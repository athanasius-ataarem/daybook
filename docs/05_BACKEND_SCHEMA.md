# 05 — Backend Schema

## 1. Principles

1. **Client-generated ids.** `id` is a UUIDv4 created on the device before the
   record is saved locally. The server upserts on it. This makes sync retry-safe
   and means the UI never waits for a server key.
2. **Append-only money.** Once written, `amountPesewas`, `kind`, `channel` and
   `businessDate` are immutable. Only `note`, `voidedAt` and `voidReason` change.
   Enforced in the `/sync` handler and asserted by a test.
3. **Integers only.** All money is `Int` pesewas, in `*Pesewas` fields.
4. **Snapshot, don't recompute.** A `DayClose` stores the expected values as they
   stood at close time. Historical reconciliations must never move.
5. **Tenant of one.** Every row hangs off a `User`. `userId` always comes from
   the JWT, never from a payload.

## 2. Prisma schema

```prisma
generator client { provider = "prisma-client-js" }
datasource db    { provider = "postgresql"; url = env("DATABASE_URL") }

model User {
  id            String     @id @default(uuid())
  phone         String     @unique              // E.164, e.g. "+233241234567"
  pinHash       String
  shopName      String
  createdAt     DateTime   @default(now())
  lastSeenAt    DateTime?                       // updated on each successful /sync
  failedLogins  Int        @default(0)
  lockedUntil   DateTime?
  entries       Entry[]
  dayCloses     DayClose[]
}

model Entry {
  id              String    @id                 // client UUIDv4
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  businessDate    DateTime  @db.Date            // device-resolved trading day
  kind            EntryKind
  channel         Channel
  amountPesewas   Int                           // > 0 always; direction lives in `kind`
  note            String?   @db.VarChar(200)

  createdAtDevice DateTime                      // device clock at entry
  createdAt       DateTime  @default(now())     // server receipt
  updatedAt       DateTime  @updatedAt

  voidedAt        DateTime?
  voidReason      String?   @db.VarChar(200)

  @@index([userId, businessDate])
  @@index([userId, updatedAt])                  // drives the `since` delta
}

model DayClose {
  id                    String    @id           // client UUIDv4
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  businessDate          DateTime  @db.Date

  openingCashPesewas    Int
  openingMomoPesewas    Int
  expectedCashPesewas   Int                     // snapshot at close
  expectedMomoPesewas   Int                     // snapshot at close
  countedCashPesewas    Int
  countedMomoPesewas    Int

  closedAt              DateTime?               // null = re-opened
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([userId, businessDate])
  @@index([userId, updatedAt])
}

enum EntryKind { SALE EXPENSE }
enum Channel   { CASH MOMO }
```

Notes on choices:

- `amountPesewas` is always positive. Sign is derived from `kind` at read time.
  Storing signed amounts invites a class of bug where a void and a negative
  cancel confusingly.
- There is no third `kind` and no transfer type. **Money leaving the drawer for
  the bank, for a supplier, or for the owner's pocket is an `EXPENSE` on the
  channel it left from, with a note.** Cash converted to MoMo (or the reverse) is
  two entries: an `EXPENSE` on one channel and a `SALE` on the other, same
  amount. This is crude accounting and it is correct for this product — the only
  question the app answers is whether each channel balances.
- `@db.Date` on `businessDate` so Postgres stores no time and no zone. Read it
  back as a `YYYY-MM-DD` string; never let a `Date` object with a time component
  cross the API boundary.
- `updatedAt` indexes exist purely to serve the `since` delta on `/sync`.
- `onDelete: Cascade` is what makes `DELETE /api/me` a real deletion.
- `failedLogins` and `lockedUntil` live on the row, not in memory, so the lock
  survives a PM2 restart.

## 3. Derived values — never stored

```ts
// packages/shared/src/totals.ts
type DayTotals = {
  salesCash: Pesewas;  salesMomo: Pesewas;
  expCash:   Pesewas;  expMomo:   Pesewas;
  inTotal:   Pesewas;  outTotal:  Pesewas;  net: Pesewas;
};

function dayTotals(entries: Entry[]): DayTotals;      // excludes voided
function expectedCash(opening: Pesewas, t: DayTotals): Pesewas;  // opening + salesCash − expCash
function expectedMomo(opening: Pesewas, t: DayTotals): Pesewas;
```

At close time, `t` is computed over every non-voided entry with a `businessDate`
after the last closed date up to and including today — not today alone — so
unclosed gap days are included and a skipped day never produces a phantom
variance.

Today's totals are computed on the client from IndexedDB every render. There is
no totals endpoint and no cached aggregate. At the volumes involved — a few
hundred entries a month — this is free, and a cached total is a bug waiting to
diverge from its source.

The **only** place expected values are persisted is the `DayClose` snapshot.

## 4. IndexedDB schema

Database `daybook`, version 1. Four stores.

```ts
entries      keyPath 'id'
             index 'byBusinessDate'  → 'businessDate'
             index 'byUpdatedAt'     → 'updatedAtLocal'

dayCloses    keyPath 'id'
             index 'byBusinessDate'  → 'businessDate'   unique

outbox       keyPath 'seq' (autoIncrement)
             { seq, recordType: 'entry'|'dayClose', recordId, op: 'upsert',
               attempts, nextAttemptAt, lastError }

meta         keyPath 'key'
             rows: 'lastSyncAt', 'userId', 'shopName', 'lastChannel', 'sessionStale'
```

Rules:

- Records in `entries` and `dayCloses` mirror the server shape exactly, plus a
  local-only `updatedAtLocal` used for ordering.
- **A mutation writes the record and appends to `outbox` inside a single
  `readwrite` transaction spanning both stores.** If that transaction is not
  atomic, an entry can exist locally and never sync, which is the worst possible
  failure for this product. Assert it in a test.
- The outbox stores a *reference*, not a payload copy, so a later note edit
  flushes the current state rather than a stale snapshot.
- On sign-out, clear all four stores only after confirming the outbox is empty or
  the user has explicitly overridden.

## 5. API

Base `/api`. Cookie auth on everything except the two auth routes and `/health`.

| Method | Route | Body / Query | Returns |
|---|---|---|---|
| GET | `/health` | — | `{ ok: true, db: true }` |
| POST | `/auth/register` | `{ phone, pin, shopName }` | `201 { user }` + cookie |
| POST | `/auth/login` | `{ phone, pin }` | `200 { user }` + cookie |
| POST | `/auth/logout` | — | `204` |
| GET | `/me` | — | `{ id, phone, shopName, lastSeenAt }` |
| GET | `/me/export` | — | `200 text/csv` |
| DELETE | `/me` | `{ pin }` | `204`, cascading hard delete |
| POST | `/sync` | see below | see below |

### `POST /sync`

```jsonc
// request
{
  "since": "2026-07-24T18:03:11.000Z",   // null on first ever sync
  "entries": [
    {
      "id": "8f1c...",
      "businessDate": "2026-07-25",
      "kind": "SALE",
      "channel": "CASH",
      "amountPesewas": 24000,
      "note": "Paracetamol carton",
      "createdAtDevice": "2026-07-25T16:12:04.000Z",
      "voidedAt": null,
      "voidReason": null
    }
  ],
  "dayCloses": [ /* full DayClose objects, same shape as the model */ ]
}
```

Handler, in order:

1. Validate with zod. Reject the whole request on a schema failure — do not
   partially accept malformed input.
2. Bounds: `amountPesewas` 1..99,999,999; `businessDate` within 90 days past and
   1 day future; `note` and `voidReason` ≤ 200 chars; arrays ≤ 500 items each.
3. Discard any `userId` in the payload; log that it was present.
4. For each record, in one transaction per record type:
   - Not found → create with `userId` from the JWT.
   - Found → **immutability guard.** If `amountPesewas`, `kind`, `channel` or
     `businessDate` differ from stored, push `{ id, reason: 'IMMUTABLE_FIELD',
     fields: [...] }` onto `rejected` and skip. Otherwise update only `note`,
     `voidedAt`, `voidReason` (last-write-wins, except a stored non-null
     `voidedAt` is never overwritten with null — a void is write-once).
   - For a `DayClose`, only `businessDate` is immutable; the balance fields and
     `closedAt` update last-write-wins. A new `DayClose` id colliding with
     `@@unique([userId, businessDate])` is applied as an update to the existing
     row for that date; the incoming id goes onto `rejected` with
     `reason: 'DUPLICATE_DAY'` and the surviving row is returned, so the client
     replaces its local duplicate.
   - Found but belonging to another user → `rejected` with `reason: 'NOT_FOUND'`.
     Never reveal that the id exists.
5. Query everything for this user with `updatedAt > since` (all rows when `since`
   is null), capped at 500 per type, and return it.
6. Update `user.lastSeenAt`. Renew the cookie if it is more than 7 days old.

```jsonc
// response
{
  "serverTime": "2026-07-25T19:22:04.000Z",
  "entries":   [ /* server-side changes since `since` */ ],
  "dayCloses": [ /* ditto */ ],
  "rejected":  [ { "id": "8f1c...", "reason": "IMMUTABLE_FIELD", "fields": ["amountPesewas"] } ],
  "hasMore":   false
}
```

`hasMore: true` means the client should immediately call again with `since` set
to the newest `updatedAt` it received.

### Error shape

```jsonc
{ "error": { "code": "PIN_INCORRECT", "message": "...", "requestId": "r_8f1c" } }
```

Stable codes: `VALIDATION_FAILED`, `PHONE_TAKEN`, `PIN_INCORRECT`,
`ACCOUNT_LOCKED`, `WEAK_PIN`, `NOT_AUTHENTICATED`, `RATE_LIMITED`,
`IMMUTABLE_FIELD`, `DUPLICATE_DAY`, `INTERNAL`. The client switches on `code` only.

## 6. Permissions and roles

There are none, deliberately. One user, one shop, all their own records. No
roles table, no permission checks beyond "does this row's `userId` match the
JWT's `sub`". A staff-entry role is a v2 concern and must not be scaffolded now.

## 7. CSV export

One row per entry, including voided ones, ordered by `businessDate` then
`createdAtDevice`. Amounts as plain decimals so Excel and Google Sheets parse
them without coercion games.

```csv
business_date,time,kind,channel,amount_ghs,note,voided,void_reason
2026-07-25,16:12,SALE,CASH,240.00,Paracetamol carton,no,
2026-07-25,11:04,SALE,CASH,50.00,,yes,entered twice
```

Filename `daybook-<shop-slug>-<YYYY-MM-DD>.csv`. Generated server-side at
`/api/me/export`, and client-side from IndexedDB so the export also works
offline. Both paths use the same shared formatter.

## 8. Seed data

`pnpm db:seed` creates one user (`+233240000000` / PIN `4726`, shop "Mawuli
Pharmacy") and 14 business days of plausible activity:

- 8–20 sales per day, GHS 5–450, roughly 60% cash and 40% MoMo
- 1–4 expenses per day (fuel, transport, stock top-up, water)
- one voided entry somewhere in the fortnight
- 12 of the 14 days closed; one mid-fortnight day and the most recent day left
  open; one closed with a GHS 25 cash shortage and one with a GHS 5 overage

That last requirement exists so the History screen and the variance card can be
seen in all three of their states without hand-entering data.
