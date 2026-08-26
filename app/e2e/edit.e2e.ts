import { expect, test } from '@playwright/test'
import { bootstrap, entry, MARIO, signIn, stubApi, stubGoogle, TODAY } from './harness'

/**
 * Editing an entry that is already in the sheet.
 *
 * This screen had no test at all, and it is the one that can void a row — the
 * nearest thing this app has to deleting something, on a ledger where deleting
 * is the one operation that would corrupt every balance below it.
 */

const LEDGER = bootstrap({
  entries: [entry({ row: 2300, id: 'e1', date: TODAY, concept: 'super', amount: 23.5, payer: MARIO })],
})

test.beforeEach(async ({ page }) => {
  await stubGoogle(page)
})

test('anular is a button, in the corner, away from the way out', async ({ page }) => {
  const calls = await stubApi(page, LEDGER)
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos' }).click()
  await page.getByRole('button', { name: /super/ }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // All three are buttons now — none of them a bare line of text that happens
  // to be tappable.
  const anular = dialog.getByRole('button', { name: 'Anular' })
  const cancelar = dialog.getByRole('button', { name: 'Cancelar' })
  const guardar = dialog.getByRole('button', { name: 'Guardar cambios' })
  for (const button of [anular, cancelar, guardar]) await expect(button).toBeVisible()

  // Anular sits above everything else, to the right; cancel and save share a row
  // at the bottom, in that order.
  const [top, cancel, save] = await Promise.all(
    [anular, cancelar, guardar].map(b => b.boundingBox()))
  expect(top!.y).toBeLessThan(cancel!.y)
  expect(top!.x).toBeGreaterThan(cancel!.x)
  expect(Math.abs(cancel!.y - save!.y)).toBeLessThan(2)
  expect(cancel!.x).toBeLessThan(save!.x)
  // Saving is the wider of the two: both are ways out, only one is the one
  // being looked for.
  expect(save!.width).toBeGreaterThan(cancel!.width)

  // And cancel is a way out that changes nothing.
  await cancelar.click()
  await expect(dialog).toBeHidden()
  expect(JSON.stringify(calls)).not.toContain('update')
})

test('the fields come in the order the keypad asks for them', async ({ page }) => {
  // Editing and apuntando are the same six questions, and they were in two
  // different orders: the sheet put the amount first and the day fifth. It now
  // follows the flow — day, amount, who, concept, observación — and pairs what
  // fits on one line of a phone.
  await stubApi(page, LEDGER)
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos' }).click()
  await page.getByRole('button', { name: /super/ }).click()

  const dialog = page.getByRole('dialog')
  const boxes = await Promise.all([
    dialog.locator('input[type="date"]').boundingBox(),
    dialog.getByRole('textbox', { name: 'Importe' }).boundingBox(),
    dialog.getByRole('button', { name: 'Paga Viqui' }).boundingBox(),
    dialog.getByRole('textbox', { name: 'Concepto' }).boundingBox(),
    dialog.getByRole('textbox', { name: 'Observaciones' }).boundingBox(),
  ])
  // Middles, not tops: the amount sits inside a bordered box with the € beside
  // it, so its own top is a few pixels below the date field's while the two are
  // plainly on one line.
  const rows = boxes.map(box => box!.y + box!.height / 2)

  // The day and the amount share a line; everything after it comes below.
  expect(Math.abs(rows[0] - rows[1])).toBeLessThan(4)
  expect(rows[2]).toBeGreaterThan(rows[1])
  expect(rows[3]).toBeGreaterThan(rows[2])
  expect(rows[4]).toBeGreaterThan(rows[3])

  // And the amount reads as money rather than as a number: 23.5 is 23,50.
  await expect(dialog.getByRole('textbox', { name: 'Importe' })).toHaveValue('23,50')
})

test('saving an edit sends it, and voiding asks first', async ({ page }) => {
  const calls = await stubApi(page, LEDGER)
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos' }).click()
  await page.getByRole('button', { name: /super/ }).click()

  await page.getByRole('textbox', { name: 'Concepto' }).fill('super mercadona')
  await page.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  // Polled, not asserted once: an edit goes into the outbound queue and is sent
  // by the flush that follows, which is deliberately not awaited — the screen
  // must not wait for the network to close.
  await expect.poll(() => calls.some(call =>
    call.action === 'update' && call.payload.concept === 'super mercadona')).toBe(true)

  // Voiding is behind a confirmation, because the row stays in the sheet with
  // its amounts cleared and there is no way back from here.
  //
  // Matched on `super` rather than the edited name: the stubbed backend answers
  // the same bootstrap every time, so the queued edit shows until the refresh
  // that follows replaces it with the server's copy. Both spellings are the same
  // row, and which one is on screen depends on a race this test is not about.
  await page.getByRole('button', { name: /super/ }).click()
  page.once('dialog', confirm => void confirm.dismiss())
  await page.getByRole('button', { name: 'Anular' }).click()
  // Refused, so the screen is still open and nothing has been sent.
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(calls.some(call => call.action === 'voidEntry')).toBe(false)

  page.once('dialog', confirm => void confirm.accept())
  await page.getByRole('button', { name: 'Anular' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect.poll(() => calls.some(call => call.action === 'voidEntry')).toBe(true)
})


test('the amount takes the width and the caret lands at its end', async ({ page }) => {
  // Correcting an amount means deleting the one already there, and a tap used to
  // put the caret wherever the finger landed — so the way to fix 43,50 was tap,
  // drag the caret to the end, then start pressing backspace.
  await stubApi(page)
  await signIn(page)
  await page.getByRole('button', { name: 'Gastos' }).click()
  await page.getByRole('button', { name: /super/ }).click()

  const amount = page.getByRole('textbox', { name: 'Importe' })
  const date = page.getByLabel('Fecha')

  // The number that must not be wrong gets more room than dd/mm/yyyy does.
  const widths = await Promise.all([amount, date].map(field =>
    field.evaluate(node => node.getBoundingClientRect().width)))
  expect(widths[0]).toBeGreaterThan(widths[1])

  await amount.click()
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  // 326,72 with its last two characters gone, which is what a caret at the end
  // means and what tapping in the middle would not have given.
  await expect(amount).toHaveValue('326,')
})
