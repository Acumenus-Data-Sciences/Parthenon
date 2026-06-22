---
doc_type: devlog
status: current
date: 2026-06-21
owner: acumenus
module: fhir
lineage_anchor: false
supersedes: []
superseded_by: null
related_code:
  - backend/database/migrations/2026_06_21_100000_create_omop_care_extension_tables.php
  - backend/database/migrations/2026_06_21_100100_add_fhir_crosswalk_deleted_columns.php
  - backend/tests/Feature/Fhir/FhirCrossSchemaExtensionTest.php
related_prs: []
---
# FHIR Ingestion Parity — Care-Extension Tables + Crosswalk Soft-Delete (DB Foundation 1.3–1.5)

**Date:** 2026-06-21
**Status:** Complete — DB-foundation tasks of the FHIR Ingestion Medgnosis-Parity Port

---

## Summary

DB foundation for inbound mappers covering 6 new FHIR resources. Three of them —
CarePlan, Goal, CareTeam — have no native OMOP CDM v5.4 landing table, so this
work adds OMOP-extension tables. Soft-delete support adds audit columns to the
existing `fhir_*_crosswalk` tables.

## Changes

### 1.4 — OMOP care-extension tables (`omop` connection)

`2026_06_21_100000_create_omop_care_extension_tables.php` creates four tables on
the `omop` connection (search_path `omop,vocab,php`), following the existing
OMOP-bridge migration convention (`2026_04_10_164500`, `2026_04_10_164600`):
`bigInteger` ids/concepts, `*_concept_id` default 0, nullable source/date
columns, `person_id` indexed, idempotent `hasTable` guards.

- `care_plan` — start/end dates, status/intent/category concepts, visit link, source value/concept
- `care_goal` — `care_plan_id` link, lifecycle + achievement status, goal source
- `care_team` — start/end dates, status, source value
- `care_team_member` — `care_team_id` link, provider/care-site, role concept + source

`down()` drops all four in reverse order.

### 1.5 — Crosswalk soft-delete audit columns (default connection)

`2026_06_21_100100_add_fhir_crosswalk_deleted_columns.php` adds nullable
`deleted_at` (timestamp) + `deleted_reason` (string 250) to the five crosswalk
tables, each `Schema::hasColumn`-guarded:
`fhir_patient_crosswalk`, `fhir_encounter_crosswalk`, `fhir_provider_crosswalk`,
`fhir_location_crosswalk`, `fhir_caresite_crosswalk`.

**Connection finding:** the crosswalk tables live on the **default** (`pgsql`)
connection, NOT `omop`. Verified against `CrosswalkService` (bare `DB::table(...)`)
and the two creating migrations (`2026_03_05_270001`, `2026_03_12_010001`, both
bare `Schema::create`). The ALTER therefore targets the default connection.

### 1.3 — Real-schema rollback validation harness

`tests/Feature/Fhir/FhirCrossSchemaExtensionTest.php` provides
`assertInsertableOmop()`, which runs a genuine INSERT against the live `omop`
connection inside an always-rolled-back transaction — catching missing columns,
NOT-NULL, and cast errors that mock tests cannot. The file skips gracefully when
omop is unwritable/absent (a `beforeEach` rolled-back person probe). One
self-test (person) plus four care-table smokes.

## PG role / privilege note (runtime/migrator/owner split)

The `omop` schema is owned by the host DBA (`smudoshi`), not `parthenon_owner`.
`parthenon_migrator` lacks CREATE on `omop` by default (same situation as the
`vocab` schema, cf. `2026_04_25_000050_grant_vocab_create_to_migrator.php`). A
superuser `GRANT CREATE ON SCHEMA omop TO parthenon_migrator` was applied so the
migration could run as the migrator.

Tables created by `parthenon_migrator` do **not** inherit the per-owner DEFAULT
PRIVILEGES that auto-grant DML to the runtime role `parthenon_app` (those exist
only for `smudoshi`-owned CDM tables). The migration therefore explicitly grants
`SELECT, INSERT, UPDATE, DELETE` plus sequence `USAGE` to `parthenon_app` on the
four new tables, guarded and non-fatal so a non-granting migrator role still
lands the DDL. On any fresh environment this self-grant runs as part of `up()`.

> Operator note: on the already-migrated live `parthenon` DB the runtime grant
> was not yet applied (the migration row predates the grant code, and the
> migrator cannot grant on the smudoshi-owned `omop` schema). Until a superuser
> applies it, `parthenon_app` cannot write the care tables on that one
> environment:
> ```
> sudo -u postgres psql parthenon -c "
>   GRANT SELECT,INSERT,UPDATE,DELETE ON omop.care_plan,omop.care_goal,omop.care_team,omop.care_team_member TO parthenon_app;
>   GRANT USAGE,SELECT ON SEQUENCE omop.care_plan_care_plan_id_seq,omop.care_goal_care_goal_id_seq,omop.care_team_care_team_id_seq,omop.care_team_member_care_team_member_id_seq TO parthenon_app;"
> ```

## Verification

- Pint: PASS (3 files)
- Pest `tests/Feature/Fhir/FhirCrossSchemaExtensionTest.php`: 5 passed (against `parthenon_testing`, where the connecting role owns `omop`)
- PHPStan (3 files): `[OK] No errors`
- Migrations applied to both live `parthenon` and the `parthenon_testing` test DB.
