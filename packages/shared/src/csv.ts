import { formatGhsPlain } from './money';
import type { Entry } from './types';

// One row per entry, voided ones included, ordered by businessDate then
// createdAtDevice. Used by BOTH the server export and the offline client
// export — one formatter, one format.

const HEADER = 'business_date,time,kind,channel,amount_ghs,note,voided,void_reason';

function csvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function timeOf(isoDateTime: string): string {
  // Ghana is UTC+0, and createdAtDevice is stamped by the device, so the UTC
  // clock face is the local clock face. Using UTC keeps server and client
  // exports identical regardless of where they run.
  const d = new Date(isoDateTime);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function buildEntriesCsv(entries: readonly Entry[]): string {
  const sorted = [...entries].sort(
    (a, b) =>
      a.businessDate.localeCompare(b.businessDate) ||
      a.createdAtDevice.localeCompare(b.createdAtDevice),
  );
  const rows = sorted.map((e) =>
    [
      e.businessDate,
      timeOf(e.createdAtDevice),
      e.kind,
      e.channel,
      formatGhsPlain(e.amountPesewas),
      csvField(e.note ?? ''),
      e.voidedAt === null ? 'no' : 'yes',
      csvField(e.voidReason ?? ''),
    ].join(','),
  );
  return [HEADER, ...rows].join('\r\n') + '\r\n';
}

export function csvFilename(shopName: string, isoDate: string): string {
  const slug =
    shopName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'shop';
  return `daybook-${slug}-${isoDate}.csv`;
}
