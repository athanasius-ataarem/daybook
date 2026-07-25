import { useEffect, useState, type ReactNode } from 'react';
import { formatGhs, formatGhsPlain, parseGhs, signed } from '@daybook/shared/money';
import { dayTotals } from '@daybook/shared/totals';
import { Sheet } from '../components/Sheet';
import { Keypad, displayAmount } from '../components/Keypad';
import {
  anyCloseExists,
  closeForDate,
  latestClosedBefore,
  putDayClose,
  reopenDay,
} from '../db/dayCloses';
import { entriesAfterDate, entriesForDate, addEntry } from '../db/entries';
import { useDbData } from '../lib/useDbData';
import { computeExpected, variance } from '../lib/closeMath';
import { buildSummary, whatsappUrl } from '../lib/summary';
import { dayLabel, dayLabelShort } from '../lib/format';
import { requestFlush } from '../sync/worker';
import { saveTick } from '../lib/haptic';
import { useApp } from '../AppContext';

// Close of day — the product, not a feature. Expected vs counted vs
// difference, snapshot onto the DayClose, and never a silent correction.

type Field = 'cash' | 'momo' | 'openCash' | 'openMomo' | null;

function parseOrZero(s: string): number {
  try {
    return s === '' ? 0 : parseGhs(s);
  } catch {
    return 0;
  }
}

function AmountField(props: {
  label: string;
  value: string;
  colour: string;
  active: boolean;
  onFocus: () => void;
}): ReactNode {
  return (
    <div className="mt-4">
      <p className="text-[17px]">{props.label}</p>
      <button
        type="button"
        aria-label={props.label}
        className={`amt mt-2 flex h-[50px] w-full items-center justify-end rounded border bg-card px-3 text-[22px] ${props.colour} ${
          props.active ? 'border-ink' : 'border-rule'
        }`}
        onClick={props.onFocus}
      >
        GH₵{displayAmount(props.value)}
      </button>
    </div>
  );
}

function VarianceCard(props: {
  expectedCash: number;
  expectedMomo: number;
  countedCash: number;
  countedMomo: number;
}): ReactNode {
  const v = variance(
    props.expectedCash,
    props.expectedMomo,
    props.countedCash,
    props.countedMomo,
  );
  const diffClass = (d: number): string =>
    d === 0 ? 'text-ink-60' : d < 0 ? 'text-short' : 'text-over';
  const sentence = ((): string => {
    if (v.matched) return 'Everything matches.';
    const parts: string[] = [];
    if (v.cashDiff < 0) parts.push(`Your cash is short by ${formatGhs(-v.cashDiff)}.`);
    if (v.cashDiff > 0) parts.push(`Your cash is over by ${formatGhs(v.cashDiff)}.`);
    if (v.momoDiff < 0) parts.push(`Your MoMo is short by ${formatGhs(-v.momoDiff)}.`);
    if (v.momoDiff > 0) parts.push(`Your MoMo is over by ${formatGhs(v.momoDiff)}.`);
    return parts.join(' ');
  })();

  const row = (
    label: string,
    labelClass: string,
    expected: number,
    counted: number,
    diff: number,
  ): ReactNode => (
    <tr className="border-t border-rule">
      <th scope="row" className={`py-3 text-left text-[15px] font-semibold ${labelClass}`}>
        {label}
      </th>
      <td className="tnum py-3 text-right text-[15px] text-ink-60">
        {formatGhsPlain(expected)}
      </td>
      <td className="tnum py-3 text-right text-[15px] text-ink-60">
        {formatGhsPlain(counted)}
      </td>
      <td className={`amt py-3 text-right text-[22px] ${diffClass(diff)}`}>
        {diff === 0 ? '0.00' : `${diff < 0 ? '−' : '+'}${formatGhsPlain(Math.abs(diff))}`}
      </td>
    </tr>
  );

  return (
    <section className="mt-6 rounded border-[1.5px] border-ink bg-card p-4">
      <table className="w-full">
        <thead>
          <tr>
            <th aria-label="Channel" />
            <th className="lbl pb-2 text-right font-semibold">Expected</th>
            <th className="lbl pb-2 text-right font-semibold">Counted</th>
            <th className="lbl pb-2 text-right font-semibold">Difference</th>
          </tr>
        </thead>
        <tbody>
          {row('Cash', 'text-cash', props.expectedCash, props.countedCash, v.cashDiff)}
          {row('MoMo', 'text-momo', props.expectedMomo, props.countedMomo, v.momoDiff)}
        </tbody>
      </table>
      <p
        aria-live="polite"
        className={`mt-3 text-[15px] font-semibold ${
          v.matched ? 'text-ink-60' : 'text-short'
        }`}
      >
        {sentence}
      </p>
    </section>
  );
}

export default function CloseDay(props: {
  open: boolean;
  onClose: () => void;
  date: string;
}): ReactNode {
  const { shopName } = useApp();
  const { open, date } = props;

  const existing = useDbData(() => closeForDate(date), [date, open]);
  const lastClosed = useDbData(() => latestClosedBefore(date), [date, open]);
  const hasAnyClose = useDbData(anyCloseExists, [open]);
  const spanEntries =
    useDbData(
      () => entriesAfterDate(lastClosed?.businessDate ?? null, date),
      [lastClosed?.businessDate ?? '', date],
    ) ?? [];
  const todayEntries = useDbData(() => entriesForDate(date), [date]) ?? [];

  const [openCash, setOpenCash] = useState('');
  const [openMomo, setOpenMomo] = useState('');
  const [cash, setCash] = useState('');
  const [momo, setMomo] = useState('');
  const [field, setField] = useState<Field>('cash');
  const [leftIt, setLeftIt] = useState(false);
  const [justClosed, setJustClosed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCash('');
    setMomo('');
    setOpenCash('');
    setOpenMomo('');
    setField('cash');
    setLeftIt(false);
    setJustClosed(false);
    setCopied(false);
  }, [open]);

  const isClosed = existing?.closedAt != null && !justClosed;
  const firstEver = hasAnyClose === false && !existing;
  const needsOpenings = firstEver;

  const openingCash = lastClosed
    ? lastClosed.countedCashPesewas
    : existing
      ? existing.openingCashPesewas
      : parseOrZero(openCash);
  const openingMomo = lastClosed
    ? lastClosed.countedMomoPesewas
    : existing
      ? existing.openingMomoPesewas
      : parseOrZero(openMomo);

  const exp = computeExpected(openingCash, openingMomo, spanEntries);
  const countedCash = parseOrZero(cash);
  const countedMomo = parseOrZero(momo);
  const counted = cash !== '' && momo !== '';
  const v = variance(
    exp.expectedCashPesewas,
    exp.expectedMomoPesewas,
    countedCash,
    countedMomo,
  );

  const [step, setStep] = useState<'openings' | 'count'>('count');
  useEffect(() => {
    if (open) setStep(needsOpenings ? 'openings' : 'count');
  }, [open, needsOpenings]);

  const recordIt = async (): Promise<void> => {
    // Creates the matching entry — money out if short, money in if over —
    // then everything recomputes. Never auto-correct, never editorialise.
    const label = dayLabelShort(date);
    if (v.cashDiff !== 0) {
      await addEntry({
        businessDate: date,
        kind: v.cashDiff < 0 ? 'EXPENSE' : 'SALE',
        channel: 'CASH',
        amountPesewas: Math.abs(v.cashDiff),
        note: v.cashDiff < 0 ? `shortage on ${label}` : `extra on ${label}`,
      });
    }
    if (v.momoDiff !== 0) {
      await addEntry({
        businessDate: date,
        kind: v.momoDiff < 0 ? 'EXPENSE' : 'SALE',
        channel: 'MOMO',
        amountPesewas: Math.abs(v.momoDiff),
        note: v.momoDiff < 0 ? `shortage on ${label}` : `extra on ${label}`,
      });
    }
    requestFlush();
  };

  const persistClose = async (): Promise<void> => {
    // Recompute the expected at the moment of close — this is the snapshot.
    const finalExp = computeExpected(
      openingCash,
      openingMomo,
      await entriesAfterDate(lastClosed?.businessDate ?? null, date),
    );
    await putDayClose({
      id: existing?.id ?? crypto.randomUUID(),
      businessDate: date,
      openingCashPesewas: openingCash,
      openingMomoPesewas: openingMomo,
      expectedCashPesewas: finalExp.expectedCashPesewas,
      expectedMomoPesewas: finalExp.expectedMomoPesewas,
      countedCashPesewas: countedCash,
      countedMomoPesewas: countedMomo,
      closedAt: new Date().toISOString(),
    });
    saveTick();
    requestFlush();
    setJustClosed(true);
  };

  const summaryText = (): string => {
    const t = dayTotals(todayEntries);
    const closeData =
      isClosed && existing
        ? {
            expectedCashPesewas: existing.expectedCashPesewas,
            expectedMomoPesewas: existing.expectedMomoPesewas,
            countedCashPesewas: existing.countedCashPesewas,
            countedMomoPesewas: existing.countedMomoPesewas,
          }
        : justClosed
          ? {
              expectedCashPesewas: exp.expectedCashPesewas,
              expectedMomoPesewas: exp.expectedMomoPesewas,
              countedCashPesewas: countedCash,
              countedMomoPesewas: countedMomo,
            }
          : null;
    return buildSummary(shopName, date, t, closeData);
  };

  const copySummary = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(summaryText());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const keypadValue =
    field === 'cash' ? cash : field === 'momo' ? momo : field === 'openCash' ? openCash : openMomo;
  const setKeypadValue =
    field === 'cash'
      ? setCash
      : field === 'momo'
        ? setMomo
        : field === 'openCash'
          ? setOpenCash
          : setOpenMomo;

  return (
    <Sheet open={open} onClose={props.onClose} label="Close the day" full>
      <div className="mx-auto flex h-full max-w-md flex-col overflow-y-auto p-4">
        <header className="flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-semibold">Close the day</h2>
            <p className="text-[12px] text-ink-60">{dayLabel(date)}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="h-11 w-11 text-[17px] text-ink-60"
            onClick={props.onClose}
          >
            ✕
          </button>
        </header>

        {isClosed && existing ? (
          <>
            <VarianceCard
              expectedCash={existing.expectedCashPesewas}
              expectedMomo={existing.expectedMomoPesewas}
              countedCash={existing.countedCashPesewas}
              countedMomo={existing.countedMomoPesewas}
            />
            <div className="mt-auto space-y-2 pt-6">
              <a
                href={whatsappUrl(summaryText())}
                className="flex h-14 w-full items-center justify-center rounded bg-ink text-[17px] font-semibold text-white"
              >
                Send to WhatsApp
              </a>
              <button
                type="button"
                className="h-12 w-full rounded border border-rule bg-card text-[15px]"
                onClick={() => void copySummary()}
              >
                {copied ? 'Copied' : 'Copy summary'}
              </button>
              <button
                type="button"
                className="h-12 w-full rounded border border-rule text-[15px] text-ink-60"
                onClick={() => {
                  void reopenDay(date).then(() => requestFlush());
                  props.onClose();
                }}
              >
                Re-open this day
              </button>
              <button
                type="button"
                className="h-12 w-full rounded text-[15px] text-ink-60"
                onClick={props.onClose}
              >
                Done
              </button>
            </div>
          </>
        ) : step === 'openings' ? (
          <>
            <p className="mt-4 text-[15px] text-ink-60">
              How much cash and MoMo did you start with today? We only need this once.
            </p>
            <AmountField
              label="Cash at the start of today"
              value={openCash}
              colour="text-cash"
              active={field === 'openCash'}
              onFocus={() => setField('openCash')}
            />
            <AmountField
              label="MoMo at the start of today"
              value={openMomo}
              colour="text-momo"
              active={field === 'openMomo'}
              onFocus={() => setField('openMomo')}
            />
            <div className="mt-auto pt-4">
              <Keypad value={keypadValue} onChange={setKeypadValue} />
              <button
                type="button"
                className="mt-3 h-14 w-full rounded bg-ink text-[17px] font-semibold text-white"
                onClick={() => {
                  setStep('count');
                  setField('cash');
                }}
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <AmountField
              label="How much cash is in the drawer?"
              value={cash}
              colour="text-cash"
              active={field === 'cash'}
              onFocus={() => setField('cash')}
            />
            <AmountField
              label="What does your MoMo balance say?"
              value={momo}
              colour="text-momo"
              active={field === 'momo'}
              onFocus={() => setField('momo')}
            />

            {field === null && counted && !justClosed && (
              <VarianceCard
                expectedCash={exp.expectedCashPesewas}
                expectedMomo={exp.expectedMomoPesewas}
                countedCash={countedCash}
                countedMomo={countedMomo}
              />
            )}

            {justClosed ? (
              <>
                <VarianceCard
                  expectedCash={exp.expectedCashPesewas}
                  expectedMomo={exp.expectedMomoPesewas}
                  countedCash={countedCash}
                  countedMomo={countedMomo}
                />
                <div className="mt-auto space-y-2 pt-6">
                  <a
                    href={whatsappUrl(summaryText())}
                    className="flex h-14 w-full items-center justify-center rounded bg-ink text-[17px] font-semibold text-white"
                  >
                    Send to WhatsApp
                  </a>
                  <button
                    type="button"
                    className="h-12 w-full rounded border border-rule bg-card text-[15px]"
                    onClick={() => void copySummary()}
                  >
                    {copied ? 'Copied' : 'Copy summary'}
                  </button>
                  <button
                    type="button"
                    className="h-12 w-full rounded text-[15px] text-ink-60"
                    onClick={props.onClose}
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-auto pt-4">
                {field !== null ? (
                  // A field is being edited: the keypad stays until the user
                  // says they are done — never vanish mid-typing.
                  <>
                    <Keypad value={keypadValue} onChange={setKeypadValue} />
                    <button
                      type="button"
                      disabled={keypadValue === ''}
                      className="mt-3 h-14 w-full rounded bg-ink text-[17px] font-semibold text-white disabled:opacity-40"
                      onClick={() => {
                        const otherEmpty =
                          field === 'cash' ? momo === '' : cash === '';
                        if (otherEmpty) {
                          setField(field === 'cash' ? 'momo' : 'cash');
                        } else {
                          setField(null);
                        }
                      }}
                    >
                      {(field === 'cash' ? momo === '' : cash === '')
                        ? 'Next'
                        : 'Show the difference'}
                    </button>
                  </>
                ) : counted ? (
                  !v.matched && !leftIt ? (
                    <>
                      <div className="mb-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className="h-12 rounded border-2 border-ink text-[15px] font-semibold"
                          onClick={() => void recordIt()}
                        >
                          Record it
                        </button>
                        <button
                          type="button"
                          className="h-12 rounded border border-rule text-[15px] text-ink-60"
                          onClick={() => setLeftIt(true)}
                        >
                          Leave it
                        </button>
                      </div>
                      <p className="text-center text-[13px] text-ink-60">
                        Record the difference {signed(v.cashDiff + v.momoDiff)} as
                        an entry, or leave it on the summary.
                      </p>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="h-14 w-full rounded bg-ink text-[17px] font-semibold text-white"
                      onClick={() => void persistClose()}
                    >
                      Close the day
                    </button>
                  )
                ) : (
                  <p className="mt-3 text-center text-[13px] text-ink-60">
                    Count both, then the difference shows here.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
