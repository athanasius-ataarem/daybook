// Date <-> ISO conversions at the API boundary. Prisma returns @db.Date
// columns as Date objects at UTC midnight; the wire format is "YYYY-MM-DD".

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** businessDate must sit within 90 days past and 1 day future. */
export function businessDateInRange(isoDate: string, now: Date = new Date()): boolean {
  const d = fromIsoDate(isoDate).getTime();
  const DAY = 24 * 60 * 60 * 1000;
  return d >= now.getTime() - 90 * DAY && d <= now.getTime() + 1 * DAY;
}
