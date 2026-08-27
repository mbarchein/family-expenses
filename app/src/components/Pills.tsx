export interface Pill {
  key: string
  label: string
  /** Set on the pills that come out of the Sugerencias tab, so a curated entry
   *  reads differently from one the history happened to throw up. */
  pinned?: boolean
}

/**
 * Pills: one line that scrolls sideways, or as many lines as they need.
 *
 * Scrolling is the default and it used to be the only option, for a reason worth
 * keeping: these rows were `flex-wrap` once, eight frequent concepts became three
 * lines of chips, and the keypad went off the bottom of the screen. A row that
 * can only ever be one line tall is a row that cannot move anything else.
 *
 * `wrap` is the exception, and the payment methods asked for it. What made the
 * concepts dangerous does not apply to them: the concepts are a grid of their own
 * now, and the methods are a handful of short words off the Sugerencias tab — a
 * list of four cards that a sideways scroll hides half of is worse than a list of
 * four cards on two lines. It stays opt-in rather than becoming the default,
 * because the row that regrets it will be one nobody thought about.
 *
 * Tapping the active pill clears it: both the concept and the note have exactly
 * one value, so there has to be a way back to none of them without reaching for
 * the text field.
 */
export function Pills({ items, active, onPick, label, size = 'md', wrap = false }: {
  items: Pill[]
  active: string
  onPick: (key: string) => void
  label: string
  /** `lg` for the row that is the main way through a screen — a thumb aiming at
   *  a concept deserves more than a 13px pill. */
  size?: 'md' | 'lg'
  /** Let them take a second line instead of scrolling out of sight. Only for a
   *  short list of short labels — see above. */
  wrap?: boolean
}) {
  if (!items.length) return null
  return (
    <div
      role="group"
      aria-label={label}
      className={'flex gap-1.5 py-0.5' + (wrap
        ? ' flex-wrap'
        // The negative margin is what lets a scrolling row bleed to both edges of
        // the screen, so a pill half off the right edge reads as "there is more"
        // rather than as a margin. A wrapped row has no edge to bleed to.
        : ' -mx-4 snap-x overflow-x-auto px-4 [-ms-overflow-style:none]' +
          ' [scrollbar-width:none] [&::-webkit-scrollbar]:hidden')}
    >
      {items.map(item => {
        const on = item.key === active
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onPick(on ? '' : item.key)}
            aria-pressed={on}
            className={'shrink-0 whitespace-nowrap rounded-full border'
              + (wrap ? '' : ' snap-start') +
              ' focus-visible:outline focus-visible:outline-2' +
              (size === 'lg' ? ' px-4 py-2.5 text-[15px]' : ' px-3 py-1.5 text-[13px]')}
            style={on
              ? {
                  background: 'var(--accent)',
                  color: 'var(--accent-ink)',
                  borderColor: 'var(--accent)',
                  fontWeight: 600,
                }
              : {
                  background: 'var(--surface)',
                  color: item.pinned ? 'var(--ink)' : 'var(--ink-2)',
                  borderColor: 'var(--line)',
                }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
