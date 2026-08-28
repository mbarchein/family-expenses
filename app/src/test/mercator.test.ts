import { describe, expect, it } from 'vitest'
import { TILE, metresPerPixel, panned, pointOf, tileOf } from '../lib/mercator'
import { metresBetween } from '../lib/geo'

/** The fixture doorway in Granada, where the app is actually used: 37° north is
 *  far enough from the equator that a longitude degree is a fifth shorter than a
 *  latitude one, which is where sign and scale errors show up. */
const DOOR = { lat: 37.1773, lon: -3.5986, accuracy: 40 }
const ZOOM = 17

describe('the projection', () => {
  it('comes back to where it started', () => {
    const tile = tileOf(DOOR.lat, DOOR.lon, ZOOM)
    const back = pointOf(tile.x, tile.y, ZOOM)

    expect(back.lat).toBeCloseTo(DOOR.lat, 9)
    expect(back.lon).toBeCloseTo(DOOR.lon, 9)
  })

  it('names a whole tile per 256 pixels', () => {
    const here = tileOf(DOOR.lat, DOOR.lon, ZOOM)
    const east = tileOf(DOOR.lat, DOOR.lon + 0.01, ZOOM)
    expect(east.x).toBeGreaterThan(here.x)
    // A tile is 256 px of ground at this latitude and zoom. Within a tenth of a
    // percent of the haversine distance, which is the two models disagreeing —
    // Mercator scales by the cosine of the latitude, the sphere does not — and
    // not a reason for either to be wrong.
    const pixels = (east.x - here.x) * TILE * metresPerPixel(DOOR.lat, ZOOM)
    const ground = metresBetween(DOOR, { lat: DOOR.lat, lon: DOOR.lon + 0.01 })
    expect(Math.abs(pixels - ground) / ground).toBeLessThan(0.002)
  })
})

describe('panned', () => {
  it('moves the point against the drag, by what was dragged', () => {
    // Dragging the map to the right pulls the world east under a centre that
    // does not move, so the point the centre names goes west. Getting this
    // backwards would move somebody's doorway quietly the wrong way, which is
    // the reason this maths lives in a file with a test.
    const west = panned(DOOR, 40, 0, ZOOM)
    expect(west.lon).toBeLessThan(DOOR.lon)
    expect(metresBetween(DOOR, west)).toBeCloseTo(40 * metresPerPixel(DOOR.lat, ZOOM), 1)

    // And dragging down brings what was above the centre into it, so the point
    // goes north — the same "against the drag", which is worth stating because
    // "down is south" is the sentence a reader is about to think.
    const north = panned(DOOR, 0, 40, ZOOM)
    expect(north.lat).toBeGreaterThan(DOOR.lat)
    expect(metresBetween(DOOR, north)).toBeCloseTo(40 * metresPerPixel(DOOR.lat, ZOOM), 1)
  })

  it('leaves the accuracy alone', () => {
    // Moving the map says nothing about how sure the device was. What a
    // hand-placed point is worth is decided by whoever placed it — see
    // `PLACED_METRES`.
    expect(panned(DOOR, 30, -12, ZOOM).accuracy).toBe(DOOR.accuracy)
  })

  it('adds up to nothing when the drag goes back', () => {
    const there = panned(DOOR, 55, -21, ZOOM)
    const back = panned(there, -55, 21, ZOOM)
    expect(metresBetween(DOOR, back)).toBeLessThan(0.01)
  })
})
