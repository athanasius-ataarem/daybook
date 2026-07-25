import { describe, expect, it } from 'vitest';
import { addEntry, entriesAfterDate } from '../src/db/entries';
import { closeForDate, latestClosedBefore, putDayClose, reopenDay, allCloses } from '../src/db/dayCloses';
import { computeExpected } from '../src/lib/closeMath';

// The invariant the product's credibility rests on: a DayClose snapshots its
// expected values, and a backdated entry never moves a past reconciliation.

const DAY1 = '2026-07-20';
const DAY2 = '2026-07-21';
const DAY3 = '2026-07-22';

async function closeDay(
  date: string,
  countedCash: number,
  countedMomo: number,
): Promise<void> {
  const last = await latestClosedBefore(date);
  const openingCash = last ? last.countedCashPesewas : 0;
  const openingMomo = last ? last.countedMomoPesewas : 0;
  const span = await entriesAfterDate(last?.businessDate ?? null, date);
  const exp = computeExpected(openingCash, openingMomo, span);
  const existing = await closeForDate(date);
  await putDayClose({
    id: existing?.id ?? crypto.randomUUID(),
    businessDate: date,
    openingCashPesewas: openingCash,
    openingMomoPesewas: openingMomo,
    expectedCashPesewas: exp.expectedCashPesewas,
    expectedMomoPesewas: exp.expectedMomoPesewas,
    countedCashPesewas: countedCash,
    countedMomoPesewas: countedMomo,
    closedAt: new Date().toISOString(),
  });
}

describe('close of day', () => {
  it('adversarial: a backdated entry never moves a closed snapshot; re-close does', async () => {
    await addEntry({
      businessDate: DAY1,
      kind: 'SALE',
      channel: 'CASH',
      amountPesewas: 10_000,
      note: null,
    });
    await closeDay(DAY1, 10_000, 0);

    const snapshot = await closeForDate(DAY1);
    expect(snapshot?.expectedCashPesewas).toBe(10_000);

    // Backdate an entry onto the closed day.
    await addEntry({
      businessDate: DAY1,
      kind: 'SALE',
      channel: 'CASH',
      amountPesewas: 5_000,
      note: 'backdated',
    });

    // The snapshot must be unchanged.
    const after = await closeForDate(DAY1);
    expect(after?.expectedCashPesewas).toBe(10_000);
    expect(after?.closedAt).not.toBeNull();

    // Re-open and re-close: now it reflects the new entry.
    await reopenDay(DAY1);
    expect((await closeForDate(DAY1))?.closedAt).toBeNull();
    await closeDay(DAY1, 15_000, 0);
    const reclosed = await closeForDate(DAY1);
    expect(reclosed?.expectedCashPesewas).toBe(15_000);

    // Same date, still exactly one DayClose row.
    expect((await allCloses()).filter((c) => c.businessDate === DAY1)).toHaveLength(1);
  });

  it('an unclosed gap day is included in the next close, so it never reads as a variance', async () => {
    await addEntry({
      businessDate: DAY1,
      kind: 'SALE',
      channel: 'CASH',
      amountPesewas: 100_000,
      note: null,
    });
    await closeDay(DAY1, 100_000, 0);

    // Day 2 trades but never closes.
    await addEntry({
      businessDate: DAY2,
      kind: 'SALE',
      channel: 'CASH',
      amountPesewas: 50_000,
      note: null,
    });
    // Day 3 trades and closes.
    await addEntry({
      businessDate: DAY3,
      kind: 'SALE',
      channel: 'CASH',
      amountPesewas: 20_000,
      note: null,
    });

    const last = await latestClosedBefore(DAY3);
    expect(last?.businessDate).toBe(DAY1);
    const span = await entriesAfterDate(last?.businessDate ?? null, DAY3);
    const exp = computeExpected(last?.countedCashPesewas ?? 0, 0, span);
    // 100,000 counted Monday + 50,000 (gap Tuesday) + 20,000 (Wednesday).
    expect(exp.expectedCashPesewas).toBe(170_000);
  });

  it('a day with only expenses goes negative from a zero opening', async () => {
    await addEntry({
      businessDate: DAY1,
      kind: 'EXPENSE',
      channel: 'CASH',
      amountPesewas: 7_000,
      note: 'fuel',
    });
    const span = await entriesAfterDate(null, DAY1);
    const exp = computeExpected(0, 0, span);
    expect(exp.expectedCashPesewas).toBe(-7_000);
  });

  it('a zero counted cash records as zero, not as missing', async () => {
    await addEntry({
      businessDate: DAY1,
      kind: 'SALE',
      channel: 'MOMO',
      amountPesewas: 4_000,
      note: null,
    });
    await closeDay(DAY1, 0, 4_000);
    const c = await closeForDate(DAY1);
    expect(c?.countedCashPesewas).toBe(0);
    expect(c?.countedMomoPesewas).toBe(4_000);
  });

  it('voided entries never count toward expected', async () => {
    const e = await addEntry({
      businessDate: DAY1,
      kind: 'SALE',
      channel: 'CASH',
      amountPesewas: 9_999,
      note: null,
    });
    const { voidEntry } = await import('../src/db/entries');
    await voidEntry(e.id, 'entered twice');
    const span = await entriesAfterDate(null, DAY1);
    expect(computeExpected(0, 0, span).expectedCashPesewas).toBe(0);
  });
});
