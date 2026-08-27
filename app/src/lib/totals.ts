/**
 * What the three numbers over the list add up to.
 *
 * Sums by calendar month and calendar year, over whatever list it is handed —
 * which is the point: the strip is fed the *filtered* entries, so searching for
 * "super" turns it into what the supermarket has cost this month. A summary that
 * ignored the filter under it would be a number nobody could act on, and one
 * that looked like the household total while showing one person's is worse than
 * no summary at all.
 *
 * Months are compared as `YYYY-MM` string prefixes rather than as dates. The
 * ledger stores days as `YYYY-MM-DD` strings and nothing here needs arithmetic
 * on them; going through `Date` would only add a timezone that could move an
 * expense into the wrong month at midnight on the first.
 */

export interface Totals {
  previous: number
  current: number
  year: number
  /** `YYYY-MM` of the month before the one we are in — December of last year
   *  when we are in January, which is the case a `month - 1` gets wrong. */
  previousMonth: string
}

export function summarise(
  entries: readonly { date: string; amount: number; voided: boolean }[],
  today: string,
): Totals {
  const year = today.slice(0, 4)
  const current = today.slice(0, 7)
  const previous = monthBefore(current)
  const totals: Totals = { previous: 0, current: 0, year: 0, previousMonth: previous }

  for (const entry of entries) {
    // A voided row keeps its place in the list, struck through, and contributes
    // nothing here. Its amounts are gone from the sheet too.
    if (entry.voided) continue
    const month = entry.date.slice(0, 7)
    if (month === current) totals.current += entry.amount
    else if (month === previous) totals.previous += entry.amount
    if (entry.date.slice(0, 4) === year) totals.year += entry.amount
  }

  return totals
}

/**
 * Everything the list is showing, added up, with no calendar in it at all.
 *
 * The three cells above are months, which is the right shape for "how are we
 * doing" and the wrong one for a filter: searching for `farmacia` and being told
 * what the chemist cost *this month* answers a question nobody asked when the
 * point of typing it was to find out what it costs, full stop. So this is the
 * fourth number, and it only appears when a filter is on — unfiltered it would be
 * a total of "the last few hundred rows", which is a number about the app rather
 * than about the household.
 *
 * The span comes back with it because a total with no dates on it invites being
 * read as a total of everything. It is not: it is a total of what got loaded, and
 * the two ends of it say where that starts.
 *
 * Voided rows are skipped, the way they are everywhere else that adds up — and
 * the count is of what the total is made of, for the same reason. A row with no
 * amounts is not a row this number is hiding.
 */
export interface Matched {
  total: number
  count: number
  from: string | null
  to: string | null
}

export function matchedTotal(
  entries: readonly { date: string; amount: number; voided: boolean }[],
): Matched {
  const matched: Matched = { total: 0, count: 0, from: null, to: null }
  for (const entry of entries) {
    if (entry.voided) continue
    matched.total += entry.amount
    matched.count++
    if (!matched.from || entry.date < matched.from) matched.from = entry.date
    if (!matched.to || entry.date > matched.to) matched.to = entry.date
  }
  return matched
}

/** The earliest day present, or null for an empty list. What the summary can
 *  see, which is not the same as what the ledger holds — the app loads the last
 *  few hundred rows, so a year total is a floor when this falls after 1 January. */
export function earliestDay(entries: readonly { date: string }[]): string | null {
  let earliest: string | null = null
  for (const entry of entries) if (!earliest || entry.date < earliest) earliest = entry.date
  return earliest
}

/** The latest day present, or null for an empty list. The pair with
 *  `earliestDay` is what lets a total say which stretch of time it is a total
 *  of, rather than leaving somebody to guess from the rows above it. */
export function latestDay(entries: readonly { date: string }[]): string | null {
  let latest: string | null = null
  for (const entry of entries) if (!latest || entry.date > latest) latest = entry.date
  return latest
}

/** True when the loaded window cannot see the whole of `today`'s year. */
export function yearIsPartial(from: string | null, today: string): boolean {
  return Boolean(from) && from! > `${today.slice(0, 4)}-01-01`
}

function monthBefore(month: string): string {
  const [year, index] = month.split('-').map(Number)
  return index === 1
    ? `${year - 1}-12`
    : `${year}-${String(index - 1).padStart(2, '0')}`
}
