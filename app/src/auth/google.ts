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

const TOKEN_KEY = 'a-medias:token'

/**
 * The token survives the app being closed, and that is the fix to "why does it
 * ask me who I am every time I open it".
 *
 * It used to live in this variable and nowhere else, so every cold start began
 * with no credential and had to get a new one out of Google before the app could
 * ask for anything. That silent path is the least reliable thing in the whole
 * app — it needs a live Google session, an un-suppressed One Tap and a browser
 * willing to run it — and when it failed, which was often, the answer was a
 * login screen. Now a token that has not expired is simply still there: opening
 * the app twice in an afternoon does not involve Google at all.
 *
 * `localStorage` rather than IndexedDB because this one has to be readable
 * *synchronously* before the first request goes out, and it is one short string.
 * It is a bearer credential sitting on the phone, which is worth saying out
 * loud: identity only, no scope over anything, expires within the hour, and on
 * the same device that already holds the whole ledger cache. Section 12 of the
 * privacy policy has promised exactly this since it was written — "tu perfil,
 * para no pedirte la sesión cada vez" — so this is the code catching up with
 * the document.
 */
function load(): Cached | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as Cached
    return typeof stored?.token === 'string' && typeof stored.expiresAt === 'number'
      ? stored
      : null
  } catch {
    // Unreadable or not ours. A missing token costs a sign-in; a thrown
    // exception here would cost the whole app.
    return null
  }
}

function store(value: Cached | null) {
  try {
    if (value) localStorage.setItem(TOKEN_KEY, JSON.stringify(value))
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Private mode, or a full quota. The token stays in memory for this session.
  }
}

let cached: Cached | null = load()
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
  // From disk too, or the next cold start would hand the backend the very
  // credential it has just refused.
  store(null)
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
  store(cached)
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
  const known = cachedEmail()
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: receive,
    // Returning users are signed back in without a tap. This is the whole
    // reason the app can promise it opens on the keypad: the session renews
    // in the background and nobody sees a login screen twice.
    auto_select: true,
    itp_support: true,
    cancel_on_tap_outside: false,
    // Through the browser's own identity API rather than an iframe from
    // accounts.google.com. That iframe is third-party by definition, and a
    // browser that has stopped carrying third-party cookies — which is where
    // they are all going — turns the silent path off without saying so. FedCM
    // is the supported replacement and the reason this app can sign somebody
    // back in at all once the old path is gone.
    use_fedcm_for_prompt: true,
    // Which account, when the phone is signed in to several. Without it
    // `auto_select` has to pick, and a chooser is what it shows instead of
    // picking. The address comes from the last token this device accepted.
    ...(known ? { login_hint: known } : {}),
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
