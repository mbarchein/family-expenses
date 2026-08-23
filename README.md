# A medias

A PWA for two people who share household expenses, writing into a Google
spreadsheet they already keep.

It opens straight on the numeric keypad: amount, concept, save. The row lands at
the bottom of the same ledger they have been using for years, and the balance
between the two people is read from the column the sheet already computes.

The interface is in Spanish — it is built for two specific people. Everything
else in this repository is in English. See [`CLAUDE.md`](CLAUDE.md).

## Status

Design closed, no code yet. The reference document is
[`docs/DESIGN.md`](docs/DESIGN.md). A visual version with screen mockups is
published at
<https://claude.ai/code/artifact/7cb8ee01-cc45-4bc2-b1c9-e9fd88b00393>.

## The model in four lines

- Every row is money that left one person's pocket for the household — the
  groceries, the fuel, or a transfer to the joint account.
- Who paid is expressed by which column holds the amount, not by a field.
- Everything splits down the middle. There are no settlements: an imbalance is
  corrected in the next transfer to the joint account.
- The app does not recompute the balance. It reads it from the sheet's
  `diferencia` column, so the two can never disagree.

## Planned architecture

| Piece | Choice |
| --- | --- |
| Frontend | React + TypeScript + Vite, installable PWA |
| Local state | IndexedDB with an outbound queue |
| Backend | Google Apps Script bound to the sheet, versioned with `clasp` |
| Identity | Google Sign-In, identity scope only |
| Authorization | Whoever can edit the spreadsheet |
| Hosting | Cloudflare Pages, deployed from GitHub Actions |

## Development

All development runs against a **copy** of the real spreadsheet. The live ledger
is not touched until the app works against the copy.
