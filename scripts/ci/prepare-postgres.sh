#!/usr/bin/env bash
set -euo pipefail

main_db="${PGDATABASE:-parthenon_test}"
test_db="${POSTGRES_TEST_DATABASE:-parthenon_testing}"
owner="${PGUSER:-parthenon}"
schemas=(
  app
  php
  omop
  vocab
  results
  gis
  eunomia
  eunomia_results
  finngen
  inpatient
  inpatient_ext
)

psql_db() {
  local database="$1"
  shift
  psql -v ON_ERROR_STOP=1 -h "${PGHOST:-127.0.0.1}" -p "${PGPORT:-5432}" -U "$owner" -d "$database" "$@"
}

prepare_database() {
  local database="$1"

  psql_db "$database" -c "CREATE EXTENSION IF NOT EXISTS vector;"
  psql_db "$database" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

  if [[ "${POSTGRES_ENABLE_POSTGIS:-0}" == "1" ]]; then
    psql_db "$database" -c "CREATE EXTENSION IF NOT EXISTS postgis;"
  fi

  for schema in "${schemas[@]}"; do
    psql_db "$database" -c "CREATE SCHEMA IF NOT EXISTS \"$schema\";"
  done
}

create_test_database() {
  local exists
  exists="$(psql_db "$main_db" -Atqc "SELECT 1 FROM pg_database WHERE datname = '$test_db';")"
  if [[ "$exists" != "1" ]]; then
    psql_db "$main_db" -c "CREATE DATABASE \"$test_db\" OWNER \"$owner\";"
  fi
}

prepare_database "$main_db"

if [[ "${POSTGRES_CREATE_TEST_DATABASE:-0}" == "1" ]]; then
  create_test_database
  prepare_database "$test_db"
fi
