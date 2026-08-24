import { useMemo, useState } from 'react'
import { Segmented } from '../components/Segmented'
import { Totals } from '../components/Totals'
import { ScreenHeader } from '../components/ScreenHeader'
import { T } from '../i18n/strings'
import { formatDayHeading, formatShortDate, todayIso } from '../lib/dates'
import { formatEur } from '../lib/money'
import { earliestDay, summarise, yearIsPartial } from '../lib/totals'
import type { Entry } from '../api/types'
import type { Ledger } from '../store/ledger'
import { EditSheet } from './EditSheet'

export function ListScreen({ ledger, onBack }: { ledger: Ledger; onBack: () => void }) {
  const people = ledger.data?.config.people
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Entry | null>(null)

  // Filtered once, used three times: the list, the day totals and the strip must
  // agree about what is on screen, and three copies of the same two conditions
  // is three chances for them to stop agreeing.
  const shown = useMemo(() => matching(ledger.entries, filter, query), [ledger.entries, filter, query])
  const days = useMemo(() => groupByDay(shown), [shown])
  const today = todayIso()
  const sums = useMemo(() => summarise(shown, today), [shown, today])

  // Coverage is a property of the window the app loaded, not of the filter, so
  // it is measured over everything rather than over what is on screen.
  const from = useMemo(() => earliestDay(ledger.entries), [ledger.entries])

  if (!people) return null

  return (
    <div className="flex flex-col gap-3 p-4">
      <ScreenHeader title={T.tabs.list} onBack={onBack} />

      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { label: T.list.both, value: 'all' },
          { label: people[0].name, value: '0', tone: 'person-1' },
          { label: people[1].name, value: '1', tone: 'person-2' },
        ]}
      />

      <input
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder={T.list.search}
        aria-label={T.list.search}
        type="search"
        className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink
                   placeholder:text-ink-3 focus-visible:outline focus-visible:outline-2"
      />

      <Totals
        sums={sums}
        today={today}
        filtered={filter !== 'all' || Boolean(query.trim())}
        partialSince={yearIsPartial(from, today) ? formatShortDate(from!) : null}
      />

      {!days.length && (
        <p className="py-8 text-center text-sm text-ink-3">
          {ledger.entries.length ? T.list.noResults : T.list.empty}
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
                  onClick={() => (entry.id ? setEditing(entry) : void ledger.claimRow(entry.row))}
                  className="flex w-full items-center gap-2.5 border-b border-line py-2 text-left
                             focus-visible:outline focus-visible:outline-2"
                >
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: entry.payer === 0 ? 'var(--person-1)' : 'var(--person-2)' }}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-sm"
                      style={entry.voided ? { textDecoration: 'line-through', color: 'var(--ink-3)' } : undefined}
                    >
                      {entry.concept}
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
                    </span>
                  </span>
                  <span className="font-mono text-sm tabular">{formatEur(entry.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && (
        <EditSheet
          entry={editing}
          people={people}
          onClose={() => setEditing(null)}
          onSave={async entry => { await ledger.editEntry(entry); setEditing(null) }}
          onVoid={async id => { await ledger.voidEntry(id); setEditing(null) }}
        />
      )}
    </div>
  )
}

interface Day { date: string; total: number; entries: Entry[] }

/** The entries a person filter and a search leave standing. */
function matching(entries: Entry[], filter: string, query: string): Entry[] {
  const needle = query.trim().toLowerCase()
  return entries.filter(entry =>
    (filter === 'all' || entry.payer === Number(filter)) &&
    (!needle || entry.concept.toLowerCase().includes(needle)))
}

/**
 * Groups into days, newest first.
 *
 * Voided entries stay in the list — struck through — instead of disappearing.
 * They are still rows in the spreadsheet, and hiding them here would leave the
 * app and the sheet telling different stories. They contribute nothing to the
 * day's total, because their amounts are gone.
 */
function groupByDay(entries: Entry[]): Day[] {
  const days = new Map<string, Day>()

  for (const entry of entries) {
    const day = days.get(entry.date) ?? { date: entry.date, total: 0, entries: [] }
    day.entries.push(entry)
    if (!entry.voided) day.total += entry.amount
    days.set(entry.date, day)
  }

  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
}
