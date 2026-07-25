import { describe, expect, it } from 'vitest';
import { dayTotals } from '@daybook/shared/totals';
import { buildSummary } from '../src/lib/summary';

// The exact string from docs/04_APP_FLOW.md §6, asserted character for
// character — the padding is the whole reason it reads as a record.

const entries = [
  { kind: 'SALE' as const, channel: 'CASH' as const, amountPesewas: 124000, voidedAt: null },
  { kind: 'SALE' as const, channel: 'MOMO' as const, amountPesewas: 86000, voidedAt: null },
  { kind: 'EXPENSE' as const, channel: 'CASH' as const, amountPesewas: 18000, voidedAt: null },
];

describe('buildSummary', () => {
  it('produces the documented message for the known day', () => {
    const text = buildSummary('Mawuli Pharmacy', '2026-07-25', dayTotals(entries), {
      expectedCashPesewas: 124000,
      expectedMomoPesewas: 86000,
      countedCashPesewas: 121500,
      countedMomoPesewas: 86000,
    });
    expect(text).toBe(
      [
        'MAWULI PHARMACY — Sat 25 Jul 2026',
        '',
        'Money in:   GH₵2,100.00',
        '  Cash      GH₵1,240.00',
        '  MoMo      GH₵  860.00',
        'Money out:  GH₵  180.00',
        'Net:        GH₵1,920.00',
        '',
        'Cash counted: GH₵1,215.00 (short GH₵25.00)',
        'MoMo balance: GH₵  860.00 (ok)',
        '',
        'Sent from Daybook',
      ].join('\n'),
    );
    expect(text.length).toBeLessThan(500);
  });

  it('ends after Net when the day has not been closed', () => {
    const text = buildSummary('Mawuli Pharmacy', '2026-07-25', dayTotals(entries), null);
    expect(text).toContain('Net:');
    expect(text).not.toContain('counted');
    expect(text.trimEnd().endsWith('Sent from Daybook')).toBe(true);
  });

  it('upper-cases and truncates the shop name at 28 characters', () => {
    const text = buildSummary(
      'A Very Long Shop Name That Never Ends',
      '2026-07-25',
      dayTotals([]),
      null,
    );
    const firstLine = text.split('\n')[0] ?? '';
    expect(firstLine.startsWith('A VERY LONG SHOP NAME THAT N')).toBe(true);
    expect(firstLine).toContain(' — ');
  });

  it('shows (over ...) for an overage', () => {
    const text = buildSummary('Shop', '2026-07-25', dayTotals(entries), {
      expectedCashPesewas: 124000,
      expectedMomoPesewas: 86000,
      countedCashPesewas: 124500,
      countedMomoPesewas: 86000,
    });
    expect(text).toContain('(over GH₵5.00)');
  });
});
