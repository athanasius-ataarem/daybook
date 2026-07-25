import { useState, type ReactNode } from 'react';
import { isWeakPin } from '@daybook/shared/pin';
import { PinBoxes } from '../components/PinBoxes';
import { api } from '../lib/api';
import { navigate, Link } from '../lib/router';
import { useApp } from '../AppContext';

interface AuthUser {
  user: { id: string; phone: string; shopName: string };
}

export default function Register(): ReactNode {
  const { setAuthed } = useApp();
  const [shopName, setShopName] = useState('');
  const [digits, setDigits] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setError('');
    if (!shopName.trim()) {
      setError('Enter your shop name.');
      return;
    }
    if (digits.length !== 9) {
      setError('Enter the 9 digits of your phone number.');
      return;
    }
    if (pin.length !== 4 || pin !== pin2) {
      setError("Those PINs don't match. Enter the same 4 digits twice.");
      return;
    }
    if (isWeakPin(pin)) {
      setError('That PIN is too easy to guess. Choose another.');
      return;
    }
    setBusy(true);
    const res = await api<AuthUser>('/auth/register', {
      method: 'POST',
      body: { phone: `+233${digits}`, pin, shopName: shopName.trim() },
    });
    setBusy(false);
    if (res.ok && res.data) {
      await setAuthed({ id: res.data.user.id, shopName: res.data.user.shopName });
      navigate('/', true);
      return;
    }
    if (res.code === 'PHONE_TAKEN') {
      setError('That number already has an account. Sign in instead.');
    } else if (res.code === 'WEAK_PIN') {
      setError('That PIN is too easy to guess. Choose another.');
    } else if (res.status === 0) {
      // Registration is the only screen that requires network. Say so plainly.
      setError('You need network just for this first step.');
    } else {
      setError('Check the details and try again.');
    }
  };

  return (
    <main className="mx-auto max-w-md p-4 pt-10">
      <h1 className="amt text-[34px]">Daybook</h1>
      <p className="mt-1 text-[15px] text-ink-60">Create an account</p>

      <label className="lbl mt-8 block" htmlFor="shop">
        Shop name
      </label>
      <input
        id="shop"
        type="text"
        maxLength={60}
        className="mt-2 h-12 w-full rounded border border-rule bg-card px-3 text-[17px] outline-none"
        value={shopName}
        onChange={(e) => setShopName(e.target.value)}
      />

      <label className="lbl mt-6 block" htmlFor="phone">
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
        <PinBoxes label="Choose a PIN" value={pin} onChange={setPin} />
      </div>
      <div className="mt-4">
        <PinBoxes label="Enter it again" value={pin2} onChange={setPin2} />
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
        Create account
      </button>

      <p className="mt-6 text-center text-[15px] text-ink-60">
        Already set up?{' '}
        <Link to="/login" className="font-semibold text-ink underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
