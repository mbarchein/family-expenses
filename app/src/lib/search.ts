import { fold } from './icons'
import { amountTyped, sameAmount } from './money'

/**
 * Everything the list is narrowed by, and the one place that applies it.
 *
 * It was three conditions written inline on the screen — the payer, the search
 * box, the category — and it is seven now that an amount and two ranges have
 * been added. Seven conditions spread across a component is where a filter
 * quietly stops agreeing with the summary above it, so they live here, in one
 * object, applied by one function that the screen, the band and the day totals
 * all read through.
 *
 * Every field is a string because every field comes from an input, and the
 * empty string is what an input that has not been filled in says. That keeps
 * "not filtered by this" and "filtered by nothing" from being two states.
 */
export interface Filters {
  /** `'all'`, or the index of the person paying, as the segmented control
   *  gives it. */
  payer: string
  /** The quick search box: a concept, or an amount, or something that is both. */
  query: string
  /** The category picked, `''` for the rows that have none, `null` for all. */
  category: string | null
  /** `YYYY-MM-DD`, from the advanced search. */
  from: string
  to: string
  /** Euros, as typed. */
  min: string
  max: string
}

export const NO_FILTERS: Filters = {
  payer: 'all', query: '', category: null, from: '', to: '', min: '', max: '',
}

/** Whether anything at all is narrowing the list — which is what makes the
 *  band say «Solo lo filtrado» and the matched total appear. */
export function isFiltered(filters: Filters): boolean {
  return filters.payer !== 'all' || Boolean(filters.query.trim()) ||
    filters.category !== null || Boolean(filters.from || filters.to) ||
    Boolean(filters.min.trim() || filters.max.trim())
}

/** Whether the advanced search is holding anything, which is what lights its
 *  button up: the quick box says what it is doing on its face, and a range
 *  folded behind a dialog does not. */
export function isNarrowed(filters: Filters): boolean {
  return Boolean(filters.from || filters.to || filters.min.trim() || filters.max.trim())
}

/**
 * The entries the filters leave standing.
 *
 * The category is compared folded, like everywhere else that compares one: the
 * names come from a tab the two of them edit by hand in Google Sheets, so
 * `Educación` typed there and `educacion` written by an older version of the app
 * are the same category and a filter that disagreed would show an empty list.
 *
 * **The search box matches a concept or an amount**, whichever the text can be,
 * and `60` can be both: it finds the sixty-euro row and it finds «ruta 60». Two
 * boxes would make somebody choose which kind of question they are asking before
 * they have finished asking it, and one box that quietly stopped searching
 * concepts the moment a query looked numeric would lose rows without saying so.
 * An amount matches exactly — asked for that way, and the only way that is any
 * use: a quick search is for the row you remember, and «39,90» is the thing you
 * remember about it. Ranges are what the advanced search is for.
 *
 * Dates are compared as `YYYY-MM-DD` strings, which sort correctly and need no
 * timezone — see `lib/totals.ts` for why nothing here goes through `Date`.
 */
export function matches<T extends {
  concept: string; amount: number; payer?: number | null; category?: string; date: string
}>(entry: T, filters: Filters): boolean {
  if (filters.payer !== 'all' && entry.payer !== Number(filters.payer)) return false

  const needle = filters.query.trim().toLowerCase()
  if (needle) {
    const wantedAmount = amountTyped(filters.query)
    const byConcept = entry.concept.toLowerCase().includes(needle)
    const byAmount = wantedAmount !== null && sameAmount(entry.amount, wantedAmount)
    if (!byConcept && !byAmount) return false
  }

  // `?? ''` against the types on purpose: a ledger cached by a version from
  // before column H existed has rows with no category at all, and it is read
  // straight off the disk on the next open.
  if (filters.category !== null && fold(entry.category ?? '') !== fold(filters.category)) {
    return false
  }

  if (filters.from && entry.date < filters.from) return false
  if (filters.to && entry.date > filters.to) return false

  // A bound that is not a number is a bound that is still being typed, and
  // half-typed is not a reason to empty the list under somebody's hands.
  const min = amountTyped(filters.min)
  const max = amountTyped(filters.max)
  if (min !== null && entry.amount < min && !sameAmount(entry.amount, min)) return false
  if (max !== null && entry.amount > max && !sameAmount(entry.amount, max)) return false

  return true
}
