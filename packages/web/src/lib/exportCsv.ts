import { buildEntriesCsv, csvFilename } from '@daybook/shared/csv';
import { resolveBusinessDate } from '@daybook/shared/businessDate';
import { allEntries } from '../db/entries';
import { getMeta } from '../db/meta';

/** The offline export path: straight from IndexedDB, same shared formatter
 *  as the server route. Works with no network at all. */
export async function exportCsvFromDevice(): Promise<void> {
  const entries = await allEntries();
  const shopName = (await getMeta<string>('shopName')) ?? 'shop';
  const csv = buildEntriesCsv(entries);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = csvFilename(shopName, resolveBusinessDate(new Date()));
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
