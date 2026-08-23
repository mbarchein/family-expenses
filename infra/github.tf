# ── What CI needs to deploy ─────────────────────────────────
#
# Half the value of having this in Terraform is that the identifiers CI reads
# are derived from the resources above rather than pasted into a web panel: the
# Vercel project id reaches the Actions variables on its own, and cannot drift
# from the project it names.
#
# Secrets and variables are not the same thing and the split is deliberate.
# Anything that ends up inside the published bundle — the OAuth client id, the
# backend URL — is public the moment the app loads, and storing it as a secret
# would only make it harder to read while protecting nothing. What is actually
# a credential is a secret.

locals {
  repo = var.github_repository

  # Read by .github/workflows/desplegar.yml.
  variables = {
    VERCEL_ORG_ID     = var.vercel_org_id != "" ? var.vercel_org_id : vercel_project.app.team_id
    VERCEL_PROJECT_ID = vercel_project.app.id
    SCRIPT_ID         = var.apps_script_id
    DEPLOYMENT_ID     = var.apps_script_deployment_id

    # Inlined into the bundle by Vite at build time.
    VITE_API_URL          = var.apps_script_exec_url
    VITE_GOOGLE_CLIENT_ID = var.google_oauth_client_id
  }

  secrets = {
    VERCEL_TOKEN = var.vercel_token
    CLASPRC_JSON = var.clasprc_json
  }
}

resource "github_actions_variable" "ci" {
  for_each = local.variables

  repository    = local.repo
  variable_name = each.key
  value         = each.value
}

resource "github_actions_secret" "ci" {
  for_each = local.secrets

  repository  = local.repo
  secret_name = each.key
  value       = each.value
}

resource "github_repository_vulnerability_alerts" "app" {
  repository = local.repo
  enabled    = true
}

resource "github_branch_protection" "main" {
  repository_id = local.repo
  pattern       = "main"

  required_status_checks {
    strict = true
    # The job names inside `verificar`, not the workflow. A context that names
    # no real check is never reported, and a branch protection waiting on a
    # check that will never arrive blocks every merge forever.
    contexts = ["app", "backend"]
  }

  # A single operator: requiring another person's review would block the work.
  # What is required is that the checks pass first.
  enforce_admins      = false
  allows_deletions    = false
  allows_force_pushes = false
}
