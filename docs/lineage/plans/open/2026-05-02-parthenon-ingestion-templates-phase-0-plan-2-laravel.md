# Parthenon Ingestion Templates — Phase 0, Plan 2: Laravel Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Laravel-side persistence, controllers, services, jobs, and migrations so that `/api/v1/ingestion/templates/*` endpoints work end-to-end against the Python `parthenon-templates` service from Plan 1. Submitting a template run creates the right DB rows, dispatches the polling job, and returns 201. Tested via Pest with mocked Python.

**Architecture:** Standard Laravel layered: routes → controllers → form requests → services → models → migrations. New Sanctum-auth'd routes nested under `/api/v1/ingestion/`, reusing `permission:ingestion.{view,run,delete}` middleware. Python service called via Guzzle through `TemplateRegistryClient` with `X-Parthenon-Internal-Token` header. Run state synced via `PollTemplateRunJob` on Horizon.

**Tech Stack:** Laravel 11, PHP 8.4, Sanctum auth, Spatie permissions, Horizon queues, Eloquent ORM, Guzzle, Pest test runner. PHPStan level 8 strict. Pint formatting via Docker (`docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`).

**Depends on:** Plan 1 (Foundations — Python service must respond on `http://parthenon-templates:8000`).

**Unblocks:** Plan 3 (Frontend), Plan 4 (Templates).

---

## Pre-flight verification (perform once before Task 1)

- [ ] **Verify existing permissions** (`ingestion.view`, `ingestion.run`, `ingestion.delete`) are already seeded — these are reused, not added.

Run: `cd /home/smudoshi/Github/Parthenon && grep -nE "ingestion\.(view|run|delete)" backend/database/seeders/RolePermissionSeeder.php`
Expected: at least one match each for `ingestion.view`, `ingestion.run`, `ingestion.delete` on lines around 161/183.

- [ ] **Verify the existing `// Ingestion` block in `routes/api.php`** sits around line 229–271 and is followed by an `// Ingestion Projects (multi-file)` block around line 273.

Run: `cd /home/smudoshi/Github/Parthenon && sed -n '229,275p' backend/routes/api.php`
Expected: visual inspection — block matches the spec.

- [ ] **Verify `parthenon-templates:8000` is the canonical service hostname** (Plan 1 owns the compose entry; this plan only consumes it).

Run: `cd /home/smudoshi/Github/Parthenon && grep -n "parthenon-templates" docker-compose.yml || echo "Plan 1 has not yet landed the service entry"`
Expected: either a match (Plan 1 is in) OR the literal string above (then this plan's tests use Guzzle MockHandler and don't need a live container).

---

## Task 1: Migration — `app.template_runs` table

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/backend/database/migrations/2026_05_02_100000_create_template_runs_table.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TemplateRunsSchemaTest extends TestCase
{
    use RefreshDatabase;

    public function test_template_runs_table_exists_with_required_columns(): void
    {
        $columns = DB::select("
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'app' AND table_name = 'template_runs'
            ORDER BY ordinal_position
        ");

        $names = array_map(fn ($c) => $c->column_name, $columns);

        $this->assertContains('id', $names);
        $this->assertContains('template_id', $names);
        $this->assertContains('template_version', $names);
        $this->assertContains('parameters', $names);
        $this->assertContains('status', $names);
        $this->assertContains('progress', $names);
        $this->assertContains('current_node', $names);
        $this->assertContains('prefect_run_id', $names);
        $this->assertContains('error_message', $names);
        $this->assertContains('post_conditions', $names);
        $this->assertContains('artifacts_path', $names);
        $this->assertContains('submitted_by', $names);
        $this->assertContains('submitted_at', $names);
        $this->assertContains('started_at', $names);
        $this->assertContains('finished_at', $names);
        $this->assertContains('correlation_id', $names);
        $this->assertContains('created_at', $names);
        $this->assertContains('updated_at', $names);
    }

    public function test_status_check_constraint_rejects_invalid_status(): void
    {
        $this->expectException(\Illuminate\Database\QueryException::class);

        DB::table('app.template_runs')->insert([
            'template_id' => 'hello_cdm',
            'template_version' => '0.1.0',
            'parameters' => json_encode([]),
            'status' => 'not_a_valid_status',
            'submitted_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_progress_check_constraint_rejects_out_of_range(): void
    {
        $this->expectException(\Illuminate\Database\QueryException::class);

        DB::table('app.template_runs')->insert([
            'template_id' => 'hello_cdm',
            'template_version' => '0.1.0',
            'parameters' => json_encode([]),
            'status' => 'pending',
            'progress' => 1.5,
            'submitted_by' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_indexes_exist(): void
    {
        $indexes = collect(DB::select("
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'app' AND tablename = 'template_runs'
        "))->pluck('indexname')->all();

        $this->assertContains('idx_template_runs_template_id', $indexes);
        $this->assertContains('idx_template_runs_status', $indexes);
        $this->assertContains('idx_template_runs_submitted_by', $indexes);
        $this->assertContains('idx_template_runs_submitted_at', $indexes);
    }
}
```

Save to: `/home/smudoshi/Github/Parthenon/backend/tests/Feature/Templates/TemplateRunsSchemaTest.php`

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/TemplateRunsSchemaTest.php"`
Expected: FAIL with `SQLSTATE[42P01]: Undefined table: 7 ERROR: relation "app.template_runs" does not exist`

- [ ] **Step 3: Write minimal implementation**

```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            CREATE TABLE app.template_runs (
                id              BIGSERIAL PRIMARY KEY,
                template_id     VARCHAR(128) NOT NULL,
                template_version VARCHAR(32) NOT NULL,
                parameters      JSONB NOT NULL,
                status          VARCHAR(32) NOT NULL
                                CHECK (status IN ('pending','queued','running','completed','failed','cancelled')),
                progress        REAL NOT NULL DEFAULT 0.0
                                CHECK (progress >= 0 AND progress <= 1),
                current_node    VARCHAR(128),
                prefect_run_id  UUID,
                error_message   TEXT,
                post_conditions JSONB,
                artifacts_path  TEXT,
                submitted_by    BIGINT NOT NULL REFERENCES app.users(id),
                submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                started_at      TIMESTAMPTZ,
                finished_at     TIMESTAMPTZ,
                correlation_id  UUID NOT NULL DEFAULT gen_random_uuid(),
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        SQL);

        DB::statement('CREATE INDEX idx_template_runs_template_id   ON app.template_runs (template_id)');
        DB::statement('CREATE INDEX idx_template_runs_status        ON app.template_runs (status)');
        DB::statement('CREATE INDEX idx_template_runs_submitted_by  ON app.template_runs (submitted_by)');
        DB::statement('CREATE INDEX idx_template_runs_submitted_at  ON app.template_runs (submitted_at DESC)');
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.template_runs');
    }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/TemplateRunsSchemaTest.php"`
Expected: PASS — 4 tests, all green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint database/migrations/2026_05_02_100000_create_template_runs_table.php tests/Feature/Templates/TemplateRunsSchemaTest.php && vendor/bin/phpstan analyse database/migrations/2026_05_02_100000_create_template_runs_table.php tests/Feature/Templates/TemplateRunsSchemaTest.php"`
Expected: no issues; `[OK] No errors`.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/database/migrations/2026_05_02_100000_create_template_runs_table.php backend/tests/Feature/Templates/TemplateRunsSchemaTest.php
git commit -m "feat(templates): add app.template_runs migration with check constraints and indexes"
```

---

## Task 2: Migration — alter `app.ingestion_jobs`

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/backend/database/migrations/2026_05_02_100100_add_template_run_id_to_ingestion_jobs.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class IngestionJobsTemplateColumnsTest extends TestCase
{
    use RefreshDatabase;

    public function test_ingestion_jobs_has_template_run_id_and_kind_columns(): void
    {
        $columns = collect(DB::select("
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'app' AND table_name = 'ingestion_jobs'
              AND column_name IN ('template_run_id','kind')
        "))->keyBy('column_name');

        $this->assertTrue($columns->has('template_run_id'));
        $this->assertSame('YES', $columns['template_run_id']->is_nullable);
        $this->assertTrue($columns->has('kind'));
        $this->assertSame('NO', $columns['kind']->is_nullable);
        $this->assertStringContainsString("'upload'", (string) $columns['kind']->column_default);
    }

    public function test_kind_check_constraint_rejects_invalid(): void
    {
        $this->expectException(\Illuminate\Database\QueryException::class);

        DB::table('app.ingestion_jobs')->insert([
            'kind' => 'unknown_kind',
            'status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_indexes_exist(): void
    {
        $indexes = collect(DB::select("
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'app' AND tablename = 'ingestion_jobs'
        "))->pluck('indexname')->all();

        $this->assertContains('idx_ingestion_jobs_kind', $indexes);
        $this->assertContains('idx_ingestion_jobs_template_run_id', $indexes);
    }
}
```

Save to: `/home/smudoshi/Github/Parthenon/backend/tests/Feature/Templates/IngestionJobsTemplateColumnsTest.php`

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/IngestionJobsTemplateColumnsTest.php"`
Expected: FAIL — `assertTrue(false)` for `template_run_id` / `kind` not found, OR no kind/template_run_id rows returned.

- [ ] **Step 3: Write minimal implementation**

```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement(<<<'SQL'
            ALTER TABLE app.ingestion_jobs
                ADD COLUMN template_run_id BIGINT NULL
                    REFERENCES app.template_runs(id) ON DELETE SET NULL,
                ADD COLUMN kind VARCHAR(32) NOT NULL DEFAULT 'upload'
                    CHECK (kind IN ('upload','fhir','template'))
        SQL);

        DB::statement('CREATE INDEX idx_ingestion_jobs_kind            ON app.ingestion_jobs (kind)');
        DB::statement('CREATE INDEX idx_ingestion_jobs_template_run_id ON app.ingestion_jobs (template_run_id)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS app.idx_ingestion_jobs_template_run_id');
        DB::statement('DROP INDEX IF EXISTS app.idx_ingestion_jobs_kind');
        DB::statement('ALTER TABLE app.ingestion_jobs DROP COLUMN IF EXISTS kind');
        DB::statement('ALTER TABLE app.ingestion_jobs DROP COLUMN IF EXISTS template_run_id');
    }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/IngestionJobsTemplateColumnsTest.php"`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint database/migrations/2026_05_02_100100_add_template_run_id_to_ingestion_jobs.php tests/Feature/Templates/IngestionJobsTemplateColumnsTest.php && vendor/bin/phpstan analyse database/migrations/2026_05_02_100100_add_template_run_id_to_ingestion_jobs.php tests/Feature/Templates/IngestionJobsTemplateColumnsTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/database/migrations/2026_05_02_100100_add_template_run_id_to_ingestion_jobs.php backend/tests/Feature/Templates/IngestionJobsTemplateColumnsTest.php
git commit -m "feat(templates): add template_run_id and kind to ingestion_jobs with FK and check constraints"
```

---

## Task 3: `TemplateRun` Eloquent model

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/backend/app/Models/App/TemplateRun.php`
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Unit/Templates/TemplateRunModelTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Models\App\IngestionJob;
use App\Models\App\TemplateRun;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TemplateRunModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_status_constants_match_check_constraint(): void
    {
        $this->assertSame('pending',   TemplateRun::STATUS_PENDING);
        $this->assertSame('queued',    TemplateRun::STATUS_QUEUED);
        $this->assertSame('running',   TemplateRun::STATUS_RUNNING);
        $this->assertSame('completed', TemplateRun::STATUS_COMPLETED);
        $this->assertSame('failed',    TemplateRun::STATUS_FAILED);
        $this->assertSame('cancelled', TemplateRun::STATUS_CANCELLED);
    }

    public function test_fillable_whitelist_is_set(): void
    {
        $run = new TemplateRun();
        $expected = [
            'template_id',
            'template_version',
            'parameters',
            'status',
            'progress',
            'current_node',
            'prefect_run_id',
            'error_message',
            'post_conditions',
            'artifacts_path',
            'submitted_by',
            'submitted_at',
            'started_at',
            'finished_at',
            'correlation_id',
        ];
        $this->assertSame($expected, $run->getFillable());
    }

    public function test_casts_parameters_and_post_conditions_as_arrays(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm',
            'template_version' => '0.1.0',
            'parameters' => ['target_schema' => 'eunomia'],
            'status' => TemplateRun::STATUS_PENDING,
            'post_conditions' => [['kind' => 'row_count', 'status' => 'pending']],
            'submitted_by' => $user->id,
        ]);

        $fresh = TemplateRun::find($run->id);
        $this->assertIsArray($fresh->parameters);
        $this->assertSame('eunomia', $fresh->parameters['target_schema']);
        $this->assertIsArray($fresh->post_conditions);
        $this->assertSame('row_count', $fresh->post_conditions[0]['kind']);
    }

    public function test_submitted_by_relationship_returns_user(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm',
            'template_version' => '0.1.0',
            'parameters' => [],
            'status' => TemplateRun::STATUS_PENDING,
            'submitted_by' => $user->id,
        ]);
        $this->assertTrue($run->submittedBy->is($user));
    }

    public function test_ingestion_jobs_relationship(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm',
            'template_version' => '0.1.0',
            'parameters' => [],
            'status' => TemplateRun::STATUS_PENDING,
            'submitted_by' => $user->id,
        ]);
        IngestionJob::create([
            'kind' => 'template',
            'status' => 'pending',
            'template_run_id' => $run->id,
            'created_by' => $user->id,
        ]);

        $this->assertCount(1, $run->ingestionJobs);
        $this->assertSame('template', $run->ingestionJobs->first()->kind);
    }

    public function test_scope_non_terminal_excludes_terminal_states(): void
    {
        $user = User::factory()->create();
        TemplateRun::create([
            'template_id' => 't', 'template_version' => '1', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
        ]);
        TemplateRun::create([
            'template_id' => 't', 'template_version' => '1', 'parameters' => [],
            'status' => TemplateRun::STATUS_COMPLETED, 'submitted_by' => $user->id,
        ]);
        TemplateRun::create([
            'template_id' => 't', 'template_version' => '1', 'parameters' => [],
            'status' => TemplateRun::STATUS_FAILED, 'submitted_by' => $user->id,
        ]);

        $this->assertSame(1, TemplateRun::nonTerminal()->count());
    }

    public function test_scope_for_template_filters_by_id_and_version(): void
    {
        $user = User::factory()->create();
        TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_PENDING, 'submitted_by' => $user->id,
        ]);
        TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.2.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_PENDING, 'submitted_by' => $user->id,
        ]);
        TemplateRun::create([
            'template_id' => 'nodes_test', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_PENDING, 'submitted_by' => $user->id,
        ]);

        $this->assertSame(1, TemplateRun::forTemplate('hello_cdm', '0.1.0')->count());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRunModelTest.php"`
Expected: FAIL with `Class "App\Models\App\TemplateRun" not found`.

- [ ] **Step 3: Write minimal implementation**

```php
<?php

declare(strict_types=1);

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TemplateRun extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_QUEUED = 'queued';

    public const STATUS_RUNNING = 'running';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    public const STATUS_CANCELLED = 'cancelled';

    /** @var array<int,string> */
    public const TERMINAL_STATUSES = [
        self::STATUS_COMPLETED,
        self::STATUS_FAILED,
        self::STATUS_CANCELLED,
    ];

    protected $connection = 'pgsql';

    protected $table = 'template_runs';

    /** @var array<int,string> */
    protected $fillable = [
        'template_id',
        'template_version',
        'parameters',
        'status',
        'progress',
        'current_node',
        'prefect_run_id',
        'error_message',
        'post_conditions',
        'artifacts_path',
        'submitted_by',
        'submitted_at',
        'started_at',
        'finished_at',
        'correlation_id',
    ];

    /**
     * @return array<string,string>
     */
    protected function casts(): array
    {
        return [
            'parameters' => 'array',
            'post_conditions' => 'array',
            'progress' => 'float',
            'submitted_at' => 'datetime',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'correlation_id' => 'string',
            'prefect_run_id' => 'string',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    /**
     * @return HasMany<IngestionJob, $this>
     */
    public function ingestionJobs(): HasMany
    {
        return $this->hasMany(IngestionJob::class, 'template_run_id');
    }

    /**
     * @param  Builder<TemplateRun>  $query
     * @return Builder<TemplateRun>
     */
    public function scopeNonTerminal(Builder $query): Builder
    {
        return $query->whereNotIn('status', self::TERMINAL_STATUSES);
    }

    /**
     * @param  Builder<TemplateRun>  $query
     * @return Builder<TemplateRun>
     */
    public function scopeForTemplate(Builder $query, string $templateId, string $version): Builder
    {
        return $query->where('template_id', $templateId)->where('template_version', $version);
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, self::TERMINAL_STATUSES, true);
    }
}
```

Also add `template_run_id` and `kind` to `IngestionJob::$fillable`. Edit `/home/smudoshi/Github/Parthenon/backend/app/Models/App/IngestionJob.php` lines 13–25 and append two strings to the `$fillable` array.

```php
    protected $fillable = [
        'source_id',
        'ingestion_project_id',
        'status',
        'current_step',
        'progress_percentage',
        'config_json',
        'started_at',
        'completed_at',
        'stats_json',
        'error_message',
        'created_by',
        'staging_table_name',
        'template_run_id',
        'kind',
    ];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRunModelTest.php"`
Expected: PASS — 7 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Models/App/TemplateRun.php app/Models/App/IngestionJob.php tests/Unit/Templates/TemplateRunModelTest.php && vendor/bin/phpstan analyse app/Models/App/TemplateRun.php app/Models/App/IngestionJob.php tests/Unit/Templates/TemplateRunModelTest.php"`
Expected: no issues at level 8.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Models/App/TemplateRun.php backend/app/Models/App/IngestionJob.php backend/tests/Unit/Templates/TemplateRunModelTest.php
git commit -m "feat(templates): add TemplateRun model with fillable, casts, scopes, status constants"
```

---

## Task 4: Custom exception `TemplateRegistryException`

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/backend/app/Exceptions/Templates/TemplateRegistryException.php`
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Unit/Templates/TemplateRegistryExceptionTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Exceptions\Templates\TemplateRegistryException;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Psr7\Request;
use PHPUnit\Framework\TestCase;

class TemplateRegistryExceptionTest extends TestCase
{
    public function test_from_status_captures_status_and_body(): void
    {
        $e = TemplateRegistryException::fromStatus(503, 'service down', 'GET /templates');
        $this->assertSame(503, $e->getStatusCode());
        $this->assertSame('service down', $e->getResponseBody());
        $this->assertStringContainsString('GET /templates', $e->getMessage());
    }

    public function test_from_connect_returns_zero_status(): void
    {
        $inner = new ConnectException('connect timed out', new Request('GET', '/templates'));
        $e = TemplateRegistryException::fromConnect($inner, 'GET /templates');
        $this->assertSame(0, $e->getStatusCode());
        $this->assertStringContainsString('connect', $e->getMessage());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRegistryExceptionTest.php"`
Expected: FAIL with `Class "App\Exceptions\Templates\TemplateRegistryException" not found`.

- [ ] **Step 3: Write minimal implementation**

```php
<?php

declare(strict_types=1);

namespace App\Exceptions\Templates;

use GuzzleHttp\Exception\ConnectException;
use RuntimeException;
use Throwable;

class TemplateRegistryException extends RuntimeException
{
    public function __construct(
        string $message,
        private readonly int $statusCode = 0,
        private readonly ?string $responseBody = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct($message, $statusCode, $previous);
    }

    public static function fromStatus(int $status, string $body, string $context): self
    {
        return new self(
            sprintf('Template registry HTTP %d on %s: %s', $status, $context, $body),
            $status,
            $body,
        );
    }

    public static function fromConnect(ConnectException $e, string $context): self
    {
        return new self(
            sprintf('Template registry connect error on %s: %s', $context, $e->getMessage()),
            0,
            null,
            $e,
        );
    }

    public function getStatusCode(): int
    {
        return $this->statusCode;
    }

    public function getResponseBody(): ?string
    {
        return $this->responseBody;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRegistryExceptionTest.php"`
Expected: PASS — 2 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Exceptions/Templates tests/Unit/Templates/TemplateRegistryExceptionTest.php && vendor/bin/phpstan analyse app/Exceptions/Templates tests/Unit/Templates/TemplateRegistryExceptionTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Exceptions/Templates/TemplateRegistryException.php backend/tests/Unit/Templates/TemplateRegistryExceptionTest.php
git commit -m "feat(templates): add TemplateRegistryException for HTTP and connect failures"
```

---

## Task 5: `config/services.php` and `.env.example` for templates service

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/backend/config/services.php`
- Modify: `/home/smudoshi/Github/Parthenon/backend/.env.example`
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Unit/Templates/TemplatesConfigTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use Tests\TestCase;

class TemplatesConfigTest extends TestCase
{
    public function test_templates_service_url_has_default(): void
    {
        $this->assertSame('http://parthenon-templates:8000', config('services.templates.url'));
    }

    public function test_templates_internal_token_is_readable(): void
    {
        config(['services.templates.internal_token' => 'test-token-123']);
        $this->assertSame('test-token-123', config('services.templates.internal_token'));
    }

    public function test_templates_timeout_default(): void
    {
        $this->assertSame(5, config('services.templates.timeout'));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplatesConfigTest.php"`
Expected: FAIL — `expected 'http://parthenon-templates:8000', actual null`.

- [ ] **Step 3: Write minimal implementation**

Append the following block to `/home/smudoshi/Github/Parthenon/backend/config/services.php`, immediately before the final closing `];`:

```php
    'templates' => [
        'url' => env('TEMPLATES_SERVICE_URL', 'http://parthenon-templates:8000'),
        'internal_token' => env('TEMPLATES_INTERNAL_TOKEN'),
        'timeout' => (int) env('TEMPLATES_SERVICE_TIMEOUT', 5),
    ],
```

Append to `/home/smudoshi/Github/Parthenon/backend/.env.example`:

```
# Parthenon Templates service (Phase 0 ingestion templates)
TEMPLATES_SERVICE_URL=http://parthenon-templates:8000
TEMPLATES_INTERNAL_TOKEN=
TEMPLATES_SERVICE_TIMEOUT=5
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplatesConfigTest.php"`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint config/services.php tests/Unit/Templates/TemplatesConfigTest.php && vendor/bin/phpstan analyse config/services.php tests/Unit/Templates/TemplatesConfigTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/config/services.php backend/.env.example backend/tests/Unit/Templates/TemplatesConfigTest.php
git commit -m "feat(templates): add services.templates config (url, internal_token, timeout) and .env.example entries"
```

---

## Task 6: `TemplateRegistryClient` — list and get template

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/backend/app/Services/Templates/TemplateRegistryClient.php`
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Unit/Templates/TemplateRegistryClientTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Exceptions\Templates\TemplateRegistryException;
use App\Services\Templates\TemplateRegistryClient;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Request;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\TestCase;

class TemplateRegistryClientTest extends TestCase
{
    /** @var array<int,array<string,mixed>> */
    private array $history = [];

    private function makeClient(MockHandler $mock): TemplateRegistryClient
    {
        $stack = HandlerStack::create($mock);
        $this->history = [];
        $stack->push(Middleware::history($this->history));

        return new TemplateRegistryClient(
            new Client(['handler' => $stack, 'base_uri' => 'http://parthenon-templates:8000', 'timeout' => 5]),
            'secret-token',
        );
    }

    public function test_list_templates_returns_decoded_payload(): void
    {
        $payload = [['id' => 'hello_cdm', 'version' => '0.1.0', 'name' => 'Hello CDM']];
        $client = $this->makeClient(new MockHandler([
            new Response(200, ['Content-Type' => 'application/json'], (string) json_encode($payload)),
        ]));

        $this->assertSame($payload, $client->listTemplates());
        /** @var Request $req */
        $req = $this->history[0]['request'];
        $this->assertSame('GET', $req->getMethod());
        $this->assertSame('/templates', $req->getUri()->getPath());
        $this->assertSame('secret-token', $req->getHeaderLine('X-Parthenon-Internal-Token'));
    }

    public function test_get_template_returns_decoded_payload(): void
    {
        $payload = ['id' => 'hello_cdm', 'manifest' => ['name' => 'Hello CDM']];
        $client = $this->makeClient(new MockHandler([
            new Response(200, ['Content-Type' => 'application/json'], (string) json_encode($payload)),
        ]));

        $this->assertSame($payload, $client->getTemplate('hello_cdm'));
        /** @var Request $req */
        $req = $this->history[0]['request'];
        $this->assertSame('/templates/hello_cdm', $req->getUri()->getPath());
    }

    public function test_list_templates_throws_on_500(): void
    {
        $client = $this->makeClient(new MockHandler([
            new Response(500, [], 'kaboom'),
        ]));

        $this->expectException(TemplateRegistryException::class);
        $client->listTemplates();
    }

    public function test_list_templates_throws_on_connect_error(): void
    {
        $req = new Request('GET', '/templates');
        $client = $this->makeClient(new MockHandler([
            new \GuzzleHttp\Exception\ConnectException('connection refused', $req),
        ]));

        $this->expectException(TemplateRegistryException::class);
        $client->listTemplates();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRegistryClientTest.php"`
Expected: FAIL — `Class "App\Services\Templates\TemplateRegistryClient" not found`.

- [ ] **Step 3: Write minimal implementation**

```php
<?php

declare(strict_types=1);

namespace App\Services\Templates;

use App\Exceptions\Templates\TemplateRegistryException;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use Psr\Http\Message\ResponseInterface;

class TemplateRegistryClient
{
    public function __construct(
        private readonly Client $http,
        private readonly string $internalToken,
    ) {}

    /**
     * @return array<int,array<string,mixed>>
     */
    public function listTemplates(): array
    {
        /** @var array<int,array<string,mixed>> $decoded */
        $decoded = $this->json('GET', '/templates');

        return $decoded;
    }

    /**
     * @return array<string,mixed>
     */
    public function getTemplate(string $id): array
    {
        /** @var array<string,mixed> $decoded */
        $decoded = $this->json('GET', sprintf('/templates/%s', $id));

        return $decoded;
    }

    /**
     * @return array<int|string,mixed>
     */
    protected function json(string $method, string $path, array $options = []): array
    {
        $context = sprintf('%s %s', $method, $path);

        try {
            $response = $this->http->request($method, $path, array_merge_recursive(
                ['headers' => ['X-Parthenon-Internal-Token' => $this->internalToken, 'Accept' => 'application/json']],
                $options,
            ));
        } catch (ConnectException $e) {
            throw TemplateRegistryException::fromConnect($e, $context);
        } catch (RequestException $e) {
            throw $this->mapRequestException($e, $context);
        } catch (GuzzleException $e) {
            throw new TemplateRegistryException(sprintf('Template registry transport error on %s: %s', $context, $e->getMessage()), 0, null, $e);
        }

        return $this->decode($response, $context);
    }

    protected function mapRequestException(RequestException $e, string $context): TemplateRegistryException
    {
        $response = $e->getResponse();
        if ($response instanceof ResponseInterface) {
            return TemplateRegistryException::fromStatus(
                $response->getStatusCode(),
                (string) $response->getBody(),
                $context,
            );
        }

        return new TemplateRegistryException(sprintf('Template registry request error on %s: %s', $context, $e->getMessage()), 0, null, $e);
    }

    /**
     * @return array<int|string,mixed>
     */
    protected function decode(ResponseInterface $response, string $context): array
    {
        $body = (string) $response->getBody();
        if ($response->getStatusCode() >= 400) {
            throw TemplateRegistryException::fromStatus($response->getStatusCode(), $body, $context);
        }

        /** @var mixed $decoded */
        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            throw new TemplateRegistryException(sprintf('Template registry returned non-JSON on %s', $context), $response->getStatusCode(), $body);
        }

        return $decoded;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRegistryClientTest.php"`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/Templates tests/Unit/Templates/TemplateRegistryClientTest.php && vendor/bin/phpstan analyse app/Services/Templates tests/Unit/Templates/TemplateRegistryClientTest.php"`
Expected: no issues at level 8.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Services/Templates/TemplateRegistryClient.php backend/tests/Unit/Templates/TemplateRegistryClientTest.php
git commit -m "feat(templates): TemplateRegistryClient listTemplates/getTemplate with auth header and exception mapping"
```

---

## Task 7: `TemplateRegistryClient` — submit run

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/backend/app/Services/Templates/TemplateRegistryClient.php`
- Modify: `/home/smudoshi/Github/Parthenon/backend/tests/Unit/Templates/TemplateRegistryClientTest.php`

- [ ] **Step 1: Write the failing test**

Append to `TemplateRegistryClientTest.php`:

```php
    public function test_submit_run_posts_payload_and_returns_response(): void
    {
        $payload = ['prefect_run_id' => '11111111-1111-1111-1111-111111111111', 'manifest' => ['singleton' => true]];
        $client = $this->makeClient(new MockHandler([
            new Response(200, ['Content-Type' => 'application/json'], (string) json_encode($payload)),
        ]));

        $result = $client->submitRun(
            'hello_cdm',
            '0.1.0',
            ['target_schema' => 'eunomia'],
            '99999999-9999-9999-9999-999999999999',
        );

        $this->assertSame($payload, $result);
        /** @var Request $req */
        $req = $this->history[0]['request'];
        $this->assertSame('POST', $req->getMethod());
        $this->assertSame('/runs', $req->getUri()->getPath());
        /** @var array<string,mixed> $body */
        $body = json_decode((string) $req->getBody(), true);
        $this->assertSame('hello_cdm', $body['template_id']);
        $this->assertSame('0.1.0', $body['version']);
        $this->assertSame(['target_schema' => 'eunomia'], $body['parameters']);
        $this->assertSame('99999999-9999-9999-9999-999999999999', $body['correlation_id']);
    }

    public function test_submit_run_throws_on_422(): void
    {
        $client = $this->makeClient(new MockHandler([
            new Response(422, [], json_encode(['detail' => 'parameter X required']) ?: ''),
        ]));

        $this->expectException(TemplateRegistryException::class);
        $client->submitRun('hello_cdm', '0.1.0', [], 'corr');
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRegistryClientTest.php"`
Expected: FAIL — `Method "submitRun" does not exist`.

- [ ] **Step 3: Write minimal implementation**

Add to `TemplateRegistryClient`:

```php
    /**
     * @param  array<string,mixed>  $parameters
     * @return array<string,mixed>
     */
    public function submitRun(string $templateId, string $version, array $parameters, string $correlationId): array
    {
        /** @var array<string,mixed> $decoded */
        $decoded = $this->json('POST', '/runs', [
            'json' => [
                'template_id' => $templateId,
                'version' => $version,
                'parameters' => $parameters,
                'correlation_id' => $correlationId,
            ],
        ]);

        return $decoded;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRegistryClientTest.php"`
Expected: PASS — 6 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/Templates tests/Unit/Templates/TemplateRegistryClientTest.php && vendor/bin/phpstan analyse app/Services/Templates tests/Unit/Templates/TemplateRegistryClientTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Services/Templates/TemplateRegistryClient.php backend/tests/Unit/Templates/TemplateRegistryClientTest.php
git commit -m "feat(templates): TemplateRegistryClient::submitRun POSTs to /runs with correlation_id"
```

---

## Task 8: `TemplateRegistryClient` — getRun, getLogs, getArtifacts, cancelRun

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/backend/app/Services/Templates/TemplateRegistryClient.php`
- Modify: `/home/smudoshi/Github/Parthenon/backend/tests/Unit/Templates/TemplateRegistryClientTest.php`

- [ ] **Step 1: Write the failing test**

Append to `TemplateRegistryClientTest.php`:

```php
    public function test_get_run_returns_status_payload(): void
    {
        $payload = ['status' => 'running', 'progress' => 0.4, 'current_node' => 'load_csv'];
        $client = $this->makeClient(new MockHandler([
            new Response(200, ['Content-Type' => 'application/json'], (string) json_encode($payload)),
        ]));

        $this->assertSame($payload, $client->getRun('abc-123'));
        /** @var Request $req */
        $req = $this->history[0]['request'];
        $this->assertSame('/runs/abc-123', $req->getUri()->getPath());
    }

    public function test_get_logs_returns_log_lines(): void
    {
        $payload = ['lines' => [['ts' => '2026-05-02T00:00:00Z', 'level' => 'info', 'message' => 'started']]];
        $client = $this->makeClient(new MockHandler([
            new Response(200, ['Content-Type' => 'application/json'], (string) json_encode($payload)),
        ]));

        $this->assertSame($payload, $client->getLogs('abc-123'));
        $this->assertSame('/runs/abc-123/logs', $this->history[0]['request']->getUri()->getPath());
    }

    public function test_get_artifacts_returns_artifact_list(): void
    {
        $payload = ['artifacts' => [['name' => 'summary.json', 'size' => 1024]]];
        $client = $this->makeClient(new MockHandler([
            new Response(200, ['Content-Type' => 'application/json'], (string) json_encode($payload)),
        ]));

        $this->assertSame($payload, $client->getArtifacts('abc-123'));
        $this->assertSame('/runs/abc-123/artifacts', $this->history[0]['request']->getUri()->getPath());
    }

    public function test_cancel_run_issues_delete(): void
    {
        $payload = ['status' => 'cancelled'];
        $client = $this->makeClient(new MockHandler([
            new Response(200, ['Content-Type' => 'application/json'], (string) json_encode($payload)),
        ]));

        $this->assertSame($payload, $client->cancelRun('abc-123'));
        /** @var Request $req */
        $req = $this->history[0]['request'];
        $this->assertSame('DELETE', $req->getMethod());
        $this->assertSame('/runs/abc-123', $req->getUri()->getPath());
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRegistryClientTest.php"`
Expected: FAIL — `Method "getRun" does not exist` (or first missing of the four).

- [ ] **Step 3: Write minimal implementation**

Add to `TemplateRegistryClient`:

```php
    /**
     * @return array<string,mixed>
     */
    public function getRun(string $prefectRunId): array
    {
        /** @var array<string,mixed> $decoded */
        $decoded = $this->json('GET', sprintf('/runs/%s', $prefectRunId));

        return $decoded;
    }

    /**
     * @return array<string,mixed>
     */
    public function getLogs(string $prefectRunId): array
    {
        /** @var array<string,mixed> $decoded */
        $decoded = $this->json('GET', sprintf('/runs/%s/logs', $prefectRunId));

        return $decoded;
    }

    /**
     * @return array<string,mixed>
     */
    public function getArtifacts(string $prefectRunId): array
    {
        /** @var array<string,mixed> $decoded */
        $decoded = $this->json('GET', sprintf('/runs/%s/artifacts', $prefectRunId));

        return $decoded;
    }

    /**
     * @return array<string,mixed>
     */
    public function cancelRun(string $prefectRunId): array
    {
        /** @var array<string,mixed> $decoded */
        $decoded = $this->json('DELETE', sprintf('/runs/%s', $prefectRunId));

        return $decoded;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRegistryClientTest.php"`
Expected: PASS — 10 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/Templates tests/Unit/Templates/TemplateRegistryClientTest.php && vendor/bin/phpstan analyse app/Services/Templates tests/Unit/Templates/TemplateRegistryClientTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Services/Templates/TemplateRegistryClient.php backend/tests/Unit/Templates/TemplateRegistryClientTest.php
git commit -m "feat(templates): TemplateRegistryClient run lifecycle (getRun, getLogs, getArtifacts, cancelRun)"
```

---

## Task 9: Service container binding for `TemplateRegistryClient`

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/backend/app/Providers/TemplatesServiceProvider.php`
- Modify: `/home/smudoshi/Github/Parthenon/backend/bootstrap/providers.php`
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Feature/Templates/TemplatesServiceBindingTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Services\Templates\TemplateRegistryClient;
use Tests\TestCase;

class TemplatesServiceBindingTest extends TestCase
{
    public function test_container_resolves_template_registry_client(): void
    {
        config([
            'services.templates.url' => 'http://parthenon-templates:8000',
            'services.templates.internal_token' => 'test-token',
            'services.templates.timeout' => 5,
        ]);

        $client = $this->app->make(TemplateRegistryClient::class);
        $this->assertInstanceOf(TemplateRegistryClient::class, $client);
    }

    public function test_missing_internal_token_throws_clear_error(): void
    {
        config(['services.templates.internal_token' => null]);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessageMatches('/TEMPLATES_INTERNAL_TOKEN/');

        $this->app->make(TemplateRegistryClient::class);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/TemplatesServiceBindingTest.php"`
Expected: FAIL — `Target class [App\Services\Templates\TemplateRegistryClient] does not exist` or container resolution fails on missing constructor args.

- [ ] **Step 3: Write minimal implementation**

```php
<?php

declare(strict_types=1);

namespace App\Providers;

use App\Services\Templates\TemplateRegistryClient;
use GuzzleHttp\Client;
use Illuminate\Support\ServiceProvider;
use RuntimeException;

class TemplatesServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(TemplateRegistryClient::class, function ($app): TemplateRegistryClient {
            $config = (array) $app['config']->get('services.templates', []);
            $token = $config['internal_token'] ?? null;
            if (!is_string($token) || $token === '') {
                throw new RuntimeException('TEMPLATES_INTERNAL_TOKEN is required to use TemplateRegistryClient.');
            }
            $url = is_string($config['url'] ?? null) ? $config['url'] : 'http://parthenon-templates:8000';
            $timeout = (int) ($config['timeout'] ?? 5);

            $http = new Client([
                'base_uri' => rtrim($url, '/').'/',
                'timeout' => $timeout,
                'connect_timeout' => $timeout,
            ]);

            return new TemplateRegistryClient($http, $token);
        });
    }
}
```

Append `App\Providers\TemplatesServiceProvider::class,` to the array in `/home/smudoshi/Github/Parthenon/backend/bootstrap/providers.php` (preserving existing entries).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/TemplatesServiceBindingTest.php"`
Expected: PASS — 2 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Providers/TemplatesServiceProvider.php bootstrap/providers.php tests/Feature/Templates/TemplatesServiceBindingTest.php && vendor/bin/phpstan analyse app/Providers/TemplatesServiceProvider.php bootstrap/providers.php tests/Feature/Templates/TemplatesServiceBindingTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Providers/TemplatesServiceProvider.php backend/bootstrap/providers.php backend/tests/Feature/Templates/TemplatesServiceBindingTest.php
git commit -m "feat(templates): bind TemplateRegistryClient in container with internal-token guard"
```

---

## Task 10: `SubmitTemplateRunRequest` form request

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/backend/app/Http/Requests/SubmitTemplateRunRequest.php`
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Unit/Templates/SubmitTemplateRunRequestTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Http\Requests\SubmitTemplateRunRequest;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class SubmitTemplateRunRequestTest extends TestCase
{
    public function test_valid_payload_passes(): void
    {
        $rules = (new SubmitTemplateRunRequest())->rules();
        $v = Validator::make(['version' => '0.1.0', 'parameters' => ['target_schema' => 'eunomia']], $rules);
        $this->assertFalse($v->fails(), implode(';', $v->errors()->all()));
    }

    public function test_missing_version_fails(): void
    {
        $rules = (new SubmitTemplateRunRequest())->rules();
        $v = Validator::make(['parameters' => []], $rules);
        $this->assertTrue($v->fails());
        $this->assertArrayHasKey('version', $v->errors()->toArray());
    }

    public function test_invalid_semver_fails(): void
    {
        $rules = (new SubmitTemplateRunRequest())->rules();
        $v = Validator::make(['version' => 'not-semver', 'parameters' => []], $rules);
        $this->assertTrue($v->fails());
        $this->assertArrayHasKey('version', $v->errors()->toArray());
    }

    public function test_parameters_must_be_array(): void
    {
        $rules = (new SubmitTemplateRunRequest())->rules();
        $v = Validator::make(['version' => '0.1.0', 'parameters' => 'not-an-array'], $rules);
        $this->assertTrue($v->fails());
        $this->assertArrayHasKey('parameters', $v->errors()->toArray());
    }

    public function test_parameters_optional_default_empty(): void
    {
        $rules = (new SubmitTemplateRunRequest())->rules();
        $v = Validator::make(['version' => '0.1.0'], $rules);
        $this->assertFalse($v->fails());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/SubmitTemplateRunRequestTest.php"`
Expected: FAIL — `Class "App\Http\Requests\SubmitTemplateRunRequest" not found`.

- [ ] **Step 3: Write minimal implementation**

```php
<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SubmitTemplateRunRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string,array<int,string>|string>
     */
    public function rules(): array
    {
        return [
            'version' => ['required', 'string', 'regex:/^\d+\.\d+\.\d+(?:[-+].+)?$/'],
            'parameters' => ['sometimes', 'array'],
        ];
    }

    /**
     * @return array<string,mixed>
     */
    public function validatedParameters(): array
    {
        $params = $this->validated()['parameters'] ?? [];

        return is_array($params) ? $params : [];
    }

    public function validatedVersion(): string
    {
        return (string) $this->validated()['version'];
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/SubmitTemplateRunRequestTest.php"`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Http/Requests/SubmitTemplateRunRequest.php tests/Unit/Templates/SubmitTemplateRunRequestTest.php && vendor/bin/phpstan analyse app/Http/Requests/SubmitTemplateRunRequest.php tests/Unit/Templates/SubmitTemplateRunRequestTest.php"`
Expected: no issues at level 8.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Http/Requests/SubmitTemplateRunRequest.php backend/tests/Unit/Templates/SubmitTemplateRunRequestTest.php
git commit -m "feat(templates): SubmitTemplateRunRequest layer-1 validation (version semver, parameters array)"
```

---

## Task 11: `TemplateRunService::submit` happy path + transaction wrapper

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/backend/app/Services/Templates/TemplateRunService.php`
- Create: `/home/smudoshi/Github/Parthenon/backend/app/Jobs/Templates/PollTemplateRunJob.php` (stub for dispatch reference; full body lands in Task 14)
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Unit/Templates/TemplateRunServiceSubmitTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Exceptions\Templates\TemplateRegistryException;
use App\Jobs\Templates\PollTemplateRunJob;
use App\Models\App\IngestionJob;
use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use App\Services\Templates\TemplateRunService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Mockery;
use Tests\TestCase;

class TemplateRunServiceSubmitTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_submit_creates_template_run_and_dispatches_job(): void
    {
        Queue::fake();
        $user = User::factory()->create();

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')
            ->with('hello_cdm')
            ->andReturn(['id' => 'hello_cdm', 'manifest' => ['singleton' => false, 'meta' => ['emits_cdm' => false]]]);
        $registry->shouldReceive('submitRun')
            ->andReturn(['prefect_run_id' => '11111111-1111-1111-1111-111111111111']);

        /** @var TemplateRunService $service */
        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);

        $run = $service->submit('hello_cdm', '0.1.0', ['target_schema' => 'eunomia'], $user);

        $this->assertInstanceOf(TemplateRun::class, $run);
        $this->assertSame(TemplateRun::STATUS_QUEUED, $run->status);
        $this->assertSame('11111111-1111-1111-1111-111111111111', $run->prefect_run_id);
        $this->assertSame($user->id, $run->submitted_by);
        $this->assertSame(['target_schema' => 'eunomia'], $run->parameters);

        Queue::assertPushed(PollTemplateRunJob::class);
    }

    public function test_submit_creates_ingestion_job_when_template_emits_cdm(): void
    {
        Queue::fake();
        $user = User::factory()->create();

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')->andReturn([
            'id' => 'load_synpuf',
            'manifest' => ['singleton' => false, 'meta' => ['emits_cdm' => true]],
        ]);
        $registry->shouldReceive('submitRun')->andReturn(['prefect_run_id' => '22222222-2222-2222-2222-222222222222']);

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);
        $run = $service->submit('load_synpuf', '0.1.0', [], $user);

        $job = IngestionJob::where('template_run_id', $run->id)->firstOrFail();
        $this->assertSame('template', $job->kind);
    }

    public function test_submit_rolls_back_when_python_fails(): void
    {
        Queue::fake();
        $user = User::factory()->create();

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')->andReturn([
            'id' => 'hello_cdm',
            'manifest' => ['singleton' => false, 'meta' => ['emits_cdm' => false]],
        ]);
        $registry->shouldReceive('submitRun')->andThrow(TemplateRegistryException::fromStatus(503, 'down', 'POST /runs'));

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);

        try {
            $service->submit('hello_cdm', '0.1.0', [], $user);
            $this->fail('Expected TemplateRegistryException');
        } catch (TemplateRegistryException $e) {
            $this->assertSame(0, TemplateRun::count());
            $this->assertSame(0, IngestionJob::where('kind', 'template')->count());
        }

        Queue::assertNothingPushed();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRunServiceSubmitTest.php"`
Expected: FAIL — `Class "App\Services\Templates\TemplateRunService" not found`.

- [ ] **Step 3: Write minimal implementation**

```php
<?php

declare(strict_types=1);

namespace App\Services\Templates;

use App\Exceptions\Templates\TemplateRegistryException;
use App\Jobs\Templates\PollTemplateRunJob;
use App\Models\App\IngestionJob;
use App\Models\App\TemplateRun;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TemplateRunService
{
    public function __construct(private readonly TemplateRegistryClient $registry) {}

    /**
     * @param  array<string,mixed>  $parameters
     */
    public function submit(string $templateId, string $version, array $parameters, User $user): TemplateRun
    {
        $manifest = $this->registry->getTemplate($templateId);
        $manifestBody = $this->extractManifestBody($manifest);
        $singleton = (bool) ($manifestBody['singleton'] ?? false);
        $emitsCdm = (bool) (data_get($manifestBody, 'meta.emits_cdm') ?? false);
        $requiresCdm = (bool) (data_get($manifestBody, 'requires.cdm_initialized') ?? false);

        return DB::transaction(function () use ($templateId, $version, $parameters, $user, $singleton, $emitsCdm, $requiresCdm): TemplateRun {
            if ($singleton) {
                $this->assertNoActiveRun($templateId, $version);
            }

            $correlationId = (string) Str::uuid();
            $run = TemplateRun::create([
                'template_id' => $templateId,
                'template_version' => $version,
                'parameters' => $parameters,
                'status' => TemplateRun::STATUS_PENDING,
                'submitted_by' => $user->id,
                'submitted_at' => now(),
                'correlation_id' => $correlationId,
            ]);

            if ($emitsCdm || $requiresCdm) {
                IngestionJob::create([
                    'kind' => 'template',
                    'template_run_id' => $run->id,
                    'status' => 'pending',
                    'created_by' => $user->id,
                ]);
            }

            try {
                $response = $this->registry->submitRun($templateId, $version, $parameters, $correlationId);
            } catch (TemplateRegistryException $e) {
                throw $e;
            }

            $prefectRunId = (string) ($response['prefect_run_id'] ?? '');
            if ($prefectRunId === '') {
                throw new TemplateRegistryException('Template registry returned empty prefect_run_id', 502);
            }

            $run->update([
                'prefect_run_id' => $prefectRunId,
                'status' => TemplateRun::STATUS_QUEUED,
            ]);

            PollTemplateRunJob::dispatch($run->id)->delay(now()->addSeconds(2));

            return $run->refresh();
        });
    }

    private function assertNoActiveRun(string $templateId, string $version): void
    {
        TemplateRun::query()
            ->forTemplate($templateId, $version)
            ->nonTerminal()
            ->lockForUpdate()
            ->each(function (TemplateRun $existing): void {
                throw new \RuntimeException(sprintf(
                    'Singleton template already running (run_id=%d, status=%s)',
                    $existing->id,
                    $existing->status,
                ));
            });
    }

    /**
     * @param  array<string,mixed>  $payload
     * @return array<string,mixed>
     */
    private function extractManifestBody(array $payload): array
    {
        if (isset($payload['manifest']) && is_array($payload['manifest'])) {
            return $payload['manifest'];
        }

        return $payload;
    }
}
```

Stub `PollTemplateRunJob` so the dispatch resolves; full body lands in Task 14:

```php
<?php

declare(strict_types=1);

namespace App\Jobs\Templates;

use App\Models\App\TemplateRun;
use App\Services\Templates\TemplateRunService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class PollTemplateRunJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(public readonly int $templateRunId) {}

    public function handle(TemplateRunService $service): void
    {
        $run = TemplateRun::find($this->templateRunId);
        if ($run === null) {
            return;
        }
        // Polling logic completed in Task 14.
    }

    /**
     * @return array<int,string>
     */
    public function tags(): array
    {
        return ['templates', 'template_run:'.$this->templateRunId];
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRunServiceSubmitTest.php"`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/Templates/TemplateRunService.php app/Jobs/Templates/PollTemplateRunJob.php tests/Unit/Templates/TemplateRunServiceSubmitTest.php && vendor/bin/phpstan analyse app/Services/Templates/TemplateRunService.php app/Jobs/Templates/PollTemplateRunJob.php tests/Unit/Templates/TemplateRunServiceSubmitTest.php"`
Expected: no issues at level 8.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Services/Templates/TemplateRunService.php backend/app/Jobs/Templates/PollTemplateRunJob.php backend/tests/Unit/Templates/TemplateRunServiceSubmitTest.php
git commit -m "feat(templates): TemplateRunService::submit with CDM IngestionJob and transactional rollback"
```

---

## Task 12: `TemplateRunService::submit` singleton enforcement

**Files:**
- Modify: existing service is already in place — extend tests only.
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Unit/Templates/TemplateRunServiceSingletonTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use App\Services\Templates\TemplateRunService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Mockery;
use RuntimeException;
use Tests\TestCase;

class TemplateRunServiceSingletonTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_singleton_blocks_when_active_run_exists(): void
    {
        Queue::fake();
        $user = User::factory()->create();

        TemplateRun::create([
            'template_id' => 'load_synpuf',
            'template_version' => '0.1.0',
            'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING,
            'submitted_by' => $user->id,
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')->andReturn([
            'id' => 'load_synpuf',
            'manifest' => ['singleton' => true, 'meta' => ['emits_cdm' => true]],
        ]);
        // submitRun must NOT be called.
        $registry->shouldNotReceive('submitRun');

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessageMatches('/Singleton template already running/');
        $service->submit('load_synpuf', '0.1.0', [], $user);
    }

    public function test_singleton_allows_when_prior_run_is_terminal(): void
    {
        Queue::fake();
        $user = User::factory()->create();

        TemplateRun::create([
            'template_id' => 'load_synpuf',
            'template_version' => '0.1.0',
            'parameters' => [],
            'status' => TemplateRun::STATUS_COMPLETED,
            'submitted_by' => $user->id,
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')->andReturn([
            'id' => 'load_synpuf',
            'manifest' => ['singleton' => true, 'meta' => ['emits_cdm' => true]],
        ]);
        $registry->shouldReceive('submitRun')->andReturn(['prefect_run_id' => '33333333-3333-3333-3333-333333333333']);

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);
        $run = $service->submit('load_synpuf', '0.1.0', [], $user);
        $this->assertSame(TemplateRun::STATUS_QUEUED, $run->status);
    }
}
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRunServiceSingletonTest.php"`
Expected: PASS in both cases (the singleton logic was implemented in Task 11 — this task verifies it). If FAIL: revisit `TemplateRunService::assertNoActiveRun` and ensure the `forTemplate` + `nonTerminal` scope chain matches.

- [ ] **Step 3: Write minimal implementation**

No code change; this task is a verification gate. If Step 2 fails, fix `TemplateRunService::assertNoActiveRun` until both tests pass.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRunServiceSingletonTest.php"`
Expected: PASS — 2 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/Templates/TemplateRunService.php tests/Unit/Templates/TemplateRunServiceSingletonTest.php && vendor/bin/phpstan analyse app/Services/Templates/TemplateRunService.php tests/Unit/Templates/TemplateRunServiceSingletonTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/tests/Unit/Templates/TemplateRunServiceSingletonTest.php
git commit -m "test(templates): cover singleton enforcement happy/blocked paths in TemplateRunService"
```

---

## Task 13: `TemplateRunService::pollAndUpdate` and `cancel`

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/backend/app/Services/Templates/TemplateRunService.php`
- Modify: `/home/smudoshi/Github/Parthenon/backend/app/Models/App/IngestionJob.php` (sync helper if needed — covered by adding fillable in Task 3 — no further edit required here)
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Unit/Templates/TemplateRunServicePollTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Unit\Templates;

use App\Models\App\IngestionJob;
use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use App\Services\Templates\TemplateRunService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class TemplateRunServicePollTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_poll_updates_status_and_progress_and_current_node(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_QUEUED, 'submitted_by' => $user->id,
            'prefect_run_id' => '11111111-1111-1111-1111-111111111111',
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getRun')->with('11111111-1111-1111-1111-111111111111')->andReturn([
            'status' => 'running',
            'progress' => 0.42,
            'current_node' => 'load_csv',
            'started_at' => '2026-05-02T01:00:00Z',
        ]);

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);
        $service->pollAndUpdate($run);

        $run->refresh();
        $this->assertSame(TemplateRun::STATUS_RUNNING, $run->status);
        $this->assertEqualsWithDelta(0.42, $run->progress, 0.001);
        $this->assertSame('load_csv', $run->current_node);
    }

    public function test_poll_marks_completed_and_propagates_to_ingestion_job(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'load_synpuf', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
            'prefect_run_id' => '22222222-2222-2222-2222-222222222222',
        ]);
        $job = IngestionJob::create([
            'kind' => 'template', 'status' => 'pending',
            'template_run_id' => $run->id, 'created_by' => $user->id,
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getRun')->andReturn([
            'status' => 'completed',
            'progress' => 1.0,
            'finished_at' => '2026-05-02T01:30:00Z',
            'post_conditions' => [['kind' => 'row_count', 'status' => 'pass']],
        ]);

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);
        $service->pollAndUpdate($run);

        $run->refresh();
        $job->refresh();
        $this->assertSame(TemplateRun::STATUS_COMPLETED, $run->status);
        $this->assertSame('completed', (string) $job->status->value ?? $job->status);
        $this->assertNotEmpty($run->post_conditions);
    }

    public function test_poll_marks_failed_and_captures_error(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
            'prefect_run_id' => '33333333-3333-3333-3333-333333333333',
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getRun')->andReturn([
            'status' => 'failed',
            'progress' => 0.5,
            'error' => 'node csv_reader: file not found',
            'finished_at' => '2026-05-02T01:05:00Z',
        ]);

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);
        $service->pollAndUpdate($run);

        $run->refresh();
        $this->assertSame(TemplateRun::STATUS_FAILED, $run->status);
        $this->assertStringContainsString('csv_reader', (string) $run->error_message);
    }

    public function test_cancel_calls_python_and_marks_cancelled(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
            'prefect_run_id' => '44444444-4444-4444-4444-444444444444',
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('cancelRun')->with('44444444-4444-4444-4444-444444444444')->andReturn(['status' => 'cancelled']);

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);
        $service->cancel($run);

        $this->assertSame(TemplateRun::STATUS_CANCELLED, $run->refresh()->status);
    }

    public function test_cancel_is_noop_for_terminal_run(): void
    {
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_COMPLETED, 'submitted_by' => $user->id,
            'prefect_run_id' => '55555555-5555-5555-5555-555555555555',
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldNotReceive('cancelRun');

        $service = $this->app->makeWith(TemplateRunService::class, ['registry' => $registry]);
        $service->cancel($run);

        $this->assertSame(TemplateRun::STATUS_COMPLETED, $run->refresh()->status);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRunServicePollTest.php"`
Expected: FAIL — `Method "pollAndUpdate" does not exist`.

- [ ] **Step 3: Write minimal implementation**

Append to `TemplateRunService`:

```php
    public function pollAndUpdate(TemplateRun $run): void
    {
        if ($run->isTerminal() || $run->prefect_run_id === null) {
            return;
        }

        $payload = $this->registry->getRun((string) $run->prefect_run_id);
        $newStatus = (string) ($payload['status'] ?? $run->status);
        $update = [
            'status' => $newStatus,
            'progress' => isset($payload['progress']) ? (float) $payload['progress'] : $run->progress,
            'current_node' => $payload['current_node'] ?? $run->current_node,
        ];

        if (isset($payload['started_at']) && $run->started_at === null) {
            $update['started_at'] = $payload['started_at'];
        }
        if (isset($payload['finished_at'])) {
            $update['finished_at'] = $payload['finished_at'];
        }
        if (isset($payload['post_conditions']) && is_array($payload['post_conditions'])) {
            $update['post_conditions'] = $payload['post_conditions'];
        }
        if (isset($payload['error'])) {
            $update['error_message'] = (string) $payload['error'];
        }

        DB::transaction(function () use ($run, $update, $newStatus): void {
            $run->update($update);
            if (in_array($newStatus, TemplateRun::TERMINAL_STATUSES, true)) {
                IngestionJob::query()
                    ->where('template_run_id', $run->id)
                    ->each(fn (IngestionJob $job) => $job->update(['status' => $newStatus]));
            }
        });
    }

    public function cancel(TemplateRun $run): void
    {
        if ($run->isTerminal()) {
            return;
        }
        if ($run->prefect_run_id !== null) {
            $this->registry->cancelRun((string) $run->prefect_run_id);
        }
        $run->update([
            'status' => TemplateRun::STATUS_CANCELLED,
            'finished_at' => now(),
        ]);
    }
```

The `IngestionJob` model casts `status` to `ExecutionStatus` enum. The test uses string comparison via the enum's `value` accessor — this is correct because `ExecutionStatus::COMPLETED->value === 'completed'`. If the enum lacks a matching case, fail loudly: open `app/Enums/ExecutionStatus.php` and verify `pending|running|completed|failed|cancelled` are present (they are, per the existing IngestionJob).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Templates/TemplateRunServicePollTest.php"`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/Templates/TemplateRunService.php tests/Unit/Templates/TemplateRunServicePollTest.php && vendor/bin/phpstan analyse app/Services/Templates/TemplateRunService.php tests/Unit/Templates/TemplateRunServicePollTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Services/Templates/TemplateRunService.php backend/tests/Unit/Templates/TemplateRunServicePollTest.php
git commit -m "feat(templates): TemplateRunService pollAndUpdate + cancel with IngestionJob status sync"
```

---

## Task 14: `PollTemplateRunJob` full body — backoff and terminal exit

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/backend/app/Jobs/Templates/PollTemplateRunJob.php`
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Feature/Templates/RunPollingTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Jobs\Templates\PollTemplateRunJob;
use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Mockery;
use Tests\TestCase;

class RunPollingTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_non_terminal_status_redispatches_with_backoff(): void
    {
        Bus::fake([PollTemplateRunJob::class]);
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
            'prefect_run_id' => '11111111-1111-1111-1111-111111111111',
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getRun')->andReturn(['status' => 'running', 'progress' => 0.3]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        (new PollTemplateRunJob($run->id, 0))->handle($this->app->make(\App\Services\Templates\TemplateRunService::class));

        Bus::assertDispatched(PollTemplateRunJob::class, function (PollTemplateRunJob $job) use ($run): bool {
            return $job->templateRunId === $run->id && $job->attempt === 1;
        });
    }

    public function test_terminal_status_does_not_redispatch(): void
    {
        Bus::fake([PollTemplateRunJob::class]);
        $user = User::factory()->create();
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
            'prefect_run_id' => '22222222-2222-2222-2222-222222222222',
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getRun')->andReturn(['status' => 'completed', 'progress' => 1.0]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        (new PollTemplateRunJob($run->id, 3))->handle($this->app->make(\App\Services\Templates\TemplateRunService::class));

        Bus::assertNotDispatched(PollTemplateRunJob::class);
    }

    public function test_backoff_sequence_caps_at_30s(): void
    {
        $job = new PollTemplateRunJob(1, 0);
        $this->assertSame(2, $job->delaySeconds());
        $this->assertSame(4,  (new PollTemplateRunJob(1, 1))->delaySeconds());
        $this->assertSame(8,  (new PollTemplateRunJob(1, 2))->delaySeconds());
        $this->assertSame(16, (new PollTemplateRunJob(1, 3))->delaySeconds());
        $this->assertSame(30, (new PollTemplateRunJob(1, 4))->delaySeconds()); // capped
        $this->assertSame(30, (new PollTemplateRunJob(1, 99))->delaySeconds());
    }

    public function test_missing_run_is_noop(): void
    {
        Bus::fake([PollTemplateRunJob::class]);
        (new PollTemplateRunJob(999_999, 0))->handle($this->app->make(\App\Services\Templates\TemplateRunService::class));
        Bus::assertNotDispatched(PollTemplateRunJob::class);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/RunPollingTest.php"`
Expected: FAIL — `Method "delaySeconds" does not exist` (or similar — backoff/redispatch logic absent).

- [ ] **Step 3: Write minimal implementation**

Replace `PollTemplateRunJob` body:

```php
<?php

declare(strict_types=1);

namespace App\Jobs\Templates;

use App\Models\App\TemplateRun;
use App\Services\Templates\TemplateRunService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class PollTemplateRunJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /** Job re-dispatches itself; never relies on Horizon retry. */
    public int $tries = 1;

    public function __construct(
        public readonly int $templateRunId,
        public readonly int $attempt = 0,
    ) {}

    public function handle(TemplateRunService $service): void
    {
        $run = TemplateRun::find($this->templateRunId);
        if ($run === null) {
            return;
        }

        try {
            $service->pollAndUpdate($run);
        } catch (Throwable $e) {
            // Do not crash the worker — re-dispatch with backoff so transient
            // network errors against the Python service don't strand the run.
            $this->redispatch();

            return;
        }

        $run->refresh();
        if ($run->isTerminal()) {
            return;
        }

        $this->redispatch();
    }

    public function delaySeconds(): int
    {
        $sequence = [2, 4, 8, 16, 30];

        return $sequence[min($this->attempt, count($sequence) - 1)];
    }

    private function redispatch(): void
    {
        self::dispatch($this->templateRunId, $this->attempt + 1)
            ->delay(now()->addSeconds($this->delaySeconds()));
    }

    /**
     * @return array<int,string>
     */
    public function tags(): array
    {
        return ['templates', 'template_run:'.$this->templateRunId];
    }
}
```

Update `TemplateRunService::submit` to dispatch with attempt 0 (already passes `$run->id`; replace dispatch line):

```php
            PollTemplateRunJob::dispatch($run->id, 0)->delay(now()->addSeconds(2));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/RunPollingTest.php"`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Jobs/Templates/PollTemplateRunJob.php app/Services/Templates/TemplateRunService.php tests/Feature/Templates/RunPollingTest.php && vendor/bin/phpstan analyse app/Jobs/Templates/PollTemplateRunJob.php app/Services/Templates/TemplateRunService.php tests/Feature/Templates/RunPollingTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Jobs/Templates/PollTemplateRunJob.php backend/app/Services/Templates/TemplateRunService.php backend/tests/Feature/Templates/RunPollingTest.php
git commit -m "feat(templates): PollTemplateRunJob with self-redispatch backoff (2/4/8/16/30s) and terminal exit"
```

---

## Task 15: `TemplatesController` — list and show + routes

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/TemplatesController.php`
- Modify: `/home/smudoshi/Github/Parthenon/backend/routes/api.php` (insert routes after the existing `// Ingestion` block, around line 271, before the `// Ingestion Projects (multi-file)` block)
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Feature/Templates/TemplatesControllerListShowTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class TemplatesControllerListShowTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_unauthenticated_index_returns_401(): void
    {
        $this->getJson('/api/v1/ingestion/templates')->assertStatus(401);
    }

    public function test_authenticated_without_permission_returns_403(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->getJson('/api/v1/ingestion/templates')->assertStatus(403);
    }

    public function test_index_with_permission_returns_catalog(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('ingestion.view');

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('listTemplates')->andReturn([
            ['id' => 'hello_cdm', 'version' => '0.1.0', 'name' => 'Hello CDM'],
        ]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $this->actingAs($user)
            ->getJson('/api/v1/ingestion/templates')
            ->assertOk()
            ->assertJsonFragment(['id' => 'hello_cdm']);
    }

    public function test_show_proxies_single_template(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('ingestion.view');

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')->with('hello_cdm')->andReturn([
            'id' => 'hello_cdm',
            'manifest' => ['singleton' => false],
        ]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $this->actingAs($user)
            ->getJson('/api/v1/ingestion/templates/hello_cdm')
            ->assertOk()
            ->assertJsonPath('id', 'hello_cdm')
            ->assertJsonPath('manifest.singleton', false);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/TemplatesControllerListShowTest.php"`
Expected: FAIL — `404 Not Found` for `/api/v1/ingestion/templates`.

- [ ] **Step 3: Write minimal implementation**

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Templates\TemplateRegistryClient;
use Illuminate\Http\JsonResponse;

class TemplatesController extends Controller
{
    public function __construct(private readonly TemplateRegistryClient $registry) {}

    public function index(): JsonResponse
    {
        return response()->json($this->registry->listTemplates());
    }

    public function show(string $id): JsonResponse
    {
        return response()->json($this->registry->getTemplate($id));
    }
}
```

Insert into `routes/api.php` immediately after line 271 (end of the existing `// Ingestion` validation routes block, before `// Ingestion Projects`):

```php
        // Ingestion Templates (Phase 0)
        Route::prefix('ingestion/templates')->group(function () {
            Route::get('/', [TemplatesController::class, 'index'])
                ->middleware('permission:ingestion.view');
            Route::get('/{id}', [TemplatesController::class, 'show'])
                ->where('id', '[A-Za-z0-9_\-]+')
                ->middleware('permission:ingestion.view');
        });
```

Add a `use App\Http\Controllers\Api\V1\TemplatesController;` import at the top of `routes/api.php` near the other `Api\V1` controller imports (insert alphabetically after the existing `TemplatesController`-adjacent import; for example after `MappingReviewController` ~line 99).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/TemplatesControllerListShowTest.php"`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Http/Controllers/Api/V1/TemplatesController.php routes/api.php tests/Feature/Templates/TemplatesControllerListShowTest.php && vendor/bin/phpstan analyse app/Http/Controllers/Api/V1/TemplatesController.php routes/api.php tests/Feature/Templates/TemplatesControllerListShowTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Http/Controllers/Api/V1/TemplatesController.php backend/routes/api.php backend/tests/Feature/Templates/TemplatesControllerListShowTest.php
git commit -m "feat(templates): TemplatesController index/show with auth + ingestion.view permission"
```

---

## Task 16: `TemplatesController::submitRun`

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/TemplatesController.php`
- Modify: `/home/smudoshi/Github/Parthenon/backend/routes/api.php`
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Feature/Templates/TemplatesControllerSubmitTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class TemplatesControllerSubmitTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_submit_requires_ingestion_run_permission(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('ingestion.view'); // not run
        $this->actingAs($user)
            ->postJson('/api/v1/ingestion/templates/hello_cdm/runs', ['version' => '0.1.0'])
            ->assertStatus(403);
    }

    public function test_invalid_version_returns_422(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['ingestion.view', 'ingestion.run']);
        $this->actingAs($user)
            ->postJson('/api/v1/ingestion/templates/hello_cdm/runs', ['version' => 'not-semver'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['version']);
    }

    public function test_valid_submission_returns_201_and_payload(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['ingestion.view', 'ingestion.run']);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')->andReturn([
            'id' => 'hello_cdm',
            'manifest' => ['singleton' => false, 'meta' => ['emits_cdm' => true]],
        ]);
        $registry->shouldReceive('submitRun')->andReturn([
            'prefect_run_id' => '11111111-1111-1111-1111-111111111111',
        ]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $resp = $this->actingAs($user)
            ->postJson('/api/v1/ingestion/templates/hello_cdm/runs', [
                'version' => '0.1.0',
                'parameters' => ['target_schema' => 'eunomia'],
            ])
            ->assertStatus(201)
            ->assertJsonStructure(['template_run_id', 'ingestion_job_id', 'status']);

        $this->assertSame(1, TemplateRun::count());
        $run = TemplateRun::firstOrFail();
        $this->assertSame((string) $run->id, (string) $resp->json('template_run_id'));
        $this->assertSame('queued', $resp->json('status'));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/TemplatesControllerSubmitTest.php"`
Expected: FAIL — `404 Not Found` for the POST route.

- [ ] **Step 3: Write minimal implementation**

Append to `TemplatesController` (and inject `TemplateRunService` into the constructor — full constructor below):

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\SubmitTemplateRunRequest;
use App\Models\App\TemplateRun;
use App\Services\Templates\TemplateRegistryClient;
use App\Services\Templates\TemplateRunService;
use Illuminate\Http\JsonResponse;

class TemplatesController extends Controller
{
    public function __construct(
        private readonly TemplateRegistryClient $registry,
        private readonly TemplateRunService $runService,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json($this->registry->listTemplates());
    }

    public function show(string $id): JsonResponse
    {
        return response()->json($this->registry->getTemplate($id));
    }

    public function submitRun(SubmitTemplateRunRequest $request, string $id): JsonResponse
    {
        $user = $request->user();
        if ($user === null) {
            abort(401);
        }
        $run = $this->runService->submit(
            $id,
            $request->validatedVersion(),
            $request->validatedParameters(),
            $user,
        );

        $jobId = $run->ingestionJobs()->value('id');

        return response()->json([
            'template_run_id' => $run->id,
            'ingestion_job_id' => $jobId,
            'status' => $run->status,
        ], 201);
    }
}
```

Insert into the templates route group:

```php
            Route::post('/{id}/runs', [TemplatesController::class, 'submitRun'])
                ->where('id', '[A-Za-z0-9_\-]+')
                ->middleware('permission:ingestion.run');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/TemplatesControllerSubmitTest.php"`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Http/Controllers/Api/V1/TemplatesController.php routes/api.php tests/Feature/Templates/TemplatesControllerSubmitTest.php && vendor/bin/phpstan analyse app/Http/Controllers/Api/V1/TemplatesController.php routes/api.php tests/Feature/Templates/TemplatesControllerSubmitTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Http/Controllers/Api/V1/TemplatesController.php backend/routes/api.php backend/tests/Feature/Templates/TemplatesControllerSubmitTest.php
git commit -m "feat(templates): TemplatesController::submitRun with ingestion.run permission and 201 payload"
```

---

## Task 17: `TemplatesController` — showRun, runLogs, runArtifacts

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/TemplatesController.php`
- Modify: `/home/smudoshi/Github/Parthenon/backend/routes/api.php`
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Feature/Templates/TemplatesControllerRunReadTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class TemplatesControllerRunReadTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function makeRun(User $user): TemplateRun
    {
        return TemplateRun::create([
            'template_id' => 'hello_cdm',
            'template_version' => '0.1.0',
            'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING,
            'submitted_by' => $user->id,
            'prefect_run_id' => '11111111-1111-1111-1111-111111111111',
        ]);
    }

    public function test_show_run_returns_row_and_linked_jobs(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('ingestion.view');
        $run = $this->makeRun($user);

        $this->actingAs($user)
            ->getJson('/api/v1/ingestion/templates/runs/'.$run->id)
            ->assertOk()
            ->assertJsonPath('template_run.id', $run->id)
            ->assertJsonPath('template_run.status', TemplateRun::STATUS_RUNNING);
    }

    public function test_run_logs_proxies_to_python(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('ingestion.view');
        $run = $this->makeRun($user);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getLogs')->with('11111111-1111-1111-1111-111111111111')
            ->andReturn(['lines' => [['ts' => '2026-05-02T00:00:00Z', 'level' => 'info', 'message' => 'started']]]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $this->actingAs($user)
            ->getJson('/api/v1/ingestion/templates/runs/'.$run->id.'/logs')
            ->assertOk()
            ->assertJsonPath('lines.0.message', 'started');
    }

    public function test_run_artifacts_proxies_to_python(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('ingestion.view');
        $run = $this->makeRun($user);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getArtifacts')->andReturn([
            'artifacts' => [['name' => 'summary.json', 'size' => 100]],
        ]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $this->actingAs($user)
            ->getJson('/api/v1/ingestion/templates/runs/'.$run->id.'/artifacts')
            ->assertOk()
            ->assertJsonPath('artifacts.0.name', 'summary.json');
    }

    public function test_run_endpoints_require_view_permission(): void
    {
        $user = User::factory()->create();
        $run = $this->makeRun($user);

        $this->actingAs($user)
            ->getJson('/api/v1/ingestion/templates/runs/'.$run->id)
            ->assertStatus(403);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/TemplatesControllerRunReadTest.php"`
Expected: FAIL — `404 Not Found`.

- [ ] **Step 3: Write minimal implementation**

Append to `TemplatesController`:

```php
    public function showRun(TemplateRun $run): JsonResponse
    {
        $run->loadMissing('ingestionJobs');

        return response()->json([
            'template_run' => $run,
            'ingestion_jobs' => $run->ingestionJobs,
        ]);
    }

    public function runLogs(TemplateRun $run): JsonResponse
    {
        if ($run->prefect_run_id === null) {
            return response()->json(['lines' => []]);
        }

        return response()->json($this->registry->getLogs((string) $run->prefect_run_id));
    }

    public function runArtifacts(TemplateRun $run): JsonResponse
    {
        if ($run->prefect_run_id === null) {
            return response()->json(['artifacts' => []]);
        }

        return response()->json($this->registry->getArtifacts((string) $run->prefect_run_id));
    }
```

Insert into the templates route group:

```php
            Route::get('/runs/{run}', [TemplatesController::class, 'showRun'])
                ->middleware('permission:ingestion.view');
            Route::get('/runs/{run}/logs', [TemplatesController::class, 'runLogs'])
                ->middleware('permission:ingestion.view');
            Route::get('/runs/{run}/artifacts', [TemplatesController::class, 'runArtifacts'])
                ->middleware('permission:ingestion.view');
```

The implicit binding `{run}` resolves to a `TemplateRun` model — Laravel uses the parameter type-hint on the controller method. Confirm `TemplateRun` is the only model with that route key (it is — primary key by default).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/TemplatesControllerRunReadTest.php"`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Http/Controllers/Api/V1/TemplatesController.php routes/api.php tests/Feature/Templates/TemplatesControllerRunReadTest.php && vendor/bin/phpstan analyse app/Http/Controllers/Api/V1/TemplatesController.php routes/api.php tests/Feature/Templates/TemplatesControllerRunReadTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Http/Controllers/Api/V1/TemplatesController.php backend/routes/api.php backend/tests/Feature/Templates/TemplatesControllerRunReadTest.php
git commit -m "feat(templates): TemplatesController showRun + runLogs + runArtifacts proxy endpoints"
```

---

## Task 18: `TemplatesController::cancelRun`

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/backend/app/Http/Controllers/Api/V1/TemplatesController.php`
- Modify: `/home/smudoshi/Github/Parthenon/backend/routes/api.php`
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Feature/Templates/TemplatesControllerCancelTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class TemplatesControllerCancelTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_cancel_requires_ingestion_delete(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo('ingestion.view');
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
            'prefect_run_id' => '11111111-1111-1111-1111-111111111111',
        ]);

        $this->actingAs($user)
            ->deleteJson('/api/v1/ingestion/templates/runs/'.$run->id)
            ->assertStatus(403);
    }

    public function test_cancel_with_permission_calls_python_and_marks_cancelled(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['ingestion.view', 'ingestion.delete']);
        $run = TemplateRun::create([
            'template_id' => 'hello_cdm', 'template_version' => '0.1.0', 'parameters' => [],
            'status' => TemplateRun::STATUS_RUNNING, 'submitted_by' => $user->id,
            'prefect_run_id' => '22222222-2222-2222-2222-222222222222',
        ]);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('cancelRun')->with('22222222-2222-2222-2222-222222222222')->andReturn(['status' => 'cancelled']);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $this->actingAs($user)
            ->deleteJson('/api/v1/ingestion/templates/runs/'.$run->id)
            ->assertOk()
            ->assertJsonPath('status', TemplateRun::STATUS_CANCELLED);

        $this->assertSame(TemplateRun::STATUS_CANCELLED, $run->refresh()->status);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/TemplatesControllerCancelTest.php"`
Expected: FAIL — `404 Not Found` for the DELETE route.

- [ ] **Step 3: Write minimal implementation**

Append to `TemplatesController`:

```php
    public function cancelRun(TemplateRun $run): JsonResponse
    {
        $this->runService->cancel($run);

        return response()->json([
            'template_run_id' => $run->id,
            'status' => $run->refresh()->status,
        ]);
    }
```

Insert into the templates route group:

```php
            Route::delete('/runs/{run}', [TemplatesController::class, 'cancelRun'])
                ->middleware('permission:ingestion.delete');
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/TemplatesControllerCancelTest.php"`
Expected: PASS — 2 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Http/Controllers/Api/V1/TemplatesController.php routes/api.php tests/Feature/Templates/TemplatesControllerCancelTest.php && vendor/bin/phpstan analyse app/Http/Controllers/Api/V1/TemplatesController.php routes/api.php tests/Feature/Templates/TemplatesControllerCancelTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Http/Controllers/Api/V1/TemplatesController.php backend/routes/api.php backend/tests/Feature/Templates/TemplatesControllerCancelTest.php
git commit -m "feat(templates): TemplatesController::cancelRun with ingestion.delete permission"
```

---

## Task 19: `templates:sync` Artisan command

**Files:**
- Create: `/home/smudoshi/Github/Parthenon/backend/app/Console/Commands/Templates/SyncCatalogCommand.php`
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Feature/Templates/SyncCatalogCommandTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Services\Templates\TemplateRegistryClient;
use Illuminate\Support\Facades\Cache;
use Mockery;
use Tests\TestCase;

class SyncCatalogCommandTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_sync_writes_digest_log_and_caches_catalog(): void
    {
        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('listTemplates')->once()->andReturn([
            ['id' => 'hello_cdm', 'version' => '0.1.0'],
            ['id' => 'load_synpuf', 'version' => '0.1.0'],
        ]);
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $this->artisan('templates:sync')
            ->expectsOutputToContain('templates synced: 2')
            ->assertSuccessful();

        $cached = Cache::get('templates:catalog');
        $this->assertIsArray($cached);
        $this->assertCount(2, $cached);
    }

    public function test_sync_handles_registry_failure(): void
    {
        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('listTemplates')->andThrow(new \App\Exceptions\Templates\TemplateRegistryException('down', 503));
        $this->app->instance(TemplateRegistryClient::class, $registry);

        $this->artisan('templates:sync')
            ->expectsOutputToContain('templates sync failed')
            ->assertFailed();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/SyncCatalogCommandTest.php"`
Expected: FAIL — `Command "templates:sync" is not defined`.

- [ ] **Step 3: Write minimal implementation**

```php
<?php

declare(strict_types=1);

namespace App\Console\Commands\Templates;

use App\Exceptions\Templates\TemplateRegistryException;
use App\Services\Templates\TemplateRegistryClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class SyncCatalogCommand extends Command
{
    protected $signature = 'templates:sync';

    protected $description = 'Pull the manifest catalog from parthenon-templates and cache it for the UI.';

    public function handle(TemplateRegistryClient $registry): int
    {
        try {
            $catalog = $registry->listTemplates();
        } catch (TemplateRegistryException $e) {
            $this->error('templates sync failed: '.$e->getMessage());
            Log::warning('templates:sync registry error', ['error' => $e->getMessage(), 'status' => $e->getStatusCode()]);

            return self::FAILURE;
        }

        Cache::put('templates:catalog', $catalog, now()->addMinutes(60));

        $this->info(sprintf('templates synced: %d', count($catalog)));
        Log::info('templates:sync ok', ['count' => count($catalog)]);

        return self::SUCCESS;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/SyncCatalogCommandTest.php"`
Expected: PASS — 2 tests green.

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Console/Commands/Templates tests/Feature/Templates/SyncCatalogCommandTest.php && vendor/bin/phpstan analyse app/Console/Commands/Templates tests/Feature/Templates/SyncCatalogCommandTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/app/Console/Commands/Templates/SyncCatalogCommand.php backend/tests/Feature/Templates/SyncCatalogCommandTest.php
git commit -m "feat(templates): templates:sync command pulls catalog and caches for 60min"
```

---

## Task 20: `deploy.sh` integration

**Files:**
- Modify: `/home/smudoshi/Github/Parthenon/deploy.sh` (add `--templates-sync` flag and run sync after migrations)

- [ ] **Step 1: Write the failing test**

This task is shell-script integration; verify by execution rather than Pest. Define the expected behavior:

```bash
# Expected: ./deploy.sh --templates-sync prints templates sync output and exits 0 (when service reachable)
# Expected: ./deploy.sh --db (migration mode) emits "templates:sync" line at the end
# Expected: ./deploy.sh (full) runs migrations followed by templates:sync
```

Run: `cd /home/smudoshi/Github/Parthenon && grep -nE "templates-sync|templates:sync" deploy.sh || echo "NOT_PRESENT"`
Expected: `NOT_PRESENT`.

- [ ] **Step 2: Run shell-level smoke**

Run: `cd /home/smudoshi/Github/Parthenon && bash -n deploy.sh && echo "syntax-ok"`
Expected: `syntax-ok` — confirms the script currently parses.

- [ ] **Step 3: Write minimal implementation**

Edit `deploy.sh` in three places.

(a) Around line 50 (`for arg in "$@"; do … case`), add a new case:

```bash
    --templates-sync) TEMPLATES_SYNC_ONLY=true ;;
```

(b) Around line 45 with the other booleans, add:

```bash
TEMPLATES_SYNC_ONLY=false
```

And around line 60 with the other `DO_*` vars:

```bash
DO_TEMPLATES_SYNC=true
```

(c) Around line 65 with the other targeted-mode resets, add:

```bash
if $TEMPLATES_SYNC_ONLY; then
  DO_PHP=false; DO_FRONTEND=false; DO_DB=false; DO_DOCS=false; DO_OPENAPI=false
fi
```

And include `DO_TEMPLATES_SYNC=false` in each existing targeted-mode reset (`PHP_ONLY`, `FRONTEND_ONLY`, `DB_ONLY`, `DOCS_ONLY`, `OPENAPI_ONLY` — except keep it `true` for `DB_ONLY` and `TEMPLATES_SYNC_ONLY` so migrations naturally trigger a re-sync). Final shape per existing line:

```bash
if $PHP_ONLY;      then DO_FRONTEND=false; DO_DB=false;      DO_DOCS=false; DO_OPENAPI=false; DO_TEMPLATES_SYNC=false; fi
if $FRONTEND_ONLY; then DO_PHP=false;      DO_DB=false;      DO_DOCS=false; DO_OPENAPI=false; DO_TEMPLATES_SYNC=false; fi
if $DB_ONLY;       then DO_PHP=false;      DO_FRONTEND=false; DO_DOCS=false; DO_OPENAPI=false; fi
if $DOCS_ONLY;     then DO_PHP=false;      DO_FRONTEND=false; DO_DB=false;  DO_OPENAPI=false;  DO_TEMPLATES_SYNC=false; fi
if $OPENAPI_ONLY;  then DO_PHP=false;      DO_FRONTEND=false; DO_DB=false;  DO_DOCS=false;     DO_TEMPLATES_SYNC=false; fi
if $TEMPLATES_SYNC_ONLY; then DO_PHP=false; DO_FRONTEND=false; DO_DB=false; DO_DOCS=false; DO_OPENAPI=false; fi
```

(d) Append a new section near the end of the script — directly **after** the migrations block and **before** the smoke-test section. Insert after the `if $DO_DB; then … fi` block (which ends around line 565). Add:

```bash
if $DO_TEMPLATES_SYNC; then
  echo "▸ Templates catalog sync"
  if docker compose exec -T php php artisan templates:sync 2>&1 | sed 's/^/     /'; then
    ok "templates:sync"
  else
    warn "templates:sync failed (continuing — non-fatal in deploy)"
  fi
fi
```

(e) Update the usage block (around line 14) to document the new flag:

```bash
#   ./deploy.sh --templates-sync # pull manifest catalog from parthenon-templates only
```

- [ ] **Step 4: Verify the script parses and the flag is wired**

Run: `cd /home/smudoshi/Github/Parthenon && bash -n deploy.sh && grep -nE "templates-sync|templates:sync|DO_TEMPLATES_SYNC" deploy.sh`
Expected: at least 6 hits (1 usage line, 1 case, 1 init, 6 reset rows, 1 if-block).

- [ ] **Step 5: Run Pint and PHPStan**

Pint and PHPStan don't apply to shell. Skip — but run the Pest test suite to confirm no regressions:

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates tests/Unit/Templates"`
Expected: PASS — full templates test suite green.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add deploy.sh
git commit -m "chore(deploy): add --templates-sync flag and run templates:sync after migrations"
```

---

## Task 21: End-to-end Pest test — full submit → poll → terminal flow

**Files:**
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Feature/Templates/TemplateRunEndToEndTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use App\Jobs\Templates\PollTemplateRunJob;
use App\Models\App\IngestionJob;
use App\Models\App\TemplateRun;
use App\Models\User;
use App\Services\Templates\TemplateRegistryClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\TestCase;

class TemplateRunEndToEndTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_full_submit_to_completion_flow(): void
    {
        $user = User::factory()->create();
        $user->givePermissionTo(['ingestion.view', 'ingestion.run']);

        $registry = Mockery::mock(TemplateRegistryClient::class);
        $registry->shouldReceive('getTemplate')->andReturn([
            'id' => 'hello_cdm',
            'manifest' => ['singleton' => false, 'meta' => ['emits_cdm' => true]],
        ]);
        $registry->shouldReceive('submitRun')->andReturn(['prefect_run_id' => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa']);
        $registry->shouldReceive('getRun')->andReturnUsing(function (): array {
            static $calls = 0;
            $calls++;
            if ($calls === 1) {
                return ['status' => 'running', 'progress' => 0.3, 'current_node' => 'load_csv'];
            }
            return ['status' => 'completed', 'progress' => 1.0, 'finished_at' => '2026-05-02T01:30:00Z'];
        });
        $this->app->instance(TemplateRegistryClient::class, $registry);

        // 1. Submit
        $resp = $this->actingAs($user)
            ->postJson('/api/v1/ingestion/templates/hello_cdm/runs', [
                'version' => '0.1.0',
                'parameters' => ['target_schema' => 'eunomia'],
            ])
            ->assertStatus(201);

        $runId = (int) $resp->json('template_run_id');
        $this->assertGreaterThan(0, $runId);
        $run = TemplateRun::findOrFail($runId);
        $this->assertSame(TemplateRun::STATUS_QUEUED, $run->status);
        $this->assertSame(1, IngestionJob::where('template_run_id', $runId)->count());

        // 2. First poll → still running
        $service = $this->app->make(\App\Services\Templates\TemplateRunService::class);
        (new PollTemplateRunJob($runId, 0))->handle($service);
        $run->refresh();
        $this->assertSame(TemplateRun::STATUS_RUNNING, $run->status);

        // 3. Second poll → completed
        (new PollTemplateRunJob($runId, 1))->handle($service);
        $run->refresh();
        $this->assertSame(TemplateRun::STATUS_COMPLETED, $run->status);

        // 4. Show endpoint reflects terminal state
        $this->actingAs($user)
            ->getJson('/api/v1/ingestion/templates/runs/'.$runId)
            ->assertOk()
            ->assertJsonPath('template_run.status', TemplateRun::STATUS_COMPLETED);
    }
}
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/TemplateRunEndToEndTest.php"`
Expected: PASS on first run if Tasks 1–18 are green. If FAIL: the diagnostic is the assertion message — fix the underlying Task that owns the failure (e.g., a missed `current_node` cast).

- [ ] **Step 3: Write minimal implementation**

No new code — this task is integration coverage over the work in Tasks 1–18.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates"`
Expected: PASS — entire `tests/Feature/Templates/` suite green.

- [ ] **Step 5: Run Pint and PHPStan across all new code**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Models/App/TemplateRun.php app/Models/App/IngestionJob.php app/Services/Templates app/Http/Controllers/Api/V1/TemplatesController.php app/Http/Requests/SubmitTemplateRunRequest.php app/Jobs/Templates app/Console/Commands/Templates app/Exceptions/Templates app/Providers/TemplatesServiceProvider.php config/services.php routes/api.php bootstrap/providers.php tests/Feature/Templates tests/Unit/Templates && vendor/bin/phpstan analyse app/Models/App/TemplateRun.php app/Services/Templates app/Http/Controllers/Api/V1/TemplatesController.php app/Http/Requests/SubmitTemplateRunRequest.php app/Jobs/Templates app/Console/Commands/Templates app/Exceptions/Templates app/Providers/TemplatesServiceProvider.php tests/Feature/Templates tests/Unit/Templates"`
Expected: no issues at level 8; no new entries in `phpstan-baseline.neon`.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/tests/Feature/Templates/TemplateRunEndToEndTest.php
git commit -m "test(templates): end-to-end submit -> poll -> completed flow"
```

---

## Task 22: Permissions verification (no code change)

**Files:**
- None — this task is a verification gate.
- Test: `/home/smudoshi/Github/Parthenon/backend/tests/Feature/Templates/PermissionsExistTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

namespace Tests\Feature\Templates;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class PermissionsExistTest extends TestCase
{
    use RefreshDatabase;

    public function test_required_ingestion_permissions_exist(): void
    {
        $this->seed(\Database\Seeders\RolePermissionSeeder::class);

        $this->assertTrue(Permission::where('name', 'ingestion.view')->exists());
        $this->assertTrue(Permission::where('name', 'ingestion.run')->exists());
        $this->assertTrue(Permission::where('name', 'ingestion.delete')->exists());
    }
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates/PermissionsExistTest.php"`
Expected: PASS — these permissions exist already (per pre-flight verification). No code change required.

- [ ] **Step 3: Write minimal implementation**

No code change.

- [ ] **Step 4: Run test to verify it passes**

(Same as Step 2.)

- [ ] **Step 5: Run Pint and PHPStan**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint tests/Feature/Templates/PermissionsExistTest.php && vendor/bin/phpstan analyse tests/Feature/Templates/PermissionsExistTest.php"`
Expected: no issues.

- [ ] **Step 6: Commit**

```bash
cd /home/smudoshi/Github/Parthenon
git add backend/tests/Feature/Templates/PermissionsExistTest.php
git commit -m "test(templates): assert ingestion.view/run/delete permissions exist (no new perms needed)"
```

---

## Plan completion checklist

After all tasks pass:

- [ ] Run the full new suite together: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Templates tests/Unit/Templates"` — all tests green.
- [ ] Run the full project Pest suite to confirm no regressions: `cd /home/smudoshi/Github/Parthenon && docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pest"` — overall green.
- [ ] Confirm `phpstan-baseline.neon` is unchanged (no new ignores added).
- [ ] Confirm `git log --oneline | head -25` shows ~22 atomic commits, one per task.
- [ ] Verify `php artisan route:list --name=templates` shows 7 routes, all under `auth:sanctum` and a `permission:` middleware.
- [ ] Confirm Plan 1 (Python service) is in place before deploy: `docker compose ps parthenon-templates` returns `running` and `curl -s http://parthenon-templates:8000/health` from the Laravel container returns 200. (If Plan 1 is not yet merged, the unit + Pest suites still pass via the Guzzle mocks, but a live deploy will be deferred.)
- [ ] Run `./deploy.sh --db` to apply migrations on staging.
- [ ] Run `./deploy.sh --templates-sync` to seed the catalog cache.
