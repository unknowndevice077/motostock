/**
 * Module-level (not React state) cache for list queries, keyed by a string
 * like `parts:${shopId}`. Survives page navigation since it isn't tied to
 * any component's lifecycle, so switching back to a page you already
 * visited can paint the last-known data immediately instead of a loading
 * skeleton — then the page's own effect re-fetches in the background and
 * updates the view when fresh data lands. Standard stale-while-revalidate;
 * hand-rolled here rather than adding a data-fetching library for this
 * small an app.
 */
const cache = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value);
}

/** Drops every cached entry whose key starts with `prefix` — call after a
 * write so a stale list doesn't linger past its next background refresh. */
export function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
