import { useEffect, useRef } from 'react'
import { T } from '../i18n/strings'
import { useBackClose } from '../lib/route'

/**
 * A question with two answers, inside the app.
 *
 * `window.confirm` is what the rest of this app still uses for the other three
 * questions it asks, and it is not good enough for this one. It is the browser's
 * dialog, not ours: on iOS a standalone PWA labels it with the site's hostname,
 * the wording of the buttons is the browser's, and it looks like something has
 * gone wrong rather than like a question the screen is asking. Discarding a gasto
 * somebody has just typed deserves to look like it comes from the app that is
 * about to throw it away.
 *
 * Cancelling is the easy answer in three different ways, which is deliberate for
 * a question whose other answer destroys something: it is the button that gets
 * focus, it is what the backdrop does, it is what Escape does, and it is what the
 * phone's back button does. The destructive answer has to be aimed at.
 */
export function Confirm({
  title, body, confirmLabel, cancelLabel = T.confirm.cancel, onConfirm, onCancel,
}: {
  title: string
  /** What the answer costs. Not optional: a question worth a dialog is a question
   *  whose consequence is worth a sentence. */
  body: string
  confirmLabel: string
  /**
   * The safe answer, when "Cancelar" would be ambiguous.
   *
   * It was, in the first place this dialog was used: the review step already has
   * a Cancelar in its header that abandons the whole entry, so a Cancelar in a
   * dialog about abandoning the entry meant the opposite thing six centimetres
   * away from it. The default is fine anywhere that word is not already taken.
   */
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const safe = useRef<HTMLButtonElement>(null)

  // Back means "no", like every other sheet in this app — see `useBackClose`.
  useBackClose(true, onCancel)

  useEffect(() => {
    safe.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      // Above the detail sheets, which are z-10: this can be asked from inside
      // one of them.
      className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-6"
      onClick={event => { if (event.target === event.currentTarget) onCancel() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex w-full max-w-xs flex-col gap-3 rounded-2xl p-4"
        style={{ background: 'var(--paper)' }}
      >
        <p className="text-base font-semibold">{title}</p>
        <p className="text-sm text-ink-2">{body}</p>
        <div className="flex items-stretch gap-2 pt-1">
          <button
            ref={safe}
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold
                       focus-visible:outline focus-visible:outline-2"
            style={{ background: 'var(--surface)' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white
                       focus-visible:outline focus-visible:outline-2"
            style={{ background: 'var(--danger)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
