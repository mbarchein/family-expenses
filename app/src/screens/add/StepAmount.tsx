import { useRef, useState } from 'react'
import { Keypad } from '../../components/Keypad'
import { Segmented } from '../../components/Segmented'
import { T } from '../../i18n/strings'
import { displayTyped } from '../../lib/money'
import { formatDayShort, todayIso, yesterdayIso } from '../../lib/dates'
import type { Draft } from '../../store/draft'
import type { Person } from '../../api/types'

/**
 * Step one: when, how much, and who paid.
 *
 * Who paid is here rather than with the concept because the payment methods on
 * the next screen are filtered by it — a card belongs to whoever holds it, so
 * the payer has to be settled before there is a list to choose from.
 *
 * The third day segment is both the button and the answer: it says "Otra fecha"
 * until a day is chosen and then wears the day itself. Tapping it opens the
 * device's own calendar straight away — the field it opens is not on the screen
 * at all. There was one, and it was a second control saying what the segment
 * beside it already said, plus a tap to get at it.
 */
export function StepAmount({ draft, people, patch, onNext }: {
  draft: Draft
  people: readonly [Person, Person]
  patch: (fields: Partial<Draft>) => void
  onNext: () => void
}) {
  const kind = dateKind(draft)
  const day = useRef<HTMLInputElement>(null)
  // Only for a browser whose date field cannot open itself. See `openCalendar`.
  const [showField, setShowField] = useState(false)

  /**
   * Open the device's calendar on the hidden field.
   *
   * `showPicker` needs the field to be rendered, which is why it is clipped out
   * of sight rather than removed, and it needs a user gesture, which a tap on
   * the segment is. Where it throws — an older browser, or a gesture the browser
   * did not count — the field is shown instead: worse, but a day can still be
   * chosen, and a control that quietly does nothing is the one outcome that
   * cannot be allowed here.
   */
  function openCalendar() {
    try {
      day.current?.showPicker()
    } catch {
      setShowField(true)
      day.current?.focus()
    }
  }

  return (
    <>
      <Segmented
        value={kind}
        onChange={next => {
          patch(dateFor(next))
          if (next === 'other') openCalendar()
          else setShowField(false)
        }}
        options={[
          { label: T.add.today, value: 'today' },
          { label: T.add.yesterday, value: 'yesterday' },
          {
            // The label is the chosen day once there is one, so the answer is on
            // the control that asked. Tapping it again reopens the calendar,
            // which is how a day gets changed.
            label: kind === 'other' ? formatDayShort(draft.date) : T.add.otherDate,
            value: 'other',
            ariaLabel: T.add.otherDate,
          },
        ]}
        compact
      />

      <input
        ref={day}
        type="date"
        value={draft.date}
        max={todayIso()}
        onChange={event => event.target.value && patch({ date: event.target.value })}
        aria-label={T.add.fieldDate}
        // Clipped rather than hidden: `display: none` would make `showPicker`
        // throw, and then every tap would fall through to the visible field.
        className={showField
          ? 'rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink'
          : 'pointer-events-none absolute h-px w-px opacity-0'}
      />

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
