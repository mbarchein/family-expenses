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

export function setInteractionHandler(handler: () => void) {
  onNeedsInteraction = handler
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

async function requestToken(): Promise<string> {
  await loadGsi()

  return new Promise<string>((resolve, reject) => {
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response: { credential: string }) => {
        const claims = decodeJwt(response.credential)
        cached = { token: response.credential, expiresAt: claims.exp * 1000 }
        if (claims.email) rememberEmail(claims.email)
        resolve(response.credential)
      },
      // Returning users are signed back in without a tap. This is the whole
      // reason the app can promise it opens on the keypad: the session renews
      // in the background and nobody sees a login screen twice.
      auto_select: true,
      itp_support: true,
      cancel_on_tap_outside: false,
    })

    google.accounts.id.prompt((notification: PromptNotification) => {
      // A prompt that cannot display itself is not an error — it usually means
      // the browser has no Google session, or One Tap is suppressed. The app
      // shows its own sign-in button instead of leaving a dead screen.
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
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
