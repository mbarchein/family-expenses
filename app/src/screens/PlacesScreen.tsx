import { PlaceMap } from '../components/PlaceMap'
import { ScreenHeader } from '../components/ScreenHeader'
import { T } from '../i18n/strings'
import { formatShortDate, toIso } from '../lib/dates'
import { metresBetween } from '../lib/geo'
import type { Fix } from '../lib/position'
import { usePlaces, type NearPlace, type Place } from '../store/places'

/**
 * The saved places, and what was bought at each one.
 *
 * It exists so the guessing on the second step is inspectable. A screen that
 * suggests a concept because of where you are standing has to have somewhere
 * that says which places it knows, how good the fix was when each was saved,
 * and how to get rid of one — otherwise the suggestion is magic, and magic that
 * fills in the wrong concept has no visible cause.
 *
 * Nothing here has ever been uploaded, and the first line of the screen says so.
 */
export function PlacesScreen({ onBack, viewing, onOpen, onCloseDetail }: {
  onBack: () => void
  /** From the address: the id of the place whose map is open, or '' for the list.
   *  An address is what makes the phone's back button close the map instead of
   *  leaving the screen — the same reason the fijos detail has one. */
  viewing: string
  onOpen: (detail: string) => void
  onCloseDetail: () => void
}) {
  const { places, ready, here, forget } = usePlaces()

  const rows = [...places].sort((a, b) => {
    const near = distance(a, here) - distance(b, here)
    return near !== 0 ? near : b.savedAt - a.savedAt
  })

  // Derived from the address rather than held beside it, so there is one answer
  // to "what is open". An id nothing matches — a place forgotten on this phone
  // while a link to it was still around — leaves the list rather than an empty
  // sheet.
  const open = viewing ? rows.find(place => place.id === viewing) ?? null : null

  return (
    <div className="flex flex-col gap-3 p-4">
      <ScreenHeader title={T.tabs.places} onBack={onBack} />

      <p className="text-xs text-ink-2">{T.places.local}</p>
      {/* The map is somebody else's server, so it is said here rather than only
          in section 13 of the policy: this is the screen that explains the
          feature, and a disclosure nobody reads is not one. */}
      <p className="text-xs text-ink-3">{T.places.localMap}</p>

      {ready && !rows.length && (
        <div className="flex flex-col gap-2 pt-6 text-center">
          <p className="text-sm font-semibold text-ink-2">{T.places.empty}</p>
          <p className="mx-auto max-w-xs text-xs text-ink-3">{T.places.emptyHow}</p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map(place => {
          const metres = here ? Math.round(metresBetween(here, place)) : null
          return (
            <li
              key={place.id}
              className="flex items-start gap-3 rounded-xl border border-line p-3"
              style={{ background: 'var(--surface)' }}
            >
              {/* The facts are the button, and Borrar stays beside it: a button
                  inside a button is not markup, and the destructive one has no
                  business being the whole row. Its own name, because a list of
                  dates and metres read out loud does not say what tapping does. */}
              <button
                type="button"
                onClick={() => onOpen(place.id)}
                aria-label={T.places.open(place.concept)}
                className="flex flex-1 items-center gap-2 rounded-lg text-left
                           focus-visible:outline focus-visible:outline-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{place.concept}</span>
                  {place.method && (
                    <span className="block text-xs text-ink-2">{place.method}</span>
                  )}
                  <span className="block pt-1 text-[11px] text-ink-3">
                    {T.places.savedOn(formatShortDate(toIso(new Date(place.savedAt))))}
                    {' · '}{T.places.accuracy(Math.round(place.accuracy))}
                    {' · '}{T.places.uses(place.uses)}
                    {metres !== null && ` · ${T.places.distance(metres)}`}
                  </span>
                </span>
                {/* The row gives no other sign that it opens something — the same
                    chevron the fijos banner uses, for the same reason. */}
                <span aria-hidden="true" className="shrink-0 text-ink-3">›</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm(T.places.forgetConfirm)) void forget(place.id)
                }}
                className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold
                           focus-visible:outline focus-visible:outline-2"
                style={{ color: 'var(--danger)' }}
              >
                {T.places.forget}
              </button>
            </li>
          )
        })}
      </ul>

      {open && (
        <Detail
          key={open.id}
          place={open}
          others={around(open, places)}
          here={here}
          onClose={onCloseDetail}
        />
      )}
    </div>
  )
}

/**
 * One saved place, on the map it was saved from.
 *
 * The list says a place is 34 m away and ±18 m sure of itself, which are numbers
 * about a doorway nobody can picture. This is the picture: the same streets the
 * review step drew when the place was saved, centred on the tile that fix landed
 * in, with the accuracy it had and the fifteen metres inside which another fix
 * counts as the same door.
 *
 * It reads no position. The coordinate is the one on the disk, so opening this
 * never prompts for the permission and works with it refused. What it does do is
 * ask openstreetmap.org for tiles — the second occasion in the app, after the
 * switch, and the reason section 13 and the two lines at the top of this screen
 * had to be rewritten in the same commit as it.
 */
function Detail({ place, others, here, onClose }: {
  place: Place
  /** The other saved places near this one, measured from it. Drawn because they
   *  are the answer to "why does this door offer me two concepts". */
  others: NearPlace[]
  /** Where the phone is now, if it was already known. Not asked for here. */
  here: Fix | null
  onClose: () => void
}) {
  const metres = here ? Math.round(metresBetween(here, place)) : null
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col"
      style={{ background: 'var(--paper)' }}
      role="dialog"
      aria-label={T.places.detail}
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <p className="flex-1 truncate text-sm font-semibold">{place.concept}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold focus-visible:outline focus-visible:outline-2"
          style={{ color: 'var(--accent)' }}
        >
          {T.places.close}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <PlaceMap
          // The saved fix, not a fresh one: this map is about where the place is,
          // and a phone that has moved has nothing to add to that.
          fix={{ lat: place.lat, lon: place.lon, accuracy: place.accuracy }}
          // Its own name goes under the dot rather than into this list: the
          // centre is the place here, not the person looking at it.
          nearby={others}
          label={T.places.mapSaved}
          note={T.places.mapSavedNote}
          centreLabel={place.concept}
        />

        <p className="text-xs text-ink-2">
          {T.places.savedOn(formatShortDate(toIso(new Date(place.savedAt))))}
          {' · '}{T.places.uses(place.uses)}
          {metres !== null && ` · ${T.places.distance(metres)}`}
        </p>
        {place.method && <p className="text-xs text-ink-2">{place.method}</p>}
        {others.length > 0 && (
          <p className="text-[11px] text-ink-3">{T.places.mapOthers(others.length)}</p>
        )}
      </div>
    </div>
  )
}

/**
 * The other places worth drawing around one of them.
 *
 * Measured from the place rather than from the phone, which is the whole
 * difference between this and the list's own ordering. The radius is generous
 * next to the 15 m tolerance on purpose: what makes the picture readable is the
 * shop across the road, and that one is deliberately *not* a match.
 */
const AROUND_METRES = 120

function around(place: Place, places: Place[]): NearPlace[] {
  return places
    .filter(other => other.id !== place.id)
    .map(other => ({ ...other, metres: metresBetween(place, other) }))
    .filter(other => other.metres <= AROUND_METRES)
    .sort((a, b) => a.metres - b.metres)
    .slice(0, 3)
}

/** Far away when there is no fix, so an unknown position leaves the list in the
 *  order it would have had anyway rather than shuffling it. */
function distance(place: Place, here: { lat: number; lon: number } | null): number {
  return here ? metresBetween(here, place) : Number.POSITIVE_INFINITY
}
