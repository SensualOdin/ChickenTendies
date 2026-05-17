// Bounded TTL Map: evicts entries after `ttlMs` (rolling on each set) and
// caps total entries at `maxEntries` using insertion-order LRU. Replaces
// unbounded `new Map()` caches that would slowly leak memory in long-running
// server processes.

type Entry<V> = {
  value: V;
  expiresAt: number;
};

export class TtlMap<K, V> {
  private readonly store = new Map<K, Entry<V>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(opts: { ttlMs: number; maxEntries?: number; sweepIntervalMs?: number }) {
    this.ttlMs = opts.ttlMs;
    this.maxEntries = opts.maxEntries ?? 10_000;
    const sweepInterval = opts.sweepIntervalMs ?? opts.ttlMs;
    this.sweepTimer = setInterval(() => this.sweep(), sweepInterval);
    this.sweepTimer.unref?.();
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): this {
    this.store.delete(key);
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    if (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value as K | undefined;
      if (oldestKey !== undefined) this.store.delete(oldestKey);
    }
    return this;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  get size(): number {
    return this.store.size;
  }

  *entries(): IterableIterator<[K, V]> {
    const now = Date.now();
    for (const [k, e] of this.store) {
      if (e.expiresAt > now) yield [k, e.value];
    }
  }

  *keys(): IterableIterator<K> {
    for (const [k] of this.entries()) yield k;
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries();
  }

  private sweep() {
    const now = Date.now();
    for (const [k, e] of this.store) {
      if (e.expiresAt <= now) this.store.delete(k);
    }
  }

  dispose() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }
}
