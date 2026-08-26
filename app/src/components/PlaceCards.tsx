import { T } from '../i18n/strings'
import type { NearPlace } from '../store/places'

/**
 * What has been apuntado at this doorway before, as cards.
 *
 * A card and not a chip because it carries two things and both have to be
 * visible. Tapping it fills in the concept *and* the payment method saved with
 * it, which is the whole "what was this" question answered in one tap — and the
 * rule the rest of this app follows is that a suggestion fills the field it is a
 * suggestion for. A card is a suggestion for the pair, so it prints the pair on
 * its face: nothing lands in a field that was not on screen before it was
 * touched.
 *
 * One line that scrolls sideways, like the chip rows and for the same reason: a
 * block that grows downwards pushes the concept field and the keyboard off a
 * phone. In practice there are one or two of these; the scroll is for the corner
 * where somebody has saved five things at one address.
 */
export function PlaceCards({ places, concept, method, onPick }: {
  places: NearPlace[]
  concept: string
  /** The payment method, which is the other half a card fills. It was the note
   *  until the method got a column of its own. */
  method: string
  onPick: (place: NearPlace) => void
}) {
  if (!places.length) return null

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-ink-2">{T.places.hereRow}</p>
      <div
        role="group"
        aria-label={T.places.hereRow}
        className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-0.5
                   [-ms-overflow-style:none] [scrollbar-width:none]
                   [&::-webkit-scrollbar]:hidden"
      >
        {places.map(place => {
          // Selected when both halves match, not just the concept: the card
          // claims to set two fields, so it may only look set when it has.
          const on = place.concept === concept && place.method === method
          return (
            <button
              key={place.id}
              type="button"
              onClick={() => onPick(place)}
              aria-pressed={on}
              className="min-w-[9rem] shrink-0 snap-start rounded-xl border px-3 py-2 text-left
                         focus-visible:outline focus-visible:outline-2"
              style={on
                ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--accent-ink)' }
                : { background: 'var(--surface)', borderColor: 'var(--accent)' }}
            >
              <span className="block truncate text-[15px] font-semibold">{place.concept}</span>
              {place.method && (
                <span className="block truncate text-xs" style={{ opacity: 0.75 }}>
                  {place.method}
                </span>
              )}
              <span className="block pt-0.5 text-[11px]" style={{ opacity: 0.6 }}>
                {T.places.distance(Math.round(place.metres))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
