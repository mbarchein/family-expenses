import { ScreenHeader } from '../components/ScreenHeader'
import { T } from '../i18n/strings'
import { formatShortDate, toIso } from '../lib/dates'
import { metresBetween } from '../lib/geo'
import { usePlaces, type Place } from '../store/places'

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
export function PlacesScreen({ onBack }: { onBack: () => void }) {
  const { places, ready, here, forget } = usePlaces()

  const rows = [...places].sort((a, b) => {
    const near = distance(a, here) - distance(b, here)
    return near !== 0 ? near : b.savedAt - a.savedAt
  })

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
              <div className="flex-1">
                <p className="font-semibold">{place.concept}</p>
                {place.method && <p className="text-xs text-ink-2">{place.method}</p>}
                <p className="pt-1 text-[11px] text-ink-3">
                  {T.places.savedOn(formatShortDate(toIso(new Date(place.savedAt))))}
                  {' · '}{T.places.accuracy(Math.round(place.accuracy))}
                  {' · '}{T.places.uses(place.uses)}
                  {metres !== null && ` · ${T.places.distance(metres)}`}
                </p>
              </div>

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
    </div>
  )
}

/** Far away when there is no fix, so an unknown position leaves the list in the
 *  order it would have had anyway rather than shuffling it. */
function distance(place: Place, here: { lat: number; lon: number } | null): number {
  return here ? metresBetween(here, place) : Number.POSITIVE_INFINITY
}
