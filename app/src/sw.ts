/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching'
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
