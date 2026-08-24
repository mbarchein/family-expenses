import type { Page } from '@playwright/test'
import type { Bootstrap, Entry } from '../src/api/types'

/**
 * Google and the spreadsheet, replaced by doubles.
 *
 * Both have to go. Signing in for real needs a human and a Google session, and
 * the backend writes into somebody's actual ledger — a test suite that appends
 * rows to a spreadsheet is a test suite nobody dares run twice. What is left
 * after the doubles is still the thing worth testing: the real bundle, the real
 * service worker, the real layout at a real viewport.
 */

/** A token shaped enough for `decodeJwt` in auth/google.ts, which reads the
 *  expiry and the address and verifies nothing — the backend does that, and the
 *  backend is a double here too. */
function fakeCredential(email: string): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return [
    part({ alg: 'none' }),
    part({ exp: Math.floor(Date.now() / 1000) + 3600, email }),
    'not-a-signature',
  ].join('.')
}

export const VIQUI = 0
export const MARIO = 1

export function bootstrap(overrides: Partial<Bootstrap> = {}): Bootstrap {
  return {
    user: { email: 'mario@example.invalid', name: 'Mario' },
    config: {
      people: [
        { name: 'Viqui', color: '#2F62D9' },
        { name: 'Mario', color: '#A96F13' },
      ],
      // Mario is holding the phone, so Mario is the payer the screen opens on.
      meIndex: MARIO,
    },
    balance: 1435.94,
    entries: [
      entry({ row: 2298, id: 'one', date: '2026-08-23', concept: 'super', amount: 326.72, payer: VIQUI }),
      entry({ row: 2297, id: 'two', date: '2026-08-22', concept: 'gasolina', amount: 60, payer: MARIO }),
    ],
    // More concepts than the grid has tiles, on purpose: the cut is what the
    // grid is, and a fixture that fits inside it would never test the cut.
    frequent: [
      { concept: 'super' },
      { concept: 'gasolina' },
      { concept: 'comedor' },
      { concept: 'luz' },
      // No keyword matches this one, so it is the tile inside the grid that
      // falls back to an initial — and the one the icon menu is tested on.
      { concept: 'chuches' },
      { concept: 'pan' },
      // Outside the grid, for the test that typing reaches past the six.
      { concept: 'lo del jueves' },
    ],
    suggestions: [
      { text: 'Efectivo', kind: 'method', person: null },
      { text: 'Tarjeta BBVA', kind: 'method', person: MARIO },
      { text: 'Tarjeta Viqui', kind: 'method', person: VIQUI },
      { text: 'farmacia', kind: 'concept', person: null },
    ],
    lastRow: 2298,
    ...overrides,
  }
}

function entry(fields: Omit<Entry, 'note' | 'voided'> & Partial<Entry>): Entry {
  return { note: '', voided: false, ...fields }
}

/**
 * One Tap refuses to show itself, which is the path that matters.
 *
 * It is also the path that was broken: the silent request rejects, the user taps
 * the rendered button, and the credential arrives with nothing waiting for it.
 * Every test here goes in through the button for that reason.
 */
export async function stubGoogle(page: Page, email = 'mario@example.invalid') {
  await page.addInitScript(credential => {
    let config: { callback: (response: { credential: string }) => void } | null = null
    Object.assign(window, {
      google: {
        accounts: {
          id: {
            initialize: (options: typeof config) => { config = options },
            prompt: (listener: (n: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) =>
              listener({ isNotDisplayed: () => true, isSkippedMoment: () => false }),
            renderButton: (target: HTMLElement) => {
              const button = document.createElement('button')
              button.dataset.testid = 'google-sign-in'
              button.textContent = 'Entrar con Google'
              button.onclick = () => config?.callback({ credential })
              target.replaceChildren(button)
            },
          },
        },
      },
    })
  }, fakeCredential(email))
}

export interface ApiCall {
  action: string
  payload: Record<string, unknown>
}

/**
 * The backend, answering from memory. Returns the list of calls it received, so
 * a test can assert what was actually sent rather than what the screen claims.
 */
export async function stubApi(page: Page, data: Bootstrap = bootstrap()): Promise<ApiCall[]> {
  const calls: ApiCall[] = []

  await page.route('**/macros/s/**', async route => {
    const body = JSON.parse(route.request().postData() ?? '{}')
    calls.push({ action: body.action, payload: body.payload })

    if (body.action === 'append' || body.action === 'update') {
      const sent = body.payload as Omit<Entry, 'row' | 'voided'>
      return route.fulfill({ json: { ok: true, data: { ...sent, row: 2299, voided: false } } })
    }
    return route.fulfill({ json: { ok: true, data } })
  })

  return calls
}

/**
 * The draft as it exists on disk, or null.
 *
 * The app writes it without awaiting — a keypad that waited for IndexedDB
 * before repainting would feel like it was thinking — so a test that reloads
 * has to wait for the write rather than assume it happened. On a slow machine
 * the write always wins; on a fast one the reload does, which is how this
 * arrived as a test that passed locally and failed in CI.
 */
export function storedDraft(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate(() => new Promise<Record<string, unknown> | null>(resolve => {
    const request = indexedDB.open('a-medias')
    request.onsuccess = () => {
      try {
        const get = request.result.transaction('draft', 'readonly').objectStore('draft').get('current')
        get.onsuccess = () => resolve(get.result ?? null)
        get.onerror = () => resolve(null)
      } catch {
        // No store yet: opening without a version can create an empty database.
        resolve(null)
      }
    }
    request.onerror = () => resolve(null)
  }))
}

/** Signs in the only way that works without a human: through the button. */
export async function signIn(page: Page) {
  await page.goto('/')
  await page.getByTestId('google-sign-in').click()
  // The first step is the app: waiting for it is waiting for a loaded ledger.
  await page.getByText('Paso 1 de 3').waitFor()
}
