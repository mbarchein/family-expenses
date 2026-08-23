provider "vercel" {
  api_token = var.vercel_token
}

provider "github" {
  owner = var.github_owner
  token = var.github_token
}

# Only for the domain's DNS zone (domain.tf). The application's traffic does
# NOT go through Cloudflare: the record is DNS-only, see the note there.
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
