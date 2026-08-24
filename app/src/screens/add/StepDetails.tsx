import { useMemo, useState } from 'react'
import { ConceptGrid, type ConceptTile } from '../../components/ConceptGrid'
import { IconMenu } from '../../components/IconMenu'
import { PlaceCards } from '../../components/PlaceCards'
import { Pills, type Pill } from '../../components/Pills'
import { T } from '../../i18n/strings'
import { fold } from '../../lib/icons'
import { fuzzyFilter } from '../../lib/fuzzy'
import { useIconChoices } from '../../store/iconChoices'
import { usePlaces } from '../../store/places'
import type { Draft } from '../../store/draft'
import type { Bootstrap, Suggestion } from '../../api/types'

/**
 * Six tiles, two by three.
 *
 * Not a number to raise casually: it is what fits at a size a thumb hits without
 * aiming, and every extra row comes out of the space the keyboard needs. Nine
 * was the alternative and it truncates "lavandería y luz".
 */
const TILES = 6

/**
 * Step two: what it was, and how it was paid for.
 *
 * The concepts are a grid of six tiles above the field, and the field searches
 * them. Two reasons for that order, and the second is the one that matters on a
 * phone: the tiles are the fast path and the typing is the fallback, so the fast
 * path goes where the eye lands first — and when the on-screen keyboard opens it
 * covers everything *below* the focused field, so anything useful has to be
 * above it.
 *
 * Nothing is focused on arrival. Landing on a screen with the keyboard already
 * up hides the chips behind it and makes the common case — tap a chip, move on —
 * the one that costs an extra gesture.
 *
 * Both rows are filtered by whoever is paying, chosen on the previous screen,
 * rather than by whoever is holding the phone. Either person can enter the
 * other's expense, and it is the payer's card that belongs in the note.
 *
 * Above all of it, when there is a place saved where the phone is standing, the
 * cards: what has been apuntado at this doorway before, concept and card
 * together, one tap to fill both. They go at the top because they are the
 * strongest guess this screen ever gets — somebody in the same shop as last time
 * is buying the same kind of thing, and no amount of frequency beats being here —
 * and because they are the only control here that can answer the whole screen.
 */
export function StepDetails({ draft, data, patch, onNext }: {
  draft: Draft
  data: Bootstrap
  patch: (fields: Partial<Draft>) => void
  onNext: () => void
}) {
  // `locate` because this is the screen that suggests by proximity, and the
  // position is read again on every visit: a fix is only worth what it was worth
  // when it was taken.
  const { nearby } = usePlaces({ locate: true })
  const { chosen, choose } = useIconChoices()
  const [menu, setMenu] = useState(false)

  const mine = useMemo(
    () => (data.suggestions ?? []).filter(
      (item: Suggestion) => item.person === null || item.person === draft.payer,
    ),
    [data.suggestions, draft.payer],
  )

  /**
   * The concepts on offer: the ones written down in the Sugerencias tab first,
   * then whatever the history threw up, deduplicated — and then filtered by
   * whatever has been typed so far.
   *
   * The field is the search box. There is no second input and no separate
   * state: the query and the concept are the same string, so tapping a match
   * simply finishes the word.
   */
  const conceptTiles = useMemo<ConceptTile[]>(() => {
    // The places are not in here: they are the cards above, and a concept
    // offered twice on one screen is two controls for one field.
    const seen = new Set<string>()
    const all: ConceptTile[] = []
    const add = (tile: ConceptTile) => {
      if (seen.has(tile.concept.toLowerCase())) return
      seen.add(tile.concept.toLowerCase())
      all.push(tile)
    }

    // The written-down ones first, then whatever the history threw up. Both
    // carry whatever icon was chosen for them, and `iconFor` guesses the rest.
    for (const item of mine.filter(item => item.kind === 'concept')) {
      add({ concept: item.text, icon: chosen[fold(item.text)] })
    }
    for (const chip of data.frequent) {
      add({ concept: chip.concept, icon: chosen[fold(chip.concept)] })
    }

    // Cut to the grid *after* the search, so typing reaches the seventh concept
    // rather than only reordering the six already on screen.
    return fuzzyFilter(all, draft.concept, tile => tile.concept).slice(0, TILES)
  }, [mine, data.frequent, draft.concept, chosen])

  /**
   * One row for the note, the payment methods first and then the suggested
   * observations. They share it because column `observaciones` holds a single
   * value: two rows feeding one field would be two controls contradicting each
   * other.
   */
  const notePills = useMemo<Pill[]>(() => {
    const rank = { method: 0, note: 1, concept: 2 }
    return mine
      .filter(item => item.kind === 'method' || item.kind === 'note')
      .sort((a, b) => rank[a.kind] - rank[b.kind])
      .map(item => ({ key: item.text, label: item.text, pinned: true }))
  }, [mine])

  /** Everything the menu can label: the two lists, and the places' concepts. */
  const known = useMemo(() => {
    const seen = new Set<string>()
    const all: string[] = []
    for (const concept of [
      ...nearby.map(place => place.concept),
      ...mine.filter(item => item.kind === 'concept').map(item => item.text),
      ...data.frequent.map(chip => chip.concept),
    ]) {
      const key = fold(concept)
      if (key && !seen.has(key)) { seen.add(key); all.push(concept) }
    }
    return all
  }, [nearby, mine, data.frequent])

  // One group, tight. The concept and the payment method are two halves of the
  // same question — what was this — and putting the spare height between them
  // made them look like separate screens stacked on one. What is left over sits
  // between the group and the button, which is exactly where the on-screen
  // keyboard appears.
  return (
    <>
      <div className="flex flex-col gap-2">
        {/* One tap for the pair. Tapping the same card again clears both, the
            way the chips clear the one field they own: a card that could only
            ever be turned on would need a third control to undo it. */}
        <PlaceCards
          places={nearby}
          concept={draft.concept}
          note={draft.note}
          onPick={place => patch(
            place.concept === draft.concept && place.note === draft.note
              ? { concept: '', note: '' }
              : { concept: place.concept, note: place.note },
          )}
        />

        {/* Sets the concept and nothing else. This used to set the payer too, so
            tapping a chip changed who was paying — silently, and over a choice
            just made. A suggestion may fill in the field it is a suggestion
            for, and no others. */}
        <div className="flex items-baseline gap-3">
          <p className="flex-1 text-xs font-semibold text-ink-2">{T.add.conceptRow}</p>
          {/* The way in to the icons, next to the icons. A preference nobody
              visits on purpose does not deserve a tab, and choosing an icon
              anywhere other than in front of the grid it changes is choosing
              blind. */}
          <button
            type="button"
            onClick={() => setMenu(true)}
            className="text-xs font-semibold focus-visible:outline focus-visible:outline-2"
            style={{ color: 'var(--accent)' }}
          >
            {T.icons.menu}
          </button>
        </div>

        <ConceptGrid
          items={conceptTiles}
          active={draft.concept}
          onPick={concept => patch({ concept })}
        />

        <input
          value={draft.concept}
          onChange={event => patch({ concept: event.target.value })}
          placeholder={T.add.conceptPlaceholder}
          aria-label={T.add.concept}
          enterKeyHint="done"
          autoComplete="off"
          className="rounded-lg border border-line bg-surface px-3 py-3 text-base text-ink
                     placeholder:text-ink-2 focus-visible:outline focus-visible:outline-2"
        />

        <div className="pt-1">
          <p className="pb-1 text-xs font-semibold text-ink-2">{T.add.noteRow}</p>
          <Pills
            items={notePills}
            active={draft.note}
            onPick={note => patch({ note })}
            label={T.add.noteRow}
          />
        </div>
      </div>

      {/* All of the slack, below all of the content. This is the same spacer
          that was wrong on the previous version of this screen and is right
          here: there it opened a hole between two things that belong together,
          and here it puts the empty space exactly where the on-screen keyboard
          appears when the field is tapped. */}
      <div className="flex-1" />

      {menu && (
        <IconMenu
          concepts={known}
          chosen={chosen}
          onChoose={choose}
          onClose={() => setMenu(false)}
        />
      )}

      <button
        type="button"
        onClick={onNext}
        className="rounded-xl py-3.5 text-base font-bold focus-visible:outline focus-visible:outline-2"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        {T.add.next}
      </button>
    </>
  )
}
