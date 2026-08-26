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
    .toMatchObject({ row: 2, due: firstOfThisMonth() })
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
  await expect(page.getByRole('textbox', { name: 'Concepto' })).toHaveValue('luz')
})

test('skipping records the period without writing an expense', async ({ page }) => {
  const calls = await stubApi(page, bootstrap({ fixed: [fixed()] }))
  await signIn(page)

  await page.getByRole('button', { name: 'Hay 1 fijo vencido' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Saltar' }).click()

  await expect.poll(() => calls.find(call => call.action === 'fixedDone')?.payload)
    .toMatchObject({ row: 2, due: firstOfThisMonth() })
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

test('a template can be created from the phone', async ({ page }) => {
  // The tab exists because of this: an editor needs a door that is there when
  // the list is empty, and the proposals appear only when something is owed.
  const calls = await stubApi(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Fijos' }).click()

  await expect(page.getByText('Todavía no hay ningún fijo')).toBeVisible()
  await page.getByRole('button', { name: 'Nuevo fijo' }).click()

  await page.getByRole('textbox', { name: 'Concepto' }).fill('comunidad')
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

  await page.getByRole('textbox', { name: 'Concepto' }).fill('luz')
  await expect(page.getByRole('textbox', { name: 'Importe fijo' }))
    .toHaveAttribute('placeholder', 'Preguntar cada vez')
  await page.getByRole('button', { name: 'Guardar fijo' }).click()

  await expect.poll(() => calls.find(call => call.action === 'saveFixed')?.payload)
    .toMatchObject({ concept: 'luz', amount: null })
})

test('an existing template opens with its values and can be switched off', async ({ page }) => {
  const calls = await stubApi(page, bootstrap({ fixed: [fixed({ row: 4, concept: 'gimnasio', amount: 39 })] }))
  await signIn(page)
  await page.getByRole('button', { name: 'Fijos' }).click()

  await page.getByRole('button', { name: /gimnasio/ }).click()
  await expect(page.getByRole('textbox', { name: 'Importe fijo' })).toHaveValue('39')

  await page.getByRole('button', { name: 'Desactivado' }).click()
  await page.getByRole('button', { name: 'Guardar fijo' }).click()

  // The same row, so it is edited rather than duplicated.
  await expect.poll(() => calls.find(call => call.action === 'saveFixed')?.payload)
    .toMatchObject({ row: 4, concept: 'gimnasio', active: false })
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

  await page.getByRole('textbox', { name: 'Concepto' }).fill('gimnasio')
  await page.getByRole('textbox', { name: 'Importe fijo' }).fill('40')
  await page.getByRole('button', { name: 'Guardar fijo' }).click()

  // The strip says it is going up, exactly as it does for an expense.
  await expect(page.getByRole('status').filter({ hasText: /Guardando/ })).toBeVisible()

  // And the template is on the screen rather than nowhere: the queue has it, so
  // saying otherwise would be the same lie the expenses list used to tell.
  await expect(page.getByText('gimnasio')).toBeVisible()
})
