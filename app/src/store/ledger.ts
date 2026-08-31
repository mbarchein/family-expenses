import { useCallback, useEffect, useRef, useState } from 'react'
import { api, isBootstrap } from '../api/client'
import { T } from '../i18n/strings'
import { clearFault, fault, report, state } from '../lib/progress'
import { ApiError, type Bootstrap, type Entry, type Fixed } from '../api/types'
import { idb } from './db'
import {
  enqueue, flush, pendingAttempts, pendingCount, pendingOps,
  type QueuedEntry, type QueuedFixed,
} from './queue'

export type Status = 'loading' | 'ready' | 'needsAuth' | 'forbidden' | 'error'

/**
 * An entry as the app shows it: the sheet's row plus whether it is still on its
 * way up.
 *
 * `pending` is not part of the API and deliberately does not live on `Entry`.
 * The sheet has no idea an expense was ever queued; this is the phone's own
 * knowledge, and the list is the one place it belongs.
 */
export interface ShownEntry extends Entry {
  pending: boolean
}

export interface Ledger {
  status: Status
  /**
   * Whether a bootstrap is on the wire right now.
   *
   * Separate from `status` because the two answer different questions and the
   * gap between them was a reported bug: after a 401 the status is `needsAuth`
   * and the sign-in screen is up, and tapping the button starts a request that
   * changes no status at all — `refresh` only drops to 'loading' before the first
   * paint, and by then the cache has painted. So the button stayed on screen for
   * the whole download of a two-thousand-row sheet, which reads as a sign-in that
   * did not work.
   */
  busy: boolean
  error: string | null
  data: Bootstrap | null
  entries: ShownEntry[]
  pending: number
  /** How many attempts the most-retried queued operation has behind it. Zero
   *  while an upload is simply in flight. */
  attempts: number
  addEntry: (entry: QueuedEntry) => Promise<void>
  editEntry: (entry: QueuedEntry) => Promise<void>
  voidEntry: (id: string) => Promise<void>
  claimRow: (row: number) => Promise<void>
  /** The recurring templates as the sheet has them. */
  fixed: Fixed[]
  saveFixed: (fixed: Omit<Fixed, 'last'>) => Promise<void>
  /** Records that a due date has been dealt with, confirmed or skipped.
   *  Deliberately not queued — see the comment where it is implemented. */
  settleFixed: (id: string, row: number, due: string) => Promise<void>
  /** Writes one row of the Categorías tab and re-reads the sheet. Not queued —
   *  see the note on `api.saveCategory`. */
  saveCategory: (category: { name: string; icon: string; words: string[]; was?: string })
    => Promise<void>
  deleteCategory: (name: string) => Promise<void>
  refresh: () => Promise<void>
}

const CACHE_KEY = 'bootstrap'

export function useLedger(): Ledger {
  const [status, setStatus] = useState<Status>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Bootstrap | null>(null)
  const [local, setLocal] = useState<Map<string, QueuedEntry>>(new Map())
  const [voided, setVoided] = useState<Set<string>>(new Set())
  const [queuedFixed, setQueuedFixed] = useState<QueuedFixed[]>([])
  const [pending, setPending] = useState(0)
  const [attempts, setAttempts] = useState(0)

  /**
   * Whether anything is on screen yet.
   *
   * A ref and not state, deliberately. `refresh` would have to depend on it to
   * read it, the mount effect below depends on `refresh`, and an effect that
   * re-runs whenever the data changes bootstraps in a loop.
   */
  const painted = useRef(false)

  const replayQueue = useCallback(async () => {
    const ops = await pendingOps()
    const map = new Map<string, QueuedEntry>()
    const gone = new Set<string>()
    const templates: QueuedFixed[] = []
    for (const op of ops) {
      if (op.kind === 'void') gone.add(op.id)
      else if (op.kind === 'fixed') templates.push(op.fixed)
      else map.set(op.entry.id, op.entry)
    }
    setLocal(map)
    setVoided(gone)
    setQueuedFixed(templates)
    setPending(await pendingCount())
    setAttempts(await pendingAttempts())
  }, [])

  const refresh = useCallback(async () => {
    // Back to the splash while the first load is in flight, and only then.
    //
    // Without this, tapping the sign-in button left the status on 'needsAuth'
    // for as long as the request took — so a request that never came back left
    // the sign-in screen on screen, and the app answered a tap on "Entrar con
    // Google" by showing the same button again. That is the third shape of
    // "la app no carga después de identificarme", and the one that looks least
    // like a bug and most like a phone being slow.
    if (!painted.current) setStatus('loading')
    setBusy(true)
    try {
      report('queue')
      await flush()
      report('sheet')
      const fresh = await api.bootstrap()
      await idb.set('cache', CACHE_KEY, fresh)
      setData(fresh)
      state(T.splash.facts.rows, String(fresh.entries.length))
      painted.current = true
      setStatus('ready')
      setError(null)
      report('ready')
      clearFault()
    } catch (err) {
      handle(err, setStatus, setError, painted.current)
    } finally {
      setBusy(false)
      await replayQueue()
    }
  }, [replayQueue])

  /**
   * The first load: paint from the last known state, then go to the network.
   *
   * The cached bootstrap is what makes the app open on the keypad with the list
   * already filled in rather than on a spinner. Reading it costs a microtask,
   * so every setState here lands in a callback rather than in the effect body —
   * an effect that sets state synchronously cascades a second render before the
   * first has painted.
   *
   * The cancelled flag is not ceremony. StrictMode mounts every effect twice in
   * development, and without it the two runs race: two bootstraps in flight,
   * the slower one winning and overwriting the fresher answer.
   */
  useEffect(() => {
    let cancelled = false

    void (async () => {
      report('cache')
      const cached = await idb.get<unknown>('cache', CACHE_KEY)
      if (cancelled) return
      // Checked rather than trusted, because a bad cache entry is the one
      // failure a reload makes worse: painting from it is the first thing this
      // effect does, so a stored object that is not a ledger crashes the app
      // before it can reach the network to replace it, and the crash screen's
      // only button starts the same load again. It happened — Apps Script's
      // health answer got cached as the ledger, and `config.people` was
      // undefined for ever. Throwing the entry away is safe: what is not on the
      // sheet yet is in the queue, not in here.
      if (isBootstrap(cached)) {
        setData(cached)
        painted.current = true
        setStatus('ready')
      } else if (cached !== undefined) {
        fault(`CACHE: ${T.errors.diagnosis.badCache}`)
        await idb.del('cache', CACHE_KEY)
      }
      await replayQueue()
      if (cancelled) return
      await refresh()
    })()

    return () => { cancelled = true }
  }, [replayQueue, refresh])

  // Coming back online, and coming back to the foreground, are the two moments
  // worth retrying. Polling on a timer would burn battery for an app that is
  // open for eight seconds at a time.
  useEffect(() => {
    const onWake = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('online', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      window.removeEventListener('online', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [refresh])

  const mutate = useCallback(async (kind: 'append' | 'update', entry: QueuedEntry) => {
    await enqueue({ kind, entry })
    setLocal(prev => new Map(prev).set(entry.id, entry))
    setPending(await pendingCount())
    void refresh()
  }, [refresh])

  const voidEntry = useCallback(async (id: string) => {
    await enqueue({ kind: 'void', id })
    setVoided(prev => new Set(prev).add(id))
    setPending(await pendingCount())
    void refresh()
  }, [refresh])

  /**
   * Queued, like an expense.
   *
   * It went straight to the network before, so with no signal the button failed
   * and whatever had been typed was gone — and a template is more typing than an
   * expense: a concept, an amount, a day, a cadence and a payer.
   *
   * The key is the row for a template that has one, so two edits to the same
   * template collapse into the final state rather than being replayed in turn.
   * A new one has no row yet and carries an id generated here instead; without
   * that, two new templates queued offline would share a key and the second
   * would quietly replace the first.
   */
  const saveFixed = useCallback(async (fixed: Omit<Fixed, 'last'>) => {
    // Keyed by the template's id, so two edits to the same one collapse into the
    // final state instead of being replayed in turn — and a row added by hand,
    // which has no id yet, by its row. It was the row for both, which meant two
    // edits to a *new* template appended it twice.
    const key = fixed.id || `row:${fixed.row}`
    await enqueue({ kind: 'fixed', key, fixed })
    setPending(await pendingCount())
    void refresh()
  }, [refresh])

  /**
   * Not queued, and that is a decision rather than an omission.
   *
   * The expense itself goes through the queue, because losing one is losing
   * money. This is only the note that says "do not propose that period again",
   * and if it fails the proposal comes back — which is annoying and safe, and
   * the duplicate warning catches it, since by then the expense is in the list
   * the warning reads. Queueing it would mean the two halves of one tap landing
   * out of order, which is how a period gets marked settled for an expense that
   * never made it.
   */
  const settleFixed = useCallback(async (id: string, row: number, due: string) => {
    // Both: the id is what it is looked up by, and the row is what the backend
    // falls back to for a template that has not got one yet.
    await api.fixedDone(id, row, due)
    await refresh()
  }, [refresh])

  const saveCategory = useCallback(async (
    category: { name: string; icon: string; words: string[]; was?: string },
  ) => {
    await api.saveCategory(category)
    await refresh()
  }, [refresh])

  const deleteCategory = useCallback(async (name: string) => {
    await api.deleteCategory(name)
    await refresh()
  }, [refresh])

  const claimRow = useCallback(async (row: number) => {
    // Deliberately not queued: giving a legacy row an id is only useful with the
    // sheet in front of us, and an offline attempt would have nothing to
    // reconcile against.
    await api.assignId(row)
    await refresh()
  }, [refresh])

  return {
    status, busy, error, data, pending, attempts,
    entries: merge(data?.entries ?? [], local, voided),
    addEntry: entry => mutate('append', entry),
    editEntry: entry => mutate('update', entry),
    voidEntry,
    claimRow,
    fixed: mergeFixed(data?.fixed ?? [], queuedFixed),
    saveFixed,
    settleFixed,
    saveCategory,
    deleteCategory,
    refresh,
  }
}

/**
 * The sheet's rows plus whatever has not reached it yet.
 *
 * A queued entry always wins over the server's copy of the same id: it is
 * either newer (an edit still in flight) or identical (already uploaded, not
 * yet re-fetched). Either way the user sees what they typed.
 */
function merge(server: Entry[], local: Map<string, QueuedEntry>,
               voided: Set<string>): ShownEntry[] {
  const byId = new Map<string, ShownEntry>()
  for (const entry of server) {
    byId.set(entry.id || `row:${entry.row}`, { ...entry, pending: false })
  }
  for (const [id, entry] of local) {
    const existing = byId.get(id)
    byId.set(id, { ...entry, row: existing?.row ?? 0, voided: false, pending: true })
  }
  return [...byId.values()]
    .map(entry => (voided.has(entry.id) ? { ...entry, voided: true } : entry))
    .sort((a, b) => (a.date === b.date ? b.row - a.row : b.date.localeCompare(a.date)))
}

/**
 * The templates the tab has, plus the ones still on their way to it.
 *
 * Without this a template saved with no signal disappeared from the Fijos screen
 * until it uploaded — the queue had it, so nothing was lost, but the screen said
 * otherwise, which is the same lie the expenses list used to tell.
 *
 * A queued edit wins over the tab's copy of the same row: it is either newer or
 * identical. A queued new one has no row yet, so it is appended.
 */
function mergeFixed(server: Fixed[], queued: QueuedFixed[]): Fixed[] {
  if (!queued.length) return server
  // Keyed the way the sheet is looked up: by id, and by row for a template
  // somebody added by hand that has not got one yet.
  const key = (item: { id: string; row: number }) => item.id || `row:${item.row}`
  const known = new Map<string, Fixed>()
  for (const item of server) known.set(key(item), item)

  const added: Fixed[] = []
  for (const item of queued) {
    const existing = known.get(key(item))
    // `last` is the tab's own record of what has been dealt with, and saving a
    // template never touches it — so it comes from the server's copy, not from
    // the queue, which has no business knowing it.
    const merged = { ...item, last: existing?.last ?? '' }
    if (existing) known.set(key(item), merged)
    else added.push(merged)
  }
  return [...known.values(), ...added]
}

function handle(err: unknown, setStatus: (s: Status) => void, setError: (m: string) => void,
                painted: boolean) {
  // The auth layer's own handover to the sign-in button. Deliberately not
  // recorded as a fault: it has already written down why Google did not answer,
  // and overwriting that with the words "interaction required" throws away the
  // only half worth reading.
  const handover = !(err instanceof ApiError) && String(err).includes('interaction required')

  // Written down whatever happens next, including for the failures the app
  // copes with silently — the queue will retry, there is a cached ledger on
  // screen. Those are invisible from outside and are usually the clue to
  // whatever the user is actually complaining about.
  if (err instanceof ApiError) fault(`${err.code}: ${err.message}`)
  else if (!handover) fault(String(err))

  /**
   * A ledger already on screen is never replaced while the phone has no network.
   *
   * What was reported: no connection, and the app would not open — it said there
   * was none instead of showing what it had. Offline, `loadGsi()` cannot load
   * Google, so the token request gives up and the app went to the sign-in
   * screen, over the top of a perfectly good cached ledger.
   *
   * And every screen that failure could lead to needs the network it has just
   * been told there is none of: signing in again, retrying, "no se ha podido
   * conectar". All three are a worse answer than yesterday's numbers with the
   * strip above the tab bar saying there is no connection. Online, none of this
   * applies and the behaviour is unchanged — a dead token there is worth
   * interrupting somebody for, because they can do something about it.
   */
  if (painted && !navigator.onLine) return

  if (err instanceof ApiError) {
    if (err.code === 'FORBIDDEN') return setStatus('forbidden')
    if (err.code === 'UNAUTHENTICATED') return setStatus('needsAuth')
    // A network failure with a cached bootstrap on screen is not an error the
    // user needs to see: the queue will deal with it. Only surface it when
    // there is nothing to show — and that second half is what was missing.
    //
    // This `return` used to be unconditional, against its own comment, and it is
    // the other half of "la app no carga". On a phone whose site data has just
    // been cleared there is no cached bootstrap, so a single failed request —
    // no signal, or any answer from the deployment that is not a 200, which
    // includes every Apps Script error page — left the status on 'loading' and
    // the app on the splash screen for ever, with nothing said and nothing to
    // retry. Clearing the cache again could only make it more likely.
    if (err.code === 'NETWORK') {
      if (painted) return
      setError(T.errors.network)
      return setStatus('error')
    }
    // An answer that is not the ledger is treated like a dead network on
    // purpose: written down, and shown only when there is nothing else to show.
    // A cached ledger on screen is worth more than a screen that says the
    // deployment is confused, and the next refresh will say the same thing
    // again if it still is.
    if (err.code === 'NOT_LEDGER') {
      if (painted) return
      setError(err.message)
      return setStatus('error')
    }
    setError(err.message)
    return setStatus('error')
  }
  if (handover) return setStatus('needsAuth')
  setError(String(err))
  setStatus('error')
}
