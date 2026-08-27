/**
 * The cross inside a text field.
 *
 * Inside rather than beside, for two reasons: a control next to the field takes
 * width away from the field, and on a phone the thumb is already on the box it
 * is meant to empty. Only rendered when there is something to clear — a cross on
 * an empty field is a control that does nothing, sitting exactly where a thumb
 * will find it.
 *
 * The caller owns the positioning context: this is `absolute`, so the wrapper has
 * to be `relative` and the input needs padding on the right to keep its text from
 * running underneath. Shared rather than copied because the third copy of the
 * same twelve lines was one too many — WebKit draws a cross of its own for
 * `type=search`, small and grey and only on some platforms, so that one is turned
 * off and this is drawn everywhere at a size a thumb can actually hit.
 */
export function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center
                 rounded-full text-ink-3 focus-visible:outline focus-visible:outline-2"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="h-4 w-4"
           fill="none" stroke="currentColor" strokeWidth={2.5}
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  )
}
