# Genomics #01 — FinnGen curated endpoint library import (DF14)

**Quick task:** `260416-qpg`
**Commits:** `f4a9561c2`, `44909d0b5` (+ this devlog)
**Date:** 2026-04-16

## Why

First step of the FinnGen genomics roadmap (items #1–#4 from the workbench
genomics gap analysis). FinnGen publishes a canonical phenotype taxonomy used
across all FinnGen GWAS, Risteys, and PheWeb work. Importing it gives Parthenon
researchers FinnGen-aligned cohort definitions for free and unlocks future
GWAS, PRS, and Risteys-style modules — those depend on a shared phenotype
vocabulary with FinnGen.

## What landed

### Source

- **File:** `FINNGEN_ENDPOINTS_DF14_Final_2026-02-13_public.xlsx` (864 KB, 47 cols)
- **Origin:** [finngen.fi clinical endpoints page](https://www.finngen.fi/en/researchers/clinical-endpoints) — the XLSX on finngen.fi is the source of truth (no GitHub repo is authoritative for the endpoint definitions).
- **License:** "Use freely but if used extensively please mention the source" — citation in `backend/database/fixtures/finngen/LICENSE.md`.
- Committed as a fixture; `fetch.sh` provided for df12/df13 if needed.

### Code

- `app/Enums/CohortDomain.php` — added `FINNGEN_ENDPOINT` case (no DB migration; column is varchar(50)).
- `app/Models/App/FinnGenUnmappedCode.php` + migration `2026_04_16_190000_create_finngen_unmapped_codes_table.php` — sidecar table for codes that didn't resolve to OMOP `concept_id` during import.
- `app/Services/FinnGen/{FinnGenXlsxReader, FinnGenPatternExpander, FinnGenConceptResolver, FinnGenEndpointImporter}` + `Dto/{EndpointRow, ImportReport}`.
- `app/Console/Commands/FinnGen/ImportEndpointsCommand.php` — `php artisan finngen:import-endpoints --release=df14 [--dry-run] [--fixture=path] [--limit=N] [--no-solr-reindex]`.
- `composer require phpoffice/phpspreadsheet` (5.5.0) — XLSX parsing.

### Tests

34 passing Pest tests across `Unit/FinnGen/{XlsxReaderTest, PatternExpansionTest}` and `Feature/FinnGen/{ConceptResolutionTest, ImportEndpointsCommandTest}`. Tests run against the committed 10-row `sample_endpoints.xlsx`, not the full DF14 file.

## Production results (DF14 against live `parthenon` DB)

### Coverage breakdown

| Bucket | Count | % | Meaning |
|---|---|---|---|
| **FULLY_MAPPED** (≥95% codes mapped) | 1,180 | 22.9% | Cohort-generation ready |
| **PARTIAL** (50–94% codes mapped) | 884 | 17.1% | Mostly usable; minor code gaps |
| **SPARSE** (1–49%) | 1,500 | 29.1% | Some codes mapped; partial defs |
| **UNMAPPED** (0%) | 1,268 | 24.6% | Awaits Finnish vocab loading |
| **CONTROL_ONLY** | 329 | 6.4% | No codes — defines a control group |
| **Total** | **5,161** | 100% | |

**~40% are immediately useful** (FULLY + PARTIAL = 2,064 endpoints). Another 29% (SPARSE) have *some* codes mapped and may produce partial cohorts. 25% are blocked on Finnish vocab loading.

### Verification queries

```
finngen_endpoint cohort_defs        | 5161  -- exactly matches parsed total
unmapped sidecar rows               | 9093  -- unique (endpoint, code, vocab)
unique unmapped vocabularies        | 7
Solr docs in cohorts core           | 5246  -- 5161 imported + 85 prior cohort defs
```

Idempotency confirmed: 2nd run (`--no-solr-reindex`) produced no new rows.

### Top unmapped vocabularies (by unique code count)

| Source vocab | Unique codes | Total observations |
|---|---|---|
| ICD-8 (Finnish) | 3,821 | 7,470 |
| ICD10_UNMATCHED (Finnish ICD-10 extensions) | 2,957 | 5,826 |
| ICDO3 (oncology morphology) | 1,073 | 1,073 |
| ICD9_FIN (Finnish ICD-9) | 958 | 1,907 |
| NOMESCO (Nordic surgery codes) | 219 | 219 |
| KELA_REIMB (drug reimbursement) | 61 | 61 |
| ATC_UNMATCHED | 4 | 4 |

**ATC mapping is essentially perfect** (only 4 codes unresolved out of thousands). The biggest gap is ICD-8 — `vocab.concept` doesn't have ICD-8 loaded at all.

## Honest gaps

1. **`coverage_bucket` not stored per-row.** The classification (FULLY/PARTIAL/SPARSE/UNMAPPED/CONTROL_ONLY) is only in `storage/app/finngen-endpoints/df14-coverage.json`, not on each `cohort_definitions` row's `expression_json`. Workbench cohort picker can't filter by bucket today. Cheap follow-up: store it in `expression_json.coverage_bucket` during import.
2. **Finnish vocabulary is not loaded.** ICD-8, Finnish ICD-9, ICDO3, NOMESCO, KELA_REIMB — none are in `vocab.concept`. The unmapped sidecar table captures every unresolved code so a future "load Finnish OMOP vocabularies" task has a precise target list.
3. **`expression_json` uses custom `kind: "finngen_endpoint"` shape, not Circe.** This is intentional (Finnish regex codes, INCLUDE composition, and KELA reimbursement rules can't round-trip through Circe). It means these definitions don't currently flow through the existing Circe-based cohort generators in Parthenon. Generation against actual CDM data is item #2 in the genomics roadmap.
4. **DF13 not staged.** Only DF12 fixture was checked-in alongside DF14. `fetch.sh` will pull DF12 or DF13 on demand; if researchers need a specific older release, they run that script.

## How to use

```bash
# Re-run the import (idempotent)
docker compose exec php php artisan finngen:import-endpoints --release=df14

# Dry-run (no DB writes; shows planned counts)
docker compose exec php php artisan finngen:import-endpoints --release=df14 --dry-run

# Older releases (downloads on demand)
backend/database/fixtures/finngen/fetch.sh df12
docker compose exec php php artisan finngen:import-endpoints --release=df12

# Find FinnGen endpoints in the workbench cohort picker
# → filter by tag: finngen-endpoint
# → or by tag: finngen:df14 for release-specific subset
```

## Next genomics steps (deferred)

- **#2 — Risteys-style endpoint dashboard** (`co2.endpoint_profile`): ~3 days. Reuses the imported defs as the per-endpoint catalog.
- **#3 — `gwas.regenie`**: ~2–3 weeks. Workbench cohort → regenie pipeline → results schema → PheWeb-lite Manhattan UI.
- **#4 — `gwas.prs`**: PGS Catalog scoring; depends on #3 plumbing.
- **Finnish vocab loading** (separate quick task): turn the 9,093 unmapped codes into mapped concept_ids by loading ICD-8/ICD9_FIN/ICDO3 from FinnGen's vocabulary drops or the Finnish version of THL.

## References

- [FinnGen Clinical Endpoints page](https://www.finngen.fi/en/researchers/clinical-endpoints)
- [FinnGen Endpoint Definition Interpretation](https://docs.finngen.fi/finngen-data-specifics/endpoints/how-to-interpret-endpoint-definition-file)
- [FinnGen Endpoints Introduction](https://finngen.gitbook.io/documentation/methods/endpoints)
- Quick task plan: `.planning/quick/260416-qpg-import-finngen-curated-endpoint-library-/260416-qpg-PLAN.md`
- Research: `.planning/quick/260416-qpg-import-finngen-curated-endpoint-library-/260416-qpg-RESEARCH.md`
- Pre-import snapshot: `backups/pre-finngen-import-20260416T235540Z.sql`
