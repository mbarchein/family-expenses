import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PRIVACY, TERMS, type LegalDocument } from './i18n/legal'
import { keepUpToDate } from './pwa'
import { LegalScreen } from './screens/LegalScreen'
import './index.css'

keepUpToDate()

/**
 * Two paths that are not the app.
 *
 * Google's consent screen has to link to a privacy policy and to terms, and
 * whoever checks those links has no account here — so they cannot live inside
 * `App`, which asks for a ledger and shows a sign-in wall before rendering
 * anything. A pathname switch is the whole router this app needs: there are
 * three tabs and they are state, not URLs.
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
    {legal ? <LegalScreen doc={legal} /> : <App />}
  </StrictMode>,
)
