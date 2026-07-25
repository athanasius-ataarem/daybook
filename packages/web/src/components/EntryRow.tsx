import { useRef, useState, type ReactNode } from 'react';
import { formatGhs } from '@daybook/shared/money';
import type { LocalEntry } from '../db/schema';
import { time12 } from '../lib/format';

// One ledger row. Swipe left reveals Void; long-press opens the note editor.
// Voided rows stay in place, struck through and dimmed. They never move or hide.

const LONG_PRESS_MS = 500;
const REVEAL_PX = 88;

export function EntryRow(props: {
  entry: LocalEntry;
  animateIn?: boolean;
  onVoid: (entry: LocalEntry) => void;
  onEditNote: (entry: LocalEntry) => void;
}): ReactNode {
  const { entry } = props;
  const [offset, setOffset] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const timer = useRef<number | null>(null);
  const voided = entry.voidedAt !== null;
  const colour = entry.channel === 'CASH' ? 'text-cash' : 'text-momo';
  const sign = entry.kind === 'SALE' ? '+' : '−';
  const channelWord = entry.channel === 'CASH' ? 'Cash' : 'MoMo';
  const kindWord = entry.kind === 'SALE' ? 'Sale' : 'Expense';

  const clearTimer = (): void => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const onTouchStart = (e: React.TouchEvent): void => {
    const t = e.touches[0];
    if (!t) return;
    start.current = { x: t.clientX, y: t.clientY };
    if (!voided) {
      timer.current = window.setTimeout(() => props.onEditNote(entry), LONG_PRESS_MS);
    }
  };
  const onTouchMove = (e: React.TouchEvent): void => {
    const t = e.touches[0];
    if (!t || !start.current) return;
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimer();
    if (!voided && dx < 0 && Math.abs(dx) > Math.abs(dy)) {
      setOffset(Math.max(dx, -REVEAL_PX));
    }
  };
  const onTouchEnd = (): void => {
    clearTimer();
    setOffset(offset < -REVEAL_PX / 2 ? -REVEAL_PX : 0);
    start.current = null;
  };

  return (
    <div className={`relative overflow-hidden ${props.animateIn ? 'row-in' : ''}`}>
      {!voided && (
        <button
          type="button"
          className="absolute inset-y-0 right-0 w-[88px] bg-short text-[15px] font-semibold text-white"
          style={{ opacity: offset < 0 ? 1 : 0 }}
          tabIndex={offset < 0 ? 0 : -1}
          onClick={() => {
            setOffset(0);
            props.onVoid(entry);
          }}
        >
          Void
        </button>
      )}
      <div
        className={`bg-paper py-3 transition-transform ${voided ? 'opacity-45' : ''}`}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onContextMenu={(e) => {
          if (!voided) {
            e.preventDefault();
            props.onEditNote(entry);
          }
        }}
      >
        <div className="flex items-baseline justify-between">
          <span className="flex items-baseline gap-3">
            <span
              className={`amt text-[22px] ${colour} ${voided ? 'line-through' : ''}`}
            >
              {sign}
              {formatGhs(entry.amountPesewas)}
            </span>
            {voided && <span className="lbl text-short">VOIDED</span>}
          </span>
          <span className="text-[11px] text-ink-60">{time12(entry.createdAtDevice)}</span>
        </div>
        <p className="mt-0.5 text-[15px] text-ink-60">
          {channelWord} · {entry.note ?? kindWord}
          {voided && entry.voidReason ? ` — ${entry.voidReason}` : ''}
        </p>
      </div>
    </div>
  );
}
