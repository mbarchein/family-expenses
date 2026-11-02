import { useEffect } from 'react'
import { T } from '../i18n/strings'
import { todayIso } from '../lib/dates'
import { typedFrom } from '../lib/money'
import { useBackClose } from '../lib/route'
import type { Filters } from '../lib/search'

/**
 * The two questions the quick search box cannot ask.
 *
 * Both need two values and the box has one: between which amounts, and between
 * which days. So they are a dialog — asked for as one — reached from a button
 * beside the box, which is also where the app already puts a second control for
 * a field that has one (see the cross on the category filter).
 *
 * A card over the list rather than a screen over it, which is how `Confirm`
 * does it and not how the category picker does. That one is a full screen
 * because it is a list of thirty rows that has to scroll; this is four boxes,
 * and four boxes on a full screen is nine centimetres of nothing under them.
 * The list stays visible around the edges, which is the point: it is narrowing
 * as the boxes are typed into.
 *
 * **It filters as it is typed, and the list behind it is already narrowed when
 * it closes.** There is no Aplicar and nothing to confirm: a range is two
 * numbers, and a dialog that held them back until a button was pressed would be
 * asking somebody to guess what they were about to get. Which is why the button
 * at the bottom says «Ver los gastos» — it closes the dialog over a list that
 * has already answered.
 *
 * Each bound stands alone. An empty box is not a zero and not today: it is "no
 * limit at this end", so one bound on its own is a perfectly good question —
 * everything over fifty euros, everything since March — and it is the common
 * one. The line under the amounts says so, because an empty number box is the
 * one place in this app where blank and nought are easy to confuse.
 */
export function AdvancedSearch({ filters, onChange, onClose }: {
  filters: Filters
  onChange: (fields: Partial<Filters>) => void
  onClose: () => void
}) {
  // Back closes it and leaves the list underneath filtered exactly as it is —
  // the same gesture as every other sheet in this app.
  useBackClose(true, onClose)

  const empty = !filters.from && !filters.to && !filters.min.trim() && !filters.max.trim()

  // Escape closes it, like the other dialog in this app and like every dialog
  // anywhere. Nothing is lost by closing: the filters are already applied.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      // Above the tab bar as well as the list: a dialog you can tap straight
      // past is a dialog that will be tapped straight past.
      //
      // `grid-cols-[minmax(0,1fr)]` and not just `place-items-center`, which is
      // what this was and which put the card 48px off the right-hand edge of a
      // 360px phone. A grid with no columns declared invents one, sized `auto`,
      // and an `auto` track is floored at the min-content width of what is in
      // it — here two date inputs, which will not go below about 164px each. So
      // the track grew past the screen and took `w-full` with it, since 100% of
      // an overflowing track is an overflowing card. A `minmax(0, …)` track has
      // no such floor and cannot be wider than the room it was given.
      className="fixed inset-0 z-20 grid grid-cols-[minmax(0,1fr)] place-items-center
                 bg-black/60 p-4"
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={T.list.advanced}
        // `--surface` and a border, not `--paper`: paper is the colour of the
        // screen underneath, so the card was the page floating on the page, and
        // under the dark theme — where paper is #0f1413 and a 40% veil over it
        // is nearly the same black — there was nothing to tell them apart. A
        // card has to be a step up from what it covers in both themes, and the
        // border and the shadow are what say so when the step is small.
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line
                   p-4 shadow-2xl"
        style={{ background: 'var(--surface)' }}
      >
        <p className="text-base font-semibold">{T.list.advanced}</p>
        <section className="flex flex-col gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
            {T.list.amountRange}
          </h2>
          {/* Two halves and the dash between them, as grid tracks rather than
              as flex children: `minmax(0,1fr)` is the only way to say "half,
              whatever is in it" to a box that has an opinion about how narrow
              it is willing to be. A date input has a strong one. */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            {/* `inputMode` rather than `type="number"`: the spinner arrows are
                furniture on a phone, and a number input in a Spanish locale
                argues with the comma. The text is cleaned the same way every
                hand-typed amount in this app is — see `typedFrom`. */}
            <Amount
              label={T.list.amountFrom}
              hint={T.list.rangeStart}
              value={filters.min}
              onChange={min => onChange({ min })}
            />
            <Dash />
            <Amount
              label={T.list.amountTo}
              hint={T.list.rangeEnd}
              value={filters.max}
              onChange={max => onChange({ max })}
            />
          </div>
          <p className="text-[11px] text-ink-3">{T.list.rangeHint}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-ink-3">
            {T.list.dateRange}
          </h2>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <Day
              label={T.list.dateFrom}
              value={filters.from}
              onChange={from => onChange({ from })}
            />
            <Dash />
            <Day
              label={T.list.dateTo}
              value={filters.to}
              onChange={to => onChange({ to })}
            />
          </div>
        </section>

        <div className="flex items-stretch gap-2 pt-1">
          <button
            type="button"
            onClick={() => onChange({ from: '', to: '', min: '', max: '' })}
            disabled={empty}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold
                       disabled:opacity-40 focus-visible:outline focus-visible:outline-2"
            style={{ background: 'var(--surface)' }}
          >
            {T.list.clearAdvanced}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold
                       focus-visible:outline focus-visible:outline-2"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            {T.list.apply}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Between the two ends of a range. Decorative: the boxes say which end they
 *  are, out loud, in their labels. */
function Dash() {
  return <span aria-hidden="true" className="shrink-0 text-sm text-ink-3">–</span>
}

function Amount({ label, hint, value, onChange }: {
  /** What it is, for anything that reads the screen out loud: the box is
   *  labelled by what it does rather than by the short word printed in it. */
  label: string
  /** And the short word printed in it, which the width has room for. */
  hint: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex min-w-0 items-center gap-1 rounded-lg border border-line
                      bg-surface px-3 py-2.5 focus-within:outline focus-within:outline-2">
      <input
        value={value}
        onChange={event => onChange(typedFrom(event.target.value))}
        aria-label={label}
        inputMode="decimal"
        placeholder={hint}
        className="tabular min-w-0 flex-1 bg-transparent text-right font-mono text-sm
                   placeholder:text-left placeholder:font-sans placeholder:text-ink-3
                   focus:outline-none"
      />
      <span aria-hidden="true" className="shrink-0 text-sm text-ink-3">€</span>
    </label>
  )
}

function Day({ label, value, onChange }: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <input
      type="date"
      value={value}
      // Nothing in this ledger is dated after today, so neither is a bound.
      max={todayIso()}
      onChange={event => onChange(event.target.value)}
      aria-label={label}
      className="w-full min-w-0 rounded-lg border border-line bg-surface px-2.5 py-2.5 text-sm
                 focus-visible:outline focus-visible:outline-2"
    />
  )
}
