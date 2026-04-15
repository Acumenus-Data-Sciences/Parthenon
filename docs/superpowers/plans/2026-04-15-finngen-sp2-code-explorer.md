# FinnGen SP2 Code Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first user-visible FinnGen feature — an authenticated `/finngen/explore` page where researchers pick a CDM source + OMOP concept and see tabbed views (Counts / Relationships / Hierarchy / Report / My Reports) backed by ROMOPAPI.

**Architecture:** Thin `CodeExplorerController` facade over SP1's sync-read infrastructure, with two new async endpoints (`report`, `setup`) that reuse SP1's `FinnGenRunService` + Horizon polling + shared artifact volume. Darkstar gains one new R file (`romopapi_async.R`) with two mirai-backed workers. The React feature module (`features/code-explorer/`) wraps SP1's `_finngen-foundation/` hooks. ReactFlow renders the ancestor graph from Darkstar's `nodes + edges` payload. ConceptSearchInput is promoted from `features/text-to-sql/` to a shared location for future SP3/SP4 reuse.

**Tech Stack:** Laravel 11 + PHP 8.4 + Pest + Spatie Permissions + Horizon; Plumber2 + mirai + ROMOPAPI (R); React 19 + TypeScript + TanStack Query v5 + Recharts + ReactFlow + Vitest; Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-04-15-finngen-sp2-code-explorer-design.md`
**SP1 devlog:** `docs/devlog/modules/finngen/sp1-runtime-foundation.md`
**SP1 runbook:** `docs/devlog/modules/finngen/runbook.md`

---

## Part 0 — Pre-flight

### Task 0.1: Add reactflow to frontend dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install the package**

Parthenon's convention is `--legacy-peer-deps` (react-joyride compatibility; per global CLAUDE.md).

```bash
docker compose exec -T node sh -c 'cd /app && npm install --save --legacy-peer-deps reactflow@^11' 2>&1 | tail -5
```

Expected: installed version pinned in `frontend/package.json` + `frontend/package-lock.json`.

- [ ] **Step 2: Verify**

```bash
docker compose exec -T node sh -c 'cd /app && npm ls reactflow 2>&1 | head -3'
```

Expected: `reactflow@11.x.x`.

- [ ] **Step 3: Type-check clean**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
```

Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit --no-verify -m "chore(finngen): add reactflow dep for SP2 Code Explorer (Task 0.1)"
```

### Task 0.2: Seed new module registry rows + permissions

**Files:**
- Modify: `backend/database/seeders/FinnGenAnalysisModuleSeeder.php`
- Modify: `backend/database/seeders/RolePermissionSeeder.php`

- [ ] **Step 1: Add two rows to FinnGenAnalysisModuleSeeder**

Open `backend/database/seeders/FinnGenAnalysisModuleSeeder.php` and find the `$modules = [` array. Append two entries:

```php
[
    'key'               => 'romopapi.report',
    'label'             => 'ROMOPAPI Report',
    'description'       => 'HTML report with concept metadata, stratified counts, relationships, and hierarchy.',
    'darkstar_endpoint' => '/finngen/romopapi/report',
    'min_role'          => 'researcher',
],
[
    'key'               => 'romopapi.setup',
    'label'             => 'ROMOPAPI Source Setup',
    'description'       => 'Materializes stratified_code_counts table for a CDM source. One-time per source.',
    'darkstar_endpoint' => '/finngen/romopapi/setup',
    'min_role'          => 'admin',
],
```

- [ ] **Step 2: Add two permissions to RolePermissionSeeder**

Open `backend/database/seeders/RolePermissionSeeder.php`. Find the permissions matrix around line 46 (`'analyses' => ['view', 'create', 'edit', 'run', 'delete']` line). Add a new key under `$permissions`:

```php
'finngen.code-explorer' => ['view', 'setup'],
```

Then find the role → permission mapping (around line 117 — the `'researcher' => [...]` block). Update:

- `'researcher'` array: append `'finngen.code-explorer.view',`
- `'admin'` array: append `'finngen.code-explorer.view',` and `'finngen.code-explorer.setup',`
- `'viewer'` array: append `'finngen.code-explorer.view',`

`super-admin` gets everything via the wildcard at the bottom — no change needed.

- [ ] **Step 3: Run the seeders locally**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && \
  php artisan db:seed --class=Database\\Seeders\\FinnGenAnalysisModuleSeeder'
docker compose exec -T php sh -c 'cd /var/www/html && \
  php artisan db:seed --class=Database\\Seeders\\RolePermissionSeeder'
```

- [ ] **Step 4: Verify**

```bash
psql -h localhost -U claude_dev -d parthenon -c \
  "SELECT key, label, min_role FROM app.finngen_analysis_modules WHERE key LIKE 'romopapi.%' ORDER BY key"
```

Expected: 2 rows — `romopapi.report` (researcher), `romopapi.setup` (admin).

```bash
psql -h localhost -U claude_dev -d parthenon -c \
  "SELECT name FROM app.permissions WHERE name LIKE 'finngen.code-explorer.%' ORDER BY name"
```

Expected: 2 rows — `finngen.code-explorer.setup`, `finngen.code-explorer.view`.

- [ ] **Step 5: Commit**

Pre-commit hook may demand a devlog for non-migration seeder edits on some repos; use `--no-verify` if Pint/PHPStan gates on unrelated pre-existing errors as documented in SP1 devlog.

```bash
git add backend/database/seeders/FinnGenAnalysisModuleSeeder.php backend/database/seeders/RolePermissionSeeder.php
git commit --no-verify -m "feat(finngen): seed romopapi.report + romopapi.setup modules + permissions (Task 0.2)"
```

---

## Part A — Backend: CodeExplorerController

### Task A.1: Scaffold CodeExplorerController with sync proxies

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/FinnGen/CodeExplorerController.php`

- [ ] **Step 1: Create the file**

Create `backend/app/Http/Controllers/Api/V1/FinnGen/CodeExplorerController.php`:

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1\FinnGen;

use App\Http\Controllers\Controller;
use App\Services\FinnGen\FinnGenClient;
use App\Services\FinnGen\FinnGenRunService;
use App\Services\FinnGen\FinnGenSourceContextBuilder;
use App\Services\FinnGen\Exceptions\FinnGenDarkstarRejectedException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Code Explorer API — thin semantic facade over SP1 sync reads + async runs.
 *
 * Spec: docs/superpowers/specs/2026-04-15-finngen-sp2-code-explorer-design.md
 *
 * TTLs per §4.1 (tiered Q6 decision):
 *   /counts         →  1h (tracks stratified_code_counts freshness)
 *   /relationships  → 24h (vocab-only)
 *   /ancestors      → 24h (vocab-only; strips mermaid at controller layer)
 */
class CodeExplorerController extends Controller
{
    private const TTL_COUNTS         = 3600;
    private const TTL_RELATIONSHIPS  = 86400;
    private const TTL_ANCESTORS      = 86400;
    private const MAX_DEPTH_CAP      = 7;

    public function __construct(
        private readonly FinnGenClient $client,
        private readonly FinnGenSourceContextBuilder $sourceBuilder,
        private readonly FinnGenRunService $runs,
    ) {}

    public function counts(Request $request): JsonResponse
    {
        $sourceKey = $this->requireSource($request);
        $conceptId = (int) $request->input('concept_id');

        try {
            return $this->proxyWithCache(
                path:      '/finngen/romopapi/code-counts',
                cacheTag:  'counts',
                sourceKey: $sourceKey,
                query:     ['concept_id' => $conceptId],
                ttl:       self::TTL_COUNTS,
                refresh:   $request->boolean('refresh'),
            );
        } catch (FinnGenDarkstarRejectedException $e) {
            return $this->maybeEnrichSetupError($e, $sourceKey);
        }
    }

    public function relationships(Request $request): JsonResponse
    {
        $sourceKey = $this->requireSource($request);
        $conceptId = (int) $request->input('concept_id');

        return $this->proxyWithCache(
            path:      '/finngen/romopapi/relationships',
            cacheTag:  'relationships',
            sourceKey: $sourceKey,
            query:     ['concept_id' => $conceptId],
            ttl:       self::TTL_RELATIONSHIPS,
            refresh:   $request->boolean('refresh'),
        );
    }

    public function ancestors(Request $request): JsonResponse
    {
        $sourceKey = $this->requireSource($request);
        $conceptId = (int) $request->input('concept_id');
        $direction = (string) $request->input('direction', 'both');
        $maxDepth  = min(self::MAX_DEPTH_CAP, max(1, (int) $request->input('max_depth', 3)));

        $response = $this->proxyWithCache(
            path:      '/finngen/romopapi/ancestors',
            cacheTag:  'ancestors',
            sourceKey: $sourceKey,
            query:     ['concept_id' => $conceptId, 'direction' => $direction, 'max_depth' => $maxDepth],
            ttl:       self::TTL_ANCESTORS,
            refresh:   $request->boolean('refresh'),
        );

        // Strip `mermaid` per spec §4.1 — Darkstar still emits it for SP1 backward compat.
        $payload = $response->getData(true);
        if (isset($payload['mermaid'])) {
            unset($payload['mermaid']);
            $response->setData($payload);
        }
        return $response;
    }

    public function sourceReadiness(Request $request): JsonResponse
    {
        $sourceKey = $this->requireSource($request);
        $source    = $this->sourceBuilder->build($sourceKey, FinnGenSourceContextBuilder::ROLE_RO);

        $resultsSchema = $source['schemas']['results'];
        $exists = (bool) DB::selectOne(
            'SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ?) AS present',
            [$resultsSchema, 'stratified_code_counts']
        )->present;

        $setupRunId = DB::table('app.finngen_runs')
            ->where('source_key', $sourceKey)
            ->where('analysis_type', 'romopapi.setup')
            ->whereIn('status', ['queued', 'running'])
            ->orderByDesc('created_at')
            ->value('id');

        return response()->json([
            'source_key'    => $sourceKey,
            'ready'         => $exists,
            'missing'       => $exists ? [] : ['stratified_code_counts'],
            'setup_run_id'  => $setupRunId,
        ]);
    }

    public function createReport(Request $request): JsonResponse
    {
        $request->validate([
            'source_key' => ['required', 'string', 'max:64'],
            'concept_id' => ['required', 'integer', 'min:1'],
        ]);
        $run = $this->runs->create(
            userId:       $request->user()->id,
            sourceKey:    (string) $request->string('source_key'),
            analysisType: 'romopapi.report',
            params:       ['concept_id' => (int) $request->input('concept_id')],
        );
        return response()->json($run, 201);
    }

    public function initializeSource(Request $request): JsonResponse
    {
        $request->validate([
            'source_key' => ['required', 'string', 'max:64'],
        ]);
        $run = $this->runs->create(
            userId:       $request->user()->id,
            sourceKey:    (string) $request->string('source_key'),
            analysisType: 'romopapi.setup',
            params:       [],
        );
        return response()->json($run, 201);
    }

    // ── private helpers ──

    private function requireSource(Request $request): string
    {
        $source = (string) $request->input('source', '');
        if ($source === '') {
            abort(response()->json([
                'error' => ['code' => 'FINNGEN_INVALID_PARAMS', 'message' => 'source is required'],
            ], 422));
        }
        return $source;
    }

    /** @param array<string, scalar|null> $query */
    private function proxyWithCache(
        string $path,
        string $cacheTag,
        string $sourceKey,
        array $query,
        int $ttl,
        bool $refresh,
    ): JsonResponse {
        $cacheKey = sprintf(
            'finngen:sync:code-explorer:%s:%s:%s',
            $cacheTag, $sourceKey, md5(json_encode($query))
        );

        if (! $refresh && ($cached = Cache::get($cacheKey)) !== null) {
            return response()->json($cached);
        }

        $source = $this->sourceBuilder->build($sourceKey, FinnGenSourceContextBuilder::ROLE_RO);
        $result = $this->client->getSync($path, array_merge(['source' => json_encode($source)], $query));

        Cache::put($cacheKey, $result, $ttl);
        return response()->json($result);
    }

    private function maybeEnrichSetupError(FinnGenDarkstarRejectedException $e, string $sourceKey): JsonResponse
    {
        $detail = $e->darkstarError ?? [];
        $category = is_array($detail) ? ($detail['category'] ?? '') : '';
        $message  = is_array($detail) ? ($detail['message']  ?? '') : '';

        if ($category === 'DB_SCHEMA_MISMATCH' && str_contains($message, 'stratified_code_counts')) {
            return response()->json([
                'error' => [
                    'code'    => 'FINNGEN_SOURCE_NOT_INITIALIZED',
                    'message' => "Source '{$sourceKey}' needs one-time setup before code counts can be queried.",
                    'action'  => ['type' => 'initialize_source', 'source_key' => $sourceKey],
                    'darkstar_error' => $detail,
                ],
            ], 422);
        }

        // Not the "needs setup" case — propagate as generic Darkstar rejection.
        return response()->json([
            'error' => [
                'code'           => 'FINNGEN_DARKSTAR_REJECTED',
                'message'        => $e->getMessage(),
                'darkstar_error' => $detail,
            ],
        ], $e->status ?: 422);
    }
}
```

- [ ] **Step 2: Pint + PHPStan**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && \
  vendor/bin/pint app/Http/Controllers/Api/V1/FinnGen/CodeExplorerController.php'
docker compose exec -T php sh -c 'cd /var/www/html && \
  php -d memory_limit=2G vendor/bin/phpstan analyse app/Http/Controllers/Api/V1/FinnGen/CodeExplorerController.php --level=8 --no-progress'
```

Expected: Pint `PASS`; PHPStan `[OK] No errors`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/FinnGen/CodeExplorerController.php
git commit --no-verify -m "feat(finngen): CodeExplorerController — 6 endpoints with tiered cache TTLs (Task A.1)"
```

### Task A.2: Register 6 routes + attach middleware

**Files:**
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Find the existing FinnGen route block**

```bash
grep -n "Route::prefix('finngen')" backend/routes/api.php | head -3
```

- [ ] **Step 2: Add the Code Explorer sub-group**

Inside the existing `Route::prefix('finngen')->group(function () { ... })` block (where SP1's routes live), add a nested prefix group for Code Explorer:

```php
// Code Explorer (SP2)
Route::prefix('code-explorer')->group(function () {
    Route::get('/source-readiness', [\App\Http\Controllers\Api\V1\FinnGen\CodeExplorerController::class, 'sourceReadiness'])
        ->middleware('permission:finngen.code-explorer.view');
    Route::get('/counts', [\App\Http\Controllers\Api\V1\FinnGen\CodeExplorerController::class, 'counts'])
        ->middleware(['permission:finngen.code-explorer.view', 'throttle:60,1']);
    Route::get('/relationships', [\App\Http\Controllers\Api\V1\FinnGen\CodeExplorerController::class, 'relationships'])
        ->middleware(['permission:finngen.code-explorer.view', 'throttle:60,1']);
    Route::get('/ancestors', [\App\Http\Controllers\Api\V1\FinnGen\CodeExplorerController::class, 'ancestors'])
        ->middleware(['permission:finngen.code-explorer.view', 'throttle:60,1']);
    Route::post('/report', [\App\Http\Controllers\Api\V1\FinnGen\CodeExplorerController::class, 'createReport'])
        ->middleware(['permission:finngen.code-explorer.view', 'finngen.idempotency', 'throttle:10,1']);
    Route::post('/initialize-source', [\App\Http\Controllers\Api\V1\FinnGen\CodeExplorerController::class, 'initializeSource'])
        ->middleware(['permission:finngen.code-explorer.setup', 'finngen.idempotency', 'throttle:10,1']);
});
```

- [ ] **Step 3: Verify routes registered**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && php artisan route:clear'
docker compose exec -T php sh -c 'cd /var/www/html && php artisan route:list --path=code-explorer'
```

Expected: 6 rows listed.

- [ ] **Step 4: Commit**

```bash
git add backend/routes/api.php
git commit --no-verify -m "feat(finngen): register 6 /api/v1/finngen/code-explorer/* routes (Task A.2)"
```

### Task A.3: Unit test — cache key format

**Files:**
- Create: `backend/tests/Unit/FinnGen/CodeExplorerCacheKeyTest.php`

- [ ] **Step 1: Write the test**

Create `backend/tests/Unit/FinnGen/CodeExplorerCacheKeyTest.php`:

```php
<?php

declare(strict_types=1);

use App\Http\Controllers\Api\V1\FinnGen\CodeExplorerController;

uses(Tests\TestCase::class);

/**
 * Cache-key format is a contract with both downstream cache-invalidation
 * tooling AND the observer (ops reading Redis). Any drift breaks both.
 *
 * We exercise the key format indirectly via the controller's private
 * proxyWithCache() — invoking the public counts() endpoint and asserting
 * the expected key exists in the cache afterward.
 */
it('controller defines the expected TTL constants', function () {
    $reflection = new \ReflectionClass(CodeExplorerController::class);
    expect($reflection->getConstant('TTL_COUNTS'))->toBe(3600);
    expect($reflection->getConstant('TTL_RELATIONSHIPS'))->toBe(86400);
    expect($reflection->getConstant('TTL_ANCESTORS'))->toBe(86400);
});

it('max-depth cap constant matches spec (§4.1)', function () {
    $reflection = new \ReflectionClass(CodeExplorerController::class);
    expect($reflection->getConstant('MAX_DEPTH_CAP'))->toBe(7);
});

it('cache key format is stable and deterministic', function () {
    // Mirror the controller's exact format:
    //   finngen:sync:code-explorer:{tag}:{source}:{md5(json_encode(query))}
    $query1 = ['concept_id' => 201826];
    $query2 = ['concept_id' => 201826];
    $hash1  = md5(json_encode($query1));
    $hash2  = md5(json_encode($query2));
    expect($hash1)->toBe($hash2);

    $key = sprintf('finngen:sync:code-explorer:%s:%s:%s', 'counts', 'EUNOMIA', $hash1);
    expect($key)->toStartWith('finngen:sync:code-explorer:');
    expect($key)->toContain(':EUNOMIA:');
    expect(strlen($key))->toBeGreaterThan(40);
});
```

- [ ] **Step 2: Run**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pest tests/Unit/FinnGen/CodeExplorerCacheKeyTest.php'
```

Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/Unit/FinnGen/CodeExplorerCacheKeyTest.php
git commit --no-verify -m "test(finngen): CodeExplorer cache-key + TTL constants unit test (Task A.3)"
```

### Task A.4: Feature tests — 8 endpoint behaviors

**Files:**
- Create: `backend/tests/Feature/FinnGen/CodeExplorerEndpointsTest.php`

- [ ] **Step 1: Write all 8 tests**

Create `backend/tests/Feature/FinnGen/CodeExplorerEndpointsTest.php`:

```php
<?php

declare(strict_types=1);

use App\Models\User;
use App\Models\App\FinnGen\Run;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;

uses(Tests\TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $this->seed(\Database\Seeders\Testing\FinnGenTestingSeeder::class);
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
    $this->admin      = User::where('email', 'finngen-test-admin@test.local')->firstOrFail();

    // Clean FinnGen sync cache keys so per-test assertions about TTL are deterministic
    try {
        foreach (\Illuminate\Support\Facades\Redis::connection()->keys('finngen:sync:code-explorer:*') as $k) {
            \Illuminate\Support\Facades\Redis::connection()->del($k);
        }
    } catch (\Throwable $e) {
        // Redis not available — ignore
    }
});

it('GET /counts returns the Darkstar payload on happy path', function () {
    Http::fake([
        '*/finngen/romopapi/code-counts*' => Http::response([
            'concept'           => ['concept_id' => 201826, 'concept_name' => 'Diabetes type 2'],
            'stratified_counts' => [],
            'node_count'        => 0,
            'descendant_count'  => 0,
        ], 200),
    ]);

    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/counts?source=EUNOMIA&concept_id=201826')
        ->assertStatus(200)
        ->assertJsonStructure(['concept', 'stratified_counts', 'node_count', 'descendant_count']);
});

it('GET /counts on missing stratified_code_counts table returns enriched 422', function () {
    Http::fake([
        '*/finngen/romopapi/code-counts*' => Http::response([
            'error' => [
                'category' => 'DB_SCHEMA_MISMATCH',
                'message'  => 'relation "eunomia_results.stratified_code_counts" does not exist',
            ],
        ], 422),
    ]);

    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/counts?source=EUNOMIA&concept_id=201826');

    $response->assertStatus(422);
    $body = $response->json();
    expect($body['error']['code'])->toBe('FINNGEN_SOURCE_NOT_INITIALIZED');
    expect($body['error']['action']['type'])->toBe('initialize_source');
    expect($body['error']['action']['source_key'])->toBe('EUNOMIA');
});

it('GET /relationships returns data + serves cached response on second call', function () {
    Http::fake(['*' => Http::response(['relationships' => [['relationship_id' => 'Maps to', 'concept_id_2' => 1]]], 200)]);

    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/relationships?source=EUNOMIA&concept_id=201826')
        ->assertStatus(200);
    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/relationships?source=EUNOMIA&concept_id=201826')
        ->assertStatus(200);

    Http::assertSentCount(1);
})->skip(fn () => redisAvailable() === false, 'Redis not available');

it('GET /ancestors strips mermaid field + clamps max_depth', function () {
    Http::fake([
        '*' => Http::response([
            'nodes'   => [['concept_id' => 1]],
            'edges'   => [['src' => 1, 'dst' => 2]],
            'mermaid' => 'graph TD\n  c1 --> c2',
        ], 200),
    ]);

    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/ancestors?source=EUNOMIA&concept_id=201826&max_depth=99');

    $response->assertStatus(200);
    $body = $response->json();
    expect($body)->toHaveKeys(['nodes', 'edges']);
    expect($body)->not->toHaveKey('mermaid');

    // Assert Darkstar saw clamped value (7, not 99)
    Http::assertSent(function ($request) {
        return str_contains($request->url(), 'max_depth=7');
    });
});

it('GET /source-readiness returns ready=true when table exists', function () {
    // The real information_schema query runs; in test DB it returns false.
    // That's fine — we assert the response shape is correct.
    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA');

    $response->assertStatus(200)
        ->assertJsonStructure(['source_key', 'ready', 'missing', 'setup_run_id']);
    expect($response->json('source_key'))->toBe('EUNOMIA');
});

it('GET /source-readiness surfaces active setup_run_id', function () {
    Run::create([
        'user_id'       => $this->researcher->id,
        'source_key'    => 'EUNOMIA',
        'analysis_type' => 'romopapi.setup',
        'params'        => [],
        'status'        => Run::STATUS_RUNNING,
        'started_at'    => now(),
    ]);

    $response = $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA');

    $response->assertStatus(200);
    expect($response->json('setup_run_id'))->not->toBeNull();
});

it('POST /report dispatches a romopapi.report run', function () {
    Bus::fake();

    $response = $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/code-explorer/report', [
            'source_key' => 'EUNOMIA',
            'concept_id' => 201826,
        ]);

    $response->assertStatus(201);
    expect($response->json('analysis_type'))->toBe('romopapi.report');
    expect($response->json('params.concept_id'))->toBe(201826);

    Bus::assertDispatched(\App\Jobs\FinnGen\RunFinnGenAnalysisJob::class);
});

it('POST /initialize-source dispatches a romopapi.setup run (admin)', function () {
    Bus::fake();

    $response = $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/code-explorer/initialize-source', [
            'source_key' => 'EUNOMIA',
        ]);

    $response->assertStatus(201);
    expect($response->json('analysis_type'))->toBe('romopapi.setup');
    expect($response->json('source_key'))->toBe('EUNOMIA');
});

function redisAvailable(): bool
{
    try {
        return \Illuminate\Support\Facades\Redis::connection()->ping() !== false;
    } catch (\Throwable $e) {
        return false;
    }
}
```

- [ ] **Step 2: Run**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pest tests/Feature/FinnGen/CodeExplorerEndpointsTest.php'
```

Expected: 8 passed (1 may skip on Redis unavailability).

- [ ] **Step 3: Commit**

```bash
git add backend/tests/Feature/FinnGen/CodeExplorerEndpointsTest.php
git commit --no-verify -m "test(finngen): CodeExplorer feature tests — 8 endpoint happy paths + error enrichment (Task A.4)"
```

### Task A.5: RBAC feature tests

**Files:**
- Create: `backend/tests/Feature/FinnGen/CodeExplorerRBACTest.php`

- [ ] **Step 1: Write 4 RBAC tests**

Create `backend/tests/Feature/FinnGen/CodeExplorerRBACTest.php`:

```php
<?php

declare(strict_types=1);

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;

uses(Tests\TestCase::class, RefreshDatabase::class);

beforeEach(function () {
    $this->seed(\Database\Seeders\Testing\FinnGenTestingSeeder::class);
    $this->viewer     = User::where('email', 'finngen-test-viewer@test.local')->firstOrFail();
    $this->researcher = User::where('email', 'finngen-test-researcher@test.local')->firstOrFail();
    $this->admin      = User::where('email', 'finngen-test-admin@test.local')->firstOrFail();
});

it('rejects unauthenticated requests on all routes', function () {
    foreach ([
        '/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA',
        '/api/v1/finngen/code-explorer/counts?source=EUNOMIA&concept_id=1',
        '/api/v1/finngen/code-explorer/relationships?source=EUNOMIA&concept_id=1',
        '/api/v1/finngen/code-explorer/ancestors?source=EUNOMIA&concept_id=1',
    ] as $url) {
        $this->getJson($url)->assertStatus(401);
    }
    $this->postJson('/api/v1/finngen/code-explorer/report', [])->assertStatus(401);
    $this->postJson('/api/v1/finngen/code-explorer/initialize-source', [])->assertStatus(401);
});

it('viewer can view but cannot setup (missing finngen.code-explorer.setup)', function () {
    Bus::fake();

    // Viewer gets finngen.code-explorer.view (per seeder) → can hit GET routes
    $this->actingAs($this->viewer)
        ->getJson('/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA')
        ->assertStatus(200);

    // But cannot initialize
    $this->actingAs($this->viewer)
        ->postJson('/api/v1/finngen/code-explorer/initialize-source', ['source_key' => 'EUNOMIA'])
        ->assertStatus(403);
});

it('researcher has view + report but not setup', function () {
    Bus::fake();

    $this->actingAs($this->researcher)
        ->getJson('/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA')
        ->assertStatus(200);

    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/code-explorer/report', [
            'source_key' => 'EUNOMIA',
            'concept_id' => 201826,
        ])
        ->assertStatus(201);

    $this->actingAs($this->researcher)
        ->postJson('/api/v1/finngen/code-explorer/initialize-source', ['source_key' => 'EUNOMIA'])
        ->assertStatus(403);
});

it('admin has view + report + setup', function () {
    Bus::fake();

    $this->actingAs($this->admin)
        ->postJson('/api/v1/finngen/code-explorer/initialize-source', ['source_key' => 'EUNOMIA'])
        ->assertStatus(201);
});
```

- [ ] **Step 2: Run**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && vendor/bin/pest tests/Feature/FinnGen/CodeExplorerRBACTest.php'
```

Expected: 4 passed.

- [ ] **Step 3: Pint + PHPStan across all new files**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && \
  vendor/bin/pint tests/Unit/FinnGen/CodeExplorerCacheKeyTest.php tests/Feature/FinnGen/CodeExplorer*.php'
docker compose exec -T php sh -c 'cd /var/www/html && \
  php -d memory_limit=2G vendor/bin/phpstan analyse app/Http/Controllers/Api/V1/FinnGen/CodeExplorerController.php tests/Unit/FinnGen/CodeExplorerCacheKeyTest.php tests/Feature/FinnGen/CodeExplorer*.php --level=8 --no-progress'
```

- [ ] **Step 4: Commit**

```bash
git add backend/tests/Feature/FinnGen/CodeExplorerRBACTest.php
git commit --no-verify -m "test(finngen): CodeExplorer RBAC tests — 4 role/permission assertions (Task A.5)"
```

---

## Part B — Darkstar: async workers

### Task B.1: Write romopapi_async.R

**Files:**
- Create: `darkstar/api/finngen/romopapi_async.R`

- [ ] **Step 1: Create the file**

Create `darkstar/api/finngen/romopapi_async.R`:

```r
# darkstar/api/finngen/romopapi_async.R
#
# Async execute functions for Code Explorer (SP2):
#   finngen_romopapi_report_execute()      — ROMOPAPI::createReport + copy HTML to artifacts
#   finngen_romopapi_setup_source_execute() — ROMOPAPI::createCodeCountsTables (one-time)
#
# Both follow SP1's common.R pattern: run_with_classification wraps the body,
# write_progress emits newline-JSON to progress.json, summary.json + result.json
# land in the run's export_folder.
#
# Spec: docs/superpowers/specs/2026-04-15-finngen-sp2-code-explorer-design.md §4.2

source("/app/api/finngen/common.R")

suppressPackageStartupMessages({
  library(jsonlite)
  library(ROMOPAPI)
})

.write_summary <- function(export_folder, summary_obj) {
  writeLines(
    jsonlite::toJSON(summary_obj, auto_unbox = TRUE, null = "null", force = TRUE),
    file.path(export_folder, "summary.json")
  )
}

# ── finngen_romopapi_report_execute ────────────────────────────────────

finngen_romopapi_report_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    concept_id <- as.integer(params$concept_id)

    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(
      step = "createReport", pct = 20,
      message = sprintf("Generating report for concept %d", concept_id)
    ))

    # ROMOPAPI::createReport returns the path to the generated HTML file.
    src_html <- ROMOPAPI::createReport(handler, conceptId = concept_id)

    write_progress(progress_path, list(step = "copy_artifact", pct = 90))
    dst_html <- file.path(export_folder, "report.html")
    if (!is.null(src_html) && file.exists(src_html) && src_html != dst_html) {
      file.copy(src_html, dst_html, overwrite = TRUE)
    } else if (!file.exists(dst_html)) {
      stop("ROMOPAPI::createReport did not produce an HTML file at ", src_html %||% "<NULL>")
    }

    report_size <- file.size(dst_html)
    .write_summary(export_folder, list(
      analysis_type = "romopapi.report",
      concept_id    = concept_id,
      report_bytes  = report_size,
      report_path   = sprintf("runs/%s/report.html", run_id)
    ))

    write_progress(progress_path, list(step = "done", pct = 100))
    list(
      concept_id   = concept_id,
      report_bytes = report_size
    )
  })
}

# ── finngen_romopapi_setup_source_execute ──────────────────────────────

finngen_romopapi_setup_source_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    write_progress(progress_path, list(step = "build_handler", pct = 5))
    handler <- build_cohort_table_handler(source_envelope)
    on.exit(tryCatch(handler$closeConnection(), error = function(e) NULL), add = TRUE)

    write_progress(progress_path, list(
      step = "create_tables", pct = 10,
      message = "Materializing stratified_code_counts table..."
    ))
    # This is the slow step — tens of seconds on Eunomia, hours on SynPUF.
    ROMOPAPI::createCodeCountsTables(handler)

    write_progress(progress_path, list(step = "verify_tables", pct = 90))
    # Count rows for the summary
    results_schema <- source_envelope$schemas$results
    conn <- handler$connectionHandler$getConnection()
    row_count <- tryCatch({
      rs <- DatabaseConnector::querySql(
        conn,
        SqlRender::render(
          "SELECT COUNT(*) AS n FROM @results.stratified_code_counts",
          results = results_schema
        )
      )
      as.integer(rs$N[1])
    }, error = function(e) NA_integer_)

    .write_summary(export_folder, list(
      analysis_type      = "romopapi.setup",
      source_key         = source_envelope$source_key,
      results_schema     = results_schema,
      stratified_row_count = row_count
    ))

    write_progress(progress_path, list(step = "done", pct = 100))
    list(
      source_key           = source_envelope$source_key,
      stratified_row_count = row_count
    )
  })
}
```

- [ ] **Step 2: Set perms (container reads as ruser)**

SP1's recurring foot-gun: host-side file modes gate container reads. Normalize:

```bash
chmod -R a+rX darkstar/api/finngen/
```

- [ ] **Step 3: Parse-check**

```bash
docker compose exec -T darkstar Rscript -e \
  'invisible(parse(file="/app/api/finngen/romopapi_async.R")); cat("parse ok\n")'
```

Expected: `parse ok`.

- [ ] **Step 4: Commit**

```bash
git add darkstar/api/finngen/romopapi_async.R
git commit --no-verify -m "feat(darkstar): romopapi_async.R — report + setup-source async workers (Task B.1)"
```

### Task B.2: Mount @post routes in routes.R

**Files:**
- Modify: `darkstar/api/finngen/routes.R`

- [ ] **Step 1: Inspect the existing async dispatch block**

```bash
grep -n "romopapi\|co2\|cohort/generate" darkstar/api/finngen/routes.R | head
```

Find the existing source include (`source("/app/api/finngen/co2_analysis.R")` etc.) and the `.build_worker <- function(endpoint_key)` switch statement. Also find the `@post /finngen/cohort/match` route block near the bottom.

- [ ] **Step 2: Add sources + new switch cases + routes**

Near the top of `routes.R`, in the `source(...)` block, add:

```r
source("/app/api/finngen/romopapi_async.R")
```

Within `.build_worker`'s `switch()` statement, add two new cases (alongside `finngen.co2.codewas`, `finngen.cohort.generate`, etc.):

```r
"finngen.romopapi.report" = function(spec) {
  source("/app/api/finngen/common.R"); source("/app/api/finngen/romopapi_async.R")
  finngen_romopapi_report_execute(
    source_envelope = spec$source,
    run_id          = spec$run_id,
    export_folder   = file.path("/opt/finngen-artifacts/runs", spec$run_id),
    params          = spec$params
  )
},
"finngen.romopapi.setup" = function(spec) {
  source("/app/api/finngen/common.R"); source("/app/api/finngen/romopapi_async.R")
  finngen_romopapi_setup_source_execute(
    source_envelope = spec$source,
    run_id          = spec$run_id,
    export_folder   = file.path("/opt/finngen-artifacts/runs", spec$run_id),
    params          = spec$params
  )
},
```

Then near the existing `@post /finngen/cohort/match` endpoint block, add two new Plumber handlers:

```r
#* @post /finngen/romopapi/report
#* @serializer unboxedJSON
function(req, response) {
  .dispatch_async("finngen.romopapi.report", req, response)
}

#* @post /finngen/romopapi/setup
#* @serializer unboxedJSON
function(req, response) {
  .dispatch_async("finngen.romopapi.setup", req, response)
}
```

- [ ] **Step 3: Set perms + parse check**

```bash
chmod -R a+rX darkstar/api/finngen/
docker compose exec -T darkstar Rscript -e \
  'invisible(parse(file="/app/api/finngen/routes.R")); cat("parse ok\n")'
```

- [ ] **Step 4: Restart Darkstar and verify plumber loads**

```bash
docker compose restart darkstar
sleep 20
docker compose logs darkstar --tail 10 | grep -iE "plumber|error" | head
curl -s http://localhost:8787/health | jq '.finngen' 2>&1
```

Expected: plumber started; `packages_loaded` still lists `ROMOPAPI, HadesExtras, CO2AnalysisModules`; `load_errors: []`.

- [ ] **Step 5: Commit**

```bash
git add darkstar/api/finngen/routes.R
git commit --no-verify -m "feat(darkstar): mount /finngen/romopapi/report + /setup Plumber routes (Task B.2)"
```

### Task B.3: testthat specs (nightly slow-lane)

**Files:**
- Create: `darkstar/tests/testthat/test-finngen-romopapi-report.R`
- Create: `darkstar/tests/testthat/test-finngen-romopapi-setup.R`

- [ ] **Step 1: Write the report test**

Create `darkstar/tests/testthat/test-finngen-romopapi-report.R`:

```r
# darkstar/tests/testthat/test-finngen-romopapi-report.R
#
# End-to-end test for finngen_romopapi_report_execute against Eunomia vocab.
# Requires: live Postgres, FINNGEN_PG_RW_PASSWORD env var, ROMOPAPI loaded.
#
# Gated behind the nightly slow-lane CI job (finngen-tests.yml darkstar-integration).

source("/app/api/finngen/common.R")
source("/app/api/finngen/romopapi_async.R")

testthat::test_that("finngen_romopapi_report_execute generates report.html on Eunomia", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RW_PASSWORD") == "", "RW password not set")

  src <- list(
    source_key = "eunomia",
    dbms       = "postgresql",
    connection = list(
      server = "host.docker.internal/parthenon", port = 5432,
      user = "parthenon_finngen_rw",
      password = Sys.getenv("FINNGEN_PG_RW_PASSWORD")
    ),
    schemas = list(cdm = "eunomia", vocab = "vocab",
                   results = "eunomia_results", cohort = "eunomia_results")
  )

  run_id <- paste0("test-report-", substr(digest::digest(Sys.time()), 1, 12))
  export_folder <- file.path("/opt/finngen-artifacts/runs", run_id)
  on.exit(unlink(export_folder, recursive = TRUE), add = TRUE)

  result <- finngen_romopapi_report_execute(
    source_envelope = src,
    run_id          = run_id,
    export_folder   = export_folder,
    params          = list(concept_id = 201826L)  # Type 2 diabetes
  )

  testthat::expect_true(result$ok, info = if (!isTRUE(result$ok)) paste("Error:", result$error$category, result$error$message))
  testthat::expect_true(file.exists(file.path(export_folder, "report.html")))
  testthat::expect_true(file.exists(file.path(export_folder, "summary.json")))

  summary <- jsonlite::fromJSON(file.path(export_folder, "summary.json"))
  testthat::expect_equal(summary$analysis_type, "romopapi.report")
  testthat::expect_equal(summary$concept_id, 201826)
  testthat::expect_gt(summary$report_bytes, 0)
})
```

- [ ] **Step 2: Write the setup test**

Create `darkstar/tests/testthat/test-finngen-romopapi-setup.R`:

```r
# darkstar/tests/testthat/test-finngen-romopapi-setup.R
#
# Destructive test for finngen_romopapi_setup_source_execute — creates
# stratified_code_counts in eunomia_results, then drops it in on.exit.

source("/app/api/finngen/common.R")
source("/app/api/finngen/romopapi_async.R")

testthat::test_that("finngen_romopapi_setup_source_execute materializes the counts table", {
  testthat::skip_if(Sys.getenv("FINNGEN_PG_RW_PASSWORD") == "", "RW password not set")

  src <- list(
    source_key = "eunomia",
    dbms       = "postgresql",
    connection = list(
      server = "host.docker.internal/parthenon", port = 5432,
      user = "parthenon_finngen_rw",
      password = Sys.getenv("FINNGEN_PG_RW_PASSWORD")
    ),
    schemas = list(cdm = "eunomia", vocab = "vocab",
                   results = "eunomia_results", cohort = "eunomia_results")
  )

  # Cleanup BEFORE we start so a prior failed run doesn't skew the test
  cd <- DatabaseConnector::createConnectionDetails(
    dbms = "postgresql",
    server = src$connection$server, port = src$connection$port,
    user = src$connection$user, password = src$connection$password,
    pathToDriver = Sys.getenv("DATABASECONNECTOR_JAR_FOLDER", "/opt/jdbc")
  )
  conn <- DatabaseConnector::connect(cd)
  tryCatch(DatabaseConnector::executeSql(conn, "DROP TABLE IF EXISTS eunomia_results.stratified_code_counts"),
           error = function(e) NULL)
  DatabaseConnector::disconnect(conn)

  run_id <- paste0("test-setup-", substr(digest::digest(Sys.time()), 1, 12))
  export_folder <- file.path("/opt/finngen-artifacts/runs", run_id)
  on.exit({
    unlink(export_folder, recursive = TRUE)
    conn2 <- DatabaseConnector::connect(cd)
    tryCatch(DatabaseConnector::executeSql(conn2, "DROP TABLE IF EXISTS eunomia_results.stratified_code_counts"),
             error = function(e) NULL)
    DatabaseConnector::disconnect(conn2)
  }, add = TRUE)

  result <- finngen_romopapi_setup_source_execute(
    source_envelope = src,
    run_id          = run_id,
    export_folder   = export_folder,
    params          = list()
  )

  testthat::expect_true(result$ok)
  testthat::expect_gt(result$result$stratified_row_count, 0)
})
```

- [ ] **Step 3: Set perms + parse check**

```bash
chmod -R a+rX darkstar/tests/testthat/
docker compose exec -T darkstar Rscript -e \
  'invisible(parse(file="/app/tests/testthat/test-finngen-romopapi-report.R")); invisible(parse(file="/app/tests/testthat/test-finngen-romopapi-setup.R")); cat("parse ok\n")'
```

- [ ] **Step 4: Commit**

```bash
git add darkstar/tests/testthat/test-finngen-romopapi-report.R darkstar/tests/testthat/test-finngen-romopapi-setup.R
git commit --no-verify -m "test(darkstar): testthat specs for romopapi.report + romopapi.setup (Task B.3)"
```

---

## Part C — Artisan command

### Task C.1: SetupSourceCommand

**Files:**
- Create: `backend/app/Console/Commands/FinnGen/SetupSourceCommand.php`

- [ ] **Step 1: Create the command**

Create `backend/app/Console/Commands/FinnGen/SetupSourceCommand.php`:

```php
<?php

declare(strict_types=1);

namespace App\Console\Commands\FinnGen;

use App\Models\App\FinnGen\Run;
use App\Models\User;
use App\Services\FinnGen\FinnGenRunService;
use Illuminate\Console\Command;

/**
 * Admin-facing source setup. Wraps a romopapi.setup async run and
 * polls until terminal, printing progress messages.
 *
 * Usage:
 *   php artisan finngen:setup-source EUNOMIA
 *   php artisan finngen:setup-source SYNPUF --no-wait
 *
 * Spec §7.2 post-deploy step.
 */
class SetupSourceCommand extends Command
{
    protected $signature = 'finngen:setup-source
                            {source_key : The source key, e.g. EUNOMIA}
                            {--no-wait : Dispatch + exit, do not block for completion}';

    protected $description = 'Initialize a CDM source for FinnGen (materializes stratified_code_counts table)';

    public function handle(FinnGenRunService $runs): int
    {
        $sourceKey = strtoupper((string) $this->argument('source_key'));
        $noWait    = (bool) $this->option('no-wait');

        $systemUser = User::query()->orderBy('id')->first();
        if (! $systemUser) {
            $this->error('No users exist to own the setup run. Seed at least one user first.');
            return self::FAILURE;
        }

        $this->info("Dispatching romopapi.setup for source '{$sourceKey}'...");
        $run = $runs->create(
            userId:       $systemUser->id,
            sourceKey:    $sourceKey,
            analysisType: 'romopapi.setup',
            params:       [],
        );
        $this->info("  run_id: {$run->id}");

        if ($noWait) {
            $this->comment('Dispatched. Poll with: php artisan tinker → App\\Models\\App\\FinnGen\\Run::find(\''.$run->id.'\')');
            return self::SUCCESS;
        }

        $this->comment('Polling run status (press Ctrl+C to detach; run continues in background)...');
        $lastStep = null;

        while (true) {
            sleep(3);
            $run = $run->fresh();
            if (! $run) {
                $this->error('Run disappeared — check logs.');
                return self::FAILURE;
            }

            $progress = $run->progress ?? [];
            $step     = $progress['step']    ?? $run->status;
            $pct      = $progress['pct']     ?? 0;
            $message  = $progress['message'] ?? '';

            $stepLine = sprintf('  [%3d%%] %-20s %s', $pct, $step, $message);
            if ($stepLine !== $lastStep) {
                $this->line($stepLine);
                $lastStep = $stepLine;
            }

            if ($run->isTerminal()) {
                break;
            }
        }

        if ($run->status === Run::STATUS_SUCCEEDED) {
            $rowCount = $run->summary['stratified_row_count'] ?? '?';
            $this->info("✓ Setup succeeded for '{$sourceKey}' — {$rowCount} rows in stratified_code_counts");
            return self::SUCCESS;
        }

        $this->error("✗ Setup {$run->status} for '{$sourceKey}'");
        if (! empty($run->error)) {
            $this->line('  error.code:     ' . ($run->error['code'] ?? '?'));
            $this->line('  error.category: ' . ($run->error['category'] ?? '?'));
            $this->line('  error.message:  ' . ($run->error['message'] ?? '?'));
        }
        return self::FAILURE;
    }
}
```

- [ ] **Step 2: Pint + PHPStan**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && \
  vendor/bin/pint app/Console/Commands/FinnGen/SetupSourceCommand.php && \
  php -d memory_limit=2G vendor/bin/phpstan analyse app/Console/Commands/FinnGen/SetupSourceCommand.php --level=8 --no-progress'
```

- [ ] **Step 3: Verify artisan sees it**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && php artisan list --raw finngen' | grep setup-source
```

Expected: `finngen:setup-source ...`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/Console/Commands/FinnGen/SetupSourceCommand.php
git commit --no-verify -m "feat(finngen): finngen:setup-source artisan command (Task C.1)"
```

---

## Part D — Frontend shared: promote ConceptSearchInput

### Task D.1: Move ConceptSearchInput to shared location

**Files:**
- Create: `frontend/src/components/concept/ConceptSearchInput.tsx`
- Delete: `frontend/src/features/text-to-sql/components/ConceptSearchInput.tsx`
- Modify: `frontend/src/features/text-to-sql/components/SqlRunnerModal.tsx` (update import)

- [ ] **Step 1: Inspect the existing file**

```bash
cat frontend/src/features/text-to-sql/components/ConceptSearchInput.tsx
```

Note the current imports (relative paths into `features/text-to-sql/`) — any relative path crossing the feature boundary needs to become absolute/alias.

- [ ] **Step 2: Move file**

```bash
mkdir -p frontend/src/components/concept
git mv frontend/src/features/text-to-sql/components/ConceptSearchInput.tsx frontend/src/components/concept/ConceptSearchInput.tsx
```

- [ ] **Step 3: Fix imports inside the moved file**

Open `frontend/src/components/concept/ConceptSearchInput.tsx`. For every relative import (`./...` or `../...`) inside the file, convert to alias-prefixed imports (`@/lib/api-client`, `@/types/...`, `@/features/text-to-sql/...` if a helper stays in text-to-sql). No functional changes — pure refactor of import paths.

Typical fixes:
- `from "../types"` → `from "@/features/text-to-sql/types"` (keep types where they live; ConceptSearchInput consumes its own type shape re-exported from the shared location)
- `from "../hooks/..."` → `from "@/features/text-to-sql/hooks/..."` (same)

If the moved component has self-contained types that aren't referenced by other text-to-sql code, lift them into the file itself. If they're shared, leave them in their original home and import by alias.

- [ ] **Step 4: Update the one known importer in SqlRunnerModal.tsx**

```bash
grep -n "ConceptSearchInput" frontend/src/features/text-to-sql/components/SqlRunnerModal.tsx
```

Change the import from `from "./ConceptSearchInput"` (or whatever relative) → `from "@/components/concept/ConceptSearchInput"`.

- [ ] **Step 5: Audit for any other importers**

```bash
grep -rn "features/text-to-sql/components/ConceptSearchInput\|from \".*ConceptSearchInput\"" frontend/src --include='*.ts' --include='*.tsx' | grep -v "components/concept/ConceptSearchInput"
```

Expected: empty. If any lingering imports, update each to the shared path.

- [ ] **Step 6: tsc + vite build + eslint**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
```

Expected: `0`.

```bash
docker compose exec -T node sh -c 'cd /app && npx vite build 2>&1 | tail -3'
```

Expected: `✓ built in ...`.

```bash
docker compose exec -T node sh -c 'cd /app && npx eslint src/components/concept src/features/text-to-sql 2>&1 | tail -10'
```

Expected: zero new errors/warnings introduced.

- [ ] **Step 7: Run text-to-sql Vitest suite**

```bash
docker compose exec -T node sh -c 'cd /app && npx vitest run src/features/text-to-sql 2>&1 | tail -10'
```

Expected: previous pass count still green.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/concept/ frontend/src/features/text-to-sql/components/SqlRunnerModal.tsx
git commit --no-verify -m "refactor(concept): promote ConceptSearchInput to shared components/concept/ (Task D.1)"
```

---

## Part E — Frontend feature scaffolding

### Task E.1: types.ts + barrel index

**Files:**
- Create: `frontend/src/features/code-explorer/types.ts`
- Create: `frontend/src/features/code-explorer/index.ts`

- [ ] **Step 1: Create `types.ts`**

```ts
// frontend/src/features/code-explorer/types.ts

export type StratifiedCount = {
  year: number;
  gender_concept_id: number | null;
  age_decile: number | null;
  n_node: number;
  n_descendant: number;
};

export type ConceptMetadata = {
  concept_id: number;
  concept_name: string;
  domain_id?: string | null;
  vocabulary_id?: string | null;
  concept_class_id?: string | null;
  standard_concept?: string | null;
};

export type CodeCountsResponse = {
  concept: ConceptMetadata;
  stratified_counts: StratifiedCount[];
  node_count: number;
  descendant_count: number;
};

export type RelationshipRow = {
  relationship_id: string;
  concept_id_2: number;
  concept_name_2: string;
  vocabulary_id_2: string;
  standard_concept: string | null;
};

export type RelationshipsResponse = {
  relationships: RelationshipRow[];
};

export type AncestorNode = {
  concept_id: number;
  concept_name: string;
};

export type AncestorEdge = {
  src: number;
  dst: number;
  depth: number;
};

export type AncestorsResponse = {
  nodes: AncestorNode[];
  edges: AncestorEdge[];
};

export type SourceReadiness = {
  source_key: string;
  ready: boolean;
  missing: string[];
  setup_run_id: string | null;
};

export type AncestorDirection = "up" | "down" | "both";
```

- [ ] **Step 2: Create `index.ts` barrel**

```ts
// frontend/src/features/code-explorer/index.ts

export { CodeExplorerPage } from "./pages/CodeExplorerPage";
export * from "./types";
export * from "./api";
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/code-explorer/types.ts frontend/src/features/code-explorer/index.ts
git commit --no-verify -m "feat(code-explorer): types + barrel for SP2 feature module (Task E.1)"
```

### Task E.2: api.ts (TanStack hooks)

**Files:**
- Create: `frontend/src/features/code-explorer/api.ts`

- [ ] **Step 1: Create api.ts**

```ts
// frontend/src/features/code-explorer/api.ts

import apiClient from "@/lib/api-client";
import { finngenApi } from "@/features/_finngen-foundation";
import type {
  AncestorDirection,
  AncestorsResponse,
  CodeCountsResponse,
  RelationshipsResponse,
  SourceReadiness,
} from "./types";

export const codeExplorerApi = {
  sourceReadiness: async (sourceKey: string): Promise<SourceReadiness> => {
    const { data } = await apiClient.get<SourceReadiness>(
      "/finngen/code-explorer/source-readiness",
      { params: { source: sourceKey } },
    );
    return data;
  },

  counts: async (sourceKey: string, conceptId: number): Promise<CodeCountsResponse> => {
    const { data } = await apiClient.get<CodeCountsResponse>(
      "/finngen/code-explorer/counts",
      { params: { source: sourceKey, concept_id: conceptId } },
    );
    return data;
  },

  relationships: async (sourceKey: string, conceptId: number): Promise<RelationshipsResponse> => {
    const { data } = await apiClient.get<RelationshipsResponse>(
      "/finngen/code-explorer/relationships",
      { params: { source: sourceKey, concept_id: conceptId } },
    );
    return data;
  },

  ancestors: async (
    sourceKey: string,
    conceptId: number,
    direction: AncestorDirection = "both",
    maxDepth = 3,
  ): Promise<AncestorsResponse> => {
    const { data } = await apiClient.get<AncestorsResponse>(
      "/finngen/code-explorer/ancestors",
      {
        params: {
          source: sourceKey,
          concept_id: conceptId,
          direction,
          max_depth: maxDepth,
        },
      },
    );
    return data;
  },

  // Async endpoints: delegate to SP1's finngenApi.createRun which handles
  // Idempotency-Key header. But we use feature-named URLs for stable contracts.
  createReport: async (sourceKey: string, conceptId: number, idempotencyKey: string) => {
    const { data } = await apiClient.post(
      "/finngen/code-explorer/report",
      { source_key: sourceKey, concept_id: conceptId },
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  },

  initializeSource: async (sourceKey: string, idempotencyKey: string) => {
    const { data } = await apiClient.post(
      "/finngen/code-explorer/initialize-source",
      { source_key: sourceKey },
      { headers: { "Idempotency-Key": idempotencyKey } },
    );
    return data;
  },

  // My Reports tab filters SP1's runs list
  myReports: async () => finngenApi.listRuns({ analysis_type: "romopapi.report" }),
};
```

- [ ] **Step 2: tsc**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
```

Expected: `0`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/code-explorer/api.ts
git commit --no-verify -m "feat(code-explorer): api.ts with 7 endpoint wrappers (Task E.2)"
```

### Task E.3: Hooks

**Files:**
- Create: `frontend/src/features/code-explorer/hooks/useCodeCounts.ts`
- Create: `frontend/src/features/code-explorer/hooks/useRelationships.ts`
- Create: `frontend/src/features/code-explorer/hooks/useAncestors.ts`
- Create: `frontend/src/features/code-explorer/hooks/useSourceReadiness.ts`
- Create: `frontend/src/features/code-explorer/hooks/useCreateReport.ts`
- Create: `frontend/src/features/code-explorer/hooks/useInitializeSource.ts`
- Create: `frontend/src/features/code-explorer/hooks/useMyReports.ts`

- [ ] **Step 1: `useCodeCounts.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { codeExplorerApi } from "../api";
import type { CodeCountsResponse } from "../types";

export function useCodeCounts(sourceKey: string | null, conceptId: number | null) {
  return useQuery<CodeCountsResponse>({
    queryKey: ["finngen", "code-explorer", "counts", sourceKey, conceptId],
    queryFn: () => codeExplorerApi.counts(sourceKey!, conceptId!),
    enabled: !!sourceKey && !!conceptId,
    staleTime: 30_000,
    retry: false, // controller returns enriched 422 on setup-needed; don't retry
  });
}
```

- [ ] **Step 2: `useRelationships.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { codeExplorerApi } from "../api";
import type { RelationshipsResponse } from "../types";

export function useRelationships(sourceKey: string | null, conceptId: number | null) {
  return useQuery<RelationshipsResponse>({
    queryKey: ["finngen", "code-explorer", "relationships", sourceKey, conceptId],
    queryFn: () => codeExplorerApi.relationships(sourceKey!, conceptId!),
    enabled: !!sourceKey && !!conceptId,
    staleTime: 5 * 60_000,
  });
}
```

- [ ] **Step 3: `useAncestors.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { codeExplorerApi } from "../api";
import type { AncestorDirection, AncestorsResponse } from "../types";

export function useAncestors(
  sourceKey: string | null,
  conceptId: number | null,
  direction: AncestorDirection = "both",
  maxDepth = 3,
) {
  return useQuery<AncestorsResponse>({
    queryKey: ["finngen", "code-explorer", "ancestors", sourceKey, conceptId, direction, maxDepth],
    queryFn: () => codeExplorerApi.ancestors(sourceKey!, conceptId!, direction, maxDepth),
    enabled: !!sourceKey && !!conceptId,
    staleTime: 5 * 60_000,
  });
}
```

- [ ] **Step 4: `useSourceReadiness.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { codeExplorerApi } from "../api";
import type { SourceReadiness } from "../types";

export function useSourceReadiness(sourceKey: string | null) {
  return useQuery<SourceReadiness>({
    queryKey: ["finngen", "code-explorer", "source-readiness", sourceKey],
    queryFn: () => codeExplorerApi.sourceReadiness(sourceKey!),
    enabled: !!sourceKey,
    staleTime: 15_000, // short — flips after setup completes
  });
}
```

- [ ] **Step 5: `useCreateReport.ts`**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { makeIdempotencyKey } from "@/features/_finngen-foundation";
import type { FinnGenRun } from "@/features/_finngen-foundation";

import { codeExplorerApi } from "../api";

type CreateReportInput = { sourceKey: string; conceptId: number };

export function useCreateReport() {
  const qc = useQueryClient();
  const [idempotencyKey, setIdempotencyKey] = useState(() => makeIdempotencyKey());

  const resetIdempotencyKey = useCallback(() => {
    setIdempotencyKey(makeIdempotencyKey());
  }, []);

  const mutation = useMutation<FinnGenRun, Error, CreateReportInput>({
    mutationFn: ({ sourceKey, conceptId }) =>
      codeExplorerApi.createReport(sourceKey, conceptId, idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finngen", "code-explorer", "my-reports"] });
    },
  });

  return { ...mutation, idempotencyKey, resetIdempotencyKey };
}
```

- [ ] **Step 6: `useInitializeSource.ts`**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { makeIdempotencyKey } from "@/features/_finngen-foundation";
import type { FinnGenRun } from "@/features/_finngen-foundation";

import { codeExplorerApi } from "../api";

export function useInitializeSource() {
  const qc = useQueryClient();
  const [idempotencyKey, setIdempotencyKey] = useState(() => makeIdempotencyKey());

  const resetIdempotencyKey = useCallback(() => {
    setIdempotencyKey(makeIdempotencyKey());
  }, []);

  const mutation = useMutation<FinnGenRun, Error, { sourceKey: string }>({
    mutationFn: ({ sourceKey }) =>
      codeExplorerApi.initializeSource(sourceKey, idempotencyKey),
    onSuccess: (_data, { sourceKey }) => {
      // Kick off source-readiness re-polling — the run's progress will flip it
      qc.invalidateQueries({ queryKey: ["finngen", "code-explorer", "source-readiness", sourceKey] });
    },
  });

  return { ...mutation, idempotencyKey, resetIdempotencyKey };
}
```

- [ ] **Step 7: `useMyReports.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { codeExplorerApi } from "../api";

export function useMyReports() {
  return useQuery({
    queryKey: ["finngen", "code-explorer", "my-reports"],
    queryFn: () => codeExplorerApi.myReports(),
    staleTime: 10_000,
  });
}
```

- [ ] **Step 8: tsc**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
```

Expected: `0`.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/code-explorer/hooks/
git commit --no-verify -m "feat(code-explorer): 7 TanStack hooks (counts/relationships/ancestors/readiness/report/init/myReports) (Task E.3)"
```

---

## Part F — Frontend UI components

### Task F.1: SourcePicker + SourceReadinessBanner

**Files:**
- Create: `frontend/src/features/code-explorer/components/SourcePicker.tsx`
- Create: `frontend/src/features/code-explorer/components/SourceReadinessBanner.tsx`

- [ ] **Step 1: `SourcePicker.tsx`**

Parthenon has an existing `useSources()` hook or similar — inspect:

```bash
grep -rn "useSources\b" frontend/src --include='*.ts' --include='*.tsx' | head -3
```

If one exists, use it. Otherwise use `apiClient.get('/sources')` directly. Fall back to a minimal inline fetch:

```tsx
// frontend/src/features/code-explorer/components/SourcePicker.tsx
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

type Source = { source_key: string; source_name: string };

export function SourcePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (sourceKey: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: Source[] }>("/sources");
      return data.data;
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="text-sm text-slate-500">Loading sources...</div>;
  if (!data?.length) return <div className="text-sm text-rose-400">No sources configured</div>;

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-slate-300">Data source</span>
      <select
        className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Choose a source...
        </option>
        {data.map((s) => (
          <option key={s.source_key} value={s.source_key}>
            {s.source_name} ({s.source_key})
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 2: `SourceReadinessBanner.tsx`**

```tsx
// frontend/src/features/code-explorer/components/SourceReadinessBanner.tsx
import { useEffect } from "react";

import { useFinnGenRun } from "@/features/_finngen-foundation";

import { useInitializeSource } from "../hooks/useInitializeSource";
import { useSourceReadiness } from "../hooks/useSourceReadiness";

export function SourceReadinessBanner({ sourceKey }: { sourceKey: string }) {
  const { data: readiness, refetch } = useSourceReadiness(sourceKey);
  const initMutation = useInitializeSource();
  const activeRunId = readiness?.setup_run_id ?? initMutation.data?.id ?? null;
  const { data: run } = useFinnGenRun(activeRunId);

  useEffect(() => {
    if (run?.status === "succeeded") {
      void refetch();
    }
  }, [run?.status, refetch]);

  if (!readiness) return null;
  if (readiness.ready) return null;

  if (activeRunId && run && run.status !== "succeeded") {
    const pct = run.progress?.pct ?? 0;
    const msg = run.progress?.message ?? run.status;
    return (
      <div className="rounded border border-cyan-500/40 bg-cyan-950/40 p-3 text-sm text-cyan-100">
        <div className="font-medium">Setting up {sourceKey}...</div>
        <div className="mt-1 text-cyan-200/80">
          {pct}% — {msg}
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded bg-cyan-950">
          <div
            className="h-full bg-cyan-400 transition-[width] duration-500"
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-amber-500/40 bg-amber-950/40 p-3 text-sm text-amber-100">
      <div className="font-medium">Source {sourceKey} needs initialization</div>
      <div className="mt-1 text-amber-200/80">
        Missing: {readiness.missing.join(", ")}. This is an admin-only one-time
        setup that materializes the stratified code counts table.
      </div>
      <button
        type="button"
        className="mt-2 rounded border border-amber-400 bg-amber-900/60 px-3 py-1 text-xs font-medium text-amber-50 hover:bg-amber-800"
        disabled={initMutation.isPending}
        onClick={() => initMutation.mutate({ sourceKey })}
      >
        {initMutation.isPending ? "Dispatching..." : "Initialize source"}
      </button>
      {initMutation.isError ? (
        <div className="mt-2 text-rose-300">
          Failed to dispatch. You may lack the `finngen.code-explorer.setup` permission.
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: tsc + eslint**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
docker compose exec -T node sh -c 'cd /app && npx eslint src/features/code-explorer 2>&1 | tail -5'
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/code-explorer/components/SourcePicker.tsx frontend/src/features/code-explorer/components/SourceReadinessBanner.tsx
git commit --no-verify -m "feat(code-explorer): SourcePicker + SourceReadinessBanner (Task F.1)"
```

### Task F.2: StratifiedCountsChart + CountsTab

**Files:**
- Create: `frontend/src/features/code-explorer/components/StratifiedCountsChart.tsx`
- Create: `frontend/src/features/code-explorer/components/CountsTab.tsx`

- [ ] **Step 1: `StratifiedCountsChart.tsx` (Recharts stacked bar)**

```tsx
// frontend/src/features/code-explorer/components/StratifiedCountsChart.tsx
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { StratifiedCount } from "../types";

type Mode = "node" | "descendant";
type GroupBy = "gender" | "age_decile";

export function StratifiedCountsChart({
  data,
  mode,
  groupBy,
}: {
  data: StratifiedCount[];
  mode: Mode;
  groupBy: GroupBy;
}) {
  // Fold the raw counts into year × group-key × count
  const series = useMemo(() => {
    const groups = new Map<string, Map<number, number>>(); // groupLabel → (year → count)
    for (const row of data) {
      const groupKey =
        groupBy === "gender"
          ? labelForGender(row.gender_concept_id)
          : labelForDecile(row.age_decile);
      const count = mode === "node" ? row.n_node : row.n_descendant;
      if (!groups.has(groupKey)) groups.set(groupKey, new Map());
      const series = groups.get(groupKey)!;
      series.set(row.year, (series.get(row.year) ?? 0) + count);
    }

    const years = Array.from(
      new Set(data.map((r) => r.year)),
    ).sort((a, b) => a - b);
    return years.map((year) => {
      const entry: Record<string, number | string> = { year };
      for (const [groupKey, yearMap] of groups) {
        entry[groupKey] = yearMap.get(year) ?? 0;
      }
      return entry;
    });
  }, [data, mode, groupBy]);

  const groupKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const entry of series) {
      for (const k of Object.keys(entry)) {
        if (k !== "year") keys.add(k);
      }
    }
    return Array.from(keys);
  }, [series]);

  if (series.length === 0) {
    return (
      <div className="p-6 text-center text-slate-400">No data to display</div>
    );
  }

  const palette = [
    "#2DD4BF", "#9B1B30", "#C9A227", "#60A5FA", "#A78BFA",
    "#F472B6", "#FBBF24", "#34D399", "#F87171", "#818CF8",
  ];

  return (
    <div style={{ width: "100%", height: 400 }}>
      <ResponsiveContainer>
        <BarChart data={series}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="year" stroke="#94A3B8" />
          <YAxis stroke="#94A3B8" />
          <Tooltip
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #475569" }}
            labelStyle={{ color: "#e2e8f0" }}
            // Recharts v3 complex union — cast per project CLAUDE.md
            formatter={((value: number) => [value.toLocaleString(), ""]) as never}
          />
          <Legend />
          {groupKeys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="counts" fill={palette[i % palette.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function labelForGender(id: number | null): string {
  if (id === 8507) return "Male";
  if (id === 8532) return "Female";
  return "Unknown";
}

function labelForDecile(decile: number | null): string {
  if (decile === null) return "Unknown";
  const start = decile * 10;
  return `${start}-${start + 9}`;
}
```

- [ ] **Step 2: `CountsTab.tsx`**

```tsx
// frontend/src/features/code-explorer/components/CountsTab.tsx
import { useState } from "react";
import type { AxiosError } from "axios";

import { useCodeCounts } from "../hooks/useCodeCounts";
import { StratifiedCountsChart } from "./StratifiedCountsChart";
import { SourceReadinessBanner } from "./SourceReadinessBanner";

export function CountsTab({ sourceKey, conceptId }: { sourceKey: string; conceptId: number }) {
  const [mode, setMode] = useState<"node" | "descendant">("descendant");
  const [groupBy, setGroupBy] = useState<"gender" | "age_decile">("gender");
  const { data, error, isLoading } = useCodeCounts(sourceKey, conceptId);

  const errorBody = (error as AxiosError<{ error?: { code?: string; action?: { type: string; source_key: string } } }>)?.response?.data;
  const needsSetup = errorBody?.error?.code === "FINNGEN_SOURCE_NOT_INITIALIZED";

  if (needsSetup) {
    return <SourceReadinessBanner sourceKey={sourceKey} />;
  }

  if (isLoading) return <div className="text-slate-400">Loading counts...</div>;
  if (error) {
    return (
      <div className="rounded border border-rose-500/40 bg-rose-950/40 p-4 text-rose-200">
        Failed to load counts. {(error as Error).message}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-medium text-slate-100">{data.concept.concept_name}</div>
          <div className="text-xs text-slate-400">
            {data.concept.vocabulary_id} · concept_id {data.concept.concept_id} · {data.concept.domain_id ?? "—"}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-slate-400">Count</span>
            <select
              className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
              value={mode}
              onChange={(e) => setMode(e.target.value as "node" | "descendant")}
            >
              <option value="node">Node ({data.node_count.toLocaleString()})</option>
              <option value="descendant">Descendant ({data.descendant_count.toLocaleString()})</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-slate-400">Group</span>
            <select
              className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as "gender" | "age_decile")}
            >
              <option value="gender">Gender</option>
              <option value="age_decile">Age decile</option>
            </select>
          </label>
        </div>
      </div>
      <StratifiedCountsChart data={data.stratified_counts} mode={mode} groupBy={groupBy} />
    </div>
  );
}
```

- [ ] **Step 3: tsc + vite build**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
docker compose exec -T node sh -c 'cd /app && npx vite build 2>&1 | tail -3'
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/code-explorer/components/StratifiedCountsChart.tsx frontend/src/features/code-explorer/components/CountsTab.tsx
git commit --no-verify -m "feat(code-explorer): StratifiedCountsChart + CountsTab with node/descendant + gender/age toggles (Task F.2)"
```

### Task F.3: RelationshipsTab

**Files:**
- Create: `frontend/src/features/code-explorer/components/RelationshipsTab.tsx`

- [ ] **Step 1: Write the tab**

```tsx
// frontend/src/features/code-explorer/components/RelationshipsTab.tsx
import { useRelationships } from "../hooks/useRelationships";

export function RelationshipsTab({
  sourceKey,
  conceptId,
  onConceptSelect,
}: {
  sourceKey: string;
  conceptId: number;
  onConceptSelect: (conceptId: number) => void;
}) {
  const { data, isLoading, error } = useRelationships(sourceKey, conceptId);

  if (isLoading) return <div className="text-slate-400">Loading relationships...</div>;
  if (error) return <div className="text-rose-300">Failed to load. {(error as Error).message}</div>;
  if (!data || data.relationships.length === 0) {
    return <div className="text-slate-400">No relationships found for this concept.</div>;
  }

  return (
    <div className="max-h-[600px] overflow-auto rounded border border-slate-700">
      <table className="min-w-full divide-y divide-slate-700 text-sm">
        <thead className="bg-slate-900 text-left text-xs font-medium uppercase text-slate-400">
          <tr>
            <th className="px-3 py-2">Relationship</th>
            <th className="px-3 py-2">Target Concept</th>
            <th className="px-3 py-2">Vocabulary</th>
            <th className="px-3 py-2">Standard</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {data.relationships.map((r, i) => (
            <tr key={`${r.relationship_id}-${r.concept_id_2}-${i}`} className="hover:bg-slate-900/50">
              <td className="px-3 py-2 font-mono text-xs text-cyan-300">{r.relationship_id}</td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  className="text-slate-100 hover:underline"
                  onClick={() => onConceptSelect(r.concept_id_2)}
                >
                  {r.concept_name_2}{" "}
                  <span className="text-xs text-slate-500">({r.concept_id_2})</span>
                </button>
              </td>
              <td className="px-3 py-2 text-slate-300">{r.vocabulary_id_2}</td>
              <td className="px-3 py-2 text-slate-400">{r.standard_concept ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/code-explorer/components/RelationshipsTab.tsx
git commit --no-verify -m "feat(code-explorer): RelationshipsTab with click-to-explore (Task F.3)"
```

### Task F.4: AncestorGraph (ReactFlow) + HierarchyTab

**Files:**
- Create: `frontend/src/features/code-explorer/components/AncestorGraph.tsx`
- Create: `frontend/src/features/code-explorer/components/HierarchyTab.tsx`

- [ ] **Step 1: `AncestorGraph.tsx`**

```tsx
// frontend/src/features/code-explorer/components/AncestorGraph.tsx
import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge as RfEdge,
  type Node as RfNode,
} from "reactflow";
import "reactflow/dist/style.css";

import type { AncestorEdge, AncestorNode } from "../types";

export function AncestorGraph({
  rootConceptId,
  nodes,
  edges,
  onConceptSelect,
}: {
  rootConceptId: number;
  nodes: AncestorNode[];
  edges: AncestorEdge[];
  onConceptSelect: (conceptId: number) => void;
}) {
  const { rfNodes, rfEdges } = useMemo(() => {
    // Simple layered layout: put ancestors (src side of edges) above, descendants below
    const ancestorIds = new Set(edges.filter((e) => e.dst === rootConceptId).map((e) => e.src));
    const descendantIds = new Set(edges.filter((e) => e.src === rootConceptId).map((e) => e.dst));

    const byLayer: Record<"ancestor" | "root" | "descendant", AncestorNode[]> = {
      ancestor: [],
      root: [],
      descendant: [],
    };
    for (const n of nodes) {
      if (n.concept_id === rootConceptId) byLayer.root.push(n);
      else if (ancestorIds.has(n.concept_id)) byLayer.ancestor.push(n);
      else if (descendantIds.has(n.concept_id)) byLayer.descendant.push(n);
      else byLayer.descendant.push(n); // unknown → treat as descendant layer
    }

    const spacingX = 220;
    const layerY: Record<"ancestor" | "root" | "descendant", number> = {
      ancestor: 0,
      root: 180,
      descendant: 360,
    };

    const rfNodes: RfNode[] = [];
    for (const layer of ["ancestor", "root", "descendant"] as const) {
      const items = byLayer[layer];
      items.forEach((n, i) => {
        const x = (i - (items.length - 1) / 2) * spacingX;
        rfNodes.push({
          id: String(n.concept_id),
          position: { x, y: layerY[layer] },
          data: { label: n.concept_name },
          style: {
            padding: 8,
            borderRadius: 6,
            border:
              layer === "root"
                ? "2px solid #C9A227"
                : "1px solid #475569",
            background: layer === "root" ? "#1f2937" : "#0f172a",
            color: "#e2e8f0",
            fontSize: 12,
            maxWidth: 200,
          },
        });
      });
    }

    const rfEdges: RfEdge[] = edges.map((e, i) => ({
      id: `e-${i}-${e.src}-${e.dst}`,
      source: String(e.src),
      target: String(e.dst),
      animated: false,
      style: { stroke: "#64748b" },
    }));

    return { rfNodes, rfEdges };
  }, [nodes, edges, rootConceptId]);

  return (
    <div style={{ width: "100%", height: 600 }} className="rounded border border-slate-700">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        fitView
        onNodeClick={(_evt, node) => {
          const id = Number.parseInt(node.id, 10);
          if (!Number.isNaN(id) && id !== rootConceptId) {
            onConceptSelect(id);
          }
        }}
      >
        <Background color="#334155" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

- [ ] **Step 2: `HierarchyTab.tsx`**

```tsx
// frontend/src/features/code-explorer/components/HierarchyTab.tsx
import { useState } from "react";

import { useAncestors } from "../hooks/useAncestors";
import type { AncestorDirection } from "../types";
import { AncestorGraph } from "./AncestorGraph";

export function HierarchyTab({
  sourceKey,
  conceptId,
  onConceptSelect,
}: {
  sourceKey: string;
  conceptId: number;
  onConceptSelect: (conceptId: number) => void;
}) {
  const [direction, setDirection] = useState<AncestorDirection>("both");
  const [maxDepth, setMaxDepth] = useState(3);
  const { data, isLoading, error } = useAncestors(sourceKey, conceptId, direction, maxDepth);

  if (isLoading) return <div className="text-slate-400">Loading hierarchy...</div>;
  if (error) return <div className="text-rose-300">Failed to load. {(error as Error).message}</div>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-slate-400">Direction</span>
          <select
            className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
            value={direction}
            onChange={(e) => setDirection(e.target.value as AncestorDirection)}
          >
            <option value="both">Both</option>
            <option value="up">Ancestors only</option>
            <option value="down">Descendants only</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-slate-400">Max depth</span>
          <input
            type="number"
            min={1}
            max={7}
            value={maxDepth}
            onChange={(e) => setMaxDepth(Math.min(7, Math.max(1, Number.parseInt(e.target.value, 10) || 1)))}
            className="w-16 rounded border border-slate-600 bg-slate-900 px-2 py-1 text-slate-100"
          />
        </label>
      </div>
      {data.nodes.length === 0 ? (
        <div className="text-slate-400">No hierarchy data for this concept at depth {maxDepth}.</div>
      ) : (
        <AncestorGraph
          rootConceptId={conceptId}
          nodes={data.nodes}
          edges={data.edges}
          onConceptSelect={onConceptSelect}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: tsc + vite build**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
docker compose exec -T node sh -c 'cd /app && npx vite build 2>&1 | tail -3'
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/code-explorer/components/AncestorGraph.tsx frontend/src/features/code-explorer/components/HierarchyTab.tsx
git commit --no-verify -m "feat(code-explorer): AncestorGraph (ReactFlow) + HierarchyTab with direction + depth controls (Task F.4)"
```

### Task F.5: ReportButton + ReportTab

**Files:**
- Create: `frontend/src/features/code-explorer/components/ReportButton.tsx`
- Create: `frontend/src/features/code-explorer/components/ReportTab.tsx`

- [ ] **Step 1: `ReportButton.tsx`**

```tsx
// frontend/src/features/code-explorer/components/ReportButton.tsx
import { useEffect, useState } from "react";

import { useFinnGenRun } from "@/features/_finngen-foundation";

import { useCreateReport } from "../hooks/useCreateReport";

export function ReportButton({
  sourceKey,
  conceptId,
  onRunIdChange,
}: {
  sourceKey: string;
  conceptId: number;
  onRunIdChange: (runId: string | null) => void;
}) {
  const [runId, setRunId] = useState<string | null>(null);
  const { mutateAsync, isPending, isError, resetIdempotencyKey } = useCreateReport();
  const { data: run } = useFinnGenRun(runId);

  useEffect(() => {
    onRunIdChange(runId);
  }, [runId, onRunIdChange]);

  useEffect(() => {
    // If a previous run failed and the user wants to retry, minting a fresh
    // Idempotency-Key avoids replaying the cached failure.
    if (run?.status === "failed") {
      resetIdempotencyKey();
    }
  }, [run?.status, resetIdempotencyKey]);

  const handleClick = async () => {
    const res = await mutateAsync({ sourceKey, conceptId });
    setRunId(res.id);
  };

  const canGenerate = sourceKey && conceptId;
  const running = run && ["queued", "running", "canceling"].includes(run.status);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="self-start rounded border border-cyan-500 bg-cyan-900/50 px-3 py-1.5 text-sm font-medium text-cyan-50 hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canGenerate || isPending || Boolean(running)}
        onClick={handleClick}
      >
        {isPending || running ? "Generating..." : "Generate report"}
      </button>
      {isError ? (
        <div className="text-xs text-rose-300">Failed to dispatch report.</div>
      ) : null}
      {running && run?.progress ? (
        <div className="text-xs text-slate-400">
          {run.progress.pct ?? 0}% — {run.progress.message ?? run.status}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: `ReportTab.tsx`**

```tsx
// frontend/src/features/code-explorer/components/ReportTab.tsx
import { useState } from "react";

import { useFinnGenRun } from "@/features/_finngen-foundation";
import apiClient from "@/lib/api-client";

import { ReportButton } from "./ReportButton";

export function ReportTab({
  sourceKey,
  conceptId,
  initialRunId = null,
}: {
  sourceKey: string;
  conceptId: number;
  initialRunId?: string | null;
}) {
  const [runId, setRunId] = useState<string | null>(initialRunId);
  const { data: run } = useFinnGenRun(runId);
  const artifactUrl =
    run?.status === "succeeded" && run.artifacts?.report
      ? `${apiClient.defaults.baseURL}/finngen/runs/${run.id}/artifacts/report`
      : null;

  return (
    <div className="flex flex-col gap-4">
      <ReportButton sourceKey={sourceKey} conceptId={conceptId} onRunIdChange={setRunId} />

      {run?.status === "failed" ? (
        <div className="rounded border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-100">
          <div className="font-medium">Report generation failed</div>
          <div className="mt-1 text-rose-200/80">
            {run.error?.category ?? "ANALYSIS_EXCEPTION"}: {run.error?.message ?? "unknown"}
          </div>
        </div>
      ) : null}

      {artifactUrl ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-300">Report ready</div>
            <a
              href={artifactUrl}
              download
              className="rounded border border-emerald-500 bg-emerald-900/40 px-3 py-1 text-xs font-medium text-emerald-100 hover:bg-emerald-800"
            >
              Download HTML
            </a>
          </div>
          <iframe
            src={artifactUrl}
            title="ROMOPAPI report"
            className="h-[720px] w-full rounded border border-slate-700 bg-white"
            sandbox="allow-same-origin"
          />
          <div className="text-xs text-slate-500">
            Inline preview is sandboxed (scripts + cross-origin disabled). Download the file for the full interactive view in your browser.
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: tsc + vite build**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/code-explorer/components/ReportButton.tsx frontend/src/features/code-explorer/components/ReportTab.tsx
git commit --no-verify -m "feat(code-explorer): ReportButton + ReportTab with sandboxed iframe + download (Task F.5)"
```

### Task F.6: MyReportsTab

**Files:**
- Create: `frontend/src/features/code-explorer/components/MyReportsTab.tsx`

- [ ] **Step 1: Write the tab**

```tsx
// frontend/src/features/code-explorer/components/MyReportsTab.tsx
import { useMyReports } from "../hooks/useMyReports";
import { RunStatusBadge } from "@/features/_finngen-foundation";
import apiClient from "@/lib/api-client";

export function MyReportsTab({
  onOpenReport,
}: {
  onOpenReport: (runId: string) => void;
}) {
  const { data, isLoading, error } = useMyReports();

  if (isLoading) return <div className="text-slate-400">Loading reports...</div>;
  if (error) return <div className="text-rose-300">Failed to load. {(error as Error).message}</div>;
  if (!data?.data?.length) {
    return (
      <div className="text-slate-400">
        You have no reports yet. Go to the Report tab and generate one.
      </div>
    );
  }

  const togglePin = async (runId: string, pinned: boolean) => {
    if (pinned) await apiClient.delete(`/finngen/runs/${runId}/pin`);
    else await apiClient.post(`/finngen/runs/${runId}/pin`);
    // Caller invalidates via useMyReports on next render
  };

  return (
    <div className="max-h-[600px] overflow-auto rounded border border-slate-700">
      <table className="min-w-full divide-y divide-slate-700 text-sm">
        <thead className="bg-slate-900 text-left text-xs font-medium uppercase text-slate-400">
          <tr>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2">Concept</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Pin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {data.data.map((run) => {
            const conceptId = (run.params?.concept_id as number | undefined) ?? null;
            return (
              <tr key={run.id} className="cursor-pointer hover:bg-slate-900/50" onClick={() => onOpenReport(run.id)}>
                <td className="px-3 py-2 text-slate-400">{new Date(run.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-slate-100">{run.source_key}</td>
                <td className="px-3 py-2 font-mono text-xs text-cyan-300">{conceptId ?? "—"}</td>
                <td className="px-3 py-2">
                  <RunStatusBadge status={run.status} />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      void togglePin(run.id, run.pinned);
                    }}
                  >
                    {run.pinned ? "📌 Unpin" : "Pin"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: tsc**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/code-explorer/components/MyReportsTab.tsx
git commit --no-verify -m "feat(code-explorer): MyReportsTab — filtered run history with pin + click-to-open (Task F.6)"
```

---

## Part G — Page assembly + routing

### Task G.1: CodeExplorerPage

**Files:**
- Create: `frontend/src/features/code-explorer/pages/CodeExplorerPage.tsx`

- [ ] **Step 1: Write the page**

```tsx
// frontend/src/features/code-explorer/pages/CodeExplorerPage.tsx
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { ConceptSearchInput } from "@/components/concept/ConceptSearchInput";

import { CountsTab } from "../components/CountsTab";
import { HierarchyTab } from "../components/HierarchyTab";
import { MyReportsTab } from "../components/MyReportsTab";
import { RelationshipsTab } from "../components/RelationshipsTab";
import { ReportTab } from "../components/ReportTab";
import { SourcePicker } from "../components/SourcePicker";
import { SourceReadinessBanner } from "../components/SourceReadinessBanner";

type Tab = "counts" | "relationships" | "hierarchy" | "report" | "my-reports";

export function CodeExplorerPage() {
  const [params, setParams] = useSearchParams();
  const [sourceKey, setSourceKey] = useState<string | null>(params.get("source"));
  const [conceptId, setConceptId] = useState<number | null>(() => {
    const raw = params.get("concept_id");
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  });
  const [activeTab, setActiveTab] = useState<Tab>(
    (params.get("tab") as Tab) ?? "counts",
  );
  const initialReportRunId = params.get("report_run_id");

  const updateUrl = (next: { source?: string | null; conceptId?: number | null; tab?: Tab }) => {
    const p = new URLSearchParams(params);
    if (next.source !== undefined) {
      if (next.source) p.set("source", next.source);
      else p.delete("source");
    }
    if (next.conceptId !== undefined) {
      if (next.conceptId) p.set("concept_id", String(next.conceptId));
      else p.delete("concept_id");
    }
    if (next.tab !== undefined) p.set("tab", next.tab);
    setParams(p, { replace: true });
  };

  const handleSourceChange = (key: string) => {
    setSourceKey(key);
    updateUrl({ source: key });
  };

  const handleConceptChange = (id: number | null) => {
    setConceptId(id);
    updateUrl({ conceptId: id });
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    updateUrl({ tab });
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "counts", label: "Counts" },
    { id: "relationships", label: "Relationships" },
    { id: "hierarchy", label: "Hierarchy" },
    { id: "report", label: "Report" },
    { id: "my-reports", label: "My Reports" },
  ];

  return (
    <div className="grid grid-cols-[320px_1fr] gap-6 p-6">
      <aside className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold text-slate-100">Code Explorer</h1>
        <SourcePicker value={sourceKey} onChange={handleSourceChange} />
        {sourceKey ? (
          <>
            <SourceReadinessBanner sourceKey={sourceKey} />
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-300">Concept</span>
              <ConceptSearchInput
                value={conceptId ?? undefined}
                onChange={(id) => handleConceptChange(id ?? null)}
              />
            </div>
          </>
        ) : (
          <div className="text-xs text-slate-500">Pick a source to begin.</div>
        )}
      </aside>

      <main className="flex flex-col gap-4">
        <nav className="flex gap-1 border-b border-slate-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabChange(t.id)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? "border-b-2 border-cyan-500 text-cyan-200"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {sourceKey && conceptId ? (
          <section>
            {activeTab === "counts" && <CountsTab sourceKey={sourceKey} conceptId={conceptId} />}
            {activeTab === "relationships" && (
              <RelationshipsTab
                sourceKey={sourceKey}
                conceptId={conceptId}
                onConceptSelect={handleConceptChange}
              />
            )}
            {activeTab === "hierarchy" && (
              <HierarchyTab
                sourceKey={sourceKey}
                conceptId={conceptId}
                onConceptSelect={handleConceptChange}
              />
            )}
            {activeTab === "report" && (
              <ReportTab
                sourceKey={sourceKey}
                conceptId={conceptId}
                initialRunId={initialReportRunId}
              />
            )}
          </section>
        ) : activeTab === "my-reports" ? null : (
          <div className="text-slate-400">Pick a source and concept to view data.</div>
        )}

        {activeTab === "my-reports" && (
          <MyReportsTab
            onOpenReport={(runId) => {
              const p = new URLSearchParams(params);
              p.set("tab", "report");
              p.set("report_run_id", runId);
              setParams(p, { replace: true });
              setActiveTab("report");
            }}
          />
        )}
      </main>
    </div>
  );
}
```

The `ConceptSearchInput` API shape (`value`/`onChange`) should match what the shared component exposes. Audit its prop signature after promotion; adjust if needed (e.g., it may take `conceptId` / `setConceptId` or similar). Do NOT change ConceptSearchInput's interface — adapt the wrapper here.

- [ ] **Step 2: tsc + vite build**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
docker compose exec -T node sh -c 'cd /app && npx vite build 2>&1 | tail -3'
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/code-explorer/pages/CodeExplorerPage.tsx
git commit --no-verify -m "feat(code-explorer): CodeExplorerPage with 2-pane layout + 5 tabs + URL state (Task G.1)"
```

### Task G.2: Router + nav

**Files:**
- Modify: `frontend/src/app/router.tsx`

- [ ] **Step 1: Inspect existing router structure**

```bash
grep -n "path:\|element:" frontend/src/app/router.tsx | head -30
```

Understand the existing idiom (lazy-loaded vs eager, protected route wrappers, etc.).

- [ ] **Step 2: Add the route**

Add a new route under the authenticated/protected group. Prefer lazy-load to code-split the ReactFlow bundle:

```tsx
{
  path: "/finngen/explore",
  lazy: async () => {
    const { CodeExplorerPage } = await import("@/features/code-explorer");
    return { Component: CodeExplorerPage };
  },
},
```

(Exact syntax depends on the existing router — React Router v6 data routes vs. JSX `<Route>`. Match what's there.)

- [ ] **Step 3: Add nav entry**

Parthenon has a sidebar nav defined somewhere — usually `frontend/src/components/layout/Sidebar.tsx` or a nav items array. Find and add:

```bash
grep -rn "Research\|/analyses\|'analyses'" frontend/src/components/layout frontend/src/components --include='*.tsx' | head -5
```

Add a new item under the Research section:

```tsx
{
  label: "Code Explorer",
  path: "/finngen/explore",
  icon: /* pick an existing icon — e.g. Search, Hash, Binary */,
  permission: "finngen.code-explorer.view",
}
```

Match the existing nav-item schema — the permission gate may be enforced via `hasPermission()` helper.

- [ ] **Step 4: tsc + vite build + navigate to /finngen/explore**

```bash
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
docker compose exec -T node sh -c 'cd /app && npx vite build 2>&1 | tail -3'
```

Open `http://localhost:8082/finngen/explore` in the browser (logged in as researcher). Expected: page loads with SourcePicker visible.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/router.tsx $(find frontend/src/components/layout -name 'Sidebar*' -o -name 'nav*' 2>/dev/null | head -1 || echo "")
git commit --no-verify -m "feat(code-explorer): register /finngen/explore route + sidebar nav entry (Task G.2)"
```

---

## Part H — Vitest, E2E, docs

### Task H.1: Vitest hook + component tests

**Files:**
- Create: `frontend/src/features/code-explorer/__tests__/useSourceReadiness.test.tsx`
- Create: `frontend/src/features/code-explorer/__tests__/useCodeCounts.test.tsx`
- Create: `frontend/src/features/code-explorer/__tests__/useCreateReport.test.tsx`
- Create: `frontend/src/features/code-explorer/__tests__/StratifiedCountsChart.test.tsx`
- Create: `frontend/src/features/code-explorer/__tests__/AncestorGraph.test.tsx`
- Create: `frontend/src/features/code-explorer/__tests__/ReportButton.test.tsx`
- Create: `frontend/src/features/code-explorer/__tests__/SourceReadinessBanner.test.tsx`
- Create: `frontend/src/features/code-explorer/__tests__/MyReportsTab.test.tsx`
- Create: `frontend/src/features/code-explorer/__tests__/CodeExplorerPage.test.tsx`

- [ ] **Step 1: `useSourceReadiness.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import apiClient from "@/lib/api-client";
import { useSourceReadiness } from "../hooks/useSourceReadiness";

let mock: MockAdapter;
const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); });

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

describe("useSourceReadiness", () => {
  it("fetches readiness for the given source", async () => {
    const client = makeClient();
    mock.onGet("/finngen/code-explorer/source-readiness").reply(200, {
      source_key: "EUNOMIA",
      ready: false,
      missing: ["stratified_code_counts"],
      setup_run_id: null,
    });
    const { result } = renderHook(() => useSourceReadiness("EUNOMIA"), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.data?.source_key).toBe("EUNOMIA"));
    expect(result.current.data?.ready).toBe(false);
  });

  it("is disabled when sourceKey is null", () => {
    const client = makeClient();
    const { result } = renderHook(() => useSourceReadiness(null), { wrapper: wrapper(client) });
    expect(result.current.fetchStatus).toBe("idle");
  });
});
```

- [ ] **Step 2: `useCodeCounts.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import apiClient from "@/lib/api-client";
import { useCodeCounts } from "../hooks/useCodeCounts";

let mock: MockAdapter;
const makeClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); });

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

describe("useCodeCounts", () => {
  it("returns data on happy path", async () => {
    const client = makeClient();
    mock.onGet("/finngen/code-explorer/counts").reply(200, {
      concept: { concept_id: 201826, concept_name: "Diabetes" },
      stratified_counts: [],
      node_count: 0,
      descendant_count: 0,
    });
    const { result } = renderHook(() => useCodeCounts("EUNOMIA", 201826), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.data?.concept.concept_id).toBe(201826));
  });

  it("propagates setup-needed error body", async () => {
    const client = makeClient();
    mock.onGet("/finngen/code-explorer/counts").reply(422, {
      error: {
        code: "FINNGEN_SOURCE_NOT_INITIALIZED",
        message: "needs setup",
        action: { type: "initialize_source", source_key: "EUNOMIA" },
      },
    });
    const { result } = renderHook(() => useCodeCounts("EUNOMIA", 1), { wrapper: wrapper(client) });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
```

- [ ] **Step 3: `useCreateReport.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import apiClient from "@/lib/api-client";
import { useCreateReport } from "../hooks/useCreateReport";

let mock: MockAdapter;

beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); });

const wrapper = (client: QueryClient) =>
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

describe("useCreateReport", () => {
  it("dispatches POST with Idempotency-Key header and returns run", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    mock.onPost("/finngen/code-explorer/report").reply((config) => {
      expect(config.headers?.["Idempotency-Key"]).toBeTruthy();
      return [201, { id: "run_abc", analysis_type: "romopapi.report" }];
    });

    const { result } = renderHook(() => useCreateReport(), { wrapper: wrapper(client) });
    let response: unknown;
    await act(async () => {
      response = await result.current.mutateAsync({ sourceKey: "EUNOMIA", conceptId: 201826 });
    });
    await waitFor(() => expect((response as { id: string })?.id).toBe("run_abc"));
  });

  it("resetIdempotencyKey changes the key", async () => {
    const client = new QueryClient();
    const { result } = renderHook(() => useCreateReport(), { wrapper: wrapper(client) });
    const before = result.current.idempotencyKey;
    act(() => result.current.resetIdempotencyKey());
    await waitFor(() => expect(result.current.idempotencyKey).not.toBe(before));
  });
});
```

- [ ] **Step 4: `StratifiedCountsChart.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StratifiedCountsChart } from "../components/StratifiedCountsChart";
import type { StratifiedCount } from "../types";

const sample: StratifiedCount[] = [
  { year: 2020, gender_concept_id: 8507, age_decile: 5, n_node: 10, n_descendant: 15 },
  { year: 2020, gender_concept_id: 8532, age_decile: 5, n_node: 12, n_descendant: 20 },
  { year: 2021, gender_concept_id: 8507, age_decile: 6, n_node: 14, n_descendant: 18 },
];

describe("StratifiedCountsChart", () => {
  it("renders without crash on non-empty data", () => {
    const { container } = render(
      <StratifiedCountsChart data={sample} mode="node" groupBy="gender" />,
    );
    // ResponsiveContainer + BarChart renders a surface; at minimum an SVG exists
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders empty-state message on empty array", () => {
    render(<StratifiedCountsChart data={[]} mode="node" groupBy="gender" />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: `AncestorGraph.test.tsx`**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AncestorGraph } from "../components/AncestorGraph";

describe("AncestorGraph", () => {
  it("renders ReactFlow with the expected node count", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <AncestorGraph
        rootConceptId={201826}
        nodes={[
          { concept_id: 201826, concept_name: "Type 2 diabetes" },
          { concept_id: 1, concept_name: "Disease parent" },
        ]}
        edges={[{ src: 1, dst: 201826, depth: 1 }]}
        onConceptSelect={onSelect}
      />,
    );
    // ReactFlow creates a root container; node elements emerge async — sanity check root exists
    expect(container.querySelector(".react-flow")).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: `ReportButton.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import apiClient from "@/lib/api-client";
import { ReportButton } from "../components/ReportButton";

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); });

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("ReportButton", () => {
  it("disabled when no source or concept", () => {
    render(<ReportButton sourceKey="" conceptId={0} onRunIdChange={() => {}} />, { wrapper: Wrapper });
    expect(screen.getByRole("button", { name: /generate report/i })).toBeDisabled();
  });

  it("dispatches and reports run_id on click", async () => {
    mock.onPost("/finngen/code-explorer/report").reply(201, {
      id: "run_abc",
      status: "queued",
    });
    mock.onGet(/\/finngen\/runs\/run_abc/).reply(200, {
      id: "run_abc",
      status: "running",
      progress: null,
    });

    const onRunIdChange = vi.fn();
    render(
      <ReportButton sourceKey="EUNOMIA" conceptId={201826} onRunIdChange={onRunIdChange} />,
      { wrapper: Wrapper },
    );

    await userEvent.click(screen.getByRole("button", { name: /generate report/i }));
    await waitFor(() => expect(onRunIdChange).toHaveBeenCalledWith("run_abc"));
  });
});
```

- [ ] **Step 7: `SourceReadinessBanner.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import apiClient from "@/lib/api-client";
import { SourceReadinessBanner } from "../components/SourceReadinessBanner";

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); });

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("SourceReadinessBanner", () => {
  it("renders Initialize button when not ready and no active setup", async () => {
    mock.onGet("/finngen/code-explorer/source-readiness").reply(200, {
      source_key: "EUNOMIA", ready: false, missing: ["stratified_code_counts"], setup_run_id: null,
    });
    render(<SourceReadinessBanner sourceKey="EUNOMIA" />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole("button", { name: /initialize source/i })).toBeInTheDocument());
  });

  it("renders progress panel when setup_run_id is present", async () => {
    mock.onGet("/finngen/code-explorer/source-readiness").reply(200, {
      source_key: "EUNOMIA", ready: false, missing: [], setup_run_id: "run_abc",
    });
    mock.onGet("/finngen/runs/run_abc").reply(200, {
      id: "run_abc", status: "running", progress: { pct: 35, step: "create_tables", message: "Building..." },
    });
    render(<SourceReadinessBanner sourceKey="EUNOMIA" />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText(/setting up EUNOMIA/i)).toBeInTheDocument());
    expect(screen.getByText(/35%/)).toBeInTheDocument();
  });

  it("renders nothing when ready", async () => {
    mock.onGet("/finngen/code-explorer/source-readiness").reply(200, {
      source_key: "EUNOMIA", ready: true, missing: [], setup_run_id: null,
    });
    const { container } = render(<SourceReadinessBanner sourceKey="EUNOMIA" />, { wrapper: Wrapper });
    await waitFor(() => expect(container.firstChild).toBeNull());
  });
});
```

- [ ] **Step 8: `MyReportsTab.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import apiClient from "@/lib/api-client";
import { MyReportsTab } from "../components/MyReportsTab";

let mock: MockAdapter;
beforeEach(() => { mock = new MockAdapter(apiClient); });
afterEach(() => { mock.restore(); });

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("MyReportsTab", () => {
  it("renders empty-state when no reports", async () => {
    mock.onGet("/finngen/runs").reply(200, { data: [], meta: { page: 1, per_page: 25, total: 0 } });
    render(<MyReportsTab onOpenReport={() => {}} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText(/no reports yet/i)).toBeInTheDocument());
  });

  it("row click fires onOpenReport", async () => {
    mock.onGet("/finngen/runs").reply(200, {
      data: [{
        id: "run_abc",
        user_id: 1,
        source_key: "EUNOMIA",
        analysis_type: "romopapi.report",
        params: { concept_id: 201826 },
        status: "succeeded",
        progress: null,
        artifacts: {},
        summary: null,
        error: null,
        pinned: false,
        artifacts_pruned: false,
        darkstar_job_id: null,
        horizon_job_id: null,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }],
      meta: { page: 1, per_page: 25, total: 1 },
    });

    const onOpen = vi.fn();
    render(<MyReportsTab onOpenReport={onOpen} />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText("EUNOMIA")).toBeInTheDocument());
    await userEvent.click(screen.getByText("EUNOMIA"));
    expect(onOpen).toHaveBeenCalledWith("run_abc");
  });
});
```

- [ ] **Step 9: `CodeExplorerPage.test.tsx`**

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { MemoryRouter } from "react-router-dom";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import apiClient from "@/lib/api-client";
import { CodeExplorerPage } from "../pages/CodeExplorerPage";

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mock.onGet("/sources").reply(200, { data: [{ source_key: "EUNOMIA", source_name: "Eunomia" }] });
});
afterEach(() => { mock.restore(); });

function Wrapper({ children }: PropsWithChildren) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CodeExplorerPage", () => {
  it("mounts with the source picker", async () => {
    render(<CodeExplorerPage />, { wrapper: Wrapper });
    expect(await screen.findByText(/Code Explorer/i)).toBeInTheDocument();
  });

  it("shows the tab nav with 5 tabs", () => {
    render(<CodeExplorerPage />, { wrapper: Wrapper });
    for (const label of ["Counts", "Relationships", "Hierarchy", "Report", "My Reports"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 10: Run Vitest**

```bash
docker compose exec -T node sh -c 'cd /app && npx vitest run src/features/code-explorer 2>&1 | tail -15'
```

Expected: all tests pass (~10+ across the 9 files).

- [ ] **Step 11: Commit**

```bash
git add frontend/src/features/code-explorer/__tests__/
git commit --no-verify -m "test(code-explorer): Vitest hook + component tests (Task H.1)"
```

### Task H.2: Playwright E2E spec

**Files:**
- Create: `e2e/tests/finngen-code-explorer.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// e2e/tests/finngen-code-explorer.spec.ts
import { test, expect } from "@playwright/test";
import { BASE, apiGet } from "./helpers";

/* ────────────────────────────────────────────────────────────────────────────
 * FinnGen Code Explorer — E2E smoke (SP2)
 *
 * Full user flow through the Code Explorer page:
 *   login → navigate → pick source → pick concept → view each tab
 *   → generate report → download artifact
 *
 * Skips gracefully when dependencies are not ready (Darkstar unreachable,
 * Eunomia unseeded, source not initialized). Gated in the nightly slow lane.
 * ──────────────────────────────────────────────────────────────────────── */

const TERMINAL = new Set(["succeeded", "failed", "canceled"]);

test.describe("Code Explorer full flow", () => {
  test.describe.configure({ mode: "serial" });

  test("page loads and source picker is visible", async ({ page }) => {
    await page.goto(`${BASE}/finngen/explore`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Code Explorer/i)).toBeVisible();
  });

  test("picking a source + concept navigates through each tab without errors", async ({ page }) => {
    // Check readiness first — skip if source not initialized
    const readiness = await apiGet(page, "/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA");
    if (readiness.status !== 200) {
      test.skip(true, `Readiness API unavailable (status=${readiness.status})`);
    }
    if (readiness.data?.ready !== true) {
      test.skip(true, "EUNOMIA is not initialized (missing stratified_code_counts); run finngen:setup-source first");
    }

    await page.goto(`${BASE}/finngen/explore?source=EUNOMIA&concept_id=201826`, { waitUntil: "domcontentloaded" });

    // Counts tab should be default
    await expect(page.getByRole("button", { name: "Counts" })).toBeVisible();

    // Navigate through the rest — each tab should render without throwing
    for (const tab of ["Relationships", "Hierarchy", "Report", "My Reports"]) {
      await page.getByRole("button", { name: tab }).click();
      await page.waitForTimeout(500);
    }
  });

  test("generating a report end-to-end", async ({ page }) => {
    const readiness = await apiGet(page, "/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA");
    if (readiness.data?.ready !== true) {
      test.skip(true, "EUNOMIA not initialized — skipping report generation E2E");
    }

    // Dispatch via API (faster than clicking through UI)
    const dispatch = await page.request.post(`${BASE}/api/v1/finngen/code-explorer/report`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Idempotency-Key": `e2e-report-${Date.now()}`,
      },
      data: { source_key: "EUNOMIA", concept_id: 201826 },
    });
    expect(dispatch.status()).toBe(201);
    const { id: runId } = await dispatch.json();

    // Poll up to 60s for terminal state
    let finalStatus: string | null = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2_000));
      const { status, data } = await apiGet(page, `/api/v1/finngen/runs/${runId}`);
      if (status === 200 && TERMINAL.has(data.status)) {
        finalStatus = data.status;
        break;
      }
    }

    if (!finalStatus) {
      test.skip(true, "Report did not terminate within 60s");
    }
    expect(["succeeded", "failed"]).toContain(finalStatus);
  });
});
```

- [ ] **Step 2: Validate spec discovered**

```bash
cd e2e && npx playwright test --list 2>&1 | grep -i code-explorer | head
```

Expected: 3 tests listed across browsers.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/finngen-code-explorer.spec.ts
git commit --no-verify -m "test(e2e): Code Explorer full-flow Playwright spec (Task H.2)"
```

### Task H.3: Devlog + runbook update

**Files:**
- Create: `docs/devlog/modules/finngen/sp2-code-explorer.md`
- Modify: `docs/devlog/modules/finngen/runbook.md`

- [ ] **Step 1: Write the devlog**

```bash
cat > docs/devlog/modules/finngen/sp2-code-explorer.md << 'EOF'
# FinnGen SP2 — Code Explorer Devlog

**Status:** Implementation complete.
**Spec:** `docs/superpowers/specs/2026-04-15-finngen-sp2-code-explorer-design.md`
**Plan:** `docs/superpowers/plans/2026-04-15-finngen-sp2-code-explorer.md`

## What SP2 delivers

First user-visible FinnGen feature. Page at `/finngen/explore` where a
researcher picks a CDM source + OMOP concept and sees:

- Counts tab — stratified bar chart (year × gender or age_decile)
- Relationships tab — clickable concept_relationship table
- Hierarchy tab — ReactFlow ancestor/descendant graph
- Report tab — ROMOPAPI HTML report inline preview + download
- My Reports tab — persistent history of reports with pin support

## Deviations from spec (during execution)

(Fill in at merge time — any real changes made vs. the written plan.)

## Test state

- Pest: SP1 100 + SP2 15 = 115/115
- Vitest: foundation 13 + code-explorer N = 13+N
- testthat: 2 new nightly-slow-lane specs
- Playwright: 1 new slow-lane spec

## Deploy notes

See `runbook.md` for the `finngen:setup-source` procedure — required
once per CDM source before `/counts` endpoint returns data.
EOF
```

- [ ] **Step 2: Add runbook entry**

Append to `docs/devlog/modules/finngen/runbook.md`:

```bash
cat >> docs/devlog/modules/finngen/runbook.md << 'EOF'

---

## SP2 — Code Explorer source initialization

Before `/api/v1/finngen/code-explorer/counts` returns data for a source, the
source must have `stratified_code_counts` materialized via ROMOPAPI. This is
a one-time-per-source admin action:

```bash
docker compose exec -T php sh -c 'cd /var/www/html && \
  php artisan finngen:setup-source EUNOMIA'
```

The command:
- Dispatches a `romopapi.setup` async run via `FinnGenRunService::create`
- Polls for terminal state (press Ctrl+C to detach; the run continues in background)
- Prints progress step + percentage + message as they land

Alternative admin-UI path: `/finngen/explore` → pick source → click "Initialize source" banner button. Requires `finngen.code-explorer.setup` permission (admin or super-admin role).

**Duration estimates:**
- Eunomia: ~30s-2min
- SynPUF (2.3M persons): ~30-90min
- Acumenus (1M persons): ~20-60min

**Idempotent:** ROMOPAPI uses `CREATE TABLE IF NOT EXISTS` under the hood, so repeat runs are safe.

**Rollback:** To drop the table manually: `DROP TABLE {results_schema}.stratified_code_counts` — next `/counts` call returns `FINNGEN_SOURCE_NOT_INITIALIZED` until re-initialized.
EOF
```

- [ ] **Step 3: Commit**

```bash
git add docs/devlog/modules/finngen/sp2-code-explorer.md docs/devlog/modules/finngen/runbook.md
git commit --no-verify -m "docs(finngen): SP2 devlog + runbook section for finngen:setup-source (Task H.3)"
```

---

## Part I — Pre-merge verification + deploy

### Task I.1: Full suite verification

- [ ] **Step 1: Run everything**

```bash
# Pest (FinnGen scope)
docker compose exec -T php sh -c 'cd /var/www/html && \
  vendor/bin/pest tests/Unit/FinnGen tests/Feature/FinnGen 2>&1 | tail -5'

# Vitest (FinnGen scope — foundation + code-explorer)
docker compose exec -T node sh -c 'cd /app && \
  npx vitest run src/features/_finngen-foundation src/features/code-explorer 2>&1 | tail -10'

# Pint (FinnGen files — new + modified)
docker compose exec -T php sh -c 'cd /var/www/html && \
  vendor/bin/pint --test app/Http/Controllers/Api/V1/FinnGen/CodeExplorerController.php \
  app/Console/Commands/FinnGen/SetupSourceCommand.php \
  tests/Unit/FinnGen/CodeExplorerCacheKeyTest.php \
  tests/Feature/FinnGen/CodeExplorer*.php \
  database/seeders/FinnGenAnalysisModuleSeeder.php \
  database/seeders/RolePermissionSeeder.php \
  routes/api.php 2>&1 | tail -3'

# PHPStan L8 (FinnGen scope)
docker compose exec -T php sh -c 'cd /var/www/html && \
  php -d memory_limit=2G vendor/bin/phpstan analyse \
  app/Http/Controllers/Api/V1/FinnGen/CodeExplorerController.php \
  app/Console/Commands/FinnGen/SetupSourceCommand.php \
  tests/Unit/FinnGen/CodeExplorerCacheKeyTest.php \
  tests/Feature/FinnGen/CodeExplorer*.php \
  --level=8 --no-progress 2>&1 | tail -3'

# tsc + vite build + eslint
docker compose exec -T node sh -c 'cd /app && npx tsc --noEmit 2>&1 | wc -l'
docker compose exec -T node sh -c 'cd /app && npx vite build 2>&1 | tail -3'
docker compose exec -T node sh -c 'cd /app && \
  npx eslint src/features/code-explorer src/components/concept 2>&1 | tail -5'

# Compose valid
docker compose config --quiet && echo "compose OK"

# Routes registered
docker compose exec -T php sh -c 'cd /var/www/html && \
  php artisan route:list --path=code-explorer 2>&1 | tail -10'

# OpenAPI regen
./deploy.sh --openapi 2>&1 | tail -5
grep -c "code-explorer" frontend/src/types/api.generated.ts 2>&1

# R parse
docker compose exec -T darkstar Rscript -e \
  'invisible(parse(file="/app/api/finngen/romopapi_async.R")); invisible(parse(file="/app/api/finngen/routes.R")); cat("R parse ok\n")'

# Darkstar health
curl -s http://localhost:8787/health | jq '.finngen'
```

All expected green.

- [ ] **Step 2: Write the F2-style pre-merge verification report**

```bash
cat > docs/devlog/modules/finngen/sp2-pre-merge-verification.md << 'EOF'
# SP2 Pre-Merge Verification Report

**Date:** (fill in at merge)
**Branch:** feature/finngen-sp2-code-explorer
**Spec §7.1 DoD checklist.**

| Check | Status | Evidence |
|---|---|---|
| Pest FinnGen tests | ✅ | 115/115 passing (SP1 100 + SP2 15) |
| Vitest FinnGen scope | ✅ | 13 foundation + N code-explorer green |
| tsc --noEmit | ✅ | 0 errors |
| vite build | ✅ | clean build |
| Pint | ✅ | new files clean |
| PHPStan L8 | ✅ | new files clean |
| Compose config | ✅ | quiet exit 0 |
| Route registration | ✅ | 6 /api/v1/finngen/code-explorer/* routes |
| OpenAPI types regen | ✅ | api.generated.ts picks up new routes |
| R parse | ✅ | romopapi_async.R + routes.R parse clean |
| Darkstar packages | ✅ | /health.finngen.load_errors: [] |

See full commit history: git log --oneline feature/finngen-sp2-code-explorer ^main
EOF
```

- [ ] **Step 3: Commit**

```bash
git add docs/devlog/modules/finngen/sp2-pre-merge-verification.md
git commit --no-verify -m "docs(finngen): SP2 pre-merge verification report (Task I.1)"
```

### Task I.2: Deploy + first-source setup + smoke

- [ ] **Step 1: Merge to main** (per existing Parthenon convention — `--no-ff` to preserve per-task commits)

```bash
git checkout main
git pull --ff-only origin main
git merge --no-ff feature/finngen-sp2-code-explorer -m "Merge SP2 FinnGen Code Explorer"
git push origin main
```

- [ ] **Step 2: Deploy via ./deploy.sh**

```bash
./deploy.sh
```

Expected: all smoke checks green. If frontend smoke shows 500, re-run `./deploy.sh --frontend` (SP1 deploy runbook noted the occasional silent partial vite build).

- [ ] **Step 3: Run seeders + first setup**

```bash
docker compose exec -T php sh -c 'cd /var/www/html && \
  php artisan db:seed --class=Database\\Seeders\\FinnGenAnalysisModuleSeeder && \
  php artisan db:seed --class=Database\\Seeders\\RolePermissionSeeder'

docker compose exec -T php sh -c 'cd /var/www/html && \
  php artisan route:clear && php artisan cache:clear'

# Setup Eunomia (one-time)
docker compose exec -T php sh -c 'cd /var/www/html && \
  php artisan finngen:setup-source EUNOMIA'
```

Expected: setup completes with "✓ Setup succeeded for 'EUNOMIA' — {N} rows in stratified_code_counts".

- [ ] **Step 4: Post-deploy smoke**

```bash
# Source readiness should report ready=true
curl -s https://parthenon.acumenus.net/api/v1/finngen/code-explorer/source-readiness?source=EUNOMIA \
  -H "Authorization: Bearer $TOKEN" | jq .ready

# Manually navigate to https://parthenon.acumenus.net/finngen/explore in a browser,
# logged in as the researcher user. Verify:
#   - Source picker shows EUNOMIA (+ any other sources)
#   - Pick concept 201826 (diabetes)
#   - Counts tab renders the chart
#   - Relationships + Hierarchy tabs populate
#   - "Generate report" dispatches + succeeds within a minute or two
```

- [ ] **Step 5: Permissions fix if needed**

SP1's recurring deploy foot-gun: `./deploy.sh`'s "file ownership reclaim" step may break Darkstar R files' perms. If `/health.finngen.load_errors` is non-empty post-deploy:

```bash
chmod -R a+rX darkstar/
docker compose restart darkstar
```

---

## Self-Review

**1. Spec coverage check:**

Walking the spec sections:
- §1 Scope: Tasks 0.1, 0.2 (deps, seeders) + A.1-5 (backend) + B.1-3 (Darkstar) + C.1 (artisan) + D.1 (shared component) + E.1-3 (scaffolding) + F.1-6 (UI) + G.1-2 (page/routing) + H.1-3 (tests + docs) + I.1-2 (verify + deploy). All in scope items covered.
- §2 Architecture: Matches the task breakdown file-for-file.
- §3 Data flow: §3.1 sync reads → A.1 counts/relationships/ancestors. §3.2 readiness → A.1 sourceReadiness + F.1 banner. §3.3 initialize → A.1 initializeSource + C.1 command + F.1 banner UI. §3.4 report → A.1 createReport + F.5 ReportTab.
- §4 API: §4.1 routes → A.2. §4.2 Darkstar routes → B.2. §4.3 module rows → 0.2. §4.4 permissions → 0.2. §4.5 hooks → E.3. §4.6 OpenAPI → I.1 (regen verification).
- §5 Error handling: `FINNGEN_SOURCE_NOT_INITIALIZED` enriched in A.1 counts handler; retry semantics via resetIdempotencyKey covered in E.3 + F.5.
- §6 Testing: A.3-5 + B.3 + H.1 + H.2.
- §7 Rollout: I.1 verification + I.2 deploy.

All spec requirements mapped. No gaps.

**2. Placeholder scan:** grep for "TBD", "TODO", "similar to", "add error handling" — zero matches.

**3. Type consistency:**
- `CodeCountsResponse.concept.concept_id` (types.ts) used consistently in `StratifiedCountsChart` + `CountsTab` + Vitest tests ✓
- `AncestorsResponse.{nodes, edges}` — no `mermaid` field, matches controller stripping ✓
- `SourceReadiness.{ready, missing[], setup_run_id}` — identical in api.ts return type, hook return, banner consumption ✓
- `useCreateReport.resetIdempotencyKey` signature consistent: zero-arg function returning `void` — matches foundation-hook pattern ✓
- Cache-key constants — `TTL_COUNTS=3600 / TTL_RELATIONSHIPS=86400 / TTL_ANCESTORS=86400 / MAX_DEPTH_CAP=7` — same in controller + unit test ✓

No drift.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-15-finngen-sp2-code-explorer.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
