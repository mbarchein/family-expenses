import { useState } from 'react'
import { Segmented } from '../components/Segmented'
import { ScreenHeader } from '../components/ScreenHeader'
import { T } from '../i18n/strings'
import { dueDay } from '../lib/fixed'
import { todayIso } from '../lib/dates'
import { formatEur, parseAmount, typedFromAmount } from '../lib/money'
import type { Fixed, Person } from '../api/types'
import type { Ledger } from '../store/ledger'

/**
 * The recurring expenses: what they are, and where they are changed.
 *
 * The tab exists because they are editable from the phone, and an editor needs a
 * door that is there when the list is empty — the proposals on the first step
 * appear only when something is owed, so they could never be the way in to
 * creating the first one.
 *
 * What is *not* here is any notion of what is due. That is worked out from these
 * rows in `lib/fixed.ts` and shown where it can be acted on, which is the screen
 * where an expense gets apuntado.
 */
export function FixedScreen({ ledger, onBack }: { ledger: Ledger; onBack: () => void }) {
  const people = ledger.data?.config.people
  const [editing, setEditing] = useState<Fixed | null>(null)

  if (!people) return null
  const rows = [...ledger.fixed].sort((a, b) => a.day - b.day || a.concept.localeCompare(b.concept))

  return (
    <div className="flex flex-col gap-3 p-4">
      <ScreenHeader title={T.tabs.fixed} onBack={onBack} />

      {!rows.length && (
        <div className="flex flex-col gap-2 pt-6 text-center">
          <p className="text-sm font-semibold text-ink-2">{T.fixed.empty}</p>
          <p className="mx-auto max-w-xs text-xs text-ink-3">{T.fixed.emptyHow}</p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {rows.map(item => (
          <li key={item.row}>
            <button
              type="button"
              onClick={() => setEditing(item)}
              className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left
                         focus-visible:outline focus-visible:outline-2"
              style={{ background: 'var(--surface)', opacity: item.active ? 1 : 0.55 }}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{item.concept}</span>
                <span className="block text-[11px] text-ink-3">
                  {T.fixed.every(item.months)} · {T.fixed.dayLabel.toLowerCase()} {item.day}
                  {' · '}
                  {item.payer === null ? T.fixed.payerAny : people[item.payer].name}
                  {!item.active && ` · ${T.fixed.inactive}`}
                </span>
              </span>
              <span className="tabular shrink-0 font-mono text-sm">
                {item.amount === null ? '—' : formatEur(item.amount)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setEditing(blank())}
        className="rounded-xl py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        {T.fixed.add}
      </button>

      {editing && (
        <Editor
          fixed={editing}
          people={people}
          onClose={() => setEditing(null)}
          onSave={async next => { await ledger.saveFixed(next); setEditing(null) }}
        />
      )}
    </div>
  )
}

/** A new one, monthly on the first, amount to be asked for. The safest defaults:
 *  a wrong day is one edit, a wrong amount posted every month is a mess. */
function blank(): Fixed {
  return {
    row: 0, concept: '', amount: null, day: 1, payer: null,
    months: 1, active: true, from: '', last: '',
  }
}

const CADENCES = [1, 2, 3, 4, 6, 12]

function Editor({ fixed, people, onClose, onSave }: {
  fixed: Fixed
  people: readonly [Person, Person]
  onClose: () => void
  onSave: (fixed: Omit<Fixed, 'last'>) => Promise<void>
}) {
  const [draft, setDraft] = useState(fixed)
  const [typed, setTyped] = useState(draft.amount === null ? '' : typedFromAmount(draft.amount))
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function save() {
    const concept = draft.concept.trim()
    if (!concept) return setProblem(T.fixed.needConcept)

    setSaving(true)
    const amount = typed.trim() ? parseAmount(typed) : null
    await onSave({
      ...draft,
      concept,
      amount,
      // The anchor is what keeps a cadence longer than a month in phase, so it
      // is written down the moment one is chosen rather than inferred later
      // from whatever the first confirmation happened to be.
      from: draft.months > 1 && !draft.from ? dueDay(todayIso(), draft.day) : draft.from,
    }).catch(() => setSaving(false))
  }

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col"
      style={{ background: 'var(--paper)' }}
      role="dialog"
      aria-label={draft.row ? draft.concept || T.fixed.add : T.fixed.add}
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <p className="flex-1 text-sm font-semibold">{draft.row ? draft.concept : T.fixed.add}</p>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold focus-visible:outline focus-visible:outline-2"
          style={{ color: 'var(--accent)' }}
        >
          {T.fixed.close}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Field label={T.add.concept}>
          <input
            value={draft.concept}
            onChange={event => setDraft({ ...draft, concept: event.target.value })}
            aria-label={T.add.concept}
            autoComplete="off"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink
                       focus-visible:outline focus-visible:outline-2"
          />
        </Field>

        <Field label={T.fixed.amountLabel}>
          <input
            value={typed}
            onChange={event => setTyped(event.target.value.replace(/[^0-9,.]/g, ''))}
            placeholder={T.fixed.amountAsk}
            aria-label={T.fixed.amountLabel}
            inputMode="decimal"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink
                       placeholder:text-ink-3 focus-visible:outline focus-visible:outline-2"
          />
        </Field>

        <Field label={T.fixed.everyLabel}>
          {/* A native select for six options: on a phone it is a wheel the
              thumb already knows, and six segments would not fit the width. */}
          <select
            value={draft.months}
            onChange={event => setDraft({ ...draft, months: Number(event.target.value) })}
            aria-label={T.fixed.everyLabel}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink
                       focus-visible:outline focus-visible:outline-2"
          >
            {CADENCES.map(months => (
              <option key={months} value={months}>{T.fixed.every(months)}</option>
            ))}
          </select>
        </Field>

        <Field label={T.fixed.dayLabel}>
          <input
            value={String(draft.day)}
            onChange={event => setDraft({
              ...draft,
              day: Math.min(31, Math.max(1, Number(event.target.value.replace(/\D/g, '')) || 1)),
            })}
            aria-label={T.fixed.dayLabel}
            inputMode="numeric"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-ink
                       focus-visible:outline focus-visible:outline-2"
          />
        </Field>

        <Field label={T.add.fieldPayer}>
          <Segmented
            value={draft.payer === null ? 'any' : String(draft.payer)}
            onChange={value => setDraft({
              ...draft,
              payer: value === 'any' ? null : (Number(value) as 0 | 1),
            })}
            options={[
              { label: T.fixed.payerAny, value: 'any' },
              { label: people[0].name, value: '0', tone: 'person-1' },
              { label: people[1].name, value: '1', tone: 'person-2' },
            ]}
            compact
          />
        </Field>

        <Field label={T.fixed.activeLabel}>
          <Segmented
            value={draft.active ? 'on' : 'off'}
            onChange={value => setDraft({ ...draft, active: value === 'on' })}
            options={[
              { label: T.fixed.activeLabel, value: 'on' },
              { label: T.fixed.inactive, value: 'off' },
            ]}
            compact
          />
        </Field>

        {problem && (
          <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>{problem}</p>
        )}

        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="mt-1 rounded-xl py-3.5 text-base font-bold disabled:opacity-40
                     focus-visible:outline focus-visible:outline-2"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          {saving ? T.add.saving : T.fixed.save}
        </button>
      </div>
    </div>
  )
}

/**
 * A caption over a control, and deliberately not a `<label>`.
 *
 * It was one, and it broke the names of everything that is not an input: a
 * button inside a label takes the label's text into its own accessible name, so
 * the segment reading "Activo" announced itself as "Activo Desactivado" and the
 * payer row as "Quien lo apunte Viqui Mario". A browser test found it, which is
 * the only way anybody was going to. Every control in here carries its own
 * `aria-label`, so the caption is free to be plain text.
 */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-ink-2">{label}</p>
      {children}
    </div>
  )
}
