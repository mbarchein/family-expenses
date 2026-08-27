import { useCallback, useEffect, useState } from 'react'
import { carriedDate, carriedMethod, loadCarried } from './carry'
import { idb } from './db'
import { todayIso } from '../lib/dates'

/**
 * The expense being typed, kept on the phone until it is saved or thrown away.
 *
 * Three screens is three chances to be interrupted, and the interruptions are
 * the normal case: a queue moves, somebody talks to you, the phone locks. None
 * of that should cost the amount you already typed.
 *
 * It also closes a hole the app opened itself. Picking up a new version on open
 * reloads the page — see `pwa.ts` — and a reload halfway through the entry flow
 * used to lose everything on screen. Now the reload is invisible.
 *
 * The step travels with the fields, so reopening lands where you left off
 * rather than at the beginning of something you had nearly finished.
 */
export interface Draft {
  step: 0 | 1 | 2
  date: string
  /** What the keypad emitted, not a number: '', '12', '12,5', '12,'. */
  typed: string
  payer: 0 | 1
  concept: string
  /**
   * The category, which is a suggestion until somebody looks at it.
   *
   * Stored on the draft rather than worked out at save time, because it can be
   * changed by hand on the second step and that choice has to survive the app
   * being killed like everything else here does. Empty means unfiled, which is
   * a real answer: nothing guessed, and nobody chose.
   */
  category: string
  /**
   * How it was paid, on its way to column I.
   *
   * Its own field because it is its own column now. It used to share
   * `observaciones` with the free text, which meant "Tarjeta BBVA" and "lo pongo
   * yo y me lo pasas" could not both be said about one expense — and nothing
   * could be totalled by card.
   */
  method: string
  note: string
  /**
   * Whether the day is being chosen by hand.
   *
   * It has to be stored rather than worked out from `date`, and that is the bug
   * this field exists for: "Otra fecha" was derived — the segment was on when
   * the date was neither today nor yesterday — so choosing it changed nothing,
   * the segment never lit up, and the day picker never appeared. A date of today
   * chosen by hand and today by default are the same date and a different
   * intention, and only the intention decides what is on screen.
   */
  pickDate: boolean
  /**
   * Set when this entry came from a recurring template, so that saving it can
   * also record that the period is dealt with.
   *
   * On the draft rather than in a variable because a confirmation is three taps
   * long — propose, review, save — and the phone can lock in the middle of it.
   * Losing it would leave the expense apuntado and the period still owed, which
   * proposes the rent again tomorrow.
   */
  fixed: { id: string; row: number; due: string } | null
  /**
   * The saved place that lent this concept, if one did.
   *
   * Two things come out of it: the review step says "already saved" instead of
   * offering a switch, and saving the expense counts a use against that place so
   * the cards keep ranking by how often each doorway is really used.
   *
   * The concept is stored beside the id, and it is the concept that decides
   * whether either of those happens: `fromPlace.concept === concept` or nothing.
   * That is what makes it safe — any edit to the concept, from the box, from a
   * tile, from the cross, or from a recurring template, makes the two stop
   * matching and both behaviours go away by themselves, with no clearing to
   * remember at five call sites. The id is only ever read once that comparison has
   * already held, and the pair is always written together.
   */
  fromPlace: { id: string; concept: string } | null
}

const KEY = 'current'

export function emptyDraft(payer: 0 | 1): Draft {
  return {
    step: 0, date: todayIso(), typed: '', payer, concept: '', category: '',
    method: '', note: '', pickDate: false, fixed: null, fromPlace: null,
  }
}

export interface DraftStore {
  draft: Draft
  /** False until the stored draft has been read, so the first paint does not
   *  flash an empty form over one that was half filled in. */
  ready: boolean
  patch: (fields: Partial<Draft>) => void
  /** Resolves once the draft is off the disk, so a caller that is about to
   *  navigate can be sure of it. See `reset` below for why that matters. */
  reset: () => Promise<void>
}

export function useDraft(defaultPayer: 0 | 1): DraftStore {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(defaultPayer))
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // Both off the same store, and the carried card before the draft is used:
      // a first open with nothing saved still starts on the card this person paid
      // with last time, which is the whole point of remembering it.
      await loadCarried()
      const stored = await idb.get<Draft>('draft', KEY)
      if (cancelled) return
      // A draft with nothing typed into it is not an interrupted expense, it is
      // where the last one left off — and one thing it can be carrying is the date
      // of the last one, which is only meant to last as long as the app stays
      // open. It gets written to disk all the same, because the flow patches the
      // step on its way back to the keypad; this is where that is undone, and it
      // is why "a reload comes back to today" is true rather than only intended.
      //
      // `fixed` excluded on purpose: a template whose amount is unknown lands on
      // the keypad with nothing typed and everything else filled in, and blanking
      // that would lose which fijo is being dealt with.
      const started = stored
        && (stored.typed !== '' || stored.concept !== '' || stored.fixed !== null)
      if (!stored || typeof stored.typed !== 'string' || !started) {
        const method = carriedMethod(defaultPayer)
        if (method) setDraft(current => ({ ...current, method }))
        setReady(true)
        return
      }
      // A stored draft from an older shape is not worth migrating: the worst
      // case is one expense typed twice, and guessing at half a record is how
      // an amount ends up attached to the wrong concept.
      // `pickDate` normalised rather than trusted: a draft stored before the
      // field existed has it missing, and `undefined` reaching a boolean is how
      // a screen ends up in a state its own types say is impossible.
      setDraft({
        ...stored,
        pickDate: stored.pickDate === true,
        // A `fixed` from before templates had ids would settle the period by row,
        // which is the thing this stopped doing. Dropped rather than trusted: the
        // expense is still apuntado and the fijo is simply proposed again, which
        // is the safe half of that pair — the same reasoning as the comment on
        // `settleFixed` failing.
        fixed: stored.fixed && typeof stored.fixed.id === 'string' ? stored.fixed : null,
        // Missing on a draft stored before the field existed, and `undefined`
        // reaching a comparison is how a screen ends up claiming something
        // nobody told it.
        fromPlace: stored.fromPlace ?? null,
      })
      setReady(true)
    })()
    return () => { cancelled = true }
    // `defaultPayer` is read once, on the way in: it is who holds the phone, and
    // it does not change while the app is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const patch = useCallback((fields: Partial<Draft>) => {
    setDraft(current => {
      const next = { ...current, ...fields }
      // Written without being awaited on purpose. A save that has not reached
      // the disk yet costs nothing here — the state is already updated — and
      // waiting for IndexedDB before repainting would make the keypad feel
      // like it was thinking.
      void idb.set('draft', KEY, next)
      return next
    })
  }, [])

  /**
   * Thrown away, and the promise says when it is actually gone.
   *
   * `patch` writes without awaiting on purpose — a keypad that waited for
   * IndexedDB before repainting would feel like it was thinking, and a write
   * that is a few milliseconds late costs nothing when the state on screen is
   * already right. This is the one case where it is not the same: the state on
   * screen is empty and the disk still holds what was cancelled, so an app
   * killed in that window comes back offering the entry that was just thrown
   * away. CI caught exactly that — a cancel and an immediate reload, and the
   * amount was still there.
   *
   * The repaint still does not wait: `setDraft` happens first and the promise is
   * for whoever has a reason to care.
   */
  /**
   * The next expense, blank except for what the last one lends it.
   *
   * The card this person paid with, and the date — for as long as the app stays
   * open. Neither is written to disk here: what is on disk is a draft somebody is
   * in the middle of, and this is the absence of one. `carry.ts` says why the two
   * are remembered for different lengths of time.
   */
  const reset = useCallback(() => {
    const fresh = emptyDraft(defaultPayer)
    const method = carriedMethod(defaultPayer)
    if (method) fresh.method = method
    const date = carriedDate()
    if (date) {
      fresh.date = date.date
      fresh.pickDate = date.pickDate
    }
    setDraft(fresh)
    return idb.del('draft', KEY)
  }, [defaultPayer])

  return { draft, ready, patch, reset }
}
