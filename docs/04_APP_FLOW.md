# 04 — App Flow

## 1. Routes

Six routes only. Everything else is a sheet over the current route, so the
underlying scroll position and state survive.

```
/login            unauthenticated
/register         unauthenticated
/                 Today            (default authenticated route)
/history          History
/day/:date        A past day, read-only
/privacy          Privacy notice
```

Sheets, not routes: entry sheet, void confirm, edit note, close-of-day,
opening-balance prompt, overflow menu, delete-account confirm.

Back-button behaviour: a sheet consumes the back gesture and closes. On Today
with no sheet open, back exits the app. Never trap the user.

## 2. First run — cold install to first sale

This is the flow that happens standing at a counter, with a salesperson holding
the phone. Target: under 4 minutes. Every extra step here costs a customer.

```
Open link (daybook.example) in Chrome
  → App shell loads, /login
  → "Create an account"  →  /register
      Shop name
      Phone  (+233 prefix fixed, 9 digits typed)
      PIN    (4 digits, entered twice)
      → POST /auth/register
          201 → cookie set, IndexedDB initialised, → /
          409 (phone taken) → inline: "That number already has an account. Sign in instead."
          offline → block with: "You need network just for this first step."
  → Today, empty state
  → Browser install prompt, or the salesperson uses Chrome ⋮ → Add to Home screen
  → Tap +  →  amount  →  Save
  → First entry visible. Done.
```

**Registration is the only screen in the app that requires network.** Say so
plainly if it is unavailable. Everything after this point works offline forever.

The install step is done *by the salesperson*, not left to the user. If the
`beforeinstallprompt` event fires, show a single unobtrusive bar: "Add Daybook to
your home screen" with `Add` and `Not now`. Never nag twice.

## 3. Authentication flow

```
App open
  → read cookie via GET /me
      200            → hydrate from IndexedDB, render Today, trigger sync
      401 + local data present  → render Today from IndexedDB, mark the session
                                  stale (grey dot); ask for login only when the
                                  user next needs to sync
      401 + no local data       → /login
      network error  → if local data exists, render Today offline and skip auth entirely
```

The 401-with-data and network-error branches matter: **an expired or unreachable session must never lock a
user out of their own local records.** The cookie lasts 180 days and renews on
sync, so in practice this only bites after a long offline stretch. Local reads
require no valid session. Only `/sync` does.

```
/login
  phone + PIN → POST /auth/login
    200  → cookie set, → /
    401  → "That number and PIN don't match. Try again."   (identical response for unknown number)
    423  → "Too many tries. Wait 15 minutes and try again."
    5 failures → lock 15 min
```

Sign out: confirm sheet warning that unsynced entries will be lost if they have
not uploaded, showing the count. If the outbox is non-empty, offer `Sync first`
and disable `Sign out` until it drains or the user overrides.

There is no PIN reset in v1. The overflow menu says: "Forgot your PIN? Contact
whoever set up Daybook for you." No dead link.

## 4. The core loop — recording money

```
Today
  → tap +  (entry sheet slides up, 150ms)
      amount via custom keypad
      toggle Money in / Money out      (default: Money in)
      toggle Cash / MoMo               (default: last used, persisted in meta.lastChannel, else Cash)
      optionally: Add note
      optionally: change date
  → Save
      1. build entry { id: uuidv4(), businessDate: the date picked in the sheet
                        (defaults to resolveBusinessDate(now)), ... }
      2. IndexedDB transaction: put entry + append outbox item     ← atomic
      3. resolve; haptic; sheet closes; row animates in; totals recount
      4. fire-and-forget sync attempt (never awaited by the UI)
```

Steps 2 and 3 must not depend on step 4 in any way. If sync throws, the user
sees nothing but the sync dot changing colour.

### Void

```
Row swipe left → Void
  → confirm sheet: "Void this GH₵240.00 entry?" + optional reason field
  → set voidedAt, voidReason; IndexedDB put + outbox append
  → row goes struck-through and dimmed in place; totals recount
```

No undo, because the void *is* the undo, and it is itself reversible only by
recording a fresh entry. Say nothing about deletion — the row never disappears.

### Edit note

Long-press → sheet with a single input → save. The only mutable field on an
entry besides the void pair.

## 5. Close of day

```
Today → "Close the day"
  ├─ No entries today?
  │     → "There is nothing to close yet. Record a sale first."  (button disabled)
  ├─ No prior DayClose for this user (first ever close)
  │     → Opening balance step
  │         "How much cash and MoMo did you start with today? We only need this once."
  │         two inputs → continue
  └─ Otherwise
        openingCash = previous close's countedCash
        openingMomo = previous close's countedMomo
        (previous = most recent DayClose with businessDate < today, closedAt set)

  → Count step
      counted cash input
      counted MoMo input
  → compute
      expectedCash = openingCash + Σ(SALE,CASH) − Σ(EXPENSE,CASH)
      expectedMomo = openingMomo + Σ(SALE,MOMO) − Σ(EXPENSE,MOMO)
          [non-voided entries with businessDate after the last closed date, up
           to and including today — unclosed gap days are included, so a skipped
           day never shows up as a phantom shortage or overage]
      diff = counted − expected
  → Variance card + one plain sentence
  → if any diff ≠ 0:
        "Record it"  → creates EXPENSE (if short) or SALE (if over) on the same
                       businessDate, same channel, note "shortage on 25 Jul" /
                       "extra on 25 Jul", then recomputes and re-renders
        "Leave it"   → proceed with the difference recorded on the DayClose
  → persist DayClose { id: uuidv4(), openings, expecteds (snapshot), counteds, closedAt }
  → Send to WhatsApp  |  Done → Today (footer now reads "Day closed · view summary")
```

### Re-opening a closed day

Allowed, from the day summary: `Re-open this day` clears `closedAt` but keeps the
row. The expected snapshot is recomputed on the next close. Adding an entry to a
day that is already closed shows a one-line warning — "This day is already
closed. Re-open it to update the summary." — and still saves the entry. The
snapshot does not move until the day is closed again.

### Missed days

If the user last closed three days ago, do not force them to close the gap. Each
day's opening simply comes from the most recent close, whenever that was, and
the expected at the next close includes every entry recorded since that close,
so gap-day trading never reads as a false variance. Show a neutral line on the
History rows for unclosed days ("not closed") and no nagging prompt. Chasing users about missed days is how apps get uninstalled.

## 6. WhatsApp share

```
Close summary → "Send to WhatsApp"
  → build plain text (format below)
  → window.location.href = `https://wa.me/?text=${encodeURIComponent(text)}`
```

### Summary format

Plain text. No markdown, no emoji, under 500 characters. Pad the amounts with
spaces so the figures align as a column in WhatsApp's font — this is the whole
reason it reads as a record rather than a paragraph.

```
MAWULI PHARMACY — Sat 25 Jul 2026

Money in:   GH₵2,100.00
  Cash      GH₵1,240.00
  MoMo      GH₵  860.00
Money out:  GH₵  180.00
Net:        GH₵1,920.00

Cash counted: GH₵1,215.00 (short GH₵25.00)
MoMo balance: GH₵  860.00 (ok)

Sent from Daybook
```

Rules:

- The shop name is upper-cased, truncated at 28 characters.
- Omit the two count lines entirely if the day has not been closed; end after
  `Net`.
- Bracketed status is one of `(ok)`, `(short GH₵X.XX)`, `(over GH₵X.XX)`.
- The builder formats its own numbers: `GH₵` prefix plus thousands-grouped
  digits (`formatGhsPlain` stays ungrouped — it belongs to the CSV and the
  round-trip test). Pad left to a common width computed from the longest amount
  in the message — do not hard-code the padding.
- Unit-test the builder against a known day, asserting the exact string.

No API, no cost, no recipient stored. The OS share sheet or WhatsApp handles
recipient choice. If WhatsApp is absent, the link is a no-op on some devices, so
also offer a `Copy summary` fallback button that writes to the clipboard.

## 7. Sync flow

```
Trigger: foreground | 'online' event | after any mutation | 60s interval
  → if outbox empty AND lastSyncAt < 60s ago → skip
  → POST /api/sync { since: lastSyncAt, entries: [...], dayCloses: [...] }   (≤500 records)
      200 → remove flushed items from outbox
            merge returned server-side changes into IndexedDB
            set lastSyncAt = response.serverTime
            surface response.rejected if non-empty
            more pending? → immediately page again
      401 → do not sign the user out. Mark the session stale, keep working
            locally, show the dot as offline-grey, retry on next foreground.
      (immutable-field conflicts are never an HTTP status — they arrive in the
       200 response's `rejected` list. Never overwrite the local copy silently;
       list them under the sync dot.)
      429 / 5xx / network → per-item backoff 2s, 8s, 30s, 2m, 10m, hourly
```

The sync dot is the only surface for all of this. No modals, no banners, no
error toasts, ever.

## 8. Error and empty states

| Situation | What the user sees |
|---|---|
| No entries today | "No entries yet today. Tap + to record your first sale." |
| No history | "Your past days will show up here once you close your first day." |
| Offline | Sync dot grey. On tap: "No network. Your records are safe on this phone." |
| Registration attempted offline | "You need network just for this first step." |
| Wrong PIN | "That number and PIN don't match. Try again." |
| Locked out | "Too many tries. Wait 15 minutes and try again." |
| Entry rejected by server | Dot red. On tap: a list of the affected entries and "These could not save. Show this to your Daybook contact." |
| Amount is zero | Save button simply disabled. No error message. |
| Storage quota exceeded | "This phone is out of space. Free some space so Daybook can keep saving." |

Errors never apologise, never blame the user, and always name the next action.

## 9. Account deletion

```
⋮ → Delete my account
  → sheet: plain text of exactly what is destroyed and that it cannot be undone
  → "Export my records first" (primary, offers the CSV)
  → type PIN to confirm
  → DELETE /api/me → cascading hard delete
  → clear IndexedDB, clear cookie, → /login
  → if offline: refuse and say "You need network to delete your account."
```

Deletion must be reachable in two taps from Today and must genuinely delete.
This is both a Data Protection Act obligation and the single most persuasive
answer to the question a shop owner will actually ask: *what happens to my
records if I stop using this?*
