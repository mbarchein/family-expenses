/** The key that deletes, as the button draws it. Named because it now arrives
 *  from two places: a tap on the grid, and Backspace on a real keyboard. */
export const BACKSPACE = '⌫'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', BACKSPACE]

/**
 * One keystroke against a typed amount, as a value rather than an effect.
 *
 * Pulled out of the component because the grid of buttons stopped being the only
 * way in: on a desktop, or with a keyboard paired to the phone, the number keys
 * have to reach the same rules. Two implementations of "two decimals and no
 * more" would drift, and the one that drifted would be the one nobody tested.
 *
 * Returns the value unchanged for a keystroke that does nothing, which is how
 * the caller knows not to repaint.
 */
export function pressKey(value: string, key: string): string {
  if (key === BACKSPACE) return value.slice(0, -1)
  if (key === ',') return value.includes(',') ? value : `${value || '0'},`
  // Two decimals and no more: there is no third cent.
  const [, cents] = value.split(',')
  if (cents !== undefined && cents.length >= 2) return value
  if (value === '0') return key
  return value + key
}

/**
 * Appends to a string rather than editing a number.
 *
 * Typing 12,50 passes through '12,' and '12,5', neither of which is a number
 * worth storing. Keeping the raw keystrokes means nothing is reformatted under
 * the user's fingers and the cents never disappear halfway through.
 */
export function Keypad({ value, onChange }: {
  value: string
  onChange: (value: string) => void
}) {
  function press(key: string) {
    const next = pressKey(value, key)
    if (next !== value) onChange(next)
  }

  return (
    <div className="grid grid-cols-3 gap-1.5">
      {KEYS.map(key => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          aria-label={key === BACKSPACE ? 'Borrar' : key}
          className="rounded-xl border border-line bg-surface py-3 font-mono text-2xl
                     font-medium text-ink active:opacity-70
                     focus-visible:outline focus-visible:outline-2"
        >
          {key}
        </button>
      ))}
    </div>
  )
}
