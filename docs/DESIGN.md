# A medias — design

A living document. It records the decisions made before any code was written and
why. When something changes, it changes here first.

Interface copy quoted below is in Spanish on purpose: the app is built for two
Spanish speakers. See `CLAUDE.md` for the language rule.

## 1. The problem

Two people share household finances. Each pays for things out of their own
pocket and transfers money into a joint account. They want to contribute roughly
the same amount and to know, at any moment, who is ahead and by how much.

They already track this by hand in a Google spreadsheet. The app does not
replace that sheet — it turns it into something that can be fed from a phone in
three taps.

## 2. The model

Every row is **money that left one person's pocket** for the household: the
groceries, the fuel, or a transfer to the joint account. All of it counts the
same way.

- Everything splits **down the middle**. No per-expense percentages.
- There are **no settlements** between the two people.
- **Expenses paid by the joint account are not recorded.** That money was
  already counted when it went in; counting it again would double it.

An imbalance is corrected in the next transfer to the joint account. The app
computes each person's share so the difference lands on zero:

```
share of the person who is ahead = (total − difference) / 2
```

If the difference exceeds the total, that person contributes nothing, the other
contributes everything, and the app reports how much is still outstanding.

A difference that is an odd number of cents has no halfway point either. The
share of whoever is ahead is rounded down, so the extra cent is carried by the
one who was behind — the side that owed it — and the screen says a cent remains
rather than claiming a zero the spreadsheet will not show.

### What this gives up

Because joint-account spending is never recorded, the app **cannot say how much
is left in the pot**, nor what the household spends on. It measures
contributions, not consumption. This is a deliberate trade for halving the
effort of recording anything.

It is reversible: enabling a third payer makes new rows count, with no migration
of what came before.

## 3. The spreadsheet

The entire history lives in **a single tab**. Its current shape:

| Col. | Header | What the app does with it |
| --- | --- | --- |
| A | `Fecha` | Writes a real date in the same format. Defaults to today. |
| B | `Concepto` | Free text. Feeds the frequent-concept chips and search. |
| C | `Viqui` | The amount, when person 1 paid. Otherwise empty. |
| D | `Mario` | Same for person 2. |
| E | `diferencia` | **Never written by hand.** The cell is copied down from the row above and the last one is read. |
| F | *(no header)* | Left alone; already holds occasional notes. Used as the note field. |
| G | `id` | **The only new column.** A per-row identifier, so a phone can edit a row without guessing at a row number. |

### Writing rules

1. **Who paid is expressed by the column.** The amount lands in C or in D.
   There is no payer field to keep in sync.
2. **The balance is read, not recomputed.** Column E holds, per row,
   `SUM($C$2:C{row}) − SUM($D$2:D{row})` — the cumulative difference from the
   top, positive in favour of person 1. The app reads the last cell rather than
   summing the columns itself, so app and sheet cannot disagree, and opening the
   app costs the same with 600 rows as with 6,000.

   Each row recomputes from the top instead of chaining off the row above. That
   is more robust than a chained formula: a broken cell breaks one row, not
   every row below it, and inserting a row mid-sheet still recalculates
   correctly. The cost grows with the square of the row count — imperceptible at
   the current size, worth revisiting past a few thousand rows. **Do not change
   it unprompted.** It is the users' sheet and it works.

   **Copy the cell down; never build the formula string.** Apps Script writes
   formulas in en-US notation (`SUM(a,b)`) regardless of the sheet's locale,
   while this sheet displays `SUMA(a;b)`. Constructing the text by hand invites
   a locale bug and would silently ignore any future change the users make to
   their own formula. `copyTo` from the previous row adjusts the relative
   references on its own and sidesteps both problems.
3. **Always append at the end.** Nothing is reordered.
4. **Voiding is not deleting.** To undo an entry, the app **clears the amounts
   in C and D** and marks the concept. Deleting a row inside a running total
   corrupts everything below it; clearing it lets the balance correct itself —
   the cumulative sums simply skip the empty cells — leaves the formula
   untouched, and keeps a record of what was voided.
5. **`observaciones` holds the payment method.** Picking one on the entry
   screen is what writes that column; there is no other source for it. It
   records *how* the money left, which the ledger could not say before, and
   deliberately not *who* — that is what the column the amount sits in is for,
   and a second copy is a second thing that can disagree.
6. **Rows without an `id` are respected.** Entries pasted by hand from a bank
   statement are read and counted, but not editable from the phone until an id
   is assigned — one tap.
7. **Only the tail is read.** The last few months, plus the final `diferencia`
   cell.

### New tabs

Neither touches the ledger. Both can be deleted and the sheet is what it always
was.

**`Config`** — a key/value table, editable by hand:

| key | value |
| --- | --- |
| `persona_1_nombre` | Viqui |
| `persona_1_columna` | C |
| `persona_1_correo` | …@gmail.com |
| `persona_2_nombre` | Mario |
| `persona_2_columna` | D |
| `persona_2_correo` | …@gmail.com |
| `hoja_libro` | name of the ledger tab |

Display names come from here, not from the C and D headers, so a header can be
renamed without breaking anything. No name is hardcoded anywhere.

**`Fijos`** — templates for recurring entries (concept, amount, day, person,
period, active). They are not ledger rows until confirmed.

**`Sugerencias`** — the lists the phone offers, three columns:

| texto | tipo | ámbito |
| --- | --- | --- |
| Efectivo | `medio` | *(empty)* |
| Tarjeta Viqui | `medio` | Viqui |
| farmacia | `concepto` | *(empty)* |

`tipo` is `concepto`, `observacion` or `medio`. `ámbito` is empty for both of
them, or one person's name as it appears in `Config`. Accents and capitals are
forgiven on both columns, because nobody remembers whether they wrote
"observación" or "observacion" and a row that is silently ignored is a bug the
app gets blamed for. A scope naming neither person is treated as belonging to
both and counted by `sanityCheck`, on the same reasoning: showing one suggestion
to one person too many is a smaller failure than a row that vanishes.

The `medio` rows are what fills column `observaciones` — see below. They are
scoped by person because a card belongs to whoever holds it.

### What the app will not add

No categories, no split percentage, no status column. With everything split down
the middle and no settlements, those columns would not change the result by a
cent, and would clutter a sheet that has stayed clean for years. If they are
ever needed, they append at the end with no migration.

## 4. Interface

Five screens — **Añadir**, **Gastos**, **Diferencia**, **Sitios**, **Fijos** —
plus settings.

### Añadir — three steps

Entering an expense is three screens, not one. It was one, with every control on
it at once, and the reason for splitting it is the same reason the layout was
rewritten before that: this is used one-handed, standing up, with a receipt in
the other hand. Three screens is what lets each one be a single decision at a
size a thumb can hit.

**1. When, how much, and who paid.** The keypad, the amount set large, `Hoy` /
`Ayer` / `Otra fecha`, and the two payer buttons preselected to whoever has the
app open.

Who paid is on this screen rather than with the concept because the payment
methods on the next one are filtered by it — a card belongs to whoever holds it,
so the payer has to be settled before there is a list to offer.

**2. What it was, and how it was paid for.** The chips, then the field, then one
row of pills for `observaciones` — all three tight together, because the concept
and the payment method are two halves of one question and spreading them apart
made them read as two screens stacked on one. The spare height goes below all of
it, which is where the on-screen keyboard appears.

**The chips are above the field, and the field searches them.** The chips are
the fast path and typing is the fallback, so the fast path goes where the eye
lands first; and when the keyboard opens it covers everything *below* the
focused field, so anything still useful has to be above it. Nothing is focused
on arrival, for the same reason: landing with the keyboard already up hides the
chips behind it and makes tapping one cost an extra gesture.

The search is a subsequence match over both lists — the concepts written down in
`Sugerencias` and the ones the history threw up — scored so that a run of
adjacent letters and a match at the start of a word beat scattered hits, and a
short entry beats a long one. `sper` finds `supermercado`, which a substring
filter would not: a thumb on a phone drops letters. There is no second input and
no second piece of state — the query and the concept are the same string, so
tapping a match just finishes the word. See `app/src/lib/fuzzy.ts`.

- Chips of frequent concepts, ranked by **frequency × recency** over the
  household's own history. Nothing to configure.

  Ahead of all of them, marked with a dot, the concept of any place saved within
  fifteen metres of where the phone is standing — see **Sitios**. It is the
  strongest guess this screen ever gets: somebody in the same shop as last time
  is buying the same kind of thing, and no amount of frequency beats being here.
  It is still only a chip, filled in by a tap like any other.

  **A chip carries the concept and nothing else.** It used to carry two more
  things, and both were removed for the same reason: a suggestion may fill in
  the field it is a suggestion for, and no others. The median amount of what
  that concept had cost put a figure nobody had checked into the one field of
  this app that is not allowed to be approximately right. The usual payer
  changed who was paying behind the back of somebody who had already chosen —
  and who pays is the whole point of the ledger.
- The `observaciones` row holds the payment methods first and then the suggested
  observations, both filtered by **who is paying** rather than by who is holding
  the phone. They share one row because that column holds one value: two rows
  feeding one field would be two controls contradicting each other. Tapping the
  active pill clears it.

**3. Review, and save.** Every field on one screen, each row a button that goes
back to the step that owns it. Nothing is editable here: a field that can be
changed in two places is a field with two versions of the truth, and a ledger is
not where to discover that. Also a way to throw the whole thing away, which a
three-step flow needs and a one-screen form did not.

The review exists because of what saving does. The row cannot be taken back out
of the spreadsheet, only voided — so a glance before writing is worth a tap.

**The device's back button walks back through the steps.** Each step forward is
a history entry, so back means "the previous view" rather than "close the app
halfway through typing". The on-screen arrow calls `history.back()` and nothing
else, so there is one way back and not two that can disagree. A draft restored
at step two or three rebuilds those entries on the way in, because the page has
only just loaded and there is nothing behind it yet.

**Nothing typed is held only in memory.** Every keystroke goes to a draft in
IndexedDB, and reopening lands where you left off. Three screens is three
chances to be interrupted, and the interruptions are the normal case: a queue
moves, somebody talks to you, the phone locks. It also closes a hole this app
opened itself — picking up a new version on open reloads the page, and a reload
halfway through the flow used to lose everything on screen.

Every step fits without scrolling, and that is a constraint rather than a
preference. The first version was a vertical stack of nine blocks of equal
weight, with the keypad below the concept field and the save button below the
keypad, so on a phone the two most-used controls in the app were off the bottom.
The spare height is now spread between the rows rather than handed to any one of
them: given to the keypad it made 130px keys with the digits floating inside
them, and given to a spacer it made a hole in the middle of an otherwise dense
step. The pill rows scroll sideways for the same family of reasons — a row that
can only ever be one line tall cannot push anything else off the screen.

Short path: type amount → next → tap chip → next → save.

**Saving is instant.** The row is painted and the app can be closed without
waiting for the network: it sits in a local queue with its identifier and
uploads in the background.

### Gastos

The last few months grouped by day, filterable by person, searchable by concept.
Swipe to edit or void. Either person can edit any row.

### Diferencia

The running total, large, named for whoever is ahead. Below it the splitter:
enter how much is going into the joint account and the app proposes each
person's share to land on zero.

### Sitios

The places saved on this phone, and the concept spent at each. It exists so the
guessing on the second step is inspectable: a screen that offers a concept
because of where you are standing has to have somewhere that says which places
it knows, how good the fix was when each was saved, how far away each one is
right now, and how to delete one. A suggestion with no visible cause is magic,
and magic that fills in the wrong concept is indistinguishable from a bug.

**The coordinates never leave the device.** They are in IndexedDB, they are not
sent to the backend, they are not written to the spreadsheet, and there is no
column for them — what reaches the ledger is the concept, exactly as if it had
been typed. The other person in the house cannot see them. The first line of the
screen says so, and section 13 of the privacy policy says it again.

Saving one is always a deliberate tap on "Guardar este sitio", which is the only
thing in the app that asks for the location permission. Every other read is
guarded by a permission check that gives up rather than prompting, so somebody
who never uses places is never asked — see `app/src/lib/position.ts`.

A place is a location *and* a concept, not a location with a concept attached.
The pharmacy and the supermarket in the same square are two places, and both are
offered when you stand between them. Merging them would mean choosing which one
to lose.

**Fifteen metres**, and the number is load-bearing in both directions. The shop
next door is fifteen metres away, so a radius wide enough to always match would
match the wrong shop; and an indoor fix is often worse than fifteen metres, so
the accuracy of each fix is stored and shown rather than hidden — a place that
never matches is then explained by a number instead of being a mystery. The fix
itself is never read from the cache, and that is the line to leave alone: it was
a minute of cache to begin with, which is eighty metres of walking, and the
browser test that walks forty metres up the street is what caught it.

### Fijos

Recurring templates. They **propose, they do not post**: because some entries
are pasted from bank statements, posting automatically would duplicate them. On
the due date a prompt appears and one tap confirms, amends the amount, or skips.

## 5. Architecture

```
PWA  ──▶  Google ID token  ──▶  Apps Script  ──▶  spreadsheet
```

**Apps Script bound to the sheet**, published as an API. No infrastructure, no
credentials in the browser, native access to the sheet, scheduled triggers
included. Its weakness — latency — stops mattering because every operation moves
very little data. The code lives in this repo and ships via `clasp` from CI.

Rejected for maintenance cost: a Cloudflare Worker with a service account.
Faster, but a private key has to be kept in repository secrets and the scheduled
job built separately.

Rejected for friction: talking to the Sheets API straight from the browser. That
scope is "sensitive" to Google, requires app verification, and shows a warning
screen on entry.

### Identity and authorization

Google Sign-In requesting **identity only** (email and name), never permission
over any spreadsheet. That avoids Google's app review and its warning screen.

**Authorization is the spreadsheet's own sharing list.** The script asks the
sheet who it is shared with and compares that against the signed-in email.
Sharing the sheet grants access; unsharing revokes it. Edit permission writes;
view permission only reads.

Two known limits:

- Access granted **by link** or **through a Google Group** cannot be enumerated
  and would be rejected. It fails closed, which is right, but it means sharing
  has to be per named email.
- The check is cached for a few minutes, so revoking access takes that long to
  take effect.

**Sign-in does not block startup.** The app opens on the keypad with the
already-stored profile; identity is only needed to sync. Offline or with an
expired session, the row waits in the queue.

## 6. Delivery

| Piece | Choice |
| --- | --- |
| Frontend | React + TypeScript + Vite, `vite-plugin-pwa` |
| Local state | IndexedDB with an outbound queue |
| Backend | `apps-script/`, deployed with `clasp` |
| Hosting | Vercel, at gafa.terragiro.es |

**Updating.** Opening the app is what picks up a new version, and three separate
things have to happen for that — each of which used to have a way of not
happening. See `app/src/pwa.ts`.

1. *Look.* A service worker only checks for a new version of itself when the
   page navigates, and an installed PWA resumed from the home screen never
   navigates — so a phone kept the version it was installed with indefinitely.
   The check hangs off the document becoming visible and off `pageshow`, the
   second for a resume out of the back/forward cache where a visibility change
   is not guaranteed.
2. *Take over.* The worker calls `skipWaiting()` as it installs, but it still
   parks in `waiting` when another tab is holding the old one — and a version
   parked in `waiting` never arrives. Every check now also messages a waiting
   worker to step forward, which `app/src/sw.ts` answers.
3. *Reload.* Two independent signals, because neither is reliable everywhere:
   `controllerchange` on the container, and the arriving worker reaching
   `activated`. Whichever comes first wins; a guard makes the other a no-op, and
   the same guard stops a first install from reloading for nothing.

The reload is immediate rather than a banner to dismiss: at the moment of
opening there is nothing on screen to lose, the draft is in IndexedDB after
every keystroke, and a saved expense is in the outbound queue before the screen
repaints.

**Cache headers.** `app/vercel.json` sets two, and the reasons cannot live
beside them: Vercel validates that file against a strict schema and rejects any
property it does not know, so a `comment` key inside a header entry fails the
build — which is exactly how it failed, in one second, the first time the deploy
was ever configured enough to run. The reasons, then, are here. `/sw.js` is
served `max-age=0, must-revalidate`, because a service worker cached by a phone
keeps running last week's app forever. `/assets/(.*)` is served `immutable` for
a year, because those filenames are content hashes and a new build produces new
names.

**Tests.** Vitest over the pieces that cannot be wrong: the C/D column reader,
the transfer splitter, the concept matcher, and the distance between two points
on the ground.

Playwright over the bundle in a browser, at the size of a phone, with Google and
the backend replaced by doubles — `app/e2e/`. It exists because of what it
caught: a screen that scrolled because the layout had been written to read as a
document, and a sign-in button that could not sign anybody in. Neither was
visible to a unit test and neither was caught in review. It asserts that the
entry screen does not scroll, that tapping a chip does not move the payer, that
the payment methods follow whoever is paying, that saving sends the amount, the
payer and the method, and that the two legal pages render for a visitor with no
account. It touches no network and writes to no spreadsheet: a suite that
appended rows to a real ledger would be a suite nobody dared run twice.

**GitHub Actions.** `verify` runs lint, typecheck, tests and build on every
push and pull request. `deploy` runs only after it passes, and publishes the
app and the backend. The backend goes out on every run rather than only when
`apps-script/` changed: the change detection compared the last commit against
its parent, which is not the same as the push, so a merge of two commits could
skip the backend deploy in green. The comment in the workflow has the detail.

Cloudflare Pages was the first choice and was dropped: Spanish ISPs block
Cloudflare IP ranges on match days, and an app that does not open at weekends is
not an app. Vercel's own Git integration stays disconnected for a related
reason — it would deploy every push the moment it lands, checks or no checks.

All development runs against a **copy** of the spreadsheet.

## 7. Phases

1. **Read the sheet and record.** C/D column reader, `id` column, append with
   formula fill-down, Google sign-in, keypad entry screen, recent list, and the
   balance read from column E. *Useful daily from here on.*
2. **Edit without fear, and split.** Editing and voiding by clearing, the
   transfer splitter, and recurring templates prompting on their due date.
3. **Make it fly.** Offline queue, computed chips, installable PWA, a direct
   "new expense" shortcut from the icon, undo after saving, and the concept
   remembered per place.
4. **Extras.** Search across the whole history, per-concept summaries, receipt
   photos to Drive, CSV export.

## 8. Open

- Review who has access to the spreadsheet: now that Drive governs
  authorization, anyone with edit permission could post from the app.
- A copy of the spreadsheet to develop against.
- The two Google accounts used to sign in.
