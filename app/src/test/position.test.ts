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

  it('keeps a fix through the length of a gasto', () => {
    // The window this is for: writing a concept, opening the category picker and
    // stepping back is a normal minute of apuntando one expense, and none of it
    // should send the app back to the GPS.
    expect(stillHere(NOW, NOW)).toBe(true)
    expect(stillHere(NOW - 2_000, NOW)).toBe(true)
    expect(stillHere(NOW - 90_000, NOW)).toBe(true)
  })

  it('drops one from long enough ago to be another doorway', () => {
    expect(stillHere(NOW - FIX_GOOD_FOR, NOW)).toBe(false)
    expect(stillHere(NOW - 600_000, NOW)).toBe(false)
  })

  it('is right up to the last millisecond either side', () => {
    expect(stillHere(NOW - (FIX_GOOD_FOR - 1), NOW)).toBe(true)
    expect(stillHere(NOW - (FIX_GOOD_FOR + 1), NOW)).toBe(false)
  })
})
