import { useEffect, type ReactNode } from 'react';

// Sheets are not routes. Opening one pushes a history entry so the back
// gesture closes the sheet instead of leaving the app.

export function Sheet(props: {
  open: boolean;
  onClose: () => void;
  label: string;
  full?: boolean;
  children: ReactNode;
}): ReactNode {
  const { open, onClose } = props;

  useEffect(() => {
    if (!open) return;
    history.pushState({ sheet: true }, '');
    const onPop = (): void => onClose();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if ((history.state as { sheet?: boolean } | null)?.sheet) history.back();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-ink/30"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={props.label}
        className={`sheet-up absolute inset-x-0 bottom-0 rounded-t bg-paper shadow-lg ${
          props.full ? 'top-0 rounded-none' : 'max-h-[92%] overflow-y-auto'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {props.children}
      </div>
    </div>
  );
}
