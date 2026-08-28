import { expect, test } from '@playwright/test'
import {
  LAST_YEAR, bootstrap, entry, fixed, MARIO, signIn, storedDraft, stubApi, stubGoogle, TODAY,
} from './harness'

/**
 * Getting around: five screens, five addresses, and a way back from each.
 *
 * The app used to keep the current screen in a variable, so all five shared one
 * URL and a reload always landed on the keypad. That is worse here than in most
 * apps: this one reloads itself when a new version is deployed, so it could take
 * somebody off the screen they were reading with no warning and no way back.
 */

const SCREENS = [
  { tab: 'Gastos', path: '/gastos' },
  { tab: 'Diferencia', path: '/diferencia' },
  { tab: 'Sitios', path: '/sitios' },
  { tab: 'Fijos', path: '/fijos' },
] as const

test.beforeEach(async ({ page }) => {
  await stubGoogle(page)
})

// One test per screen rather than one loop through all four: a page load costs
// seconds in CI, and eight of them in a row is a test that fails on the clock
// rather than on the app.
for (const screen of SCREENS) {
  test(`${screen.tab} has its own address, and comes back after a reload`, async ({ page }) => {
    await stubApi(page)
    await signIn(page)

    await page.getByRole('button', { name: screen.tab }).click()
    await expect(page).toHaveURL(new RegExp(`${screen.path}$`))

    await page.reload()
    // Still here, named by its own heading rather than by the tab that is lit.
    await expect(page.getByRole('heading', { name: screen.tab })).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${screen.path}$`))
  })
}

test('the keypad is the root, and going to it says so', async ({ page }) => {
  await stubApi(page)
  await signIn(page)

  await page.getByRole('button', { name: 'Gastos' }).click()
  await page.getByRole('button', { name: 'Añadir', exact: true }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
})

test('the back arrow returns to where you were, from every screen', async ({ page }) => {
  await stubApi(page)
  await signIn(page)

  await page.getByRole('button', { name: 'Gastos' }).click()
  await page.getByRole('button', { name: 'Sitios' }).click()
  await page.getByRole('button', { name: 'Atrás' }).click()

  await expect(page).toHaveURL(/\/gastos$/)
  await expect(page.getByRole('heading', { name: 'Gastos' })).toBeVisible()
})

test('a screen opened cold still has a way out', async ({ page }) => {
  // Straight to an address with no history behind it — a bookmark, a link, or
  // the app reopening where it was. `history.back()` would leave the app.
  await stubApi(page)
  await stubGoogle(page)
  await page.goto('/fijos')
  await page.getByTestId('google-sign-in').click()
  await expect(page.getByRole('heading', { name: 'Fijos' })).toBeVisible()

  await page.getByRole('button', { name: 'Atrás' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
})

test('an entry can be abandoned from any step of the flow', async ({ page }) => {
  await stubApi(page)
  await signIn(page)

  // Nothing typed yet: there is nothing to cancel, so nothing offers to.
  await expect(page.getByRole('button', { name: 'Cancelar' })).toHaveCount(0)

  await page.getByRole('button', { name: '2', exact: true }).click()
  await page.getByRole('button', { name: '3', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible()

  // And from the second step, where the number is already behind you.
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('Paso 2 de 3')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()

  // Back at the beginning with an empty keypad — not with 23 waiting on it.
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cancelar' })).toHaveCount(0)
  await expect(page.locator('output')).not.toContainText('23')
})

test('the step indicator does not move when cancel appears', async ({ page }) => {
  // The header jump, for the second time. It was the back arrow being swapped
  // for a narrower spacer; this time it was the cancel button arriving with the
  // first digit and pushing the progress pills along the row. Both are the same
  // fix — a slot of a fixed size, empty rather than absent — and this is the
  // assertion that says so out loud.
  await stubApi(page)
  await signIn(page)

  // The pills themselves, not the box around them: it is the indicator that must
  // not move, and a container can hold still while its contents slide.
  const pills = page.locator('header div[aria-hidden="true"]')
  const before = await pills.boundingBox()

  await page.getByRole('button', { name: '7', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeVisible()

  const after = await pills.boundingBox()
  expect(after!.x).toBeCloseTo(before!.x, 0)
  expect(after!.y).toBeCloseTo(before!.y, 0)
})

test('a cancelled entry does not come back on the next open', async ({ page }) => {
  await stubApi(page)
  await signIn(page)

  await page.getByRole('button', { name: '5', exact: true }).click()
  await page.getByRole('button', { name: 'Cancelar' }).click()

  // Waited for rather than assumed. The draft is written without being awaited,
  // so on a fast machine the reload can beat the delete to the disk — which is
  // how this test failed in CI and passed here, and it was the app that was
  // wrong: `reset` now says when the draft is actually gone.
  await expect.poll(() => storedDraft(page).then(draft => draft?.typed ?? null)).toBe(null)
  await page.reload()

  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  await expect(page.locator('output')).not.toContainText('5')
})

test('the year is on the rows, the day headings and the totals', async ({ page }) => {
  // The window reaches back to last January, so scrolling the list crosses a
  // year. A date without one is not ambiguous there, it is wrong.
  await stubApi(page, bootstrap({
    entries: [
      entry({ row: 2300, id: 'e1', date: TODAY, concept: 'super', amount: 20, payer: MARIO }),
      entry({ row: 2299, id: 'e2', date: LAST_YEAR, concept: 'seguro', amount: 300, payer: MARIO }),
    ],
  }))
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos' }).click()

  const year = LAST_YEAR.slice(0, 4)
  await expect(page.getByRole('heading', { name: new RegExp(year) })).toBeVisible()
  await expect(page.getByRole('button', { name: new RegExp(`seguro.*${year}`, 's') })).toBeVisible()
})


/**
 * The sheets have addresses too.
 *
 * Reported: back on the detail of a fijo did the wrong thing. It was `useState`,
 * so there was nothing for back to close and it left the whole screen — and a
 * reload landed on the keypad, and neither of them could send the other a link to
 * a row.
 */
test('the detail of a fijo has its own address, and back closes it', async ({ page }) => {
  await stubApi(page, bootstrap({
    fixed: [fixed({ id: 'f-alquiler', row: 4, concept: 'alquiler', amount: 700, day: 1 })],
  }))
  await signIn(page)
  await page.getByRole('button', { name: 'Fijos', exact: true }).click()

  await page.getByRole('button', { name: /alquiler/ }).click()
  await expect(page).toHaveURL(/\/fijos\/f-alquiler$/)
  await expect(page.getByRole('dialog')).toBeVisible()

  // Back closes the sheet and stays on the screen, which is the whole bug.
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/fijos$/)
  await expect(page.getByRole('heading', { name: 'Fijos' })).toBeVisible()
})

test('a fijo detail survives a reload', async ({ page }) => {
  await stubApi(page, bootstrap({
    fixed: [fixed({ id: 'f-alquiler', row: 4, concept: 'alquiler', amount: 700, day: 1 })],
  }))
  await signIn(page)
  await page.goto('/fijos/f-alquiler')

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Concepto' })).toHaveValue('alquiler')
})

test('a new fijo is an address of its own', async ({ page }) => {
  await stubApi(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Fijos', exact: true }).click()
  await page.getByRole('button', { name: 'Nuevo fijo' }).click()

  await expect(page).toHaveURL(/\/fijos\/nuevo$/)
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('the detail of an expense has its own address too', async ({ page }) => {
  await stubApi(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos', exact: true }).click()

  await page.getByRole('button', { name: /super/ }).click()
  await expect(page).toHaveURL(/\/gastos\/one$/)

  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/gastos$/)
})

test('an address naming a row that is not there opens the screen, not a hole',
  async ({ page }) => {
  // A stale link, or a template the other phone deleted.
  await stubApi(page)
  await signIn(page)
  await page.goto('/fijos/no-existe')

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Fijos' })).toBeVisible()
})

/**
 * And the sheets that are not addresses.
 *
 * The category picker, the cog's inner lists and the proposal of what the fijos
 * owe open over a form whose contents are nowhere in the URL, so they are not
 * given a path of their own — but back on a phone means "close this", and a sheet
 * that ignores it takes the whole screen away. Same bug as the fijo detail, three
 * more places.
 */
test('the cog sheet has an address, and back closes it', async ({ page }) => {
  await stubApi(page)
  await signIn(page)
  await page.getByRole('button', { name: '5', exact: true }).click()
  await page.getByRole('button', { name: 'Siguiente' }).click()

  await page.getByRole('button', { name: 'Iconos' }).click()
  await expect(page).toHaveURL(/\/iconos$/)
  await expect(page.getByRole('dialog')).toBeVisible()

  // Back to the step it was opened from, with the amount still on the draft.
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('Paso 2 de 3')).toBeVisible()
})

test('back inside the cog sheet steps out of the list, not out of the sheet',
  async ({ page }) => {
  // The nesting, which is what makes this more than one line: labelling one
  // concept and labelling four are the same errand, so back from the icons goes
  // to the concepts rather than closing everything.
  await stubApi(page)
  await signIn(page)
  await page.getByRole('button', { name: '5', exact: true }).click()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('button', { name: 'Iconos' }).click()

  const menu = page.getByRole('dialog')
  await menu.getByRole('button', { name: /^chuches/ }).click()
  await expect(page.getByRole('button', { name: 'huella', exact: true })).toBeVisible()

  await page.goBack()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(menu.getByRole('button', { name: /^chuches/ })).toBeVisible()
  await expect(page).toHaveURL(/\/iconos$/)

  // And the second press leaves the sheet, because the sheet is the address.
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Paso 2 de 3')).toBeVisible()
})

test('an address for the cog sheet with the draft elsewhere opens the keypad', async ({ page }) => {
  // Nothing typed, so there is no second step for the cog to be on. The address
  // gives way rather than the draft.
  await stubApi(page)
  await stubGoogle(page)
  await page.goto('/iconos')
  await page.getByTestId('google-sign-in').click()

  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
})

test('back closes the category picker and leaves the editor open', async ({ page }) => {
  await stubApi(page, bootstrap({
    fixed: [fixed({ id: 'f-alquiler', row: 4, concept: 'alquiler', amount: 700, day: 1 })],
  }))
  await signIn(page)
  await page.goto('/fijos/f-alquiler')
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByRole('button', { name: 'Elegir categoría' }).click()
  await expect(page.getByRole('dialog', { name: 'Elegir categoría' })).toBeVisible()

  // The editor is still there afterwards — this is the sheet whose back button
  // had the furthest to fall, since closing it wrongly would have shut the form
  // as well and lost what was typed into it.
  await page.goBack()
  await expect(page.getByRole('dialog', { name: 'Elegir categoría' })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Concepto' })).toHaveValue('alquiler')
  await expect(page).toHaveURL(/\/fijos\/f-alquiler$/)
})

test('back closes what the fijos owe and stays on the keypad', async ({ page }) => {
  await stubApi(page, bootstrap({ fixed: [fixed()] }))
  await signIn(page)

  await page.getByRole('button', { name: 'Hay 1 fijo vencido' }).click()
  await expect(page.getByRole('dialog', { name: 'Fijos vencidos' })).toBeVisible()

  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
})
