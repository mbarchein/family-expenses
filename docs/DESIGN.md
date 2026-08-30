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
period, active), plus `categoría`, our own `id`, and `forma de pago` on the end.
They are not ledger rows until confirmed.

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

Five screens — **Añadir**, **Gastos**, **Diferencia**, **Sitios**, **Fijos**.

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

`Otra fecha` is both the button and the answer: tapping it opens the device's own
calendar straight away, and the segment then wears the day that came back —
"10 ago", with the year added only when it is not this one. The field the
calendar belongs to is clipped to a transparent pixel and not removed, because
`showPicker` throws on an element that is not rendered; where it throws anyway —
an unsupported browser, or a gesture the browser declined to count — the field is
shown instead, which is worse but still a way to choose a day. There was a
visible field before, below the row: a second control saying what the segment
beside it already said, plus a tap to get at it.

**2. What it was, and how it was paid for.** The chips, then the field, then one
row of pills for `observaciones` — all three tight together, because the concept
and the payment method are two halves of one question and spreading them apart
made them read as two screens stacked on one. The spare height goes below all of
it, which is where the on-screen keyboard appears.

**The tiles are above the field, and the field searches them.** The tiles are
the fast path and typing is the fallback, so the fast path goes where the eye
lands first; and when the keyboard opens it covers everything *below* the
focused field, so anything still useful has to be above it. Nothing is focused
on arrival, for the same reason: landing with the keyboard already up hides the
tiles behind it and makes tapping one cost an extra gesture.

The search is a subsequence match over both lists — the concepts written down in
`Sugerencias` and the ones the history threw up — scored so that a run of
adjacent letters and a match at the start of a word beat scattered hits, and a
short entry beats a long one. `sper` finds `supermercado`, which a substring
filter would not: a thumb on a phone drops letters. There is no second input and
no second piece of state — the query and the concept are the same string, so
tapping a match just finishes the word. See `app/src/lib/fuzzy.ts`.

- Above everything, when there is a place saved within fifteen metres of where
  the phone is standing, **cards**: what has been apuntado at this doorway
  before, one per place — see **Sitios**. They are at the top because they are
  the strongest guess this screen ever gets (somebody in the same shop as last
  time is buying the same kind of thing, and no amount of frequency beats being
  here) and because they are the only control here that can answer the whole
  screen: one tap fills the concept *and* the payment method.

  A card and not a chip for exactly that reason. The rule everywhere else is
  that a suggestion fills the field it is a suggestion for and no others; a card
  is a suggestion for the pair, so it prints the pair on its face along with how
  far away the doorway is. Nothing lands in a field that was not on screen
  before it was touched, and tapping the card again clears both.
- **Eight tiles**, two across and four down, ranked by **frequency × recency**
  over the household's own history with the written-down ones first. Nothing to
  configure. The places are deliberately not among them: a concept offered twice
  on one screen is two controls for one field.

  Eight, and it does not scroll. The row this replaced held every concept and
  scrolled sideways, so anything past the third was invisible until somebody
  thought to swipe — a fast path that has to be discovered is not a fast path.
  Six at first, reasoned from the space the on-screen keyboard needs; eight
  because somebody looked at it on the phone and four rows fit. Two columns
  either way: three truncates "lavandería y luz". The search reaches everything
  else, because the cut to eight happens *after* the filter — typing gets to the
  ninth concept instead of only reordering the eight on screen.

  Rectangular rather than pill-shaped because a rectangle holds two things: an
  icon and a label on one line, at a readable size.

  **The icons are drawn, in `components/Icon.tsx`.** Not emoji — those arrive in
  whatever style the platform ships, cannot be recoloured, and make the same
  concept look like a different app on Android and on iOS. Not an icon font
  either: that is a request to a host this app does not otherwise talk to, on a
  screen that has to work in a supermarket basement, and until it arrives every
  tile shows a blank. Two dozen shapes as paths are a few hundred bytes inside a
  bundle that is already precached, stroked in `currentColor` so a selected tile
  inverts its icon with it.

  Which icon a concept gets, in three tries: **what you chose** in the icon menu;
  then a **guess from the words in it** (`lib/icons.ts`, longest keyword first so
  `gasolina` is not matched by `gas`); then **nothing**, and the tile shows the
  concept's initial. That last step is the rule, not a gap: a basket on the
  electricity bill is a small lie printed on the fast path, every time, and worse
  than no icon at all.

  The **Iconos** menu sits beside the grid it changes, because choosing an icon
  anywhere else is choosing blind. Its way in is a cog, not the word: on a row
  whose whole point is that the tiles are read as pictures, a word is the one
  thing that reads as content. The cog is drawn where it is used rather than
  added to the set — the set is what the picker offers for a *concept*, and
  nobody buys a cogwheel. It lists every concept the app knows with the
  icon it currently shows and whether that was *elegido* or *propuesto* — so the
  list doubles as the answer to "why has that got a basket on it". Choices are
  per device, in IndexedDB: the sheet is the ledger, and this is a preference
  about how a button looks, with no wrong answer to make shared.

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
back to the step that owns it. Below the card, outside it because it is not a
field of the expense, the switch that saves where the phone is — see **Sitios**.
It is on this step and not the second one for two reasons: this is where
everything about to be written is confirmed, and by the time it can be touched
there is certainly a concept to attach a place to, since the second step cannot
be left without one. Nothing is editable here: a field that can be
changed in two places is a field with two versions of the truth, and a ledger is
not where to discover that. Also a way to throw the whole thing away, which a
three-step flow needs and a one-screen form did not.

The review exists because of what saving does. The row cannot be taken back out
of the spreadsheet, only voided — so a glance before writing is worth a tap.

There is deliberately nothing after saving: no banner, no "Deshacer". One was
there and it earned nothing. A confirmation nobody reads is a confirmation that
covers the button underneath it, and undoing an expense is not urgent enough to
need its own six-second window — the row is in **Gastos**, at the top, with
"Anular" on it, which is where somebody who wants to undo something an hour
later would look anyway. This screen returns to step one and says nothing.

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

**The edit sheet offers what the app knows**, which for a long time it did not:
the concept box has the same vocabulary as the fijos editor behind a `datalist`
(`lib/concepts.ts` — the Sugerencias tab, then the backend's ranking, then this
phone's own rows, folded for duplicates), the category is re-guessed when the
concept is *replaced*, and the payment method has the cards off the Sugerencias
tab as pills above its box. The box stays: a row can hold a method the tab has
never heard of, an old one's or one typed on the other phone. What was wrong was
treating that as a reason to make somebody type «Tarjeta BBVA» in full.

Re-guessing only on replacement is the caveat that screen always had, kept:
opening the sheet refiles nothing, because the row's category may have been picked
by hand or typed into the spreadsheet. Change the word and the derivation is
invalid, exactly as on the second step.

Over the list, three totals: **last month, this month, this year**. They are
computed from the entries the list is showing, so they follow the filter and the
search — which is the point, because the useful question is rarely "what have we
spent" but "what has *this* cost us", and the answer has to change when the
question does. The strip says **Solo lo filtrado** whenever one is on: three euro
amounts read as the household's total whatever produced them, and a filtered
number wearing that look is a wrong number rather than a narrow one.

**And a fourth number while a filter is on: the total of everything that
matches, with no calendar in it.** The three cells are months, which is the right
shape for "how are we doing" and the wrong one for a filter — somebody who types
`farmacia` into the search box is asking what the chemist costs, and the month
each row landed in is the part they are trying to get rid of. It is its own row
rather than a fourth cell, because four euro amounts across a phone is a strip
nobody can read, and this is the number that was just gone looking for. It comes
with the count of rows it is made of and both ends of the stretch it covers: a
total with no dates on it reads as a total of everything, and this one is a total
of what the app has loaded. Unfiltered it is not shown at all — there it would be
a number about the window rather than about the household.

The year is a total rather than a floor, and that cost two changes. The window
the backend sends **reaches back to the first of January of last year** — not a
row count, which turned "this year" into "since whenever row 1999 was" — with
`TAIL_MAX_ROWS` as the ceiling on one JSON body. And the list **renders every row
it is given** with `content-visibility: auto` per day, so the browser skips
style, layout and paint for the days that are off screen while find-in-page and
row heights keep working. Where that property is unsupported the list behaves
exactly as it did before: slower, never wrong.

The strip still prints the day it counts from when the year is incomplete, since
the ceiling can bite and a ledger can start mid-year — a floor is never allowed
to pass for a total.

Months are compared as `YYYY-MM` string prefixes rather than as dates: the ledger
stores days as strings, nothing here needs arithmetic on them, and going through
`Date` would add a timezone that can move an expense into the wrong month at
midnight on the first. What it does need is that the month before January is
December of the year before, which `month - 1` gets wrong once a year, so there
is a test for exactly that.

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

**The coordinates never reach the backend.** They are in IndexedDB, they are not
sent to the backend, they are not written to the spreadsheet, and there is no
column for them — what reaches the ledger is the concept, exactly as if it had
been typed. The other person in the house cannot see them. The first line of the
screen says so, and section 13 of the privacy policy says it again.

**With one exception, decided out loud: the map.** The review step used to draw
its own schematic rather than show a map, so that nothing about the position
reached any server at all. It was reported as circles that add nothing, and that
was right — the drawing only ever knew one thing, the accuracy against the
fifteen-metre tolerance, which is a sentence and not a picture; with no saved
place nearby, the normal case, it was two concentric circles around a dot, and
nothing on it was recognisable as anywhere. So the map is real now, from
OpenStreetMap, and turning the switch on asks that server for tiles. The line
that replaced "nothing leaves" is narrower and still worth having: **tiles are
requested at tile granularity — a hundred metres or more, never the point.** The
mosaic is centred on the tile the fix sits in rather than on the fix, so even the
set of URLs asked for does not narrow it further; nothing is requested unless a
map is on screen; and the accuracy ring and the fifteen-metre circle are still
drawn locally, on top, which is the part of the old drawing that was doing work.

**The same map, a second time: one saved place.** Tapping a row on the Sitios
screen opens `/sitios/<id>`, which is that place on the map it was saved from —
the fix that was written down, the accuracy it had, the fifteen-metre circle, and
the other saved places within 120 m labelled around it. It exists because the
list is numbers about a doorway nobody can picture: "±18 m, a 34 m de aquí" is
the reason a place never matches, and the map is where that stops being a
mystery. The places within 120 m are also the answer to why one door offers two
concepts, seen instead of explained.

Drawing it reads no position — the coordinate comes off the disk — so the map
neither prompts nor needs the permission, and it works with it refused. What it
does do is ask for tiles, the second of the occasions section 13 names. (The
screen itself does read the position where the permission was already granted,
through `positionIfAlreadyAllowed`, which is what the distances on the list are
and never raises a dialog. Prompting is one button's job and it says so.) The
detail is an address rather than state for the usual reason: the phone's back
button closes the map instead of leaving the screen.

**And the two things you can do to a place, both of them there.** *Corregir la
posición* replaces the position a place was saved with, and it is the cure for the
failure this feature has that nothing else could fix: a place saved indoors at
±40 m is outside its own fifteen-metre tolerance from the first day, so it never
comes back, and the only answer used to be deleting it and apuntando another gasto
at that door.

It opens on the position the place already has and **the map is dragged** until
the crosshair is on the doorway — which needs no fix at all, and is the answer to
the case standing still cannot fix: the phone says the far side of the block, and
the person holding it can see which door it should be. A point placed that way has
no device accuracy, so it takes `PLACED_METRES` — ten, what a fingertip on a
street map is worth, and inside the tolerance, which is the whole reason somebody
moved it. The old position is labelled on the map once the two are far enough
apart to be told apart, with the distance under it, and nothing is stored until
Guardar.

Inside that correction, *Usar dónde estoy ahora* reads the device and recentres on
it, with the review step's watch refining the fix — best fix wins, not latest —
until a drag takes over, at which point the point is the person's and the watch
stops rather than shoving it back. That button is the third thing in the app that
reads the position, and it follows the rule rather than bending it: only a control
that says it will may ask. Dragging asks for the tiles it drags over, which is
what dragging is; the map is draggable through a prop rather than by default,
because a map opened to read must not become a way to look around. Section 13, the
disclosure on the Sitios screen and the bullet in `CLAUDE.md` moved with all of
it. That disclosure sits behind a fold — «Cómo se guardan los sitios», at the
bottom of the list — because as two paragraphs above the list it was four lines of
prose between the header and the thing the screen is for. Folded, not deleted: it
is the policy said where the feature is, and that repetition is the point of it.

**A place can also be added from this screen**, with a concept and a category and
no gasto involved. The switch on the review step is the other way in and it only
fires while something is being apuntado at that doorway, which misses both useful
moments: the shop you are standing outside with nothing to apuntar, and the one
you want to name and file deliberately rather than with whatever the guess made of
its concept while there was a queue behind you. The form is `/sitios/nuevo`, the
same picker as the correction — a map that opens on the phone's position where the
permission was already granted, on the last place saved where it was not, dragged
from either — plus the concept field and the same category picker the second step
uses. `uses` starts at nothing, because that counter means "how often this doorway
really turned out to be the one" and a place typed in at the kitchen table has not
been the one yet. The same concept at the same doorway is still the same place: the
form says so instead of listing it twice.

**Which is what the category on a place is for.** It is stored on the place rather
than guessed from the concept, because the guess is the thing it exists to
override — `guessCategory` reads the Categorías tab's keywords, and «la de la
esquina» is not a word on any row of it. A place that carries one hands it to the
expense along with the concept, and the step-two guess is told to stand down for
that tap; a place saved by the switch keeps whatever category the expense was
filed under, which is usually one somebody has just looked at. Empty is not a
category: without one, the guess happens exactly as before.

The picker behind both — the fix from the device, the drag, the watch that stops
the moment somebody drags — is one hook, `lib/picker.ts`. Two screens choosing a
position had to agree about three things that are easy to get subtly different,
and the third is the one worth naming: a refusal is said out loud, because this
app cannot re-ask for a permission it has been refused and a button that silently
did nothing would be indistinguishable from a broken one.

The Mercator arithmetic moved out to `lib/mercator.ts` when the map learned to
drag: a sign error there moves somebody's doorway quietly in the wrong direction,
and as three pure functions it has a round trip a test can check. Dragging down
moves the point *north*, which is the line in that file worth reading twice.

*Borrar este sitio* is on the same screen and has moved off the list row, where it
sat a thumb's width from the row that scrolls past it. It asks with the app's own
dialog rather than `window.confirm`, like the discard on the review step.

Saving one is always a deliberate flick of the "Guardar este sitio" switch on
the review step, which is the only thing in the app that asks for the location
permission. Every other read is guarded by a permission check that gives up
rather than prompting, so somebody who never uses places is never asked — see
`app/src/lib/position.ts`.

The switch reads the position when it goes on and shows the coordinate it would
save, with the accuracy beside it. Showing it is the only way to tell a good fix
from a bad one *before* trusting it: the radius is fifteen metres, a phone
indoors is often less sure of itself than that, and `±38 m` on screen explains in
advance what would otherwise be a suggestion that mysteriously never comes back.
It is also the only place in the app that ever displays a coordinate.

The place is written when the expense is, not when the switch moves — so
abandoning the entry leaves nothing behind, and a place cannot exist for a gasto
that was never apuntado.

A place is a location *and* a concept, not a location with a concept attached.
The pharmacy and the supermarket in the same square are two places, and both are
offered when you stand between them. Merging them would mean choosing which one
to lose.

What a place lends back is a card at the top of the second step, not a chip in
the row — see **Añadir**. It carries the concept and the payment method saved
with it, because at a given shop it tends to be the same card, and both are
printed on it.

**Fifteen metres**, and the number is load-bearing in both directions. The shop
next door is fifteen metres away, so a radius wide enough to always match would
match the wrong shop; and an indoor fix is often worse than fifteen metres, so
the accuracy of each fix is stored and shown rather than hidden — a place that
never matches is then explained by a number instead of being a mystery. The fix
itself is never read from the cache, and that is the line to leave alone: it was
a minute of cache to begin with, which is eighty metres of walking, and the
browser test that walks forty metres up the street is what caught it.

### Fijos

Recurring templates: the rent, the light, the insurance. They **propose, they do
not post** — some rows in this ledger are pasted from a bank statement, so an app
that posted them by itself would write the rent twice into a ledger where a row
can only be voided, never removed.

The tab is the list and the editor: what they are, how often, on which day, whose
card, what card, and whether they are switched on. The category and the payment
method are the two the template carries on behalf of the gasto it proposes: the
rent is filed the same way and comes off the same account every month, so both are
chosen once here rather than every time a proposal is confirmed. Empty leaves each
to what the second step would have done anyway — the guess for the category, the
pills for the card. `importe` left empty means *ask me every
time*, which is the light and the water. `persona` left empty means whoever is
holding the phone. It is a tab and not a corner of another screen because an
editor needs a door that is there when the list is empty — the proposals appear
only when something is owed, so they could never be the way in to creating the
first one.

**What is due appears on the first step of Añadir**, as one line saying how many,
with the detail behind a tap. Not the list itself: that screen already carries
the keypad, the amount, the payer and the day, and a list that grows with what is
owed would push the keypad off the bottom — the mistake that screen has now made
in four different ways.

Confirming loads the expense into the three-step flow at the **review** step and
writes nothing until it is saved there, through the same append, the same queue
and the same client-generated id as an expense typed by hand. A template with no
amount lands on the keypad instead, with the concept, the day and the payer
already filled in. Skipping records the period as dealt with without writing
anything: confirmed and skipped are the same fact as far as *do not propose it
again* goes.

Two things guard against the duplicate. The `último` column, written by the app,
is the record of what has been settled. And the app checks the entries it already
holds for something that looks like this expense in this month — folded, and by
month rather than day, because a statement says "RECIBO ALQUILER" on the 2nd for
a rent due on the 1st. That one is a **warning and not a block**: too eager costs
a line nobody needed, too strict costs the rent twice.

**A template is its `id`, not its row.** The Fijos tab is edited by hand, so a
row deleted or inserted above one moves every row below it — and a phone holding
a list from a minute earlier would then write `último` onto the neighbouring bill.
The `id` column on the end is ours; the row still comes back to the app because it
is what the users see in the tab, but nothing is looked up by it. A row with no id
is found by row as a fallback and **stamped on the way past**: with the id the app
sent, or with a fresh one when it sent none. That second case is the templates
written before the column existed — the app reads them with no id, so it sends
none, and without minting one here they would be row-addressed for ever.
`setupSpreadsheet` stamps them all in one pass; whichever happens first wins, and
an id already in the cell is never overwritten.

**Which periods a template owes is computed in the app**, not the backend —
`app/src/lib/fixed.ts`. All the risk here is calendar arithmetic: a day 31 in
February, an anchor two months out of phase, six months nobody opened the app.
Apps Script has no test runner and this has twenty-two unit tests. Missed periods
are all proposed, oldest first, because the ledger wants each row with its own
date; a ceiling of twenty-four stops an anchor typed as 2014 from producing a
screen nobody can use.

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

### Staying signed in

The token is kept in `localStorage` until it expires, and that is the difference
between an app that opens on the keypad and one that asks who you are every time.
It used to live in a variable, so every cold start began with no credential and
had to get a fresh one out of Google before it could ask for anything — and the
silent path that does that is the least reliable thing here: it wants a live
Google session, an un-suppressed One Tap, and a browser willing to run it. When
it failed, the app showed a login screen. Now a token inside its hour is simply
still there, and opening the app twice in an afternoon involves Google not at
all.

Three things make the *renewal* silent too, when the hour is up. `auto_select`,
so a single matching session needs no tap. A `login_hint` from the last address
this device accepted, because with several Google accounts on a phone
`auto_select` has to choose and shows a chooser instead of choosing. And
`use_fedcm_for_prompt`, which is the one that matters most as time passes: the
old One Tap is an iframe from accounts.google.com, third-party by definition, and
a browser that has stopped carrying third-party cookies turns it off without
saying so. FedCM is the browser's own identity API and the supported replacement.

A rejected token is deleted rather than kept, so a cold start cannot hand the
backend the very credential it just refused — the sharing list can change under a
token that is still within its hour, and that is a `UNAUTHENTICATED` the app has
to take as final.

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

**Tests.** `node --test` over the backend, against forty lines of fake Sheets in
`apps-script/test/`. It says something the rest of the suite cannot: the browser
tests stub the API, so a backend that throws — or answers a shape the app does
not expect — is green all the way to somebody's phone. It found `último` being
written as text and read back as empty, which would have proposed every recurring
expense again for ever.

Vitest over the pieces that cannot be wrong: the C/D column reader,
the transfer splitter, the concept matcher, the distance between two points on
the ground, the icon a concept is given, the totals over the list, and which
periods a recurring expense owes.

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
   transfer splitter, and recurring templates prompting on their due date. *Done.*
3. **Make it fly.** Offline queue, computed chips, installable PWA, a direct
   "new expense" shortcut from the icon, and the concept remembered per place.
4. **Extras.** Search across the whole history, per-concept summaries, receipt
   photos to Drive, CSV export.

## 8. Open

The first three items on this list were the ones that had to exist before any of
this worked, and they do: there is a copy to develop against, both accounts sign
in, and the sheet is shared with the two of them and nobody else. What is left:

- **The app still writes to the copy.** Switching it to the real ledger is
  `DEPLOY.md` §9, and it is a deliberate last step: everything gets tried on the
  copy first, and the copy stays afterwards for the same reason.
- **Review who has access to the spreadsheet, periodically.** Drive governs
  authorization now, so anyone with edit permission could post from the app.
- **One gap left open on purpose.** `app/e2e/` is outside `tsc -b` and
  `eslint src`, since tsconfig covers only `src` and the tests need Node globals
  the app's type surface excludes.

The other gap that used to be here — the tabs being state rather than URLs — is
closed. Every screen has an address (`/`, `/gastos`, `/diferencia`, `/sitios`,
`/fijos`), so does each detail sheet (`/fijos/4`, `/fijos/nuevo`, `/gastos/<id>`,
`/sitios/<id>`)
and so does the cog sheet (`/iconos`); the device's back button walks all of it,
and a reload — including the one the app performs on itself when a new version
lands — comes back to what was open. The sheets that are not addresses close on
back instead, through `useBackClose`: the category picker, the cog sheet's inner
lists and the proposal of what the fijos owe open over a form whose contents are
nowhere in the URL, so a path of their own would promise to restore something it
cannot.
