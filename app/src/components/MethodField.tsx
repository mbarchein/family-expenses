import { useMemo } from 'react'
import { Pills, type Pill } from './Pills'
import { T } from '../i18n/strings'
import type { Suggestion } from '../api/types'

/**
 * The payment method: the cards off the Sugerencias tab, and a box for the rest.
 *
 * The pills were only on the way in, on the second step, and the reasoning for
 * that was written down here: the fast path is where the pills belong, and these
 * screens have to be able to show a method that is not on the tab — an old row's,
 * or one typed on the other phone. Both halves of that are still true; what was
 * wrong was the conclusion. A screen can offer the four cards *and* keep the box,
 * and correcting a row to "Tarjeta BBVA" by typing all twelve characters — when
 * the app has that card written down and knows whose it is — was work nobody
 * needed to do.
 *
 * So: one field, one value. Tapping a pill fills the box and typing over it
 * leaves no pill lit, exactly as the observaciones row on the second step works.
 * There is no second state to disagree with the first.
 *
 * **The pills are filtered by payer and the box is not.** A card of Mario's is
 * not offered on a gasto Viqui pays, because a payment method belongs to whoever
 * is paying rather than to whoever is holding the phone. Nothing is cleared when
 * the payer changes, though — unlike the second step, which is filling a draft
 * nobody has committed to. These two screens are editing something that already
 * exists, and silently rewriting a stored value while somebody is looking at a
 * different field is how an edit screen loses trust.
 */
export function MethodField({ suggestions, payer, value, onChange }: {
  suggestions: readonly Suggestion[]
  /** Who pays: null on a fijo that says "whoever has the phone", which is offered
   *  only the methods that belong to neither of them. */
  payer: 0 | 1 | null
  value: string
  onChange: (method: string) => void
}) {
  const pills = useMemo<Pill[]>(() => suggestions
    .filter(item => item.kind === 'method' && (item.person === null || item.person === payer))
    .map(item => ({ key: item.text, label: item.text, pinned: true })), [suggestions, payer])

  return (
    <div className="flex flex-col gap-1.5">
      {/* Wrapped rather than scrolling, like the row on the second step: four
          cards of which two are off the right edge is a list that hides half of
          itself, and these labels are short. */}
      <Pills
        items={pills}
        active={value}
        onPick={onChange}
        label={T.add.methodRow}
        wrap
      />
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        aria-label={T.add.methodRow}
        placeholder={T.add.methodPlaceholder}
        className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm
                   placeholder:text-ink-3 focus-visible:outline focus-visible:outline-2"
      />
    </div>
  )
}
