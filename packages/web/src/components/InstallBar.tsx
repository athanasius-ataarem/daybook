import { useEffect, useState, type ReactNode } from 'react';
import { getMeta, setMeta } from '../db/meta';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

// One unobtrusive bar if the browser offers install. Never nag twice.

export function InstallBar(): ReactNode {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (e: Event): void => {
      e.preventDefault();
      void getMeta<boolean>('installDismissed').then((dismissed) => {
        if (!dismissed) setDeferred(e as BeforeInstallPromptEvent);
      });
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferred) return null;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-rule bg-card px-4 py-2">
      <span className="text-[15px]">Add Daybook to your home screen</span>
      <span className="flex gap-2">
        <button
          type="button"
          className="h-9 rounded bg-ink px-3 text-[15px] font-semibold text-white"
          onClick={() => {
            void deferred.prompt();
            setDeferred(null);
          }}
        >
          Add
        </button>
        <button
          type="button"
          className="h-9 px-2 text-[15px] text-ink-60"
          onClick={() => {
            void setMeta('installDismissed', true);
            setDeferred(null);
          }}
        >
          Not now
        </button>
      </span>
    </div>
  );
}
