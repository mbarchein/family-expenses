import { useId } from 'react'
import { ClearButton } from './ClearButton'
import { T } from '../i18n/strings'

/**
 * The concept, with the vocabulary the ledger already has behind it.
 *
 * A native `datalist` rather than the grid of tiles the keypad uses. The grid is
 * a fast path for the screen that is walked through twenty times a week with a
 * queue behind you; these two screens — editing a gasto, writing a fijo — are
 * opened once and deliberately, and what they need is not speed but the spelling
 * that is already in the sheet. Typing `alq` and picking `alquiler` is what stops
 * a ledger growing a 721st distinct concept that differs from the 720th by a
 * capital letter.
 *
 * Shared by both because they were drifting apart: the fijos editor had this and
 * the edit sheet had a bare box, so correcting a concept on a row was the one
 * place in the app where the app knew a word and did not offer it.
 */
export function ConceptField({ value, concepts, onChange, placeholder, autoFocus }: {
  value: string
  /** What to offer, in the order it should be offered. Deduplication is the
   *  caller's: it knows which lists it is joining. */
  concepts: readonly string[]
  onChange: (concept: string) => void
  /** Only where the box can be empty on purpose — the new-place form. The two
   *  editing screens open on a concept that is already there. */
  placeholder?: string
  autoFocus?: boolean
}) {
  const listId = useId()

  return (
    <div className="relative">
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-label={T.add.concept}
        placeholder={placeholder}
        list={listId}
        // Off, because the list is the autocomplete: leaving it on stacks the
        // browser's own history of this field on top of the sheet's vocabulary,
        // which is two dropdowns fighting over one box.
        autoComplete="off"
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-line bg-surface py-2.5 pl-3 pr-11 text-base
                   text-ink placeholder:text-ink-3
                   focus-visible:outline focus-visible:outline-2"
      />
      {value && <ClearButton label={T.add.clearConcept} onClick={() => onChange('')} />}
      <datalist id={listId}>
        {concepts.map(concept => <option key={concept} value={concept} />)}
      </datalist>
    </div>
  )
}
