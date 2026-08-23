import { useState } from 'react'
import { Chips, type Chip } from '../components/Chips'
import { Keypad } from '../components/Keypad'
import { Segmented } from '../components/Segmented'
import { T } from '../i18n/strings'
import { displayTyped, parseAmount } from '../lib/money'
import { todayIso, yesterdayIso } from '../lib/dates'
import type { Ledger } from '../store/ledger'

/**
 * The landing screen.
 *
 * Everything here has a default that is right most of the time: today, the
 * person holding the phone, and — once a chip is tapped — the amount and payer
 * that concept usually carries. Typing an amount and tapping a chip is a
 * complete expense; the rest of the controls exist for the minority of entries
 * that need them.
 */
export function AddScreen({ ledger }: { ledger: Ledger }) {
  const me = ledger.data?.config.meIndex ?? -1
  const people = ledger.data?.config.people

  const [typed, setTyped] = useState('')
  const [concept, setConcept] = useState('')
  const [payer, setPayer] = useState<0 | 1>(me === 1 ? 1 : 0)
  const [date, setDate] = useState(todayIso())
  const [problem, setProblem] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState<string | null>(null)

  if (!people) return null
  const readOnly = me === -1

  function pickChip(chip: Chip) {
    setConcept(chip.concept)
    setPayer(chip.payer)
    if (!typed && chip.amount > 0) setTyped(String(chip.amount).replace('.', ','))
  }

  async function save() {
    const amount = parseAmount(typed)
    if (amount <= 0) return setProblem(T.add.needAmount)
    if (!concept.trim()) return setProblem(T.add.needConcept)

    const id = crypto.randomUUID()
    await ledger.addEntry({ id, date, concept: concept.trim(), amount, payer, note: '' })

    setTyped('')
    setConcept('')
    setDate(todayIso())
    setProblem(null)
    setJustSaved(id)
    // Long enough to catch the "wrong person" reflex, short enough that the
    // banner is gone by the next time the app is opened.
    window.setTimeout(() => setJustSaved(current => (current === id ? null : current)), 6000)
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <output className="py-1 text-center font-mono text-5xl font-semibold tabular tracking-tight">
        <span className="text-2xl text-ink-3">€ </span>{displayTyped(typed)}
      </output>

      <Chips chips={ledger.data?.frequent ?? []} active={concept} onPick={pickChip} />

      <input
        value={concept}
        onChange={event => setConcept(event.target.value)}
        placeholder={T.add.conceptPlaceholder}
        aria-label={T.add.concept}
        enterKeyHint="done"
        className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink
                   placeholder:text-ink-3 focus-visible:outline focus-visible:outline-2"
      />

      <Segmented
        value={String(payer)}
        onChange={value => setPayer(Number(value) as 0 | 1)}
        options={[
          { label: T.add.pays(people[0].name), value: '0', tone: 'person-1' },
          { label: T.add.pays(people[1].name), value: '1', tone: 'person-2' },
        ]}
      />

      <Segmented
        value={dateKind(date)}
        onChange={kind => setDate(kind === 'today' ? todayIso() : kind === 'yesterday' ? yesterdayIso() : date)}
        options={[
          { label: T.add.today, value: 'today' },
          { label: T.add.yesterday, value: 'yesterday' },
          { label: T.add.otherDate, value: 'other' },
        ]}
      />

      {dateKind(date) === 'other' && (
        <input
          type="date"
          value={date}
          max={todayIso()}
          onChange={event => setDate(event.target.value)}
          aria-label={T.add.otherDate}
          className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink"
        />
      )}

      <Keypad value={typed} onChange={setTyped} />

      {problem && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>{problem}</p>}

      <button
        type="button"
        onClick={save}
        disabled={readOnly}
        className="rounded-xl py-3.5 text-base font-bold disabled:opacity-40
                   focus-visible:outline focus-visible:outline-2"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        {T.add.save}
      </button>

      {readOnly && <p className="text-center text-sm text-ink-2">{T.auth.noColumn}</p>}

      {justSaved && (
        <div className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <span>{T.add.savedUndo}</span>
          <button
            type="button"
            className="font-semibold"
            style={{ color: 'var(--accent)' }}
            onClick={() => { void ledger.voidEntry(justSaved); setJustSaved(null) }}
          >
            {T.add.undo}
          </button>
        </div>
      )}
    </div>
  )
}

function dateKind(date: string): 'today' | 'yesterday' | 'other' {
  if (date === todayIso()) return 'today'
  if (date === yesterdayIso()) return 'yesterday'
  return 'other'
}
