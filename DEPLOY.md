# DEPLOY — putting A medias in the air

One sitting at a computer, roughly half an hour. After it, the app is used from
a phone and updates ship from CI without anyone opening a browser again.

Nothing here touches the real ledger. Steps 1–8 run against a **copy**; §9 is
the switch, and it is the last thing you do.

It comes in two halves. The Google half is by hand, because none of it can be
automated — the reasons are one per line in [`infra/README.md`](infra/README.md).
Everything else is `terraform apply`.

What you need in front of you:

| | |
| --- | --- |
| A computer | `node` ≥ 22.12, and `terraform` ~> 1.15. The Sheets mobile app has no Apps Script menu and the editor is unusable on a phone. |
| The Google account | The one that owns the spreadsheet. |
| A Vercel token | Account Settings → Tokens. |
| A GitHub PAT | For `mbarchein/family-expenses`. Classic: `repo` and `workflow`. Fine-grained: **Administration**, **Secrets**, **Variables** and **Actions**, all read and write. Administration is the one that gets forgotten, and it is the one branch protection needs. |
| A Cloudflare token | `Zone:Read` and `DNS:Edit` on `terragiro.es`. |
| An R2 bucket | For Terraform's state. Or drop the `backend "s3" {}` block and keep the state local. |

The four values the manual half produces — a client id, an /exec URL, a script
id and a deployment id — are pasted once into `terraform.tfvars`, and Terraform
carries them to every place CI reads them from. Nothing gets typed into a web
panel twice.

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

Then, once per Google account, turn on the switch that `clasp` cannot turn on
for you: <https://script.google.com/home/usersettings> → **API de Google Apps
Script** → on. Without it `push` fails with `User has not enabled the Apps
Script API`, and nothing in the message says where the setting lives.

Back on your computer, in a clone of this repository:

```bash
npx --yes @google/clasp@2 login          # opens a browser once
cp apps-script/.clasp.json.example .clasp.json
$EDITOR .clasp.json                      # paste the script id
npx --yes @google/clasp@2 push --force
```

`clasp login` asks for its whole set of scopes and the consent screen is
accept-or-cancel — there is no subset to pick, and deselecting anything makes a
later `push` fail on a scope error that does not name what is missing. The
refresh token it leaves in `~/.clasprc.json` can create and overwrite any Apps
Script project of that account, not just this one, which is why it travels as a
secret and not as a variable. Revoke it at
<https://myaccount.google.com/permissions> if it ever leaks.

`.clasp.json` belongs at the **root of the repository**, not inside
`apps-script/`: the file itself carries `"rootDir": "./apps-script"` and points
down from above. It is gitignored.

Reload the editor: the five files are there.

> `clasp push` overwrites what is in the editor. It is the only direction that
> is ever used — edits made in the browser are lost on the next push, so make
> them here and push.

## 3. Prepare the spreadsheet

In the Apps Script editor, pick `setupSpreadsheet` from the function dropdown
and press **Ejecutar**. Google asks for authorization the first time; the
screen that warns the app is unverified is expected — it is your own script,
and **Configuración avanzada → Ir a (nombre)** gets past it.

It creates the `Config`, `Fijos` and `Sugerencias` tabs and writes the `id`
header in column G. `Sugerencias` arrives with two payment methods in it, so the
row of pills on the entry screen has something to show; fill in the rest by hand
whenever you like — the app reads it on every open.
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

## 7. Everything else: `terraform apply`

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # the four values from above, plus the three tokens
cp backend.hcl.example backend.hcl             # R2 bucket and endpoint
make init
make plan                                      # read it before applying
make apply
```

That creates the Vercel project rooted at `app/`, the DNS-only CNAME for
`gafa.terragiro.es`, branch protection on `main`, and every Actions variable and
secret the deploy workflow reads. The Vercel identifiers are taken off the
resources rather than copied, so they cannot drift from the project they name.

Two things worth knowing before the first `apply`:

- **The Vercel project stores no environment variables.** The `VITE_*` reach the
  build from Actions variables, so there is one place per value rather than two
  that can disagree.
- **Do not connect Vercel's Git integration.** It would deploy every push the
  moment it lands, checks or no checks, racing the workflow that does gate on
  them. Terraform leaves it disconnected by not declaring it; connecting it
  later in the dashboard undoes that silently.
- **The four values from the manual half can be left empty, and the apply still
  works.** Their Actions variables are simply not created while they are — see
  the comment in `infra/github.tf`, because the reason is not obvious. So this
  can be applied before §1–6 to get DNS propagating and the certificate issued,
  and applied again afterwards to fill them in. What must *not* be done is
  leaving the placeholders from `terraform.tfvars.example` in place: those are
  not empty, `deploy`'s preflight would take them for a configured
  deployment, and the app would ship with `XXXXXXXX` inlined as its API URL.

If the plan shows `VERCEL_ORG_ID` as empty — or the apply stops saying it would
be created empty — the account has no team and `team_id` came back null. Read
the account id off the API, because `vercel whoami` prints the username and not
an id:

```bash
curl -s https://api.vercel.com/v2/user \
  -H "Authorization: Bearer <vercel token>" | jq -r '.user.id'
```

Put it in `vercel_org_id` and re-plan.

Then push to `main` and watch `verify` and `deploy` go green.

Before Terraform has run, `deploy` does not fail — it skips both halves and
says so in the run summary. A deploy workflow that is permanently red is worse
than one that does nothing: it teaches everyone to ignore the red mark.

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
3. Update `apps_script_exec_url`, `apps_script_id` and
   `apps_script_deployment_id` in `terraform.tfvars` and `apply` again. Nothing
   is edited in a panel.
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

**The apply fails with 403 "Resource not accessible by personal access token".**
Branch protection and the vulnerability alerts need more than secrets and
variables do, so the giveaway is that those two failed while the secrets went
in. A fine-grained PAT is missing **Administration: read and write**; it can be
added to the existing token without regenerating it.

**A merge is blocked forever waiting on a check.** Branch protection lists the
job names inside `verify` — `app` and `backend` — not the workflow's name. If
a job is ever renamed, `infra/github.tf` has to be renamed with it.
