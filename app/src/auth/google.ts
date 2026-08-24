/**
 * Google sign-in, identity only.
 *
 * The app asks for the openid/email/profile scopes and nothing else — never for
 * access to spreadsheets. That is what keeps it out of Google's app
 * verification and away from the warning screen a "sensitive scope" would put
 * in front of the two people who just want to type 23,50 and leave.
 *
 * Authorization happens on the other side: the Apps Script deployment checks
 * the email against the spreadsheet's own sharing list.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
const GSI_SRC = 'https://accounts.google.com/gsi/client'

/** Tokens last an hour. Refreshing a minute early costs nothing and avoids the
 *  request that would fail while it is in flight. */
const REFRESH_MARGIN_MS = 60_000

interface Cached {
  token: string
  expiresAt: number
}

let cached: Cached | null = null
let pending: Promise<string> | null = null
let onNeedsInteraction: (() => void) | null = null
let onSignedIn: (() => void) | null = null
/** Resolves the request that is waiting for a token, when there is one. */
let deliver: ((token: string) => void) | null = null
let initialised = false

export function setInteractionHandler(handler: () => void) {
  onNeedsInteraction = handler
}

/** Called when a credential arrives with nobody waiting for it — which is what
 *  happens every time the user signs in by tapping the button. */
export function setSignedInHandler(handler: () => void) {
  onSignedIn = handler
}

export function cachedEmail(): string | null {
  return localStorage.getItem('a-medias:email')
}

export function rememberEmail(email: string) {
  localStorage.setItem('a-medias:email', email)
}

export async function getIdToken(): Promise<string> {
  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached.token
  if (!pending) pending = requestToken().finally(() => { pending = null })
  return pending
}

/** Signals a token that is gone rather than merely old — used when the backend
 *  rejects one, so the next call re-prompts instead of retrying the same
 *  credential forever. */
export function invalidateToken() {
  cached = null
}

/**
 * Every credential Google hands over arrives here, from either of the two ways
 * in — and both of them have to work.
 *
 * The silent prompt has a request waiting for the token. The button the user
 * taps does not: its credential arrives long after that request gave up and
 * rejected, and calling resolve() on a settled promise is silence. That silence
 * was the whole bug. A valid token sat in `cached`, nothing asked for the
 * ledger again, the app stayed on the sign-in screen, and the button on it only
 * ever reopened the account chooser. So a credential with nobody waiting for it
 * tells the app instead.
 */
function receive(response: { credential: string }) {
  const claims = decodeJwt(response.credential)
  cached = { token: response.credential, expiresAt: claims.exp * 1000 }
  if (claims.email) rememberEmail(claims.email)

  const waiting = deliver
  deliver = null
  if (waiting) waiting(response.credential)
  else onSignedIn?.()
}

/** Once per page. `renderButton` delivers through the callback registered here,
 *  so the button is dead until this has run — which is why it is not left to
 *  whichever path happens to reach Google first. */
function initialise() {
  if (initialised) return
  initialised = true
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: receive,
    // Returning users are signed back in without a tap. This is the whole
    // reason the app can promise it opens on the keypad: the session renews
    // in the background and nobody sees a login screen twice.
    auto_select: true,
    itp_support: true,
    cancel_on_tap_outside: false,
  })
}

async function requestToken(): Promise<string> {
  await loadGsi()
  initialise()

  return new Promise<string>((resolve, reject) => {
    deliver = resolve

    google.accounts.id.prompt((notification: PromptNotification) => {
      // A prompt that cannot display itself is not an error — it usually means
      // the browser has no Google session, or One Tap is suppressed. The app
      // shows its own sign-in button instead of leaving a dead screen.
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        deliver = null
        onNeedsInteraction?.()
        reject(new Error('interaction required'))
      }
    })
  })
}

/** Renders the official button. Used only when the silent path above could not
 *  produce a token; Google requires its own markup for the visible flow. */
export function renderSignInButton(target: HTMLElement) {
  loadGsi().then(() => {
    initialise()
    google.accounts.id.renderButton(target, {
      theme: 'outline', size: 'large', shape: 'pill', locale: 'es', width: 260,
    })
  })
}

let gsiPromise: Promise<void> | null = null

function loadGsi(): Promise<void> {
  if (gsiPromise) return gsiPromise
  gsiPromise = new Promise((resolve, reject) => {
    if (typeof google !== 'undefined' && google.accounts?.id) return resolve()
    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google sign-in could not load'))
    document.head.appendChild(script)
  })
  return gsiPromise
}

/** Reads the payload without verifying it. That is fine here and only here:
 *  it is used for the expiry and the display name, both of which the backend
 *  re-derives from a token it does verify. Nothing is trusted on this side. */
function decodeJwt(token: string): { exp: number; email?: string } {
  const payload = token.split('.')[1]
  const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
  return JSON.parse(decodeURIComponent(escape(json)))
}

interface PromptNotification {
  isNotDisplayed?: () => boolean
  isSkippedMoment?: () => boolean
}

declare const google: {
  accounts: {
    id: {
      initialize: (config: Record<string, unknown>) => void
      prompt: (listener?: (n: PromptNotification) => void) => void
      renderButton: (el: HTMLElement, options: Record<string, unknown>) => void
    }
  }
}
