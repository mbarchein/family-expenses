import { useMemo, useState } from 'react'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { CategoryFilter } from '../components/CategoryField'
import { ClearButton } from '../components/ClearButton'
import { Icon } from '../components/Icon'
import { Segmented } from '../components/Segmented'
import { Totals } from '../components/Totals'
import { ScreenHeader } from '../components/ScreenHeader'
import { T } from '../i18n/strings'
import { formatDayHeading, formatShortDate, todayIso } from '../lib/dates'
import { iconOf } from '../lib/categories'
import { knownConcepts } from '../lib/concepts'
import { formatEur } from '../lib/money'
import { NO_FILTERS, isFiltered, isNarrowed, matches, type Filters } from '../lib/search'
import { earliestDay, matchedTotal, monthlyTotals, yearTotal } from '../lib/totals'
import type { Category } from '../api/types'
import { useIconChoices } from '../store/iconChoices'
import type { Ledger, ShownEntry } from '../store/ledger'
import { EditSheet } from './EditSheet'

export function ListScreen({ ledger, onBack, editing, onOpen, onCloseEditor }: {
  ledger: Ledger
  onBack: () => void
  /** From the address: the id of the entry whose sheet is open, or ''. State
   *  before, which left the back button nothing to close. */
  editing: string
  onOpen: (detail: string) => void
  onCloseEditor: () => void
}) {
  const people = ledger.data?.config.people
  // The same icons the keypad shows, corrections included: a concept that was
  // given a basket by hand on the way in is the same concept on the way out, and
  // two screens disagreeing about what something looks like is worse than
  // neither of them showing it.
  const { chosen } = useIconChoices()
  const categories = ledger.data?.categories ?? []
  /**
   * Everything narrowing the list, in one object.
   *
   * Four `useState`s before, which was fine for four and is not for seven: the
   * advanced search sets two of them at a time and clears four at once, and a
   * screen that spells out which ones each control touches is a screen where one
   * of them eventually gets left behind. See `lib/search.ts`.
   */
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const narrow = (fields: Partial<Filters>) =>
    setFilters(current => ({ ...current, ...fields }))
  /** Whether the dialog is up. Not an address, like the category picker it sits
   *  beside and unlike the edit sheet: it is a control on this screen rather
   *  than a thing with its own identity. Back still closes it. */
  const [advanced, setAdvanced] = useState(false)

  // Filtered once, used three times: the list, the day totals and the band must
  // agree about what is on screen, and three copies of seven conditions is three
  // chances for them to stop agreeing.
  const shown = useMemo(
    () => ledger.entries.filter(entry => matches(entry, filters)),
    [ledger.entries, filters],
  )
  const days = useMemo(() => groupByDay(shown), [shown])
  const today = todayIso()
  // A cell per month, back as far as the loaded entries go — the band scrolls,
  // so the two it used to have room for are no longer the limit.
  const months = useMemo(() => monthlyTotals(shown, today), [shown, today])
  const year = useMemo(() => yearTotal(shown, today), [shown, today])
  const filtered = isFiltered(filters)
  // Only while something is filtered: unfiltered, "everything that matches" is
  // everything the app happens to have loaded, which is a number about the window
  // rather than about the household.
  const matched = useMemo(
    () => (filtered ? matchedTotal(shown) : null), [filtered, shown])

  // The vocabulary the edit sheet offers under its concept box. Built from the
  // whole ledger rather than from what the filter leaves standing: correcting a
  // row is not a search.
  const concepts = useMemo(
    () => knownConcepts(
      ledger.data?.frequent ?? [], ledger.entries, ledger.data?.suggestions ?? []),
    [ledger.data?.frequent, ledger.entries, ledger.data?.suggestions],
  )

  // Coverage is a property of the window the app loaded, not of the filter, so
  // it is measured over everything rather than over what is on screen.
  const from = useMemo(() => earliestDay(ledger.entries), [ledger.entries])

  // From the address, so the back button and the sheet's Cancelar are the same
  // gesture. An id that is not in the window — a link to an old row, or one
  // voided on the other phone — shows the list rather than an empty sheet.
  const open = editing ? ledger.entries.find(entry => entry.id === editing) ?? null : null

  if (!people) return null

  return (
    <div className="flex flex-col gap-3 p-4">
      <ScreenHeader title={T.tabs.list} onBack={onBack} />

      <Segmented
        value={filters.payer}
        onChange={payer => narrow({ payer })}
        options={[
          { label: T.list.both, value: 'all' },
          { label: people[0].name, value: '0', tone: 'person-1' },
          { label: people[1].name, value: '1', tone: 'person-2' },
        ]}
      />

      <div className="flex gap-2">
        {/* The cross lives inside the field — see `ClearButton`, which is also
            what the concept box on the second step uses. */}
        <div className="relative min-w-0 flex-1">
          <input
            value={filters.query}
            onChange={event => narrow({ query: event.target.value })}
            placeholder={T.list.search}
            aria-label={T.list.search}
            type="search"
            className="w-full rounded-lg border border-line bg-surface py-2.5 pl-3 pr-11 text-sm
                       text-ink placeholder:text-ink-3 focus-visible:outline focus-visible:outline-2
                       [&::-webkit-search-cancel-button]:appearance-none"
          />
          {filters.query && (
            <ClearButton label={T.list.clearSearch} onClick={() => narrow({ query: '' })} />
          )}
        </div>

        {/* Beside the box, where the category filter already puts its second
            control. It wears the accent when it is holding something: a range
            folded behind a dialog is the one filter on this screen that cannot
            be seen from the screen, and an invisible filter is how somebody
            concludes the app has lost their gastos. */}
        <button
          type="button"
          onClick={() => setAdvanced(true)}
          aria-label={isNarrowed(filters) ? T.list.advancedOn : T.list.advanced}
          aria-pressed={isNarrowed(filters)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border
                     focus-visible:outline focus-visible:outline-2"
          style={isNarrowed(filters)
            ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-ink)' }
            : { background: 'var(--surface)', borderColor: 'var(--line)', color: 'var(--ink-2)' }}
        >
          <SlidersIcon />
        </button>
      </div>

      <CategoryFilter
        value={filters.category}
        categories={categories}
        onChange={category => narrow({ category })}
      />

      <Totals
        months={months}
        year={year}
        today={today}
        filtered={filtered}
        matched={matched}
        since={from}
      />

      {!days.length && (
        <p className="py-8 text-center text-sm text-ink-3">
          {!ledger.entries.length ? T.list.empty
            : filters.query.trim() || filters.category === null ? T.list.noResults
            : T.list.noResultsCategory}
        </p>
      )}

      {days.map(day => (
        <section
          key={day.date}
          /* The list is one day per section and every row it is given is in the
             DOM — which is what lets the browser's own find-in-page work, and
             what stopped being free when the window grew to reach last January.
             `content-visibility: auto` is the fix and it is a property rather
             than a library: the browser skips style, layout and paint for a
             section that is off screen, which is the expensive part, and does it
             with rows of any height. `contain-intrinsic-size` is the promise it
             needs in exchange — an estimate of the height it is skipping, so the
             scrollbar does not lurch as sections are measured for real. `auto`
             means the real height replaces the estimate once it is known.

             Where it is unsupported the declaration is ignored and the list
             behaves exactly as it did before: slower, never wrong. */
          style={{
            contentVisibility: 'auto',
            containIntrinsicSize: `auto ${24 + day.entries.length * 47}px`,
          }}
        >
          <h2 className="mt-2 text-[11px] font-bold uppercase tracking-wider text-ink-3">
            {formatDayHeading(day.date)} · {formatEur(day.total)}
          </h2>
          <ul>
            {day.entries.map(entry => (
              <li key={entry.id || `row:${entry.row}`}>
                <button
                  type="button"
                  onClick={() => (entry.id ? onOpen(entry.id) : void ledger.claimRow(entry.row))}
                  className="flex w-full items-center gap-2.5 border-b border-line py-2 text-left
                             focus-visible:outline focus-visible:outline-2"
                >
                  <RowIcon entry={entry} categories={categories} chosen={chosen} />
                  <span className="min-w-0 flex-1">
                    {/* A row and not a block, so the badge keeps its width and
                        the concept is what gets truncated. The other way round
                        the mark disappeared exactly on the long concepts. */}
                    <span className="flex items-center gap-1.5">
                      <span
                        className="truncate text-sm"
                        style={entry.voided ? { textDecoration: 'line-through', color: 'var(--ink-3)' } : undefined}
                      >
                        {entry.concept}
                      </span>
                      {entry.pending && <UnsavedBadge />}
                    </span>
                    {/* Who paid and when, on one grey line. The day heading
                        above says the same date, and that is not a reason to
                        leave it off a row: rows are read one at a time, get
                        screenshotted one at a time, and are searched for across
                        a window that now spans two years. */}
                    <span className="block truncate text-[11px] text-ink-3">
                      {entry.voided
                        ? T.list.voided
                        : entry.id
                          ? people[entry.payer ?? 0].name
                          : T.list.legacy}
                      {entry.id && <> · {formatShortDate(entry.date)}</>}
                      {/* Last, and truncated first if the row runs out of
                          room: an observación is worth showing — it is where
                          "efectivo" or "lo pongo yo y luego me lo pasas" lives
                          — and it is the part of the line you can afford to
                          lose. */}
                      {entry.note && <> · {entry.note}</>}
                    </span>
                  </span>
                  <span className="font-mono text-sm tabular">{formatEur(entry.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {advanced && (
        <AdvancedSearch
          filters={filters}
          onChange={narrow}
          onClose={() => setAdvanced(false)}
        />
      )}

      {open && (
        <EditSheet
          key={open.id}
          entry={open}
          people={people}
          categories={categories}
          concepts={concepts}
          suggestions={ledger.data?.suggestions ?? []}
          entries={ledger.entries}
          onClose={onCloseEditor}
          onSave={async entry => { await ledger.editEntry(entry); onCloseEditor() }}
          onVoid={async id => { await ledger.voidEntry(id); onCloseEditor() }}
        />
      )}
    </div>
  )
}

/** Three sliders, the shape every app uses for "there are more filters than
 *  fit here". It is a button with no word on it, so the word is its label. */
function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-5 w-5"
         fill="none" stroke="currentColor" strokeWidth={2}
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h10M18 7h2M4 12h4M12 12h8M4 17h10M18 17h2" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="16" cy="17" r="2" />
    </svg>
  )
}

/**
 * The mark on a row that has not reached the sheet yet.
 *
 * The strip above the tab bar says something is going up. This says which one —
 * the question worth answering when the list has thirty rows on it and the one
 * just typed is somewhere among them.
 */
function UnsavedBadge() {
  return (
    <span
      className="flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[10px]
                 font-semibold"
      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-3 w-3"
           fill="none" stroke="currentColor" strokeWidth={2.5}
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V7M7 12l5-5 5 5" />
      </svg>
      {T.list.unsaved}
    </span>
  )
}

/**
 * One slot at the head of the row, doing two jobs.
 *
 * The colour is who paid, which is what the dot in this position has always
 * said. The shape is what the expense was, which is new — and the reason the
 * slot is 24px wide rather than 8. Where there is no icon the dot is what is
 * left: `iconFor` answers nothing rather than something approximate, because a
 * guess that misses is a small lie printed on every row of somebody's history.
 */
function RowIcon({ entry, categories, chosen }: {
  entry: ShownEntry
  categories: readonly Category[]
  chosen: Record<string, string>
}) {
  const icon = iconOf(entry, categories, chosen)
  const colour = entry.voided
    ? 'var(--ink-3)'
    : entry.payer === 0 ? 'var(--person-1)' : 'var(--person-2)'

  return (
    <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center" style={{ color: colour }}>
      {icon
        ? <Icon name={icon} className="h-[22px] w-[22px]" />
        : <span className="h-2 w-2 rounded-full bg-current" />}
    </span>
  )
}

interface Day { date: string; total: number; entries: ShownEntry[] }

/**
 * Groups into days, newest first.
 *
 * Voided entries stay in the list — struck through — instead of disappearing.
 * They are still rows in the spreadsheet, and hiding them here would leave the
 * app and the sheet telling different stories. They contribute nothing to the
 * day's total, because their amounts are gone.
 */
function groupByDay(entries: ShownEntry[]): Day[] {
  const days = new Map<string, Day>()

  for (const entry of entries) {
    const day = days.get(entry.date) ?? { date: entry.date, total: 0, entries: [] }
    day.entries.push(entry)
    if (!entry.voided) day.total += entry.amount
    days.set(entry.date, day)
  }

  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
}
