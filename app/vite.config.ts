import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Which commit this bundle is, worked out here rather than passed in.
 *
 * It was a `VITE_BUILD` in the deploy workflow's environment for exactly one
 * deploy, and the phone reported `Versión: dev` — a bundle that had reached
 * production without the stamp, which is the one thing the stamp exists to rule
 * out. Reading git where the build actually runs cannot fail that way: the
 * workflow builds from a checkout, and so does every other path that produces a
 * bundle. The environment variable still wins when it is set, for a build that
 * has no git.
 *
 * Both halves are here on purpose. A sha answers "is this the fix?", and the
 * date answers it again for anyone without the commits to hand — including
 * when the sha is somehow missing, which is what happened.
 */
function stamp(): { build: string; built: string } {
  const fromEnv = process.env.VITE_BUILD?.trim()
  if (fromEnv) return { build: fromEnv.slice(0, 7), built: today() }
  try {
    return {
      build: execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim() || 'dev',
      built: today(),
    }
  } catch {
    // No git and no variable: a tarball, or a sandbox. Saying 'dev' is honest.
    return { build: 'dev', built: today() }
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ')
}

const VERSION = stamp()

export default defineConfig({
  define: {
    // Inlined as literals, so nothing here depends on the VITE_ prefix reaching
    // `import.meta.env` through whichever tool is driving the build.
    __BUILD__: JSON.stringify(VERSION.build),
    __BUILT_AT__: JSON.stringify(VERSION.built),
  },
  plugins: [
    react(),
    VitePWA({
      // injectManifest rather than generateSW: the service worker has to stay
      // out of the way of the API. Every call carries a short-lived ID token
      // and a cached response would be worse than no response — see src/sw.ts.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // src/pwa.ts registers the worker, so the plugin must not inject a second
      // registration of its own: two of them race and only one is the one that
      // checks for a new version when the app is opened.
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'A medias — gastos compartidos',
        short_name: 'A medias',
        description: 'Los gastos de casa, apuntados en tres toques',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f1f3f0',
        theme_color: '#0c6f63',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-pressing the icon lands straight on the keypad. The whole app
        // already opens there, but the shortcut skips whatever screen the user
        // left behind last time.
        shortcuts: [
          { name: 'Nuevo gasto', short_name: 'Nuevo', url: '/?nuevo=1' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173 },
})
