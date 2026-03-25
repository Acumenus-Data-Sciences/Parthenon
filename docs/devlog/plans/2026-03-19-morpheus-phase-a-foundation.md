# Morpheus Phase A: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the database schemas, build the morpheus-ingest Python service with MIMIC-IV adapter, OMOP mapper, and quality gate — proving the full staging → CDM pipeline end-to-end with the 100-patient demo dataset.

**Architecture:** A new Python FastAPI service (`morpheus-ingest`, port 8004) reads from canonical staging tables in `inpatient_staging.*`, maps to OMOP CDM 5.4 in `inpatient.*` using shared vocabulary in `omop.*`, and writes to Morpheus extension tables in `inpatient_ext.*`. The MIMIC-IV adapter is the first source adapter, proving the pipeline without de-identification (MIMIC is pre-de-identified).

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, psycopg2, PostgreSQL 16 (Docker), Laravel 11 (database connection only)

**Spec:** `docs/superpowers/specs/2026-03-19-morpheus-v2-architecture-design.md`

**Prerequisite:** MIMIC-IV demo data loaded in Docker `parthenon.mimiciv.*` (31 tables, 100 patients) — already done. Vocabulary (7.2M concepts) currently in `inpatient.*` — Task 0 migrates it to `omop.*`.

**DATA PROTECTION:** Task 0 moves vocabulary data. The `inpatient.*` vocab tables are the ONLY copy in Docker. The migration MUST verify `omop.concept` has rows BEFORE dropping `inpatient.concept`. Follow the project's data protection rules (backup before destructive operations).

---

## File Structure

```
# New service (sibling to ai/)
morpheus-ingest/
├── Dockerfile
├── requirements.txt
├── alembic.ini
├── alembic/
│   ├── env.py
│   └── versions/                    — Schema migrations
├── app/
│   ├── __init__.py
│   ├── main.py                      — FastAPI app + router registration
│   ├── config.py                    — Pydantic BaseSettings
│   ├── db.py                        — SQLAlchemy engine + session
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── ingest.py                — /ingest/* endpoints
│   │   ├── quality.py               — /quality/* endpoints
│   │   └── health.py                — /health endpoint
│   ├── adapters/
│   │   ├── __init__.py
│   │   ├── base.py                  — SourceAdapter ABC
│   │   └── mimic_adapter.py         — MIMIC-IV CSVs → staging
│   ├── staging/
│   │   ├── __init__.py
│   │   ├── models.py                — SQLAlchemy models for stg_* tables
│   │   └── writer.py                — Bulk COPY writer
│   ├── mapper/
│   │   ├── __init__.py
│   │   ├── omop_mapper.py           — Pipeline orchestrator
│   │   ├── person_mapper.py
│   │   ├── visit_mapper.py
│   │   ├── condition_mapper.py
│   │   ├── drug_mapper.py
│   │   ├── measurement_mapper.py
│   │   ├── procedure_mapper.py
│   │   ├── observation_mapper.py
│   │   ├── note_mapper.py
│   │   ├── specimen_mapper.py
│   │   ├── death_mapper.py
│   │   ├── domain_router.py
│   │   └── era_builder.py
│   ├── vocabulary/
│   │   ├── __init__.py
│   │   ├── concept_lookup.py        — Query omop.concept
│   │   └── relationship_walker.py   — Source → standard mapping
│   ├── quality/
│   │   ├── __init__.py
│   │   ├── dqd_runner.py
│   │   ├── coverage_checker.py
│   │   ├── integrity_checker.py
│   │   └── gate.py                  — Pass/fail decision
│   └── orchestrator/
│       ├── __init__.py
│       ├── batch_runner.py
│       └── state.py                 — Batch state machine
└── tests/
    ├── __init__.py
    ├── conftest.py                  — Fixtures (DB session, test data)
    ├── test_mimic_adapter.py
    ├── test_staging_writer.py
    ├── test_person_mapper.py
    ├── test_visit_mapper.py
    ├── test_condition_mapper.py
    ├── test_measurement_mapper.py
    ├── test_domain_router.py
    ├── test_era_builder.py
    ├── test_concept_lookup.py
    ├── test_quality_gate.py
    └── test_batch_runner.py

# Existing files to modify
backend/config/database.php          — Add 'inpatient' connection
docker-compose.yml                   — Add morpheus-ingest service

# SQL files (executed via Alembic or direct)
morpheus-ingest/alembic/versions/
├── 000_migrate_vocab_to_omop.py
├── 001_create_inpatient_staging.py
└── 002_create_inpatient_ext.py
```

---

### Task 0: Migrate Vocabulary to `omop.*` Schema

**Files:**
- Create: `morpheus-ingest/scripts/migrate_vocab_to_omop.sql`

This is a prerequisite — vocabulary (7.2M concepts, 139M total rows) currently lives in `inpatient.*` in Docker. It must move to `omop.*` before we clean `inpatient.*` for CDM clinical data only.

- [ ] **Step 1: Verify current state**

Run: `docker compose exec -T postgres psql -U parthenon -d parthenon -c "SELECT count(*) FROM inpatient.concept;"`

Expected: 7194924

- [ ] **Step 2: Create and run migration script**

Create `morpheus-ingest/scripts/migrate_vocab_to_omop.sql`:
```sql
-- Migrate vocabulary from inpatient.* to omop.* schema
-- DATA PROTECTION: Verifies target has data before dropping source

BEGIN;

-- Create omop schema if not exists
CREATE SCHEMA IF NOT EXISTS omop;

-- Move each vocabulary table (ALTER TABLE SET SCHEMA is atomic and instant)
ALTER TABLE inpatient.concept SET SCHEMA omop;
ALTER TABLE inpatient.concept_ancestor SET SCHEMA omop;
ALTER TABLE inpatient.concept_class SET SCHEMA omop;
ALTER TABLE inpatient.concept_relationship SET SCHEMA omop;
ALTER TABLE inpatient.concept_synonym SET SCHEMA omop;
ALTER TABLE inpatient.domain SET SCHEMA omop;
ALTER TABLE inpatient.drug_strength SET SCHEMA omop;
ALTER TABLE inpatient.relationship SET SCHEMA omop;
ALTER TABLE inpatient.source_to_concept_map SET SCHEMA omop;
ALTER TABLE inpatient.vocabulary SET SCHEMA omop;

COMMIT;
```

Run:
```bash
docker compose exec -T postgres psql -U parthenon -d parthenon -f /dev/stdin < morpheus-ingest/scripts/migrate_vocab_to_omop.sql
```

- [ ] **Step 3: Verify migration succeeded**

Run:
```bash
docker compose exec -T postgres psql -U parthenon -d parthenon -c "
SELECT 'omop.concept' as tbl, count(*) FROM omop.concept
UNION ALL SELECT 'inpatient.concept exists', count(*) FROM pg_tables WHERE schemaname='inpatient' AND tablename='concept';"
```

Expected: omop.concept = 7194924, inpatient.concept exists = 0

- [ ] **Step 4: Commit**

```bash
git add morpheus-ingest/scripts/migrate_vocab_to_omop.sql
git commit -m "feat(morpheus): migrate vocabulary tables from inpatient to omop schema"
```

---

### Task 1: Service Skeleton

**Files:**
- Create: `morpheus-ingest/requirements.txt`
- Create: `morpheus-ingest/Dockerfile`
- Create: `morpheus-ingest/app/__init__.py`
- Create: `morpheus-ingest/app/main.py`
- Create: `morpheus-ingest/app/config.py`
- Create: `morpheus-ingest/app/db.py`
- Create: `morpheus-ingest/app/routers/__init__.py`
- Create: `morpheus-ingest/app/routers/health.py`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create requirements.txt**

```
fastapi>=0.135.0,<1.0.0
uvicorn>=0.41.0,<1.0.0
pydantic>=2.0.0,<3.0.0
pydantic-settings>=2.0.0,<3.0.0
sqlalchemy>=2.0.0,<3.0.0
psycopg2-binary>=2.9.0,<3.0.0
alembic>=1.15.0,<2.0.0
httpx>=0.27.0,<1.0.0
pytest>=8.0.0,<9.0.0
pytest-asyncio>=0.24.0,<1.0.0
```

- [ ] **Step 2: Create config.py**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="MORPHEUS_")

    database_url: str = "postgresql://parthenon:parthenon@postgres:5432/parthenon"
    # Schema names
    staging_schema: str = "inpatient_staging"
    cdm_schema: str = "inpatient"
    ext_schema: str = "inpatient_ext"
    vocab_schema: str = "omop"
    mimic_schema: str = "mimiciv"
    # Quality gate thresholds
    min_mapping_coverage: float = 0.70
    max_error_rate: float = 0.20
    # Batch settings
    batch_size: int = 1000


settings = Settings()
```

- [ ] **Step 3: Create db.py**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

engine = create_engine(settings.database_url, pool_size=5, max_overflow=10)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 4: Create health router**

```python
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check():
    return {"status": "ok", "service": "morpheus-ingest"}
```

- [ ] **Step 5: Create main.py**

```python
from fastapi import FastAPI

from app.routers import health

app = FastAPI(
    title="Morpheus Ingest",
    description="EHR data ingestion and OMOP CDM mapping for Parthenon",
    version="0.1.0",
)

app.include_router(health.router)
```

- [ ] **Step 6: Create Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

- [ ] **Step 7: Add morpheus-ingest to docker-compose.yml**

Add after the `python-ai` service definition in `docker-compose.yml`:

```yaml
  morpheus-ingest:
    container_name: parthenon-morpheus-ingest
    build:
      context: ./morpheus-ingest
      dockerfile: Dockerfile
    ports:
      - "8004:8000"
    volumes:
      - ./morpheus-ingest:/app
      - ./inpatient/data:/data:ro
    environment:
      - MORPHEUS_DATABASE_URL=postgresql://parthenon:parthenon@postgres:5432/parthenon
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped
```

- [ ] **Step 8: Build and verify service starts**

Run: `docker compose build morpheus-ingest && docker compose up -d morpheus-ingest`

Then: `curl http://localhost:8004/health`

Expected: `{"status":"ok","service":"morpheus-ingest"}`

- [ ] **Step 9: Commit**

```bash
git add morpheus-ingest/ docker-compose.yml
git commit -m "feat(morpheus): scaffold morpheus-ingest FastAPI service"
```

---

### Task 2: Schema DDL — `inpatient_staging`

**Files:**
- Create: `morpheus-ingest/alembic.ini`
- Create: `morpheus-ingest/alembic/env.py`
- Create: `morpheus-ingest/alembic/versions/001_create_inpatient_staging.py`

- [ ] **Step 1: Create alembic.ini**

```ini
[alembic]
script_location = alembic
sqlalchemy.url = postgresql://parthenon:parthenon@localhost:5480/parthenon

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

- [ ] **Step 2: Create alembic/env.py**

```python
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def run_migrations_online() -> None:
    # Support URL override via alembic -x sqlalchemy.url=...
    url = context.get_x_argument(as_dictionary=True).get(
        "sqlalchemy.url",
        config.get_main_option("sqlalchemy.url"),
    )
    connectable = create_engine(url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=None)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
```

- [ ] **Step 3: Create staging schema migration**

Create `morpheus-ingest/alembic/versions/001_create_inpatient_staging.py`:

```python
"""Create inpatient_staging schema and tables."""

revision = "001"
down_revision = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS inpatient_staging")

    # Metadata columns included in every staging table:
    # source_system_id, load_batch_id, source_table, source_row_id, dq_flags

    # NOTE: load_batch and concept_gap live in inpatient_ext (persist after staging purge)
    # Staging tables reference inpatient_ext.load_batch(batch_id) via load_batch_id column

    op.execute("""
        CREATE TABLE inpatient_staging.stg_patient (
            staging_id          BIGSERIAL PRIMARY KEY,
            person_source_value TEXT NOT NULL,
            birth_year          INTEGER,
            gender_source_value TEXT,
            race_source_value   TEXT,
            ethnicity_source_value TEXT,
            death_date          DATE,
            death_datetime      TIMESTAMP,
            source_system_id    INTEGER,
            load_batch_id       INTEGER NOT NULL,
            source_table        TEXT,
            source_row_id       TEXT,
            dq_flags            JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_encounter (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT NOT NULL,
            encounter_type          TEXT,
            admit_datetime          TIMESTAMP,
            discharge_datetime      TIMESTAMP,
            admit_source            TEXT,
            discharge_disposition   TEXT,
            care_site_source_value  TEXT,
            preceding_encounter_source_value TEXT,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_condition (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            condition_source_code   TEXT NOT NULL,
            condition_source_vocab  TEXT,
            condition_start_date    DATE,
            condition_start_datetime TIMESTAMP,
            condition_end_date      DATE,
            condition_type          TEXT,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_procedure (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            procedure_source_code   TEXT NOT NULL,
            procedure_source_vocab  TEXT,
            procedure_date          DATE,
            procedure_datetime      TIMESTAMP,
            procedure_type          TEXT,
            quantity                INTEGER,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_drug (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            drug_source_code        TEXT NOT NULL,
            drug_source_vocab       TEXT,
            drug_name               TEXT,
            start_datetime          TIMESTAMP,
            end_datetime            TIMESTAMP,
            route_source_value      TEXT,
            dose_value              TEXT,
            dose_unit               TEXT,
            quantity                NUMERIC,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_measurement (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            measurement_datetime    TIMESTAMP,
            source_code             TEXT NOT NULL,
            source_vocabulary       TEXT,
            value_as_number         NUMERIC,
            value_as_text           TEXT,
            unit_source_value       TEXT,
            range_low               NUMERIC,
            range_high              NUMERIC,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_note (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            note_datetime           TIMESTAMP,
            note_type               TEXT,
            note_text               TEXT,
            note_class              TEXT,
            encoding_concept_id     INTEGER,
            language_concept_id     INTEGER,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_device (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            device_source_code      TEXT NOT NULL,
            device_source_vocab     TEXT,
            start_datetime          TIMESTAMP,
            end_datetime            TIMESTAMP,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_specimen (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            specimen_source_code    TEXT NOT NULL,
            specimen_source_vocab   TEXT,
            specimen_datetime       TIMESTAMP,
            quantity                NUMERIC,
            unit_source_value       TEXT,
            anatomic_site_source    TEXT,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_microbiology (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            specimen_datetime       TIMESTAMP,
            specimen_source_code    TEXT,
            specimen_source_desc    TEXT,
            test_source_code        TEXT,
            test_name               TEXT,
            organism_source_code    TEXT,
            organism_name           TEXT,
            antibiotic_source_code  TEXT,
            antibiotic_name         TEXT,
            susceptibility          TEXT,
            dilution_value          NUMERIC,
            dilution_comparison     TEXT,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_surgical_case (
            staging_id                  BIGSERIAL PRIMARY KEY,
            person_source_value         TEXT NOT NULL,
            encounter_source_value      TEXT,
            surgery_date                DATE,
            scheduled_start_datetime    TIMESTAMP,
            scheduled_duration_minutes  INTEGER,
            primary_procedure_code      TEXT,
            primary_procedure_vocab     TEXT,
            service_source_value        TEXT,
            asa_rating                  TEXT,
            case_type                   TEXT,
            case_class                  TEXT,
            patient_class               TEXT,
            status                      TEXT,
            cancellation_reason         TEXT,
            source_system_id            INTEGER,
            load_batch_id               INTEGER NOT NULL,
            source_table                TEXT,
            source_row_id               TEXT,
            dq_flags                    JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_case_timeline (
            staging_id              BIGSERIAL PRIMARY KEY,
            case_source_value       TEXT NOT NULL,
            periop_arrival_dt       TIMESTAMP,
            preop_in_dt             TIMESTAMP,
            preop_out_dt            TIMESTAMP,
            or_in_dt                TIMESTAMP,
            anesthesia_start_dt     TIMESTAMP,
            procedure_start_dt      TIMESTAMP,
            procedure_close_dt      TIMESTAMP,
            procedure_end_dt        TIMESTAMP,
            or_out_dt               TIMESTAMP,
            anesthesia_end_dt       TIMESTAMP,
            pacu_in_dt              TIMESTAMP,
            pacu_out_dt             TIMESTAMP,
            destination             TEXT,
            primary_procedure_code  TEXT,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_transport (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            transport_type          TEXT,
            location_from           TEXT,
            location_to             TEXT,
            status                  TEXT,
            planned_time            TIMESTAMP,
            actual_start            TIMESTAMP,
            actual_end              TIMESTAMP,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_safety_event (
            staging_id              BIGSERIAL PRIMARY KEY,
            person_source_value     TEXT NOT NULL,
            encounter_source_value  TEXT,
            event_type              TEXT,
            severity                TEXT,
            description             TEXT,
            event_datetime          TIMESTAMP,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_staging.stg_bed_census (
            staging_id              BIGSERIAL PRIMARY KEY,
            census_datetime         TIMESTAMP NOT NULL,
            location_source_value   TEXT NOT NULL,
            total_beds              INTEGER,
            occupied_beds           INTEGER,
            available_beds          INTEGER,
            pending_admits          INTEGER,
            pending_discharges      INTEGER,
            boarding_count          INTEGER,
            source_system_id        INTEGER,
            load_batch_id           INTEGER NOT NULL,
            source_table            TEXT,
            source_row_id           TEXT,
            dq_flags                JSONB DEFAULT '{}'
        )
    """)

    # Indexes on frequently joined columns
    op.execute("CREATE INDEX idx_stg_patient_psv ON inpatient_staging.stg_patient (person_source_value)")
    op.execute("CREATE INDEX idx_stg_encounter_psv ON inpatient_staging.stg_encounter (person_source_value)")
    op.execute("CREATE INDEX idx_stg_encounter_esv ON inpatient_staging.stg_encounter (encounter_source_value)")
    op.execute("CREATE INDEX idx_stg_measurement_psv ON inpatient_staging.stg_measurement (person_source_value)")
    op.execute("CREATE INDEX idx_stg_condition_psv ON inpatient_staging.stg_condition (person_source_value)")
    op.execute("CREATE INDEX idx_stg_drug_psv ON inpatient_staging.stg_drug (person_source_value)")
    op.execute("CREATE INDEX idx_stg_batch ON inpatient_staging.load_batch (status)")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS inpatient_staging CASCADE")
```

- [ ] **Step 4: Run migration against Docker postgres**

Run: `cd morpheus-ingest && alembic -x sqlalchemy.url=postgresql://parthenon:parthenon@localhost:5480/parthenon upgrade head`

- [ ] **Step 5: Verify staging tables exist**

Run: `docker compose exec -T postgres psql -U parthenon -d parthenon -c "SELECT tablename FROM pg_tables WHERE schemaname = 'inpatient_staging' ORDER BY tablename;"`

Expected: 15 tables (stg_patient, stg_encounter, stg_condition, stg_procedure, stg_drug, stg_measurement, stg_note, stg_device, stg_specimen, stg_microbiology, stg_surgical_case, stg_case_timeline, stg_transport, stg_safety_event, stg_bed_census). Note: load_batch and concept_gap live in inpatient_ext.

- [ ] **Step 6: Commit**

```bash
git add morpheus-ingest/alembic.ini morpheus-ingest/alembic/
git commit -m "feat(morpheus): create inpatient_staging schema with 17 canonical tables"
```

---

### Task 3: Schema DDL — `inpatient_ext`

**Files:**
- Create: `morpheus-ingest/alembic/versions/002_create_inpatient_ext.py`

- [ ] **Step 1: Create extension schema migration**

Create `morpheus-ingest/alembic/versions/002_create_inpatient_ext.py`:

```python
"""Create inpatient_ext schema and Morpheus extension tables."""

revision = "002"
down_revision = "001"

from alembic import op


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS inpatient_ext")

    # --- Data Provenance ---
    op.execute("""
        CREATE TABLE inpatient_ext.data_source (
            source_id       BIGSERIAL PRIMARY KEY,
            source_name     TEXT NOT NULL,
            vendor          TEXT CHECK (vendor IN ('Epic','Cerner','Meditech','FHIR','MIMIC','HL7v2','CSV')),
            connection_type TEXT,
            last_extract_dt TIMESTAMP,
            total_patients  INTEGER DEFAULT 0,
            dqd_score       NUMERIC(5,2),
            created_at      TIMESTAMP DEFAULT NOW()
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.concept_gap (
            gap_id              BIGSERIAL PRIMARY KEY,
            source_code         TEXT NOT NULL,
            source_vocabulary   TEXT NOT NULL,
            frequency           INTEGER DEFAULT 1,
            suggested_concept_id INTEGER,
            confidence_score    NUMERIC(5,4),
            reviewed_by         TEXT,
            accepted            BOOLEAN,
            created_at          TIMESTAMP DEFAULT NOW(),
            UNIQUE (source_code, source_vocabulary)
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.load_batch (
            batch_id            BIGSERIAL PRIMARY KEY,
            source_id           BIGINT REFERENCES inpatient_ext.data_source(source_id),
            start_dt            TIMESTAMP NOT NULL DEFAULT NOW(),
            end_dt              TIMESTAMP,
            status              TEXT NOT NULL DEFAULT 'pending',
            rows_staged         INTEGER DEFAULT 0,
            rows_mapped         INTEGER DEFAULT 0,
            rows_rejected       INTEGER DEFAULT 0,
            mapping_coverage_pct NUMERIC(5,2),
            dqd_pass            BOOLEAN,
            stats               JSONB DEFAULT '{}'
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.dq_result (
            result_id       BIGSERIAL PRIMARY KEY,
            batch_id        INTEGER REFERENCES inpatient_ext.load_batch(batch_id),
            check_name      TEXT NOT NULL,
            check_level     TEXT,
            threshold       NUMERIC,
            result_value    NUMERIC,
            passed          BOOLEAN NOT NULL
        )
    """)

    # --- Perioperative ---
    op.execute("""
        CREATE TABLE inpatient_ext.surgical_case (
            case_id                     BIGSERIAL PRIMARY KEY,
            person_id                   INTEGER NOT NULL,
            visit_occurrence_id         INTEGER,
            surgery_date                DATE,
            room_source_value           TEXT,
            primary_surgeon_provider_id INTEGER,
            service_concept_id          INTEGER,
            asa_rating                  TEXT,
            case_type_concept_id        INTEGER,
            case_class_concept_id       INTEGER,
            patient_class_concept_id    INTEGER,
            scheduled_start_datetime    TIMESTAMP,
            scheduled_duration_minutes  INTEGER,
            status_concept_id           INTEGER,
            cancellation_reason_concept_id INTEGER,
            source_system_id            INTEGER,
            load_batch_id               INTEGER
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.case_timeline (
            timeline_id             BIGSERIAL PRIMARY KEY,
            case_id                 INTEGER REFERENCES inpatient_ext.surgical_case(case_id),
            periop_arrival_dt       TIMESTAMP,
            preop_in_dt             TIMESTAMP,
            preop_out_dt            TIMESTAMP,
            or_in_dt                TIMESTAMP,
            anesthesia_start_dt     TIMESTAMP,
            procedure_start_dt      TIMESTAMP,
            procedure_close_dt      TIMESTAMP,
            procedure_end_dt        TIMESTAMP,
            or_out_dt               TIMESTAMP,
            anesthesia_end_dt       TIMESTAMP,
            pacu_in_dt              TIMESTAMP,
            pacu_out_dt             TIMESTAMP,
            destination             TEXT,
            primary_procedure_concept_id INTEGER
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.case_metrics (
            case_id                 INTEGER PRIMARY KEY REFERENCES inpatient_ext.surgical_case(case_id),
            turnover_minutes        NUMERIC,
            utilization_pct         NUMERIC(5,2),
            in_block_minutes        NUMERIC,
            out_of_block_minutes    NUMERIC,
            prime_time_minutes      NUMERIC,
            non_prime_time_minutes  NUMERIC,
            late_start_minutes      NUMERIC,
            early_finish_minutes    NUMERIC
        )
    """)

    # --- ICU ---
    op.execute("""
        CREATE TABLE inpatient_ext.icu_stay (
            icu_stay_id             BIGSERIAL PRIMARY KEY,
            visit_detail_id         INTEGER NOT NULL,
            person_id               INTEGER NOT NULL,
            visit_occurrence_id     INTEGER,
            hospital_admit_dt       TIMESTAMP,
            hospital_discharge_dt   TIMESTAMP,
            icu_admit_dt            TIMESTAMP,
            icu_discharge_dt        TIMESTAMP,
            icu_los_hours           NUMERIC,
            hospital_los_days       NUMERIC,
            care_site_name          TEXT,
            died_in_hospital        BOOLEAN DEFAULT FALSE,
            died_in_icu             BOOLEAN DEFAULT FALSE,
            readmission_48h         BOOLEAN DEFAULT FALSE,
            severity_score          NUMERIC,
            severity_system_concept_id INTEGER
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.bundle_card (
            bundle_card_id          BIGSERIAL PRIMARY KEY,
            component               CHAR(1) NOT NULL CHECK (component IN ('A','B','C','D','E','F')),
            component_name          TEXT NOT NULL,
            assessment_concept_id   INTEGER,
            target_frequency_hours  NUMERIC,
            adherence_threshold     NUMERIC,
            sccm_guideline_version  TEXT
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.bundle_assessment (
            assessment_id           BIGSERIAL PRIMARY KEY,
            person_id               INTEGER NOT NULL,
            visit_detail_id         INTEGER,
            assessment_datetime     TIMESTAMP NOT NULL,
            bundle_component        CHAR(1) NOT NULL,
            assessment_concept_id   INTEGER,
            value_as_number         NUMERIC,
            value_as_concept_id     INTEGER,
            adherent_flag           BOOLEAN
        )
    """)

    # --- Patient Flow ---
    op.execute("""
        CREATE TABLE inpatient_ext.transport (
            transport_id            BIGSERIAL PRIMARY KEY,
            person_id               INTEGER NOT NULL,
            visit_occurrence_id     INTEGER,
            transport_type          TEXT,
            location_from           TEXT,
            location_to             TEXT,
            status                  TEXT,
            planned_time            TIMESTAMP,
            actual_start            TIMESTAMP,
            actual_end              TIMESTAMP,
            assigned_provider_id    INTEGER
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.bed_census (
            census_id               BIGSERIAL PRIMARY KEY,
            census_datetime         TIMESTAMP NOT NULL,
            location_id             INTEGER,
            location_name           TEXT,
            total_beds              INTEGER,
            occupied_beds           INTEGER,
            available_beds          INTEGER,
            pending_admits          INTEGER,
            pending_discharges      INTEGER,
            boarding_count          INTEGER
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.care_milestone (
            milestone_id            BIGSERIAL PRIMARY KEY,
            person_id               INTEGER NOT NULL,
            visit_occurrence_id     INTEGER,
            milestone_type          TEXT NOT NULL,
            status                  TEXT NOT NULL DEFAULT 'Pending',
            required                BOOLEAN DEFAULT TRUE,
            completed_at            TIMESTAMP,
            completed_by_provider_id INTEGER
        )
    """)

    # --- Safety & Quality ---
    op.execute("""
        CREATE TABLE inpatient_ext.safety_event (
            event_id                BIGSERIAL PRIMARY KEY,
            person_id               INTEGER NOT NULL,
            visit_occurrence_id     INTEGER,
            event_type              TEXT NOT NULL,
            severity                TEXT CHECK (severity IN ('Low','Medium','High','Critical')),
            description             TEXT,
            event_datetime          TIMESTAMP,
            reporting_provider_id   INTEGER,
            acknowledged_by_provider_id INTEGER,
            acknowledged_at         TIMESTAMP,
            resolved_at             TIMESTAMP
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.quality_measure (
            measure_id              BIGSERIAL PRIMARY KEY,
            measure_name            TEXT NOT NULL,
            measure_set             TEXT,
            numerator_count         INTEGER,
            denominator_count       INTEGER,
            rate                    NUMERIC(7,4),
            period_start            DATE,
            period_end              DATE
        )
    """)

    # --- Microbiology ---
    op.execute("""
        CREATE TABLE inpatient_ext.antibiogram (
            antibiogram_id          BIGSERIAL PRIMARY KEY,
            person_id               INTEGER NOT NULL,
            visit_occurrence_id     INTEGER,
            organism_concept_id     INTEGER,
            antibiotic_concept_id   INTEGER,
            susceptibility          TEXT CHECK (susceptibility IN ('S','I','R')),
            mic_value               NUMERIC,
            test_method             TEXT,
            specimen_concept_id     INTEGER,
            result_datetime         TIMESTAMP
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.infection_episode (
            episode_id              BIGSERIAL PRIMARY KEY,
            person_id               INTEGER NOT NULL,
            visit_occurrence_id     INTEGER,
            infection_concept_id    INTEGER,
            onset_datetime          TIMESTAMP,
            resolution_datetime     TIMESTAMP,
            hai_flag                BOOLEAN DEFAULT FALSE,
            source_concept_id       INTEGER
        )
    """)

    # --- NLP ---
    op.execute("""
        CREATE TABLE inpatient_ext.note_section (
            section_id              BIGSERIAL PRIMARY KEY,
            note_id                 INTEGER NOT NULL,
            section_concept_id      INTEGER,
            section_text            TEXT,
            section_order           INTEGER
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.note_assertion (
            assertion_id            BIGSERIAL PRIMARY KEY,
            note_id                 INTEGER NOT NULL,
            concept_id              INTEGER,
            assertion_type          TEXT CHECK (assertion_type IN ('present','absent','conditional','historical')),
            confidence_score        NUMERIC(5,4),
            extraction_model_version TEXT
        )
    """)

    # --- Process Mining ---
    op.execute("""
        CREATE TABLE inpatient_ext.process_event (
            event_id                BIGSERIAL PRIMARY KEY,
            event_type              TEXT NOT NULL,
            event_timestamp         TIMESTAMP NOT NULL,
            object_type             TEXT,
            object_id               TEXT,
            activity                TEXT,
            resource                TEXT,
            lifecycle_state         TEXT
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.process_model (
            model_id                BIGSERIAL PRIMARY KEY,
            model_type              TEXT,
            model_data              JSONB,
            cohort_id               INTEGER,
            created_at              TIMESTAMP DEFAULT NOW()
        )
    """)

    # --- Predictions ---
    op.execute("""
        CREATE TABLE inpatient_ext.prediction_model (
            model_id                BIGSERIAL PRIMARY KEY,
            model_name              TEXT NOT NULL,
            model_type              TEXT,
            version                 TEXT,
            target_outcome          TEXT,
            training_cohort_id      INTEGER,
            auc                     NUMERIC(5,4),
            auprc                   NUMERIC(5,4),
            feature_set             JSONB,
            onnx_artifact_path      TEXT,
            created_at              TIMESTAMP DEFAULT NOW()
        )
    """)

    op.execute("""
        CREATE TABLE inpatient_ext.prediction_score (
            score_id                BIGSERIAL PRIMARY KEY,
            person_id               INTEGER NOT NULL,
            visit_detail_id         INTEGER,
            model_id                INTEGER REFERENCES inpatient_ext.prediction_model(model_id),
            score_datetime          TIMESTAMP NOT NULL,
            predicted_probability   NUMERIC(7,6),
            risk_tier               TEXT CHECK (risk_tier IN ('Low','Medium','High','Critical')),
            explanation             JSONB
        )
    """)

    # Indexes
    op.execute("CREATE INDEX idx_ext_icu_person ON inpatient_ext.icu_stay (person_id)")
    op.execute("CREATE INDEX idx_ext_bundle_person ON inpatient_ext.bundle_assessment (person_id)")
    op.execute("CREATE INDEX idx_ext_census_dt ON inpatient_ext.bed_census (census_datetime)")
    op.execute("CREATE INDEX idx_ext_pred_person ON inpatient_ext.prediction_score (person_id)")
    op.execute("CREATE INDEX idx_ext_process_ts ON inpatient_ext.process_event (event_timestamp)")


def downgrade() -> None:
    op.execute("DROP SCHEMA IF EXISTS inpatient_ext CASCADE")
```

- [ ] **Step 2: Run migration**

Run: `cd morpheus-ingest && alembic -x sqlalchemy.url=postgresql://parthenon:parthenon@localhost:5480/parthenon upgrade head`

- [ ] **Step 3: Verify extension tables exist**

Run: `docker compose exec -T postgres psql -U parthenon -d parthenon -c "SELECT tablename FROM pg_tables WHERE schemaname = 'inpatient_ext' ORDER BY tablename;"`

Expected: 23 tables (includes concept_gap, load_batch, data_source, dq_result + 19 domain tables)

- [ ] **Step 4: Commit**

```bash
git add morpheus-ingest/alembic/versions/002_create_inpatient_ext.py
git commit -m "feat(morpheus): create inpatient_ext schema with 22 extension tables"
```

---

### Task 4: Add Laravel `inpatient` Database Connection

**Files:**
- Modify: `backend/config/database.php`

- [ ] **Step 1: Add inpatient connection**

Add to `backend/config/database.php` after the `eunomia` connection:

```php
'inpatient' => [
    'driver' => 'pgsql',
    'url' => env('DATABASE_URL'),
    'host' => env('DB_HOST', '127.0.0.1'),
    'port' => env('DB_PORT', '5432'),
    'database' => env('DB_DATABASE', 'parthenon'),
    'username' => env('DB_USERNAME', 'parthenon'),
    'password' => env('DB_PASSWORD', ''),
    'charset' => 'utf8',
    'prefix' => '',
    'prefix_indexes' => true,
    'search_path' => 'inpatient,inpatient_ext,omop',
    'sslmode' => 'prefer',
],
```

- [ ] **Step 2: Commit**

```bash
git add backend/config/database.php
git commit -m "feat(morpheus): add Laravel inpatient database connection"
```

---

### Task 5: MIMIC-IV Adapter

**Files:**
- Create: `morpheus-ingest/app/adapters/__init__.py`
- Create: `morpheus-ingest/app/adapters/base.py`
- Create: `morpheus-ingest/app/adapters/mimic_adapter.py`
- Create: `morpheus-ingest/app/staging/__init__.py`
- Create: `morpheus-ingest/app/staging/models.py`
- Create: `morpheus-ingest/app/staging/writer.py`
- Create: `morpheus-ingest/tests/__init__.py`
- Create: `morpheus-ingest/tests/conftest.py`
- Create: `morpheus-ingest/tests/test_mimic_adapter.py`

This task is large — it builds the adapter that reads from `mimiciv.*` and writes to `inpatient_staging.*`. I'll provide the key files; the test verifies the adapter stages MIMIC demo data correctly.

- [ ] **Step 1: Write test for MIMIC adapter**

Create `morpheus-ingest/tests/conftest.py`:
```python
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

TEST_DB_URL = "postgresql://parthenon:parthenon@localhost:5480/parthenon"


@pytest.fixture(scope="session")
def db_engine():
    return create_engine(TEST_DB_URL)


@pytest.fixture
def db_session(db_engine):
    """Each test runs in a transaction that rolls back — no pollution."""
    connection = db_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()
```

Create `morpheus-ingest/tests/test_mimic_adapter.py`:
```python
from sqlalchemy import text

from app.adapters.mimic_adapter import MimicAdapter


def test_mimic_adapter_stages_patients(db_session):
    adapter = MimicAdapter(db_session)
    batch_id = adapter.stage_all()
    result = db_session.execute(
        text("SELECT count(*) FROM inpatient_staging.stg_patient WHERE load_batch_id = :bid"),
        {"bid": batch_id},
    )
    count = result.scalar()
    assert count == 100, f"Expected 100 patients, got {count}"


def test_mimic_adapter_stages_encounters(db_session):
    adapter = MimicAdapter(db_session)
    batch_id = adapter.stage_all()
    result = db_session.execute(
        text("SELECT count(*) FROM inpatient_staging.stg_encounter WHERE load_batch_id = :bid"),
        {"bid": batch_id},
    )
    count = result.scalar()
    assert count > 0, "Expected encounters to be staged"


def test_mimic_adapter_stage_all_uses_single_batch(db_session):
    adapter = MimicAdapter(db_session)
    batch_id = adapter.stage_all()
    # All tables should reference the same batch_id
    for table in ["stg_patient", "stg_encounter", "stg_condition", "stg_drug",
                  "stg_measurement", "stg_procedure"]:
        result = db_session.execute(
            text(f"SELECT count(*) FROM inpatient_staging.{table} WHERE load_batch_id = :bid"),
            {"bid": batch_id},
        )
        count = result.scalar()
        assert count > 0, f"Expected {table} to have rows for batch {batch_id}"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd morpheus-ingest && python -m pytest tests/test_mimic_adapter.py -v`

Expected: FAIL (MimicAdapter not defined)

- [ ] **Step 3: Create adapter base class**

Create `morpheus-ingest/app/adapters/base.py`:
```python
from abc import ABC, abstractmethod

from sqlalchemy.orm import Session


class SourceAdapter(ABC):
    """Base class for all EHR source adapters."""

    def __init__(self, session: Session):
        self.session = session

    @abstractmethod
    def create_batch(self, source_name: str) -> int:
        """Create a load_batch record and return batch_id."""

    @abstractmethod
    def stage_patients(self) -> int:
        """Stage patient records. Returns batch_id."""

    @abstractmethod
    def stage_encounters(self) -> int:
        """Stage encounter records. Returns batch_id."""

    @abstractmethod
    def stage_conditions(self) -> int:
        """Stage condition records. Returns batch_id."""

    @abstractmethod
    def stage_measurements(self) -> int:
        """Stage measurement records. Returns batch_id."""

    @abstractmethod
    def stage_drugs(self) -> int:
        """Stage drug records. Returns batch_id."""

    @abstractmethod
    def stage_procedures(self) -> int:
        """Stage procedure records. Returns batch_id."""

    @abstractmethod
    def stage_all(self) -> int:
        """Stage all available data. Returns batch_id."""
```

- [ ] **Step 4: Create MIMIC adapter**

Create `morpheus-ingest/app/adapters/mimic_adapter.py`:
```python
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.adapters.base import SourceAdapter
from app.config import settings

EXT = settings.ext_schema
STG = settings.staging_schema
SRC = settings.mimic_schema


class MimicAdapter(SourceAdapter):
    """Adapter for MIMIC-IV demo data already loaded in mimiciv.* schema."""

    def create_batch(self, source_name: str = "MIMIC-IV Demo") -> int:
        result = self.session.execute(
            text(f"""
                INSERT INTO {EXT}.load_batch (source_name, status)
                VALUES (:name, 'staging')
                RETURNING batch_id
            """),
            {"name": source_name},
        )
        self.session.flush()
        return result.scalar()

    def stage_all(self) -> int:
        """Stage all MIMIC-IV data into canonical staging tables under one batch."""
        batch_id = self.create_batch("MIMIC-IV Demo")
        self._stage_patients(batch_id)
        self._stage_encounters(batch_id)
        self._stage_conditions(batch_id)
        self._stage_measurements(batch_id)
        self._stage_drugs(batch_id)
        self._stage_procedures(batch_id)
        self.session.flush()
        return batch_id

    # --- Individual staging methods (all private, share batch_id) ---

    def _stage_patients(self, batch_id: int) -> None:
        self.session.execute(
            text(f"""
                INSERT INTO {STG}.stg_patient
                    (person_source_value, birth_year, gender_source_value,
                     load_batch_id, source_table, source_row_id)
                SELECT subject_id::text, anchor_year::int - anchor_age::int, gender,
                       :bid, 'patients', subject_id::text
                FROM {SRC}.patients
            """),
            {"bid": batch_id},
        )

    def _stage_encounters(self, batch_id: int) -> None:
        self.session.execute(
            text(f"""
                INSERT INTO {STG}.stg_encounter
                    (person_source_value, encounter_source_value, encounter_type,
                     admit_datetime, discharge_datetime, admit_source,
                     discharge_disposition, load_batch_id, source_table, source_row_id)
                SELECT subject_id::text, hadm_id::text, admission_type,
                       admittime::timestamp, dischtime::timestamp,
                       admission_location, discharge_location,
                       :bid, 'admissions', hadm_id::text
                FROM {SRC}.admissions
            """),
            {"bid": batch_id},
        )

    def _stage_conditions(self, batch_id: int) -> None:
        self.session.execute(
            text(f"""
                INSERT INTO {STG}.stg_condition
                    (person_source_value, encounter_source_value,
                     condition_source_code, condition_source_vocab,
                     load_batch_id, source_table, source_row_id)
                SELECT subject_id::text, hadm_id::text, icd_code,
                       CASE WHEN icd_version='9' THEN 'ICD9CM' ELSE 'ICD10CM' END,
                       :bid, 'diagnoses_icd',
                       subject_id::text||'-'||hadm_id::text||'-'||seq_num::text
                FROM {SRC}.diagnoses_icd
            """),
            {"bid": batch_id},
        )

    def _stage_measurements(self, batch_id: int) -> None:
        # Lab events
        self.session.execute(
            text(f"""
                INSERT INTO {STG}.stg_measurement
                    (person_source_value, encounter_source_value,
                     measurement_datetime, source_code, source_vocabulary,
                     value_as_number, value_as_text, unit_source_value,
                     range_low, range_high,
                     load_batch_id, source_table, source_row_id)
                SELECT subject_id::text, hadm_id::text, charttime::timestamp,
                       itemid::text, 'MIMIC-labevents',
                       CASE WHEN valuenum ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN valuenum::numeric ELSE NULL END,
                       value, valueuom,
                       CASE WHEN ref_range_lower ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ref_range_lower::numeric ELSE NULL END,
                       CASE WHEN ref_range_upper ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ref_range_upper::numeric ELSE NULL END,
                       :bid, 'labevents', labevent_id::text
                FROM {SRC}.labevents
            """),
            {"bid": batch_id},
        )
        # Chart events (vitals, assessments)
        self.session.execute(
            text(f"""
                INSERT INTO {STG}.stg_measurement
                    (person_source_value, encounter_source_value,
                     measurement_datetime, source_code, source_vocabulary,
                     value_as_number, value_as_text, unit_source_value,
                     load_batch_id, source_table, source_row_id)
                SELECT subject_id::text, hadm_id::text, charttime::timestamp,
                       itemid::text, 'MIMIC-chartevents',
                       CASE WHEN valuenum ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN valuenum::numeric ELSE NULL END,
                       value, valueuom,
                       :bid, 'chartevents',
                       subject_id::text||'-'||stay_id::text||'-'||charttime::text
                FROM {SRC}.chartevents
            """),
            {"bid": batch_id},
        )

    def _stage_drugs(self, batch_id: int) -> None:
        self.session.execute(
            text(f"""
                INSERT INTO {STG}.stg_drug
                    (person_source_value, encounter_source_value,
                     drug_source_code, drug_source_vocab, drug_name,
                     start_datetime, end_datetime, route_source_value,
                     dose_value, dose_unit,
                     load_batch_id, source_table, source_row_id)
                SELECT subject_id::text, hadm_id::text,
                       COALESCE(NULLIF(ndc,'0'), gsn, drug),
                       CASE WHEN ndc IS NOT NULL AND ndc != '0' AND ndc != '' THEN 'NDC'
                            ELSE 'MIMIC-prescriptions' END,
                       drug, starttime::timestamp, stoptime::timestamp, route,
                       dose_val_rx, dose_unit_rx,
                       :bid, 'prescriptions',
                       subject_id::text||'-'||hadm_id::text||'-'||COALESCE(starttime,'')||'-'||COALESCE(drug,'')
                FROM {SRC}.prescriptions
            """),
            {"bid": batch_id},
        )

    def _stage_procedures(self, batch_id: int) -> None:
        self.session.execute(
            text(f"""
                INSERT INTO {STG}.stg_procedure
                    (person_source_value, encounter_source_value,
                     procedure_source_code, procedure_source_vocab,
                     procedure_date,
                     load_batch_id, source_table, source_row_id)
                SELECT subject_id::text, hadm_id::text, icd_code,
                       CASE WHEN icd_version='9' THEN 'ICD9Proc' ELSE 'ICD10PCS' END,
                       chartdate::date,
                       :bid, 'procedures_icd',
                       subject_id::text||'-'||hadm_id::text||'-'||icd_code
                FROM {SRC}.procedures_icd
            """),
            {"bid": batch_id},
        )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd morpheus-ingest && python -m pytest tests/test_mimic_adapter.py -v`

Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add morpheus-ingest/app/adapters/ morpheus-ingest/app/staging/ morpheus-ingest/tests/
git commit -m "feat(morpheus): MIMIC-IV adapter stages patients, encounters, measurements to canonical staging"
```

---

### Task 6-10: OMOP Mappers, Quality Gate, Orchestrator, End-to-End

> **Note:** Tasks 6-10 follow the same TDD pattern (test → implement → verify → commit) for:
> - **Task 6:** Vocabulary lookup + concept_lookup.py + relationship_walker.py
> - **Task 7:** Person mapper + visit mapper (staging → CDM)
> - **Task 8:** Condition, drug, measurement, procedure mappers + domain router
> - **Task 9:** Era builder (condition_era, drug_era, observation_period)
> - **Task 10:** Quality gate (coverage checker, integrity checker, gate decision) + batch orchestrator + ingest API router + end-to-end test
>
> These tasks are substantial and will be detailed in a follow-up plan document once the foundation (Tasks 1-5) is validated. The architecture and file structure are already defined above. Each mapper follows the same pattern:
> 1. Read from `inpatient_staging.stg_*`
> 2. Look up source codes in `omop.concept` via vocabulary utilities
> 3. Apply domain routing (concept.domain_id determines target CDM table)
> 4. Write to `inpatient.*` CDM tables
> 5. Log unmapped codes to `inpatient_staging.concept_gap`

---

## Completion Criteria

Phase A is complete when:
- [ ] `omop` schema has vocabulary tables (7.2M concepts)
- [ ] `inpatient_staging` schema has 15 staging tables
- [ ] `inpatient_ext` schema has 23 tables (including load_batch, concept_gap, data_source, dq_result)
- [ ] `inpatient` schema has CDM clinical tables only (no vocabulary)
- [ ] Laravel has `inpatient` database connection
- [ ] morpheus-ingest service runs on port 8004
- [ ] MIMIC-IV demo data (100 patients) flows through: `mimiciv.*` → `inpatient_staging.stg_*` → `inpatient.*` CDM tables
- [ ] Quality gate reports mapping coverage and DQD results
- [ ] Row counts in CDM tables are non-zero and plausible
