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
  const transfer = cents(total)
  const signed = cents(difference)
  const gap = Math.abs(signed)
  const ahead = signed > 0 ? 0 : 1
  const behind = ahead === 0 ? 1 : 0
  const shares: [number, number] = [0, 0]

  if (gap >= transfer) {
    shares[behind] = transfer
  } else {
    // An odd number of cents has no halfway point, and this is where it is
    // dropped: on integers, so it is dropped once and on purpose.
    shares[ahead] = Math.floor((transfer - gap) / 2)
    // The other share is the remainder rather than the same division run twice,
    // so the two always add up to exactly the transfer that was typed.
    shares[behind] = transfer - shares[ahead]
  }

  // Computed the way the spreadsheet computes it, not derived from the algebra
  // above: if the two ever disagree, this is the one that matches what the
  // sheet will show tomorrow.
  const residual = signed + shares[0] - shares[1]

  return {
    shares: [shares[0] / 100, shares[1] / 100],
    residual: residual / 100
  }
}

/**
 * Money as the whole number of cents it is. Everything above runs on these.
 *
 * The previous version divided and floored the euro figures directly, and
 * `Math.floor(value * 100)` is a trap: 574.56 * 100 is 57455.999999999993, so
 * flooring it drops a cent that was never in dispute — and then the screen
 * reports two cents outstanding that do not exist. Inventing a leftover is the
 * same sin as hiding one.
 *
 * Rounding on the way in is also what keeps the app agreeing with the sheet.
 * The balance cell arrives as 1435.9399999997404 after two thousand additions
 * while the spreadsheet displays 1.435,94 €. Cents are the authority; the extra
 * digits are an artefact of the sum, not information.
 */
function cents(value: number): number {
  return Math.round(value * 100)
}
