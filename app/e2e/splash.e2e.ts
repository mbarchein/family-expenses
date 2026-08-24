import { expect, test } from '@playwright/test'
import { bootstrap, stubApi, stubGoogle } from './harness'

/**
 * The splash screen, which has to say what it is waiting for.
 *
 * "Se queda en el splash" was the same sentence four times over, for four
 * different hangs, because the screen it described was one word on an empty
 * page. These tests are the difference: whatever the fifth one turns out to be,
 * the screen will name the step it died on and print what failed.
 */

test('the splash says what it is waiting for', async ({ page }) => {
  await stubGoogle(page)
  // An answer that never comes, so the step it is stuck on stays on screen to
  // be read rather than flashing past.
  await page.route('**/macros/s/**', () => { /* never answered */ })

  await page.goto('/')
  await page.getByTestId('google-sign-in').click()

  await expect(page.getByRole('status')).toHaveText(/Cargando la hoja/)
  // And how long it has been waiting, which is the difference between slow and
  // never — the counter starts once it is worth reading.
  await expect(page.getByRole('status')).toHaveText(/\d+ s/, { timeout: 10_000 })
})

test('the splash prints the error, not just the fact that there was one', async ({ page }) => {
  await stubGoogle(page)
  await page.route('**/macros/s/**', route => route.abort())

  await page.goto('/')
  await page.getByTestId('google-sign-in').click()

  await expect(page.getByText('No se ha podido conectar')).toBeVisible()
  // Verbatim and in full: it is not for them to understand, it is for them to
  // be able to read it out.
  await expect(page.getByText('Último error: NETWORK: fetch failed')).toBeVisible()
})

test('a backend that refuses says which code it refused with', async ({ page }) => {
  await stubGoogle(page)
  await page.route('**/macros/s/**', route => route.fulfill({
    json: { ok: false, error: { code: 'MISCONFIGURED', message: 'Falta la pestaña Config' } },
  }))

  await page.goto('/')
  await page.getByTestId('google-sign-in').click()

  await expect(page.getByText('Falta la pestaña Config', { exact: true })).toBeVisible()
  await expect(page.getByText('Último error: MISCONFIGURED: Falta la pestaña Config')).toBeVisible()
})

test('Google going quiet is reported on the sign-in screen', async ({ page }) => {
  // The FedCM silence, which is the one that took two reports and a session to
  // find. It now names itself on the only screen the user can still see.
  await stubApi(page)
  await stubGoogle(page, 'mario@example.invalid', 'silent')

  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText(/Comprobando tu sesión de Google/)
  await expect(page.getByText('Último error: Google no ha contestado a tiempo'))
    .toBeVisible({ timeout: 20_000 })
})

test('a load that works says nothing about errors at all', async ({ page }) => {
  // The other half: an app that shouts about a failure it recovered from would
  // be worse than one that says nothing. Once it works, the slate is clean.
  await stubGoogle(page)
  let broken = true
  await page.route('**/macros/s/**', route => {
    if (broken) { broken = false; return route.abort() }
    return route.fulfill({ json: { ok: true, data: bootstrap() } })
  })

  await page.goto('/')
  await page.getByTestId('google-sign-in').click()
  await expect(page.getByText(/^Último error/)).toBeVisible()

  await page.getByRole('button', { name: 'Volver a cargar' }).click()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  await expect(page.getByText(/^Último error/)).toHaveCount(0)
})
