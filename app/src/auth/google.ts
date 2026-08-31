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

import { T } from '../i18n/strings'
import { fault, report, state } from '../lib/progress'

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
  // Never the token itself — only whether there is one and how long it has left,
  // which is the part that explains a request being refused. A bearer credential
  // printed on a screen that gets photographed and sent to somebody is a
  // different bug from the one being chased.
  state(T.splash.facts.session, describeSession())
  const account = cachedEmail()
  if (account) state(T.splash.facts.account, account)

  if (cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) return cached.token
  if (!pending) pending = requestToken().finally(() => { pending = null })
  return pending
}

function describeSession(): string {
  if (!cached) return T.splash.session.none
  const minutes = Math.round((cached.expiresAt - Date.now()) / 60_000)
  return minutes > 0 ? T.splash.session.valid(minutes) : T.splash.session.expired(-minutes)
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

/**
 * How long the silent path is given before the app stops waiting for it.
 *
 * This number is the fix to "la app no carga". The silent attempt used to have
 * no deadline at all: it rejected only when the prompt reported that it could
 * not display itself, and with `use_fedcm_for_prompt` that report never comes —
 * Google does not invoke `isNotDisplayed()` or `isSkippedMoment()` once FedCM is
 * on. So every way FedCM can fail to produce a credential (no browser support,
 * a dialog the user closes, a mediation that goes nowhere) left this promise
 * pending for ever, `refresh()` never returned, the status never left 'loading',
 * and the app sat on the splash screen with no way out and nothing to catch it:
 * a hang is not an exception, so no error boundary sees it.
 *
 * Timing out early is safe in both directions. If the credential arrives after
 * the deadline it is not lost — `receive` finds nobody waiting and tells the app
 * through `onSignedIn`, which is the same path the tapped button uses.
 */
const SILENT_TIMEOUT_MS = 8_000

function requestToken(): Promise<string> {
  report('google')

  return new Promise<string>((resolve, reject) => {
    let settled = false

    const handOver = (token: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(token)
    }

    /**
     * No credential is coming. Hand the screen its sign-in button and write down
     * why — in red where something is broken, and as a fact where nothing is.
     *
     * That second case is most of them. «One Tap se ha saltado» is Google's word
     * for a silent prompt that came up and was not used, and being asked to tap
     * a button afterwards is the design rather than a failure — printed as
     * «Último error» it reads as something broken, and it was reported as one.
     * It still goes in the details panel, because a phone that never signs in
     * silently is worth being able to look into.
     */
    const giveUp = (why: string, broken = true) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (deliver === handOver) deliver = null
      if (broken) fault(why)
      else state(T.splash.facts.oneTap, why)
      onNeedsInteraction?.()
      reject(new Error('interaction required'))
    }

    deliver = handOver
    // Armed before Google is even fetched, and that is the point. The deadline
    // used to start after `await loadGsi()`, so a script request that hung
    // rather than failing — a captive portal, a DNS that never answers, a
    // connection dropped without being closed — hung the whole app in a place no
    // timeout was watching: neither `onload` nor `onerror` is guaranteed to
    // fire, and nothing else was ever going to settle that await.
    const timer = setTimeout(() => giveUp('Google no ha contestado a tiempo'), SILENT_TIMEOUT_MS)

    loadGsi().then(
      () => {
        if (settled) return
        initialise()
        prompt(giveUp)
      },
      (error: Error) => giveUp(error.message),
    )
  })
}

/**
 * The silent prompt, and the answers that mean no credential is on its way.
 *
 * A prompt that cannot display itself is not an error — it usually means the
 * browser has no Google session, or One Tap is suppressed. The app shows its own
 * sign-in button instead of leaving a dead screen. The two pre-FedCM moments are
 * still handled because the browsers that lack FedCM still report them; the
 * deadline in the caller covers the ones that do not.
 */
function prompt(giveUp: (why: string, broken?: boolean) => void) {
  google.accounts.id.prompt((notification: PromptNotification) => {
    // None of these three is a failure: no Google session, One Tap suppressed
    // after being closed a couple of times, or a prompt somebody dismissed. All
    // three mean the same thing — ask, with the button — so they are recorded
    // quietly and the screen invites instead of apologising.
    if (notification.isNotDisplayed?.()) {
      return giveUp('One Tap no se ha podido mostrar', false)
    }
    if (notification.isSkippedMoment?.()) return giveUp('One Tap se ha saltado', false)
    // Dismissal is also fired straight after a credential is handed over, with
    // that reason, so it cannot be treated as a failure on its own.
    const reason = notification.getDismissedReason?.()
    if (notification.isDismissedMoment?.() && reason !== 'credential_returned') {
      giveUp(`Google ha cerrado la ventana (${reason ?? 'sin motivo'})`, false)
    }
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
  isDismissedMoment?: () => boolean
  getDismissedReason?: () => string
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
