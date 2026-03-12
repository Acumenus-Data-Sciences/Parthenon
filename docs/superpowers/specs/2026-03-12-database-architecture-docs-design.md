# Database Architecture Documentation — Design Spec

> **Audience:** New developers onboarding to the Parthenon codebase
> **Approach:** Hybrid — static narrative guide with domain ERDs + automated audit command

## Goal

A new developer cloning Parthenon should be able to understand — within 15 minutes — why there are two PostgreSQL databases, which data lives where, how Laravel connections route queries, and how to verify their own environment is set up correctly.

## Context: The Dual-Database Decision

Parthenon deliberately splits data across two PostgreSQL instances:

- **Docker PG 16** (`parthenon` database, port 5480) — Portable application metadata. Users, roles, cohort definitions, studies, analyses, concept sets. Everything a `docker compose up` creates from scratch via migrations. Lightweight, disposable, re-seedable.

- **External PG 17** (`ohdsi` database, port 5432) — Operational data store. The real OMOP CDM with 1M+ patients and 1.8B+ clinical observations. Vocabulary tables (7.2M concepts). Achilles characterization results. GIS extension tables. This data is massive (hundreds of GB), ETL'd from claims/EHR sources, and would be absurd to containerize.

This is not a bug or technical debt — it's the standard OHDSI deployment pattern. Atlas/WebAPI does the same thing: the app tier is separate from the CDM tier. Parthenon just makes it explicit with named Laravel connections.

## Deliverable 1: Architecture Guide

**Path:** `docs/architecture/database-architecture.md`

### Sections

#### 1. The Two-Database Pattern
- Why the split exists (app metadata vs operational data store)
- Which database each Docker service connects to
- How env vars route connections between Docker-only and Acumenus deployments
- What happens after `docker compose up` (Docker PG has app tables + empty OMOP schemas; external PG has the real data)

#### 2. Connection Topology (Mermaid diagram)
A directed graph showing:
```
Browser → Laravel PHP → [pgsql] Docker PG (app schema)
                       → [cdm]  External PG (omop schema)
                       → [vocab] External PG (omop schema)
                       → [results] External PG (achilles_results schema)
                       → [gis] External PG (gis schema)
                       → [eunomia] Docker PG (eunomia schema)
         Python AI    → External PG (omop schema, pgvector)
         R Runtime    → Docker PG (eunomia schema) OR External PG
         Hecate       → External PG (omop schema)
```

#### 3. Schema Inventory

**Local PG 17 (`ohdsi`)** — 15 schemas:
| Schema | Tables | Purpose | Row Scale |
|--------|--------|---------|-----------|
| `omop` | 48 | Combined CDM v5.4 + vocabulary (Atlas/ETL convention) | 1.8B+ |
| `achilles_results` | 8 | Achilles characterization + DQD | 1.6M |
| `app` | 112 | Application tables (mirror of Docker, kept in sync) | Thousands |
| `gis` | 5 | GIS extension (geographic_location, external_exposure, hospitals) | Thousands |
| `eunomia` | 20 | GiBleed demo CDM (2,694 patients) | 343K |
| `eunomia_results` | 4 | Achilles results for Eunomia | 64K |
| `webapi` | 105 | Legacy Atlas WebAPI tables (read-only, historical) | ~0 |
| `basicauth` | 8 | Legacy Atlas auth (unused) | ~0 |
| `vocab` | 11 | Empty — created by migrations, unused on Acumenus | 0 |
| `cdm` | 24 | Empty — created by migrations, unused on Acumenus | 0 |
| `staging` | 1 | ETL staging area | Variable |
| `topology` | — | PostGIS topology extension | System |
| `vocabulary` | — | Legacy schema alias | 0 |
| `results` | — | Legacy schema from Atlas era | 0 |
| `public` | — | Default PostgreSQL schema | System |

**Docker PG 16 (`parthenon`)** — 7 schemas:
| Schema | Tables | Purpose |
|--------|--------|---------|
| `app` | 104 | Application tables from Laravel migrations |
| `vocab` | 0 | Created by init.sql, empty (populated only via Eunomia seeder) |
| `cdm` | 0 | Created by init.sql, empty (populated only via Eunomia seeder) |
| `achilles_results` | 0 | Created by init.sql, empty |
| `eunomia` | 0 | Created by init.sql, populated by `parthenon:load-eunomia` |
| `public` | 1 | Laravel migrations tracking |
| `topology` | 2 | PostGIS topology extension |

#### 4. The `omop` Schema Explained
The `omop` schema in the local database is a **combined CDM + vocabulary schema**. This is the standard Atlas/ETL convention where both clinical tables (person, visit_occurrence, condition_occurrence) and vocabulary tables (concept, concept_relationship, vocabulary) live in a single schema. Parthenon's separate `cdm` and `vocab` Laravel connections both point here via `search_path` overrides in `.env`:
```
CDM_DB_SEARCH_PATH=omop,public
VOCAB_DB_SEARCH_PATH=omop,public
```

#### 5. Laravel Connection Reference
Table documenting all 7 connections: name, default host/database, search_path, which models use it, and when to use each one.

#### 6. Common Gotchas
- Docker PG has empty OMOP schemas — this is expected, not a bug
- `docker compose restart` does NOT reload env vars — must `docker compose up -d`
- After `migrate:fresh`, sources/cohorts are gone — re-seed with `admin:seed` + `eunomia:seed-source`
- The `omop` schema has ETL-specific tables (claims, claims_transactions, states_map) not in standard OMOP CDM
- Legacy `webapi`/`basicauth` schemas are read-only artifacts from Atlas migration

#### 7. Deployment Profiles
Two documented configurations:

**Docker-only (new installs):**
- All connections point to Docker PG
- Eunomia demo dataset for CDM/vocab/results
- 2,694 patients, sufficient for development

**Acumenus (production):**
- App connection → Docker PG
- CDM/vocab/results/GIS → Local PG 17 (`ohdsi`)
- 1M patients, full Athena vocabulary, real Achilles results

## Deliverable 2: Domain ERDs

Five Mermaid `erDiagram` blocks embedded in the architecture guide. Each shows 10-20 tables with PKs, FKs, and key columns. Not exhaustive — focused on relationships that matter for understanding data flow.

### ERD 1: App Core
`users`, `roles`, `permissions`, `model_has_roles`, `personal_access_tokens`, `sources`, `source_daimons`, `auth_provider_settings`, `ai_provider_settings`

### ERD 2: Research Pipeline
`cohort_definitions` → `cohort_generations` → `analysis_executions` → `execution_logs`
`concept_sets` → `concept_set_items`
`studies` → `study_analyses` → `study_executions` → `study_results`
`characterizations`, `incidence_rate_analyses`, `pathway_analyses`, `estimation_analyses`, `prediction_analyses`, `sccs_analyses`, `evidence_synthesis_analyses`

### ERD 3: OMOP CDM v5.4
Standard clinical tables with `person` at center:
`person` → `visit_occurrence` → `condition_occurrence`, `drug_exposure`, `procedure_occurrence`, `measurement`, `observation`, `device_exposure`
`observation_period`, `condition_era`, `drug_era`, `cost`

### ERD 4: OMOP Vocabulary
`concept` ↔ `concept_relationship` ↔ `concept_ancestor`
`vocabulary`, `domain`, `concept_class`, `relationship`
`concept_synonym`, `drug_strength`, `source_to_concept_map`
`concept_embeddings` (pgvector, 768-dim)

### ERD 5: Extensions
**GIS:** `geographic_location` → `location_geography` → `external_exposure`, `geography_summary`, `gis_hospital`
**Genomics:** `genomic_uploads` → `genomic_variants` → `genomic_cohort_criteria`
**Imaging:** `imaging_studies` → `imaging_series` → `imaging_instances`, `imaging_measurements`, `imaging_features`
**HEOR:** `heor_analyses` → `heor_scenarios` → `heor_cost_parameters`, `heor_results`

## Deliverable 3: Audit Command

**Command:** `php artisan db:audit`

### Behavior
1. Iterates over configured connections: `pgsql`, `cdm`, `vocab`, `results`, `gis`, `eunomia`, `docker_pg`
2. For each connection:
   - Tests connectivity (catch and report failures gracefully)
   - Queries `pg_tables` for schema/table inventory
   - Queries `pg_stat_user_tables` for row counts
3. Outputs a formatted console table grouped by connection
4. Highlights discrepancies:
   - Empty schemas that should have data (yellow warning)
   - Connections that fail (red error)
   - Table count differences between `pgsql` and `docker_pg` (info)
5. Exits with status 0 (informational tool, not a gate)

### Options
- `--json` — output as JSON (for CI/scripting)
- `--connection=NAME` — audit a single connection

### Example Output
```
┌─────────────┬────────────┬────────────┬──────────────┐
│ Connection  │ Schema     │ Tables     │ Total Rows   │
├─────────────┼────────────┼────────────┼──────────────┤
│ pgsql       │ app        │ 112        │ 17,923,456   │
│ cdm         │ omop       │ 48         │ 1,831,204,876│
│ vocab       │ omop       │ 10 (vocab) │ 7,234,891    │
│ results     │ achilles_* │ 8          │ 1,604,143    │
│ gis         │ gis        │ 5          │ 54,007       │
│ eunomia     │ eunomia    │ 20         │ 343,070      │
│ docker_pg   │ app        │ 104        │ 1,204        │
├─────────────┼────────────┼────────────┼──────────────┤
│ ⚠ docker_pg │ vocab      │ 0 tables   │ Empty schema │
│ ⚠ docker_pg │ cdm        │ 0 tables   │ Empty schema │
│ ⚠ docker_pg │ achilles_* │ 0 tables   │ Empty schema │
└─────────────┴────────────┴────────────┴──────────────┘
```

## File Structure

```
docs/
  architecture/
    database-architecture.md    ← Main guide (narrative + embedded ERDs)
backend/
  app/Console/Commands/
    DatabaseAudit.php           ← php artisan db:audit
```

## Out of Scope

- Automated ERD generation from live schema (manual Mermaid is sufficient for 5 diagrams)
- Database migration tooling or schema synchronization between local and Docker
- Multi-dialect support documentation (Redshift, Snowflake — future phase)
- Performance tuning documentation
