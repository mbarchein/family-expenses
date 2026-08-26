/// <reference lib="webworker" />
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope

/**
 * The shell is cached; the ledger never is.
 *
 * Precaching the built assets is what lets the app open on the keypad with no
 * network. The API is deliberately left alone: every call carries a token that
 * expires within the hour, and a cached answer would show a stale balance —
 * which in this app is the one number that must never be wrong. Requests to the
 * backend go to the network or fail, and a failure is what the outbound queue
 * exists for.
 */
precacheAndRoute(self.__WB_MANIFEST)

/**
 * Every address is the same document.
 *
 * The screens have their own paths now — `/gastos`, `/fijos/4`, `/iconos` — so
 * those are addresses a phone can be sitting on when it goes into a lift, and
 * the precache only knows `index.html`. Without this, a reload on any screen but
 * the keypad left the precache route with nothing to match and went to the
 * network for a document that does not exist on the server either: offline it
 * showed the browser's own error page, which is the app failing to open at all.
 *
 * `vercel.json` performs exactly this rewrite when there is a server. This is
 * the same rewrite for when there is not.
 */
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

self.skipWaiting()
clientsClaim()

/**
 * Step forward when asked.
 *
 * `skipWaiting()` above is called as this worker installs and is normally
 * enough. It is not enough when another tab of the app is still holding the
 * previous worker: this one parks in `waiting`, and a version parked in
 * `waiting` never reaches the phone. `pwa.ts` messages it on every update
 * check, so the second attempt is not tied to a page ever navigating again.
 */
self.addEventListener('message', event => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})
