# FIELD_SETUP — the first five shops

This is not a build document. It is for whoever walks into a shop and sets Daybook
up on an owner's phone. The build is the easy half.

---

## Who to approach, in order

1. **Pharmacy** — holds stock, takes a lot of MoMo, owner is numerate and often
   absent, which makes the reconciliation immediately interesting.
2. **Agro-input dealer** — high value per sale, seasonal cash flow, keeps records
   for supplier credit.
3. **Hardware shop** — high MoMo volume, frequent part-payments.
4. **Provisions store** — highest transaction count, so the fastest test of whether
   entry is quick enough.
5. **Guesthouse** — fewer, larger transactions and a staffed front desk, which
   tests the owner-absent case hardest.

Five different types beats five of the same. You are trying to find out where the
product fits, not to confirm it fits everywhere.

## What to bring

- Your own phone with the app already installed, showing seed data.
- A power bank. You may need to charge their phone to finish.
- Nothing printed. A brochure makes this a sales visit; it should feel like a
  favour.

---

## The conversation, before any phone comes out

Do not describe the app. Ask three questions and listen:

1. **"At closing time, how do you know what came in today?"**
2. **"Does your MoMo ever come up short at the end of the day?"**
3. **"When last did it happen, and how much was it?"**

If they light up on question two, they are a user. If they shrug, thank them and
leave — do not sell past a shrug. **Write down their answers.** These three
answers across five shops are worth more than the code.

Then, only if they engaged, show yours:

> "I'll show you mine. At the end of the day it tells me if the cash in the drawer
> matches what I sold. Takes about four minutes to set up. Free, and I'm not
> selling you anything today."

---

## The install — target four minutes

You do this, on their phone, not them.

1. Open Chrome. Go to the URL. **Add to Home screen** — do this yourself and put
   the icon on their first screen, next to WhatsApp.
2. Create the account: shop name, their phone number, a PIN **they** choose. Do
   not choose it for them and do not write it down anywhere.
3. Say the PIN sentence out loud, once: *"There's no way to reset this PIN, so
   remember it. If you forget it, call me."*
4. Record one real sale together — the next customer who walks in, if you can wait
   for one. A real transaction lands differently than a fake one.
5. Show the close-of-day screen using **your** phone's seed data, not theirs, so
   they see what tonight will look like.
6. Say the privacy sentence: *"Your records stay on your phone and on my server.
   Nobody else sees them. You can download everything or delete it all any time —
   it's in that menu."* Show them the menu. Then stop talking.

## What to say about money

Nothing. Do not mention price on the first visit. If they ask:

> "It's free while I'm testing it with a few shops. If it's useful later I'll
> charge something small, and I'll tell you before I do."

The first person who asks unprompted what it costs is your strongest signal.
Write down who and when.

---

## Record for each shop

Keep this in one place, one row per shop:

| Field | Why |
|---|---|
| Shop name, type, location | |
| Owner name, phone | |
| Who actually handles money day to day | The owner is often not the user |
| Answers to the three questions | Especially the last shortage and its size |
| Phone model and Android version | Tells you your real device floor |
| Minutes the install took | If it creeps past six, the onboarding is wrong |
| Date installed | Day 3 and day 14 are counted from here |
| What they fumbled during the first entry | This is your roadmap |
| What they asked for that doesn't exist | Goes in `DECISIONS.md` under "Requested by users" |

---

## Day 3 — the return visit

Go back in person. Do not phone. Ask to see the phone.

- **Is the icon still on the home screen?** If it was moved or removed, that is
  the whole answer and you should ask why, kindly.
- **How many entries since install?** Compare with what a real day looks like for
  them. Ten sales a day recorded as three means they are using it selectively —
  find out which three and why those.
- **Did they close a day?** If not, that's the critical failure. Close-of-day is
  the entire value proposition; if they skipped it, either they didn't understand
  it or it was too much friction at the end of a long day. Find out which.
- **Watch them enter one sale.** Say nothing while they do it. Where their thumb
  hesitates is a design defect, not a training gap.

Then ask one question: **"What would make you stop using this?"**

## Day 14 — the decision

Count how many of the five entered a sale in the last three days without you
prompting them.

- **3 or more:** the loop works. Take the request list, pick the one thing most
  shops asked for, build only that.
- **1 or 2:** the loop works for a narrower user than you thought. Find out what
  those one or two have in common before building anything.
- **0:** stop. Do not add features. Something about the premise is wrong, and the
  answer is in the answers to "what would make you stop using this?" Go and ask
  the susu collectors instead.

Write the outcome down and date it. The temptation at day 14 will be to explain
away a bad number. Don't — a clear no at day 14 costs you a fortnight, and
ignoring it costs you six months.

---

## Things that will go wrong, and the answer

| Problem | What to do |
|---|---|
| "My phone has no space" | Free space with them. The PWA is small; the problem is usually photos. |
| Forgot the PIN | You cannot reset it. Export their data if you can reach it, delete the account, re-register. Say this will happen before it happens. |
| Shop assistant needs to enter sales | Not supported in v1. Note it — if three shops ask, it becomes the next build. |
| "Can it track my stock?" | "Not yet, and I'd rather do this one thing well first." Note it. Do not promise it. |
| They want it to record credit sales | The expected first request. Note who asked. Say nothing about when. |
| Owner is enthusiastic but never enters anything | The most common failure and the most informative. Ask what happens at 6pm that stops them. |
