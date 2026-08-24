import { T } from '../i18n/strings'

export type Tab = 'add' | 'list' | 'balance' | 'places'

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const tabs: Tab[] = ['add', 'list', 'balance', 'places']
  return (
    <nav className="flex border-t border-line bg-surface" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map(name => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          aria-current={tab === name ? 'page' : undefined}
          className="flex-1 py-3 text-xs font-semibold focus-visible:outline focus-visible:outline-2"
          style={{ color: tab === name ? 'var(--accent)' : 'var(--ink-3)' }}
        >
          {T.tabs[name]}
        </button>
      ))}
    </nav>
  )
}
