import type { Page } from '@playwright/test'
import type { Bootstrap, Entry, Fixed } from '../src/api/types'

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

/**
 * The fixture's days, worked out from the real clock rather than written down.
 *
 * A hardcoded '2026-08-23' is in "this month" for a few weeks and then silently
 * is not, which would make the totals over the list a test that passes today and
 * fails in September for no reason anybody could see. `new Date(y, m - 1, …)`
 * rolls the year back on its own, so January needs no special case.
 */
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` +
  `-${String(date.getDate()).padStart(2, '0')}`

const now = new Date()
export const TODAY = iso(now)
export const PREVIOUS_MONTH = iso(new Date(now.getFullYear(), now.getMonth() - 1, 15))
/** June of last year: far enough back that it is never "the previous month",
 *  whatever today is — including the first of January. */
export const LAST_YEAR = iso(new Date(now.getFullYear() - 1, 5, 15))

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
      entry({ row: 2298, id: 'one', date: TODAY, concept: 'super', amount: 326.72, payer: VIQUI }),
      entry({ row: 2297, id: 'two', date: TODAY, concept: 'gasolina', amount: 60, payer: MARIO }),
      entry({ row: 2296, id: 'three', date: PREVIOUS_MONTH, concept: 'luz', amount: 100, payer: MARIO }),
      // Last year's, so the year total has something to exclude.
      entry({ row: 2295, id: 'four', date: LAST_YEAR, concept: 'seguro', amount: 1000, payer: VIQUI }),
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
      { concept: 'agua' },
      { concept: 'seguro' },
      { concept: 'pan' },
      // Outside the grid, for the test that typing reaches past the last tile.
      //
      // Nine of them here while the backend sent eight, which is how a browser
      // test for exactly this passed while the real thing was broken: the double
      // was more generous than production. The backend now sends up to two
      // hundred — if that ever shrinks to the size of the grid again, the test
      // that catches it is in `apps-script/test/`, not here.
      { concept: 'lo del jueves' },
    ],
    // The Categorías tab, small but real: two of these share an icon, which is
    // allowed and which the app is supposed to say out loud.
    categories: [
      { name: 'Supermercado', icon: 'cesta', words: ['supermercado', 'super', 'compra'] },
      { name: 'Combustible', icon: 'combustible', words: ['gasolinera', 'gasolina'] },
      { name: 'Restaurantes', icon: 'cubiertos', words: ['restaurante', 'cena', 'comedor'] },
      { name: 'Cafés y bares', icon: 'cubiertos', words: ['cafeteria', 'bar'] },
      { name: 'Luz', icon: 'bombilla', words: ['electricidad', 'luz'] },
      { name: 'Colegio', icon: 'mochila', words: ['colegio', 'escolar'] },
    ],
    suggestions: [
      { text: 'Efectivo', kind: 'method', person: null },
      { text: 'Tarjeta BBVA', kind: 'method', person: MARIO },
      { text: 'Tarjeta Viqui', kind: 'method', person: VIQUI },
      { text: 'farmacia', kind: 'concept', person: null },
      // A `note` suggestion, so the two pill rows can be told apart: the methods
      // fill column I and these fill the observaciones.
      { text: 'a medias', kind: 'note', person: null },
    ],
    // No recurring templates by default: the banner has to be absent, not empty,
    // on every screen that is not about it.
    fixed: [],
    lastRow: 2298,
    ...overrides,
  }
}

export function entry(
  fields: Omit<Entry, 'note' | 'voided' | 'category' | 'method'> & Partial<Entry>,
): Entry {
  return { note: '', category: '', method: '', voided: false, ...fields }
}

/**
 * What the silent prompt does, which is the difference between two real worlds.
 *
 * `notDisplayed` is One Tap saying it cannot show itself — the pre-FedCM answer,
 * and the one every test here relies on: the silent request rejects, the user
 * taps the rendered button, and the credential arrives with nothing waiting for
 * it.
 *
 * `silent` is what FedCM does, and what made the app unopenable. Google does not
 * invoke `isNotDisplayed()` or `isSkippedMoment()` once `use_fedcm_for_prompt`
 * is on, so a prompt that produces no credential produces no notification
 * either. Nothing was stubbed this way, which is exactly how 45 browser tests
 * passed over a bug that left the app on its splash screen for ever.
 */
export type Moment = 'notDisplayed' | 'silent'

export async function stubGoogle(
  page: Page,
  email = 'mario@example.invalid',
  moment: Moment = 'notDisplayed',
) {
  await page.addInitScript(([credential, moment]) => {
    let config: { callback: (response: { credential: string }) => void } | null = null
    Object.assign(window, {
      google: {
        accounts: {
          id: {
            initialize: (options: typeof config) => { config = options },
            prompt: (listener: (n: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => {
              if (moment === 'silent') return
              listener({ isNotDisplayed: () => true, isSkippedMoment: () => false })
            },
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
  }, [fakeCredential(email), moment] as const)
}

/**
 * A ledger with a year and a half in it, for the screen that has to render one.
 *
 * The window the backend sends reaches back to last January, so on this
 * household's sheet the list is over a thousand rows rather than the three
 * hundred it used to be. A fixture of two entries could never have caught what
 * that does to a phone.
 */
export function longLedger(days = 400, perDay = 3): Bootstrap {
  const entries: Entry[] = []
  const start = new Date()
  for (let back = 0; back < days; back++) {
    const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() - back)
    for (let n = 0; n < perDay; n++) {
      entries.push(entry({
        row: 2298 - entries.length,
        id: `e${entries.length}`,
        date: iso(day),
        concept: n === 0 ? 'super' : `compra ${back}-${n}`,
        amount: 10 + n,
        payer: (back + n) % 2 === 0 ? VIQUI : MARIO,
      }))
    }
  }
  return bootstrap({ entries, lastRow: 2298 })
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
  await stubTiles(page)

  await page.route('**/macros/s/**', async route => {
    const body = JSON.parse(route.request().postData() ?? '{}')
    calls.push({ action: body.action, payload: body.payload })

    if (body.action === 'append' || body.action === 'update') {
      const sent = body.payload as Omit<Entry, 'row' | 'voided'>
      return route.fulfill({ json: { ok: true, data: { ...sent, row: 2299, voided: false } } })
    }
    // The two writes on the Fijos tab, answered in their own shape.
    //
    // They used to fall through to the bootstrap below, which the client checks
    // and refuses — so `fixedDone` threw `NOT_LEDGER` on every skip in every
    // test, and the tests that exercise skipping were passing over a failure.
    // What made that visible was giving the button something to say when it
    // fails.
    if (body.action === 'fixedDone') {
      const sent = body.payload as { id?: string; row?: number; due: string }
      return route.fulfill({ json: { ok: true, data: { row: sent.row ?? 2, last: sent.due } } })
    }
    if (body.action === 'saveFixed') {
      const sent = body.payload as { id?: string; row?: number }
      return route.fulfill({
        json: { ok: true, data: { row: sent.row || 9, id: sent.id ?? '' } },
      })
    }
    return route.fulfill({ json: { ok: true, data } })
  })

  return calls
}

/**
 * The map, answered from memory as well.
 *
 * The review step asks openstreetmap.org for tiles the moment the place switch
 * goes on, and no test has any business leaving the machine: in CI it would be a
 * suite that reports somebody else's uptime, and in a sandbox with no route out
 * it would be twelve requests waiting to fail. One transparent pixel, per tile.
 *
 * Deliberately still routed rather than blocked, because what the tests need to
 * be able to say is *which* requests went out and where to — see the place tests.
 */
export async function stubTiles(page: Page) {
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  )
  await page.route('**/tile.openstreetmap.org/**', route =>
    route.fulfill({ body: pixel, contentType: 'image/png' }))
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

/**
 * Writes something into the bootstrap cache, to be found on the next load.
 *
 * For one test, and it is the test for the worst bug this app has had: a stored
 * object that is not a ledger is painted before anything else happens, so it
 * crashes the app before it can reach the network to replace it, and the crash
 * screen's only button starts the same load again. Reproducing it needs a way to
 * put the bad value there in the first place.
 */
export function poisonCache(page: Page, value: unknown): Promise<void> {
  return page.evaluate(bad => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('a-medias')
    request.onsuccess = () => {
      const tx = request.result.transaction('cache', 'readwrite')
      tx.objectStore('cache').put(bad, 'bootstrap')
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    }
    request.onerror = () => reject(request.error)
  }), value)
}

/** Signs in the only way that works without a human: through the button. */
export async function signIn(page: Page) {
  await page.goto('/')
  await page.getByTestId('google-sign-in').click()
  // The first step is the app: waiting for it is waiting for a loaded ledger.
  await page.getByText('Paso 1 de 3').waitFor()
}

/** A recurring template, defaulting to the rent: monthly, on the 1st, 700. */
export function fixed(over: Partial<Fixed> = {}): Fixed {
  return {
    // Readable rather than a uuid, and it is what the address of a template is
    // made of — `/fijos/f-alquiler` in a test says which one it means.
    id: 'f-alquiler',
    row: 2,
    concept: 'alquiler',
    amount: 700,
    day: 1,
    payer: VIQUI,
    months: 1,
    active: true,
    from: '',
    last: '',
    category: '',
    method: '',
    ...over,
  }
}

/** The first of the current month, which is always due by definition. */
export function firstOfThisMonth(): string {
  return `${TODAY.slice(0, 7)}-01`
}
