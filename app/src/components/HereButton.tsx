import { Spinner } from './Spinner'
import { T } from '../i18n/strings'
import type { Reading } from '../lib/picker'

/**
 * "Usar dónde estoy ahora", and the refusal underneath it.
 *
 * The only control on the Sitios screen that reads the position, which is why it
 * is a button of its own and says so in as many words: the rule this app follows
 * is that nothing reads the device unless the thing that was pressed announced it
 * — see the coordinate bullet in `CLAUDE.md` and section 13 of the policy, which
 * name this button.
 *
 * Shared because it appears twice, on the two screens that choose a position, and
 * two copies would be two chances for one of them to go quiet on a refusal. That
 * is what the alert is for: this app cannot re-ask for a permission it has been
 * refused, so a button that silently did nothing would be indistinguishable from
 * a broken one.
 */
export function HereButton({ reading, onClick }: {
  reading: Reading
  onClick: () => void
}) {
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={reading === 'asking'}
        className="flex items-center justify-center gap-2 rounded-xl border border-line py-2.5
                   text-sm font-semibold disabled:opacity-60 focus-visible:outline
                   focus-visible:outline-2"
        style={{ background: 'var(--surface)' }}
      >
        {reading === 'asking' && <Spinner className="h-4 w-4" />}
        {reading === 'asking' ? T.places.fixAsking : T.places.fixHere}
      </button>

      {(reading === 'denied' || reading === 'unavailable') && (
        <p role="alert" className="text-xs" style={{ color: 'var(--danger)' }}>
          {reading === 'denied' ? T.places.denied : T.places.unavailable}
        </p>
      )}
    </>
  )
}
