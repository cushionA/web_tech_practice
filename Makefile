# Portfolio common tasks. Works in Git Bash / WSL / Linux / macOS.
# On Windows install make via Scoop (`scoop install make`) or use Git Bash.

.SHELLFLAGS := -eu -o pipefail -c
SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

# ---- repo-wide --------------------------------------------------------------

.PHONY: help
help: ## List available targets
	@awk 'BEGIN{FS=":.*##"; printf "Targets:\n"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "  %-22s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install-tooling
install-tooling: ## Install pre-commit (+commit-msg) + npm deps
	pre-commit install -t pre-commit -t commit-msg
	npm install

.PHONY: lint
lint: lint.ts ## Lint everything

.PHONY: format
format: format.ts ## Auto-format everything

# ---- typescript -------------------------------------------------------------

.PHONY: install.ts
install.ts: ## npm install (root TS tooling)
	npm install

.PHONY: lint.ts
lint.ts: ## eslint + prettier check (TS / React)
	npm run lint
	npm run format:check

.PHONY: format.ts
format.ts: ## prettier write + eslint --fix
	npm run format
	npm run lint:fix

.PHONY: typecheck.ts
typecheck.ts: ## tsc -b (no-op until apps registered in tsconfig references)
	npm run typecheck

# ---- compose ----------------------------------------------------------------

.PHONY: up
up: ## docker compose up --build -d
	docker compose up --build -d

.PHONY: down
down: ## docker compose down
	docker compose down

.PHONY: logs
logs: ## docker compose logs -f
	docker compose logs -f

.PHONY: ps
ps: ## docker compose ps
	docker compose ps

# ---- security ---------------------------------------------------------------

.PHONY: scan
scan: ## Run prompt-injection scan on staged changes
	python .claude/scripts/pr-validate.py --staged

.PHONY: secrets
secrets: ## Scan staged diff for secrets (gitleaks)
	gitleaks protect --staged --redact -v
