import { useMemo, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { ScreenHeader } from '../components/ScreenHeader'
import { T } from '../i18n/strings'
import { formatShortDate } from '../lib/dates'
import { formatEur, parseAmount, typedFrom } from '../lib/money'
import { splitTransfer } from '../lib/split'
import { earliestDay, latestDay } from '../lib/totals'
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
  /**
   * What each of them has put in — over the whole sheet where the backend says
   * so, and over the window it sent where it does not.
   *
   * The window is a year and a half of a ledger that starts in 2016, and this bar
   * used to add up that window while the number above it covered everything. On
   * this household's sheet that read 48/52 to Mario under «Viqui va por delante»,
   * which is a screen contradicting itself. The backend sums the same two columns
   * the sheet's own difference subtracts, so the two halves now answer the same
   * question — see `readTotals_`.
   *
   * The fallback is not dead code: a bootstrap cached by an older version is read
   * off the disk before any request goes out, and the app can be newer than the
   * deployment for a few minutes after a push. Where it is used, the caption says
   * what stretch the bar covers instead of claiming everything.
   */
  const lifetime = ledger.data?.totals
  const windowed = useMemo(() => {
    const totals: [number, number] = [0, 0]
    for (const entry of ledger.entries) {
      if (!entry.voided && entry.payer !== null) totals[entry.payer] += entry.amount
    }
    return totals
  }, [ledger.entries])
  const contributions = lifetime?.paid ?? windowed
  // What stretch is being added up. A total whose dates are left to be guessed at
  // from the rows above it is a total of nothing in particular.
  const loadedFrom = useMemo(() => earliestDay(ledger.entries), [ledger.entries])
  const to = useMemo(() => latestDay(ledger.entries), [ledger.entries])
  const from = lifetime ? (lifetime.since || loadedFrom) : loadedFrom

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
        {parseAmount(typed) > 0 && (
          <>
            <div className="flex gap-1.5">
              {people.map((person, index) => (
                <div key={person.name} className="flex-1 rounded-lg border px-2 py-2.5 text-center"
                     role="group"
                     // The pair in one phrase, like the bar below: a name over an
                     // amount is joined by position and by nothing else.
                     aria-label={T.balance.putsIn(person.name, formatEur(split.shares[index]))}
                     style={{ borderColor: `var(--person-${index + 1})`, color: `var(--person-${index + 1})` }}>
                  <span className="block text-[11px] font-semibold">{person.name}</span>
                  <span className="block font-mono text-sm font-bold tabular">
                    {formatEur(split.shares[index])}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-center text-[11px] text-ink-3">{outcome(split.residual)}</p>
          </>
        )}

        {/* Last, under the answer it produces. The on-screen keyboard covers
            everything below the focused field, so with the field on top the two
            halves somebody is typing at — how much, and what it would leave —
            were exactly what the keyboard hid. The same reasoning put the
            concept grid above its search box on the second step. */}
        <label className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
          <span className="text-sm text-ink-3">{T.balance.splitPrompt}</span>
          <input
            inputMode="decimal"
            value={typed}
            onChange={event => setTyped(typedFrom(event.target.value))}
            placeholder="0"
            className="min-w-0 flex-1 bg-transparent text-right font-mono text-lg tabular outline-none"
          />
          <span className="text-ink-3">€</span>
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
            {T.balance.contributed}
          </h2>
          <p className="text-[11px] text-ink-3">
            {from && to
              ? (lifetime
                  ? T.balance.contributedRange(formatShortDate(from), formatShortDate(to))
                  : T.balance.contributedWindow(formatShortDate(from), formatShortDate(to)))
              : T.balance.contributedEmpty}
          </p>
        </div>
        <div className="flex h-7 overflow-hidden rounded-md text-[11px] font-bold text-white">
          {/* Named as well as coloured: read out, this was "75%, 25%" with
              nothing saying whose. */}
          <span className="grid place-items-center font-mono"
                aria-label={T.balance.putInShare(people[0].name, share)}
                style={{ flex: Math.max(share, 1), background: 'var(--person-1)' }}>
            {share}%
          </span>
          <span className="grid place-items-center font-mono"
                aria-label={T.balance.putInShare(people[1].name, 100 - share)}
                style={{ flex: Math.max(100 - share, 1), background: 'var(--person-2)' }}>
            {100 - share}%
          </span>
        </div>
        {/* Each side says whose it is.
            
            It was two coloured numbers and two coloured percentages, and the
            colour was the only thing saying which was which — learnable, and
            reported as the two being the wrong way round, which is exactly what
            somebody says about a chart that needs a key nobody printed. The name
            and the face go with the amount now, and the pair reads on its own.
            
            Mirrored on the right, so each face sits at its own outer edge and
            each name beside the bar segment it belongs to. */}
        <div className="flex justify-between gap-2 text-[11px]">
          {people.map((person, index) => (
            <span
              key={person.name}
              role="group"
              // The pair, said in one phrase: the name and the amount are two
              // elements beside each other on screen and nothing but position
              // joins them for anybody who cannot see it.
              aria-label={T.balance.putIn(person.name, formatEur(contributions[index]))}
              className={'flex min-w-0 items-center gap-1.5'
                + (index === 1 ? ' flex-row-reverse' : '')}
              style={{ color: `var(--person-${index + 1})` }}
            >
              <Avatar name={faces[index]} className="h-4 w-4 shrink-0"
                      style={{ color: `var(--person-${index + 1})` }} />
              <span className="truncate font-semibold">{person.name}</span>
              <span className="tabular shrink-0 font-mono">
                {formatEur(contributions[index])}
              </span>
            </span>
          ))}
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
