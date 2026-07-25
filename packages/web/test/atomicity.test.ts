import { describe, expect, it } from 'vitest';
import { addEntry, allEntries } from '../src/db/entries';
import { allOutbox } from '../src/db/outbox';

const input = {
  businessDate: '2026-07-25',
  kind: 'SALE' as const,
  channel: 'CASH' as const,
  amountPesewas: 24000,
  note: 'Paracetamol carton',
};

describe('the atomic record-plus-outbox write', () => {
  it('one mutation produces the record AND its outbox item', async () => {
    const entry = await addEntry(input);
    const entries = await allEntries();
    const outbox = await allOutbox();
    expect(entries).toHaveLength(1);
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.recordId).toBe(entry.id);
    expect(outbox[0]?.recordType).toBe('entry');
    expect(outbox[0]?.attempts).toBe(0);
  });

  it('a failure while appending to the outbox rolls the entry back too', async () => {
    // If this were two transactions, the entry would survive the outbox
    // failure and exist locally while never syncing — the worst possible
    // failure for this product.
    const original = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (
      this: IDBObjectStore,
      ...args: [unknown, IDBValidKey?]
    ) {
      if (this.name === 'outbox') throw new Error('simulated outbox failure');
      return original.apply(this, args as [unknown]);
    };
    try {
      await expect(addEntry(input)).rejects.toThrow('simulated outbox failure');
    } finally {
      IDBObjectStore.prototype.add = original;
    }
    expect(await allEntries()).toHaveLength(0);
    expect(await allOutbox()).toHaveLength(0);
  });
});
