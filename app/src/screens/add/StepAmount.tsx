import { useEffect, useRef } from 'react'
import { Keypad } from '../../components/Keypad'
import { Segmented } from '../../components/Segmented'
import { T } from '../../i18n/strings'
import { displayTyped } from '../../lib/money'
import { todayIso, yesterdayIso } from '../../lib/dates'
import type { Draft } from '../../store/draft'
import type { Person } from '../../api/types'

/**
 * Step one: when, how much, and who paid.
 *
 * Who paid is here rather than with the concept because the payment methods on
 * the next screen are filtered by it — a card belongs to whoever holds it, so
 * the payer has to be settled before there is a list to choose from.
 */
export function StepAmount({ draft, people, patch, onNext }: {
  draft: Draft
  people: readonly [Person, Person]
  patch: (fields: Partial<Draft>) => void
  onNext: () => void
}) {
  const kind = dateKind(draft)

  return (
    <>
      <Segmented
        value={kind}
        onChange={next => patch(dateFor(next))}
        options={[
          { label: T.add.today, value: 'today' },
          { label: T.add.yesterday, value: 'yesterday' },
          { label: T.add.otherDate, value: 'other' },
        ]}
        compact
      />

      {kind === 'other' && (
        <DayPicker date={draft.date} onPick={date => patch({ date })} />
      )}

      <div className="flex items-center justify-center py-2">
        <output className="tabular font-mono text-6xl font-semibold leading-none tracking-tight">
          {displayTyped(draft.typed)}<span className="pl-1.5 align-baseline text-3xl text-ink-3">€</span>
        </output>
      </div>

      <Segmented
        value={String(draft.payer)}
        onChange={value => patch({ payer: Number(value) as 0 | 1 })}
        options={[
          { label: T.add.pays(people[0].name), value: '0', tone: 'person-1' },
          { label: T.add.pays(people[1].name), value: '1', tone: 'person-2' },
        ]}
      />

      <Keypad value={draft.typed} onChange={typed => patch({ typed })} />

      <button
        type="button"
        onClick={onNext}
        className="rounded-xl py-3.5 text-base font-bold focus-visible:outline focus-visible:outline-2"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        {T.add.next}
      </button>
    </>
  )
}

/**
 * The day, chosen by hand.
 *
 * It opens its own picker on arrival. Reaching it already costs a tap on "Otra
 * fecha", and a native date field that has to be tapped a second time to show a
 * calendar is the one control on this screen nobody would find on purpose.
 * `showPicker` throws where it is unsupported or outside a gesture, and a field
 * that can still be tapped is a fine outcome, so the failure is ignored.
 */
function DayPicker({ date, onPick }: { date: string; onPick: (date: string) => void }) {
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      field.current?.showPicker()
    } catch {
      // Tapping the field still works.
    }
  }, [])

  return (
    <input
      ref={field}
      type="date"
      value={date}
      max={todayIso()}
      onChange={event => onPick(event.target.value)}
      aria-label={T.add.otherDate}
      className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
    />
  )
}

/** Which segment is lit. `pickDate` first: a hand-picked today is still a
 *  hand-picked day, and the picker has to stay on screen. */
function dateKind(draft: Draft): 'today' | 'yesterday' | 'other' {
  if (draft.pickDate) return 'other'
  if (draft.date === todayIso()) return 'today'
  if (draft.date === yesterdayIso()) return 'yesterday'
  return 'other'
}

/** Choosing a segment sets the day, except for the one whose whole purpose is
 *  to leave the day to the user. */
function dateFor(kind: string): Partial<Draft> {
  if (kind === 'today') return { date: todayIso(), pickDate: false }
  if (kind === 'yesterday') return { date: yesterdayIso(), pickDate: false }
  return { pickDate: true }
}
