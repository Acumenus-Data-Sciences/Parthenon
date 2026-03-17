# Aqueduct Phase 1: Foundation + Lookup Generator Tab

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Aqueduct ETL Mapping Workbench as a discoverable Workbench tool with a functional Lookup Generator tab that assembles vocabulary lookup SQL from 12 Perseus-extracted templates.

**Architecture:** Dedicated `AqueductController` + `AqueductService` umbrella under `api/v1/etl/aqueduct/`. Frontend feature module at `frontend/src/features/aqueduct/` with tabbed page. SDK scaffold generated, service registered in discovery. Lookup templates stored as static SQL files in `backend/resources/etl/lookups/`.

**Tech Stack:** Laravel 11 / PHP 8.4, React 19 / TypeScript / TanStack Query, Community Workbench SDK contracts

**Spec:** `docs/superpowers/specs/2026-03-16-aqueduct-etl-workbench-design.md`

---

## Chunk 1: Database + Models

### Task 1: Create Migration for `aqueduct_sessions`

**Files:**
- Create: `backend/database/migrations/2026_03_17_000001_create_aqueduct_sessions_table.php`

- [ ] **Step 1: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('aqueduct_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->string('name', 255);
            $table->string('cdm_version', 10)->default('5.4');
            $table->string('scan_report_name', 255)->nullable();
            $table->string('scan_report_path', 500)->nullable();
            $table->jsonb('source_schema')->default('[]');
            $table->jsonb('mapping_config')->default('{}');
            $table->string('status', 20)->default('draft');
            $table->timestamps();
            $table->softDeletes();

            $table->index('user_id');
            $table->index('source_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('aqueduct_sessions');
    }
};
```

- [ ] **Step 2: Run migration**

Run: `docker compose exec php php artisan migrate`
Expected: "Migrating... aqueduct_sessions ... DONE"

- [ ] **Step 3: Verify table exists**

Run: `docker compose exec php php artisan tinker --execute="echo Schema::hasTable('aqueduct_sessions') ? 'yes' : 'no';"`
Expected: `yes`

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_03_17_000001_create_aqueduct_sessions_table.php
git commit -m "feat(aqueduct): add aqueduct_sessions migration"
```

---

### Task 2: Create Migration for `aqueduct_runs`

**Files:**
- Create: `backend/database/migrations/2026_03_17_000002_create_aqueduct_runs_table.php`

- [ ] **Step 1: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('aqueduct_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->nullable()->constrained('aqueduct_sessions')->nullOnDelete();
            $table->string('service_name', 80);
            $table->string('status', 20)->default('ok');
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->jsonb('source_snapshot')->nullable();
            $table->jsonb('request_payload')->nullable();
            $table->jsonb('result_payload')->nullable();
            $table->jsonb('runtime_payload')->nullable();
            $table->jsonb('artifact_index')->nullable();
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['service_name', 'source_id']);
            $table->index('session_id');
            $table->index('submitted_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('aqueduct_runs');
    }
};
```

- [ ] **Step 2: Run migration**

Run: `docker compose exec php php artisan migrate`
Expected: "Migrating... aqueduct_runs ... DONE"

- [ ] **Step 3: Commit**

```bash
git add backend/database/migrations/2026_03_17_000002_create_aqueduct_runs_table.php
git commit -m "feat(aqueduct): add aqueduct_runs migration"
```

---

### Task 3: Create Eloquent Models

**Files:**
- Create: `backend/app/Models/App/AqueductSession.php`
- Create: `backend/app/Models/App/AqueductRun.php`

- [ ] **Step 1: Create AqueductSession model**

```php
<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/** @property-read Source|null $source */
class AqueductSession extends Model
{
    use SoftDeletes;

    protected $table = 'aqueduct_sessions';

    protected $fillable = [
        'user_id',
        'source_id',
        'name',
        'cdm_version',
        'scan_report_name',
        'scan_report_path',
        'source_schema',
        'mapping_config',
        'status',
    ];

    protected $casts = [
        'source_schema' => 'array',
        'mapping_config' => 'array',
    ];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Source, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /** @return HasMany<AqueductRun, $this> */
    public function runs(): HasMany
    {
        return $this->hasMany(AqueductRun::class, 'session_id');
    }
}
```

- [ ] **Step 2: Create AqueductRun model**

```php
<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** @property-read Source|null $source */
class AqueductRun extends Model
{
    protected $table = 'aqueduct_runs';

    protected $fillable = [
        'session_id',
        'service_name',
        'status',
        'source_id',
        'submitted_by',
        'source_snapshot',
        'request_payload',
        'result_payload',
        'runtime_payload',
        'artifact_index',
        'submitted_at',
        'completed_at',
    ];

    protected $casts = [
        'source_snapshot' => 'array',
        'request_payload' => 'array',
        'result_payload' => 'array',
        'runtime_payload' => 'array',
        'artifact_index' => 'array',
        'submitted_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    /** @return BelongsTo<AqueductSession, $this> */
    public function session(): BelongsTo
    {
        return $this->belongsTo(AqueductSession::class, 'session_id');
    }

    /** @return BelongsTo<Source, $this> */
    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    /** @return BelongsTo<User, $this> */
    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }
}
```

- [ ] **Step 3: Verify models load**

Run: `docker compose exec php php artisan tinker --execute="new App\Models\App\AqueductSession; echo 'ok';"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add backend/app/Models/App/AqueductSession.php backend/app/Models/App/AqueductRun.php
git commit -m "feat(aqueduct): add AqueductSession and AqueductRun Eloquent models"
```

---

## Chunk 2: Vocabulary Lookup Templates

### Task 4: Create Lookup SQL Templates

These are extracted from Perseus's `perseus-api/model/lookups/` directory and adapted for Parthenon's schema placeholder convention.

**Files:**
- Create: `backend/resources/etl/lookups/templates/cte_source_to_standard.sql`
- Create: `backend/resources/etl/lookups/templates/cte_source_to_source.sql`
- Create: `backend/resources/etl/lookups/templates/cte_result.sql`
- Create: `backend/resources/etl/lookups/templates/cte_result_standard_only.sql`

- [ ] **Step 1: Create directory structure**

Run: `mkdir -p backend/resources/etl/lookups/templates backend/resources/etl/lookups/filters/source_to_standard backend/resources/etl/lookups/filters/source_to_source`

- [ ] **Step 2: Write cte_source_to_standard.sql**

This is the base CTE that joins CONCEPT → CONCEPT_RELATIONSHIP → CONCEPT to find standard concept mappings. The `{vocab_schema}` placeholder is replaced at assembly time with the source's vocabulary daimon schema name. The `{vocabulary_filter}` placeholder is replaced with the vocabulary-specific WHERE clause.

```sql
-- Source to Standard vocabulary lookup CTE
-- Placeholder {vocab_schema} is replaced with the source's vocabulary schema name
-- Placeholder {vocabulary_filter} is replaced with the vocabulary-specific WHERE clause
Source_to_Standard AS (
    SELECT
        c.concept_code     AS SOURCE_CODE,
        c.concept_id       AS SOURCE_CONCEPT_ID,
        c.concept_name     AS SOURCE_CODE_DESCRIPTION,
        c.vocabulary_id    AS SOURCE_VOCABULARY_ID,
        c.domain_id        AS SOURCE_DOMAIN_ID,
        c.concept_class_id AS SOURCE_CONCEPT_CLASS_ID,
        c.valid_start_date AS SOURCE_VALID_START_DATE,
        c.valid_end_date   AS SOURCE_VALID_END_DATE,
        c.invalid_reason   AS SOURCE_INVALID_REASON,
        c2.concept_id      AS TARGET_CONCEPT_ID,
        c2.concept_name    AS TARGET_CONCEPT_NAME,
        c2.vocabulary_id   AS TARGET_VOCABULARY_ID,
        c2.domain_id       AS TARGET_DOMAIN_ID,
        c2.concept_class_id AS TARGET_CONCEPT_CLASS_ID,
        c2.invalid_reason  AS TARGET_INVALID_REASON,
        c2.standard_concept AS TARGET_STANDARD_CONCEPT
    FROM {vocab_schema}.concept c
    JOIN {vocab_schema}.concept_relationship cr
        ON c.concept_id = cr.concept_id_1
        AND cr.relationship_id = 'Maps to'
        AND cr.invalid_reason IS NULL
    JOIN {vocab_schema}.concept c2
        ON cr.concept_id_2 = c2.concept_id
        AND c2.standard_concept = 'S'
        AND c2.invalid_reason IS NULL
    WHERE c.invalid_reason IS NULL
    {vocabulary_filter}

    UNION

    SELECT
        stcm.source_code               AS SOURCE_CODE,
        stcm.source_concept_id          AS SOURCE_CONCEPT_ID,
        stcm.source_code_description    AS SOURCE_CODE_DESCRIPTION,
        stcm.source_vocabulary_id       AS SOURCE_VOCABULARY_ID,
        NULL                            AS SOURCE_DOMAIN_ID,
        NULL                            AS SOURCE_CONCEPT_CLASS_ID,
        stcm.valid_start_date           AS SOURCE_VALID_START_DATE,
        stcm.valid_end_date             AS SOURCE_VALID_END_DATE,
        stcm.invalid_reason             AS SOURCE_INVALID_REASON,
        c2.concept_id                   AS TARGET_CONCEPT_ID,
        c2.concept_name                 AS TARGET_CONCEPT_NAME,
        c2.vocabulary_id                AS TARGET_VOCABULARY_ID,
        c2.domain_id                    AS TARGET_DOMAIN_ID,
        c2.concept_class_id             AS TARGET_CONCEPT_CLASS_ID,
        c2.invalid_reason               AS TARGET_INVALID_REASON,
        c2.standard_concept             AS TARGET_STANDARD_CONCEPT
    FROM {vocab_schema}.source_to_concept_map stcm
    JOIN {vocab_schema}.concept c2
        ON stcm.target_concept_id = c2.concept_id
        AND c2.standard_concept = 'S'
        AND c2.invalid_reason IS NULL
    WHERE stcm.invalid_reason IS NULL
    {stcm_vocabulary_filter}
)
```

- [ ] **Step 3: Write cte_source_to_source.sql**

```sql
-- Source to Source vocabulary lookup CTE
Source_to_Source AS (
    SELECT
        c.concept_code     AS SOURCE_CODE,
        c.concept_id       AS SOURCE_CONCEPT_ID,
        c.concept_name     AS SOURCE_CODE_DESCRIPTION,
        c.vocabulary_id    AS SOURCE_VOCABULARY_ID,
        c.domain_id        AS SOURCE_DOMAIN_ID,
        c.concept_class_id AS SOURCE_CONCEPT_CLASS_ID,
        c.valid_start_date AS SOURCE_VALID_START_DATE,
        c.valid_end_date   AS SOURCE_VALID_END_DATE,
        c.invalid_reason   AS SOURCE_INVALID_REASON,
        c.concept_id       AS TARGET_CONCEPT_ID,
        c.concept_name     AS TARGET_CONCEPT_NAME,
        c.vocabulary_id    AS TARGET_VOCABULARY_ID,
        c.domain_id        AS TARGET_DOMAIN_ID,
        c.concept_class_id AS TARGET_CONCEPT_CLASS_ID,
        c.invalid_reason   AS TARGET_INVALID_REASON,
        c.standard_concept AS TARGET_STANDARD_CONCEPT
    FROM {vocab_schema}.concept c
    WHERE c.invalid_reason IS NULL
    {vocabulary_filter}

    UNION

    SELECT
        stcm.source_code               AS SOURCE_CODE,
        stcm.source_concept_id          AS SOURCE_CONCEPT_ID,
        stcm.source_code_description    AS SOURCE_CODE_DESCRIPTION,
        stcm.source_vocabulary_id       AS SOURCE_VOCABULARY_ID,
        NULL                            AS SOURCE_DOMAIN_ID,
        NULL                            AS SOURCE_CONCEPT_CLASS_ID,
        stcm.valid_start_date           AS SOURCE_VALID_START_DATE,
        stcm.valid_end_date             AS SOURCE_VALID_END_DATE,
        stcm.invalid_reason             AS SOURCE_INVALID_REASON,
        c2.concept_id                   AS TARGET_CONCEPT_ID,
        c2.concept_name                 AS TARGET_CONCEPT_NAME,
        c2.vocabulary_id                AS TARGET_VOCABULARY_ID,
        c2.domain_id                    AS TARGET_DOMAIN_ID,
        c2.concept_class_id             AS TARGET_CONCEPT_CLASS_ID,
        c2.invalid_reason               AS TARGET_INVALID_REASON,
        c2.standard_concept             AS TARGET_STANDARD_CONCEPT
    FROM {vocab_schema}.source_to_concept_map stcm
    JOIN {vocab_schema}.concept c2
        ON stcm.target_concept_id = c2.concept_id
    WHERE stcm.invalid_reason IS NULL
    {stcm_vocabulary_filter}
)
```

- [ ] **Step 4: Write cte_result.sql**

```sql
-- Combined result template (source_to_standard + source_to_source)
WITH
{source_to_standard},
{source_to_source}

SELECT * FROM Source_to_Standard

UNION ALL

SELECT * FROM Source_to_Source
```

- [ ] **Step 5: Write cte_result_standard_only.sql**

```sql
-- Standard-only result template (no source_to_source)
WITH
{source_to_standard}

SELECT * FROM Source_to_Standard
```

- [ ] **Step 6: Commit templates**

```bash
git add backend/resources/etl/lookups/templates/
git commit -m "feat(aqueduct): add lookup CTE templates extracted from Perseus"
```

---

### Task 5: Create Vocabulary Filter Files

**Files:**
- Create: 11 files in `backend/resources/etl/lookups/filters/source_to_standard/`
- Create: 11 files in `backend/resources/etl/lookups/filters/source_to_source/`

- [ ] **Step 1: Write source_to_standard filters**

Each filter has TWO parts separated by `---STCM---`. The first part uses alias `c` (for the concept join branch). The second part uses alias `stcm` (for the source_to_concept_map UNION branch). The service splits on `---STCM---` and replaces `{vocabulary_filter}` and `{stcm_vocabulary_filter}` separately.

`backend/resources/etl/lookups/filters/source_to_standard/icd10cm.sql`:
```sql
AND lower(c.vocabulary_id) IN ('icd10cm')
AND lower(c2.domain_id) = 'condition'
---STCM---
AND lower(stcm.source_vocabulary_id) IN ('icd10cm')
AND lower(c2.domain_id) = 'condition'
```

Follow the same two-part pattern (`---STCM---` separator) for all remaining 10 vocabularies: `icd9cm.sql`, `ndc.sql`, `loinc.sql`, `snomed.sql`, `cvx.sql`, `nucc.sql`, `procedure.sql`, `read.sql`, `revenue.sql`, `ucum.sql`. The first part references alias `c` for vocabulary_id and `c2` for domain_id. The STCM part references alias `stcm` for source_vocabulary_id and `c2` for domain_id.

Vocabulary → Domain mapping:
- `icd9cm` → condition | `ndc` → drug | `loinc` → measurement | `snomed` → (no domain filter)
- `cvx` → drug | `nucc` → provider | `procedure` (cpt4,hcpcs,icd10pcs,icd9proc) → procedure
- `read` → (no domain filter) | `revenue` (revenue code) → (no domain filter) | `ucum` → unit

- [ ] **Step 2: Write source_to_source filters**

Each source_to_source filter restricts both source and target to the same vocabulary.

`backend/resources/etl/lookups/filters/source_to_source/icd10cm.sql`:
```sql
AND lower(c.vocabulary_id) IN ('icd10cm')
AND lower(c.domain_id) = 'condition'
```

Follow the same pattern for all 11 vocabularies: `icd9cm.sql`, `ndc.sql` (domain=drug), `loinc.sql` (domain=measurement), `snomed.sql` (no domain filter), `cvx.sql` (domain=drug), `nucc.sql` (domain=provider), `procedure.sql` (vocabularies=cpt4,hcpcs,icd10pcs,icd9proc, domain=procedure), `read.sql` (no domain filter), `revenue.sql` (no domain filter), `ucum.sql` (domain=unit).

- [ ] **Step 3: Commit filters**

```bash
git add backend/resources/etl/lookups/filters/
git commit -m "feat(aqueduct): add 22 vocabulary lookup filters extracted from Perseus"
```

---

## Chunk 3: Backend Services

### Task 6: Create AqueductLookupGeneratorService

**Files:**
- Create: `backend/app/Services/Aqueduct/AqueductLookupGeneratorService.php`
- Test: `backend/tests/Feature/Api/V1/AqueductLookupGeneratorTest.php`

- [ ] **Step 1: Write failing test for vocabulary listing**

```php
<?php
// backend/tests/Feature/Api/V1/AqueductLookupGeneratorTest.php

use App\Models\User;

it('lists all vocabulary filters', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/etl/aqueduct/lookups/vocabularies');

    $response->assertOk()
        ->assertJsonStructure(['data' => ['vocabularies']])
        ->assertJsonCount(11, 'data.vocabularies');
});

it('previews assembled lookup SQL for a vocabulary', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/etl/aqueduct/lookups/preview/icd10cm');

    $response->assertOk()
        ->assertJsonStructure(['data' => ['vocabulary', 'sql', 'includes_source_to_source']]);

    $sql = $response->json('data.sql');
    expect($sql)->toContain('Source_to_Standard')
        ->toContain('icd10cm')
        ->not->toContain('{vocab_schema}')
        ->not->toContain('{vocabulary_filter}');
});

it('rejects unknown vocabulary with 404', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/etl/aqueduct/lookups/preview/nonexistent');

    $response->assertNotFound();
});

it('generates lookup result envelope for multiple vocabularies', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/etl/aqueduct/lookups/generate', [
            'vocabularies' => ['icd10cm', 'ndc'],
            'include_source_to_source' => true,
            'vocab_schema' => 'vocab',
        ]);

    $response->assertOk()
        ->assertJsonStructure([
            'data' => ['status', 'runtime', 'summary', 'artifacts'],
        ]);

    expect($response->json('data.status'))->toBe('ok');
    expect($response->json('data.artifacts.artifacts'))->toHaveCount(2);
});

it('rejects unauthenticated users', function () {
    $this->getJson('/api/v1/etl/aqueduct/lookups/vocabularies')
        ->assertUnauthorized();
});

it('rejects users without researcher or super-admin role', function () {
    $user = User::factory()->create();
    // No role assigned

    $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/etl/aqueduct/lookups/vocabularies')
        ->assertForbidden();
});

it('rejects vocab_schema with SQL injection characters', function () {
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user, 'sanctum')
        ->postJson('/api/v1/etl/aqueduct/lookups/generate', [
            'vocabularies' => ['icd10cm'],
            'vocab_schema' => 'vocab; DROP TABLE users; --',
        ]);

    $response->assertUnprocessable();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `docker compose exec php vendor/bin/pest tests/Feature/Api/V1/AqueductLookupGeneratorTest.php`
Expected: FAIL (routes not defined, service not created)

- [ ] **Step 3: Write AqueductLookupGeneratorService**

```php
<?php

namespace App\Services\Aqueduct;

use Illuminate\Support\Facades\File;

class AqueductLookupGeneratorService
{
    private string $basePath;

    public function __construct()
    {
        $this->basePath = resource_path('etl/lookups');
    }

    /** @return list<array{id: string, display_name: string, domain: string|null}> */
    public function listVocabularies(): array
    {
        $vocabularies = [
            ['id' => 'icd10cm', 'display_name' => 'ICD-10-CM', 'domain' => 'Condition'],
            ['id' => 'icd9cm', 'display_name' => 'ICD-9-CM', 'domain' => 'Condition'],
            ['id' => 'ndc', 'display_name' => 'NDC', 'domain' => 'Drug'],
            ['id' => 'loinc', 'display_name' => 'LOINC', 'domain' => 'Measurement'],
            ['id' => 'snomed', 'display_name' => 'SNOMED', 'domain' => null],
            ['id' => 'cvx', 'display_name' => 'CVX', 'domain' => 'Drug'],
            ['id' => 'nucc', 'display_name' => 'NUCC', 'domain' => 'Provider'],
            ['id' => 'procedure', 'display_name' => 'Procedure (CPT4/HCPCS/ICD10PCS/ICD9Proc)', 'domain' => 'Procedure'],
            ['id' => 'read', 'display_name' => 'Read', 'domain' => null],
            ['id' => 'revenue', 'display_name' => 'Revenue Code', 'domain' => null],
            ['id' => 'ucum', 'display_name' => 'UCUM', 'domain' => 'Unit'],
        ];

        return $vocabularies;
    }

    public function vocabularyExists(string $vocabulary): bool
    {
        if (! preg_match('/^[a-z0-9]+$/', $vocabulary)) {
            return false; // Reject path traversal characters
        }

        return File::exists("{$this->basePath}/filters/source_to_standard/{$vocabulary}.sql");
    }

    public function assembleLookupSql(string $vocabulary, string $vocabSchema, bool $includeSourceToSource = true): string
    {
        // Validate vocab_schema: alphanumeric + underscore only (prevents SQL injection)
        if (! preg_match('/^[a-z0-9_]+$/', $vocabSchema)) {
            throw new \InvalidArgumentException("Invalid vocab_schema: must be alphanumeric with underscores only.");
        }

        // Validate vocabulary: alphanumeric only (prevents path traversal)
        if (! preg_match('/^[a-z0-9]+$/', $vocabulary)) {
            throw new \InvalidArgumentException("Invalid vocabulary: must be alphanumeric only.");
        }

        // Filter files use ---STCM--- separator: first part for concept alias `c`, second for stcm alias
        [$conceptFilter, $stcmFilter] = $this->splitFilter('source_to_standard', $vocabulary);

        $s2sCte = $this->readTemplate('cte_source_to_standard.sql');
        $s2sCte = str_replace('{vocabulary_filter}', $conceptFilter, $s2sCte);
        $s2sCte = str_replace('{stcm_vocabulary_filter}', $stcmFilter, $s2sCte);
        $s2sCte = str_replace('{vocab_schema}', $vocabSchema, $s2sCte);

        if ($includeSourceToSource) {
            [$s2sConceptFilter, $s2sStcmFilter] = $this->splitFilter('source_to_source', $vocabulary);
            $s2sSourceCte = $this->readTemplate('cte_source_to_source.sql');
            $s2sSourceCte = str_replace('{vocabulary_filter}', $s2sConceptFilter, $s2sSourceCte);
            $s2sSourceCte = str_replace('{stcm_vocabulary_filter}', $s2sStcmFilter, $s2sSourceCte);
            $s2sSourceCte = str_replace('{vocab_schema}', $vocabSchema, $s2sSourceCte);

            $result = $this->readTemplate('cte_result.sql');
            $result = str_replace('{source_to_standard}', $s2sCte, $result);
            $result = str_replace('{source_to_source}', $s2sSourceCte, $result);
        } else {
            $result = $this->readTemplate('cte_result_standard_only.sql');
            $result = str_replace('{source_to_standard}', $s2sCte, $result);
        }

        return $result;
    }

    /** @return array{0: string, 1: string} */
    private function splitFilter(string $type, string $vocabulary): array
    {
        $raw = $this->readFilter($type, $vocabulary);
        $parts = explode('---STCM---', $raw, 2);
        $conceptPart = trim($parts[0]);
        $stcmPart = isset($parts[1]) ? trim($parts[1]) : $conceptPart;

        return [$conceptPart, $stcmPart];
    }

    /** @return array{status: string, runtime: array<string, mixed>, summary: array<string, mixed>, artifacts: array{artifacts: list<array<string, mixed>>}, warnings: list<string>, next_actions: list<string>} */
    public function generateResultEnvelope(array $vocabularies, string $vocabSchema, bool $includeSourceToSource = true): array
    {
        $startTime = microtime(true);
        $artifacts = [];

        foreach ($vocabularies as $vocabulary) {
            $sql = $this->assembleLookupSql($vocabulary, $vocabSchema, $includeSourceToSource);
            $artifacts[] = [
                'id' => "lookup_{$vocabulary}_sql",
                'label' => strtoupper($vocabulary) . ' Lookup SQL',
                'kind' => 'sql',
                'content_type' => 'text/sql',
                'path' => null,
                'summary' => "Assembled lookup SQL for {$vocabulary} vocabulary",
                'downloadable' => true,
                'previewable' => true,
                'content' => $sql,
            ];
        }

        $elapsedMs = (int) ((microtime(true) - $startTime) * 1000);

        return [
            'status' => 'ok',
            'runtime' => [
                'status' => 'ready',
                'adapter_mode' => 'native',
                'fallback_active' => false,
                'upstream_ready' => true,
                'dependency_issues' => [],
                'notes' => [],
                'timings' => ['assembly_ms' => $elapsedMs],
                'last_error' => null,
            ],
            'summary' => [
                'tab' => 'lookup_generator',
                'vocabularies_requested' => count($vocabularies),
                'vocabularies_assembled' => count($artifacts),
                'include_source_to_source' => $includeSourceToSource,
                'vocab_schema' => $vocabSchema,
            ],
            'panels' => [],
            'artifacts' => ['artifacts' => $artifacts],
            'warnings' => [],
            'next_actions' => ['Download lookup SQL files', 'Execute against vocabulary database'],
        ];
    }

    private function readTemplate(string $filename): string
    {
        return File::get("{$this->basePath}/templates/{$filename}");
    }

    private function readFilter(string $type, string $vocabulary): string
    {
        return File::get("{$this->basePath}/filters/{$type}/{$vocabulary}.sql");
    }
}
```

- [ ] **Step 4: Commit service**

```bash
git add backend/app/Services/Aqueduct/AqueductLookupGeneratorService.php
git commit -m "feat(aqueduct): add AqueductLookupGeneratorService with template assembly"
```

---

### Task 7: Create AqueductService Umbrella + Service Entry

**Files:**
- Create: `backend/app/Services/Aqueduct/AqueductService.php`

- [ ] **Step 1: Write AqueductService**

This is the umbrella service that provides the service entry for Workbench discovery (following the `CommunityWorkbenchSdkDemoService::serviceEntry()` pattern).

```php
<?php

namespace App\Services\Aqueduct;

class AqueductService
{
    public function __construct(
        private readonly AqueductLookupGeneratorService $lookups,
    ) {}

    public function lookups(): AqueductLookupGeneratorService
    {
        return $this->lookups;
    }

    public function serviceEntry(): array
    {
        return [
            'name' => 'etl_mapping_workbench',
            'endpoint' => '/flows/etl-mapping',
            'description' => 'Visual source-to-CDM mapping with concept matching and vocabulary lookup generation.',
            'mcp_tools' => ['etl_mapping_workbench_catalog'],
            'input' => ['source_key', 'scan_report', 'mapping_config', 'source_codes_csv', 'vocabulary_filters'],
            'output' => ['mapping_summary', 'concept_matches', 'lookup_sql', 'etl_archive'],
            'validation' => [
                'registration gated by ETL_MAPPING_WORKBENCH_ENABLED',
                'writes require explicit confirmation before execution tools are added',
            ],
            'ui_hints' => [
                'title' => 'Aqueduct',
                'summary' => 'Design and validate ETL mappings from source data to OMOP CDM.',
                'accent' => 'teal',
                'repository' => null,
                'workspace' => 'etl-workbench',
            ],
            'implemented' => true,
            'source' => 'parthenon',
        ];
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Services/Aqueduct/AqueductService.php
git commit -m "feat(aqueduct): add AqueductService umbrella with service entry"
```

---

### Task 8: Create AqueductController + Routes

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/AqueductController.php`
- Modify: `backend/routes/api.php` (add route group inside existing `etl` prefix)

- [ ] **Step 1: Create AqueductGenerateLookupsRequest Form Request**

```php
<?php
// backend/app/Http/Requests/Aqueduct/AqueductGenerateLookupsRequest.php

namespace App\Http\Requests\Aqueduct;

use Illuminate\Foundation\Http\FormRequest;

class AqueductGenerateLookupsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Auth handled by middleware
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'vocabularies' => ['required', 'array', 'min:1'],
            'vocabularies.*' => ['required', 'string', 'regex:/^[a-z0-9]+$/'],
            'include_source_to_source' => ['sometimes', 'boolean'],
            'vocab_schema' => ['sometimes', 'string', 'regex:/^[a-z0-9_]+$/'],
        ];
    }
}
```

- [ ] **Step 2: Write AqueductController**

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Aqueduct\AqueductGenerateLookupsRequest;
use App\Services\Aqueduct\AqueductService;
use Illuminate\Http\JsonResponse;

class AqueductController extends Controller
{
    public function __construct(
        private readonly AqueductService $aqueduct,
    ) {}

    public function listVocabularies(): JsonResponse
    {
        return response()->json([
            'data' => ['vocabularies' => $this->aqueduct->lookups()->listVocabularies()],
        ]);
    }

    public function previewLookup(string $vocabulary): JsonResponse
    {
        if (! $this->aqueduct->lookups()->vocabularyExists($vocabulary)) {
            return response()->json(['message' => "Unknown vocabulary: {$vocabulary}"], 404);
        }

        // Preview uses 'vocab' as default; production use resolves from source daimon
        $sql = $this->aqueduct->lookups()->assembleLookupSql($vocabulary, 'vocab');

        return response()->json([
            'data' => [
                'vocabulary' => $vocabulary,
                'sql' => $sql,
                'includes_source_to_source' => true,
            ],
        ]);
    }

    public function generateLookups(AqueductGenerateLookupsRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $vocabSchema = $validated['vocab_schema'] ?? 'vocab';
        $includeS2S = $validated['include_source_to_source'] ?? true;

        // Validate all requested vocabularies exist as filter files
        $invalid = array_filter(
            $validated['vocabularies'],
            fn (string $v) => ! $this->aqueduct->lookups()->vocabularyExists($v),
        );

        if (! empty($invalid)) {
            return response()->json([
                'message' => 'Unknown vocabularies: ' . implode(', ', $invalid),
            ], 422);
        }

        $result = $this->aqueduct->lookups()->generateResultEnvelope(
            $validated['vocabularies'],
            $vocabSchema,
            $includeS2S,
        );

        return response()->json(['data' => $result]);
    }
}
```

- [ ] **Step 2: Add routes to api.php**

In `backend/routes/api.php`, add the Aqueduct route group inside the existing `etl` prefix block (around line 498-511). Add after the FHIR routes and before the closing `});` of the `etl` group:

```php
            // Aqueduct ETL Mapping Workbench (auth:sanctum inherited from parent group)
            Route::prefix('aqueduct')
                ->middleware(['role:researcher|super-admin'])
                ->group(function () {
                    // Lookup Generator (read endpoints — relaxed throttle)
                    Route::middleware('throttle:60,1')->group(function () {
                        Route::get('/lookups/vocabularies', [AqueductController::class, 'listVocabularies']);
                        Route::get('/lookups/preview/{vocabulary}', [AqueductController::class, 'previewLookup']);
                    });

                    // Lookup Generator (mutation endpoints — strict throttle)
                    Route::middleware('throttle:10,1')->group(function () {
                        Route::post('/lookups/generate', [AqueductController::class, 'generateLookups']);
                    });
                });
```

Add the import at the top of `api.php`:
```php
use App\Http\Controllers\Api\V1\AqueductController;
```

- [ ] **Step 3: Run the tests**

Run: `docker compose exec php vendor/bin/pest tests/Feature/Api/V1/AqueductLookupGeneratorTest.php`
Expected: All 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/AqueductController.php backend/app/Http/Requests/Aqueduct/AqueductGenerateLookupsRequest.php backend/routes/api.php
git commit -m "feat(aqueduct): add AqueductController with lookup generator routes"
```

---

### Task 9: Wire Service Discovery

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/StudyAgentController.php` — `services()` method

- [ ] **Step 1: Write test for service discovery**

Add to `backend/tests/Feature/Api/V1/AqueductLookupGeneratorTest.php`:

```php
public function test_aqueduct_appears_in_service_discovery(): void
{
    $user = User::factory()->create();
    $user->assignRole('researcher');

    $response = $this->actingAs($user, 'sanctum')
        ->getJson('/api/v1/study-agent/services');

    $response->assertOk();

    $services = collect($response->json('data.services'));
    $aqueduct = $services->firstWhere('name', 'etl_mapping_workbench');

    $this->assertNotNull($aqueduct, 'Aqueduct should appear in service discovery');
    $this->assertEquals('Aqueduct', $aqueduct['ui_hints']['title']);
    $this->assertEquals('teal', $aqueduct['ui_hints']['accent']);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `docker compose exec php vendor/bin/pest tests/Feature/Api/V1/AqueductLookupGeneratorTest.php --filter=test_aqueduct_appears_in_service_discovery`
Expected: FAIL (Aqueduct not yet in service list)

- [ ] **Step 3: Modify StudyAgentController::services()**

In `StudyAgentController.php`, update the `services()` method signature to inject `AqueductService` and append its entry. Find the line where `CommunityWorkbenchSdkDemoService` is appended and add Aqueduct after it:

```php
use App\Services\Aqueduct\AqueductService;

// In the services() method, after the community demo line:
$services = $this->appendServiceEntry($services, $aqueductService->serviceEntry());
```

Update the method signature:
```php
public function services(
    CommunityWorkbenchSdkDemoService $demoService,
    AqueductService $aqueductService,
): JsonResponse
```

- [ ] **Step 4: Run test to verify it passes**

Run: `docker compose exec php vendor/bin/pest tests/Feature/Api/V1/AqueductLookupGeneratorTest.php --filter=test_aqueduct_appears_in_service_discovery`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/StudyAgentController.php backend/tests/Feature/Api/V1/AqueductLookupGeneratorTest.php
git commit -m "feat(aqueduct): wire Aqueduct into Workbench service discovery"
```

---

## Chunk 4: Frontend

### Task 10: Create Frontend Feature Module + Types

**Files:**
- Create: `frontend/src/features/aqueduct/types.ts`
- Create: `frontend/src/features/aqueduct/api.ts`

- [ ] **Step 1: Create types.ts**

```typescript
// Aqueduct ETL Mapping Workbench types
// Matches SDK result-envelope.schema.json contracts

export interface AqueductRuntime {
  status: string;
  adapter_mode: string;
  fallback_active: boolean;
  upstream_ready: boolean;
  dependency_issues: string[];
  notes: string[];
  timings?: Record<string, number>;
  last_error: string | null;
}

export interface AqueductArtifact {
  id: string;
  label: string;
  kind: string;
  content_type?: string;
  path?: string | null;
  summary: string;
  downloadable: boolean;
  previewable: boolean;
  content?: string;
}

export interface AqueductResultEnvelope {
  status: string;
  runtime: AqueductRuntime;
  summary: Record<string, unknown>;
  panels: unknown[];
  artifacts: { artifacts: AqueductArtifact[] };
  warnings: string[];
  next_actions: string[];
}

export interface LookupVocabulary {
  id: string;
  display_name: string;
  domain: string | null;
}

export interface LookupPreviewResponse {
  vocabulary: string;
  sql: string;
  includes_source_to_source: boolean;
}
```

- [ ] **Step 2: Create api.ts**

```typescript
import { apiClient } from "@/lib/api-client";
import { useQuery, useMutation } from "@tanstack/react-query";
import type {
  LookupVocabulary,
  LookupPreviewResponse,
  AqueductResultEnvelope,
} from "./types";

// -- Lookup Generator API --

export async function fetchLookupVocabularies(): Promise<LookupVocabulary[]> {
  const { data } = await apiClient.get("/etl/aqueduct/lookups/vocabularies");
  return data.data?.vocabularies ?? data.vocabularies ?? [];
}

export async function fetchLookupPreview(
  vocabulary: string,
): Promise<LookupPreviewResponse> {
  const { data } = await apiClient.get(
    `/etl/aqueduct/lookups/preview/${vocabulary}`,
  );
  return data.data ?? data;
}

export async function generateLookups(params: {
  vocabularies: string[];
  include_source_to_source?: boolean;
  vocab_schema?: string;
}): Promise<AqueductResultEnvelope> {
  const { data } = await apiClient.post(
    "/etl/aqueduct/lookups/generate",
    params,
  );
  return data.data ?? data;
}

// -- TanStack Query Hooks --

export function useLookupVocabularies() {
  return useQuery({
    queryKey: ["aqueduct", "lookups", "vocabularies"],
    queryFn: fetchLookupVocabularies,
  });
}

export function useLookupPreview(vocabulary: string | null) {
  return useQuery({
    queryKey: ["aqueduct", "lookups", "preview", vocabulary],
    queryFn: () => fetchLookupPreview(vocabulary!),
    enabled: !!vocabulary,
  });
}

export function useGenerateLookups() {
  return useMutation({
    mutationFn: generateLookups,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/aqueduct/types.ts frontend/src/features/aqueduct/api.ts
git commit -m "feat(aqueduct): add frontend types and API hooks"
```

---

### Task 11: Create Lookup Generator Tab Component

**Files:**
- Create: `frontend/src/features/aqueduct/components/LookupGeneratorTab.tsx`
- Create: `frontend/src/features/aqueduct/components/LookupPreview.tsx`

- [ ] **Step 1: Create LookupPreview.tsx**

```tsx
interface LookupPreviewProps {
  sql: string;
  vocabulary: string;
}

export default function LookupPreview({ sql, vocabulary }: LookupPreviewProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#161619] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium text-[#C9A227]">
          {vocabulary.toUpperCase()} Lookup SQL
        </h4>
        <button
          onClick={() => {
            const blob = new Blob([sql], { type: "text/sql" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${vocabulary}_lookup.sql`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="rounded bg-[#C9A227]/20 px-3 py-1 text-xs text-[#C9A227] hover:bg-[#C9A227]/30"
        >
          Download
        </button>
      </div>
      <pre className="max-h-96 overflow-auto rounded bg-black/40 p-3 text-xs text-gray-300">
        {sql}
      </pre>
    </div>
  );
}
```

- [ ] **Step 2: Create LookupGeneratorTab.tsx**

```tsx
import { useState } from "react";
import {
  useLookupVocabularies,
  useLookupPreview,
  useGenerateLookups,
} from "../api";
import LookupPreview from "./LookupPreview";
import type { AqueductArtifact } from "../types";

export default function LookupGeneratorTab() {
  const [selected, setSelected] = useState<string[]>([]);
  const [previewVocab, setPreviewVocab] = useState<string | null>(null);
  const [includeS2S, setIncludeS2S] = useState(true);

  const { data: vocabularies, isLoading } = useLookupVocabularies();
  const { data: preview } = useLookupPreview(previewVocab);
  const generateMutation = useGenerateLookups();

  const toggleVocab = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  const handleGenerate = () => {
    if (selected.length === 0) return;
    generateMutation.mutate({
      vocabularies: selected,
      include_source_to_source: includeS2S,
      vocab_schema: "vocab",
    });
  };

  return (
    <div className="space-y-6">
      {/* Vocabulary Picker */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-white">
          Vocabulary Lookup Generator
        </h3>
        <p className="mb-4 text-sm text-gray-400">
          Select vocabularies to generate SOURCE_TO_CONCEPT_MAP lookup SQL.
          These templates map source codes to standard OMOP concepts.
        </p>

        {isLoading ? (
          <div className="text-sm text-gray-500">Loading vocabularies...</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {vocabularies?.map((vocab) => (
              <button
                key={vocab.id}
                onClick={() => toggleVocab(vocab.id)}
                className={`rounded-lg border p-3 text-left text-sm transition ${
                  selected.includes(vocab.id)
                    ? "border-[#2DD4BF] bg-[#2DD4BF]/10 text-white"
                    : "border-white/10 bg-[#161619] text-gray-400 hover:border-white/20"
                }`}
              >
                <div className="font-medium">{vocab.display_name}</div>
                {vocab.domain && (
                  <div className="mt-1 text-xs text-gray-500">
                    {vocab.domain}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Options */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={includeS2S}
            onChange={(e) => setIncludeS2S(e.target.checked)}
            className="rounded border-gray-600 bg-[#161619]"
          />
          Include source-to-source lookups
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleGenerate}
          disabled={selected.length === 0 || generateMutation.isPending}
          className="rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-black transition hover:bg-[#2DD4BF]/80 disabled:opacity-50"
        >
          {generateMutation.isPending
            ? "Generating..."
            : `Generate ${selected.length} Lookup${selected.length !== 1 ? "s" : ""}`}
        </button>
        {selected.length === 1 && (
          <button
            onClick={() => setPreviewVocab(selected[0])}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-300 hover:border-white/20"
          >
            Preview SQL
          </button>
        )}
      </div>

      {/* Preview */}
      {preview && previewVocab && (
        <LookupPreview sql={preview.sql} vocabulary={previewVocab} />
      )}

      {/* Generated Results */}
      {generateMutation.data && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-[#C9A227]">
            Generated Lookups ({generateMutation.data.summary.vocabularies_assembled as number} vocabularies)
          </h4>
          {generateMutation.data.artifacts.artifacts.map(
            (artifact: AqueductArtifact) => (
              <LookupPreview
                key={artifact.id}
                sql={artifact.content ?? ""}
                vocabulary={artifact.id.replace("lookup_", "").replace("_sql", "")}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/aqueduct/components/LookupGeneratorTab.tsx frontend/src/features/aqueduct/components/LookupPreview.tsx
git commit -m "feat(aqueduct): add LookupGeneratorTab and LookupPreview components"
```

---

### Task 12: Create Aqueduct Page + Router Integration

**Files:**
- Create: `frontend/src/features/aqueduct/pages/AqueductPage.tsx`
- Modify: `frontend/src/app/router.tsx`

- [ ] **Step 1: Create AqueductPage.tsx**

```tsx
import { useState } from "react";
import LookupGeneratorTab from "../components/LookupGeneratorTab";

type AqueductTab = "schema_mapper" | "concept_matcher" | "lookup_generator";

const TABS: { id: AqueductTab; label: string; available: boolean }[] = [
  { id: "schema_mapper", label: "Schema Mapper", available: false },
  { id: "concept_matcher", label: "Concept Matcher", available: false },
  { id: "lookup_generator", label: "Lookup Generator", available: true },
];

export default function AqueductPage() {
  const [activeTab, setActiveTab] = useState<AqueductTab>("lookup_generator");

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Aqueduct</h1>
        <p className="mt-1 text-sm text-gray-400">
          ETL Mapping Workbench — design source-to-CDM mappings with concept
          matching and vocabulary lookups
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-lg border border-white/10 bg-[#161619] p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => tab.available && setActiveTab(tab.id)}
            disabled={!tab.available}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
                : tab.available
                  ? "text-gray-400 hover:text-gray-300"
                  : "cursor-not-allowed text-gray-600"
            }`}
          >
            {tab.label}
            {!tab.available && (
              <span className="ml-2 text-xs text-gray-600">(Coming Soon)</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-lg border border-white/10 bg-[#0E0E11] p-6">
        {activeTab === "lookup_generator" && <LookupGeneratorTab />}
        {activeTab === "schema_mapper" && (
          <div className="py-12 text-center text-gray-500">
            Schema Mapper — Phase 3
          </div>
        )}
        {activeTab === "concept_matcher" && (
          <div className="py-12 text-center text-gray-500">
            Concept Matcher — Phase 2
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add route to router.tsx**

In `frontend/src/app/router.tsx`, add after the `workbench/community-sdk-demo` route (around line 302):

```typescript
{
  path: "workbench/aqueduct",
  lazy: () =>
    import("@/features/aqueduct/pages/AqueductPage").then(
      (m) => ({ Component: m.default }),
    ),
},
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit 2>&1 | head -20"`
Expected: No errors (or only pre-existing errors)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/aqueduct/pages/AqueductPage.tsx frontend/src/app/router.tsx
git commit -m "feat(aqueduct): add AqueductPage with tabbed layout and router integration"
```

---

## Chunk 5: Workbench Discovery Card + Final Integration

### Task 13: Add Aqueduct Discovery Card to Workbench Page

**Files:**
- Modify: `frontend/src/features/finngen/pages/FinnGenToolsPage.tsx`

- [ ] **Step 1: Add Aqueduct to Workbench discovery**

In `FinnGenToolsPage.tsx`, find the "Community Tool Spotlight" section and add an Aqueduct card after it. The card should link to `/workbench/aqueduct` with teal accent color. Ensure `Link` is imported from `react-router-dom` (it likely already is in this file):

```tsx
{/* Aqueduct ETL Workbench */}
<div className="rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/5 p-4">
  <div className="flex items-center gap-2">
    <div className="h-2 w-2 rounded-full bg-[#2DD4BF]" />
    <h3 className="font-semibold text-white">Aqueduct</h3>
  </div>
  <p className="mt-2 text-sm text-gray-400">
    Design and validate ETL mappings from source data to OMOP CDM with
    concept matching and vocabulary lookup generation.
  </p>
  <div className="mt-3 flex gap-2">
    <Link
      to="/workbench/aqueduct"
      className="rounded bg-[#2DD4BF]/20 px-3 py-1 text-xs text-[#2DD4BF] hover:bg-[#2DD4BF]/30"
    >
      Open Aqueduct
    </Link>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/finngen/pages/FinnGenToolsPage.tsx
git commit -m "feat(aqueduct): add Aqueduct discovery card to Workbench page"
```

---

### Task 14: Add MCP Tool + Service Registry Entry

**Files:**
- Create: `study-agent/mcp_server/study_agent_mcp/tools/etl_mapping_workbench.py`
- Modify: `study-agent/mcp_server/study_agent_mcp/tools/__init__.py`
- Modify: `study-agent/docs/SERVICE_REGISTRY.yaml`

- [ ] **Step 1: Create MCP tool module**

```python
"""Aqueduct ETL Mapping Workbench catalog tool."""

from __future__ import annotations

import os
from typing import Any, Dict


def register(mcp: object) -> None:
    @mcp.tool(name="etl_mapping_workbench_catalog")  # type: ignore[attr-defined]
    def etl_mapping_workbench_catalog() -> Dict[str, Any]:
        """Return Aqueduct ETL Mapping Workbench service descriptor."""
        payload = {
            "project": "etl_mapping_workbench",
            "label": "Aqueduct",
            "repository": None,
            "workspace": "etl-workbench",
            "enabled": True,
            "configured": bool(os.getenv("ETL_MAPPING_WORKBENCH_ENABLED")),
            "operations": [
                "list_vocabularies",
                "preview_lookup",
                "generate_lookups",
            ],
            "visualizations": ["sql_preview"],
        }
        return payload

    return None
```

- [ ] **Step 2: Register in tools/__init__.py**

Add to `OPTIONAL_TOOL_MODULES` list:

```python
("ETL_MAPPING_WORKBENCH_ENABLED", "study_agent_mcp.tools.etl_mapping_workbench"),
```

- [ ] **Step 3: Add SERVICE_REGISTRY.yaml entry**

Append to `study-agent/docs/SERVICE_REGISTRY.yaml`:

```yaml
etl_mapping_workbench:
  endpoint: /flows/etl-mapping
  description: Visual source-to-CDM mapping with concept matching and vocabulary lookup generation.
  mcp_tools:
    - etl_mapping_workbench_catalog
  input:
    - source_key
    - scan_report
    - mapping_config
    - source_codes_csv
    - vocabulary_filters
  output:
    - mapping_summary
    - concept_matches
    - lookup_sql
    - etl_archive
  validation:
    - registration gated by ETL_MAPPING_WORKBENCH_ENABLED
    - writes require explicit confirmation before execution tools are added
  ui_hints:
    title: Aqueduct
    summary: Design and validate ETL mappings from source data to OMOP CDM
    accent: teal
    repository: null
    workspace: etl-workbench
```

- [ ] **Step 4: Commit**

```bash
git add study-agent/mcp_server/study_agent_mcp/tools/etl_mapping_workbench.py study-agent/mcp_server/study_agent_mcp/tools/__init__.py study-agent/docs/SERVICE_REGISTRY.yaml
git commit -m "feat(aqueduct): add MCP tool and service registry entry"
```

---

### Task 15: Run Full Test Suite + Deploy

- [ ] **Step 1: Run backend tests**

Run: `docker compose exec php vendor/bin/pest tests/Feature/Api/V1/AqueductLookupGeneratorTest.php --verbose`
Expected: All tests PASS

- [ ] **Step 2: Run TypeScript check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit 2>&1 | tail -5"`
Expected: No new errors

- [ ] **Step 3: Build frontend**

Run: `./deploy.sh --frontend`
Expected: Build completes successfully

- [ ] **Step 4: Deploy**

Run: `./deploy.sh --php --db`
Expected: Caches cleared, migrations run

- [ ] **Step 5: Verify in browser**

Navigate to:
1. `https://parthenon.acumenus.net/workbench` — Aqueduct discovery card visible
2. `https://parthenon.acumenus.net/workbench/aqueduct` — Tabbed page loads
3. Click "Lookup Generator" tab — vocabulary list loads
4. Select ICD-10-CM, click Generate — SQL appears

- [ ] **Step 6: Verify no untracked files were missed**

Run: `git status`
Expected: Only Aqueduct-related files. Stage any remaining files individually, then verify with `git diff --cached --stat`.

**Note:** `POST /etl/aqueduct/lookups/custom` (user-defined lookups) and `GET|POST /etl/aqueduct/runs` (run history) are deferred to Phase 2. The routes, models, and migration for runs are in place but not yet exposed via API.
