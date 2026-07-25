// Per-item exponential backoff: 2s, 8s, 30s, 2m, 10m, then hourly.
// After MAX_ATTEMPTS the item is parked and surfaced under the sync dot.

const STEPS = [2_000, 8_000, 30_000, 120_000, 600_000] as const;
const HOURLY = 3_600_000;

export const MAX_ATTEMPTS = 50;

/** attempts = failures so far (1-based). */
export function delayFor(attempts: number): number {
  return STEPS[attempts - 1] ?? HOURLY;
}
