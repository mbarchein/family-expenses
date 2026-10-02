import { describe, expect, it } from 'vitest'
import { earliestDay, matchedTotal, monthlyTotals, yearTotal, latestDay } from '../lib/totals'

const entry = (date: string, amount: number, voided = false) => ({ date, amount, voided })

describe('monthlyTotals', () => {
  const months = (list: ReturnType<typeof monthlyTotals>) => list.map(item => item.month)

  it('is a cell per month, newest first, back to the oldest entry', () => {
    const list = monthlyTotals([
      entry('2026-08-24', 10),
      entry('2026-08-01', 5),
      entry('2026-07-31', 100),
      entry('2026-05-02', 7),
    ], '2026-08-24')

    expect(months(list)).toEqual(['2026-08', '2026-07', '2026-06', '2026-05'])
    expect(list[0].total).toBe(15)
    expect(list[1].total).toBe(100)
  })

  it('leaves no month out, however empty', () => {
    // The band reads as one continuous strip under a thumb. A month nobody spent
    // anything in is a zero on it, not a jump from July to April.
    const list = monthlyTotals([entry('2026-08-24', 10), entry('2026-04-04', 3)], '2026-08-24')
    expect(months(list)).toEqual(['2026-08', '2026-07', '2026-06', '2026-05', '2026-04'])
    expect(list.map(item => item.total)).toEqual([10, 0, 0, 0, 3])
  })

  it('knows that the month before January is December of the year before', () => {
    // `month - 1` gets this wrong, and gets it wrong once a year.
    const list = monthlyTotals([entry('2026-01-05', 20), entry('2025-12-20', 300)], '2026-01-15')
    expect(months(list)).toEqual(['2026-01', '2025-12'])
    expect(list[1].total).toBe(300)
  })

  it('still shows two months when there is nothing to show', () => {
    // An empty ledger, or a filter that matches only today: one lonely cell on a
    // band built for three would read as something that failed to load.
    expect(months(monthlyTotals([], '2026-08-24'))).toEqual(['2026-08', '2026-07'])
    expect(months(monthlyTotals([entry('2026-08-24', 10)], '2026-08-24')))
      .toEqual(['2026-08', '2026-07'])
  })

  it('leaves voided entries out without losing their month', () => {
    const list = monthlyTotals([
      entry('2026-08-24', 10),
      entry('2026-08-23', 999, true),
      entry('2026-06-10', 999, true),
    ], '2026-08-24')

    expect(list[0].total).toBe(10)
    // June was voided away, so the band stops at the two it always shows rather
    // than reaching back for a month that came to nothing.
    expect(months(list)).toEqual(['2026-08', '2026-07'])
  })

  it('starts at the month we are in, whatever is dated after it', () => {
    // A row dated next month is not a cell: the band goes backwards from today.
    const list = monthlyTotals([entry('2026-09-01', 50), entry('2026-08-24', 10)], '2026-08-24')
    expect(months(list)).toEqual(['2026-08', '2026-07'])
  })

  it('sums whatever it is handed, which is how the filter reaches it', () => {
    // The screen passes the filtered entries. This function has no opinion about
    // who paid or what was searched for, and that is the whole mechanism.
    const all = [entry('2026-08-24', 10), entry('2026-08-24', 90)]
    expect(monthlyTotals(all, '2026-08-24')[0].total).toBe(100)
    expect(monthlyTotals(all.slice(0, 1), '2026-08-24')[0].total).toBe(10)
  })
})

describe('yearTotal', () => {
  it('counts this calendar year and nothing else', () => {
    expect(yearTotal([
      entry('2026-08-24', 10),
      entry('2026-01-02', 7),
      entry('2025-12-31', 1000),
    ], '2026-08-24')).toBe(17)
  })

  it('is not the sum of the months on the band', () => {
    // December is recent and belongs to last year, which is the case that
    // catches people out every January — and the reason this is its own pass
    // rather than a column added up.
    expect(yearTotal([entry('2026-01-05', 20), entry('2025-12-20', 300)], '2026-01-15')).toBe(20)
  })

  it('leaves voided entries out, and is zero rather than undefined', () => {
    expect(yearTotal([entry('2026-08-24', 999, true)], '2026-08-24')).toBe(0)
    expect(yearTotal([], '2026-08-24')).toBe(0)
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

describe('latestDay', () => {
  it('is the last day present, whatever order the rows arrive in', () => {
    expect(latestDay([{ date: '2026-01-04' }, { date: '2026-08-26' }, { date: '2026-03-01' }]))
      .toBe('2026-08-26')
  })

  it('is null for an empty list, so the range can say there is none', () => {
    expect(latestDay([])).toBe(null)
  })
})

describe('matchedTotal', () => {
  it('adds up everything it is given, whatever month it is in', () => {
    // The point of the number: the three cells above it are months, and a filter
    // is usually asking what something costs rather than what it cost in August.
    const matched = matchedTotal([
      entry('2026-08-24', 10),
      entry('2026-02-03', 5),
      entry('2024-11-30', 1000),
    ])

    expect(matched.total).toBe(1015)
    expect(matched.count).toBe(3)
    expect(matched.from).toBe('2024-11-30')
    expect(matched.to).toBe('2026-08-24')
  })

  it('leaves out the voided rows, and does not count them either', () => {
    // They stay in the list struck through and their amounts are gone from the
    // sheet, so a count beside this total has to mean the rows it is made of.
    const matched = matchedTotal([
      entry('2026-08-24', 10),
      entry('2026-08-20', 0, true),
    ])

    expect(matched.total).toBe(10)
    expect(matched.count).toBe(1)
    expect(matched.from).toBe('2026-08-24')
  })

  it('has no span at all when nothing matches', () => {
    expect(matchedTotal([])).toEqual({ total: 0, count: 0, from: null, to: null })
  })
})
