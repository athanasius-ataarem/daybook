import type { DayClose, Entry } from '@daybook/shared/types';
import { getDb, notifyDbChange, type LocalDayClose, type LocalEntry } from '../db/schema';
import { getMeta, setMeta } from '../db/meta';
import {
  dueItems,
  removeItems,
  markFailed,
  markDeferred,
  removeItemsForRecord,
  allOutbox,
} from '../db/outbox';
import { deleteLocalClose } from '../db/dayCloses';

// The flush itself, shared verbatim between the window worker and the service
// worker's Background Sync handler. No window APIs in here.

const BATCH = 500;

interface SyncResponseEntry extends Entry {
  updatedAt: string;
}
interface SyncResponseClose extends DayClose {
  updatedAt: string;
}
interface RejectedItem {
  id: string;
  reason: 'IMMUTABLE_FIELD' | 'NOT_FOUND' | 'DUPLICATE_DAY' | 'VALIDATION_FAILED';
  fields?: string[];
}
interface SyncResponse {
  serverTime: string;
  entries: SyncResponseEntry[];
  dayCloses: SyncResponseClose[];
  rejected: RejectedItem[];
  hasMore: boolean;
}

export type FlushOutcome = 'ok' | 'offline' | 'unauthorized' | 'error';

function wireEntry(e: LocalEntry): Entry {
  return {
    id: e.id,
    businessDate: e.businessDate,
    kind: e.kind,
    channel: e.channel,
    amountPesewas: e.amountPesewas,
    note: e.note,
    createdAtDevice: e.createdAtDevice,
    voidedAt: e.voidedAt,
    voidReason: e.voidReason,
  };
}

function wireClose(c: LocalDayClose): DayClose {
  return {
    id: c.id,
    businessDate: c.businessDate,
    openingCashPesewas: c.openingCashPesewas,
    openingMomoPesewas: c.openingMomoPesewas,
    expectedCashPesewas: c.expectedCashPesewas,
    expectedMomoPesewas: c.expectedMomoPesewas,
    countedCashPesewas: c.countedCashPesewas,
    countedMomoPesewas: c.countedMomoPesewas,
    closedAt: c.closedAt,
  };
}

async function mergeServerRecords(data: SyncResponse): Promise<void> {
  const db = await getDb();
  // Records that still have pending outbox items are newer locally — the
  // server copy must not clobber them.
  const pendingIds = new Set((await allOutbox()).map((i) => i.recordId));
  const tx = db.transaction(['entries', 'dayCloses'], 'readwrite');
  for (const e of data.entries) {
    if (pendingIds.has(e.id)) continue;
    const { updatedAt, ...rest } = e;
    await tx.objectStore('entries').put({ ...rest, updatedAtLocal: updatedAt });
  }
  for (const c of data.dayCloses) {
    if (pendingIds.has(c.id)) continue;
    const { updatedAt, ...rest } = c;
    await tx.objectStore('dayCloses').put({ ...rest, updatedAtLocal: updatedAt });
  }
  await tx.done;
}

async function handleRejected(rejected: RejectedItem[]): Promise<void> {
  if (rejected.length === 0) return;
  const existing = (await getMeta<RejectedItem[]>('rejectedIds')) ?? [];
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const r of rejected) {
    // A rejected record can never succeed by retrying — drop its outbox items
    // but NEVER touch the local copy silently; it is listed under the dot.
    await removeItemsForRecord(r.id);
    if (r.reason === 'DUPLICATE_DAY') {
      // The server kept another device's row for that date and returned it in
      // this same response; the local duplicate is replaced, not surfaced.
      await deleteLocalClose(r.id);
      continue;
    }
    byId.set(r.id, r);
  }
  await setMeta('rejectedIds', [...byId.values()]);
}

let running: Promise<FlushOutcome> | null = null;

/** `force` = an explicit trigger (online event, foreground, mutation):
 *  backoff timestamps are ignored so recovery is immediate. */
export function flushOnce(force = false, apiBase = '/api'): Promise<FlushOutcome> {
  running ??= doFlush(force, apiBase).finally(() => {
    running = null;
  });
  return running;
}

async function doFlush(force: boolean, apiBase: string): Promise<FlushOutcome> {
  for (;;) {
    const due = await dueItems(new Date(), force);

    // Latest state per record — the outbox stores references, so a later note
    // edit flushes current state, and duplicate items collapse into one send.
    const seqsByRecord = new Map<string, number[]>();
    for (const item of due) {
      if (item.seq === undefined) continue;
      const key = `${item.recordType}:${item.recordId}`;
      const seqs = seqsByRecord.get(key) ?? [];
      seqs.push(item.seq);
      seqsByRecord.set(key, seqs);
    }

    const db = await getDb();
    const entries: Entry[] = [];
    const dayCloses: DayClose[] = [];
    const sentSeqs: number[] = [];
    let taken = 0;
    for (const [key, seqs] of seqsByRecord) {
      if (taken >= BATCH) break; // the client pages; the rest goes next round
      const [type, id] = key.split(':') as ['entry' | 'dayClose', string];
      if (type === 'entry') {
        const e = await db.get('entries', id);
        if (e) entries.push(wireEntry(e));
      } else {
        const c = await db.get('dayCloses', id);
        if (c) dayCloses.push(wireClose(c));
      }
      sentSeqs.push(...seqs);
      taken += 1;
    }

    const since = (await getMeta<string>('lastSyncAt')) ?? null;

    let res: Response;
    try {
      res = await fetch(`${apiBase}/sync`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ since, entries, dayCloses }),
      });
    } catch {
      // No network is not the item's failure — defer briefly, never park.
      if (sentSeqs.length > 0) await markDeferred(sentSeqs, 'network');
      return 'offline';
    }

    if (res.status === 401) {
      // Never sign the user out, never hide local data. Mark the session
      // stale, keep working locally, retry on the next trigger.
      await setMeta('sessionStale', true);
      return 'unauthorized';
    }
    if (!res.ok) {
      if (sentSeqs.length > 0) {
        // A dead or overloaded gateway (nginx 502/503/504) and rate limiting
        // are not the item's failure — defer, never count toward parking.
        // Genuine server errors escalate per-item backoff and park at 50.
        if ([429, 502, 503, 504].includes(res.status)) {
          await markDeferred(sentSeqs, `http ${res.status}`);
        } else {
          await markFailed(sentSeqs, `http ${res.status}`);
        }
      }
      return 'error';
    }

    const data = (await res.json()) as SyncResponse;
    await setMeta('sessionStale', false);
    if (sentSeqs.length > 0) await removeItems(sentSeqs);
    await handleRejected(data.rejected);
    await mergeServerRecords(data);
    await setMeta('lastSyncAt', data.serverTime);
    notifyDbChange();

    const stillDue = (await dueItems(new Date(), force)).length > 0;
    if (!data.hasMore && !stillDue) return 'ok';
    // hasMore, or more outbox pages: immediately go again.
  }
}
