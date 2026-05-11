# Vocabulary Schema Bootstrap Fix

Date: 2026-05-11

## Context

The Parthenon-EE `vEE-0.1.0-rc.6` clean VM drill found that a fresh database
could run the published EE images, but migrations failed when
`2026_04_24_000500_create_vsac_omop_crosswalk_view` joined `vocab.concept`.

Root cause: the PostgreSQL init path created `omop` but not `vocab`, while the
Laravel `vocab` connection used `search_path = vocab,omop,php`. PostgreSQL
silently ignores a missing schema in `search_path`, so the base vocabulary
migrations created OMOP vocabulary tables under `omop`.

## Change

- Create and grant `vocab` in the Postgres init SQL.
- Copy the init SQL into the Postgres image with mode `0644` so the postgres
  entrypoint can read it in a fresh container.
- Make the init SQL database-level `CREATE` grant target `current_database()`
  instead of assuming the database is named `parthenon`.
- Add an early Laravel migration that creates the core schemas for external
  PostgreSQL installs that do not use the Docker init script.
- Add a guard/repair migration that moves misplaced vocabulary tables from
  `omop` to `vocab`, drops empty duplicates, fails on data-bearing duplicates,
  and ensures `vocab.concept_tree` exists.
- Add a regression test that asserts the shared OMOP vocabulary tables live in
  `vocab`, not `omop`.

## Validation

- PHP syntax checks passed for both migrations and the regression test.
- Full clean migration smoke passed against a disposable PostgreSQL container
  built from the patched Postgres Dockerfile.
- The smoke confirmed `vocab.concept`, `vocab.concept_relationship`,
  `vocab.concept_ancestor`, `vocab.vocabulary`, `vocab.domain`, and
  `vocab.concept_tree` exist under `vocab`.
- `php artisan test --filter VocabSchemaBootstrapTest` passed against a fresh
  disposable PostgreSQL database.
