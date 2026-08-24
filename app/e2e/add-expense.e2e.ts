import { expect, test } from '@playwright/test'
import { bootstrap, signIn, stubApi, stubGoogle } from './harness'

test.beforeEach(async ({ page }) => {
  await stubGoogle(page)
})

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

  await expect(page.getByRole('button', { name: 'Guardar' })).toBeVisible()
  await expect(page.getByTestId('google-sign-in')).toHaveCount(0)
})

test('the entry screen fits on the screen', async ({ page }) => {
  // Not a nicety. The first version of this screen was a column of nine blocks
  // of equal weight, which put the keypad and the save button — the two most
  // used controls in the app — below the fold on a phone.
  await stubApi(page)
  await signIn(page)

  const overflows = await page.evaluate(
    () => document.scrollingElement!.scrollHeight > window.innerHeight + 1,
  )
  expect(overflows).toBe(false)
  await expect(page.getByRole('button', { name: 'Guardar' })).toBeInViewport()
})

test('a chip sets the concept and leaves the payer alone', async ({ page }) => {
  // It used to set the payer as well, to whoever pays that concept most often,
  // so tapping a chip changed who was paying — silently, and over a choice the
  // user may have just made. Who pays is the whole point of this ledger.
  await stubApi(page)
  await signIn(page)

  const chosenPayer = () => page.getByRole('button', { pressed: true, name: /^Paga / }).innerText()
  await expect.poll(chosenPayer).toBe('Paga Mario')

  await page.getByRole('button', { name: 'super', exact: true }).click()

  await expect.poll(chosenPayer).toBe('Paga Mario')
})

test('the payment methods follow whoever is paying', async ({ page }) => {
  await stubApi(page)
  await signIn(page)

  const mine = page.getByRole('button', { name: 'Tarjeta BBVA' })
  const hers = page.getByRole('button', { name: 'Tarjeta Viqui' })
  const shared = page.getByRole('button', { name: 'Efectivo' })

  await expect(mine).toBeVisible()
  await expect(hers).toHaveCount(0)

  await page.getByRole('button', { name: 'Paga Viqui' }).click()

  await expect(mine).toHaveCount(0)
  await expect(hers).toBeVisible()
  // The common ones belong to nobody, so they never move.
  await expect(shared).toBeVisible()
})

test('saving sends the amount, the payer and the payment method', async ({ page }) => {
  const calls = await stubApi(page)
  await signIn(page)

  for (const key of ['2', '3', ',', '5']) {
    await page.getByRole('button', { name: key, exact: true }).click()
  }
  await page.getByRole('button', { name: 'super', exact: true }).click()
  await page.getByRole('button', { name: 'Tarjeta BBVA' }).click()
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
})

test('an account that is neither of the two can look but not write', async ({ page }) => {
  await stubApi(page, bootstrap({ config: { people: bootstrap().config.people, meIndex: -1 } }))
  await signIn(page)

  await expect(page.getByRole('button', { name: 'Guardar' })).toBeDisabled()
})
