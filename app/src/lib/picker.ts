import { useCallback, useEffect, useState } from 'react'
import { PLACED_METRES } from './geo'
import { watchPosition, type Fix, type PositionFailure } from './position'

/**
 * Choosing a position: from the device, or by dragging the map.
 *
 * Two screens do this — correcting a place that already exists, and adding one by
 * hand — and they have to agree about three things that are easy to get subtly
 * different: that a point dragged by a person is no longer the device's claim,
 * that the watch refining a fix must stop the moment somebody drags, and that a
 * refusal is said out loud rather than leaving a button that appears to do
 * nothing.
 *
 * The hook holds the state; each screen draws its own layout around it, because
 * one is a correction with a "would move N m" line and the other is a form.
 */

/** Where the point on screen came from. `start` is whatever the screen opened
 *  on — a place's saved position, or the phone's if it was already known — which
 *  is neither a reading nor a choice yet. */
export type PickedFrom = 'start' | 'here' | 'hand'

/** The device read, which is its own state because it happens *inside* a
 *  correction: the map has to stay on screen while the phone is being asked. */
export type Reading = 'idle' | 'asking' | 'denied' | 'unavailable'

export interface Picked {
  /** Null only where the screen opened with no position at all: adding a place
   *  on a phone that has never granted the permission and has no saved place to
   *  start from. */
  fix: Fix | null
  from: PickedFrom
  /** True while the watch is still running and the fix may yet get better. */
  improving: boolean
}

export interface Picker {
  picked: Picked
  reading: Reading
  /** Reads the device, prompting if the permission has not been decided. Only
   *  ever wired to a control that says it will — see `HereButton`. */
  locateHere: () => Promise<void>
  /** A drag. */
  pan: (fix: Fix) => void
  /** Back to a starting point: opening the picker, or closing it. */
  reset: (fix: Fix | null) => void
}

export function usePositionPicker(
  start: Fix | null,
  locate: () => Promise<Fix | PositionFailure>,
): Picker {
  const [picked, setPicked] = useState<Picked>(
    { fix: start, from: 'start', improving: false })
  const [reading, setReading] = useState<Reading>('idle')

  /**
   * While a fix read from the device is on screen, keep improving it.
   *
   * The same watch the review step runs and for the same reason — the best fix
   * wins rather than the latest, because a later reading can be worse and
   * replacing a ±8 with a ±25 would be a downgrade dressed as an update.
   *
   * Only while the point came from the device: the moment somebody drags the map
   * the point is theirs, and a watch still running would shove it back under
   * their thumb a second later. Stopped too when the screen goes away — a watch
   * left running is a GPS held open on somebody's phone.
   */
  useEffect(() => {
    if (picked.from !== 'here') return
    return watchPosition(fix => setPicked(current => {
      if (current.from !== 'here' || !current.fix) return current
      return fix.accuracy < current.fix.accuracy
        ? { fix, from: 'here', improving: true }
        : { ...current, improving: false }
    }))
  }, [picked.from])

  const locateHere = useCallback(async () => {
    setReading('asking')
    const fix = await locate()
    if (fix === 'denied' || fix === 'unavailable') return setReading(fix)
    setReading('idle')
    setPicked({ fix, from: 'here', improving: true })
  }, [locate])

  // A point moved by hand has no device accuracy at all, so it stops carrying
  // the one belonging to the fix it just replaced — see `PLACED_METRES`.
  const pan = useCallback((fix: Fix) => {
    setPicked({ fix: { ...fix, accuracy: PLACED_METRES }, from: 'hand', improving: false })
  }, [])

  const reset = useCallback((fix: Fix | null) => {
    setPicked({ fix, from: 'start', improving: false })
    setReading('idle')
  }, [])

  return { picked, reading, locateHere, pan, reset }
}
