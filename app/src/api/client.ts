import { ApiError } from './types'
import type { ApiAction, Bootstrap, Entry, Fixed } from './types'
import { getIdToken, invalidateToken } from '../auth/google'
import { T } from '../i18n/strings'
import { state } from '../lib/progress'

const API_URL = import.meta.env.VITE_API_URL as string

/**
 * Long, because the sheet is big and Apps Script is not fast — and finite,
 * because a fetch has no timeout of its own. A request that hangs used to hang
 * the app with it, and this app is a phone in a supermarket: it has to give up
 * eventually and let the queue deal with it.
 */
const TIMEOUT_MS = 40_000

/**
 * One POST, one action, a JSON string body sent as text/plain.
 *
 * The content type is load-bearing, not sloppiness. Apps Script web apps answer
 * through a redirect to script.googleusercontent.com, which sets
 * `Access-Control-Allow-Origin: *` — but they never answer OPTIONS, so any
 * request that triggers a CORS preflight fails outright. text/plain with no
 * custom headers is a "simple request" and skips the preflight; that is also
 * why the ID token rides inside the body instead of an Authorization header.
 *
 * Making this a tidy REST call with application/json and a bearer header works
 * perfectly in curl and fails in every browser. Do not.
 */
async function call<T>(action: ApiAction, payload: unknown = {}): Promise<T> {
  // Recorded before anything can fail, so that a failure has the address it was
  // aimed at sitting next to it. `VITE_API_URL` lost at build time shows up here
  // as the app's own origin, which is otherwise invisible from a phone.
  state(T.splash.facts.endpoint, API_URL || '(vacío)')
  state(T.splash.facts.action, action)

  const idToken = await getIdToken()

  let response: Response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, idToken, payload }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    // The browser's own words as well as ours. "TypeError: Failed to fetch" is
    // not informative on its own, but it is what a search engine and a second
    // pair of eyes both need.
    state(T.splash.facts.answer, verbatim(error))
    throw new ApiError('NETWORK', await explain(error))
  }

  state(T.splash.facts.answer, `HTTP ${response.status}`)
  if (!response.ok) throw new ApiError('NETWORK', `HTTP ${response.status} de ${host()}`)

  // Read as text first, deliberately. `response.json()` on an HTML page throws
  // outside every catch in this file and arrives as an unexplained
  // "SyntaxError: Unexpected token '<'" — when what it means is that Apps Script
  // answered with an error page or a login form, and the first line of it says
  // which.
  const text = await response.text()
  let body: { ok?: boolean; data?: unknown; error?: { code?: string; message?: string } }
  try {
    body = JSON.parse(text) as typeof body
  } catch {
    state(T.splash.facts.body, text.slice(0, 200).replace(/\s+/g, ' ').trim() || '(vacío)')
    throw new ApiError('NOT_JSON', T.errors.diagnosis.notJson(host()))
  }
  if (!body.ok) {
    // Drop the credential the backend just refused. Without this the same dead
    // token is handed to every call until it expires on its own, which is the
    // opposite of what invalidateToken() was written for — it was exported and
    // never called.
    if (body.error?.code === 'UNAUTHENTICATED') invalidateToken()
    throw new ApiError(body.error?.code ?? 'INTERNAL', body.error?.message ?? '')
  }
  return body.data as T
}

/** Just the host, for a message that has to fit on a phone. It also answers the
 *  question "is the app even pointed at the right place": a build that lost
 *  VITE_API_URL posts to its own origin, and this is where that shows up. */
function host(): string {
  try {
    return new URL(API_URL, location.href).host
  } catch {
    return String(API_URL)
  }
}

/** The browser's own words, which are the ones worth quoting to anybody else. */
function verbatim(error: unknown): string {
  const thrown = error as Error | null
  if (!thrown?.name) return String(error)
  return thrown.message ? `${thrown.name}: ${thrown.message}` : thrown.name
}

/**
 * Why the request died, in words that lead somewhere.
 *
 * "Failed to fetch" is the browser refusing to say, and it covers two failures
 * with nothing in common: a request that never left the phone, and a server
 * that answered something the browser would not hand over. The second is what
 * an Apps Script deployment does when it wants a Google login — it redirects to
 * a page with no `Access-Control-Allow-Origin`, and the browser reports it
 * exactly like a dead network.
 *
 * So the failure is probed once, with `mode: 'no-cors'`. An opaque response
 * means the server is there and talking, and the problem is what it said; a
 * rejection means nothing got out at all. That single bit is the difference
 * between redeploying the backend and looking at the phone's network.
 *
 * No token goes into the probe. It is a request whose answer cannot be read,
 * which is not somewhere to put a credential, and the backend needs none to
 * refuse an action it does not know.
 */
async function explain(error: unknown): Promise<string> {
  if ((error as Error | null)?.name === 'TimeoutError') {
    return T.errors.diagnosis.timeout(host(), TIMEOUT_MS / 1000)
  }
  if (!navigator.onLine) return T.errors.diagnosis.offline
  return await reachable()
    ? T.errors.diagnosis.refused(host())
    : T.errors.diagnosis.unreachable(host())
}

async function reachable(): Promise<boolean> {
  try {
    await fetch(API_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'ping' }),
      signal: AbortSignal.timeout(10_000),
    })
    return true
  } catch {
    return false
  }
}

export const api = {
  bootstrap: (limit?: number) => call<Bootstrap>('bootstrap', { limit }),
  append: (entry: Omit<Entry, 'row' | 'voided'>) => call<Entry>('append', entry),
  update: (entry: Omit<Entry, 'row' | 'voided'>) => call<Entry>('update', entry),
  voidEntry: (id: string) => call<Entry>('voidEntry', { id }),
  assignId: (row: number) => call<Entry>('assignId', { row }),
  saveFixed: (fixed: Omit<Fixed, 'last'>) => call<{ row: number }>('saveFixed', fixed),
  /** Marks a template dealt with up to `due` — confirmed and skipped are the
   *  same fact as far as "do not propose it again" goes. */
  fixedDone: (row: number, due: string) =>
    call<{ row: number; last: string }>('fixedDone', { row, due }),
}
