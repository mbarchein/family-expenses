import { useCallback, useEffect, useMemo, useState } from 'react'
import { idb } from './db'
import { TOLERANCE_METRES, metresBetween, samePlace } from '../lib/geo'
import { askForPosition, positionIfAlreadyAllowed, type Fix } from '../lib/position'

/**
 * Places, and the concept spent at each one — on this device and nowhere else.
 *
 * The point of the feature: the same shop produces the same concept every time,
 * and typing it again is work a phone that knows where it is should not need.
 * Saving one is always a deliberate tap; nothing is recorded by walking around.
 *
 * **Coordinates never leave the device.** They are not sent to the backend, they
 * are not written to the spreadsheet, and there is no column for them. What
 * reaches the ledger is the concept, exactly as if it had been typed. This is
 * the reason they live in IndexedDB rather than in the sheet with everything
 * else, and the reason the screen that lists them says so out loud.
 *
 * A place is a location *and* a concept, not a location with a concept attached.
 * The pharmacy and the supermarket in the same square are two places; so are
 * "super" and "farmacia" at the same door if somebody saves both, and both are
 * then offered. Merging them would mean choosing which one to lose.
 */
export interface Place {
  id: string
  lat: number
  lon: number
  /** What the device claimed when it was saved. Shown on the places screen: the
   *  tolerance is 15 m and an indoor fix is often worse than that, so a place
   *  that never matches is explained by this number rather than a mystery. */
  accuracy: number
  concept: string
  /** The payment method chosen alongside it, if any. Saved because at a given
   *  shop it tends to be the same card, and it costs nothing to offer. */
  note: string
  savedAt: number
  uses: number
}

/** A stored place together with how far away it is right now. */
export interface NearPlace extends Place {
  metres: number
}

export type RememberResult = 'saved' | 'again' | 'denied' | 'unavailable'

export interface PlacesStore {
  places: Place[]
  ready: boolean
  /** Where the phone is, if the permission was already granted. Null otherwise —
   *  including while it is still being worked out. */
  here: Fix | null
  /** The places within the tolerance of `here`, nearest first. */
  nearby: NearPlace[]
  /** Saves where the phone is now against this concept. Prompts for the
   *  permission if it has not been decided yet: it is reached by a tap on a
   *  button that says what it does. */
  remember: (concept: string, note: string) => Promise<RememberResult>
  forget: (id: string) => Promise<void>
}

export function usePlaces(): PlacesStore {
  const [places, setPlaces] = useState<Place[]>([])
  const [ready, setReady] = useState(false)
  const [here, setHere] = useState<Fix | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = await idb.all<Place>('places')
      if (!cancelled) {
        setPlaces(stored.filter(isPlace))
        setReady(true)
      }
      // Deliberately after the list and deliberately without prompting: the
      // screens that use this are useful with no position at all, and a dialog
      // nobody asked for is how a permission gets denied for good.
      const fix = await positionIfAlreadyAllowed()
      if (!cancelled && fix) setHere(fix)
    })()
    return () => { cancelled = true }
  }, [])

  const nearby = useMemo<NearPlace[]>(() => {
    if (!here) return []
    return places
      .map(place => ({ ...place, metres: metresBetween(here, place) }))
      .filter(place => place.metres <= TOLERANCE_METRES)
      .sort((a, b) => a.metres - b.metres || b.uses - a.uses)
  }, [places, here])

  const remember = useCallback(async (concept: string, note: string): Promise<RememberResult> => {
    const fix = await askForPosition()
    if (fix === 'denied' || fix === 'unavailable') return fix
    setHere(fix)

    // The same concept at the same doorway is the same place. Saving it again
    // counts as a use rather than adding a second row that will always be
    // offered twice.
    const existing = places.find(
      place => place.concept === concept && samePlace(fix, place),
    )
    const place: Place = existing
      ? { ...existing, uses: existing.uses + 1, note: note || existing.note }
      : {
          id: crypto.randomUUID(),
          lat: fix.lat,
          lon: fix.lon,
          accuracy: fix.accuracy,
          concept,
          note,
          savedAt: Date.now(),
          uses: 1,
        }

    await idb.set('places', place.id, place)
    setPlaces(current => [...current.filter(item => item.id !== place.id), place])
    return existing ? 'again' : 'saved'
  }, [places])

  const forget = useCallback(async (id: string) => {
    await idb.del('places', id)
    setPlaces(current => current.filter(place => place.id !== id))
  }, [])

  return { places, ready, here, nearby, remember, forget }
}

/** Guards against a half-written record from an older shape of this store: a
 *  place with no coordinates would match everywhere or nowhere. */
function isPlace(value: unknown): value is Place {
  if (!value || typeof value !== 'object') return false
  const place = value as Partial<Place>
  return typeof place.lat === 'number' && typeof place.lon === 'number' &&
    typeof place.concept === 'string' && place.concept.length > 0
}
