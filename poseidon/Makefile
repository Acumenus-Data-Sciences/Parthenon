# Poseidon — dbt + Dagster development shortcuts
# Run from project root: make -f poseidon/Makefile <target>
# Or cd into poseidon/ and run: make -f Makefile <target>

COMPOSE = docker compose
WEBSERVER = poseidon-server
DBT_DIR = poseidon/dbt
PROFILES_DIR = poseidon/dbt

.PHONY: dbt-debug dbt-compile dbt-run dbt-test dbt-build dagster-dev help

## dbt-debug: Test database connection inside the container
dbt-debug:
	$(COMPOSE) exec $(WEBSERVER) dbt debug \
		--project-dir /app/$(DBT_DIR) \
		--profiles-dir /app/$(PROFILES_DIR)

## dbt-compile: Compile all dbt models (no execution)
dbt-compile:
	$(COMPOSE) exec $(WEBSERVER) dbt compile \
		--project-dir /app/$(DBT_DIR) \
		--profiles-dir /app/$(PROFILES_DIR)

## dbt-run: Run all dbt models
dbt-run:
	$(COMPOSE) exec $(WEBSERVER) dbt run \
		--project-dir /app/$(DBT_DIR) \
		--profiles-dir /app/$(PROFILES_DIR)

## dbt-test: Run all dbt tests
dbt-test:
	$(COMPOSE) exec $(WEBSERVER) dbt test \
		--project-dir /app/$(DBT_DIR) \
		--profiles-dir /app/$(PROFILES_DIR)

## dbt-build: Run dbt build (run + test combined)
dbt-build:
	$(COMPOSE) exec $(WEBSERVER) dbt build \
		--project-dir /app/$(DBT_DIR) \
		--profiles-dir /app/$(PROFILES_DIR)

## dagster-dev: Open Dagit UI in browser
dagster-dev:
	@echo "Dagit UI: http://localhost:3100"
	@open http://localhost:3100 2>/dev/null || xdg-open http://localhost:3100 2>/dev/null || true

## help: Show this help
help:
	@grep -E '^##' Makefile | sed 's/## //'
