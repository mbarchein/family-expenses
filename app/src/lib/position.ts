/**
 * Where the phone is, asked for as little as possible.
 *
 * Two functions and the difference between them is the whole privacy design of
 * this feature. `askForPosition` prompts, and is only ever reached by tapping a
 * button that says it will. `positionIfAlreadyAllowed` never prompts: it looks
 * at the permission first and gives up rather than asking, so entering an
 * expense does not raise a dialog for somebody who has never used places.
 */

export interface Fix {
  lat: number
  lon: number
  /** Metres of uncertainty the device reports. Kept and shown, because the
   *  tolerance places are matched with is smaller than a typical indoor fix. */
  accuracy: number
}

export type PositionFailure = 'denied' | 'unavailable'

/**
 * How long a fix is still where you are, in milliseconds.
 *
 * **Two minutes, and this number is only safe because of what it does not
 * govern.** Every gasto reads the position from scratch — the add flow asks the
 * moment the first digit of the amount is typed, throwing away whatever was
 * held — so this is not a cache that carries one shop's fix into the next
 * gasto. It governs one thing: how long somebody may dawdle *inside* a single
 * gasto before the step that shows the proximity cards takes the reading again.
 *
 * Asked for, and worth being plain about what it costs. The arithmetic written
 * above `maximumAge: 0` below says places match within 15 m and a person walks
 * about 1.4 m a second, which makes ten seconds the honest window and two
 * minutes about a hundred and seventy metres — several doorways. What bought
 * the other hundred and ten seconds is that ten was too short to be worth
 * having: writing a concept, opening the category picker and stepping back is
 * more than ten seconds of a normal gasto, so the cards kept blanking and being
 * fetched again in the middle of entering one expense, which is the reading
 * being redone rather than kept.
 *
 * So the trade is: a stale fix can only ever mean a card offered part-way
 * through a gasto for a doorway that was left mid-gasto, which is somebody
 * walking out of a shop while apuntando what they spent in it. A card is an
 * offer — it fills two fields when it is tapped and writes nothing on its own —
 * and the fifteen metres still decide whether it appears at all.
 */
export const FIX_GOOD_FOR = 120_000

/**
 * Whether a fix taken at `takenAt` is still where you are.
 *
 * Zero means there is no fix, which is not the same as an old one and is false
 * here for the same reason: neither is a position. Split out from the store so
 * the boundary can be tested without a browser — the wiring around it needs one,
 * the arithmetic does not.
 */
export function stillHere(takenAt: number, now: number = Date.now()): boolean {
  return takenAt > 0 && now - takenAt < FIX_GOOD_FOR
}

/** A fix, or why there is none. Prompts if the permission has not been decided. */
export async function askForPosition(): Promise<Fix | PositionFailure> {
  if (!navigator.geolocation) return 'unavailable'
  try {
    return read(await locate())
  } catch (error) {
    // 1 is PERMISSION_DENIED. The other two — position unavailable, timeout —
    // are the same thing from here: no fix, try again later.
    return (error as GeolocationPositionError)?.code === 1 ? 'denied' : 'unavailable'
  }
}

/**
 * A fix, but only for somebody who has already granted the permission.
 *
 * `null` covers everything else, including a browser with no Permissions API:
 * not knowing whether asking would raise a dialog has to mean not asking.
 */
export async function positionIfAlreadyAllowed(): Promise<Fix | null> {
  if (!navigator.geolocation || !navigator.permissions) return null
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' })
    if (status.state !== 'granted') return null
    return read(await locate())
  } catch {
    return null
  }
}

function locate(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      // Ten seconds is a long time to hold up a screen, and a fix that arrives
      // later than that is not going to help somebody at a till.
      timeout: 10_000,
      // Never a cached fix, and this is the line to leave alone. It was 60_000
      // — a minute-old position is free and looks harmless — and the browser
      // test that walks forty metres up the street caught it: the radius is
      // 15 m and a minute of walking is eighty. A cache window would have to be
      // under ten seconds to be safe, which is close enough to zero that the
      // reasoning is not worth keeping. It is the browser's cache this refuses,
      // and that refusal is what makes every gasto start from a real reading;
      // how long one reading then lasts inside a gasto is `FIX_GOOD_FOR`, which
      // is a different question with a different answer. The cost is one GPS
      // read per gasto, taken on the keypad where nobody is waiting on it.
      maximumAge: 0,
    })
  })
}

function read(position: GeolocationPosition): Fix {
  return {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    accuracy: position.coords.accuracy,
  }
}

/**
 * The coordinate as a person can read it, and paste into a map.
 *
 * Five decimals is about a metre, which is finer than any phone knows and
 * coarse enough to fit on one line. A point and not a comma for the decimal
 * separator even though the interface is Spanish: this is the one number here
 * that is not prose, and `37,17730, -3,59860` is a string with four numbers in
 * it as far as anyone reading it is concerned.
 */
export function formatCoords(fix: Fix): string {
  return `${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)}`
}

/**
 * Keeps reading the position until it is told to stop, reporting each fix.
 *
 * For the one screen that is standing still with the switch on: the first fix a
 * phone gives indoors is often ±40 m, and thirty seconds later the same phone
 * knows itself to ±8. Places match within fifteen metres, so the difference
 * between those two numbers is the difference between a suggestion that comes
 * back at that doorway and one that never does.
 *
 * Only ever started from the switch that says it will save where you are — the
 * same rule `askForPosition` follows, for the same reason: nothing in this app
 * reads the position without a control that announced it.
 *
 * Returns the way to stop, and stopping is not optional: a watch left running is
 * a GPS held open on somebody's phone.
 */
export function watchPosition(onFix: (fix: Fix) => void): () => void {
  if (!navigator.geolocation) return () => {}
  const id = navigator.geolocation.watchPosition(
    position => onFix(read(position)),
    // Silent on purpose. The switch already has the fix it was turned on with;
    // a refinement that fails to arrive is not news, and the errors here are the
    // same three as everywhere else.
    () => {},
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
  )
  return () => navigator.geolocation.clearWatch(id)
}
