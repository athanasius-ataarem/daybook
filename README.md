# Daybook

A daily cashbook for single-shop traders in Ghana. Records cash and mobile money
coming in and going out, and at closing time tells the owner whether the money in
the drawer and the MoMo balance match what was sold.

**Status: built through Step 8 on a dev machine; not yet deployed.** All
packages typecheck, unit tests pass, and the offline loop, sync, close-of-day,
WhatsApp summary, export and delete flows are implemented. Deployment to the
VM (nginx + PM2 + TLS) and the physical-phone field checks remain.

---

## Read these first

| File | What it is |
|---|---|
| `CLAUDE.md` | The contract. Hard rules, stack, doc index, working style. |
| `docs/01_PRD.md` | What we're building, for whom, and what is out of scope. |
| `docs/02_TRD.md` | How it's built. Stack, standards, budgets, security. |
| `docs/03_UI_UX.md` | Tokens, screens, states, copy rules. |
| `docs/03_wireframes.svg` | Layout reference for the four core screens. |
| `docs/04_APP_FLOW.md` | Routes, auth, the entry loop, close of day, sync, errors. |
| `docs/05_BACKEND_SCHEMA.md` | Prisma models, IndexedDB stores, the `/sync` contract. |
| `docs/06_IMPLEMENTATION_PLAN.md` | Nine build steps with acceptance criteria. |
| `KICKOFF.md` | The exact prompts to give Claude Code, in order. |
| `FIELD_SETUP.md` | The in-person install script and validation plan. |
| `DECISIONS.md` | Running log. Append, never rewrite. |
| `ORIGIN_BRIEF.md` | **Superseded.** History only. Do not implement from it. |

Precedence when documents disagree: `CLAUDE.md`, then `docs/01_PRD.md`, then the
rest of `docs/`. `ORIGIN_BRIEF.md` is never authoritative.

---

## Prerequisites

- Node 20 LTS
- pnpm 9
- PostgreSQL 16, running locally
- A browser with devtools (Chrome, for the service worker and throttling tools)
- For field testing: one low-end Android phone

---

## Setup

```bash
git clone <repo> daybook && cd daybook
pnpm install

cp .env.example .env
openssl rand -base64 48          # paste into JWT_SECRET

sudo -u postgres createuser daybook --pwprompt
sudo -u postgres createdb daybook --owner=daybook
# put the password into DATABASE_URL in .env

pnpm db:migrate
pnpm db:seed                     # 14 days of sample shop activity
pnpm dev                         # api on :4000, web on :5173
```

Seed login: `+233240000000`, PIN `4726`.

## Commands

```bash
pnpm dev         # api + web concurrently
pnpm test        # vitest, unit only
pnpm typecheck   # tsc --noEmit across all packages
pnpm lint
pnpm db:migrate  # prisma migrate dev
pnpm db:seed
pnpm build       # web to packages/web/dist, api to packages/api/dist
```

Run `pnpm typecheck && pnpm test && pnpm lint` before every commit.

---

## Testing offline behaviour

The single most important property of this app is that it works with no network.
Test it deliberately, not incidentally:

```bash
# 1. kill the api and use the app for a while
pm2 stop daybook-api        # or ctrl-C the dev api process

# 2. record entries, void one, close the day — all must work

# 3. bring it back and confirm everything arrives exactly once
pm2 start daybook-api
```

Also: Chrome devtools → Network → Offline, and → No throttling → Slow 3G. Neither
should ever produce a spinner, an error toast, or a lost entry.

---

## Deployment

Static web behind nginx, api on PM2, Postgres local, TLS via Let's Encrypt.

```bash
pnpm build
# rsync packages/web/dist to the server web root
# rsync packages/api/dist + package.json, then pnpm install --prod on the server
pm2 start ecosystem.config.cjs
pm2 save
```

nginx serves `web/dist` with long cache headers on hashed assets and
**`no-cache` on `index.html` and `sw.js`** — getting that wrong strands users on
an old service worker. `/api` proxies to `127.0.0.1:4000`.

HTTPS is mandatory. Service workers do not register over plain HTTP, so the PWA
silently stops being a PWA.

### Backups

`pg_dump` nightly to a separate disk, 14-day retention (`deploy/backup.sh`,
installed via cron). **Test the restore before the first real user**, not after.

Restore procedure — tested 2026-07-25 against a seeded database (229 entries,
12 closes; restored counts matched the source exactly):

```bash
# 1. dump (what the cron job runs nightly)
pg_dump -U daybook -d daybook -Fc -f daybook-YYYY-MM-DD.dump

# 2. restore into a fresh database and verify the counts
createdb -U daybook daybook_restored
pg_restore -U daybook -d daybook_restored daybook-YYYY-MM-DD.dump
psql -U daybook -d daybook_restored -c 'SELECT count(*) FROM "Entry"'
psql -U daybook -d daybook_restored -c 'SELECT count(*) FROM "DayClose"'

# 3. swap it in and restart
psql -U postgres -c 'ALTER DATABASE daybook RENAME TO daybook_broken'
psql -U postgres -c 'ALTER DATABASE daybook_restored RENAME TO daybook'
pm2 restart daybook-api
```

---

## Setting up a new shop in under four minutes

The in-person install script, for whoever is standing at the counter. The
fuller field playbook is `FIELD_SETUP.md`.

1. Open Chrome on the owner's phone → go to the Daybook URL.
2. Chrome ⋮ → **Add to Home screen** (or tap `Add` if the bar offers it). Put
   the icon on the first screen, next to WhatsApp.
3. **Create an account**: shop name, their phone number, a PIN **they** choose.
   Say once: "There's no way to reset this PIN, so remember it. If you forget
   it, call me."
4. Record one real sale together — the next customer if you can wait.
5. Show close-of-day on **your** phone's seed data, so they see tonight's
   screen before tonight.
6. Show the ⋮ menu: "You can download everything or delete it all any time."

Registration is the only step that needs network. Everything after works
offline.

---

## What this is not

No inventory. No products. No debtors or credit sales. No receipts. No staff
accounts. No charts. No payments. No email. See `docs/01_PRD.md` §5.3 for the
full list, which is binding.

Credit sales is the most likely first request from real users and is deliberately
excluded from v1 so the core loop gets proven first.
