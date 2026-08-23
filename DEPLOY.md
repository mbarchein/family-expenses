# DEPLOY — putting A medias in the air

One sitting at a computer, roughly half an hour. After it, the app is used from
a phone and updates ship from CI without anyone opening a browser again.

Nothing here touches the real ledger. Steps 1–8 run against a **copy**; §9 is
the switch, and it is the last thing you do.

What you need:

- A computer with a browser and `node` ≥ 20. The Google Sheets mobile app has no
  Apps Script menu, and the editor is unusable on a phone.
- The Google account that owns the spreadsheet.
- A Vercel account.
- Control of DNS for `terragiro.es`.

---

## 1. Copy the spreadsheet

In the real ledger: **Archivo → Hacer una copia**. Name it something you will
not confuse at a glance — `Gastos (PRUEBAS)` — and work only in the copy until
§9.

Share the copy with both accounts, with edit permission. That sharing list *is*
the app's access control: there is no allowlist anywhere in the code.

> Sharing "to anyone with the link", or with a Google Group, does not work.
> Those grants cannot be enumerated and the backend rejects them. Share to named
> addresses.

## 2. Create the script and upload the code

In the copy: **Extensiones → Apps Script**. A bound project opens. Leave it.

Copy the script id out of the editor's URL — the long string between
`/projects/` and `/edit`.

Back on your computer, in a clone of this repository:

```bash
npx --yes @google/clasp@2 login          # opens a browser once
cp apps-script/.clasp.json.example .clasp.json
$EDITOR .clasp.json                      # paste the script id
npx --yes @google/clasp@2 push --force
```

Reload the editor: the five files are there.

> `clasp push` overwrites what is in the editor. It is the only direction that
> is ever used — edits made in the browser are lost on the next push, so make
> them here and push.

## 3. Prepare the spreadsheet

In the Apps Script editor, pick `setupSpreadsheet` from the function dropdown
and press **Ejecutar**. Google asks for authorization the first time; the
screen that warns the app is unverified is expected — it is your own script,
and **Configuración avanzada → Ir a (nombre)** gets past it.

It creates the `Config` and `Fijos` tabs and writes the `id` header in column G.
It never overwrites a `Config` that already exists, so it is safe to re-run.

Then run `backfillIds`. It gives every existing row an identifier, which is what
makes the history editable from a phone. Optional — without it the old rows
still count towards the balance, they just cannot be edited until each is
claimed individually.

## 4. Deploy the web app

**Implementar → Nueva implementación → Aplicación web**:

| Field | Value |
| --- | --- |
| Ejecutar como | Yo (your account) |
| Quién tiene acceso | Cualquier usuario |

"Cualquier usuario" looks alarming and is not. The endpoint answers nothing
without a valid Google ID token belonging to an account that can edit the
spreadsheet; the URL being guessable buys an attacker nothing.

Copy two things from the result:

- the **/exec URL** — the frontend's `VITE_API_URL`
- the **deployment id** — CI needs it to update this same deployment instead of
  minting a new URL nobody points at

Open the /exec URL in a browser. It should answer
`{"ok":true,"data":{"service":"a-medias","status":"ok"}}`.

## 5. Create the OAuth client

At <https://console.cloud.google.com/apis/credentials>, in the project the
script belongs to (the editor's **Configuración del proyecto** names it):

**Crear credenciales → ID de cliente de OAuth → Aplicación web**.

Authorized JavaScript origins:

```
https://gafa.terragiro.es
http://localhost:5173
```

No redirect URIs: the app uses Google Identity Services, which never leaves the
page.

On the consent screen, request only `openid`, `email` and `profile`. Those are
not sensitive scopes, so there is no verification to sit through. Publishing
status can stay **En pruebas** with both accounts added as test users, or go to
**En producción** — either works, and production avoids the weekly re-consent
that testing mode imposes.

Copy the **client id**.

## 6. Fill in Config

Back in the spreadsheet's `Config` tab:

| clave | valor |
| --- | --- |
| `oauth_client_id` | the client id from §5 |
| `persona_1_correo` | the account that pays into column C |
| `persona_2_correo` | the account that pays into column D |

Names and colours are already filled from the ledger's headers. Change them
freely — the app reads them from here, so renaming a person never means touching
a header or the code.

Now run `sanityCheck` in the editor and read the log. It prints the tab it is
looking at, the balance it reads, the formula behind it, both people with their
columns and addresses, and the accounts it will accept. If any line surprises
you, stop here — everything downstream assumes these are right.

## 7. Publish the frontend

On Vercel: **Add New → Project**, import `mbarchein/family-expenses`, and set
**Root Directory** to `app`.

Then **disconnect the Git integration** (Settings → Git → Ignored Build Step, or
disconnect the repository). Deploys come from `.github/workflows/desplegar.yml`,
which runs only after `verificar` passes. Leaving both connected gives you two
deployments racing on every push, and the one that wins is the one that skipped
the checks.

Environment variables, for Production and Preview:

```
VITE_API_URL=<the /exec URL from §4>
VITE_GOOGLE_CLIENT_ID=<the client id from §5>
```

Add `gafa.terragiro.es` under **Domains** and create the DNS record Vercel asks
for. HTTPS is issued automatically.

Repository secrets, under Settings → Secrets and variables → Actions:

| Secret | Where it comes from |
| --- | --- |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json` after `vercel link`, or Project Settings |
| `VERCEL_PROJECT_ID` | same place |
| `CLASPRC_JSON` | the whole contents of `~/.clasprc.json` after §2 |
| `SCRIPT_ID` | the script id from §2 |
| `DEPLOYMENT_ID` | the deployment id from §4 |

Push to `main` and watch `verificar` then `desplegar` go green.

Until those six secrets exist, `desplegar` does not fail — it skips both halves
and says so in the run summary. A deploy workflow that is permanently red is
worse than one that does nothing: it teaches everyone to ignore the red mark.

## 8. Install it on the phones

Open `https://gafa.terragiro.es` in Chrome on Android, sign in with Google, and
use **Añadir a pantalla de inicio**. On iOS the same lives under Share →
Add to Home Screen in Safari.

Try, on the copy:

- Save an expense. It should appear instantly, before the network answers.
- Check the row landed at the bottom of the sheet, with the balance formula
  filled down and an id in column G.
- Turn on airplane mode, save another, turn it off. It uploads by itself.
- Void one from the app. The row stays; both amounts go empty; the concept gains
  a `[anulado]` prefix; the balance corrects itself.

## 9. Switch to the real ledger

Only once §8 behaved. On the **real** spreadsheet:

1. **Archivo → Hacer una copia** first. A backup that predates anything the app
   ever wrote.
2. Extensiones → Apps Script, and repeat §2 (new script id), §3, §4.
3. Update `VITE_API_URL` in Vercel and `DEPLOYMENT_ID` / `SCRIPT_ID` in the
   repository secrets to the new deployment.
4. Add `oauth_client_id` and the two addresses to the new `Config` tab. The same
   OAuth client works — it is tied to the domain, not to the spreadsheet.
5. Run `sanityCheck` again and compare the balance it prints against the number
   at the bottom of column E.

Keep the copy. It is where anything gets tried from now on.

---

## When something goes wrong

**Everyone is rejected, including you.** `oauth_client_id` in `Config` does not
match the client id the app was built with. `sanityCheck` prints both ends.

**"Esa cuenta no puede editar la hoja"** for an account that plainly can. The
editor list is cached for five minutes; wait it out. If it persists, `getEditors`
is failing for lack of scope — the log says so — and the backend has fallen back
to the two addresses in `Config`. Either fill those in, or add
`https://www.googleapis.com/auth/drive.readonly` to `apps-script/appsscript.json`,
push, and re-authorize by running any function from the editor.

**Saving does nothing and the console shows a CORS error.** Something started
sending `application/json` or a custom header. Apps Script never answers OPTIONS,
so any request that triggers a preflight dies. See the comment at the top of
`apps-script/Api.js`.

**The balance in the app is not the one in the sheet.** It cannot be — the app
reads that cell. What it can be is a different cell: `sanityCheck` prints the row
it read from and the formula it found. A ledger with trailing blank rows below
the data is the usual cause.

**A row was appended in the wrong place.** `lastDataRow_` walks up from the
bottom of column A. Something below the ledger has a date in that column.

**CI deploys the backend and nothing changes.** `clasp deploy` updated a
different deployment id than the one the phones use. There is one URL that
matters, the one from §4.
