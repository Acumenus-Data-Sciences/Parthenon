# Acropolis: DataHub Enterprise Data Catalog — Full Annotation

**Date:** 2026-04-03
**Author:** Dr. Sanjay Udoshi
**Status:** Complete
**Impact:** 376 datasets, ~4,100 columns, 100% documentation coverage across 680 GB of clinical research data

---

## Summary

Built a complete enterprise data catalog in DataHub for the Parthenon platform — every table, every column, across every schema. Starting from an empty DataHub instance with a broken ingestion pipeline, reached 100% documentation coverage in a single session: 376 datasets organized into 6 domains, annotated with 13 glossary terms across 3 semantic groups, tagged with 6 classification labels, and documented at the column level using OHDSI CDM v5.4 specifications.

## Starting Point

DataHub was deployed as part of the Acropolis Enterprise stack but had never successfully ingested metadata:

1. **DataHub frontend couldn't provision users** — missing `DATAHUB_SYSTEM_CLIENT_ID` and `DATAHUB_SYSTEM_CLIENT_SECRET` env vars meant the frontend's post-OIDC calls to GMS `/entities` were rejected
2. **Actions container Kafka consumer broken** — `SCHEMA_REGISTRY_URL` was not set, defaulting to `localhost:8081` instead of `datahub-schema-registry:8081`
3. **No datasets, no domains, no documentation** — a single stale "Parthenon" domain with no contents

## Infrastructure Fixes

| Fix | File | Impact |
|-----|------|--------|
| Added `DATAHUB_SYSTEM_CLIENT_ID` + `DATAHUB_SYSTEM_CLIENT_SECRET` to frontend | `docker-compose.enterprise.yml` | OIDC user provisioning works |
| Added `SCHEMA_REGISTRY_URL` to actions container | `docker-compose.enterprise.yml` | Kafka consumer deserializes events |
| Disabled native OIDC (`AUTH_OIDC_ENABLED=false`) | `docker-compose.enterprise.yml` | Forward auth only, no provisioning failures |

## Database Characterization

Before ingestion, characterized the full Parthenon database:

| Schema | Tables | Size | Description |
|--------|--------|------|-------------|
| `omop` | 46 | 333 GB | Acumenus 1M-patient CDM (711M measurements, 343M observations) |
| `irsf` | 39 | 314 GB | IRSF Natural History Study CDM (459M claims transactions) |
| `vocab` | 11 | 14 GB | Shared OMOP Vocabulary (79M ancestor relationships, 41M concept relationships) |
| `app` | 174 | 9.2 GB | Parthenon application tables (users, cohorts, sources, 28M genomic variants) |
| `atlantic_health` | 26 | 8.3 GB | Atlantic Health System MIMIC-style clinical data + materialized views |
| `results` | 9 | 1.6 GB | Acumenus Achilles/DQD characterization output |
| `irsf_results` | 8 | 1.0 GB | IRSF Achilles/DQD output |
| `mimiciv` | 31 | 178 MB | MIMIC-IV ICU CDM (Beth Israel Deaconess) |
| `pancreas` | 26 | 26 MB | Pancreatic Cancer Corpus (361 patients, multimodal) |
| `pancreas_results` | 5 | 400 KB | Pancreas Achilles output |
| **Total** | **375** | **680 GB** | **~2.6 billion rows, ~4,100 columns** |

## Metadata Ingestion

Ran the PostgreSQL ingestion recipe from the DataHub actions container:

```
Pipeline finished successfully; produced 1963 events in 6.11 seconds.
Tables scanned: 368 | Views scanned: 7 | Records written: 1,963
```

The `pg_recipe.yml` was pre-configured with schema allow-lists covering all 10 active schemas. Ingestion captured table structures, column types, primary/foreign keys, and view lineage (Atlantic Health materialized views, Pancreas vocab views).

## Domain Architecture

Created 6 logical domains to organize datasets by function:

| Domain | Datasets | Purpose |
|--------|----------|---------|
| **Parthenon Application** | 174 | User management, cohort definitions, studies, RBAC, platform state |
| **Clinical Data (OMOP CDM)** | 85 | Patient-level clinical data across Acumenus 1M and IRSF study |
| **Research Corpora** | 83 | Purpose-built datasets: Atlantic Health, Pancreas Corpus, MIMIC-IV |
| **Analytics & Results** | 22 | Achilles characterization, DQD output, computed analytics |
| **OMOP Vocabulary** | 11 | Shared standardized terminology backbone (80+ vocabularies) |
| **Data Infrastructure** | 0 | Pipeline orchestration (Poseidon Dagster — schema exists, tables pending) |

## Glossary & Classification

### Glossary Terms (13 terms across 3 groups)

**Data Standards:**
- OMOP CDM v5.4 — OHDSI Common Data Model
- FHIR R4 — HL7 interoperability standard
- OHDSI Standardized Vocabulary — 80+ clinical terminologies with cross-vocabulary mappings
- Achilles Characterization — Population-level database summaries

**Data Sources:**
- Acumenus 1M CDM — Primary synthetic research corpus
- IRSF Natural History Study — Retroperitoneal fibrosis claims + clinical
- Pancreatic Cancer Corpus — 361-patient multimodal research dataset
- Atlantic Health System — Clinical data warehouse
- MIMIC-IV — MIT de-identified ICU data

**Data Sensitivity:**
- De-identified (Safe Harbor) — HIPAA Safe Harbor compliant
- Limited Data Set — Dates/geography retained under DUA
- Synthetic Data — No real patients
- Platform Internal — Application state, not clinical

### Classification Tags (6 tags)

| Tag | Applied To | Purpose |
|-----|-----------|---------|
| `OMOP CDM` | omop, irsf, pancreas, atlantic_health, mimiciv | Standard CDM tables |
| `Achilles Output` | results, irsf_results, pancreas_results | Characterization output |
| `PHI` | irsf, atlantic_health, mimiciv | Contains protected health information |
| `Synthetic` | omop, pancreas | Computationally generated data |
| `Shared Vocabulary` | vocab | Cross-source terminology |
| `Research Ready` | omop, irsf, pancreas | Validated for outcomes research |

Every dataset carries both glossary terms (semantic meaning) and tags (operational classification).

## Documentation

### Approach

Documentation was authored in 4 waves, with 3 running as parallel agents:

1. **Analytics & Results** (22 tables) — Manual, first wave. Achilles, DQD, cohort, and concept_hierarchy tables documented with OHDSI-specification column descriptions.

2. **OMOP Vocabulary + CDM** (58 tables) — Researched from [OHDSI CDM v5.4 specification](https://ohdsi.github.io/CommonDataModel/cdm54.html). All clinical tables, derived eras, health economics, health system, metadata, and ETL staging tables. Column descriptions follow CDM conventions: primary keys, concept FK semantics, type concept provenance, source value/source concept ID patterns.

3. **IRSF CDM** (39 tables) — Parallel agent. Same CDM structure as omop, recontextualized for the IRSF Natural History Study.

4. **Research Corpora** (83 tables) — Parallel agent. Atlantic Health (MIMIC-style clinical + materialized views), Pancreas Corpus (CDM + vocab views), MIMIC-IV (ICU tables in CDM format).

5. **App ML tables** (5 tables) — Parallel agent. Patient similarity, feature vectors, network analysis, measurement statistics.

### Coverage

```
DATAHUB DOCUMENTATION COVERAGE
Total datasets:   376
Documented:       376 (100%)
Undocumented:     0

Domain                              Done  Total   Pct
Analytics & Results                  22/22   100%  DONE
Clinical Data (OMOP CDM)            85/85   100%  DONE
OMOP Vocabulary                     11/11   100%  DONE
Parthenon Application              174/174  100%  DONE
Research Corpora                    83/83   100%  DONE
```

### Documentation Depth

Every table has:
- **Table description** — what it stores, row count context, relationship to other tables
- **Column descriptions** — every column documented with:
  - Data semantics (what the value means clinically)
  - Foreign key targets (which table/column it references)
  - OMOP conventions (concept FK patterns, source value patterns, type concept provenance)
  - Domain-specific context (IRSF study, MIMIC-IV ICU, Pancreas corpus)

Column descriptions are authored per the OHDSI CDM v5.4 specification for all standard CDM tables, with Parthenon-specific documentation for application tables, ETL staging tables, and ML/analytics tables.

## Technical Notes

### DataHub API Patterns

- **Table descriptions** via `editableProperties.description` — persists across re-ingestion
- **Column descriptions** via `editableSchemaMetadata.editableSchemaFieldInfo` — MUST send all columns in a single mutation per table (individual calls overwrite the entire array)
- **Domain assignment** via `setDomain` mutation — one call per dataset
- **Glossary terms** via `addTerms` mutation — supports batch term assignment per dataset
- **Tags** via `addTags` mutation — supports batch tag assignment per dataset
- **Domains** created via `createDomain` with explicit IDs for stable URNs
- **Glossary structure** created via `createGlossaryNode` (groups) + `createGlossaryTerm` (terms) with `parentNode` references

### Parallelization

The documentation push used 3 parallel agents for the final 127 tables:
- Agent 1: IRSF schema (39 tables) — 4.3 minutes
- Agent 2: Research Corpora (83 tables) — 30.7 minutes
- Agent 3: App ML tables (5 tables) — 1.9 minutes

Total wall-clock time for full catalog build: ~45 minutes from empty DataHub to 100% coverage.

### Edge Cases

- 3 tables (mimiciv.pharmacy, mimiciv.prescriptions, pancreas.provider) initially failed column annotation due to duplicate `fieldPath` entries in the mutation — deduplicated and re-pushed successfully
- View lineage auto-detected for Atlantic Health materialized views and Pancreas vocab views
- Vocabulary tables exist in both `vocab` and `omop` schemas — omop copies documented as "resolves to vocab.* via search_path" to avoid duplication

## What's Next

- Schedule recurring ingestion to capture schema changes automatically
- Add data quality scores from DQD results as DataHub data quality assertions
- Configure DataHub lineage for the Parthenon ETL pipeline (Poseidon Dagster)
- Add column-level lineage for Achilles SQL templates (achilles_results ← CDM tables)
- Set up DataHub incidents/monitoring integration with Wazuh
