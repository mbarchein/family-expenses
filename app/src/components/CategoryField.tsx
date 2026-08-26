import { useMemo, useState } from 'react'
import { Icon } from './Icon'
import { T } from '../i18n/strings'
import { iconOfCategory } from '../lib/categories'
import { useBackClose } from '../lib/route'
import { fold } from '../lib/icons'
import type { Category } from '../api/types'

/**
 * The category on an expense: one button that says which, and a list to change it.
 *
 * A button and not a row of chips, because there are thirty categories on that
 * tab and a horizontal scroll of thirty things is a fast path nobody finds. The
 * button matters more than the list anyway — the category is guessed from the
 * concept, so most of the time the answer is already right and the only job here
 * is to show what was guessed, so that a wrong guess is visible before it is
 * saved rather than after.
 *
 * "Sin categoría" is a real answer and stays reachable. A concept nothing could
 * place is a question still open, and a category chosen at random to close it is
 * worse than the question.
 */
export function CategoryField({ value, categories, onChange }: {
  value: string
  categories: readonly Category[]
  onChange: (category: string) => void
}) {
  const [open, setOpen] = useState(false)
  const icon = iconOfCategory(value, categories)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={T.category.pick}
        className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5
                   text-left text-sm focus-visible:outline focus-visible:outline-2"
      >
        {icon
          ? <Icon name={icon} className="h-5 w-5 shrink-0" />
          : <TagIcon />}
        <span className={'min-w-0 flex-1 truncate' + (value ? '' : ' text-ink-3')}>
          {value || T.category.none}
        </span>
        <ChevronIcon />
      </button>

      {open && (
        <CategorySheet
          current={value}
          categories={categories}
          onPick={name => { onChange(name); setOpen(false) }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/**
 * The list, as a sheet over the screen it was opened from.
 *
 * With a search box, because thirty rows is more than fits and scrolling past
 * twenty-nine of them to reach one is not how anybody finds a word they already
 * know. The rows carry their icons: this list is also the only place the icon of
 * a category can be seen next to its name, which is what makes a shared icon
 * noticeable.
 */
function CategorySheet({ current, categories, onPick, onClose }: {
  current: string
  categories: readonly Category[]
  onPick: (name: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  // Back closes the list and leaves the form underneath exactly as it was.
  useBackClose(true, onClose)

  const shown = useMemo(() => {
    const needle = fold(query)
    if (!needle) return categories
    return categories.filter(category => fold(category.name).includes(needle))
  }, [categories, query])

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col"
      style={{ background: 'var(--paper)' }}
      role="dialog"
      aria-label={T.category.pick}
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <p className="flex-1 text-sm font-semibold">{T.category.pick}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold focus-visible:outline focus-visible:outline-2"
          style={{ color: 'var(--accent)' }}
        >
          {T.category.close}
        </button>
      </header>

      <div className="p-4 pb-2">
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={T.category.search}
          aria-label={T.category.search}
          type="search"
          autoFocus
          className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm
                     placeholder:text-ink-3 focus-visible:outline focus-visible:outline-2"
        />
      </div>

      <ul className="flex-1 overflow-y-auto px-4 pb-4">
        <Row
          label={T.category.none}
          on={!current}
          onPick={() => onPick('')}
        />
        {shown.map(category => (
          <Row
            key={category.name}
            label={category.name}
            icon={category.icon}
            on={fold(category.name) === fold(current)}
            onPick={() => onPick(category.name)}
          />
        ))}
        {!categories.length && (
          <li className="py-6 text-center text-sm text-ink-3">{T.category.empty}</li>
        )}
      </ul>
    </div>
  )
}

function Row({ label, icon, on, onPick }: {
  label: string
  icon?: string
  on: boolean
  onPick: () => void
}) {
  const drawn = icon && iconOfCategory(label, [{ name: label, icon, words: [] }])
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={on}
        className="flex w-full items-center gap-3 border-b border-line py-2.5 text-left text-sm
                   focus-visible:outline focus-visible:outline-2"
        style={on ? { color: 'var(--accent)', fontWeight: 600 } : undefined}
      >
        {drawn ? <Icon name={drawn} className="h-5 w-5 shrink-0" /> : <TagIcon />}
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
    </li>
  )
}

/** A label on a string, for the category that has none and for one whose icon
 *  this app cannot draw. Local to this file: it is not part of the concept
 *  vocabulary in `Icon.tsx`, it is furniture. */
function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-5 w-5 shrink-0"
         fill="none" stroke="currentColor" strokeWidth={1.75}
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5V5h7.5l8 8-6.5 6.5-8-8Z" />
      <circle cx="8" cy="9" r="1.2" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"
         className="h-4 w-4 shrink-0 text-ink-3"
         fill="none" stroke="currentColor" strokeWidth={2.5}
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10l5 5 5-5" />
    </svg>
  )
}
