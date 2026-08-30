import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { CategoryField } from '../components/CategoryField'
import { ConceptField } from '../components/ConceptField'
import { MethodField } from '../components/MethodField'
import { Segmented } from '../components/Segmented'
import { T } from '../i18n/strings'
import { categoryFor } from '../lib/categories'
import { todayIso } from '../lib/dates'
import { parseAmount, typedFrom, typedFromAmount } from '../lib/money'
import type { Category, Entry, Person, Suggestion } from '../api/types'
import { useAvatars } from '../store/avatars'
import type { QueuedEntry } from '../store/queue'

export function EditSheet({
  entry, people, categories, concepts, suggestions, entries, onClose, onSave, onVoid,
}: {
  entry: Entry
  people: [Person, Person]
  categories: readonly Category[]
  /** The vocabulary the sheet already has, for the concept box's own list. This
   *  screen had a bare input: the one place in the app that knew a word and did
   *  not offer it. */
  concepts: readonly string[]
  /** The Sugerencias tab, for the cards on the method row. */
  suggestions: readonly Suggestion[]
  /** The ledger, for the category guess when the concept is replaced. */
  entries: readonly Entry[]
  onClose: () => void
  onSave: (entry: QueuedEntry) => Promise<void>
  onVoid: (id: string) => Promise<void>
}) {
  // Two decimals from the start, the way money is written and the way the big
  // display used to render it. Merging that display into this field made the raw
  // number visible for the first time: 43.5 arrived on screen as `43,5`.
  const [typed, setTyped] = useState(typedFromAmount(entry.amount))
  const [concept, setConcept] = useState(entry.concept)
  const [payer, setPayer] = useState<0 | 1>(entry.payer ?? 0)
  const [date, setDate] = useState(entry.date)
  const [note, setNote] = useState(entry.note)
  const [method, setMethod] = useState(entry.method)
  const [category, setCategory] = useState(entry.category)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  /**
   * A row whose amount is below zero: money that came back rather than went out.
   *
   * They exist on the sheet — a refund, or one of the two of them putting money
   * in — and this screen cannot write one: the keypad has no sign and
   * `typedFromAmount` answers '' for anything not above zero, so the field opened
   * empty and Guardar did nothing, silently, for ever. Saying so is not support
   * for negative amounts; it is the difference between a limit and a broken
   * screen.
   */
  const negative = entry.amount < 0
  const titleId = useId()

  /**
   * The category, re-guessed only when the concept is *replaced*.
   *
   * The rule the second step follows, and the caveat this screen always had is
   * still honoured: opening the sheet refiles nothing. The row arrives with a
   * category — possibly one typed into the spreadsheet by hand — and the ref
   * starts at the concept it arrived with, so nothing is guessed until somebody
   * changes the word. After that the derivation is what it is everywhere else: a
   * category describes a concept, and replacing the concept invalidates it.
   */
  const guessedFor = useRef(entry.concept.trim())
  useEffect(() => {
    const named = concept.trim()
    if (guessedFor.current === named) return
    guessedFor.current = named
    const guess = categoryFor(named, categories, entries)
    setCategory(current => (guess === current ? current : guess))
  }, [concept, categories, entries])
  const { faces } = useAvatars()

  /**
   * Caret at the end of the amount, on focus.
   *
   * Correcting an amount means deleting the one that is there, and a tap put the
   * caret wherever the finger landed — so the way to fix 43,50 was to tap, drag
   * the caret to the end, and only then start pressing backspace.
   *
   * On three events, and not on a timer. Focus alone is not enough: the browser
   * positions the caret from the tap *after* focus fires, so anything set there
   * is immediately undone. Deferring by a frame instead only moved the problem —
   * it left a window in which the caret was still wherever the tap had put it,
   * and CI found a backspace landing inside the number rather than at its end.
   *
   * `pointerup` and `click` are the moments after the browser has had its say, so
   * setting it there is deterministic rather than a race. All three are the same
   * idempotent call, and `focus` is the one that covers arriving here by keyboard.
   */
  function toEnd(event: SyntheticEvent<HTMLInputElement>) {
    const field = event.currentTarget
    const end = field.value.length
    field.setSelectionRange(end, end)
  }

  async function save() {
    const amount = parseAmount(typed)
    // Said out loud. This used to `return` on both counts, so the button did
    // nothing whatsoever and there was no way to find out why — and one of the
    // two ways to reach it is a row the app itself could not fill in.
    if (amount <= 0) return setProblem(T.edit.needAmount)
    if (!concept.trim()) return setProblem(T.edit.needConcept)
    setProblem(null)
    setBusy(true)
    await onSave({
      id: entry.id, date, concept: concept.trim(), amount, payer, note,
      category, method,
    })
  }

  async function remove() {
    if (!window.confirm(T.edit.voidConfirm)) return
    setBusy(true)
    await onVoid(entry.id)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-10 flex items-end bg-black/40"
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4"
           style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          {/* The title moved into the space the cancel link left behind, and it
              is what names the dialog now — one name rather than a visible one
              and a different invisible one. */}
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-semibold">{T.edit.title}</h2>
            {/* Up here with the title rather than alone at the foot of the
                sheet: it is what this screen is about — that row and no other —
                and it was costing a line of its own to say so. */}
            <p className="text-[11px] text-ink-3">
              {entry.row ? T.edit.row(entry.row) : T.sync.pending(1)}
            </p>
          </div>
          {/* Outlined rather than filled: this is the one control here that
              cannot be undone, so it has to look like a button without looking
              like the thing to press. */}
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="shrink-0 rounded-full border px-4 py-2 text-sm font-semibold
                       disabled:opacity-40"
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
          >
            {T.list.void}
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* The day and the amount on one line, in that order, because that is
              the order the keypad asks for them in — and because neither needs a
              whole line of a phone to itself. The amount keeps the big mono
              digits it has on the keypad: it is the number that must not be
              wrong, and this is the screen for fixing it.

              One field where there used to be two. A read-only display over an
              input showed the same number twice, and on a screen with a keyboard
              the input can be the display. */}
          {/* The date takes only what a date needs and the amount takes the
              rest. It was the other way round, which gave eight characters of
              dd/mm/yyyy the whole width and the number that must not be wrong a
              six-digit box. */}
          <div className="flex items-stretch gap-2">
            <input
              type="date"
              value={date}
              max={todayIso()}
              onChange={event => setDate(event.target.value)}
              aria-label={T.add.fieldDate}
              className="w-36 shrink-0 rounded-lg border border-line bg-surface px-2.5 py-2.5
                         text-sm"
            />
            <div className="flex min-w-0 flex-1 items-center gap-1 rounded-lg border
                            border-line bg-surface px-3">
              <input
                inputMode="decimal"
                value={typed}
                onChange={event => setTyped(typedFrom(event.target.value))}
                onFocus={toEnd}
                onPointerUp={toEnd}
                onClick={toEnd}
                aria-label={T.add.fieldAmount}
                className="min-w-0 flex-1 bg-transparent text-right font-mono text-xl
                           font-semibold tabular outline-none"
              />
              <span aria-hidden="true" className="text-sm text-ink-3">€</span>
            </div>
          </div>

          <Segmented
            value={String(payer)}
            onChange={value => setPayer(Number(value) as 0 | 1)}
            options={[
              {
                // The name alone, with "Paga" left to the accessible name: the
                // row is under a heading that already asks the question, and the
                // word was taking the space the face wanted.
                label: people[0].name, ariaLabel: T.add.pays(people[0].name),
                value: '0', tone: 'person-1',
                icon: <Avatar name={faces[0]} className="h-10 w-10" />,
              },
              {
                label: people[1].name, ariaLabel: T.add.pays(people[1].name),
                value: '1', tone: 'person-2',
                icon: <Avatar name={faces[1]} className="h-10 w-10" />,
              },
            ]}
            stack
          />

          <ConceptField value={concept} concepts={concepts} onChange={setConcept} />

          {/* Under the concept, because it is about the concept. Never re-guessed
              here: this row already has a category — possibly one somebody typed
              into the sheet by hand — and an edit screen that quietly refiles
              what it was opened to fix is worse than one that shows nothing. */}
          <CategoryField value={category} categories={categories} onChange={setCategory} />

          {/* Its own field, because it is its own column — and the cards as well
              as the box now. The box has to stay: this screen must be able to
              show a method that is not on the Sugerencias tab, an old row's or
              one typed on the other phone. What was wrong was making that a
              reason to leave out the four cards the app has written down, so
              correcting a row to «Tarjeta BBVA» meant typing all twelve
              characters. */}
          <MethodField
            suggestions={suggestions}
            payer={payer}
            value={method}
            onChange={setMethod}
          />

          <input
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder={T.add.notePlaceholder}
            aria-label={T.add.fieldNote}
            className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm
                       placeholder:text-ink-3"
          />

          {/* Cancel next to save, at the size of a button and not a link in the
              corner. Saving is twice the width: they are both ways out of this
              screen, and only one of them is the one being looked for. */}
          {/* Above the buttons, where the answer to "why did nothing happen" has
              to be. The negative note is shown from the moment the sheet opens,
              because that one is not something the person did. */}
          {(negative || problem) && (
            <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
              {negative ? T.edit.negative : problem}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-xl border border-line py-3.5 font-semibold
                         text-ink-2 disabled:opacity-40"
            >
              {T.edit.cancel}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy || negative}
              className="flex-[2] rounded-xl py-3.5 font-bold disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              {T.edit.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
