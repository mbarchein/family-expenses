import { expect, test } from '@playwright/test'
import { LAST_YEAR, PREVIOUS_MONTH, TODAY, signIn, stubApi, stubGoogle, bootstrap } from './harness'

/**
 * The three totals over the list of expenses.
 *
 * Every date in the fixture is relative to the real clock — see `harness.ts` —
 * so these assertions mean the same thing in September as in August, which a
 * summary keyed to calendar months otherwise would not.
 */

const month = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { month: 'short' })
    .format(new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, 1))
    .replace(/\./g, '')

test.beforeEach(async ({ page }) => {
  await stubGoogle(page)
})

test('the strip totals last month, this month and this year', async ({ page }) => {
  await stubApi(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos' }).click()

  const cells = page.getByRole('group', { name: 'Resumen' }).locator('> div')
  // Three cells in the order the question is usually asked: what did last month
  // cost, what is this one costing, and where is the year.
  await expect(cells).toHaveCount(3)

  await expect(cells.nth(0)).toContainText(month(PREVIOUS_MONTH))
  await expect(cells.nth(0)).toContainText('100,00')

  await expect(cells.nth(1)).toContainText(month(TODAY))
  await expect(cells.nth(1)).toContainText('386,72')   // 326,72 + 60

  await expect(cells.nth(2)).toContainText('Año')
  // Last year's 1000 is excluded either way. Whether last month counts towards
  // this year depends on the day this runs: in January it does not.
  const sameYear = PREVIOUS_MONTH.slice(0, 4) === TODAY.slice(0, 4)
  await expect(cells.nth(2)).toContainText(sameYear ? '486,72' : '386,72')
  expect(LAST_YEAR.slice(0, 4)).not.toBe(TODAY.slice(0, 4))
})

test('filtering moves the totals with it, and the strip says it is filtered', async ({ page }) => {
  // The reason the strip is fed the filtered entries: the useful question is
  // rarely "what have we spent" but "what has this cost us", and the answer has
  // to change when the question does.
  await stubApi(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos' }).click()

  const cells = page.getByRole('group', { name: 'Resumen' }).locator('> div')
  await expect(page.getByText('Solo lo filtrado')).toHaveCount(0)

  await page.getByRole('button', { name: 'Viqui', exact: true }).click()
  await expect(cells.nth(1)).toContainText('326,72')
  await expect(cells.nth(0)).toContainText('0,00')       // last month was Mario's
  await expect(page.getByText('Solo lo filtrado')).toBeVisible()

  await page.getByRole('button', { name: 'Ambos' }).click()
  await page.getByRole('searchbox', { name: 'Buscar concepto…' }).fill('gaso')
  await expect(cells.nth(1)).toContainText('60,00')
  await expect(cells.nth(2)).toContainText('60,00')
  await expect(page.getByText('Solo lo filtrado')).toBeVisible()
})

test('a year the app cannot see all of says so', async ({ page }) => {
  // The app loads the last few hundred rows, not the whole sheet. On a busy
  // ledger the year total is a floor, and a floor wearing the look of a total is
  // a wrong number rather than a narrow one.
  const march = `${TODAY.slice(0, 4)}-03-03`
  await stubApi(page, bootstrap({
    entries: [
      { row: 2298, id: 'one', date: TODAY, concept: 'super', amount: 10, payer: 0, note: '', voided: false },
      { row: 2297, id: 'two', date: march, concept: 'luz', amount: 20, payer: 1, note: '', voided: false },
    ],
  }))
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos' }).click()

  await expect(page.getByText(/El año cuenta desde el/)).toBeVisible()
})
