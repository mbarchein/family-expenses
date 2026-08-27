import { Icon } from './Icon'
import { T } from '../i18n/strings'
import { iconFor, initialOf } from '../lib/icons'

export interface ConceptTile {
  concept: string
  /** The icon chosen for it in the icon menu, if there is one. Beats the guess. */
  icon?: string
  /**
   * Written down by hand in the Sugerencias tab, rather than found in the
   * history.
   *
   * Worth a mark on the tile because it is the answer to "why is *that* one
   * here": these come first on this screen, in the order they are written in the
   * tab and before anything the ranking has to say, so a tile that looks
   * inexplicably high is usually one somebody chose to put there.
   */
  pinned?: boolean
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
/**
 * A filled star, on the tiles that were written down by hand.
 *
 * Filled rather than outlined, and small: it has to be recognisable at 16 pixels
 * beside a word, and an outline at that size is a smudge. In the accent colour at
 * full strength, because it was asked for as something you can see — the first
 * version was a grey star at 40% and it read as a smudge from arm's length. On a
 * lit tile it takes the text's colour instead, which is the one case where the
 * accent would be the tile's own background.
 *
 * `aria-hidden`, with the button's name saying it instead: a screen reader
 * announcing "star" after the concept is reading out a shape, while "favorito" is
 * what the shape means.
 */
function StarIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"
         className="h-4 w-4 shrink-0"
         style={{ color: on ? 'currentColor' : 'var(--accent)' }}
         fill="currentColor">
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3-5.8 3 1.1-6.4L2.6 9.4l6.5-.9z" />
    </svg>
  )
}

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
            // The star is a shape; this is what it means. Read out after the
            // concept, so the tile still announces itself first.
            aria-label={item.pinned ? T.add.pinned(item.concept) : undefined}
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
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-tight">
              {item.concept}
            </span>
            {item.pinned && <StarIcon on={on} />}
          </button>
        )
      })}
    </div>
  )
}
