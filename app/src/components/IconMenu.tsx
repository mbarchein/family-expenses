import { useMemo, useState } from 'react'
import { Avatar, AVATAR_NAMES, type AvatarName } from './Avatar'
import { Icon, ICON_NAMES } from './Icon'
import { T } from '../i18n/strings'
import { formatEur } from '../lib/money'
import type { Category, Entry } from '../api/types'
import { alsoWearing, iconOfCategory } from '../lib/categories'
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
export function IconMenu({
  concepts, chosen, onChoose, onClose, people, faces, onFace,
  categories, entries, onSaveCategory, onDeleteCategory,
}: {
  concepts: string[]
  chosen: Record<string, string>
  onChoose: (concept: string, icon: string | null) => void
  onClose: () => void
  /** The two names, for the rows that choose their faces. */
  people: readonly [string, string]
  faces: readonly [AvatarName, AvatarName]
  onFace: (person: 0 | 1, face: AvatarName) => void
  /** The Categorías tab, editable from here. The tab itself is for a laptop;
   *  this is the same thing for a phone. */
  categories: readonly Category[]
  /** What is on screen, so the shared-icon warning can show real rows from the
   *  category that already wears the icon rather than only its name. */
  entries: readonly Entry[]
  onSaveCategory: (category: { name: string; icon: string; words: string[]; was?: string })
    => Promise<void>
  onDeleteCategory: (name: string) => Promise<void>
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [whose, setWhose] = useState<0 | 1 | null>(null)
  /** The category being edited: a name for an existing one, `''` for a new one,
   *  null for neither. `''` and null have to be different things — one is a form
   *  waiting to be filled in and the other is no form at all. */
  const [category, setCategory] = useState<string | null>(null)

  const heading = editing ? T.icons.pick(editing)
    : whose !== null ? T.icons.face(people[whose])
    : category !== null ? (category ? T.categories.edit(category) : T.categories.add)
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
            if (category !== null) return setCategory(null)
            onClose()
          }}
          className="text-sm font-semibold focus-visible:outline focus-visible:outline-2"
          style={{ color: 'var(--accent)' }}
        >
          {editing || whose !== null || category !== null ? T.icons.back : T.icons.close}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {category !== null ? (
          <CategoryEditor
            key={category}
            current={categories.find(one => fold(one.name) === fold(category))}
            categories={categories}
            entries={entries}
            onSave={async next => { await onSaveCategory(next); setCategory(null) }}
            onRemove={async name => { await onDeleteCategory(name); setCategory(null) }}
          />
        ) : whose !== null ? (
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
              <p className="pb-1 pt-3 text-xs font-semibold text-ink-2">{T.categories.title}</p>
            </li>
            {categories.map(one => (
              <li key={one.name}>
                <button
                  type="button"
                  onClick={() => setCategory(one.name)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5
                             text-left focus-visible:outline focus-visible:outline-2"
                  style={{ background: 'var(--surface)' }}
                >
                  <CategoryGlyph icon={one.icon} />
                  <span className="flex-1 truncate text-sm font-semibold">{one.name}</span>
                  {/* The words, because they are the half of a category nobody
                      can see from the outside — and the half that decides where
                      an expense lands. */}
                  <span className="max-w-[45%] truncate text-[11px] text-ink-3">
                    {one.words.join(', ')}
                  </span>
                </button>
              </li>
            ))}
            {!categories.length && (
              <li className="py-2 text-center text-[11px] text-ink-3">{T.categories.noneYet}</li>
            )}
            <li>
              <button
                type="button"
                onClick={() => setCategory('')}
                className="w-full rounded-xl border border-dashed border-line py-2.5 text-sm
                           font-semibold focus-visible:outline focus-visible:outline-2"
                style={{ color: 'var(--accent)' }}
              >
                {T.categories.add}
              </button>
            </li>

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

/**
 * The whole set, plus the way back to no icon at all.
 *
 * Each icon says which categories already wear it. Without that, choosing one is
 * choosing blind: two categories sharing a shape is allowed and sometimes right,
 * and the only way to decide is to know it is about to happen.
 */
function Choices({ current, categories = [], onPick }: {
  current?: string
  categories?: readonly Category[]
  onPick: (name: string | null) => void
}) {
  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {ICON_NAMES.map(name => {
          const wearers = categories
            .filter(one => one.icon === name)
            .map(one => one.name)
          return (
            <button
              key={name}
              type="button"
              onClick={() => onPick(name)}
              aria-label={wearers.length ? `${name} · ${wearers.join(', ')}` : name}
              aria-pressed={name === current}
              className="flex flex-col items-center justify-center gap-0.5 rounded-xl border py-2
                         focus-visible:outline focus-visible:outline-2"
              style={name === current
                ? { background: 'var(--accent)', color: 'var(--accent-ink)', borderColor: 'var(--accent)' }
                : { background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--line)' }}
            >
              <Icon name={name} className="h-7 w-7" />
              {wearers.length > 0 && (
                <span className="w-full truncate px-1 text-[9px] leading-tight opacity-70">
                  {wearers.join(', ')}
                </span>
              )}
            </button>
          )
        })}
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

/** A category's icon, or a tag when the tab names one this app cannot draw. */
function CategoryGlyph({ icon }: { icon: string }) {
  const drawn = iconOfCategory('x', [{ name: 'x', icon, words: [] }])
  return (
    <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center text-ink-2">
      {drawn ? <Icon name={drawn} className="h-6 w-6" /> : <span className="text-xs">·</span>}
    </span>
  )
}

/**
 * One category: its name, its icon and the words that guess it.
 *
 * The words are the half nobody can see from outside and the half that decides
 * where an expense lands, so they are a plain box with the `=algo` rule spelled
 * out under it rather than something clever.
 *
 * Picking an icon another category already wears is allowed and is sometimes
 * right. What is not allowed is doing it by accident, so it asks — with the other
 * category's name and its last few expenses, which is what makes the question
 * answerable rather than rhetorical.
 */
function CategoryEditor({ current, categories, entries, onSave, onRemove }: {
  current?: Category
  categories: readonly Category[]
  entries: readonly Entry[]
  onSave: (category: { name: string; icon: string; words: string[]; was?: string })
    => Promise<void>
  onRemove: (name: string) => Promise<void>
}) {
  const [name, setName] = useState(current?.name ?? '')
  const [icon, setIcon] = useState(current?.icon ?? '')
  const [words, setWords] = useState((current?.words ?? []).join(', '))
  const [picking, setPicking] = useState(false)
  /** An icon chosen but not yet accepted, while the sharing question is open. */
  const [asking, setAsking] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const shared = useMemo(
    () => (asking ? alsoWearing(asking, categories, name) : []),
    [asking, categories, name])
  const recent = useMemo(() => entries
    .filter(entry => shared.some(one => fold(one) === fold(entry.category)))
    .slice(0, 4), [entries, shared])

  function choose(next: string | null) {
    setPicking(false)
    if (next === null) return setIcon('')
    const others = alsoWearing(next, categories, name)
    if (others.length) return setAsking(next)
    setIcon(next)
  }

  async function save() {
    const trimmed = name.trim()
    if (!trimmed) return setProblem(T.categories.needName)
    setProblem(null)
    setBusy(true)
    try {
      await onSave({
        name: trimmed,
        icon,
        words: words.split(',').map(word => word.trim()).filter(Boolean),
        was: current?.name,
      })
    } catch {
      setBusy(false)
      setProblem(T.categories.failed)
    }
  }

  async function remove() {
    if (!current || !window.confirm(T.categories.removeConfirm(current.name))) return
    setBusy(true)
    await onRemove(current.name).catch(() => {
      setBusy(false)
      setProblem(T.categories.failed)
    })
  }

  if (asking) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm font-semibold">{T.categories.shared(shared.join(', '))}</p>
        <p className="text-xs text-ink-2">{T.categories.sharedWhy}</p>

        <p className="pt-1 text-xs font-semibold text-ink-2">{T.categories.sharedRecent}</p>
        {recent.length ? (
          <ul className="flex flex-col gap-1">
            {recent.map(entry => (
              <li key={entry.id || entry.row} className="flex gap-2 text-[11px] text-ink-2">
                <span className="min-w-0 flex-1 truncate">{entry.concept}</span>
                <span className="tabular shrink-0 font-mono">{formatEur(entry.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-ink-3">{T.categories.sharedNoRows}</p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => { setAsking(null); setPicking(true) }}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold
                       focus-visible:outline focus-visible:outline-2"
            style={{ color: 'var(--ink-2)' }}
          >
            {T.categories.pickAnother}
          </button>
          <button
            type="button"
            onClick={() => { setIcon(asking); setAsking(null) }}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold
                       focus-visible:outline focus-visible:outline-2"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            {T.categories.useAnyway}
          </button>
        </div>
      </div>
    )
  }

  if (picking) return <Choices current={icon} categories={categories} onPick={choose} />

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-ink-2">{T.categories.name}</span>
        <input
          value={name}
          onChange={event => setName(event.target.value)}
          aria-label={T.categories.name}
          className="rounded-lg border border-line bg-surface px-3 py-2.5 text-base"
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-ink-2">{T.categories.icon}</span>
        <button
          type="button"
          onClick={() => setPicking(true)}
          aria-label={T.categories.icon}
          className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5
                     text-left text-sm focus-visible:outline focus-visible:outline-2"
        >
          <CategoryGlyph icon={icon} />
          <span className="flex-1 truncate">{icon || T.icons.none}</span>
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-ink-2">{T.categories.words}</span>
        <input
          value={words}
          onChange={event => setWords(event.target.value)}
          aria-label={T.categories.words}
          className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm"
        />
        <span className="text-[11px] text-ink-3">{T.categories.wordsHelp}</span>
      </label>

      {problem && (
        <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>{problem}</p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="rounded-xl py-3 text-sm font-bold disabled:opacity-40
                   focus-visible:outline focus-visible:outline-2"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        {T.categories.save}
      </button>

      {current && (
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-xl border py-2.5 text-sm font-semibold disabled:opacity-40
                     focus-visible:outline focus-visible:outline-2"
          style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
        >
          {T.categories.remove}
        </button>
      )}
    </div>
  )
}
