import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Which screen is on, in the address bar rather than in a variable.
 *
 * It used to be a `useState` in `App`, which meant every screen in the app
 * shared one URL: reloading on the list, or on the places, or halfway through
 * looking at the recurring expenses, put you back on the keypad. On a PWA that
 * reloads itself when a new version lands, that is the app losing your place on
 * its own initiative.
 *
 * The paths are Spanish because they are read: they sit in the address bar, they
 * are what a bookmark says, and they are what somebody sends to the other one.
 * `app/vercel.json` rewrites every path to index.html, so they arrive here
 * rather than as a 404.
 *
 * The pathname is the single source of truth, deliberately. History *state* is
 * the obvious place to put the screen and it is the wrong one: the add wizard
 * calls `replaceState` to keep its own step there, so a screen kept in state
 * would be quietly overwritten by a flow that knows nothing about it. A pathname
 * survives that, and survives being typed by hand.
 */
export type Route = 'add' | 'list' | 'balance' | 'places' | 'fixed'

const PATHS: Record<Route, string> = {
  add: '/',
  list: '/gastos',
  balance: '/diferencia',
  places: '/sitios',
  fixed: '/fijos',
}

/**
 * The screen, and what it is looking at.
 *
 * `detail` is the segment after the screen's own path: `/fijos/3` is the Fijos
 * screen with the template on row 3 open, `/gastos/abc` is the list with that
 * entry open. Empty for the screen itself.
 *
 * It exists because those two sheets used to be `useState`, and a sheet that is
 * state rather than an address has a back button that does the wrong thing:
 * pressing back on the detail of a fijo left the whole screen instead of closing
 * the sheet, which is the bug this answers. A reload landed on the keypad, and
 * nobody could send the other one a link to a row.
 */
/**
 * The details the keypad answers to.
 *
 * Listed rather than derived, and this is the reason: `/` is the prefix of every
 * path in the app, so anything else would make `/cualquier-cosa` a detail of the
 * keypad instead of an address nobody recognises. One entry today — the cog
 * sheet, which is a place you can be sent back to when the app reloads itself on
 * a deploy.
 */
const ADD_DETAILS = ['iconos']

export function pathOf(route: Route, detail = ''): string {
  const base = PATHS[route]
  if (!detail) return base
  return base === '/' ? `/${encodeURIComponent(detail)}`
    : `${base}/${encodeURIComponent(detail)}`
}

export function routeOf(pathname: string): Route {
  return split(pathname).route
}

/** What the address is looking at, decoded, or '' for the screen itself. */
export function detailOf(pathname: string): string {
  return split(pathname).detail
}

function split(pathname: string): { route: Route; detail: string } {
  const trimmed = pathname.replace(/\/+$/, '') || '/'
  const exact = (Object.keys(PATHS) as Route[]).find(route => PATHS[route] === trimmed)
  if (exact) return { route: exact, detail: '' }

  if (ADD_DETAILS.includes(trimmed.slice(1))) return { route: 'add', detail: trimmed.slice(1) }

  // Longest first, so `/fijos` is tried before `/` — otherwise every path would
  // match the keypad and everything after the first slash would be its detail.
  const routes = (Object.keys(PATHS) as Route[])
    .filter(route => PATHS[route] !== '/')
    .sort((a, b) => PATHS[b].length - PATHS[a].length)
  for (const route of routes) {
    if (trimmed.startsWith(`${PATHS[route]}/`)) {
      return { route, detail: decode(trimmed.slice(PATHS[route].length + 1)) }
    }
  }
  // An address nobody recognises opens the app rather than an error. There is no
  // 404 worth writing for two people and five screens.
  return { route: 'add', detail: '' }
}

function decode(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    // A malformed escape is not worth a crash on the way into the app.
    return raw
  }
}

/**
 * The state of the entry we are on, to be carried onto the next one.
 *
 * The add wizard keeps its step in `history.state`, and a screen or a detail
 * arriving on top is not entitled to lose it: an entry pushed with a bare `{}`
 * made the wizard read "no step" when it was popped back to, so back out of the
 * cog sheet's icon list dropped the whole flow to the keypad — a sheet closing
 * two screens at once, which is the bug this file exists to answer.
 *
 * `overlay` is the exception and is dropped: it marks how deep a sheet sits above
 * *this* entry, so it means nothing on the next one.
 */
function carried(): Record<string, unknown> {
  const state = { ...(history.state as Record<string, unknown> | null) }
  delete state.overlay
  return state
}

/**
 * How many entries this app has pushed itself.
 *
 * It is what the back button needs to know: `history.back()` from the first
 * screen of a fresh tab leaves the app entirely, which is not what a back arrow
 * inside an app should ever do. Module scope rather than state because it counts
 * something about the tab, not about a render, and it deliberately survives
 * every remount.
 */
let pushed = 0

export function useRoute() {
  const [at, setAt] = useState(() => split(location.pathname))

  useEffect(() => {
    const onPop = () => setAt(split(location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((next: Route) => {
    const now = split(location.pathname)
    if (now.route === next && !now.detail) return
    history.pushState(carried(), '', pathOf(next))
    pushed++
    setAt({ route: next, detail: '' })
  }, [])

  /**
   * Opens a detail of the screen already on, as its own history entry.
   *
   * Its own entry is the whole point: back then closes the sheet rather than
   * leaving the screen, which is what a back button on a detail is for.
   */
  const openDetail = useCallback((detail: string) => {
    const now = split(location.pathname)
    if (now.detail === detail) return
    history.pushState(carried(), '', pathOf(now.route, detail))
    pushed++
    setAt({ route: now.route, detail })
  }, [])

  /** Back through the history when there is one of ours to go back through, and
   *  home when there is not — arriving straight at `/sitios` from a bookmark
   *  still leaves an arrow that does something sensible. */
  const back = useCallback(() => {
    if (pushed > 0) return history.back()
    history.replaceState(carried(), '', pathOf('add'))
    setAt({ route: 'add', detail: '' })
  }, [])

  /**
   * Closes a detail without leaving the screen.
   *
   * `back()` when this app pushed the entry, which is the common case and the one
   * that keeps the device's own back button and the sheet's Cerrar doing the same
   * thing. A detail arrived at directly — a bookmark, a link from the other phone
   * — has no entry of ours behind it, so the address is rewritten in place
   * instead of stepping out of the app.
   */
  const closeDetail = useCallback(() => {
    if (pushed > 0) return history.back()
    const now = split(location.pathname)
    history.replaceState(carried(), '', pathOf(now.route))
    setAt({ route: now.route, detail: '' })
  }, [])

  return { route: at.route, detail: at.detail, go, openDetail, back, closeDetail }
}

/**
 * A sheet that the back button closes.
 *
 * For the overlays that are not addresses: the cog sheet's inner lists, the
 * category picker, the proposal of what the recurring templates owe. They open
 * over a form whose contents are nowhere in the URL, so a path of their own would
 * promise to restore something it cannot — but the back button on a phone is the
 * gesture for "close this", and a sheet that ignores it takes the whole screen
 * away instead. That was the reported bug, and it is not only about the fijos.
 *
 * While `open`, one history entry belongs to this sheet, and pressing back runs
 * exactly the same function its own Cerrar runs. Two things make it safe to
 * nest:
 *
 * - The entry is stamped with its depth, taken from the entry underneath, and a
 *   pop only closes the sheet whose stamp has just disappeared. Without that, the
 *   sheet beneath would hear the same popstate and close as well, so one press
 *   would shut both.
 * - Closing from the button takes the entry back out, but only if it is still on
 *   top. It is not, if a tab was tapped while the sheet was up: stepping back
 *   then would undo the navigation the tap just made, and one stale entry is a
 *   far smaller thing than a tab bar that bounces.
 *
 * The rest of the state is preserved into our entry, because the add wizard keeps
 * its step there and a sheet is not entitled to lose it.
 */
export function useBackClose(open: boolean, onBack: () => void) {
  // Through a ref, so a handler rebuilt on every render does not push and pop an
  // entry on every render with it. Written in an effect rather than during the
  // render: a ref touched while rendering is a lint error and, in a concurrent
  // render that is thrown away, a lie.
  const latest = useRef(onBack)
  useEffect(() => { latest.current = onBack }, [onBack])

  useEffect(() => {
    if (!open) return
    const state = history.state as { overlay?: number } | null
    const depth = (state?.overlay ?? 0) + 1
    history.pushState({ ...state, overlay: depth }, '')

    const onPop = () => {
      const now = (history.state as { overlay?: number } | null)?.overlay ?? 0
      if (now < depth) latest.current()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      const now = (history.state as { overlay?: number } | null)?.overlay ?? 0
      if (now === depth) history.back()
    }
  }, [open])
}
