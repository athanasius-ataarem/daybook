// All money in Daybook is an integer count of pesewas. These four functions are
// the only place money is parsed or formatted. No floats, no toFixed, anywhere.

export type Pesewas = number; // integer, always

export const MAX_ENTRY_PESEWAS = 99_999_999;

const MINUS = '−'; // true minus, per the UI spec
const CEDI = 'GH₵';

function assertInteger(p: Pesewas): void {
  if (!Number.isSafeInteger(p)) {
    throw new Error(`not an integer pesewas amount: ${String(p)}`);
  }
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function splitPesewas(p: Pesewas): { whole: string; frac: string } {
  const abs = Math.abs(p);
  const whole = String(Math.trunc(abs / 100));
  const frac = String(abs % 100).padStart(2, '0');
  return { whole, frac };
}

/** 1250 -> "GH₵12.50"; -2500 -> "−GH₵25.00". Grouped thousands, for display. */
export function formatGhs(p: Pesewas): string {
  assertInteger(p);
  const { whole, frac } = splitPesewas(p);
  const sign = p < 0 ? MINUS : '';
  return `${sign}${CEDI}${groupThousands(whole)}.${frac}`;
}

/**
 * 1250 -> "12.50". Never grouped: this feeds the CSV (a comma breaks an
 * unquoted field) and the parseGhs round-trip. Display grouping is the
 * caller's job.
 */
export function formatGhsPlain(p: Pesewas): string {
  assertInteger(p);
  const { whole, frac } = splitPesewas(p);
  const sign = p < 0 ? MINUS : '';
  return `${sign}${whole}.${frac}`;
}

/** -2500 -> "−GH₵25.00", 500 -> "+GH₵5.00", 0 -> "GH₵0.00". For differences. */
export function signed(p: Pesewas): string {
  assertInteger(p);
  if (p === 0) return formatGhs(0);
  return p > 0 ? `+${formatGhs(p)}` : formatGhs(p);
}

/**
 * "12.5" -> 1250. Parses the digit string directly — never `* 100` on a float.
 * Accepts an optional integer part, an optional dot, at most two decimals.
 * Throws on anything else, including more than two decimals, negatives,
 * exponents, commas, spaces, and the empty string. Zero parses to 0; rejecting
 * zero amounts is the entry schema's job, not the parser's.
 */
export function parseGhs(input: string): Pesewas {
  const m = /^(\d*)(?:\.(\d{0,2}))?$/.exec(input);
  if (!m) throw new Error(`not an amount: ${JSON.stringify(input)}`);
  const wholeDigits = m[1] ?? '';
  const fracDigits = m[2] ?? '';
  if (wholeDigits === '' && fracDigits === '') {
    throw new Error(`not an amount: ${JSON.stringify(input)}`);
  }
  const whole = wholeDigits === '' ? 0 : Number.parseInt(wholeDigits, 10);
  const frac =
    fracDigits === '' ? 0 : Number.parseInt(fracDigits.padEnd(2, '0'), 10);
  const pesewas = whole * 100 + frac;
  if (pesewas > MAX_ENTRY_PESEWAS) {
    throw new Error(`amount above the maximum: ${JSON.stringify(input)}`);
  }
  return pesewas;
}
