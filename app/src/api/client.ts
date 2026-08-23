import { ApiError } from './types'
import type { ApiAction, Bootstrap, Entry } from './types'
import { getIdToken } from '../auth/google'

const API_URL = import.meta.env.VITE_API_URL as string

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
  const idToken = await getIdToken()

  let response: Response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, idToken, payload }),
    })
  } catch {
    throw new ApiError('NETWORK', 'fetch failed')
  }

  if (!response.ok) throw new ApiError('NETWORK', `HTTP ${response.status}`)

  const body = await response.json()
  if (!body.ok) throw new ApiError(body.error?.code ?? 'INTERNAL', body.error?.message ?? '')
  return body.data as T
}

export const api = {
  bootstrap: (limit?: number) => call<Bootstrap>('bootstrap', { limit }),
  append: (entry: Omit<Entry, 'row' | 'voided'>) => call<Entry>('append', entry),
  update: (entry: Omit<Entry, 'row' | 'voided'>) => call<Entry>('update', entry),
  voidEntry: (id: string) => call<Entry>('voidEntry', { id }),
  assignId: (row: number) => call<Entry>('assignId', { row }),
}
