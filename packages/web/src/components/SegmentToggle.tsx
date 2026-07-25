import type { ReactNode } from 'react';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  activeClass: string; // bg + text when selected
  inactiveClass?: string;
}

export function SegmentToggle<T extends string>(props: {
  legend: string;
  options: [SegmentOption<T>, SegmentOption<T>];
  value: T;
  onChange: (value: T) => void;
}): ReactNode {
  return (
    <div
      role="radiogroup"
      aria-label={props.legend}
      className="grid h-12 w-full grid-cols-2 gap-px rounded border border-rule bg-card p-px"
    >
      {props.options.map((o) => {
        const active = o.value === props.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={`rounded text-[15px] font-semibold ${
              active ? o.activeClass : (o.inactiveClass ?? 'text-ink-60')
            }`}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
