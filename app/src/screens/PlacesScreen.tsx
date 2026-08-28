import { useEffect, useState } from 'react'
import { Confirm } from '../components/Confirm'
import { PlaceMap } from '../components/PlaceMap'
import { ScreenHeader } from '../components/ScreenHeader'
import { Spinner } from '../components/Spinner'
import { T } from '../i18n/strings'
import { formatShortDate, toIso } from '../lib/dates'
import { metresBetween } from '../lib/geo'
import { watchPosition, type Fix, type PositionFailure } from '../lib/position'
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
  const { places, ready, here, locateNow, moveTo, forget } = usePlaces()

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
            <li key={place.id}>
              {/* The whole row opens the place now that there is somewhere to
                  open. Borrar used to sit on the right of it and has moved
                  inside, next to the other thing you can do to a place: a
                  destructive button a thumb's width from the row that scrolls
                  past it is a place to press by accident. */}
              <button
                type="button"
                onClick={() => onOpen(place.id)}
                aria-label={T.places.open(place.concept)}
                className="flex w-full items-center gap-2 rounded-xl border border-line p-3
                           text-left focus-visible:outline focus-visible:outline-2"
                style={{ background: 'var(--surface)' }}
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
          onLocate={locateNow}
          onMove={fix => moveTo(open.id, fix)}
          onForget={async () => { await forget(open.id); onCloseDetail() }}
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
 * It is also the two things you can do to a place: correct where it is, and
 * delete it.
 *
 * **Correcting is the one that earns its keep.** The fix a place was saved with
 * is whatever the phone had at the till, which indoors is often ±40 m through a
 * roof — and places match within fifteen. A place saved that way is outside its
 * own tolerance from the first day, so it never comes back, and the only cure
 * this screen offered was deleting it and apuntando another gasto at that door.
 * Now: stand at the door, look at the new fix on the map with the old position
 * drawn beside it, and write it over the old one. Nothing is stored until
 * Guardar, and the watch that keeps improving the fix stops the moment it is.
 *
 * **Opening this reads nothing**, exactly as before: the map is drawn from the
 * coordinate on the disk, so it never prompts and works with the permission
 * refused. The correction button is the one that reads, and it says so — the
 * rule this app follows is that only a control announcing it may prompt. It is
 * the third occasion something about a position leaves this device, since the
 * map it then draws is of where the phone is: section 13, the two lines at the
 * top of this screen and the rule in `CLAUDE.md` all moved in the same commit.
 */
type Fixing =
  | { kind: 'off' }
  | { kind: 'asking' }
  /** A fix in hand and nothing written yet. `improving` while the watch is still
   *  running, exactly as on the review step: the first reading indoors is often
   *  ±40 m and the one thirty seconds later is ±8. */
  | { kind: 'found'; fix: Fix; improving: boolean }
  | { kind: 'denied' }
  | { kind: 'unavailable' }

function Detail({ place, others, here, onLocate, onMove, onForget, onClose }: {
  place: Place
  /** The other saved places near this one, measured from it. Drawn because they
   *  are the answer to "why does this door offer me two concepts". */
  others: NearPlace[]
  /** Where the phone is now, if it was already known. Not asked for here. */
  here: Fix | null
  /** Reads the position, prompting if the permission has not been decided. Only
   *  ever reached from the button that says it will. */
  onLocate: () => Promise<Fix | PositionFailure>
  onMove: (fix: Fix) => Promise<void>
  onForget: () => Promise<void>
  onClose: () => void
}) {
  const [fixing, setFixing] = useState<Fixing>({ kind: 'off' })
  const [asking, setAsking] = useState(false)
  const [done, setDone] = useState(false)
  const metres = here ? Math.round(metresBetween(here, place)) : null

  /**
   * While a new fix is on screen, keep improving it.
   *
   * The same watch the review step runs and for the same reason — the best fix
   * wins rather than the latest, because a later reading can be worse and
   * replacing a ±8 with a ±25 would be a downgrade dressed as an update. Stopped
   * the moment the correction is cancelled, saved or the sheet goes away: a watch
   * left running is a GPS held open on somebody's phone.
   */
  useEffect(() => {
    if (fixing.kind !== 'found') return
    return watchPosition(fix => setFixing(current => {
      if (current.kind !== 'found') return current
      return fix.accuracy < current.fix.accuracy
        ? { ...current, fix, improving: true }
        : { ...current, improving: false }
    }))
  }, [fixing.kind])

  async function locate() {
    setDone(false)
    setFixing({ kind: 'asking' })
    const fix = await onLocate()
    if (fix === 'denied' || fix === 'unavailable') return setFixing({ kind: fix })
    setFixing({ kind: 'found', fix, improving: true })
  }

  async function save() {
    if (fixing.kind !== 'found') return
    await onMove(fixing.fix)
    setFixing({ kind: 'off' })
    setDone(true)
  }

  // What is on the map: the place, or the position being offered in its stead.
  // The preview says so in its own words, because a map that changed under a
  // heading saying "dónde se guardó este sitio" would be showing one thing and
  // naming another.
  const preview = fixing.kind === 'found' ? fixing.fix : null
  const moved = preview ? Math.round(metresBetween(preview, place)) : null

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
          // The saved fix, or the one being offered to replace it. Either way it
          // is a coordinate this device already has: nothing is read to draw
          // this, and nothing is written until Guardar.
          fix={preview ?? { lat: place.lat, lon: place.lon, accuracy: place.accuracy }}
          // Its own name goes under the dot rather than into this list: the
          // centre is the place here, not the person looking at it. While a
          // correction is being looked at the centre is the phone, so the place
          // joins the neighbours and its label shows how far the move would be.
          nearby={preview ? [{ ...place, metres: moved ?? 0 }, ...others] : others}
          label={preview ? T.places.fixPreview : T.places.mapSaved}
          note={preview ? undefined : T.places.mapSavedNote}
          improving={fixing.kind === 'found' && fixing.improving}
          // Named in both states, and differently: on the place's own map the dot
          // is the place, and while a correction is being looked at the dot is
          // the phone and the place is the label forty metres down the street.
          // Two identical labels either side of a move is a picture that does not
          // say which one is which.
          centreLabel={preview ? T.places.here : place.concept}
        />

        {preview
          ? (
            <>
              <p className="text-xs text-ink-2">
                {moved ? T.places.fixMoves(moved) : T.places.fixSame}
              </p>
              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => setFixing({ kind: 'off' })}
                  className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold
                             focus-visible:outline focus-visible:outline-2"
                  style={{ background: 'var(--surface)' }}
                >
                  {T.places.fixCancel}
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  className="flex-1 rounded-xl py-2.5 text-sm font-bold
                             focus-visible:outline focus-visible:outline-2"
                  style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
                >
                  {T.places.fixSave}
                </button>
              </div>
            </>
          )
          : (
            <>
              <p className="text-xs text-ink-2">
                {T.places.savedOn(formatShortDate(toIso(new Date(place.savedAt))))}
                {' · '}{T.places.uses(place.uses)}
                {metres !== null && ` · ${T.places.distance(metres)}`}
              </p>
              {place.method && <p className="text-xs text-ink-2">{place.method}</p>}
              {others.length > 0 && (
                <p className="text-[11px] text-ink-3">{T.places.mapOthers(others.length)}</p>
              )}

              {/* The two things you can do to a saved place, at the bottom where
                  they cannot be pressed on the way to reading it. Correcting is
                  the useful one and it goes first: a place saved indoors at ±40 m
                  is outside the fifteen-metre tolerance from the day it was
                  written, so it never comes back — and deleting it was the only
                  cure this screen offered. */}
              <button
                type="button"
                onClick={() => void locate()}
                disabled={fixing.kind === 'asking'}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl py-3 text-sm
                           font-bold disabled:opacity-60 focus-visible:outline
                           focus-visible:outline-2"
                style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
              >
                {fixing.kind === 'asking' && <Spinner className="h-4 w-4" />}
                {fixing.kind === 'asking' ? T.places.fixAsking : T.places.fix}
              </button>
              <p className="text-center text-[11px] text-ink-3">{T.places.fixHow}</p>

              {(fixing.kind === 'denied' || fixing.kind === 'unavailable') && (
                <p role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>
                  {fixing.kind === 'denied' ? T.places.denied : T.places.unavailable}
                </p>
              )}
              {done && (
                <p role="status" className="text-xs" style={{ color: 'var(--accent)' }}>
                  {T.places.fixDone}
                </p>
              )}

              <button
                type="button"
                onClick={() => setAsking(true)}
                className="rounded-xl border py-2.5 text-sm font-semibold focus-visible:outline
                           focus-visible:outline-2"
                style={{ borderColor: 'var(--line)', color: 'var(--danger)' }}
              >
                {T.places.forget}
              </button>
            </>
          )}
      </div>

      {/* In the app rather than the browser's dialog — see `Confirm`. Deleting a
          place is small and irreversible, and `window.confirm` in a standalone
          PWA is labelled with the hostname and looks like something went wrong. */}
      {asking && (
        <Confirm
          title={T.places.forgetAsk}
          body={T.places.forgetBody}
          confirmLabel={T.places.forgetYes}
          onConfirm={() => { setAsking(false); void onForget() }}
          onCancel={() => setAsking(false)}
        />
      )}
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
