const EUR = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
})

export function formatEur(amount: number): string {
  return EUR.format(amount)
}

/**
 * Turns the keypad's digit string into euros.
 *
 * The keypad emits what was typed, not a number: '', '12', '12,5', '12,'. A
 * trailing separator is a state the user passes through on the way to the
 * cents, so it parses as the whole part rather than as NaN.
 */
export function parseAmount(typed: string): number {
  if (!typed) return 0
  const normalised = typed.replace(',', '.').replace(/\.$/, '')
  const value = Number(normalised)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0
}

/** What the amount looks like while it is being typed: never reformatted
 *  underfoot, only grouped, so the caret never jumps. */
export function displayTyped(typed: string): string {
  if (!typed) return '0'
  const [whole, cents] = typed.split(',')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return cents === undefined ? grouped : `${grouped},${cents}`
}

/**
 * The keypad string for an amount that came from somewhere else — a recurring
 * template's fixed price.
 *
 * The inverse of `parseAmount`, and it has to be, because everything downstream
 * of the keypad reads `typed` rather than a number: dropping 700 straight into
 * the draft as a number would show "0" on the screen and save nothing. Whole
 * euros keep no decimals, since "700" is what somebody would have typed.
 */
export function typedFromAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return ''
  const cents = Math.round(amount * 100)
  const whole = Math.floor(cents / 100)
  const rest = cents % 100
  return rest === 0 ? String(whole) : `${whole},${String(rest).padStart(2, '0')}`
}
