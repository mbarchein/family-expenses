import { expect, test } from '@playwright/test'

/**
 * The two pages Google's consent screen links to.
 *
 * Read without an account, on purpose and by whoever reviews them, which is why
 * they hang off main.tsx instead of App: a privacy policy behind a sign-in wall
 * is not a published privacy policy. Nothing here is stubbed — if these needed
 * a token or a ledger to render, that would be the bug.
 */
test.describe('the legal pages', () => {
  test('the privacy policy renders for a visitor with no account', async ({ page }) => {
    await page.goto('/privacy')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de privacidad')
    // The sentence the whole document exists to say.
    await expect(page.getByText('no tiene base de datos ni servidor propio')).toBeVisible()
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(14)
    await expect(page.getByTestId('google-sign-in')).toHaveCount(0)
  })

  test('the terms render, and link back to the app', async ({ page }) => {
    await page.goto('/terms-and-conditions')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Términos y condiciones')
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(7)
    await expect(page.getByRole('link', { name: /Volver a la app/ })).toHaveAttribute('href', '/')
  })

  test('the contact address comes from the build, not from the source', async ({ page }) => {
    // Whatever playwright.config.ts passed as VITE_CONTACT_EMAIL has to appear
    // on both pages, and the placeholder that stands in for a missing one must
    // not. That placeholder is the failure state: it is what ships if nobody
    // sets the variable, and Google reads these pages.
    for (const path of ['/privacy', '/terms-and-conditions']) {
      await page.goto(path)
      await expect(page.getByText('e2e@example.invalid').first()).toBeVisible()
      // The exact fallback, not the word "PENDIENTE": getByText matches
      // substrings without regard to case, and the policy legitimately talks
      // about "gastos pendientes de subir" two sections further down.
      await expect(page.getByText('falta configurar VITE_CONTACT_EMAIL')).toHaveCount(0)
    }
  })
})
