import { describe, expect, it } from 'vitest'
import { earliestDay, summarise, yearIsPartial, latestDay } from '../lib/totals'

const entry = (date: string, amount: number, voided = false) => ({ date, amount, voided })

describe('summarise', () => {
  it('splits the loaded entries into last month, this month and this year', () => {
    const totals = summarise([
      entry('2026-08-24', 10),
      entry('2026-08-01', 5),
      entry('2026-07-31', 100),
      entry('2026-01-02', 7),
      entry('2025-12-31', 1000),
    ], '2026-08-24')

    expect(totals.current).toBe(15)
    expect(totals.previous).toBe(100)
    // Everything dated 2026, including the two months above; nothing from 2025.
    expect(totals.year).toBe(122)
  })

  it('knows that the month before January is December of the year before', () => {
    // `month - 1` gets this wrong, and gets it wrong once a year.
    const totals = summarise([
      entry('2026-01-05', 20),
      entry('2025-12-20', 300),
    ], '2026-01-15')

    expect(totals.previousMonth).toBe('2025-12')
    expect(totals.current).toBe(20)
    expect(totals.previous).toBe(300)
    // The December expense is last year's, however recent it feels.
    expect(totals.year).toBe(20)
  })

  it('leaves voided entries out of every total', () => {
    const totals = summarise([
      entry('2026-08-24', 10),
      entry('2026-08-23', 999, true),
      entry('2026-07-10', 999, true),
    ], '2026-08-24')

    expect(totals).toMatchObject({ current: 10, previous: 0, year: 10 })
  })

  it('is zero for an empty list rather than undefined', () => {
    expect(summarise([], '2026-08-24')).toMatchObject({ current: 0, previous: 0, year: 0 })
  })

  it('sums whatever it is handed, which is how the filter reaches it', () => {
    // The screen passes the filtered entries. This function has no opinion about
    // who paid or what was searched for, and that is the whole mechanism.
    const all = [entry('2026-08-24', 10), entry('2026-08-24', 90)]
    expect(summarise(all, '2026-08-24').current).toBe(100)
    expect(summarise(all.slice(0, 1), '2026-08-24').current).toBe(10)
  })
})

describe('earliestDay', () => {
  it('finds the oldest day in any order', () => {
    expect(earliestDay([{ date: '2026-08-24' }, { date: '2026-03-03' }, { date: '2026-05-01' }]))
      .toBe('2026-03-03')
  })

  it('is null when there is nothing loaded', () => {
    expect(earliestDay([])).toBeNull()
  })
})

describe('yearIsPartial', () => {
  it('is true when the window starts after the first of January', () => {
    // The app loads the last few hundred rows, so on a busy ledger the year
    // total is a floor. Saying so is the difference between a number and a lie.
    expect(yearIsPartial('2026-03-03', '2026-08-24')).toBe(true)
    expect(yearIsPartial('2026-01-01', '2026-08-24')).toBe(false)
    expect(yearIsPartial('2025-11-30', '2026-08-24')).toBe(false)
    expect(yearIsPartial(null, '2026-08-24')).toBe(false)
  })
})

describe('latestDay', () => {
  it('is the last day present, whatever order the rows arrive in', () => {
    expect(latestDay([{ date: '2026-01-04' }, { date: '2026-08-26' }, { date: '2026-03-01' }]))
      .toBe('2026-08-26')
  })

  it('is null for an empty list, so the range can say there is none', () => {
    expect(latestDay([])).toBe(null)
  })
})
