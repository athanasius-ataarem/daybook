// Date and time display helpers. Amounts format ONLY through the shared
// money module.

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** "2026-07-25" -> "Sat 25 Jul" */
export function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return `${DAYS[d.getDay()] ?? ''} ${d.getDate()} ${MONTHS[d.getMonth()] ?? ''}`;
}

/** "2026-07-25" -> "Sat 25 Jul 2026" */
export function dayLabelFull(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return `${dayLabel(isoDate)} ${d.getFullYear()}`;
}

/** "2026-07-25" -> "25 Jul" */
export function dayLabelShort(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()] ?? ''}`;
}

/** ISO datetime -> "4:12 pm" (device-local clock). */
export function time12(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  let h = d.getHours();
  const suffix = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${suffix}`;
}

/** ISO date arithmetic without timezone traps. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
