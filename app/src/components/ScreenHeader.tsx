import type { ReactNode } from 'react'
import { T } from '../i18n/strings'

/**
 * The top of every screen that is not the keypad: a way back, and its name.
 *
 * Each of these screens has its own address now, so each of them can be the
 * first thing a reload or a shared link opens — and a screen that can be arrived
 * at directly needs a way out that does not depend on having come from
 * somewhere. `back` handles that; the arrow is always here.
 */
export function ScreenHeader({ title, onBack, children }: {
  title: string
  onBack: () => void
  children?: ReactNode
}) {
  return (
    <header className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label={T.add.back}
        className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                   focus-visible:outline focus-visible:outline-2"
        style={{ color: 'var(--accent)' }}
      >
        <BackIcon />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>
      {children}
    </header>
  )
}

/** A drawn chevron, not the `←` character. The glyph is a font's opinion: it
 *  arrives at a different weight and a different vertical offset on every
 *  device, and on Android it sat visibly above the text beside it. */
export function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"
         className="h-6 w-6" fill="none" stroke="currentColor"
         strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}
