import { useSyncExternalStore } from 'react'

/**
 * What the app is doing right now, and the last thing that went wrong.
 *
 * This exists because "se queda en el splash" is a bug report that cannot be
 * acted on. The splash screen used to be a word on an empty screen, identical
 * whether the app was reading IndexedDB, waiting for Google, waiting for the
 * spreadsheet, or waiting for something that was never going to arrive. Four
 * separate hangs hid behind that one screen, and each cost a round trip to the
 * two people using the app to find out which.
 *
 * So the splash reports. Every step of the way in writes down where it is, and
 * anything that fails writes down what it said — including the failures the app
 * recovers from, which are otherwise invisible and are usually the clue.
 *
 * A module-level store rather than context: `auth/google.ts` and `store/queue.ts`
 * are not components and cannot reach a provider, and this has to work before
 * React has rendered anything at all.
 */

export type Step = 'start' | 'cache' | 'queue' | 'google' | 'sheet' | 'ready'

/** One line of the details panel: what it is, and what it was. */
export interface Fact {
  label: string
  value: string
}

export interface Progress {
  step: Step
  /** When the current step began, for the seconds counter on the splash. */
  since: number
  /** The last failure, in whatever words it arrived in, or null. */
  fault: string | null
  /**
   * Everything worth knowing about this particular phone, in the order it was
   * learnt: which address the bundle is pointed at, which build it is, whether
   * there was a token, what the browser actually said.
   *
   * This exists because of "antes funcionaba". The interesting question is then
   * what is different, and none of the answers were on screen — least of all
   * which version of the app the phone is even running.
   */
  facts: readonly Fact[]
}

const facts = new Map<string, string>()

function snapshot(): readonly Fact[] {
  return [...facts].map(([label, value]) => ({ label, value }))
}

let current: Progress = { step: 'start', since: Date.now(), fault: null, facts: [] }
const listeners = new Set<() => void>()

function publish(next: Progress) {
  // A fresh object every time, deliberately: useSyncExternalStore compares
  // snapshots by identity, so mutating this one would repaint nothing.
  current = next
  for (const listener of listeners) listener()
}

export function report(step: Step) {
  if (current.step === step) return
  // The fault survives the step it happened in. A network failure followed by a
  // retry that is also slow should still show why the first attempt died.
  publish({ ...current, step, since: Date.now() })
}

/**
 * Records a fact about this device, replacing any earlier value for the same
 * label. Facts are not errors: most of them are true on a perfectly healthy
 * phone, and they are only ever shown next to a failure they might explain.
 */
export function state(label: string, value: string) {
  if (facts.get(label) === value) return
  facts.set(label, value)
  publish({ ...current, facts: snapshot() })
}

/** Records a failure without changing what the app thinks it is doing. */
export function fault(message: string) {
  const text = message.trim() || 'error'
  if (current.fault === text) return
  publish({ ...current, fault: text })
}

/** Called once a load succeeds: the slate is clean. */
export function clearFault() {
  if (!current.fault) return
  publish({ ...current, fault: null })
}

export function progress(): Progress {
  return current
}

/** Exported for the tests, which need to reach it the way React does. */
export function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useProgress(): Progress {
  return useSyncExternalStore(subscribe, progress, progress)
}

/**
 * Errors nobody caught, on the screen instead of in a console the phone does
 * not show. An exception thrown while rendering is the boundary's job; this is
 * for the ones that happen outside it — an event handler, a promise with no
 * catch, a module that failed to load.
 */
/**
 * The facts that are true before anything has been asked of anybody.
 *
 * The build is the one that matters most. "Antes funcionaba" is a statement
 * about two different versions, and until this was on screen there was no way
 * to tell from a phone which of them it was running — including whether it had
 * picked up the fix it was supposed to be reporting on.
 */
export function describeDevice(labels: {
  build: string; network: string; worker: string; yes: string; no: string
}) {
  state(labels.build, BUILD)
  const online = () => state(labels.network, navigator.onLine ? labels.yes : labels.no)
  online()
  window.addEventListener('online', online)
  window.addEventListener('offline', online)
  state(labels.worker, navigator.serviceWorker?.controller ? labels.yes : labels.no)
}

/** Stamped in by the deploy workflow; 'dev' in a local or CI build. A commit and
 *  nothing else: it is printed on a screen the two users can photograph. */
const BUILD = (import.meta.env.VITE_BUILD as string | undefined)?.slice(0, 7) || 'dev'

export function watchForFaults() {
  window.addEventListener('error', event => {
    fault(event.message || String(event.error ?? 'error'))
  })
  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason as { message?: string } | string | undefined
    fault(typeof reason === 'string' ? reason : reason?.message ?? 'promesa rechazada')
  })
}
