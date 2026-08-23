# infra

The half of the deployment a machine can create. Terraform builds the Vercel
project, the DNS record, and every credential and identifier CI reads.

It does **not** build the Google half, and that is not an omission — see below.

Applied by hand, never from CI. The state holds live tokens, and a workflow that
can rewrite the platform is a wider blast radius than this project earns.

```bash
cp terraform.tfvars.example terraform.tfvars   # fill it in
cp backend.hcl.example backend.hcl             # fill it in
make init
make plan
make apply
```

## What Terraform cannot do here

Five things, all on Google's side, all genuinely unavailable rather than
skipped:

| Thing | Why not |
| --- | --- |
| Copying the spreadsheet | Drive has no Terraform provider. |
| The bound Apps Script project | No provider. The Apps Script API can create one with a `parentId`, but only under an interactive OAuth session — which is the thing being avoided. |
| Authorizing the script | A consent screen. Inherently a human clicking. |
| The web app deployment | `clasp deploy` can do it, but only once that authorization exists. |
| **The OAuth 2.0 Web client id** | The one that surprises people. Google publishes no API for creating Cloud Console OAuth clients, so no provider has a resource for it. `google_iap_client` is a different thing — it belongs to an IAP brand and is Workspace-internal. |

So the shape is: do the Google half by hand once (DEPLOY.md steps 1–6), paste
its four outputs into `terraform.tfvars`, and `apply`. From then on Terraform
owns everything else, and the outputs never get copied into a web panel twice.

## What it does own

- `vercel.tf` — the project. No environment variables on it: CI supplies the
  `VITE_*` at build time, so one place holds each value.
- `domain.tf` — a DNS-only CNAME. The comment there explains why the grey cloud
  is not a preference.
- `github.tf` — Actions variables and secrets, plus branch protection. The
  Vercel ids are read off the resources rather than pasted.

## Secrets and variables

Anything that ends up inside the published bundle is public the moment the app
loads. The OAuth client id and the backend URL are Actions *variables*; making
them secrets would obscure them from you and from nobody else. `VERCEL_TOKEN`
and `CLASPRC_JSON` are credentials, and those are secrets.
