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

  # Null on a Vercel account with no team. Kept a string, so the precondition
  # below can compare it rather than trip over a null.
  vercel_team_id = vercel_project.app.team_id == null ? "" : vercel_project.app.team_id

  # Read by .github/workflows/deploy.yml. Taken off the Vercel resources, so
  # both exist from the very first apply.
  derived_variables = {
    VERCEL_ORG_ID     = var.vercel_org_id != "" ? var.vercel_org_id : local.vercel_team_id
    VERCEL_PROJECT_ID = vercel_project.app.id
  }

  # Also read by deploy.yml, and all of them optional in the same sense: not
  # created while empty. The first four are empty until somebody has walked
  # through DEPLOY.md 1-6; the last is empty until somebody decides which
  # address the legal pages should point at.
  optional_variables = {
    SCRIPT_ID     = var.apps_script_id
    DEPLOYMENT_ID = var.apps_script_deployment_id

    # Inlined into the bundle by Vite at build time.
    VITE_API_URL          = var.apps_script_exec_url
    VITE_GOOGLE_CLIENT_ID = var.google_oauth_client_id
    VITE_CONTACT_EMAIL    = var.contact_email
  }

  # An empty one is not created at all, and that is the whole point. GitHub
  # answers 422 to a variable with an empty value, so "created but blank" is not
  # a state that exists; and deploy.yml's preflight tests with `-n`, which
  # reads an absent variable and an empty one the same way. Leaving it out is
  # therefore what makes the workflow skip. Filling it with a placeholder to
  # keep the map whole would do the opposite: preflight would see a configured
  # deployment and publish a bundle with that placeholder inlined as the API
  # URL.
  #
  # VITE_CONTACT_EMAIL is deliberately NOT one of the values deploy.yml's
  # preflight insists on. A missing contact address makes the legal pages say so
  # in as many words; it is not a reason to refuse to publish the app.
  #
  # The filter runs over the input variables alone, never over the derived ones:
  # for_each needs its keys at plan time, and VERCEL_PROJECT_ID is not known
  # until the project exists.
  variables = merge(
    local.derived_variables,
    { for name, value in local.optional_variables : name => value if value != "" }
  )

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

  lifecycle {
    # Without this the apply dies on GitHub's 422 after having created half the
    # variables. The only one that can arrive here empty is VERCEL_ORG_ID: the
    # manual half's are filtered out above, and VERCEL_PROJECT_ID always has a
    # value once the project exists.
    precondition {
      condition     = each.value != ""
      error_message = "This Actions variable would be created empty, and GitHub rejects that with a 422. For VERCEL_ORG_ID it means the Vercel account has no team, so team_id came back null: read the account id off https://api.vercel.com/v2/user and put it in vercel_org_id."
    }
  }
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
    # The job names inside `verify`, not the workflow. A context that names
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
