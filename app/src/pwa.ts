import { registerSW } from 'virtual:pwa-register'

/**
 * Pick up a new version when the app is opened.
 *
 * `registerType: 'autoUpdate'` and the service worker's own `skipWaiting()`
 * already hand control to a new version the moment one is found. The problem
 * was that nothing was finding one: a service worker only looks for an update
 * when the page navigates, and an installed PWA resumed from the background
 * never navigates. A phone kept running the version it was installed with
 * until somebody happened to pull down to refresh.
 *
 * So the check hangs off the document becoming visible, which is what "opening
 * it" means once the app is on the home screen.
 *
 * The reload is immediate rather than a banner to dismiss. At the moment of
 * opening, the screen is empty and there is nothing to lose. The cost is that a
 * version found while the app is already in use reloads too, and can take a
 * typed amount with it — rare, and cheaper than the failure it replaces. A
 * saved expense is never at risk: it is in the outbound queue in IndexedDB
 * before the screen repaints.
 */
export function keepUpToDate(): void {
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update()
      })
    },
  })

  // Whether this page already had a service worker in charge, read before any
  // of ours can take over. Without it the first visit after installing would
  // reload once for nothing: claiming an uncontrolled page fires the same event
  // as replacing a controller.
  const hadController = Boolean(navigator.serviceWorker?.controller)
  let reloading = false

  // Reloading here rather than leaving it to the plugin's own autoUpdate path.
  // This is the behaviour that was asked for by name, and it should not depend
  // on which minor version of vite-plugin-pwa happens to be installed.
  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return
    reloading = true
    window.location.reload()
  })
}
