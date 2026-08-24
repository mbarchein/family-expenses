import { expect, test, type Page } from '@playwright/test'
import { bootstrap, signIn, storedDraft, stubApi, stubGoogle } from './harness'

test.beforeEach(async ({ page }) => {
  await stubGoogle(page)
})

const next = (page: Page) => page.getByRole('button', { name: 'Siguiente' }).click()
const key = (page: Page, digit: string) =>
  page.getByRole('button', { name: digit, exact: true }).click()

async function typeAmount(page: Page, digits: string) {
  for (const digit of digits) await key(page, digit === '.' ? ',' : digit)
}

test('the sign-in button signs you in', async ({ page }) => {
  // The failure this replaces: One Tap could not display itself, the silent
  // request rejected, and the credential from the tapped button resolved a
  // promise that had already settled — which does nothing. A valid token sat in
  // memory, nothing asked for the ledger again, and the button only ever
  // reopened Google's account chooser.
  await stubApi(page)
  await page.goto('/')

  await expect(page.getByTestId('google-sign-in')).toBeVisible()
  await page.getByTestId('google-sign-in').click()

  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  await expect(page.getByTestId('google-sign-in')).toHaveCount(0)
})

test('every step fits on the screen', async ({ page }) => {
  // Not a nicety. The screen this replaced was a column of nine blocks of equal
  // weight, which put the keypad and the save button — the two most used
  // controls in the app — below the fold on a phone.
  await stubApi(page)
  await signIn(page)

  const overflows = () => page.evaluate(
    () => document.scrollingElement!.scrollHeight > window.innerHeight + 1,
  )

  expect(await overflows()).toBe(false)
  await typeAmount(page, '23,5')
  await next(page)

  expect(await overflows()).toBe(false)
  await page.getByRole('button', { name: 'super', exact: true }).click()
  await next(page)

  expect(await overflows()).toBe(false)
  await expect(page.getByRole('button', { name: 'Guardar' })).toBeInViewport()
})

test('back walks the steps, and the last one back leaves the flow alone', async ({ page }) => {
  // The point of the three screens: the device's back button has to mean "the
  // previous view", not "close the app halfway through typing an expense".
  await stubApi(page)
  await signIn(page)

  await typeAmount(page, '10')
  await next(page)
  await expect(page.getByText('Paso 2 de 3')).toBeVisible()

  await page.getByRole('button', { name: 'super', exact: true }).click()
  await next(page)
  await expect(page.getByText('Paso 3 de 3')).toBeVisible()

  await page.goBack()
  await expect(page.getByText('Paso 2 de 3')).toBeVisible()
  // And what was typed is still there on the way back.
  await expect(page.getByRole('textbox', { name: 'Concepto' })).toHaveValue('super')

  await page.goBack()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  // The amount lives in the output together with its € sign, so this is a
  // containment check and not an exact one.
  await expect(page.locator('output')).toContainText('10')
})

test('the field searches the chips, and nothing is focused on arrival', async ({ page }) => {
  await stubApi(page)
  await signIn(page)

  await typeAmount(page, '10')
  await next(page)

  // Landing with the keyboard already up would hide the chips behind it and
  // make the common case — tap one, move on — cost an extra gesture.
  await expect(page.getByRole('textbox', { name: 'Concepto' })).not.toBeFocused()
  await expect(page.getByRole('button', { name: 'gasolina' })).toBeVisible()

  // A dropped letter still finds it: 'sper' is a subsequence of 'super', which
  // is the difference between this and a substring filter.
  await page.getByRole('textbox', { name: 'Concepto' }).fill('sper')

  await expect(page.getByRole('button', { name: 'super', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'gasolina' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'comedor' })).toHaveCount(0)

  // Tapping the match finishes the word rather than adding a second field.
  await page.getByRole('button', { name: 'super', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Concepto' })).toHaveValue('super')
})

test('a chip sets the concept and leaves the payer alone', async ({ page }) => {
  // It used to set the payer as well, to whoever pays that concept most often,
  // so tapping a chip changed who was paying — silently, and over a choice the
  // user had just made. Who pays is the whole point of this ledger.
  await stubApi(page)
  await signIn(page)

  await typeAmount(page, '10')
  await page.getByRole('button', { name: 'Paga Viqui' }).click()
  await next(page)

  await page.getByRole('button', { name: 'super', exact: true }).click()
  await next(page)

  // The review is where a changed payer would show up, and it says Viqui.
  await expect(page.getByText('Viqui', { exact: true })).toBeVisible()
})

test('the payment methods follow whoever is paying', async ({ page }) => {
  await stubApi(page)
  await signIn(page)

  await typeAmount(page, '10')
  await next(page)

  // Mario is holding the phone, so Mario pays unless told otherwise.
  await expect(page.getByRole('button', { name: 'Tarjeta BBVA' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tarjeta Viqui' })).toHaveCount(0)

  await page.goBack()
  await page.getByRole('button', { name: 'Paga Viqui' }).click()
  await next(page)

  await expect(page.getByRole('button', { name: 'Tarjeta BBVA' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tarjeta Viqui' })).toBeVisible()
  // The common ones belong to nobody, so they never move.
  await expect(page.getByRole('button', { name: 'Efectivo' })).toBeVisible()
})

test('saving sends the amount, the payer and the payment method', async ({ page }) => {
  const calls = await stubApi(page)
  await signIn(page)

  await typeAmount(page, '23,5')
  await next(page)
  await page.getByRole('button', { name: 'super', exact: true }).click()
  await page.getByRole('button', { name: 'Tarjeta BBVA' }).click()
  await next(page)
  await page.getByRole('button', { name: 'Guardar' }).click()

  await expect.poll(() => calls.filter(call => call.action === 'append').length).toBe(1)

  const sent = calls.find(call => call.action === 'append')!.payload
  expect(sent).toMatchObject({
    concept: 'super',
    amount: 23.5,
    payer: 1,
    // The whole reason the Sugerencias tab exists: this lands in column
    // `observaciones`, and it is the only thing that writes there.
    note: 'Tarjeta BBVA',
  })
  expect(String(sent.id)).toHaveLength(36)

  // And the flow starts over rather than leaving the saved expense on screen.
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
})

test('a half-typed expense survives the app being reloaded', async ({ page }) => {
  // This app reloads itself when it finds a new version, which used to take
  // whatever was on screen with it.
  await stubApi(page)
  await signIn(page)

  await typeAmount(page, '41,2')
  await next(page)
  await page.getByRole('button', { name: 'super', exact: true }).click()

  // Wait for the write instead of assuming it. This is the whole point of the
  // test: what is on disk when the page goes away is what comes back.
  await expect.poll(() => storedDraft(page).then(draft => draft?.concept ?? null)).toBe('super')

  await page.reload()
  // The double always refuses One Tap, so a fresh load always needs the button.
  // The real thing signs a returning user back in without one; what is being
  // tested here is what survives the reload, not how it gets past the door.
  await page.getByTestId('google-sign-in').click()

  await expect(page.getByText('Paso 2 de 3')).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Concepto' })).toHaveValue('super')
  // Back still works after a reload, and that needs the history rebuilt on the
  // way in: the page has only just loaded, so there is nothing behind it yet.
  await page.goBack()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  await expect(page.locator('output')).toContainText('41,2')
})

test('an account that is neither of the two can look but not write', async ({ page }) => {
  await stubApi(page, bootstrap({ config: { people: bootstrap().config.people, meIndex: -1 } }))
  await signIn(page)

  await typeAmount(page, '10')
  await next(page)
  await page.getByRole('button', { name: 'super', exact: true }).click()
  await next(page)

  await expect(page.getByRole('button', { name: 'Guardar' })).toBeDisabled()
})

test('the header stays put when the step changes', async ({ page }) => {
  // It did not. The back arrow appeared on step two where step one had a narrow
  // spacer, so the step counter and the progress pills shifted sideways and down
  // at the exact moment the screen changed — the one moment the eye is on them.
  await stubApi(page)
  await signIn(page)

  const counter = page.locator('header p')
  const before = await counter.boundingBox()

  await typeAmount(page, '10')
  await next(page)
  await expect(page.getByText('Paso 2 de 3')).toBeVisible()

  const after = await counter.boundingBox()
  expect(after!.x).toBeCloseTo(before!.x, 0)
  expect(after!.y).toBeCloseTo(before!.y, 0)

  // And the arrow that appeared is drawn, not typed: a font glyph lands at a
  // different height on every device.
  const back = page.getByRole('button', { name: 'Atrás' })
  await expect(back.locator('svg')).toBeVisible()
  await expect(back).not.toContainText('←')
})

test('another date can actually be chosen', async ({ page }) => {
  // It could not. Which segment was lit was worked out from the date itself, so
  // "Otra fecha" was on only when the date was already neither today nor
  // yesterday — and choosing it set the date to the date it already had.
  // Nothing lit up, no picker appeared, and there was no way to reach it at all.
  const calls = await stubApi(page)
  await signIn(page)

  const other = page.getByRole('button', { name: 'Otra fecha' })
  await other.click()
  await expect(other).toHaveAttribute('aria-pressed', 'true')

  const field = page.getByLabel('Otra fecha')
  await expect(field).toBeVisible()
  await field.fill('2026-08-10')
  // Still on screen after a day was picked: a hand-picked day stays hand-picked.
  await expect(other).toHaveAttribute('aria-pressed', 'true')

  await typeAmount(page, '12')
  await next(page)
  await page.getByRole('button', { name: 'super', exact: true }).click()
  await next(page)
  await page.getByRole('button', { name: 'Guardar' }).click()

  await expect.poll(() => calls.find(call => call.action === 'append')?.payload.date).toBe('2026-08-10')
})

test('the day goes back to today, and the picker goes away with it', async ({ page }) => {
  await stubApi(page)
  await signIn(page)

  await page.getByRole('button', { name: 'Otra fecha' }).click()
  await expect(page.getByLabel('Otra fecha')).toBeVisible()

  await page.getByRole('button', { name: 'Hoy' }).click()
  await expect(page.getByLabel('Otra fecha')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'true')
})
