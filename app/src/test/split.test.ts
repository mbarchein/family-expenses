import { describe, expect, it } from 'vitest'
import { splitTransfer } from '../lib/split'

/** What the sheet will read after the transfer is entered as two rows. */
const after = (difference: number, shares: [number, number]) =>
  Math.round((difference + shares[0] - shares[1]) * 100) / 100

describe('splitTransfer', () => {
  it('adds up to exactly the transfer that was typed', () => {
    const { shares } = splitTransfer(3000, 1850.87)
    expect(shares[0] + shares[1]).toBeCloseTo(3000, 2)
  })

  it('reports the cent it cannot split instead of pretending it is zero', () => {
    const { shares, residual } = splitTransfer(3000, 1850.87)
    expect(shares).toEqual([574.56, 2425.44])
    expect(residual).toBe(-0.01)
    expect(after(1850.87, shares)).toBe(residual)
  })

  it('leaves the odd cent with whoever was behind', () => {
    // Person 1 was ahead, so person 2 pays the extra cent and ends up ahead by
    // it — never the other way round.
    expect(splitTransfer(3000, 1850.87).residual).toBeLessThan(0)
    expect(splitTransfer(3000, -1850.87).residual).toBeGreaterThan(0)
  })

  it('comes out exact when the difference is an even number of cents', () => {
    const { shares, residual } = splitTransfer(3000, 1850.86)
    expect(shares).toEqual([574.57, 2425.43])
    expect(residual).toBe(0)
  })

  it('splits down the middle when nobody is ahead', () => {
    expect(splitTransfer(600, 0)).toEqual({ shares: [300, 300], residual: 0 })
  })

  it('mirrors when the other person is ahead', () => {
    expect(splitTransfer(600, -360)).toEqual({ shares: [480, 120], residual: 0 })
  })

  it('gives the whole transfer to whoever is behind when it cannot even out', () => {
    const { shares, residual } = splitTransfer(100, 500)
    expect(shares).toEqual([0, 100])
    expect(residual).toBe(400)
  })
})
