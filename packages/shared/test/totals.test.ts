import { describe, expect, it } from 'vitest';
import { dayTotals, expectedCash, expectedMomo, type TotalableEntry } from '../src/totals';

const entry = (
  kind: TotalableEntry['kind'],
  channel: TotalableEntry['channel'],
  amountPesewas: number,
  voidedAt: string | null = null,
): TotalableEntry => ({ kind, channel, amountPesewas, voidedAt });

describe('dayTotals', () => {
  it('returns zeros for an empty array', () => {
    expect(dayTotals([])).toEqual({
      salesCash: 0,
      salesMomo: 0,
      expCash: 0,
      expMomo: 0,
      inTotal: 0,
      outTotal: 0,
      net: 0,
    });
  });

  it('splits by kind and channel', () => {
    const t = dayTotals([
      entry('SALE', 'CASH', 124000),
      entry('SALE', 'MOMO', 86000),
      entry('EXPENSE', 'CASH', 18000),
      entry('EXPENSE', 'MOMO', 500),
    ]);
    expect(t.salesCash).toBe(124000);
    expect(t.salesMomo).toBe(86000);
    expect(t.expCash).toBe(18000);
    expect(t.expMomo).toBe(500);
    expect(t.inTotal).toBe(210000);
    expect(t.outTotal).toBe(18500);
    expect(t.net).toBe(191500);
  });

  it('excludes voided entries entirely', () => {
    const t = dayTotals([
      entry('SALE', 'CASH', 5000),
      entry('SALE', 'CASH', 24000, '2026-07-25T11:04:00.000Z'),
      entry('EXPENSE', 'MOMO', 1000, '2026-07-25T12:00:00.000Z'),
    ]);
    expect(t.salesCash).toBe(5000);
    expect(t.expMomo).toBe(0);
    expect(t.net).toBe(5000);
  });
});

describe('expectedCash / expectedMomo', () => {
  const t = dayTotals([
    entry('SALE', 'CASH', 124000),
    entry('SALE', 'MOMO', 86000),
    entry('EXPENSE', 'CASH', 18000),
  ]);

  it('with a zero opening', () => {
    expect(expectedCash(0, t)).toBe(106000);
    expect(expectedMomo(0, t)).toBe(86000);
  });

  it('with a non-zero opening', () => {
    expect(expectedCash(50000, t)).toBe(156000);
    expect(expectedMomo(20000, t)).toBe(106000);
  });

  it('goes negative when expenses exceed sales and opening', () => {
    const heavy = dayTotals([
      entry('SALE', 'CASH', 1000),
      entry('EXPENSE', 'CASH', 9000),
    ]);
    expect(expectedCash(0, heavy)).toBe(-8000);
  });
});
