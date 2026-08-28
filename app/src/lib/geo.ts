/**
 * Distance between two points on the ground, and what counts as the same place.
 *
 * The tolerance is fifteen metres, which is smaller than the fix most phones
 * report indoors. That is deliberate and it is the interesting part: a shop next
 * door is fifteen metres away, so a radius wide enough to always match would
 * match the wrong shop. The accuracy of each fix is stored with the place —
 * see `store/places.ts` — so a place that never matches can be seen for what it
 * is rather than guessed at.
 */

export const TOLERANCE_METRES = 15

/**
 * How sure a position is when a person put it there rather than a phone.
 *
 * A point placed by dragging a street map has no device accuracy at all, and
 * leaving the old number beside it would be a claim about a fix that has just
 * been thrown away. Ten metres is what a fingertip on a street-level map is
 * worth — the doorway is visible, the exact pixel is not — and it is inside the
 * fifteen the tolerance allows, which is the whole reason somebody bothered to
 * move it.
 */
export const PLACED_METRES = 10

export interface Point {
  lat: number
  lon: number
}

const EARTH_RADIUS_METRES = 6_371_008.8

/**
 * Great-circle distance in metres.
 *
 * Haversine rather than the flat approximation. At these distances the two agree
 * to well under a metre, but the flat version needs a cosine of the latitude to
 * scale longitude and getting that wrong is a bug that only shows up far from
 * the equator — the kind of thing that works in testing and not in Granada.
 */
export function metresBetween(a: Point, b: Point): number {
  const lat1 = radians(a.lat)
  const lat2 = radians(b.lat)
  const dLat = lat2 - lat1
  const dLon = radians(b.lon - a.lon)

  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2

  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Whether two points are close enough to be the same place. */
export function samePlace(a: Point, b: Point, tolerance = TOLERANCE_METRES): boolean {
  return metresBetween(a, b) <= tolerance
}

function radians(degrees: number): number {
  return degrees * Math.PI / 180
}
