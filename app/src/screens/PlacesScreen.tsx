import { useEffect, useState } from 'react'
import { Confirm } from '../components/Confirm'
import { PlaceMap } from '../components/PlaceMap'
import { ScreenHeader } from '../components/ScreenHeader'
import { Spinner } from '../components/Spinner'
import { T } from '../i18n/strings'
import { formatShortDate, toIso } from '../lib/dates'
import { PLACED_METRES, metresBetween } from '../lib/geo'
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

      {/* The two paragraphs that used to sit above the list, folded away.
          
          They were four lines of prose between the header and the thing the
          screen is for, read once and then in the way for ever. Folded rather
          than deleted, and this is the part not to undo: they are the same
          promise as section 13 of the privacy policy, and the reason it is
          repeated here is that a disclosure only in a policy is a disclosure
          nobody reads. A closed `details` is still on the screen, one tap from
          the list it describes, and it is `<summary>` text rather than a
          paragraph — which is what was asked for. Deleting them outright would
          leave the app claiming something in a published document that it no
          longer says where it happens. */}
      <details className="pt-2 text-xs text-ink-3">
        <summary className="cursor-pointer font-semibold focus-visible:outline
                            focus-visible:outline-2">
          {T.places.how}
        </summary>
        <p className="pt-2">{T.places.local}</p>
        <p className="pt-1.5">{T.places.localMap}</p>
      </details>

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
/**
 * Where the point on screen came from, which is the whole of this state.
 *
 * `saved` is the position the place already has, which is what the correction
 * opens on: no reading, no prompt, and a map you can drag from a sofa. `here` is
 * a fix just read from the device, still being refined by the watch. `hand` is
 * one somebody dragged the map to, which has no device accuracy at all and takes
 * `PLACED_METRES` instead.
 */
type Chosen = 'saved' | 'here' | 'hand'

/** A correction in progress: a point in hand and nothing written yet.
 *  `improving` while the watch is still running, exactly as on the review step —
 *  the first reading indoors is often ±40 m and the one half a minute later ±8. */
interface Editing {
  fix: Fix
  from: Chosen
  improving: boolean
}

/** The device read, which is its own state because it happens *inside* a
 *  correction: the map has to stay on screen while the phone is being asked. */
type Reading = 'idle' | 'asking' | 'denied' | 'unavailable'

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
  const [editing, setEditing] = useState<Editing | null>(null)
  const [reading, setReading] = useState<Reading>('idle')
  const [asking, setAsking] = useState(false)
  const [done, setDone] = useState(false)
  const metres = here ? Math.round(metresBetween(here, place)) : null
  const watching = editing?.from === 'here'

  /**
   * While a fix read from the device is on screen, keep improving it.
   *
   * The same watch the review step runs and for the same reason — the best fix
   * wins rather than the latest, because a later reading can be worse and
   * replacing a ±8 with a ±25 would be a downgrade dressed as an update.
   *
   * Only while the point came from the device: the moment somebody drags the map
   * the point is theirs, and a watch still running would shove it back under
   * their thumb a second later. Stopped too when the correction is saved,
   * cancelled or the sheet goes away — a watch left running is a GPS held open on
   * somebody's phone.
   */
  useEffect(() => {
    if (!watching) return
    return watchPosition(fix => setEditing(current => {
      if (current?.from !== 'here') return current
      return fix.accuracy < current.fix.accuracy
        ? { ...current, fix, improving: true }
        : { ...current, improving: false }
    }))
  }, [watching])

  /** Opens the correction on the position the place already has. Reads nothing
   *  and prompts for nothing: the map is drawn from what is on the disk, and
   *  from there it can be dragged. */
  function startFixing() {
    setDone(false)
    setReading('idle')
    setEditing({
      fix: { lat: place.lat, lon: place.lon, accuracy: place.accuracy },
      from: 'saved',
      improving: false,
    })
  }

  /** The one control on this screen that reads the position, which is why it is
   *  a button of its own and says what it does. */
  async function locateHere() {
    setDone(false)
    setReading('asking')
    const fix = await onLocate()
    if (fix === 'denied' || fix === 'unavailable') return setReading(fix)
    setReading('idle')
    setEditing({ fix, from: 'here', improving: true })
  }

  /** A drag. The point stops being the device's the moment it is moved, so the
   *  accuracy stops being the device's too. */
  function pan(fix: Fix) {
    setEditing(current => (current
      ? { fix: { ...fix, accuracy: PLACED_METRES }, from: 'hand', improving: false }
      : current))
  }

  async function save() {
    if (!editing) return
    await onMove(editing.fix)
    setEditing(null)
    setDone(true)
  }

  // How far the correction would move it, which is the one number that says what
  // pressing Guardar would do.
  const moved = editing ? Math.round(metresBetween(editing.fix, place)) : null

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
          // The saved position, or the one being chosen in its stead. Either way
          // it is a coordinate this device already has — the correction opens on
          // the place's own, so nothing is read to draw this and nothing is
          // written until Guardar.
          fix={editing?.fix ?? { lat: place.lat, lon: place.lon, accuracy: place.accuracy }}
          // Its own name goes under the dot rather than into this list: the
          // centre is the place here, not the person looking at it. While a
          // position is being chosen the centre is the crosshair, so the place
          // joins the neighbours and its label is where it would be moving from.
          nearby={editing && moved && moved >= APART_METRES
            ? [{ ...place, metres: moved }, ...others]
            : others}
          label={editing ? T.places.fixDrag : T.places.mapSaved}
          note={editing
            ? (editing.from === 'here' ? undefined
              : editing.from === 'hand' ? T.places.fixByHand
              : T.places.fixFromSaved)
            : T.places.mapSavedNote}
          improving={editing?.from === 'here' && editing.improving}
          centreLabel={editing ? undefined : place.concept}
          // The map is draggable only here, where a position is being chosen:
          // this is the correction that needs no fix at all, for the phone that
          // says the far side of the block while its owner can see the doorway.
          onPan={editing ? pan : undefined}
        />

        {editing
          ? (
            <>
              <p className="text-xs text-ink-2">
                {moved ? T.places.fixMoves(moved) : T.places.fixSame}
              </p>

              {/* The reading is inside the correction rather than the way into
                  it, which is the difference between this screen prompting and
                  not: dragging the map asks the device nothing. */}
              <button
                type="button"
                onClick={() => void locateHere()}
                disabled={reading === 'asking'}
                className="flex items-center justify-center gap-2 rounded-xl border border-line
                           py-2.5 text-sm font-semibold disabled:opacity-60
                           focus-visible:outline focus-visible:outline-2"
                style={{ background: 'var(--surface)' }}
              >
                {reading === 'asking' && <Spinner className="h-4 w-4" />}
                {reading === 'asking' ? T.places.fixAsking : T.places.fixHere}
              </button>

              {(reading === 'denied' || reading === 'unavailable') && (
                <p role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>
                  {reading === 'denied' ? T.places.denied : T.places.unavailable}
                </p>
              )}

              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
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
                onClick={startFixing}
                className="mt-2 rounded-xl py-3 text-sm font-bold focus-visible:outline
                           focus-visible:outline-2"
                style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
              >
                {T.places.fix}
              </button>
              <p className="text-center text-[11px] text-ink-3">{T.places.fixHow}</p>

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

/**
 * How far the correction has to have moved before the old position is labelled.
 *
 * It is drawn so you can see what you are moving away from, and at two metres it
 * is a label sitting on top of the crosshair hiding the thing being aimed. Five
 * is about where the two stop overlapping at street zoom.
 */
const APART_METRES = 5

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
