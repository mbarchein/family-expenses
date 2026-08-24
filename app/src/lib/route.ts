import { useCallback, useEffect, useState } from 'react'

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

export function pathOf(route: Route): string {
  return PATHS[route]
}

export function routeOf(pathname: string): Route {
  const wanted = pathname.replace(/\/+$/, '') || '/'
  const found = (Object.keys(PATHS) as Route[]).find(route => PATHS[route] === wanted)
  // An address nobody recognises opens the app rather than an error. There is no
  // 404 worth writing for two people and five screens.
  return found ?? 'add'
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
  const [route, setRoute] = useState(() => routeOf(location.pathname))

  useEffect(() => {
    const onPop = () => setRoute(routeOf(location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((next: Route) => {
    if (routeOf(location.pathname) === next) return
    history.pushState({}, '', pathOf(next))
    pushed++
    setRoute(next)
  }, [])

  /** Back through the history when there is one of ours to go back through, and
   *  home when there is not — arriving straight at `/sitios` from a bookmark
   *  still leaves an arrow that does something sensible. */
  const back = useCallback(() => {
    if (pushed > 0) return history.back()
    history.replaceState({}, '', pathOf('add'))
    setRoute('add')
  }, [])

  return { route, go, back }
}
