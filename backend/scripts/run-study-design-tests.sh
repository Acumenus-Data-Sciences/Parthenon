#!/usr/bin/env bash
set -euo pipefail

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-parthenon-postgres}"
PHP_CONTAINER="${PHP_CONTAINER:-parthenon-php}"
DB_PREFIX="${DB_PREFIX:-codex_study}"
ROLE_PREFIX="${ROLE_PREFIX:-codex_role}"
PASSWORD="${PASSWORD:-codex-study-design-test}"
TEST_PATH="${TEST_PATH:-tests/Feature/Api/V1/StudyDesignTest.php}"

suffix="$(date +%s)_$$"
db_name="${DB_PREFIX}_${suffix}"
role_name="${ROLE_PREFIX}_${suffix}"

cleanup() {
  if [[ "${db_name}" == codex_study_* && "${role_name}" == codex_role_* ]]; then
    docker exec "${POSTGRES_CONTAINER}" psql -U parthenon -d postgres -v ON_ERROR_STOP=1 \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${db_name}';" \
      -c "DROP DATABASE IF EXISTS \"${db_name}\";" \
      -c "DROP ROLE IF EXISTS \"${role_name}\";" >/dev/null
  fi
}
trap cleanup EXIT

if [[ "${db_name}" != codex_study_* || "${role_name}" != codex_role_* ]]; then
  echo "Refusing to create test database or role outside codex prefixes." >&2
  exit 1
fi

docker exec "${POSTGRES_CONTAINER}" psql -U parthenon -d postgres -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE \"${role_name}\" LOGIN PASSWORD '${PASSWORD}';" \
  -c "CREATE DATABASE \"${db_name}\" OWNER \"${role_name}\";" \
  -c "GRANT CREATE ON DATABASE \"${db_name}\" TO \"${role_name}\";" >/dev/null

docker exec -i "${POSTGRES_CONTAINER}" psql -U parthenon -d "${db_name}" -v ON_ERROR_STOP=1 >/dev/null <<SQL
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE SCHEMA IF NOT EXISTS app AUTHORIZATION "${role_name}";
CREATE SCHEMA IF NOT EXISTS omop AUTHORIZATION "${role_name}";
CREATE SCHEMA IF NOT EXISTS vocab AUTHORIZATION "${role_name}";
CREATE SCHEMA IF NOT EXISTS results AUTHORIZATION "${role_name}";
CREATE SCHEMA IF NOT EXISTS gis AUTHORIZATION "${role_name}";
CREATE SCHEMA IF NOT EXISTS eunomia AUTHORIZATION "${role_name}";
CREATE SCHEMA IF NOT EXISTS eunomia_results AUTHORIZATION "${role_name}";
CREATE SCHEMA IF NOT EXISTS php AUTHORIZATION "${role_name}";
CREATE SCHEMA IF NOT EXISTS webapi AUTHORIZATION "${role_name}";
CREATE SCHEMA IF NOT EXISTS inpatient AUTHORIZATION "${role_name}";
CREATE SCHEMA IF NOT EXISTS inpatient_ext AUTHORIZATION "${role_name}";
GRANT ALL ON SCHEMA app, omop, vocab, results, gis, eunomia, eunomia_results, php, webapi, inpatient, inpatient_ext TO "${role_name}";
SQL

docker exec \
  -e APP_ENV=testing \
  -e PGOPTIONS='-c search_path=app,php,public' \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_DATABASE="${db_name}" \
  -e DB_USERNAME="${role_name}" \
  -e DB_PASSWORD="${PASSWORD}" \
  -e DB_TEST_HOST=postgres \
  -e DB_TEST_PORT=5432 \
  -e DB_TEST_DATABASE="${db_name}" \
  -e DB_TEST_USERNAME="${role_name}" \
  -e DB_TEST_PASSWORD="${PASSWORD}" \
  -e PROTECTED_CONSOLE_DATABASES=parthenon \
  -w /var/www/html \
  "${PHP_CONTAINER}" vendor/bin/pest "${TEST_PATH}" --colors=never
