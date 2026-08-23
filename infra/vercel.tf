# ── Vercel: hosting for the PWA ─────────────────────────────
#
# The project stores no environment variable. CI is the only source of the
# VITE_*: `vercel build` runs in the workflow with them in its environment, and
# `vercel deploy --prebuilt` uploads the result. One place to change a value,
# and the bundle that ships is the one the checks were run against.

resource "vercel_project" "app" {
  name           = var.project
  framework      = "vite"
  root_directory = "app" # the Vite app lives in app/, not at the root

  # No access wall on any deployment. An interstitial in front of the PWA would
  # break the service worker and the manifest before they ever load.
  vercel_authentication = {
    deployment_type = "none"
  }

  # Vercel's own Git integration stays off: it would deploy every push the
  # moment it lands, checks or no checks, racing the workflow that does gate on
  # them. There is no field for "do not connect"; not declaring `git_repository`
  # is what leaves it disconnected.
}

output "vercel_url" {
  description = "Fallback URL, if the domain ever has trouble"
  value       = "https://${vercel_project.app.name}.vercel.app"
}
