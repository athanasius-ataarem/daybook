# 01 — Product Requirements Document

## 1. Name

**Daybook.** Working name. Plain English, describes the artifact it replaces (the
exercise book kept under the counter), pronounceable in Gurene, Hausa, Twi and
English without explanation, and available as a name in a market where "Sika",
"Kudi" and "Cash" variants are crowded.

## 2. The problem

A one-shop trader in Bolgatanga takes money all day in two forms — physical cash
into a drawer, and mobile money into a personal or merchant MoMo wallet. Records
are kept in an exercise book, badly, or not at all.

At closing time the owner cannot answer three questions:

1. How much did I actually take today?
2. Is the cash in the drawer the cash I should have?
3. Does my MoMo balance match my MoMo sales?

The gap between those numbers is where losses live — staff skimming, forgotten
personal withdrawals, MoMo sent to the wrong number, change given wrong. Owners
know the gap exists and cannot measure it. Measuring it is the product.

Secondary problem: an owner who wants a loan, a supplier credit line, or a
Ghana Enterprises Agency facility has no records to show. Daybook produces a
record as a by-product of daily use.

## 3. Target user

**Primary:** the owner-operator of a single fixed-location retail business in the
Upper East Region. Pharmacy, agro-input dealer, hardware shop, provisions store,
guesthouse, spare-parts shop. Turnover roughly GHS 500–5,000 a day.

Characteristics that drive every design decision:

- Android phone, 5–6 inch screen, 2–4 GB RAM, Chrome. Often two SIMs.
- Data bought in small bundles; every megabyte is a felt cost.
- Network is 3G or 4G but drops, and is unreliable inside concrete-block shops.
- Numerate and fast with money. Not necessarily comfortable with English prose,
  accounting vocabulary, or nested menus.
- Uses WhatsApp constantly. Uses email approximately never.
- The phone is shared with family and sometimes handed to a shop assistant.

**Secondary, v2 and beyond:** the shop assistant entering on the owner's behalf,
and the owner's spouse who wants the day's figure sent to them. Both are served
in v1 only through the WhatsApp summary. Neither gets an account.

**Not the user:** anyone with an accountant, anyone with more than one branch,
anyone who already runs a POS.

## 4. Goals

| # | Goal | Measure |
|---|---|---|
| G1 | Recording a sale is faster than writing it in the book | Under 6 seconds, cold open to saved, measured on a mid-range Android |
| G2 | The owner learns something they did not know, on day one | The close-of-day variance is non-zero and explicable for at least 3 of the first 5 users |
| G3 | The app is trusted with money records | No entry can silently disappear; every user can export a CSV and delete their account |
| G4 | It works in a shop with no signal | Seven consecutive days of use with the API unreachable, including close of day |
| G5 | Records accumulate into something worth keeping | 30 days of history retrievable and shareable |

## 5. Scope

### 5.1 Core features — v1 ships all of these

1. **Register and sign in** with a phone number and a 4-digit PIN.
2. **Record money in** — amount, cash or MoMo, optional note.
3. **Record money out** — same shape.
4. **Today's position** — total in, total out, net, each split cash and MoMo,
   plus the day's entries newest-first.
5. **Void an entry** with an optional reason. Voided entries stay visible and
   struck through. No deletion.
6. **Close the day** — enter counted cash and MoMo balance, see expected versus
   counted versus difference for both.
7. **Send today's summary to WhatsApp** as plain text via a share link.
8. **History** — last 30 business days, each with its net and whether it
   reconciled.
9. **Export all entries as CSV.**
10. **Delete my account and all my data.**
11. **Privacy notice** in plain language.

### 5.2 Nice to have — explicitly not v1

Listed so they are recognised and deferred, not so they are built:

- Credit sales / debtors ledger — **the most likely first request from real
  users.** Deferred deliberately so the core loop is proven first.
- A second user on the same shop (assistant with entry-only rights)
- Weekly and monthly summaries
- Expense categories
- Photo of a receipt attached to an entry
- Reminder notification at closing time
- Gurene, Hausa and Twi interface language
- Bank or MoMo statement import
- A lender-facing or GEA-facing business record export

### 5.3 Out of scope — do not build, do not scaffold

Inventory. Stock levels. Products or SKUs. Barcode scanning. Printed or PDF
receipts. Multi-branch. Staff accounts and roles. Suppliers. Purchase orders.
Invoices. VAT or tax computation. Payroll. Charts and graphs. Subscriptions and
in-app payments. Multi-currency. Email of any kind. Mobile money API
integration. An admin panel or back office. Any AI feature.

If a requirement appears to need one of these, stop and ask rather than
improvising a partial version.

## 6. Success criteria

The build is done when:

- All eleven core features work, offline and online.
- G1 through G5 above are demonstrably met.
- The reconciliation maths survives the adversarial cases in
  `docs/06_IMPLEMENTATION_PLAN.md` §Definition of done.

The product is validated — a separate question from the build — when, of the
first five shops set up in person, **at least three are still entering sales on
day 14 without being prompted.** If fewer, stop building and go and find out why
before adding anything.

## 7. Principles for judgement calls

1. **Trust beats features.** Anything that makes the money record feel mutable or
   opaque is a bug, however convenient.
2. **The counter is the context.** A customer is waiting. Fewer taps, bigger
   targets, no dialogs.
3. **Speak the user's language, not accounting's.** "Money in", not "revenue".
   "Money out", not "expenditure". "Short by GH₵25", not "negative variance".
4. **Data is expensive.** Every kilobyte shipped is money out of the user's
   pocket. Budget the bundle like it costs cash, because it does.
5. **When in doubt, cut it.** The failure mode for this product is not too few
   features. It is a shop owner who opened it three times and stopped.
