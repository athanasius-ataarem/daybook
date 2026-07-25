import { getDb, type MetaKey } from './schema';

export async function getMeta<T>(key: MetaKey): Promise<T | null> {
  const db = await getDb();
  const row = await db.get('meta', key);
  return row ? (row.value as T) : null;
}

export async function setMeta(key: MetaKey, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put('meta', { key, value });
}

export async function delMeta(key: MetaKey): Promise<void> {
  const db = await getDb();
  await db.delete('meta', key);
}
