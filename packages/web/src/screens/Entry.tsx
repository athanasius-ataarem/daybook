import { useEffect, useState, type ReactNode } from 'react';
import { parseGhs } from '@daybook/shared/money';
import { resolveBusinessDate } from '@daybook/shared/businessDate';
import type { Channel, EntryKind } from '@daybook/shared/types';
import { Sheet } from '../components/Sheet';
import { Keypad, displayAmount } from '../components/Keypad';
import { SegmentToggle } from '../components/SegmentToggle';
import { addEntry } from '../db/entries';
import { closeForDate } from '../db/dayCloses';
import { getMeta, setMeta } from '../db/meta';
import { useDbData } from '../lib/useDbData';
import { requestFlush } from '../sync/worker';
import { saveTick } from '../lib/haptic';
import { addDays, dayLabelShort } from '../lib/format';

// The entry sheet. Five sales in a row without the thumb leaving the lower
// third of the screen. On save: haptic tick, sheet closes, row animates in.
// No toast, no dialog, no navigation.

export default function Entry(props: {
  open: boolean;
  onClose: () => void;
  onSaved: (id: string) => void;
}): ReactNode {
  const today = resolveBusinessDate(new Date());
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState<EntryKind>('SALE');
  const [channel, setChannel] = useState<Channel>('CASH');
  const [date, setDate] = useState(today);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!props.open) return;
    setAmount('');
    setKind('SALE');
    setDate(resolveBusinessDate(new Date()));
    setNoteOpen(false);
    setNote('');
    void getMeta<Channel>('lastChannel').then((c) => {
      if (c) setChannel(c);
    });
  }, [props.open]);

  const dateClose = useDbData(() => closeForDate(date), [date]);
  const dateClosed = dateClose?.closedAt != null;

  let pesewas = 0;
  try {
    pesewas = amount === '' ? 0 : parseGhs(amount);
  } catch {
    pesewas = 0;
  }

  const save = async (): Promise<void> => {
    if (pesewas <= 0) return;
    const entry = await addEntry({
      businessDate: date,
      kind,
      channel,
      amountPesewas: pesewas,
      note: noteOpen && note.trim() ? note.trim().slice(0, 200) : null,
    });
    await setMeta('lastChannel', channel);
    saveTick();
    requestFlush(); // fire-and-forget — never awaited by the UI
    props.onSaved(entry.id);
    props.onClose();
  };

  return (
    <Sheet open={props.open} onClose={props.onClose} label="Record money" full>
      <div className="mx-auto flex h-full max-w-md flex-col p-4">
        <button
          type="button"
          aria-label="Close"
          className="h-11 w-11 self-start text-[17px] text-ink-60"
          onClick={props.onClose}
        >
          ✕
        </button>

        <p className="amt mt-2 text-right text-[48px] leading-none" aria-live="polite">
          GH₵{displayAmount(amount)}
        </p>

        <label className="mt-2 flex items-center justify-end gap-1 text-[15px] text-ink-60">
          <span>
            {date === today ? 'Today · ' : ''}
            {dayLabelShort(date)}
          </span>
          <input
            type="date"
            aria-label="Business date"
            className="w-6 opacity-0"
            value={date}
            min={addDays(today, -90)}
            max={addDays(today, 1)}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
          <span aria-hidden className="-ml-5">▾</span>
        </label>

        {dateClosed && (
          <p className="mt-2 text-right text-[13px] text-ink-60">
            This day is already closed. Re-open it to update the summary.
          </p>
        )}

        <div className="mt-4 space-y-3">
          <SegmentToggle
            legend="Direction"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'SALE', label: 'Money in', activeClass: 'bg-ink text-white' },
              { value: 'EXPENSE', label: 'Money out', activeClass: 'bg-ink text-white' },
            ]}
          />
          <SegmentToggle
            legend="Channel"
            value={channel}
            onChange={setChannel}
            options={[
              { value: 'CASH', label: 'Cash', activeClass: 'bg-cash text-white' },
              {
                value: 'MOMO',
                label: 'MoMo',
                activeClass: 'bg-momo text-white',
                inactiveClass: 'font-semibold text-momo',
              },
            ]}
          />
        </div>

        <div className="mt-3 min-h-[44px]">
          {noteOpen ? (
            <input
              type="text"
              autoFocus
              maxLength={200}
              placeholder="Note"
              aria-label="Note"
              className="h-11 w-full rounded border border-rule bg-card px-3 text-[15px] outline-none"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          ) : (
            <button
              type="button"
              className="h-11 text-[13px] text-ink underline"
              onClick={() => setNoteOpen(true)}
            >
              Add note
            </button>
          )}
        </div>

        <div className="mt-auto">
          <Keypad value={amount} onChange={setAmount} />
          <button
            type="button"
            disabled={pesewas <= 0}
            className="mt-3 h-14 w-full rounded bg-ink text-[17px] font-semibold text-white disabled:opacity-40"
            onClick={() => void save()}
          >
            Save
          </button>
        </div>
      </div>
    </Sheet>
  );
}
