# Installer Sub-project C: Existing OMOP CDM Support

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Sub-project:** C of 3 (Installer milestone)
**Date:** 2026-04-23
**Status:** Approved design — pending implementation plan

---

## Goal

Enable the Parthenon installer to fully configure an external OMOP CDM database at install time — including CDM schema creation (if needed), source registration, vocabulary loading, results schema creation, and optional Achilles characterization and DQD quality assessment — across all supported dialects.

## Architecture

The `omop_cdm` phase is a new engine phase inserted after `datasets` and before `solr` in `DEFAULT_REGISTRY`. It contains 7 steps. Each step is idempotent and resumable via the existing `CheckpointStore`. Steps are no-ops (their `check()` returns `True` immediately) when `cdm_setup_mode == "Create local PostgreSQL OMOP database"` (mode 3 — the bundled Docker PG path already handled by existing phases) or when the step's precondition is already satisfied on the external server.

All dialect-specific DDL operations (CDM schema creation, results schema creation) are delegated to OHDSI R packages (`CommonDataModel`, `Achilles`) running inside the existing `r-runtime` container via DatabaseConnector, which natively supports all 10+ dialects.

---

## CDM Setup Modes

| Mode | `cdm_setup_mode` value | What the installer does |
|------|------------------------|-------------------------|
| 1 | `"Use an existing OMOP CDM"` | CDM + vocab already populated; test → register → create results schema → optional Achilles/DQD |
| 2 | `"Use an existing database server"` | Server accessible but CDM empty/partial; test → create CDM DDL → register → load vocab → create results schema → optional Achilles/DQD |
| 3 | `"Create local PostgreSQL OMOP database"` | Bundled Docker PG — entire `omop_cdm` phase is a no-op |

---

## Phase Steps

### Step 1: `omop_cdm.test_connection`

**Purpose:** Verify the installer can reach the external database before attempting any writes.

**Artisan command:** `php artisan omop:test-connection --source-key={ext_source_key}`

**Implementation:** For PostgreSQL, uses Laravel's dynamic connection resolver with the collected `EXT_DB_*` env vars. For non-PG dialects, delegates to `DatabaseConnector::connect()` via an R runtime call.

**check():** Always returns `False` — this is a diagnostic step with no persisted state.

**Failure:** Raises `StepError` with the raw driver error message. User is directed to verify firewall rules, credentials, and dialect-specific port.

**Mode 3 guard:** Returns `True` immediately.

---

### Step 2: `omop_cdm.create_cdm_schema`

**Purpose:** Create the OMOP CDM v5.4 schema and tables on the external server when the database is empty or partial.

**Artisan command:** `php artisan omop:create-cdm-schema --source-key={ext_source_key} --cdm-schema={cdm_schema} --dialect={cdm_dialect}`

**Implementation:** Calls the OHDSI `CommonDataModel` R package's DDL generator via the `r-runtime` container. The package produces dialect-correct SQL for all supported systems.

**check():**
- Mode 3 guard → `True`
- Mode 1 (`cdm_existing_state` is `"Tables exist"` or `"Complete"`) → `True`
- Otherwise: queries `INFORMATION_SCHEMA.TABLES` for the `person` table in `{cdm_schema}` on the external server → `True` if found

---

### Step 3: `omop_cdm.register_source`

**Purpose:** Create the `Source` and `SourceDaimon` records so Parthenon knows about the external CDM.

**Artisan command:**
```
php artisan omop:register-source
  --source-key={ext_source_key}
  --name={source_name}
  --dialect={cdm_dialect}
  --host={cdm_server}
  --port={cdm_port}
  --database={cdm_database}
  --cdm-schema={cdm_schema}
  --vocab-schema={vocabulary_schema}
  --results-schema={results_schema}
```

**Implementation:** Uses `Source::updateOrCreate(['source_key' => $key], [...])` and creates three `SourceDaimon` records (CDM, Vocabulary, Results) using the same pattern as `acumenus:seed-source`. Password is encrypted at rest via Laravel's model cast.

**check():** `SELECT COUNT(*) FROM app.sources WHERE source_key = '{ext_source_key}' AND deleted_at IS NULL` > 0.

**Mode 3 guard:** Returns `True` immediately.

---

### Step 4: `omop_cdm.load_vocabulary`

**Purpose:** Load the Athena vocabulary into the external server's vocabulary schema when the vocab is absent or incomplete.

**Artisan command:** `php artisan vocabulary:import --source-key={ext_source_key} --zip={vocab_zip_path}` (extends the existing importer with a `--source-key` flag to target a non-default schema).

**check():**
- Mode 3 guard → `True`
- `vocabulary_setup == "Use existing vocabulary"` → `True`
- No `vocab_zip_path` configured → `True` (skip — user loads vocab manually later)
- Otherwise: queries concept count in `{vocabulary_schema}.concept` on the external server → `True` if > 1000

---

### Step 5: `omop_cdm.create_results_schema`

**Purpose:** Create the Achilles results schema and tables on the external server.

**Artisan command:** `php artisan omop:create-results-schema --source-key={ext_source_key}`

**Implementation:** Calls `Achilles::createResultsDataModel()` in R, which is dialect-aware via DatabaseConnector.

**check():**
- Mode 3 guard → `True`
- Queries `INFORMATION_SCHEMA.TABLES` for `achilles_results` in `{results_schema}` → `True` if found

---

### Step 6: `omop_cdm.run_achilles`

**Purpose:** Run OHDSI Achilles characterization to pre-populate the dashboard.

**Artisan command:** `php artisan achilles:run --source-key={ext_source_key}` (existing command).

**check():**
- Mode 3 guard → `True`
- `resolved["run_achilles"] == False` → `True` (user opted out at config time)
- Queries `SELECT COUNT(*) FROM {results_schema}.achilles_results` → `True` if > 0

---

### Step 7: `omop_cdm.run_dqd`

**Purpose:** Run OHDSI Data Quality Dashboard assessment.

**Artisan command:** `php artisan dqd:run --source-key={ext_source_key}` (existing command).

**check():**
- Mode 3 guard → `True`
- `resolved["run_dqd"] == False` → `True` (user opted out at config time)
- Queries whether DQD results exist for this source in `app.dqd_results` → `True` if found

---

## Source Key Convention

The external source key is derived deterministically from the database name by a utility function in the phase module:

```python
import re

def _ext_source_key(resolved: dict) -> str:
    raw = f"EXT_{resolved['cdm_database'].upper()}"
    return re.sub(r"[^A-Z0-9_]", "_", raw)[:32]
```

Example: `cdm_database = "omop_cdm"` → `EXT_OMOP_CDM`. The function is called inline by each step that needs the key — no mutation of `resolved` required.

---

## Config and Credentials

### Keys collected by `installer/config.py` (no new prompts needed)

| Key | Description |
|-----|-------------|
| `cdm_setup_mode` | One of the three mode strings |
| `cdm_dialect` | Database dialect (postgresql, sqlserver, oracle, etc.) |
| `cdm_server` | External DB hostname |
| `cdm_port` | External DB port (dialect-specific default) |
| `cdm_database` | External DB database name |
| `cdm_user` | External DB username |
| `cdm_password` | External DB password |
| `cdm_schema` | CDM schema name (default: `omop`) |
| `vocabulary_schema` | Vocabulary schema name (default: `vocab`) |
| `results_schema` | Results schema name (default: `results`) |
| `cdm_existing_state` | State of the existing CDM |
| `vocabulary_setup` | Vocabulary setup choice |
| `vocab_zip_path` | Path to Athena vocabulary ZIP |
| `run_achilles` | Boolean — run Achilles at install time |
| `run_dqd` | Boolean — run DQD at install time |

### Credential flow

1. `config.gather` — collects and injects `ext_source_key` into `resolved`
2. `config.write_env` — writes `EXT_DB_HOST`, `EXT_DB_PORT`, `EXT_DB_DATABASE`, `EXT_DB_USER`, `EXT_DB_PASSWORD` to `backend/.env`; adds a named `ext` connection entry to `config/database.php` pattern (via the dynamic source connection resolver — no file edit needed)
3. `config.store_secrets` — adds `EXT_DB_PASSWORD` to the OS keychain (extends the existing 4-key list)
4. Phase steps — read `resolved["cdm_*"]` from `ctx.config` and pass as artisan command arguments; the password is never written to the event stream

---

## New Artisan Commands

| Command | File | Notes |
|---------|------|-------|
| `omop:test-connection` | `backend/app/Console/Commands/Omop/TestConnectionCommand.php` | New |
| `omop:create-cdm-schema` | `backend/app/Console/Commands/Omop/CreateCdmSchemaCommand.php` | New; calls R runtime |
| `omop:register-source` | `backend/app/Console/Commands/Omop/RegisterSourceCommand.php` | New; mirrors seed-source pattern |
| `omop:create-results-schema` | `backend/app/Console/Commands/Omop/CreateResultsSchemaCommand.php` | New; calls R runtime |
| `vocabulary:import` | `backend/app/Console/Commands/Vocabulary/ImportCommand.php` | Extended with `--source-key` |

Existing commands used unchanged: `achilles:run`, `dqd:run`.

---

## Phase Registration

`installer/engine/phases/__init__.py` updated to insert `omop_cdm.PHASE` between `DATASETS` and `FRONTEND`:

```python
DEFAULT_REGISTRY = PhaseRegistry()
for phase in (PREFLIGHT, CONFIG, HECATE, DOCKER, BOOTSTRAP, DATASETS, OMOP_CDM, FRONTEND, SOLR, ADMIN):
    DEFAULT_REGISTRY.register(phase)
```

Total phases: 10 (was 9).

---

## Error Handling

- `test_connection` failure → `StepError` with driver message; installer stops, directs user to check credentials
- `create_cdm_schema` failure → `StepError`; user can fix DDL issue and `--resume`
- `register_source` failure → `StepError`; idempotent on retry
- `load_vocabulary` failure → `StepError`; large ZIP uploads time out at 30 min (configurable via `VOCAB_IMPORT_TIMEOUT_S`)
- `create_results_schema` failure → `StepError`; R runtime not up raises distinct message directing user to check `docker compose ps`
- `run_achilles` / `run_dqd` failure → `StepError`; these are long-running; the checkpoint saves `"running"` which is demoted to `"failed"` on resume (per the Sub-project B fix)

---

## Testing

### Unit tests (`installer/tests/test_omop_cdm_phase.py`)
- `check()` returns `True` for all steps when `cdm_setup_mode == "Create local PostgreSQL OMOP database"`
- `check()` returns `True` for `run_achilles` when `resolved["run_achilles"] == False`
- `check()` returns `True` for `run_dqd` when `resolved["run_dqd"] == False`
- `check()` returns `True` for `load_vocabulary` when `vocabulary_setup == "Use existing vocabulary"`
- Source key slug generation: sanitization, truncation at 32 chars, `EXT_` prefix

### Contract tests (extend `test_engine_contract.py`)
- `omop_cdm` registered in `DEFAULT_REGISTRY`
- All 7 steps have `run` and `check` callables
- Phase appears after `datasets` and before `frontend` in registry order

### Integration tests (Docker-guarded, extend `test_engine_integration.py`)
- Mode 3: entire phase emits only `step_skip` events
- Mode 1 against bundled Eunomia schema: `test_connection` passes, `register_source` creates a `Source` row, `create_results_schema` creates the schema

---

## Out of Scope

- Installer GUI / TUI changes to prompt for new config keys (config keys already exist in `installer/config.py`)
- Multi-source registration (registering more than one external CDM per install)
- APT/YUM repository hosting
- Uninstall / CDM deregistration workflow
- SQL Server / Oracle dialect integration tests (covered by artisan command unit tests)
