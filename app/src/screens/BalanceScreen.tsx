import { useMemo, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { ScreenHeader } from '../components/ScreenHeader'
import { T } from '../i18n/strings'
import { displayTyped, formatEur, parseAmount } from '../lib/money'
import { splitTransfer } from '../lib/split'
import { useAvatars } from '../store/avatars'
import type { Ledger } from '../store/ledger'

/**
 * The difference, and the only thing that corrects it.
 *
 * The number shown is the spreadsheet's own `diferencia` column, unmodified —
 * the same figure the two of them have been reading for years. What the app
 * adds is the next step: how to split the next transfer so it lands on zero.
 */
export function BalanceScreen({ ledger, onBack }: { ledger: Ledger; onBack: () => void }) {
  const people = ledger.data?.config.people
  const balance = ledger.data?.balance ?? 0
  const { faces } = useAvatars()
  const [typed, setTyped] = useState('')

  const split = useMemo(() => splitTransfer(parseAmount(typed), balance), [typed, balance])
  const contributions = useMemo(() => {
    const totals: [number, number] = [0, 0]
    for (const entry of ledger.entries) {
      if (!entry.voided && entry.payer !== null) totals[entry.payer] += entry.amount
    }
    return totals
  }, [ledger.entries])

  if (!people) return null

  const ahead = balance > 0 ? 0 : 1
  const total = contributions[0] + contributions[1]
  const share = total > 0 ? Math.round((contributions[0] / total) * 100) : 50

  return (
    <div className="flex flex-col gap-5 p-4">
      <ScreenHeader title={T.tabs.balance} onBack={onBack} />

      <div className="pt-2 text-center">
        <p className="font-mono text-4xl font-bold tabular"
           style={{ color: balance === 0 ? 'var(--ink)' : `var(--person-${ahead + 1})` }}>
          {formatEur(Math.abs(balance))}
        </p>
        {/* The face beside the sentence, in that person's colour. Two names in
            a household are told apart faster by the shape than by reading
            them, which is the whole reason the payer buttons wear these. */}
        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-ink-2">
          {balance !== 0 && (
            <Avatar name={faces[ahead]} className="h-5 w-5 shrink-0"
                    style={{ color: `var(--person-${ahead + 1})` }} />
          )}
          {balance === 0 ? T.balance.even : T.balance.ahead(people[ahead].name)}
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
          {T.balance.splitTitle}
        </h2>
        <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
          <span className="text-sm text-ink-3">{T.balance.splitPrompt}</span>
          <input
            inputMode="decimal"
            value={typed}
            onChange={event => setTyped(event.target.value.replace(/[^\d,]/g, ''))}
            placeholder="0"
            className="min-w-0 flex-1 bg-transparent text-right font-mono text-lg tabular outline-none"
          />
          <span className="text-ink-3">€</span>
        </label>

        {parseAmount(typed) > 0 && (
          <>
            <div className="flex gap-1.5">
              {people.map((person, index) => (
                <div key={person.name} className="flex-1 rounded-lg border px-2 py-2.5 text-center"
                     style={{ borderColor: `var(--person-${index + 1})`, color: `var(--person-${index + 1})` }}>
                  <span className="block text-[11px] font-semibold">{person.name}</span>
                  <span className="block font-mono text-sm font-bold tabular">
                    {formatEur(split.shares[index])}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] text-ink-3">{outcome(split.residual)}</p>
            <p className="text-center font-mono text-[11px] text-ink-3">
              {displayTyped(typed)} €
            </p>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
          {T.balance.contributed}
        </h2>
        <div className="flex h-7 overflow-hidden rounded-md text-[11px] font-bold text-white">
          <span className="grid place-items-center font-mono"
                style={{ flex: Math.max(share, 1), background: 'var(--person-1)' }}>
            {share}%
          </span>
          <span className="grid place-items-center font-mono"
                style={{ flex: Math.max(100 - share, 1), background: 'var(--person-2)' }}>
            {100 - share}%
          </span>
        </div>
        <div className="flex justify-between font-mono text-[11px] tabular">
          <span style={{ color: 'var(--person-1)' }}>{formatEur(contributions[0])}</span>
          <span style={{ color: 'var(--person-2)' }}>{formatEur(contributions[1])}</span>
        </div>
      </section>
    </div>
  )
}

/**
 * What the screen says about the leftover.
 *
 * A cent that cannot be halved is not the same thing as a transfer too small to
 * settle the difference, and rounding the first away would make the app claim a
 * zero the spreadsheet will not show.
 */
function outcome(residual: number): string {
  if (residual === 0) return T.balance.splitResult
  if (Math.abs(residual) <= 0.01) return T.balance.splitCent
  return T.balance.splitShort(formatEur(Math.abs(residual)))
}
