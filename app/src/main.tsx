import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Boundary } from './components/Boundary'
import { PRIVACY, TERMS, type LegalDocument } from './i18n/legal'
import { T } from './i18n/strings'
import { describeDevice, watchForFaults } from './lib/progress'
import { keepUpToDate } from './pwa'
import { LegalScreen } from './screens/LegalScreen'
import './index.css'

keepUpToDate()
// Before anything else renders, so an exception on the way in is reported by
// the splash rather than swallowed into a console nobody can open on a phone.
watchForFaults()
describeDevice({
  build: T.splash.facts.build,
  network: T.splash.facts.network,
  worker: T.splash.facts.worker,
  yes: T.splash.yes,
  no: T.splash.no,
})

/**
 * Two paths that are not the app.
 *
 * Google's consent screen has to link to a privacy policy and to terms, and
 * whoever checks those links has no account here — so they cannot live inside
 * `App`, which asks for a ledger and shows a sign-in wall before rendering
 * anything. A pathname switch is all this needs: the app's own screens have real
 * addresses — see `lib/route.ts` — and these two are not among them, since
 * neither one is the app.
 *
 * `app/vercel.json` rewrites every path to index.html, so these two arrive here
 * rather than as a 404.
 */
function legalDocument(pathname: string): LegalDocument | null {
  switch (pathname.replace(/\/+$/, '')) {
    case '/privacy': return PRIVACY
    case '/terms-and-conditions': return TERMS
    default: return null
  }
}

const legal = legalDocument(window.location.pathname)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boundary>
      {legal ? <LegalScreen doc={legal} /> : <App />}
    </Boundary>
  </StrictMode>,
)
