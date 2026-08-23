# A medias

A PWA for two people who share household expenses, writing into a Google
spreadsheet they already keep.

It opens straight on the numeric keypad: amount, concept, save. The row lands at
the bottom of the same ledger they have been using for years, and the difference
between the two people is read from the column the sheet already computes.

The interface is in Spanish — it is built for two specific people. Everything
else in this repository is in English. See [`CLAUDE.md`](CLAUDE.md).

- **Design:** [`docs/DESIGN.md`](docs/DESIGN.md), with a visual version at
  <https://claude.ai/code/artifact/7cb8ee01-cc45-4bc2-b1c9-e9fd88b00393>
- **Installing it:** [`DEPLOY.md`](DEPLOY.md)
- **Live at:** <https://gafa.terragiro.es>

## The model in four lines

- Every row is money that left one person's pocket for the household — the
  groceries, the fuel, or a transfer to the joint account.
- Who paid is expressed by which column holds the amount, not by a field.
- Everything splits down the middle. There are no settlements: an imbalance is
  corrected in the next transfer to the joint account, and the app works out
  each share.
- The app does not recompute the balance. It reads it from the sheet's
  `diferencia` column, so the two can never disagree.

## Layout

```
app/           the PWA — Vite, React, TypeScript, Tailwind, vite-plugin-pwa
apps-script/   the backend — a Google Apps Script bound to the spreadsheet
docs/          DESIGN.md, the reasoning behind all of it
```

## Working on it

```bash
make install                 # dependencies
cp app/.env.example app/.env # point it at a deployed backend
make dev                     # http://localhost:5173
make verify                  # lint, typecheck, test, build — what CI runs
```

`make dev` talks to a real Apps Script deployment; there is no local backend to
run. Point it at the copy of the spreadsheet, never at the live ledger — see
[`DEPLOY.md`](DEPLOY.md).

## Status

Phase 1 and most of phase 2 are written and unreleased: entry, list, editing,
voiding, the balance, the transfer splitter, the offline queue and installable
PWA. Recurring templates (the `Fijos` tab) are stubbed in the spreadsheet but
have no screen yet.
