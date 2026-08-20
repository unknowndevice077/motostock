/**
 * Races a promise against a timeout so a stalled network call (a slow/
 * waking-up Supabase project, a dropped connection, ...) can never hang a UI
 * action forever with no way out — the caller gets a clear rejection instead
 * of an indefinite spinner. supabase-js's query builders are thenables, not
 * real Promises, so this wraps with Promise.resolve() first.
 */
export function withTimeout<T>(thenable: PromiseLike<T>, ms: number, label = "Request"): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out — check your internet connection and try again.`)), ms);
    Promise.resolve(thenable).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
