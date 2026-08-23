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
