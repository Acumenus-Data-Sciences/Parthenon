# Phase 13: FinnGen Endpoint Universalization (Standard-First Resolver) - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Upgrade FinnGen endpoint resolution so the 5,161 curated endpoint definitions from FinnGen DF14 run natively on any OMOP CDM globally (PANCREAS, SynPUF, Acumenus, inpatient, eunomia, or any future source that ships with OHDSI standard vocabularies) — **without** requiring Finnish-specific custom OMOP vocabularies.

**In scope:**
- Rewrite `FinnGenConceptResolver` to prefer OHDSI standard concepts via `concept_relationship` "Maps to" before any source-vocab fallback.
- Ship a curated FinnGen-authored `vocab.source_to_concept_map` cross-walk covering ICD-8, NOMESCO, KELA_REIMB, and high-value ICD-10-FI extensions to standard concepts.
- Add `coverage_profile` classification (`universal` / `partial` / `finland_only`) per endpoint and surface it in the endpoint browser.
- Re-process all 5,161 live `cohort_definitions.expression` rows in one shot at phase merge, with a rollback snapshot table.
- Drop the UNMAPPED bucket from 427 endpoints to <100.

**Out of scope (moved to Phase 18.5: Finnish CDM Enablement, deferred):**
- Registering Finnish vocabularies (ICD-8, ICD9_FIN, ICD-10-FI, ICDO3-FI, NOMESCO, KELA_REIMB) as custom OMOP vocabularies with concept_ids ≥ 2B.
- Loading THL-published catalogs.
- Anything that depends on having Finnish-sourced CDM data attached.

**Scope pivot recorded 2026-04-17:** original Phase 13 was framed as "Finnish OMOP Vocabulary Load." The pivot to universalization was user-initiated ("make FinnGen tools more universal and standardized for global researchers"). REQUIREMENTS.md GENOMICS-12 was split into GENOMICS-12a (this phase) and GENOMICS-12b (deferred). ROADMAP.md Phase 13 name, goal, and success criteria were rewritten in the same commit as this CONTEXT.md.

</domain>

<decisions>
## Implementation Decisions

### Cross-walk strategy
- **D-01:** Ship a FinnGen-authored `vocab.source_to_concept_map` cross-walk as the primary coverage lift mechanism. No new rows in `vocab.vocabulary`. No concept_id ≥ 2B block allocation. The cross-walk table alone handles Finnish source codes → standard concepts.
- **D-02:** Cross-walk source priority: (1) FinnGen's own published mapping references (LibraryOfEndpoints repo, DF14 endpoint definitions spreadsheet), (2) OHDSI Phoebe / Athena for gaps, (3) curated manual mappings for anything remaining that is clinically high-value. Document the provenance of each row (sourced-from column or companion manifest).
- **D-03:** Cross-walk coverage targets by vocab: ICD-8 → ICD10CM/SNOMED, NOMESCO → SNOMED Procedure, KELA_REIMB → RxNorm class (or ATC where reimbursement class implies a drug class), ICD-10-FI → ICD10CM parent where one exists. ICDO3 uses OMOP's existing standard ICDO3 vocabulary — no new cross-walk needed, just resolver preference.
- **D-04:** Grants: all new rows owned by `parthenon_migrator` with explicit `GRANT SELECT` to `parthenon_app` per HIGHSEC §4.1.

### Coverage classification
- **D-05:** Add a `coverage_profile` column (or JSON field on existing `coverage_bucket` metadata) with three values:
  - `universal` — every qualifying-event branch resolves to a standard concept on any OMOP CDM
  - `partial` — some branches resolve, some were dropped (Finnish-only); remaining branches still clinically meaningful
  - `finland_only` — no branches resolve outside Finnish source vocabs (reimbursement-keyed, NOMESCO-only surgical, etc.)
- **D-06:** The existing `coverage_bucket` column (FULLY_MAPPED / PARTIAL / UNMAPPED) remains the per-source resolution metric; `coverage_profile` is the portability metric. Both are populated by the resolver.
- **D-07:** Invariant enforced at end of phase: no endpoint is simultaneously `coverage_bucket = UNMAPPED` AND `coverage_profile = universal`.

### UX for Finland-only endpoints
- **D-08:** Keep Finland-only endpoints visible in the FinnGen Endpoint Browser. Render a "Requires Finnish CDM" pill next to the endpoint name. Disable the per-source "Generate" CTA for non-Finnish sources with a tooltip explaining why. Do not hide, do not tab-separate, do not delete.
- **D-09:** When a Finnish-sourced CDM eventually attaches (Phase 18.5), Finland-only endpoints light up automatically against that source via existing per-source badges — no additional UI change needed.

### Success-criteria calibration
- **D-10:** Empirical baseline first. Before locking any coverage percentage, the phase runs a dry-run pass of the upgraded resolver against all 5,161 endpoints and reports the actual `coverage_profile` distribution. Only after that scan completes is a final target (if different from the current <100 UNMAPPED floor) negotiated with the user.
- **D-11:** Binary success criteria that are locked regardless of the baseline scan:
  - UNMAPPED bucket < 100 endpoints
  - No `vocab.vocabulary` insertions
  - `coverage_profile` populated on every endpoint
  - At least one previously-UNMAPPED endpoint generates on PANCREAS with `subject_count > 0`

### Re-import and rollback
- **D-12:** One-shot re-processing at phase merge. Phase 13's final task re-runs `finngen:import-endpoints --release=df14 --overwrite` inside a single PostgreSQL transaction, rewriting all 5,161 `cohort_definitions.expression` rows.
- **D-13:** Ship a rollback snapshot migration: `app.finngen_endpoint_expressions_pre_phase13` is populated by copying `(cohort_definition_id, name, expression, coverage_bucket, created_at)` immediately before the overwrite. This table persists for at least one milestone (through v1.0 ship) to allow rollback without re-importing from DF14 source files.
- **D-14:** Generation history (`app.finngen_endpoint_generations` rows written before phase 13) is preserved. New generation runs after phase 13 use the new resolver; old runs remain valid for auditing but may point to endpoint expressions that have since been rewritten — this is acceptable (the generation ran against what was live at the time).

### Delivery mechanism
- **D-15:** Laravel migration for schema changes (rollback snapshot table, `coverage_profile` column). PHP Artisan command `php artisan finngen:import-endpoints` already exists (`backend/app/Console/Commands/FinnGen/ImportEndpointsCommand.php`) — extend it with `--overwrite` behavior that is transaction-safe. No Python ETL for this phase (IRSF pattern doesn't apply here — we're not loading custom vocab).
- **D-16:** The curated FinnGen cross-walk ships as a data migration that seeds `vocab.source_to_concept_map` via `DB::table()->insert()` with idempotent upsert semantics (delete rows where `source_vocabulary_id IN ('ICD8', 'NOMESCO', 'KELA_REIMB', 'ICD10_FIN')` first, then insert — same pattern as IRSF vocab loader, just without the concept registration).

### Claude's Discretion
- File layout for the cross-walk manifest (per-vocab CSV vs single JSON vs SQL migration with inline literals) — planner picks.
- Whether `coverage_profile` lives on the `cohort_definitions` row as a typed column or inside the existing JSONB `metadata` field — planner picks based on existing schema patterns.
- Naming of the rollback snapshot table (e.g., `finngen_endpoint_expressions_pre_phase13` vs `finngen_endpoint_expressions_snapshots` with a `taken_at` column for reusability) — planner picks.
- R worker (`finngen_endpoint_generate_execute`) updates needed to honor the new resolver output — researcher investigates whether the R worker even needs changes or whether the resolver's new output is transparent to it.

### Folded Todos
(No todos matched — `todo_count` = 0.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement + roadmap sources
- `.planning/ROADMAP.md` §Phase 13 — rewritten phase name, goal, success criteria (rewritten 2026-04-17)
- `.planning/REQUIREMENTS.md` GENOMICS-12a (this phase) and GENOMICS-12b (deferred to Phase 18.5)
- `.planning/PROJECT.md` — milestone v1.0 FinnGen Genomics definition

### FinnGen services (existing code to modify)
- `backend/app/Services/FinnGen/FinnGenConceptResolver.php` — the resolver that gets the standard-first rewrite
- `backend/app/Services/FinnGen/FinnGenEndpointImporter.php` — the importer that re-processes endpoints and writes `coverage_bucket`
- `backend/app/Services/FinnGen/FinnGenPatternExpander.php` — handles ICD-10 range expansion; understand how its output feeds the resolver
- `backend/app/Services/FinnGen/FinnGenXlsxReader.php` — parses FinnGen DF14 endpoint definitions XLSX; source of truth for the raw endpoint data

### FinnGen console commands
- `backend/app/Console/Commands/FinnGen/ImportEndpointsCommand.php` — Artisan command that gets `--overwrite` behavior extended
- `backend/app/Console/Commands/FinnGen/ReconcileOrphansCommand.php` — may need an analog for reconciling coverage_profile after the resolver upgrade

### Database schema (existing tables this phase touches)
- `backend/database/migrations/2026_04_16_190000_create_finngen_unmapped_codes_table.php` — the `app.finngen_unmapped_codes` sidecar that tracks raw unresolvable (endpoint, code, vocab) tuples
- `backend/database/migrations/2026_03_01_150009_create_vocab_source_to_concept_maps_table.php` — the `vocab.source_to_concept_map` table that the curated cross-walk populates
- `backend/database/migrations/2026_04_17_000500_create_finngen_endpoint_generations_table.php` — `app.finngen_endpoint_generations` tracking (preserved through the re-import)
- `backend/database/migrations/2026_04_13_014502_create_finngen_db_roles.php` — baseline for `parthenon_migrator` / `parthenon_app` grants pattern

### Reusable patterns (pattern reference, not code to reuse directly)
- `scripts/irsf_etl/lib/vocab_loader.py` — DELETE+INSERT idempotent transactional load pattern; adapt for `source_to_concept_map` insertion without concept registration
- `backend/app/Services/FinnGen/FinnGenAnalysisModuleRegistry.php` — how FinnGen modules are registered; may apply if the phase adds a `co2.endpoint_universalize` module

### Governance + security
- `.claude/rules/HIGHSEC.spec.md` §2 (route protection) and §4.1 (non-root execution) and §5 (secrets) — every new migration and grant must follow this
- `.claude/CLAUDE.md` — Parthenon project CLAUDE.md for database architecture (schema isolation, connection map, `vocab` shared schema)
- `/home/smudoshi/.claude/CLAUDE.md` §"Laravel (Backend)" — enum casing, run Pint after edits, transaction poisoning awareness

### FinnGen upstream references (to read when authoring the cross-walk)
- FinnGen LibraryOfEndpoints public repository (external, referenced as source of truth for FinnGen-authored mappings): https://github.com/FINNGEN/library-of-endpoints
- FinnGen DF14 endpoint definitions documentation (external, bundled with the endpoint XLSX already on disk)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`FinnGenConceptResolver`** — the resolver gets rewritten but its interface (input: source code + vocab; output: resolved concept_id or null-to-unmapped-sidecar) stays stable. Callers (endpoint importer, pattern expander) don't need changes.
- **`FinnGenEndpointImporter`** — already handles idempotent re-import of all 5,161 endpoints. The `--overwrite` flag extension is additive; the overwrite semantics themselves already exist per the quick-task 260416-qpg implementation.
- **`ImportEndpointsCommand`** — the Artisan command dispatcher is already in place; no new command needed. Extend its options, not its shape.
- **`vocab.source_to_concept_map`** — table schema already supports what we need (source_code, source_vocabulary_id, target_concept_id, target_vocabulary_id with date ranges and invalid_reason). No migration needed for the table itself; only data inserts + grants.
- **`app.finngen_unmapped_codes`** — sidecar table becomes the empirical measurement instrument: diff (pre-phase-13 rows) vs (post-phase-13 rows) gives the coverage lift delta per vocab.
- **`app.finngen_endpoint_generations`** — existing generation tracking stays valid through the re-import; a Phase 13 task validates no orphan references are created.

### Established Patterns
- **Idempotent DELETE+INSERT in single transaction** (IRSF Phase 6, `scripts/irsf_etl/lib/vocab_loader.py`) — adapt for cross-walk loading. The pattern is: delete rows matching the target vocab set, insert new rows, commit. No concept registration layer needed here.
- **HIGHSEC grants pattern** (from `create_finngen_db_roles.php` and every migration since): every CREATE must be followed by explicit GRANT to `parthenon_app` inside a `DO $grants$ ... END $grants$` block guarded by `pg_roles` existence check.
- **Parthenon migration commit style** — migrations that CREATE tables are paired with explicit GRANT blocks in the same migration; down() drops the table.
- **Per-source coverage badges** (PHENO-07 pattern, `app.finngen_endpoint_generations`) — the UI pattern for `coverage_profile` pills mirrors the existing per-source `confidence indicator` + `badges` in the endpoint browser.

### Integration Points
- **Endpoint browser** (`frontend/src/features/finngen-workbench/...`) — needs a new "Requires Finnish CDM" pill and a disabled-state tooltip on the "Generate" CTA for `coverage_profile = finland_only`. Existing badge infrastructure is in place.
- **R worker `finngen_endpoint_generate_execute`** — consumes the resolved `cohort_definitions.expression` JSON; may be transparent to the resolver upgrade (researcher confirms during Phase 13 research).
- **Workbench "Open in Workbench" CTA** (PHENO-08, commit `7504cffea`) — transparent to this phase; expression rewrites on the cohort definition row are picked up automatically by the workbench session seeder.

</code_context>

<specifics>
## Specific Ideas

- "Make FinnGen tools more universal and standardized for global researchers" (user direction, 2026-04-17). This is the organizing principle for the phase.
- The FinnGen endpoint library is "arguably the best public catalog of condition definitions in healthcare" — the phase treats the *definitions* as the durable asset and the *Finnish coding* as an implementation detail to be abstracted away.
- Baseline measurement: today's `app.finngen_unmapped_codes` distribution is ICD8=3,983 / ICD10_UNMATCHED=2,961 / ICDO3=1,107 / ICD9_FIN=958 / NOMESCO=453 / KELA_REIMB=61 / ATC_UNMATCHED=4 (total 9,527; roadmap baseline said 9,093 — investigate the delta during research).
- Cross-walk authoring priority reflects clinical value density: ICD-8 (3,983 rows) and NOMESCO (453 surgical rows) pay the biggest lift per mapping; KELA_REIMB at 61 rows is cheap to cover.
- The "Rett dual-mapping" pattern from IRSF Phase 6 (`SNOMED_MAPPINGS` in `irsf_vocabulary.py`) is precedent for authoring dual target mappings when a source code has both a clinically useful local mapping and a standard concept target.

</specifics>

<deferred>
## Deferred Ideas

### Moved to future phases
- **Phase 18.5: Finnish CDM Enablement** (NEW; to be inserted between Phase 18 and any v1.1 work) — Custom Finnish OMOP vocabulary load (GENOMICS-12b). Only runs when a Finnish-sourced CDM (THL HILMO, AvoHILMO, KanTa) is attached. Registers ICD-8, ICD9_FIN, ICD-10-FI, ICDO3-FI, NOMESCO, KELA_REIMB as custom OMOP vocabularies with concept_id ≥ 2B. Not in v1.0 scope.

### Noted but not explored this phase
- Auto-translation of Finnish concept_name / synonym content to English (would matter for Phase 18.5, not Phase 13 — no concept rows are added here).
- Integration with HPO (Human Phenotype Ontology) as an additional cross-walk target for rare-disease endpoints — belongs to a future rare-disease-focused phase.
- Phoebe recommendation integration for auto-suggesting cross-walk targets — belongs to a tooling phase, not this one.

### Reviewed Todos (not folded)
(No matching pending todos — `todo_count` = 0.)

</deferred>

---

*Phase: 13-finngen-endpoint-universalization*
*Context gathered: 2026-04-17*
