import { useLayoutEffect, useRef } from 'react'
import { T } from '../i18n/strings'
import { formatMonthShort, formatShortDate } from '../lib/dates'
import { formatEur } from '../lib/money'
import type { Matched, MonthTotal } from '../lib/totals'

/**
 * The band over the list: a month per cell going back as far as the app has
 * loaded, with the year at the right-hand end.
 *
 * They are computed from the entries the list is showing, so they follow the
 * person filter and the search — asked for that way, and right that way: the
 * useful question is usually not "what have we spent" but "what has *this* cost
 * us", and the answer to that has to change when the question does.
 *
 * Which is exactly why the band says so when a filter is on. Euro amounts on a
 * strip read as the household's total whatever produced them, and a filtered
 * number wearing that look is a wrong number rather than a narrow one.
 *
 * **It scrolls sideways, and that is the whole shape of it.** Three fixed cells
 * — last month, this month, the year — were all a phone had room for, and the
 * month before last was a number the app held and could not show. So the band is
 * a scroller now, asked for in as many words: slide it with a thumb and the
 * months keep going back.
 *
 * Three things make that read as one continuous band rather than a widget:
 *
 * - **Every cell is exactly a third of the band.** Not a minimum width, a third:
 *   the snap points are then a third apart, the band's own width is a whole
 *   number of them, and so is the furthest it can scroll — so no position in the
 *   whole travel can show a cell cut in half, including the end.
 * - **The snap is mandatory**, which is what makes a half-finished swipe finish
 *   itself. Lift a thumb between two cells and the browser carries it to the
 *   nearer one; there is no resting place that is not a cell boundary.
 * - **Nothing is between the cells.** No gaps and no padding at either end: one
 *   hairline divider each, so what moves under the thumb is a strip of numbers
 *   and not a row of cards.
 *
 * **Time runs left to right, so the band rests at its right-hand end.** That is
 * the order the strip always had — last month, this month, the year — and it is
 * the one a calendar has: going back is going left. The cost is that the resting
 * place is `scrollWidth` rather than nought, and a band that painted at nought
 * and then jumped would be exactly the jerk this was asked not to have. So the
 * scroll is set in a layout effect, which runs after the cells are in the DOM
 * and before the browser paints: the first frame anybody sees is already at the
 * right end.
 *
 * The same effect is what keeps a filter from moving the band. Cells are added
 * and removed at the *left* — a search that matches nothing older shortens the
 * band from its far end — so a `scrollLeft` held constant would slide the months
 * under somebody's eyes every time they typed a letter. What is held constant is
 * the distance from the right, which is the end that means "now" and the only
 * end that does not move.
 *
 * The year is the last cell because it is the one that is not a month, and
 * because the three that show without touching anything are then the three this
 * band always showed.
 *
 * And a number underneath while a filter is on: what everything that matches
 * adds up to, months ignored. The cells answer "how is this month going", which
 * is not what somebody typing `farmacia` into the search box wants to know —
 * they want what the chemist costs, and the month it happened in is the part of
 * that they are trying to get rid of.
 */
export function Totals({ months, year, today, filtered, matched, since }: {
  /** Newest first, and never empty: see `monthlyTotals`. */
  months: readonly MonthTotal[]
  /** What this calendar year comes to, which is not the sum of `months` — the
   *  band stops where the loaded window does and the year does not. */
  year: number
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
  /**
   * The first day the app has, or null for an empty ledger.
   *
   * Shown, not hidden, and it says more now than it used to. It was only there
   * when the window started after 1 January — the case where the year is a floor
   * rather than a total — and the band has since grown an end: its last cell is
   * the month the window starts in, so that month is a floor too, and on a busy
   * ledger it always will be. One line saying where the whole band begins covers
   * both, and covers them whatever the filter leaves standing.
   */
  since: string | null
}) {
  const band = useRef<HTMLDivElement>(null)
  /**
   * How far the band is from its right-hand end, in pixels.
   *
   * Nought on the first render, which is what puts it at that end to begin with.
   * After that it is whatever the last scroll left it at, so that a band looking
   * at March in a ledger that has just grown four months of history is still
   * looking at March.
   *
   * A ref and not state: nothing on screen is drawn from it, and making it state
   * would re-render the list under every pixel of a swipe.
   */
  const fromRight = useRef(0)

  // Before the paint, not after: `useEffect` would show one frame of the band at
  // its left end and then move it, which is a jump rather than a position.
  useLayoutEffect(() => {
    const node = band.current
    if (node) node.scrollLeft = node.scrollWidth - node.clientWidth - fromRight.current
    // The count and not the contents: the amounts change under a filter without
    // moving anything, and re-running this on every keystroke would fight the
    // thumb of somebody scrolling while the search box still has focus.
  }, [months.length])

  return (
    <div className="flex flex-col gap-1">
      {/* `tabIndex` because a region that scrolls has to be reachable by
          something other than a thumb — with it, the arrow keys move the band,
          and without it the months past the third are keyboard-unreachable.
          `overscroll-x-contain` so that running out of months does not hand the
          gesture to the browser, which on a phone is the back swipe. The
          scrollbar is hidden the way the other sideways rows in this app hide
          it: on a strip three cells wide it is furniture over the numbers. */}
      <div
        ref={band}
        role="group"
        aria-label={T.list.totalsRow}
        tabIndex={0}
        onScroll={event => {
          const node = event.currentTarget
          fromRight.current = node.scrollWidth - node.clientWidth - node.scrollLeft
        }}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain
                   rounded-xl border border-line focus-visible:outline focus-visible:outline-2
                   [-ms-overflow-style:none] [scrollbar-width:none]
                   [&::-webkit-scrollbar]:hidden"
        style={{ background: 'var(--surface)' }}
      >
        {/* Oldest first in the DOM, because the DOM is left to right and so is
            time. `months` comes newest first — the order it is built in and the
            order anything reasoning about it wants — so the one place that
            cares which way round the screen runs is the one that turns it. */}
        {months.map((month, index) => (
          <Cell
            key={month.month}
            label={formatMonthShort(month.month)}
            amount={month.total}
            // The month we are in, which is the number somebody opened this
            // screen to see. It keeps the weight it had when it was the middle
            // of three fixed cells, and it is still in the middle of them.
            strong={index === 0}
          />
        )).reverse()}
        {/* The year names itself rather than saying "Año": the cells beside it
            carry theirs, and a cell labelled only "Año" among dated ones reads
            as a different kind of number. */}
        <Cell label={today.slice(0, 4)} amount={year} last />
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

      {(filtered || since) && (
        <p className="text-[11px] text-ink-3">
          {[filtered ? T.list.filtered : null,
            since ? T.list.countsFrom(formatShortDate(since)) : null]
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
    // A third of the band exactly — see the note on the scroller about why that
    // is a width and not a minimum.
    <div className={'w-1/3 shrink-0 snap-start px-3 py-2'
      + (last ? '' : ' border-r border-line')}>
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
