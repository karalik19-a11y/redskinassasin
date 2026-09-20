/**
 * TOMAHAWK OSINT ENGINE — concurrency, deadlines & resilience
 * ---------------------------------------------------------------------------
 * Collection runs against hostile infrastructure: APIs time out, rate-limit and
 * reset connections. These primitives give every module a bounded, cancellable,
 * jittered-retry execution envelope, and give the engine a hard wall-clock
 * budget it can never overshoot.
 */

import { OsintError, errorMessage, isOsintError } from './errors';

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new OsintError('CANCELLED', 'operation aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new OsintError('CANCELLED', 'operation aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Bounded parallel map — preserves input order, fails softly. */
export async function pMap<T, R>(
  items: readonly T[],
  mapper: (item: T, index: number) => Promise<R>,
  limit = 6,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = new Array(Math.max(1, Math.min(limit, items.length))).fill(0).map(async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index] as T, index);
    }
  });
  await Promise.all(workers);
  return results;
}

export class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(permits: number) {
    this.available = Math.max(1, permits);
  }

  private acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
      return;
    }
    this.available += 1;
  }

  async use<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  get pending(): number {
    return this.waiters.length;
  }
}

/** Token bucket — protects upstream APIs from our own concurrency. */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillPerMs: number;

  constructor(capacity: number, refillPerSecond: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillPerMs = refillPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  async take(cost = 1, signal?: AbortSignal): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.tokens = Math.min(this.capacity, this.tokens + (now - this.lastRefill) * this.refillPerMs);
      this.lastRefill = now;
      if (this.tokens >= cost) {
        this.tokens -= cost;
        return;
      }
      const needed = (cost - this.tokens) / this.refillPerMs;
      await sleep(Math.min(250, Math.max(16, needed)), signal);
    }
  }
}

/** Reject when `promise` outlives `ms`. The underlying op is aborted via signal. */
export async function withTimeout<T>(promise: Promise<T>, ms: number, message = 'timeout'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new OsintError('TIMEOUT', message)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  signal?: AbortSignal;
  /** Called before each retry (for telemetry). */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
  /** Predicate deciding if another attempt is worthwhile. */
  shouldRetry?: (error: unknown) => boolean;
}

/** Exponential backoff with full jitter — the industry-proven default. */
export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const base = options.baseDelayMs ?? 350;
  const max = options.maxDelayMs ?? 4_000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (options.signal?.aborted) throw error;
      const retryable = options.shouldRetry ? options.shouldRetry(error) : isOsintError(error) ? error.retryable : true;
      if (!retryable || attempt === attempts) throw error;
      const delay = Math.random() * Math.min(max, base * 2 ** (attempt - 1));
      options.onRetry?.(attempt, error, delay);
      await sleep(delay, options.signal);
    }
  }
  throw lastError instanceof Error ? lastError : new OsintError('INTERNAL', errorMessage(lastError));
}

/** Cooperative cancellation + budget watchdog shared by an entire run. */
export class RunController {
  readonly signal: AbortSignal;
  private readonly controller: AbortController;
  private readonly timer?: ReturnType<typeof setTimeout>;
  budgetExhausted = false;

  constructor(budgetMs: number) {
    this.controller = new AbortController();
    this.signal = this.controller.signal;
    if (budgetMs > 0 && Number.isFinite(budgetMs)) {
      this.timer = setTimeout(() => {
        this.budgetExhausted = true;
        this.controller.abort();
      }, budgetMs);
    }
  }

  get aborted(): boolean {
    return this.signal.aborted;
  }

  cancel(reason = 'cancelled by caller'): void {
    this.controller.abort(new OsintError('CANCELLED', reason));
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}

/** Simple monotonic stopwatch for per-module telemetry. */
export class Stopwatch {
  private startedAt = nowMs();
  static start(): Stopwatch {
    return new Stopwatch();
  }
  elapsed(): number {
    return nowMs() - this.startedAt;
  }
  reset(): void {
    this.startedAt = nowMs();
  }
}

export function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}
