export interface Pill {
  key: string
  label: string
  /** Set on the pills that come out of the Sugerencias tab, so a curated entry
   *  reads differently from one the history happened to throw up. */
  pinned?: boolean
}

/**
 * One line of pills that scrolls sideways.
 *
 * Never wraps, and that is the whole point. These rows used to be `flex-wrap`,
 * which meant eight frequent concepts became three lines of chips and pushed
 * the keypad off the bottom of the screen. A row that can only ever be one line
 * tall is a row that cannot move anything else.
 *
 * Tapping the active pill clears it: both the concept and the note have exactly
 * one value, so there has to be a way back to none of them without reaching for
 * the text field.
 */
export function Pills({ items, active, onPick, label, size = 'md' }: {
  items: Pill[]
  active: string
  onPick: (key: string) => void
  label: string
  /** `lg` for the row that is the main way through a screen — a thumb aiming at
   *  a concept deserves more than a 13px pill. */
  size?: 'md' | 'lg'
}) {
  if (!items.length) return null
  return (
    <div
      role="group"
      aria-label={label}
      className="-mx-4 flex snap-x gap-1.5 overflow-x-auto px-4 py-0.5
                 [-ms-overflow-style:none] [scrollbar-width:none]
                 [&::-webkit-scrollbar]:hidden"
    >
      {items.map(item => {
        const on = item.key === active
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onPick(on ? '' : item.key)}
            aria-pressed={on}
            className={'shrink-0 snap-start whitespace-nowrap rounded-full border' +
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
