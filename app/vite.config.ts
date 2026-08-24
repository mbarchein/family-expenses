import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
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
