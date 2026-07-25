import type { ReactNode } from 'react';
import { dayTotals } from '@daybook/shared/totals';
import { formatGhs, formatGhsPlain } from '@daybook/shared/money';
import { entriesForDate } from '../db/entries';
import { closeForDate, reopenDay } from '../db/dayCloses';
import { useDbData } from '../lib/useDbData';
import { dayLabel, time12 } from '../lib/format';
import { navigate } from '../lib/router';
import { variance } from '../lib/closeMath';
import { requestFlush } from '../sync/worker';

// A past day, read-only: its entries and its close summary.

export default function DayView(props: { date: string }): ReactNode {
  const entries = useDbData(() => entriesForDate(props.date), [props.date]) ?? [];
  const close = useDbData(() => closeForDate(props.date), [props.date]);
  const totals = dayTotals(entries);
  const closed = close?.closedAt != null;
  const v = close
    ? variance(
        close.expectedCashPesewas,
        close.expectedMomoPesewas,
        close.countedCashPesewas,
        close.countedMomoPesewas,
      )
    : null;

  return (
    <div className="mx-auto min-h-screen max-w-md pb-10">
      <header className="flex items-center gap-2 border-b border-rule px-2 py-3">
        <button
          type="button"
          aria-label="Back"
          className="h-11 w-11 text-[20px]"
          onClick={() => navigate('/history')}
        >
          ←
        </button>
        <div>
          <p className="text-[15px] font-semibold">{dayLabel(props.date)}</p>
          <p className="text-[12px] text-ink-60">
            {closed ? 'Day closed' : 'Not closed'} · net {formatGhs(totals.net)}
          </p>
        </div>
      </header>

      <main className="px-4">
        {closed && close && v && (
          <section className="mt-4 rounded border-[1.5px] border-ink bg-card p-4">
            <table className="w-full">
              <thead>
                <tr>
                  <th aria-label="Channel" />
                  <th className="lbl pb-2 text-right">Expected</th>
                  <th className="lbl pb-2 text-right">Counted</th>
                  <th className="lbl pb-2 text-right">Difference</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-rule">
                  <th scope="row" className="py-2 text-left text-[15px] font-semibold text-cash">
                    Cash
                  </th>
                  <td className="tnum py-2 text-right text-[15px] text-ink-60">
                    {formatGhsPlain(close.expectedCashPesewas)}
                  </td>
                  <td className="tnum py-2 text-right text-[15px] text-ink-60">
                    {formatGhsPlain(close.countedCashPesewas)}
                  </td>
                  <td
                    className={`amt py-2 text-right text-[19px] ${
                      v.cashDiff === 0 ? 'text-ink-60' : v.cashDiff < 0 ? 'text-short' : 'text-over'
                    }`}
                  >
                    {v.cashDiff === 0
                      ? '0.00'
                      : `${v.cashDiff < 0 ? '−' : '+'}${formatGhsPlain(Math.abs(v.cashDiff))}`}
                  </td>
                </tr>
                <tr className="border-t border-rule">
                  <th scope="row" className="py-2 text-left text-[15px] font-semibold text-momo">
                    MoMo
                  </th>
                  <td className="tnum py-2 text-right text-[15px] text-ink-60">
                    {formatGhsPlain(close.expectedMomoPesewas)}
                  </td>
                  <td className="tnum py-2 text-right text-[15px] text-ink-60">
                    {formatGhsPlain(close.countedMomoPesewas)}
                  </td>
                  <td
                    className={`amt py-2 text-right text-[19px] ${
                      v.momoDiff === 0 ? 'text-ink-60' : v.momoDiff < 0 ? 'text-short' : 'text-over'
                    }`}
                  >
                    {v.momoDiff === 0
                      ? '0.00'
                      : `${v.momoDiff < 0 ? '−' : '+'}${formatGhsPlain(Math.abs(v.momoDiff))}`}
                  </td>
                </tr>
              </tbody>
            </table>
            <button
              type="button"
              className="mt-3 h-11 w-full rounded border border-rule text-[15px] text-ink-60"
              onClick={() => {
                void reopenDay(props.date).then(() => requestFlush());
              }}
            >
              Re-open this day
            </button>
          </section>
        )}

        <p className="lbl mb-1 mt-6 border-b border-rule pb-2">Entries</p>
        {entries.length === 0 ? (
          <p className="py-8 text-center text-[15px] text-ink-60">
            No entries on this day.
          </p>
        ) : (
          <ul>
            {entries.map((e, i) => {
              const voided = e.voidedAt !== null;
              return (
                <li
                  key={e.id}
                  className={`py-3 ${i < entries.length - 1 ? 'border-b border-rule' : ''} ${
                    voided ? 'opacity-45' : ''
                  }`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="flex items-baseline gap-3">
                      <span
                        className={`amt text-[22px] ${
                          e.channel === 'CASH' ? 'text-cash' : 'text-momo'
                        } ${voided ? 'line-through' : ''}`}
                      >
                        {e.kind === 'SALE' ? '+' : '−'}
                        {formatGhs(e.amountPesewas)}
                      </span>
                      {voided && <span className="lbl text-short">VOIDED</span>}
                    </span>
                    <span className="text-[11px] text-ink-60">
                      {time12(e.createdAtDevice)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[15px] text-ink-60">
                    {e.channel === 'CASH' ? 'Cash' : 'MoMo'} ·{' '}
                    {e.note ?? (e.kind === 'SALE' ? 'Sale' : 'Expense')}
                    {voided && e.voidReason ? ` — ${e.voidReason}` : ''}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
