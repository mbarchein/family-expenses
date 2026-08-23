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

1. **Never write to column E.** The running balance is the spreadsheet's own
   formula. Copy it down to a new row; never compute the value ourselves.
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
