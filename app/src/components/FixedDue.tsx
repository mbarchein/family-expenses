import { useState } from 'react'
import { Spinner } from './Spinner'
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
  /**
   * Awaited, which is the point: skipping writes `último` to the sheet over the
   * network, and this screen used to fire it and forget. Nothing on screen
   * changed, so a slow reply looked like a button that had not registered the
   * tap — and a second tap sent it again.
   */
  onSkip: (item: Due) => Promise<void>
  onClose: () => void
}) {
  /** Which proposal is talking to the sheet, `null` for none. The whole sheet
   *  goes quiet while one is: confirming loads the expense into the flow and
   *  leaves, so two of these at once is never a thing somebody meant. */
  const [busy, setBusy] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const keyOf = (item: Due) => `${item.id || item.row}:${item.due}`

  async function skip(item: Due) {
    if (busy) return
    setBusy(keyOf(item))
    setProblem(null)
    try {
      await onSkip(item)
    } catch {
      // Said out loud rather than swallowed. The period stays owed, which is the
      // safe half of that pair: it is proposed again rather than silently
      // treated as dealt with.
      setProblem(T.fixed.skipFailed)
    } finally {
      setBusy(null)
    }
  }

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

      {/* Nothing owed, with the sheet still open — which is what skipping the
          last proposal leaves behind. The banner never opens an empty sheet, so
          this is the state that arrives while you are looking at it, and a list
          that empties into blank paper reads as a screen that broke. */}
      {!due.length ? (
        <div className="flex flex-1 flex-col gap-2 p-6 text-center">
          <p className="text-sm font-semibold text-ink-2">{T.fixed.noneDue}</p>
          <p className="mx-auto max-w-xs text-xs text-ink-3">{T.fixed.noneDueWhen}</p>
        </div>
      ) : (
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

                {/* Both disabled while either is working, and the one that was
                    pressed says what it is doing. Neither of them did before: the
                    skip went to the network with nothing on screen to show it, and
                    confirming twice pushed the flow twice. */}
                <div className="flex gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => onConfirm(item)}
                    disabled={busy !== null}
                    className="flex-1 rounded-lg py-2 text-sm font-bold disabled:opacity-40
                               focus-visible:outline focus-visible:outline-2"
                    style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
                  >
                    {T.add.next}
                  </button>
                  <button
                    type="button"
                    onClick={() => void skip(item)}
                    disabled={busy !== null}
                    aria-busy={busy === keyOf(item)}
                    className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2
                               text-sm font-semibold disabled:opacity-40
                               focus-visible:outline focus-visible:outline-2"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    {busy === keyOf(item) && <Spinner className="h-3.5 w-3.5" />}
                    {busy === keyOf(item) ? T.fixed.skipping : T.fixed.skip}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {problem && (
        <p role="alert" className="px-4 pb-4 text-center text-sm"
           style={{ color: 'var(--danger)' }}>
          {problem}
        </p>
      )}
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
