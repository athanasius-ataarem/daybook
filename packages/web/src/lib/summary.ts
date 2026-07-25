import type { DayTotals } from '@daybook/shared/totals';
import type { Pesewas } from '@daybook/shared/money';
import { dayLabelFull } from './format';

// The WhatsApp summary. Plain text, no markdown, no emoji, under 500
// characters. Amounts are padded to a common width computed from the longest
// amount in the message, so the figures read as a column in WhatsApp's font.

const LABEL_WIDTH = 12;

function grouped(p: Pesewas): string {
  const abs = Math.abs(p);
  const whole = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const frac = String(abs % 100).padStart(2, '0');
  return `${p < 0 ? '−' : ''}${whole}.${frac}`;
}

export interface SummaryClose {
  expectedCashPesewas: Pesewas;
  expectedMomoPesewas: Pesewas;
  countedCashPesewas: Pesewas;
  countedMomoPesewas: Pesewas;
}

export function buildSummary(
  shopName: string,
  businessDate: string,
  totals: DayTotals,
  close: SummaryClose | null,
): string {
  const name = shopName.toUpperCase().slice(0, 28);

  const amounts: Record<string, string> = {
    in: grouped(totals.inTotal),
    cash: grouped(totals.salesCash),
    momo: grouped(totals.salesMomo),
    out: grouped(totals.outTotal),
    net: grouped(totals.net),
  };
  if (close) {
    amounts.countedCash = grouped(close.countedCashPesewas);
    amounts.countedMomo = grouped(close.countedMomoPesewas);
  }
  const width = Math.max(...Object.values(amounts).map((a) => a.length));
  const pad = (key: string): string => `GH₵${(amounts[key] ?? '').padStart(width)}`;
  const label = (text: string): string => text.padEnd(LABEL_WIDTH);

  const lines = [
    `${name} — ${dayLabelFull(businessDate)}`,
    '',
    `${label('Money in:')}${pad('in')}`,
    `${label('  Cash')}${pad('cash')}`,
    `${label('  MoMo')}${pad('momo')}`,
    `${label('Money out:')}${pad('out')}`,
    `${label('Net:')}${pad('net')}`,
  ];

  if (close) {
    const status = (diff: Pesewas): string =>
      diff === 0
        ? '(ok)'
        : diff < 0
          ? `(short GH₵${grouped(-diff)})`
          : `(over GH₵${grouped(diff)})`;
    lines.push(
      '',
      `Cash counted: ${pad('countedCash')} ${status(
        close.countedCashPesewas - close.expectedCashPesewas,
      )}`,
      `MoMo balance: ${pad('countedMomo')} ${status(
        close.countedMomoPesewas - close.expectedMomoPesewas,
      )}`,
    );
  }

  lines.push('', 'Sent from Daybook');
  return lines.join('\n');
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
