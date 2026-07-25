import type { DayCloseInput, EntryInput } from '@daybook/shared/schemas';

// The append-only guard, as pure functions so the rule is unit-testable
// without a database. `stored` is the wire-shaped record already in Postgres.

export interface StoredEntry {
  businessDate: string; // "YYYY-MM-DD"
  kind: string;
  channel: string;
  amountPesewas: number;
  voidedAt: Date | null;
}

const ENTRY_IMMUTABLE = ['amountPesewas', 'kind', 'channel', 'businessDate'] as const;

export function entryImmutableViolations(
  stored: StoredEntry,
  incoming: EntryInput,
): string[] {
  const fields: string[] = [];
  for (const f of ENTRY_IMMUTABLE) {
    if (stored[f] !== incoming[f]) fields.push(f);
  }
  return fields;
}

/**
 * The three mutable fields, last-write-wins — except a stored non-null
 * voidedAt is never overwritten with null. A void is write-once.
 */
export function mergeEntryUpdate(
  stored: Pick<StoredEntry, 'voidedAt'>,
  incoming: EntryInput,
): { note: string | null; voidedAt: Date | null; voidReason: string | null } {
  const incomingVoidedAt = incoming.voidedAt === null ? null : new Date(incoming.voidedAt);
  const voidedAt = stored.voidedAt !== null && incomingVoidedAt === null
    ? stored.voidedAt
    : incomingVoidedAt;
  return { note: incoming.note, voidedAt, voidReason: incoming.voidReason };
}

export interface StoredDayClose {
  businessDate: string; // "YYYY-MM-DD"
}

/** For a DayClose only businessDate is immutable; balances and closedAt are
 *  last-write-wins (re-open and re-close legitimately rewrite the snapshot). */
export function dayCloseImmutableViolations(
  stored: StoredDayClose,
  incoming: DayCloseInput,
): string[] {
  return stored.businessDate !== incoming.businessDate ? ['businessDate'] : [];
}
