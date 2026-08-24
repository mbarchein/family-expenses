import { useCallback, useEffect, useState } from 'react'
import { T } from '../../i18n/strings'
import { parseAmount } from '../../lib/money'
import { useDraft } from '../../store/draft'
import type { Ledger } from '../../store/ledger'
import { StepAmount } from './StepAmount'
import { StepDetails } from './StepDetails'
import { StepReview } from './StepReview'

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
export function AddScreen({ ledger }: { ledger: Ledger }) {
  const data = ledger.data
  const me = data?.config.meIndex ?? -1
  const { draft, ready, patch, reset } = useDraft(me === 1 ? 1 : 0)
  const [problem, setProblem] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState<string | null>(null)

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
    await ledger.addEntry({
      id,
      date: draft.date,
      concept: draft.concept.trim(),
      amount,
      payer: draft.payer,
      note: draft.note,
    })

    reset()
    setProblem(null)
    // Back to where the flow started, so the steps just walked through are not
    // left behind us for the back button to wander into. `go` and not two
    // `back()` calls, and never `go(0)` — that one reloads the page.
    rewind()
    setJustSaved(id)
    // Long enough to catch the "wrong person" reflex, short enough that the
    // banner is gone by the next time the app is opened.
    window.setTimeout(() => setJustSaved(current => (current === id ? null : current)), 6000)
  }

  // `justify-between` distributes the spare height between the rows and no child
  // grows. Handing the slack to one element instead is a mistake this screen has
  // already made twice: given to the keypad it produced 130px keys with the
  // digits floating inside them, and given to a spacer it produced a 500px hole
  // in the middle of an otherwise dense step.
  return (
    <div className="relative flex h-full flex-col justify-between gap-2 p-4">
      <header className="flex items-center gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => history.back()}
            aria-label={T.add.back}
            className="-ml-1 px-1 text-lg font-semibold focus-visible:outline focus-visible:outline-2"
            style={{ color: 'var(--accent)' }}
          >
            ←
          </button>
        ) : (
          <span className="w-3" />
        )}
        <p className="text-xs font-semibold text-ink-2">{T.add.step(step + 1, STEPS)}</p>
        <div className="ml-auto flex gap-1" aria-hidden="true">
          {[0, 1, 2].map(index => (
            <span
              key={index}
              className="h-1.5 w-6 rounded-full"
              style={{ background: index <= step ? 'var(--accent)' : 'var(--surface-2)' }}
            />
          ))}
        </div>
      </header>

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
          // One call, not a back() per step: two in a row race each other and
          // the second can land before the first popstate has been handled.
          onEdit={target => history.go(target - step)}
          onSave={save}
          onDiscard={() => { reset(); rewind() }}
        />
      )}

      {problem && (
        <p role="alert" className="text-center text-sm" style={{ color: 'var(--danger)' }}>
          {problem}
        </p>
      )}

      {/* Floating rather than part of the column: a banner that reflows the
          layout moves the button out from under a thumb already on its way. */}
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
