import type { Pesewas } from './money';
import type { Channel, EntryKind } from './types';

// The reconciliation maths. Voided entries never count. Totals are always
// computed from the entries at hand — never cached, never stored, except for
// the one snapshot a DayClose takes at close time.

export interface TotalableEntry {
  kind: EntryKind;
  channel: Channel;
  amountPesewas: Pesewas;
  voidedAt: string | null;
}

export interface DayTotals {
  salesCash: Pesewas;
  salesMomo: Pesewas;
  expCash: Pesewas;
  expMomo: Pesewas;
  inTotal: Pesewas;
  outTotal: Pesewas;
  net: Pesewas;
}

export function dayTotals(entries: readonly TotalableEntry[]): DayTotals {
  let salesCash = 0;
  let salesMomo = 0;
  let expCash = 0;
  let expMomo = 0;
  for (const e of entries) {
    if (e.voidedAt !== null) continue;
    if (e.kind === 'SALE') {
      if (e.channel === 'CASH') salesCash += e.amountPesewas;
      else salesMomo += e.amountPesewas;
    } else {
      if (e.channel === 'CASH') expCash += e.amountPesewas;
      else expMomo += e.amountPesewas;
    }
  }
  const inTotal = salesCash + salesMomo;
  const outTotal = expCash + expMomo;
  return { salesCash, salesMomo, expCash, expMomo, inTotal, outTotal, net: inTotal - outTotal };
}

// At close time the caller computes `t` over every non-voided entry with a
// businessDate after the last closed date up to and including today — not
// today alone — so unclosed gap days never produce a phantom variance.

export function expectedCash(opening: Pesewas, t: DayTotals): Pesewas {
  return opening + t.salesCash - t.expCash;
}

export function expectedMomo(opening: Pesewas, t: DayTotals): Pesewas {
  return opening + t.salesMomo - t.expMomo;
}
