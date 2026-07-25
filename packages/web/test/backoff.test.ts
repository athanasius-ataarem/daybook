import { describe, expect, it } from 'vitest';
import { delayFor, MAX_ATTEMPTS } from '../src/sync/backoff';

describe('per-item backoff', () => {
  it('follows 2s, 8s, 30s, 2m, 10m, then hourly', () => {
    expect(delayFor(1)).toBe(2_000);
    expect(delayFor(2)).toBe(8_000);
    expect(delayFor(3)).toBe(30_000);
    expect(delayFor(4)).toBe(120_000);
    expect(delayFor(5)).toBe(600_000);
    expect(delayFor(6)).toBe(3_600_000);
    expect(delayFor(49)).toBe(3_600_000);
  });

  it('parks at 50 attempts', () => {
    expect(MAX_ATTEMPTS).toBe(50);
  });
});
