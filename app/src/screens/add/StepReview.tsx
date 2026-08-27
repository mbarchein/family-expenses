import { useState } from 'react'
import { Confirm } from '../../components/Confirm'
import { PlaceMap } from '../../components/PlaceMap'
import { T } from '../../i18n/strings'
import { formatEur } from '../../lib/money'
import { formatDayHeading } from '../../lib/dates'
import { formatCoords, type Fix } from '../../lib/position'
import type { NearPlace } from '../../store/places'
import type { Draft } from '../../store/draft'
import type { Person } from '../../api/types'

/** What the place switch is doing: off, looking, on with a fix, or refused. */
export type PlaceState =
  | { kind: 'off' }
  | { kind: 'asking' }
  /** `improving` is true while the watch is still running: the fix on screen may
   *  yet get better, and saying so is the difference between a number that looks
   *  final and one that is still settling. */
  | { kind: 'on'; fix: Fix; known: boolean; improving: boolean }
  | { kind: 'denied' }
  | { kind: 'unavailable' }

/**
 * Step three: everything on one screen, and one button.
 *
 * Each row goes back to the step that owns it rather than being editable here.
 * A field that can be changed in two places is a field with two versions of the
 * truth, and the ledger this writes into is not somewhere to find that out.
 *
 * The place switch is the one control here that is not a field of the expense,
 * which is why it sits outside the card rather than looking like another row.
 * It belongs on this screen and not on the previous one for two reasons: this is
 * where everything about to be written is confirmed, and by the time it can be
 * touched there is certainly a concept to attach a place to — the second step
 * cannot be left without one.
 */
export function StepReview({
  draft, people, amount, readOnly, place, nearby, onTogglePlace, onEdit, onSave, onDiscard,
}: {
  draft: Draft
  people: readonly [Person, Person]
  amount: number
  readOnly: boolean
  place: PlaceState
  /** The saved places, measured against the current fix by the store. Drawn on
   *  the schematic so the dot has something to be near. */
  nearby: NearPlace[]
  onTogglePlace: () => void
  onEdit: (step: 0 | 1) => void
  onSave: () => void
  onDiscard: () => void
}) {
  const [asking, setAsking] = useState(false)

  /**
   * Whether the doorway on screen is one already saved.
   *
   * The comparison rather than a flag of its own: `fromPlace` is set only when a
   * card lends its concept, so the moment the concept is edited by any of the
   * five ways it can be, the two stop matching and this goes false on its own.
   */
  const known = draft.concept !== '' && draft.concept === draft.fromPlace?.concept

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
        {/* The category and the method each get a line, because each is now a
            column of its own: a screen for checking before saving has to show
            everything that is about to be written. */}
        <Row label={T.category.label} onEdit={() => onEdit(1)}>
          {draft.category || <span className="text-ink-3">{T.category.none}</span>}
        </Row>
        <Row label={T.add.methodRow} onEdit={() => onEdit(1)}>
          {draft.method || <span className="text-ink-3">{T.add.noMethod}</span>}
        </Row>
        <Row label={T.add.fieldNote} onEdit={() => onEdit(1)} last>
          {draft.note || <span className="text-ink-3">{T.add.noNote}</span>}
        </Row>
      </div>

      {/* Either an offer or a fact, never both.
          
          When the concept came from a saved place — see `Draft.fromPlace` — there
          is nothing to offer: this doorway is already in the list, the concept on
          screen is the one it lent, and a switch labelled "Guardar este sitio"
          would be asking to save what is already saved. So the row states that
          instead, and no position is read and no tile is fetched. */}
      {known
        ? <PlaceKnown />
        : <PlaceSwitch state={place} onToggle={onTogglePlace} />}

      {/* Under the switch and only while it is on — which is also when the first
          tile is asked for. See the comment on `PlaceMap`: it was a drawing until
          somebody looked at it, and what it is now costs a line in section 13. */}
      {!known && place.kind === 'on' && (
        <PlaceMap fix={place.fix} nearby={nearby} improving={place.improving} />
      )}

      {/* The two ways off this screen, on one line, both of them buttons.
          
          Discarding used to be underlined text below the save button, which is
          two mistakes: at the bottom of a scrolling screen it was reached by
          accident, and as a link it did not look like the irreversible thing it
          is. Left and narrower, because that is the answer to a question nobody
          came here to answer; Guardar takes the rest of the row and the thumb's
          side of the screen.
          
          `items-stretch`, so the two are the same height whatever the words do to
          them, and the icons because a row of two identical grey rectangles is
          read by shape before it is read at all. */}
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => setAsking(true)}
          // The whole sentence as the name, "Descartar" as the label: read out of
          // context by a screen reader, one word is not enough to know what goes.
          aria-label={T.add.discard}
          className="flex shrink-0 items-center gap-2 rounded-xl border px-4 py-3.5 text-base
                     font-semibold focus-visible:outline focus-visible:outline-2"
          style={{ borderColor: 'var(--line)', color: 'var(--danger)' }}
        >
          <TrashIcon />
          {T.add.discardShort}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={readOnly}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3.5 text-base
                     font-bold disabled:opacity-40 focus-visible:outline focus-visible:outline-2"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          <CheckIcon />
          {T.add.save}
        </button>
      </div>

      {readOnly && <p className="text-center text-xs text-ink-2">{T.auth.noColumn}</p>}

      {/* In the app rather than the browser's own dialog — see `Confirm`. */}
      {asking && (
        <Confirm
          title={T.add.discardAsk}
          body={T.add.discardBody}
          confirmLabel={T.add.discardYes}
          cancelLabel={T.add.discardNo}
          onConfirm={() => { setAsking(false); onDiscard() }}
          onCancel={() => setAsking(false)}
        />
      )}
    </>
  )
}

/**
 * The doorway is already saved, so this says so and asks nothing.
 *
 * Same shape and same place in the column as the switch it replaces, because it
 * answers the same question — what happens to the place — and a row that moved
 * would read as a different subject. Not a button: there is nothing to decide.
 */
function PlaceKnown() {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3 text-sm"
      style={{ background: 'var(--surface)' }}
    >
      <PinIcon />
      <span className="flex flex-col">
        <span className="font-semibold">{T.places.savedHere}</span>
        <span className="text-[11px] text-ink-3">{T.places.savedHereWhy}</span>
      </span>
    </div>
  )
}

/** A map pin with a tick in it: the place is known, not being decided. */
function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-6 w-6 shrink-0"
         fill="none" stroke="currentColor" strokeWidth={1.8}
         strokeLinecap="round" strokeLinejoin="round"
         style={{ color: 'var(--accent)' }}>
      <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
      <path d="M8.8 9.9l2.2 2.2 4-4.2" />
    </svg>
  )
}

/** A tick, on the button that writes the row. */
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0"
         fill="none" stroke="currentColor" strokeWidth={2.5}
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 12.5l5 5 10-11" />
    </svg>
  )
}

/** A bin, on the one that throws the draft away. Furniture rather than part of
 *  the concept vocabulary in `Icon.tsx`, so it lives here. */
function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0"
         fill="none" stroke="currentColor" strokeWidth={1.9}
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 13h9l1-13M10.5 10.5v6M13.5 10.5v6" />
    </svg>
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

/**
 * Save this place, with the coordinate it would save.
 *
 * The coordinate is shown because it is the only way to tell a good fix from a
 * bad one before trusting it: places match within fifteen metres, a phone
 * indoors is often less sure of itself than that, and `±38 m` on screen explains
 * in advance what would otherwise be a suggestion that mysteriously never comes
 * back. It is also the only screen in the app that ever displays a coordinate —
 * it is on the device, on its way to IndexedDB and nowhere else.
 */
function PlaceSwitch({ state, onToggle }: { state: PlaceState; onToggle: () => void }) {
  const on = state.kind === 'on'

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onToggle}
        disabled={state.kind === 'asking'}
        className="flex items-center justify-between gap-3 rounded-xl border border-line
                   px-3.5 py-3 text-left text-sm focus-visible:outline focus-visible:outline-2"
        style={{ background: 'var(--surface)' }}
      >
        <span className="flex flex-col">
          <span className={on ? 'font-semibold' : 'text-ink-2'}>{T.places.remember}</span>
          {state.kind === 'asking' && (
            <span className="text-xs text-ink-3">{T.places.remembering}</span>
          )}
          {on && (
            <span className="tabular pt-0.5 font-mono text-[11px] text-ink-3">
              {formatCoords(state.fix)} · {T.places.accuracy(Math.round(state.fix.accuracy))}
            </span>
          )}
          {on && state.known && (
            <span className="text-[11px] text-ink-3">{T.places.knownAlready}</span>
          )}
          {on && !state.known && (
            <span className="text-[11px] text-ink-3">{T.places.willRemember}</span>
          )}
        </span>

        {/* Drawn rather than a checkbox: this row is one tap target and a native
            control inside a button would be two, one of which swallows the tap. */}
        <span
          aria-hidden="true"
          className="relative h-6 w-10 shrink-0 rounded-full transition-colors"
          style={{ background: on ? 'var(--accent)' : 'var(--surface-2)' }}
        >
          <span
            className="absolute top-0.5 h-5 w-5 rounded-full transition-all"
            style={{
              left: on ? '1.125rem' : '0.125rem',
              background: on ? 'var(--accent-ink)' : 'var(--ink-3)',
            }}
          />
        </span>
      </button>

      {(state.kind === 'denied' || state.kind === 'unavailable') && (
        <p role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>
          {state.kind === 'denied' ? T.places.denied : T.places.unavailable}
        </p>
      )}
    </div>
  )
}
