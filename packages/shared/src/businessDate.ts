// The trading day rolls at 03:00 device time: a shop that closes at 1am calls
// that the same day. Ghana is UTC+0 with no DST, so no timezone library —
// everything reads the device's local clock.

export const DAY_ROLL_HOUR = 3;

/** Device time -> "YYYY-MM-DD" business date, with the 03:00 roll. */
export function resolveBusinessDate(deviceNow: Date): string {
  const shifted = new Date(deviceNow.getTime());
  shifted.setHours(shifted.getHours() - DAY_ROLL_HOUR);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, '0');
  const d = String(shifted.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  if (m < 1 || m > 12) return false;
  const daysInMonth = new Date(y, m, 0).getDate();
  return d >= 1 && d <= daysInMonth;
}
