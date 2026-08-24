import { registerSW } from 'virtual:pwa-register'

/**
 * Pick up a new version when the app is opened.
 *
 * A service worker only looks for a new version of itself when the page
 * navigates, and an installed PWA resumed from the background never navigates.
 * So a phone kept running the version it was installed with until somebody
 * happened to pull down to refresh. Everything here exists to close that gap.
 *
 * Three things have to happen, and each of them used to have a way of not
 * happening:
 *
 * 1. **Look.** The check hangs off the document becoming visible and off
 *    `pageshow`, which is what "opening it" means once the app is on the home
 *    screen — the second one catches a resume from the back/forward cache,
 *    where a visibility change is not guaranteed.
 * 2. **Take over.** Our worker calls `skipWaiting()` as it installs, but a
 *    worker still parks in `waiting` whenever another tab of the app is holding
 *    the old one — so a waiting worker is told again, by message, to step
 *    forward. A version sitting in `waiting` is a version that never arrives.
 * 3. **Reload.** Two independent signals, because neither is reliable
 *    everywhere: `controllerchange` on the container, and the arriving worker
 *    reaching `activated`. Whichever comes first wins and the other is ignored.
 *
 * The reload is immediate rather than a banner to dismiss. At the moment of
 * opening, the screen is empty and there is nothing to lose. Nothing typed is
 * lost either way: the draft is in IndexedDB after every keystroke and a saved
 * expense is in the outbound queue before the screen repaints.
 */
export function keepUpToDate(): void {
  // Whether this page already had a service worker in charge, read before any
  // of ours can take over. Without it the first visit after installing would
  // reload once for nothing: claiming an uncontrolled page is indistinguishable
  // from replacing a controller.
  const hadController = Boolean(navigator.serviceWorker?.controller)
  let reloading = false

  function reload() {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  }

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return

      const look = () => {
        registration.update()
          // A worker that installed but did not take over. Ours skips waiting
          // by itself, so this is the belt to that braces.
          .then(() => registration.waiting?.postMessage({ type: 'SKIP_WAITING' }))
          // Offline, or the browser declined to check again this soon. Neither
          // is worth a word on screen, and an unhandled rejection here used to
          // be the only trace either left.
          .catch(() => {})
      }

      registration.addEventListener('updatefound', () => {
        const arriving = registration.installing
        arriving?.addEventListener('statechange', () => {
          if (arriving.state === 'installed') {
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
          }
          if (arriving.state === 'activated') reload()
        })
      })

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') look()
      })
      window.addEventListener('pageshow', look)
    },
  })

  navigator.serviceWorker?.addEventListener('controllerchange', reload)
}
