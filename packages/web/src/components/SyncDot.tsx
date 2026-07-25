import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { getSyncStatus, subscribeSyncStatus, type SyncStatus } from '../sync/worker';
import { Sheet } from './Sheet';
import { useDbData } from '../lib/useDbData';
import { getMeta } from '../db/meta';
import { parkedItems } from '../db/outbox';
import { getDb } from '../db/schema';
import { formatGhs } from '@daybook/shared/money';

// One 8px dot in the header. Never a modal, never a banner, never a spinner.

const DOT_CLASS: Record<SyncStatus['state'], string> = {
  saved: 'bg-cash',
  pending: 'bg-momo',
  offline: 'bg-ink-60',
  rejected: 'bg-short',
};

function label(s: SyncStatus): string {
  switch (s.state) {
    case 'saved':
      return 'All your records are saved.';
    case 'pending':
      return s.pending === 1
        ? '1 entry will save when you have network.'
        : `${s.pending} entries will save when you have network.`;
    case 'offline':
      return 'No network. Your records are safe on this phone.';
    case 'rejected':
      return s.rejected === 1
        ? '1 entry could not save. Tap to see.'
        : `${s.rejected} entries could not save. Tap to see.`;
  }
}

interface RejectedRow {
  id: string;
  text: string;
}

async function loadRejectedRows(): Promise<RejectedRow[]> {
  const ids = new Set<string>();
  const metaRejected = (await getMeta<{ id: string }[]>('rejectedIds')) ?? [];
  for (const r of metaRejected) ids.add(r.id);
  for (const p of await parkedItems()) ids.add(p.recordId);
  const db = await getDb();
  const rows: RejectedRow[] = [];
  for (const id of ids) {
    const e = await db.get('entries', id);
    rows.push({
      id,
      text: e ? `${formatGhs(e.amountPesewas)} · ${e.note ?? e.kind}` : id,
    });
  }
  return rows;
}

export function SyncDot(): ReactNode {
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  const [open, setOpen] = useState(false);
  const rejectedRows = useDbData(loadRejectedRows, [status.state]) ?? [];

  return (
    <>
      <button
        type="button"
        aria-label={label(status)}
        className="flex h-11 w-11 items-center justify-center"
        onClick={() => setOpen(true)}
      >
        <span aria-hidden className={`h-2 w-2 rounded-full ${DOT_CLASS[status.state]}`} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Saving status">
        <div className="p-4 pb-8">
          <p className="text-[17px]">{label(status)}</p>
          {status.state === 'rejected' && rejectedRows.length > 0 && (
            <div className="mt-3 border-t border-rule pt-3">
              <p className="lbl mb-2">These could not save</p>
              <ul className="space-y-2">
                {rejectedRows.map((r) => (
                  <li key={r.id} className="text-[15px] text-ink-60">
                    {r.text}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[15px]">
                Show this to your Daybook contact.
              </p>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
