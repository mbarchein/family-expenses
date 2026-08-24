import { expect, test } from '@playwright/test'
import { signIn, stubApi, stubGoogle } from './harness'

/**
 * Being remembered between openings.
 *
 * The stubbed One Tap always refuses to display itself — see `harness.ts` — which
 * is the pessimistic half of the real world and the half that matters here. With
 * the silent path unavailable, whether the app opens on the keypad or on a login
 * screen comes down entirely to whether it kept the token it already had.
 */

test.beforeEach(async ({ page }) => {
  await stubGoogle(page)
})

test('a token that has not expired survives closing the app', async ({ page }) => {
  // The bug this replaces: the token lived in a variable, so every cold start
  // began with no credential and had to get one out of Google before it could
  // ask for anything — and asked the user to sign in whenever that failed.
  await stubApi(page)
  await signIn(page)

  await page.reload()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  await expect(page.getByTestId('google-sign-in')).toHaveCount(0)
})

test('an expired token asks again rather than being sent to the backend', async ({ page }) => {
  const calls = await stubApi(page)
  await page.addInitScript(() => {
    localStorage.setItem('a-medias:token', JSON.stringify({
      token: 'stale.token.here',
      expiresAt: Date.now() - 1000,
    }))
  })

  await page.goto('/')
  await expect(page.getByTestId('google-sign-in')).toBeVisible()
  // And nothing went out carrying it: a credential known to be dead is worth one
  // sign-in, not a round trip that will come back rejected.
  expect(JSON.stringify(calls)).not.toContain('stale.token.here')

  await page.getByTestId('google-sign-in').click()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
})

test('a rejected token is thrown away, not retried for ever', async ({ page }) => {
  // The backend is the authority on whether a token is any good — the sharing
  // list can change under a token that is still within its hour. When it says
  // no, the stored one has to go, or every cold start would hand it back.
  await stubApi(page)
  await signIn(page)

  const stored = await page.evaluate(() => localStorage.getItem('a-medias:token'))
  expect(stored).toContain('expiresAt')

  await page.route('**/macros/s/**', route =>
    route.fulfill({ json: { ok: false, error: { code: 'UNAUTHENTICATED', message: 'no' } } }))
  await page.reload()

  await expect(page.getByTestId('google-sign-in')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('a-medias:token'))).toBeNull()
})
