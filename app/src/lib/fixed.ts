/**
 * Which recurring expenses owe a period, and which have already been paid.
 *
 * This is where the whole risk of the feature lives, which is why it is here and
 * not in the backend: it is calendar arithmetic, and Apps Script has no test
 * runner. A day 31 in February, an anchor two months out of phase, six months
 * nobody opened the app — get any of those wrong and a bill is either proposed
 * twice or never, in a ledger where a row cannot be taken back out.
 *
 * Days are `YYYY-MM-DD` strings from end to end, compared as strings and never
 * as `Date` objects. The one place a Date appears is inside `dueDay`, to ask how
 * long a month is, and it never leaves.
 */

/** A period a template owes: the day it fell due. */
export interface Due {
  /** The row of the template on the Fijos tab, which is its identity. */
  row: number
  concept: string
  /** Null for the ones whose amount changes every month. */
  amount: number | null
  payer: 0 | 1 | null
  /** `YYYY-MM-DD`, and the date the expense gets if it is confirmed. */
  due: string
}

export interface Template {
  row: number
  concept: string
  amount: number | null
  day: number
  payer: 0 | 1 | null
  /** Months between one due date and the next: 1 monthly, 2 bimonthly, 12 yearly. */
  months: number
  active: boolean
  /** The anchor. Only matters when `months` is more than one. */
  from: string
  /** The last due date confirmed or skipped. */
  last: string
}

/**
 * A ceiling on how far back one template can reach.
 *
 * Two years of monthly bills. It exists for the anchor somebody types as 2014:
 * without it that row would propose a hundred and forty periods, and a screen
 * with a hundred and forty proposals on it is not a screen anybody can use to
 * find the one that matters.
 */
const MAX_PERIODS = 24

/**
 * Everything owed, oldest first.
 *
 * "Owed" means: fell due on or before today, and has not been dealt with — the
 * app writes the last due date it settled back to the sheet, so this is the list
 * of due dates after that one. A template nobody has ever settled starts at its
 * anchor, or at this month if it has none: a bill added today does not owe the
 * eleven months before it existed.
 */
export function whatIsDue(templates: readonly Template[], today: string): Due[] {
  const owed: Due[] = []

  for (const template of templates) {
    if (!template.active) continue
    for (const due of periodsFor(template, today)) {
      owed.push({
        row: template.row,
        concept: template.concept,
        amount: template.amount,
        payer: template.payer,
        due,
      })
    }
  }

  return owed.sort((a, b) => a.due.localeCompare(b.due) || a.row - b.row)
}

function periodsFor(template: Template, today: string): string[] {
  const anchor = template.from || template.last || monthStart(today)
  let due = dueDay(anchor, template.day)

  // Walk forward to the first period that is actually owed. From the anchor when
  // nothing has been settled; from the one after `last` when something has.
  while (due <= template.last) due = addMonths(due, template.months, template.day)

  const periods: string[] = []
  while (due <= today && periods.length < MAX_PERIODS) {
    periods.push(due)
    due = addMonths(due, template.months, template.day)
  }
  return periods
}

/**
 * The day a template falls due in the month of `iso`.
 *
 * Clamped to the length of that month, so a rent due on the 31st falls on the
 * 28th of February rather than slipping into March — which is what a naive
 * `new Date(2026, 1, 31)` does, silently.
 */
export function dueDay(iso: string, day: number): string {
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7))
  const last = new Date(year, month, 0).getDate()
  return `${iso.slice(0, 7)}-${String(Math.min(day, last)).padStart(2, '0')}`
}

/** `months` later, landing on the same day of the month where the month has one. */
export function addMonths(iso: string, months: number, day: number): string {
  const year = Number(iso.slice(0, 4))
  const month = Number(iso.slice(5, 7)) + Math.max(1, months)
  const shifted = `${year + Math.floor((month - 1) / 12)}-${String(((month - 1) % 12) + 1).padStart(2, '0')}-01`
  return dueDay(shifted, day)
}

function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

/**
 * Whether the ledger already has this expense for this period.
 *
 * The reason the feature needs it: some rows are pasted from a bank statement,
 * so the rent can already be there without the app ever having proposed it —
 * and confirming a proposal in that state writes the rent twice into a ledger
 * where a row can only be voided, never removed.
 *
 * Deliberately generous about what counts as a match, and deliberately only a
 * warning. It compares the concept folded, and the month rather than the day,
 * because a bank statement says "RECIBO ALQUILER" on the 2nd for a rent due on
 * the 1st. Being too eager here costs a warning nobody needed; being too strict
 * costs a duplicate in the ledger.
 */
export function alreadyThere(
  entries: readonly { date: string; concept: string; voided: boolean }[],
  due: Due,
): boolean {
  const wanted = fold(due.concept)
  const month = due.due.slice(0, 7)
  return entries.some(entry =>
    !entry.voided &&
    entry.date.slice(0, 7) === month &&
    fold(entry.concept).includes(wanted))
}

function fold(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}
