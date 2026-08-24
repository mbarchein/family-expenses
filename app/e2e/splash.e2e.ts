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

test('a request that never left the phone says so, and names the host', async ({ page }) => {
  // Both the request and the probe die, which is what a blocked host, a VPN or
  // a wrong address in the bundle looks like from in here.
  await stubGoogle(page)
  await page.route('**/macros/s/**', route => route.abort())

  await page.goto('/')
  await page.getByTestId('google-sign-in').click()

  await expect(page.getByText('No se ha podido conectar')).toBeVisible()
  // Verbatim and in full: it is not for them to understand, it is for them to
  // be able to read it out.
  await expect(page.getByText(/Último error: NETWORK: No se llega a script\.google\.com/))
    .toBeVisible()
})

test('a server that answers but is not allowed to be read says that instead', async ({ page }) => {
  // The one "fetch failed" hides, and the one that means the backend is
  // misdeployed rather than unreachable: an Apps Script deployment that wants a
  // Google login redirects to a page with no CORS headers, and the browser
  // reports that exactly like a dead network. The probe is what tells them
  // apart — it is the request carrying `ping`, and it gets through.
  await stubGoogle(page)
  await page.route('**/macros/s/**', route => {
    const body = route.request().postData() ?? ''
    if (body.includes('"ping"')) return route.fulfill({ status: 302, body: '' })
    return route.abort()
  })

  await page.goto('/')
  await page.getByTestId('google-sign-in').click()

  await expect(page.getByText(/Último error: NETWORK: script\.google\.com contesta, pero/))
    .toBeVisible()
  await expect(page.getByText(/cualquier persona/)).toBeVisible()
})

test('the probe carries no credential', async ({ page }) => {
  // It is a request whose answer cannot be read. Nothing that identifies anybody
  // belongs in one.
  await stubGoogle(page)
  const bodies: string[] = []
  await page.route('**/macros/s/**', route => {
    const body = route.request().postData() ?? ''
    bodies.push(body)
    if (body.includes('"ping"')) return route.fulfill({ status: 302, body: '' })
    return route.abort()
  })

  await page.goto('/')
  await page.getByTestId('google-sign-in').click()
  await expect(page.getByText(/Último error: NETWORK:/)).toBeVisible()

  const probes = bodies.filter(body => body.includes('"ping"'))
  expect(probes.length).toBeGreaterThan(0)
  for (const probe of probes) expect(probe).not.toContain('idToken')
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

test('the details say which server, which build and which session', async ({ page }) => {
  // "Antes funcionaba" is a claim about two versions of something, and none of
  // the things that could differ were on screen. These are them.
  await stubGoogle(page)
  await page.route('**/macros/s/**', route => route.abort())

  await page.goto('/')
  await page.getByTestId('google-sign-in').click()
  await expect(page.getByText('No se ha podido conectar')).toBeVisible()

  await page.getByText('Detalles').click()
  const panel = page.locator('details')
  await expect(panel).toContainText('Servidor')
  // A link, because opening it settles what the CORS failure was.
  await expect(panel.getByRole('link', { name: /script\.google\.com/ })).toBeVisible()
  await expect(panel).toContainText('Petición')
  await expect(panel).toContainText('bootstrap')
  // The browser's own words, which are the ones worth quoting to anyone else.
  await expect(panel).toContainText(/Respuesta.*(TypeError|Failed)/s)
  // A real commit and a date, never 'dev': a bundle that reached a phone without
  // its stamp is the one thing the stamp exists to rule out, and it has already
  // happened once.
  await expect(panel).toContainText(/Versión\s*[0-9a-f]{7} · \d{4}-\d{2}-\d{2}/)
  await expect(panel).toContainText('Sesión')
  await expect(panel).toContainText('válida')
  await expect(panel).toContainText('mario@example.invalid')
})

test('the token itself never reaches the screen', async ({ page }) => {
  // The session line says how long is left, never what the credential is. A
  // screen that gets photographed and sent to somebody must not be a way to
  // hand over a bearer token.
  await stubGoogle(page)
  await page.route('**/macros/s/**', route => route.abort())

  await page.goto('/')
  await page.getByTestId('google-sign-in').click()
  await expect(page.getByText('No se ha podido conectar')).toBeVisible()
  await page.getByText('Detalles').click()

  const stored = await page.evaluate(() => localStorage.getItem('a-medias:token'))
  const token = JSON.parse(stored ?? '{}').token as string
  expect(token).toBeTruthy()
  await expect(page.locator('body')).not.toContainText(token)
})

test('a page that is not JSON is quoted rather than thrown away', async ({ page }) => {
  // What an Apps Script deployment answers when it wants a login, or when the
  // script threw: an HTML page. It used to arrive as an unexplained
  // "SyntaxError: Unexpected token '<'" from outside every catch in the client.
  await stubGoogle(page)
  await page.route('**/macros/s/**', route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<html><head><title>Se necesita autorización</title></head><body>Inicia sesión</body></html>',
  }))

  await page.goto('/')
  await page.getByTestId('google-sign-in').click()

  // Twice on screen by design: the sentence for them, and the raw line to read
  // out. Either will do here.
  await expect(page.getByText(/no es JSON/).first()).toBeVisible()
  await page.getByText('Detalles').click()
  await expect(page.locator('details')).toContainText('Se necesita autorización')
})
