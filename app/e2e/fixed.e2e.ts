import { expect, test } from '@playwright/test'
import { TODAY, bootstrap, firstOfThisMonth, fixed, signIn, stubApi, stubGoogle } from './harness'

/**
 * Recurring expenses: they propose, they do not post.
 *
 * The rule this feature was designed around, before any of it was written. Some
 * rows in this ledger are pasted from a bank statement, so an app that posted
 * these by itself would write the rent twice — and a row can only be voided,
 * never removed.
 */

test.beforeEach(async ({ page }) => {
  await stubGoogle(page)
})

test('nothing is proposed when there are no templates', async ({ page }) => {
  await stubApi(page)
  await signIn(page)
  await expect(page.getByRole('button', { name: /fijo/ })).toHaveCount(0)
})

test('a due template is proposed, and confirming goes through the review', async ({ page }) => {
  const calls = await stubApi(page, bootstrap({ fixed: [fixed()] }))
  await signIn(page)

  await page.getByRole('button', { name: 'Hay 1 fijo vencido' }).click()
  const sheet = page.getByRole('dialog', { name: 'Fijos vencidos' })
  await expect(sheet).toContainText('alquiler')
  await expect(sheet).toContainText('700,00')

  // Confirming lands on the review step with everything filled in — the same
  // screen a hand-typed expense passes through, and nothing written yet.
  await sheet.getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('Paso 3 de 3')).toBeVisible()
  await expect(page.getByText('700,00 €')).toBeVisible()
  await expect(page.getByText('Viqui', { exact: true })).toBeVisible()
  expect(calls.filter(call => call.action === 'append')).toHaveLength(0)

  await page.getByRole('button', { name: 'Guardar' }).click()

  // The expense, dated the day it fell due rather than today.
  await expect.poll(() => calls.find(call => call.action === 'append')?.payload)
    .toMatchObject({ concept: 'alquiler', amount: 700, payer: 0, date: firstOfThisMonth() })

  // And the period recorded as dealt with, so tomorrow proposes nothing.
  await expect.poll(() => calls.find(call => call.action === 'fixedDone')?.payload)
    .toMatchObject({ id: 'f-alquiler', due: firstOfThisMonth() })
})

test('confirming a proposal leaves one history entry per step and nothing over',
  async ({ page }) => {
  // The sheet has a history entry of its own, so that back closes it. Confirming
  // moves forward from inside it, and the entry has to be reused rather than
  // buried: buried, back from the review walked the three steps and then found a
  // fourth entry that also meant "the keypad", so the press did nothing at all.
  await stubApi(page, bootstrap({ fixed: [fixed()] }))
  await signIn(page)

  const depth = () => page.evaluate(() => history.length)
  const before = await depth()

  await page.getByRole('button', { name: 'Hay 1 fijo vencido' }).click()
  await page.getByRole('dialog', { name: 'Fijos vencidos' })
    .getByRole('button', { name: 'Siguiente' }).click()
  await expect(page.getByText('Paso 3 de 3')).toBeVisible()

  // Two: the second step and the third. The sheet's own is one of them now.
  expect(await depth() - before).toBe(2)

  await page.goBack()
  await expect(page.getByText('Paso 2 de 3')).toBeVisible()
  await page.goBack()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
})

test('a fijo does not lend its date to the next expense', async ({ page }) => {
  // The date on a proposal is the day it fell due, which is often weeks back and
  // is nobody's choice. The next expense inherits what somebody picked, and this
  // is the one date that must not be carried: the app would be dating today's
  // shopping to the first of the month, quietly.
  const calls = await stubApi(page, bootstrap({ fixed: [fixed()] }))
  await signIn(page)

  await page.getByRole('button', { name: 'Hay 1 fijo vencido' }).click()
  await page.getByRole('dialog', { name: 'Fijos vencidos' })
    .getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()

  // Back on today, not on the first of the month.
  await expect(page.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: '5', exact: true }).click()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('textbox', { name: 'Concepto' }).fill('pan')
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()

  await expect.poll(() => calls.filter(call => call.action === 'append').length).toBe(2)
  const [rent, bread] = calls.filter(call => call.action === 'append').map(call => call.payload)
  expect(rent.date).toBe(firstOfThisMonth())
  expect(bread.date).toBe(TODAY)
})

test('a template with no amount lands on the keypad instead', async ({ page }) => {
  // The light, the water: the concept and the day are known and the number is
  // not, so the flow starts where the number gets typed.
  await stubApi(page, bootstrap({ fixed: [fixed({ concept: 'luz', amount: null, day: 1 })] }))
  await signIn(page)

  await page.getByRole('button', { name: 'Hay 1 fijo vencido' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Siguiente' }).click()

  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  await expect(page.locator('output')).toContainText('0')
  // Straight on to the second step, with the concept already there.
  await page.getByRole('button', { name: '4', exact: true }).click()
  await page.getByRole('button', { name: 'Siguiente' }).click()
  // The add flow's own concept box, which has no list and so is still a
  // textbox — unlike the one in the fijo editor.
  await expect(page.getByRole('textbox', { name: 'Concepto' })).toHaveValue('luz')
})

test('skipping records the period without writing an expense', async ({ page }) => {
  const calls = await stubApi(page, bootstrap({ fixed: [fixed()] }))
  await signIn(page)

  await page.getByRole('button', { name: 'Hay 1 fijo vencido' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Saltar' }).click()

  await expect.poll(() => calls.find(call => call.action === 'fixedDone')?.payload)
    .toMatchObject({ id: 'f-alquiler', due: firstOfThisMonth() })
  expect(calls.filter(call => call.action === 'append')).toHaveLength(0)
})

test('a period already in the ledger is proposed with a warning', async ({ page }) => {
  // The bank-statement case, which is the reason this is a proposal at all.
  await stubApi(page, bootstrap({
    fixed: [fixed()],
    entries: [{
      row: 2298, id: 'one', date: TODAY, concept: 'RECIBO ALQUILER',
      amount: 700, payer: 0, note: '', voided: false,
    }],
  }))
  await signIn(page)

  await page.getByRole('button', { name: 'Hay 1 fijo vencido' }).click()
  await expect(page.getByText('Puede que ya esté apuntado este mes')).toBeVisible()
})

test('two missed months are two proposals, oldest first', async ({ page }) => {
  const twoMonthsBack = `${new Date(
    Number(TODAY.slice(0, 4)),
    Number(TODAY.slice(5, 7)) - 3,
    1,
  ).getFullYear()}-${String(new Date(
    Number(TODAY.slice(0, 4)),
    Number(TODAY.slice(5, 7)) - 3,
    1,
  ).getMonth() + 1).padStart(2, '0')}-01`

  await stubApi(page, bootstrap({ fixed: [fixed({ last: twoMonthsBack })] }))
  await signIn(page)

  await page.getByRole('button', { name: 'Hay 2 fijos vencidos' }).click()
  const items = page.getByRole('dialog').getByRole('listitem')
  await expect(items).toHaveCount(2)
  // The ledger wants both rows, each with its own date.
  await expect(items.first()).not.toContainText(firstOfThisMonth().slice(-2))
})

// The concept box on this screen is a `combobox` and not a `textbox`: it carries
// a `datalist` of the concepts the ledger already knows, and an input with a list
// is a combobox in the accessibility tree. The one on the add flow has no list and
// is still a textbox.
test('a template can be created from the phone', async ({ page }) => {
  // The tab exists because of this: an editor needs a door that is there when
  // the list is empty, and the proposals appear only when something is owed.
  const calls = await stubApi(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Fijos' }).click()

  await expect(page.getByText('Todavía no hay ningún fijo')).toBeVisible()
  await page.getByRole('button', { name: 'Nuevo fijo' }).click()

  await page.getByRole('combobox', { name: 'Concepto' }).fill('comunidad')
  await page.getByRole('textbox', { name: 'Importe fijo' }).fill('62,50')
  await page.getByRole('textbox', { name: 'Día del mes' }).fill('5')
  await page.getByRole('combobox', { name: 'Cada cuánto' }).selectOption('3')
  await page.getByRole('button', { name: 'Viqui', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar fijo' }).click()

  await expect.poll(() => calls.find(call => call.action === 'saveFixed')?.payload)
    .toMatchObject({ concept: 'comunidad', amount: 62.5, day: 5, months: 3, payer: 0, active: true })

  // A cadence longer than a month gets its anchor written down there and then,
  // which is what keeps it in phase instead of drifting to whenever the first
  // confirmation happened to land.
  const sent = calls.find(call => call.action === 'saveFixed')!.payload as { from: string }
  expect(sent.from).toMatch(/^\d{4}-\d{2}-05$/)
})

test('an amount left empty means "ask me every time"', async ({ page }) => {
  const calls = await stubApi(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Fijos' }).click()
  await page.getByRole('button', { name: 'Nuevo fijo' }).click()

  await page.getByRole('combobox', { name: 'Concepto' }).fill('luz')
  await expect(page.getByRole('textbox', { name: 'Importe fijo' }))
    .toHaveAttribute('placeholder', 'Preguntar cada vez')
  await page.getByRole('button', { name: 'Guardar fijo' }).click()

  await expect.poll(() => calls.find(call => call.action === 'saveFixed')?.payload)
    .toMatchObject({ concept: 'luz', amount: null })
})

test('an existing template opens with its values and can be switched off', async ({ page }) => {
  const calls = await stubApi(page, bootstrap({ fixed: [fixed({ id: 'f-gimnasio', row: 4, concept: 'gimnasio', amount: 39 })] }))
  await signIn(page)
  await page.getByRole('button', { name: 'Fijos' }).click()

  await page.getByRole('button', { name: /gimnasio/ }).click()
  await expect(page.getByRole('textbox', { name: 'Importe fijo' })).toHaveValue('39')

  await page.getByRole('button', { name: 'Desactivado' }).click()
  await page.getByRole('button', { name: 'Guardar fijo' }).click()

  // The same row, so it is edited rather than duplicated.
  await expect.poll(() => calls.find(call => call.action === 'saveFixed')?.payload)
    .toMatchObject({ id: 'f-gimnasio', concept: 'gimnasio', active: false })
})


test('a template can be saved with no signal, and says it is on its way',
  async ({ page }) => {
  // It went straight to the network before, so with no signal the button failed
  // and everything typed was gone — a concept, an amount, a day, a cadence and a
  // payer, which is more typing than an expense.
  await page.route('**/macros/s/**', async route => {
    const body = JSON.parse(route.request().postData() ?? '{}')
    if (body.action === 'saveFixed') return route.abort()
    return route.fulfill({ json: { ok: true, data: bootstrap() } })
  })
  await signIn(page)
  await page.getByRole('button', { name: 'Fijos' }).click()
  await page.getByRole('button', { name: 'Nuevo fijo' }).click()

  await page.getByRole('combobox', { name: 'Concepto' }).fill('gimnasio')
  await page.getByRole('textbox', { name: 'Importe fijo' }).fill('40')
  await page.getByRole('button', { name: 'Guardar fijo' }).click()

  // The strip says it is going up, exactly as it does for an expense.
  await expect(page.getByRole('status').filter({ hasText: /Guardando/ })).toBeVisible()

  // And the template is on the screen rather than nowhere: the queue has it, so
  // saying otherwise would be the same lie the expenses list used to tell.
  await expect(page.getByText('gimnasio')).toBeVisible()
})


test('a template carries a category, and hands it to the expense it proposes',
  async ({ page }) => {
  // The payoff of the column: a bill that arrives every month is filed the same
  // way every month without anybody choosing again.
  const calls = await stubApi(page, bootstrap({
    fixed: [fixed({ concept: 'alquiler', amount: 700, day: 1, category: 'Hogar' })],
  }))
  await signIn(page)

  await page.getByRole('button', { name: /fijo vencido/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Siguiente' }).click()
  await page.getByRole('button', { name: 'Guardar' }).click()

  await expect.poll(() => calls.find(call => call.action === 'append')?.payload)
    .toMatchObject({ concept: 'alquiler', amount: 700, category: 'Hogar' })
})

test('the editor takes a category and offers the concepts the ledger knows',
  async ({ page }) => {
  const calls = await stubApi(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Fijos' }).click()
  await page.getByRole('button', { name: 'Nuevo fijo' }).click()

  // The concept box has a list rather than a grid of tiles: this screen is opened
  // once per bill, and what it needs is the spelling the ledger already has.
  const options = await page.locator('datalist option').evaluateAll(
    nodes => nodes.map(node => (node as HTMLOptionElement).value))
  expect(options).toContain('gasolina')

  await page.getByRole('combobox', { name: 'Concepto' }).fill('gasolina')
  await page.getByRole('button', { name: 'Elegir categoría' }).click()
  await page.getByRole('dialog', { name: 'Elegir categoría' })
    .getByRole('button', { name: 'Combustible' }).click()
  await page.getByRole('button', { name: 'Guardar fijo' }).click()

  await expect.poll(() => calls.find(call => call.action === 'saveFixed')?.payload)
    .toMatchObject({ concept: 'gasolina', category: 'Combustible' })
})

test('a template wears the icon of its category in the list', async ({ page }) => {
  await stubApi(page, bootstrap({
    fixed: [
      fixed({ id: 'f-alquiler', row: 2, concept: 'alquiler', day: 1, category: 'Luz' }),
      // No category and a concept nothing can guess from: no icon at all, which
      // is deliberate — a guess that misses is a small lie on every row.
      fixed({ row: 3, concept: 'lo del jueves', day: 2, category: '' }),
    ],
  }))
  await signIn(page)
  // Exact, because two due templates put a "Hay 2 fijos vencidos" banner on the
  // screen and that matches a loose `Fijos` too.
  await page.getByRole('button', { name: 'Fijos', exact: true }).click()

  await expect(page.getByRole('button', { name: /alquiler/ }).locator('svg')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /lo del jueves/ }).locator('svg')).toHaveCount(0)
})
