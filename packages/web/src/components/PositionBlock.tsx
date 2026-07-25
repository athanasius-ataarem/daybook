import type { ReactNode } from 'react';
import { formatGhs, formatGhsPlain } from '@daybook/shared/money';
import type { DayTotals } from '@daybook/shared/totals';

// Numbers are the interface. The net is the largest thing on the screen.

function Split(props: { cash: number; momo: number }): ReactNode {
  return (
    <p className="mt-0.5 text-[15px]">
      <span className="tnum text-cash">Cash {formatGhsPlain(props.cash)}</span>
      <span className="text-ink-60"> · </span>
      <span className="tnum text-momo">MoMo {formatGhsPlain(props.momo)}</span>
    </p>
  );
}

export function PositionBlock(props: { totals: DayTotals }): ReactNode {
  const t = props.totals;
  return (
    <section className="rounded border border-rule bg-card p-4" aria-label="Net today">
      <p className="lbl">Net today</p>
      <p className="amt mt-1 text-right text-[48px] leading-none">{formatGhs(t.net)}</p>
      <div className="mt-4 border-t border-rule pt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[17px]">Money in</span>
          <span className="amt text-[22px]">{formatGhs(t.inTotal)}</span>
        </div>
        <Split cash={t.salesCash} momo={t.salesMomo} />
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[17px]">Money out</span>
          <span className="amt text-[22px]">{formatGhs(t.outTotal)}</span>
        </div>
        <Split cash={t.expCash} momo={t.expMomo} />
      </div>
    </section>
  );
}
