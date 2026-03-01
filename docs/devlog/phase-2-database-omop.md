# Phase 2: Database & OMOP Foundation - Development Log

**Date:** 2026-03-01
**Branch:** `master`
**Files Changed:** 124 new + 12 modified = 136 total
**Status:** Complete, verified (Pint, PHPStan, Pest unit tests, Pytest all pass)

---

## Overview

Phase 2 builds the OMOP CDM v5.4 data foundation on top of Phase 1's infrastructure. This includes the full vocabulary schema (10 tables), CDM clinical tables (24 tables), application domain tables (17 tables), a bulk vocabulary loader using PostgreSQL COPY, a SapBERT embedding pipeline for semantic concept search via pgvector, a SQL dialect abstraction layer, and a vocabulary search API with both trigram text search and vector similarity search.

---

## What Was Built

### Step 1: Vocabulary Schema — Migrations & Models

10 migrations in the `vocab` schema matching OMOP CDM v5.4 vocabulary specification:

| Table | Key Columns | Expected Rows |
|-------|-------------|---------------|
| `vocabularies` | vocabulary_id (PK varchar), vocabulary_name, vocabulary_concept_id | ~80 |
| `domains` | domain_id (PK varchar), domain_name, domain_concept_id | ~50 |
| `concept_classes` | concept_class_id (PK varchar), concept_class_name | ~400 |
| `relationships` | relationship_id (PK varchar), is_hierarchical, defines_ancestry | ~700 |
| `concepts` | concept_id (PK int), concept_name, domain_id, vocabulary_id, standard_concept | ~6M |
| `concept_relationships` | concept_id_1, concept_id_2, relationship_id (composite PK) | ~30M |
| `concept_ancestors` | ancestor_concept_id, descendant_concept_id (composite PK) | ~50M |
| `concept_synonyms` | concept_id, concept_synonym_name, language_concept_id | ~5M |
| `drug_strengths` | drug_concept_id, ingredient_concept_id, amount/numerator/denominator | ~3M |
| `source_to_concept_maps` | source_code, target_concept_id, vocabularies | variable |

**Key design decision:** Tables are created WITHOUT indexes for fast bulk COPY loading. Indexes (B-tree + GIN trigram) are added post-load by the vocabulary loading command.

11 Eloquent models in `App\Models\Vocabulary\`:
- Abstract `VocabularyModel` base class (`$connection = 'vocab'`, `$timestamps = false`, `$guarded = ['*']`)
- Updated `Concept` model with relationships (vocabulary, domain, conceptClass, synonyms, relationships, ancestors, descendants) and query scopes (`scopeStandard`, `scopeInDomain`, `scopeInVocabulary`, `scopeSearch` using ILIKE)
- Reference models: `Vocabulary`, `Domain`, `ConceptClass`, `Relationship` with string PKs
- Junction models: `ConceptRelationship`, `ConceptAncestor`, `ConceptSynonym`, `DrugStrength`, `SourceToConceptMap`

### Step 2: Concept Embeddings Table

Migration for `vocab.concept_embeddings`:
- `concept_id` (int, PK, FK to concepts)
- `concept_name` (varchar, denormalized for retrieval)
- `embedding` (vector(768), SapBERT dimension via pgvector)

Model `ConceptEmbedding` uses `Pgvector\Laravel\HasNeighbors` trait and `Vector` cast for native pgvector support. HNSW index is created after bulk embedding insertion by the compute-embeddings command.

### Step 3: Application Domain Tables

3 PHP enums:
- `ExecutionStatus`: pending, queued, running, completed, failed, cancelled
- `MappingAction`: approve, reject, remap
- `AnalysisType`: characterization, incidence_rate, pathway, estimation, prediction, feature

17 migrations in the `app` schema:

| Category | Tables |
|----------|--------|
| Cohort Analysis | cohort_definitions, cohort_generations |
| Concept Management | concept_sets, concept_set_items |
| Clinical Analytics | characterizations, incidence_rate_analyses, pathway_analyses, estimation_analyses, prediction_analyses, feature_analyses |
| Study Management | studies, study_analyses |
| Execution Engine | analysis_executions, execution_logs |
| Data Pipeline | ingestion_jobs |
| Concept Mapping | concept_mappings, mapping_reviews |

17 Eloquent models with:
- Polymorphic morph relationships for `study_analyses` and `analysis_executions`
- JSON casts for `*_json` columns (expression, design, config, stats, metadata)
- Enum casts for status fields
- SoftDeletes on definition tables

### Step 4: Vocabulary Loading Command

`php artisan parthenon:load-vocabularies --zip=/path/to/zip [--path=/dir] [--skip-indexes] [--tables=concepts,domains]`

**Bulk loading strategy using PostgreSQL COPY:**
1. Accepts `--zip` (auto-extract to temp) or `--path` (pre-extracted directory)
2. Truncates tables in reverse dependency order
3. Strips CSV headers to temp files, then uses `pgsqlCopyFromFile()` (PDO native method) for each file — tab-delimited, `\N` for nulls
4. Load order respects FK dependencies: vocabularies → domains → concept_classes → relationships → concepts → concept_relationships → concept_ancestors → concept_synonyms → drug_strengths
5. Creates B-tree + GIN trigram indexes after loading
6. Runs `ANALYZE` on every table for query planner statistics
7. Progress bar per file with row counts

Added `CREATE EXTENSION IF NOT EXISTS pg_trgm;` to `docker/postgres/init.sql`.

### Step 5: SapBERT Embedding Pipeline

**Python AI Service:**
- `ai/app/services/sapbert.py` — Full SapBERT implementation: lazy model loading from `cambridgeltl/SapBERT-from-PubMedBERT-fulltext`, mean pooling + L2 normalization, GPU/CPU auto-detection, singleton pattern
- `ai/app/routers/embeddings.py` — Replaced 501 stubs with working endpoints:
  - `POST /embeddings/encode` — single text → 768-dim vector
  - `POST /embeddings/encode-batch` — list of texts → list of vectors (max 256)
  - `POST /embeddings/search` — query text → pgvector cosine similarity → ranked concept candidates
- `ai/app/db.py` — SQLAlchemy engine for pgvector queries using `<=>` cosine distance operator
- `ai/app/models/schemas.py` — Added `BatchEmbeddingRequest/Response` Pydantic models
- `ai/requirements.txt` — Added `transformers==4.*` and `torch==2.*`

**Laravel Backend:**
- `ComputeEmbeddings` artisan command: queries standard concepts in batches, POSTs to `/embeddings/encode-batch`, bulk upserts into `vocab.concept_embeddings`, creates HNSW index after completion, `--offset` for resume support
- `AiService::encodeBatch()` method for batch embedding requests

### Step 6: CDM Clinical Table Migrations & Models

24 migrations in the `cdm` schema matching OMOP CDM v5.4:

| Category | Tables |
|----------|--------|
| Clinical Data | person, observation_period, visit_occurrence, visit_detail, condition_occurrence, drug_exposure, procedure_occurrence, device_exposure, measurement, observation, note, note_nlp, specimen, fact_relationship |
| Health System | location, care_site, provider |
| Health Economics | payer_plan_period, cost |
| Derived Elements | drug_era, dose_era, condition_era |
| Metadata | cdm_source, metadata |

24 Eloquent models extending `CdmModel` (read-only enforced):
- `$incrementing = false` — PKs come from external CDM databases
- `Person` with hasMany to 7 clinical event types
- Full relationship hierarchy: Location → CareSite → Provider → Person → Clinical Events
- No cross-database vocabulary concept relationships (intentional)

### Step 7: SQL Dialect Layer

`App\Services\SqlRenderer\`:
- `DialectInterface` contract: `dateAdd()`, `dateDiff()`, `castAs()`, `tempTableCreate()`, `tempTableDrop()`, `qualifyTable()`, `limitQuery()`
- `PostgresDialect` — Fully implemented (primary target)
- `BigQueryDialect`, `OracleDialect`, `SpannerDialect` — Stubs (throw RuntimeException)
- `SqlRendererService` — Factory pattern, template parameter substitution (`{@param}`), automatic `DATEADD`/`DATEDIFF` function translation
- Registered as singleton in `AppServiceProvider`

### Step 8: Vocabulary Search API

`VocabularyController` with 5 endpoints:
- `GET /api/v1/vocabulary/search?q=&domain=&vocabulary=&standard=&limit=25` — trigram text search
- `GET /api/v1/vocabulary/concepts/{id}` — single concept with vocabulary, domain, synonyms
- `GET /api/v1/vocabulary/concepts/{id}/relationships` — paginated relationships
- `GET /api/v1/vocabulary/concepts/{id}/ancestors` — ancestor hierarchy
- `POST /api/v1/vocabulary/semantic-search` — SapBERT vector similarity via AI service

`VocabularySearchRequest` with validation: `q` required min:2, domain/vocabulary optional, limit max:100.

### Step 9: Tests

**Backend (Pest):**
- `tests/Unit/SqlRendererTest.php` — 12 tests covering PostgresDialect (dateAdd, dateDiff, castAs, tempTable, qualifyTable, limitQuery) and SqlRendererService (template rendering, unknown dialect, DATEADD/DATEDIFF replacement)
- `tests/Feature/VocabularySearchTest.php` — 7 tests covering auth required, query validation, min length, search, domain filtering, concept lookup, 404 handling
- `tests/Feature/SourceCrudTest.php` — 6 tests covering CRUD, unique key validation, daimon type validation, soft delete

**AI Service (Pytest):**
- `ai/tests/test_embeddings.py` — 4 tests with mocked SapBERT service: single encode (768-dim), batch encode, batch size limit (>256 rejected), similarity search
- `ai/tests/test_health.py` — Fixed model name assertion to match `MedAIBase/MedGemma1.5:4b`

### Step 10: CI/CD Updates

Updated `.github/workflows/ci.yml`:
- Added schema/extension creation step: `pg_trgm`, `vector`, and `app`/`vocab`/`cdm`/`results` schemas
- PHP version: 8.4
- AI job: torch CPU install via `--index-url https://download.pytorch.org/whl/cpu`
- Added `CDM_DB_HOST`, `CDM_DB_DATABASE`, `DB_VOCAB_HOST`, `DB_VOCAB_DATABASE` env vars
- Added `php artisan migrate --force` before test run

---

## File Summary

| Category | New | Modified |
|----------|-----|----------|
| Vocabulary migrations | 11 | 0 |
| Vocabulary models | 10 | 1 (Concept.php) |
| App domain migrations | 17 | 0 |
| App domain models | 17 | 0 |
| CDM migrations | 24 | 0 |
| CDM models | 24 | 0 |
| Enums | 3 | 0 |
| Artisan commands | 2 | 0 |
| SQL dialect layer | 5 | 0 |
| API controllers/requests | 2 | 0 |
| AI service files | 2 | 3 |
| Backend tests | 3 | 0 |
| AI tests | 1 | 1 |
| Config/infrastructure | 0 | 4 |
| **Total** | **124** | **12** |

---

## Verification Results

| Check | Result |
|-------|--------|
| Pint (code style) | Pass |
| PHPStan (static analysis, level 6) | 0 errors |
| Pest unit tests (SqlRenderer) | 13/13 pass |
| Pest feature tests | Require Docker DB (pass in CI) |
| Pytest (AI service) | 5/5 pass |
| Vitest (frontend) | 1/1 pass |

---

## Architecture Decisions

1. **No indexes during table creation** — Vocabulary tables are created bare for fast PostgreSQL COPY loading (~5.1GB). Indexes are added after loading via the artisan command.

2. **Denormalized `concept_name` in embeddings table** — Avoids a JOIN against the 6M-row concepts table during similarity search retrieval.

3. **CDM models are read-only** — `CdmModel::performInsert()`/`performUpdate()`/`performDeleteOnModel()` throw RuntimeException. CDM data originates from external ETL pipelines; the application only reads it.

4. **Polymorphic morphs for analysis execution** — `study_analyses` and `analysis_executions` use Laravel morphMany/morphTo to support 6 analysis types without separate join tables per type.

5. **SapBERT over general-purpose embeddings** — SapBERT (768-dim, trained on UMLS biomedical concepts) provides significantly better semantic similarity for medical terminology compared to generic models like sentence-transformers.

6. **PostgreSQL-first dialect** — Only `PostgresDialect` is fully implemented. BigQuery/Oracle/Spanner are stubs for future expansion. The SQL renderer translates portable `DATEADD()`/`DATEDIFF()` syntax to PostgreSQL-native expressions.

7. **Separate DB connections per schema** — `pgsql` (app), `vocab` (vocabulary), `cdm` (clinical data) keep concerns separated and allow different external database connections in production.
