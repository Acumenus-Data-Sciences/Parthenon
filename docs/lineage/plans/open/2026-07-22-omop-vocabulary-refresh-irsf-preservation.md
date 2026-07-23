---
doc_type: plan
status: open
date: 2026-07-22
owner: acumenus
module: omop-vocabulary
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/app/Console/Commands/LoadVocabularies.php
  - backend/app/Console/Commands/Omop/LoadVocabularyCommand.php
  - backend/app/Jobs/Vocabulary/VocabularyImportJob.php
  - backend/app/Services/Vocabulary/VocabularyImportService.php
  - backend/app/Console/Commands/ValidateSolrVocabularyCompleteness.php
  - backend/app/Console/Commands/SolrIndexVocabulary.php
  - backend/tests/Concerns/BootsTestSchemas.php
  - backend/tests/Feature/FinnGen/FinnGenSourceToConceptMapSeedTest.php
  - scripts/irsf_etl/
  - scripts/bootstrap-hecate.py
  - scripts/hecate_vocabulary_sync.py
  - scripts/cutover-hecate-qdrant.py
  - ai/app/chroma/clinical.py
  - ai/app/chroma/vocabulary_sync.py
  - templates/commercial/runtime/commercial/mapping/ingest_embeddings.py
related_prs: []
---

# OMOP Vocabulary Refresh and IRSF Preservation Plan

## Purpose

Make the 27 February 2026 Athena vocabulary refresh a fully supported,
repeatable Parthenon operation while preserving the IRSF Natural History Study
dataset, analytics, custom vocabulary, published designs, and executed results.

This plan is the execution authority for the post-refresh work. An item is
complete only when the evidence named beside it has been captured. The plan
must remain open until the source database, every derived search/vector store,
IRSF analytics, and the future import path have passed their full acceptance
gates.

## Required outcome

1. The live PostgreSQL `vocab` schema remains on Athena master release
   `v5.0 27-FEB-26` with the intentionally preserved MeSH 2025, ICD9CM v32,
   ICD9Proc v32, and IRSF-NHS 1.0 vocabularies.
2. The IRSF raw source dataset, transformed CDM, custom vocabulary, source
   registration, cohort definitions, analysis designs, executed cohorts,
   Achilles results, and DQD results are recoverable and unchanged except for
   removal of the known synthetic CI sentinel.
3. BGE, Solr, Chroma, and Hecate/Qdrant are synchronized from the same current
   vocabulary release and use explicitly documented inclusion policies.
4. Parthenon has one staging-first vocabulary refresh workflow with validation,
   preservation manifests, transactional cutover, downstream refreshes,
   rollback evidence, and an auditable import record.
5. Existing IRSF research cohorts and analytics still resolve and execute
   against source 57 after the refresh.

## Non-destructive invariants

- Never drop, truncate, rename, or bulk-rewrite `irsf` or `irsf_results` as
  part of vocabulary synchronization.
- Never delete a real IRSF-NHS vocabulary concept, relationship, source map,
  design, study, execution, or clinical/result row.
- The only approved IRSF row deletion is the exact synthetic
  `CI_IRSF_NHS_SENTINEL` source-map fixture after it is archived and the
  surrounding IRSF counts are proven unchanged.
- Do not run the existing `TRUNCATE ... CASCADE` vocabulary loaders against the
  live database.
- Do not replace a live Solr, Chroma, or Qdrant collection with a partially
  populated rebuild. Prefer a versioned build and cutover; otherwise use an
  announced maintenance window with a tested rollback.
- Keep the pre-refresh vocabulary backup and the dedicated IRSF preservation
  set until all completion gates pass.
- Keep Athena/CPT and IRSF data local. Do not add licensed or participant-level
  data to Git, logs, documentation, or public artifacts.
- Never persist database credentials in tracked files, import manifests, shell
  history excerpts, or documentation.

## Authoritative post-refresh baseline

Captured from host PostgreSQL 17 at `127.0.0.1:5432`, database `parthenon`, on
2026-07-22.

### Vocabulary and derived PostgreSQL state

| Object | Baseline |
|---|---:|
| Athena master release | `v5.0 27-FEB-26` |
| `vocab.concept` | 7,551,271 |
| `vocab.concept_relationship` | 45,498,324 |
| `vocab.concept_ancestor` | 84,404,308 |
| `vocab.concept_synonym` | 4,476,781 |
| `vocab.drug_strength` | 2,966,827 |
| `vocab.vocabulary` | 87 |
| `vocab.concept_tree` | 528,834 |
| each results hierarchy | 300,218 |
| VSAC materialized view | 224,820 |
| invalid vocabulary indexes | 0 |

### IRSF dataset and results state

| Object | Baseline |
|---|---:|
| source | id 57, key `IRSF-NHS` |
| CDM daimon | `irsf` |
| vocabulary daimon | `vocab` |
| results daimon | `irsf_results` |
| `irsf.person` | 1,858 |
| `irsf.observation_period` | 1,858 |
| `irsf.visit_occurrence` | 9,003 |
| `irsf.condition_occurrence` | 5,788 |
| `irsf.drug_exposure` | 41,866 |
| `irsf.measurement` | 370,581 |
| `irsf.observation` | 550,893 |
| `irsf.death` | 86 |
| `irsf.source_to_concept_map` | 121 |
| `irsf_results.cohort` | 7,804,803 |
| `irsf_results.concept_hierarchy` | 300,218 |
| `irsf_results.achilles_results` | 203,744 |
| `irsf_results.achilles_results_dist` | 764 |
| `irsf_results.dqd_results` | 1,995 |
| active IRSF cohort definitions | 22, ids 198-219 |
| IRSF studies | 6, ids 104-109 |
| IRSF analysis designs | 10 |
| completed source-57 analysis executions | 23 |
| source-57 cohort generations | 56 |
| invalid/unready IRSF indexes | 0 / 0 |

### IRSF-NHS vocabulary state

| Object | Baseline |
|---|---:|
| vocabulary rows | 1 |
| concepts | 117 valid standard concepts |
| concept relationships touching IRSF concepts | 254 |
| real source-map rows | 121 |
| synthetic sentinel rows | 1 |
| concept-id range | 2,000,001,000-2,000,004,013 |

The global `vocab.source_to_concept_map` count is 122 because it contains the
121 real IRSF mappings plus the leaked synthetic sentinel. The isolated
`irsf.source_to_concept_map` contains only the 121 real mappings.

## Recovery assets

- Pre-refresh vocabulary dump:
  `/mnt/md0/postgres-backups/manual/parthenon-vocab-pre-refresh-20260722T232125Z`
- Dedicated IRSF preservation set:
  `/mnt/md0/postgres-backups/manual/parthenon-irsf-preservation-20260722T235933Z`
- The dedicated set must contain:
  - a directory-format PostgreSQL dump of `irsf` and `irsf_results`;
  - the raw 444-file IRSF source dataset archive;
  - the ETL staging/report archive;
  - selected current IRSF-NHS vocabulary CSVs;
  - sanitized source/daimon metadata;
  - IRSF studies, cohorts, analysis designs, study links, executions, and
    cohort-generation metadata;
  - a restore listing, SHA-256 manifest, counts manifest, and verification log.

## Dependency-ordered implementation checklist

### Phase 0 - preservation and baseline proof

- [x] Confirm the real host database path and readiness.
- [x] Inventory all live IRSF schemas, tables, source daimons, designs, and
  execution metadata.
- [x] Capture exact post-refresh IRSF row-count baselines.
- [x] Confirm zero invalid or unready indexes in `irsf` and `irsf_results`.
- [x] Create a compressed directory-format dump of both IRSF schemas.
- [x] Verify that `pg_restore --list` can read the schema dump and contains
  table-data entries for every IRSF and IRSF-results table.
- [x] Finish the raw 444-file source-dataset archive.
- [x] Archive ETL staging and report output.
- [x] Export the current IRSF-NHS vocabulary slice and sanitized application
  analytics metadata.
- [x] Run `zstd --test` or the equivalent archive-integrity check on every
  compressed non-PostgreSQL artifact.
- [x] Write SHA-256 and object/count manifests for the complete recovery set.
- [x] Restore the schema dump into an isolated verification database.
- [x] Compare all 34 restored table counts with the live baseline.
- [x] Verify representative IRSF clinical and analytics queries in the restored
  database.

**Phase 0 closes when:** the recovery set is complete, hash-verified, and
successfully restored with matching counts. No live cleanup may precede this
gate.

### Phase 1 - eliminate the test leak and synthetic sentinel

- [x] Add explicit test-only `vocab_testing`, `omop_testing`, and
  `results_testing` connection behavior or rebind those logical connections to
  the `pgsql_testing` PDO during test bootstrap.
- [x] Add a test-bootstrap guard that fails before any write if a test
  connection resolves to database `parthenon`.
- [x] Add regression tests proving `DB::connection('vocab')` resolves to
  `parthenon_testing` and participates in rollback.
- [x] Rewrite `FinnGenSourceToConceptMapSeedTest` so it cannot write a fixture
  to the live vocabulary schema and cleans up defensively on failure.
- [x] Run the focused FinnGen source-map test suite against the isolated test
  database.
- [x] Archive the exact live sentinel row in the recovery manifest.
- [x] Delete only the exact row matching source code
  `CI_IRSF_NHS_SENTINEL`, source vocabulary `IRSF-NHS`, source concept
  9,900,001, and target concept 9,900,002.
- [x] Prove that global real IRSF source maps remain 121, isolated IRSF source
  maps remain 121, IRSF concepts remain 117, and IRSF relationships remain
  254.

**Phase 1 closes when:** no production test fixture remains, all real IRSF
counts match baseline, and tests cannot reach the live database.

### Phase 2 - BGE/pgvector synchronization

- [x] Build or provision a one-off commercial runtime containing the pinned
  `sentence-transformers`, `torch`, and Parthenon commercial mapping package.
- [x] Inject the database DSN at runtime without persisting it.
- [x] Confirm the model is exactly `BAAI/bge-base-en-v1.5`, 768 dimensions,
  with normalized embeddings.
- [x] Run the idempotent loader for SNOMED, RxNorm, LOINC, ATC, and HCPCS. ATC
  produces no rows under the current valid standard (`S`) mapping contract
  because ATC concepts are classifications (`C`), not standard targets.
- [x] Confirm all 2,035 current missing eligible embeddings were populated.
- [x] Confirm zero eligible concepts are missing and no embedding references a
  nonexistent concept.
- [x] Confirm every row uses the expected model name and dimension.
- [x] Run targeted `ANALYZE`; the valid/ready index did not require a rebuild.
  Install `pg_prewarm` and load the 2.48 GB IVFFlat index into the 16 GB shared
  buffer pool after cold storage latency exceeded the restricted role's query
  timeout.
- [x] Persist the Python model cache in the ignored, user-writable `ai/models/`
  bind mount rather than the root-owned `/tmp/parthenon-ai-models` path.
- [x] Bound filtered ANN searches by materializing 500 or more nearest
  candidates before applying vocabulary/domain metadata filters; cover the
  filtered and unfiltered SQL shapes with regression tests.
- [x] Run Ariadne retrieval smoke tests with known SNOMED, RxNorm, LOINC, and
  HCPCS concepts. Record ATC as deliberately absent from this standard-target
  corpus until a classification-aware retrieval contract is approved.

**Phase 2 closes when:** BGE eligibility, model, dimension, FK, index, and
retrieval checks all pass.

### Phase 3 - Solr synchronization and validator repair

- [x] Fix the validator so PostgreSQL and Solr counts use identical inclusion
  rules; a value over 100% must fail rather than pass.
- [x] Replace `ORDER BY random()` sampling over millions of concepts with an
  efficient, reproducible sampling strategy.
- [x] Validate document fields, not merely ID presence, for sampled concepts.
- [x] Add tests covering missing documents, stale standard/validity flags,
  surplus documents, and count mismatches.
- [x] Build a fresh vocabulary index from all 7,551,271 current concepts.
- [x] Prefer a replacement core/alias cutover; record a maintenance and rollback
  plan if the current single-core deployment prevents that.
- [x] Confirm the final Solr document count matches PostgreSQL exactly.
- [x] Confirm CPT 99213 and 99214 carry current names and
  `standard_concept = S`.
- [x] Confirm all 117 IRSF-NHS concepts are searchable with current fields.
- [x] Run the repaired completeness validator and vocabulary search smoke tests.

The replacement core is `vocabulary_20260227`. The Laravel runtime selects it
through `SOLR_CORE_VOCABULARY`; the unchanged 7,195,041-document `vocabulary`
core is the immediate rollback target. The bulk build temporarily lengthened
auto-commit intervals, restored the normal 15-second hard/1-second soft policy
after the explicit commit, and raised the dedicated client commit timeout to
300 seconds because the full commit plus suggester build required 179 seconds.

**Phase 3 closes when:** the repaired validator passes exact counts, field
freshness, IRSF inclusion, and representative searches.

### Phase 4 - Abby Chroma clinical-reference synchronization

- [x] Record the current clinical-reference collection count and metadata.
- [x] Add a versioned rebuild/cutover path or document a maintenance-window
  rebuild with rollback.
- [x] Rebuild from the current eligibility query; do not rely on upsert-only
  ingestion because it cannot remove newly invalid/nonstandard concepts.
- [x] Confirm the rebuilt count matches the SQL eligibility count (892,831
  under the final policy: the four clinical domains plus every valid standard
  IRSF-NHS and CPT4 concept, excluding RxNorm Extension).
- [x] Confirm all 117 eligible IRSF-NHS concepts are present with current names,
  domains, vocabulary IDs, and embeddings.
- [x] Confirm CPT 99213 and 99214 are present.
- [x] Run Abby clinical retrieval smoke tests before cutover.

**Phase 4 closes when:** collection count, IRSF/CPT membership, metadata, and
retrieval checks match the current database.

The original live `clinical_reference` collection has 624,821 records and
`hnsw:space = cosine`. Two non-live candidates were deliberately rejected and
removed: the first omitted 1,135 Observation-domain CPT4 concepts; the second
had exact membership but used a defective local `nomic-embed-text` runtime
that collapsed unrelated short labels ending in the same token to identical
vectors. The synchronizer now rejects that failure mode and can reuse
name-verified `embeddinggemma:300m` vectors from the audited Hecate/Qdrant
replacement without reusing the defective semantic space.

### Phase 5 - Hecate/Qdrant synchronization

- [x] Record a product/architecture decision on RxNorm Extension inclusion.
  The recommended policy is to exclude its approximately 1.86 million
  NDC/package concepts, matching Chroma, unless a concrete Hecate use case
  requires them.
- [x] Make the inclusion policy explicit in code and in a generated manifest.
- [x] Replace high-water-mark-only resume behavior with membership/change-aware
  synchronization so lower-ID additions and renamed concepts cannot be skipped.
- [x] Preserve the embedding-model lock: `embeddinggemma:300m` behind the
  `text-embedding-3-large:latest` alias expected by Hecate.
- [x] Build a versioned replacement collection rather than partially updating
  the live `meddra` collection.
- [x] Include all 117 IRSF-NHS concepts and verify their current payloads.
- [x] Remove stale/ineligible points in the replacement collection.
- [x] Generate and hash the new pairs file.
- [x] Run semantic search acceptance probes, then cut over with rollback
  available.

**Phase 5 closes when:** inclusion policy, exact point count, model identity,
IRSF membership, payload freshness, pairs file, and search probes pass.

### Phase 6 - production-safe vocabulary refresh service

- [x] Consolidate the CLI command, admin import job, and external-source
  preflight command around one import service.
- [x] Correct singular OMOP vocabulary table names everywhere.
- [x] Replace live per-table `TRUNCATE ... CASCADE` with staging, validation,
  and transactional cutover that preserves table/view contracts.
- [x] Validate headers, file set, row counts, duplicate keys, referential
  integrity, date ranges, and required vocabulary metadata before cutover.
- [x] Add an explicit preservation policy for local/omitted vocabularies,
  including IRSF-NHS, with a fail-closed default.
- [x] Require an explicit override before removing any omitted vocabulary.
- [x] Make CPT/UMLS handling conditional on the actual downloaded file state;
  never log keys or licensed content.
- [x] Preserve valid embeddings and invalidate only rows whose concept name,
  eligibility, or model identity changed.
- [ ] Rebuild `concept_tree`, every results hierarchy, and the VSAC materialized
  view in the orchestrated workflow.
- [ ] Orchestrate BGE, Solr, Chroma, and Hecate refreshes with checkpointed
  status and retry behavior.
- [x] Record file hashes, master release, per-vocabulary versions, omitted and
  preserved vocabularies, before/after counts, backup path, operator, timing,
  downstream status, and validation results.
- [x] Make `omop:load-vocabulary` fail or report preflight-only status until it
  performs a real import; it must not return a misleading success.
- [x] Add isolated PostgreSQL integration tests for success, validation failure,
  rollback, omitted-vocabulary preservation, IRSF preservation, embedding FK
  behavior, and downstream failure recovery.

**Phase 6 closes when:** all import entry points use the same tested service and
an IRSF-preservation integration test proves the real invariant.

### Phase 7 - IRSF analytics and research acceptance

- [x] Reconfirm source 57 and all three daimons.
- [x] Reconfirm every baseline IRSF CDM and results-table count.
- [x] Reconfirm the 117 custom concepts, 254 relationships, and 121 real source
  maps.
- [x] Run IRSF temporal, rejection, Rett plausibility, DQD, and Achilles
  validation using non-mutating/report-only modes where available.
- [x] Verify the 22 active cohort definitions still resolve every referenced
  concept ID.
- [ ] Recompile/generate representative T1, T2, T3, T4, outcome, and exposure
  cohorts into a separate verification target or transaction and compare
  counts with the preserved baseline.
- [x] Verify the ten IRSF analysis designs, six studies, 23 completed executions,
  56 cohort generations, and their study/cohort links remain present.
- [x] Review the 32 nonstandard and 28 invalid concepts used by the broader
  4,804 saved concept-set items; identify which, if any, affect IRSF designs.
- [ ] Run representative characterization, incidence, pathway, estimation,
  prediction, and SCCS read/smoke paths against source 57.
- [x] Confirm no participant-level values or licensed vocabulary content leaked
  into Git or logs during the work.

The non-mutating acceptance pass found no IRSF data loss: all 34 table counts
and all eight preservation fingerprints remain exact. All 46 concept
references across 19 of the 22 JSON cohort expressions resolve, but 12
references use six now-nonstandard RxNorm brand concepts. The broader 4,804
saved concept-set items still contain 32 nonstandard rows, 28 of them invalid;
none are IRSF-NHS concepts. These are semantic-governance follow-ups, not safe
automatic rewrites during a preservation-first vocabulary refresh.

The rejection gate passes: high-priority error rejection rates are 0% for
drug exposure, measurement, and observation, and 1.89% for visits. The latest
stored DQD run does not pass its release threshold: 129 of 170 checks pass
(75.88%) and 120 of 157 populated-table checks pass (76.43%) against an 80%
target. Existing temporal debt includes 1,688 future-dated observations, 41
future-ended observation periods, 58 condition end-before-start rows, and 522
drug end-before-start rows. These findings predate and are unchanged by the
vocabulary work, so the plan remains open for a governed IRSF data-quality
tranche.

**Phase 7 closes when:** IRSF clinical data, cohorts, designs, executions,
results, and validators match the preserved evidence or every intentional
semantic difference is reviewed and documented.

### Phase 8 - closeout and operationalization

- [x] Run focused backend, AI, template, and IRSF ETL tests.
- [ ] Run migration status and application health checks.
- [x] Run `graphify update .` after code changes.
- [ ] Regenerate the lineage catalog and pass document checks.
- [x] Record final database, Solr, Chroma, Qdrant, BGE, and IRSF counts here.
- [x] Record exact rollback procedures and retention decision for both backups.
- [ ] Move this plan to `docs/lineage/plans/closed/`, set `status: shipped`, and
  update the open-plan backlog only after every closure gate is proven.

## Rollback strategy

1. **IRSF database:** restore `irsf` and `irsf_results` into a separate database
   first; never overwrite the live schemas without a separately approved
   incident recovery action.
2. **Synthetic sentinel cleanup:** recover the exact archived row from the
   support export if an unexpected dependency is discovered.
3. **Vocabulary source:** use the pre-refresh directory dump only for a planned
   rollback after comparing release and IRSF preservation manifests.
4. **Solr/Chroma/Qdrant:** retain the prior core/collection until the new version
   passes acceptance, then switch back if post-cutover probes fail.
5. **Embeddings:** the BGE loader is additive/idempotent. Preserve model identity
   and restore the prior table from the pre-refresh dump only if validation
   proves corruption.

Operational rollback commands and order:

- Solr: restore `SOLR_CORE_VOCABULARY=vocabulary`, recreate PHP/Horizon, and
  rerun the exact-count validator before accepting traffic.
- Chroma: restore `CHROMA_CLINICAL_COLLECTION=clinical_reference`, recreate
  `python-ai`, and run exact membership plus semantic probes. The unchanged
  624,821-record collection remains in Chroma for this purpose.
- Hecate: stop Hecate; upload the retained 7,292,466,688-byte snapshot from
  `/mnt/md0/postgres-backups/manual/parthenon-hecate-qdrant-pre-cutover-20260723T031500Z/`
  into a new Qdrant rollback collection; verify its 1,968,694-point count;
  replace alias `meddra`; restore the backed-up `all_pairs.txt`; and start
  Hecate only after exact and semantic probes pass.
- PostgreSQL: use `pg_restore` from
  `/mnt/md0/postgres-backups/manual/parthenon-vocab-pre-refresh-20260722T232125Z`
  into a separate verification database first. A live schema overwrite
  requires a separately approved maintenance/incident action.

All PostgreSQL, IRSF, Solr, Chroma, Qdrant, Hecate-pairs, and Redis rollback
assets are retained. Do not prune them until the remaining Phase 6/7 research
and orchestration gates close or an owner records a replacement retention
decision.

## Known risks and decisions still required

- The Hecate policy is now explicit: valid standard concepts are included and
  RxNorm Extension package/NDC concepts are excluded. A future product need
  for package-level mapping requires a separate ADR and capacity test.
- The corrected Chroma collection must use `embeddinggemma:300m`; the rejected
  `nomic-embed-text` semantic space must never be promoted or reused.
- Database cutover is staged and tested, but the import service intentionally
  leaves hierarchy, VSAC, BGE, Solr, Chroma, and Hecate work as auditable
  pending checkpoints. Automated retry/orchestration remains follow-up work.
- IRSF DQD remains below threshold, six legacy RxNorm brands in IRSF cohort
  expressions are nonstandard, and 21 source-57 cohort generations are not in
  `completed` state (nine failed, twelve queued). Preserve these records until
  a research owner approves semantic updates and regeneration.
- The manual refresh audit row must be written only after the hardening
  migration is deployed and every downstream status is confirmed complete.

## Evidence log

| Date | Evidence | Result |
|---|---|---|
| 2026-07-22 | Host PostgreSQL post-refresh audit | Vocabulary tables, derived PostgreSQL structures, views, FKs, and indexes passed. |
| 2026-07-22 | IRSF live inventory | Dataset, results, source daimons, cohorts, studies, designs, and executions recorded in this plan. |
| 2026-07-22 | Dedicated IRSF schema dump | Created, readable via `pg_restore --list`, and restored successfully into an isolated verification database. |
| 2026-07-22 | Downstream inventory | BGE missing 2,035; Solr stale; Chroma incomplete; Hecate incomplete under current code policy. |
| 2026-07-22 | Dedicated IRSF recovery verification | All archives passed integrity and SHA-256 checks; the schema dump restored into `parthenon_irsf_restore_verify_20260722`; all 34 table counts and representative fingerprints matched. |
| 2026-07-22 | Test isolation and sentinel cleanup | Logical clinical connections now share the test PDO, unsafe database names fail before DDL, focused tests passed, the archived sentinel was removed, and every real IRSF invariant remained exact. |
| 2026-07-22 | BGE backfill and integrity audit | Populated all 2,035 missing eligible rows; 634,277 of 634,277 eligible concepts are embedded, no eligible rows are missing, no orphan embeddings exist, all 634,295 stored rows use the pinned 768-dimensional model, and all indexes are valid/ready. |
| 2026-07-22 | BGE runtime and retrieval smoke | Replaced the root-owned temporary cache with persistent `ai/models/`, repaired bounded filtered ANN search, passed focused tests, prewarmed 317,478 IVFFlat blocks, and returned exact SNOMED/RxNorm/LOINC matches plus relevant HCPCS results. |
| 2026-07-22 | BGE IRSF preservation check | IRSF remained at 1,858 persons, 370,581 measurements, 550,893 observations, and 7,804,803 cohort rows after the backfill and runtime repair. |
| 2026-07-22 | Solr validator negative control | The repaired validator correctly failed the old core for a 356,230-document deficit, three missing sampled documents, and stale validity/name fields. |
| 2026-07-22 | Redis recovery prerequisite | Backed up and hash-verified the 67.6 MB named volume at `/mnt/md0/postgres-backups/manual/parthenon-redis-pre-aof-repair-20260723T005600Z`, truncated only the checker-proven 750-byte corrupt AOF tail, and restored healthy 0.001-second cache access. |
| 2026-07-22 | Solr replacement validation | `vocabulary_20260227` contains exactly 7,551,271 documents; the deterministic 1,000-document field audit passed with zero missing, unexpected, or stale documents; CPT 99213/99214 and all 117 IRSF-NHS concepts passed direct checks. |
| 2026-07-22 | Solr application cutover | Laravel resolves `vocabulary_20260227`; application-level CPT and IRSF searches passed; PHP, Horizon, Redis, and Solr are healthy; the old core remains intact as rollback. |
| 2026-07-22 | Production-safe import service | Unified CLI and queued imports behind a staging-first service; real-package file inspection passed; 15 focused service/command/PostgreSQL tests pass with 31 assertions, including full preflight, omitted IRSF preservation, rollback, source-map failure, and selective BGE invalidation. |
| 2026-07-22 | Chroma candidate acceptance | Exact 892,831-row membership exposed a defective `nomic-embed-text` short-label semantic space; the candidate was not promoted, the active 624,821-row collection remained unchanged, and the synchronizer now rejects collapsed models and supports audited Qdrant vector reuse. |
| 2026-07-22 | Hecate versioned build and cutover | `meddra_20260227` passed exact 1,366,041-point membership, all 117 IRSF concepts, zero missing/stale payloads, `embeddinggemma:300m` model-alias cosine 1.0, and Rett/humerus/hemoglobin probes. The 1,968,694-point prior collection was exported as a 7,292,466,688-byte hash-verified snapshot before alias cutover; Hecate is healthy and loads 1,304,155 unique names. |
| 2026-07-22 | Chroma final build acceptance | `clinical_reference_20260227_v3` contains exactly 892,831 records, reused 892,831 audited Qdrant vectors and generated zero, has no missing/stale records, contains all 117 IRSF concepts and CPT 99213/99214, and passes Rett/humerus/hemoglobin semantic probes. The 624,821-record prior collection remains intact. |
| 2026-07-22 | Focused regression gates | 36 AI/synchronizer tests, 22 backend tests with 55 assertions, 571 IRSF ETL tests, four runnable commercial mapping tests, 99 changed-frontend Vitest tests, PHPStan, scoped Pint, TypeScript, ESLint, Python compilation, Compose validation, and Graphify update passed. Environment-dependent commercial acceptance cases remained explicitly skipped. |
| 2026-07-22 | IRSF final count and fingerprint audit | All 34 live IRSF/IRSF-results table counts and eight representative fingerprints exactly match the preservation set. |
| 2026-07-22 | IRSF research-reference audit | All referenced concept IDs resolve; 22 active cohorts, six studies, ten designs, 23 completed executions, and 56 generation records remain present. Six legacy RxNorm brands account for 12 nonstandard cohort references. |
| 2026-07-22 | IRSF validation follow-up | Rejection gate passed, but DQD remained below target at 75.88% overall and 76.43% on populated-table checks; temporal anomalies were recorded without changing participant data. |

## Final synchronized counts

| Store | Final accepted state |
|---|---:|
| PostgreSQL `vocab.concept` | 7,551,271 |
| PostgreSQL `vocab.concept_embedding_bge` eligible/current | 634,277 / 634,277 |
| Solr `vocabulary_20260227` | 7,551,271 |
| Chroma `clinical_reference_20260227_v3` | 892,831 |
| Qdrant `meddra` alias -> `meddra_20260227` | 1,366,041 |
| Hecate unique-name pairs | 1,304,155 names / 1,366,041 points |
| IRSF custom vocabulary | 117 concepts / 254 relationships / 121 real maps |
| IRSF CDM/result tables | all 34 counts and eight fingerprints exact |

## Closure condition

This plan closes only when every unchecked item is completed or an explicit ADR
records a deliberate de-scope, all IRSF invariants pass against current live
evidence, downstream stores match their documented source queries, the future
refresh workflow is staging-first and tested, and the recovery assets have been
restore-verified.
