import { describe, expect, it } from 'vitest'
import { displayTyped, parseAmount } from '../lib/money'

describe('parseAmount', () => {
  it('reads a comma as the decimal separator', () => {
    expect(parseAmount('12,50')).toBe(12.5)
  })

  it('survives the trailing comma the user types on the way to the cents', () => {
    expect(parseAmount('12,')).toBe(12)
  })

  it('is zero while nothing has been typed', () => {
    expect(parseAmount('')).toBe(0)
  })
})

describe('displayTyped', () => {
  it('groups thousands without touching what is being typed', () => {
    expect(displayTyped('3000')).toBe('3.000')
    expect(displayTyped('3000,5')).toBe('3.000,5')
  })

  it('keeps a lone trailing comma visible', () => {
    expect(displayTyped('12,')).toBe('12,')
  })
})
