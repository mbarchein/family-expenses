import { Component, type ErrorInfo, type ReactNode } from 'react'
import { T } from '../i18n/strings'

/**
 * The last thing between a thrown error and a white screen.
 *
 * There was nothing here, so any exception during a render took the whole
 * interface with it and left a blank page — which from the outside is
 * indistinguishable from "the app does not load", from a request that never
 * answered, and from a sign-in that failed. That ambiguity cost an evening of
 * guessing, and this is the fix: whatever happens, the screen says something,
 * and it says what.
 *
 * The message is shown rather than hidden behind a friendly euphemism. There are
 * two users, one of whom can read a stack trace, and neither of them is helped
 * by "algo ha ido mal" when the text underneath it would have said which line.
 */
export class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept for a phone plugged into a laptop, which is the only debugger this
    // app will ever have.
    console.error('a medias:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="grid h-full place-items-center p-6">
        <div className="flex max-w-sm flex-col gap-3 text-center">
          <p className="text-base font-semibold">{T.errors.crashed}</p>
          <p className="font-mono text-xs break-words text-ink-2">{error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mx-auto rounded-xl px-5 py-2.5 text-sm font-bold
                       focus-visible:outline focus-visible:outline-2"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
          >
            {T.errors.reload}
          </button>
          <p className="text-[11px] text-ink-3">{T.errors.queueSafe}</p>
        </div>
      </div>
    )
  }
}
