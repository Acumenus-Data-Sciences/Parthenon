---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: FinnGen Genomics v1
status: defining_requirements
stopped_at: Milestone v1.0 FinnGen Genomics started 2026-04-16
last_updated: "2026-04-17T01:15:00.000Z"
last_activity: 2026-04-16 - Milestone v1.0 FinnGen Genomics started; phenotyping foundation (PHENO-01..08) validated and live in production
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-16 — Milestone v1.0 FinnGen Genomics)

**Core value:** A researcher can pick any of 5,161 FinnGen-aligned phenotypes from the catalog, materialize a cohort against any source CDM, run a GWAS on that cohort, see Manhattan-plot results in the browser, compute polygenic risk scores against PGS Catalog summary stats, and inspect Risteys-style mortality / comorbidity dashboards — all without leaving Parthenon.
**Current focus:** Defining requirements + roadmapping (Phase 13+ continuing IRSF numbering)

## Current Position

Phase: Not started — defining requirements
Plan: —
Status: Defining requirements (REQUIREMENTS.md drafted; awaiting roadmap)
Last activity: 2026-04-16 — Milestone v1.0 FinnGen Genomics started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 3
- Average duration: 4.0min
- Total execution time: 0.20 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | 9min | 4.5min |
| 02 | 1 | 3min | 3.0min |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 09 P01 | 5min | 5 tasks | 4 files |
| Phase 10 P01 | 4min | 4 tasks | 4 files |
| Phase 07 P01 | 3min | 3 tasks | 4 files |
| Phase 06 P01 | 7min | 2 tasks | 5 files |
| Phase 04 P01 | 3min | 1 tasks | 2 files |
| Phase 03 P02 | 3min | 1 tasks | 3 files |
| Phase 02 P02 | 3min | 1 tasks | 3 files |
| Phase 03 P01 | 4min | 2 tasks | 6 files |
| Phase 04 P03 | 3min | 1 tasks | 2 files |
| Phase 04 P02 | 3min | 1 tasks | 2 files |
| Phase 05 P01 | 6min | 5 tasks | 5 files |
| Phase 06 P02 | 3min | 2 tasks | 5 files |
| Phase 05 P02 | 3min | 3 tasks | 2 files |
| Phase 08 P01 | 7min | 11 tasks | 3 files |
| Phase 08-conditions P02 | 3min | 6 tasks | 2 files |
| Phase 07 P02 | 3min | 2 tasks | 2 files |
| Phase 09 P02 | 3min | 4 tasks | 3 files |
| Phase 10 P02 | 4min | 3 tasks | 3 files |
| Phase 07 P03 | 5min | 5 tasks | 4 files |
| Phase 09 P03 | 7min | 5 tasks | 2 files |
| Phase 10 P03 | 5min | 7 tasks | 3 files |
| Phase 11 P01 | 11min | 1 tasks | 1 files |
| Phase 11 P02 | 10min | 1 tasks | 2 files |
| Phase 12 P01 | 5min | 4 tasks | 3 files |
| Phase 12 P02 | 3min | 3 tasks | 3 files |
| Phase 12 P03 | 4min | 2 tasks | 2 files |
| Phase 260411-qux P01 | 13min | 2 tasks | 624 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 12-phase fine-grained structure derived from 51 requirements across 11 categories
- [Roadmap]: Phases 2+3 parallelizable (shared lib split by dependency), Phases 7-10 parallelizable (clinical domains independent after person/visit/vocab)
- [Roadmap]: SRC-01 and SRC-02 (source value preservation) assigned to Phase 7 (Medications) as first clinical domain establishing the pattern
- [Phase 01]: Used underscore directory name (irsf_etl) for Python import compatibility
- [Phase 01]: Created dedicated .venv in scripts/irsf_etl/ for ETL dependencies
- [Phase 01-02]: Used keep_default_na=False for pandas 3.x empty string vs null distinction
- [Phase 01-02]: Fixed source directory paths to match actual layout (5211_Custom_Extracts, csv/ subdirs)
- [Phase 01-02]: Added _is_string_dtype helper for pandas 3.x StringDtype compatibility
- [Phase 02-01]: Frozen dict for month lookup (avoids locale sensitivity vs calendar.month_abbr)
- [Phase 02-01]: Day clamping to month max (improvement over SQL's simple <1/>31 check)
- [Phase 02-01]: _safe_int pattern for unified NaN/NA/None/float coercion in pandas columns
- [Phase 03]: RejectionCategory.CUSTOM severity set to warning (safe default for user-defined categories)
- [Phase 02]: person_id = int(participant_id) -- direct integer use as OMOP person_id, no hashing
- [Phase 03]: Used psycopg2-binary for PostgreSQL access with search_path=omop schema isolation
- [Phase 03]: Batch queries chunk at 1000 items to avoid PostgreSQL parameter limits
- [Phase 04-01]: 2-digit year pivot at 25 for Rett patient DOBs (00-25->2000s, 26-99->1900s)
- [Phase 04-01]: Missing DOB logged as warning, not error -- patient included without DOB
- [Phase 04-01]: Demographics_5211 join via dict lookup for O(1) participant_id matching
- [Phase 06-01]: Block-allocated concept IDs: CSS 2B+1000, MBA 2B+2000, Mutations 2B+3000, Diagnoses 2B+4000
- [Phase 06-01]: Used csv module (not pandas) for CSV generation -- lighter dependency, consistent quoting
- [Phase 06-01]: Both OtherMCP2Mutations and OtherMECP2Mutations get separate concepts (both exist in source data)
- [Phase 04]: Load only DeathRecord_5211 (strict superset of 5201); dedup keeps first valid record per person_id
- [Phase 04]: Multi-race patients get concept_id=0 with comma-separated source_value
- [Phase 06]: SNOMED dual mappings for 4 diagnoses: Classic Rett (4288480), Atypical Rett (37397680), MECP2 duplication (45765797), FOXG1 (45765499)
- [Phase 06]: VocabularyLoader uses DELETE+INSERT in single transaction for idempotent re-runs with parameterized queries
- [Phase 05]: LogMasterForm_5211 as authoritative 5211 visit source (not scanning 60+ clinical tables)
- [Phase 05]: 822 5201-only patients identified and scanned from ClinicalAssessment + Measurements
- [Phase 05]: Dedup on (person_id, visit_date, visit_concept_id) -- same date different type creates separate records
- [Phase 05]: max_year=2026 for hospitalization date assembly (data includes recent hospitalizations)
- [Phase 05]: Outpatient (9202) preferred in date-only fallback for VisitResolver when multiple visits on same person+date
- [Phase 05]: Binary search (bisect) for nearest-date fallback with sorted date list per person
- [Phase 05]: resolve_series returns pd.Int64Dtype array with pd.NA for unresolved (consistent with PersonIdRegistry pattern)
- [Phase 07]: Regex ordering: code:(digits) before code:RX10(digits) -- RX10 prefix naturally fails numeric-only match
- [Phase 07]: assemble_stop_reason severity order: Ineffective, Side effects, Not needed
- [Phase 10]: pd.Int64Dtype() required for pandera nullable integer columns (pd.NA cannot coerce to int64)
- [Phase 10]: 40/41 MBA score columns mapped -- Scoliosis_MBA not in source CSV (source uses shared Scoliosis column)
- [Phase 10]: pandas melt approach for wide-to-long unpivot, dropna after melt for NULL score filtering
- [Phase 09]: pd.Int64Dtype() for nullable int Pandera schema columns (same pattern as Phase 10)
- [Phase 09]: NaT string treated as invalid date in unpivot (strftime on NaT produces literal "NaT")
- [Phase 09]: HeightMeasurementPosition appended as parenthetical to measurement_source_value
- [Phase 08]: condition_type_concept_id = 32879 (Registry) for all condition records
- [Phase 08]: SNOMED regex parser extracts code from formatted SNOWMEDOutput strings via code:(\d+)
- [Phase 08]: Not a seizure (390 rows) excluded from condition_occurrence; Rett spell emitted with concept_id=0
- [Phase 08-conditions]: Optional validator parameter on extract_conditions() -- None skips validation for DB-free testing
- [Phase 08-conditions]: condition_source_concept_id always preserves original pre-validation code for traceability
- [Phase 07]: Conditional ConceptStatus import for offline mode; Int64Dtype for nullable integers; MM/DD/YY + MM/DD/YYYY visit_date parsing
- [Phase 09]: CSS measure_specs built from _CSS_CONCEPTS source_column (data-driven, no hardcoded columns)
- [Phase 10]: 1,732 genotype rows from value=1 filter; 47/48 columns mapped; DOB as atemporal observation_date
- [Phase 07]: Int64Dtype for drug_exposure schema nullable integer columns (Pandera compatibility)
- [Phase 07]: Coverage rate 86.3% among parseable RxNorm codes; gap from 2,556 deprecated-no-replacement + 2,544 not-found-in-vocabulary
- [Phase 09]: Lab measurement_date uses DatePerformed (actual lab date), not visit_date; SF-36 uses keep_default_na=False for None text preservation
- [Phase 10]: Rett Features Everoccurred columns use Yes/No strings; _is_truthy handles both string and integer truthy values
- [Phase 10]: Timepoint observations (AtBaseline-At5Y) included in v1 for longitudinal tracking
- [Phase 11]: bigint for concept_id columns (SNOMED codes exceed int32); schema adaptation for existing OMOP tables; IRSF sentinel via person_source_value = person_id::text
- [Phase 11]: ObservationPeriodCalculator filters to person table via INNER JOIN to avoid orphan person_ids from shared event tables (procedure_occurrence had 110M rows from Synthea)
- [Phase 11]: CDM_SOURCE uses delete+insert for idempotency (no PK in OMOP spec)
- [Phase 12]: Achilles dispatch via API with --skip-dispatch fallback for post-hoc verification
- [Phase 12]: Temporal checks use year_of_birth comparison for before-birth since OMOP person may only have year
- [Phase 12]: MECP2 threshold lowered from 85% to 75% — only 77.8% of registry patients have genotype data
- [Phase 12]: unmapped_concept and deprecated_remapped classified as warnings (not errors) for rejection rate; error rate = 0% for drug_exposure vs 15.3% total
- [Phase quick-1]: source_to_concept_map is clinical data (moved to irsf schema), not shared vocab; load-vocab.sh reads from irsf schema
- [Phase 260411-qux]: Used color-mix(in srgb) for 8-char alpha hex values; kept CSS fallback pattern var(--x, #hex) in AboutAbbyModal

### Pending Todos

None yet.

### Blockers/Concerns

- REQUIREMENTS.md states 42 total requirements but actual count is 51. Traceability updated to reflect true count of 51.
- Research flags Phase 6 (Custom Vocabulary) as needing deeper research during planning for LOINC/HPO coverage of CSS/MBA items and MECP2 mutation taxonomy.
- Research flags Phase 12 (Validation) Rett-specific heuristic thresholds need domain expert confirmation before treating as hard assertion failures.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Create irsf/irsf_results schemas, migrate IRSF data, load shared vocab schema | 2026-03-27 | 9649b1c97 | [1-create-irsf-irsf-results-schemas-migrate](./quick/1-create-irsf-irsf-results-schemas-migrate/) |
| 2 | Add 3 publication templates to the Publish page: Comparative Effectiveness, Incidence Report, and Study Protocol | 2026-03-27 | 572db21a2 | [2-add-3-publication-templates](./quick/2-add-3-publication-templates-to-the-publi/) |
| 3 | Add save-to-vocabulary, save/load project actions to Mapping Assistant | 2026-03-27 | a657163ee | [3-add-action-arms-to-mapping-assistant-sav](./quick/3-add-action-arms-to-mapping-assistant-sav/) |
| 4 | Integrate Phoebe concept recommendations into Concept Set Editor and Detail page | 2026-03-27 | 85a9e950e | [4-integrate-phoebe-concept-recommendations](./quick/4-integrate-phoebe-concept-recommendations/) |
| 5 | Add Arachne federated execution service (backend + frontend) | 2026-03-27 | fa228d5e5 | [5-add-arachne-federated-execution-service-](./quick/5-add-arachne-federated-execution-service-/) |
| 6 | Build Strategus JSON spec builder UI with per-module config and JSON editor | 2026-03-27 | fed378b5e | [6-build-strategus-json-spec-builder-ui-for](./quick/6-build-strategus-json-spec-builder-ui-for/) |
| 7 | Replace Scramble with Scribe for static API documentation | 2026-03-27 | 63c0cd4e7 | [7-replace-scramble-with-scribe-for-api-ref](./quick/7-replace-scramble-with-scribe-for-api-ref/) |
| 8 | Integrate Scribe OpenAPI spec into Docusaurus site | 2026-03-27 | 713358ee9 | [8-integrate-scribe-openapi-spec-into-docus](./quick/8-integrate-scribe-openapi-spec-into-docus/) |
| 9 | Fix semantic search right panel empty and selection highlighting | 2026-03-28 | 04d7bf81f | [9-fix-semantic-search-ui-right-panel-empty](./quick/9-fix-semantic-search-ui-right-panel-empty/) |
| 10 | Populate remaining public domain survey instruments with question items | 2026-03-29 | b5763b7da | [10-populate-remaining-public-domain-survey-](./quick/10-populate-remaining-public-domain-survey-/) |
| 10 | Populate 29 remaining public domain survey instruments (605 items) | 2026-03-29 | 2932d2605 | [10-populate-remaining-public-domain-survey-](./quick/10-populate-remaining-public-domain-survey-/) |
| 12 | Implement all critical Wazuh post-install hardening (FIM, SCA, logs, demo users, ISM) | 2026-04-02 | 69da309c9 | [12-implement-all-critical-wazuh-post-instal](./quick/12-implement-all-critical-wazuh-post-instal/) |
| 13 | Harden webapp installer: port fallback, secure passwords, step validation, CSRF, subprocess cleanup | 2026-04-02 | bbdd1fa3e | [13-webapp-installer-refinement-port-fallbac](./quick/13-webapp-installer-refinement-port-fallbac/) |
| 14 | OIDC SSO for Grafana via Authentik — OAuth2 provider + Generic OAuth config | 2026-04-03 | 57e098975 | [14-oidc-sso-for-grafana-via-authentik-creat](./quick/14-oidc-sso-for-grafana-via-authentik-creat/) |
| 15 | Native SSO bootstrap for Acropolis installer (OIDC + SAML for all services) | 2026-04-03 | 052467c97 | [15-update-acropolis-installer-authentik-py-](./quick/15-update-acropolis-installer-authentik-py-/) |
| 16 | Rebuild cross-domain SNOMED hierarchy + clinical groupings navigation | 2026-04-05 | 4b0f8af45 | [16-rebuild-concept-hierarchy-cross-domain-s](./quick/16-rebuild-concept-hierarchy-cross-domain-s/) |
| 260411-qux | Replace 12,018 hardcoded hex colors with CSS variable tokens for light/dark theme | 2026-04-11 | 236111c22 | [260411-qux-automated-sweep](./quick/260411-qux-automated-sweep-replace-all-hardcoded-he/) |
| 17 | Refactor wiki engine to use ChromaDB for semantic search | 2026-04-06 | 8b5341775 | [17-refactor-wiki-engine-to-use-chromadb-for](./quick/17-refactor-wiki-engine-to-use-chromadb-for/) |
| 19 | Wiki UX cleanup: paginated list, debounced search, chat drawer | 2026-04-07 | pending | [19-wiki-ux-cleanup-paginated-list-keyword-s](./quick/19-wiki-ux-cleanup-paginated-list-keyword-s/) |
| 260410-4kk | Add hierarchical concept similarity (depth-weighted Jaccard via concept_ancestor) | 2026-04-10 | 407be6241 | [260410-4kk-add-hierarchical-concept-similarity-usin](./quick/260410-4kk-add-hierarchical-concept-similarity-usin/) |
| 260410-50r | Add Love Plot SMD visualization and JSD/Wasserstein distributional comparison | 2026-04-10 | 23dea1869 | [260410-50r-add-love-plot-smd-visualization-and-jsd-](./quick/260410-50r-add-love-plot-smd-visualization-and-jsd-/) |
| 260410-5vf | Add UMAP patient landscape visualization (Python AI + R3F scatter) | 2026-04-10 | 2a297fd78 | [260410-5vf-add-umap-patient-landscape-visualization](./quick/260410-5vf-add-umap-patient-landscape-visualization/) |
| 260410-6ep | Add propensity score matching (L1 logistic regression, PS matching) | 2026-04-10 | bad7b4845 | [260410-6ep-add-propensity-score-matching-python-ai-](./quick/260410-6ep-add-propensity-score-matching-python-ai-/) |
| 260410-73h | Add temporal similarity via DTW on lab trajectories | 2026-04-10 | 9a5194a7b | [260410-73h-add-temporal-similarity-via-dynamic-time](./quick/260410-73h-add-temporal-similarity-via-dynamic-time/) |
| 260410-7g0 | Add clustering-based phenotype discovery (consensus clustering + heatmap) | 2026-04-10 | 7eab94e24 | [260410-7g0-add-clustering-based-phenotype-discovery](./quick/260410-7g0-add-clustering-based-phenotype-discovery/) |
| 260411-s3c | Replace 1,150+ remaining hardcoded hex colors with CSS variable tokens | 2026-04-12 | 116c7ee33 | [260411-s3c-hunt-down-and-fix-all-remaining-light-mo](./quick/260411-s3c-hunt-down-and-fix-all-remaining-light-mo/) |
| 260411-sxo | Replace 1,033 hardcoded Tailwind grayscale utilities with theme-aware token classes | 2026-04-12 | c6587029d | [260411-sxo-replace-all-hardcoded-tailwind-grayscale](./quick/260411-sxo-replace-all-hardcoded-tailwind-grayscale/) |
| 260416-owf | Full live end-to-end smoke of SP4 workbench workers | 2026-04-16 | fc53cfdd7 | [260416-owf-full-live-end-to-end-smoke-of-sp4-workbe](./quick/260416-owf-full-live-end-to-end-smoke-of-sp4-workbe/) |
| 260416-qpg | Import FinnGen curated endpoint library (DF14, 5,161 phenotypes) into app.cohort_definitions | 2026-04-16 | 44909d0b5 | [260416-qpg-import-finngen-curated-endpoint-library-](./quick/260416-qpg-import-finngen-curated-endpoint-library-/) |

## Session Continuity

Last session: 2026-04-11T23:37:32.192Z
Stopped at: Completed 260411-qux (automated hex-to-token sweep)
Resume file: None
