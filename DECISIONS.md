# DECISIONS

Append-only. Newest at the bottom of each section. Never rewrite or delete an
entry — if a decision is reversed, add a new one that says so and why.

Format: `YYYY-MM-DD — Decision. Alternatives considered. Reasoning.`

---

## Product

**2026-07-25 — Scope is one loop: money in, money out, close and reconcile.**
Alternatives: a fuller bookkeeping app; a POS. Reasoning: the failure mode for
this product is not too few features, it is a shop owner who opened it three
times and stopped. Everything that does not serve the closing-time reconciliation
is deferred.

**2026-07-25 — Credit sales / debtors excluded from v1.** Alternatives: include
it, since Ghanaian retail runs on credit. Reasoning: it roughly doubles the data
model and the UI surface. It is the expected first user request, and it should be
built once five shops have proven the simple loop is worth opening twice — not
before.

**2026-07-25 — No inventory, ever, in v1.** Reasoning: inventory is what kills
builds of this kind. It requires products, units, opening stock, and reconciliation
of its own, and it is the single largest source of abandoned setup.

**2026-07-25 — Close of day is the product, not a feature.** Reasoning: it is the
only moment the app tells the owner something they did not already know. It is
also the retention mechanism, and it gets the strongest visual treatment.

**2026-07-25 — Single user per shop. No roles, no staff accounts, no permissions
table.** Reasoning: adds auth complexity and a permissions surface before anyone
has asked. An entry-only assistant account is a v2 candidate.

## Data and correctness

**2026-07-25 — All money as integer pesewas in `*Pesewas` fields.**
Alternatives: `Decimal` in Postgres; floats. Reasoning: floats are disqualifying
for money; `Decimal` complicates the client and IndexedDB round-tripping.
Integers are exact everywhere and cheap.

**2026-07-25 — `amountPesewas` always positive; direction lives in `kind`.**
Alternatives: signed amounts. Reasoning: signed amounts combined with voiding
creates a class of cancellation bug that is hard to see in a list.

**2026-07-25 — Entries are append-only. No hard delete, no edit of amount, kind,
channel or date. Corrections happen by voiding.** Alternatives: editable entries;
soft delete that hides the row. Reasoning: the product's only real job is to be
trustworthy about money. An owner who suspects entries can silently change or
disappear will stop using it. Voided rows stay visible in place.

**2026-07-25 — `businessDate` is set on the device and stored as a `DATE`, with a
03:00 day roll.** Alternatives: derive the date server-side from the timestamp.
Reasoning: a shop closing at 1am considers that the same trading day, and an
entry synced three days later must keep its original business date. Ghana is
UTC+0 with no DST, so no timezone library is needed.

**2026-07-25 — `DayClose` snapshots its expected values.** Alternatives:
recompute expected on read. Reasoning: a backdated entry must never silently
rewrite a past reconciliation. Recomputing on read would make yesterday's
verified figure change overnight, which destroys trust in the whole record.

**2026-07-25 — Client-generated UUIDv4 ids, server upserts on them.**
Alternatives: server-assigned sequential ids. Reasoning: makes sync idempotent
and retry-safe, and means the UI never waits for a network round trip.

**2026-07-25 — No third `kind` and no transfer type.** Money to the bank or the
owner's pocket is an `EXPENSE` on the channel it left from. Cash-to-MoMo is two
entries. Reasoning: crude but correct for the only question the app answers —
does each channel balance.

**2026-07-25 — Totals computed on the client on every render; never cached, no
totals endpoint.** Reasoning: a few hundred entries a month makes this free, and
a cached aggregate is a bug waiting to diverge from its source.

**2026-07-25 — Close-of-day expected spans every entry since the last close, not
just today's.** Alternatives: today-only, as first drafted in `04_APP_FLOW.md`
§5. Reasoning: missed days are allowed, so the opening can come from a close
several days back; summing only today's entries would report the gap days'
trading as a phantom variance — the exact wrong number the product exists to
prevent. DayClose snapshot semantics are unchanged.

**2026-07-25 — A void is write-once: the server never overwrites a non-null
`voidedAt` with null.** Alternatives: pure last-write-wins on all three mutable
fields. Reasoning: a stale second device editing a note would silently un-void
an entry and put its amount back into the totals. There is no un-void in the UI,
so nothing legitimate is lost.

**2026-07-25 — DayClose immutability on `/sync`: only `businessDate` is
immutable; balance fields and `closedAt` are last-write-wins.** Reasoning:
re-open and re-close legitimately rewrite the snapshot; the date is the record's
identity.

**2026-07-25 — A second device closing an already-closed date: the server applies
the incoming DayClose as an update to the existing row and rejects the incoming
id with `DUPLICATE_DAY`; the client adopts the surviving row.** Alternatives:
reject outright (the second device could never close); insert (violates the
unique constraint). DayCloses are not append-only money records, so replacing
the local duplicate is safe.

**2026-07-25 — `parseGhs` parses the digit string directly and rejects more than
two decimal places.** Alternatives: `Math.round(input * 100)`. Reasoning: float
multiplication turns 12.505 into 1250.4999…; string parsing is exact. The keypad
cannot produce a third decimal, so rejecting costs nothing.

**2026-07-25 — `formatGhsPlain` never groups thousands.** Reasoning: it feeds the
CSV (a comma breaks an unquoted field) and the `parseGhs` round-trip test. The
WhatsApp builder does its own `GH₵`-plus-grouping formatting, matching the
example in `04_APP_FLOW.md` §6.

## Technical

**2026-07-25 — React + Vite PWA, not Next.js.** Reasoning: no SSR requirement,
smaller bundle, and `vite-plugin-pwa` is the shortest path to a reliable service
worker.

**2026-07-25 — Hand-rolled outbox sync on `idb`, not a sync framework.**
Alternatives: PouchDB, RxDB, Replicache. Reasoning: the conflict surface here is
tiny by design — only three mutable fields, guarded by server-side immutability —
so a framework would add bundle weight and a second mental model for no benefit.
Revisit only if multi-device editing becomes a real requirement.

**2026-07-25 — React context plus `idb` for state. No Redux, Zustand, or query
library.** Reasoning: IndexedDB is the source of truth; there is no server cache
to manage.

**2026-07-25 — Custom on-screen keypad for amounts, not the OS keyboard.**
Reasoning: the OS keyboard is slow to appear, covers most of the screen, and its
layout varies by device. Amount entry is the most-repeated action in the app.

**2026-07-25 — WhatsApp share via a `wa.me` deep link, not the Business API.**
Reasoning: zero cost, zero integration, no approval process, no recipient stored.
A `Copy summary` fallback covers devices where the link no-ops.

**2026-07-25 — Everything self-hosted. No CDN fonts, no analytics, no crash
reporter, no external requests at runtime.** Reasoning: users buy data in small
bundles and every kilobyte is a felt cost. Also removes an entire class of
privacy obligation.

**2026-07-25 — No dark mode in v1.** Reasoning: the device is used in daylight at
a counter, and a partial dark mode is worse than none.

**2026-07-25 — Immutable-field sync conflicts are reported inside the 200
response's `rejected` list, never as HTTP 409.** Reasoning: one bad record in a
batch of 500 cannot be a status code for the whole request. The 409 branch in
`04_APP_FLOW.md` §7 was vestigial and has been removed.

**2026-07-25 — `lastChannel` is persisted in IndexedDB `meta`, not
session-only.** Alternatives: session-only, as the UI doc first said. Reasoning:
the meta row already existed in the schema, and a MoMo-heavy shop gets the right
default every morning.

**2026-07-25 — History dot: green only for an exact match; red for any non-zero
difference, overage included; grey if never closed.** Alternatives: green for
overage, as the wireframe showed. Reasoning: the dot answers "did it match", and
GH₵5 of unexplained extra money is still unexplained. Wireframe corrected.

**2026-07-25 — Variance buttons are `Record it` / `Leave it`.** The UI doc said
"Record the difference"; the flow doc, plan and kickoff all said "Record it".
Shorter wins on a 360px screen, and an action keeps one name.

**2026-07-25 — Entry rows read "Channel · note" (or the kind word when there is
no note), with 12-hour times.** Per the wireframe; the channel word also stops
channel being conveyed by colour alone.

**2026-07-25 — Seed data closes 12 of 14 days and leaves one mid-fortnight day
plus the current day open.** The counts in `05_BACKEND_SCHEMA.md` §8 did not add
up to 14.

**2026-07-25 — Hand-rolled ~50-line history router; no react-router.**
Alternatives: react-router-dom (~20 KB gz). Reasoning: six routes and
sheets-as-state need pushState, popstate and a Link. The bundle budget is a
build-failing threshold and the saved weight is real.

**2026-07-25 — Hand-rolled .env loader, cookie codec, rate limiter and JSON
logger on the api; no dotenv, cookie-parser, express-rate-limit or pino.**
Reasoning: each is under 40 lines for our exact need; the login lock lives on
the user row anyway, and one PM2 process makes an in-memory limiter correct.
Fewer dependencies to audit for an app holding money records.

**2026-07-25 — Dev-only dependencies added: tsx and esbuild (api dev/build),
fake-indexeddb (the atomicity test needs IndexedDB in vitest), workbox-core /
-precaching / -routing / -window (bundled into the service worker by
vite-plugin-pwa — they ship no separate runtime request).** None affect the
shipped bundle beyond the service worker Workbox code the PWA plugin requires.

**2026-07-25 — Fonts fetched once at build-setup from Google Fonts and
committed as self-hosted woff2 (Archivo 600, IBM Plex Sans 400/600, latin
subsets, 60,660 bytes total).** No runtime request ever goes to a CDN; the
files live in `packages/web/public/fonts`.

**2026-07-25 — Sync merge guard: a server record is not merged into IndexedDB
while that record still has pending outbox items.** Reasoning: the response to
a flush echoes the just-flushed state; merging it over a note edited a moment
later would silently revert the newer local value.

**2026-07-25 — Close-flow mechanics: `Leave it` (or a matched count) reveals a
final `Close the day` button which persists the snapshot; `Record it` creates
the correcting entries and everything recomputes live.** `04_APP_FLOW.md` §5
implies persisting directly on `Leave it`; an explicit final button keeps one
obvious commit point and changes nothing about what is stored.

**2026-07-25 — Close-day counting is explicit: keypad stays while a field is
edited, `Next` moves between cash and MoMo, `Show the difference` reveals the
variance card.** Alternatives: live-computing the card as soon as both fields
had any digit (the first build). Reasoning: found on a real phone in the first
field test — the keypad vanished after one digit of the second amount and a
half-typed number was "calculated". The variance must be computed from numbers
the owner has finished typing, never from keystrokes in flight.

**2026-07-25 — Backoff counts only real server failures; connectivity problems
never escalate.** A fetch that cannot reach the network, and gateway/ratelimit
statuses (429, 502, 503, 504), defer the item ~5s without touching `attempts`;
only genuine server errors walk the 2s→hourly ladder and park at 50. Explicit
triggers (online event, app foreground, a fresh mutation) flush immediately,
ignoring backoff timestamps — the schedule paces only the automatic interval.
Reasoning: found while scripting the airplane-mode test — under the original
reading, every offline save escalated every pending item, so a week offline
could falsely park entries as "could not save" the moment network returned.

**2026-07-25 — Local development runs a dedicated PostgreSQL 16 cluster in
`.pgdata/` on port 5433 with trust auth,** started with `pg_ctl`, instead of
touching the machine's existing 5432 cluster. Production remains 5432 on the
VM per the TRD. Dev machine runs Node 24; the deploy target stays Node 20 LTS.

## Security and auth

**2026-07-25 — Phone number plus 4-digit PIN, argon2id.** Alternatives: password;
SMS OTP; magic link. Reasoning: the user has no email and will not type a
password on a counter. A 4-digit PIN is weak, so the mitigations are mandatory:
per-IP and per-phone rate limits, a 15-minute lock after five failures stored on
the user row, weak-PIN rejection, and identical responses for unknown number and
wrong PIN.

**2026-07-25 — No SMS OTP in v1.** Reasoning: registration happens in person with
the salesperson present, so there is nothing to verify. **SMS OTP is a hard
requirement before any self-serve signup exists** — recorded here so it is not
forgotten when that day comes.

**2026-07-25 — No PIN reset flow in v1.** Reasoning: no email, no SMS provider. A
forgotten PIN is handled out of band by whoever did the install. A dead "forgot
PIN" link would be worse than none.

**2026-07-25 — A 401 must never sign the user out or hide local data.**
Reasoning: local reads require no session. Locking someone out of their own
records because a cookie expired during a long offline stretch would be the worst
possible failure.

**2026-07-25 — A 401 at app open with local data present renders Today (session
marked stale, grey dot) instead of routing to `/login`.** Alternatives: the
login wall `04_APP_FLOW.md` §3 first specified. Reasoning: matches the sync-401
policy and the decision above; login is demanded only when the user next needs
to sync.

**2026-07-25 — Every PIN-verifying endpoint shares the login lockout and rate
limits.** `DELETE /api/me` takes a PIN; without the shared `failedLogins` /
`lockedUntil` counters it would be a brute-force oracle that bypasses the login
mitigations.

**2026-07-25 — Weak-PIN reject list enumerated:** the ten repeats `0000`–`9999`,
plus `1234`, `4321`, `1212`, `1313`, `1010`, `1122`, `2580`, `2000`, `2001`,
`6969`, plus any PIN from `1940` to `2035` (birth-year patterns). "The 20 most
common" was not implementable as written.

## Requested by users

Nothing yet. Add every real request here with the date and which shop asked.
**This list, not intuition, decides v2.**

---

## Pending — decide before the relevant step

- **Domain name.** Needed before Step 8. HTTPS is required for the service
  worker, and changing domains later invalidates every installed home-screen icon.
- **Restore procedure verified.** Fill in `README.md` once a `pg_dump` restore has
  actually been tested.
- **Pricing.** Not a build decision. Charge nothing until someone asks what it
  costs; GHS 50/month is the anchor when they do.
