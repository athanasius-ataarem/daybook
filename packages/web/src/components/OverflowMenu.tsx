import { useState, type ReactNode } from 'react';
import { Sheet } from './Sheet';
import { PinBoxes } from './PinBoxes';
import { api } from '../lib/api';
import { exportCsvFromDevice } from '../lib/exportCsv';
import { pendingCount } from '../db/outbox';
import { useDbData } from '../lib/useDbData';
import { requestFlush } from '../sync/worker';
import { navigate } from '../lib/router';
import { useApp } from '../AppContext';

// ⋮ menu: Privacy, Export, Sign out, Delete account — plus the PIN line,
// because there is no reset flow and a dead link would be worse than none.

type Panel = 'menu' | 'signout' | 'delete' | null;

export function OverflowMenu(props: {
  open: boolean;
  onClose: () => void;
}): ReactNode {
  const { signOutLocal } = useApp();
  const [panel, setPanel] = useState<Panel>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useDbData(pendingCount) ?? 0;

  const active: Panel = props.open ? (panel ?? 'menu') : null;

  const closeAll = (): void => {
    setPanel(null);
    setPin('');
    setError('');
    props.onClose();
  };

  const signOut = async (): Promise<void> => {
    await api('/auth/logout', { method: 'POST' }); // best effort
    await signOutLocal();
    closeAll();
    navigate('/login', true);
  };

  const deleteAccount = async (): Promise<void> => {
    setError('');
    if (!navigator.onLine) {
      setError('You need network to delete your account.');
      return;
    }
    if (pin.length !== 4) {
      setError('Type your 4-digit PIN to confirm.');
      return;
    }
    setBusy(true);
    const res = await api('/me', { method: 'DELETE', body: { pin } });
    setBusy(false);
    if (res.status === 204) {
      await signOutLocal();
      closeAll();
      navigate('/login', true);
      return;
    }
    if (res.code === 'ACCOUNT_LOCKED') {
      setError('Too many tries. Wait 15 minutes and try again.');
    } else if (res.status === 0) {
      setError('You need network to delete your account.');
    } else {
      setError('That PIN is not right.');
    }
  };

  const item =
    'block w-full border-b border-rule px-4 py-4 text-left text-[17px] last:border-b-0';

  return (
    <>
      <Sheet open={active === 'menu'} onClose={closeAll} label="Menu">
        <nav className="pb-4">
          <button type="button" className={item} onClick={() => { closeAll(); navigate('/privacy'); }}>
            Privacy
          </button>
          <button
            type="button"
            className={item}
            onClick={() => {
              void exportCsvFromDevice();
              closeAll();
            }}
          >
            Export my records
          </button>
          <button type="button" className={item} onClick={() => setPanel('signout')}>
            Sign out
          </button>
          <button
            type="button"
            className={`${item} text-short`}
            onClick={() => setPanel('delete')}
          >
            Delete my account
          </button>
          <p className="px-4 pt-4 text-[15px] text-ink-60">
            Forgot your PIN? Contact whoever set up Daybook for you.
          </p>
        </nav>
      </Sheet>

      <Sheet open={active === 'signout'} onClose={closeAll} label="Sign out">
        <div className="p-4 pb-8">
          <h2 className="text-[17px] font-semibold">Sign out</h2>
          {pending > 0 ? (
            <>
              <p className="mt-2 text-[15px]">
                {pending === 1 ? '1 entry has' : `${pending} entries have`} not saved
                yet. If you sign out now, {pending === 1 ? 'it' : 'they'} will be lost
                from this phone.
              </p>
              <button
                type="button"
                className="mt-4 h-12 w-full rounded bg-ink font-semibold text-white"
                onClick={() => requestFlush()}
              >
                Save them first
              </button>
              <button
                type="button"
                className="mt-2 h-12 w-full rounded border border-short font-semibold text-short"
                onClick={() => void signOut()}
              >
                Sign out anyway
              </button>
            </>
          ) : (
            <>
              <p className="mt-2 text-[15px]">
                Your records are saved. You can sign back in with your phone number
                and PIN.
              </p>
              <button
                type="button"
                className="mt-4 h-12 w-full rounded bg-ink font-semibold text-white"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </Sheet>

      <Sheet open={active === 'delete'} onClose={closeAll} label="Delete my account">
        <div className="p-4 pb-8">
          <h2 className="text-[17px] font-semibold">Delete my account</h2>
          <p className="mt-2 text-[15px]">
            This destroys your account, every entry and every day summary, on this
            phone and on the server. It cannot be undone.
          </p>
          <button
            type="button"
            className="mt-4 h-12 w-full rounded bg-ink font-semibold text-white"
            onClick={() => void exportCsvFromDevice()}
          >
            Export my records first
          </button>
          <div className="mt-6">
            <PinBoxes label="Type your PIN to confirm" value={pin} onChange={setPin} />
          </div>
          {error && (
            <p className="mt-3 text-[15px] text-short" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            className="mt-4 h-12 w-full rounded bg-short font-semibold text-white disabled:opacity-50"
            onClick={() => void deleteAccount()}
          >
            Delete my account
          </button>
        </div>
      </Sheet>
    </>
  );
}
