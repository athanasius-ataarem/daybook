import { describe, expect, it } from 'vitest';
import {
  entryImmutableViolations,
  mergeEntryUpdate,
  dayCloseImmutableViolations,
  type StoredEntry,
} from '../src/lib/immutability';
import type { DayCloseInput, EntryInput } from '@daybook/shared/schemas';

const stored: StoredEntry = {
  businessDate: '2026-07-25',
  kind: 'SALE',
  channel: 'CASH',
  amountPesewas: 24000,
  voidedAt: null,
};

const incoming = (over: Partial<EntryInput> = {}): EntryInput => ({
  id: '8f1c0000-0000-4000-8000-000000000000',
  businessDate: '2026-07-25',
  kind: 'SALE',
  channel: 'CASH',
  amountPesewas: 24000,
  note: null,
  createdAtDevice: '2026-07-25T16:12:04.000Z',
  voidedAt: null,
  voidReason: null,
  ...over,
});

describe('entryImmutableViolations', () => {
  it('passes when nothing immutable changed', () => {
    expect(entryImmutableViolations(stored, incoming({ note: 'edited' }))).toEqual([]);
  });

  it('catches an amount change', () => {
    expect(entryImmutableViolations(stored, incoming({ amountPesewas: 25000 }))).toEqual([
      'amountPesewas',
    ]);
  });

  it('catches every changed field by name', () => {
    const fields = entryImmutableViolations(
      stored,
      incoming({
        amountPesewas: 1,
        kind: 'EXPENSE',
        channel: 'MOMO',
        businessDate: '2026-07-24',
      }),
    );
    expect(fields.sort()).toEqual(
      ['amountPesewas', 'businessDate', 'channel', 'kind'].sort(),
    );
  });
});

describe('mergeEntryUpdate — a void is write-once', () => {
  it('applies a fresh void', () => {
    const m = mergeEntryUpdate(
      { voidedAt: null },
      incoming({ voidedAt: '2026-07-25T18:00:00.000Z', voidReason: 'entered twice' }),
    );
    expect(m.voidedAt?.toISOString()).toBe('2026-07-25T18:00:00.000Z');
    expect(m.voidReason).toBe('entered twice');
  });

  it('never lets a stale device un-void an entry', () => {
    const existing = new Date('2026-07-25T18:00:00.000Z');
    const m = mergeEntryUpdate(
      { voidedAt: existing },
      incoming({ voidedAt: null, note: 'late note edit from a stale device' }),
    );
    expect(m.voidedAt).toBe(existing);
    expect(m.note).toBe('late note edit from a stale device');
  });

  it('lets a newer void timestamp win over an older one', () => {
    const m = mergeEntryUpdate(
      { voidedAt: new Date('2026-07-25T18:00:00.000Z') },
      incoming({ voidedAt: '2026-07-25T19:00:00.000Z' }),
    );
    expect(m.voidedAt?.toISOString()).toBe('2026-07-25T19:00:00.000Z');
  });
});

describe('dayCloseImmutableViolations', () => {
  const close = (over: Partial<DayCloseInput> = {}): DayCloseInput => ({
    id: 'aaaa0000-0000-4000-8000-000000000000',
    businessDate: '2026-07-25',
    openingCashPesewas: 0,
    openingMomoPesewas: 0,
    expectedCashPesewas: 124000,
    expectedMomoPesewas: 86000,
    countedCashPesewas: 121500,
    countedMomoPesewas: 86000,
    closedAt: '2026-07-25T19:00:00.000Z',
    ...over,
  });

  it('only businessDate is immutable', () => {
    expect(
      dayCloseImmutableViolations({ businessDate: '2026-07-25' }, close()),
    ).toEqual([]);
    expect(
      dayCloseImmutableViolations(
        { businessDate: '2026-07-25' },
        close({ businessDate: '2026-07-24' }),
      ),
    ).toEqual(['businessDate']);
  });
});
