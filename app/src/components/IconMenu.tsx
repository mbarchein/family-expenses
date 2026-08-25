import { useState } from 'react'
import { Avatar, AVATAR_NAMES, type AvatarName } from './Avatar'
import { Icon, ICON_NAMES } from './Icon'
import { T } from '../i18n/strings'
import { fold, iconFor, initialOf } from '../lib/icons'

/**
 * Give a concept an icon.
 *
 * Two lists, one on top of the other: the concepts, and then the icons once one
 * is picked. A sheet rather than a screen because it is opened from the tiles it
 * changes and closed straight back to them — a preference nobody visits on
 * purpose does not deserve a tab, and choosing an icon while looking at the grid
 * it belongs to is the only way to tell whether the choice was any good.
 *
 * Every concept on offer is listed, guessed icons included, and the row shows
 * what the tile shows now. So the list doubles as the answer to "why has that
 * got a basket on it" — the guess is visible, and one tap overrides it.
 */
export function IconMenu({ concepts, chosen, onChoose, onClose, people, faces, onFace }: {
  concepts: string[]
  chosen: Record<string, string>
  onChoose: (concept: string, icon: string | null) => void
  onClose: () => void
  /** The two names, for the rows that choose their faces. */
  people: readonly [string, string]
  faces: readonly [AvatarName, AvatarName]
  onFace: (person: 0 | 1, face: AvatarName) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [whose, setWhose] = useState<0 | 1 | null>(null)

  const heading = editing ? T.icons.pick(editing)
    : whose !== null ? T.icons.face(people[whose])
    : T.icons.title

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col"
      style={{ background: 'var(--paper)' }}
      role="dialog"
      aria-label={heading}
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <p className="flex-1 text-sm font-semibold">{heading}</p>
        <button
          type="button"
          onClick={() => {
            if (editing) return setEditing(null)
            if (whose !== null) return setWhose(null)
            onClose()
          }}
          className="text-sm font-semibold focus-visible:outline focus-visible:outline-2"
          style={{ color: 'var(--accent)' }}
        >
          {editing || whose !== null ? T.icons.back : T.icons.close}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {whose !== null ? (
          <Faces
            current={faces[whose]}
            onPick={face => { onFace(whose, face); setWhose(null) }}
          />
        ) : editing ? (
          <Choices
            current={chosen[fold(editing)]}
            onPick={name => { onChoose(editing, name); setEditing(null) }}
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {/* The two people first, above their concepts: this list is long and
                the faces are two rows that somebody comes here on purpose to
                find. */}
            <li>
              <p className="pb-1 pt-1 text-xs font-semibold text-ink-2">{T.icons.people}</p>
            </li>
            {([0, 1] as const).map(person => (
              <li key={person}>
                <button
                  type="button"
                  onClick={() => setWhose(person)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5
                             text-left focus-visible:outline focus-visible:outline-2"
                  style={{ background: 'var(--surface)' }}
                >
                  <Avatar
                    name={faces[person]}
                    className="h-6 w-6 shrink-0"
                  />
                  <span className="flex-1 truncate text-sm font-semibold">{people[person]}</span>
                  <span className="text-[11px] text-ink-3">
                    {T.icons.paintings[faces[person]] ?? faces[person]}
                  </span>
                </button>
              </li>
            ))}
            <li>
              <p className="pb-1 pt-3 text-xs font-semibold text-ink-2">{T.icons.title}</p>
            </li>
            {concepts.map(concept => (
              <li key={concept}>
                <button
                  type="button"
                  onClick={() => setEditing(concept)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5
                             text-left focus-visible:outline focus-visible:outline-2"
                  style={{ background: 'var(--surface)' }}
                >
                  <Glyph concept={concept} chosen={chosen[fold(concept)]} />
                  <span className="flex-1 truncate text-sm font-semibold">{concept}</span>
                  {/* Says where the icon came from, because a guess and a choice
                      look identical on the tile and only one of them is yours. */}
                  <span className="text-[11px] text-ink-3">
                    {chosen[fold(concept)] ? T.icons.mine : T.icons.guessed}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** The whole set, plus the way back to no icon at all. */
function Choices({ current, onPick }: {
  current?: string
  onPick: (name: string | null) => void
}) {
  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {ICON_NAMES.map(name => (
          <button
            key={name}
            type="button"
            onClick={() => onPick(name)}
            aria-label={name}
            aria-pressed={name === current}
            className="grid aspect-square place-items-center rounded-xl border
                       focus-visible:outline focus-visible:outline-2"
            style={name === current
              ? { background: 'var(--accent)', color: 'var(--accent-ink)', borderColor: 'var(--accent)' }
              : { background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--line)' }}
          >
            <Icon name={name} className="h-7 w-7" />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onPick(null)}
        className="mt-4 w-full rounded-xl border border-line py-2.5 text-sm font-semibold
                   focus-visible:outline focus-visible:outline-2"
        style={{ color: 'var(--ink-2)' }}
      >
        {T.icons.none}
      </button>
    </>
  )
}

/** The eight portraits, named. Two columns rather than four: the name under
 *  each is what makes it a choice rather than a guessing game, and the drawing
 *  is bigger than the button it will end up on so that what is being chosen is
 *  visible while choosing it. */
function Faces({ current, onPick }: {
  current: AvatarName
  onPick: (name: AvatarName) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {AVATAR_NAMES.map(name => (
        <button
          key={name}
          type="button"
          onClick={() => onPick(name)}
          aria-label={T.icons.paintings[name] ?? name}
          aria-pressed={name === current}
          className="flex items-center gap-2 rounded-xl border px-3 py-2.5
                     focus-visible:outline focus-visible:outline-2"
          style={name === current
            ? { background: 'var(--accent)', color: 'var(--accent-ink)', borderColor: 'var(--accent)' }
            : { background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--line)' }}
        >
          <Avatar name={name} className="h-8 w-8 shrink-0" />
          <span className="min-w-0 truncate text-left text-xs font-semibold">
            {T.icons.paintings[name] ?? name}
          </span>
        </button>
      ))}
    </div>
  )
}

/** What the tile would show for this concept right now. */
function Glyph({ concept, chosen }: { concept: string; chosen?: string }) {
  const name = iconFor(concept, chosen)
  if (name) return <Icon name={name} className="h-6 w-6 shrink-0" />
  return (
    <span
      aria-hidden="true"
      className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
      style={{ background: 'var(--surface-2)', color: 'var(--ink-2)' }}
    >
      {initialOf(concept)}
    </span>
  )
}
