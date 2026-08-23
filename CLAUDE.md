# Project conventions

## Language

**English everywhere in this repository** — code, identifiers, comments, docs,
commit messages, PR descriptions, test names, log output.

**Spanish for anything a user reads.** The app's two users are Spanish speakers;
the interface is theirs. That means:

- All UI copy: labels, buttons, empty states, error messages, date formats.
- The spreadsheet itself. Its column headers (`Fecha`, `Concepto`, `Viqui`,
  `Mario`, `diferencia`) are their data and are never renamed by us.
- The keys of the `Config` sheet tab (`persona_1_nombre`, …). That tab is edited
  by hand in Google Sheets by the two users, so it counts as interface, not
  schema. Overrule this if you disagree — but do it deliberately, not by drift.

Keep UI strings in one place so the boundary stays obvious rather than leaking
Spanish into logic.

## Invariants

These come out of the design and are easy to break by accident. See
`docs/DESIGN.md` for the reasoning.

1. **Never write a value or a formula string into column E.** The running
   balance is the spreadsheet's own formula. Copy the cell down from the row
   above with `copyTo`. Building the formula text ourselves would hardcode
   en-US function names and separators (`SUM(a,b)`, not the `SUMA(a;b)` the
   sheet displays) and would break the day someone edits the formula.
2. **Never delete a row.** Voiding an entry clears the two amount cells and
   marks the concept. Deleting a row inside a running total corrupts every row
   below it.
3. **Always append at the end.** Never reorder, never insert.
4. **Who paid is expressed by which column holds the amount** — there is no
   payer field.
5. **Rows without an `id` are read-only.** They were pasted by hand from a bank
   statement; count them, never edit them, until an id is assigned.
6. **Development runs against a copy of the spreadsheet.** The real ledger is
   only connected once the app works.

## Layout

```
app/           the PWA. Vite + React + TypeScript + Tailwind + vite-plugin-pwa
apps-script/   the backend. Plain .js, pushed to Google with clasp
docs/          DESIGN.md
```

There is no local backend. `app` talks to a deployed Apps Script; develop
against the copy of the spreadsheet, never the live ledger.

## Two more traps

- **Never send `application/json` to the backend, and never add a header to a
  request.** Apps Script does not answer OPTIONS, so anything that triggers a
  CORS preflight fails in the browser while working perfectly in curl. Requests
  are `text/plain` with the token in the body. The reasoning is at the top of
  `apps-script/Api.js` and `app/src/api/client.ts`.
- **Never round a leftover cent into silence.** A difference that is an odd
  number of cents has no even split; `splitTransfer` reports what will remain
  and the screen says so. The balance is the one number in this app that is not
  allowed to be approximately right.

## Comments

Comments here explain why, and several name the failure that motivated them.
Match that. A comment restating what the line below it does is noise; a comment
saying which plausible-looking change would break production is the reason the
next person does not make it.
