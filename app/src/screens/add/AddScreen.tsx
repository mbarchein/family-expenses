import { useCallback, useEffect, useMemo, useState } from 'react'
import { T } from '../../i18n/strings'
import { parseAmount } from '../../lib/money'
import { useDraft } from '../../store/draft'
import type { Ledger } from '../../store/ledger'
import { FixedBanner, FixedDue } from '../../components/FixedDue'
import { alreadyThere, whatIsDue, type Due } from '../../lib/fixed'
import { todayIso } from '../../lib/dates'
import { typedFromAmount } from '../../lib/money'
import { BackIcon } from '../../components/ScreenHeader'
import { usePlaces } from '../../store/places'
import { StepAmount } from './StepAmount'
import { StepDetails } from './StepDetails'
import { StepReview, type PlaceState } from './StepReview'

const STEPS = 3

/**
 * Entering an expense, in three screens: amount, details, review.
 *
 * It was one screen before, with every control on it at once. Three is not more
 * ceremony for its own sake — it is what lets each screen be one decision at a
 * readable size, on the phone of somebody standing in a queue. The amount gets
 * the whole screen because it is the number that must not be wrong; the review
 * exists because the row about to be written cannot be taken back out of the
 * ledger, only voided.
 *
 * **The device's back button walks back through the steps.** Each step forward
 * is a history entry, so back is what the hand already expects it to be rather
 * than something that closes the app halfway through. The on-screen arrow does
 * exactly the same thing, through the same mechanism, so there is one path and
 * not two that can disagree.
 *
 * Nothing typed here is held only in memory: every keystroke goes to the draft
 * in IndexedDB, so an interruption — a lock screen, a phone call, or this app
 * reloading itself to pick up a new version — costs nothing.
 */
export function AddScreen({ ledger, onLeave }: { ledger: Ledger; onLeave: () => void }) {
  const data = ledger.data
  const me = data?.config.meIndex ?? -1
  const { draft, ready, patch, reset } = useDraft(me === 1 ? 1 : 0)
  const [problem, setProblem] = useState<string | null>(null)

  // No `locate`: this only ever writes a place, and reading the GPS on the way
  // into a flow that may never ask for one is exactly what the option exists to
  // avoid. The screen that suggests by proximity does its own reading.
  const { locateNow, knows, rememberAt } = usePlaces()
  const [place, setPlace] = useState<PlaceState>({ kind: 'off' })
  const [showDue, setShowDue] = useState(false)

  // What the recurring templates owe, worked out here rather than in the
  // backend: it is calendar arithmetic, and this side has a test runner.
  const due = useMemo(
    () => whatIsDue(ledger.fixed, todayIso()),
    [ledger.fixed],
  )

  const step = draft.step

  /**
   * One history entry per step, and the browser is the only source of truth for
   * which one we are on.
   *
   * Moving forward pushes; moving back is `history.back()` and nothing else,
   * including for the on-screen arrow. Setting the step directly *and* pushing
   * a state would give the two ways back a chance to disagree, which is the
   * usual way a wizard ends up needing the button pressed twice.
   */
  const goTo = useCallback((next: 0 | 1 | 2) => {
    history.pushState({ step: next }, '')
    patch({ step: next })
  }, [patch])

  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const to = (event.state as { step?: number } | null)?.step
      patch({ step: (to === 1 || to === 2 ? to : 0) })
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [patch])

  // A draft restored at step two or three has no history behind it — the page
  // has just been loaded. Without this, back from a restored step three would
  // leave the app instead of returning to the concept.
  useEffect(() => {
    if (!ready) return
    history.replaceState({ step: 0 }, '')
    for (let pushed = 1; pushed <= step; pushed++) history.pushState({ step: pushed }, '')
    // Deliberately once, when the stored draft arrives. Re-running it on every
    // step change would push the entries a second time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  if (!data || !ready) return null
  const people = data.config.people
  const readOnly = me === -1
  const amount = parseAmount(draft.typed)

  /** Returns to the first step through the history, so the browser's idea of
   *  where we are and ours cannot come apart. */
  function rewind() {
    if (step > 0) history.go(-step)
  }

  /**
   * The switch reads the position when it goes on and forgets it when it goes
   * off. Nothing is written here: the place lands in `save()`, with the expense
   * it belongs to, so abandoning the entry does not leave a place behind for a
   * gasto that was never apuntado.
   */
  async function togglePlace() {
    if (place.kind === 'on') return setPlace({ kind: 'off' })
    setPlace({ kind: 'asking' })
    const fix = await locateNow()
    if (fix === 'denied' || fix === 'unavailable') return setPlace({ kind: fix })
    // Whether this doorway and concept are already stored, so the switch can say
    // "you already had this" instead of implying something new was added.
    setPlace({ kind: 'on', fix, known: knows(fix, draft.concept.trim()) })
  }

  /**
   * Confirming a proposal loads it into this flow rather than posting it.
   *
   * Straight to the review step when the amount is known, because there is
   * nothing left to type and the review is where a row about to be written gets
   * looked at. To the keypad when it is not — the light, the water — with the
   * concept, the day and the payer already filled in.
   *
   * `fixed` rides along on the draft so that saving can also record the period
   * as dealt with. See `store/draft.ts` for why it is stored rather than held.
   */
  function confirm(item: Due) {
    const known = item.amount !== null && item.amount > 0
    setShowDue(false)
    patch({
      typed: known ? typedFromAmount(item.amount!) : '',
      date: item.due,
      pickDate: true,
      payer: item.payer ?? draft.payer,
      concept: item.concept,
      note: '',
      fixed: { row: item.row, due: item.due },
      step: known ? 2 : 0,
    })
    // The history has to grow with the step, or back from a proposed review
    // would leave the app instead of returning to the keypad.
    if (known) {
      history.pushState({ step: 1 }, '')
      history.pushState({ step: 2 }, '')
    }
  }

  /**
   * Out of the flow, from any step, leaving nothing behind.
   *
   * There was a way to abandon an entry only on the third screen, which is the
   * one place it is least needed — by then the thing is written and the question
   * is whether to save it. Changing your mind happens on the first screen, with
   * a wrong number on it, and the only ways out were the tab bar (which leaves
   * the number there for next time) and the back arrow (which does nothing at
   * all on the first step).
   *
   * The draft is cleared rather than left: a cancelled entry that comes back on
   * the next open is not a cancelled entry.
   */
  function cancel() {
    reset()
    setPlace({ kind: 'off' })
    setProblem(null)
    rewind()
  }

  /** Whether there is anything to cancel. On an untouched keypad the button
   *  would be an offer to abandon nothing. */
  const started = step > 0 || Boolean(draft.typed) || Boolean(draft.concept.trim())

  function forward() {
    if (step === 0) {
      if (amount <= 0) return setProblem(T.add.needAmount)
      setProblem(null)
      return goTo(1)
    }
    if (step === 1) {
      if (!draft.concept.trim()) return setProblem(T.add.needConcept)
      setProblem(null)
      return goTo(2)
    }
  }

  async function save() {
    if (amount <= 0) return setProblem(T.add.needAmount)
    if (!draft.concept.trim()) return setProblem(T.add.needConcept)

    const id = crypto.randomUUID()
    // Before the entry, and deliberately not awaited together with it: a place
    // is local and instant, while the entry goes through the outbound queue.
    // Failing to store a place must never stop an expense being apuntado.
    if (place.kind === 'on') {
      await rememberAt(place.fix, draft.concept.trim(), draft.note).catch(() => {})
    }

    await ledger.addEntry({
      id,
      date: draft.date,
      concept: draft.concept.trim(),
      amount,
      payer: draft.payer,
      note: draft.note,
    })

    // After the expense, never before: the entry is the thing that matters and
    // it goes through the queue, while this is only the note that stops the
    // period being proposed again. If it fails the proposal comes back, which
    // is safe — by then the expense is in the list the duplicate warning reads.
    if (draft.fixed) {
      const settling = draft.fixed
      void ledger.settleFixed(settling.row, settling.due).catch(() => {})
    }

    reset()
    setPlace({ kind: 'off' })
    setProblem(null)
    // Back to where the flow started, so the steps just walked through are not
    // left behind us for the back button to wander into. `go` and not two
    // `back()` calls, and never `go(0)` — that one reloads the page.
    rewind()
  }

  // `justify-between` distributes the spare height between the rows and no child
  // grows. Handing the slack to one element instead is a mistake this screen has
  // already made twice: given to the keypad it produced 130px keys with the
  // digits floating inside them, and given to a spacer it produced a 500px hole
  // in the middle of an otherwise dense step.
  return (
    <div className="flex h-full flex-col justify-between gap-2 p-4">
      <header className="flex items-center gap-2">
        {/* A slot of a fixed size, empty on the first step rather than absent.
            The arrow used to be swapped for a narrower spacer, which changed the
            row's width *and* its height — so "Paso 2 de 3" and the progress pills
            visibly jumped the moment the step changed. An empty box the same size
            as the button is the whole fix. */}
        <div className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center">
          {/* On every step now, including the first — where it leaves the flow
              rather than walking back through it. Both are `history.back()`,
              because a step and a screen are both entries in the same history
              and the arrow should not have to know which one it is on. */}
          <button
            type="button"
            onClick={() => (step > 0 ? history.back() : onLeave())}
            aria-label={T.add.back}
            className="flex h-9 w-9 items-center justify-center rounded-full
                       focus-visible:outline focus-visible:outline-2"
            style={{ color: 'var(--accent)' }}
          >
            <BackIcon />
          </button>
        </div>
        <p className="text-xs font-semibold text-ink-2">{T.add.step(step + 1, STEPS)}</p>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1" aria-hidden="true">
            {[0, 1, 2].map(index => (
              <span
                key={index}
                className="h-1.5 w-6 rounded-full"
                style={{ background: index <= step ? 'var(--accent)' : 'var(--surface-2)' }}
              />
            ))}
          </div>
          {started && (
            <button
              type="button"
              onClick={cancel}
              className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs
                         font-semibold text-ink-2 focus-visible:outline focus-visible:outline-2"
            >
              {T.edit.cancel}
            </button>
          )}
        </div>
      </header>

      {step === 0 && <FixedBanner count={due.length} onOpen={() => setShowDue(true)} />}

      {step === 0 && (
        <StepAmount draft={draft} people={people} patch={patch} onNext={forward} />
      )}
      {step === 1 && (
        <StepDetails draft={draft} data={data} patch={patch} onNext={forward} />
      )}
      {step === 2 && (
        <StepReview
          draft={draft}
          people={people}
          amount={amount}
          readOnly={readOnly}
          place={place}
          onTogglePlace={() => void togglePlace()}
          // One call, not a back() per step: two in a row race each other and
          // the second can land before the first popstate has been handled.
          onEdit={target => history.go(target - step)}
          onSave={save}
          onDiscard={() => { reset(); setPlace({ kind: 'off' }); rewind() }}
        />
      )}

      {showDue && (
        <FixedDue
          due={due}
          warn={item => alreadyThere(ledger.entries, item)}
          onConfirm={confirm}
          onSkip={item => { void ledger.settleFixed(item.row, item.due) }}
          onClose={() => setShowDue(false)}
        />
      )}

      {problem && (
        <p role="alert" className="text-center text-sm" style={{ color: 'var(--danger)' }}>
          {problem}
        </p>
      )}

    </div>
  )
}
