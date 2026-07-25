> **SUPERSEDED — NOT A SPECIFICATION.**
>
> This was the original single-file brief for Daybook. It has been replaced by
> `CLAUDE.md` and the numbered documents in `docs/`, which are the only
> authoritative sources. It is kept for the reasoning behind certain decisions.
>
> Known points where it is now WRONG:
>
> - Build order: it gives 5 steps. The real plan is 9 steps in
>   `docs/06_IMPLEMENTATION_PLAN.md`, which splits the money/date/totals helpers
>   into their own first step and adds a trust-surface step.
> - History window: §2 says a 7-day list. It is 30 days.
> - `User.lastSyncAt` is now `User.lastSeenAt`.
> - IndexedDB has four stores, not three — a `meta` store was added.
> - The `/sync` response includes `hasMore` for paging, and typed `rejected`
>   reason codes.
> - It omits: the per-phone login rate limit, weak-PIN rejection, the
>   performance budget, the colour and type tokens, and the 401-must-not-sign-out
>   rule.
>
> Do not implement from this file.

---

# DAYBOOK — Build Brief (v1 MVP)

A daily cashbook for single-shop traders in Ghana. Records cash and MoMo sales and
expenses, and at closing time tells the owner whether the money in the drawer and
the MoMo balance match what was sold.

Target user: owner or shopkeeper of a pharmacy, agro-input dealer, hardware shop,
provisions store or guesthouse in Bolgatanga. Low-end Android phone, intermittent
2G/3G, GHS 5–20 of data per week, moderate literacy, high numeracy.

**The whole product is one loop:** enter money in → enter money out → at closing,
count and compare. Anything that does not serve that loop is out of scope.

---

## 1. Non-negotiable constraints

1. **Offline-first.** Every write must succeed with no network. Sync is
   background and invisible. If the app ever shows a spinner or an error because
   the network is down, the build has failed.
2. **Under 6 seconds to record a sale**, from cold app open to saved, one hand,
   without reading any label.
3. **Onboarding under 4 minutes** standing at a counter, done by the salesperson
   on the owner's phone.
4. **No floating point money.** All amounts are integers in pesewas.
5. **Works on a 5-inch 720p screen with one thumb**, in daylight.

---

## 2. Explicit non-goals for v1

Do not build, do not scaffold, do not leave TODOs for:

- Inventory or stock tracking
- Products or SKUs
- Customers, debtors, or credit sales
- Printed or PDF receipts
- Multiple users, staff accounts, or roles
- Suppliers or purchase orders
- Charts, graphs, or any analytics beyond a 7-day list
- Payments, subscriptions, or billing
- Multi-currency
- Email of any kind
- Mobile money API integration
- Photo attachments
- Categories or tags for expenses (a free-text note is enough)
- Any admin panel

If a requirement seems to imply one of the above, stop and leave it out.

> Note for the maintainer, not for this build: credit sales ("customer owes me")
> is the single most likely first request from real users. It is deliberately
> excluded from v1 so the loop stays provable. Do not pre-build hooks for it.

---

## 3. Stack

- **Frontend:** React 18 + Vite, TypeScript, PWA (vite-plugin-pwa, Workbox),
  Tailwind. Installable, offline-capable.
- **Local store:** IndexedDB via `idb`. This is the source of truth for the UI.
- **Backend:** Node 20 + Express, TypeScript.
- **DB:** PostgreSQL 16 with Prisma.
- **Auth:** phone number + 4-digit PIN. `argon2id` hash. JWT in an httpOnly,
  Secure, SameSite=Lax cookie, 180-day expiry, sliding renewal on each sync.
- **Deploy:** existing Ubuntu VM, nginx reverse proxy, PM2, Let's Encrypt.
  HTTPS is mandatory — service workers will not register without it.
- No Redis, no queue, no Docker, no third-party SDKs.

---

## 4. Domain rules

### 4.1 Money

All monetary values are `Int` columns named `*_pesewas`. GHS 12.50 is stored as
`1250`. Format for display with a single shared helper:
`formatGhs(1250) === "GH₵12.50"`. Never construct currency strings ad hoc.

Amount entry accepts up to 2 decimal places, max GHS 999,999.99 per entry.

### 4.2 Business date

The trading day, **not** a UTC timestamp derived value.

- `business_date` is a `DATE` (no time, no zone), set on the **device** at the
  moment of entry from the device's local calendar date.
- Ghana is UTC+0 with no DST, so device-local and UTC dates coincide in practice
  — but store the date explicitly anyway. Do not recompute it server-side from
  `created_at`. A backdated entry synced three days later must keep its original
  business date.
- A "day roll hour" of 03:00 applies: entries made between 00:00 and 02:59 are
  assigned to the **previous** calendar date, because shops that close late
  think of that as the same trading day. Implement this in one function,
  `resolveBusinessDate(deviceNow): string`, and unit test it.
- The user can change the date on an entry via a date picker, but the default is
  always today's resolved business date.

### 4.3 Entries

Two kinds, two channels:

- `kind`: `SALE` | `EXPENSE`
- `channel`: `CASH` | `MOMO`

Nothing else. A withdrawal from the drawer to the bank or to a personal wallet is
recorded as a `CASH` `EXPENSE` with a note.

**Entries are append-only.** There is no hard delete and no edit of `amount`,
`kind`, or `channel`. A mistake is corrected by voiding:

- `voided_at` timestamp + `void_reason` free text (optional).
- Voided entries are excluded from all totals but remain visible in the day list
  with a strikethrough and a "voided" marker.
- The `note` field alone is editable after creation.

This matters because the app's only real job is to be trustworthy about money.
An owner who suspects entries can silently disappear will stop using it.

### 4.4 IDs and idempotency

The **client** generates `id` as a UUIDv4 for every entry, before saving locally.
The server upserts on that id. This makes sync retry-safe and means the UI never
waits for a server-assigned key. Same rule for `day_close` records.

### 4.5 Close of day — the core feature

This is the reason the product exists. Do not treat it as a secondary screen.

At closing, the user is asked two questions:

1. How much cash is in the drawer right now?
2. What does your MoMo balance say?

The app then shows, side by side:

```
                 Expected      Counted      Difference
Cash             GH₵1,240.00   GH₵1,215.00   −GH₵25.00
MoMo             GH₵  860.00   GH₵  860.00    GH₵ 0.00
```

Computation:

```
expected_cash  = opening_cash
               + sum(SALE, CASH)
               - sum(EXPENSE, CASH)

expected_momo  = opening_momo
               + sum(SALE, MOMO)
               - sum(EXPENSE, MOMO)
```

- `opening_cash` / `opening_momo` for a given business date = the `counted_*`
  values from the most recent prior `day_close` for that user. If none exists
  (first ever day), prompt the user once for opening balances and store them on
  that first close.
- Snapshot `expected_cash_pesewas` and `expected_momo_pesewas` onto the
  `day_close` row at close time. Do not recompute historical closes on read — a
  later backdated entry must not silently rewrite a past reconciliation.
- If a difference is non-zero, show it plainly in a warning colour with the
  amount and no editorialising. Offer one action: "Record the difference as an
  expense" (creates a `CASH`/`MOMO` `EXPENSE` note "shortage on <date>"), or
  "Leave it". Never auto-correct.
- A day can be closed once. Re-opening a closed day is allowed (soft: clear
  `closed_at`), and it must recompute on the next close.

### 4.6 WhatsApp summary

No API, no integration, no cost. Build a plain-text summary and open a
`https://wa.me/?text=<urlencoded>` deep link so the OS share sheet / WhatsApp
picks it up and the user chooses the recipient.

Format (keep it under 500 characters, no markdown, no emoji beyond none):

```
<SHOP NAME> — Sat 25 Jul 2026

Sales:      GH₵2,100.00
  Cash      GH₵1,240.00
  MoMo      GH₵  860.00
Expenses:   GH₵  180.00
Net:        GH₵1,920.00

Cash counted: GH₵1,215.00 (short GH₵25.00)
MoMo balance: GH₵  860.00 (ok)

Sent from Daybook
```

Align the numbers with padding so it reads as a column in WhatsApp's font.

---

## 5. Data model (Prisma)

```prisma
model User {
  id            String   @id @default(uuid())
  phone         String   @unique          // E.164, e.g. +233241234567
  pinHash       String
  shopName      String
  createdAt     DateTime @default(now())
  lastSyncAt    DateTime?
  entries       Entry[]
  dayCloses     DayClose[]
}

model Entry {
  id              String    @id            // client-generated UUIDv4
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  businessDate    DateTime  @db.Date
  kind            EntryKind
  channel         Channel
  amountPesewas   Int
  note            String?
  createdAtDevice DateTime                 // device clock at entry
  createdAt       DateTime  @default(now())// server receipt
  voidedAt        DateTime?
  voidReason      String?

  @@index([userId, businessDate])
}

model DayClose {
  id                    String    @id      // client-generated UUIDv4
  userId                String
  user                  User      @relation(fields: [userId], references: [id])
  businessDate          DateTime  @db.Date
  openingCashPesewas    Int
  openingMomoPesewas    Int
  expectedCashPesewas   Int
  expectedMomoPesewas   Int
  countedCashPesewas    Int
  countedMomoPesewas    Int
  closedAt              DateTime?
  createdAt             DateTime  @default(now())

  @@unique([userId, businessDate])
}

enum EntryKind { SALE EXPENSE }
enum Channel   { CASH MOMO }
```

Mirror this shape in IndexedDB with two object stores (`entries`, `dayCloses`)
plus an `outbox` store holding `{ id, type, payload, attempts, lastError }`.

---

## 6. API

All routes under `/api`. Cookie auth except where noted.

| Method | Route | Notes |
|---|---|---|
| POST | `/auth/register` | `{ phone, pin, shopName }`. No OTP in v1 — the salesperson is physically present at signup. Rate limit 5/hour/IP. |
| POST | `/auth/login` | `{ phone, pin }`. Rate limit 10/hour/IP, and lock the account for 15 minutes after 5 consecutive failures. |
| POST | `/auth/logout` | |
| GET | `/me` | Returns user + `lastSyncAt`. |
| POST | `/sync` | The only data route. See below. |

### `POST /sync`

Request:

```json
{
  "since": "2026-07-24T18:03:11.000Z",
  "entries":   [ { ...full entry... } ],
  "dayCloses": [ { ...full dayClose... } ]
}
```

Behaviour:

1. Upsert every supplied entry and dayClose by `id`, scoped to the
   authenticated `userId`. Ignore any `userId` in the payload.
2. Immutability guard: if an existing row is found, only `note`, `voidedAt` and
   `voidReason` may change. Reject changes to `amountPesewas`, `kind`,
   `channel`, `businessDate` with 409 and the offending ids.
3. Return everything for this user changed server-side since `since`, so a
   second device or a reinstall converges.

Response:

```json
{
  "serverTime": "2026-07-25T19:22:04.000Z",
  "entries": [],
  "dayCloses": [],
  "rejected": []
}
```

Batch size cap 500 per call; the client pages.

---

## 7. Screens

Four. No navigation drawer, no settings maze. A bottom bar with two items
(Today, History) and a floating action button.

### 7.1 Entry (the FAB opens this, full screen)

- **Amount first.** A large custom numeric keypad, not the OS keyboard —
  digits 0–9, one decimal point, backspace. Digit targets at least 64px tall.
  The amount displays at the top in a very large font.
- Two big segmented toggles below the keypad: `Sale / Expense` and `Cash / MoMo`.
  Defaults: Sale, Cash. Remember the last-used channel within the session.
- One optional single-line note field. Collapsed behind a small "Add note" link
  so it never gets in the way.
- One full-width `Save` button. On save: haptic tick, the sheet closes, the new
  entry animates into the top of the day list, and the totals recount. No toast,
  no confirmation dialog, no navigation.
- The date defaults to the resolved business date and is shown as small
  tappable text ("Today · 25 Jul") that opens a date picker.

### 7.2 Today

- Header: shop name, business date, and a small sync status dot
  (synced / pending N / offline).
- Big block: **Net today**, with Sales and Expenses beneath it, each split
  Cash / MoMo.
- Below: the day's entries, newest first. Amount, kind icon, channel label,
  note, time. Swipe left on a row → Void (with a confirm sheet asking for an
  optional reason). Long-press → edit note.
- Sticky footer button: **Close the day** (becomes "Day closed · view summary"
  once closed).

### 7.3 Close of day

The two count inputs, then the comparison table from §4.5, then two buttons:
`Send to WhatsApp` and `Done`.

### 7.4 History

A flat list of the last 30 business dates: date, net, and a red/green dot for
whether that day reconciled. Tap to see that day's entries and close summary,
read-only. No filters, no search, no export in v1.

### Visual direction

Dense, high-contrast, utilitarian. This is a tool used at a counter with a
customer waiting, not a lifestyle app. One accent colour, generous type scale,
tabular numerals for all amounts (`font-variant-numeric: tabular-nums`), and
enough contrast to read in direct sunlight. Amounts are the largest thing on
every screen.

Copy: plain English, short. "Money in" and "Money out" are clearer to this user
than "Revenue" and "Expenditure". Avoid accounting vocabulary entirely.

---

## 8. Sync engine

Requirements:

1. Every mutation writes to IndexedDB **and** appends to `outbox` in a single
   transaction, then returns. The UI reads only from IndexedDB.
2. A sync worker attempts to flush the outbox on: app foreground,
   `navigator.onLine` becoming true, a successful mutation, and every 60s while
   the app is open. Use Workbox Background Sync where available, with a plain
   `setInterval` fallback — do not depend on Background Sync alone, coverage on
   older Android WebViews is poor.
3. Exponential backoff per item: 2s, 8s, 30s, 2m, 10m, then hourly. Never block
   the UI on a retry.
4. Conflict policy: last-write-wins on the editable fields only. The
   immutability guard in §6 means real conflicts are near-impossible by design.
5. `rejected` ids from the server are surfaced once, quietly, on the Today
   header ("1 entry could not sync") with a tap-through list. Do not modal it.
6. The app must fully function, including close of day, with the backend
   unreachable for a week. Test this by killing the API and using the app for a
   simulated week.

---

## 9. Security and data protection

- HTTPS only, HSTS on. Secure + httpOnly + SameSite=Lax cookie.
- Server-side validation on every field. Reject negative or zero amounts,
  amounts over 99,999,999 pesewas, business dates more than 90 days in the past
  or 1 day in the future, notes over 200 characters.
- `helmet`, CORS locked to the app origin, `express-rate-limit` on auth routes.
- PIN is never logged. Scrub `pin` and `pinHash` from all log output.
- No analytics SDK, no third-party scripts, no fonts loaded from a CDN.
  Self-host everything. Users pay for their own data.
- **Data protection:** this app makes its operator a data controller under
  Ghana's Data Protection Act 2012 in respect of phone numbers and business
  financial records. Include a plain-language privacy notice screen, reachable
  from the header menu, stating what is stored, where it is hosted, that it is
  not shared with anyone, and how the user can request deletion. Implement
  account deletion as a real endpoint (`DELETE /me`, hard-deletes the user and
  cascades) — not a mailto link.
- Add a visible "Export my data" action that downloads a CSV of all entries.
  This exists to answer the trust question a shop owner will actually ask:
  *what happens to my records if I stop using this?*

---

## 10. Build order

Ship each step working before starting the next.

**Step 1 — spine (≈1 day).** Prisma schema, migrations, auth, `/sync`,
`resolveBusinessDate` with unit tests, money helpers with unit tests. Verify
with curl only. No UI.

**Step 2 — screens against IndexedDB (≈1 day).** Entry sheet, Today, keypad,
void. Local only — do not wire sync yet. The app should be fully usable with the
API turned off.

**Step 3 — sync (≈1 day).** Outbox, worker, backoff, status dot, PWA manifest
and service worker, installability. Test in airplane mode, then with the API
killed, then with 2G throttling in devtools.

**Step 4 — close of day + WhatsApp + History (≈1 day).** The reconciliation
table, the snapshot logic, the share text, the 30-day list.

**Step 5 — field polish (≈half day).** Privacy notice, CSV export, account
deletion, empty states, one-time first-run hint on the Today screen.

### Definition of done

- Cold open to saved sale in under 6 seconds on a mid-range Android, measured.
- Lighthouse PWA installable, and passes with the network offline.
- A simulated 30-day week of entries reconciles correctly, including a backdated
  entry added after a day was closed (the closed day's snapshot must not move).
- Every amount on screen uses `formatGhs`. Grep for `toFixed` and remove it.
- Works on Chrome for Android 100+ and on one physically borrowed cheap phone.

---

## 11. Deliverables

- `README.md` — setup, env vars, deploy to the VM, nginx config, PM2 ecosystem.
- `DECISIONS.md` — every judgement call made during the build, with the
  reasoning, plus a running "deferred features and why" list.
- Seed script generating 14 days of plausible Bolgatanga shop activity for demos.
- `.env.example` with every variable named and commented.
