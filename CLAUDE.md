# CLAUDE.md — Daybook

Read this first, every session. It is the contract.

## What this is

A daily cashbook for single-shop traders in Ghana. Records cash and MoMo money in
and money out, and at closing tells the owner whether the drawer and the MoMo
balance match what was sold.

## Documents — read before writing code

| Doc | Read it when |
|---|---|
| `docs/01_PRD.md` | Deciding whether something is in scope |
| `docs/02_TRD.md` | Choosing a library, a pattern, or an env var |
| `docs/03_UI_UX.md` | Building or restyling any screen |
| `docs/03_wireframes.svg` | Laying out a screen — this is the reference, follow it |
| `docs/04_APP_FLOW.md` | Wiring navigation, auth, or any state transition |
| `docs/05_BACKEND_SCHEMA.md` | Touching Prisma, IndexedDB, or `/sync` |
| `docs/06_IMPLEMENTATION_PLAN.md` | Starting or finishing a step |
| `README.md` | Setup, commands, deployment |

`KICKOFF.md` and `FIELD_SETUP.md` are for the human, not for you. Read them for
context if useful, but they are not specifications.

`DECISIONS.md` is a running log. Append to it every time you make a judgement
call the docs did not cover. Never silently deviate from a doc — if a doc is
wrong, say so, propose the change, and record it.

**`ORIGIN_BRIEF.md` at the repo root is superseded and is NOT a specification.**
It is the earlier single-file brief, kept only for the reasoning behind some
decisions. Where it disagrees with `docs/`, `docs/` is correct. Do not implement
anything from it. Do not cite it.

## Hard rules — violating any of these is a failed build

1. **No floating point money.** All amounts are integers in pesewas, in fields
   named `*Pesewas`. Format only through `formatGhs()`. Never use `toFixed` on a
   monetary value.
2. **Offline-first.** Every write goes to IndexedDB and returns. The UI reads
   only from IndexedDB, never from a network response. If the app shows a
   spinner or an error because the network is down, it is broken.
3. **Client-generated UUIDv4 ids.** The server upserts on them. The UI never
   waits for a server-assigned key.
4. **Entries are append-only.** No hard delete, no edit of `amountPesewas`,
   `kind`, `channel`, or `businessDate`. Corrections happen by voiding.
5. **Closed days are frozen.** A `DayClose` snapshots its expected values. A
   backdated entry must never change a past reconciliation.
6. **No third-party runtime dependencies for anything user-facing.** No CDN
   fonts, no analytics, no tracking pixels, no external SDKs. Self-host
   everything. Users pay for their own data by the megabyte.
7. **Stay in scope.** The non-goals list in `docs/01_PRD.md` §5 is binding. If a
   task seems to require one of those features, stop and ask.

## Stack, fixed

React 18 + Vite + TypeScript + Tailwind (PWA via `vite-plugin-pwa`), IndexedDB
via `idb`, Node 20 + Express + TypeScript, PostgreSQL 16 + Prisma, `argon2id`,
JWT in an httpOnly cookie. Deployed to an existing Ubuntu VM behind nginx with
PM2. No Redis, no Docker, no queue, no ORM other than Prisma, no state library
other than React context plus `idb`.

Do not add a dependency without recording the reason in `DECISIONS.md`.

## Commands

```bash
pnpm dev            # api + web concurrently
pnpm test           # vitest, unit only
pnpm typecheck      # tsc --noEmit across both packages
pnpm lint
pnpm db:migrate     # prisma migrate dev
pnpm db:seed        # 14 days of plausible shop activity
pnpm build
```

Run `pnpm typecheck && pnpm test` before declaring any step done.

## Working style

- Build in the order given in `docs/06_IMPLEMENTATION_PLAN.md`. Each step must
  run and be usable before the next begins.
- Small commits, one concern each, conventional commit messages.
- Write the unit tests for `resolveBusinessDate`, `formatGhs`, and the
  reconciliation maths as you write those functions, not afterwards. They are
  the three places a bug costs a user real money.
- Never leave a `TODO` for a non-goal feature. Delete the thought.
- When something in these docs conflicts with something else, `CLAUDE.md` wins,
  then the PRD, then the rest.
