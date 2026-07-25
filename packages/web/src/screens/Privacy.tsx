import { useState, type ReactNode } from 'react';
import { navigate } from '../lib/router';
import { exportCsvFromDevice } from '../lib/exportCsv';
import { OverflowMenu } from '../components/OverflowMenu';

// ~250 words, plain language, no legalese, no accordion.

export default function Privacy(): ReactNode {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="mx-auto min-h-screen max-w-md pb-10">
      <header className="flex items-center gap-2 border-b border-rule px-2 py-3">
        <button
          type="button"
          aria-label="Back"
          className="h-11 w-11 text-[20px]"
          onClick={() => navigate('/')}
        >
          ←
        </button>
        <p className="text-[15px] font-semibold">Privacy</p>
      </header>

      <main className="space-y-4 px-4 pt-4 text-[17px] leading-relaxed">
        <p>
          Daybook keeps your money records so you can check your drawer and your MoMo
          balance at the end of the day. Here is exactly what that involves.
        </p>
        <p>
          <strong>What we keep.</strong> Your shop name, your phone number, and the
          entries you record: amounts, whether each was cash or MoMo, any note you
          typed, and your end-of-day counts. Nothing else. No location, no contacts,
          no photos.
        </p>
        <p>
          <strong>Where it lives.</strong> On this phone, and on one server that
          exists only for Daybook. Your records are not shared with anyone — not
          sold, not analysed by any other company, not sent anywhere else. There are
          no trackers and no adverts in this app.
        </p>
        <p>
          <strong>Your PIN.</strong> It is stored scrambled, in a way that cannot be
          read back. Nobody can look it up, which is also why it cannot be reset —
          if you forget it, contact whoever set up Daybook for you.
        </p>
        <p>
          <strong>Your rights.</strong> You can download every record as a file, any
          time, even without network. You can delete your account, which destroys
          everything on the server straight away and clears this phone. Nightly
          backup copies are kept for 14 days, so within 30 days of deleting, every
          trace is gone from those too.
        </p>
        <p>
          <strong>How long we keep records.</strong> For as long as you keep your
          account. Stop using Daybook and your records simply wait for you; delete
          the account and they are gone.
        </p>

        <div className="space-y-2 pt-2">
          <button
            type="button"
            className="h-12 w-full rounded bg-ink font-semibold text-white"
            onClick={() => void exportCsvFromDevice()}
          >
            Export my records
          </button>
          <button
            type="button"
            className="h-12 w-full rounded border border-short font-semibold text-short"
            onClick={() => setMenuOpen(true)}
          >
            Delete my account
          </button>
        </div>
      </main>

      <OverflowMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
