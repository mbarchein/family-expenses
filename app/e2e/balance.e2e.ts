import { expect, test } from '@playwright/test'
import { MARIO, TODAY, VIQUI, bootstrap, entry, signIn, stubApi, stubGoogle } from './harness'

/**
 * The Diferencia screen, which is the one about money nobody had a browser test
 * for.
 *
 * It was reported as showing the percentages and the amounts the wrong way
 * round. They were not — the bar had no names on it, and a colour is a key
 * nobody printed — but the way to keep that answer true is to pin each pair
 * here: whose percentage, whose amount, and who puts in more when a transfer is
 * being split.
 */

/** Viqui 300, Mario 100, and a difference of 200 in Viqui's favour — which is
 *  what the sheet's own `SUMA(C) - SUMA(D)` says about those two rows. */
const LEDGER = bootstrap({
  balance: 200,
  entries: [
    entry({ row: 10, id: 'a', date: TODAY, concept: 'super', amount: 300, payer: VIQUI }),
    entry({ row: 11, id: 'b', date: TODAY, concept: 'luz', amount: 100, payer: MARIO }),
  ],
})

test.beforeEach(async ({ page }) => {
  await stubGoogle(page)
})

test('the bar pairs each name with its own share and its own amount',
  async ({ page }) => {
  await stubApi(page, LEDGER)
  await signIn(page)
  await page.getByRole('button', { name: 'Diferencia' }).click()

  // Who is ahead is who has put in more, which is what a positive `diferencia`
  // means: the column of person 1 minus the column of person 2.
  await expect(page.getByText('Viqui va por delante')).toBeVisible()

  // Three quarters of 400 is Viqui's, and it says so — the percentage and the
  // amount both, each next to her name rather than only in her colour.
  await expect(page.getByRole('group', { name: 'Viqui ha puesto 300,00 €' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Mario ha puesto 100,00 €' })).toBeVisible()
  await expect(page.getByLabel('Viqui, 75%')).toHaveText('75%')
  await expect(page.getByLabel('Mario, 25%')).toHaveText('25%')
})

test('the transfer proposal asks more of whoever has put in less', async ({ page }) => {
  // The other half of "the wrong way round", and the half that moves money: the
  // one who is behind puts in more, so that the difference lands on zero rather
  // than doubling. 400 with 200 owed to Viqui is 100 and 300.
  await stubApi(page, LEDGER)
  await signIn(page)
  await page.getByRole('button', { name: 'Diferencia' }).click()

  await page.getByRole('textbox', { name: 'Cuánto vais a meter al bote' }).fill('400')

  await expect(page.getByRole('group', { name: 'Viqui mete 100,00 €' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'Mario mete 300,00 €' })).toBeVisible()
  await expect(page.getByText('Quedaríais a la par')).toBeVisible()
})
