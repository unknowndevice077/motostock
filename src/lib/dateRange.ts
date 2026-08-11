/** Whether an ISO timestamp falls within a "yyyy-mm-dd" from/to range
 * (either end optional, both inclusive — `to` covers the whole day). */
export function isWithinDateRange(isoDate: string, from: string, to: string): boolean {
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return true; // no date recorded — don't hide it over a filter bug
  if (from) {
    const fromTime = new Date(`${from}T00:00:00`).getTime();
    if (t < fromTime) return false;
  }
  if (to) {
    const toTime = new Date(`${to}T23:59:59.999`).getTime();
    if (t > toTime) return false;
  }
  return true;
}
