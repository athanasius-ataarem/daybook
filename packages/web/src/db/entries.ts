import type { Channel, EntryKind } from '@daybook/shared/types';
import { getDb, notifyDbChange, type LocalEntry, type OutboxItem } from './schema';

// Every mutation writes the record AND appends to the outbox inside a single
// readwrite transaction spanning both stores. If that is not atomic, an entry
// can exist locally and never sync — the worst possible failure. Asserted by
// a test.

function outboxItemFor(recordId: string): OutboxItem {
  return {
    recordType: 'entry',
    recordId,
    op: 'upsert',
    attempts: 0,
    nextAttemptAt: new Date().toISOString(),
    lastError: null,
  };
}

export interface NewEntry {
  businessDate: string;
  kind: EntryKind;
  channel: Channel;
  amountPesewas: number;
  note: string | null;
}

export async function addEntry(input: NewEntry): Promise<LocalEntry> {
  const now = new Date().toISOString();
  const entry: LocalEntry = {
    id: crypto.randomUUID(),
    businessDate: input.businessDate,
    kind: input.kind,
    channel: input.channel,
    amountPesewas: input.amountPesewas,
    note: input.note,
    createdAtDevice: now,
    voidedAt: null,
    voidReason: null,
    updatedAtLocal: now,
  };
  const db = await getDb();
  const tx = db.transaction(['entries', 'outbox'], 'readwrite');
  try {
    await tx.objectStore('entries').put(entry);
    await tx.objectStore('outbox').add(outboxItemFor(entry.id));
    await tx.done;
  } catch (err) {
    try {
      tx.abort();
    } catch {
      /* already aborted */
    }
    await tx.done.catch(() => undefined);
    throw err;
  }
  notifyDbChange();
  return entry;
}

export async function voidEntry(id: string, reason: string | null): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['entries', 'outbox'], 'readwrite');
  try {
    const store = tx.objectStore('entries');
    const entry = await store.get(id);
    if (entry && entry.voidedAt === null) {
      const now = new Date().toISOString();
      entry.voidedAt = now;
      entry.voidReason = reason;
      entry.updatedAtLocal = now;
      await store.put(entry);
      await tx.objectStore('outbox').add(outboxItemFor(id));
    }
    await tx.done;
  } catch (err) {
    try {
      tx.abort();
    } catch {
      /* already aborted */
    }
    await tx.done.catch(() => undefined);
    throw err;
  }
  notifyDbChange();
}

export async function updateNote(id: string, note: string | null): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['entries', 'outbox'], 'readwrite');
  try {
    const store = tx.objectStore('entries');
    const entry = await store.get(id);
    if (entry) {
      entry.note = note;
      entry.updatedAtLocal = new Date().toISOString();
      await store.put(entry);
      await tx.objectStore('outbox').add(outboxItemFor(id));
    }
    await tx.done;
  } catch (err) {
    try {
      tx.abort();
    } catch {
      /* already aborted */
    }
    await tx.done.catch(() => undefined);
    throw err;
  }
  notifyDbChange();
}

/** Newest first, for the Today list. */
export async function entriesForDate(businessDate: string): Promise<LocalEntry[]> {
  const db = await getDb();
  const rows = await db.getAllFromIndex('entries', 'byBusinessDate', businessDate);
  return rows.sort((a, b) => b.createdAtDevice.localeCompare(a.createdAtDevice));
}

/**
 * Entries with businessDate in (afterDate, throughDate], oldest date first.
 * `afterDate: null` means everything up to throughDate — used by close-of-day
 * so unclosed gap days are always included in the expected.
 */
export async function entriesAfterDate(
  afterDate: string | null,
  throughDate: string,
): Promise<LocalEntry[]> {
  const db = await getDb();
  const range =
    afterDate === null
      ? IDBKeyRange.upperBound(throughDate)
      : IDBKeyRange.bound(afterDate, throughDate, true, false);
  return db.getAllFromIndex('entries', 'byBusinessDate', range);
}

/** Distinct business dates present in entries, newest first. */
export async function entryDates(limit: number): Promise<string[]> {
  const db = await getDb();
  const dates: string[] = [];
  let cursor = await db
    .transaction('entries')
    .store.index('byBusinessDate')
    .openKeyCursor(null, 'prevunique');
  while (cursor && dates.length < limit) {
    dates.push(cursor.key);
    cursor = await cursor.continue();
  }
  return dates;
}

export async function allEntries(): Promise<LocalEntry[]> {
  const db = await getDb();
  return db.getAll('entries');
}
