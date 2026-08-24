import { useId, useState } from 'react'
import { Segmented } from '../components/Segmented'
import { T } from '../i18n/strings'
import { formatShortDate, todayIso } from '../lib/dates'
import { displayTyped, parseAmount } from '../lib/money'
import type { Entry, Person } from '../api/types'
import type { QueuedEntry } from '../store/queue'

export function EditSheet({ entry, people, onClose, onSave, onVoid }: {
  entry: Entry
  people: [Person, Person]
  onClose: () => void
  onSave: (entry: QueuedEntry) => Promise<void>
  onVoid: (id: string) => Promise<void>
}) {
  const [typed, setTyped] = useState(String(entry.amount).replace('.', ','))
  const [concept, setConcept] = useState(entry.concept)
  const [payer, setPayer] = useState<0 | 1>(entry.payer ?? 0)
  const [date, setDate] = useState(entry.date)
  const [note, setNote] = useState(entry.note)
  const [busy, setBusy] = useState(false)
  const titleId = useId()

  async function save() {
    const amount = parseAmount(typed)
    if (amount <= 0 || !concept.trim()) return
    setBusy(true)
    await onSave({ id: entry.id, date, concept: concept.trim(), amount, payer, note })
  }

  async function remove() {
    if (!window.confirm(T.edit.voidConfirm)) return
    setBusy(true)
    await onVoid(entry.id)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-10 flex items-end bg-black/40"
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4"
           style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          {/* The title moved into the space the cancel link left behind, and it
              is what names the dialog now — one name rather than a visible one
              and a different invisible one. */}
          <h2 id={titleId} className="text-sm font-semibold">{T.edit.title}</h2>
          {/* Outlined rather than filled: this is the one control here that
              cannot be undone, so it has to look like a button without looking
              like the thing to press. */}
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="shrink-0 rounded-full border px-4 py-2 text-sm font-semibold
                       disabled:opacity-40"
            style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
          >
            {T.list.void}
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <output className="py-1 text-center font-mono text-4xl font-semibold tabular">
            <span className="text-xl text-ink-3">€ </span>{displayTyped(typed)}
          </output>

          <input
            inputMode="decimal"
            value={typed}
            onChange={event => setTyped(event.target.value.replace(/[^\d,]/g, ''))}
            aria-label="Importe"
            className="rounded-lg border border-line bg-surface px-3 py-2.5 text-center font-mono text-sm"
          />

          <input
            value={concept}
            onChange={event => setConcept(event.target.value)}
            aria-label={T.add.concept}
            className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm"
          />

          <Segmented
            value={String(payer)}
            onChange={value => setPayer(Number(value) as 0 | 1)}
            options={[
              { label: T.add.pays(people[0].name), value: '0', tone: 'person-1' },
              { label: T.add.pays(people[1].name), value: '1', tone: 'person-2' },
            ]}
          />

          <input
            type="date"
            value={date}
            max={todayIso()}
            onChange={event => setDate(event.target.value)}
            aria-label={formatShortDate(date)}
            className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm"
          />

          <input
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder={T.edit.note}
            aria-label={T.edit.note}
            className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm placeholder:text-ink-3"
          />

          {/* Cancel next to save, at the size of a button and not a link in the
              corner. Saving is twice the width: they are both ways out of this
              screen, and only one of them is the one being looked for. */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-xl border border-line py-3.5 font-semibold
                         text-ink-2 disabled:opacity-40"
            >
              {T.edit.cancel}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="flex-[2] rounded-xl py-3.5 font-bold disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              {T.edit.save}
            </button>
          </div>

          <p className="text-center text-[11px] text-ink-3">
            {entry.row ? `Fila ${entry.row}` : T.sync.pending(1)}
          </p>
        </div>
      </div>
    </div>
  )
}
