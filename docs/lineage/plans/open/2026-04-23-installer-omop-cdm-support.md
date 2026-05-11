# Installer Sub-project C: Existing OMOP CDM Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 7-step `omop_cdm` engine phase that connects an external OMOP CDM database to Parthenon at install time — testing connectivity, creating schemas, registering the source, loading vocabulary, and optionally running Achilles + DQD.

**Architecture:** New `installer/engine/phases/omop_cdm.py` phase follows the exact idempotent-step pattern of existing phases. All check() functions return True immediately when `cdm_setup_mode == "Create local PostgreSQL OMOP database"` (mode 3 no-op guard). Four new PHP artisan commands back the phase steps. CDM and results schema creation delegate to OHDSI R packages (CommonDataModel, Achilles) via two new R Plumber API endpoints. Achilles and DQD reuse existing `parthenon:run-achilles` and `parthenon:run-dqd` commands with source ID lookup.

**Tech Stack:** Python 3.12 installer engine, PHP 8.4 / Laravel 11 artisan commands, R 4.4 + OHDSI HADES packages via Plumber API, PostgreSQL/SQL Server/Oracle/etc. target databases via DatabaseConnector.

---

## File Structure

**Create:**
- `installer/engine/phases/omop_cdm.py` — 7-step engine phase
- `installer/tests/test_omop_cdm_phase.py` — unit + contract + integration tests
- `backend/app/Console/Commands/Omop/RegisterSourceCommand.php`
- `backend/app/Console/Commands/Omop/TestConnectionCommand.php`
- `backend/app/Console/Commands/Omop/CreateCdmSchemaCommand.php`
- `backend/app/Console/Commands/Omop/CreateResultsSchemaCommand.php`
- `backend/app/Console/Commands/Omop/LoadVocabularyCommand.php`
- `backend/tests/Feature/Omop/RegisterSourceCommandTest.php`
- `backend/tests/Feature/Omop/TestConnectionCommandTest.php`
- `backend/tests/Feature/Omop/CreateCdmSchemaCommandTest.php`
- `backend/tests/Feature/Omop/CreateResultsSchemaCommandTest.php`
- `backend/tests/Feature/Omop/LoadVocabularyCommandTest.php`

**Modify:**
- `installer/engine/phases/__init__.py` — insert OMOP_CDM after DATASETS
- `installer/tests/test_engine_contract.py` — add omop_cdm contract assertions
- `installer/tests/test_engine_integration.py` — add mode 3 no-op integration test
- `r-runtime/plumber_api.R` — add two endpoints

---

## Context for agentic workers

**Existing patterns to follow:**

`installer/engine/phases/datasets.py` — authoritative example of a phase module. Every step has `_check_X(ctx)` and `_run_X(ctx)`. The `check()` returning `True` = already done = skip. `check()` returning `False` = run needed.

`backend/app/Console/Commands/SeedAcumenusSourceCommand.php` — model for registering a Source + SourceDaimon records. Use `updateOrCreate` on `source_key`. Import `DaimonType` enum.

`backend/app/Console/Commands/RunAchillesCommand.php` — existing Achilles command. Takes `{source}` as positional Source ID (not key). Uses `--sync` for synchronous execution.

`installer/tests/test_engine_contract.py` — shows how to write contract tests for phases.

**Important caveats:**
- `_check_test_connection()` always returns `False` — it is a diagnostic step with no persisted state, always re-runs.
- Source `source_connection` field: set to `'dynamic'` for external sources — the Source model resolves a dynamic connection from `db_host`/`db_port`/`db_database` when `source_connection == 'dynamic'`.
- R Plumber API base URL: `env('R_PLUMBER_URL', 'http://r-runtime:8004')` — add this to `backend/.env.example`.
- The R Plumber API port: verify against `docker-compose.yml` before implementing Task 4. The service is named `r-runtime`.

---

## Task 1: Phase skeleton + `_ext_source_key()` + mode 3 guards + unit tests

**Files:**
- Create: `installer/engine/phases/omop_cdm.py`
- Create: `installer/tests/test_omop_cdm_phase.py`

- [ ] **Step 1: Write failing unit tests for mode 3 guard and source key**

```python
# installer/tests/test_omop_cdm_phase.py
from __future__ import annotations
import pytest
from unittest.mock import patch, MagicMock
from installer.engine.phases.omop_cdm import (
    _ext_source_key,
    _check_test_connection,
    _check_create_cdm_schema,
    _check_register_source,
    _check_load_vocabulary,
    _check_create_results_schema,
    _check_run_achilles,
    _check_run_dqd,
    PHASE,
)
from installer.engine.registry import Context
from installer.engine.secrets import SecretManager


def _ctx(resolved: dict, tmp_path) -> Context:
    return Context(
        config={"resolved": resolved},
        secrets=SecretManager(tmp_path / "s"),
        emit=lambda msg: None,
    )


MODE3 = "Create local PostgreSQL OMOP database"
MODE1 = "Use an existing OMOP CDM"


class TestExtSourceKey:
    def test_basic(self):
        assert _ext_source_key({"cdm_database": "omop_cdm"}) == "EXT_OMOP_CDM"

    def test_sanitizes_special_chars(self):
        assert _ext_source_key({"cdm_database": "my-db.prod"}) == "EXT_MY_DB_PROD"

    def test_truncates_at_32(self):
        long_db = "a" * 40
        key = _ext_source_key({"cdm_database": long_db})
        assert len(key) <= 32
        assert key.startswith("EXT_")

    def test_uppercase(self):
        assert _ext_source_key({"cdm_database": "lowercase"}) == "EXT_LOWERCASE"


class TestMode3Guard:
    """All check() functions must return True (no-op) for mode 3."""

    def test_test_connection_skips_mode3(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE3}, tmp_path)
        assert _check_test_connection(ctx) is True

    def test_create_cdm_schema_skips_mode3(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE3}, tmp_path)
        assert _check_create_cdm_schema(ctx) is True

    def test_register_source_skips_mode3(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE3}, tmp_path)
        assert _check_register_source(ctx) is True

    def test_load_vocabulary_skips_mode3(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE3}, tmp_path)
        assert _check_load_vocabulary(ctx) is True

    def test_create_results_schema_skips_mode3(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE3}, tmp_path)
        assert _check_create_results_schema(ctx) is True

    def test_run_achilles_skips_mode3(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE3}, tmp_path)
        assert _check_run_achilles(ctx) is True

    def test_run_dqd_skips_mode3(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE3}, tmp_path)
        assert _check_run_dqd(ctx) is True


class TestOptOutGuards:
    def test_achilles_skips_when_opted_out(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE1, "run_achilles": False, "cdm_database": "x"}, tmp_path)
        assert _check_run_achilles(ctx) is True

    def test_dqd_skips_when_opted_out(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE1, "run_dqd": False, "cdm_database": "x"}, tmp_path)
        assert _check_run_dqd(ctx) is True

    def test_load_vocab_skips_when_existing(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE1, "vocabulary_setup": "Use existing vocabulary",
                    "cdm_database": "x"}, tmp_path)
        assert _check_load_vocabulary(ctx) is True

    def test_load_vocab_skips_when_no_zip(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE1, "vocabulary_setup": "Load Athena vocabulary ZIP",
                    "vocab_zip_path": None, "cdm_database": "x"}, tmp_path)
        assert _check_load_vocabulary(ctx) is True


class TestPhaseStructure:
    def test_phase_has_7_steps(self):
        assert len(PHASE.steps) == 7

    def test_step_ids(self):
        ids = [s.id for s in PHASE.steps]
        assert ids == [
            "omop_cdm.test_connection",
            "omop_cdm.create_cdm_schema",
            "omop_cdm.register_source",
            "omop_cdm.load_vocabulary",
            "omop_cdm.create_results_schema",
            "omop_cdm.run_achilles",
            "omop_cdm.run_dqd",
        ]

    def test_all_steps_have_run_and_check(self):
        for step in PHASE.steps:
            assert callable(step.run), f"{step.id} missing run"
            assert callable(step.check), f"{step.id} missing check"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest installer/tests/test_omop_cdm_phase.py -v
```
Expected: `ModuleNotFoundError: No module named 'installer.engine.phases.omop_cdm'`

- [ ] **Step 3: Create the phase skeleton**

```python
# installer/engine/phases/omop_cdm.py
from __future__ import annotations

import re

from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import utils

ROOT = utils.REPO_ROOT
MODE_LOCAL = "Create local PostgreSQL OMOP database"
MODE_EXISTING_CDM = "Use an existing OMOP CDM"
MODE_EXISTING_SERVER = "Use an existing database server"


def _ext_source_key(resolved: dict) -> str:
    raw = f"EXT_{resolved.get('cdm_database', 'CDM').upper()}"
    return re.sub(r"[^A-Z0-9_]", "_", raw)[:32]


def _is_local(ctx: Context) -> bool:
    return ctx.config.get("resolved", {}).get("cdm_setup_mode") == MODE_LOCAL


def _check_test_connection(ctx: Context) -> bool:
    return _is_local(ctx)


def _run_test_connection(ctx: Context) -> None:
    pass  # implemented in Task 7


def _check_create_cdm_schema(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    resolved = ctx.config.get("resolved", {})
    if resolved.get("cdm_existing_state") in ("Tables exist", "Vocab loaded", "Complete"):
        return True
    return False  # implemented fully in Task 7


def _run_create_cdm_schema(ctx: Context) -> None:
    pass  # implemented in Task 7


def _check_register_source(ctx: Context) -> bool:
    return _is_local(ctx)


def _run_register_source(ctx: Context) -> None:
    pass  # implemented in Task 7


def _check_load_vocabulary(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    resolved = ctx.config.get("resolved", {})
    if resolved.get("vocabulary_setup") == "Use existing vocabulary":
        return True
    if not resolved.get("vocab_zip_path"):
        return True
    return False  # implemented fully in Task 7


def _run_load_vocabulary(ctx: Context) -> None:
    pass  # implemented in Task 7


def _check_create_results_schema(ctx: Context) -> bool:
    return _is_local(ctx)


def _run_create_results_schema(ctx: Context) -> None:
    pass  # implemented in Task 7


def _check_run_achilles(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    return not ctx.config.get("resolved", {}).get("run_achilles", True)


def _run_run_achilles(ctx: Context) -> None:
    pass  # implemented in Task 7


def _check_run_dqd(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    return not ctx.config.get("resolved", {}).get("run_dqd", True)


def _run_run_dqd(ctx: Context) -> None:
    pass  # implemented in Task 7


PHASE = Phase(
    id="omop_cdm",
    name="External OMOP CDM Setup",
    steps=[
        Step(id="omop_cdm.test_connection", name="Test external CDM connection",
             run=_run_test_connection, check=_check_test_connection),
        Step(id="omop_cdm.create_cdm_schema", name="Create OMOP CDM schema",
             run=_run_create_cdm_schema, check=_check_create_cdm_schema),
        Step(id="omop_cdm.register_source", name="Register external CDM as source",
             run=_run_register_source, check=_check_register_source),
        Step(id="omop_cdm.load_vocabulary", name="Load OMOP vocabulary into external DB",
             run=_run_load_vocabulary, check=_check_load_vocabulary),
        Step(id="omop_cdm.create_results_schema", name="Create Achilles results schema",
             run=_run_create_results_schema, check=_check_create_results_schema),
        Step(id="omop_cdm.run_achilles", name="Run Achilles characterization",
             run=_run_run_achilles, check=_check_run_achilles),
        Step(id="omop_cdm.run_dqd", name="Run Data Quality Dashboard",
             run=_run_run_dqd, check=_check_run_dqd),
    ],
)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest installer/tests/test_omop_cdm_phase.py -v
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add installer/engine/phases/omop_cdm.py installer/tests/test_omop_cdm_phase.py
git commit -m "feat(installer-c): omop_cdm phase skeleton with mode 3 guards and source key utility"
```

---

## Task 2: `omop:register-source` artisan command

**Files:**
- Create: `backend/app/Console/Commands/Omop/RegisterSourceCommand.php`
- Create: `backend/tests/Feature/Omop/RegisterSourceCommandTest.php`

- [ ] **Step 1: Write failing Pest test**

```php
<?php
// backend/tests/Feature/Omop/RegisterSourceCommandTest.php

use App\Models\App\Source;
use App\Models\App\SourceDaimon;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

test('register-source creates source and three daimons', function () {
    $this->artisan('omop:register-source', [
        '--source-key'     => 'EXT_TEST',
        '--name'           => 'Test External CDM',
        '--dialect'        => 'postgresql',
        '--host'           => 'db.example.com',
        '--port'           => '5432',
        '--database'       => 'omop_db',
        '--username'       => 'reader',
        '--password'       => 'secret',
        '--cdm-schema'     => 'omop',
        '--vocab-schema'   => 'vocab',
        '--results-schema' => 'results',
    ])->assertExitCode(0);

    $source = Source::where('source_key', 'EXT_TEST')->first();
    expect($source)->not->toBeNull();
    expect($source->db_host)->toBe('db.example.com');
    expect($source->db_database)->toBe('omop_db');
    expect($source->source_dialect)->toBe('postgresql');

    $daimons = SourceDaimon::where('source_id', $source->id)->pluck('daimon_type')->sort()->values();
    expect($daimons->toArray())->toBe(['cdm', 'results', 'vocabulary']);
});

test('register-source is idempotent', function () {
    $this->artisan('omop:register-source', [
        '--source-key' => 'EXT_IDEM',
        '--name'       => 'Test',
        '--dialect'    => 'postgresql',
        '--host'       => 'h',
        '--port'       => '5432',
        '--database'   => 'd',
    ])->assertExitCode(0);

    $this->artisan('omop:register-source', [
        '--source-key' => 'EXT_IDEM',
        '--name'       => 'Test Updated',
        '--dialect'    => 'postgresql',
        '--host'       => 'h',
        '--port'       => '5432',
        '--database'   => 'd',
    ])->assertExitCode(0);

    expect(Source::where('source_key', 'EXT_IDEM')->count())->toBe(1);
});

test('register-source fails without source-key', function () {
    $this->artisan('omop:register-source')->assertExitCode(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Omop/RegisterSourceCommandTest.php --no-ansi 2>&1"
```
Expected: `Class "App\Console\Commands\Omop\RegisterSourceCommand" not found` or similar.

- [ ] **Step 3: Create the command**

```php
<?php
// backend/app/Console/Commands/Omop/RegisterSourceCommand.php

namespace App\Console\Commands\Omop;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use Illuminate\Console\Command;

class RegisterSourceCommand extends Command
{
    protected $signature = 'omop:register-source
        {--source-key= : Unique source key (e.g. EXT_OMOP_CDM)}
        {--name= : Display name}
        {--dialect=postgresql : Database dialect (postgresql, sqlserver, oracle, etc.)}
        {--host= : Database host}
        {--port= : Database port}
        {--database= : Database name}
        {--username= : Database username}
        {--password= : Database password}
        {--cdm-schema=omop : CDM schema name}
        {--vocab-schema=vocab : Vocabulary schema name}
        {--results-schema=results : Results schema name}';

    protected $description = 'Register an external OMOP CDM database as a Parthenon data source';

    public function handle(): int
    {
        $key = $this->option('source-key');
        if (! $key) {
            $this->error('--source-key is required');
            return self::FAILURE;
        }

        $source = Source::updateOrCreate(
            ['source_key' => $key],
            [
                'source_name'       => $this->option('name') ?? $key,
                'source_dialect'    => $this->option('dialect') ?? 'postgresql',
                'source_connection' => 'dynamic',
                'db_host'           => $this->option('host'),
                'db_port'           => $this->option('port') ? (int) $this->option('port') : null,
                'db_database'       => $this->option('database'),
                'username'          => $this->option('username'),
                'password'          => $this->option('password'),
                'is_cache_enabled'  => false,
            ]
        );

        $daimons = [
            ['daimon_type' => DaimonType::CDM->value,       'table_qualifier' => $this->option('cdm-schema'),     'priority' => 0],
            ['daimon_type' => DaimonType::Vocabulary->value, 'table_qualifier' => $this->option('vocab-schema'),   'priority' => 0],
            ['daimon_type' => DaimonType::Results->value,    'table_qualifier' => $this->option('results-schema'), 'priority' => 0],
        ];

        foreach ($daimons as $daimon) {
            SourceDaimon::updateOrCreate(
                ['source_id' => $source->id, 'daimon_type' => $daimon['daimon_type']],
                ['table_qualifier' => $daimon['table_qualifier'], 'priority' => $daimon['priority']]
            );
        }

        $verb = $source->wasRecentlyCreated ? 'Created' : 'Updated';
        $this->info("{$verb} source: {$source->source_name} (key={$key}, id={$source->id})");

        return self::SUCCESS;
    }
}
```

- [ ] **Step 4: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Console/Commands/Omop/RegisterSourceCommand.php"
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Omop/RegisterSourceCommandTest.php --no-ansi 2>&1"
```
Expected: 3 tests passing.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Console/Commands/Omop/RegisterSourceCommand.php backend/tests/Feature/Omop/RegisterSourceCommandTest.php
git commit -m "feat(installer-c): add omop:register-source artisan command"
```

---

## Task 3: `omop:test-connection` artisan command

**Files:**
- Create: `backend/app/Console/Commands/Omop/TestConnectionCommand.php`
- Create: `backend/tests/Feature/Omop/TestConnectionCommandTest.php`

- [ ] **Step 1: Write failing Pest test**

```php
<?php
// backend/tests/Feature/Omop/TestConnectionCommandTest.php

use App\Models\App\Source;
use Illuminate\Support\Facades\DB;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

test('test-connection fails without source-key or host', function () {
    $this->artisan('omop:test-connection')->assertExitCode(1);
});

test('test-connection fails when source-key not found', function () {
    $this->artisan('omop:test-connection', [
        '--source-key' => 'NONEXISTENT',
    ])->assertExitCode(1);
});

test('test-connection succeeds against default app database', function () {
    // Create a source pointing at the app's own PG (always available in test env)
    Source::create([
        'source_key'        => 'EXT_SELF_TEST',
        'source_name'       => 'Self test',
        'source_dialect'    => 'postgresql',
        'source_connection' => 'dynamic',
        'db_host'           => env('DB_HOST', '127.0.0.1'),
        'db_port'           => (int) env('DB_PORT', 5432),
        'db_database'       => env('DB_DATABASE', 'parthenon'),
        'username'          => env('DB_USERNAME', 'parthenon'),
        'password'          => env('DB_PASSWORD', ''),
        'is_cache_enabled'  => false,
    ]);

    $this->artisan('omop:test-connection', [
        '--source-key' => 'EXT_SELF_TEST',
    ])->assertExitCode(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Omop/TestConnectionCommandTest.php --no-ansi 2>&1"
```
Expected: command class not found.

- [ ] **Step 3: Create the command**

```php
<?php
// backend/app/Console/Commands/Omop/TestConnectionCommand.php

namespace App\Console\Commands\Omop;

use App\Models\App\Source;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class TestConnectionCommand extends Command
{
    protected $signature = 'omop:test-connection
        {--source-key= : Registered source key to test}
        {--dialect=postgresql : Dialect for raw credential test}
        {--host= : Database host}
        {--port= : Database port}
        {--database= : Database name}
        {--username= : Username}
        {--password= : Password}';

    protected $description = 'Test connectivity to an external OMOP CDM database';

    public function handle(): int
    {
        [$driver, $host, $port, $database, $username, $password] = $this->resolveParams();

        if (! $host || ! $database) {
            $this->error('Provide --source-key or --host + --database');
            return self::FAILURE;
        }

        $connName = 'omop_test_' . uniqid();

        try {
            config([
                "database.connections.{$connName}" => [
                    'driver'   => $driver,
                    'host'     => $host,
                    'port'     => (int) $port,
                    'database' => $database,
                    'username' => $username,
                    'password' => $password,
                    'charset'  => 'utf8',
                    'options'  => [\PDO::ATTR_TIMEOUT => 10],
                ],
            ]);

            DB::connection($connName)->getPdo();
            DB::purge($connName);

            $this->info("Connection successful: {$host}/{$database}");
            return self::SUCCESS;
        } catch (\Exception $e) {
            DB::purge($connName);
            $this->error("Connection failed: {$e->getMessage()}");
            return self::FAILURE;
        }
    }

    /** @return array{string, string|null, string|int, string|null, string|null, string|null} */
    private function resolveParams(): array
    {
        if ($key = $this->option('source-key')) {
            $source = Source::where('source_key', $key)->first();
            if (! $source) {
                $this->error("Source '{$key}' not found.");
                exit(self::FAILURE);
            }
            return [
                $this->dialectToDriver($source->source_dialect),
                $source->db_host,
                $source->db_port ?? 5432,
                $source->db_database,
                $source->username,
                $source->password,
            ];
        }

        return [
            $this->dialectToDriver($this->option('dialect') ?? 'postgresql'),
            $this->option('host'),
            $this->option('port') ?? 5432,
            $this->option('database'),
            $this->option('username'),
            $this->option('password'),
        ];
    }

    private function dialectToDriver(string $dialect): string
    {
        return match ($dialect) {
            'sqlserver', 'synapse' => 'sqlsrv',
            'mysql'                => 'mysql',
            default                => 'pgsql',
        };
    }
}
```

> **Note for implementer:** Non-PDO dialects (Oracle, Snowflake, BigQuery, Databricks, DuckDB) cannot be tested via PDO. For those, `dialectToDriver()` falls back to `'pgsql'` which will fail. Phase `_run_test_connection` should emit a warning for unsupported dialects rather than a hard failure in v1.

- [ ] **Step 4: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Console/Commands/Omop/TestConnectionCommand.php"
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Omop/TestConnectionCommandTest.php --no-ansi 2>&1"
```
Expected: 3 tests passing.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Console/Commands/Omop/TestConnectionCommand.php backend/tests/Feature/Omop/TestConnectionCommandTest.php
git commit -m "feat(installer-c): add omop:test-connection artisan command"
```

---

## Task 4: R Plumber CDM schema endpoint + `omop:create-cdm-schema` command

**Files:**
- Modify: `r-runtime/plumber_api.R` — add `/omop/create-cdm-schema` endpoint
- Create: `backend/app/Console/Commands/Omop/CreateCdmSchemaCommand.php`
- Create: `backend/tests/Feature/Omop/CreateCdmSchemaCommandTest.php`

> **Before starting:** Check the R Plumber API port: `docker compose exec r-runtime sh -c "cat /app/plumber_api.R | head -5"` and `docker compose ps r-runtime` to see the published port. Use that port for `R_PLUMBER_URL`.

- [ ] **Step 1: Add endpoint to `r-runtime/plumber_api.R`**

Add this block at the end of the file (before the final `pr_run()` call if present):

```r
#* Create OMOP CDM v5.4 schema on an external database
#* @post /omop/create-cdm-schema
#* @param dialect:[chr] Database dialect (postgresql, sqlserver, oracle, etc.)
#* @param host:[chr] Database host
#* @param port:[int] Database port
#* @param database:[chr] Database name
#* @param username:[chr] Database username
#* @param password:[chr] Database password
#* @param cdm_schema:[chr] Target schema name for CDM tables
#* @serializer json
function(dialect, host, port, database, username, password, cdm_schema) {
  library(DatabaseConnector)
  library(CommonDataModel)

  # Build server string — format varies by dialect
  server <- if (dialect %in% c("sqlserver", "synapse")) {
    paste0(host, ";databaseName=", database)
  } else {
    paste0(host, "/", database)
  }

  connectionDetails <- DatabaseConnector::createConnectionDetails(
    dbms     = dialect,
    server   = server,
    port     = as.integer(port),
    user     = username,
    password = password
  )

  tryCatch({
    CommonDataModel::executeDdl(
      connectionDetails   = connectionDetails,
      cdmVersion          = "5.4",
      cdmDatabaseSchema   = cdm_schema,
      executeDdl          = TRUE,
      executePrimaryKey   = TRUE,
      executeConstraints  = FALSE,
      executeIndices      = FALSE
    )
    list(status = "ok", message = paste("CDM schema created:", cdm_schema))
  }, error = function(e) {
    list(status = "error", message = conditionMessage(e))
  })
}
```

- [ ] **Step 2: Write failing Pest test for the PHP command**

```php
<?php
// backend/tests/Feature/Omop/CreateCdmSchemaCommandTest.php

use Illuminate\Support\Facades\Http;

test('create-cdm-schema calls R Plumber API and succeeds', function () {
    Http::fake([
        '*/omop/create-cdm-schema' => Http::response(
            ['status' => 'ok', 'message' => 'CDM schema created: omop'],
            200
        ),
    ]);

    $this->artisan('omop:create-cdm-schema', [
        '--dialect'    => 'postgresql',
        '--host'       => 'db.example.com',
        '--port'       => '5432',
        '--database'   => 'omop_db',
        '--username'   => 'reader',
        '--password'   => 'secret',
        '--cdm-schema' => 'omop',
    ])->assertExitCode(0);

    Http::assertSentCount(1);
});

test('create-cdm-schema fails when R API returns error', function () {
    Http::fake([
        '*/omop/create-cdm-schema' => Http::response(
            ['status' => 'error', 'message' => 'Connection refused'],
            200
        ),
    ]);

    $this->artisan('omop:create-cdm-schema', [
        '--dialect'    => 'postgresql',
        '--host'       => 'db.example.com',
        '--port'       => '5432',
        '--database'   => 'omop_db',
        '--username'   => 'reader',
        '--password'   => 'secret',
        '--cdm-schema' => 'omop',
    ])->assertExitCode(1);
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Omop/CreateCdmSchemaCommandTest.php --no-ansi 2>&1"
```
Expected: command class not found.

- [ ] **Step 4: Create the PHP command**

```php
<?php
// backend/app/Console/Commands/Omop/CreateCdmSchemaCommand.php

namespace App\Console\Commands\Omop;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class CreateCdmSchemaCommand extends Command
{
    protected $signature = 'omop:create-cdm-schema
        {--dialect=postgresql : Database dialect}
        {--host= : Database host}
        {--port=5432 : Database port}
        {--database= : Database name}
        {--username= : Database username}
        {--password= : Database password}
        {--cdm-schema=omop : Target CDM schema name}';

    protected $description = 'Create OMOP CDM v5.4 schema on an external database via the R runtime';

    public function handle(): int
    {
        $rUrl = rtrim(env('R_PLUMBER_URL', 'http://r-runtime:8004'), '/');

        $this->info("Creating CDM schema '{$this->option('cdm-schema')}' on {$this->option('host')}…");

        $response = Http::timeout(300)->post("{$rUrl}/omop/create-cdm-schema", [
            'dialect'    => $this->option('dialect'),
            'host'       => $this->option('host'),
            'port'       => (int) $this->option('port'),
            'database'   => $this->option('database'),
            'username'   => $this->option('username') ?? '',
            'password'   => $this->option('password') ?? '',
            'cdm_schema' => $this->option('cdm-schema'),
        ]);

        $body = $response->json();

        if (! $response->successful() || ($body['status'] ?? '') === 'error') {
            $this->error('CDM schema creation failed: ' . ($body['message'] ?? $response->body()));
            return self::FAILURE;
        }

        $this->info($body['message'] ?? 'CDM schema created');
        return self::SUCCESS;
    }
}
```

- [ ] **Step 5: Add `R_PLUMBER_URL` to `backend/.env.example`**

Open `backend/.env.example` and add after the existing service URL entries:
```
R_PLUMBER_URL=http://r-runtime:8004
```

- [ ] **Step 6: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Console/Commands/Omop/CreateCdmSchemaCommand.php"
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Omop/CreateCdmSchemaCommandTest.php --no-ansi 2>&1"
```
Expected: 2 tests passing.

- [ ] **Step 8: Commit**

```bash
git add r-runtime/plumber_api.R \
    backend/app/Console/Commands/Omop/CreateCdmSchemaCommand.php \
    backend/tests/Feature/Omop/CreateCdmSchemaCommandTest.php \
    backend/.env.example
git commit -m "feat(installer-c): add omop:create-cdm-schema command and R Plumber endpoint"
```

---

## Task 5: R Plumber results schema endpoint + `omop:create-results-schema` command

**Files:**
- Modify: `r-runtime/plumber_api.R` — add `/omop/create-results-schema` endpoint
- Create: `backend/app/Console/Commands/Omop/CreateResultsSchemaCommand.php`
- Create: `backend/tests/Feature/Omop/CreateResultsSchemaCommandTest.php`

- [ ] **Step 1: Add endpoint to `r-runtime/plumber_api.R`**

```r
#* Create Achilles results data model on an external database
#* @post /omop/create-results-schema
#* @param dialect:[chr] Database dialect
#* @param host:[chr] Database host
#* @param port:[int] Database port
#* @param database:[chr] Database name
#* @param username:[chr] Database username
#* @param password:[chr] Database password
#* @param results_schema:[chr] Target schema name for Achilles results tables
#* @serializer json
function(dialect, host, port, database, username, password, results_schema) {
  library(DatabaseConnector)
  library(Achilles)

  server <- if (dialect %in% c("sqlserver", "synapse")) {
    paste0(host, ";databaseName=", database)
  } else {
    paste0(host, "/", database)
  }

  connectionDetails <- DatabaseConnector::createConnectionDetails(
    dbms     = dialect,
    server   = server,
    port     = as.integer(port),
    user     = username,
    password = password
  )

  tryCatch({
    conn <- DatabaseConnector::connect(connectionDetails)
    on.exit(DatabaseConnector::disconnect(conn))

    Achilles::createResultsDataModel(
      connection            = conn,
      resultsDatabaseSchema = results_schema
    )
    list(status = "ok", message = paste("Results schema created:", results_schema))
  }, error = function(e) {
    list(status = "error", message = conditionMessage(e))
  })
}
```

- [ ] **Step 2: Write failing Pest test**

```php
<?php
// backend/tests/Feature/Omop/CreateResultsSchemaCommandTest.php

use Illuminate\Support\Facades\Http;

test('create-results-schema calls R Plumber API and succeeds', function () {
    Http::fake([
        '*/omop/create-results-schema' => Http::response(
            ['status' => 'ok', 'message' => 'Results schema created: results'],
            200
        ),
    ]);

    $this->artisan('omop:create-results-schema', [
        '--dialect'        => 'postgresql',
        '--host'           => 'db.example.com',
        '--port'           => '5432',
        '--database'       => 'omop_db',
        '--username'       => 'reader',
        '--password'       => 'secret',
        '--results-schema' => 'results',
    ])->assertExitCode(0);
});

test('create-results-schema fails when R API returns error', function () {
    Http::fake([
        '*/omop/create-results-schema' => Http::response(
            ['status' => 'error', 'message' => 'schema already exists'],
            200
        ),
    ]);

    $this->artisan('omop:create-results-schema', [
        '--dialect'        => 'postgresql',
        '--host'           => 'db.example.com',
        '--port'           => '5432',
        '--database'       => 'omop_db',
        '--username'       => 'reader',
        '--password'       => 'secret',
        '--results-schema' => 'results',
    ])->assertExitCode(1);
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Omop/CreateResultsSchemaCommandTest.php --no-ansi 2>&1"
```

- [ ] **Step 4: Create the PHP command**

```php
<?php
// backend/app/Console/Commands/Omop/CreateResultsSchemaCommand.php

namespace App\Console\Commands\Omop;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class CreateResultsSchemaCommand extends Command
{
    protected $signature = 'omop:create-results-schema
        {--dialect=postgresql : Database dialect}
        {--host= : Database host}
        {--port=5432 : Database port}
        {--database= : Database name}
        {--username= : Database username}
        {--password= : Database password}
        {--results-schema=results : Target results schema name}';

    protected $description = 'Create Achilles results data model on an external database via the R runtime';

    public function handle(): int
    {
        $rUrl = rtrim(env('R_PLUMBER_URL', 'http://r-runtime:8004'), '/');

        $this->info("Creating results schema '{$this->option('results-schema')}' on {$this->option('host')}…");

        $response = Http::timeout(120)->post("{$rUrl}/omop/create-results-schema", [
            'dialect'        => $this->option('dialect'),
            'host'           => $this->option('host'),
            'port'           => (int) $this->option('port'),
            'database'       => $this->option('database'),
            'username'       => $this->option('username') ?? '',
            'password'       => $this->option('password') ?? '',
            'results_schema' => $this->option('results-schema'),
        ]);

        $body = $response->json();

        if (! $response->successful() || ($body['status'] ?? '') === 'error') {
            $this->error('Results schema creation failed: ' . ($body['message'] ?? $response->body()));
            return self::FAILURE;
        }

        $this->info($body['message'] ?? 'Results schema created');
        return self::SUCCESS;
    }
}
```

- [ ] **Step 5: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Console/Commands/Omop/CreateResultsSchemaCommand.php"
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Omop/CreateResultsSchemaCommandTest.php --no-ansi 2>&1"
```
Expected: 2 tests passing.

- [ ] **Step 7: Commit**

```bash
git add r-runtime/plumber_api.R \
    backend/app/Console/Commands/Omop/CreateResultsSchemaCommand.php \
    backend/tests/Feature/Omop/CreateResultsSchemaCommandTest.php
git commit -m "feat(installer-c): add omop:create-results-schema command and R Plumber endpoint"
```

---

## Task 6: `omop:load-vocabulary` artisan command

**Files:**
- Create: `backend/app/Console/Commands/Omop/LoadVocabularyCommand.php`
- Create: `backend/tests/Feature/Omop/LoadVocabularyCommandTest.php`

This command loads an Athena vocabulary ZIP into a specific schema on an external database. It uses the existing vocabulary import service but targets the external source's connection.

- [ ] **Step 1: Write failing Pest test**

```php
<?php
// backend/tests/Feature/Omop/LoadVocabularyCommandTest.php

use App\Models\App\Source;
use App\Models\App\SourceDaimon;

uses(\Illuminate\Foundation\Testing\RefreshDatabase::class);

test('load-vocabulary fails when source not found', function () {
    $this->artisan('omop:load-vocabulary', [
        '--source-key' => 'NONEXISTENT',
        '--zip'        => '/tmp/vocab.zip',
    ])->assertExitCode(1);
});

test('load-vocabulary fails when zip not found', function () {
    Source::create([
        'source_key'        => 'EXT_VOCAB_TEST',
        'source_name'       => 'Vocab Test',
        'source_dialect'    => 'postgresql',
        'source_connection' => 'dynamic',
        'db_host'           => 'db.example.com',
        'db_port'           => 5432,
        'db_database'       => 'omop_db',
        'is_cache_enabled'  => false,
    ]);

    $this->artisan('omop:load-vocabulary', [
        '--source-key' => 'EXT_VOCAB_TEST',
        '--zip'        => '/nonexistent/vocab.zip',
    ])->assertExitCode(1);
});

test('load-vocabulary requires source-key and zip', function () {
    $this->artisan('omop:load-vocabulary')->assertExitCode(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Omop/LoadVocabularyCommandTest.php --no-ansi 2>&1"
```

- [ ] **Step 3: Create the command**

```php
<?php
// backend/app/Console/Commands/Omop/LoadVocabularyCommand.php

namespace App\Console\Commands\Omop;

use App\Models\App\Source;
use App\Models\App\SourceDaimon;
use App\Enums\DaimonType;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class LoadVocabularyCommand extends Command
{
    protected $signature = 'omop:load-vocabulary
        {--source-key= : Registered source key}
        {--zip= : Path to Athena vocabulary ZIP file}';

    protected $description = 'Load Athena OMOP vocabulary ZIP into an external source\'s vocabulary schema';

    public function handle(): int
    {
        $key = $this->option('source-key');
        $zip = $this->option('zip');

        if (! $key || ! $zip) {
            $this->error('--source-key and --zip are required');
            return self::FAILURE;
        }

        $source = Source::where('source_key', $key)->first();
        if (! $source) {
            $this->error("Source '{$key}' not found.");
            return self::FAILURE;
        }

        if (! file_exists($zip)) {
            $this->error("ZIP file not found: {$zip}");
            return self::FAILURE;
        }

        $vocabDaimon = SourceDaimon::where('source_id', $source->id)
            ->where('daimon_type', DaimonType::Vocabulary->value)
            ->first();

        $vocabSchema = $vocabDaimon?->table_qualifier ?? 'vocab';

        $this->info("Loading vocabulary from {$zip} into {$source->db_host}/{$source->db_database}.{$vocabSchema}…");

        // Delegate to the existing vocabulary import service via artisan
        // The vocabulary:import command loads into the default omop connection.
        // For external sources, we pass connection details via env override.
        $exitCode = $this->call('vocabulary:import', [
            '--zip'        => $zip,
            '--connection' => 'dynamic',
            '--schema'     => $vocabSchema,
        ]);

        if ($exitCode !== 0) {
            $this->error('Vocabulary import failed.');
            return self::FAILURE;
        }

        $this->info('Vocabulary loaded successfully.');
        return self::SUCCESS;
    }
}
```

> **Note for implementer:** The `vocabulary:import` command may not support `--connection` and `--schema` flags yet. Check `backend/app/Console/Commands/Vocabulary/` (or search `artisan vocabulary:import` to find the command class). If those flags do not exist, extend the existing command to accept them, following the same pattern used for `CreateCdmSchemaCommand` — or call the VocabularyImportService directly from this command.

- [ ] **Step 4: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Console/Commands/Omop/LoadVocabularyCommand.php"
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Omop/LoadVocabularyCommandTest.php --no-ansi 2>&1"
```
Expected: 3 tests passing.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Console/Commands/Omop/LoadVocabularyCommand.php \
    backend/tests/Feature/Omop/LoadVocabularyCommandTest.php
git commit -m "feat(installer-c): add omop:load-vocabulary artisan command"
```

---

## Task 7: Complete `omop_cdm` phase — run() and check() implementations

**Files:**
- Modify: `installer/engine/phases/omop_cdm.py` — replace all `pass` stubs with real implementations
- Modify: `installer/tests/test_omop_cdm_phase.py` — add run() tests

All `exec_php` calls follow the `check=False` + exit code check pattern from `datasets.py`.

- [ ] **Step 1: Add run() + check() unit tests for non-mode-3 paths**

Add this class to `installer/tests/test_omop_cdm_phase.py`:

```python
class TestCheckFunctions:
    """check() returns False when the step is genuinely pending (mode 1/2)."""

    def test_register_source_false_when_no_source(self, tmp_path):
        """check_register_source returns False by default for mode 1 (will query DB via exec_php)."""
        # The real check() calls exec_php; we verify it returns False when exec_php
        # reports the source does not exist.
        ctx = _ctx({"cdm_setup_mode": MODE1, "cdm_database": "test_db"}, tmp_path)
        with patch("installer.engine.phases.omop_cdm.utils.exec_php") as mock:
            mock.return_value = MagicMock(stdout="0", returncode=0)
            from installer.engine.phases.omop_cdm import _check_register_source
            assert _check_register_source(ctx) is False

    def test_register_source_true_when_source_exists(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE1, "cdm_database": "test_db"}, tmp_path)
        with patch("installer.engine.phases.omop_cdm.utils.exec_php") as mock:
            mock.return_value = MagicMock(stdout="1", returncode=0)
            from installer.engine.phases.omop_cdm import _check_register_source
            assert _check_register_source(ctx) is True

    def test_create_results_schema_false_when_table_missing(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE1, "cdm_database": "db"}, tmp_path)
        with patch("installer.engine.phases.omop_cdm.utils.exec_php") as mock:
            mock.return_value = MagicMock(stdout="0", returncode=0)
            from installer.engine.phases.omop_cdm import _check_create_results_schema
            assert _check_create_results_schema(ctx) is False

    def test_run_achilles_true_when_results_exist(self, tmp_path):
        ctx = _ctx({"cdm_setup_mode": MODE1, "cdm_database": "db", "run_achilles": True}, tmp_path)
        with patch("installer.engine.phases.omop_cdm.utils.exec_php") as mock:
            mock.return_value = MagicMock(stdout="1000", returncode=0)
            from installer.engine.phases.omop_cdm import _check_run_achilles
            assert _check_run_achilles(ctx) is True
```

- [ ] **Step 2: Run new tests to verify they fail (stubs don't query exec_php yet)**

```bash
python -m pytest installer/tests/test_omop_cdm_phase.py::TestCheckFunctions -v
```

- [ ] **Step 3: Replace stub implementations in `omop_cdm.py`**

Replace the entire content of `installer/engine/phases/omop_cdm.py` with:

```python
# installer/engine/phases/omop_cdm.py
from __future__ import annotations

import re

from ..exceptions import StepError
from ..registry import Context, Phase, Step
from installer import utils

ROOT = utils.REPO_ROOT
MODE_LOCAL = "Create local PostgreSQL OMOP database"


def _ext_source_key(resolved: dict) -> str:
    raw = f"EXT_{resolved.get('cdm_database', 'CDM').upper()}"
    return re.sub(r"[^A-Z0-9_]", "_", raw)[:32]


def _is_local(ctx: Context) -> bool:
    return ctx.config.get("resolved", {}).get("cdm_setup_mode") == MODE_LOCAL


def _resolved(ctx: Context) -> dict:
    return ctx.config.get("resolved", {})


# ── test_connection ────────────────────────────────────────────────────────────

def _check_test_connection(ctx: Context) -> bool:
    return _is_local(ctx)  # always re-runs for external CDMs


def _run_test_connection(ctx: Context) -> None:
    r = _resolved(ctx)
    key = _ext_source_key(r)
    dialect = r.get("cdm_dialect", "postgresql")
    pdо_dialects = {"postgresql", "sqlserver", "synapse", "mysql"}
    if dialect not in pdо_dialects:
        ctx.emit(f"Dialect '{dialect}' uses R runtime path — skipping PHP connection test")
        return
    ctx.emit(f"Testing connection to {r.get('cdm_server')}/{r.get('cdm_database')}…")
    result = utils.exec_php(
        f"php artisan omop:test-connection"
        f" --source-key={key}"
        f" --dialect={dialect}"
        f" --host={r.get('cdm_server', '')}"
        f" --port={r.get('cdm_port', 5432)}"
        f" --database={r.get('cdm_database', '')}"
        f" --username={r.get('cdm_user', '')}"
        f" --password={r.get('cdm_password', '')}"
        f" --no-ansi 2>&1",
        check=False,
    )
    if result.returncode != 0:
        raise StepError(f"Connection test failed:\n{result.stdout}")
    ctx.emit("External CDM connection verified")


# ── create_cdm_schema ──────────────────────────────────────────────────────────

def _check_create_cdm_schema(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    r = _resolved(ctx)
    if r.get("cdm_existing_state") in ("Tables exist", "Vocab loaded", "Complete"):
        return True
    # Query person table existence on external DB via registered source
    key = _ext_source_key(r)
    result = utils.exec_php(
        f"php artisan tinker --execute=\""
        f"$src = App\\\\Models\\\\App\\\\Source::where('source_key','{key}')->first();"
        f"echo $src ? 1 : 0;"
        f"\" --no-ansi 2>&1",
        check=False,
    )
    # Source not yet registered — CDM schema definitely not created
    if result.stdout.strip() != "1":
        return False
    return False  # always re-check; DDL creation is safe to re-run (idempotent in CommonDataModel)


def _run_create_cdm_schema(ctx: Context) -> None:
    r = _resolved(ctx)
    ctx.emit(f"Creating OMOP CDM v5.4 schema '{r.get('cdm_schema', 'omop')}' on {r.get('cdm_server')}…")
    result = utils.exec_php(
        f"php artisan omop:create-cdm-schema"
        f" --dialect={r.get('cdm_dialect', 'postgresql')}"
        f" --host={r.get('cdm_server', '')}"
        f" --port={r.get('cdm_port', 5432)}"
        f" --database={r.get('cdm_database', '')}"
        f" --username={r.get('cdm_user', '')}"
        f" --password={r.get('cdm_password', '')}"
        f" --cdm-schema={r.get('cdm_schema', 'omop')}"
        f" --no-ansi 2>&1",
        check=False,
    )
    if result.returncode != 0:
        raise StepError(f"CDM schema creation failed:\n{result.stdout}")
    ctx.emit("OMOP CDM schema created")


# ── register_source ────────────────────────────────────────────────────────────

def _check_register_source(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    r = _resolved(ctx)
    key = _ext_source_key(r)
    result = utils.exec_php(
        f"php artisan tinker --execute=\""
        f"echo App\\\\Models\\\\App\\\\Source::where('source_key','{key}')"
        f"->whereNull('deleted_at')->count();"
        f"\" --no-ansi 2>&1",
        check=False,
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_register_source(ctx: Context) -> None:
    r = _resolved(ctx)
    key = _ext_source_key(r)
    name = f"External CDM ({r.get('cdm_database', key)})"
    ctx.emit(f"Registering source '{key}'…")
    result = utils.exec_php(
        f"php artisan omop:register-source"
        f" --source-key={key}"
        f" --name='{name}'"
        f" --dialect={r.get('cdm_dialect', 'postgresql')}"
        f" --host={r.get('cdm_server', '')}"
        f" --port={r.get('cdm_port', 5432)}"
        f" --database={r.get('cdm_database', '')}"
        f" --username={r.get('cdm_user', '')}"
        f" --password={r.get('cdm_password', '')}"
        f" --cdm-schema={r.get('cdm_schema', 'omop')}"
        f" --vocab-schema={r.get('vocabulary_schema', 'vocab')}"
        f" --results-schema={r.get('results_schema', 'results')}"
        f" --no-ansi 2>&1",
        check=False,
    )
    if result.returncode != 0:
        raise StepError(f"Source registration failed:\n{result.stdout}")
    ctx.emit(f"Source '{key}' registered")


# ── load_vocabulary ────────────────────────────────────────────────────────────

def _check_load_vocabulary(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    r = _resolved(ctx)
    if r.get("vocabulary_setup") == "Use existing vocabulary":
        return True
    if not r.get("vocab_zip_path"):
        return True
    # Check concept count in external DB via tinker would require dynamic connection.
    # Conservative: always re-run if zip is configured (vocab import is idempotent via TRUNCATE+INSERT).
    return False


def _run_load_vocabulary(ctx: Context) -> None:
    r = _resolved(ctx)
    key = _ext_source_key(r)
    zip_path = r.get("vocab_zip_path", "")
    ctx.emit(f"Loading vocabulary from {zip_path}…")
    result = utils.exec_php(
        f"php artisan omop:load-vocabulary"
        f" --source-key={key}"
        f" --zip={zip_path}"
        f" --no-ansi 2>&1",
        check=False,
    )
    if result.returncode != 0:
        raise StepError(f"Vocabulary load failed:\n{result.stdout}")
    ctx.emit("Vocabulary loaded")


# ── create_results_schema ──────────────────────────────────────────────────────

def _check_create_results_schema(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    r = _resolved(ctx)
    key = _ext_source_key(r)
    results_schema = r.get("results_schema", "results")
    # Check achilles_results table via tinker
    result = utils.exec_php(
        f"php artisan tinker --execute=\""
        f"try {{ $n = DB::connection('dynamic')->select("
        f"\\\"SELECT COUNT(*) AS c FROM information_schema.tables "
        f"WHERE table_schema='{results_schema}' AND table_name='achilles_results'\\\""
        f")[0]->c ?? 0; echo $n; }} catch(\\\\Exception $e) {{ echo 0; }}"
        f"\" --no-ansi 2>&1",
        check=False,
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_create_results_schema(ctx: Context) -> None:
    r = _resolved(ctx)
    ctx.emit(f"Creating Achilles results schema '{r.get('results_schema', 'results')}'…")
    result = utils.exec_php(
        f"php artisan omop:create-results-schema"
        f" --dialect={r.get('cdm_dialect', 'postgresql')}"
        f" --host={r.get('cdm_server', '')}"
        f" --port={r.get('cdm_port', 5432)}"
        f" --database={r.get('cdm_database', '')}"
        f" --username={r.get('cdm_user', '')}"
        f" --password={r.get('cdm_password', '')}"
        f" --results-schema={r.get('results_schema', 'results')}"
        f" --no-ansi 2>&1",
        check=False,
    )
    if result.returncode != 0:
        raise StepError(f"Results schema creation failed:\n{result.stdout}")
    ctx.emit("Results schema created")


# ── run_achilles ───────────────────────────────────────────────────────────────

def _check_run_achilles(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    r = _resolved(ctx)
    if not r.get("run_achilles", True):
        return True
    key = _ext_source_key(r)
    results_schema = r.get("results_schema", "results")
    result = utils.exec_php(
        f"php artisan tinker --execute=\""
        f"try {{ echo DB::connection('dynamic')->table('{results_schema}.achilles_results')->count(); }}"
        f" catch(\\\\Exception $e) {{ echo 0; }}"
        f"\" --no-ansi 2>&1",
        check=False,
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_run_achilles(ctx: Context) -> None:
    r = _resolved(ctx)
    key = _ext_source_key(r)
    ctx.emit("Looking up source ID for Achilles run…")
    id_result = utils.exec_php(
        f"php artisan tinker --execute=\""
        f"echo App\\\\Models\\\\App\\\\Source::where('source_key','{key}')->value('id') ?? 'not_found';"
        f"\" --no-ansi 2>&1",
        check=False,
    )
    source_id = id_result.stdout.strip()
    if not source_id or source_id == "not_found":
        raise StepError(f"Source '{key}' not found — register_source must complete first")
    ctx.emit(f"Running Achilles on source {source_id} (this may take several minutes)…")
    result = utils.exec_php(
        f"php artisan parthenon:run-achilles {source_id} --sync --no-ansi 2>&1",
        check=False,
    )
    if result.returncode != 0:
        raise StepError(f"Achilles failed:\n{result.stdout}")
    ctx.emit("Achilles characterization complete")


# ── run_dqd ───────────────────────────────────────────────────────────────────

def _check_run_dqd(ctx: Context) -> bool:
    if _is_local(ctx):
        return True
    r = _resolved(ctx)
    if not r.get("run_dqd", True):
        return True
    key = _ext_source_key(r)
    result = utils.exec_php(
        f"php artisan tinker --execute=\""
        f"$src = App\\\\Models\\\\App\\\\Source::where('source_key','{key}')->first();"
        f"echo $src ? App\\\\Models\\\\App\\\\DqdResult::where('source_id',$src->id)->count() : 0;"
        f"\" --no-ansi 2>&1",
        check=False,
    )
    try:
        return int(result.stdout.strip()) > 0
    except ValueError:
        return False


def _run_run_dqd(ctx: Context) -> None:
    r = _resolved(ctx)
    key = _ext_source_key(r)
    id_result = utils.exec_php(
        f"php artisan tinker --execute=\""
        f"echo App\\\\Models\\\\App\\\\Source::where('source_key','{key}')->value('id') ?? 'not_found';"
        f"\" --no-ansi 2>&1",
        check=False,
    )
    source_id = id_result.stdout.strip()
    if not source_id or source_id == "not_found":
        raise StepError(f"Source '{key}' not found — register_source must complete first")
    ctx.emit(f"Running DQD on source {source_id} (this may take several minutes)…")
    result = utils.exec_php(
        f"php artisan parthenon:run-dqd {source_id} --sync --no-ansi 2>&1",
        check=False,
    )
    if result.returncode != 0:
        raise StepError(f"DQD failed:\n{result.stdout}")
    ctx.emit("DQD assessment complete")


# ── Phase registration ─────────────────────────────────────────────────────────

PHASE = Phase(
    id="omop_cdm",
    name="External OMOP CDM Setup",
    steps=[
        Step(id="omop_cdm.test_connection",      name="Test external CDM connection",
             run=_run_test_connection,      check=_check_test_connection),
        Step(id="omop_cdm.create_cdm_schema",    name="Create OMOP CDM schema",
             run=_run_create_cdm_schema,    check=_check_create_cdm_schema),
        Step(id="omop_cdm.register_source",      name="Register external CDM as source",
             run=_run_register_source,      check=_check_register_source),
        Step(id="omop_cdm.load_vocabulary",      name="Load OMOP vocabulary into external DB",
             run=_run_load_vocabulary,      check=_check_load_vocabulary),
        Step(id="omop_cdm.create_results_schema", name="Create Achilles results schema",
             run=_run_create_results_schema, check=_check_create_results_schema),
        Step(id="omop_cdm.run_achilles",         name="Run Achilles characterization",
             run=_run_run_achilles,         check=_check_run_achilles),
        Step(id="omop_cdm.run_dqd",              name="Run Data Quality Dashboard",
             run=_run_run_dqd,              check=_check_run_dqd),
    ],
)
```

- [ ] **Step 4: Run all phase unit tests**

```bash
python -m pytest installer/tests/test_omop_cdm_phase.py -v
```
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add installer/engine/phases/omop_cdm.py installer/tests/test_omop_cdm_phase.py
git commit -m "feat(installer-c): complete omop_cdm phase run/check implementations"
```

---

## Task 8: Register phase + contract tests + integration test

**Files:**
- Modify: `installer/engine/phases/__init__.py`
- Modify: `installer/tests/test_engine_contract.py`
- Modify: `installer/tests/test_engine_integration.py`

- [ ] **Step 1: Write failing contract tests**

Add to `installer/tests/test_engine_contract.py`:

```python
def test_omop_cdm_phase_registered():
    from installer.engine.phases import DEFAULT_REGISTRY
    phase_ids = [p.id for p in DEFAULT_REGISTRY.phases()]
    assert "omop_cdm" in phase_ids


def test_omop_cdm_appears_after_datasets_before_frontend():
    from installer.engine.phases import DEFAULT_REGISTRY
    ids = [p.id for p in DEFAULT_REGISTRY.phases()]
    assert ids.index("omop_cdm") > ids.index("datasets")
    assert ids.index("omop_cdm") < ids.index("frontend")


def test_omop_cdm_has_7_steps():
    from installer.engine.phases import DEFAULT_REGISTRY
    phases = {p.id: p for p in DEFAULT_REGISTRY.phases()}
    assert len(phases["omop_cdm"].steps) == 7


def test_resume_param_present():
    """Regression: resume param must be present in cli.run() signature."""
    import inspect
    from installer import cli
    sig = inspect.signature(cli.run)
    assert "resume" in sig.parameters
```

- [ ] **Step 2: Run contract tests to verify failure**

```bash
python -m pytest installer/tests/test_engine_contract.py::test_omop_cdm_phase_registered -v
```
Expected: `AssertionError: assert 'omop_cdm' in [...]`

- [ ] **Step 3: Register the phase in `__init__.py`**

```python
# installer/engine/phases/__init__.py
from __future__ import annotations

from ..registry import PhaseRegistry
from .preflight import PHASE as PREFLIGHT
from .config import PHASE as CONFIG
from .hecate import PHASE as HECATE
from .docker import PHASE as DOCKER
from .bootstrap import PHASE as BOOTSTRAP
from .datasets import PHASE as DATASETS
from .omop_cdm import PHASE as OMOP_CDM
from .frontend import PHASE as FRONTEND
from .solr import PHASE as SOLR
from .admin import PHASE as ADMIN

DEFAULT_REGISTRY = PhaseRegistry()
for phase in (PREFLIGHT, CONFIG, HECATE, DOCKER, BOOTSTRAP, DATASETS, OMOP_CDM, FRONTEND, SOLR, ADMIN):
    DEFAULT_REGISTRY.register(phase)
```

- [ ] **Step 4: Write failing integration test**

Add to `installer/tests/test_engine_integration.py`:

```python
def test_omop_cdm_phase_is_noop_for_local_mode(tmp_path: Path):
    """All omop_cdm steps emit step_skip when cdm_setup_mode is local."""
    from installer.engine.phases.omop_cdm import PHASE as OMOP_CDM_PHASE

    reg = PhaseRegistry()
    reg.register(OMOP_CDM_PHASE)

    config = {"resolved": {"cdm_setup_mode": "Create local PostgreSQL OMOP database"}}
    out = io.StringIO()
    store = CheckpointStore(tmp_path / ".state.json")
    runner = StepRunner(reg, store, config=config,
                        secrets=SecretManager(tmp_path / "s"), output=out)
    runner.run()

    events = [json.loads(line) for line in out.getvalue().splitlines() if line.strip()]
    step_starts = [e for e in events if e["type"] == "step_start"]
    skip_events = [e for e in events if e["type"] == "step_skip"]

    assert step_starts == [], "No steps should run in local mode"
    assert len(skip_events) == len(OMOP_CDM_PHASE.steps), \
        f"Expected {len(OMOP_CDM_PHASE.steps)} skips, got {len(skip_events)}"
```

- [ ] **Step 5: Run all installer tests**

```bash
python -m pytest installer/tests/ -v
```
Expected: all tests pass. Total should be 85+ tests.

- [ ] **Step 6: Run PHP tests to confirm nothing broke**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Omop/ --no-ansi 2>&1"
```
Expected: all 9 Omop feature tests passing.

- [ ] **Step 7: Commit**

```bash
git add installer/engine/phases/__init__.py \
    installer/tests/test_engine_contract.py \
    installer/tests/test_engine_integration.py
git commit -m "feat(installer-c): register omop_cdm phase, add contract and integration tests"
```

---

## Self-Review Checklist

After writing this plan, verify spec coverage:

| Spec requirement | Task |
|---|---|
| Mode 3 no-op guard on all steps | Task 1 |
| `test_connection` step | Task 3 + Task 7 |
| `create_cdm_schema` step | Task 4 + Task 7 |
| `register_source` step | Task 2 + Task 7 |
| `load_vocabulary` step | Task 6 + Task 7 |
| `create_results_schema` step | Task 5 + Task 7 |
| `run_achilles` step (opt-in) | Task 7 |
| `run_dqd` step (opt-in) | Task 7 |
| `_ext_source_key()` utility | Task 1 |
| R Plumber CDM schema endpoint | Task 4 |
| R Plumber results schema endpoint | Task 5 |
| Phase registered after datasets, before frontend | Task 8 |
| Contract tests | Task 8 |
| Integration test (mode 3) | Task 8 |
| PHP: `omop:register-source` | Task 2 |
| PHP: `omop:test-connection` | Task 3 |
| PHP: `omop:create-cdm-schema` | Task 4 |
| PHP: `omop:create-results-schema` | Task 5 |
| PHP: `omop:load-vocabulary` | Task 6 |
| `R_PLUMBER_URL` env var in `.env.example` | Task 4 |

All spec requirements covered. ✓
