/**
 * TOMAHAWK OSINT ENGINE — resilient HTTP gateway
 * ---------------------------------------------------------------------------
 * One entry point for every outbound request, providing:
 *   • per-host token-bucket rate limiting (we are a guest on other people's APIs)
 *   • TTL caching with request coalescing (via `Cache`)
 *   • retry with full-jitter backoff, timeouts, AbortSignal propagation
 *   • CORS transit fallback with provenance (`via`) so every fact records how
 *     it was delivered
 *   • request/failure counters for run telemetry and honest reporting
 *   • `probe()` for existence checks with soft-404 detection — the correct way
 *     to verify "does this account exist?" rather than trusting status codes
 */

import { OsintError, errorCode, errorMessage } from '../core/errors';
import { TokenBucket, withRetry } from '../core/concurrency';
import type { Cache } from '../core/cache';
import type { HttpGateway, HttpProbeResult, HttpRequestOptions } from '../types/module';
import { detectRelayError, resolveTransitChain } from './transit';

export interface HttpMetrics {
  requests: number;
  failures: number;
  cacheHits: number;
  byHost: Record<string, { ok: number; failed: number; avgMs: number }>;
  lastError?: { url: string; message: string; via?: string };
}

export interface HttpClientOptions {
  cache: Cache;
  transit: string[];
  offline?: boolean;
  timeoutMs?: number;
  userAgent?: string;
  /** Absolute ceiling on requests per run, protecting budgets. */
  maxRequests?: number;
  fetchImpl?: typeof fetch;
  /** Hard wall-clock limit; requests started after it fail fast. */
  deadline?: number;
  signal?: AbortSignal;
  onRequest?: (info: { url: string; via: string; status: number; ms: number; cached: boolean }) => void;
}

const DEFAULT_HOST_TPS = 4;

export class HttpClient implements HttpGateway {
  private readonly options: HttpClientOptions;
  private readonly buckets = new Map<string, TokenBucket>();
  private readonly metrics: HttpMetrics = { requests: 0, failures: 0, cacheHits: 0, byHost: {} };
  /**
   * Provenance ledger: which transport delivered which URL. Modules and the
   * engine read it back so every evidence record can state its delivery path
   * ("via: codetabs") instead of silently presenting relayed data as direct.
   */
  private readonly transports = new Map<string, string>();
  readonly offline: boolean;

  constructor(options: HttpClientOptions) {
    this.options = options;
    this.offline = options.offline ?? false;
  }

  counters(): HttpMetrics {
    return { ...this.metrics, byHost: { ...this.metrics.byHost } };
  }

  /** Transport used for a URL (exact match first, then host match). */
  viaOf(url: string): string | undefined {
    if (!url) return undefined;
    const exact = this.transports.get(url);
    if (exact) return exact;
    try {
      const host = new URL(url).host;
      for (const [key, via] of this.transports) {
        if (key.includes(host)) return via;
      }
    } catch {
      /* not a URL — nothing to report */
    }
    return undefined;
  }

  private bucketFor(host: string): TokenBucket {
    const existing = this.buckets.get(host);
    if (existing) return existing;
    const bucket = new TokenBucket(6, DEFAULT_HOST_TPS);
    this.buckets.set(host, bucket);
    return bucket;
  }

  private assertBudget(): void {
    if (this.offline) throw new OsintError('NETWORK_UNAVAILABLE', 'Сетевой доступ отключён (offline mode)');
    if (this.options.deadline && Date.now() > this.options.deadline) throw new OsintError('BUDGET_EXHAUSTED', 'Бюджет времени расследования исчерпан');
    if (this.options.maxRequests && this.metrics.requests >= this.options.maxRequests) {
      throw new OsintError('BUDGET_EXHAUSTED', `Достигнут лимит запросов (${this.options.maxRequests})`);
    }
  }

  private async fetchWithTransit(
    url: string,
    init: { method: 'GET' | 'HEAD'; headers: Record<string, string> },
    options: HttpRequestOptions,
  ): Promise<{ body: string; status: number; contentType: string; via: string }> {
    const chain = resolveTransitChain(options.transit ?? this.options.transit);
    const errors: string[] = [];
    const fetchImpl = this.options.fetchImpl ?? globalThis.fetch;

    if (typeof fetchImpl !== 'function') throw new OsintError('NETWORK_UNAVAILABLE', 'fetch() недоступен в этой среде');

    for (const provider of chain) {
      this.assertBudget();
      const rewritten = provider.rewrite({ url, method: provider.supportsHead ? init.method : 'GET', headers: init.headers });
      const host = safeHost(rewritten.url);
      await this.bucketFor(host).take(1, options.signal ?? this.options.signal);

      const timeout = options.timeoutMs ?? this.options.timeoutMs ?? 12_000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new OsintError('TIMEOUT', `Таймаут ${timeout} мс: ${url}`)), timeout);
      const abortBridge = () => controller.abort(new OsintError('CANCELLED', 'run cancelled'));
      (options.signal ?? this.options.signal)?.addEventListener('abort', abortBridge, { once: true });
      const startedAt = Date.now();

      try {
        const response = await fetchImpl(rewritten.url, {
          method: rewritten.method,
          headers: {
            'user-agent': this.options.userAgent ?? 'TomahawkOSINT/1.0',
            ...(init.headers ?? {}),
            ...(rewritten.headers ?? {}),
          },
          signal: controller.signal,
          redirect: 'follow',
          credentials: 'omit',
          mode: 'cors',
        });

        const contentType = response.headers.get('content-type') ?? '';
        const text = await response.text();
        const unwrapped = provider.unwrap ? provider.unwrap(text, contentType) : text;
        this.record(host, Date.now() - startedAt, true, rewritable(provider.id));

        if (!response.ok && !options.allowErrorStatus) {
          const relayError = detectRelayError(unwrapped);
          errors.push(`${provider.id}: HTTP ${response.status}${relayError ? ` (${relayError})` : ''}`);
          // A 404/410 from the origin is authoritative — do not mask it with relays.
          if (response.status === 404 || response.status === 410) {
            throw new OsintError('HTTP_ERROR', `HTTP ${response.status}`, { url, retryable: false });
          }
          continue;
        }
        return { body: unwrapped, status: response.status, contentType, via: provider.id };
      } catch (error) {
        this.record(host, Date.now() - startedAt, false, rewritable(provider.id));
        if (errorCode(error) === 'CANCELLED') throw error;
        if (error instanceof OsintError && error.code === 'HTTP_ERROR' && !error.retryable) throw error;
        errors.push(`${provider.id}: ${errorMessage(error)}`);
      } finally {
        clearTimeout(timer);
        (options.signal ?? this.options.signal)?.removeEventListener('abort', abortBridge);
      }
    }

    const isCors = errors.every((entry) => /failed to fetch|network|load failed|typeerror/i.test(entry));
    this.metrics.lastError = { url, message: errors.join(' | ').slice(0, 400) };
    throw new OsintError(
      isCors ? 'BLOCKED' : 'NETWORK_UNAVAILABLE',
      `Все транспорты недоступны для ${url}: ${errors.join(' | ').slice(0, 300)}`,
      { url, retryable: !isCors },
    );
  }

  private record(host: string, ms: number, ok: boolean, via: string): void {
    const entry = (this.metrics.byHost[host] ??= { ok: 0, failed: 0, avgMs: 0 });
    if (ok) entry.ok += 1;
    else entry.failed += 1;
    entry.avgMs = Math.round(entry.avgMs === 0 ? ms : (entry.avgMs * 3 + ms) / 4);
    this.options.onRequest?.({ url: host, via, status: ok ? 200 : 0, ms, cached: false });
  }

  async text(url: string, init: HttpRequestOptions = {}): Promise<string> {
    this.assertBudget();
    const cacheKey = `http:text:${url}`;
    const ttl = init.cacheTtlMs ?? 0;

    const run = async (): Promise<string> => {
      this.metrics.requests += 1;
      const result = await withRetry(() => this.fetchWithTransit(url, { method: 'GET', headers: init.headers ?? {} }, init), {
        attempts: 2,
        signal: init.signal ?? this.options.signal,
        shouldRetry: (error) => errorCode(error) !== 'BLOCKED' && errorCode(error) !== 'CANCELLED',
      });
      this.transports.set(url, result.via);
      return result.body;
    };

    if (ttl > 0) {
      const cached = this.options.cache.get<string>(cacheKey);
      if (cached !== undefined) {
        this.metrics.cacheHits += 1;
        return cached;
      }
      const value = await this.options.cache.remember(cacheKey, ttl, run);
      return value;
    }
    try {
      return await run();
    } catch (error) {
      this.metrics.failures += 1;
      throw error;
    }
  }

  async json<T = unknown>(url: string, init: HttpRequestOptions = {}): Promise<T> {
    const body = await this.text(url, { ...init, headers: { accept: 'application/json, text/plain, */*', ...(init.headers ?? {}) } });
    const trimmed = body.trim();
    // Some relays wrap payloads in JSONP-ish envelopes; strip them defensively.
    const cleaned = trimmed.replace(/^[a-zA-Z0-9_.]+\((.*)\);?$/s, '$1');
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      throw new OsintError('PARSE_ERROR', `Ответ не является корректным JSON (${trimmed.slice(0, 120)}…)`, { url, retryable: false });
    }
  }

  /** Parses `text/html` for OpenGraph/meta payloads without a DOM. */
  async html(url: string, init: HttpRequestOptions = {}): Promise<string> {
    return this.text(url, { ...init, headers: { accept: 'text/html,application/xhtml+xml', ...(init.headers ?? {}) } });
  }

  /**
   * Existence probe with soft-404 detection. Many platforms return HTTP 200 with
   * an "account not found" page, so status alone is not evidence. We compare the
   * response against known negative markers and look for the queried name.
   */
  async probe(url: string, init: HttpRequestOptions = {}): Promise<HttpProbeResult> {
    const startedAt = Date.now();
    const name = init.expect === 'any' ? '' : (new URL(url).pathname.split('/').filter(Boolean).pop() ?? '');
    try {
      const body = await this.text(url, { ...init, allowErrorStatus: true, cacheTtlMs: init.cacheTtlMs ?? 0 });
      const lower = body.toLowerCase();
      const softNotFound = SOFT_404_MARKERS.some((marker) => lower.includes(marker)) || lower.trim().length < 120;
      return {
        url,
        ok: true,
        status: 200,
        reachable: true,
        markers: { softNotFound, containsName: name ? lower.includes(name.toLowerCase()) : undefined },
        elapsedMs: Date.now() - startedAt,
      };
    } catch (error) {
      const status = /HTTP (\d{3})/.exec(errorMessage(error))?.[1];
      return {
        url,
        ok: false,
        status: status ? Number(status) : 0,
        reachable: status ? Number(status) < 500 : false,
        markers: { softNotFound: status === '404' },
        elapsedMs: Date.now() - startedAt,
        error: errorMessage(error),
      };
    }
  }
}

const SOFT_404_MARKERS = [
  'page not found', 'not found', 'user not found', 'no such user', 'профиль не найден', 'страница не найдена',
  "this account doesn't exist", 'account suspended', 'sorry, nobody on mastodon', 'error 404', '404 not found',
  'this page could not be found', 'пользователь не найден',
];

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'invalid';
  }
}

function rewritable(id: string): string {
  return id === 'direct' ? 'origin' : id;
}
