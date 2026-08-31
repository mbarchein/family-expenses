import { expect, test } from '@playwright/test'
import { bootstrap, signIn, stubApi, stubGoogle } from './harness'

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

test('the sign-in screen invites instead of reporting an error', async ({ page }) => {
  // Reported as a question: «a veces sale "Último error: One Tap se ha saltado",
  // ¿qué es eso?». It is Google's own word for a silent prompt that came up and
  // was not used — the ordinary reason this screen exists — and printed under
  // «Último error» it reads as something broken.
  await stubApi(page)
  await signIn(page)
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()

  // The token is refused on the next open, which is what an expired hour looks
  // like from the backend and the case that shows this screen to somebody the
  // app already knows.
  await page.route('**/macros/s/**', route =>
    route.fulfill({ json: { ok: false, error: { code: 'UNAUTHENTICATED', message: 'no' } } }))
  await page.reload()

  await expect(page.getByText('Tu sesión de Google ha caducado')).toBeVisible()
  // By name, because with several Google accounts on a phone «which one» is the
  // question — it is the same address `login_hint` sends.
  await expect(page.getByText(/Vuelve a entrar como mario@example\.invalid/)).toBeVisible()
  // And nothing in red: neither the refused token nor the silent prompt is a
  // failure, and both are said in Spanish above.
  await expect(page.getByText(/Último error/)).toHaveCount(0)

  // It is still written down, one tap away, for a token being refused when it
  // should be good.
  await page.getByText('Detalles').click()
  await expect(page.getByText(/UNAUTHENTICATED/)).toBeVisible()
})

test('signing in again puts the download on screen, not the button', async ({ page }) => {
  // Reported: after signing in, «Entrar con Google» stayed on screen while the
  // sheet came down, which reads as a sign-in that silently failed — and the
  // obvious thing to do about it is tap the button again.
  //
  // The shape of it: a 401 leaves the status on `needsAuth` with the cache
  // already painted, so the fresh credential starts a request that changes no
  // status at all. What is happening then is a download, and the screen has to
  // say so.
  await stubApi(page)
  await signIn(page)
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()

  // Refused once, so the app asks again with the cache in hand.
  let refuse = true
  let held: (() => void) | null = null
  await page.route('**/macros/s/**', async route => {
    if (refuse) {
      refuse = false
      return route.fulfill({ json: { ok: false, error: { code: 'UNAUTHENTICATED', message: 'no' } } })
    }
    // The next one is held open, which is what a two-thousand-row sheet on a
    // slow connection looks like from here.
    await new Promise<void>(resolve => { held = resolve })
    return route.fallback()
  })
  await page.reload()
  await expect(page.getByTestId('google-sign-in')).toBeVisible()

  await page.getByTestId('google-sign-in').click()

  // The button is gone and the step is named, with the seconds it has been
  // going, rather than the same button sitting there.
  await expect(page.getByRole('status')).toHaveText(/Cargando la hoja/)
  await expect(page.getByTestId('google-sign-in')).toHaveCount(0)

  held?.()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
})

/**
 * The two ways the app could never open at all.
 *
 * Both of these are what "la app no carga después de identificarme" was, and
 * both survived 45 browser tests because every one of them stubs a One Tap that
 * politely says it cannot display itself and a backend that always answers 200.
 * Neither is what a phone with its site data just cleared actually meets.
 */
test('a prompt that never answers still ends on a sign-in button', async ({ page }) => {
  // FedCM does not report the moments the old code waited for, so the silent
  // request settled through nothing at all: no token, no rejection, no sign-in
  // screen, and a splash screen that was the whole app for ever.
  await stubApi(page)
  await stubGoogle(page, 'mario@example.invalid', 'silent')

  await page.goto('/')
  // Longer than the app's own deadline for the silent path, and deliberately
  // tied to nothing: the point is that it is bounded at all.
  await expect(page.getByTestId('google-sign-in')).toBeVisible({ timeout: 20_000 })

  await page.getByTestId('google-sign-in').click()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
})

test('a backend that cannot be reached says so, and can be retried', async ({ page }) => {
  // Nothing cached, because the site data has just been cleared — which is the
  // state in which a single failed request used to be swallowed in silence.
  let broken = true
  await page.route('**/macros/s/**', async route => {
    if (broken) return route.abort()
    return route.fulfill({ json: { ok: true, data: bootstrap() } })
  })

  await page.goto('/')
  await page.getByTestId('google-sign-in').click()
  await expect(page.getByText('No se ha podido conectar')).toBeVisible()

  broken = false
  await page.getByRole('button', { name: 'Volver a cargar' }).click()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
})

test('an answer that never arrives does not leave the splash on screen', async ({ page }) => {
  // The backstop for the third cause nobody has found yet: a request that hangs
  // rather than failing. Fifteen seconds of "A medias" and then something to do.
  await page.route('**/macros/s/**', () => { /* never answered, never refused */ })

  await page.goto('/')
  await page.getByTestId('google-sign-in').click()
  await expect(page.getByText('Esto está tardando demasiado. Vuelve a cargar.'))
    .toBeVisible({ timeout: 25_000 })
})
