import { useMemo } from 'react'
import { Pills, type Pill } from '../../components/Pills'
import { T } from '../../i18n/strings'
import type { Draft } from '../../store/draft'
import type { Bootstrap, Suggestion } from '../../api/types'

/**
 * Step two: what it was, and how it was paid for.
 *
 * Both rows are filtered by whoever is paying — chosen on the previous screen —
 * rather than by whoever is holding the phone. Either person can enter the
 * other's expense, and it is the payer's card that belongs in the note.
 */
export function StepDetails({ draft, data, patch, onNext }: {
  draft: Draft
  data: Bootstrap
  patch: (fields: Partial<Draft>) => void
  onNext: () => void
}) {
  const mine = useMemo(
    () => (data.suggestions ?? []).filter(
      (item: Suggestion) => item.person === null || item.person === draft.payer,
    ),
    [data.suggestions, draft.payer],
  )

  /** Curated concepts first, then whatever the history threw up, deduplicated. */
  const conceptPills = useMemo<Pill[]>(() => {
    const pinned = mine.filter(item => item.kind === 'concept')
    const seen = new Set(pinned.map(item => item.text.toLowerCase()))
    return [
      ...pinned.map(item => ({ key: item.text, label: item.text, pinned: true })),
      ...data.frequent
        .filter(chip => !seen.has(chip.concept.toLowerCase()))
        .map(chip => ({ key: chip.concept, label: chip.concept })),
    ]
  }, [mine, data.frequent])

  /**
   * One row for the note, the payment methods first and then the suggested
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

  // Two groups, each one tight, and the spare height goes between them rather
  // than inside them: the chips fill the field directly above them, and a
  // hundred pixels of nothing in between makes them look unrelated to it.
  return (
    <>
      <div className="flex flex-col gap-2">
        <input
          value={draft.concept}
          onChange={event => patch({ concept: event.target.value })}
          placeholder={T.add.conceptPlaceholder}
          aria-label={T.add.concept}
          enterKeyHint="done"
          autoFocus
          className="rounded-lg border border-line bg-surface px-3 py-3 text-base text-ink
                     placeholder:text-ink-2 focus-visible:outline focus-visible:outline-2"
        />

        {/* Sets the concept and nothing else. This used to set the payer too, so
            tapping a chip changed who was paying — silently, and over a choice
            just made. A suggestion may fill in the field it is a suggestion
            for, and no others. */}
        <Pills
          items={conceptPills}
          active={draft.concept}
          onPick={concept => patch({ concept })}
          label={T.add.conceptRow}
        />
      </div>

      <div>
        <p className="pb-1.5 text-xs font-semibold text-ink-2">{T.add.noteRow}</p>
        <Pills
          items={notePills}
          active={draft.note}
          onPick={note => patch({ note })}
          label={T.add.noteRow}
        />
      </div>

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
