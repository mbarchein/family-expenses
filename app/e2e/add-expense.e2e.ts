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
    // Column I, its own. It used to land in `observaciones` alongside the free
    // text, which meant one expense could not say both how it was paid and
    // anything else about itself — and nothing could be totalled by card.
    method: 'Tarjeta BBVA',
    note: '',
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

test('the step and its bars are stacked in the middle, and the header keeps its height', async ({ page }) => {
  await stubApi(page)
  await signIn(page)

  const header = page.locator('header')
  const counter = header.locator('p')
  const pills = header.locator('div[aria-hidden="true"]')

  const tall = (await header.boundingBox())!.height
  for (const step of ['Paso 1 de 3', 'Paso 2 de 3', 'Paso 3 de 3']) {
    await expect(page.getByText(step)).toBeVisible()

    const [box, text, bars] = await Promise.all(
      [header, counter, pills].map(locator => locator.boundingBox()))

    // One above the other, both centred on the header rather than pushed to
    // opposite ends of it. The bars are a real box and carry the assertion; the
    // counter's box spans the column on purpose — see AddScreen — so what is
    // checked there is that its text is centred within it.
    expect(text!.y).toBeLessThan(bars!.y)
    const middle = box!.x + box!.width / 2
    await expect(counter).toHaveCSS('text-align', 'center')
    expect(text!.x + text!.width / 2).toBeCloseTo(middle, 0)
    expect(bars!.x + bars!.width / 2).toBeCloseTo(middle, 0)

    // And the header is the same height on every step — the stack lives inside
    // the height the two buttons already give it.
    expect(box!.height).toBeCloseTo(tall, 0)

    if (step === 'Paso 1 de 3') await typeAmount(page, '10')
    if (step === 'Paso 2 de 3') await page.getByRole('textbox', { name: 'Concepto' }).fill('super')
    if (step !== 'Paso 3 de 3') await next(page)
  }
})

test('the icons cog sits on the line of the concept field', async ({ page }) => {
  // It was a small cog attached to a label above a grid of large tiles: the
  // smallest thing on the screen, next to the one thing nobody touches.
  await stubApi(page)
  await signIn(page)
  await typeAmount(page, '10')
  await next(page)

  const field = page.getByRole('textbox', { name: 'Concepto' })
  const cog = page.getByRole('button', { name: 'Iconos' })

  const [box, button] = await Promise.all([field.boundingBox(), cog.boundingBox()])
  // Same line, to the right of the field, and the same height as it.
  expect(button!.y).toBeCloseTo(box!.y, 0)
  expect(button!.height).toBeCloseTo(box!.height, 0)
  expect(button!.x).toBeGreaterThan(box!.x + box!.width - 1)
})

test('an observación can be typed, not only picked from the pills', async ({ page }) => {
  // Until now the pills were the only way to fill this field while apuntando: a
  // note nobody had written into the Sugerencias tab could not be entered at
  // all — not here, and not on the review step, which only shows it. The way to
  // add one was to save the expense and then edit it.
  const calls = await stubApi(page)
  await signIn(page)

  await typeAmount(page, '12')
  await next(page)
  await page.getByRole('button', { name: 'super', exact: true }).click()

  const note = page.getByRole('textbox', { name: 'Observaciones' })
  await note.fill('lo pongo yo y me lo pasas')
  await next(page)

  // It reaches the review step as what will be written.
  await expect(page.getByText('lo pongo yo y me lo pasas')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar' }).click()

  await expect.poll(() => calls.filter(call => call.action === 'append').length).toBe(1)
  expect(calls.find(call => call.action === 'append')!.payload)
    .toMatchObject({ note: 'lo pongo yo y me lo pasas' })
})

test('a note pill fills the same field the keyboard writes into', async ({ page }) => {
  // One field and one draft key, so there is no second state to disagree with
  // the first: tapping a pill fills the box, and typing over it is just typing.
  await stubApi(page)
  await signIn(page)

  await typeAmount(page, '12')
  await next(page)
  const note = page.getByRole('textbox', { name: 'Observaciones' })

  await page.getByRole('button', { name: 'a medias', exact: true }).click()
  await expect(note).toHaveValue('a medias')

  await note.fill('a medias con mi hermana')
  await expect(note).toHaveValue('a medias con mi hermana')
  // And the pill is no longer the one that is on.
  await expect(page.getByRole('button', { name: 'a medias', exact: true }))
    .not.toHaveAttribute('aria-pressed', 'true')
})

test('the method and the observación are two fields now', async ({ page }) => {
  // They shared one while the method travelled inside the observaciones, so an
  // expense could say how it was paid or something about itself, never both.
  const calls = await stubApi(page)
  await signIn(page)

  await typeAmount(page, '40')
  await next(page)
  await page.getByRole('textbox', { name: 'Concepto' }).fill('cena')
  await page.getByRole('button', { name: 'Efectivo' }).click()
  await page.getByRole('textbox', { name: 'Observaciones' }).fill('lo pongo yo')
  await next(page)
  await page.getByRole('button', { name: 'Guardar' }).click()

  await expect.poll(() => calls.find(call => call.action === 'append')?.payload)
    .toMatchObject({ method: 'Efectivo', note: 'lo pongo yo' })
})

test('the payer buttons wear a face, and each one can be changed', async ({ page }) => {
  // Two names in the same type are told apart by reading them, and this row is
  // pressed without looking. The choice is per phone: it is a preference about
  // how a button looks, not a fact about the ledger.
  await stubApi(page)
  await signIn(page)

  const viqui = page.getByRole('button', { name: 'Paga Viqui' })
  await expect(viqui.locator('svg')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Paga Mario' }).locator('svg')).toBeVisible()

  // Into the menu the cog opens, which is where the pictures are chosen.
  await typeAmount(page, '10')
  await next(page)
  await page.getByRole('button', { name: 'Iconos' }).click()
  await page.getByRole('button', { name: /^Viqui/ }).click()

  await expect(page.getByRole('button', { name: 'La Gioconda' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'El grito' }).click()

  // Back on the list, the row says which painting she is now.
  await expect(page.getByRole('button', { name: /^Viqui/ })).toContainText('El grito')
})

test('a chosen face is still there after the app reloads', async ({ page }) => {
  await stubApi(page)
  await signIn(page)
  await typeAmount(page, '10')
  await next(page)
  await page.getByRole('button', { name: 'Iconos' }).click()
  await page.getByRole('button', { name: /^Mario/ }).click()
  await page.getByRole('button', { name: 'Frida Kahlo' }).click()
  await expect(page.getByRole('button', { name: /^Mario/ })).toContainText('Frida Kahlo')

  await page.reload()
  await page.getByText('Paso 2 de 3').waitFor()
  await page.getByRole('button', { name: 'Iconos' }).click()

  await expect(page.getByRole('button', { name: /^Mario/ })).toContainText('Frida Kahlo')
})

test('the payer tiles are square-ish, and say the name without the verb', async ({ page }) => {
  // "Paga Viqui" side by side gave the face a fifth of the width and the verb
  // the rest, which is the wrong way round on the one row of this screen that is
  // aimed at rather than read. The verb stays as the accessible name — the
  // button does mean "paga Viqui", and a screen reader should still say so.
  await stubApi(page)
  await signIn(page)

  const viqui = page.getByRole('button', { name: 'Paga Viqui' })
  await expect(viqui).toHaveText('Viqui')

  const box = (await viqui.boundingBox())!
  expect(box.width / box.height).toBeLessThan(1.6)
  // And the face is drawn big enough to be the reason the tile got taller.
  const face = (await viqui.locator('svg').boundingBox())!
  expect(face.height).toBeGreaterThanOrEqual(32)

  // Still fits without scrolling, which is what the keypad's whole layout is for.
  const room = await page.evaluate(() => {
    const main = document.querySelector('main')!
    return main.scrollHeight - main.clientHeight
  })
  expect(room).toBeLessThanOrEqual(0)
})

test('a concept apuntado a minute ago can be found by typing it', async ({ page }) => {
  // What was reported: `Museo` was entered, and the next day typing `mus` found
  // nothing. Two causes, one on each side — the backend sent only the eight
  // concepts the grid shows, so the search had nothing else to look through; and
  // the app searched only what the backend sent, so a concept still in the
  // outbound queue was invisible even to the phone that had just typed it.
  //
  // This is the second half, so the entry has to stay in the queue: the append
  // is refused while the bootstrap keeps working, which is a phone with no
  // signal. Letting the append succeed would prove nothing — the double never
  // learns about `Museo`, so the concept would vanish from the list the moment
  // the queue emptied, and that state does not exist against a real sheet.
  await page.route('**/macros/s/**', async route => {
    const body = JSON.parse(route.request().postData() ?? '{}')
    if (body.action === 'append') return route.abort()
    return route.fulfill({ json: { ok: true, data: bootstrap() } })
  })
  await signIn(page)

  await typeAmount(page, '12')
  await next(page)
  await page.getByRole('textbox', { name: 'Concepto' }).fill('Museo')
  await next(page)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  // Still on this phone and nowhere else, which is the state being tested.
  // Filtered rather than bare: the amount readout is an <output>, which is a
  // status too, and `getByRole('status')` alone resolves to both.
  await expect(page.getByRole('status').filter({ hasText: /Guardando|Sin conexión/ }))
    .toBeVisible()

  await typeAmount(page, '8')
  await next(page)
  await page.getByRole('textbox', { name: 'Concepto' }).fill('mus')

  await expect(page.getByRole('button', { name: 'Museo', exact: true })).toBeVisible()
})

test('typing reaches a concept the grid never had room for', async ({ page }) => {
  // The other half, from the app's side: the vocabulary is filtered and only
  // then cut to eight tiles.
  await stubApi(page)
  await signIn(page)
  await typeAmount(page, '10')
  await next(page)

  await expect(page.getByRole('button', { name: 'lo del jueves' })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Concepto' }).fill('jueves')
  await expect(page.getByRole('button', { name: 'lo del jueves' })).toBeVisible()
})


/**
 * An upload that says it worked and did not.
 *
 * The expense that went missing: the deployment answered the append POST with
 * its own health check — `{ ok: true, data: { service, status } }`, which is
 * what Apps Script's redirect produces when it lands on `doGet` — the client
 * resolved, and the queue deleted the operation as delivered. The row was never
 * written to the sheet and was no longer on the phone either. Gone from both
 * sides, with nothing on screen to say so.
 */
test('an append the sheet never really did stays on the phone', async ({ page }) => {
  await page.route('**/macros/s/**', async route => {
    const body = JSON.parse(route.request().postData() ?? '{}')
    if (body.action === 'append') {
      return route.fulfill({ json: { ok: true, data: { service: 'a-medias', status: 'ok' } } })
    }
    return route.fulfill({ json: { ok: true, data: bootstrap() } })
  })
  await signIn(page)

  await typeAmount(page, '1250')
  await next(page)
  await page.getByRole('textbox', { name: 'Concepto' }).fill('Museo')
  await next(page)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()

  // Still queued. The first attempt says only Guardando…: it is a try, not a
  // retry, and a save that announced a retry as it was tapped would make every
  // ordinary save look like a repair.
  const strip = page.getByRole('status').filter({ hasText: /Guardando/ })
  await expect(strip).toBeVisible()
  await expect(strip).not.toContainText('reintento')

  // Nor does a second flush a moment later. Coming back to the foreground is one
  // of the two moments the app retries on, and on a phone the keyboard closing
  // does it a second after Guardar — which is still the first attempt as far as
  // anybody watching is concerned.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(strip).toBeVisible()
  await expect(strip).not.toContainText('reintento')

  // Past the window, it is a real second attempt and says so.
  await new Promise(resolve => setTimeout(resolve, 3_200))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(strip).toContainText('reintento 1')

  // And still in the list, because the list shows the queue as well as the
  // sheet. An expense somebody typed does not disappear because a server
  // answered nonsense — and its own row says it has not gone up yet, which the
  // strip above the tab bar cannot, since it does not know which row is which.
  await page.getByRole('button', { name: 'Gastos' }).click()
  const row = page.getByRole('button', { name: /Museo/ })
  await expect(row).toBeVisible()
  await expect(row).toContainText('sin subir')

  // The rows that did come from the sheet carry no such mark.
  await expect(page.getByRole('button', { name: /gasolina/ })).not.toContainText('sin subir')
})

test('a save that works says nothing about retries', async ({ page }) => {
  await stubApi(page)
  await signIn(page)

  await typeAmount(page, '900')
  await next(page)
  await page.getByRole('textbox', { name: 'Concepto' }).fill('pan')
  await next(page)
  await page.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  await expect(page.getByText(/reintento/)).toHaveCount(0)
})


test('the amount can be typed on a real keyboard', async ({ page }) => {
  // On a laptop, or on a phone with a keyboard paired to it, the grid of buttons
  // was the only way in: typing 12,50 did nothing whatsoever.
  await stubApi(page)
  await signIn(page)

  await page.keyboard.type('12.50')
  // The point is taken as the comma — same key on a numeric pad, and on an
  // external keyboard it is whichever the layout says.
  await expect(page.locator('output')).toContainText('12,50')

  await page.keyboard.press('Backspace')
  await expect(page.locator('output')).toContainText('12,5')

  // A third cent is refused here exactly as it is on the buttons.
  await page.keyboard.type('99')
  await expect(page.locator('output')).toContainText('12,59')

  await next(page)
  await expect(page.getByText('Paso 2 de 3')).toBeVisible()
})

test('a keystroke aimed at a field stays in the field', async ({ page }) => {
  // The listener is on the window, so the one thing it must never do is eat the
  // characters somebody is typing into the concept box.
  await stubApi(page)
  await signIn(page)
  await typeAmount(page, '10')
  await next(page)

  const concept = page.getByRole('textbox', { name: 'Concepto' })
  await concept.fill('')
  await concept.pressSequentially('caña 2,5')

  await expect(concept).toHaveValue('caña 2,5')
})


/**
 * The category: the bucket, as opposed to the concept, which is whatever was
 * typed. Guessed from the concept rather than asked for — a question on the fast
 * path gets answered with whatever is nearest the thumb — so what the screen has
 * to do is show the guess before it is saved rather than after.
 */
test('the category is guessed from the concept and sent with the expense', async ({ page }) => {
  const calls = await stubApi(page)
  await signIn(page)

  await typeAmount(page, '2350')
  await next(page)
  await page.getByRole('textbox', { name: 'Concepto' }).fill('Cena en un bar')

  const field = page.getByRole('button', { name: 'Elegir categoría' })
  await expect(field).toContainText('Restaurantes')

  await next(page)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()

  await expect
    .poll(() => calls.find(call => call.action === 'append')?.payload.category)
    .toBe('Restaurantes')
  // The concept stays what was typed. That separation is the whole point.
  expect(calls.find(call => call.action === 'append')?.payload.concept).toBe('Cena en un bar')
})

test('a concept nothing can place is left unfiled rather than guessed at', async ({ page }) => {
  // An empty category is a question still open. One chosen at random to close it
  // is worse than the question, because it gets totalled under a heading and
  // then believed.
  await stubApi(page)
  await signIn(page)
  await typeAmount(page, '10')
  await next(page)
  await page.getByRole('textbox', { name: 'Concepto' }).fill('lo del jueves')

  await expect(page.getByRole('button', { name: 'Elegir categoría' }))
    .toContainText('Sin categoría')
})

test('a category picked by hand survives, until the concept changes', async ({ page }) => {
  // The category is derived from the concept, so a new concept means a new
  // guess — and a hand-picked one sticks only until the thing it describes is
  // replaced.
  const calls = await stubApi(page)
  await signIn(page)
  await typeAmount(page, '10')
  await next(page)

  const concept = page.getByRole('textbox', { name: 'Concepto' })
  const field = page.getByRole('button', { name: 'Elegir categoría' })

  await concept.fill('Cena en un bar')
  await expect(field).toContainText('Restaurantes')

  await field.click()
  await page.getByRole('dialog', { name: 'Elegir categoría' })
    .getByRole('button', { name: 'Cafés y bares' }).click()
  await expect(field).toContainText('Cafés y bares')

  // Still there while the concept is what it was.
  await next(page)
  await page.getByRole('button', { name: 'Atrás' }).click()
  await expect(field).toContainText('Cafés y bares')

  // Replaced when the concept is.
  await concept.fill('gasolinera Repsol')
  await expect(field).toContainText('Combustible')

  await next(page)
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  // Polled: getting back to the first step means the draft is cleared, not that
  // the request has left — the queue flushes after that, and asserting on `calls`
  // straight away is a race this suite lost once.
  await expect
    .poll(() => calls.find(call => call.action === 'append')?.payload.category)
    .toBe('Combustible')
})
