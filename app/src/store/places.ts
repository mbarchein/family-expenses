import { useCallback, useEffect, useMemo, useState } from 'react'
import { idb } from './db'
import { TOLERANCE_METRES, metresBetween, samePlace } from '../lib/geo'
import {
  askForPosition, positionIfAlreadyAllowed, type Fix, type PositionFailure,
} from '../lib/position'

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
   *  shop it tends to be the same card, and it costs nothing to offer.
   *
   *  Called `note` until the method got a column of its own — it was always this,
   *  it just travelled inside the observaciones. Places already on a phone still
   *  have the old key, so reading one falls back to it. */
  method: string
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
  /** Reads where the phone is, prompting if the permission has not been decided
   *  yet. Only ever reached from a control that says it will ask. */
  locateNow: () => Promise<Fix | PositionFailure>
  /** Whether this doorway already holds this concept. Asked by the review
   *  step's switch, which has a fix in hand and no business recomputing the
   *  tolerance itself. */
  knows: (fix: Fix, concept: string) => boolean
  /**
   * Counts one more use of a place already saved, by id.
   *
   * For the doorway the review step recognises rather than offers to save: there
   * is no switch to flick there and no position in hand, so this is how `uses`
   * keeps meaning "how often this doorway is really the one" — which is what
   * orders the cards. No coordinate is read, written or changed; it is a counter
   * on a row that already exists.
   */
  countUse: (id: string) => Promise<void>
  /** Stores a fix already in hand against this concept. Separate from reading
   *  it because the two happen at different times: the switch on the review
   *  step reads the position when it is turned on, and the place is written
   *  only if the expense it belongs to is saved. */
  rememberAt: (fix: Fix, concept: string, method: string) => Promise<RememberResult>
  forget: (id: string) => Promise<void>
}

/**
 * `locate` asks for the position on mount — but only where it is already
 * allowed, and never with a prompt. It is opt-in because two screens need it
 * (the chips on the second step, the distances on the places screen) and one
 * does not: the flow that only ever writes a place would otherwise read the GPS
 * on every mount for nothing.
 */
export interface PlacesOptions {
  locate?: boolean
}

export function usePlaces({ locate = false }: PlacesOptions = {}): PlacesStore {
  const [places, setPlaces] = useState<Place[]>([])
  const [ready, setReady] = useState(false)
  const [here, setHere] = useState<Fix | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = await idb.all<Place>('places')
      if (!cancelled) {
        setPlaces(stored.filter(isPlace).map(readPlace))
        setReady(true)
      }
      // Deliberately after the list and deliberately without prompting: the
      // screens that use this are useful with no position at all, and a dialog
      // nobody asked for is how a permission gets denied for good.
      if (!locate) return
      const fix = await positionIfAlreadyAllowed()
      if (!cancelled && fix) setHere(fix)
    })()
    return () => { cancelled = true }
  }, [locate])

  const nearby = useMemo<NearPlace[]>(() => {
    if (!here) return []
    return places
      .map(place => ({ ...place, metres: metresBetween(here, place) }))
      .filter(place => place.metres <= TOLERANCE_METRES)
      .sort((a, b) => a.metres - b.metres || b.uses - a.uses)
  }, [places, here])

  const locateNow = useCallback(async () => {
    const fix = await askForPosition()
    if (fix !== 'denied' && fix !== 'unavailable') setHere(fix)
    return fix
  }, [])

  const knows = useCallback(
    (fix: Fix, concept: string) =>
      places.some(place => place.concept === concept && samePlace(fix, place)),
    [places],
  )

  const rememberAt = useCallback(async (
    fix: Fix, concept: string, method: string,
  ): Promise<RememberResult> => {
    // The same concept at the same doorway is the same place. Saving it again
    // counts as a use rather than adding a second row that will always be
    // offered twice.
    const existing = places.find(
      place => place.concept === concept && samePlace(fix, place),
    )
    const place: Place = existing
      ? { ...existing, uses: existing.uses + 1, method: method || existing.method }
      : {
          id: crypto.randomUUID(),
          lat: fix.lat,
          lon: fix.lon,
          accuracy: fix.accuracy,
          concept,
          method,
          savedAt: Date.now(),
          uses: 1,
        }

    await idb.set('places', place.id, place)
    setPlaces(current => [...current.filter(item => item.id !== place.id), place])
    return existing ? 'again' : 'saved'
  }, [places])

  const countUse = useCallback(async (id: string) => {
    // Read back from the disk rather than from `places`, because the caller is
    // the save on the review step and this hook's copy of the list belongs to a
    // screen that has been mounted since before the flow started. Two expenses
    // apuntados at the same doorway in one session would otherwise both write
    // "uses: 2".
    const stored = await idb.get<Place>('places', id)
    if (!isPlace(stored)) return
    const place = { ...stored, uses: stored.uses + 1 }
    await idb.set('places', id, place)
    setPlaces(current => current.map(item => (item.id === id ? place : item)))
  }, [])

  const forget = useCallback(async (id: string) => {
    await idb.del('places', id)
    setPlaces(current => current.filter(place => place.id !== id))
  }, [])

  return { places, ready, here, nearby, locateNow, knows, rememberAt, countUse, forget }
}

/** Guards against a half-written record from an older shape of this store: a
 *  place with no coordinates would match everywhere or nowhere. */
/**
 * A stored place, with the field the method used to live under.
 *
 * It was called `note` while the payment method travelled inside the
 * observaciones — the field's own comment already said it held the method. Places
 * live on the phone and nowhere else, so nothing migrates them for us: the ones
 * saved before the rename are read here or not at all.
 */
function readPlace(place: Place): Place {
  if (place.method !== undefined) return place
  const legacy = (place as Place & { note?: string }).note
  return { ...place, method: typeof legacy === 'string' ? legacy : '' }
}

function isPlace(value: unknown): value is Place {
  if (!value || typeof value !== 'object') return false
  const place = value as Partial<Place>
  return typeof place.lat === 'number' && typeof place.lon === 'number' &&
    typeof place.concept === 'string' && place.concept.length > 0
}
