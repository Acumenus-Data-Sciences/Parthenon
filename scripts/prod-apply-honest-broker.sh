#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/smudoshi/Github/Parthenon"
BACKEND_DIR="$REPO_DIR/backend"
ENV_FILE="$BACKEND_DIR/.env"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$REPO_DIR/backups"
BACKUP_FILE="$BACKUP_DIR/prod-survey-pre-honest-broker-$STAMP.sql"

cd "$REPO_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

DB_HOST="$(grep '^DB_HOST=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
DB_PORT="$(grep '^DB_PORT=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
DB_DATABASE="$(grep '^DB_DATABASE=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
DB_USERNAME="$(grep '^DB_USERNAME=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
DB_PASSWORD="$(grep '^DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
DB_SUPERUSER="smudoshi"
DB_SUPERPASS="acumenus"

DB_PORT="${DB_PORT:-5432}"

echo "==> Honest broker prod rollout"
echo "Repo:      $REPO_DIR"
echo "DB host:   $DB_HOST:$DB_PORT"
echo "DB name:   $DB_DATABASE"
echo "App role:  $DB_USERNAME"
echo

mkdir -p "$BACKUP_DIR"

echo "==> Step 1: narrow survey backup"
export PGPASSWORD="$DB_PASSWORD"
pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USERNAME" \
  -d "$DB_DATABASE" \
  -n app \
  -t app.survey_campaigns \
  -t app.survey_conduct \
  -t app.survey_instruments \
  -t app.survey_items \
  -t app.survey_answer_options \
  -t app.survey_responses \
  -f "$BACKUP_FILE"

echo "Backup written to:"
echo "  $BACKUP_FILE"
echo

echo "==> Step 2: test superuser connectivity"
if ! PGPASSWORD="$DB_SUPERPASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB_DATABASE" -c 'select current_user;' >/dev/null; then
  echo "FAIL: could not connect as DB superuser [$DB_SUPERUSER]."
  echo "Stop here and verify the superuser credentials or host-level network access."
  exit 1
fi

echo "==> Step 3: apply additive schema directly as postgres"
PGPASSWORD="$DB_SUPERPASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB_DATABASE" <<'SQL'
BEGIN;

ALTER TABLE app.survey_campaigns
  ADD COLUMN IF NOT EXISTS requires_honest_broker boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS app.survey_honest_broker_links (
  id bigserial PRIMARY KEY,
  survey_campaign_id bigint NOT NULL REFERENCES app.survey_campaigns(id) ON DELETE CASCADE,
  survey_conduct_id bigint NULL REFERENCES app.survey_conduct(id) ON DELETE SET NULL,
  person_id bigint NULL,
  source_id bigint NULL REFERENCES app.sources(id) ON DELETE SET NULL,
  cohort_generation_id bigint NULL REFERENCES app.cohort_generations(id) ON DELETE SET NULL,
  blinded_participant_id varchar(64) NOT NULL UNIQUE,
  respondent_identifier_hash varchar(64) NOT NULL,
  respondent_identifier text NULL,
  match_status varchar(20) NOT NULL DEFAULT 'registered',
  submitted_at timestamp NULL,
  notes text NULL,
  created_by bigint NULL REFERENCES app.users(id) ON DELETE SET NULL,
  updated_by bigint NULL REFERENCES app.users(id) ON DELETE SET NULL,
  created_at timestamp NULL,
  updated_at timestamp NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'survey_hb_campaign_identifier_unique'
  ) THEN
    ALTER TABLE app.survey_honest_broker_links
      ADD CONSTRAINT survey_hb_campaign_identifier_unique
      UNIQUE (survey_campaign_id, respondent_identifier_hash);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS survey_hb_campaign_person_index
  ON app.survey_honest_broker_links (survey_campaign_id, person_id);

COMMIT;
SQL

echo
echo "==> Step 4: hand ownership of new table to app role"
PGPASSWORD="$DB_SUPERPASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB_DATABASE" <<SQL
ALTER TABLE app.survey_honest_broker_links OWNER TO "$DB_USERNAME";
GRANT ALL PRIVILEGES ON TABLE app.survey_honest_broker_links TO "$DB_USERNAME";
GRANT ALL PRIVILEGES ON SEQUENCE app.survey_honest_broker_links_id_seq TO "$DB_USERNAME";
SQL

echo
echo "==> Step 5: mark Laravel targeted migration as applied"
cd "$BACKEND_DIR"

if php artisan migrate:status | grep -q '2026_03_30_000002_add_honest_broker_support_to_surveys .* Ran'; then
  echo "Migration already recorded in Laravel."
else
  DB_HOST="$(grep '^DB_HOST=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
  DB_PORT="$(grep '^DB_PORT=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
  DB_DATABASE="$(grep '^DB_DATABASE=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'")"
  NEXT_BATCH="$(
    PGPASSWORD="$DB_SUPERPASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB_DATABASE" -tAc \
      "SELECT COALESCE(MAX(batch), 0) + 1 FROM app.migrations"
  )"

  PGPASSWORD="$DB_SUPERPASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_SUPERUSER" -d "$DB_DATABASE" <<SQL
INSERT INTO app.migrations (migration, batch)
SELECT '2026_03_30_000002_add_honest_broker_support_to_surveys', $NEXT_BATCH
WHERE NOT EXISTS (
  SELECT 1 FROM app.migrations
  WHERE migration = '2026_03_30_000002_add_honest_broker_support_to_surveys'
);
SQL
fi

echo
echo "==> Step 6: verify status"
php artisan migrate:status | tail -n 12

echo
echo "==> Done"
