.PHONY: up down build fresh logs shell-php shell-node shell-python shell-r test lint

up:
	docker compose --profile dev up -d

down:
	docker compose down

build:
	docker compose --profile dev build

fresh:
	docker compose down -v
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
