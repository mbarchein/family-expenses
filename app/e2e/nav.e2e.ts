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
  await page.getByRole('button', { name: 'Añadir' }).click()

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
    fixed: [fixed({ row: 4, concept: 'alquiler', amount: 700, day: 1 })],
  }))
  await signIn(page)
  await page.getByRole('button', { name: 'Fijos', exact: true }).click()

  await page.getByRole('button', { name: /alquiler/ }).click()
  await expect(page).toHaveURL(/\/fijos\/4$/)
  await expect(page.getByRole('dialog')).toBeVisible()

  // Back closes the sheet and stays on the screen, which is the whole bug.
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/fijos$/)
  await expect(page.getByRole('heading', { name: 'Fijos' })).toBeVisible()
})

test('a fijo detail survives a reload', async ({ page }) => {
  await stubApi(page, bootstrap({
    fixed: [fixed({ row: 4, concept: 'alquiler', amount: 700, day: 1 })],
  }))
  await signIn(page)
  await page.goto('/fijos/4')

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
  await page.goto('/fijos/99')

  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Fijos' })).toBeVisible()
})
