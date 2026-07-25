import { describe, expect, it } from 'vitest';
import {
  formatGhs,
  formatGhsPlain,
  parseGhs,
  signed,
  MAX_ENTRY_PESEWAS,
} from '../src/money';

describe('parseGhs', () => {
  it.each([
    ['12', 1200],
    ['12.', 1200],
    ['12.5', 1250],
    ['12.50', 1250],
    ['012.50', 1250],
    ['.5', 50],
    ['0', 0],
    ['999999.99', 99_999_999],
  ])('parses %s to %d pesewas', (input, expected) => {
    expect(parseGhs(input)).toBe(expected);
  });

  it.each([
    ['12.505'], // more than two decimals
    [''],
    ['.'],
    ['abc'],
    ['12,50'],
    ['1 2'],
    ['-5'],
    ['1e3'],
    ['1000000.00'], // above the maximum single entry
    ['12.5.0'],
  ])('throws on %j', (input) => {
    expect(() => parseGhs(input)).toThrow();
  });

  it('never suffers float artifacts on two-decimal input', () => {
    // 12.505-style inputs are rejected outright, but even legal inputs must be
    // exact: 0.29 * 100 === 28.999... in float land.
    expect(parseGhs('0.29')).toBe(29);
    expect(parseGhs('19.99')).toBe(1999);
  });
});

describe('formatGhs', () => {
  it('formats with the cedi sign and grouped thousands', () => {
    expect(formatGhs(1250)).toBe('GH₵12.50');
    expect(formatGhs(124000)).toBe('GH₵1,240.00');
    expect(formatGhs(MAX_ENTRY_PESEWAS)).toBe('GH₵999,999.99');
    expect(formatGhs(0)).toBe('GH₵0.00');
  });

  it('uses a true minus (U+2212) for negatives', () => {
    expect(formatGhs(-2500)).toBe('−GH₵25.00');
  });

  it('rejects non-integers', () => {
    expect(() => formatGhs(12.5)).toThrow();
  });
});

describe('formatGhsPlain', () => {
  it('never groups thousands (CSV safety)', () => {
    expect(formatGhsPlain(1250)).toBe('12.50');
    expect(formatGhsPlain(210000)).toBe('2100.00');
    expect(formatGhsPlain(MAX_ENTRY_PESEWAS)).toBe('999999.99');
  });
});

describe('signed', () => {
  it('marks direction explicitly', () => {
    expect(signed(-2500)).toBe('−GH₵25.00');
    expect(signed(500)).toBe('+GH₵5.00');
    expect(signed(0)).toBe('GH₵0.00');
  });
});

describe('round-trip', () => {
  it('parseGhs(formatGhsPlain(n)) === n across 1,000 random integers', () => {
    // Deterministic LCG so a failure is reproducible.
    let seed = 42;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed;
    };
    for (let i = 0; i < 1000; i++) {
      const n = (next() % MAX_ENTRY_PESEWAS) + 1;
      expect(parseGhs(formatGhsPlain(n))).toBe(n);
    }
  });
});
