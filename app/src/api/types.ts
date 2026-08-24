export interface Entry {
  row: number
  id: string
  date: string          // yyyy-MM-dd
  concept: string
  amount: number
  payer: 0 | 1 | null   // null when both amount cells are empty
  note: string
  voided: boolean
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

export interface Bootstrap {
  user: { email: string; name: string }
  config: { people: [Person, Person]; meIndex: number }
  balance: number
  entries: Entry[]
  frequent: { concept: string }[]
  suggestions: Suggestion[]
  lastRow: number
}

export type ApiAction = 'bootstrap' | 'append' | 'update' | 'voidEntry' | 'assignId'

export class ApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message)
  }
}
