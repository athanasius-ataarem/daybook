import { useState, type ReactNode } from 'react';
import { PinBoxes } from '../components/PinBoxes';
import { api } from '../lib/api';
import { navigate, Link } from '../lib/router';
import { useApp } from '../AppContext';

interface AuthUser {
  user: { id: string; phone: string; shopName: string };
}

export default function Login(): ReactNode {
  const { setAuthed } = useApp();
  const [digits, setDigits] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setError('');
    if (digits.length !== 9 || pin.length !== 4) {
      setError('Enter your phone number and 4-digit PIN.');
      return;
    }
    setBusy(true);
    const res = await api<AuthUser>('/auth/login', {
      method: 'POST',
      body: { phone: `+233${digits}`, pin },
    });
    setBusy(false);
    if (res.ok && res.data) {
      await setAuthed({ id: res.data.user.id, shopName: res.data.user.shopName });
      navigate('/', true);
      return;
    }
    if (res.code === 'ACCOUNT_LOCKED') {
      setError('Too many tries. Wait 15 minutes and try again.');
    } else if (res.code === 'RATE_LIMITED') {
      setError('Too many tries. Wait and try again.');
    } else if (res.status === 0) {
      setError('No network. Try again when you have signal.');
    } else {
      setError("That number and PIN don't match. Try again.");
    }
  };

  return (
    <main className="mx-auto max-w-md p-4 pt-10">
      <h1 className="amt text-[34px]">Daybook</h1>
      <p className="mt-1 text-[15px] text-ink-60">Sign in</p>

      <label className="lbl mt-8 block" htmlFor="phone">
        Phone number
      </label>
      <div className="mt-2 flex h-12 items-center rounded border border-rule bg-card px-3">
        <span className="tnum text-[17px] text-ink-60">+233</span>
        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          className="tnum ml-2 h-full w-full bg-transparent text-[17px] outline-none"
          value={digits}
          onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 9))}
        />
      </div>

      <div className="mt-6">
        <PinBoxes label="PIN" value={pin} onChange={setPin} />
      </div>

      {error && (
        <p className="mt-4 text-[15px] text-short" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        className="mt-8 h-14 w-full rounded bg-ink text-[17px] font-semibold text-white disabled:opacity-50"
        onClick={() => void submit()}
      >
        Sign in
      </button>

      <p className="mt-6 text-center text-[15px] text-ink-60">
        New here?{' '}
        <Link to="/register" className="font-semibold text-ink underline">
          Create an account
        </Link>
      </p>
    </main>
  );
}
