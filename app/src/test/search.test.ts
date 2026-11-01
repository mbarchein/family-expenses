import { describe, expect, it } from 'vitest'
import { NO_FILTERS, isFiltered, isNarrowed, matches } from '../lib/search'
import { amountTyped, sameAmount } from '../lib/money'

const row = (over: Partial<Parameters<typeof matches>[0]> = {}) => ({
  concept: 'super', amount: 20, payer: 0, category: 'Comida', date: '2026-08-24', ...over,
})
const only = (fields: Partial<typeof NO_FILTERS>) => ({ ...NO_FILTERS, ...fields })

describe('amountTyped', () => {
  it('reads what somebody types into a search box', () => {
    expect(amountTyped('60')).toBe(60)
    expect(amountTyped('12,5')).toBe(12.5)
    expect(amountTyped('12.50')).toBe(12.5)
    expect(amountTyped('0')).toBe(0)
  })

  it('reads back what the app printed, euro sign and all', () => {
    // Every amount on this screen is written by `formatEur`, and the obvious
    // thing to do with one is to copy it into the box above it.
    expect(amountTyped('1000,00 €')).toBe(1000)
    expect(amountTyped('10.000,50 €')).toBe(10_000.5)
    expect(amountTyped(' 326,72 ')).toBe(326.72)
  })

  it('says no to anything that is not a number', () => {
    // Which is the whole reason this exists rather than `parseAmount`: that one
    // answers 0 for `gaso`, and 0 is a real amount.
    expect(amountTyped('gaso')).toBe(null)
    expect(amountTyped('')).toBe(null)
    expect(amountTyped('  ')).toBe(null)
    expect(amountTyped('12,345')).toBe(null)
    expect(amountTyped('1,2,3')).toBe(null)
    expect(amountTyped('ruta 60')).toBe(null)
  })

  it('says no to grouping that is not grouping', () => {
    // `1.0000` is a typo. Reading it as anything would answer a question
    // nobody asked, silently.
    expect(amountTyped('1.0000')).toBe(null)
    expect(amountTyped('1.00')).toBe(1)        // two decimals, not a group
  })
})

describe('sameAmount', () => {
  it('compares money rather than floats', () => {
    expect(sameAmount(0.1 + 0.2, 0.3)).toBe(true)
    expect(sameAmount(39.9, 39.9)).toBe(true)
    expect(sameAmount(39.9, 39.91)).toBe(false)
  })
})

describe('matches', () => {
  it('takes the search box as a concept or as an amount', () => {
    // Asked for: the quick box finds a row by what it cost, exactly, as well as
    // by what it was called.
    expect(matches(row({ concept: 'gasolina', amount: 60 }), only({ query: '60' }))).toBe(true)
    expect(matches(row({ concept: 'gasolina', amount: 60 }), only({ query: '60,00' }))).toBe(true)
    expect(matches(row({ concept: 'gasolina', amount: 61 }), only({ query: '60' }))).toBe(false)
    expect(matches(row({ concept: 'gasolina', amount: 60 }), only({ query: 'gaso' }))).toBe(true)
  })

  it('does not stop searching concepts because a query looks like a number', () => {
    // `60` is both questions at once, and a box that quietly chose one would
    // lose rows without saying so.
    expect(matches(row({ concept: 'ruta 60', amount: 7 }), only({ query: '60' }))).toBe(true)
  })

  it('matches an amount exactly, which is what a quick search is for', () => {
    // Ranges are the advanced search's job. A quick search is for the row you
    // remember, and the amount is the thing you remember about it.
    expect(matches(row({ amount: 39.9 }), only({ query: '39,9' }))).toBe(true)
    expect(matches(row({ amount: 39.9 }), only({ query: '39' }))).toBe(false)
  })

  it('keeps everything from the bound upwards, and the bound itself', () => {
    expect(matches(row({ amount: 50 }), only({ min: '50' }))).toBe(true)
    expect(matches(row({ amount: 49.99 }), only({ min: '50' }))).toBe(false)
    expect(matches(row({ amount: 50 }), only({ max: '50' }))).toBe(true)
    expect(matches(row({ amount: 50.01 }), only({ max: '50' }))).toBe(false)
    expect(matches(row({ amount: 30 }), only({ min: '20', max: '40' }))).toBe(true)
    expect(matches(row({ amount: 10 }), only({ min: '20', max: '40' }))).toBe(false)
  })

  it('leaves the list alone while a bound is still being typed', () => {
    // An empty box is "no limit at this end", not nought — and half a number is
    // not a reason to empty the list under somebody's hands.
    expect(matches(row({ amount: 20 }), only({ min: '' }))).toBe(true)
    expect(matches(row({ amount: 20 }), only({ min: ',' }))).toBe(true)
  })

  it('takes both ends of a date range, inclusive', () => {
    expect(matches(row({ date: '2026-08-24' }), only({ from: '2026-08-24' }))).toBe(true)
    expect(matches(row({ date: '2026-08-23' }), only({ from: '2026-08-24' }))).toBe(false)
    expect(matches(row({ date: '2026-08-24' }), only({ to: '2026-08-24' }))).toBe(true)
    expect(matches(row({ date: '2026-08-25' }), only({ to: '2026-08-24' }))).toBe(false)
  })

  it('narrows by all of them at once', () => {
    const entry = row({ concept: 'luz', amount: 80, payer: 1, date: '2026-03-10' })
    expect(matches(entry, only({
      payer: '1', query: 'lu', min: '50', max: '100', from: '2026-01-01', to: '2026-12-31',
    }))).toBe(true)
    // One condition short is no match, which is what "and" means and is worth
    // one test: an `||` slipped in here would look right in every other case.
    expect(matches(entry, only({ payer: '0', query: 'lu' }))).toBe(false)
  })

  it('folds the category, because that tab is edited by hand', () => {
    expect(matches(row({ category: 'Educación' }), only({ category: 'educacion' }))).toBe(true)
    expect(matches(row({ category: undefined }), only({ category: '' }))).toBe(true)
  })

  it('keeps everything when nothing is asked', () => {
    expect(matches(row(), NO_FILTERS)).toBe(true)
    expect(isFiltered(NO_FILTERS)).toBe(false)
  })
})

describe('isFiltered and isNarrowed', () => {
  it('knows that a range is a filter', () => {
    expect(isFiltered(only({ min: '10' }))).toBe(true)
    expect(isFiltered(only({ from: '2026-01-01' }))).toBe(true)
  })

  it('tells the two kinds apart, which is what lights the button', () => {
    // The quick box says what it is doing on its face. A range folded behind a
    // dialog is the one filter on that screen that cannot be seen from it.
    expect(isNarrowed(only({ query: 'luz' }))).toBe(false)
    expect(isNarrowed(only({ payer: '1' }))).toBe(false)
    expect(isNarrowed(only({ max: '40' }))).toBe(true)
    expect(isNarrowed(only({ to: '2026-01-01' }))).toBe(true)
  })
})
