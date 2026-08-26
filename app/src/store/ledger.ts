import { useCallback, useEffect, useRef, useState } from 'react'
import { api, isBootstrap } from '../api/client'
import { T } from '../i18n/strings'
import { clearFault, fault, report, state } from '../lib/progress'
import { ApiError, type Bootstrap, type Entry, type Fixed } from '../api/types'
import { idb } from './db'
import {
  enqueue, flush, pendingAttempts, pendingCount, pendingOps, type QueuedEntry,
} from './queue'

export type Status = 'loading' | 'ready' | 'needsAuth' | 'forbidden' | 'error'

export interface Ledger {
  status: Status
  error: string | null
  data: Bootstrap | null
  entries: Entry[]
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
  settleFixed: (row: number, due: string) => Promise<void>
  refresh: () => Promise<void>
}

const CACHE_KEY = 'bootstrap'

export function useLedger(): Ledger {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<Bootstrap | null>(null)
  const [local, setLocal] = useState<Map<string, QueuedEntry>>(new Map())
  const [voided, setVoided] = useState<Set<string>>(new Set())
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
    for (const op of ops) {
      if (op.kind === 'void') gone.add(op.id)
      else map.set(op.entry.id, op.entry)
    }
    setLocal(map)
    setVoided(gone)
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

  const saveFixed = useCallback(async (fixed: Omit<Fixed, 'last'>) => {
    await api.saveFixed(fixed)
    await refresh()
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
  const settleFixed = useCallback(async (row: number, due: string) => {
    await api.fixedDone(row, due)
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
    status, error, data, pending, attempts,
    entries: merge(data?.entries ?? [], local, voided),
    addEntry: entry => mutate('append', entry),
    editEntry: entry => mutate('update', entry),
    voidEntry,
    claimRow,
    fixed: data?.fixed ?? [],
    saveFixed,
    settleFixed,
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
function merge(server: Entry[], local: Map<string, QueuedEntry>, voided: Set<string>): Entry[] {
  const byId = new Map<string, Entry>()
  for (const entry of server) {
    byId.set(entry.id || `row:${entry.row}`, entry)
  }
  for (const [id, entry] of local) {
    const existing = byId.get(id)
    byId.set(id, { ...entry, row: existing?.row ?? 0, voided: false })
  }
  return [...byId.values()]
    .map(entry => (voided.has(entry.id) ? { ...entry, voided: true } : entry))
    .sort((a, b) => (a.date === b.date ? b.row - a.row : b.date.localeCompare(a.date)))
}

function handle(err: unknown, setStatus: (s: Status) => void, setError: (m: string) => void,
                painted: boolean) {
  if (err instanceof ApiError) {
    // Written down whatever happens next, including for the failures the app
    // copes with silently — the queue will retry, there is a cached ledger on
    // screen. Those are invisible from outside and are usually the clue to
    // whatever the user is actually complaining about.
    fault(`${err.code}: ${err.message}`)
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
  // Not recorded as a fault, deliberately: this is the auth layer's own signal
  // that it is handing over to the button, and it has already written down why
  // Google did not answer. Overwriting that with the words "interaction
  // required" throws away the only half of it worth reading.
  if (String(err).includes('interaction required')) return setStatus('needsAuth')
  fault(String(err))
  setError(String(err))
  setStatus('error')
}
