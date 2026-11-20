/** ISO string for a local wall-clock time (month is 1-based), so tests hold in any time zone. */
export function local(y: number, m: number, d: number, h = 9, min = 0): string {
  return new Date(y, m - 1, d, h, min).toISOString();
}
