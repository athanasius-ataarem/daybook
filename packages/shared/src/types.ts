import type { Pesewas } from './money';

export type EntryKind = 'SALE' | 'EXPENSE';
export type Channel = 'CASH' | 'MOMO';

// Wire and store shape. Dates crossing a boundary are ISO strings; Date
// objects stay inside a module.
export interface Entry {
  id: string; // client UUIDv4
  businessDate: string; // "YYYY-MM-DD", device-resolved
  kind: EntryKind;
  channel: Channel;
  amountPesewas: Pesewas; // > 0 always; direction lives in `kind`
  note: string | null;
  createdAtDevice: string; // ISO datetime, device clock
  voidedAt: string | null;
  voidReason: string | null;
}

export interface DayClose {
  id: string; // client UUIDv4
  businessDate: string; // "YYYY-MM-DD"
  openingCashPesewas: Pesewas;
  openingMomoPesewas: Pesewas;
  expectedCashPesewas: Pesewas; // snapshot at close
  expectedMomoPesewas: Pesewas; // snapshot at close
  countedCashPesewas: Pesewas;
  countedMomoPesewas: Pesewas;
  closedAt: string | null; // null = re-opened
}
