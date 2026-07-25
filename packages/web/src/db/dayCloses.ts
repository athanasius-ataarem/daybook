import { getDb, notifyDbChange, type LocalDayClose, type OutboxItem } from './schema';

function outboxItemFor(recordId: string): OutboxItem {
  return {
    recordType: 'dayClose',
    recordId,
    op: 'upsert',
    attempts: 0,
    nextAttemptAt: new Date().toISOString(),
    lastError: null,
  };
}

/** Atomic put + outbox append, same rule as entries. */
export async function putDayClose(
  close: Omit<LocalDayClose, 'updatedAtLocal'>,
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['dayCloses', 'outbox'], 'readwrite');
  try {
    await tx
      .objectStore('dayCloses')
      .put({ ...close, updatedAtLocal: new Date().toISOString() });
    await tx.objectStore('outbox').add(outboxItemFor(close.id));
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

export async function closeForDate(businessDate: string): Promise<LocalDayClose | null> {
  const db = await getDb();
  return (await db.getFromIndex('dayCloses', 'byBusinessDate', businessDate)) ?? null;
}

/** The most recent DayClose with businessDate < the given date and closedAt
 *  set — the source of the next close's opening balances. */
export async function latestClosedBefore(
  businessDate: string,
): Promise<LocalDayClose | null> {
  const db = await getDb();
  const all = await db.getAll('dayCloses');
  let best: LocalDayClose | null = null;
  for (const c of all) {
    if (c.closedAt === null) continue;
    if (c.businessDate >= businessDate) continue;
    if (!best || c.businessDate > best.businessDate) best = c;
  }
  return best;
}

export async function anyCloseExists(): Promise<boolean> {
  const db = await getDb();
  return (await db.count('dayCloses')) > 0;
}

export async function allCloses(): Promise<LocalDayClose[]> {
  const db = await getDb();
  return db.getAll('dayCloses');
}

/** Re-open: clears closedAt but keeps the row. The snapshot does not move
 *  until the day is closed again. */
export async function reopenDay(businessDate: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(['dayCloses', 'outbox'], 'readwrite');
  const store = tx.objectStore('dayCloses');
  const close = await store.index('byBusinessDate').get(businessDate);
  if (close && close.closedAt !== null) {
    close.closedAt = null;
    close.updatedAtLocal = new Date().toISOString();
    await store.put(close);
    await tx.objectStore('outbox').add(outboxItemFor(close.id));
  }
  await tx.done;
  notifyDbChange();
}

/** Sync merge only: replace a local duplicate close (DUPLICATE_DAY). */
export async function deleteLocalClose(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('dayCloses', id);
  notifyDbChange();
}
