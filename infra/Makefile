.PHONY: help init plan apply fmt

help:
	@grep -E '^[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | column -t -s "$$(printf '\t')"

init:  ## Initialise with the remote state (needs backend.hcl)
	terraform init -backend-config=backend.hcl

plan:  ## What would change
	terraform plan

apply: ## Apply it
	terraform apply

fmt:   ## Format the HCL
	terraform fmt -recursive
