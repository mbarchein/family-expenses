# ── Domain: gafa.terragiro.es ───────────────────────────────
#
# The zone lives in Cloudflare; the hosting, in Vercel. The record is a
# **DNS-only (grey cloud)** CNAME towards Vercel's edge, and that detail is not
# optional here:
#
#  1. Spanish ISPs block the IPs of Cloudflare's *proxy*, not its DNS. DNS-only
#     means the traffic goes straight to Vercel and never touches the blocked
#     network. Proxied, we would be back at the problem that ruled Cloudflare
#     Pages out in the first place.
#  2. Proxying stacks two CDNs, which is latency and two places to debug a
#     cache in.
#  3. Behind a proxy, Vercel cannot issue or renew the certificate: the
#     validation never reaches it.

data "cloudflare_zone" "main" {
  filter = {
    name = var.domain_zone
  }
}

locals {
  app_fqdn = "${var.app_subdomain}.${var.domain_zone}"
  app_url  = "https://${var.app_subdomain}.${var.domain_zone}"
}

# Vercel verifies ownership and issues the certificate through the CNAME below.
resource "vercel_project_domain" "app" {
  project_id = vercel_project.app.id
  domain     = local.app_fqdn
}

resource "cloudflare_dns_record" "app" {
  zone_id = data.cloudflare_zone.main.zone_id
  name    = var.app_subdomain
  type    = "CNAME"
  content = var.vercel_cname_target
  proxied = false # grey cloud: see the note above
  ttl     = 1     # automatic

  depends_on = [vercel_project_domain.app]
}

output "app_url" {
  description = "Where the app lives"
  value       = local.app_url
}
