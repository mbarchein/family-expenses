# Shortcuts. Everything here also works by hand; nothing is hidden in a script.
.PHONY: help install dev build test lint typecheck verify icons push-backend

help:
	@grep -E '^[a-z-]+:.*?## .*$$' $(MAKEFILE_LIST) | sed 's/:.*## /\t/' | column -t -s "$$(printf '\t')"

install:  ## Install the frontend dependencies
	cd app && npm install

dev:      ## Run the app locally against the deployed backend (needs app/.env)
	cd app && npm run dev

build:    ## Production build
	cd app && npm run build

test:     ## Unit tests
	cd app && npm run test

lint:     ## ESLint
	cd app && npm run lint

typecheck: ## TypeScript, no emit
	cd app && npm run typecheck

verify: lint typecheck test build  ## Everything CI runs, in the same order

icons:    ## Regenerate the PWA icons from the palette
	cd app && npm run icons

push-backend:  ## Upload the Apps Script sources (needs .clasp.json and clasp login)
	npx clasp push --force
