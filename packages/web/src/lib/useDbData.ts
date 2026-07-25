import { useEffect, useState, useSyncExternalStore } from 'react';
import { dbVersion, subscribeDb } from '../db/schema';

/** Re-runs an IndexedDB read whenever anything is written. The UI reads only
 *  from IndexedDB — never from a network response. */
export function useDbData<T>(
  load: () => Promise<T>,
  deps: unknown[] = [],
): T | undefined {
  const version = useSyncExternalStore(subscribeDb, dbVersion);
  const [data, setData] = useState<T>();
  useEffect(() => {
    let alive = true;
    void load().then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
    // deps is intentionally spread: callers pass the values their loader closes over.
  }, [version, ...deps]);
  return data;
}
