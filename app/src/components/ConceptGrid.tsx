import { Icon } from './Icon'
import { T } from '../i18n/strings'
import { iconFor, initialOf } from '../lib/icons'

export interface ConceptTile {
  concept: string
  /** The icon chosen for it in the icon menu, if there is one. Beats the guess. */
  icon?: string
}

/**
 * The concepts, as a grid of tiles that does not scroll.
 *
 * Six of them, two by three. That number is the design: the row of chips this
 * replaces held eight or ten and scrolled sideways, which meant the ones past
 * the third were invisible until somebody thought to swipe — a fast path that
 * has to be discovered is not a fast path. Six is what fits at a size a thumb
 * hits without aiming, and the field below reaches everything else.
 *
 * Rectangular rather than pill-shaped because a rectangle can hold two things:
 * an icon and a label on one line, at a readable size. And an icon is what makes
 * six of these legible at a glance instead of six lines of text to read.
 *
 * Where there is no icon the tile shows the concept's initial. A guess that
 * misses is worse than no guess — a basket on the electricity bill is a small
 * lie printed on the fast path — so `iconFor` returns nothing rather than
 * something approximate, and the menu behind the "Iconos" button is how a guess
 * gets corrected. See `lib/icons.ts`.
 */
export function ConceptGrid({ items, active, onPick }: {
  items: ConceptTile[]
  active: string
  onPick: (concept: string) => void
}) {
  if (!items.length) return null

  return (
    <div role="group" aria-label={T.add.conceptRow} className="grid grid-cols-2 gap-2">
      {items.map(item => {
        const on = item.concept === active
        const icon = iconFor(item.concept, item.icon)
        return (
          <button
            key={item.concept}
            type="button"
            // Always sets, never clears.
            //
            // It used to toggle, the way the pills do. Reported: type a concept
            // that is also one of these tiles, then tap the tile to confirm it,
            // and the concept disappears — because typing it had already lit the
            // tile, so the tap that means "yes, this one" was the tap that undoes
            // it. The pills keep their toggle because for the medio de pago it is
            // the only way back to none; this field has a cross of its own inside
            // it, which is where a hand looks for that anyway.
            onClick={() => onPick(item.concept)}
            aria-pressed={on}
            className="flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left
                       focus-visible:outline focus-visible:outline-2"
            style={on
              ? {
                  background: 'var(--accent)',
                  color: 'var(--accent-ink)',
                  borderColor: 'var(--accent)',
                }
              : { background: 'var(--surface)', color: 'var(--ink)', borderColor: 'var(--line)' }}
          >
            {icon ? (
              <Icon name={icon} className="h-6 w-6 shrink-0" />
            ) : (
              <span
                aria-hidden="true"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full
                           text-sm font-bold"
                style={on
                  ? { background: 'var(--accent-ink)', color: 'var(--accent)' }
                  : { background: 'var(--surface-2)', color: 'var(--ink-2)' }}
              >
                {initialOf(item.concept)}
              </span>
            )}
            <span className="truncate text-[15px] font-semibold leading-tight">
              {item.concept}
            </span>
          </button>
        )
      })}
    </div>
  )
}
