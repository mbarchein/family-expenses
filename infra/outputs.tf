output "still_manual" {
  description = "What Terraform cannot create, and has to exist before `apply`"
  value = [
    "A copy of the spreadsheet (Drive has no provider)",
    "The Apps Script project bound to it, and its authorization",
    "The web app deployment, for apps_script_exec_url and apps_script_deployment_id",
    "The OAuth 2.0 Web client id — Google publishes no API to create one",
    "The Config tab's oauth_client_id and the two addresses",
  ]
}
