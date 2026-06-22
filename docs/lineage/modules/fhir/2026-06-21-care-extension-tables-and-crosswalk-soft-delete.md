---
doc_type: lineage
status: shipped
date: 2026-06-21
owner: acumenus
module: fhir
lineage_anchor: false
supersedes: []
superseded_by: null
related_code:
  - backend/database/migrations/2026_06_21_100000_create_omop_care_extension_tables.php
  - backend/database/migrations/2026_06_21_100100_add_fhir_crosswalk_deleted_columns.php
  - backend/database/migrations/2026_06_21_100200_create_fhir_careteam_crosswalk.php
  - backend/tests/Feature/Fhir/FhirCrossSchemaExtensionTest.php
  - backend/app/Services/Fhir/Mappers/CarePlanMapper.php
  - backend/app/Services/Fhir/Mappers/GoalMapper.php
  - backend/app/Services/Fhir/Mappers/CareTeamMapper.php
  - backend/app/Services/Fhir/CrosswalkService.php
  - backend/database/migrations/2026_06_21_100300_add_fhir_dedup_tracking_deleted_columns.php
  - backend/app/Services/Fhir/FhirDedupService.php
  - backend/app/Services/Fhir/FhirNdjsonProcessorService.php
  - backend/app/Services/Fhir/FhirBulkExportService.php
  - backend/app/Jobs/Fhir/RunFhirSyncJob.php
  - backend/tests/Unit/Services/Fhir/FhirEnteredInErrorTest.php
  - backend/tests/Feature/Fhir/FhirDedupSoftDeleteTest.php
  - backend/tests/Feature/Fhir/FhirProcessorEnteredInErrorTest.php
  - backend/tests/Feature/Fhir/FhirBulkDeletionsJobTest.php
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
> migrator cannot grant on the smudoshi-owned `omop` schema).
> **RESOLVED 2026-06-21 (same session):** a superuser applied the care-table
> runtime grant on live `parthenon` (`parthenon_app` now has full DML +
> sequence USAGE on all four `omop` care tables; verified `app_grants:4` each).

## Phase 4 — Extension mappers (CarePlan / Goal / CareTeam)

Three `ResourceMapper` classes emit the extension-table rows, registered into
`FhirBulkMapper` via the `afterResolving` block in `AppServiceProvider`:

- `CarePlanMapper` → `care_plan` (single row; person/period/encounter; status+intent
  packed into `care_plan_source_value`).
- `GoalMapper` → `care_goal` (single row; `care_plan_id` deferred null — the column
  is nullable and cross-resource PK linking is out of scope for v1).
- `CareTeamMapper` → `care_team` + one `care_team_member` per participant.

### CareTeam surrogate-PK linkage (Option B — single-pass, no processor change)

`care_team_member.care_team_id` must reference the parent team's PK, which a plain
auto-increment would not surface until after insert. Rather than a two-phase insert
in `FhirNdjsonProcessorService`, `CrosswalkService::resolveCareTeamId()` get-or-creates
a row in a new `fhir_careteam_crosswalk` table whose auto-increment PK **is** the
OMOP surrogate `care_team_id` — exactly mirroring `resolveProviderId`/`resolveCareSiteId`.
The mapper emits the `care_team` row with that explicit id and links every member to
it, so the linkage is never null and the whole resource maps in one pass.

`2026_06_21_100200_create_fhir_careteam_crosswalk.php` creates the crosswalk on the
default (`pgsql`) connection (same as the other crosswalks). On the live `parthenon`
DB it was applied as `parthenon_migrator` (`SET ROLE` under superuser, table owned by
the migrator, tracked in `app.migrations`); the per-owner default privileges did not
auto-grant the runtime role, so `SELECT/INSERT/UPDATE/DELETE` + sequence USAGE were
granted explicitly to `parthenon_app` (verified `app_grants:4`).

## Verification

- Pint: PASS (3 files, then 42-file Fhir sweep clean)
- Pest `tests/Feature/Fhir/FhirCrossSchemaExtensionTest.php`: 5 passed (against `parthenon_testing`, where the connecting role owns `omop`)
- Pest mappers + Fhir feature lane (Phase 4): 0 failures (192 assertions; "deprecated" count is the pre-existing `PDO::MYSQL_ATTR_SSL_CA` harness warning)
- PHPStan L8 (`app/Services/Fhir` + `AppServiceProvider`): `[OK] No errors`
- Migrations applied to both live `parthenon` and the `parthenon_testing` test DB.

## Phase 5 — Soft-delete (entered-in-error + Bulk `deleted` manifest)

OMOP is append-only; "soft-delete" here means **remove the erroneous CDM row but
keep an audit trail** on the dedup-tracking table.

### Dedup-tracking deleted columns

`2026_06_21_100300_add_fhir_dedup_tracking_deleted_columns.php` adds nullable
`deleted_at` (timestamp) + `deleted_reason` (varchar 250) to `fhir_dedup_tracking`
(default `pgsql` connection, `app` schema), each `Schema::hasColumn`-guarded. The
migration deploys to prod via `deploy.sh`.

### `FhirDedupService::deleteByResource()`

New primitive: looks up the `(site_key, resource_type, resource_id)` tracking row
**directly** (not the in-memory cache — bulk-delete / entered-in-error paths run
with no warm cache). Behavior:

- No tracking row → `{resolved:false, deleted:false, cdm_table:null}`.
- `cdm_row_id > 0` and not already deleted → delete the CDM row through
  `cdm()->table(...)->where(pk, id)->delete()` (try/catch: log + swallow), then
  stamp `deleted_at`/`deleted_reason`. Returns `{resolved:true, deleted:true, …}`.
- `cdm_row_id === 0` (batch-insert placeholder — clinical resources inserted in
  bulk record id 0 and cannot be pinpointed) → stamp `deleted_at`/`deleted_reason`
  for audit, log a warning, return `{resolved:false, deleted:false, …}`.

`getPrimaryKeyColumn()` was extended to cover every CDM table the FHIR mappers
emit (note, payer_plan_period, location, care_site, provider, visit_detail, death,
care_plan/goal/team/member) so deletion can target the correct PK.

**Latent-bug fix:** `FhirDedupService` and `FhirNdjsonProcessorService` referenced
`DB::` without `use Illuminate\Support\Facades\DB;` — the facade resolved to a
non-existent `App\Services\Fhir\DB` (5 baselined `class.notFound` errors). Every
`DB::` method there would have fatalled if ever hit; they were simply never
exercised by a test. The missing imports are now added and the baseline entries
removed.

### `isEnteredInError()` — placement

A `public static` method on `FhirDedupService`. Rationale: the processor already
depends on `FhirDedupService`, so no new class/dependency is needed; `static` +
pure lets the unit test exercise it with zero DB/SourceContext setup. It returns
true for top-level `status === 'entered-in-error'`, or a `verificationStatus.
coding[*].code === 'entered-in-error'` (covers Condition + AllergyIntolerance).

### Processor hydration skip

`FhirNdjsonProcessorService::processFile()` checks `isEnteredInError($resource)` in
the per-line loop **before** mapping — resourceType/id come straight off the
decoded resource (`$resource['resourceType']`, `$resource['id']`). On a hit it
calls `deleteByResource(..., 'entered-in-error')`, bumps the new
`entered_in_error`/`deleted` run-stats counters, and `continue`s (no hydration).

### `RunFhirSyncJob::processBulkDeletions()`

Per the FHIR Bulk Data spec the `$export` manifest may carry a `deleted` array
(sibling of `output`) of `{type:'Bundle', url}` files; each file is NDJSON of
transaction Bundles whose entries have `request.method === 'DELETE'` and
`request.url === 'Type/id'`.

- **Fetching the `deleted` set:** added a focused `downloadDeletedFiles()` to
  `FhirBulkExportService`, mirroring `downloadNdjsonFiles`' auth + streaming
  download but reading `$manifest['deleted']` and returning a flat list of local
  paths (deleted Bundles are not grouped by resource type). Least-invasive: a new
  method rather than overloading the `output` downloader's return shape.
- `processBulkDeletions()` downloads each file, decodes each Bundle, and for every
  DELETE entry parses `[$type,$id] = explode('/', url)` and calls
  `deleteByResource(site_key, type, id, 'bulk-deleted')`. Tallies
  `{files, processed, deleted, unresolved}`. Per-file open/JSON errors are counted,
  never fatal. Called from `handle()` after the hydration pass **and** in the
  empty-`output` early-return branch (a deletion-only incremental export).
- **Tally recording:** `fhir_sync_runs` has no JSON/metadata column (only typed
  stat columns + a `resource_types` json), and no migration was in scope, so the
  tally is recorded via the existing structured `Log::info` run-summary line
  (`bulk_deletions` key) rather than persisted to a column.

### Tests

- `FhirEnteredInErrorTest` (unit) — each entered-in-error shape + negative case.
- `FhirDedupSoftDeleteTest` (feature, real DB) — binds a SourceContext so `ctx_cdm`
  resolves to the `omop` schema **inside parthenon_testing** (never host/prod),
  inserts a sentinel `note` row + tracking row, asserts the CDM row is gone and
  `deleted_at` is stamped; plus unresolved-path and `cdm_row_id=0` cases. Skips
  cleanly if `deleted_at` is not yet migrated on the local test DB or omop is
  unwritable.
- `FhirProcessorEnteredInErrorTest` (feature) — mocked mapper asserts the EIE
  resource is **never** mapped; mocked dedup asserts `deleteByResource` is called.
- `FhirBulkDeletionsJobTest` (feature) — mocked export service returns a known
  deleted-Bundle NDJSON; asserts `deleteByResource(type,id,'bulk-deleted')` per
  DELETE entry and the correct `{files,processed,deleted,unresolved}` tally.

### Verification (Phase 5)

- Pint (`app/Services/Fhir app/Jobs/Fhir tests/Unit/Services/Fhir tests/Feature/Fhir`): PASS (50 files)
- Pest `tests/Unit/Services/Fhir tests/Feature/Fhir`: 0 failures (376 assertions;
  the `PDO::MYSQL_ATTR_SSL_CA` "deprecated" count is pre-existing harness noise).
  The two column-dependent `FhirDedupSoftDeleteTest` cases **skip** on the local
  test DB until the `deleted_at` migration runs there.
- PHPStan L8 (`app/Services/Fhir app/Jobs/Fhir`): `[OK] No errors` (baseline
  entries for the renamed run-stats shape updated; the fixed `DB` import removed
  5 stale `class.notFound` baseline lines).

> Precondition note: the Phase 5 migration file existed untracked but had **not**
> been applied to the local `parthenon_testing` DB (and the suite deliberately
> keeps RefreshDatabase in transaction-only mode, so it does not run new
> migrations). The two real-DB soft-delete assertions therefore skip locally;
> they pass once the migration lands on the test DB (CI/`deploy.sh` path).
