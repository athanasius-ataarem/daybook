import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DayClose, Entry } from '@daybook/shared/types';

// Database `daybook`, version 1, four stores. Records mirror the server shape
// exactly, plus a local-only updatedAtLocal used for ordering.

export interface LocalEntry extends Entry {
  updatedAtLocal: string;
}

export interface LocalDayClose extends DayClose {
  updatedAtLocal: string;
}

export interface OutboxItem {
  seq?: number; // autoIncrement
  recordType: 'entry' | 'dayClose';
  recordId: string; // a REFERENCE, not a payload copy — a later edit flushes current state
  op: 'upsert';
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
}

export type MetaKey =
  | 'lastSyncAt'
  | 'userId'
  | 'shopName'
  | 'lastChannel'
  | 'sessionStale'
  | 'rejectedIds'
  | 'installDismissed';

export interface MetaRow {
  key: MetaKey;
  value: unknown;
}

export interface DaybookDB extends DBSchema {
  entries: {
    key: string;
    value: LocalEntry;
    indexes: { byBusinessDate: string; byUpdatedAt: string };
  };
  dayCloses: {
    key: string;
    value: LocalDayClose;
    indexes: { byBusinessDate: string };
  };
  outbox: {
    key: number;
    value: OutboxItem;
  };
  meta: {
    key: string;
    value: MetaRow;
  };
}

let dbPromise: Promise<IDBPDatabase<DaybookDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<DaybookDB>> {
  dbPromise ??= openDB<DaybookDB>('daybook', 1, {
    upgrade(db) {
      const entries = db.createObjectStore('entries', { keyPath: 'id' });
      entries.createIndex('byBusinessDate', 'businessDate');
      entries.createIndex('byUpdatedAt', 'updatedAtLocal');
      const closes = db.createObjectStore('dayCloses', { keyPath: 'id' });
      closes.createIndex('byBusinessDate', 'businessDate', { unique: true });
      db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
      db.createObjectStore('meta', { keyPath: 'key' });
    },
  });
  return dbPromise;
}

/** Sign-out / account deletion: destroy the local database entirely. */
export async function destroyDb(): Promise<void> {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
  await deleteDB('daybook');
}

// A tiny change bus so screens re-read from IndexedDB after any write.
type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;

export function notifyDbChange(): void {
  version += 1;
  for (const l of listeners) l();
}

export function subscribeDb(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dbVersion(): number {
  return version;
}
