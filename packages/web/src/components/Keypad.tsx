import type { ReactNode } from 'react';

// The custom amount keypad. Buttons, not divs. Never the OS keyboard.

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

export function keypadPress(value: string, key: string): string {
  if (key === 'back') return value.slice(0, -1);
  if (key === '.') {
    return value.includes('.') ? value : value + '.';
  }
  const [whole = '', frac] = value.split('.');
  if (frac !== undefined) {
    return frac.length >= 2 ? value : value + key;
  }
  return whole.length >= 6 ? value : value + key;
}

export function Keypad(props: {
  value: string;
  onChange: (next: string) => void;
}): ReactNode {
  return (
    <div aria-label="Amount keypad" role="group" className="grid grid-cols-3 gap-2">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          aria-label={k === 'back' ? 'Delete last digit' : k}
          className="amt h-16 rounded border border-rule bg-card text-[22px] active:bg-rule"
          onClick={() => props.onChange(keypadPress(props.value, k))}
        >
          {k === 'back' ? '⌫' : k}
        </button>
      ))}
    </div>
  );
}

/** "12.5" -> "12.50", "" -> "0.00", grouped whole part, for the display. */
export function displayAmount(input: string): string {
  if (!input) return '0.00';
  const [w = '', f] = input.split('.');
  const whole = (w === '' ? '0' : w.replace(/^0+(?=\d)/, '')).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ',',
  );
  const frac = ((f ?? '') + '00').slice(0, 2);
  return `${whole}.${frac}`;
}
