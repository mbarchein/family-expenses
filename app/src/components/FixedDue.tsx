import { T } from '../i18n/strings'
import { formatShortDate } from '../lib/dates'
import { formatEur } from '../lib/money'
import type { Due } from '../lib/fixed'

/**
 * What the recurring templates owe, in a sheet.
 *
 * A banner on the first step and a sheet behind it, rather than the list itself
 * on the screen. This step has the keypad, the amount, the payer and the day on
 * it already, and a list that grows with what is due would push the keypad off
 * the bottom — the mistake this screen has now made in four different ways. One
 * line that says how many, and the detail a tap away.
 *
 * **They propose, they do not post.** Confirming loads the expense into the
 * three-step flow at the review step, which is the same screen a hand-typed
 * expense passes through and the same save. Some rows in this ledger are pasted
 * from a bank statement, so an app that posted these by itself would duplicate
 * the rent — and a row can only be voided, never removed.
 */
export function FixedDue({ due, warn, onConfirm, onSkip, onClose }: {
  due: Due[]
  /** Whether this period looks like it is already in the ledger. */
  warn: (item: Due) => boolean
  onConfirm: (item: Due) => void
  onSkip: (item: Due) => void
  onClose: () => void
}) {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col"
      style={{ background: 'var(--paper)' }}
      role="dialog"
      aria-label={T.fixed.title}
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <p className="flex-1 text-sm font-semibold">{T.fixed.title}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold focus-visible:outline focus-visible:outline-2"
          style={{ color: 'var(--accent)' }}
        >
          {T.fixed.close}
        </button>
      </header>

      <ul className="flex-1 overflow-y-auto p-4">
        {due.map(item => (
          <li key={`${item.row}:${item.due}`} className="pb-2">
            <div
              className="flex flex-col gap-2 rounded-xl border border-line p-3"
              style={{ background: 'var(--surface)' }}
            >
              <div className="flex items-baseline gap-3">
                <span className="flex-1 truncate font-semibold">{item.concept}</span>
                <span className="tabular font-mono text-sm">
                  {item.amount === null ? '—' : formatEur(item.amount)}
                </span>
              </div>

              <p className="text-[11px] text-ink-3">
                {formatShortDate(item.due)}
                {item.amount === null && ` · ${T.fixed.ask}`}
              </p>

              {/* A warning and not a block. Being too eager here costs a line
                  nobody needed; being too strict costs the rent twice in a
                  ledger where a row can only be struck through. */}
              {warn(item) && (
                <p className="text-[11px]" style={{ color: 'var(--danger)' }}>
                  {T.fixed.already}
                </p>
              )}

              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => onConfirm(item)}
                  className="flex-1 rounded-lg py-2 text-sm font-bold
                             focus-visible:outline focus-visible:outline-2"
                  style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
                >
                  {T.add.next}
                </button>
                <button
                  type="button"
                  onClick={() => onSkip(item)}
                  className="rounded-lg border border-line px-3 py-2 text-sm font-semibold
                             focus-visible:outline focus-visible:outline-2"
                  style={{ color: 'var(--ink-2)' }}
                >
                  {T.fixed.skip}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The one line on the first step. Absent, not empty, when nothing is owed. */
export function FixedBanner({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (!count) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold
                 focus-visible:outline focus-visible:outline-2"
      style={{
        background: 'var(--accent-soft)',
        borderColor: 'var(--accent)',
        color: 'var(--accent)',
      }}
    >
      <span className="flex-1 text-left">{T.fixed.due(count)}</span>
      <span aria-hidden="true">›</span>
    </button>
  )
}
