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

This includes the CI/CD pipelines. The workflows were `verificar` and
`desplegar` for a while — matching the convention across the author's other
repositories — and that exception was dropped: nothing in `.github/` is read by
the two people using the app, so the rule has no reason to bend there. They are
`verify` and `deploy`.

What survives the rename is the trap underneath it. Branch protection in
`infra/github.tf` lists the **job** names inside `verify` — `app` and `backend` —
and not the workflow's name. Rename a job and that file has to follow in the
same commit, or every merge blocks forever waiting on a check that will never
report. `deploy.yml` also names `verify` in its `workflow_run` trigger, so those
two move together too.

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

## Three more traps

- **Never send `application/json` to the backend, and never add a header to a
  request.** Apps Script does not answer OPTIONS, so anything that triggers a
  CORS preflight fails in the browser while working perfectly in curl. Requests
  are `text/plain` with the token in the body. The reasoning is at the top of
  `apps-script/Api.js` and `app/src/api/client.ts`.
- **Never send a coordinate to the backend.** The places feature stores where
  the phone was in IndexedDB and nowhere else — not in the request, not in the
  sheet, and there is no column for it. What reaches the ledger is the concept,
  exactly as if it had been typed. This is a promise made in as many words on the
  Sitios screen and in section 13 of the privacy policy, so adding a field
  "while we are there" breaks a published document and not just a rule. The same
  goes for reading the position: only the button that says it will asks for the
  permission, and every other read gives up rather than prompting.

  This rule used to be wider — nothing about the position reached *any* server,
  which is why the review step drew its own schematic instead of showing a map.
  That was dropped deliberately, not by drift: the drawing only ever knew one
  thing, and with no saved place nearby it was two circles around a dot. The map
  is real now, so turning that switch on asks openstreetmap.org for tiles and
  tells it roughly where the phone is. The narrowing is exactly this: **tiles for
  a map that was asked for, at tile granularity — a hundred metres or more, never
  the point.** Which means the mosaic must keep being centred on the *tile* the
  fix is in rather than on the fix, or the set of URLs requested would give the
  doorway away. Everything else stands: our backend, the sheet, and the other
  person's phone still never see a coordinate, and nothing is requested unless a
  map is on screen. Section 13, the Sitios screen and this bullet say the same
  thing — change one and the other two move in the same commit.

  There are four of those maps now — the review step, a saved place, correcting
  one, and adding one by hand — and the second one is why that clause reads
  "a map is on screen" rather than "the switch is on": opening a saved place from
  Sitios shows the same map, centred on the fix that place was saved with. That
  one is the same bargain rather than a wider one — the tile asked for is the tile
  the review step already asked for the day it was saved — and it reads no
  position at all, so it never prompts and works with the permission refused.

  The third is **Corregir la posición**, on that same detail, and it is the one
  that moves. It opens on the position the place already has — so it reads nothing
  and prompts for nothing — and the map can then be dragged until the crosshair is
  on the right doorway. Dragging asks for the tiles you drag over, which is what
  dragging is and is the same bargain: squares, never the point. Inside it, and
  only there, **Usar dónde estoy ahora** reads the position and recentres on it.
  That button is the third thing in the app that may prompt, and it is allowed by
  the rule rather than an exception to it — the whole of the reading rule is that
  the control says what it will do.

  The fourth is the new-place form on Sitios, which is the correction's twin: it
  opens on the phone's position where the permission was already granted, on the
  last place saved where it was not, and is dragged from there. Same button
  inside it, same rule.

  Reading without prompting is the other half of that rule and it is allowed:
  the Sitios screen reads the position on mount through
  `positionIfAlreadyAllowed`, which looks at the permission and gives up rather
  than asking. That is what the distances on the list are, and it is why the two
  Spanish lines say «pedirte permiso solo lo hace este botón» rather than
  «nada lee tu posición» — the first is true and the second was not.

  Which is why the map is draggable through a prop and not by default: a map
  somebody opened to read must not become a way to look around, or the "tiles for
  a map that was asked for" clause stops describing what is happening. All of this
  costs what it always costs — section 13, the disclosure on the Sitios screen and
  this bullet were rewritten in the same commit, and the next occasion costs the
  same again. That disclosure is folded behind «Cómo se guardan los sitios» now,
  which was asked for and is fine: one tap from the list it describes, and still
  on the screen. Deleting it is not the same thing and is not available — a
  published document would be claiming something the app no longer says.
- **Never let clasp push anything that is not a backend source.** Apps Script
  compiles every file in the project and runs the top level of every one of them
  on every single request, so one stray file breaks the whole web app rather than
  itself. `apps-script/test/` was pushed for one afternoon: its first line is
  `require('node:test')`, every call died with "ReferenceError: require is not
  defined" before reaching `doPost`, the deployment answered an HTML error page,
  and the browser showed `TypeError: Failed to fetch` — indistinguishable, from
  inside the app, from having no network at all. The root `.claspignore` is
  therefore default-deny, and `verify` asks clasp itself what a push would
  contain. Both jobs were green throughout.
- **Never round a leftover cent into silence.** A difference that is an odd
  number of cents has no even split; `splitTransfer` reports what will remain
  and the screen says so. The balance is the one number in this app that is not
  allowed to be approximately right.

## Do not bump TypeScript to 7

TypeScript is deliberately held at 6.x while everything else tracks the latest
stable. The 7.0 compiler works — it typechecks this project cleanly — but
`typescript-eslint` refuses to load against it and hard-fails the lint step:

```
Error: typescript-eslint does not support TS 7.0
```

There is no clean way round it. The version gate is a `require('typescript')`
check, so npm `overrides` cannot give the linter its own copy: `typescript` is a
peer dependency and npm satisfies it from the root. Running the two side by side
is documented by Microsoft for tools that accept a compiler path; this one does
not.

Revisit when typescript-eslint ships support — it is tracked at
<https://github.com/typescript-eslint/typescript-eslint/issues/10940>.

## Comments

Comments here explain why, and several name the failure that motivated them.
Match that. A comment restating what the line below it does is noise; a comment
saying which plausible-looking change would break production is the reason the
next person does not make it.
