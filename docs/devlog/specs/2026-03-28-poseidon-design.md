# Poseidon — dbt + Dagster Orchestration for OMOP CDM Maintenance

**Date:** 2026-03-28
**Status:** Design — Approved for Implementation
**Module:** Poseidon (new service)

---

## 1. Problem Statement

Parthenon's Aqueduct ingestion pipeline handles the **initial** ETL: file upload → profiling → concept mapping → schema mapping → CDM writing → validation. This works well for one-time bulk loads. But healthcare data sources are not static — EHR systems, LIMS, PACS, and claims feeds produce new data continuously. Keeping OMOP CDM current requires:

1. **Incremental loads** — only process new/changed records since last run
2. **Idempotent transformations** — re-running a pipeline produces the same result (no duplicates)
3. **Dependency-aware execution** — `visit_occurrence` must load before `condition_occurrence` (FK constraints)
4. **Schema evolution** — CDM table additions, vocabulary refreshes, and mapping corrections propagate cleanly
5. **Observability** — which tables are stale, when did the last refresh run, what failed and why
6. **Per-source scheduling** — EHR nightly, LIMS hourly, PACS on-demand

The current queue-based jobs (`WriteCdmDataJob`, `RunValidationJob`) lack these properties. They are fire-and-forget, non-incremental, and have no dependency graph.

## 2. Solution: Poseidon

**Poseidon** is a new Parthenon service that adds two complementary tools:

### 2.1 dbt (Data Build Tool)

dbt models the **transformation layer** — SQL-based transformations that turn staged source data into OMOP CDM tables. Each CDM table is a dbt model with:

- **Incremental materialization** — `INSERT ... WHERE modified_date > last_run_date`
- **Schema tests** — not-null, unique, accepted-values, foreign-key relationships
- **Source freshness checks** — alerts when a staging table hasn't been updated
- **Documentation** — auto-generated lineage DAG and data dictionary

dbt operates on the principle of **ELT** (Extract-Load-Transform): data is already loaded into PostgreSQL staging tables by Aqueduct's existing `StageFileJob`. dbt handles the T — transforming staged data into CDM tables using SQL models.

**Why dbt fits Parthenon:**
- SQL-native — all transformations are PostgreSQL SQL, matching Aqueduct's existing `EtlSqlGeneratorService` output
- Schema-aware — dbt models map directly to OMOP CDM tables
- Testable — built-in data quality assertions replace `PostLoadValidationService` for incremental runs
- Vocabulary-aware — can reference the shared `vocab` schema for concept lookups and domain routing

### 2.2 Dagster

Dagster is the **orchestration layer** — it schedules, monitors, and coordinates dbt runs plus any Python-based pre/post processing. Key capabilities:

- **Software-Defined Assets** — each CDM table is a Dagster asset backed by a dbt model. Dagster knows the dependency graph and materializes assets in topological order.
- **Partitions** — time-based partitions (daily, hourly) for incremental processing. Each partition tracks its own materialization state.
- **Sensors** — event-driven triggers. A sensor can watch a staging table for new rows, a file drop directory, or a FHIR subscription webhook, then kick off a pipeline run.
- **Schedules** — cron-based recurring runs, configurable per source.
- **Asset checks** — data quality assertions that run after materialization (row counts, freshness, referential integrity).
- **Dagit UI** — web-based DAG visualization, run history, logs, and alerting.

**Why Dagster over Airflow:**
- **Asset-centric** (not task-centric) — aligns with OMOP's table-oriented model
- **First-class dbt integration** (`dagster-dbt`) — auto-discovers dbt models as Dagster assets
- **Partitioning** — built-in time partitions for incremental ETL
- **Type system** — Pydantic-compatible IO managers for data validation
- **Single-process dev mode** — `dagster dev` runs everything locally (no separate scheduler/worker/webserver like Airflow)
- **Modern Python** — native async, type hints, dataclasses — matches our Python service patterns

### 2.3 How They Compose

```
                          Dagster (Orchestration)
                         ┌─────────────────────────────────┐
                         │                                 │
  ┌──────────┐    Sensor │  ┌──────────┐   ┌───────────┐  │  ┌───────────┐
  │ Aqueduct │ ─────────►│  │ Pre-     │──►│ dbt run   │──┼─►│ Post-     │
  │ Staging  │    (new   │  │ process  │   │ (CDM      │  │  │ process   │
  │ Tables   │    rows)  │  │ (Python) │   │  models)  │  │  │ (Achilles │
  └──────────┘           │  └──────────┘   └───────────┘  │  │  DQD,     │
                         │                                 │  │  Alerts)  │
  ┌──────────┐  Schedule │  ┌──────────┐   ┌───────────┐  │  └───────────┘
  │ EHR Feed │ ─────────►│  │ Extract  │──►│ dbt run   │──┤
  │ (HL7/    │  (nightly │  │ & Stage  │   │ --select  │  │
  │  FHIR)   │   2 AM)   │  │ (Python) │   │ tag:ehr   │  │
  └──────────┘           │  └──────────┘   └───────────┘  │
                         │                                 │
  ┌──────────┐   Manual  │  ┌──────────────────────────┐  │
  │ Parthenon│ ─────────►│  │ Full refresh             │──┤
  │ UI       │  (button) │  │ dbt run --full-refresh   │  │
  └──────────┘           │  └──────────────────────────┘  │
                         └─────────────────────────────────┘
```

## 3. Architecture

### 3.1 Directory Structure

```
poseidon/
├── README.md
├── pyproject.toml                    # Python package (dagster + dbt-postgres)
├── Makefile                          # Dev shortcuts
│
├── dbt/                              # dbt project root
│   ├── dbt_project.yml               # Project config (profile, vars, paths)
│   ├── profiles.yml                  # DB connection profiles (dev, staging, prod)
│   ├── packages.yml                  # dbt packages (dbt-utils, dbt-expectations)
│   │
│   ├── models/
│   │   ├── staging/                  # 1:1 with source staging tables (light cleanup)
│   │   │   ├── _staging__sources.yml # Source definitions + freshness checks
│   │   │   ├── stg_patients.sql
│   │   │   ├── stg_encounters.sql
│   │   │   ├── stg_diagnoses.sql
│   │   │   ├── stg_medications.sql
│   │   │   ├── stg_labs.sql
│   │   │   ├── stg_procedures.sql
│   │   │   └── stg_notes.sql
│   │   │
│   │   ├── intermediate/            # Business logic, concept mapping joins
│   │   │   ├── int_person.sql       # Dedupe, gender/race/ethnicity concept lookup
│   │   │   ├── int_visit.sql        # Visit type classification, care_site mapping
│   │   │   ├── int_condition.sql    # ICD→SNOMED via concept_relationship
│   │   │   ├── int_drug.sql         # NDC/RxNorm→standard concept
│   │   │   ├── int_measurement.sql  # LOINC→standard, unit harmonization
│   │   │   ├── int_procedure.sql    # CPT/HCPCS→SNOMED procedure
│   │   │   ├── int_observation.sql  # Catch-all domain routing
│   │   │   └── int_stem.sql         # Unified stem table for domain routing
│   │   │
│   │   ├── cdm/                     # Final CDM tables (incremental materialization)
│   │   │   ├── _cdm__schema.yml     # Column tests, relationships, descriptions
│   │   │   ├── person.sql
│   │   │   ├── observation_period.sql
│   │   │   ├── visit_occurrence.sql
│   │   │   ├── visit_detail.sql
│   │   │   ├── condition_occurrence.sql
│   │   │   ├── drug_exposure.sql
│   │   │   ├── procedure_occurrence.sql
│   │   │   ├── measurement.sql
│   │   │   ├── observation.sql
│   │   │   ├── device_exposure.sql
│   │   │   ├── death.sql
│   │   │   ├── note.sql
│   │   │   ├── note_nlp.sql
│   │   │   ├── specimen.sql
│   │   │   ├── payer_plan_period.sql
│   │   │   ├── cost.sql
│   │   │   └── drug_era.sql         # Era tables derived from exposures
│   │   │
│   │   └── quality/                 # Data quality models (post-load checks)
│   │       ├── dq_completeness.sql  # Required field coverage
│   │       ├── dq_conformance.sql   # Value domain checks
│   │       └── dq_plausibility.sql  # Clinical plausibility rules
│   │
│   ├── macros/                      # Reusable SQL macros
│   │   ├── concept_lookup.sql       # {{ concept_lookup('source_code', 'ICD10CM') }}
│   │   ├── standard_concept.sql     # {{ standard_concept('concept_id') }}
│   │   ├── domain_route.sql         # {{ domain_route('concept_id', 'Condition') }}
│   │   ├── incremental_filter.sql   # {{ incremental_filter('modified_date') }}
│   │   ├── generate_schema_name.sql # Override: route models to correct PG schema
│   │   └── hash_surrogate_key.sql   # Deterministic surrogate key generation
│   │
│   ├── seeds/                       # Static reference data
│   │   ├── cdm_domain_routing.csv   # domain_id → cdm_table mapping
│   │   └── unit_harmonization.csv   # Source unit → standard UCUM unit
│   │
│   ├── tests/                       # Custom data tests
│   │   ├── assert_fk_person.sql     # Every clinical table references valid person
│   │   ├── assert_valid_dates.sql   # start_date <= end_date
│   │   ├── assert_standard_concepts.sql  # All *_concept_id are standard
│   │   └── assert_observation_period_coverage.sql
│   │
│   └── snapshots/                   # SCD Type 2 tracking (optional)
│       └── snap_person.sql          # Track person demographic changes over time
│
├── dagster/                          # Dagster orchestration
│   ├── definitions.py               # Dagster Definitions entry point
│   ├── assets/
│   │   ├── dbt_assets.py            # Auto-load dbt models as Dagster assets
│   │   ├── staging_assets.py        # Python assets for pre-dbt staging
│   │   ├── achilles_assets.py       # Post-CDM Achilles/DQD trigger
│   │   └── vocabulary_assets.py     # Vocabulary refresh asset
│   ├── resources/
│   │   ├── database.py              # PostgreSQL resource (sqlalchemy)
│   │   ├── dbt_resource.py          # DbtCliResource configuration
│   │   ├── parthenon_api.py         # HTTP client for Laravel API callbacks
│   │   └── redis_resource.py        # Redis for status broadcasting
│   ├── sensors/
│   │   ├── staging_sensor.py        # Watch staging tables for new rows
│   │   ├── fhir_webhook_sensor.py   # FHIR subscription notifications
│   │   └── file_drop_sensor.py      # Watch filesystem for new uploads
│   ├── schedules/
│   │   ├── source_schedules.py      # Per-source cron schedules from DB config
│   │   └── vocabulary_refresh.py    # Weekly vocabulary rebuild
│   ├── jobs/
│   │   ├── incremental_refresh.py   # Standard incremental CDM refresh
│   │   ├── full_refresh.py          # Full rebuild (dbt run --full-refresh)
│   │   └── source_specific.py       # Per-source job factory
│   ├── partitions/
│   │   └── time_partitions.py       # Daily/hourly partition definitions
│   └── io_managers/
│       └── postgres_io.py           # Schema-aware PostgreSQL IO manager
│
├── docker/
│   └── poseidon/
│       ├── Dockerfile                # Python 3.12, dagster, dbt-postgres
│       └── entrypoint.sh            # Start dagster-webserver + dagster-daemon
│
└── tests/
    ├── test_dbt_models.py           # dbt model compilation tests
    ├── test_dagster_assets.py       # Dagster asset materialization tests
    └── test_sensors.py              # Sensor trigger tests
```

### 3.2 Docker Services

Two new containers in `docker-compose.yml`:

```yaml
# Poseidon — Dagster webserver (UI + API)
poseidon-server:
  container_name: parthenon-poseidon-server
  build:
    context: .
    dockerfile: poseidon/docker/poseidon/Dockerfile
  command: dagster-webserver -h 0.0.0.0 -p 3100 -w poseidon/dagster/definitions.py
  ports:
    - "${POSEIDON_PORT:-3100}:3100"
  volumes:
    - ./poseidon:/app/poseidon
    - poseidon_storage:/app/storage
  environment:
    - DAGSTER_HOME=/app/storage
    - DATABASE_URL=postgresql://claude_dev:${HECATE_PG_PASSWORD}@host.docker.internal:5432/parthenon
    - DBT_PROFILES_DIR=/app/poseidon/dbt
    - PARTHENON_API_URL=http://nginx:80/api/v1
    - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
  env_file:
    - ./backend/.env
  extra_hosts:
    - "host.docker.internal:host-gateway"
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  healthcheck:
    test: ["CMD", "curl", "-sf", "http://127.0.0.1:3100/server_info"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 30s
  deploy:
    resources:
      limits:
        memory: 2G
  networks:
    - parthenon
  restart: unless-stopped

# Poseidon — Dagster daemon (schedules, sensors, run launcher)
poseidon-daemon:
  container_name: parthenon-poseidon-daemon
  build:
    context: .
    dockerfile: poseidon/docker/poseidon/Dockerfile
  command: dagster-daemon run -w poseidon/dagster/definitions.py
  volumes:
    - ./poseidon:/app/poseidon
    - poseidon_storage:/app/storage
  environment:
    - DAGSTER_HOME=/app/storage
    - DATABASE_URL=postgresql://claude_dev:${HECATE_PG_PASSWORD}@host.docker.internal:5432/parthenon
    - DBT_PROFILES_DIR=/app/poseidon/dbt
    - PARTHENON_API_URL=http://nginx:80/api/v1
    - REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
  env_file:
    - ./backend/.env
  extra_hosts:
    - "host.docker.internal:host-gateway"
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
    poseidon-server:
      condition: service_healthy
  deploy:
    resources:
      limits:
        memory: 2G
  networks:
    - parthenon
  restart: unless-stopped
```

New volume:
```yaml
volumes:
  poseidon_storage:
    driver: local
```

### 3.3 Database Schema for Poseidon State

Dagster uses its own run storage. But Parthenon needs to track orchestration jobs in the `app` schema for UI integration:

```sql
-- New table: app.poseidon_schedules
-- Stores per-source schedule configuration (managed via Parthenon UI)
CREATE TABLE app.poseidon_schedules (
    id            BIGSERIAL PRIMARY KEY,
    source_id     BIGINT NOT NULL REFERENCES app.sources(id),
    schedule_type VARCHAR(20) NOT NULL DEFAULT 'manual',  -- manual, cron, sensor
    cron_expr     VARCHAR(100),                           -- e.g., '0 2 * * *' (2 AM daily)
    sensor_config JSONB,                                  -- sensor-specific params
    is_active     BOOLEAN NOT NULL DEFAULT false,
    dbt_selector  VARCHAR(255),                           -- e.g., 'tag:ehr' or 'source:staging_acumenus'
    last_run_at   TIMESTAMPTZ,
    next_run_at   TIMESTAMPTZ,
    created_by    BIGINT REFERENCES app.users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ                             -- soft delete
);

-- New table: app.poseidon_runs
-- Mirrors Dagster run state for Parthenon UI consumption
CREATE TABLE app.poseidon_runs (
    id              BIGSERIAL PRIMARY KEY,
    dagster_run_id  VARCHAR(64) NOT NULL UNIQUE,          -- Dagster's run UUID
    source_id       BIGINT REFERENCES app.sources(id),
    schedule_id     BIGINT REFERENCES app.poseidon_schedules(id),
    run_type        VARCHAR(20) NOT NULL,                 -- incremental, full_refresh, vocabulary
    status          VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, success, failed, cancelled
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    stats           JSONB,                                -- rows_inserted, rows_updated, models_run, tests_passed
    error_message   TEXT,
    triggered_by    VARCHAR(20) NOT NULL DEFAULT 'manual', -- manual, schedule, sensor
    created_by      BIGINT REFERENCES app.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_poseidon_runs_source ON app.poseidon_runs(source_id);
CREATE INDEX idx_poseidon_runs_status ON app.poseidon_runs(status);
CREATE INDEX idx_poseidon_runs_dagster ON app.poseidon_runs(dagster_run_id);
```

### 3.4 Schema Routing

dbt needs to write to the correct PostgreSQL schema per source. The `generate_schema_name` macro handles this:

```sql
-- poseidon/dbt/macros/generate_schema_name.sql
{% macro generate_schema_name(custom_schema_name, node) %}
    {# Route models to the correct OMOP schema based on dbt vars #}
    {% if custom_schema_name %}
        {{ custom_schema_name }}
    {% elif node.fqn[1] == 'cdm' %}
        {{ var('cdm_schema', 'omop') }}
    {% elif node.fqn[1] == 'staging' %}
        {{ var('staging_schema', 'staging_' ~ var('project_id', '0')) }}
    {% elif node.fqn[1] == 'intermediate' %}
        {{ var('cdm_schema', 'omop') }}_transform
    {% elif node.fqn[1] == 'quality' %}
        {{ var('results_schema', 'results') }}
    {% else %}
        {{ target.schema }}
    {% endif %}
{% endmacro %}
```

Dagster passes `--vars` per run:
```python
dbt_cli.cli(
    ["run", "--select", "tag:ehr"],
    context=build_asset_context(),
    extra_vars={
        "cdm_schema": "omop",
        "vocab_schema": "vocab",
        "staging_schema": "staging_42",
        "results_schema": "results",
        "project_id": "42",
    },
)
```

## 4. Integration with Aqueduct

Poseidon does **not** replace Aqueduct — it extends it. The handoff points:

### 4.1 Current Flow (Unchanged)

```
User Upload → ProfileSourceJob → StageFileJob → staging_{project_id}.table_name
                                                          │
User Review → ConceptMapping (AI + human review)          │
User Review → SchemaMapping (AI + human confirm)          │
                                                          ▼
                                              WriteCdmDataJob → CDM tables
                                                          │
                                              RunValidationJob → validation_results
```

### 4.2 New Flow (With Poseidon)

```
User Upload → ProfileSourceJob → StageFileJob → staging_{project_id}.table_name
                                                          │
User Review → ConceptMapping (AI + human review)          │
User Review → SchemaMapping (AI + human confirm)          │
                                                          │
                    ┌─────────────────────────────────────┘
                    ▼
            EtlSqlGeneratorService outputs SQL
                    │
                    ▼
            Poseidon generates dbt models from confirmed mappings
            (one-time: convert SchemaMapping + ConceptMapping → .sql files)
                    │
                    ▼
            Dagster materializes assets (dbt run)
            ├── staging models (light cleanup, type casting)
            ├── intermediate models (concept joins, domain routing)
            ├── CDM models (incremental insert into omop.*, synpuf.*, etc.)
            └── quality models (DQD-equivalent checks)
                    │
                    ▼
            Post-CDM hooks (Dagster assets)
            ├── Achilles characterization (trigger via API)
            ├── DQD validation (trigger via API)
            └── Solr re-index (trigger via API)
```

### 4.3 The Key Handoff: Mapping → dbt Model Generation

When a user finalizes an Aqueduct ETL project (all schema mappings confirmed, concept mappings reviewed), a new Laravel job generates dbt model files:

```
POST /api/v1/etl-projects/{id}/generate-poseidon
```

This calls `PoseidonModelGeneratorService` which:
1. Reads all `EtlTableMapping` + `EtlFieldMapping` for the project
2. Reads all reviewed `ConceptMapping` records
3. Generates dbt SQL models using the existing `EtlSqlGeneratorService` patterns
4. Writes `.sql` and `.yml` files to `poseidon/dbt/models/` under a source-specific subdirectory
5. Registers a `poseidon_schedule` record for the source

### 4.4 Incremental Refresh Pattern

For recurring feeds, dbt incremental models track watermarks:

```sql
-- poseidon/dbt/models/cdm/condition_occurrence.sql
{{
    config(
        materialized='incremental',
        schema=var('cdm_schema', 'omop'),
        unique_key='condition_occurrence_id',
        incremental_strategy='merge',
        on_schema_change='append_new_columns'
    )
}}

SELECT
    {{ dbt_utils.generate_surrogate_key(['src.source_id', 'src.encounter_id', 'src.diagnosis_code']) }}
        AS condition_occurrence_id,
    p.person_id,
    {{ concept_lookup('src.diagnosis_code', 'ICD10CM') }} AS condition_concept_id,
    src.diagnosis_date::date AS condition_start_date,
    src.diagnosis_date AS condition_start_datetime,
    src.resolved_date::date AS condition_end_date,
    32817 AS condition_type_concept_id,  -- EHR
    v.visit_occurrence_id,
    {{ concept_lookup('src.diagnosis_code', 'ICD10CM', source_only=true) }}
        AS condition_source_concept_id,
    src.diagnosis_code AS condition_source_value
FROM {{ ref('int_condition') }} src
JOIN {{ var('cdm_schema') }}.person p
    ON p.person_source_value = src.patient_id
LEFT JOIN {{ var('cdm_schema') }}.visit_occurrence v
    ON v.visit_source_value = src.encounter_id
    AND v.person_id = p.person_id

{% if is_incremental() %}
WHERE src._loaded_at > (SELECT COALESCE(MAX(_loaded_at), '1900-01-01') FROM {{ this }})
{% endif %}
```

### 4.5 The concept_lookup Macro

```sql
-- poseidon/dbt/macros/concept_lookup.sql
{% macro concept_lookup(source_code_expr, source_vocabulary_id, source_only=false) %}
    (
        SELECT
            {% if source_only %}
                sc.concept_id
            {% else %}
                COALESCE(tc.concept_id, 0)
            {% endif %}
        FROM {{ var('vocab_schema', 'vocab') }}.concept sc
        {% if not source_only %}
        LEFT JOIN {{ var('vocab_schema', 'vocab') }}.concept_relationship cr
            ON cr.concept_id_1 = sc.concept_id
            AND cr.relationship_id = 'Maps to'
            AND cr.invalid_reason IS NULL
        LEFT JOIN {{ var('vocab_schema', 'vocab') }}.concept tc
            ON tc.concept_id = cr.concept_id_2
            AND tc.standard_concept = 'S'
            AND tc.invalid_reason IS NULL
        {% endif %}
        WHERE sc.concept_code = {{ source_code_expr }}
            AND sc.vocabulary_id = '{{ source_vocabulary_id }}'
            AND sc.invalid_reason IS NULL
        LIMIT 1
    )
{% endmacro %}
```

## 5. Dagster Asset Graph

### 5.1 Core Assets

```python
# poseidon/dagster/assets/dbt_assets.py
from dagster import AssetExecutionContext
from dagster_dbt import DbtCliResource, dbt_assets, DbtProject

dbt_project = DbtProject(project_dir="poseidon/dbt")

@dbt_assets(manifest=dbt_project.manifest_path)
def poseidon_dbt_assets(context: AssetExecutionContext, dbt: DbtCliResource):
    """All dbt models exposed as Dagster assets with dependency tracking."""
    yield from dbt.cli(["build"], context=context).stream()
```

### 5.2 Pre/Post Processing Assets

```python
# poseidon/dagster/assets/staging_assets.py
from dagster import asset, AssetIn

@asset(group_name="staging", kinds={"python", "postgres"})
def extract_ehr_delta(context, database: PostgresResource) -> dict:
    """Extract new/modified records from EHR staging tables since last watermark."""
    # Query staging tables for rows where _loaded_at > last checkpoint
    # Return metadata about what was found
    ...

@asset(
    group_name="post_cdm",
    deps=["person", "visit_occurrence", "condition_occurrence"],  # dbt asset deps
    kinds={"python", "api"},
)
def trigger_achilles(context, parthenon_api: ParthenonApiResource) -> None:
    """Trigger Achilles characterization after CDM refresh."""
    parthenon_api.post("/achilles/run", json={"source_id": context.partition_key})

@asset(
    group_name="post_cdm",
    deps=["trigger_achilles"],
    kinds={"python", "api"},
)
def trigger_dqd(context, parthenon_api: ParthenonApiResource) -> None:
    """Trigger DQD validation after Achilles completes."""
    parthenon_api.post("/dqd/run", json={"source_id": context.partition_key})
```

### 5.3 Sensors

```python
# poseidon/dagster/sensors/staging_sensor.py
from dagster import sensor, RunRequest, SensorEvaluationContext

@sensor(job=incremental_refresh_job, minimum_interval_seconds=300)
def staging_table_sensor(context: SensorEvaluationContext, database: PostgresResource):
    """Watch staging schemas for new rows and trigger incremental refresh."""
    # Query app.poseidon_schedules WHERE schedule_type = 'sensor' AND is_active
    # For each, check if staging table has rows newer than last_run_at
    # Yield RunRequest with source-specific config
    schedules = database.query("SELECT * FROM app.poseidon_schedules WHERE schedule_type = 'sensor' AND is_active = true")
    for schedule in schedules:
        new_rows = database.query(f"""
            SELECT COUNT(*) FROM {schedule.staging_schema}.{schedule.staging_table}
            WHERE _loaded_at > '{schedule.last_run_at}'
        """)
        if new_rows > 0:
            yield RunRequest(
                run_key=f"{schedule.source_id}:{context.cursor}",
                run_config={
                    "ops": {
                        "poseidon_dbt_assets": {
                            "config": {
                                "vars": {
                                    "cdm_schema": schedule.cdm_schema,
                                    "staging_schema": schedule.staging_schema,
                                    "vocab_schema": "vocab",
                                }
                            }
                        }
                    }
                },
            )
```

### 5.4 Per-Source Schedules

```python
# poseidon/dagster/schedules/source_schedules.py
from dagster import schedule, ScheduleEvaluationContext, RunRequest

def build_source_schedule(source_id: int, cron: str, dbt_selector: str):
    """Factory: create a Dagster schedule for a specific source."""
    @schedule(
        cron_schedule=cron,
        job=incremental_refresh_job,
        name=f"source_{source_id}_schedule",
    )
    def _schedule(context: ScheduleEvaluationContext):
        return RunRequest(
            run_config={...},
            tags={"source_id": str(source_id), "trigger": "schedule"},
        )
    return _schedule
```

## 6. Parthenon UI Integration

### 6.1 New Frontend Pages

| Page | Route | Purpose |
|------|-------|---------|
| Poseidon Dashboard | `/poseidon` | Overview: active schedules, recent runs, CDM freshness |
| Schedule Config | `/poseidon/schedules/{sourceId}` | Configure cron/sensor per source |
| Run Detail | `/poseidon/runs/{runId}` | Logs, asset materialization timeline, dbt test results |
| Lineage Viewer | `/poseidon/lineage` | Embedded Dagit asset graph (iframe or recreated in React) |

### 6.2 New API Endpoints

```
# Poseidon management (Laravel → Dagster proxy)
GET    /api/v1/poseidon/schedules                    — List all schedules
POST   /api/v1/poseidon/schedules                    — Create schedule for source
PUT    /api/v1/poseidon/schedules/{id}               — Update schedule
DELETE /api/v1/poseidon/schedules/{id}               — Deactivate schedule

GET    /api/v1/poseidon/runs                         — List runs (paginated, filterable)
GET    /api/v1/poseidon/runs/{id}                    — Run detail + logs
POST   /api/v1/poseidon/runs/trigger                 — Manual trigger (source_id, run_type)
POST   /api/v1/poseidon/runs/{id}/cancel             — Cancel running pipeline

GET    /api/v1/poseidon/freshness                    — CDM table freshness per source
GET    /api/v1/poseidon/lineage                      — Asset dependency graph (JSON)

# Aqueduct → Poseidon handoff
POST   /api/v1/etl-projects/{id}/generate-poseidon   — Generate dbt models from mappings
```

All routes require `auth:sanctum` + `permission:ingestion.run` (reuses existing ingestion permissions).

### 6.3 Callback API (Dagster → Laravel)

Dagster calls back to Parthenon to update run status:

```
POST /api/v1/poseidon/webhooks/run-status
{
    "dagster_run_id": "abc-123",
    "status": "success",
    "stats": {"rows_inserted": 1500, "models_run": 12, "tests_passed": 45},
    "completed_at": "2026-03-28T02:15:00Z"
}
```

Authenticated via a shared webhook secret (`POSEIDON_WEBHOOK_SECRET` in `.env`).

## 7. Implementation Phases

### Phase 1: Foundation (Infrastructure + Skeleton dbt Project)

**Goal:** Poseidon containers running, dbt can connect to PostgreSQL and compile models.

1. Create `poseidon/` directory structure
2. Write `pyproject.toml` with dependencies (dagster, dagster-webserver, dagster-dbt, dbt-postgres)
3. Write `Dockerfile` (Python 3.12, non-root user `poseidon`)
4. Write `dbt_project.yml` and `profiles.yml` (connection to host PG17 via `host.docker.internal`)
5. Write `generate_schema_name` macro for schema routing
6. Write `concept_lookup` and `standard_concept` macros
7. Add `poseidon-server` and `poseidon-daemon` to `docker-compose.yml`
8. Create one example dbt model (`models/cdm/person.sql`) to validate end-to-end
9. Verify: `docker compose exec poseidon-server dbt debug` succeeds
10. Verify: Dagit UI accessible at `http://localhost:3100`

### Phase 2: Core dbt Models (Staging + Intermediate + CDM)

**Goal:** Full set of dbt models covering all OMOP CDM v5.4 clinical tables.

1. Write staging models for common source patterns (EHR flat files, FHIR bundles)
2. Write intermediate models with concept mapping joins
3. Write CDM models with incremental materialization
4. Write `_sources.yml` with freshness checks
5. Write `_schema.yml` with column tests (not_null, unique, relationships)
6. Write custom tests (FK integrity, date validity, standard concept checks)
7. Write quality models (DQD-equivalent checks as dbt models)
8. Add seed files (domain routing, unit harmonization)
9. Verify: `dbt build` succeeds against a staging schema with test data

### Phase 3: Dagster Orchestration

**Goal:** Dagster manages dbt runs with schedules, sensors, and post-processing hooks.

1. Write `definitions.py` with resource configuration
2. Write `dbt_assets.py` — auto-load dbt models as Dagster assets
3. Write `staging_assets.py` — pre-dbt Python processing
4. Write `achilles_assets.py` — post-CDM Achilles/DQD triggers
5. Write `staging_sensor.py` — watch for new staging data
6. Write `source_schedules.py` — per-source cron factory
7. Write `incremental_refresh.py` and `full_refresh.py` jobs
8. Write `postgres_io.py` — schema-aware IO manager
9. Verify: manual run from Dagit materializes all assets in correct order

### Phase 4: Aqueduct Integration (Mapping → dbt Model Generation)

**Goal:** Confirmed Aqueduct mappings automatically generate dbt models.

1. Create `PoseidonModelGeneratorService` in Laravel
2. Add `/etl-projects/{id}/generate-poseidon` endpoint
3. Generate staging models from `SourceProfile` + `FieldProfile`
4. Generate intermediate models from `SchemaMapping` + `ConceptMapping`
5. Generate CDM models from `EtlTableMapping` + `EtlFieldMapping`
6. Generate `_schema.yml` tests from mapping metadata
7. Write generated files to `poseidon/dbt/models/{source_name}/`
8. Register `poseidon_schedule` for the source
9. Verify: end-to-end flow from Aqueduct upload → generated dbt → Dagster run → CDM populated

### Phase 5: Laravel API + Frontend

**Goal:** Poseidon management UI in Parthenon.

1. Create Laravel migration for `poseidon_schedules` and `poseidon_runs`
2. Create Eloquent models with fillable/casts
3. Create `PoseidonController` with schedule/run/trigger endpoints
4. Create `PoseidonService` for Dagster GraphQL API communication
5. Create webhook endpoint for run status callbacks
6. Frontend: Poseidon dashboard page (schedule list, recent runs, freshness indicators)
7. Frontend: Schedule configuration form (cron builder, sensor toggle)
8. Frontend: Run detail page (logs, asset timeline, test results)
9. Add Poseidon nav item to sidebar
10. Verify: user can create schedule, trigger manual run, see results in UI

### Phase 6: Production Hardening

**Goal:** Reliable, observable, secure operation.

1. Dagster run retries with exponential backoff
2. Alerting on failed runs (email via Resend, Parthenon notification)
3. Run history cleanup (retain 90 days)
4. Resource limits tuning (memory, CPU, concurrent runs)
5. Dagster run storage → PostgreSQL (not default SQLite)
6. HIGHSEC compliance: non-root container, no `$guarded = []`, auth on all routes
7. Nginx proxy route for Dagit UI (`/poseidon/dagit/` → `poseidon-server:3100`)
8. Documentation: update CLAUDE.md, write Poseidon module devlog

## 8. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| dbt adapter | `dbt-postgres` | Direct PG connection, no warehouse overhead |
| Dagster run storage | PostgreSQL (parthenon DB, `poseidon` schema) | Single DB philosophy, no SQLite in Docker |
| dbt model generation | Laravel service, not Python | Leverages existing `EtlSqlGeneratorService` patterns and Eloquent models |
| Incremental strategy | `merge` (upsert) | Handles both inserts and updates idempotently |
| Surrogate keys | `dbt_utils.generate_surrogate_key()` | Deterministic, reproducible across full refreshes |
| Vocabulary access | dbt `var('vocab_schema')` in macros | Same shared `vocab` schema pattern as all other services |
| Post-CDM hooks | Dagster assets calling Laravel API | Achilles/DQD already have Laravel endpoints; no need to reimplement in Python |
| Schedule persistence | `app.poseidon_schedules` table | Parthenon UI manages schedules; Dagster reads them dynamically |
| Container count | 2 (webserver + daemon) | Dagster best practice — daemon handles schedules/sensors separately from UI |

## 9. Dependencies

```toml
# poseidon/pyproject.toml
[project]
name = "poseidon"
version = "0.1.0"
requires-python = ">=3.12"

dependencies = [
    "dagster>=1.9,<2.0",
    "dagster-webserver>=1.9,<2.0",
    "dagster-dbt>=0.25,<1.0",
    "dagster-postgres>=0.25,<1.0",      # Run storage in PG
    "dbt-postgres>=1.9,<2.0",
    "sqlalchemy>=2.0,<3.0",
    "psycopg2-binary>=2.9,<3.0",
    "httpx>=0.27,<1.0",                 # Async HTTP for API callbacks
    "redis>=5.0,<6.0",                  # Status broadcasting
    "pydantic>=2.0,<3.0",
    "pydantic-settings>=2.0,<3.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "dagster-dev",
]
```

## 10. Environment Variables

Add to `backend/.env.example`:

```env
# Poseidon (dbt + Dagster)
POSEIDON_PORT=3100
POSEIDON_WEBHOOK_SECRET=  # Shared secret for Dagster → Laravel callbacks
DAGSTER_HOME=/app/storage
DBT_PROFILES_DIR=/app/poseidon/dbt
```

## 11. Security Considerations

Per HIGHSEC spec:

1. **Non-root Docker user** — Dockerfile creates `poseidon` user
2. **Auth on all routes** — `/api/v1/poseidon/*` requires `auth:sanctum` + `permission:ingestion.run`
3. **Webhook authentication** — `POSEIDON_WEBHOOK_SECRET` validated on callback endpoint
4. **Read-only CDM access** — dbt models write to CDM schemas but never modify `vocab` (read-only reference)
5. **No `$guarded = []`** — all new Eloquent models use `$fillable`
6. **Dagit UI behind Nginx auth** — proxied through Parthenon auth, not publicly exposed
7. **Database credentials** — via `DATABASE_URL` env var, never hardcoded
