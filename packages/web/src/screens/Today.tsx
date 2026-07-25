import { useState, type ReactNode } from 'react';
import { dayTotals } from '@daybook/shared/totals';
import { formatGhs } from '@daybook/shared/money';
import { resolveBusinessDate } from '@daybook/shared/businessDate';
import { entriesForDate, voidEntry, updateNote } from '../db/entries';
import { closeForDate } from '../db/dayCloses';
import type { LocalEntry } from '../db/schema';
import { useDbData } from '../lib/useDbData';
import { useApp } from '../AppContext';
import { dayLabel } from '../lib/format';
import { Link } from '../lib/router';
import { requestFlush } from '../sync/worker';
import { EntryRow } from '../components/EntryRow';
import { PositionBlock } from '../components/PositionBlock';
import { SyncDot } from '../components/SyncDot';
import { Sheet } from '../components/Sheet';
import { OverflowMenu } from '../components/OverflowMenu';
import { InstallBar } from '../components/InstallBar';
import Entry from './Entry';
import CloseDay from './CloseDay';

export default function Today(): ReactNode {
  const { shopName } = useApp();
  const today = resolveBusinessDate(new Date());
  const entries = useDbData(() => entriesForDate(today), [today]) ?? [];
  const close = useDbData(() => closeForDate(today), [today]);
  const totals = dayTotals(entries);
  const closed = close?.closedAt != null;

  const [entryOpen, setEntryOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<LocalEntry | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [noteTarget, setNoteTarget] = useState<LocalEntry | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);

  const confirmVoid = async (): Promise<void> => {
    if (!voidTarget) return;
    await voidEntry(voidTarget.id, voidReason.trim() ? voidReason.trim() : null);
    requestFlush();
    setVoidTarget(null);
    setVoidReason('');
  };

  const saveNote = async (): Promise<void> => {
    if (!noteTarget) return;
    await updateNote(noteTarget.id, noteDraft.trim() ? noteDraft.trim() : null);
    requestFlush();
    setNoteTarget(null);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <InstallBar />

      <header className="flex items-center justify-between border-b border-rule px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{shopName}</p>
          <p className="text-[12px] text-ink-60">Today · {dayLabel(today)}</p>
        </div>
        <div className="flex items-center">
          <SyncDot />
          <button
            type="button"
            aria-label="Menu"
            className="h-11 w-11 text-[20px] text-ink-60"
            onClick={() => setMenuOpen(true)}
          >
            ⋮
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-40 pt-3">
        <PositionBlock totals={totals} />

        <p className="lbl mb-1 mt-6 border-b border-rule pb-2">Today's entries</p>
        {entries.length === 0 ? (
          <p className="py-8 text-center text-[15px] text-ink-60">
            No entries yet today. Tap + to record your first sale.
          </p>
        ) : (
          <ul>
            {entries.map((e, i) => (
              <li
                key={e.id}
                className={i < entries.length - 1 ? 'border-b border-rule' : ''}
              >
                <EntryRow
                  entry={e}
                  animateIn={e.id === lastSavedId}
                  onVoid={(en) => {
                    setVoidTarget(en);
                    setVoidReason('');
                  }}
                  onEditNote={(en) => {
                    setNoteTarget(en);
                    setNoteDraft(en.note ?? '');
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </main>

      <div className="fixed inset-x-0 bottom-14 z-10 mx-auto max-w-md px-4 pb-3">
        {closed ? (
          <button
            type="button"
            className="h-12 w-full rounded border border-rule bg-card text-[15px] text-ink-60"
            onClick={() => setCloseOpen(true)}
          >
            Day closed · view summary
          </button>
        ) : (
          <button
            type="button"
            disabled={entries.length === 0}
            className="h-12 w-full rounded border-2 border-ink bg-paper text-[15px] font-semibold disabled:border-rule disabled:text-ink-60"
            onClick={() => setCloseOpen(true)}
          >
            {entries.length === 0
              ? 'There is nothing to close yet. Record a sale first.'
              : 'Close the day'}
          </button>
        )}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 mx-auto flex h-14 max-w-md items-center border-t border-rule bg-paper"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <span className="flex-1 text-center text-[12px] font-semibold">Today</span>
        <Link to="/history" className="flex-1 text-center text-[12px] text-ink-60">
          History
        </Link>
        <span className="w-24" aria-hidden />
      </nav>

      <button
        type="button"
        aria-label="Record money"
        className="fixed bottom-7 right-4 z-20 h-16 w-16 rounded-full bg-ink text-[28px] leading-none text-white shadow-md"
        onClick={() => setEntryOpen(true)}
      >
        +
      </button>

      <Entry
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        onSaved={setLastSavedId}
      />
      <CloseDay open={closeOpen} onClose={() => setCloseOpen(false)} date={today} />
      <OverflowMenu open={menuOpen} onClose={() => setMenuOpen(false)} />

      <Sheet
        open={voidTarget !== null}
        onClose={() => setVoidTarget(null)}
        label="Void entry"
      >
        {voidTarget && (
          <div className="p-4 pb-8">
            <h2 className="text-[17px] font-semibold">
              Void this {formatGhs(voidTarget.amountPesewas)} entry?
            </h2>
            <p className="mt-1 text-[15px] text-ink-60">
              It stays visible, struck through. It never disappears.
            </p>
            <input
              type="text"
              maxLength={200}
              placeholder="Reason (optional)"
              aria-label="Void reason"
              className="mt-4 h-11 w-full rounded border border-rule bg-card px-3 text-[15px] outline-none"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
            />
            <button
              type="button"
              className="mt-4 h-12 w-full rounded bg-short font-semibold text-white"
              onClick={() => void confirmVoid()}
            >
              Void
            </button>
            <button
              type="button"
              className="mt-2 h-12 w-full rounded text-[15px] text-ink-60"
              onClick={() => setVoidTarget(null)}
            >
              Cancel
            </button>
          </div>
        )}
      </Sheet>

      <Sheet
        open={noteTarget !== null}
        onClose={() => setNoteTarget(null)}
        label="Edit note"
      >
        {noteTarget && (
          <div className="p-4 pb-8">
            <h2 className="text-[17px] font-semibold">Edit note</h2>
            <input
              type="text"
              autoFocus
              maxLength={200}
              aria-label="Note"
              className="mt-4 h-11 w-full rounded border border-rule bg-card px-3 text-[15px] outline-none"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
            />
            <button
              type="button"
              className="mt-4 h-12 w-full rounded bg-ink font-semibold text-white"
              onClick={() => void saveNote()}
            >
              Save
            </button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
