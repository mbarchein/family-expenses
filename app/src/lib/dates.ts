/** Dates cross the wire as yyyy-MM-dd, always in local time. Anything that
 *  touches UTC here would move an expense to the previous day for anyone who
 *  types it after 01:00 in summer. */
export function toIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayIso(): string {
  return toIso(new Date())
}

export function yesterdayIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toIso(d)
}

const DAY = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

export function formatDayHeading(iso: string): string {
  if (iso === todayIso()) return 'Hoy'
  if (iso === yesterdayIso()) return 'Ayer'
  const [y, m, d] = iso.split('-').map(Number)
  return DAY.format(new Date(y, m - 1, d))
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(y, m - 1, d))
}

/**
 * Short enough to be the label of a third of a row: "10 ago".
 *
 * The year appears only when it is not this one, which is the January case —
 * apuntando something from December — and the one time the day and month alone
 * would be a lie. `es-ES` abbreviates months with a trailing dot in some ICU
 * versions and without it in others; it is dropped either way so the button does
 * not change width depending on the browser.
 */
export function formatDayShort(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const options: Intl.DateTimeFormatOptions = y === new Date().getFullYear()
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: '2-digit' }
  return new Intl.DateTimeFormat('es-ES', options)
    .format(new Date(y, m - 1, d))
    .replace(/\./g, '')
}
