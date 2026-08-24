import { useCallback, useEffect, useState } from 'react'
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
  fixed: { row: number; due: string } | null
}

const KEY = 'current'

export function emptyDraft(payer: 0 | 1): Draft {
  return {
    step: 0, date: todayIso(), typed: '', payer, concept: '', note: '',
    pickDate: false, fixed: null,
  }
}

export interface DraftStore {
  draft: Draft
  /** False until the stored draft has been read, so the first paint does not
   *  flash an empty form over one that was half filled in. */
  ready: boolean
  patch: (fields: Partial<Draft>) => void
  reset: () => void
}

export function useDraft(defaultPayer: 0 | 1): DraftStore {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(defaultPayer))
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = await idb.get<Draft>('draft', KEY)
      if (cancelled) return
      // A stored draft from an older shape is not worth migrating: the worst
      // case is one expense typed twice, and guessing at half a record is how
      // an amount ends up attached to the wrong concept.
      // `pickDate` normalised rather than trusted: a draft stored before the
      // field existed has it missing, and `undefined` reaching a boolean is how
      // a screen ends up in a state its own types say is impossible.
      if (stored && typeof stored.typed === 'string') {
        setDraft({ ...stored, pickDate: stored.pickDate === true, fixed: stored.fixed ?? null })
      }
      setReady(true)
    })()
    return () => { cancelled = true }
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

  const reset = useCallback(() => {
    const fresh = emptyDraft(defaultPayer)
    setDraft(fresh)
    void idb.del('draft', KEY)
  }, [defaultPayer])

  return { draft, ready, patch, reset }
}
