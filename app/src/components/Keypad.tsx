const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫']

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
    if (key === '⌫') return onChange(value.slice(0, -1))
    if (key === ',') return value.includes(',') ? undefined : onChange((value || '0') + ',')
    // Two decimals and no more: there is no third cent.
    const [, cents] = value.split(',')
    if (cents !== undefined && cents.length >= 2) return
    if (value === '0') return onChange(key)
    onChange(value + key)
  }

  return (
    <div className="grid h-full grid-cols-3 grid-rows-4 gap-1.5">
      {KEYS.map(key => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          aria-label={key === '⌫' ? 'Borrar' : key}
          className="rounded-xl border border-line bg-surface font-mono text-2xl font-medium
                     text-ink active:opacity-70 focus-visible:outline focus-visible:outline-2"
        >
          {key}
        </button>
      ))}
    </div>
  )
}
