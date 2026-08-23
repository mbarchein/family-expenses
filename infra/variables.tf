# ── Credentials for Terraform itself ────────────────────────

variable "vercel_token" {
  description = "Vercel API token. Account Settings → Tokens."
  type        = string
  sensitive   = true
}

variable "github_owner" {
  description = "GitHub account that owns the repository"
  type        = string
  default     = "mbarchein"
}

variable "github_token" {
  description = "GitHub PAT with repo and actions scope"
  type        = string
  sensitive   = true
}

variable "cloudflare_api_token" {
  description = "Cloudflare token with Zone:Read and DNS:Edit on the zone"
  type        = string
  sensitive   = true
}

# ── What is being built ─────────────────────────────────────

variable "project" {
  description = "Vercel project name"
  type        = string
  default     = "family-expenses"
}

variable "vercel_org_id" {
  description = "Vercel team id. Leave empty to take it from the project — on a personal account with no team that field is null and this has to be the account id, from `vercel whoami`."
  type        = string
  default     = ""
}

variable "github_repository" {
  description = "Repository name, without the owner"
  type        = string
  default     = "family-expenses"
}

variable "domain_zone" {
  description = "DNS zone the app hangs from"
  type        = string
  default     = "terragiro.es"
}

variable "app_subdomain" {
  description = "Subdomain within the zone"
  type        = string
  default     = "gafa"
}

variable "vercel_cname_target" {
  description = "Vercel's edge hostname the CNAME points at"
  type        = string
  default     = "cname.vercel-dns.com"
}

# ── Outputs of the manual half ──────────────────────────────
#
# Everything below comes from Google, and none of it can be created by
# Terraform — the README explains why for each one. They are filled in by hand
# in terraform.tfvars after walking through DEPLOY.md, and from there Terraform
# carries them to the places CI reads them from, so nobody copies an identifier
# into a web panel twice.

variable "google_oauth_client_id" {
  description = "OAuth 2.0 Client ID (Web application). Public by nature: it ships in the bundle."
  type        = string
}

variable "apps_script_exec_url" {
  description = "The /exec URL of the Apps Script web app deployment"
  type        = string
}

variable "apps_script_id" {
  description = "Script id, from the Apps Script editor's URL"
  type        = string
}

variable "apps_script_deployment_id" {
  description = "Deployment id of the web app. CI updates this deployment rather than making a new one."
  type        = string
}

variable "clasprc_json" {
  description = "Contents of ~/.clasprc.json after `clasp login`. Holds a refresh token."
  type        = string
  sensitive   = true
}
