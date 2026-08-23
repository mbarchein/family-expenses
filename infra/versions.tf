terraform {
  required_version = "~> 1.15"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 3.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  # Remote state in Cloudflare R2, compatible with the s3 backend.
  # The configuration does not admit variables, so it is passed separately:
  #   terraform init -backend-config=backend.hcl
  # See backend.hcl.example and the README.
  backend "s3" {}
}
