import { useEffect, useRef, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { T } from './i18n/strings'
import { AddScreen } from './screens/AddScreen'
import { BalanceScreen } from './screens/BalanceScreen'
import { ListScreen } from './screens/ListScreen'
import { renderSignInButton, setInteractionHandler } from './auth/google'
import { useLedger } from './store/ledger'

export default function App() {
  const ledger = useLedger()
  const [tab, setTab] = useState<Tab>('add')
  const [needsTap, setNeedsTap] = useState(false)

  useEffect(() => { setInteractionHandler(() => setNeedsTap(true)) }, [])

  if (ledger.status === 'loading') return <Splash />
  if (ledger.status === 'forbidden') return <Message text={T.auth.forbidden} />
  if (ledger.status === 'needsAuth' || needsTap) return <SignIn />
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
      </div>
    </div>
  )
}
