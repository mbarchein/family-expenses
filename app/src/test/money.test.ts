import { describe, expect, it } from 'vitest'
import { displayTyped, parseAmount, typedFromAmount, typedFrom } from '../lib/money'

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

describe('typedFromAmount', () => {
  it('is what somebody would have typed for that amount', () => {
    // The inverse of parseAmount, and it has to exist: everything downstream of
    // the keypad reads the typed string, so a number dropped into the draft
    // shows 0 on screen and saves nothing.
    expect(typedFromAmount(700)).toBe('700')
    expect(typedFromAmount(23.5)).toBe('23,50')
    expect(typedFromAmount(0.05)).toBe('0,05')
  })

  it('round-trips through parseAmount', () => {
    for (const amount of [700, 23.5, 0.05, 1234.56, 9.99]) {
      expect(parseAmount(typedFromAmount(amount))).toBe(amount)
    }
  })

  it('gives nothing for an amount there is no point typing', () => {
    expect(typedFromAmount(0)).toBe('')
    expect(typedFromAmount(-5)).toBe('')
    expect(typedFromAmount(NaN)).toBe('')
  })
})

describe('typedFrom', () => {
  it('takes a full stop as the comma it was meant to be', () => {
    // The point on a phone's numeric keyboard, and the decimal key on an
    // external one. Both used to be stripped in silence.
    expect(typedFrom('12.50')).toBe('12,50')
    expect(typedFrom('12.')).toBe('12,')
    expect(typedFrom('.5')).toBe('0,5')
  })

  it('keeps one separator and two decimals, like the keypad', () => {
    expect(typedFrom('12,5,3')).toBe('12,53')
    expect(typedFrom('12,505')).toBe('12,50')
    expect(typedFrom('0012')).toBe('12')
  })

  it('drops anything that is not a number', () => {
    expect(typedFrom('12 €')).toBe('12')
    expect(typedFrom('abc')).toBe('')
    expect(typedFrom('')).toBe('')
  })

  it('leaves a lone zero alone, since it is on the way to the cents', () => {
    expect(typedFrom('0')).toBe('0')
    expect(typedFrom('0,')).toBe('0,')
  })
})
