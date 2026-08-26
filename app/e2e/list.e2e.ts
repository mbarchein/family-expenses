import { expect, test } from '@playwright/test'
import {
  LAST_YEAR, MARIO, PREVIOUS_MONTH, TODAY, VIQUI, bootstrap, entry, longLedger, signIn, stubApi,
  stubGoogle,
} from './harness'

/**
 * The three totals over the list of expenses.
 *
 * Every date in the fixture is relative to the real clock — see `harness.ts` —
 * so these assertions mean the same thing in September as in August, which a
 * summary keyed to calendar months otherwise would not.
 */

/** With the year, as the strip now shows it: "ago 2026". Without it, January
 *  puts "dic" next to a total for a different year and says nothing about it. */
const month = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { month: 'short', year: 'numeric' })
    .format(new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, 1))
    .replace(/\./g, '')

test.beforeEach(async ({ page }) => {
  await stubGoogle(page)
})

test('the rows show the observación, after the payer and the day', async ({ page }) => {
  // It lands in the `observaciones` column and it is often the thing that
  // explains the row — "efectivo", "lo pago yo y me lo pasas". The list had no
  // sign of it at all, so the only way to see one was to open the entry.
  await stubApi(page, bootstrap({
    entries: [entry({
      row: 2300, id: 'e1', date: TODAY, concept: 'cena', amount: 40,
      payer: MARIO, note: 'lo pongo yo y me lo pasas',
    })],
  }))
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos' }).click()

  const row = page.getByRole('button', { name: /cena/ })
  await expect(row).toContainText('Mario')
  await expect(row).toContainText('lo pongo yo y me lo pasas')
})

test('a row wears the icon of what it was, in the colour of who paid', async ({ page }) => {
  // The row used to carry an eight-pixel dot in the payer's colour and nothing
  // about the expense. The icon is the same vocabulary the keypad offers, so a
  // list scrolled with a thumb is recognisable without reading it — and the
  // colour still says who paid, which is the job the dot was doing.
  await stubApi(page, bootstrap({
    entries: [
      entry({ row: 2300, id: 'e1', date: TODAY, concept: 'super', amount: 30, payer: VIQUI }),
      // No keyword matches this one, and `iconFor` answers nothing rather than
      // something approximate: the dot is what is left.
      entry({ row: 2299, id: 'e2', date: TODAY, concept: 'chuches', amount: 3, payer: MARIO }),
    ],
  }))
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos' }).click()

  const shopping = page.getByRole('button', { name: /super/ })
  await expect(shopping.locator('svg')).toHaveCount(1)
  // Viqui's colour, on the icon rather than beside it.
  await expect(shopping.locator('svg')).toHaveCSS('color', 'rgb(47, 98, 217)')

  await expect(page.getByRole('button', { name: /chuches/ }).locator('svg')).toHaveCount(0)
})

test('the concept filter has a cross inside it that empties it', async ({ page }) => {
  await stubApi(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos' }).click()

  const field = page.getByRole('searchbox', { name: 'Buscar concepto…' })
  const clear = page.getByRole('button', { name: 'Borrar la búsqueda' })

  // Nothing to clear, nothing shown: a cross on an empty field is a control
  // that does nothing, sitting where a thumb will find it.
  await expect(clear).toHaveCount(0)

  await field.fill('gasolina')
  await expect(page.getByRole('button', { name: /super/ })).toHaveCount(0)

  await clear.click()
  await expect(field).toHaveValue('')
  await expect(page.getByRole('button', { name: /super/ })).toBeVisible()
  await expect(clear).toHaveCount(0)
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

  // The year names itself, between two cells that now carry theirs.
  await expect(cells.nth(2)).toContainText(TODAY.slice(0, 4))
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

test('a year of expenses renders, and every day carries its own containment', async ({ page }) => {
  // The window reaches back to last January now, so this screen gets more than a
  // thousand rows. They are all in the DOM on purpose — find-in-page works, and
  // nothing has to guess a row height — and each day is a section the browser is
  // allowed to skip while it is off screen. Without that the list was the one
  // place in the app where a long ledger was felt.
  await stubApi(page, longLedger(400, 3))
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos' }).click()

  const sections = page.locator('main section')
  await expect(sections).toHaveCount(400)

  // The property, on every one of them, with a size to skip.
  const containment = await sections.evaluateAll(nodes => nodes.map(node => {
    const style = getComputedStyle(node)
    return `${style.contentVisibility}|${style.containIntrinsicSize.includes('px')}`
  }))
  expect(new Set(containment)).toEqual(new Set(['auto|true']))

  // And the screen is usable: the first day is on screen, the last is reachable.
  await expect(sections.first()).toBeInViewport()
  await sections.last().scrollIntoViewIfNeeded()
  await expect(sections.last()).toBeInViewport()
})

test('the list can be narrowed to one category, and to the rows that have none',
  async ({ page }) => {
  // The second question this screen is asked. The search box answers "what was
  // it called", which only works if you remember the word somebody typed; this
  // one answers "what kind of thing was it", which is what the column was added
  // for and what the totals by kind are read against.
  await stubApi(page, bootstrap({
    entries: [
      entry({
        row: 2300, id: 'e1', date: TODAY, concept: 'cena', amount: 40,
        payer: MARIO, category: 'Restaurantes',
      }),
      entry({
        row: 2299, id: 'e2', date: TODAY, concept: 'gasolina', amount: 60,
        payer: MARIO, category: 'Combustible',
      }),
      // Nothing filed it, which is the state 698 rows of the real ledger were in.
      entry({ row: 2298, id: 'e3', date: TODAY, concept: 'lo del jueves', amount: 5, payer: MARIO }),
    ],
  }))
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos', exact: true }).click()

  const filter = page.getByRole('button', { name: 'Filtrar por categoría' })
  const cells = page.getByRole('group', { name: 'Resumen' }).locator('> div')
  await expect(filter).toContainText('Todas las categorías')

  await filter.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Restaurantes' }).click()

  await expect(page.getByRole('button', { name: /cena/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /gasolina/ })).toHaveCount(0)
  // The totals follow the filter, like they do for the other two.
  await expect(cells.nth(1)).toContainText('40,00')
  await expect(page.getByText('Solo lo filtrado')).toBeVisible()

  // "Sin categoría" is a filter of its own, and it is the useful one: it is the
  // list of what still has to be filed.
  await filter.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Sin categoría' }).click()
  await expect(page.getByRole('button', { name: /lo del jueves/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /cena/ })).toHaveCount(0)

  // And the cross takes the filter off in one tap rather than three.
  await page.getByRole('button', { name: 'Quitar el filtro de categoría' }).click()
  await expect(page.getByRole('button', { name: /cena/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /gasolina/ })).toBeVisible()
  await expect(page.getByText('Solo lo filtrado')).toHaveCount(0)
})

test('a category with nothing in it says so in its own words', async ({ page }) => {
  await stubApi(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos', exact: true }).click()

  await page.getByRole('button', { name: 'Filtrar por categoría' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Luz' }).click()

  // Not "ningún gasto con ese concepto": nothing was typed into the search box,
  // and a message about a concept when the filter is a category is the app
  // answering a question nobody asked.
  await expect(page.getByText('Ningún gasto en esa categoría')).toBeVisible()
})
