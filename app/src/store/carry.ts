import { idb } from './db'

/**
 * What the next expense inherits from the one just apuntado.
 *
 * Five tickets from Saturday are five expenses with the same date and, usually,
 * the same card — and until now every one of them started at today with nothing
 * chosen, so four of the five needed the same two taps again. This is those two
 * taps, remembered.
 *
 * The two are remembered differently on purpose, because they go stale
 * differently.
 *
 * **The card is per person, and it is kept.** "My card is my card" is true next
 * week as well, so it survives the app being closed — but it belongs to whoever
 * is paying rather than to whoever is holding the phone, and the row of pills on
 * the second step is filtered by payer for exactly that reason. Remembering one
 * per person is what stops Mario's card being carried onto an expense that Viqui
 * paid; that the method also has to be one the payer is actually offered is
 * checked on the screen that offers them, where the list is.
 *
 * **The date is only for as long as the app is open.** It lives in this module
 * and nowhere else, so a reload — including the one the app performs on itself
 * when a new version lands — comes back to today. A date is the field where being
 * stale is being wrong: carrying Saturday into next Tuesday would write the wrong
 * day into a ledger, silently, and the whole point of this is to save taps rather
 * than to spend them checking. One caveat that is worth knowing rather than
 * hiding: a phone that resumes this app from the background has not reloaded
 * anything, so it does keep the date.
 */

/** Nothing on disk: the date is deliberately as short-lived as the page. */
let sessionDate: { date: string; pickDate: boolean } | null = null

export function rememberDate(date: string, pickDate: boolean) {
  sessionDate = { date, pickDate }
}

export function carriedDate(): { date: string; pickDate: boolean } | null {
  return sessionDate
}

/** Only for the tests, which need a fresh page's worth of forgetting without a
 *  fresh page. Never called by the app. */
export function forgetDate() {
  sessionDate = null
}

const KEY = 'carry'

interface Carried {
  /** One per person, by payer index. */
  methods: [string, string]
}

/**
 * Held in memory as well as on disk, so `reset` can read it without awaiting.
 *
 * The draft is rebuilt the instant an expense is saved and the screen repaints
 * from it; an await in the middle of that would paint the empty form first and
 * the carried card a frame later, which reads as the app changing its mind.
 */
let methods: [string, string] = ['', '']

/** Hydrated once, on the way into the app. A save in the first fifty
 *  milliseconds would miss it, which costs one tap and no correctness. */
export async function loadCarried(): Promise<void> {
  const stored = await idb.get<Carried>('draft', KEY)
  if (stored && Array.isArray(stored.methods) && stored.methods.length === 2) {
    methods = [String(stored.methods[0] ?? ''), String(stored.methods[1] ?? '')]
  }
}

export function carriedMethod(payer: 0 | 1): string {
  return methods[payer]
}

export async function rememberMethod(payer: 0 | 1, method: string): Promise<void> {
  const next: [string, string] = [methods[0], methods[1]]
  next[payer] = method
  methods = next
  // Written even when it is empty: clearing the pills on purpose is a choice
  // about the next expense too, and one that has to survive being closed like
  // the choosing does.
  await idb.set('draft', KEY, { methods: next } satisfies Carried)
}
