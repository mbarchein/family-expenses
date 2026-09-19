import { describe, expect, it } from 'vitest'
import { FIX_GOOD_FOR, stillHere } from '../lib/position'

/**
 * The best-before on a fix.
 *
 * The wiring around it needs a browser and is tested in `e2e/places.e2e.ts`;
 * this is the boundary it turns on, which does not.
 */
describe('stillHere', () => {
  const NOW = 1_700_000_000_000

  it('is false with no fix at all', () => {
    // Zero is "there has never been one", which is not an old position: it is
    // no position, and offering a doorway for it would be offering a guess.
    expect(stillHere(0, NOW)).toBe(false)
  })

  it('keeps a fix taken a moment ago', () => {
    expect(stillHere(NOW, NOW)).toBe(true)
    expect(stillHere(NOW - 2_000, NOW)).toBe(true)
  })

  it('drops one taken longer ago than a person can walk the tolerance', () => {
    // The arithmetic the constant comes from: 15 m of tolerance at about
    // 1.4 m/s. A fix older than that is a doorway somebody may have left.
    expect(stillHere(NOW - FIX_GOOD_FOR, NOW)).toBe(false)
    expect(stillHere(NOW - 60_000, NOW)).toBe(false)
  })

  it('is right up to the last millisecond either side', () => {
    expect(stillHere(NOW - (FIX_GOOD_FOR - 1), NOW)).toBe(true)
    expect(stillHere(NOW - (FIX_GOOD_FOR + 1), NOW)).toBe(false)
  })
})
