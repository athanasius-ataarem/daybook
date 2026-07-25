# 06 — Implementation Plan

Nine steps. Each one ends with something that runs. Do not start a step before
the previous one is committed and its acceptance criteria pass. Do not work on
two steps at once.

At the end of every step: `pnpm typecheck && pnpm test && pnpm lint`, then commit,
then append anything noteworthy to `DECISIONS.md`.

---

## Step 0 — Project setup

Scaffold only. No features.

- pnpm workspace: `packages/shared`, `packages/api`, `packages/web`.
- TypeScript strict everywhere, shared `tsconfig.base.json`,
  `noUncheckedIndexedAccess`, project references.
- ESLint + Prettier + Vitest wired at the root.
- `.env.example` already exists at the repo root — verify it matches
  `docs/02_TRD.md` §11 rather than recreating it.
- Root scripts: `dev`, `build`, `test`, `typecheck`, `lint`, `db:migrate`,
  `db:seed`.
- `DECISIONS.md` already exists at the repo root — leave it as is.

**Done when:** `pnpm dev` starts an empty Express server and an empty Vite app
concurrently, and `pnpm typecheck` is clean.

---

## Step 1 — The three dangerous functions

Build these before anything else, because a bug in any one of them costs a user
real money and will be found by a shop owner rather than by you.

`packages/shared`:

- `money.ts` — `formatGhs`, `formatGhsPlain`, `parseGhs`, `signed`.
- `businessDate.ts` — `resolveBusinessDate` with the 03:00 roll.
- `totals.ts` — `dayTotals`, `expectedCash`, `expectedMomo`.
- `schemas.ts` — zod schemas for entry, dayClose, and every request body.

Tests, written alongside:

- `parseGhs` against `"12"`, `"12."`, `"12.5"`, `"12.50"`, `"012.50"`,
  `"12.505"`, `".5"`, `""`, `"abc"`, `"12,50"`, `"1 2"`, `"-5"`, `"1e3"`.
  Of these, `"12"`, `"12."`, `"12.5"`, `"12.50"`, `"012.50"` and `".5"` parse;
  every other input throws, including `"12.505"` (more than two decimals).
- `resolveBusinessDate` at 02:59:59, 03:00:00, 00:00:00, 23:59:59, a month
  boundary, a year boundary, and 29 Feb.
- `formatGhsPlain` round-trips with `parseGhs` across 1,000 random integers
  (`formatGhs` output carries `GH₵` and thousands grouping, which `parseGhs`
  rejects by design).
- `dayTotals` excludes voided entries; returns zeros for an empty array.
- `expectedCash` / `expectedMomo` with a zero opening, a non-zero opening, and a
  day whose expenses exceed its sales.

**Done when:** every test passes and `grep -rn "toFixed" packages/shared/src`
returns nothing outside `money.ts`.

---

## Step 2 — API spine

- Prisma schema exactly as `docs/05_BACKEND_SCHEMA.md` §2, first migration.
- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /me`.
- argon2id PIN hashing, weak-PIN rejection, `failedLogins` / `lockedUntil`,
  per-IP and per-phone rate limits.
- JWT cookie issue and verify middleware.
- `POST /sync` with the immutability guard and the `since` delta.
- `GET /health`.
- Error envelope, request ids, redacting logger.

Verify with curl or a `.http` file only. **No UI in this step.**

Tests: the immutability guard (attempt to change `amountPesewas` on an existing
id → rejected, stored row unchanged), cross-user id access returns
`NOT_FOUND` not a leak, and the logger test asserting a payload containing `pin`
never reaches output.

**Done when:** a curl script can register, log in, sync 3 entries, sync them
again unchanged (idempotent, no duplicates), attempt a mutation of an immutable
field and see it rejected, and read them back via a `since` delta.

---

## Step 3 — Local store and the entry loop

Client-side only. **Point the app at nothing — the API must be switchable off and
the app still fully usable.**

- IndexedDB schema per `docs/05_BACKEND_SCHEMA.md` §4, via `idb`.
- The atomic write: record + outbox append in one `readwrite` transaction across
  both stores. Test it.
- Repository functions: `addEntry`, `voidEntry`, `updateNote`, `entriesForDate`,
  `recentDates`.
- Today screen: header, position block, entries list, empty state.
- Entry sheet: amount display, custom keypad, both toggles, note, date picker,
  save.
- Void via swipe, edit note via long-press.
- Tokens from `docs/03_UI_UX.md` §2 as Tailwind theme extensions and three
  self-hosted woff2 files.

**Done when:** with the API process stopped, you can record 20 entries, void one,
edit a note, close and reopen the browser, and everything is still there with
correct totals.

---

## Step 4 — Sync

- Outbox worker, flush triggers, per-item exponential backoff.
- `vite-plugin-pwa`: manifest, icons, precache the shell, `sw.js` served
  `no-cache`.
- Workbox Background Sync with a `setInterval` fallback.
- Sync dot with its four states and tap labels.
- 401 handling that does **not** sign the user out or hide local data.
- `rejected` surfacing under the dot.
- Paging when `hasMore`.

Test matrix, all manual and all mandatory:

1. Airplane mode: record 10 entries, re-enable network, confirm all 10 arrive
   exactly once.
2. API killed for a simulated week of use, then restarted.
3. Devtools 2G throttling — the UI must never block.
4. Two browsers, same account: entries created in one converge to the other.
5. Kill the tab mid-flush; nothing is lost and nothing duplicates.

**Done when:** all five pass and Lighthouse reports the app installable and
functional offline.

---

## Step 5 — Close of day

- Opening-balance derivation from the previous close; first-ever prompt.
- Expected computation and the **snapshot** onto the `DayClose`.
- The variance card per `docs/03_UI_UX.md` §3.4, with the `aria-live` sentence.
- `Record it` / `Leave it`.
- Re-open, and the warning when adding an entry to a closed day.
- Footer state change on Today.

Tests:

- A day with only expenses.
- A day with a zero counted cash.
- Overage as well as shortage.
- **The adversarial one:** close day 1, then add a backdated entry to day 1, then
  open day 1's summary. The snapshot must be unchanged. Then re-open and re-close
  day 1 and confirm it now reflects the new entry.
- Two closes attempted for the same date → the unique constraint holds and the
  client updates rather than duplicating.

**Done when:** all of the above pass, including the adversarial case.

---

## Step 6 — WhatsApp summary and History

- The plain-text summary builder, column-aligned, under 500 characters, with a
  unit test asserting the exact output for a known day.
- `wa.me` deep link plus a `Copy summary` fallback.
- History: 30 rows, net, reconciliation dot in its three states.
- `/day/:date` read-only view with entries and close summary.

**Done when:** a real WhatsApp message from a real phone reads as aligned
columns, and History shows a matched day, a short day and an unclosed day
correctly from seed data.

---

## Step 7 — Trust surface

The features that answer "what happens to my records if I stop using this". Not
optional, not deferrable.

- Privacy notice screen, ~250 words, plain language, per `docs/02_TRD.md` §10.
- `GET /api/me/export` CSV, plus the offline client-side path from IndexedDB.
- `DELETE /api/me` with PIN confirmation and cascading delete; clears IndexedDB.
- Overflow menu: Privacy, Export my records, Sign out, Delete my account.
- Sign-out guard when the outbox is non-empty.
- Accessibility floor from `docs/03_UI_UX.md` §6: focus rings, `aria-label`s,
  keypad as buttons, 200% text scaling without clipping.

**Done when:** an account can be exported and then genuinely deleted, and
re-registering the same phone number starts clean.

---

## Step 8 — Field readiness

- `pnpm db:seed` per `docs/05_BACKEND_SCHEMA.md` §8.
- Deploy: nginx config, PM2 ecosystem file, TLS, `pg_dump` nightly with a
  **tested** restore.
- Bundle check against the budgets in `docs/02_TRD.md` §8.
- Test on a physically borrowed low-end Android in daylight.
- `README.md`: setup, deploy, restore procedure, and a one-page
  "setting up a new shop in under four minutes" script for whoever does the
  in-person installs.

---

## Definition of done — the whole build

Ten checks. All must pass.

1. Cold open to sale saved in under 6 seconds on a mid-range Android, measured
   and recorded in `README.md`.
2. The app works for seven simulated days with the API unreachable, including
   close of day.
3. Backdated entry after a close does not move the closed day's snapshot.
4. Sync is idempotent: the same batch sent three times creates no duplicates.
5. An attempt to alter `amountPesewas`, `kind`, `channel` or `businessDate` on an
   existing record is rejected server-side and the stored row is unchanged.
6. No voided entry disappears from any view.
7. `grep -rn "toFixed" packages/` finds nothing outside `money.ts`.
8. Bundle within budget; zero external network requests at runtime (check the
   devtools network tab on a cold load — no CDN, no fonts, no analytics).
9. Lighthouse mobile: installable, works offline, accessibility ≥ 95.
10. An account can be exported and hard-deleted, and the phone number reused.

---

## What comes after, and only after

Do not start any of this until five real shops have used the app for two weeks.

The ordering is decided by what those shops ask for, but the expected first
addition is **credit sales / debtors**, because that is what Ghanaian retail
actually runs on. It is deliberately excluded from v1 so that the core loop —
record, close, reconcile — is proven on its own. Building it early would double
the surface area before anyone has confirmed the simple version is worth opening
twice.

Second most likely: **a reminder at closing time**, and **an assistant account
with entry-only rights**.

Record every real user request in `DECISIONS.md` under a "Requested by users"
heading, with the date and which shop asked. That list, not intuition, decides
v2.
