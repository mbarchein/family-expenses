export interface Entry {
  row: number
  id: string
  date: string          // yyyy-MM-dd
  concept: string
  amount: number
  payer: 0 | 1 | null   // null when both amount cells are empty
  note: string
  /** The normalised bucket, from column H. `Restaurantes` while the concept
   *  stays whatever was typed — "Cena en un bar". Empty for every row filed
   *  before the column existed, and for a concept nothing could guess. */
  category: string
  /** From column I. It used to be mixed into the note, where it could be
   *  neither filtered nor totalled. */
  method: string
  voided: boolean
}

/**
 * A category as the Categorías tab has it.
 *
 * `words` is the guess: what a concept has to contain for this category to be
 * suggested for it. It lives in the spreadsheet so that a guess which annoys
 * somebody can be fixed by the person it annoys.
 */
export interface Category {
  name: string
  /** A name from the app's icon set. Several categories may share one — the app
   *  says so when it happens rather than refusing. */
  icon: string
  words: string[]
}

export interface Person {
  name: string
  color: string
}

/** A row of the Sugerencias tab, already scoped. `person` is null when the row
 *  is for both of them. */
export interface Suggestion {
  text: string
  kind: 'concept' | 'note' | 'method'
  person: 0 | 1 | null
}

/**
 * A recurring expense as the Fijos tab has it. What it *owes* is not here: that
 * is calendar arithmetic, and it happens in `lib/fixed.ts` where it is tested.
 */
export interface Fixed {
  /** Its row on the tab, which is its identity. Nothing reorders that tab. */
  row: number
  concept: string
  /** Null for the ones whose amount changes every month, like the light. */
  amount: number | null
  day: number
  payer: 0 | 1 | null
  /** Months between due dates: 1 monthly, 2 bimonthly, 12 yearly. */
  months: number
  active: boolean
  /** The anchor for a cadence longer than a month, `YYYY-MM-DD` or empty. */
  from: string
  /** The last due date confirmed or skipped, `YYYY-MM-DD` or empty. */
  last: string
}

export interface Bootstrap {
  user: { email: string; name: string }
  config: { people: [Person, Person]; meIndex: number }
  balance: number
  entries: Entry[]
  frequent: { concept: string }[]
  categories: Category[]
  suggestions: Suggestion[]
  fixed: Fixed[]
  lastRow: number
}

export type ApiAction =
  | 'bootstrap' | 'append' | 'update' | 'voidEntry' | 'assignId'
  | 'saveFixed' | 'fixedDone'
  | 'saveCategory' | 'deleteCategory'

export class ApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
  }
}
