.PHONY: up down build fresh logs shell-php shell-node shell-python shell-r test lint fetch-fixtures

# CDISC Pilot Project (LZZT) reference dataset for SDTM testing.
# License: CDISC public-domain pilot data; not bundled in the repo (Phase 2 spec Q10).
# Reference: https://www.cdisc.org/standards/foundational/sdtm
LZZT_BASE_URL ?= https://github.com/cdisc-org/SDTMIG-Pilot-Datasets/raw/main/cdiscpilot01.zip
LZZT_DEST := templates/tests/fixtures/lzzt

fetch-fixtures: $(LZZT_DEST)/.fetched
	@echo "LZZT fixtures present at $(LZZT_DEST)"

$(LZZT_DEST)/.fetched:
	@mkdir -p $(LZZT_DEST)
	@echo "Fetching LZZT fixtures from $(LZZT_BASE_URL)..."
	@curl -fsSL "$(LZZT_BASE_URL)" -o $(LZZT_DEST)/cdiscpilot01.zip || \
		(echo "ERROR: CDISC LZZT fetch failed."; \
		 echo "Set LZZT_BASE_URL or copy a local cdiscpilot01.zip into $(LZZT_DEST) and re-run."; \
		 exit 1)
	@cd $(LZZT_DEST) && unzip -o cdiscpilot01.zip '*.xpt' && rm -f cdiscpilot01.zip
	@touch $(LZZT_DEST)/.fetched


up:
	docker compose --profile dev up -d

down:
	docker compose down

build:
	docker compose --profile dev build

fresh:
	docker compose down --remove-orphans
	docker compose --profile dev up -d --build
	docker compose exec php php artisan migrate:fresh --seed

logs:
	docker compose logs -f

shell-php:
	docker compose exec php sh

shell-node:
	docker compose exec node sh

shell-python:
	docker compose exec python-ai sh

shell-r:
	docker compose exec darkstar bash

test:
	docker compose exec php php artisan test
	docker compose exec node npm test -- --run
	docker compose exec python-ai pytest

lint:
	docker compose exec php ./vendor/bin/pint --test
	docker compose exec php ./vendor/bin/phpstan analyse
	docker compose exec node npm run lint
	docker compose exec python-ai mypy app/
