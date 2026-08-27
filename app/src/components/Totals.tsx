import { T } from '../i18n/strings'
import { formatMonthShort, formatShortDate } from '../lib/dates'
import { formatEur } from '../lib/money'
import type { Matched, Totals as Sums } from '../lib/totals'

/**
 * Three numbers over the list: last month, this month, this year.
 *
 * They are computed from the entries the list is showing, so they follow the
 * person filter and the search — asked for that way, and right that way: the
 * useful question is usually not "what have we spent" but "what has *this* cost
 * us", and the answer to that has to change when the question does.
 *
 * Which is exactly why the strip says so when a filter is on. Three euro amounts
 * on a dark strip read as the household's total whatever produced them, and a
 * filtered number wearing that look is a wrong number rather than a narrow one.
 *
 * And a fourth number underneath while a filter is on: what everything that
 * matches adds up to, months ignored. The three cells answer "how is this month
 * going", which is not what somebody typing `farmacia` into the search box wants
 * to know — they want what the chemist costs, and the month it happened in is the
 * part of that they are trying to get rid of.
 */
export function Totals({ sums, today, filtered, matched, partialSince }: {
  sums: Sums
  today: string
  filtered: boolean
  /**
   * Everything that matches, with no month in it — or null when nothing is
   * filtered and the question does not arise.
   *
   * Its own row rather than a fourth cell: four euro amounts across a phone is
   * either three characters of each or a strip nobody can read, and this is the
   * number somebody has just gone looking for, so it gets the room to be the
   * answer instead of a quarter of the furniture.
   */
  matched: Matched | null
  /** Set when the loaded window starts after 1 January, which makes the year a
   *  floor rather than a total. Shown, not hidden. */
  partialSince: string | null
}) {
  return (
    <div className="flex flex-col gap-1">
      <div
        role="group"
        aria-label={T.list.totalsRow}
        className="grid grid-cols-3 overflow-hidden rounded-xl border border-line"
        style={{ background: 'var(--surface)' }}
      >
        <Cell label={formatMonthShort(sums.previousMonth)} amount={sums.previous} />
        <Cell label={formatMonthShort(today)} amount={sums.current} strong />
        {/* The year names itself rather than saying "Año": the cells beside it
            now carry theirs, and a column labelled only "Año" between two dated
            ones reads as a different kind of number. */}
        <Cell label={today.slice(0, 4)} amount={sums.year} last />
      </div>

      {matched && (
        <div
          className="flex items-center gap-3 rounded-xl border px-3 py-2"
          style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--accent)' }}>
              {T.list.matchedTotal}
            </span>
            <span className="block truncate text-[11px] text-ink-3">
              {T.list.matchedCount(matched.count)}
              {matched.from && matched.to && (
                <> · {T.list.matchedRange(
                  formatShortDate(matched.from), formatShortDate(matched.to))}</>
              )}
            </span>
          </span>
          <span className="tabular shrink-0 font-mono text-base font-bold">
            {formatEur(matched.total)}
          </span>
        </div>
      )}

      {(filtered || partialSince) && (
        <p className="text-[11px] text-ink-3">
          {[filtered ? T.list.filtered : null,
            partialSince ? T.list.partialYear(partialSince) : null]
            .filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  )
}

function Cell({ label, amount, strong, last }: {
  label: string
  amount: number
  strong?: boolean
  last?: boolean
}) {
  return (
    <div className={'px-3 py-2' + (last ? '' : ' border-r border-line')}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-3">{label}</p>
      <p
        className={'tabular truncate font-mono text-sm' + (strong ? ' font-semibold' : '')}
        style={strong ? undefined : { color: 'var(--ink-2)' }}
      >
        {formatEur(amount)}
      </p>
    </div>
  )
}
