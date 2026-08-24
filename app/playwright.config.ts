import { defineConfig } from '@playwright/test'

/**
 * The browser tests run against the built bundle, not the dev server.
 *
 * What they exist to catch has twice now been something only the real build
 * does: a screen that scrolls because the layout was written for a document, a
 * sign-in button whose credential arrived after the request that wanted it had
 * already given up. Neither shows up in a unit test, and neither showed up in
 * review.
 *
 * The specs are `*.e2e.ts` rather than `*.spec.ts` on purpose. Vitest's default
 * include picks up `*.test.*` and `*.spec.*` anywhere under the root, so a
 * Playwright spec named the usual way gets collected by the unit runner and
 * fails in a way that reads as nonsense. The extension is the boundary.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),

  // No retries, here or in CI. A test that passes on the second attempt is a
  // test that has stopped telling you anything, and this suite has no business
  // touching the network: Google and the backend are both stubbed.
  retries: 0,

  reporter: 'list',

  // Sixty seconds a test, where the default is thirty. Not because anything here
  // is slow on a runner — the whole suite takes twenty-five seconds in CI — but
  // because the container this is written in cannot reach accounts.google.com, so
  // every page load waits out the GSI script's own timeout first. Five tests that
  // reload the page sat at twenty-seven seconds and went red the moment two of
  // them ran at once, which is a test suite that reports the machine's load
  // rather than the code. The assertions keep their own five-second timeouts, and
  // those are what catch a real failure; this ceiling only stops a slow machine
  // from looking like a broken app.
  timeout: 60_000,

  use: {
    baseURL: 'http://localhost:4173',
    browserName: 'chromium',
    // The screen this app lives on. Every assertion about the layout fitting
    // without scrolling is meaningless without a phone-shaped viewport.
    viewport: { width: 430, height: 932 },
    trace: 'retain-on-failure',
    launchOptions: {
      // A machine that already has a Chromium can point at it instead of
      // downloading another one — a sandbox, or a CI image with a browser baked
      // in. Unset, which is what CI does, Playwright uses the build it manages.
      executablePath: process.env.CHROMIUM_PATH || undefined,
    },
  },

  // Built and served exactly as production is, with the three variables Vite
  // inlines. They only have to exist: every request they would reach is
  // intercepted by the tests.
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_API_URL: 'https://script.google.com/macros/s/e2e/exec',
      VITE_GOOGLE_CLIENT_ID: 'e2e.apps.googleusercontent.com',
      VITE_CONTACT_EMAIL: 'e2e@example.invalid',
    },
  },
})
