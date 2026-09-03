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

/**
 * How near it is, at the precision that means anything.
 *
 * Reported: a list of five doorways in the same town, read from another one,
 * that said "A 47728 m de aquí" — five digits of metres, wrapping onto a second
 * line, and four of the five differing only in the hundreds. Every one of those
 * digits was a claim: the fix behind it knows itself to ±10 m, so the last three
 * were noise that the eye still has to read past.
 *
 * So the precision falls away with the distance, and the step is always smaller
 * than the accuracy of the thing being measured:
 *
 * - under 100 m, whole metres — the proximity cards live here, where a place
 *   fifteen metres away and one two metres away are a different answer;
 * - under a kilometre, tens of metres;
 * - under ten kilometres, one decimal of a kilometre;
 * - beyond that, whole kilometres.
 *
 * The number is formatted es-ES, so the decimal is a comma. The unit symbol is
 * not here: it is in `strings.ts` with the sentence it belongs to.
 */
export interface Rounded {
  /** The number, already formatted for reading. */
  amount: string
  /** Whether `amount` counts kilometres rather than metres. */
  km: boolean
}

const NUMBER = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

export function roundDistance(metres: number): Rounded {
  const away = Number.isFinite(metres) ? Math.max(0, metres) : 0
  if (away < 100) return { amount: NUMBER.format(Math.round(away)), km: false }

  // Rounded first, then re-read: 997 m is a kilometre once the tens are gone,
  // and "1000 m" is a number nobody says out loud.
  const tens = Math.round(away / 10) * 10
  if (tens < 1000) return { amount: NUMBER.format(tens), km: false }

  const km = tens / 1000
  return { amount: NUMBER.format(km < 10 ? Math.round(km * 10) / 10 : Math.round(km)), km: true }
}

/** Whether two points are close enough to be the same place. */
export function samePlace(a: Point, b: Point, tolerance = TOLERANCE_METRES): boolean {
  return metresBetween(a, b) <= tolerance
}

function radians(degrees: number): number {
  return degrees * Math.PI / 180
}
