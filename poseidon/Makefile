# Poseidon — dbt + Dagster development shortcuts
# Run from project root: make -f poseidon/Makefile <target>
# Or cd into poseidon/ and run: make -f Makefile <target>

COMPOSE = docker compose
WEBSERVER = poseidon-webserver
COMPOSE_EXEC = $(COMPOSE) exec -T
DBT_WORK_DIR = /app/storage/dbt_work

.PHONY: dbt-debug dbt-compile dbt-run dbt-test dbt-build dagster-dev help

## dbt-debug: Test database connection inside the container
dbt-debug:
	$(COMPOSE_EXEC) $(WEBSERVER) dbt debug \
		--project-dir $(DBT_WORK_DIR) \
		--profiles-dir $(DBT_WORK_DIR)

## dbt-compile: Compile all dbt models (no execution)
dbt-compile:
	$(COMPOSE_EXEC) $(WEBSERVER) dbt compile \
		--project-dir $(DBT_WORK_DIR) \
		--profiles-dir $(DBT_WORK_DIR)

## dbt-run: Run all dbt models
dbt-run:
	$(COMPOSE_EXEC) $(WEBSERVER) dbt run \
		--project-dir $(DBT_WORK_DIR) \
		--profiles-dir $(DBT_WORK_DIR)

## dbt-test: Run all dbt tests
dbt-test:
	$(COMPOSE_EXEC) $(WEBSERVER) dbt test \
		--project-dir $(DBT_WORK_DIR) \
		--profiles-dir $(DBT_WORK_DIR)

## dbt-build: Run dbt build (run + test combined)
dbt-build:
	$(COMPOSE_EXEC) $(WEBSERVER) dbt build \
		--project-dir $(DBT_WORK_DIR) \
		--profiles-dir $(DBT_WORK_DIR)

## dagster-dev: Open Dagit UI in browser
dagster-dev:
	@echo "Dagit UI: http://localhost:3100"
	@open http://localhost:3100 2>/dev/null || xdg-open http://localhost:3100 2>/dev/null || true

## help: Show this help
help:
	@grep -E '^##' Makefile | sed 's/## //'
