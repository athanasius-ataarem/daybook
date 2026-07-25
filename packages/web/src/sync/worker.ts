import { flushOnce } from './flushCore';
import { getMeta } from '../db/meta';
import { pendingCount, parkedItems } from '../db/outbox';
import { subscribeDb } from '../db/schema';

// The window-side outbox worker: flush triggers, and the observable status
// that drives the sync dot. The dot is the ONLY surface for all of this.

export type SyncState = 'saved' | 'pending' | 'offline' | 'rejected';

export interface SyncStatus {
  state: SyncState;
  pending: number;
  rejected: number;
}

let status: SyncStatus = { state: 'saved', pending: 0, rejected: 0 };
const listeners = new Set<() => void>();

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setStatus(next: SyncStatus): void {
  if (
    next.state === status.state &&
    next.pending === status.pending &&
    next.rejected === status.rejected
  ) {
    return;
  }
  status = next;
  for (const l of listeners) l();
}

async function recomputeStatus(lastOutcome?: string): Promise<void> {
  const pending = await pendingCount();
  const rejectedIds = (await getMeta<unknown[]>('rejectedIds')) ?? [];
  const parked = await parkedItems();
  const rejected = rejectedIds.length + parked.length;
  let state: SyncState;
  if (rejected > 0) state = 'rejected';
  else if (!navigator.onLine || lastOutcome === 'offline') state = 'offline';
  else if (pending > 0) state = 'pending';
  else state = 'saved';
  setStatus({ state, pending, rejected });
}

let flushing = false;

export async function runFlush(force = true): Promise<void> {
  if (flushing) return;
  if (!force) {
    const pending = await pendingCount();
    const last = await getMeta<string>('lastSyncAt');
    if (pending === 0 && last && Date.now() - Date.parse(last) < 60_000) return;
  }
  flushing = true;
  try {
    const outcome = await flushOnce(force);
    await recomputeStatus(outcome);
  } finally {
    flushing = false;
  }
}

/** Fire-and-forget — never awaited by the UI. */
export function requestFlush(): void {
  void runFlush(true);
  // Workbox-style Background Sync where the platform has it; the interval
  // and event triggers below are the fallback that always exists.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) =>
        'sync' in reg
          ? (
              reg as ServiceWorkerRegistration & {
                sync: { register: (tag: string) => Promise<void> };
              }
            ).sync.register('daybook-flush')
          : undefined,
      )
      .catch(() => undefined);
  }
}

let initialised = false;

export function initSync(): void {
  if (initialised) return;
  initialised = true;
  window.addEventListener('online', () => void runFlush(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void runFlush(true);
  });
  window.setInterval(() => void runFlush(false), 60_000);
  subscribeDb(() => void recomputeStatus());
  void recomputeStatus();
  void runFlush(true);
}
