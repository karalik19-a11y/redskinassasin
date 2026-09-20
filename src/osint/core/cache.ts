/**
 * TOMAHAWK OSINT ENGINE — caching layer
 * ---------------------------------------------------------------------------
 * Collection is expensive and rate-limited, so every network call is cached
 * through a pluggable store. The default store is an LRU + TTL map; hosts can
 * drop in IndexedDB, localStorage (browser), Redis (server) or a test spy by
 * implementing `CacheStore`.
 */

export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
}

export interface CacheStore {
  get<T>(key: string): CacheEntry<T> | undefined;
  set<T>(key: string, value: T, ttlMs: number): void;
  delete(key: string): void;
  clear(): void;
  readonly size: number;
}

export interface CacheHitEvent {
  key: string;
  ttlMs: number;
}

export class MemoryCacheStore implements CacheStore {
  private readonly maxEntries: number;
  private readonly map = new Map<string, CacheEntry>();

  constructor(maxEntries = 500) {
    this.maxEntries = Math.max(16, maxEntries);
  }

  get size(): number {
    return this.map.size;
  }

  get<T>(key: string): CacheEntry<T> | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    // LRU refresh
    this.map.delete(key);
    entry.hits += 1;
    this.map.set(key, entry);
    return entry as CacheEntry<T>;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (ttlMs <= 0) return;
    if (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next();
      if (!oldest.done) this.map.delete(oldest.value);
    }
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs, createdAt: Date.now(), hits: 0 });
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  /** Introspection for dashboards. */
  stats(): { size: number; fresh: number; expired: number } {
    let fresh = 0;
    let expired = 0;
    const now = Date.now();
    for (const entry of this.map.values()) {
      if (entry.expiresAt > now) fresh += 1;
      else expired += 1;
    }
    return { size: this.map.size, fresh, expired };
  }
}

/** Persistence adapter for browser hosts (survives reloads, TTL preserved). */
export class KeyValueCacheStore implements CacheStore {
  private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
  private readonly namespace: string;

  constructor(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>, namespace = 'tomahawk_osint_cache') {
    this.storage = storage;
    this.namespace = namespace;
  }

  private physical(key: string): string {
    return `${this.namespace}:${key}`;
  }

  get size(): number {
    let count = 0;
    for (let i = 0; i < this.storage.length; i += 1) {
      const key = this.storage.key(i);
      if (key && key.startsWith(`${this.namespace}:`)) count += 1;
    }
    return count;
  }

  get<T>(key: string): CacheEntry<T> | undefined {
    try {
      const raw = this.storage.getItem(this.physical(key));
      if (!raw) return undefined;
      const entry = JSON.parse(raw) as CacheEntry<T>;
      if (entry.expiresAt <= Date.now()) {
        this.storage.removeItem(this.physical(key));
        return undefined;
      }
      return entry;
    } catch {
      return undefined;
    }
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (ttlMs <= 0) return;
    try {
      const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs, createdAt: Date.now(), hits: 0 };
      this.storage.setItem(this.physical(key), JSON.stringify(entry));
    } catch {
      /* quota exceeded — degrade silently to uncached mode */
    }
  }

  delete(key: string): void {
    try {
      this.storage.removeItem(this.physical(key));
    } catch {
      /* ignore */
    }
  }

  clear(): void {
    try {
      const doomed: string[] = [];
      for (let i = 0; i < this.storage.length; i += 1) {
        const key = this.storage.key(i);
        if (key && key.startsWith(`${this.namespace}:`)) doomed.push(key);
      }
      for (const key of doomed) this.storage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export interface CacheStats {
  hits: number;
  misses: number;
  stores: number;
}

/**
 * Namespaced facade used by the engine and modules. Adds hit/miss metrics and
 * request coalescing: two concurrent identical lookups share one promise
 * (prevents the classic "6 modules hit the same API at once" thundering herd).
 */
export class Cache {
  private readonly store: CacheStore;
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly stats: CacheStats = { hits: 0, misses: 0, stores: 0 };
  private readonly onHit?: (event: CacheHitEvent) => void;

  constructor(store: CacheStore, onHit?: (event: CacheHitEvent) => void) {
    this.store = store;
    this.onHit = onHit;
  }

  get<T>(key: string): T | undefined {
    const entry = this.store.get<T>(key);
    if (entry) {
      this.stats.hits += 1;
      this.onHit?.({ key, ttlMs: Math.max(0, entry.expiresAt - Date.now()) });
      return entry.value;
    }
    this.stats.misses += 1;
    return undefined;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.stats.stores += 1;
    this.store.set(key, value, ttlMs);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }

  get size(): number {
    return this.store.size;
  }

  counters(): CacheStats {
    return { ...this.stats };
  }

  /** Read-through with coalescing. */
  async remember<T>(key: string, ttlMs: number, producer: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;

    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = (async () => {
      try {
        const value = await producer();
        if (value !== undefined && value !== null) this.set(key, value, ttlMs);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return promise;
  }
}

export function createCache(maxEntries = 500, onHit?: (event: CacheHitEvent) => void): Cache {
  return new Cache(new MemoryCacheStore(maxEntries), onHit);
}
