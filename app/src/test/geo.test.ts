import { describe, expect, it } from 'vitest'
import { TOLERANCE_METRES, metresBetween, roundDistance, samePlace } from '../lib/geo'

// A doorway in Granada, which is where this app is used and 37° from the
// equator — far enough north that a longitude degree is a fifth shorter than a
// latitude one.
const DOOR = { lat: 37.1773, lon: -3.5986 }

describe('metresBetween', () => {
  it('is zero for the same point', () => {
    expect(metresBetween(DOOR, DOOR)).toBe(0)
  })

  it('measures a latitude step against the known length of a degree', () => {
    // 111.2 km per degree of latitude, everywhere on the globe.
    expect(metresBetween(DOOR, { ...DOOR, lat: DOOR.lat + 0.001 })).toBeCloseTo(111.2, 0)
  })

  it('shortens a longitude step by the cosine of the latitude', () => {
    // The bug this rules out: treating a longitude degree as 111 km at every
    // latitude. Here it is 88.6 km, so the same numeric step is a fifth shorter
    // than the one above — and at the 15 m tolerance that is the difference
    // between the shop next door and this one.
    expect(metresBetween(DOOR, { ...DOOR, lon: DOOR.lon + 0.001 })).toBeCloseTo(88.6, 0)
  })

  it('is symmetric', () => {
    const other = { lat: 37.1801, lon: -3.6002 }
    expect(metresBetween(DOOR, other)).toBeCloseTo(metresBetween(other, DOOR), 6)
  })
})

describe('samePlace', () => {
  it('accepts a step inside the tolerance and refuses one outside it', () => {
    // 0.0001° of latitude is 11.1 m: the same doorway. 0.0002° is 22.2 m: not.
    expect(samePlace(DOOR, { ...DOOR, lat: DOOR.lat + 0.0001 })).toBe(true)
    expect(samePlace(DOOR, { ...DOOR, lat: DOOR.lat + 0.0002 })).toBe(false)
  })

  it('cuts off within a centimetre of the tolerance', () => {
    // A centimetre either side rather than exactly on it: the radius and the
    // latitude degree are both irrational in metres, and a test that hangs on
    // the last bit of a float tests the float. Derived from the constant, so
    // this keeps testing the boundary if the radius ever moves.
    const degreesPerMetre = 1 / 111_195
    const step = (metres: number) => ({ ...DOOR, lat: DOOR.lat + metres * degreesPerMetre })
    expect(samePlace(DOOR, step(TOLERANCE_METRES - 0.01))).toBe(true)
    expect(samePlace(DOOR, step(TOLERANCE_METRES + 0.01))).toBe(false)
  })

  it('does not confuse a longitude step for a latitude one', () => {
    // 0.00015°: 16.7 m as latitude, 13.3 m as longitude. One is the same place
    // and the other is not, and only the cosine tells them apart.
    expect(samePlace(DOOR, { ...DOOR, lat: DOOR.lat + 0.00015 })).toBe(false)
    expect(samePlace(DOOR, { ...DOOR, lon: DOOR.lon + 0.00015 })).toBe(true)
  })
})

describe('roundDistance', () => {
  const said = (metres: number) => {
    const away = roundDistance(metres)
    return `${away.amount} ${away.km ? 'km' : 'm'}`
  }

  it('keeps whole metres where the tolerance lives', () => {
    // The proximity cards only ever show distances inside TOLERANCE_METRES, so
    // this range is the one where every metre changes the answer.
    expect(said(0)).toBe('0 m')
    expect(said(2.4)).toBe('2 m')
    expect(said(14.6)).toBe('15 m')
    expect(said(99)).toBe('99 m')
  })

  it('drops to tens of metres beyond a hundred', () => {
    expect(said(104)).toBe('100 m')
    expect(said(137)).toBe('140 m')
    expect(said(986)).toBe('990 m')
  })

  it('says a kilometre rather than a thousand metres', () => {
    // 997 rounds to 1000 m, which is the number nobody says. The unit has to be
    // chosen after the rounding, not before it.
    expect(said(997)).toBe('1 km')
    expect(said(1234)).toBe('1,2 km')
    expect(said(9940)).toBe('9,9 km')
  })

  it('drops the decimal past ten kilometres', () => {
    // The reported one: five doorways in the same town, seen from another.
    expect(said(9951)).toBe('10 km')
    expect(said(47_728)).toBe('48 km')
    expect(said(48_235)).toBe('48 km')
  })

  it('never shows a negative or a NaN', () => {
    // Both are unreachable through metresBetween, and both would be read as a
    // fact about where the phone is if they ever got out.
    expect(said(-5)).toBe('0 m')
    expect(said(Number.NaN)).toBe('0 m')
    expect(said(Number.POSITIVE_INFINITY)).toBe('0 m')
  })
})
