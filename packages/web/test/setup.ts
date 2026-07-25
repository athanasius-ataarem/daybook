import 'fake-indexeddb/auto';
import { beforeEach } from 'vitest';
import { destroyDb } from '../src/db/schema';

beforeEach(async () => {
  await destroyDb();
});
