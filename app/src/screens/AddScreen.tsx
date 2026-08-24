import { useMemo, useState } from 'react'
import { Pills, type Pill } from '../components/Pills'
import { Keypad } from '../components/Keypad'
import { Segmented } from '../components/Segmented'
import { T } from '../i18n/strings'
import { displayTyped, parseAmount } from '../lib/money'
import { todayIso, yesterdayIso } from '../lib/dates'
import type { Ledger } from '../store/ledger'

/**
 * The landing screen, and the only one that has to work one-handed while the
 * other hand is holding a receipt.
 *
 * It is laid out to fit without scrolling rather than to read well as a
 * document, and that is a deliberate reversal. The first version was a single
 * vertical stack of nine blocks of equal weight: the keypad sat below the
 * concept field and two rows of segmented controls, and the save button below
 * the keypad, so on a phone the two most-used controls in the app were off the
 * bottom of the screen. Now the column is the height of the viewport, the
 * keypad takes whatever is left over, and nothing below the amount moves.
 *
 * Everything has a default that is right most of the time: today, and the
 * person holding the phone. The amount is always typed — no control fills it
 * in, because a figure that appears without being typed is a figure nobody
 * checked.
 */
export function AddScreen({ ledger }: { ledger: Ledger }) {
  const data = ledger.data
  const me = data?.config.meIndex ?? -1
  const people = data?.config.people
  // Memoised for their identity, not their cost: `?? []` hands back a new array
  // on every render, and a new array in a dependency list is a useMemo that
  // never gets to remember anything.
  const frequent = useMemo(() => data?.frequent ?? [], [data])
  const suggestions = useMemo(() => data?.suggestions ?? [], [data])

  const [typed, setTyped] = useState('')
  const [concept, setConcept] = useState('')
  const [note, setNote] = useState('')
  const [payer, setPayer] = useState<0 | 1>(me === 1 ? 1 : 0)
  const [date, setDate] = useState(todayIso())
  const [problem, setProblem] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState<string | null>(null)

  // Filtered by who is paying rather than by who is holding the phone: either
  // person can enter the other's expense, and it is the payer's card that
  // belongs in the note.
  const mine = useMemo(
    () => suggestions.filter(item => item.person === null || item.person === payer),
    [suggestions, payer],
  )

  /** Curated concepts first, then whatever the history threw up, deduplicated. */
  const conceptPills = useMemo<Pill[]>(() => {
    const pinned = mine.filter(item => item.kind === 'concept')
    const seen = new Set(pinned.map(item => item.text.toLowerCase()))
    return [
      ...pinned.map(item => ({ key: item.text, label: item.text, pinned: true })),
      ...frequent
        .filter(chip => !seen.has(chip.concept.toLowerCase()))
        .map(chip => ({ key: chip.concept, label: chip.concept })),
    ]
  }, [mine, frequent])

  /**
   * One row for the note, holding the payment methods and then the suggested
   * observations. They share it because column `observaciones` holds a single
   * value: two rows feeding one field would be two controls contradicting each
   * other.
   */
  const notePills = useMemo<Pill[]>(() => {
    const rank = { method: 0, note: 1, concept: 2 }
    return mine
      .filter(item => item.kind === 'method' || item.kind === 'note')
      .sort((a, b) => rank[a.kind] - rank[b.kind])
      .map(item => ({ key: item.text, label: item.text, pinned: true }))
  }, [mine])

  if (!people) return null
  const readOnly = me === -1
  const kind = dateKind(date)

  function pickConcept(key: string) {
    setConcept(key)
    const chip = frequent.find(item => item.concept === key)
    if (chip) setPayer(chip.payer)
  }

  async function save() {
    const amount = parseAmount(typed)
    if (amount <= 0) return setProblem(T.add.needAmount)
    if (!concept.trim()) return setProblem(T.add.needConcept)

    const id = crypto.randomUUID()
    await ledger.addEntry({ id, date, concept: concept.trim(), amount, payer, note })

    setTyped('')
    setConcept('')
    setNote('')
    setDate(todayIso())
    setProblem(null)
    setJustSaved(id)
    // Long enough to catch the "wrong person" reflex, short enough that the
    // banner is gone by the next time the app is opened.
    window.setTimeout(() => setJustSaved(current => (current === id ? null : current)), 6000)
  }

  return (
    <div className="relative flex h-full flex-col justify-between gap-2 p-4">
      <Segmented
        value={kind}
        onChange={next => setDate(next === 'today' ? todayIso() : next === 'yesterday' ? yesterdayIso() : date)}
        options={[
          { label: T.add.today, value: 'today' },
          { label: T.add.yesterday, value: 'yesterday' },
          { label: T.add.otherDate, value: 'other' },
        ]}
        compact
      />

      {kind === 'other' && (
        <input
          type="date"
          value={date}
          max={todayIso()}
          onChange={event => setDate(event.target.value)}
          aria-label={T.add.otherDate}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
      )}

      {/* Nothing here grows, and the spare height is spread between the rows by
          `justify-between` above. Two earlier attempts each gave the slack to
          one element and each looked broken for it: on the keypad it produced
          130px keys with the digits floating inside them, and on the amount it
          produced a 450px hole above a screen that is otherwise dense. Spread
          out, the same slack reads as breathing room, and on a short phone the
          gaps close back down to `gap-2` on their own. */}
      <div className="flex items-center justify-center py-2">
        <output className="tabular font-mono text-6xl font-semibold leading-none tracking-tight">
          {displayTyped(typed)}<span className="pl-1.5 align-baseline text-3xl text-ink-3">€</span>
        </output>
      </div>

      <Segmented
        value={String(payer)}
        onChange={value => setPayer(Number(value) as 0 | 1)}
        options={[
          { label: T.add.pays(people[0].name), value: '0', tone: 'person-1' },
          { label: T.add.pays(people[1].name), value: '1', tone: 'person-2' },
        ]}
      />

      <input
        value={concept}
        onChange={event => setConcept(event.target.value)}
        placeholder={T.add.conceptPlaceholder}
        aria-label={T.add.concept}
        enterKeyHint="done"
        className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink
                   placeholder:text-ink-2 focus-visible:outline focus-visible:outline-2"
      />

      <Pills items={conceptPills} active={concept} onPick={pickConcept} label={T.add.conceptRow} />
      <Pills items={notePills} active={note} onPick={setNote} label={T.add.noteRow} />

      <Keypad value={typed} onChange={setTyped} />

      {problem && (
        <p role="alert" className="text-center text-sm" style={{ color: 'var(--danger)' }}>
          {problem}
        </p>
      )}

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

      {readOnly && <p className="text-center text-xs text-ink-2">{T.auth.noColumn}</p>}

      {/* Floating rather than part of the column: a banner that reflows the
          layout moves the save button out from under a thumb already on its
          way down to it. */}
      {justSaved && (
        <div
          className="absolute inset-x-4 bottom-4 flex items-center justify-between rounded-xl
                     border border-line px-3 py-2.5 text-sm shadow-lg"
          style={{ background: 'var(--surface-2)' }}
        >
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
