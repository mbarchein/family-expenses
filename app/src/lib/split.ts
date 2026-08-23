/**
 * How much each person puts into a transfer so the ledger ends up even.
 *
 * The spreadsheet's balance column is `sum(person 1) − sum(person 2)`, so a
 * positive difference means person 1 is ahead. To land on zero after adding a
 * transfer of `total`, the one who is ahead contributes
 *
 *     (total − |difference|) / 2
 *
 * and the other one the rest.
 *
 * Two cases refuse to come out exactly, and the function reports both rather
 * than rounding them away — this is the one number in the app that is not
 * allowed to be approximately right:
 *
 *   - A difference larger than the transfer cannot be evened out at all. The
 *     person who is ahead puts in nothing, the other puts in everything, and
 *     what is still outstanding comes back in `residual`.
 *   - A difference that is an odd number of cents has no halfway point. The
 *     share of whoever is ahead is rounded DOWN, so the extra cent is carried
 *     by the one who was behind — the side that owed it — and `residual` says
 *     so instead of the screen claiming a zero that is not there.
 */
export interface Split {
  shares: [number, number]
  /** The difference that will remain afterwards, signed like the input:
   *  positive still favours person 1. Zero when it comes out exactly. */
  residual: number
}

export function splitTransfer(total: number, difference: number): Split {
  const gap = Math.abs(difference)
  const ahead = difference > 0 ? 0 : 1
  const behind = ahead === 0 ? 1 : 0
  const shares: [number, number] = [0, 0]

  if (gap >= total) {
    shares[behind] = round2(total)
  } else {
    shares[ahead] = floor2((total - gap) / 2)
    // The other share is the remainder rather than the same division run twice,
    // so the two always add up to exactly the transfer that was typed.
    shares[behind] = round2(total - shares[ahead])
  }

  // Computed the way the spreadsheet computes it, not derived from the algebra
  // above: if the two ever disagree, this is the one that matches what the
  // sheet will show tomorrow.
  return { shares, residual: round2(difference + shares[0] - shares[1]) }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function floor2(value: number): number {
  return Math.floor(value * 100) / 100
}
