# 02 — Technical Requirements Document

## 1. Decided stack — do not substitute

| Layer | Choice | Version | Why this one |
|---|---|---|---|
| Frontend | React + Vite + TypeScript | React 18, Vite 5 | Existing team fluency; Vite's PWA plugin is the shortest path to a reliable service worker |
| Styling | Tailwind CSS | 3.4 | No runtime CSS-in-JS cost on a slow phone |
| PWA | `vite-plugin-pwa` (Workbox) | latest 0.20.x | Precache, offline shell, install prompt |
| Local store | `idb` | 8.x | Thin typed wrapper over IndexedDB; no sync framework |
| Backend | Node + Express + TypeScript | Node 20 LTS, Express 4 | Matches existing VM deployments |
| ORM | Prisma | 5.x | Migrations and typed client |
| Database | PostgreSQL | 16 | Already running on the VM |
| Password hashing | `argon2` (argon2id) | latest | |
| Auth transport | JWT in httpOnly cookie (`jose`) | | |
| Validation | `zod` | 3.x | Shared schemas between web and api |
| Testing | Vitest | 1.x | Unit only in v1 |
| Process manager | PM2 | | |
| Reverse proxy | nginx + Let's Encrypt | | HTTPS is mandatory for service workers |

**Explicitly rejected:** Next.js (no SSR need, heavier bundle), Redux/Zustand
(React context plus `idb` is sufficient), Redis, Docker, any BaaS, any sync
framework (PouchDB, RxDB, Replicache), any component library, any charting
library, any i18n library in v1.

Adding a dependency requires a line in `DECISIONS.md` naming the alternative
considered and the bundle cost.

## 2. Repository layout

```
daybook/
├── CLAUDE.md
├── DECISIONS.md
├── README.md
├── docs/
├── package.json            # pnpm workspace root
├── packages/
│   ├── shared/             # zod schemas, money helpers, date helpers, types
│   ├── api/
│   │   ├── prisma/schema.prisma
│   │   └── src/
│   │       ├── index.ts
│   │       ├── routes/{auth,sync,me}.ts
│   │       ├── middleware/{auth,rateLimit,errors}.ts
│   │       └── lib/{jwt,pin,logger}.ts
│   └── web/
│       └── src/
│           ├── main.tsx
│           ├── db/{schema.ts,entries.ts,dayCloses.ts,outbox.ts}
│           ├── sync/{worker.ts,backoff.ts}
│           ├── screens/{Today,Entry,CloseDay,History,Privacy,Auth}
│           ├── components/{Keypad,AmountDisplay,SegmentToggle,SyncDot,...}
│           └── lib/{format.ts,businessDate.ts,totals.ts}
```

`packages/shared` is the single home for money helpers, `resolveBusinessDate`,
and the zod schemas used by both sides. Duplication of those three things across
packages is a defect.

## 3. Coding standards

- TypeScript `strict: true`. No `any`. No non-null assertions except in tests.
- `noUncheckedIndexedAccess: true`.
- ESLint with `@typescript-eslint/recommended-type-checked`; Prettier, 2-space,
  single quotes, semicolons, 90-column print width.
- Named exports only, except React screen components which default-export.
- No barrel `index.ts` re-export files.
- Functions that touch money take and return `number` pesewas, and say so in the
  parameter name (`amountPesewas`). A bare `amount` is a review failure.
- Dates crossing a boundary are ISO strings. `Date` objects stay inside a module.
- Errors: server returns `{ error: { code, message, details? } }` with a stable
  machine-readable `code`. The client switches on `code`, never on `message`.
- Every route handler is wrapped so a thrown error becomes a 500 with a request
  id, and the id appears in both the response and the log line.

## 4. Money

```ts
// packages/shared/src/money.ts
export type Pesewas = number; // integer, always

export function formatGhs(p: Pesewas): string;       // 1250 -> "GH₵12.50"
export function formatGhsPlain(p: Pesewas): string;   // 1250 -> "12.50"  (ungrouped: CSV + round-trip)
export function parseGhs(input: string): Pesewas;     // "12.5" -> 1250, throws on junk
export function signed(p: Pesewas): string;           // -2500 -> "−GH₵25.00" (U+2212)
```

Rules: integers only; `parseGhs` parses the digit string directly — never
`* 100` on a float — and rejects more than two decimal places; maximum single
entry 99,999,999 pesewas; reject zero and negative on entry. `formatGhsPlain`
never groups thousands: it feeds the CSV and the round-trip test, and display
grouping belongs to the caller. Unit-test `parseGhs` against `"12"`, `"12."`, `"12.5"`, `"12.50"`,
`"012.50"`, `"12.505"`, `".5"`, `""`, `"abc"`, `"12,50"`, `"1 2"`.

Display all amounts with `font-variant-numeric: tabular-nums`.

## 5. Dates and the business day

```ts
// packages/shared/src/businessDate.ts
export const DAY_ROLL_HOUR = 3;
export function resolveBusinessDate(deviceNow: Date): string; // "YYYY-MM-DD"
```

- Ghana is UTC+0 with no daylight saving. Do not add a timezone library.
- `businessDate` is set on the **device** at entry time and stored as a `DATE`.
  Never recompute it server-side from a timestamp.
- Entries created between 00:00 and 02:59 device-local belong to the **previous**
  calendar date, because a shop that closes at 1am considers that the same
  trading day.
- Unit-test the boundaries: 02:59:59, 03:00:00, 23:59:59, 00:00:00, and a
  month-end and year-end roll.

## 6. Auth

- Identifier is a Ghanaian phone number normalised to E.164 (`+233…`). Accept
  `024…`, `24…`, `+23324…`, `23324…` on input; store one canonical form.
- Credential is a 4-digit PIN. Hash with argon2id, `memoryCost` 19456 KiB,
  `timeCost` 2, `parallelism` 1.
- A 4-digit PIN is weak by design — the mitigations are the mandatory ones:
  - Rate limit `POST /auth/login` to 10 per hour per IP **and** 10 per hour per
    phone number.
  - Lock the account for 15 minutes after 5 consecutive failures; the lock is
    stored on the user row, not in memory.
  - Reject weak PINs at registration: the ten repeats `0000`–`9999`, plus
    `1234`, `4321`, `1212`, `1313`, `1010`, `1122`, `2580`, `2000`, `2001`,
    `6969`, plus any PIN from `1940` to `2035` (birth-year patterns).
  - Never reveal whether a phone number exists. Same response and same timing
    for unknown number and wrong PIN.
- No OTP and no SMS provider in v1 — registration happens in person with the
  salesperson present. Note in `DECISIONS.md` that SMS OTP is the required
  addition before any self-serve signup.
- JWT: HS256, 180-day expiry, claims `{ sub, iat, exp }` only. Cookie
  `httpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. Renew on every successful
  `/sync` if more than 7 days old.
- **No PIN recovery flow in v1.** A forgotten PIN is handled by the operator out
  of band. Document this; do not invent a reset via email.

## 7. Sync

One endpoint, `POST /api/sync`. Contract and semantics in
`docs/05_BACKEND_SCHEMA.md` §5.

Client requirements:

1. A mutation writes the record and appends to the `outbox` store **in one
   IndexedDB transaction**, then resolves. No network in the write path.
2. Flush triggers: app foreground, `online` event, after any successful
   mutation, and every 60 seconds while open.
3. Use Workbox Background Sync where supported, with a `setInterval` fallback.
   Do not depend on Background Sync alone — coverage on older Android WebViews
   is unreliable.
4. Per-item exponential backoff: 2s, 8s, 30s, 2m, 10m, then hourly. Cap
   `attempts` at 50, then park the item and surface it.
5. Batch cap 500 records per call; the client pages.
6. Conflict policy: last-write-wins on the mutable fields only (`note`,
   `voidedAt`, `voidReason`), with one exception: a stored non-null `voidedAt`
   is never overwritten with null — a void is write-once, so a stale device
   cannot silently un-void an entry. The immutability guard makes other real
   conflicts nearly impossible by construction.
7. `rejected` ids are surfaced quietly in the Today header, never as a modal.

## 8. Performance budget

Treat these as build-failing thresholds, not aspirations.

| Metric | Budget |
|---|---|
| Initial JS, gzipped | ≤ 120 KB |
| Initial CSS, gzipped | ≤ 15 KB |
| Fonts, total | ≤ 60 KB (3 woff2 files, latin subset) |
| Time to interactive, mid-range Android, 3G | ≤ 3 s first load, ≤ 1 s repeat |
| Cold open to sale saved | ≤ 6 s |
| Sync payload, typical day | ≤ 8 KB |

Measures: `vite-bundle-visualizer` in CI-equivalent local check, Lighthouse
mobile with throttling, and one manual test on a physical low-end phone.

Fonts are self-hosted woff2, latin subset, `font-display: swap`, preloaded.
Three files maximum. No icon font — inline SVG icons only, drawn in the repo.

## 9. Security

- HTTPS only. HSTS with a 6-month max-age once the domain is settled.
- `helmet` with a strict CSP: `default-src 'self'`, no `unsafe-inline` for
  scripts, no external origins at all.
- CORS locked to the single app origin; credentials allowed.
- Every request body validated with a zod schema before it reaches a handler.
  Coerce nothing silently — reject.
- Ownership check on every record: `userId` comes from the JWT, never from the
  payload. Any `userId` in a payload is ignored, and its presence is logged.
- Server-side bounds: amount 1..99,999,999 pesewas; `businessDate` within 90
  days past and 1 day future; `note` ≤ 200 chars; `voidReason` ≤ 200 chars.
- Redact `pin`, `pinHash`, and `Cookie` from every log line. Add a logger test
  asserting a payload containing `pin` never appears in output.
- `POST /auth/register` rate limited to 5 per hour per IP.
- Every endpoint that verifies a PIN (`/auth/login`, `DELETE /api/me`) shares
  the same `failedLogins` / `lockedUntil` counters and rate limits — no PIN
  oracle outside the login lock.
- No user-generated HTML anywhere; notes render as text nodes only.

## 10. Data protection

The operator becomes a data controller under Ghana's **Data Protection Act 2012**
in respect of phone numbers and business financial records. Build requirements:

- A privacy notice screen in plain English, reachable from the header, stating
  what is collected, where it is hosted, that it is shared with no one, the
  retention period, and how to obtain a copy or a deletion.
- `DELETE /api/me` performs a real cascading hard delete of the user, entries,
  and closes, and clears the local IndexedDB. Not a support-email link.
- `GET /api/me/export` returns a CSV of every entry, generated server-side, plus
  a client-side path that works offline from IndexedDB.
- Retention: financial records retained while the account exists; deleted within
  30 days of an account deletion request, including from backups. State the
  backup window honestly in the notice.
- No data leaves the VM. No processor, no analytics, no crash reporter.

## 11. Environment variables

```
# api
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://daybook:...@localhost:5432/daybook
JWT_SECRET=                  # 32+ random bytes, base64
COOKIE_DOMAIN=daybook.example
APP_ORIGIN=https://daybook.example
LOG_LEVEL=info

# web (build-time)
VITE_API_BASE=/api
VITE_APP_NAME=Daybook
```

`.env.example` ships with every variable named and commented. The app must
refuse to boot with a missing or short `JWT_SECRET` rather than defaulting.

## 12. Deployment

- nginx serves the built `web/dist` as static files with long cache headers on
  hashed assets and `no-cache` on `index.html` and `sw.js`.
- `/api` proxies to the Express process on `127.0.0.1:4000`.
- PM2 ecosystem file, one app, `max_memory_restart: 300M`, logs rotated.
- `pg_dump` nightly to a separate disk, 14-day retention, restore procedure
  documented in `README.md` and tested once before the first real user.
- A `GET /api/health` returning `{ ok, db }` for uptime checking.
