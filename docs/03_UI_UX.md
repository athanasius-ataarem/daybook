# 03 — UI / UX Design

Wireframes: `docs/03_wireframes.svg`. That file is the layout reference. Follow
its structure and proportions; this document gives the tokens, states and copy.

## 1. Design direction

The artifact this replaces is a ruled exercise book kept under the counter, filled
in with a ballpoint. That is the world to borrow from: **columns of figures,
ruled lines, ink on cheap paper, and a total at the bottom that is bigger than
everything else.**

What that means concretely:

- **Numbers are the interface.** Amounts are the largest element on every screen.
  Everything else is a label for a number.
- **Cash and MoMo are colour-coded**, consistently, everywhere, because that
  distinction is the one thing the user is always tracking. Green for cash,
  ochre for MoMo. This is semantic, not decorative — never use those two colours
  for anything else.
- **Hairline rules between rows**, like a ledger. Rules earn their place; other
  decoration does not.
- No gradients. No shadows except a single elevation on the entry sheet. No
  illustrations. No rounded-pill everything — 4px radius, chunky and square-ish.

**The signature element** is the close-of-day variance card: three columns
(Expected / Counted / Difference) in oversized tabular figures, with the
difference set larger than any other number in the app. That card is the reason
the product exists and it should look like it. Spend the boldness there and keep
every other screen quiet.

## 2. Tokens

### Colour

```
ink        #14181B   primary text, amounts
ink-60     #5B6469   secondary text, labels
paper      #F7F8F5   app background
card       #FFFFFF   surfaces
rule       #DCE0D9   hairline rules, borders
cash       #1F6F4A   cash amounts, cash toggle active
momo       #B5780A   MoMo amounts, MoMo toggle active
short      #A81E14   shortage, void, destructive
over       #1F6F4A   overage (reuses cash green)
```

Contrast: `ink` on `paper` is ~14:1; `cash` and `momo` on `card` both clear 4.5:1
for the weights used. Do not lighten either accent — this screen is read in
direct sunlight.

Dark mode: **not in v1.** The device is used in daylight and a partial dark mode
is worse than none. Record the decision.

### Type

Two self-hosted families, three files, latin subset, ≤60 KB total.

```
display / amounts   Archivo 600      tabular figures, tight tracking (-0.01em)
body / UI           IBM Plex Sans 400
labels / meta       IBM Plex Sans 600, uppercase, 0.06em tracking, 11–12px
```

Scale (mobile, px): `48` hero amount · `34` screen total · `22` row amount ·
`17` body · `15` secondary · `12` label · `11` meta.

Every numeric element sets `font-variant-numeric: tabular-nums`. Currency is
`GH₵` (U+20B5), never `GHS` or `¢`, except in CSV where `GHS` is used.
Negative amounts use a true minus, U+2212.

### Layout and touch

- Single column, 16px page gutter, 12px vertical rhythm unit.
- Minimum touch target 48×48. Keypad digits are 64px tall, full-width thirds.
- Bottom bar 56px, two destinations, plus a 64px circular action button
  overlapping it.
- Safe-area insets respected top and bottom.
- Design at 360×640 first. Do not design at desktop width and shrink.

### Motion

Sparing and functional. 150ms ease-out for the entry sheet slide, 120ms for a
new row settling into the list, none for anything else. Respect
`prefers-reduced-motion` by disabling both.

One haptic: a 10ms vibration on a successful save, guarded by feature detection.

## 3. Screens

### 3.1 Auth — Register / Sign in

Two screens, no branding flourish, no marketing copy. This is set up once by a
salesperson standing at the counter.

Register: shop name, phone number, PIN (4 digits, entered twice on one screen as
two 4-box groups). Sign in: phone number, PIN.

- Phone input is `type="tel"`, `inputMode="numeric"`, with `+233` shown as a
  fixed prefix and the local 9 digits typed after it.
- PIN boxes are four separate 1-character boxes, `inputMode="numeric"`,
  auto-advancing, masked as filled dots after entry.
- One primary button. No "forgot PIN" link — there is no reset flow in v1, and a
  dead link is worse than none.
- Errors appear inline beneath the field, in `short`, and say what to do:
  "That PIN is not right. Try again, or ask whoever set this up." After 5
  failures: "Too many tries. Wait 15 minutes and try again."

### 3.2 Today — the home screen

Top to bottom:

1. **Header.** Shop name (truncating), business date as "Today · Sat 25 Jul",
   a sync dot on the right, and a small overflow button (Privacy, Export,
   Sign out, Delete account).
2. **Position block** on `card`, full-bleed to the gutters:
   - `NET TODAY` label, then the net in the 48px hero size.
   - Two rows beneath: `Money in` and `Money out`, each with the total at 22px
     and a `cash` / `momo` split beneath in 15px, coloured.
3. **Entries list.** Newest first. Each row: amount at 22px in `cash` or `momo`
   colour, prefixed `+` for money in and `−` for money out; beneath it the
   channel word, a middot, then the note — "Cash · Paracetamol carton" — or,
   with no note, the kind word ("Sale", "Expense"), so channel never rides on
   colour alone; the time (12-hour, "4:12 pm") at 11px on the right.
   Hairline `rule` between rows, none after the last.
   - Swipe left reveals **Void** on a `short` background.
   - Long-press opens an edit-note sheet.
   - Voided rows: amount struck through, whole row at 45% opacity, a `VOIDED`
     label, and the reason if given. They stay in place. They never move or hide.
4. **Footer button**, sticky: `Close the day`. Once closed it becomes
   `Day closed · view summary` in a quieter style.
5. **Action button**, circular, bottom-right, overlapping the bar. Opens the
   entry sheet. Label is a `+`.

Empty state: no illustration. The position block shows `GH₵0.00`, and where the
list would be: **"No entries yet today. Tap + to record your first sale."**

### 3.3 Entry sheet

A full-height sheet over Today, sliding up. Not a route change — dismissing it
must never lose the Today scroll position.

Top to bottom:

1. **Amount display.** Right-aligned, 48px, showing `GH₵0.00` until digits are
   typed. A blinking caret is unnecessary.
2. **Date**, small and tappable beneath the amount: "Today · 25 Jul". Opens a
   native date picker. Defaults to the resolved business date.
3. **Two segmented toggles**, full width, 48px tall:
   - `Money in` / `Money out` — default `Money in`.
   - `Cash` / `MoMo` — default `Cash` on first ever use, thereafter the last
     used channel, persisted on this phone (`meta.lastChannel`). Active segment
     fills with `cash` or `momo` and white text.
4. **"Add note"**, a small text link. Tapping replaces it with a single-line
   input. Collapsed by default so it is never in the way.
5. **Custom keypad.** Digits 0–9, `.`, and backspace, in a 3-column grid, 64px
   rows. **Do not use the OS keyboard for the amount** — it is slow to appear,
   covers the screen, and its layout varies by device.
6. **Save**, full-width, 56px, disabled while the amount is zero.

On save: haptic tick, sheet slides down, the row animates into the top of the
list, totals recount. **No toast, no dialog, no navigation.** The user should be
able to record five sales in a row without their thumb leaving the lower third of
the screen.

### 3.4 Close the day

1. Header: "Close the day · Sat 25 Jul".
2. Two inputs, stacked, each with the custom keypad appearing inline on focus:
   - **"How much cash is in the drawer?"**
   - **"What does your MoMo balance say?"**
3. **The variance card** — the signature element. A three-column table:

   ```
                  Expected      Counted     Difference
   Cash          GH₵1,240.00  GH₵1,215.00   −GH₵25.00
   MoMo          GH₵  860.00  GH₵  860.00     GH₵0.00
   ```

   Row labels use `cash` and `momo` colours. The Difference column is the
   largest type in the card; a non-zero difference is `short` when negative,
   `over` when positive, and `ink-60` when exactly zero. Below the table, one
   plain sentence: **"Your cash is short by GH₵25.00."** / "Your cash is over by
   …" / "Everything matches."
4. If any difference is non-zero, two buttons: **`Record it`** (creates a
   matching entry — money out if short, money in if over — noted "shortage on
   25 Jul" / "extra on 25 Jul") and **`Leave it`**. Never auto-correct, and
   never editorialise about why.
5. Then: **`Send to WhatsApp`** (primary) and **`Done`**.

First-ever close asks for opening balances first, on its own step, with one line
of explanation: "How much cash and MoMo did you start with today? We only need
this once."

### 3.5 History

A flat list of up to 30 business dates. Each row: the date, the net at 22px, and
an 8px dot — `cash` green only if that day reconciled exactly, `short` red for
any non-zero difference (short or over), `rule` grey if the day was never
closed. Tap opens that day read-only, with its
entries and its close summary.

No filters, no search, no month picker, no export button here. Export lives in
the overflow menu.

### 3.6 Privacy notice

Plain running text, ~250 words, no legalese, no accordion. Ends with two
buttons: `Export my records` and `Delete my account`. The delete button opens a
confirm sheet requiring the user to type their PIN.

## 4. Sync status dot

A single 8px dot in the header, with a tap target of 44px and a one-line label
on tap:

| State | Colour | Tap label |
|---|---|---|
| Everything saved | `cash` | "All your records are saved." |
| N waiting | `momo` | "3 entries will save when you have network." |
| Offline | `ink-60` | "No network. Your records are safe on this phone." |
| N rejected | `short` | "1 entry could not save. Tap to see." |

Never a modal, never a full-screen error, never a blocking spinner. The user's
entries are safe locally and the copy must say so — that sentence is the whole
reason they will trust an app that sometimes has no signal.

## 5. Copy rules

- "Money in" and "Money out", not revenue, income, expenditure, debit, credit.
- "Short by" and "Over by", not variance, discrepancy, delta.
- "Cash" and "MoMo" — capital M, capital M, as everyone writes it.
- Sentence case for buttons and headings. Buttons name the action that happens:
  `Save`, `Close the day`, `Send to WhatsApp`, `Void`, `Delete my account`.
- An action keeps its name through the whole flow. `Close the day` produces
  "Day closed".
- Errors say what happened and what to do, in one sentence, without apologising.
- Never use the word "sync", "server", "database", "cloud", or "upload" in
  user-facing copy. Say "saved" and "on this phone".
- No exclamation marks anywhere.

## 6. Accessibility floor

Not optional, and cheap to hit if built in from the start:

- Every interactive element reachable by keyboard with a visible focus ring
  (2px `ink`, 2px offset).
- Every icon-only control has an `aria-label`.
- The keypad is a set of `<button>`s, not `div`s, in a container labelled
  "Amount keypad".
- The variance result is announced in an `aria-live="polite"` region, so the
  outcome is not conveyed by colour alone — the sentence in §3.4.4 carries it.
- Text scales to 200% without clipping the position block or the variance card.
- Target contrast 4.5:1 for all text, 3:1 for the dot and rules.
