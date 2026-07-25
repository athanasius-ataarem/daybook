import { dayTotals, expectedCash, expectedMomo } from '@daybook/shared/totals';
import type { TotalableEntry } from '@daybook/shared/totals';
import type { Pesewas } from '@daybook/shared/money';

// Pure close-of-day maths. `spanEntries` is every non-voided-or-not entry
// with businessDate after the last closed date up to and including today —
// including unclosed gap days, so a skipped day never reads as a variance.

export interface CloseComputation {
  expectedCashPesewas: Pesewas;
  expectedMomoPesewas: Pesewas;
}

export function computeExpected(
  openingCashPesewas: Pesewas,
  openingMomoPesewas: Pesewas,
  spanEntries: readonly TotalableEntry[],
): CloseComputation {
  const t = dayTotals(spanEntries);
  return {
    expectedCashPesewas: expectedCash(openingCashPesewas, t),
    expectedMomoPesewas: expectedMomo(openingMomoPesewas, t),
  };
}

export interface Variance {
  cashDiff: Pesewas; // counted − expected
  momoDiff: Pesewas;
  matched: boolean;
}

export function variance(
  expectedCashPesewas: Pesewas,
  expectedMomoPesewas: Pesewas,
  countedCashPesewas: Pesewas,
  countedMomoPesewas: Pesewas,
): Variance {
  const cashDiff = countedCashPesewas - expectedCashPesewas;
  const momoDiff = countedMomoPesewas - expectedMomoPesewas;
  return { cashDiff, momoDiff, matched: cashDiff === 0 && momoDiff === 0 };
}
