import { useSyncExternalStore, type ReactNode, type MouseEvent } from 'react';

// A ~50-line history router. Six routes, sheets are state not routes — a
// routing library would be bundle weight for nothing.

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function navigate(to: string, replace = false): void {
  if (replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  emit();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener('popstate', cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('popstate', cb);
  };
}

export function usePath(): string {
  return useSyncExternalStore(subscribe, () => location.pathname);
}

export function Link(props: {
  to: string;
  className?: string;
  'aria-label'?: string;
  children: ReactNode;
}): ReactNode {
  const onClick = (e: MouseEvent): void => {
    e.preventDefault();
    navigate(props.to);
  };
  return (
    <a
      href={props.to}
      onClick={onClick}
      className={props.className}
      aria-label={props['aria-label']}
    >
      {props.children}
    </a>
  );
}
