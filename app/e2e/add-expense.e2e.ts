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

/**
 * The native calendar cannot be driven by a test — it is the operating
 * system's, not the page's. What can be driven is everything around it: that
 * tapping the segment asks for it, that the day it returns lands on the button,
 * and that a browser which refuses to open it still lets a day be chosen.
 */
async function watchPicker(page: Page, behaviour: 'open' | 'throw' = 'open') {
  await page.addInitScript(mode => {
    const calls: string[] = []
    Object.assign(window, { __pickers: calls })
    HTMLInputElement.prototype.showPicker = function () {
      calls.push(this.type)
      if (mode === 'throw') throw new Error('no picker here')
    }
  }, behaviour)
  return () => page.evaluate(() => (window as unknown as { __pickers: string[] }).__pickers)
}

/**
 * How wide the date field is drawn.
 *
 * Not `toBeHidden`: the field is clipped to a transparent pixel rather than
 * removed, because `showPicker` throws on an element that is not rendered — and
 * a transparent pixel is "visible" as far as Playwright is concerned. Its width
 * is what separates a field nobody can see from a field on the screen.
 */
function fieldWidth(page: Page): Promise<number> {
  return page.locator('input[type="date"]')
    .boundingBox().then(box => box?.width ?? 0)
}

/** Whatever the native calendar would have returned, returned. */
async function pickDay(page: Page, iso: string) {
  await page.locator('input[type="date"]').evaluate((element, value) => {
    const input = element as HTMLInputElement
    // Through the prototype setter and with an event: React tracks the value it
    // last rendered, and assigning to `.value` alone tells it nothing.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!
      .set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, iso)
}

test('the button opens the calendar and then wears the day it returned', async ({ page }) => {
  // Two bugs, one after the other. "Otra fecha" could not be chosen at all,
  // because which segment was lit was worked out from the date itself. Then it
  // could, but it revealed a date field below the row — a second control saying
  // what the segment beside it already said, plus a tap to get at it.
  const pickers = await watchPicker(page)
  const calls = await stubApi(page)
  await signIn(page)

  const other = page.getByRole('button', { name: 'Otra fecha' })
  await other.click()
  await expect(other).toHaveAttribute('aria-pressed', 'true')

  // The calendar was asked for, and no field appeared to ask for it again.
  expect(await pickers()).toEqual(['date'])
  expect(await fieldWidth(page)).toBeLessThanOrEqual(1)

  await pickDay(page, '2026-08-10')
  // The answer is on the control that asked the question.
  await expect(other).toHaveText('10 ago')
  // And its name is still what it does, not what it says.
  await expect(other).toHaveAttribute('aria-label', 'Otra fecha')

  await typeAmount(page, '12')
  await next(page)
  await page.getByRole('button', { name: 'super', exact: true }).click()
  await next(page)
  await page.getByRole('button', { name: 'Guardar' }).click()

  await expect.poll(() => calls.find(call => call.action === 'append')?.payload.date).toBe('2026-08-10')
})

test('the day goes back to today, and the button says so again', async ({ page }) => {
  await watchPicker(page)
  await stubApi(page)
  await signIn(page)

  const other = page.getByRole('button', { name: 'Otra fecha' })
  await other.click()
  await pickDay(page, '2026-08-10')
  await expect(other).toHaveText('10 ago')

  await page.getByRole('button', { name: 'Hoy' }).click()
  await expect(page.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'true')
  await expect(other).toHaveText('Otra fecha')
})

test('a browser that will not open its calendar shows the field instead', async ({ page }) => {
  // `showPicker` is refused where it is unsupported, and by a browser that did
  // not count the tap as a gesture. A day still has to be choosable: a control
  // that quietly does nothing is the one outcome that cannot be allowed, and it
  // is what this app shipped for a day when the segment could not be lit at all.
  await watchPicker(page, 'throw')
  await stubApi(page)
  await signIn(page)

  await page.getByRole('button', { name: 'Otra fecha' }).click()

  const field = page.locator('input[type="date"]')
  expect(await fieldWidth(page)).toBeGreaterThan(100)
  await field.fill('2026-08-10')
  await expect(page.getByRole('button', { name: 'Otra fecha' })).toHaveText('10 ago')
})

test('the concepts are eight tiles that do not scroll', async ({ page }) => {
  // The row this replaced held every concept and scrolled sideways, so anything
  // past the third was invisible until somebody thought to swipe. A fast path
  // that has to be discovered is not a fast path.
  await stubApi(page)
  await signIn(page)

  await typeAmount(page, '10')
  await next(page)

  const grid = page.getByRole('group', { name: 'Conceptos frecuentes' })
  // Ten concepts are on offer in the fixture; eight is the grid.
  await expect(grid.getByRole('button')).toHaveCount(8)

  const overflow = await grid.evaluate(element => ({
    sideways: element.scrollWidth > element.clientWidth + 1,
    down: element.scrollHeight > element.clientHeight + 1,
  }))
  expect(overflow).toEqual({ sideways: false, down: false })

  // Two columns, four rows — three columns would truncate a long concept.
  const columns = await grid.evaluate(
    element => getComputedStyle(element).gridTemplateColumns.split(' ').length,
  )
  expect(columns).toBe(2)
})

test('the tiles are drawn icons, and an initial where a guess would be a lie', async ({ page }) => {
  await stubApi(page)
  await signIn(page)

  await typeAmount(page, '10')
  await next(page)

  // Drawn from the set, not an emoji: one family, one weight, and it inverts
  // with the tile because it is stroked in `currentColor`.
  await expect(page.getByRole('button', { name: 'gasolina' }).locator('svg')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'farmacia' }).locator('svg')).toHaveCount(1)

  // And nothing at all where a guess would be a lie: the initial instead.
  const unknown = page.getByRole('button', { name: 'chuches' })
  await expect(unknown.locator('svg')).toHaveCount(0)
  await expect(unknown).toContainText('C')
})

test('an icon can be given to a concept, and taken back', async ({ page }) => {
  // The menu exists because the guess is a guess. It is opened from beside the
  // grid it changes: choosing an icon anywhere else is choosing blind.
  await stubApi(page)
  await signIn(page)

  await typeAmount(page, '10')
  await next(page)

  const tile = page.getByRole('button', { name: 'chuches' })
  await expect(tile).toContainText('C')

  // Found by its name and not its label: the control is a cog now, so the word
  // "Iconos" is only its accessible name. A test that looked for text would have
  // gone green on a button nobody blind could find.
  const cog = page.getByRole('button', { name: 'Iconos' })
  await expect(cog).toBeEmpty()
  await cog.click()
  const menu = page.getByRole('dialog')
  // Every concept on offer is listed, and the row says whether its icon was
  // chosen or merely proposed.
  await expect(menu.getByRole('button', { name: /gasolina/ })).toContainText('propuesto')

  await menu.getByRole('button', { name: /chuches/ }).click()
  await page.getByRole('button', { name: 'huella', exact: true }).click()

  // Back on the list rather than out of the menu: labelling one concept and
  // labelling four are the same errand, and "Cerrar" is one tap away.
  await expect(menu.getByRole('button', { name: /chuches/ })).toContainText('elegido')
  await page.getByRole('button', { name: 'Cerrar' }).click()

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(tile.locator('svg')).toHaveCount(1)

  // It survives the app reloading itself, which is what the store is for.
  await page.reload()
  await expect(page.getByText('Paso 2 de 3')).toBeVisible()
  await expect(page.getByRole('button', { name: 'chuches' }).locator('svg')).toHaveCount(1)

  // And "sin icono" is the way back to the initial — which is not the same as
  // choosing nothing, since a concept with a keyword would go back to its guess.
  await page.getByRole('button', { name: 'Iconos' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /chuches/ }).click()
  await page.getByRole('button', { name: 'Sin icono' }).click()
  await page.getByRole('button', { name: 'Cerrar' }).click()
  await expect(page.getByRole('button', { name: 'chuches' })).toContainText('C')
})

test('typing reaches a concept that is not one of the eight', async ({ page }) => {
  // The search runs before the cut, not after it. Otherwise typing would only
  // reorder the tiles already on screen and the ninth concept would be
  // unreachable except by spelling it out in full.
  await stubApi(page)
  await signIn(page)

  await typeAmount(page, '10')
  await next(page)

  const grid = page.getByRole('group', { name: 'Conceptos frecuentes' })
  await expect(grid.getByRole('button', { name: 'lo del jueves' })).toHaveCount(0)

  await page.getByRole('textbox', { name: 'Concepto' }).fill('jueves')
  await expect(grid.getByRole('button', { name: 'lo del jueves' })).toBeVisible()
})
