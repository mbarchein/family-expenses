import { useState } from 'react'
import { CategoryField } from '../components/CategoryField'
import { ConceptField } from '../components/ConceptField'
import { Confirm } from '../components/Confirm'
import { HereButton } from '../components/HereButton'
import { PlaceMap } from '../components/PlaceMap'
import { ScreenHeader } from '../components/ScreenHeader'
import { T } from '../i18n/strings'
import type { Category } from '../api/types'
import { formatShortDate, toIso } from '../lib/dates'
import { metresBetween } from '../lib/geo'
import { usePositionPicker } from '../lib/picker'
import type { Fix, PositionFailure } from '../lib/position'
import { usePlaces, type NearPlace, type Place } from '../store/places'

/** The detail segment that means "a place that does not exist yet", like the
 *  fijos screen's own. A word rather than a number, because it ends up in the
 *  address bar — and no uuid can collide with it. */
const NEW = 'nuevo'

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
export function PlacesScreen({
  categories, concepts, onBack, viewing, onOpen, onCloseDetail,
}: {
  /** The Categorías tab, for the picker on the two forms. From the ledger,
   *  because a place files its gastos under the same names the gastos do. */
  categories: readonly Category[]
  /** And the vocabulary, for their concept boxes: a place's concept is a ledger
   *  concept — it is written into the sheet every time this door is recognised —
   *  so it is offered from the same list as everywhere else. */
  concepts: readonly string[]
  onBack: () => void
  /** From the address: the id of the place whose map is open, `nuevo` for the
   *  form, or '' for the list. An address is what makes the phone's back button
   *  close the sheet instead of leaving the screen — the same reason the fijos
   *  detail has one. */
  viewing: string
  onOpen: (detail: string) => void
  onCloseDetail: () => void
}) {
  const {
    places, ready, here, locateNow, addPlace, moveTo, editPlace, forget,
  } = usePlaces(
    // The distances on this screen were always worth having; now the new-place
    // form opens on the position too, where it is already allowed. Still never a
    // prompt — that is `HereButton`'s job and nothing else's.
    { locate: true })

  const rows = [...places].sort((a, b) => {
    const near = distance(a, here) - distance(b, here)
    return near !== 0 ? near : b.savedAt - a.savedAt
  })

  // Derived from the address rather than held beside it, so there is one answer
  // to "what is open". An id nothing matches — a place forgotten on this phone
  // while a link to it was still around — leaves the list rather than an empty
  // sheet.
  const open = viewing && viewing !== NEW
    ? rows.find(place => place.id === viewing) ?? null
    : null
  const adding = viewing === NEW

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
                  {/* What this doorway files its gastos under, when somebody has
                      said. On its own line with the card, because both are things
                      the place hands to the expense rather than facts about the
                      place. */}
                  {(place.category || place.method) && (
                    <span className="block truncate text-xs text-ink-2">
                      {[place.category, place.method].filter(Boolean).join(' · ')}
                    </span>
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

      {/* Below the list rather than above it: the list is what the screen is
          for, and this is the second way to get a place — the first being the
          switch on the review step, which only fires while a gasto is being
          apuntado there. */}
      <button
        type="button"
        onClick={() => onOpen(NEW)}
        className="rounded-xl py-3 text-sm font-bold focus-visible:outline
                   focus-visible:outline-2"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        {T.places.add}
      </button>

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

      {adding && (
        <NewPlace
          categories={categories}
          concepts={concepts}
          // Somewhere to start the map: where the phone is if that was already
          // allowed, and otherwise the last place saved — a coordinate off the
          // disk, so opening this form reads nothing and prompts for nothing.
          start={here ?? lastSaved(places)}
          startedHere={Boolean(here)}
          onLocate={locateNow}
          onSave={(fix, fields) => addPlace(fix, fields)}
          onClose={onCloseDetail}
        />
      )}

      {open && (
        <Detail
          key={open.id}
          place={open}
          others={around(open, places)}
          here={here}
          categories={categories}
          concepts={concepts}
          onLocate={locateNow}
          onMove={fix => moveTo(open.id, fix)}
          onEdit={fields => editPlace(open.id, fields)}
          onForget={async () => { await forget(open.id); onCloseDetail() }}
          onClose={onCloseDetail}
        />
      )}
    </div>
  )
}

/**
 * A place typed in from the Sitios screen, with a concept and a category.
 *
 * The switch on the review step is the other way in and it only fires while a
 * gasto is being apuntado at that doorway, which is the wrong moment twice over:
 * the shop you are standing outside with nothing to apuntar never gets saved, and
 * the one you do apuntar gets whatever category the guess made of its concept
 * while somebody was in a queue. This is the deliberate version of the same
 * thing — name it, file it, and put the point where the door is.
 *
 * It reads nothing on the way in. The map opens on the phone's position if that
 * was already known without asking, and otherwise on the last place saved, which
 * is a coordinate off the disk; from either it is dragged. The only control here
 * that touches the device is `HereButton`, which says so.
 */
function NewPlace({
  categories, concepts, start, startedHere, onLocate, onSave, onClose,
}: {
  categories: readonly Category[]
  concepts: readonly string[]
  /** Somewhere for the map to open on, or null on a phone with no permission and
   *  no saved place — there the map waits for the button. */
  start: Fix | null
  /** Whether `start` is the phone rather than a guess. The map says which, since
   *  a map centred on somewhere plausible looks exactly like one centred on you. */
  startedHere: boolean
  onLocate: () => Promise<Fix | PositionFailure>
  onSave: (
    fix: Fix, fields: { concept: string; method: string; category: string },
  ) => Promise<'saved' | 'again' | 'denied' | 'unavailable'>
  onClose: () => void
}) {
  const { picked, reading, locateHere, pan } = usePositionPicker(start, onLocate)
  const [concept, setConcept] = useState('')
  const [category, setCategory] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    const named = concept.trim()
    if (!named) return setProblem(T.places.addNeedConcept)
    if (!picked.fix) return setProblem(T.places.addNeedFix)

    setProblem(null)
    setSaving(true)
    // `again` rather than a second row: the same concept at the same doorway is
    // the same place, and the store says so instead of listing it twice.
    const result = await onSave(picked.fix, { concept: named, method: '', category })
    if (result === 'again') {
      setSaving(false)
      return setProblem(T.places.addAgain)
    }
    onClose()
  }

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col"
      style={{ background: 'var(--paper)' }}
      role="dialog"
      aria-label={T.places.addTitle}
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <p className="flex-1 truncate text-sm font-semibold">{T.places.addTitle}</p>
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
        {picked.fix
          ? (
            <PlaceMap
              fix={picked.fix}
              nearby={[]}
              label={T.places.fixDrag}
              note={picked.from === 'here' ? undefined
                : picked.from === 'hand' ? T.places.fixByHand
                : startedHere ? T.places.addFromHere
                : T.places.addFromLast}
              improving={picked.from === 'here' && picked.improving}
              onPan={pan}
            />
          )
          : (
            // No position and nothing to guess from. Said rather than shown as an
            // empty box: a map of nowhere is worse than no map.
            <p className="rounded-xl border border-line p-4 text-center text-xs text-ink-3"
               style={{ background: 'var(--surface)' }}>
              {T.places.addNeedFix}
            </p>
          )}

        <HereButton reading={reading} onClick={() => void locateHere()} />

        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-ink-2">{T.places.addConcept}</p>
          {/* The same box the edit sheet and the fijos editor use, with the same
              vocabulary behind it: this text becomes a concepto in the hoja, and
              a place is not a good reason to spell one a second way. */}
          <ConceptField
            value={concept}
            concepts={concepts}
            placeholder={T.places.addConceptPlaceholder}
            onChange={setConcept}
          />
          <p className="text-[11px] text-ink-3">{T.places.addConceptHow}</p>
        </div>

        {/* The same picker the second step uses, and the same names: a place
            files its gastos under the categories the gastos are filed under, or
            the column would mean two different things. */}
        <CategoryField value={category} categories={categories} onChange={setCategory} />

        {problem && (
          <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>
            {problem}
          </p>
        )}

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="mt-1 rounded-xl py-3 text-sm font-bold disabled:opacity-60
                     focus-visible:outline focus-visible:outline-2"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          {T.places.addSave}
        </button>
      </div>
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
 * It is also everything you can do to a place: change what it is, correct where
 * it is, and delete it.
 *
 * **What it is** is the concept and the category, and they are editable here for
 * the same reason the position is. The concept was typed at a till and is written
 * into the ledger every time this door is recognised, so a typo from that moment
 * is a typo apuntado for ever — and the only cure this screen offered was
 * deleting the place and starting it again, which threw its `uses` away with it.
 * Guardar appears when something has actually changed, so the button is never a
 * question about whether anything did.
 *
 * **Correcting is the one that earns its keep.** The fix a place was saved with
 * is whatever the phone had at the till, which indoors is often ±40 m through a
 * roof — and places match within fifteen. A place saved that way is outside its
 * own tolerance from the first day, so it never comes back, and the only cure
 * this screen offered was deleting it and apuntando another gasto at that door.
 * Now: open it on the position it already has, drag the map until the crosshair
 * is on the doorway, and Guardar writes what is under the crosshair. Nothing is
 * stored until then.
 *
 * **Opening this reads nothing**: the map is drawn from the coordinate on the
 * disk, so it never prompts and works with the permission refused. Inside the
 * correction, and only there, `HereButton` reads the device — the rule this app
 * follows is that only a control announcing it may prompt.
 */
function Detail({
  place, others, here, categories, concepts, onLocate, onMove, onEdit, onForget, onClose,
}: {
  place: Place
  /** The other saved places near this one, measured from it. Drawn because they
   *  are the answer to "why does this door offer me two concepts". */
  others: NearPlace[]
  /** Where the phone is now, if it was already known. Not asked for here. */
  here: Fix | null
  categories: readonly Category[]
  concepts: readonly string[]
  /** Reads the position, prompting if the permission has not been decided. Only
   *  ever reached from the button that says it will. */
  onLocate: () => Promise<Fix | PositionFailure>
  onMove: (fix: Fix) => Promise<void>
  /** `again` when another place at this same doorway already has that concept:
   *  the pair is the identity, so that rename would be a duplicate. */
  onEdit: (
    fields: { concept: string; category: string },
  ) => Promise<'saved' | 'again'>
  onForget: () => Promise<void>
  onClose: () => void
}) {
  const saved: Fix = { lat: place.lat, lon: place.lon, accuracy: place.accuracy }
  const { picked, reading, locateHere, pan, reset } = usePositionPicker(saved, onLocate)
  /** Whether the correction is open. Separate from the picker, which always holds
   *  a position: this screen shows the place's own until somebody says otherwise. */
  const [correcting, setCorrecting] = useState(false)
  const [asking, setAsking] = useState(false)
  const [done, setDone] = useState(false)
  const [concept, setConcept] = useState(place.concept)
  const [category, setCategory] = useState(place.category)
  const [edited, setEdited] = useState<'none' | 'saved' | 'again'>('none')
  const metres = here ? Math.round(metresBetween(here, place)) : null

  // Something to save, and something worth saving: an empty concept is not a
  // rename, it is a place with nothing to offer at that door.
  const changed = concept.trim() !== place.concept || category !== place.category
  const savable = changed && Boolean(concept.trim())

  async function saveFields() {
    if (!savable) return
    setEdited(await onEdit({ concept: concept.trim(), category }))
  }

  /** Opens the correction on the position the place already has. Reads nothing
   *  and prompts for nothing: the map is drawn from what is on the disk, and
   *  from there it can be dragged. */
  function startFixing() {
    setDone(false)
    reset(saved)
    setCorrecting(true)
  }

  function stopFixing() {
    setCorrecting(false)
    reset(saved)
  }

  async function save() {
    if (!picked.fix) return
    await onMove(picked.fix)
    setCorrecting(false)
    setDone(true)
  }

  // How far the correction would move it, which is the one number that says what
  // pressing Guardar would do.
  const editing = correcting && picked.fix ? picked : null
  const moved = editing?.fix ? Math.round(metresBetween(editing.fix, place)) : null

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
          fix={editing?.fix ?? saved}
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
              <HereButton reading={reading} onClick={() => void locateHere()} />

              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={stopFixing}
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
                {place.method && ` · ${place.method}`}
              </p>
              {others.length > 0 && (
                <p className="text-[11px] text-ink-3">{T.places.mapOthers(others.length)}</p>
              )}

              {/* What the place *is*, editable in place rather than behind a
                  mode: two fields, and a Guardar that is only there when there is
                  something to save. The card stays on the line above, read-only —
                  it is what was used here last, not a decision. */}
              <div className="flex flex-col gap-1 pt-1">
                <p className="text-xs font-semibold text-ink-2">{T.places.addConcept}</p>
                <ConceptField
                  value={concept}
                  concepts={concepts}
                  onChange={value => { setConcept(value); setEdited('none') }}
                />
              </div>
              <CategoryField
                value={category}
                categories={categories}
                onChange={value => { setCategory(value); setEdited('none') }}
              />

              {edited === 'again' && (
                <p role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>
                  {T.places.editAgain}
                </p>
              )}
              {edited === 'saved' && !changed && (
                <p role="status" className="text-xs" style={{ color: 'var(--accent)' }}>
                  {T.places.editDone}
                </p>
              )}

              {savable && (
                <button
                  type="button"
                  onClick={() => void saveFields()}
                  className="rounded-xl py-2.5 text-sm font-bold focus-visible:outline
                             focus-visible:outline-2"
                  style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
                >
                  {T.places.editSave}
                </button>
              )}

              {/* The two things you can do to a saved place, at the bottom where
                  they cannot be pressed on the way to reading it. Correcting is
                  the useful one and it goes first: a place saved indoors at ±40 m
                  is outside the fifteen-metre tolerance from the day it was
                  written, so it never comes back — and deleting it was the only
                  cure this screen offered. */}
              {/* Outlined rather than filled, now that Guardar can appear above
                  it: two solid accent buttons stacked is two primary actions, and
                  the one that is primary here is whichever the fields are asking
                  for. */}
              <button
                type="button"
                onClick={startFixing}
                className="mt-2 rounded-xl border py-2.5 text-sm font-semibold
                           focus-visible:outline focus-visible:outline-2"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent)',
                }}
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
 * The most recently saved place, or null.
 *
 * Somewhere for the new-place map to open on when the phone's position is not
 * already known: a coordinate off the disk rather than a reading, and the most
 * recent one because places are saved where their owner has been lately. The map
 * says out loud that this is where it started, since a map centred on somewhere
 * plausible looks exactly like a map centred on you.
 */
function lastSaved(places: readonly Place[]): Fix | null {
  let latest: Place | null = null
  for (const place of places) if (!latest || place.savedAt > latest.savedAt) latest = place
  return latest ? { lat: latest.lat, lon: latest.lon, accuracy: latest.accuracy } : null
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
