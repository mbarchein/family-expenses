import { useMemo, useState } from 'react'
import { Segmented } from '../components/Segmented'
import { T } from '../i18n/strings'
import { formatDayHeading } from '../lib/dates'
import { formatEur } from '../lib/money'
import type { Entry } from '../api/types'
import type { Ledger } from '../store/ledger'
import { EditSheet } from './EditSheet'

export function ListScreen({ ledger }: { ledger: Ledger }) {
  const people = ledger.data?.config.people
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Entry | null>(null)

  const days = useMemo(() => groupByDay(ledger.entries, filter, query), [ledger.entries, filter, query])

  if (!people) return null

  return (
    <div className="flex flex-col gap-3 p-4">
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

      {!days.length && (
        <p className="py-8 text-center text-sm text-ink-3">
          {ledger.entries.length ? T.list.noResults : T.list.empty}
        </p>
      )}

      {days.map(day => (
        <section key={day.date}>
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
                    <span className="block text-[11px] text-ink-3">
                      {entry.voided
                        ? T.list.voided
                        : entry.id
                          ? people[entry.payer ?? 0].name
                          : T.list.legacy}
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

/**
 * Groups into days, newest first.
 *
 * Voided entries stay in the list — struck through — instead of disappearing.
 * They are still rows in the spreadsheet, and hiding them here would leave the
 * app and the sheet telling different stories. They contribute nothing to the
 * day's total, because their amounts are gone.
 */
function groupByDay(entries: Entry[], filter: string, query: string): Day[] {
  const needle = query.trim().toLowerCase()
  const days = new Map<string, Day>()

  for (const entry of entries) {
    if (filter !== 'all' && entry.payer !== Number(filter)) continue
    if (needle && !entry.concept.toLowerCase().includes(needle)) continue

    const day = days.get(entry.date) ?? { date: entry.date, total: 0, entries: [] }
    day.entries.push(entry)
    if (!entry.voided) day.total += entry.amount
    days.set(entry.date, day)
  }

  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date))
}
