import { expect, test, type Page } from '@playwright/test'
import { signIn, stubApi, stubGoogle } from './harness'

/**
 * Places, with the browser's own geolocation stubbed by Playwright.
 *
 * The 15 m tolerance is the whole feature and it is not testable by reading the
 * code: what matters is that a coordinate 12 m away is the same shop and one
 * 40 m away is not, end to end, through the store and the chips. Playwright can
 * move the phone, so it does.
 */

// A doorway in Granada. Fine detail matters here — a longitude degree is a
// fifth shorter than a latitude one at this latitude — so all the movement in
// these tests is north, where the arithmetic is the same everywhere.
const DOOR = { latitude: 37.1773, longitude: -3.5986 }
const METRE = 1 / 111_195
const northOf = (metres: number) => ({ ...DOOR, latitude: DOOR.latitude + metres * METRE })

const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click()
const key = (page: Page, digit: string) =>
  page.getByRole('button', { name: digit, exact: true }).click()

async function typeAmount(page: Page, digits: string) {
  for (const digit of digits) await key(page, digit === '.' ? ',' : digit)
}

/** Straight to the second step with an amount in, which is where the concept
 *  and the button that saves a place both live. */
async function reachDetails(page: Page) {
  await typeAmount(page, '10')
  await next(page)
}

test.beforeEach(async ({ page }) => {
  await stubGoogle(page)
})

test.describe('with the location allowed', () => {
  test.use({ permissions: ['geolocation'], geolocation: DOOR })

  test('a saved place offers its concept back, first', async ({ page }) => {
    const calls = await stubApi(page)
    await signIn(page)
    await reachDetails(page)

    // A concept that is in neither list, so finding it later can only mean the
    // place produced it.
    await page.getByRole('textbox', { name: 'Concepto' }).fill('ferretería')
    await page.getByRole('button', { name: 'Guardar este sitio' }).click()
    await expect(page.getByRole('button', { name: 'Sitio guardado' })).toBeVisible()

    // Save the expense, which starts the flow over, and come back.
    await next(page)
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Paso 1 de 3')).toBeVisible()
    await reachDetails(page)

    // First, because standing where you stood last time beats any frequency.
    const concepts = page.getByRole('group', { name: 'Conceptos frecuentes' })
    await expect(concepts.getByRole('button').first()).toHaveText('ferretería')

    // And the one thing that must never happen: no coordinate ever left the
    // device. Nothing sent to the backend contains the place.
    expect(JSON.stringify(calls)).not.toContain('37.17')
    expect(JSON.stringify(calls)).not.toContain('-3.59')
  })

  test('forty metres away is somewhere else', async ({ page, context }) => {
    // The tolerance, end to end. Fifteen metres is the radius, so a doorway
    // forty metres up the street is a different shop and must not lend its
    // concept — that is the difference between this and a feature that suggests
    // "super" everywhere in the neighbourhood.
    await stubApi(page)
    await signIn(page)
    await reachDetails(page)

    await page.getByRole('textbox', { name: 'Concepto' }).fill('ferretería')
    await page.getByRole('button', { name: 'Guardar este sitio' }).click()
    await expect(page.getByRole('button', { name: 'Sitio guardado' })).toBeVisible()

    await context.setGeolocation(northOf(40))
    // Back to the first step and forward again: the position is read when this
    // screen mounts, so this is a fresh look from a new place.
    await page.goBack()
    await next(page)

    // Empty the field first: it is the search box for these chips, so leaving
    // "ferretería" in it would filter the row down to nothing and prove nothing.
    await page.getByRole('textbox', { name: 'Concepto' }).fill('')

    await expect(page.getByRole('button', { name: 'farmacia' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'ferretería' })).toHaveCount(0)

    // Still saved, though — it is out of range, not forgotten.
    await page.getByRole('button', { name: 'Sitios' }).click()
    await expect(page.getByRole('listitem').filter({ hasText: 'ferretería' })).toHaveCount(1)
  })

  test('the places screen lists what was saved and can forget it', async ({ page }) => {
    await stubApi(page)
    await signIn(page)
    await reachDetails(page)

    await page.getByRole('textbox', { name: 'Concepto' }).fill('ferretería')
    await page.getByRole('button', { name: 'Guardar este sitio' }).click()
    await expect(page.getByRole('button', { name: 'Sitio guardado' })).toBeVisible()

    await page.getByRole('button', { name: 'Sitios' }).click()
    const row = page.getByRole('listitem').filter({ hasText: 'ferretería' })
    await expect(row).toHaveCount(1)
    // The line that has to be on this screen: it says where the coordinates live.
    await expect(page.getByText('solo en este dispositivo')).toBeVisible()

    page.once('dialog', dialog => void dialog.accept())
    await row.getByRole('button', { name: 'Borrar' }).click()
    await expect(page.getByText('Todavía no has guardado ningún sitio')).toBeVisible()
  })

  test('a place needs a concept to be saved against', async ({ page }) => {
    await stubApi(page)
    await signIn(page)
    await reachDetails(page)

    await page.getByRole('button', { name: 'Guardar este sitio' }).click()
    await expect(page.getByRole('alert')).toHaveText('Pon primero el concepto')
  })
})

test.describe('with the location not allowed', () => {
  test('nothing is suggested, and nothing is asked for', async ({ page }) => {
    // The permission is undecided here, which is the state every user starts in.
    // The screen must not read the position and must not raise a dialog: the
    // chips are the ones the sheet and the history gave it, in that order.
    await stubApi(page)
    await signIn(page)
    await reachDetails(page)

    const concepts = page.getByRole('group', { name: 'Conceptos frecuentes' })
    await expect(concepts.getByRole('button').first()).toHaveText('farmacia')
  })

  test('a refusal is said out loud rather than going quiet', async ({ page }) => {
    // The refusal is stubbed rather than left to the browser: an undecided
    // prompt in a headless Chromium neither denies nor answers, and what is
    // being tested is what the screen does with a no — a button that silently
    // did nothing would be indistinguishable from a broken one, and this app
    // cannot re-ask for a permission it has been refused.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: (_ok: unknown, fail: (error: { code: number }) => void) =>
            fail({ code: 1 }),
        },
      })
    })
    await stubApi(page)
    await signIn(page)
    await reachDetails(page)

    await page.getByRole('textbox', { name: 'Concepto' }).fill('ferretería')
    await page.getByRole('button', { name: 'Guardar este sitio' }).click()
    await expect(page.getByRole('alert')).toContainText('Sin permiso de ubicación')
  })
})
