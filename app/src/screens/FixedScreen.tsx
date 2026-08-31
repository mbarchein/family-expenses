import { useEffect, useMemo, useRef, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { CategoryField } from '../components/CategoryField'
import { ConceptField } from '../components/ConceptField'
import { Icon } from '../components/Icon'
import { MethodField } from '../components/MethodField'
import { Segmented } from '../components/Segmented'
import { ScreenHeader } from '../components/ScreenHeader'
import { T } from '../i18n/strings'
import { categoryFor, iconOf } from '../lib/categories'
import { knownConcepts } from '../lib/concepts'
import { dueDay } from '../lib/fixed'
import { todayIso } from '../lib/dates'
import { formatEur, parseAmount, typedFromAmount } from '../lib/money'
import type { Category, Entry, Fixed, Person, Suggestion } from '../api/types'
import { useAvatars } from '../store/avatars'
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
/** The detail segment that means "a template that does not exist yet". A word
 *  rather than a zero, because it ends up in the address bar. */
const NEW = 'nuevo'

export function FixedScreen({ ledger, onBack, editing, onOpen, onCloseEditor }: {
  ledger: Ledger
  onBack: () => void
  /** From the address: `nuevo`, a row number, or '' for the list itself. The
   *  sheet used to be `useState`, which gave the back button nothing to close —
   *  pressing it on the detail of a fijo left the whole screen. */
  editing: string
  onOpen: (detail: string) => void
  onCloseEditor: () => void
}) {
  const people = ledger.data?.config.people
  // The faces, for the payer on each row — the same ones the keypad and the edit
  // sheet draw, so a person looks like the same person everywhere.
  const { faces } = useAvatars()
  // Above the early return, where every hook has to be. What the concept box
  // offers: the same vocabulary the keypad has, which for a recurring bill is
  // almost always where its name already is.
  // The same list the edit sheet offers: the Sugerencias tab, then the backend's
  // ranking, then what is on this phone. It was only the middle one here, so a
  // bill apuntado once by hand could not be picked when writing its template.
  const concepts = useMemo(
    () => knownConcepts(
      ledger.data?.frequent ?? [], ledger.entries, ledger.data?.suggestions ?? []),
    [ledger.data?.frequent, ledger.entries, ledger.data?.suggestions],
  )

  if (!people) return null
  const rows = [...ledger.fixed].sort((a, b) => a.day - b.day || a.concept.localeCompare(b.concept))
  const categories = ledger.data?.categories ?? []
  // Derived from the address rather than held beside it, so there is one answer
  // to "what is open" and the back button shares it. An address naming a row that
  // is not there — a stale link, a template deleted on the other phone — opens
  // the list rather than an empty sheet.
  const open = editing === NEW ? blank()
    : editing ? rows.find(item => (item.id || String(item.row)) === editing) ?? null
    : null

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
          <li key={item.id || `row:${item.row}`}>
            <button
              type="button"
              // By id, so a link to a template survives somebody deleting a row
              // above it in the tab — and by row for one added by hand, which has
              // no id until the app writes it.
              onClick={() => onOpen(item.id || String(item.row))}
              className="flex w-full items-center gap-3 rounded-xl border border-line p-3 text-left
                         focus-visible:outline focus-visible:outline-2"
              style={{ background: 'var(--surface)', opacity: item.active ? 1 : 0.55 }}
            >
              {/* The same slot the expense rows have, from the template's own
                  category — and falling back to guessing from the concept for
                  the ones filled in before the column existed. In whoever pays'
                  colour, which is the other thing those rows do: on a list of
                  fifteen bills, "whose is this one" was a word at the end of a
                  grey line. */}
              <FixedIcon fixed={item} categories={categories} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{item.concept}</span>
                <span className="flex items-center gap-1 text-[11px] text-ink-3">
                  <span className="truncate">
                    {T.fixed.every(item.months)} · {T.fixed.onDay(item.day)}{' · '}
                  </span>
                  {/* The face and the name, in that person's colour — the pair
                      the keypad, the edit sheet and the Diferencia bar all use,
                      because two names in a household are told apart by the shape
                      before they are read. Nothing to draw for a fijo that says
                      "whoever has the phone": there is no face for both of them,
                      and inventing one would be a claim about who pays. */}
                  {item.payer === null
                    ? <span className="shrink-0">{T.fixed.payerAny}</span>
                    : (
                      <span className="flex shrink-0 items-center gap-1 font-semibold"
                            style={{ color: `var(--person-${item.payer + 1})` }}>
                        <Avatar name={faces[item.payer]} className="h-3.5 w-3.5 shrink-0"
                                style={{ color: `var(--person-${item.payer + 1})` }} />
                        {people[item.payer].name}
                      </span>
                    )}
                  {/* Its own chunk rather than inside the text that truncates:
                      the row is already dimmed, and «Desa…» is worse than
                      nothing. */}
                  {!item.active && (
                    <span className="shrink-0">{' · '}{T.fixed.inactive}</span>
                  )}
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
        onClick={() => onOpen(NEW)}
        className="rounded-xl py-3 text-sm font-bold focus-visible:outline focus-visible:outline-2"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
      >
        {T.fixed.add}
      </button>

      {open && (
        <Editor
          key={editing}
          fixed={open}
          people={people}
          categories={categories}
          concepts={concepts}
          suggestions={ledger.data?.suggestions ?? []}
          entries={ledger.entries}
          onClose={onCloseEditor}
          onSave={async next => { await ledger.saveFixed(next); onCloseEditor() }}
        />
      )}
    </div>
  )
}

/**
 * A new one, monthly on the first, amount to be asked for. The safest defaults:
 * a wrong day is one edit, a wrong amount posted every month is a mess.
 *
 * The id is minted here rather than by the sheet, for the same reason an expense
 * mints its own: the queue is keyed by it, so an edit made twice with no signal
 * has to collapse into one template rather than append two.
 */
function blank(): Fixed {
  return {
    id: crypto.randomUUID(), row: 0, concept: '', amount: null, day: 1, payer: null,
    months: 1, active: true, from: '', last: '', category: '', method: '',
  }
}

const CADENCES = [1, 2, 3, 4, 6, 12]

function Editor({
  fixed, people, categories, concepts, suggestions, entries, onClose, onSave,
}: {
  fixed: Fixed
  people: readonly [Person, Person]
  categories: readonly Category[]
  /** The Sugerencias tab, for the cards on the method row. */
  suggestions: readonly Suggestion[]
  /** The ledger, for the category guess: what this concept was filed as last
   *  time beats what its letters look like. */
  entries: readonly Entry[]
  /** For the concept box's own list. A recurring bill's name is nearly always
   *  one the ledger already knows. */
  concepts: readonly string[]
  onClose: () => void
  onSave: (fixed: Omit<Fixed, 'last'>) => Promise<void>
}) {
  const { faces } = useAvatars()
  const [draft, setDraft] = useState(fixed)
  const [typed, setTyped] = useState(draft.amount === null ? '' : typedFromAmount(draft.amount))

  /**
   * The category, re-guessed whenever the concept changes — the second step's
   * rule, on the screen that writes the template the second step will inherit
   * from.
   *
   * Started at the concept this editor opened with, so an existing template's
   * category is never re-guessed on mount: it may have been picked by hand, or
   * typed into the tab, and an editor that quietly refiles what it was opened to
   * change is worse than one that guesses nothing. After that, a new concept
   * means a new guess, because the category is derived from the concept and a
   * hand-picked one only survives until the thing it describes is replaced.
   */
  const guessedFor = useRef(fixed.concept.trim())
  useEffect(() => {
    const concept = draft.concept.trim()
    if (guessedFor.current === concept) return
    guessedFor.current = concept
    const guess = categoryFor(concept, categories, entries)
    setDraft(current => (guess === current.category ? current : { ...current, category: guess }))
  }, [draft.concept, categories, entries])
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
          <ConceptField
            value={draft.concept}
            concepts={concepts}
            onChange={concept => setDraft({ ...draft, concept })}
          />
        </Field>

        <Field label={T.category.label}>
          {/* What the expense this produces gets filed as, so a bill that
              arrives every month is filed the same way every month without
              anybody choosing again. Guessed from the concept as it is typed —
              see the effect above — and overridable here, like everywhere else
              this pair appears. */}
          <CategoryField
            value={draft.category}
            categories={categories}
            onChange={category => setDraft({ ...draft, category })}
          />
        </Field>

        <Field label={T.add.methodRow}>
          {/* The card this bill comes off. It is the same tap saved as the
              category: the rent is paid the same way every month, and the gasto
              this template proposes now arrives with it already chosen. */}
          <MethodField
            suggestions={suggestions}
            payer={draft.payer}
            value={draft.method}
            onChange={method => setDraft({ ...draft, method })}
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
              // The same faces the keypad and the edit sheet use. Three segments
              // side by side leave no room for the stacked tiles, so these are
              // small and beside the name — enough to be recognised without
              // reading, which is what they are for.
              {
                label: people[0].name, value: '0', tone: 'person-1',
                icon: <Avatar name={faces[0]} className="h-4 w-4 shrink-0" />,
              },
              {
                label: people[1].name, value: '1', tone: 'person-2',
                icon: <Avatar name={faces[1]} className="h-4 w-4 shrink-0" />,
              },
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


/**
 * The template's icon, from its category.
 *
 * The same slot the expense rows carry, so a list of bills is recognised by
 * shape rather than read. Falls back to guessing from the concept for the
 * templates filled in before the column existed, and to nothing at all when
 * neither has an answer — a guess that misses is a small lie on every row.
 */
function FixedIcon({ fixed, categories }: { fixed: Fixed; categories: readonly Category[] }) {
  const icon = iconOf(fixed, categories)
  // Whoever pays, the way the expense rows colour theirs. A template that says
  // "whoever has the phone" belongs to neither, so it keeps the grey it had —
  // there is no colour for both of them, and picking one would be a claim.
  const colour = fixed.payer === null
    ? 'var(--ink-2)'
    : `var(--person-${fixed.payer + 1})`

  return (
    <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center"
          style={{ color: colour }}>
      {icon
        ? <Icon name={icon} className="h-6 w-6" />
        : <span className="h-2 w-2 rounded-full bg-current opacity-40" />}
    </span>
  )
}
