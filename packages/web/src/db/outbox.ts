import { getDb, notifyDbChange, type OutboxItem } from './schema';
import { MAX_ATTEMPTS, delayFor } from '../sync/backoff';

export async function pendingCount(): Promise<number> {
  const db = await getDb();
  return db.count('outbox');
}

export async function allOutbox(): Promise<OutboxItem[]> {
  const db = await getDb();
  return db.getAll('outbox');
}

/** Items whose backoff has elapsed and that are not parked. An explicit
 *  trigger (online event, foreground, a fresh mutation) passes ignoreBackoff
 *  so recovery is immediate — the backoff schedule only paces the automatic
 *  interval retries. */
export async function dueItems(
  now: Date = new Date(),
  ignoreBackoff = false,
): Promise<OutboxItem[]> {
  const all = await allOutbox();
  const nowIso = now.toISOString();
  return all.filter(
    (i) => i.attempts < MAX_ATTEMPTS && (ignoreBackoff || i.nextAttemptAt <= nowIso),
  );
}

/** Items that hit the attempt cap — parked and surfaced under the sync dot. */
export async function parkedItems(): Promise<OutboxItem[]> {
  const all = await allOutbox();
  return all.filter((i) => i.attempts >= MAX_ATTEMPTS);
}

export async function removeItems(seqs: number[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('outbox', 'readwrite');
  for (const seq of seqs) await tx.store.delete(seq);
  await tx.done;
  notifyDbChange();
}

/** Per-item exponential backoff after a real server failure (5xx / 429).
 *  These attempts count toward parking at MAX_ATTEMPTS. */
export async function markFailed(seqs: number[], error: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('outbox', 'readwrite');
  const now = Date.now();
  for (const seq of seqs) {
    const item = await tx.store.get(seq);
    if (!item) continue;
    item.attempts += 1;
    item.lastError = error;
    item.nextAttemptAt = new Date(now + delayFor(item.attempts)).toISOString();
    await tx.store.put(item);
  }
  await tx.done;
  notifyDbChange();
}

/** No network at all is not the item's failure: never counts toward parking,
 *  just a short debounce so an offline device is not hammering fetch. */
export async function markDeferred(seqs: number[], error: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('outbox', 'readwrite');
  const next = new Date(Date.now() + 5_000).toISOString();
  for (const seq of seqs) {
    const item = await tx.store.get(seq);
    if (!item) continue;
    item.lastError = error;
    item.nextAttemptAt = next;
    await tx.store.put(item);
  }
  await tx.done;
  notifyDbChange();
}

/** Remove every outbox item pointing at a record id (after a rejection —
 *  retrying can never succeed). */
export async function removeItemsForRecord(recordId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('outbox', 'readwrite');
  const all = await tx.store.getAll();
  for (const item of all) {
    if (item.recordId === recordId && item.seq !== undefined) {
      await tx.store.delete(item.seq);
    }
  }
  await tx.done;
  notifyDbChange();
}
