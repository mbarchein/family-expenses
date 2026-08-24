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
5. **Rows without an `id` are respected.** Entries pasted by hand from a bank
   statement are read and counted, but not editable from the phone until an id
   is assigned — one tap.
6. **Only the tail is read.** The last few months, plus the final `diferencia`
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

### What the app will not add

No categories, no split percentage, no status column. With everything split down
the middle and no settlements, those columns would not change the result by a
cent, and would clutter a sheet that has stayed clean for years. If they are
ever needed, they append at the end with no migration.

## 4. Interface

Four screens — **Añadir**, **Gastos**, **Diferencia**, **Fijos** — plus
settings.

### Añadir (the landing screen)

The amount field has focus on open. No menus first.

- Numeric keypad with the amount set large.
- Chips of frequent concepts, ranked by **frequency × recency** over the user's
  own history. Each chip remembers its usual amount and who usually pays it.
  Nothing to configure.
- Payer: two buttons, preselected to whoever has the app open.
- Date: `Hoy` / `Ayer` / `Otra fecha`. Always editable, free when it is today.
- Save.

Short path: open → type amount → tap chip → save.

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

**Cache headers.** `app/vercel.json` sets two, and the reasons cannot live
beside them: Vercel validates that file against a strict schema and rejects any
property it does not know, so a `comment` key inside a header entry fails the
build — which is exactly how it failed, in one second, the first time the deploy
was ever configured enough to run. The reasons, then, are here. `/sw.js` is
served `max-age=0, must-revalidate`, because a service worker cached by a phone
keeps running last week's app forever. `/assets/(.*)` is served `immutable` for
a year, because those filenames are content hashes and a new build produces new
names.

**Tests.** Vitest over the two pieces that cannot be wrong: the C/D column
reader and the transfer splitter. A Playwright smoke test over adding an
expense.

**GitHub Actions.** `verificar` runs lint, typecheck, tests and build on every
push and pull request. `desplegar` runs only after it passes, and publishes the
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
   "new expense" shortcut from the icon, undo after saving.
4. **Extras.** Search across the whole history, per-concept summaries, receipt
   photos to Drive, CSV export.

## 8. Open

- Review who has access to the spreadsheet: now that Drive governs
  authorization, anyone with edit permission could post from the app.
- A copy of the spreadsheet to develop against.
- The two Google accounts used to sign in.
