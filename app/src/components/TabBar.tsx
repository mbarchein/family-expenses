import type { ReactNode } from 'react'
import { T } from '../i18n/strings'
import type { Route } from '../lib/route'

export type Tab = Route

/**
 * The five screens, as icons with their names under them.
 *
 * Words alone made every tab the same shape, so the row had to be read rather
 * than aimed at — and the one this app is opened for, the keypad, was a word in
 * a line of words. A drawn glyph is found by shape and by position, which is
 * how a bar like this is used: with a thumb, without looking.
 *
 * The icons are here rather than in `components/Icon.tsx` on purpose. That set
 * is the vocabulary offered for concepts, and everything in it appears in the
 * picker on the second step; navigation glyphs in that list would be five things
 * to scroll past that nobody would ever choose for a gasto.
 */
export function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const tabs: Tab[] = ['add', 'list', 'balance', 'places', 'fixed']
  return (
    <nav
      className="flex border-t border-line bg-surface"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map(name => {
        const on = tab === name
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            aria-current={on ? 'page' : undefined}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 py-2
                       focus-visible:outline focus-visible:outline-2"
            style={{ color: on ? 'var(--accent)' : 'var(--ink-3)' }}
          >
            <TabIcon name={name} active={on} />
            <span className="w-full truncate text-center text-[11px] font-semibold">
              {T.tabs[name]}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

/** Stroked at 1.75, except the one that is on: a slightly heavier line is what
 *  makes the current tab readable in a glance without a second colour. */
function TabIcon({ name, active }: { name: Tab; active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"
         className="h-6 w-6" fill="none" stroke="currentColor"
         strokeWidth={active ? 2.25 : 1.75} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name]}
    </svg>
  )
}

const PATHS: Record<Tab, ReactNode> = {
  // A plus in a rounded square: adding, and the shape of the key it lands on.
  add: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 8v8M8 12h8" /></>,
  // Lines of a list, longest first, the way the day rows look from far enough
  // away to be an icon.
  list: <path d="M4 7h16M4 12h12M4 17h8" />,
  // A balance: the beam, the post, and the two pans it is named after.
  balance: <><path d="M12 4v16M5 20h14M4 8h16" /><path d="M4 8l-2 5a3 3 0 0 0 6 0zM20 8l2 5a3 3 0 0 1-6 0z" /></>,
  // A pin, not a globe: this is where something was, not where the world is.
  places: <><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  // A calendar with a day marked: something that comes round again.
  fixed: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /><circle cx="12" cy="15" r="1.6" /></>,
}
