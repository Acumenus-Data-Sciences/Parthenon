# Phase 13: FinnGen Endpoint Universalization (Standard-First Resolver) — Research

**Researched:** 2026-04-17
**Domain:** OMOP vocabulary resolution / Finnish source-code cross-walk / Laravel migration + Artisan command / React endpoint-browser UI
**Confidence:** HIGH for the schema, existing code, and live-DB facts. MEDIUM for the FinnGen-authored cross-walk payload (licenses and formats confirmed; row counts and clinical precedence will be finalized during authoring, not research).

## Summary

Phase 13 is a tightly-scoped resolver refactor + data-migration phase sitting on top of an already-shipped FinnGen phenotyping foundation (PHENO-01..08, landed 2026-04-16, 5,161 endpoints live in `app.cohort_definitions`). The plumbing is already correct: `FinnGenConceptResolver`, `FinnGenEndpointImporter`, `FinnGenPatternExpander`, `ImportEndpointsCommand`, and the R worker `finngen_endpoint_generate_execute` already follow a standard→source→descendant-expansion flow that the Universalization work only has to *lift* — not rebuild.

The work breaks into four mechanical tracks:

1. **Resolver upgrade** — add a `source_to_concept_map` (STCM) lookup path *before* the existing vocab.concept LIKE-ANY path, so Finnish source codes go through the FinnGen-authored cross-walk first. Fall back to the existing path for ICD-10/9/ATC that already resolve today. Return both standard and source arrays exactly as before (caller contract stable).
2. **Cross-walk authoring + idempotent seed migration** — ship a versioned data migration that DELETE+INSERTs FinnGen-authored rows into `vocab.source_to_concept_map` (note: the table is created in the `omop` schema by migration `2026_03_01_150009`, but Parthenon's CDM connections put `vocab` first in search_path — this is a real discrepancy that the planner MUST resolve, see Open Questions).
3. **`coverage_profile` column + re-scan** — add a `coverage_profile` VARCHAR(16) column to `app.cohort_definitions` (or store it on the top level of `expression_json`), populate it from resolver output during re-import, and surface it in the endpoint browser.
4. **One-shot re-import with rollback snapshot** — snapshot `expression_json` + `coverage_bucket` + `name` into `app.finngen_endpoint_expressions_pre_phase13`, then run the existing batch-per-500 importer with `--overwrite` semantics. The importer already wraps each 500-row batch in its own `DB::transaction`, so "one shot" here means "one phase-merge invocation" — NOT a single PG transaction across all 5,161 rows (which would take locks too long for the live cohort_definitions table and would also blow out WAL segment budget on a 12 MB table with 11 kB average JSONB per row).

**Primary recommendation:** Do the resolver upgrade in `FinnGenConceptResolver` behind a single new private method `resolveViaStcm()` that runs BEFORE `resolveLikeAny()` and merges results. Keep the existing four-method public interface (`resolveIcd10`, `resolveIcd9`, `resolveAtc`, `resolveIcd8`) — do not change the caller contract. Add two new methods `resolveIcdO3()` and `resolveNomesco()` for the cancer/procedure branches that previously dumped to the unmapped sidecar. The R worker needs zero changes (confirmed below).

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cross-walk strategy**
- **D-01:** Ship a FinnGen-authored `vocab.source_to_concept_map` cross-walk as the primary coverage lift mechanism. No new rows in `vocab.vocabulary`. No concept_id ≥ 2B block allocation. The cross-walk table alone handles Finnish source codes → standard concepts.
- **D-02:** Cross-walk source priority: (1) FinnGen's own published mapping references (LibraryOfEndpoints repo, DF14 endpoint definitions spreadsheet), (2) OHDSI Phoebe / Athena for gaps, (3) curated manual mappings for anything remaining that is clinically high-value. Document the provenance of each row (sourced-from column or companion manifest).
- **D-03:** Cross-walk coverage targets by vocab: ICD-8 → ICD10CM/SNOMED, NOMESCO → SNOMED Procedure, KELA_REIMB → RxNorm class (or ATC where reimbursement class implies a drug class), ICD-10-FI → ICD10CM parent where one exists. ICDO3 uses OMOP's existing standard ICDO3 vocabulary — no new cross-walk needed, just resolver preference.
- **D-04:** Grants: all new rows owned by `parthenon_migrator` with explicit `GRANT SELECT` to `parthenon_app` per HIGHSEC §4.1.

**Coverage classification**
- **D-05:** Add a `coverage_profile` column (or JSON field on existing `coverage_bucket` metadata) with three values: `universal` / `partial` / `finland_only`.
- **D-06:** The existing `coverage_bucket` column (FULLY_MAPPED / PARTIAL / UNMAPPED) remains the per-source resolution metric; `coverage_profile` is the portability metric. Both are populated by the resolver.
- **D-07:** Invariant enforced at end of phase: no endpoint is simultaneously `coverage_bucket = UNMAPPED` AND `coverage_profile = universal`.

**UX for Finland-only endpoints**
- **D-08:** Keep Finland-only endpoints visible in the FinnGen Endpoint Browser. Render a "Requires Finnish CDM" pill next to the endpoint name. Disable the per-source "Generate" CTA for non-Finnish sources with a tooltip. Do not hide, do not tab-separate, do not delete.
- **D-09:** When a Finnish-sourced CDM eventually attaches (Phase 18.5), Finland-only endpoints light up automatically against that source via existing per-source badges — no additional UI change needed.

**Success-criteria calibration**
- **D-10:** Empirical baseline first. Before locking any coverage percentage, the phase runs a dry-run pass of the upgraded resolver against all 5,161 endpoints and reports the actual `coverage_profile` distribution.
- **D-11:** Binary success criteria that are locked regardless of the baseline scan:
  - UNMAPPED bucket < 100 endpoints
  - No `vocab.vocabulary` insertions
  - `coverage_profile` populated on every endpoint
  - At least one previously-UNMAPPED endpoint generates on PANCREAS with `subject_count > 0`

**Re-import and rollback**
- **D-12:** One-shot re-processing at phase merge. Phase 13's final task re-runs `finngen:import-endpoints --release=df14 --overwrite` wrapped with rollback-snapshot protection.
- **D-13:** Ship a rollback snapshot migration: `app.finngen_endpoint_expressions_pre_phase13` copies `(cohort_definition_id, name, expression_json, coverage_bucket, created_at)` immediately before the overwrite. Persists at least one milestone.
- **D-14:** Generation history (`app.finngen_endpoint_generations`) preserved through re-import.

**Delivery mechanism**
- **D-15:** Laravel migration for schema changes. Extend `ImportEndpointsCommand` with `--overwrite` behavior. No Python ETL.
- **D-16:** The curated FinnGen cross-walk ships as a data migration that seeds `vocab.source_to_concept_map` via `DB::table()->insert()` with idempotent upsert semantics.

### Claude's Discretion

- File layout for the cross-walk manifest (per-vocab CSV vs single JSON vs SQL migration with inline literals) — planner picks.
- Whether `coverage_profile` lives on `cohort_definitions` as a typed column or inside `expression_json` — planner picks based on existing schema patterns.
- Naming of the rollback snapshot table — planner picks.
- R worker updates needed — researcher investigates (answered below: zero changes needed).

### Deferred Ideas (OUT OF SCOPE)

- **Phase 18.5: Finnish CDM Enablement** — Custom Finnish OMOP vocabulary load (GENOMICS-12b). Registers ICD-8, ICD9_FIN, ICD-10-FI, ICDO3-FI, NOMESCO, KELA_REIMB as custom OMOP vocabularies with concept_id ≥ 2B. Not in v1.0.
- Auto-translation of Finnish concept_name / synonym content to English.
- HPO integration as additional cross-walk target.
- Phoebe recommendation integration for auto-suggesting cross-walk targets.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GENOMICS-12a | FinnGen endpoint universalization via standard-first resolver; curated `source_to_concept_map` cross-walk; `coverage_profile` metadata; re-process 5,161 live expressions with rollback snapshot. No concept_id ≥ 2B block allocation. | Resolver code path identified (FinnGenConceptResolver.resolveLikeAny); STCM table schema already exists in `omop` schema; importer already has idempotent re-run semantics; R worker is transparent to resolver output (works off resolved `condition_concept_ids` + `drug_concept_ids` + `source_concept_ids` arrays that the importer writes). |

## Project Constraints (from CLAUDE.md / HIGHSEC.spec.md)

These directives from `./CLAUDE.md` (Parthenon) and `.claude/rules/HIGHSEC.spec.md` apply to every plan produced from this research. Call out compliance explicitly in task actions.

| # | Directive | Source | Enforcement point |
|---|-----------|--------|-------------------|
| C-1 | HIGHSEC §4.1 — `parthenon_migrator` owns all new rows in `vocab.*` and `app.*`; explicit `GRANT SELECT, INSERT, UPDATE, DELETE` to `parthenon_app` wrapped in `DO $grants$ ... END $grants$` with `pg_roles` existence guard. | HIGHSEC.spec.md §4.1 | Every migration |
| C-2 | HIGHSEC §3.1 — Every new Eloquent model uses `$fillable`. Never `$guarded = []`. | HIGHSEC.spec.md §3.1 | New models (if any) |
| C-3 | HIGHSEC §2.1 — Every new API route behind `auth:sanctum` + permission middleware. The endpoint-browser routes already are; no new public routes. | HIGHSEC.spec.md §2 | Route definitions |
| C-4 | Enum casing UPPERCASE. `CohortDomain::FINNGEN_ENDPOINT` (not `FinngenEndpoint`). | `/home/smudoshi/.claude/CLAUDE.md` §Laravel | Enum references |
| C-5 | **Run Pint via Docker after every PHP edit:** `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"` — not host Pint. CI runs Docker Pint, so parity matters. | CLAUDE.md (Parthenon) | After every PHP change |
| C-6 | **Recharts Tooltip formatter cast:** `formatter={((value: number) => [\`${value}\`, '']) as never}`. Endpoint browser may gain a tooltip — enforce the cast. | CLAUDE.md (Parthenon) | Any Recharts tooltip |
| C-7 | **Vite build stricter than `tsc --noEmit`:** run BOTH `npx tsc --noEmit` AND `npx vite build` before commit. | CLAUDE.md (Parthenon) | Frontend checks |
| C-8 | **`--legacy-peer-deps` for npm install** if a new package is introduced (react-joyride peer dep). | CLAUDE.md (Parthenon) | npm install (unlikely in this phase) |
| C-9 | **No `any` in TypeScript** — use `unknown` and narrow. `coverage_profile` type must be a literal union. | CLAUDE.md (Parthenon) | Types file |
| C-10 | **PG transaction poisoning:** event listeners that write must use nested transactions. Resolver itself does not listen, but the importer already batches every 500 rows — keep that pattern; do NOT promote to a single 5,161-row transaction (WAL pressure + lock span). | CLAUDE.md (Parthenon) | Importer batch loop |
| C-11 | **Component props — use `Pick<T,...>`** when only a subset is needed. Browser row component will only consume a subset of `EndpointSummary` — already does; preserve. | CLAUDE.md (Parthenon) | EndpointRow component |
| C-12 | **Always use `./deploy.sh --frontend`** after frontend changes. Not just vite build — production Apache serves `frontend/dist/`. | CLAUDE.md (Parthenon) | Deploy task |
| C-13 | **NoBareConnectionCallRule** PHPStan check bans bare `omop` connection access in resolver code. The existing resolver uses the `vocab` connection explicitly; new code must do the same. | FinnGenConceptResolver.php comment | Resolver code |
| C-14 | `vocab` schema is SHARED across all CDM sources. Every CDM connection puts `vocab` in `search_path`. Cross-walk rows inserted once serve every source. | CLAUDE.md (Parthenon) | Migration scope |
| C-15 | OMOP vocabulary tables (`vocab.concept`, `vocab.concept_relationship`, `vocab.concept_ancestor`) are **read-only** — no INSERT/UPDATE/DELETE on these. Only `vocab.source_to_concept_map` is writable in this phase. | CLAUDE.md (Parthenon) + HIGHSEC | Migration scope |
| C-16 | **Tests first** (TDD). Min coverage 80%. Resolver changes MUST have unit tests; re-import MUST have a feature test; coverage_profile MUST have fixture-based assertion. | `/home/smudoshi/.claude/rules/common/testing.md` | Task ordering |

## Standard Stack

This phase reuses the stack already in the Parthenon backend + frontend. Nothing new is adopted; all dependencies are pinned and resolved against the live codebase.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Laravel | 11.x | Migration + Artisan command + Eloquent | Already the backend framework [VERIFIED: composer.json, all existing FinnGen code]. |
| PHP | 8.4 | Language runtime | Project-pinned [VERIFIED: CLAUDE.md §Tech Stack]. |
| Pest | 3.x | Test framework (`backend/tests/Unit`, `backend/tests/Feature`) | Already in use for all FinnGen tests [VERIFIED: `backend/tests/Unit/FinnGen/*.php`, `backend/tests/Feature/FinnGen/*.php`]. |
| React | 19 | Endpoint browser UI | Already in use in `frontend/src/features/finngen-endpoint-browser/` [VERIFIED: `package.json`]. |
| TypeScript | strict | Type system for browser UI and API contracts | Project-enforced [VERIFIED: CLAUDE.md §Tech Stack]. |
| TanStack Query | v5 | API hooks (`useEndpointList`, `useEndpointStats`, `useEndpointDetail`, `useGenerateEndpoint`) | Already used by the endpoint browser [VERIFIED: `frontend/src/features/finngen-endpoint-browser/hooks/useEndpoints.ts`]. |
| PostgreSQL | 16 (Docker) / 17 (host) | Data store | Project default [VERIFIED: CLAUDE.md §Tech Stack]. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `DB::connection('vocab')` | Laravel | Shared `vocab` schema access | Used for all resolver SQL — the shared vocab connection has `search_path = vocab,omop,php` and is the correct entry point for reads of `vocab.concept`, `vocab.concept_relationship`, and `vocab.source_to_concept_map` [VERIFIED: `FinnGenConceptResolver.php:139-151`]. |
| Pest Mockery integration | Pest 3.x | Resolver stubbing in importer tests | The existing `ImportEndpointsCommandTest.php` binds `Mockery::mock(FinnGenConceptResolver::class)` into the container — reuse this pattern for `--overwrite` tests [VERIFIED: `ImportEndpointsCommandTest.php:22-38`]. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `vocab.source_to_concept_map` (data migration) | Athena/Phoebe bulk import of ICDO3, NOMESCO, KELA_REIMB vocabularies as concepts ≥ 2B | Forbidden by D-01 and GENOMICS-12a. Deferred to Phase 18.5. |
| Per-vocab CSV files committed to `backend/database/fixtures/finngen/crosswalk/` | Single JSON manifest | CSV preferred — lines up with IRSF `scripts/irsf_etl/data/vocabulary/*.csv` precedent, allows `git diff` review per vocab, and tolerates UTF-8 clinical strings without escaping. Planner picks; recommend CSV. |
| `coverage_profile` as top-level column on `app.cohort_definitions` | `coverage_profile` nested inside `expression_json` | **Recommend typed column.** Reasons: (a) indexable for browser filter queries, (b) parallel to existing `domain` + `quality_tier` typed columns, (c) the existing `expression_json->>'coverage_bucket'` JSON path is already the pattern and the phase would benefit from promoting to typed — but promoting `coverage_bucket` is out of scope. Instead, add `coverage_profile` as its own typed column with a matching `.index()`, and also store it inside `expression_json.coverage_profile` for the resolver's self-describing output. |
| Single mega-transaction for 5,161-row rewrite | Existing batched 500-row transactions (current importer behavior) | Existing batches are correct. [VERIFIED: `FinnGenEndpointImporter.php:87` — `BATCH_SIZE = 500`, `DB::transaction($batch, ...)` at line 124]. A single 5,161-row transaction would hold row locks on `cohort_definitions` for the full duration (several seconds to a minute), blocking the browser API during deploy. The rollback is safer: snapshot table, plus the existing batched re-import. |

**Installation:** No new packages. All changes are within the existing Laravel + React stack.

**Version verification:** Not applicable — no new packages. Existing pinned versions verified against repo state on 2026-04-17.

## Architecture Patterns

### Recommended File Layout

```
backend/
├── app/
│   ├── Services/FinnGen/
│   │   ├── FinnGenConceptResolver.php           # MODIFY — add resolveViaStcm + resolveIcdO3 + resolveNomesco + resolveKelaReimb
│   │   ├── FinnGenEndpointImporter.php          # MODIFY — consume new resolver methods, emit coverage_profile
│   │   └── FinnGenCoverageProfileClassifier.php # NEW — pure function: resolver output → universal|partial|finland_only
│   ├── Enums/
│   │   └── CoverageProfile.php                  # NEW — enum with UNIVERSAL, PARTIAL, FINLAND_ONLY (UPPERCASE per C-4)
│   ├── Console/Commands/FinnGen/
│   │   └── ImportEndpointsCommand.php           # MODIFY — add --overwrite flag + pre-snapshot hook
│   └── Http/Controllers/Api/V1/FinnGen/
│       └── EndpointBrowserController.php        # MODIFY — expose coverage_profile in list + detail payloads
├── database/
│   ├── migrations/
│   │   ├── 2026_04_18_000100_add_coverage_profile_to_cohort_definitions.php   # NEW — typed column + index
│   │   ├── 2026_04_18_000200_create_finngen_endpoint_expressions_pre_phase13.php # NEW — rollback snapshot
│   │   └── 2026_04_18_000300_seed_finngen_source_to_concept_map.php           # NEW — data migration (idempotent DELETE+INSERT)
│   └── fixtures/finngen/crosswalk/              # NEW
│       ├── icd8_to_icd10cm.csv                  # NEW — FinnGen + Phoebe
│       ├── icd10_fi_to_icd10cm.csv              # NEW — ICD-10-FI extensions with ICD-10-CM parent
│       ├── nomesco_to_snomed.csv                # NEW — NOMESCO procedure → SNOMED Procedure
│       ├── kela_reimb_to_rxnorm.csv             # NEW — KELA reimb class → RxNorm class (or ATC)
│       ├── icdo3_resolver_note.md               # NEW — documents that ICDO3 is NOT present in vocab.vocabulary today
│       └── PROVENANCE.md                        # NEW — per-row source attribution manifest
frontend/src/features/finngen-endpoint-browser/
├── api.ts                                       # MODIFY — add coverage_profile to EndpointSummary + EndpointDetail
├── pages/FinnGenEndpointBrowserPage.tsx         # MODIFY — render "Requires Finnish CDM" pill, disable Generate CTA for finland_only
└── components/
    └── CoverageProfileBadge.tsx                 # NEW — small component reused in row + detail drawer
```

### Pattern 1: Resolver Standard-First Chain

**What:** Prefer `vocab.source_to_concept_map` FIRST, then fall back to `vocab.concept LIKE ANY(...) JOIN concept_relationship 'Maps to'`.
**When to use:** Every resolve call from the importer.
**Example:**

```php
// Source: new code; pattern follows existing FinnGenConceptResolver.php:129-177
private function resolveViaStcm(string $sourceVocab, array $prefixes): array
{
    // Exact match + LIKE for prefix expansion on source_code.
    // STCM rows are curated, so no LIKE-ANY truncation risk (< ~10k rows total).
    $like = array_map(static fn (string $p): string => $p . '%', $prefixes);
    $arrayLiteral = '{' . implode(',', $like) . '}';

    $rows = DB::connection('vocab')->select(
        'SELECT DISTINCT stcm.target_concept_id
         FROM vocab.source_to_concept_map stcm
         WHERE stcm.source_vocabulary_id = ?
           AND stcm.source_code LIKE ANY(?::text[])
           AND stcm.invalid_reason IS NULL
           AND stcm.target_concept_id <> 0',
        [$sourceVocab, $arrayLiteral]
    );

    $standard = [];
    foreach ($rows as $row) {
        $standard[(int) $row->target_concept_id] = true;
    }
    return array_keys($standard);
}
```

### Pattern 2: Idempotent DELETE+INSERT Seed Migration

**What:** Data migration seeds `vocab.source_to_concept_map` by deleting all rows matching the FinnGen-owned vocabularies first, then inserting fresh rows in a single transaction per vocab.
**When to use:** When loading a curated cross-walk that must stay in sync with a source file.
**Example:**

```php
// Source: adapted from scripts/irsf_etl/lib/vocab_loader.py pattern (Phase 6, 2026-03-27)
// and the existing FinnGen UNMAPPED DELETE-semantics in ImportEndpointsCommand --overwrite
public function up(): void
{
    $ownedVocabs = ['ICD8', 'NOMESCO', 'KELA_REIMB', 'ICD10_FIN'];
    $crosswalkPath = base_path('database/fixtures/finngen/crosswalk');

    DB::transaction(function () use ($ownedVocabs, $crosswalkPath): void {
        foreach ($ownedVocabs as $vocab) {
            DB::connection('vocab')->table('vocab.source_to_concept_map')
                ->where('source_vocabulary_id', $vocab)
                ->delete();
        }
        foreach (glob("{$crosswalkPath}/*.csv") as $file) {
            $this->loadCsvInto($file);
        }
    });

    // HIGHSEC §4.1 grants (C-1)
    DB::statement("
        DO \$grants\$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app') THEN
                GRANT SELECT ON vocab.source_to_concept_map TO parthenon_app;
            END IF;
        END
        \$grants\$
    ");
}
```

### Pattern 3: Batched Re-Import with Pre-Snapshot

**What:** Before `--overwrite` rewrites `cohort_definitions.expression_json`, copy the current state into a snapshot table in the same phase-merge command.
**When to use:** Any time a data migration irreversibly rewrites live application rows.
**Example:**

```php
// Source: new code in ImportEndpointsCommand.php, pattern from IRSF migration ordering
public function handle(FinnGenEndpointImporter $importer): int
{
    if ((bool) $this->option('overwrite')) {
        $this->info('Snapshotting current FinnGen cohort_definitions...');
        DB::connection('pgsql')->statement('
            INSERT INTO app.finngen_endpoint_expressions_pre_phase13
                (cohort_definition_id, name, expression_json, coverage_bucket, created_at, snapshotted_at)
            SELECT
                id, name, expression_json, expression_json->>\'coverage_bucket\', created_at, NOW()
            FROM app.cohort_definitions
            WHERE domain = ?
            ON CONFLICT (cohort_definition_id) DO UPDATE
              SET expression_json = EXCLUDED.expression_json,
                  coverage_bucket = EXCLUDED.coverage_bucket,
                  snapshotted_at  = EXCLUDED.snapshotted_at
        ', ['finngen-endpoint']);
    }

    // ...existing importer dispatch, now receives overwrite=true
}
```

### Anti-Patterns to Avoid

- **Promoting the 5,161-row re-import to a single PG transaction.** The current 500-row batch pattern is correct (C-10). A single mega-transaction would hold locks on `app.cohort_definitions` (a live browser-read table) for the full import duration and would stack WAL writes for an 11 kB × 5,161 = 56 MB JSONB rewrite into one commit point. KEEP batching.
- **Mutating `vocab.concept` or `vocab.concept_relationship`.** Forbidden by D-01 and CLAUDE.md rule 6. The entire universalization must live in `vocab.source_to_concept_map`.
- **Changing the resolver's public method signatures** (`resolveIcd10(array $patterns): array{standard, source, truncated}`). All callers downstream — the importer, the R worker's `condition_concept_ids` payload, feature tests — rely on this shape. Upgrade the *internals*; preserve the *interface*.
- **Hiding Finland-only endpoints from the browser** (D-08 forbids). The UI must make the Finnish-CDM dependency visible, not silent.
- **Writing coverage_profile into `expression_json` only** (no typed column). The browser filter UI needs an indexable column; the JSON path works for the self-describing output but not for the list-view filter.
- **Introducing new database connections** (e.g., `omop_write`, `stcm`). The existing `vocab` connection with `search_path = vocab,omop,php` already covers `vocab.source_to_concept_map`. No new connections.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-walk table schema | A new table for FinnGen cross-walks | `vocab.source_to_concept_map` (already created by migration `2026_03_01_150009`) | OMOP v5.4 has a canonical STCM table for exactly this purpose; it supports `source_vocabulary_id` + `target_vocabulary_id` + date ranges + `invalid_reason`. Reuse. |
| Coverage classification math | Complex scoring system | Pure-function classifier: if any branch resolves via standard concept → partial; if ALL branches resolve via standard → universal; if ZERO resolve outside Finnish vocab → finland_only | Three mutually exclusive buckets driven by resolver output counts. No need for weights or thresholds. |
| Idempotent data-migration DELETE+INSERT | Custom "upsert" logic per row | `DB::transaction( DELETE WHERE source_vocab_id IN (...); INSERT ... )` | Already the established IRSF pattern [VERIFIED: `scripts/irsf_etl/lib/vocab_loader.py`]. |
| Rollback mechanism | Out-of-band backup file | Snapshot table with same schema shape as the source rows + `snapshotted_at` column | Ships in-repo, testable, queryable, recoverable with a single SQL UPDATE. |
| Re-import orchestration | New Artisan command | Extend `finngen:import-endpoints` with `--overwrite` flag | The command already exists and handles progress reporting, author resolution, Solr reindex, coverage JSON output. Adding a flag is strictly additive. |
| Cross-walk authoring tool | A custom mapping UI | FinnGen-published references + Athena OHDSI vocabulary cross-walks + manual clinical curation (in that order) — CSV-committed | FinnGen's own mapping files exist in `FINNGEN/phenotype-matching` (MIT) and `FINNGEN/pan-ukbb-mapping` (MIT). Athena has public ICD10 → SNOMED mappings already in vocab.concept_relationship. |

**Key insight:** Every piece of this phase has a proven pattern in the codebase already. The work is 75% "wire up the existing resolver + importer to a new data-migration seed" and 25% "curate the CSV cross-walk files." Don't invent — reuse.

## Runtime State Inventory

This phase is a rename-adjacent refactor: the resolver changes its *behavior* but not its callers. The re-import explicitly rewrites `app.cohort_definitions.expression_json` for 5,161 rows. Every other "stored state" must be audited so the re-import doesn't leave stale references.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `app.cohort_definitions.expression_json` — 5,161 rows tagged `finngen-endpoint` [VERIFIED: `SELECT COUNT(*) FROM app.cohort_definitions WHERE domain='finngen-endpoint'` → 5,161]. `app.finngen_unmapped_codes` — 9,527 rows today, must be re-populated post-re-import [VERIFIED live DB]. `app.finngen_endpoint_generations` — per D-14, preserved through re-import (generation rows reference `cohort_definition_id` by FK, which is stable; `expression_json` rewrite does not change the `id`). | (1) Snapshot into `app.finngen_endpoint_expressions_pre_phase13` before overwrite. (2) `app.finngen_unmapped_codes` is re-populated by the importer's existing `flushUnmapped` flow — no migration needed; verify it still produces reasonable rows post-resolver-upgrade. (3) `app.finngen_endpoint_generations` unchanged. |
| **Live service config** | Solr `cohorts` configset indexes `expression_json` content — a bulk `solr:index-cohorts --fresh` runs at the end of the import per existing `ImportEndpointsCommand.php:100-110`. No external UI config (n8n, Datadog) is involved. | Re-import already triggers Solr reindex. Nothing to manually reconcile. |
| **OS-registered state** | None. No Task Scheduler, no pm2 / systemd registrations reference the FinnGen endpoint names or resolver internals. | None — verified by `grep` over `docker/`, no systemd units. |
| **Secrets/env vars** | `FINNGEN_PG_RO_PASSWORD` / `FINNGEN_PG_RW_PASSWORD` govern the `parthenon_finngen_ro/rw` roles [VERIFIED: `backend/database/migrations/2026_04_13_014502_create_finngen_db_roles.php:24-27`]. The resolver doesn't use these roles — it uses `DB::connection('vocab')` which is `parthenon_app`. No secret rotation needed. | None. |
| **Build artifacts** | `storage/app/finngen-endpoints/df14-coverage.json` — coverage report written per import run. It is regenerated every import; the post-phase-13 version will show the lifted buckets. | None — auto-regenerates. |

**Nothing found in category — OS-registered state:** None. Verified by review of `docker-compose.yml`, systemd unit search, and FinnGen-specific file search across the repo.

## Common Pitfalls

### Pitfall 1: `vocab.source_to_concept_map` schema discrepancy (critical)

**What goes wrong:** The migration `2026_03_01_150009_create_vocab_source_to_concept_maps_table.php` creates the table on the `omop` connection via `Schema::connection('omop')->create('source_to_concept_map', ...)`. Live DB inspection confirms the table exists in BOTH `omop.source_to_concept_map` (121 rows, IRSF data) AND `vocab.source_to_concept_map` (0 rows). CONTEXT.md, ROADMAP.md, and canonical refs all say to write to `vocab.source_to_concept_map`. The resolver, when executing from the `vocab` connection, will read `source_to_concept_map` via `search_path = vocab,omop,php` — and will find the `vocab`-schema one first (empty) before falling through to `omop`.

**Why it happens:** Historical inconsistency. The migration file used `Schema::connection('omop')` (literal), but the IRSF seeder wrote to `omop.source_to_concept_map` while earlier design intent (CONTEXT D-01) was to keep cross-walks in `vocab`. The tables are byte-identical (same `\d` output) but schema-ambiguous.

**How to avoid:** Resolve during planning. Two options: (A) **Planner DECIDES** to write the Phase-13 cross-walk to `vocab.source_to_concept_map` (empty today, so no risk of collision with IRSF), and add an explicit `Schema::connection('vocab')` migration that asserts the table exists with expected columns (idempotent CREATE IF NOT EXISTS). This aligns with D-01 and the canonical refs. IRSF's 121 rows stay in `omop.source_to_concept_map`; in a future cleanup phase, both can be consolidated. (B) Write to `omop.source_to_concept_map` and update the resolver accordingly — rejected because D-01 is locked and CONTEXT says `vocab`. **Recommend option A.**

**Warning signs:** Resolver SQL with unqualified `source_to_concept_map` in a test on the `vocab` connection that returns rows from the `omop` schema, or vice versa. Always fully qualify in the resolver SQL: `vocab.source_to_concept_map` literally, never bare.

### Pitfall 2: Standard-concept chains with deprecated intermediaries

**What goes wrong:** `vocab.concept_relationship` has 238,310 rows with `relationship_id = 'Concept replaced by'` and 4,799,755 `'Maps to'` rows [VERIFIED: live DB]. A naive JOIN can land on a deprecated standard concept (`concept.invalid_reason = 'D'` or `'U'`). The existing resolver does `AND std.standard_concept = 'S'` which is correct for standardness but does not also filter invalid concepts.

**Why it happens:** OMOP's `invalid_reason` column distinguishes three states: NULL (valid, 122,635 rows for the three core vocabs), `'U'` (upgrade-only, 320 rows), `'D'` (deprecated, 1,867 rows). A deprecated standard concept can still show `standard_concept = 'S'` in Athena historical snapshots.

**How to avoid:** Add `AND std.invalid_reason IS NULL` to the resolver's JOIN in `resolveLikeAny`. Also add `AND cr.invalid_reason IS NULL` to the relationship join. Both are cheap filters on indexed columns.

**Warning signs:** Unit test asserting standard-concept output for a code known to have a deprecated SNOMED concept returns the deprecated ID.

### Pitfall 3: ICDO3 is not in the live `vocab.vocabulary`

**What goes wrong:** CONTEXT D-03 says "ICDO3 uses OMOP's existing standard ICDO3 vocabulary — no new cross-walk needed, just resolver preference." Live DB inspection contradicts this: `SELECT vocabulary_id FROM vocab.vocabulary WHERE vocabulary_id='ICDO3'` returns zero rows. Only ATC, ICD10CM, ICD9CM, RxNorm, and SNOMED are loaded today [VERIFIED: live DB]. The 1,107 ICDO3 rows in `app.finngen_unmapped_codes` cannot be resolved by "resolver preference" alone — they need a cross-walk OR a pre-Phase-13 ICDO3 vocab load.

**Why it happens:** CONTEXT was gathered before the live-DB audit; assumption was that ICDO3 exists in OMOP's Athena download (it does upstream, as vocabulary_id 'ICDO3') but it was never loaded into the current Parthenon DB.

**How to avoid:** The cross-walk MUST include ICDO3 → SNOMED Procedure / Neoplasm mappings authored from Athena bulk downloads. Per D-01/D-02, this is a standard OHDSI resource (Athena publishes ICDO3 concept rows with `concept_code` already in ICDO3 format). The planner has two sub-options:
  - (A) Ship a tiny ICDO3 vocabulary row + concepts load in Phase 13 — REJECTED because D-01 forbids new `vocab.vocabulary` rows and D-03 explicitly forbids concept_id ≥ 2B allocation.
  - (B) Author ICDO3 cross-walk rows DIRECTLY in `vocab.source_to_concept_map` from Athena (ICDO3 source_code → SNOMED target_concept_id). The `source_vocabulary_id = 'ICDO3'` literal is fine here because `source_to_concept_map.source_vocabulary_id` is free-form TEXT and does NOT require a row in `vocab.vocabulary`.
  - **Recommend B.** This is option B of D-03 as originally phrased once the live-DB fact is checked.

**Warning signs:** Baseline scan of coverage_profile shows ICDO3-derived endpoints still `finland_only`. That means the Athena ICDO3 → SNOMED rows didn't land in the seed.

### Pitfall 4: Pint version parity (CI failures)

**What goes wrong:** Laravel Pint has known rules that CI-Docker Pint enforces but host Pint misses (or vice versa). Running host Pint on the changed PHP files passes locally, then CI fails.

**Why it happens:** `/home/smudoshi/.claude/CLAUDE.md §Laravel` and `.claude/CLAUDE.md §Testing & Linting` say Parthenon CI runs Docker Pint — use Docker Pint locally for parity.

**How to avoid:** After every PHP edit:

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

NOT `vendor/bin/pint` on the host.

**Warning signs:** Host `pint --test` clean, CI Pint fails.

### Pitfall 5: Re-import race condition with the endpoint browser

**What goes wrong:** The browser page `/workbench/finngen-endpoints` queries `app.cohort_definitions` through `EndpointBrowserController::list()`. During the 5,161-row re-import, researchers hitting the page see mid-write rows (some updated, some not). A researcher dispatches a Generate from the pre-rewrite expression and writes a `finngen_endpoint_generations` row referencing the NEW (post-rewrite) cohort_definition_id — but the cohort ID didn't actually change, only the expression. The run is then valid but uses post-rewrite concepts.

**Why it happens:** `cohort_definitions.id` is the FK; `expression_json` is the payload. The importer uses `updateOrCreate(['name' => $row->name], [...])` so the ID never changes, only the JSON [VERIFIED: `FinnGenEndpointImporter.php:254-267`]. Any running generation against an endpoint during the import window will pick up the new expression mid-transaction.

**How to avoid:** (a) Run the re-import during a deploy window when no users are browsing. (b) Hold a Laravel maintenance-mode flag briefly during the 5,161-row rewrite. (c) OR: include the re-import in a `deploy.sh --db --frontend` sequence that matches the deploy cadence. Current IRSF Phase 6 precedent is option (c). **Recommend (c).**

**Warning signs:** Post-re-import generation runs show mixed resolver behavior (some with new concepts, some with old).

### Pitfall 6: Coverage_profile invariant regression

**What goes wrong:** D-07 locks the invariant: "no endpoint is simultaneously `coverage_bucket = UNMAPPED` AND `coverage_profile = universal`." Without an explicit test fixture, a logic error in the classifier (e.g., "universal" computed as "at least one standard concept anywhere" while `coverage_bucket` is computed as "at least 50% of tokens resolved") could let `UNMAPPED + universal` slip through.

**Why it happens:** Two different coverage dimensions computed from the same resolver output, with no single source of truth.

**How to avoid:** Feature test: after re-import, assert `SELECT COUNT(*) FROM app.cohort_definitions WHERE expression_json->>'coverage_bucket' = 'UNMAPPED' AND coverage_profile = 'universal'` returns 0. Automated in CI and re-run post-merge.

**Warning signs:** That SELECT returns > 0.

## Code Examples

Verified patterns from official sources and the live codebase:

### Resolver with STCM-first pass

```php
// Source: adapted from FinnGenConceptResolver.php:129-177 live code.
// Public interface preserved; STCM added as the FIRST lookup path per D-01.

public function resolveIcd8(array $patterns): array
{
    $prefixes = $this->sanitize($patterns);
    if ($prefixes === []) {
        return ['standard' => [], 'source' => [], 'truncated' => false];
    }
    // NEW: STCM-first. ICD-8 has no vocab.concept entries, so the STCM
    // is the ONLY resolution path. Returns just standard concepts; source
    // concepts are empty because the ICD-8 source codes are not registered.
    $stcm = $this->resolveViaStcm('ICD8', $prefixes);
    $standard = array_values(array_slice($stcm, 0, self::MAX_RESOLVED));
    return [
        'standard' => $standard,
        'source' => [],
        'truncated' => count($stcm) > self::MAX_RESOLVED,
    ];
}

public function resolveIcd10(array $patterns): array
{
    $prefixes = $this->expandDotted($patterns);  // existing dotted/undotted logic
    if ($prefixes === []) {
        return ['standard' => [], 'source' => [], 'truncated' => false];
    }

    // STCM-first path for ICD-10-FI extensions
    $stcm = $this->resolveViaStcm('ICD10_FIN', $prefixes);

    // Existing ICD10CM path
    $existing = $this->resolveLikeAny('ICD10CM', $prefixes);

    // Union; truncation bit bubbles up
    $standard = array_values(array_unique(array_merge($existing['standard'], $stcm)));
    return [
        'standard' => array_slice($standard, 0, self::MAX_RESOLVED),
        'source' => $existing['source'],
        'truncated' => $existing['truncated'] || count($standard) > self::MAX_RESOLVED,
    ];
}
```

### Coverage profile classifier

```php
// Source: new code, pure function, no DB access.
final class FinnGenCoverageProfileClassifier
{
    /**
     * Classify an endpoint's portability profile from resolver output.
     *
     * - universal    — EVERY non-empty qualifying-event vocab group returned at least one standard concept
     * - finland_only — ZERO qualifying-event vocab groups resolved outside Finnish source vocabs
     * - partial      — at least one group resolved, at least one group dropped as Finnish-only
     */
    public static function classify(
        array $icd10, array $icd9, array $atc, array $icd8, array $icdO3,
        array $nomesco, array $kelaReimb
    ): CoverageProfile {
        $groups = [
            'icd10' => $icd10['standard'] !== [],
            'icd9'  => $icd9['standard']  !== [],
            'atc'   => $atc['standard']   !== [],
            'icd8'  => $icd8['standard']  !== [],
            'icdO3' => $icdO3['standard'] !== [],
            'nomesco'   => $nomesco['standard']   !== [],
            'kelaReimb' => $kelaReimb['standard'] !== [],
        ];
        $hasStandard = in_array(true, $groups, true);
        $allHaveStandard = ! in_array(false, array_filter($groups, static fn ($v, $k) => true, ARRAY_FILTER_USE_BOTH), true);
        if (! $hasStandard) return CoverageProfile::FINLAND_ONLY;
        if ($allHaveStandard) return CoverageProfile::UNIVERSAL;
        return CoverageProfile::PARTIAL;
    }
}
```

### R worker — no changes needed

```r
# Source: darkstar/api/finngen/cohort_ops.R:387-537 live code.
# The R worker consumes resolved concept_id arrays from the PHP payload:
#   params$condition_concept_ids
#   params$drug_concept_ids
#   params$source_concept_ids
# It does NOT read the raw FinnGen source codes or the STCM table.
# It UNIONs condition_occurrence (concept_ancestor-expanded) + drug_exposure
# (concept_ancestor-expanded) + condition_source_concept_id fallback.
# After the resolver upgrade, these arrays simply contain MORE standard
# concept IDs — the R worker is transparent to the source of the IDs.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom Finnish vocabulary load (ICD-8, ICDO3-FI, NOMESCO, KELA_REIMB as concept_id ≥ 2B) | FinnGen-authored `vocab.source_to_concept_map` cross-walk | Phase 13 (this phase), 2026-04-17 scope pivot | Endpoints run on ANY OMOP CDM globally without Finnish-CDM dependency. |
| Source-code LIKE match against `vocab.concept` only | STCM-first with LIKE fallback | Phase 13 | ~3,983 ICD-8 + 453 NOMESCO + 61 KELA_REIMB + 1,107 ICDO3 + 2,961 unresolved ICD-10 tokens now resolvable via cross-walk. |
| `coverage_bucket` as the sole coverage dimension | `coverage_bucket` (per-source resolution) + `coverage_profile` (portability) | Phase 13 | UI can distinguish "Finland-only by design" from "poorly mapped against current vocab" — critical UX. |
| Manual re-import via individual Artisan calls | `finngen:import-endpoints --overwrite` with rollback snapshot | Phase 13 | Re-imports are now rollback-safe by default. |

**Deprecated/outdated:**

- **"UNMAPPED bucket = vocabulary load needed"** — previously surfaced in the browser copy as "awaits Finnish vocab" [VERIFIED: `FinnGenEndpointBrowserPage.tsx:53`]. Post-Phase-13 the text should become "requires Finnish CDM data" because coverage lift happens via cross-walk, not vocab load.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FinnGen's `library-of-endpoints` repo at github.com/FINNGEN/library-of-endpoints does not exist (404) [VERIFIED: WebFetch 404]. The canonical FinnGen mapping sources are `FINNGEN/phenotype-matching` (MIT, TSV/CSV) and `FINNGEN/pan-ukbb-mapping` (MIT, TSV). | Canonical Refs | Low — both repos confirmed exist with MIT licenses; canonical_refs in CONTEXT.md lists a URL that 404s and should be corrected. Planner: update reference. |
| A2 | The Athena bulk download of ICDO3, NOMESCO (partial), and SNOMED Procedure cross-walks is LICENSED for redistribution in an open-source project — [ASSUMED] Athena/OHDSI materials typically are CC-BY or public-domain, but the ICDO3 copy may carry WHO IARC terms that restrict redistribution. Planner must verify before committing cross-walk CSVs to the repo. | Cross-walk Authoring | Medium — if ICDO3 upstream rows cannot be committed, the cross-walk becomes a manifest that references Athena IDs and a loader script that pulls at build time. |
| A3 | No concurrent schema migration will race with the Phase-13 seed migration for `vocab.source_to_concept_map`. [VERIFIED: current git status shows no pending vocab schema migrations; but this holds only at research time.] | Seed Migration | Low — if someone adds an incompatible migration before Phase-13 merges, the seed's DELETE+INSERT is idempotent and will re-run cleanly. |
| A4 | The 5,161 live endpoints represent ALL endpoints that must be re-imported in one shot. [VERIFIED: `SELECT COUNT(*) FROM app.cohort_definitions WHERE domain='finngen-endpoint'` → 5,161]. | Re-import | Low — verified against live DB 2026-04-17. |
| A5 | KELA_REIMB codes map to ATC drug classes with sufficient clinical specificity. [ASSUMED based on D-03; actual ATC class granularity varies by reimbursement category.] | Cross-walk Authoring | Medium — some KELA_REIMB codes are broader than any single ATC class. For those, the cross-walk may have to use a higher-level ATC node (loss of specificity, but still clinically meaningful). |
| A6 | The roadmap baseline `9,093` unmapped codes vs. today's `9,527` delta is explainable by re-imports adding rows between the roadmap write-up and now. [ASSUMED based on CONTEXT §specifics note "investigate the delta during research"]. **Live DB 2026-04-17 shows:** ICD8=3,983, ICD10_UNMATCHED=2,961, ICDO3=1,107, ICD9_FIN=958, NOMESCO=453, KELA_REIMB=61, ATC_UNMATCHED=4 = 9,527 total. Sum of `observed_count` is 17,160 (tokens × endpoints that contain them). | Baseline | Low — the delta (434) is well within the range of one re-import. Planner should not over-engineer reconciliation. |
| A7 | The Pint version in `backend/composer.json` matches the CI Docker image. [VERIFIED only via convention; planner to confirm by checking `backend/composer.lock` Pint pin before running.] | Project Constraints | Low — Pint drift shows up as whitespace diffs, easy to detect. |

**If this table is empty:** Not applicable — 2 ASSUMED claims remain that the planner should surface to the user during `/gsd-plan-phase` or the first task preamble (A2 and A5). The rest are low-risk VERIFIED facts.

## Open Questions

1. **`vocab.source_to_concept_map` vs `omop.source_to_concept_map` schema question**
   - What we know: Both tables exist (same structure), IRSF (Phase 6) seeded rows into `omop.source_to_concept_map`, CONTEXT/ROADMAP say Phase 13 writes to `vocab.source_to_concept_map`. The table in `vocab` is empty today.
   - What's unclear: Should Phase 13 also migrate IRSF's 121 rows into `vocab.source_to_concept_map`, or leave them in `omop` (which is technically also shared by vocab-search_path)?
   - Recommendation: Leave IRSF rows in `omop` for now; Phase 13 writes only to `vocab`. Future cleanup phase can consolidate. If planner or user disagrees, flag in `/gsd-plan-phase`.

2. **Finland-only endpoints with `kela_reimb_icd` column (ICD-10 + KELA tandem)**
   - What we know: Some FinnGen endpoints combine `kela_reimb` (Finnish reimb code) AND `kela_reimb_icd` (ICD-10 anchor) — the ICD-10 anchor IS universally resolvable, but the endpoint definition may intend the AND of both predicates.
   - What's unclear: Does the resolver report these as `partial` (because ICD-10 resolves and KELA does not) or `finland_only` (because without the KELA filter the endpoint is much less specific)?
   - Recommendation: `partial` — the ICD-10 anchor still identifies a meaningful population; the loss of KELA specificity is documented in the description. Confirm with clinical stakeholder; if the answer is "finland_only" (strict), add a per-endpoint override mechanism to the classifier.

3. **Threshold for `universal` classification**
   - What we know: D-05/D-06 define `universal = every qualifying-event branch resolves`. "Resolves" is defined loosely.
   - What's unclear: If a resolver call returns a truncated result (MAX_RESOLVED=500 cap), does the branch still count as "resolved"? (It should — the cap is a display protection, not a resolution failure.)
   - Recommendation: Truncated counts as resolved; bake this into the classifier and the test fixture.

4. **ICDO3 cross-walk source authority**
   - What we know: ICDO3 is not in live `vocab.vocabulary`. Athena publishes ICDO3 concepts in its upstream feeds.
   - What's unclear: Whether FinnGen has its own ICDO3 → SNOMED cross-walk (A1 search suggests phenotype-matching repo uses ICD-10 only, not ICDO3). Likely the ICDO3 cross-walk must be authored from Athena bulk downloads + manual review.
   - Recommendation: Pull Athena `concept.csv` ICDO3 rows + `concept_relationship.csv` Maps-to rows; filter to rows where source_code appears in `app.finngen_unmapped_codes WHERE source_vocab='ICDO3'`. Emit ~1,107 cross-walk rows directly. Flag the license check (A2) before commit.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL (host) | Schema inspection during research + migration execution | ✓ | PG17 on host, PG16 in Docker | — |
| psql (host) | Live DB inspection | ✓ | 17 | — |
| Laravel / php container | Artisan command, tests, migrations | ✓ (docker compose) | PHP 8.4 / Laravel 11 | — |
| Pest 3 | Unit + feature tests | ✓ | in composer.lock | — |
| Node / Vite | Frontend build + test | ✓ (docker compose) | node service | — |
| `parthenon_app` role | Runtime grants for vocab.source_to_concept_map | ✓ | DB role exists (per `create_finngen_db_roles.php`) | Wrap in `IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'parthenon_app')` as HIGHSEC mandates. |
| `parthenon_migrator` role | Owner of new rows | ✓ | DB role exists | Same guard pattern. |
| Athena OHDSI download | ICDO3 cross-walk source rows | ✗ (not bundled with repo) | — | `scripts/vocabulary/download_athena.sh` pattern exists elsewhere in Parthenon; planner creates a Phase-13-scoped variant that pulls ICDO3 + required rows. Alternative: ship a small committed CSV of the exact 1,107 ICDO3 codes that appear in `app.finngen_unmapped_codes`. |
| FinnGen `phenotype-matching` repo | Optional secondary cross-walk source | ✓ (public, MIT) | github.com/FINNGEN/phenotype-matching | Not blocking — ICD-10 content only, supplements the Athena path. |
| FinnGen `pan-ukbb-mapping` repo | Optional secondary cross-walk source | ✓ (public, MIT) | github.com/FINNGEN/pan-ukbb-mapping | Not blocking — cross-biobank mapping, supplements the Athena path. |

**Missing dependencies with no fallback:** None blocking.

**Missing dependencies with fallback:** Athena ICDO3 download — fallback is a committed small CSV (~1,107 rows for the exact unmapped ICDO3 codes).

## Validation Architecture

Nyquist Dimension 8 (`workflow.nyquist_validation = true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Backend framework | Pest 3.x [VERIFIED: `backend/tests/Unit/FinnGen/*.php`] |
| Frontend framework | Vitest [VERIFIED: `frontend/src/features/finngen-workbench/__tests__/*.test.tsx`] |
| Config file (backend) | `backend/phpunit.xml` — Pest reads from it |
| Config file (frontend) | `frontend/vitest.config.ts` |
| Quick run (backend) | `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest --filter=FinnGen"` |
| Quick run (frontend) | `docker compose exec -T node sh -c "cd /app && npx vitest run --related frontend/src/features/finngen-endpoint-browser"` |
| Full suite (backend) | `cd backend && vendor/bin/pest` |
| Full suite (frontend) | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GENOMICS-12a | Resolver prefers STCM before vocab.concept LIKE-ANY | unit | `vendor/bin/pest --filter=StandardFirstResolverTest` | ❌ Wave 0 |
| GENOMICS-12a | Resolver output contract stable (standard, source, truncated keys) | unit | `vendor/bin/pest --filter=ConceptResolutionTest` (extend) | ✅ (extend existing `backend/tests/Feature/FinnGen/ConceptResolutionTest.php`) |
| GENOMICS-12a | ICD-8 resolves via STCM (previously always empty) | unit | `vendor/bin/pest --filter=ResolveIcd8ViaStcmTest` | ❌ Wave 0 |
| GENOMICS-12a | NOMESCO / KELA_REIMB / ICDO3 resolver methods exist and resolve via STCM | unit | `vendor/bin/pest --filter=FinnishVocabResolverTest` | ❌ Wave 0 |
| GENOMICS-12a | `CoverageProfile::classify()` returns UNIVERSAL / PARTIAL / FINLAND_ONLY per spec | unit | `vendor/bin/pest --filter=FinnGenCoverageProfileClassifierTest` | ❌ Wave 0 |
| GENOMICS-12a | Seed migration loads FinnGen cross-walk idempotently | feature | `vendor/bin/pest --filter=FinnGenSourceToConceptMapSeedTest` | ❌ Wave 0 |
| GENOMICS-12a | Seed migration grants SELECT to parthenon_app per HIGHSEC | feature | Same test — asserts `pg_has_role('parthenon_app','vocab.source_to_concept_map','SELECT')` | ❌ Wave 0 |
| GENOMICS-12a | `--overwrite` re-imports 5,161 rows without changing row count | feature | `vendor/bin/pest --filter=ImportEndpointsOverwriteTest` | ❌ Wave 0 (extend existing `ImportEndpointsCommandTest.php`) |
| GENOMICS-12a | Pre-snapshot table receives one row per endpoint before overwrite | feature | Same test — asserts snapshot table count == cohort_definitions finngen count | ❌ Wave 0 |
| GENOMICS-12a | `coverage_profile` column populated on every finngen-endpoint row | feature | `vendor/bin/pest --filter=CoverageProfilePopulationTest` | ❌ Wave 0 |
| GENOMICS-12a | Invariant: no row with coverage_bucket=UNMAPPED AND coverage_profile=universal | feature | `vendor/bin/pest --filter=CoverageInvariantTest` | ❌ Wave 0 |
| GENOMICS-12a | Endpoint browser renders "Requires Finnish CDM" pill for finland_only | frontend unit | `npx vitest run CoverageProfileBadge.test` | ❌ Wave 0 |
| GENOMICS-12a | Generate CTA is disabled for finland_only endpoints on non-Finnish sources | frontend unit | `npx vitest run FinnGenEndpointBrowserPage.disabledGenerateCTA.test` | ❌ Wave 0 |
| GENOMICS-12a | End-to-end smoke: previously-UNMAPPED endpoint with ICD-8 generates on PANCREAS with subject_count > 0 | manual-only | Script: `php artisan finngen:endpoints:generate --endpoint=<id> --source=PANCREAS` | N/A — smoke test, not automated in CI |
| GENOMICS-12a | Baseline scan output format (coverage_profile distribution JSON) | feature | `vendor/bin/pest --filter=BaselineScanOutputTest` | ❌ Wave 0 |

### Baseline Scan Protocol

The empirical pre-Phase-13 baseline is captured as:

1. **Input:** Current state of `app.cohort_definitions WHERE domain='finngen-endpoint'` (5,161 rows) and `app.finngen_unmapped_codes` (9,527 rows today).
2. **Method:** A `php artisan finngen:scan-coverage-profile --dry-run` Artisan command runs the upgraded resolver against all 5,161 endpoints in memory, emits a JSON report to `storage/app/finngen-endpoints/phase13-baseline-<timestamp>.json` with shape:
   ```json
   {
     "total_endpoints": 5161,
     "coverage_profile_distribution": {
       "universal": <int>,
       "partial":   <int>,
       "finland_only": <int>
     },
     "coverage_bucket_distribution": {
       "FULLY_MAPPED": <int>,
       "PARTIAL":     <int>,
       "SPARSE":      <int>,
       "UNMAPPED":    <int>,
       "CONTROL_ONLY":<int>
     },
     "invariant_violations": <int>,  // MUST be 0
     "baseline_unmapped_count": <int>,
     "top_lifted_vocabularies": { "ICD8": <int>, "NOMESCO": <int>, ... },
     "generated_at": "<ISO8601>"
   }
   ```
3. **Success gate:** The JSON report is committed to `.planning/phases/13-finngen-endpoint-universalization/artifacts/baseline-scan.json`, reviewed by the planner, and the final target for UNMAPPED < 100 is confirmed BEFORE the re-import runs.
4. **Automation:** The Artisan command is built in Wave 0; every subsequent task commit re-runs it against the dev DB and asserts `invariant_violations == 0` before pushing.

### Sampling Rate

- **Per task commit:** `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest --filter=FinnGen --parallel"` (quick run, < 30s for the FinnGen filter).
- **Per wave merge:** Full backend suite + FinnGen frontend Vitest filter.
- **Phase gate (before `/gsd-verify-work`):** Full `make test` (backend Pest + frontend Vitest + AI pytest). Baseline scan produces its final JSON.
- **Post-merge smoke (D-11 item 4):** `php artisan finngen:endpoints:generate --endpoint=<previously_unmapped> --source=PANCREAS` returns subject_count > 0.

### Wave 0 Gaps

- [ ] `backend/tests/Unit/FinnGen/StandardFirstResolverTest.php` — covers GENOMICS-12a resolver preference
- [ ] `backend/tests/Unit/FinnGen/FinnGenCoverageProfileClassifierTest.php` — covers classifier purity + D-05 + D-07
- [ ] `backend/tests/Unit/FinnGen/FinnishVocabResolverTest.php` — covers NOMESCO / KELA_REIMB / ICDO3 resolver methods
- [ ] `backend/tests/Feature/FinnGen/FinnGenSourceToConceptMapSeedTest.php` — covers D-01 + D-04 (STCM idempotent load + grants)
- [ ] `backend/tests/Feature/FinnGen/ImportEndpointsOverwriteTest.php` — covers D-12 + D-13 (overwrite + pre-snapshot)
- [ ] `backend/tests/Feature/FinnGen/CoverageProfilePopulationTest.php` — covers D-05 (column populated for every row)
- [ ] `backend/tests/Feature/FinnGen/CoverageInvariantTest.php` — covers D-07 (invariant)
- [ ] `backend/tests/Feature/FinnGen/BaselineScanOutputTest.php` — covers D-10 (empirical baseline)
- [ ] `frontend/src/features/finngen-endpoint-browser/__tests__/CoverageProfileBadge.test.tsx` — covers D-08 pill
- [ ] `frontend/src/features/finngen-endpoint-browser/__tests__/DisabledGenerateCTA.test.tsx` — covers D-08 CTA disable
- [ ] Wave 0 does NOT need to add framework install — Pest + Vitest are already installed.

## Cross-walk Authoring Protocol

This section specifies the D-02 provenance policy and the D-03 per-vocab coverage targets.

### Source Hierarchy (in order of precedence)

| Priority | Source | License | Coverage | Notes |
|----------|--------|---------|----------|-------|
| 1 | FinnGen `phenotype-matching` (github.com/FINNGEN/phenotype-matching) | MIT [VERIFIED: WebFetch] | ICD-10-FI patterns for ~3,000 FinnGen endpoints (overlaps with what's already in `expression_json.source_codes`) | Redistributable under MIT with attribution. Format: TSV / CSV. |
| 2 | FinnGen `pan-ukbb-mapping` (github.com/FINNGEN/pan-ukbb-mapping) | MIT [VERIFIED: WebFetch] | ICD-10 mappings across FinnGen R6-R12 releases | TSV. |
| 3 | OHDSI Athena (download.athena.ohdsi.org, authenticated) | CC-BY-4.0 for most OHDSI artifacts; WHO IARC terms on ICDO3 [ASSUMED — planner verifies before commit] | ICDO3, SNOMED Procedure, RxNorm, ATC | Athena is the canonical OHDSI vocabulary distribution. Pull ICDO3 + SNOMED concepts + concept_relationship 'Maps to' rows. |
| 4 | Clinical SME review | N/A | KELA_REIMB → ATC, NOMESCO → SNOMED gaps | Final gap-filling; documented per-row in PROVENANCE.md. |

### Row-Count Estimates

Target load into `vocab.source_to_concept_map` per vocab, based on live `app.finngen_unmapped_codes` distribution (2026-04-17):

| source_vocabulary_id | Distinct codes observed | target_vocabulary_id | Estimated row count | Priority |
|----------------------|------------------------|----------------------|---------------------|----------|
| ICD8 | ~2,500 (< 3,983 tokens, some duplicated across endpoints) | ICD10CM + SNOMED | ~2,500 rows (one per distinct ICD-8 code) | High — biggest lift (3,983 tokens → ~2,500 distinct codes). |
| ICDO3 | ~700 (< 1,107 tokens, many shared across endpoints) | SNOMED Procedure / Neoplasm | ~700 rows | High — pure Athena sourcing. |
| ICD9_FIN | ~400 (distinct Finnish ICD-9 codes that don't strip to valid ICD9CM via trailing-letter removal) | ICD10CM | ~400 rows | Medium — partial overlap with existing resolveIcd9 logic. |
| NOMESCO | ~300 (distinct surgical procedure codes from 453 tokens) | SNOMED Procedure | ~300 rows | Medium — clinical SME + Athena. |
| ICD10_FIN | ~200 (ICD-10-FI extensions not in ICD-10-CM) | ICD10CM parent + SNOMED | ~200 rows | Low — most ICD-10-FI codes strip to valid ICD10CM via existing resolver. |
| KELA_REIMB | ~60 (distinct reimbursement categories from 61 tokens) | RxNorm class / ATC | ~60 rows | Low — smallest but highest semantic distance from standard vocabs. |
| **Total** | — | — | **~4,160 rows** | — |

### Precedence Rules (When Sources Disagree)

1. **FinnGen-authored > Athena > clinical SME.** If FinnGen publishes a mapping (e.g., ICD-10-FI → ICD-10-CM in the XLSX endpoint definitions), use FinnGen's mapping.
2. **Athena wins for ICDO3 → SNOMED** because FinnGen does not publish this mapping (verified: phenotype-matching only uses ICD-10).
3. **Clinical SME wins for KELA_REIMB → ATC/RxNorm** because neither FinnGen nor Athena publishes this cross-walk — KELA_REIMB is Finland-specific reimbursement coding.
4. **Multiple targets per source code allowed.** STCM supports one-to-many. Example: an ICD-8 code maps to both a precise ICD-10-CM code AND a broader SNOMED disorder — emit BOTH rows.
5. **Invalid-reason handling.** If a target concept is deprecated in live `vocab.concept` (`invalid_reason = 'D'` or `'U'`), DROP the row and flag in PROVENANCE.md. Do not emit deprecated targets.

### Provenance Tracking Schema

Each cross-walk CSV carries a provenance comment header and a per-row metadata column. A companion `PROVENANCE.md` ships alongside the CSVs.

**CSV format (example `icd8_to_icd10cm.csv`):**

```
# source: FINNGEN/phenotype-matching ICD-8 → ICD-10 mapping table, 2024-11-08 revision
# target_vocab: ICD10CM (Athena 5.4 snapshot 2026-01-15)
# license: MIT (FinnGen source) + CC-BY-4.0 (Athena target concept_ids)
# curator: Phase 13 planner
# reviewed_by: <name, date>
source_code,source_concept_id,source_vocabulary_id,source_code_description,target_concept_id,target_vocabulary_id,valid_start_date,valid_end_date,invalid_reason,provenance_tag
393,0,ICD8,Chronic ischaemic heart disease,316139,SNOMED,1970-01-01,2099-12-31,,finngen-phenotype-matching
414,0,ICD8,Other forms of chronic ischaemic heart disease,316139,SNOMED,1970-01-01,2099-12-31,,finngen-phenotype-matching
...
```

Note: `source_concept_id = 0` because ICD-8 source codes are NOT in `vocab.concept`. OMOP STCM convention: `source_concept_id = 0` when the source vocabulary is not loaded.

**`provenance_tag` column values:**
- `finngen-phenotype-matching` — primary FinnGen mapping
- `finngen-pan-ukbb` — secondary FinnGen mapping
- `athena-icdo3-snomed-2026q1` — Athena bulk download
- `sme-<name>-2026-04-<dd>` — clinical SME review
- `computed-icd10fi-strip` — mechanical ICD-10-FI → ICD-10-CM derivation (strip Finnish suffix)

**`PROVENANCE.md` sections:**

1. Per-vocab source URLs and license snapshots
2. Row-count accounting (how many rows per provenance_tag)
3. Dropped-row log (codes deliberately NOT cross-walked, with reason — e.g., "Code 9999 intentionally unmapped; represents administrative KELA category, no clinical analogue")
4. Clinical SME review trail (name, date, codes reviewed)

## Sources

### Primary (HIGH confidence)
- **Live DB inspection** via `psql -h localhost -U claude_dev -d parthenon` (2026-04-17) — all schema facts, row counts, and vocabulary presence
- `backend/app/Services/FinnGen/FinnGenConceptResolver.php` — current resolver code, lines 129-177
- `backend/app/Services/FinnGen/FinnGenEndpointImporter.php` — batch semantics, coverage classification, unmapped aggregation
- `backend/app/Services/FinnGen/FinnGenPatternExpander.php` — pattern expansion (input to resolver)
- `backend/app/Console/Commands/FinnGen/ImportEndpointsCommand.php` — existing Artisan command shape
- `backend/database/migrations/2026_03_01_150009_create_vocab_source_to_concept_maps_table.php` — STCM table creation
- `backend/database/migrations/2026_04_16_190000_create_finngen_unmapped_codes_table.php` — unmapped sidecar
- `backend/database/migrations/2026_04_13_014502_create_finngen_db_roles.php` — HIGHSEC grants pattern
- `backend/database/migrations/2026_04_17_000500_create_finngen_endpoint_generations_table.php` — generations preserved
- `backend/tests/Feature/FinnGen/ImportEndpointsCommandTest.php` — feature test pattern for re-import
- `backend/tests/Feature/FinnGen/ConceptResolutionTest.php` — live-vocab unit test pattern
- `darkstar/api/finngen/cohort_ops.R` lines 387-537 — R worker that consumes resolver output (transparent to resolver upgrade)
- `frontend/src/features/finngen-endpoint-browser/pages/FinnGenEndpointBrowserPage.tsx` — browser UI that needs the `coverage_profile` pill

### Secondary (MEDIUM confidence)
- [FINNGEN/phenotype-matching](https://github.com/FINNGEN/phenotype-matching) — MIT-licensed FinnGen mapping repo (verified via WebFetch)
- [FINNGEN/pan-ukbb-mapping](https://github.com/FINNGEN/pan-ukbb-mapping) — MIT-licensed cross-biobank mapping (verified via WebFetch)
- [FinnGen Endpoint Documentation](https://docs.finngen.fi/finngen-data-specifics/endpoints/finngen-clinical-endpoints) — canonical FinnGen endpoint library documentation (web-fetched)
- CONTEXT.md decisions D-01 through D-16 — locked user decisions

### Tertiary (LOW confidence — marked for validation)
- A2: License terms on Athena ICDO3 redistribution — planner must verify before committing ICDO3 cross-walk CSVs
- A5: KELA_REIMB ↔ ATC clinical specificity — clinical SME review required

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all components already in use; no new dependencies
- Architecture: HIGH — follows existing IRSF Phase 6 + current FinnGen patterns
- Pitfalls: HIGH — pitfalls 1-6 verified against live code and live DB; discrepancies identified
- Cross-walk authoring: MEDIUM — FinnGen source repos verified (MIT), Athena license for ICDO3 flagged as assumption (A2)
- Runtime State Inventory: HIGH — five categories explicitly checked against codebase and live DB
- Validation Architecture: HIGH — test file paths mapped, Wave 0 gaps enumerated, baseline scan protocol specified

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 days; code-adjacent facts stable, cross-walk authoring may need fresh Athena download)

## Sources

Sources:
- [FINNGEN/phenotype-matching](https://github.com/FINNGEN/phenotype-matching) — MIT-licensed FinnGen endpoint mapping repo
- [FINNGEN/pan-ukbb-mapping](https://github.com/FINNGEN/pan-ukbb-mapping) — MIT-licensed cross-biobank mapping
- [FinnGen Endpoint Documentation](https://docs.finngen.fi/finngen-data-specifics/endpoints/finngen-clinical-endpoints)
- [Risteys FinnGen R10 Documentation](https://r10.risteys.finngen.fi/documentation)
- [FinnGen Public Documentation — Endpoints Introduction](https://finngen.gitbook.io/documentation/methods/endpoints)
- OHDSI OMOP v5.4 specification (source_to_concept_map table semantics), via Athena and OMOP Common Data Model docs

## RESEARCH COMPLETE
