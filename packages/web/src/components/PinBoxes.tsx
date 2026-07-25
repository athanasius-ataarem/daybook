import { useRef, type ReactNode } from 'react';

// Four separate 1-character boxes, auto-advancing, masked after entry.

export function PinBoxes(props: {
  label: string;
  value: string;
  onChange: (pin: string) => void;
}): ReactNode {
  const refs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const setDigit = (index: number, digit: string): void => {
    const clean = digit.replace(/\D/g, '').slice(-1);
    const chars = props.value.padEnd(4, ' ').split('');
    chars[index] = clean || ' ';
    props.onChange(chars.join('').trimEnd().replace(/ /g, ''));
    if (clean && index < 3) refs[index + 1]?.current?.focus();
  };

  return (
    <fieldset className="border-0 p-0">
      <legend className="lbl mb-2">{props.label}</legend>
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <input
            key={i}
            ref={refs[i]}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={1}
            aria-label={`${props.label} digit ${i + 1}`}
            className="amt h-14 w-12 rounded border border-rule bg-card text-center text-[22px]"
            value={props.value[i] ?? ''}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !props.value[i] && i > 0) {
                refs[i - 1]?.current?.focus();
              }
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
