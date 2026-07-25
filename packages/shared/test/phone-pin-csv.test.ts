import { describe, expect, it } from 'vitest';
import { normalizeGhPhone } from '../src/phone';
import { isWeakPin } from '../src/pin';
import { buildEntriesCsv, csvFilename } from '../src/csv';
import type { Entry } from '../src/types';

describe('normalizeGhPhone', () => {
  it.each([
    ['0241234567', '+233241234567'],
    ['241234567', '+233241234567'],
    ['+233241234567', '+233241234567'],
    ['233241234567', '+233241234567'],
    ['024 123 4567', '+233241234567'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeGhPhone(input)).toBe(expected);
  });

  it.each([['12345'], ['02412345678'], ['abc'], ['+44123456789012']])(
    'rejects %s',
    (input) => {
      expect(() => normalizeGhPhone(input)).toThrow();
    },
  );
});

describe('isWeakPin', () => {
  it.each([['0000'], ['1234'], ['1111'], ['2580'], ['1987'], ['2026'], ['6969']])(
    'flags %s as weak',
    (pin) => {
      expect(isWeakPin(pin)).toBe(true);
    },
  );

  it.each([['4726'], ['0417'], ['8305']])('allows %s', (pin) => {
    expect(isWeakPin(pin)).toBe(false);
  });
});

describe('buildEntriesCsv', () => {
  const entries: Entry[] = [
    {
      id: 'b2c3d4e5-0000-4000-8000-000000000002',
      businessDate: '2026-07-25',
      kind: 'SALE',
      channel: 'CASH',
      amountPesewas: 24000,
      note: 'Paracetamol carton',
      createdAtDevice: '2026-07-25T16:12:04.000Z',
      voidedAt: null,
      voidReason: null,
    },
    {
      id: 'a1b2c3d4-0000-4000-8000-000000000001',
      businessDate: '2026-07-25',
      kind: 'SALE',
      channel: 'CASH',
      amountPesewas: 5000,
      note: null,
      createdAtDevice: '2026-07-25T11:04:00.000Z',
      voidedAt: '2026-07-25T11:05:00.000Z',
      voidReason: 'entered twice',
    },
  ];

  it('produces the documented format, sorted, voided included', () => {
    expect(buildEntriesCsv(entries)).toBe(
      'business_date,time,kind,channel,amount_ghs,note,voided,void_reason\r\n' +
        '2026-07-25,11:04,SALE,CASH,50.00,,yes,entered twice\r\n' +
        '2026-07-25,16:12,SALE,CASH,240.00,Paracetamol carton,no,\r\n',
    );
  });

  it('escapes commas and quotes in notes', () => {
    const withComma: Entry = {
      ...entries[0]!,
      note: 'nails, 3", assorted',
    };
    const csv = buildEntriesCsv([withComma]);
    expect(csv).toContain('"nails, 3"", assorted"');
  });

  it('builds the documented filename', () => {
    expect(csvFilename('Mawuli Pharmacy', '2026-07-25')).toBe(
      'daybook-mawuli-pharmacy-2026-07-25.csv',
    );
  });
});
