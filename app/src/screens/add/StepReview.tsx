import { T } from '../../i18n/strings'
import { formatEur } from '../../lib/money'
import { formatDayHeading } from '../../lib/dates'
import type { Draft } from '../../store/draft'
import type { Person } from '../../api/types'

/**
 * Step three: everything on one screen, and one button.
 *
 * Each row goes back to the step that owns it rather than being editable here.
 * A field that can be changed in two places is a field with two versions of the
 * truth, and the ledger this writes into is not somewhere to find that out.
 */
export function StepReview({ draft, people, amount, readOnly, onEdit, onSave, onDiscard }: {
  draft: Draft
  people: readonly [Person, Person]
  amount: number
  readOnly: boolean
  onEdit: (step: 0 | 1) => void
  onSave: () => void
  onDiscard: () => void
}) {
  return (
    <>
      <p className="pt-1 text-sm text-ink-2">{T.add.reviewTitle}</p>

      <div className="overflow-hidden rounded-xl border border-line" style={{ background: 'var(--surface)' }}>
        <Row label={T.add.fieldAmount} onEdit={() => onEdit(0)}>
          <span className="tabular font-mono text-xl font-semibold">{formatEur(amount)}</span>
        </Row>
        <Row label={T.add.fieldPayer} onEdit={() => onEdit(0)}>
          <span
            className="font-semibold"
            style={{ color: draft.payer === 0 ? 'var(--person-1)' : 'var(--person-2)' }}
          >
            {people[draft.payer].name}
          </span>
        </Row>
        <Row label={T.add.fieldDate} onEdit={() => onEdit(0)}>
          {formatDayHeading(draft.date)}
        </Row>
        <Row label={T.add.fieldConcept} onEdit={() => onEdit(1)}>
          {draft.concept || <span className="text-ink-3">{T.add.needConcept}</span>}
        </Row>
        <Row label={T.add.fieldNote} onEdit={() => onEdit(1)} last>
          {draft.note || <span className="text-ink-3">{T.add.noNote}</span>}
        </Row>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={readOnly}
        className="rounded-xl py-3.5 text-base font-bold disabled:opacity-40
                   focus-visible:outline focus-visible:outline-2"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        {T.add.save}
      </button>

      {readOnly && <p className="text-center text-xs text-ink-2">{T.auth.noColumn}</p>}

      <button
        type="button"
        onClick={onDiscard}
        className="py-1 text-center text-sm text-ink-2 underline focus-visible:outline focus-visible:outline-2"
      >
        {T.add.discard}
      </button>
    </>
  )
}

function Row({ label, children, onEdit, last }: {
  label: string
  children: React.ReactNode
  onEdit: () => void
  last?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className={'flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left text-sm' +
        (last ? '' : ' border-b border-line')}
    >
      <span className="shrink-0 text-ink-2">{label}</span>
      <span className="truncate text-right text-ink">{children}</span>
    </button>
  )
}
