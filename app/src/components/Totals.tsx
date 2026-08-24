import { T } from '../i18n/strings'
import { formatMonthShort } from '../lib/dates'
import { formatEur } from '../lib/money'
import type { Totals as Sums } from '../lib/totals'

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
 */
export function Totals({ sums, today, filtered, partialSince }: {
  sums: Sums
  today: string
  filtered: boolean
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
        <Cell label={T.list.thisYear} amount={sums.year} last />
      </div>

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
