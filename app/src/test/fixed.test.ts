import { describe, expect, it } from 'vitest'
import { addMonths, alreadyThere, dueDay, whatIsDue, type Template } from '../lib/fixed'

const template = (over: Partial<Template> = {}): Template => ({
  row: 2,
  concept: 'alquiler',
  amount: 700,
  day: 1,
  payer: 0,
  months: 1,
  active: true,
  category: 'Hogar',
  from: '',
  last: '',
  ...over,
})

describe('dueDay', () => {
  it('clamps to the length of the month', () => {
    // The failure this prevents: `new Date(2026, 1, 31)` is the 3rd of March.
    // A rent due on the 31st falls on the 28th of February, not in March.
    expect(dueDay('2026-02-10', 31)).toBe('2026-02-28')
    expect(dueDay('2024-02-10', 31)).toBe('2024-02-29')   // a leap year
    expect(dueDay('2026-04-10', 31)).toBe('2026-04-30')
    expect(dueDay('2026-01-10', 31)).toBe('2026-01-31')
  })

  it('leaves a day that exists alone', () => {
    expect(dueDay('2026-08-24', 1)).toBe('2026-08-01')
    expect(dueDay('2026-08-01', 15)).toBe('2026-08-15')
  })
})

describe('addMonths', () => {
  it('crosses the end of the year', () => {
    expect(addMonths('2026-11-15', 1, 15)).toBe('2026-12-15')
    expect(addMonths('2026-12-15', 1, 15)).toBe('2027-01-15')
    expect(addMonths('2026-12-15', 12, 15)).toBe('2027-12-15')
  })

  it('keeps the day where it can and clamps where it cannot', () => {
    expect(addMonths('2026-01-31', 1, 31)).toBe('2026-02-28')
    // And recovers the 31st afterwards rather than staying on the 28th, which is
    // what walking forward from the clamped date would do.
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31')
  })
})

describe('whatIsDue', () => {
  it('proposes this month once the day has arrived, and not before', () => {
    expect(whatIsDue([template({ day: 5 })], '2026-08-04')).toEqual([])
    expect(whatIsDue([template({ day: 5 })], '2026-08-05')).toMatchObject([{ due: '2026-08-05' }])
  })

  it('does not reach back before the template existed', () => {
    // A rent added in August owes August, not the seven months before it.
    const due = whatIsDue([template({ day: 1 })], '2026-08-24')
    expect(due).toHaveLength(1)
    expect(due[0].due).toBe('2026-08-01')
  })

  it('proposes every missed period, oldest first', () => {
    // Two months of not opening the app. The ledger wants both rows, each with
    // its own date, so both are offered rather than the newest one only.
    const due = whatIsDue([template({ day: 1, last: '2026-05-01' })], '2026-08-24')
    expect(due.map(item => item.due)).toEqual(['2026-06-01', '2026-07-01', '2026-08-01'])
  })

  it('says nothing about a period already settled', () => {
    expect(whatIsDue([template({ day: 1, last: '2026-08-01' })], '2026-08-24')).toEqual([])
  })

  it('keeps a longer cadence in phase with its anchor', () => {
    // Water every two months from January: March, May, July — never April.
    const water = template({ concept: 'agua', day: 10, months: 2, from: '2026-01-10' })
    expect(whatIsDue([water], '2026-08-24').map(item => item.due))
      .toEqual(['2026-01-10', '2026-03-10', '2026-05-10', '2026-07-10'])
  })

  it('counts a yearly template once a year', () => {
    const insurance = template({ concept: 'seguro', day: 15, months: 12, from: '2025-03-15' })
    expect(whatIsDue([insurance], '2026-08-24').map(item => item.due))
      .toEqual(['2025-03-15', '2026-03-15'])
  })

  it('ignores what is switched off', () => {
    expect(whatIsDue([template({ active: false })], '2026-08-24')).toEqual([])
  })

  it('refuses to produce an endless list from an anchor in 2014', () => {
    // Somebody will type one. A hundred and forty proposals is not a screen.
    const ancient = template({ from: '2014-01-01' })
    expect(whatIsDue([ancient], '2026-08-24')).toHaveLength(24)
  })

  it('sorts everything owed by the day it fell due', () => {
    const due = whatIsDue([
      template({ row: 3, concept: 'luz', day: 20, amount: null }),
      template({ row: 2, concept: 'alquiler', day: 1 }),
    ], '2026-08-24')

    expect(due.map(item => item.concept)).toEqual(['alquiler', 'luz'])
    // The one with no amount comes through as null rather than zero: it is the
    // difference between "always 700" and "ask me".
    expect(due[1].amount).toBeNull()
  })
})

describe('alreadyThere', () => {
  const entry = (date: string, concept: string, voided = false) => ({ date, concept, voided })
  const due = {
    row: 2, concept: 'alquiler', amount: 700, payer: 0 as const,
    due: '2026-08-01', category: 'Hogar',
  }

  it('finds the row somebody pasted from the bank', () => {
    // The case the whole check exists for: the rent is already in the ledger
    // because it came off a statement, and confirming the proposal would write
    // it a second time into a ledger where a row can only be voided.
    expect(alreadyThere([entry('2026-08-02', 'RECIBO ALQUILER agosto')], due)).toBe(true)
  })

  it('matches on the month, not the day', () => {
    expect(alreadyThere([entry('2026-08-28', 'alquiler')], due)).toBe(true)
    expect(alreadyThere([entry('2026-07-01', 'alquiler')], due)).toBe(false)
  })

  it('ignores a voided row, which is a row that was taken back', () => {
    expect(alreadyThere([entry('2026-08-01', 'alquiler', true)], due)).toBe(false)
  })

  it('is not fooled into silence by a different expense', () => {
    expect(alreadyThere([entry('2026-08-01', 'gasolina')], due)).toBe(false)
    expect(alreadyThere([], due)).toBe(false)
  })
})
