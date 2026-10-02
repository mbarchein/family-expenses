/**
 * What the numbers over the list add up to.
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

/** One cell of the strip: a calendar month, and what it came to. */
export interface MonthTotal {
  /** `YYYY-MM`. */
  month: string
  total: number
}

/**
 * Every month the loaded entries cover, newest first.
 *
 * It was two numbers — this month and the one before — because that was all the
 * strip had room for. The strip scrolls now, so the limit is gone and the right
 * answer is the whole timeline: a month per cell, back to the oldest expense the
 * app has, with nothing skipped. A missing month would be a hole in a scroll
 * that is meant to read as one continuous band, and a month that happens to have
 * cost nothing is an answer rather than an absence.
 *
 * Never shorter than two, so an empty ledger — or a filter that matches only
 * today — still shows the pair this strip has always shown instead of collapsing
 * to one cell.
 *
 * Entries dated in the future are left out, as they always were: the strip
 * starts at the month we are in. They are still in the year, which is the one
 * place a date nobody has reached yet can be seen.
 */
export function monthlyTotals(
  entries: readonly { date: string; amount: number; voided: boolean }[],
  today: string,
): MonthTotal[] {
  const sums = new Map<string, number>()
  let earliest: string | null = null

  for (const entry of entries) {
    // A voided row keeps its place in the list, struck through, and contributes
    // nothing here. Its amounts are gone from the sheet too.
    if (entry.voided) continue
    const month = entry.date.slice(0, 7)
    sums.set(month, (sums.get(month) ?? 0) + entry.amount)
    if (!earliest || month < earliest) earliest = month
  }

  const current = today.slice(0, 7)
  const previous = monthBefore(current)
  const last = earliest && earliest < previous ? earliest : previous

  const months: MonthTotal[] = []
  for (let month = current; month >= last; month = monthBefore(month)) {
    months.push({ month, total: sums.get(month) ?? 0 })
  }
  return months
}

/**
 * What `today`'s calendar year comes to.
 *
 * Its own pass rather than a field on the months, because it is not their sum:
 * the strip stops at the oldest month loaded and the year counts every entry
 * dated this year, which are the same number only by coincidence. December's
 * expenses are recent and belong to the year before, which is the case that
 * catches people out every January.
 */
export function yearTotal(
  entries: readonly { date: string; amount: number; voided: boolean }[],
  today: string,
): number {
  const year = today.slice(0, 4)
  let total = 0
  for (const entry of entries) {
    if (entry.voided) continue
    if (entry.date.slice(0, 4) === year) total += entry.amount
  }
  return total
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

function monthBefore(month: string): string {
  const [year, index] = month.split('-').map(Number)
  return index === 1
    ? `${year - 1}-12`
    : `${year}-${String(index - 1).padStart(2, '0')}`
}
