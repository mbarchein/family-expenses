import { useEffect, useRef, useState } from 'react'
import { Spinner } from './components/Spinner'
import { TabBar } from './components/TabBar'
import { T } from './i18n/strings'
import { AddScreen } from './screens/add/AddScreen'
import { BalanceScreen } from './screens/BalanceScreen'
import { ListScreen } from './screens/ListScreen'
import { FixedScreen } from './screens/FixedScreen'
import { PlacesScreen } from './screens/PlacesScreen'
import { renderSignInButton, setInteractionHandler, setSignedInHandler } from './auth/google'
import { PRIVACY, TERMS } from './i18n/legal'
import { useProgress, type Fact } from './lib/progress'
import { useRoute } from './lib/route'
import { useLedger } from './store/ledger'

/** How long the splash is allowed to be the whole app before it admits that
 *  something is wrong. */
const PATIENCE_MS = 15_000

export default function App() {
  const ledger = useLedger()
  // The screen comes from the address bar rather than from state, so a reload —
  // including the one the app performs on itself when a new version lands —
  // reopens what was open. See `lib/route.ts`.
  const { route, detail, go, openDetail, back, closeDetail } = useRoute()
  const [needsTap, setNeedsTap] = useState(false)
  const [stuck, setStuck] = useState(false)

  const refresh = ledger.refresh
  useEffect(() => {
    setInteractionHandler(() => setNeedsTap(true))
    // The other half of the sign-in button. Tapping it produces a credential
    // that no request is waiting for, so this is what turns it into a loaded
    // ledger; without it the tap set a token nobody read.
    setSignedInHandler(() => { setNeedsTap(false); void refresh() })
  }, [refresh])

  /**
   * The splash cannot be the last thing that ever happens.
   *
   * Two specific ways of never leaving 'loading' have been fixed — a silent
   * sign-in with no deadline, a network failure swallowed with nothing on
   * screen — and this is here so that a third one costs a message and a button
   * instead of another report that the app does not load. Anything that leaves
   * the status on 'loading' is a hang rather than an exception, so the error
   * boundary never sees it; this is the only thing that can.
   */
  useEffect(() => {
    if (ledger.status !== 'loading') return
    const timer = setTimeout(() => setStuck(true), PATIENCE_MS)
    return () => clearTimeout(timer)
  }, [ledger.status])

  // Stuck or not, the splash is the same screen: it already says what it is
  // waiting for and what went wrong, and being stuck only adds the way out.
  if (ledger.status === 'loading') return <Splash stuck={stuck} />
  if (ledger.status === 'forbidden') return <Message text={T.auth.forbidden} />
  // `needsTap` is not allowed to outlive a successful load. It used to be a
  // one-way latch — set when One Tap could not show itself, never cleared — so
  // an app that had signed in perfectly well behind the scenes still showed the
  // sign-in screen, and the only button on it reopened the account chooser.
  if (ledger.status === 'needsAuth' || (needsTap && ledger.status !== 'ready')) return <SignIn />
  // With a retry, because the commonest error here is a request that failed on
  // a phone in a lift, and a screen that only states that is a dead end.
  if (ledger.status === 'error') {
    return <Message text={ledger.error ?? T.errors.generic} onRetry={() => void ledger.refresh()} />
  }

  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-y-auto">
        {route === 'add' && (
          <AddScreen
            ledger={ledger}
            onLeave={back}
            detail={detail}
            onOpen={openDetail}
            onCloseDetail={closeDetail}
          />
        )}
        {route === 'list' && (
          <ListScreen
            ledger={ledger}
            onBack={back}
            editing={detail}
            onOpen={openDetail}
            onCloseEditor={closeDetail}
          />
        )}
        {route === 'balance' && <BalanceScreen ledger={ledger} onBack={back} />}
        {route === 'places' && (
          <PlacesScreen
            onBack={back}
            viewing={detail}
            onOpen={openDetail}
            onCloseDetail={closeDetail}
          />
        )}
        {route === 'fixed' && (
          <FixedScreen
            ledger={ledger}
            onBack={back}
            editing={detail}
            onOpen={openDetail}
            onCloseEditor={closeDetail}
          />
        )}
      </main>

      {/* Above the tab bar, in the accent colour, with a ring going round.
          It used to be eleven grey pixels on a grey strip saying "1 gasto sin
          subir", which is a sentence about the queue: true, and not what the
          person who just tapped Guardar is asking. They are asking whether it
          worked. So: Guardando…, at a size that is visible from the arm's
          length a phone is held at, and a spinner, because a strip that says
          the same thing whether or not anything is happening is furniture. */}
      {ledger.pending > 0 && (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 border-t-2 py-2 text-sm font-semibold"
          style={{
            background: 'var(--accent-soft)',
            borderColor: 'var(--accent)',
            color: 'var(--accent)',
          }}
        >
          {navigator.onLine
            ? <>
                <Spinner />
                {ledger.pending > 1 ? T.sync.savingMany(ledger.pending) : T.sync.saving}
                {/* `attempts` counts tries, and the first one is not a
                    retry — so nothing is said until the upload is genuinely
                    repeating itself, and then the count starts at one. */}
                {ledger.attempts > 1 && <> · {T.sync.retry(ledger.attempts - 1)}</>}
              </>
            : T.sync.offline}
        </p>
      )}

      <TabBar tab={route} onChange={go} />
    </div>
  )
}

/**
 * The screen the app spent four bugs hiding behind.
 *
 * It says which step it is on, how long that step has been going, and the last
 * thing that failed — so the answer to "se queda en el splash" is on the splash
 * rather than in a console that a phone will not open. `Fault` is deliberately
 * shown here as well as on the error screens: the failures worth reading are
 * often the ones the app recovered from and carried on past.
 */
function Splash({ stuck }: { stuck: boolean }) {
  const { step, since, fault, facts } = useProgress()
  const seconds = useSecondsSince(since)

  return (
    <div className="grid h-full place-items-center p-8">
      <div className="flex max-w-xs flex-col items-center gap-3 text-center">
        <p className="text-lg font-semibold">{T.appName}</p>
        <p className="text-sm text-ink-2" role="status" aria-live="polite">
          {T.splash[step]}
          {/* Not from the first second: a counter on a load that takes 300ms is
              a flicker, and on one that takes twenty it is the whole story. */}
          {seconds >= 3 && <span className="text-ink-3"> {T.splash.waiting(seconds)}</span>}
        </p>
        <Fault text={fault} />
        {/* Shown while it is stuck even with nothing broken: the address it is
            aimed at and the version it is running are the two questions asked
            first, and neither needs a failure to be worth answering. */}
        {(fault || stuck) && <Details facts={facts} />}
        {stuck && (
          <>
            <p className="text-sm text-ink-2">{T.errors.stuck}</p>
            <Button onClick={() => location.reload()} />
          </>
        )}
      </div>
    </div>
  )
}

/** The last failure, verbatim and in mono. It is not for the two people using
 *  the app to understand — it is for them to be able to read it out. */
function Fault({ text }: { text: string | null }) {
  if (!text) return null
  return (
    <p className="max-w-xs break-words font-mono text-[11px] leading-snug"
       style={{ color: 'var(--danger)' }}>
      {T.splash.fault}: {text}
    </p>
  )
}

function Button({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-4 py-2 text-sm font-semibold text-white"
      style={{ background: 'var(--accent)' }}
    >
      {T.errors.reload}
    </button>
  )
}

/** Ticks once a second while a step is in flight, and stops mattering the
 *  moment the step changes because `since` changes with it. */
function useSecondsSince(since: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  // Clamped, because `now` lags a step that has only just started and a
  // negative count on screen would look like a bug of its own.
  return Math.max(0, Math.floor((now - since) / 1000))
}

function Message({ text, onRetry }: { text: string; onRetry?: () => void }) {
  const { fault, facts } = useProgress()
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="max-w-xs text-sm text-ink-2">{text}</p>
        <Fault text={fault} />
        <Details facts={facts} />
        {onRetry && <Button onClick={onRetry} />}
      </div>
    </div>
  )
}

/**
 * Everything known about this phone, folded away.
 *
 * Closed by default because none of it means anything on a good day, and one tap
 * from open because "antes funcionaba" is a question about the difference
 * between two states and this is the only place that difference is written down:
 * which server, which build, which session, what the browser actually said.
 *
 * A real <details> element rather than something of ours — it is the one
 * disclosure widget that works with no JavaScript state, keeps the text
 * selectable, and can be read out by a screen reader as what it is.
 */
function Details({ facts }: { facts: readonly Fact[] }) {
  if (!facts.length) return null
  return (
    <details className="w-full max-w-xs text-left">
      <summary className="cursor-pointer text-xs text-ink-3">{T.splash.details}</summary>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-mono text-[11px]
                     leading-snug text-ink-2">
        {facts.map(fact => (
          <div key={fact.label} className="col-span-2 grid grid-cols-subgrid">
            <dt className="text-ink-3">{fact.label}</dt>
            {/* `break-all`, not `break-words`: the values that matter most here
                are a URL and a deployment id, which have no spaces to break at
                and would otherwise push the layout sideways. */}
            <dd className="break-all">
              {/* The endpoint is a link because opening it in a tab is the one
                  check that settles what a CORS failure was: JSON means the
                  deployment is alive and public, a Google login page means it is
                  not. Asking somebody to copy a 90-character URL off a phone
                  screen instead is asking them not to do it. */}
              {fact.value.startsWith('https://')
                ? <a href={fact.value} target="_blank" rel="noreferrer" className="underline">
                    {fact.value}
                  </a>
                : fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

/** Google requires its own button markup for the interactive flow, so this is
 *  a container it renders into rather than a button of ours. */
function SignIn() {
  const slot = useRef<HTMLDivElement>(null)
  const { fault } = useProgress()
  useEffect(() => { if (slot.current) renderSignInButton(slot.current) }, [])
  return (
    <div className="grid h-full place-items-center gap-4 p-8">
      <div className="flex flex-col items-center gap-4">
        <p className="text-lg font-semibold">{T.appName}</p>
        <div ref={slot} />
        {/* Without this, a blocked or slow accounts.google.com shows an empty
            space where the button should be and says nothing at all. */}
        <Fault text={fault} />
        {/* Reachable from inside the app as well as from Google's consent
            screen: whoever reviews those two links tends to look for them
            here too, and they are the only pages a visitor can read without
            an account. */}
        <p className="flex gap-4 text-xs text-ink-2">
          <a href="/privacy" className="underline">{PRIVACY.title}</a>
          <a href="/terms-and-conditions" className="underline">{TERMS.title}</a>
        </p>
      </div>
    </div>
  )
}
