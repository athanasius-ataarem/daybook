# KICKOFF — how to drive the build

The documents are the specification. This file is the operating procedure: what
to type, in what order, and what to check before moving on.

## Rules for the session

1. **One step per prompt.** Never ask for two steps in one message. The steps in
   `docs/06_IMPLEMENTATION_PLAN.md` exist because smaller units produce cleaner
   code and let you catch a wrong turn while it is still cheap.
2. **Verify before advancing.** Every step has acceptance criteria. Run them
   yourself. If a step's criteria don't pass, fix that step — do not proceed and
   plan to come back.
3. **Start a fresh context for each step** once the earlier steps are committed.
   The docs reload cheaply; a bloated context is where instructions get dropped.
4. **When it proposes a dependency**, ask what it replaces and what it costs in
   the bundle. The budget in `docs/02_TRD.md` §8 is a build-failing threshold, not
   an aspiration.
5. **When it asks a question, answer it rather than saying "you decide".** Then
   put the answer in `DECISIONS.md`.

---

## Prompt 0 — orientation and contradiction hunt

Paste this first. Do not skip it; it is the cheapest bug-catching you will do all
build.

> Read `CLAUDE.md`, `README.md`, `DECISIONS.md`, and every file in `docs/`. Do not
> write any code yet.
>
> Then give me three things:
>
> 1. A short summary of the hard rules and the v1 scope, in your own words, so I
>    can check you've understood them.
> 2. Every contradiction, ambiguity, or gap you found between the documents.
>    Quote the conflicting lines. Be adversarial about this — I would rather find
>    ten problems now than one in Step 5.
> 3. Anything you think is specified wrongly, with your reasoning. Disagreeing
>    with me is useful here.
>
> Note that `ORIGIN_BRIEF.md` is superseded and is not a specification. Ignore it
> except as history.

Resolve everything it raises before Prompt 1. Record each resolution in
`DECISIONS.md`.

---

## Prompt 1 — Step 0, project setup

> Do Step 0 from `docs/06_IMPLEMENTATION_PLAN.md` and nothing else. Scaffold only,
> no features.
>
> When you're done, show me the resulting file tree and the root `package.json`,
> and confirm `pnpm dev` starts both processes and `pnpm typecheck` is clean.

**Check:** `pnpm dev` runs, `pnpm typecheck` clean, `.env.example` matches
`docs/02_TRD.md` §11. Commit.

---

## Prompt 2 — Step 1, the three dangerous functions

> Do Step 1 from `docs/06_IMPLEMENTATION_PLAN.md`: the shared money, business-date,
> totals and zod modules, with their tests, and nothing else. No API, no UI.
>
> Write the tests as you write each function, not afterwards. Cover every case
> listed in the step, including the boundary times and the malformed amount
> inputs.

**Check:** all tests pass; `grep -rn "toFixed" packages/shared/src` finds nothing
outside `money.ts`. Read the `resolveBusinessDate` tests yourself and confirm the
02:59:59 / 03:00:00 boundary is what you expect. Commit.

This is the step to be slowest about. A bug in these three modules reaches a shop
owner as a wrong number they will trust more than their own count.

---

## Prompt 3 — Step 2, API spine

> Do Step 2 from `docs/06_IMPLEMENTATION_PLAN.md`: Prisma schema and first
> migration, the auth routes, the JWT cookie middleware, `POST /sync` with the
> immutability guard and the `since` delta, `GET /health`, the error envelope, and
> the redacting logger.
>
> No UI in this step. Give me a `requests.http` file (or a curl script) that
> exercises the full acceptance path, and the tests named in the step.

**Check:** run the curl path yourself — register, login, sync three entries, sync
the same batch again and confirm no duplicates, attempt to change an
`amountPesewas` on an existing id and confirm it's rejected with the stored row
unchanged, then read back via a `since` delta. Commit.

---

## Prompt 4 — Step 3, local store and the entry loop

> Do Step 3 from `docs/06_IMPLEMENTATION_PLAN.md`: the IndexedDB schema, the
> atomic record-plus-outbox write with a test proving atomicity, the repository
> functions, and the Today and Entry screens per `docs/03_UI_UX.md` and
> `docs/03_wireframes.svg`.
>
> Do not wire up sync at all in this step. Point the app at nothing. It must be
> fully usable with the API process stopped.

**Check:** stop the API. Record 20 entries, void one, edit a note, hard-refresh
the browser, close and reopen it. Everything still there, totals correct. Compare
the screens against the wireframe. Commit.

---

## Prompt 5 — Step 4, sync

> Do Step 4 from `docs/06_IMPLEMENTATION_PLAN.md`: the outbox worker with its
> flush triggers and per-item backoff, the PWA manifest and service worker, the
> sync dot with its four states, 401 handling that does not sign the user out, and
> `hasMore` paging.
>
> Then walk me through how to run each of the five tests in the step's test
> matrix, and tell me what the expected result of each is.

**Check:** run all five yourself. Airplane mode with ten entries is the one that
matters most — all ten must arrive exactly once. Then Lighthouse: installable,
works offline. Commit.

---

## Prompt 6 — Step 5, close of day

> Do Step 5 from `docs/06_IMPLEMENTATION_PLAN.md`: opening-balance derivation and
> the first-ever prompt, the expected computation with the snapshot onto the
> `DayClose`, the variance card per `docs/03_UI_UX.md` §3.4 including the
> `aria-live` sentence, `Record it` / `Leave it`, re-open, and the Today footer
> state change.
>
> Include the adversarial test: close day 1, add a backdated entry to day 1, and
> assert the snapshot is unchanged; then re-open and re-close and assert it now
> reflects the new entry.

**Check:** the adversarial test passes. Then do it by hand in the browser too —
this is the invariant the product's credibility rests on. Commit.

---

## Prompt 7 — Step 6, WhatsApp and History

> Do Step 6 from `docs/06_IMPLEMENTATION_PLAN.md`: the summary text builder with a
> unit test asserting the exact string for a known day, the `wa.me` link and the
> `Copy summary` fallback, the History list with its three dot states, and the
> read-only `/day/:date` view.

**Check:** send one to your own WhatsApp from a real phone and look at it. If the
columns don't align in WhatsApp's font, the padding logic is wrong. Commit.

---

## Prompt 8 — Step 7, trust surface

> Do Step 7 from `docs/06_IMPLEMENTATION_PLAN.md`: the privacy notice, the CSV
> export on both the server and the offline client path, `DELETE /api/me` with PIN
> confirmation and cascading delete, the overflow menu, the sign-out guard when
> the outbox is non-empty, and the accessibility floor from `docs/03_UI_UX.md` §6.

**Check:** export an account, delete it, re-register the same phone number and
confirm it starts clean. Tab through every screen and confirm visible focus.
Commit.

---

## Prompt 9 — Step 8, field readiness

> Do Step 8 from `docs/06_IMPLEMENTATION_PLAN.md`: the seed script per
> `docs/05_BACKEND_SCHEMA.md` §8, the nginx config, the PM2 ecosystem file, the
> `pg_dump` cron with a documented restore procedure, and the bundle check against
> the budgets in `docs/02_TRD.md` §8.
>
> Then run the ten checks in the Definition of done and report each one as pass or
> fail with evidence. Do not mark anything as passing that you have not actually
> verified.

**Check:** all ten. Then the one thing no prompt can do for you — borrow a cheap
Android phone, take it outside into daylight, and record five sales on it.

---

## If it goes off the rails

- **It's building something in the non-goals list.** Stop it, point at
  `docs/01_PRD.md` §5.3, and ask why it deviated. Usually a doc gap worth fixing.
- **It's added a dependency you didn't approve.** Ask what it replaces. Remove it
  unless the answer is good, and record the outcome either way.
- **It's used `toFixed` on money.** `grep -rn "toFixed" packages/` after every
  step. This is the single most likely rule to erode late in a long session.
- **It's rewriting earlier steps while doing a later one.** Ask it to stop, revert
  the unrelated changes, and finish the current step only.
- **The context is long and it's forgetting rules.** Commit, start fresh, and
  reload the docs. This is cheap and fixes most drift.
