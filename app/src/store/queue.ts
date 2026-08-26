import { idb } from './db'
import { api } from '../api/client'
import { ApiError, type Entry, type Fixed } from '../api/types'
import { invalidateToken } from '../auth/google'
import { fault } from '../lib/progress'

/**
 * The outbound queue.
 *
 * Saving does not wait for the network. The entry is written here with the id
 * it will keep forever, painted in the list, and uploaded whenever the phone
 * can — which may be after the walk out of the supermarket, or after the app
 * has been killed and reopened.
 *
 * The id is generated on the phone rather than by the sheet. That is what makes
 * a retry safe: the backend looks the id up before appending, so an upload that
 * actually succeeded but never delivered its answer produces no second row.
 */

export type Op =
  | { kind: 'append'; entry: QueuedEntry }
  | { kind: 'update'; entry: QueuedEntry }
  | { kind: 'void'; id: string }
  /**
   * A recurring template, on its way to the Fijos tab.
   *
   * Here for the same reason the expenses are: saving one used to go straight to
   * the network, so with no signal the button failed and whatever had been typed
   * was gone. A template is less money than an expense and more typing.
   *
   * `key` is what makes a retry safe. An existing template is identified by its
   * row, so two edits to the same one collapse into the final state; a new one
   * has no row yet, so it carries an id generated on the phone — without it, two
   * new templates queued offline would share the key `fixed:0` and the second
   * would eat the first.
   */
  | { kind: 'fixed'; key: string; fixed: QueuedFixed }

export type QueuedEntry = Omit<Entry, 'row' | 'voided'>
export type QueuedFixed = Omit<Fixed, 'last'>

interface Record_ { op: Op; attempts: number; queuedAt: number; triedAt?: number }

/**
 * Two failures closer together than this are one attempt.
 *
 * The queue is flushed on every refresh, and a refresh happens when the app
 * comes back to the foreground — which on a phone includes the on-screen
 * keyboard closing a second after Guardar was tapped. Counted naively, the save
 * and that immediate second flush are two attempts, so the strip announced
 * "reintento 1" while the first attempt was still what the person was watching.
 *
 * A burst is collapsed by leaving `triedAt` where it was, so the window is
 * measured from the attempt that counted rather than sliding forward with every
 * failure — otherwise a fast enough series would never count at all.
 */
const SAME_ATTEMPT_MS = 3_000

export async function enqueue(op: Op): Promise<void> {
  await idb.set('queue', keyOf(op), { op, attempts: 0, queuedAt: Date.now() } satisfies Record_)
}

export async function pendingCount(): Promise<number> {
  return (await idb.keys('queue')).length
}

export async function pendingOps(): Promise<Op[]> {
  return (await idb.all<Record_>('queue')).map(r => r.op)
}

/**
 * The most attempts any queued operation has behind it.
 *
 * On screen as "reintento 3", which is the difference between an upload that is
 * taking a moment and one that is not going to work. The field was written on
 * every enqueue and never incremented, so nothing could tell those apart — the
 * strip said the same thing at the first attempt and at the thirtieth.
 */
export async function pendingAttempts(): Promise<number> {
  return (await idb.all<Record_>('queue'))
    .reduce((most, record) => Math.max(most, record.attempts ?? 0), 0)
}

/**
 * Sends everything, oldest first, stopping at the first failure.
 *
 * Order matters and so does stopping: an update or a void for an entry whose
 * append has not landed yet would be rejected as NOT_FOUND, and dropping it
 * would silently lose the edit. Leaving the rest queued keeps the sequence
 * intact for the next attempt.
 */
export async function flush(): Promise<{ sent: number; failed: boolean }> {
  const records = (await idb.all<Record_>('queue')).sort((a, b) => a.queuedAt - b.queuedAt)
  let sent = 0

  for (const record of records) {
    try {
      await send(record.op)
      await idb.del('queue', keyOf(record.op))
      sent++
    } catch (error) {
      if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') invalidateToken()

      // A request the server refused on its merits will be refused identically
      // forever. Retrying it every time the phone finds signal would block
      // everything behind it, so it is dropped and reported rather than left to
      // poison the queue.
      if (error instanceof ApiError && PERMANENT.has(error.code)) {
        await idb.del('queue', keyOf(record.op))
        // Written down where a phone can show it, not only where a laptop
        // could. Dropping an operation is losing an expense somebody typed, and
        // a console.error is the same thing as saying nothing.
        fault(`${error.code}: ${describe(record.op)} — ${error.message}`)
        continue
      }
      // Counted before giving up, so the next attempt knows it is one.
      const now = Date.now()
      const burst = record.triedAt !== undefined && now - record.triedAt < SAME_ATTEMPT_MS
      await idb.set('queue', keyOf(record.op), {
        ...record,
        attempts: burst ? record.attempts : (record.attempts ?? 0) + 1,
        triedAt: burst ? record.triedAt : now,
      } satisfies Record_)
      return { sent, failed: true }
    }
  }
  return { sent, failed: false }
}

const PERMANENT = new Set(['BAD_REQUEST', 'NOT_FOUND', 'UNKNOWN_ACTION', 'MISCONFIGURED'])

function send(op: Op) {
  switch (op.kind) {
    case 'append': return api.append(op.entry)
    case 'update': return api.update(op.entry)
    case 'void': return api.voidEntry(op.id)
    case 'fixed': return api.saveFixed(op.fixed)
  }
}

/** Keyed by entry, not by operation: editing a queued entry twice before it
 *  ever reaches the sheet should upload the final state once, not replay both. */
function keyOf(op: Op): string {
  if (op.kind === 'void') return `void:${op.id}`
  if (op.kind === 'fixed') return `fixed:${op.key}`
  return `entry:${op.entry.id}`
}

/** Enough of an operation to recognise which expense was lost. */
function describe(op: Op): string {
  if (op.kind === 'void') return `void ${op.id}`
  if (op.kind === 'fixed') return `fixed ${op.fixed.concept}`
  return `${op.kind} ${op.entry.concept}`
}
