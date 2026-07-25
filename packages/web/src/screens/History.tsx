import type { ReactNode } from 'react';
import { dayTotals } from '@daybook/shared/totals';
import { formatGhs } from '@daybook/shared/money';
import { entriesForDate, entryDates } from '../db/entries';
import { allCloses } from '../db/dayCloses';
import type { LocalDayClose } from '../db/schema';
import { useDbData } from '../lib/useDbData';
import { dayLabel } from '../lib/format';
import { Link, navigate } from '../lib/router';
import { variance } from '../lib/closeMath';

// Last 30 business days. No filters, no search, no month picker.
// Dot: green only for an exact match, red for any non-zero difference
// (short or over), grey if the day was never closed.

interface Row {
  date: string;
  net: number;
  close: LocalDayClose | null;
}

async function loadRows(): Promise<Row[]> {
  const dates = new Set(await entryDates(60));
  const closes = await allCloses();
  const closeByDate = new Map(closes.map((c) => [c.businessDate, c]));
  for (const c of closes) dates.add(c.businessDate);
  const sorted = [...dates].sort((a, b) => b.localeCompare(a)).slice(0, 30);
  const rows: Row[] = [];
  for (const date of sorted) {
    const entries = await entriesForDate(date);
    rows.push({
      date,
      net: dayTotals(entries).net,
      close: closeByDate.get(date) ?? null,
    });
  }
  return rows;
}

function rowState(row: Row): { dot: string; label: string; labelClass: string } {
  if (!row.close || row.close.closedAt === null) {
    return { dot: 'bg-rule border border-ink-60/40', label: 'not closed', labelClass: 'text-ink-60' };
  }
  const v = variance(
    row.close.expectedCashPesewas,
    row.close.expectedMomoPesewas,
    row.close.countedCashPesewas,
    row.close.countedMomoPesewas,
  );
  if (v.matched) {
    return { dot: 'bg-cash', label: 'everything matched', labelClass: 'text-ink-60' };
  }
  const total = v.cashDiff + v.momoDiff;
  const label =
    total < 0
      ? `short ${formatGhs(-total)}`
      : total > 0
        ? `over ${formatGhs(total)}`
        : 'cash and MoMo differ';
  return { dot: 'bg-short', label, labelClass: 'text-short' };
}

export default function History(): ReactNode {
  const rows = useDbData(loadRows);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="border-b border-rule px-4 py-3">
        <p className="text-[15px] font-semibold">History</p>
        <p className="text-[12px] text-ink-60">Last 30 days</p>
      </header>

      <main className="flex-1 px-4 pb-24">
        {rows !== undefined && rows.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-ink-60">
            Your past days will show up here once you close your first day.
          </p>
        ) : (
          <ul>
            {(rows ?? []).map((row, i) => {
              const s = rowState(row);
              return (
                <li
                  key={row.date}
                  className={i < (rows?.length ?? 0) - 1 ? 'border-b border-rule' : ''}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 py-3 text-left"
                    onClick={() => navigate(`/day/${row.date}`)}
                  >
                    <span aria-hidden className={`h-2 w-2 rounded-full ${s.dot}`} />
                    <span className="flex-1">
                      <span className="block text-[15px]">{dayLabel(row.date)}</span>
                      <span className={`block text-[12px] ${s.labelClass}`}>
                        {s.label}
                      </span>
                    </span>
                    <span className="amt text-[19px]">{formatGhs(row.net)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 mx-auto flex h-14 max-w-md items-center border-t border-rule bg-paper"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <Link to="/" className="flex-1 text-center text-[12px] text-ink-60">
          Today
        </Link>
        <span className="flex-1 text-center text-[12px] font-semibold">History</span>
      </nav>
    </div>
  );
}
