import { describe, expect, it } from 'vitest';
import { resolveBusinessDate, isIsoDate } from '../src/businessDate';

// All dates constructed in device-local time, which is what the function reads.
const at = (
  y: number,
  m: number,
  d: number,
  hh: number,
  mm = 0,
  ss = 0,
): Date => new Date(y, m - 1, d, hh, mm, ss);

describe('resolveBusinessDate — the 03:00 roll', () => {
  it('02:59:59 still belongs to the previous day', () => {
    expect(resolveBusinessDate(at(2026, 7, 25, 2, 59, 59))).toBe('2026-07-24');
  });

  it('03:00:00 exactly starts the new day', () => {
    expect(resolveBusinessDate(at(2026, 7, 25, 3, 0, 0))).toBe('2026-07-25');
  });

  it('00:00:00 belongs to the previous day', () => {
    expect(resolveBusinessDate(at(2026, 7, 25, 0, 0, 0))).toBe('2026-07-24');
  });

  it('23:59:59 belongs to the same day', () => {
    expect(resolveBusinessDate(at(2026, 7, 25, 23, 59, 59))).toBe('2026-07-25');
  });

  it('rolls across a month boundary', () => {
    expect(resolveBusinessDate(at(2026, 8, 1, 1, 30, 0))).toBe('2026-07-31');
  });

  it('rolls across a year boundary', () => {
    expect(resolveBusinessDate(at(2026, 1, 1, 2, 15, 0))).toBe('2025-12-31');
  });

  it('handles 29 February', () => {
    expect(resolveBusinessDate(at(2024, 3, 1, 1, 0, 0))).toBe('2024-02-29');
    expect(resolveBusinessDate(at(2024, 2, 29, 4, 0, 0))).toBe('2024-02-29');
    expect(resolveBusinessDate(at(2024, 2, 29, 2, 0, 0))).toBe('2024-02-28');
  });
});

describe('isIsoDate', () => {
  it.each([['2026-07-25'], ['2024-02-29'], ['2026-12-31']])('accepts %s', (v) => {
    expect(isIsoDate(v)).toBe(true);
  });

  it.each([['2026-7-25'], ['2026-13-01'], ['2026-02-30'], ['2023-02-29'], ['nope']])(
    'rejects %s',
    (v) => {
      expect(isIsoDate(v)).toBe(false);
    },
  );
});
