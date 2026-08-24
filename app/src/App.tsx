import { useEffect, useRef, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { T } from './i18n/strings'
import { AddScreen } from './screens/add/AddScreen'
import { BalanceScreen } from './screens/BalanceScreen'
import { ListScreen } from './screens/ListScreen'
import { renderSignInButton, setInteractionHandler, setSignedInHandler } from './auth/google'
import { PRIVACY, TERMS } from './i18n/legal'
import { useLedger } from './store/ledger'

export default function App() {
  const ledger = useLedger()
  const [tab, setTab] = useState<Tab>('add')
  const [needsTap, setNeedsTap] = useState(false)

  const refresh = ledger.refresh
  useEffect(() => {
    setInteractionHandler(() => setNeedsTap(true))
    // The other half of the sign-in button. Tapping it produces a credential
    // that no request is waiting for, so this is what turns it into a loaded
    // ledger; without it the tap set a token nobody read.
    setSignedInHandler(() => { setNeedsTap(false); void refresh() })
  }, [refresh])

  if (ledger.status === 'loading') return <Splash />
  if (ledger.status === 'forbidden') return <Message text={T.auth.forbidden} />
  // `needsTap` is not allowed to outlive a successful load. It used to be a
  // one-way latch — set when One Tap could not show itself, never cleared — so
  // an app that had signed in perfectly well behind the scenes still showed the
  // sign-in screen, and the only button on it reopened the account chooser.
  if (ledger.status === 'needsAuth' || (needsTap && ledger.status !== 'ready')) return <SignIn />
  if (ledger.status === 'error') return <Message text={ledger.error ?? T.errors.generic} />

  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-y-auto">
        {tab === 'add' && <AddScreen ledger={ledger} />}
        {tab === 'list' && <ListScreen ledger={ledger} />}
        {tab === 'balance' && <BalanceScreen ledger={ledger} />}
      </main>

      {ledger.pending > 0 && (
        <p className="bg-surface-2 py-1.5 text-center text-[11px] text-ink-2">
          {navigator.onLine ? T.sync.pending(ledger.pending) : T.sync.offline}
        </p>
      )}

      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}

function Splash() {
  return (
    <div className="grid h-full place-items-center">
      <p className="text-sm text-ink-3">{T.appName}</p>
    </div>
  )
}

function Message({ text }: { text: string }) {
  return (
    <div className="grid h-full place-items-center p-8">
      <p className="max-w-xs text-center text-sm text-ink-2">{text}</p>
    </div>
  )
}

/** Google requires its own button markup for the interactive flow, so this is
 *  a container it renders into rather than a button of ours. */
function SignIn() {
  const slot = useRef<HTMLDivElement>(null)
  useEffect(() => { if (slot.current) renderSignInButton(slot.current) }, [])
  return (
    <div className="grid h-full place-items-center gap-4 p-8">
      <div className="flex flex-col items-center gap-4">
        <p className="text-lg font-semibold">{T.appName}</p>
        <div ref={slot} />
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
