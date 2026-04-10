# Patient Labs Trend Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Patient Labs Panel's broken table view with a Recharts line chart that shades the reference range as a background band, backed by a hybrid (curated YAML + per-source population percentile) reference range data layer so that Ranges and Status are populated for every common lab across all CDM sources.

**Architecture:** Two new `app`-schema tables (`lab_reference_range_curated`, `lab_reference_range_population`) plus a `LabReferenceRangeService` that resolves ranges curated-first, population-fallback. `PatientProfileService::getMeasurements()` groups measurements and attaches ranges, extending the API response with a new backward-compatible `labGroups` field. Frontend swaps the expanded-row table for a Recharts `ComposedChart` with `ReferenceArea` band plus a "Show values" toggle that reveals the extracted `LabValuesTable`.

**Tech Stack:** Laravel 11 / PHP 8.4 (backend), PostgreSQL 16/17 with `percentile_cont`, Pest for backend tests, React 19 + TypeScript + Vite 7 + Recharts 3.8.1 (frontend), Vitest + React Testing Library for frontend tests. YAML for curated seed (via Symfony Yaml component already in Laravel).

**Spec:** `docs/superpowers/specs/2026-04-09-patient-labs-trend-chart-design.md`

**Branch:** Work directly on `main` per Parthenon convention. Create per-task commits (see memory `feedback_sprint_completion_sop.md`).

---

## File Structure

### New files

```
backend/
  app/
    DataTransferObjects/
      LabRangeDto.php                                         # Readonly DTO
    Enums/
      LabStatus.php                                           # Enum Low/Normal/High/Critical/Unknown
    Services/Analysis/
      LabReferenceRangeService.php                            # Lookup / lookupMany / memoization
      LabStatusClassifier.php                                 # Pure classifier
    Console/Commands/
      ComputeReferenceRangesCommand.php                       # labs:compute-reference-ranges
  database/
    migrations/
      2026_04_09_000001_create_lab_reference_range_curated_table.php
      2026_04_09_000002_create_lab_reference_range_population_table.php
    seeders/
      LabReferenceRangeSeeder.php                             # YAML loader
      data/
        lab_reference_ranges.yaml                             # Curated ranges (~170 labs)
  tests/
    Unit/Services/Analysis/
      LabReferenceRangeServiceTest.php
      LabStatusClassifierTest.php
    Unit/Seeders/
      LabReferenceRangeSeederTest.php
    Feature/Console/
      ComputeReferenceRangesCommandTest.php

frontend/
  src/features/profiles/
    components/
      LabTrendChart.tsx                                       # Recharts ComposedChart + ReferenceArea
      LabTrendTooltip.tsx                                     # Custom tooltip
      LabStatusDot.tsx                                        # Per-point status dot
      LabValuesTable.tsx                                      # Extracted from PatientLabPanel
      __tests__/
        LabTrendChart.test.tsx
        LabStatusDot.test.tsx
        LabValuesTable.test.tsx
        PatientLabPanel.test.tsx                              # Integration smoke
```

### Modified files

```
backend/
  app/
    Http/Controllers/Api/V1/PatientProfileController.php       # Response shape extension
    Services/Analysis/PatientProfileService.php                # Group + lookup + attach ranges
  database/seeders/
    DatabaseSeeder.php                                         # Wire LabReferenceRangeSeeder
  openapi.yaml                                                 # New schemas: LabGroup, LabValue, LabRange, LabStatus
  tests/Feature/Api/V1/
    PatientProfileControllerTest.php                           # labGroups assertions

frontend/
  src/features/profiles/
    components/PatientLabPanel.tsx                             # Remove table, add chart + toggle
    types.ts                                                   # New DTO types (or regen from openapi)
    hooks/useProfiles.ts                                       # Broaden return type (no behavior change)
  src/types/
    api.generated.ts                                           # Regenerated via deploy.sh --openapi
```

---

## Task Map

| Phase | Task | Summary |
|---|---|---|
| 1. Data Layer | 1 | Migration: `lab_reference_range_curated` table |
| 1. Data Layer | 2 | Migration: `lab_reference_range_population` table |
| 1. Data Layer | 3 | `LabStatus` enum + `LabRangeDto` readonly class |
| 2. Services | 4 | `LabStatusClassifier` (TDD) |
| 2. Services | 5 | `LabReferenceRangeService::lookup()` (TDD) |
| 2. Services | 6 | `LabReferenceRangeService::lookupMany()` + memoization |
| 3. Seeding | 7 | Curated YAML seed file (initial ~40 labs) |
| 3. Seeding | 8 | `LabReferenceRangeSeeder` (TDD) |
| 3. Seeding | 9 | Wire into `DatabaseSeeder`, run migrations + seeder |
| 3. Seeding | 10 | `ComputeReferenceRangesCommand` (TDD) |
| 4. API | 11 | Extend `PatientProfileService::getMeasurements()` — group + range + classify |
| 4. API | 12 | Extend `PatientProfileController` response shape + controller test |
| 4. API | 13 | Update `openapi.yaml` + regenerate frontend types |
| 5. Frontend | 14 | `LabStatusDot` component (TDD) |
| 5. Frontend | 15 | `LabTrendTooltip` component |
| 5. Frontend | 16 | `LabValuesTable` (extracted from `PatientLabPanel`) (TDD) |
| 5. Frontend | 17 | `LabTrendChart` Recharts component (TDD) |
| 5. Frontend | 18 | `PatientLabPanel` integration: replace table, add toggle, remove grouping logic |
| 6. Deploy | 19 | Run seeder + `labs:compute-reference-ranges` for each source |
| 6. Deploy | 20 | End-to-end manual verification + devlog entry |
| 6. Deploy | 21 | (Optional, stretch) Expand YAML to full Tier 3 coverage |

---

## Phase 1: Data Layer

### Task 1: Migration — `lab_reference_range_curated` table

**Files:**
- Create: `backend/database/migrations/2026_04_09_000001_create_lab_reference_range_curated_table.php`

- [ ] **Step 1: Create the migration file**

```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('pgsql')->create('lab_reference_range_curated', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('measurement_concept_id');
            $table->unsignedInteger('unit_concept_id');
            $table->char('sex', 1);                       // 'M','F','A' (A = any)
            $table->unsignedSmallInteger('age_low')->nullable();
            $table->unsignedSmallInteger('age_high')->nullable();
            $table->decimal('range_low', 12, 4);
            $table->decimal('range_high', 12, 4);
            $table->string('source_ref', 64);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('measurement_concept_id');
            $table->index('unit_concept_id');
            // Partial unique: NULL age bounds collide by default in Postgres,
            // so we use COALESCE via a raw index in a follow-up statement.
        });

        // Postgres treats NULLs as distinct in unique indexes, which would
        // allow duplicate (concept, unit, sex, NULL, NULL) rows. Use COALESCE
        // sentinels to ensure uniqueness across null bounds.
        \DB::connection('pgsql')->statement(<<<'SQL'
            CREATE UNIQUE INDEX lrr_curated_uniq
            ON lab_reference_range_curated (
                measurement_concept_id,
                unit_concept_id,
                sex,
                COALESCE(age_low, 0),
                COALESCE(age_high, 65535)
            )
        SQL);
    }

    public function down(): void
    {
        Schema::connection('pgsql')->dropIfExists('lab_reference_range_curated');
    }
};
```

- [ ] **Step 2: Run the migration against the dev DB**

```bash
docker compose exec php php artisan migrate --path=database/migrations/2026_04_09_000001_create_lab_reference_range_curated_table.php
```

Expected output: `Migrating: 2026_04_09_000001_create_lab_reference_range_curated_table` then `Migrated: ...`.

**NEVER use `--force` without `--path=`** (memory: `feedback_never_migrate_force.md`). Always scope to the specific migration path.

- [ ] **Step 3: Verify the table exists with the correct schema**

```bash
PGPASSWORD= psql -h localhost -U claude_dev -d parthenon -c "\d app.lab_reference_range_curated"
```

Expected: 11 columns plus the `lrr_curated_uniq` index.

- [ ] **Step 4: Verify unique constraint behaves correctly with NULL bounds**

```bash
PGPASSWORD= psql -h localhost -U claude_dev -d parthenon -c "
INSERT INTO app.lab_reference_range_curated
(measurement_concept_id, unit_concept_id, sex, age_low, age_high, range_low, range_high, source_ref, created_at, updated_at)
VALUES (3000963, 8713, 'F', 18, NULL, 12.0, 15.5, 'test', now(), now());

INSERT INTO app.lab_reference_range_curated
(measurement_concept_id, unit_concept_id, sex, age_low, age_high, range_low, range_high, source_ref, created_at, updated_at)
VALUES (3000963, 8713, 'F', 18, NULL, 12.0, 15.5, 'test', now(), now());
"
```

Expected: second INSERT fails with `duplicate key value violates unique constraint "lrr_curated_uniq"`. Clean up: `DELETE FROM app.lab_reference_range_curated WHERE source_ref = 'test';`

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/2026_04_09_000001_create_lab_reference_range_curated_table.php
git commit -m "feat(profiles): add lab_reference_range_curated table"
```

---

### Task 2: Migration — `lab_reference_range_population` table

**Files:**
- Create: `backend/database/migrations/2026_04_09_000002_create_lab_reference_range_population_table.php`

- [ ] **Step 1: Create the migration file**

```php
<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::connection('pgsql')->create('lab_reference_range_population', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->unsignedInteger('measurement_concept_id');
            $table->unsignedInteger('unit_concept_id');
            $table->decimal('range_low', 12, 4);          // P2.5
            $table->decimal('range_high', 12, 4);         // P97.5
            $table->decimal('median', 12, 4)->nullable(); // P50
            $table->unsignedBigInteger('n_observations');
            $table->timestamp('computed_at');
            $table->timestamps();

            $table->unique(
                ['source_id', 'measurement_concept_id', 'unit_concept_id'],
                'lrr_pop_uniq'
            );
            $table->index(['measurement_concept_id', 'unit_concept_id'], 'lrr_pop_concept_unit_idx');
        });
    }

    public function down(): void
    {
        Schema::connection('pgsql')->dropIfExists('lab_reference_range_population');
    }
};
```

- [ ] **Step 2: Run the migration**

```bash
docker compose exec php php artisan migrate --path=database/migrations/2026_04_09_000002_create_lab_reference_range_population_table.php
```

Expected: `Migrated: 2026_04_09_000002_create_lab_reference_range_population_table`.

- [ ] **Step 3: Verify table + foreign key**

```bash
PGPASSWORD= psql -h localhost -U claude_dev -d parthenon -c "\d app.lab_reference_range_population"
```

Expected: 11 columns, `lrr_pop_uniq` unique constraint, and a foreign key reference to `app.sources(id)` with `ON DELETE CASCADE`.

- [ ] **Step 4: Commit**

```bash
git add backend/database/migrations/2026_04_09_000002_create_lab_reference_range_population_table.php
git commit -m "feat(profiles): add lab_reference_range_population table"
```

---

### Task 3: `LabStatus` enum and `LabRangeDto`

**Files:**
- Create: `backend/app/Enums/LabStatus.php`
- Create: `backend/app/DataTransferObjects/LabRangeDto.php`

- [ ] **Step 1: Create the `LabStatus` enum**

```php
<?php

declare(strict_types=1);

namespace App\Enums;

enum LabStatus: string
{
    case Low      = 'low';
    case Normal   = 'normal';
    case High     = 'high';
    case Critical = 'critical';
    case Unknown  = 'unknown';
}
```

- [ ] **Step 2: Create the `LabRangeDto` readonly class**

```php
<?php

declare(strict_types=1);

namespace App\DataTransferObjects;

final readonly class LabRangeDto
{
    public function __construct(
        public float $low,
        public float $high,
        public string $source,        // 'curated' | 'population'
        public string $sourceLabel,   // 'LOINC (F, 18+)' | 'SynPUF pop. P2.5–P97.5 (n=12,430)'
        public ?string $sourceRef = null,  // curated: 'Mayo' etc.
        public ?int $nObservations = null, // population: row count
    ) {}

    /** @return array{low: float, high: float, source: string, sourceLabel: string, sourceRef: ?string, nObservations: ?int} */
    public function toArray(): array
    {
        return [
            'low' => $this->low,
            'high' => $this->high,
            'source' => $this->source,
            'sourceLabel' => $this->sourceLabel,
            'sourceRef' => $this->sourceRef,
            'nObservations' => $this->nObservations,
        ];
    }
}
```

- [ ] **Step 3: Run Pint to verify formatting**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Enums/LabStatus.php app/DataTransferObjects/LabRangeDto.php"
```

Expected: `No errors found` or auto-fix with no diff.

- [ ] **Step 4: Run PHPStan on the new files**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/phpstan analyse app/Enums/LabStatus.php app/DataTransferObjects/LabRangeDto.php --level=8"
```

Expected: `[OK] No errors`.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Enums/LabStatus.php backend/app/DataTransferObjects/LabRangeDto.php
git commit -m "feat(profiles): add LabStatus enum and LabRangeDto"
```

---

## Phase 2: Services

### Task 4: `LabStatusClassifier` (TDD)

**Files:**
- Create: `backend/tests/Unit/Services/Analysis/LabStatusClassifierTest.php`
- Create: `backend/app/Services/Analysis/LabStatusClassifier.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

declare(strict_types=1);

use App\DataTransferObjects\LabRangeDto;
use App\Enums\LabStatus;
use App\Services\Analysis\LabStatusClassifier;

dataset('classification_cases', [
    // [value, low, high, expected]
    'value in range'              => [10.0, 8.0, 12.0, LabStatus::Normal],
    'value at lower bound'        => [8.0,  8.0, 12.0, LabStatus::Normal],
    'value at upper bound'        => [12.0, 8.0, 12.0, LabStatus::Normal],
    'value just below low'        => [7.99, 8.0, 12.0, LabStatus::Low],
    'value just above high'       => [12.01, 8.0, 12.0, LabStatus::High],
    'value far below low'         => [5.0,  8.0, 12.0, LabStatus::Low],
    'value far above high'        => [20.0, 8.0, 12.0, LabStatus::High],
    'value critical low'          => [-1.0, 8.0, 12.0, LabStatus::Critical],   // 8 - 2*(12-8) = 0; -1 < 0
    'value critical high'         => [25.0, 8.0, 12.0, LabStatus::Critical],   // 12 + 2*(12-8) = 20; 25 > 20
    'value at critical boundary'  => [0.0,  8.0, 12.0, LabStatus::Low],        // exactly 0, not < 0
    'negative range, not critical'=> [-5.0, -10.0, 0.0, LabStatus::Normal],
]);

test('classifies value against range', function (float $value, float $low, float $high, LabStatus $expected) {
    $range = new LabRangeDto(
        low: $low,
        high: $high,
        source: 'curated',
        sourceLabel: 'test',
    );

    expect(LabStatusClassifier::classify($value, $range))->toBe($expected);
})->with('classification_cases');

test('returns Unknown when range is null', function () {
    expect(LabStatusClassifier::classify(10.0, null))->toBe(LabStatus::Unknown);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Services/Analysis/LabStatusClassifierTest.php"
```

Expected: FAIL with `Class "App\Services\Analysis\LabStatusClassifier" not found`.

- [ ] **Step 3: Implement the classifier**

```php
<?php

declare(strict_types=1);

namespace App\Services\Analysis;

use App\DataTransferObjects\LabRangeDto;
use App\Enums\LabStatus;

final class LabStatusClassifier
{
    /**
     * Classify a numeric value against a reference range.
     *
     * Uses a simple 2× band-width heuristic for "Critical":
     *   band_width = high - low
     *   value < low  - 2*band_width → Critical
     *   value > high + 2*band_width → Critical
     *
     * This is a rough panic-flag approximation, tunable if clinical review
     * finds it wrong. See spec §5.
     */
    public static function classify(float $value, ?LabRangeDto $range): LabStatus
    {
        if ($range === null) {
            return LabStatus::Unknown;
        }

        $bandWidth = $range->high - $range->low;
        $criticalBuffer = $bandWidth * 2.0;

        if ($value < $range->low - $criticalBuffer || $value > $range->high + $criticalBuffer) {
            return LabStatus::Critical;
        }
        if ($value < $range->low) {
            return LabStatus::Low;
        }
        if ($value > $range->high) {
            return LabStatus::High;
        }

        return LabStatus::Normal;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Services/Analysis/LabStatusClassifierTest.php"
```

Expected: `Tests: 12 passed` (11 parameterized + 1 null case).

- [ ] **Step 5: Run Pint and PHPStan**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/Analysis/LabStatusClassifier.php tests/Unit/Services/Analysis/LabStatusClassifierTest.php"
docker compose exec php sh -c "cd /var/www/html && vendor/bin/phpstan analyse app/Services/Analysis/LabStatusClassifier.php --level=8"
```

Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Services/Analysis/LabStatusClassifier.php backend/tests/Unit/Services/Analysis/LabStatusClassifierTest.php
git commit -m "feat(profiles): add LabStatusClassifier with unit tests"
```

---

### Task 5: `LabReferenceRangeService::lookup()` (TDD)

Implements the single-lookup path. `lookupMany` is bolted on in Task 6.

**Files:**
- Create: `backend/tests/Unit/Services/Analysis/LabReferenceRangeServiceTest.php`
- Create: `backend/app/Services/Analysis/LabReferenceRangeService.php`

- [ ] **Step 1: Write the failing test file**

```php
<?php

declare(strict_types=1);

use App\DataTransferObjects\LabRangeDto;
use App\Services\Analysis\LabReferenceRangeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

// Concept ids used across the tests — arbitrary values; no FK constraint
// on concept tables, so we don't need real vocab rows here.
const HGB_CONCEPT  = 3000963;
const GDL_UNIT     = 8713;
const SOURCE_ID    = 1;

beforeEach(function () {
    DB::connection('pgsql')->table('sources')->insert([
        'id' => SOURCE_ID,
        'source_key' => 'test_source',
        'source_name' => 'Test Source',
        'source_schema' => 'test',
        'is_enabled' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
});

test('returns null when no curated or population rows exist', function () {
    $service = app(LabReferenceRangeService::class);

    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'M', 40);

    expect($result)->toBeNull();
});

test('returns curated row when sex and age match', function () {
    DB::connection('pgsql')->table('lab_reference_range_curated')->insert([
        'measurement_concept_id' => HGB_CONCEPT,
        'unit_concept_id' => GDL_UNIT,
        'sex' => 'F',
        'age_low' => 18,
        'age_high' => null,
        'range_low' => 12.0,
        'range_high' => 15.5,
        'source_ref' => 'Mayo',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $service = app(LabReferenceRangeService::class);

    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'F', 32);

    expect($result)->toBeInstanceOf(LabRangeDto::class);
    expect($result->low)->toBe(12.0);
    expect($result->high)->toBe(15.5);
    expect($result->source)->toBe('curated');
    expect($result->sourceRef)->toBe('Mayo');
});

test('prefers the narrowest matching curated band', function () {
    // Two matching curated rows for a 40yo male:
    //   (M, 18, NULL)  — width infinite
    //   (M, 18, 49)    — width 31 (narrower)
    DB::connection('pgsql')->table('lab_reference_range_curated')->insert([
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'M', 'age_low' => 18, 'age_high' => null,
            'range_low' => 13.0, 'range_high' => 18.0,
            'source_ref' => 'adult-unbounded', 'created_at' => now(), 'updated_at' => now(),
        ],
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'M', 'age_low' => 18, 'age_high' => 49,
            'range_low' => 13.5, 'range_high' => 17.5,
            'source_ref' => 'adult-18-49', 'created_at' => now(), 'updated_at' => now(),
        ],
    ]);

    $service = app(LabReferenceRangeService::class);
    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'M', 40);

    expect($result->sourceRef)->toBe('adult-18-49');
    expect($result->low)->toBe(13.5);
});

test('sex-specific curated row beats sex=A row', function () {
    DB::connection('pgsql')->table('lab_reference_range_curated')->insert([
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'A', 'age_low' => 18, 'age_high' => null,
            'range_low' => 12.0, 'range_high' => 18.0,
            'source_ref' => 'any', 'created_at' => now(), 'updated_at' => now(),
        ],
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'F', 'age_low' => 18, 'age_high' => null,
            'range_low' => 12.0, 'range_high' => 15.5,
            'source_ref' => 'female', 'created_at' => now(), 'updated_at' => now(),
        ],
    ]);

    $service = app(LabReferenceRangeService::class);
    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'F', 32);

    expect($result->sourceRef)->toBe('female');
});

test('falls through to population when no curated row matches', function () {
    DB::connection('pgsql')->table('lab_reference_range_population')->insert([
        'source_id' => SOURCE_ID,
        'measurement_concept_id' => HGB_CONCEPT,
        'unit_concept_id' => GDL_UNIT,
        'range_low' => 10.5,
        'range_high' => 16.0,
        'median' => 13.2,
        'n_observations' => 5000,
        'computed_at' => now(),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $service = app(LabReferenceRangeService::class);
    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'M', 40);

    expect($result->source)->toBe('population');
    expect($result->low)->toBe(10.5);
    expect($result->nObservations)->toBe(5000);
});

test('age out of band falls through to next candidate', function () {
    // Curated only has (M, 18, 49); a 70yo male should fall to population.
    DB::connection('pgsql')->table('lab_reference_range_curated')->insert([
        'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
        'sex' => 'M', 'age_low' => 18, 'age_high' => 49,
        'range_low' => 13.5, 'range_high' => 17.5,
        'source_ref' => 'adult-18-49', 'created_at' => now(), 'updated_at' => now(),
    ]);
    DB::connection('pgsql')->table('lab_reference_range_population')->insert([
        'source_id' => SOURCE_ID,
        'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
        'range_low' => 11.0, 'range_high' => 16.5,
        'median' => 13.0, 'n_observations' => 1000,
        'computed_at' => now(), 'created_at' => now(), 'updated_at' => now(),
    ]);

    $service = app(LabReferenceRangeService::class);
    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'M', 70);

    expect($result->source)->toBe('population');
});

test('null unit_concept_id always returns null', function () {
    DB::connection('pgsql')->table('lab_reference_range_curated')->insert([
        'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
        'sex' => 'M', 'age_low' => 18, 'age_high' => null,
        'range_low' => 13.5, 'range_high' => 17.5,
        'source_ref' => 'Mayo', 'created_at' => now(), 'updated_at' => now(),
    ]);

    $service = app(LabReferenceRangeService::class);
    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, null, 'M', 40);

    expect($result)->toBeNull();
});

test('null sex skips sex-specific curated rows', function () {
    DB::connection('pgsql')->table('lab_reference_range_curated')->insert([
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'F', 'age_low' => 18, 'age_high' => null,
            'range_low' => 12.0, 'range_high' => 15.5,
            'source_ref' => 'female', 'created_at' => now(), 'updated_at' => now(),
        ],
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'A', 'age_low' => 18, 'age_high' => null,
            'range_low' => 11.0, 'range_high' => 17.0,
            'source_ref' => 'any', 'created_at' => now(), 'updated_at' => now(),
        ],
    ]);

    $service = app(LabReferenceRangeService::class);
    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, null, 40);

    expect($result->sourceRef)->toBe('any');
});

test('null age matches only rows with both age bounds null', function () {
    DB::connection('pgsql')->table('lab_reference_range_curated')->insert([
        [
            // Unbanded row — should match
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'M', 'age_low' => null, 'age_high' => null,
            'range_low' => 13.0, 'range_high' => 18.0,
            'source_ref' => 'unbanded', 'created_at' => now(), 'updated_at' => now(),
        ],
        [
            // Age-banded row — should NOT match when age is null
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'M', 'age_low' => 18, 'age_high' => 49,
            'range_low' => 13.5, 'range_high' => 17.5,
            'source_ref' => '18-49', 'created_at' => now(), 'updated_at' => now(),
        ],
    ]);

    $service = app(LabReferenceRangeService::class);
    $result = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'M', null);

    expect($result->sourceRef)->toBe('unbanded');
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Services/Analysis/LabReferenceRangeServiceTest.php"
```

Expected: FAIL with `Class "App\Services\Analysis\LabReferenceRangeService" not found`.

- [ ] **Step 3: Implement the service**

```php
<?php

declare(strict_types=1);

namespace App\Services\Analysis;

use App\DataTransferObjects\LabRangeDto;
use Illuminate\Database\DatabaseManager;

final class LabReferenceRangeService
{
    /** @var array<string, ?LabRangeDto> per-request memoization */
    private array $memo = [];

    public function __construct(
        private readonly DatabaseManager $db,
    ) {}

    /**
     * Resolve a reference range for one measurement context.
     *
     * Lookup order (see spec §5):
     *   1. Curated — sex-specific + age band match (narrowest wins)
     *   2. Curated — sex='A' + age band match (narrowest wins)
     *   3. Population — per (source, concept, unit)
     *   4. Null
     */
    public function lookup(
        int $sourceId,
        int $measurementConceptId,
        ?int $unitConceptId,
        ?string $personSex,
        ?int $personAgeYears,
    ): ?LabRangeDto {
        if ($unitConceptId === null) {
            return null;
        }

        $key = sprintf(
            '%d:%d:%d:%s:%s',
            $sourceId,
            $measurementConceptId,
            $unitConceptId,
            $personSex ?? '-',
            $personAgeYears === null ? '-' : (string) $personAgeYears,
        );

        if (array_key_exists($key, $this->memo)) {
            return $this->memo[$key];
        }

        // Step 1 — sex-specific curated (skipped if sex unknown)
        if ($personSex !== null) {
            $row = $this->queryCurated($measurementConceptId, $unitConceptId, $personSex, $personAgeYears);
            if ($row !== null) {
                return $this->memo[$key] = $this->curatedDto($row);
            }
        }

        // Step 2 — sex='A' curated
        $row = $this->queryCurated($measurementConceptId, $unitConceptId, 'A', $personAgeYears);
        if ($row !== null) {
            return $this->memo[$key] = $this->curatedDto($row);
        }

        // Step 3 — population fallback
        $row = $this->queryPopulation($sourceId, $measurementConceptId, $unitConceptId);
        if ($row !== null) {
            return $this->memo[$key] = $this->populationDto($row, $sourceId);
        }

        return $this->memo[$key] = null;
    }

    /**
     * Query the curated table for the narrowest matching row.
     *
     * Narrowness = (COALESCE(age_high, 65535) - COALESCE(age_low, 0)) ASC.
     * When personAgeYears is null, only match rows where both bounds are null.
     *
     * @return object|null stdClass with columns or null
     */
    private function queryCurated(
        int $conceptId,
        int $unitConceptId,
        string $sex,
        ?int $personAgeYears,
    ): ?object {
        $query = $this->db->connection('pgsql')
            ->table('lab_reference_range_curated')
            ->where('measurement_concept_id', $conceptId)
            ->where('unit_concept_id', $unitConceptId)
            ->where('sex', $sex);

        if ($personAgeYears === null) {
            $query->whereNull('age_low')->whereNull('age_high');
        } else {
            $query->where(function ($q) use ($personAgeYears) {
                $q->whereNull('age_low')->orWhere('age_low', '<=', $personAgeYears);
            })->where(function ($q) use ($personAgeYears) {
                $q->whereNull('age_high')->orWhere('age_high', '>=', $personAgeYears);
            });
        }

        $query->orderByRaw('COALESCE(age_high, 65535) - COALESCE(age_low, 0) ASC')
            ->orderByRaw('COALESCE(age_low, 0) ASC')
            ->limit(1);

        /** @var object|null $row */
        $row = $query->first();

        return $row;
    }

    private function queryPopulation(int $sourceId, int $conceptId, int $unitConceptId): ?object
    {
        /** @var object|null $row */
        $row = $this->db->connection('pgsql')
            ->table('lab_reference_range_population')
            ->where('source_id', $sourceId)
            ->where('measurement_concept_id', $conceptId)
            ->where('unit_concept_id', $unitConceptId)
            ->first();

        return $row;
    }

    private function curatedDto(object $row): LabRangeDto
    {
        $sexLabel = match ($row->sex) {
            'M' => 'M',
            'F' => 'F',
            default => 'Any',
        };
        $ageLabel = $this->formatAgeBand($row->age_low, $row->age_high);
        $label = sprintf('%s (%s%s)', $row->source_ref, $sexLabel, $ageLabel !== '' ? ", {$ageLabel}" : '');

        return new LabRangeDto(
            low: (float) $row->range_low,
            high: (float) $row->range_high,
            source: 'curated',
            sourceLabel: $label,
            sourceRef: $row->source_ref,
        );
    }

    private function populationDto(object $row, int $sourceId): LabRangeDto
    {
        $sourceKey = $this->db->connection('pgsql')
            ->table('sources')
            ->where('id', $sourceId)
            ->value('source_key') ?? 'source';

        $label = sprintf(
            '%s pop. P2.5–P97.5 (n=%s)',
            $sourceKey,
            number_format((float) $row->n_observations),
        );

        return new LabRangeDto(
            low: (float) $row->range_low,
            high: (float) $row->range_high,
            source: 'population',
            sourceLabel: $label,
            nObservations: (int) $row->n_observations,
        );
    }

    private function formatAgeBand(?int $ageLow, ?int $ageHigh): string
    {
        if ($ageLow === null && $ageHigh === null) {
            return '';
        }
        if ($ageHigh === null) {
            return "{$ageLow}+";
        }
        if ($ageLow === null) {
            return "0-{$ageHigh}";
        }

        return "{$ageLow}-{$ageHigh}";
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Services/Analysis/LabReferenceRangeServiceTest.php"
```

Expected: `Tests: 9 passed`.

- [ ] **Step 5: Run Pint and PHPStan**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/Analysis/LabReferenceRangeService.php tests/Unit/Services/Analysis/LabReferenceRangeServiceTest.php"
docker compose exec php sh -c "cd /var/www/html && vendor/bin/phpstan analyse app/Services/Analysis/LabReferenceRangeService.php --level=8"
```

Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Services/Analysis/LabReferenceRangeService.php backend/tests/Unit/Services/Analysis/LabReferenceRangeServiceTest.php
git commit -m "feat(profiles): add LabReferenceRangeService::lookup with curated+population resolution"
```

---

### Task 6: `LabReferenceRangeService::lookupMany()` + memoization assertion

**Files:**
- Modify: `backend/app/Services/Analysis/LabReferenceRangeService.php`
- Modify: `backend/tests/Unit/Services/Analysis/LabReferenceRangeServiceTest.php`

- [ ] **Step 1: Add the failing tests for lookupMany and memoization**

Append to `LabReferenceRangeServiceTest.php`:

```php
test('lookupMany resolves multiple groups in one call', function () {
    DB::connection('pgsql')->table('lab_reference_range_curated')->insert([
        [
            'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
            'sex' => 'M', 'age_low' => 18, 'age_high' => null,
            'range_low' => 13.5, 'range_high' => 17.5,
            'source_ref' => 'Mayo', 'created_at' => now(), 'updated_at' => now(),
        ],
        [
            'measurement_concept_id' => 3004501, 'unit_concept_id' => 8840,   // Glucose, mg/dL
            'sex' => 'A', 'age_low' => 18, 'age_high' => null,
            'range_low' => 70.0, 'range_high' => 99.0,
            'source_ref' => 'Mayo', 'created_at' => now(), 'updated_at' => now(),
        ],
    ]);

    $service = app(LabReferenceRangeService::class);
    $results = $service->lookupMany(SOURCE_ID, [
        ['concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT],
        ['concept_id' => 3004501, 'unit_concept_id' => 8840],
        ['concept_id' => 99999, 'unit_concept_id' => 8840],  // no match
    ], 'M', 40);

    expect($results)->toHaveCount(3);
    expect($results[HGB_CONCEPT.':'.GDL_UNIT])->toBeInstanceOf(LabRangeDto::class);
    expect($results['3004501:8840'])->toBeInstanceOf(LabRangeDto::class);
    expect($results['99999:8840'])->toBeNull();
});

test('memoization returns cached result on repeat calls', function () {
    DB::connection('pgsql')->table('lab_reference_range_curated')->insert([
        'measurement_concept_id' => HGB_CONCEPT, 'unit_concept_id' => GDL_UNIT,
        'sex' => 'M', 'age_low' => 18, 'age_high' => null,
        'range_low' => 13.5, 'range_high' => 17.5,
        'source_ref' => 'Mayo', 'created_at' => now(), 'updated_at' => now(),
    ]);

    $service = app(LabReferenceRangeService::class);

    DB::enableQueryLog();
    $first  = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'M', 40);
    $countAfterFirst = count(DB::getQueryLog());

    $second = $service->lookup(SOURCE_ID, HGB_CONCEPT, GDL_UNIT, 'M', 40);
    $countAfterSecond = count(DB::getQueryLog());

    DB::disableQueryLog();

    expect($first)->toEqual($second);
    expect($countAfterSecond)->toBe($countAfterFirst);  // no new queries
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Services/Analysis/LabReferenceRangeServiceTest.php --filter='lookupMany|memoization'"
```

Expected: `lookupMany` fails (method not defined), memoization passes (already implemented in Task 5).

- [ ] **Step 3: Add the `lookupMany` method to the service**

Insert this method in `LabReferenceRangeService.php`, after `lookup()`:

```php
    /**
     * Bulk variant — resolve ranges for a whole lab panel in one call.
     *
     * Delegates to `lookup()` per group to preserve memoization and the
     * full lookup-order precedence rules. DB roundtrips are bounded by
     * the number of distinct (concept, unit) tuples, not by calls.
     *
     * @param list<array{concept_id:int, unit_concept_id:int|null}> $groups
     * @return array<string, ?LabRangeDto> keyed by "{conceptId}:{unitConceptId}"
     */
    public function lookupMany(
        int $sourceId,
        array $groups,
        ?string $personSex,
        ?int $personAgeYears,
    ): array {
        $result = [];
        foreach ($groups as $group) {
            $conceptId = $group['concept_id'];
            $unitId = $group['unit_concept_id'];
            $key = sprintf('%d:%s', $conceptId, $unitId ?? 'null');

            $result[$key] = $this->lookup(
                $sourceId,
                $conceptId,
                $unitId,
                $personSex,
                $personAgeYears,
            );
        }

        return $result;
    }
```

Design note: I considered a single UNION query to cut the roundtrip count to 1, but the lookup-order precedence rules (narrowest-band, sex fall-through, population fallback) make that SQL gnarly. Per-call dispatch with the existing memoization keeps the code readable; for a typical profile (~20 distinct labs) that's 20 indexed single-row queries, well under 50ms total.

- [ ] **Step 4: Run tests to verify pass**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Services/Analysis/LabReferenceRangeServiceTest.php"
```

Expected: all tests pass (11 total in this file).

- [ ] **Step 5: Run Pint and PHPStan**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/Analysis/LabReferenceRangeService.php tests/Unit/Services/Analysis/LabReferenceRangeServiceTest.php"
docker compose exec php sh -c "cd /var/www/html && vendor/bin/phpstan analyse app/Services/Analysis/LabReferenceRangeService.php --level=8"
```

Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Services/Analysis/LabReferenceRangeService.php backend/tests/Unit/Services/Analysis/LabReferenceRangeServiceTest.php
git commit -m "feat(profiles): add LabReferenceRangeService::lookupMany bulk variant"
```

---

## Phase 3: Seeding & Compute Command

### Task 7: Curated YAML seed file (initial ~40 labs)

**Files:**
- Create: `backend/database/seeders/data/lab_reference_ranges.yaml`

This task populates an initial core of ~40 labs covering the CBC, BMP/CMP, lipid, HbA1c, TSH, coags, cardiac, and iron panels. Demonstrates every structural pattern: sex-stratified, age-stratified, and plain. Task 21 (optional) expands to full Tier 3 (~170 labs).

- [ ] **Step 1: Create the YAML file**

```yaml
# Lab reference ranges for Parthenon Patient Profiles.
#
# Source: see source_ref on each entry. Most values from the Mayo Clinical
# Laboratory Test Catalog (https://www.mayocliniclabs.com/test-catalog) and
# LOINC (https://loinc.org). Clinical disclaimer per spec §4 — research
# tool, not EMR, not FDA-cleared.
#
# Sex codes: M, F, A (any)
# Age bounds: inclusive integers in years; null = unbounded
# Units: UCUM codes resolved to OMOP unit_concept_id at seed time

# ============================================================
# Complete Blood Count (CBC)
# ============================================================

- loinc: "6690-2"                        # WBC
  unit_ucum: "10*3/uL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 4.5,  high: 11.0 }
    - { sex: A, age_low:  2, age_high:  17,  low: 5.0,  high: 14.5 }
  source_ref: "Mayo"

- loinc: "789-8"                         # RBC
  unit_ucum: "10*6/uL"
  ranges:
    - { sex: M, age_low: 18, age_high: null, low: 4.35, high: 5.65 }
    - { sex: F, age_low: 18, age_high: null, low: 3.92, high: 5.13 }
  source_ref: "Mayo"

- loinc: "718-7"                         # Hemoglobin
  unit_ucum: "g/dL"
  ranges:
    - { sex: M, age_low: 18, age_high: null, low: 13.5, high: 17.5 }
    - { sex: F, age_low: 18, age_high: null, low: 12.0, high: 15.5 }
    - { sex: A, age_low:  1, age_high:  17,  low: 11.0, high: 16.0 }
  source_ref: "Mayo"

- loinc: "4544-3"                        # Hematocrit
  unit_ucum: "%"
  ranges:
    - { sex: M, age_low: 18, age_high: null, low: 41.0, high: 53.0 }
    - { sex: F, age_low: 18, age_high: null, low: 36.0, high: 46.0 }
  source_ref: "Mayo"

- loinc: "787-2"                         # MCV
  unit_ucum: "fL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 80.0, high: 100.0 }
  source_ref: "Mayo"

- loinc: "785-6"                         # MCH
  unit_ucum: "pg"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 27.0, high: 33.0 }
  source_ref: "Mayo"

- loinc: "786-4"                         # MCHC
  unit_ucum: "g/dL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 32.0, high: 36.0 }
  source_ref: "Mayo"

- loinc: "788-0"                         # RDW
  unit_ucum: "%"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 11.5, high: 14.5 }
  source_ref: "Mayo"

- loinc: "777-3"                         # Platelets
  unit_ucum: "10*3/uL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 150.0, high: 450.0 }
  source_ref: "Mayo"

# ============================================================
# Basic / Comprehensive Metabolic Panel (BMP/CMP)
# ============================================================

- loinc: "2951-2"                        # Sodium
  unit_ucum: "mmol/L"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 135.0, high: 145.0 }
  source_ref: "Mayo"

- loinc: "2823-3"                        # Potassium
  unit_ucum: "mmol/L"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 3.5, high: 5.0 }
  source_ref: "Mayo"

- loinc: "2075-0"                        # Chloride
  unit_ucum: "mmol/L"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 98.0, high: 107.0 }
  source_ref: "Mayo"

- loinc: "2028-9"                        # CO2 / bicarbonate
  unit_ucum: "mmol/L"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 22.0, high: 29.0 }
  source_ref: "Mayo"

- loinc: "3094-0"                        # BUN
  unit_ucum: "mg/dL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 7.0, high: 20.0 }
  source_ref: "Mayo"

- loinc: "2160-0"                        # Creatinine
  unit_ucum: "mg/dL"
  ranges:
    - { sex: M, age_low: 18, age_high: null, low: 0.74, high: 1.35 }
    - { sex: F, age_low: 18, age_high: null, low: 0.59, high: 1.04 }
  source_ref: "Mayo"

- loinc: "2345-7"                        # Glucose
  unit_ucum: "mg/dL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 70.0, high: 99.0 }
  source_ref: "Mayo"
  notes: "Fasting reference. Postprandial values intentionally excluded."

- loinc: "17861-6"                       # Calcium total
  unit_ucum: "mg/dL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 8.6, high: 10.2 }
  source_ref: "Mayo"

- loinc: "1751-7"                        # Albumin
  unit_ucum: "g/dL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 3.5, high: 5.0 }
  source_ref: "Mayo"

- loinc: "2885-2"                        # Total protein
  unit_ucum: "g/dL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 6.3, high: 7.9 }
  source_ref: "Mayo"

- loinc: "1975-2"                        # Total bilirubin
  unit_ucum: "mg/dL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 0.1, high: 1.2 }
  source_ref: "Mayo"

- loinc: "1968-7"                        # Direct bilirubin
  unit_ucum: "mg/dL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 0.0, high: 0.3 }
  source_ref: "Mayo"

- loinc: "1920-8"                        # AST
  unit_ucum: "U/L"
  ranges:
    - { sex: M, age_low: 18, age_high: null, low: 10.0, high: 40.0 }
    - { sex: F, age_low: 18, age_high: null, low: 9.0,  high: 32.0 }
  source_ref: "Mayo"

- loinc: "1742-6"                        # ALT
  unit_ucum: "U/L"
  ranges:
    - { sex: M, age_low: 18, age_high: null, low: 7.0, high: 55.0 }
    - { sex: F, age_low: 18, age_high: null, low: 7.0, high: 45.0 }
  source_ref: "Mayo"

- loinc: "6768-6"                        # ALP
  unit_ucum: "U/L"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 44.0,  high: 147.0 }
    - { sex: A, age_low:  1, age_high:  17,  low: 54.0,  high: 369.0 }
  source_ref: "Mayo"
  notes: "Pediatric range intentionally wider; bone growth."

- loinc: "2324-2"                        # GGT
  unit_ucum: "U/L"
  ranges:
    - { sex: M, age_low: 18, age_high: null, low: 8.0, high: 61.0 }
    - { sex: F, age_low: 18, age_high: null, low: 5.0, high: 36.0 }
  source_ref: "Mayo"

# ============================================================
# Lipid Panel
# ============================================================

- loinc: "2093-3"                        # Total cholesterol
  unit_ucum: "mg/dL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 0.0, high: 200.0 }
  source_ref: "NCEP ATP III"
  notes: "Desirable <200; range low set to 0 since no clinical lower bound."

- loinc: "2085-9"                        # HDL
  unit_ucum: "mg/dL"
  ranges:
    - { sex: M, age_low: 18, age_high: null, low: 40.0, high: 999.0 }
    - { sex: F, age_low: 18, age_high: null, low: 50.0, high: 999.0 }
  source_ref: "NCEP ATP III"

- loinc: "13457-7"                       # LDL calculated
  unit_ucum: "mg/dL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 0.0, high: 100.0 }
  source_ref: "NCEP ATP III"
  notes: "Optimal <100. Pathological high only for primary prevention."

- loinc: "2571-8"                        # Triglycerides
  unit_ucum: "mg/dL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 0.0, high: 150.0 }
  source_ref: "NCEP ATP III"

# ============================================================
# Diabetes
# ============================================================

- loinc: "4548-4"                        # Hemoglobin A1c
  unit_ucum: "%"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 4.0, high: 5.6 }
  source_ref: "ADA"
  notes: "Non-diabetic range. 5.7-6.4 prediabetes, >=6.5 diabetes."

# ============================================================
# Thyroid
# ============================================================

- loinc: "3016-3"                        # TSH
  unit_ucum: "mIU/L"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 0.4, high: 4.5 }
  source_ref: "Mayo"

- loinc: "3024-7"                        # Free T4
  unit_ucum: "ng/dL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 0.8, high: 1.8 }
  source_ref: "Mayo"

# ============================================================
# Coagulation
# ============================================================

- loinc: "5902-2"                        # PT
  unit_ucum: "s"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 11.0, high: 13.5 }
  source_ref: "Mayo"

- loinc: "6301-6"                        # INR
  unit_ucum: "{ratio}"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 0.8, high: 1.2 }
  source_ref: "Mayo"
  notes: "Off anticoagulation. Therapeutic warfarin range is 2.0-3.0."

- loinc: "14979-9"                       # aPTT
  unit_ucum: "s"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 25.0, high: 35.0 }
  source_ref: "Mayo"

# ============================================================
# Cardiac Markers
# ============================================================

- loinc: "33762-6"                       # NT-proBNP
  unit_ucum: "pg/mL"
  ranges:
    - { sex: A, age_low: 18, age_high:  74, low: 0.0, high: 125.0 }
    - { sex: A, age_low: 75, age_high: null, low: 0.0, high: 450.0 }
  source_ref: "Roche"
  notes: "Age-adjusted; higher cutoff in elderly."

- loinc: "10839-9"                       # Troponin I
  unit_ucum: "ng/mL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 0.0, high: 0.04 }
  source_ref: "Mayo"

# ============================================================
# Iron Studies
# ============================================================

- loinc: "2498-4"                        # Iron (Fe)
  unit_ucum: "ug/dL"
  ranges:
    - { sex: M, age_low: 18, age_high: null, low: 65.0, high: 175.0 }
    - { sex: F, age_low: 18, age_high: null, low: 50.0, high: 170.0 }
  source_ref: "Mayo"

- loinc: "2276-4"                        # Ferritin
  unit_ucum: "ng/mL"
  ranges:
    - { sex: M, age_low: 18, age_high: null, low: 24.0, high: 336.0 }
    - { sex: F, age_low: 18, age_high: null, low: 11.0, high: 307.0 }
  source_ref: "Mayo"

- loinc: "2500-7"                        # TIBC
  unit_ucum: "ug/dL"
  ranges:
    - { sex: A, age_low: 18, age_high: null, low: 250.0, high: 450.0 }
  source_ref: "Mayo"
```

- [ ] **Step 2: Commit (data file only)**

```bash
git add backend/database/seeders/data/lab_reference_ranges.yaml
git commit -m "feat(profiles): add initial curated lab reference ranges YAML (~40 labs)"
```

---

### Task 8: `LabReferenceRangeSeeder` (TDD)

**Files:**
- Create: `backend/tests/Unit/Seeders/LabReferenceRangeSeederTest.php`
- Create: `backend/database/seeders/LabReferenceRangeSeeder.php`

- [ ] **Step 1: Write the failing seeder test**

```php
<?php

declare(strict_types=1);

use Database\Seeders\LabReferenceRangeSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Yaml\Yaml;

uses(RefreshDatabase::class);

function seedVocabConcepts(): void
{
    // Minimal fixture: insert just the LOINC + UCUM concepts we reference.
    DB::connection('pgsql')->table('vocab.concept')->insert([
        ['concept_id' => 3000963, 'concept_name' => 'Hgb',  'domain_id' => 'Measurement',
         'vocabulary_id' => 'LOINC', 'concept_class_id' => 'Lab Test', 'standard_concept' => 'S',
         'concept_code' => '718-7', 'valid_start_date' => '2000-01-01', 'valid_end_date' => '2099-12-31'],
        ['concept_id' => 8713,    'concept_name' => 'g/dL', 'domain_id' => 'Unit',
         'vocabulary_id' => 'UCUM','concept_class_id' => 'Unit',     'standard_concept' => 'S',
         'concept_code' => 'g/dL','valid_start_date' => '2000-01-01','valid_end_date' => '2099-12-31'],
    ]);
}

test('seeder loads YAML rows into curated table', function () {
    seedVocabConcepts();

    $yaml = [
        [
            'loinc' => '718-7',
            'unit_ucum' => 'g/dL',
            'ranges' => [
                ['sex' => 'M', 'age_low' => 18, 'age_high' => null, 'low' => 13.5, 'high' => 17.5],
                ['sex' => 'F', 'age_low' => 18, 'age_high' => null, 'low' => 12.0, 'high' => 15.5],
            ],
            'source_ref' => 'Mayo',
            'notes' => null,
        ],
    ];
    $path = tempnam(sys_get_temp_dir(), 'lrr').'.yaml';
    file_put_contents($path, Yaml::dump($yaml));

    $seeder = new LabReferenceRangeSeeder();
    $seeder->setDataPath($path);
    $seeder->run();

    $rows = DB::connection('pgsql')->table('lab_reference_range_curated')->get();

    expect($rows)->toHaveCount(2);
    expect($rows->firstWhere('sex', 'M')->range_low)->toEqual(13.5);
    expect($rows->firstWhere('sex', 'F')->range_low)->toEqual(12.0);

    unlink($path);
});

test('seeder is idempotent on re-run', function () {
    seedVocabConcepts();
    $yaml = [
        [
            'loinc' => '718-7', 'unit_ucum' => 'g/dL',
            'ranges' => [['sex' => 'M', 'age_low' => 18, 'age_high' => null, 'low' => 13.5, 'high' => 17.5]],
            'source_ref' => 'Mayo', 'notes' => null,
        ],
    ];
    $path = tempnam(sys_get_temp_dir(), 'lrr').'.yaml';
    file_put_contents($path, Yaml::dump($yaml));

    $seeder = new LabReferenceRangeSeeder();
    $seeder->setDataPath($path);
    $seeder->run();
    $seeder->run();   // Second run

    expect(DB::connection('pgsql')->table('lab_reference_range_curated')->count())->toBe(1);

    unlink($path);
});

test('seeder fails loudly on unresolvable LOINC', function () {
    seedVocabConcepts();
    $yaml = [
        [
            'loinc' => '99999-9',   // does not exist in fixture
            'unit_ucum' => 'g/dL',
            'ranges' => [['sex' => 'M', 'age_low' => 18, 'age_high' => null, 'low' => 13.5, 'high' => 17.5]],
            'source_ref' => 'Mayo', 'notes' => null,
        ],
    ];
    $path = tempnam(sys_get_temp_dir(), 'lrr').'.yaml';
    file_put_contents($path, Yaml::dump($yaml));

    $seeder = new LabReferenceRangeSeeder();
    $seeder->setDataPath($path);

    expect(fn () => $seeder->run())
        ->toThrow(RuntimeException::class, 'Unresolvable LOINC code: 99999-9');

    unlink($path);
});

test('seeder fails loudly on unresolvable UCUM unit', function () {
    seedVocabConcepts();
    $yaml = [
        [
            'loinc' => '718-7',
            'unit_ucum' => 'bogus/unit',
            'ranges' => [['sex' => 'M', 'age_low' => 18, 'age_high' => null, 'low' => 13.5, 'high' => 17.5]],
            'source_ref' => 'Mayo', 'notes' => null,
        ],
    ];
    $path = tempnam(sys_get_temp_dir(), 'lrr').'.yaml';
    file_put_contents($path, Yaml::dump($yaml));

    $seeder = new LabReferenceRangeSeeder();
    $seeder->setDataPath($path);

    expect(fn () => $seeder->run())
        ->toThrow(RuntimeException::class, 'Unresolvable UCUM unit: bogus/unit');

    unlink($path);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Seeders/LabReferenceRangeSeederTest.php"
```

Expected: FAIL with `Class "Database\Seeders\LabReferenceRangeSeeder" not found`.

- [ ] **Step 3: Implement the seeder**

```php
<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Symfony\Component\Yaml\Yaml;

final class LabReferenceRangeSeeder extends Seeder
{
    private string $dataPath;

    public function __construct()
    {
        $this->dataPath = database_path('seeders/data/lab_reference_ranges.yaml');
    }

    public function setDataPath(string $path): void
    {
        $this->dataPath = $path;
    }

    public function run(): void
    {
        if (! file_exists($this->dataPath)) {
            throw new RuntimeException("Lab reference ranges YAML not found at {$this->dataPath}");
        }

        /** @var list<array{loinc:string, unit_ucum:string, ranges:list<array<string,mixed>>, source_ref:string, notes:?string}> $entries */
        $entries = Yaml::parseFile($this->dataPath);

        $now = now();

        DB::connection('pgsql')->transaction(function () use ($entries, $now) {
            foreach ($entries as $entry) {
                $conceptId = $this->resolveLoinc($entry['loinc']);
                $unitId = $this->resolveUcum($entry['unit_ucum']);

                foreach ($entry['ranges'] as $r) {
                    $sex = (string) $r['sex'];
                    $ageLow = $r['age_low'] ?? null;
                    $ageHigh = $r['age_high'] ?? null;

                    DB::connection('pgsql')->table('lab_reference_range_curated')->upsert(
                        [[
                            'measurement_concept_id' => $conceptId,
                            'unit_concept_id' => $unitId,
                            'sex' => $sex,
                            'age_low' => $ageLow,
                            'age_high' => $ageHigh,
                            'range_low' => (float) $r['low'],
                            'range_high' => (float) $r['high'],
                            'source_ref' => $entry['source_ref'],
                            'notes' => $entry['notes'] ?? null,
                            'created_at' => $now,
                            'updated_at' => $now,
                        ]],
                        // Unique key columns (partial-index-aware via trigger not supported
                        // by Laravel upsert; fall back to DB::statement for true upsert).
                        ['measurement_concept_id', 'unit_concept_id', 'sex', 'age_low', 'age_high'],
                        ['range_low', 'range_high', 'source_ref', 'notes', 'updated_at']
                    );
                }
            }
        });
    }

    private function resolveLoinc(string $code): int
    {
        /** @var object|null $row */
        $row = DB::connection('pgsql')->table('vocab.concept')
            ->where('vocabulary_id', 'LOINC')
            ->where('concept_code', $code)
            ->where('standard_concept', 'S')
            ->first();

        if ($row === null) {
            throw new RuntimeException("Unresolvable LOINC code: {$code}");
        }

        return (int) $row->concept_id;
    }

    private function resolveUcum(string $code): int
    {
        /** @var object|null $row */
        $row = DB::connection('pgsql')->table('vocab.concept')
            ->where('vocabulary_id', 'UCUM')
            ->where('concept_code', $code)
            ->first();

        if ($row === null) {
            throw new RuntimeException("Unresolvable UCUM unit: {$code}");
        }

        return (int) $row->concept_id;
    }
}
```

**Note on the upsert + NULL bounds issue:** Laravel's `upsert()` uses Postgres `ON CONFLICT` which does NOT match rows where the unique index COALESCEs nulls (our `lrr_curated_uniq` index COALESCEs `age_low` → 0 and `age_high` → 65535). If upsert creates duplicates on re-run, the fix is to use a raw statement:

```php
DB::connection('pgsql')->statement(
    "INSERT INTO lab_reference_range_curated (measurement_concept_id, unit_concept_id, sex, age_low, age_high, range_low, range_high, source_ref, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT (measurement_concept_id, unit_concept_id, sex, (COALESCE(age_low, 0)), (COALESCE(age_high, 65535)))
     DO UPDATE SET range_low = EXCLUDED.range_low, range_high = EXCLUDED.range_high, source_ref = EXCLUDED.source_ref, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at",
    [$conceptId, $unitId, $sex, $ageLow, $ageHigh, (float)$r['low'], (float)$r['high'], $entry['source_ref'], $entry['notes'] ?? null, $now, $now]
);
```

Use whichever the idempotency test validates. If the Laravel `upsert` form fails the idempotency test, swap to the raw form.

- [ ] **Step 4: Run tests to verify they pass**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/pest tests/Unit/Seeders/LabReferenceRangeSeederTest.php"
```

Expected: all 4 tests pass. If idempotency test fails (duplicate rows on re-run), swap the Laravel `upsert` for the raw `ON CONFLICT` statement above and re-run.

- [ ] **Step 5: Run Pint and PHPStan**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint database/seeders/LabReferenceRangeSeeder.php tests/Unit/Seeders/LabReferenceRangeSeederTest.php"
docker compose exec php sh -c "cd /var/www/html && vendor/bin/phpstan analyse database/seeders/LabReferenceRangeSeeder.php --level=8"
```

Expected: both clean.

- [ ] **Step 6: Commit**

```bash
git add backend/database/seeders/LabReferenceRangeSeeder.php backend/tests/Unit/Seeders/LabReferenceRangeSeederTest.php
git commit -m "feat(profiles): add LabReferenceRangeSeeder with LOINC/UCUM resolution"
```

---

### Task 9: Wire seeder into `DatabaseSeeder` and run it against dev

**Files:**
- Modify: `backend/database/seeders/DatabaseSeeder.php`

- [ ] **Step 1: Read the current `DatabaseSeeder` to find the right place to wire the new seeder**

```bash
head -40 backend/database/seeders/DatabaseSeeder.php
```

Identify the `run()` method and locate where other data seeders (e.g., `RolePermissionSeeder`) are called.

- [ ] **Step 2: Add the call in the appropriate position**

Add inside the `run()` method, after any role/permission seeding and before any data-dependent seeders:

```php
$this->call(LabReferenceRangeSeeder::class);
```

The call should be wrapped in an `if (Schema::hasTable('lab_reference_range_curated'))` guard so it silently no-ops on environments where the migrations haven't been applied yet:

```php
if (Schema::connection('pgsql')->hasTable('lab_reference_range_curated')) {
    $this->call(LabReferenceRangeSeeder::class);
}
```

Add `use Illuminate\Support\Facades\Schema;` at the top of the file if not already present.

- [ ] **Step 3: Run the seeder against the dev DB**

```bash
docker compose exec php php artisan db:seed --class=LabReferenceRangeSeeder
```

Expected: command exits 0 with no errors. Ranges are loaded.

- [ ] **Step 4: Verify the rows were inserted**

```bash
PGPASSWORD= psql -h localhost -U claude_dev -d parthenon -c "
SELECT COUNT(*) AS total, COUNT(DISTINCT measurement_concept_id) AS distinct_labs
FROM app.lab_reference_range_curated;"
```

Expected: ~50 rows across ~35 distinct labs (Task 7 YAML).

- [ ] **Step 5: Verify one row resolved correctly (Hgb female adult)**

```bash
PGPASSWORD= psql -h localhost -U claude_dev -d parthenon -c "
SELECT c.concept_code, c.concept_name, u.concept_code AS unit, r.sex, r.age_low, r.age_high, r.range_low, r.range_high, r.source_ref
FROM app.lab_reference_range_curated r
JOIN vocab.concept c ON c.concept_id = r.measurement_concept_id
JOIN vocab.concept u ON u.concept_id = r.unit_concept_id
WHERE c.concept_code = '718-7' AND r.sex = 'F';"
```

Expected: one row with `range_low = 12.0`, `range_high = 15.5`, `source_ref = Mayo`.

- [ ] **Step 6: Commit**

```bash
git add backend/database/seeders/DatabaseSeeder.php
git commit -m "chore(profiles): wire LabReferenceRangeSeeder into DatabaseSeeder"
```

---

### Task 10: `ComputeReferenceRangesCommand` (TDD)

**Files:**
- Create: `backend/tests/Feature/Console/ComputeReferenceRangesCommandTest.php`
- Create: `backend/app/Console/Commands/ComputeReferenceRangesCommand.php`

- [ ] **Step 1: Write the failing command test**

```php
<?php

declare(strict_types=1);

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function () {
    DB::connection('pgsql')->table('sources')->insert([
        'id' => 42,
        'source_key' => 'testsource',
        'source_name' => 'Test Source',
        'source_schema' => 'testcdm',
        'is_enabled' => true,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    // Create a test schema + measurement table + fixture rows.
    DB::connection('pgsql')->statement('CREATE SCHEMA IF NOT EXISTS testcdm');
    DB::connection('pgsql')->statement('
        CREATE TABLE IF NOT EXISTS testcdm.measurement (
            measurement_id BIGSERIAL PRIMARY KEY,
            measurement_concept_id INTEGER,
            unit_concept_id INTEGER,
            value_as_number NUMERIC
        )
    ');
    DB::connection('pgsql')->statement('TRUNCATE testcdm.measurement');

    // Insert 1000 Hgb values spread between 10.0 and 18.0 g/dL
    $rows = [];
    for ($i = 0; $i < 1000; $i++) {
        $rows[] = [
            'measurement_concept_id' => 3000963,
            'unit_concept_id' => 8713,
            'value_as_number' => 10.0 + ($i / 1000.0) * 8.0,  // linear 10..18
        ];
    }
    foreach (array_chunk($rows, 500) as $chunk) {
        DB::connection('pgsql')->table('testcdm.measurement')->insert($chunk);
    }
});

afterEach(function () {
    DB::connection('pgsql')->statement('DROP SCHEMA IF EXISTS testcdm CASCADE');
});

test('command computes percentiles and writes to population table', function () {
    $this->artisan('labs:compute-reference-ranges', ['--source' => 'testsource', '--min-n' => 100])
        ->assertExitCode(0);

    $row = DB::connection('pgsql')->table('lab_reference_range_population')
        ->where('source_id', 42)
        ->where('measurement_concept_id', 3000963)
        ->where('unit_concept_id', 8713)
        ->first();

    expect($row)->not->toBeNull();
    expect((float) $row->range_low)->toBeBetween(10.0, 10.3);   // P2.5 of linear 10..18 ≈ 10.2
    expect((float) $row->range_high)->toBeBetween(17.7, 18.0);  // P97.5 ≈ 17.8
    expect((int) $row->n_observations)->toBe(1000);
});

test('command respects --min-n and skips under-populated concepts', function () {
    $this->artisan('labs:compute-reference-ranges', ['--source' => 'testsource', '--min-n' => 5000])
        ->assertExitCode(0);

    $count = DB::connection('pgsql')->table('lab_reference_range_population')->count();
    expect($count)->toBe(0);
});

test('command --dry-run does not write to population table', function () {
    $this->artisan('labs:compute-reference-ranges', ['--source' => 'testsource', '--dry-run' => true])
        ->assertExitCode(0);

    $count = DB::connection('pgsql')->table('lab_reference_range_population')->count();
    expect($count)->toBe(0);
});

test('command re-run overwrites previous computed_at', function () {
    $this->artisan('labs:compute-reference-ranges', ['--source' => 'testsource', '--min-n' => 100]);
    $firstComputedAt = DB::connection('pgsql')->table('lab_reference_range_population')
        ->value('computed_at');

    sleep(1);
    $this->artisan('labs:compute-reference-ranges', ['--source' => 'testsource', '--min-n' => 100]);
    $secondComputedAt = DB::connection('pgsql')->table('lab_reference_range_population')
        ->value('computed_at');

    expect($secondComputedAt)->toBeGreaterThan($firstComputedAt);
    expect(DB::connection('pgsql')->table('lab_reference_range_population')->count())->toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Console/ComputeReferenceRangesCommandTest.php"
```

Expected: FAIL with `Command "labs:compute-reference-ranges" is not defined`.

- [ ] **Step 3: Implement the command**

```php
<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

final class ComputeReferenceRangesCommand extends Command
{
    protected $signature = 'labs:compute-reference-ranges
        {--source= : Single source_key (omit for all enabled sources)}
        {--min-n=30 : Minimum observations per (concept, unit) to include}
        {--concepts= : Comma-separated measurement_concept_ids to restrict}
        {--dry-run : Report counts without writing}';

    protected $description = 'Compute per-source P2.5/P97.5 reference ranges from measurement values';

    public function handle(): int
    {
        $sourceKey = $this->option('source');
        $minN = (int) $this->option('min-n');
        $dryRun = (bool) $this->option('dry-run');
        $conceptsFilter = $this->option('concepts');

        $sourcesQuery = DB::connection('pgsql')->table('sources')->where('is_enabled', true);
        if ($sourceKey !== null) {
            $sourcesQuery->where('source_key', $sourceKey);
        }
        $sources = $sourcesQuery->get();

        if ($sources->isEmpty()) {
            $this->error("No enabled sources match --source={$sourceKey}");

            return self::FAILURE;
        }

        foreach ($sources as $source) {
            try {
                $this->computeForSource(
                    (int) $source->id,
                    (string) $source->source_key,
                    (string) $source->source_schema,
                    $minN,
                    $conceptsFilter,
                    $dryRun,
                );
            } catch (Throwable $e) {
                $this->error("Source {$source->source_key} failed: {$e->getMessage()}");
                // Continue — per-source isolation per spec §9
            }
        }

        return self::SUCCESS;
    }

    private function computeForSource(
        int $sourceId,
        string $sourceKey,
        string $sourceSchema,
        int $minN,
        ?string $conceptsFilter,
        bool $dryRun,
    ): void {
        $this->info("Computing ranges for source {$sourceKey} (schema={$sourceSchema})...");

        $conceptFilterSql = '';
        $bindings = [':min_n' => $minN];
        if ($conceptsFilter !== null) {
            $ids = array_filter(array_map('intval', explode(',', $conceptsFilter)));
            if ($ids === []) {
                throw new RuntimeException('--concepts must be a comma-separated list of integers');
            }
            $conceptFilterSql = 'AND measurement_concept_id = ANY(:concept_ids)';
            $bindings[':concept_ids'] = '{'.implode(',', $ids).'}';
        }

        $sql = <<<SQL
            SELECT
              measurement_concept_id,
              unit_concept_id,
              percentile_cont(0.025) WITHIN GROUP (ORDER BY value_as_number) AS p025,
              percentile_cont(0.500) WITHIN GROUP (ORDER BY value_as_number) AS p500,
              percentile_cont(0.975) WITHIN GROUP (ORDER BY value_as_number) AS p975,
              COUNT(*) AS n
            FROM {$sourceSchema}.measurement
            WHERE value_as_number IS NOT NULL
              AND unit_concept_id IS NOT NULL
              {$conceptFilterSql}
            GROUP BY measurement_concept_id, unit_concept_id
            HAVING COUNT(*) >= :min_n
        SQL;

        $rows = DB::connection('pgsql')->select($sql, $bindings);

        $this->info('  '.count($rows).' (concept, unit) pairs above min-n');

        if ($dryRun) {
            $this->warn('  --dry-run: not writing');
            return;
        }

        $now = now();
        foreach ($rows as $row) {
            DB::connection('pgsql')->table('lab_reference_range_population')->updateOrInsert(
                [
                    'source_id' => $sourceId,
                    'measurement_concept_id' => (int) $row->measurement_concept_id,
                    'unit_concept_id' => (int) $row->unit_concept_id,
                ],
                [
                    'range_low' => (float) $row->p025,
                    'range_high' => (float) $row->p975,
                    'median' => (float) $row->p500,
                    'n_observations' => (int) $row->n,
                    'computed_at' => $now,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );
        }

        $this->info("  wrote {$this->rowCountLabel(count($rows))} to lab_reference_range_population");
    }

    private function rowCountLabel(int $n): string
    {
        return $n === 1 ? '1 row' : "{$n} rows";
    }
}
```

- [ ] **Step 4: Register the command**

Laravel auto-discovers commands under `app/Console/Commands/`, so no manual registration needed. Verify with:

```bash
docker compose exec php php artisan list | grep labs:
```

Expected: `labs:compute-reference-ranges   Compute per-source P2.5/P97.5 reference ranges ...`

- [ ] **Step 5: Run tests to verify pass**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Console/ComputeReferenceRangesCommandTest.php"
```

Expected: all 4 tests pass.

- [ ] **Step 6: Run Pint and PHPStan**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Console/Commands/ComputeReferenceRangesCommand.php tests/Feature/Console/ComputeReferenceRangesCommandTest.php"
docker compose exec php sh -c "cd /var/www/html && vendor/bin/phpstan analyse app/Console/Commands/ComputeReferenceRangesCommand.php --level=8"
```

Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add backend/app/Console/Commands/ComputeReferenceRangesCommand.php backend/tests/Feature/Console/ComputeReferenceRangesCommandTest.php
git commit -m "feat(profiles): add labs:compute-reference-ranges artisan command"
```

---

## Phase 4: API Integration

### Task 11: Extend `PatientProfileService::getMeasurements()` — group, look up ranges, classify

**Files:**
- Modify: `backend/app/Services/Analysis/PatientProfileService.php`
- Modify: `backend/tests/Feature/Api/V1/PatientProfileControllerTest.php` (prepare new expectations; actual API assertions in Task 12)

- [ ] **Step 1: Read the current `getMeasurements()` method (lines ~754-794)**

```bash
sed -n '740,810p' backend/app/Services/Analysis/PatientProfileService.php
```

Identify:
- How the rows are currently fetched (SELECT shape, JOIN list)
- What fields are added per row
- How the flat result is returned
- Where in the parent method (`getProfile()`) the measurements are assembled into `clinicalEvents`

- [ ] **Step 2: Plan the minimal diff**

The new logic needs three things that the existing method doesn't provide:
1. The patient's sex (`gender_concept_id` → 'M' | 'F' | null)
2. The patient's age at measurement (or at profile-load time as a simplification)
3. A `source_id` (already available — the method takes a source context)

Pass these in as method parameters from `getProfile()`, which already has the person row loaded. Keep the existing behavior for callers that don't care about ranges by making the new parameters optional with null defaults.

- [ ] **Step 3: Modify the service method**

Replace the body of `getMeasurements()` with (keeping the existing SQL untouched, just adding post-processing):

```php
/**
 * Fetch measurements for a person, group by (concept_id, unit_concept_id),
 * look up reference ranges, classify status, and return both the flat
 * clinicalEvents list and the grouped labGroups payload.
 *
 * @return array{clinicalEvents: list<array<string,mixed>>, labGroups: list<array<string,mixed>>}
 */
public function getMeasurements(
    int $sourceId,
    int $personId,
    ?string $personSex = null,
    ?int $personAgeYears = null,
): array {
    $rows = $this->fetchMeasurementRows($sourceId, $personId);  // existing SQL moved here

    if ($rows === []) {
        return ['clinicalEvents' => [], 'labGroups' => []];
    }

    // Group by (concept_id, unit_concept_id)
    $groups = [];
    foreach ($rows as $row) {
        $key = $row->concept_id.':'.($row->unit_concept_id ?? 'null');
        if (! isset($groups[$key])) {
            $groups[$key] = [
                'conceptId' => (int) $row->concept_id,
                'conceptName' => $row->concept_name,
                'unitConceptId' => $row->unit_concept_id !== null ? (int) $row->unit_concept_id : null,
                'unitName' => $row->unit ?? '',
                'loincCode' => $row->loinc_code ?? null,
                'rows' => [],
            ];
        }
        $groups[$key]['rows'][] = $row;
    }

    // Bulk-lookup ranges
    $lookupGroups = array_map(
        fn ($g) => ['concept_id' => $g['conceptId'], 'unit_concept_id' => $g['unitConceptId']],
        array_values($groups),
    );
    $ranges = app(LabReferenceRangeService::class)->lookupMany(
        $sourceId,
        $lookupGroups,
        $personSex,
        $personAgeYears,
    );

    // Assemble clinicalEvents + labGroups from the same rows
    $clinicalEvents = [];
    $labGroups = [];
    foreach ($groups as $key => $g) {
        $range = $ranges[$key] ?? null;
        $rangeArray = $range?->toArray();

        $values = [];
        foreach ($g['rows'] as $row) {
            $status = LabStatusClassifier::classify((float) $row->value, $range)->value;

            $values[] = [
                'date' => $row->start_date,
                'value' => (float) $row->value,
                'status' => $status,
            ];

            $clinicalEvents[] = [
                'occurrence_id' => (int) $row->occurrence_id,
                'concept_id' => (int) $row->concept_id,
                'concept_name' => $row->concept_name,
                'domain' => 'measurement',
                'vocabulary' => $row->vocabulary ?? '',
                'start_date' => $row->start_date,
                'end_date' => $row->end_date,
                'type_name' => $row->type_name ?? '',
                'value' => (float) $row->value,
                'value_as_concept' => $row->value_as_concept ?? '',
                'unit' => $g['unitName'],
                'range_low' => $range?->low,
                'range_high' => $range?->high,
                'range' => $rangeArray,
                'status' => $status,
            ];
        }

        // Sort values descending by date so the latest is first
        usort($values, fn ($a, $b) => strcmp($b['date'], $a['date']));

        $latest = $values[0] ?? null;
        $trend = $this->computeTrend($values);

        $labGroups[] = [
            'conceptId' => $g['conceptId'],
            'conceptName' => $g['conceptName'],
            'loincCode' => $g['loincCode'],
            'unitConceptId' => $g['unitConceptId'],
            'unitName' => $g['unitName'],
            'n' => count($values),
            'latestValue' => $latest['value'] ?? null,
            'latestDate' => $latest['date'] ?? null,
            'trend' => $trend,
            'values' => array_reverse($values),  // chronological for charting
            'range' => $rangeArray,
        ];
    }

    return [
        'clinicalEvents' => $clinicalEvents,
        'labGroups' => $labGroups,
    ];
}

/**
 * Compute a simple trend indicator from a descending-ordered values list.
 *
 * @param list<array{date:string, value:float, status:string}> $valuesDesc
 */
private function computeTrend(array $valuesDesc): string
{
    if (count($valuesDesc) < 2) {
        return 'flat';
    }
    $latest = $valuesDesc[0]['value'];
    $prior = $valuesDesc[1]['value'];
    $delta = $latest - $prior;
    if (abs($delta) < 0.001) {
        return 'flat';
    }
    return $delta > 0 ? 'up' : 'down';
}
```

Extract the existing SQL into a new private method `fetchMeasurementRows(int $sourceId, int $personId): array`. This keeps the query in one place and makes the new method composable.

Add these `use` statements at the top of the file if not already present:

```php
use App\Services\Analysis\LabReferenceRangeService;
use App\Services\Analysis\LabStatusClassifier;
```

- [ ] **Step 4: Update `getProfile()` to pass sex + age into `getMeasurements()`**

Find where `getProfile()` calls `getMeasurements()` and update it to pass the person's sex and age. The person row already has `gender_concept_id` and `year_of_birth`. Add a small helper method near the top of the class:

```php
private function personSexFromGenderConceptId(?int $genderConceptId): ?string
{
    // OMOP gender concepts: 8507 = MALE, 8532 = FEMALE, 8551 = UNKNOWN
    return match ($genderConceptId) {
        8507 => 'M',
        8532 => 'F',
        default => null,
    };
}

private function personAgeYears(?int $yearOfBirth): ?int
{
    if ($yearOfBirth === null) {
        return null;
    }
    return (int) date('Y') - $yearOfBirth;
}
```

Pass them in:

```php
$measurements = $this->getMeasurements(
    $sourceId,
    $personId,
    personSex: $this->personSexFromGenderConceptId($person->gender_concept_id ?? null),
    personAgeYears: $this->personAgeYears($person->year_of_birth ?? null),
);
```

Then merge into the profile response:

```php
$profile['clinicalEvents'] = array_merge($profile['clinicalEvents'], $measurements['clinicalEvents']);
$profile['labGroups'] = $measurements['labGroups'];
```

- [ ] **Step 5: Run Pint and PHPStan on the changed file**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/Analysis/PatientProfileService.php"
docker compose exec php sh -c "cd /var/www/html && vendor/bin/phpstan analyse app/Services/Analysis/PatientProfileService.php --level=8"
```

Expected: both clean.

- [ ] **Step 6: Run the existing PatientProfileControllerTest to make sure nothing is broken**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Api/V1/PatientProfileControllerTest.php"
```

Expected: existing tests still pass. New assertions come in Task 12.

- [ ] **Step 7: Commit**

```bash
git add backend/app/Services/Analysis/PatientProfileService.php
git commit -m "feat(profiles): group measurements and attach reference ranges in PatientProfileService"
```

---

### Task 12: Controller response extension + Pest assertions

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/PatientProfileController.php`
- Modify: `backend/tests/Feature/Api/V1/PatientProfileControllerTest.php`

- [ ] **Step 1: Read the controller `show()` method**

```bash
sed -n '100,150p' backend/app/Http/Controllers/Api/V1/PatientProfileController.php
```

Identify how `PatientProfileService::getProfile()` output is wrapped into the JSON response.

- [ ] **Step 2: Ensure the controller surfaces the new `labGroups` field**

The service now returns `labGroups` in its output. The controller likely already passes through whatever the service returns. If the controller reshapes the output explicitly (e.g., via a Resource class or `response()->json([...specific keys...])`), add `'labGroups' => $profile['labGroups']` to that shape.

If there's a Laravel Resource for the profile (e.g., `PatientProfileResource`), add `labGroups` to its `toArray()` method with the same shape as the spec §6.

- [ ] **Step 3: Write the failing feature test**

Append to `backend/tests/Feature/Api/V1/PatientProfileControllerTest.php`:

```php
test('patient profile returns labGroups with curated range', function () {
    // Arrange: create a source, a person, and one measurement row; seed a
    // matching curated range.
    [$source, $person, $sourceSchema] = $this->createTestSourceAndPerson([
        'gender_concept_id' => 8532,   // F
        'year_of_birth' => 1990,
    ]);

    DB::connection('pgsql')->table('lab_reference_range_curated')->insert([
        'measurement_concept_id' => 3000963, 'unit_concept_id' => 8713,
        'sex' => 'F', 'age_low' => 18, 'age_high' => null,
        'range_low' => 12.0, 'range_high' => 15.5,
        'source_ref' => 'Mayo',
        'created_at' => now(), 'updated_at' => now(),
    ]);

    DB::connection('pgsql')->table("{$sourceSchema}.measurement")->insert([
        'measurement_id' => 1,
        'person_id' => $person->person_id,
        'measurement_concept_id' => 3000963,
        'measurement_date' => '2025-11-04',
        'value_as_number' => 11.8,
        'unit_concept_id' => 8713,
    ]);

    // Act
    $response = $this->actingAs($this->adminUser())
        ->getJson("/api/v1/sources/{$source->id}/profiles/{$person->person_id}");

    // Assert
    $response->assertOk();
    $response->assertJsonPath('labGroups.0.conceptId', 3000963);
    $response->assertJsonPath('labGroups.0.range.source', 'curated');
    $response->assertJsonPath('labGroups.0.range.low', 12.0);
    $response->assertJsonPath('labGroups.0.range.high', 15.5);
    $response->assertJsonPath('labGroups.0.range.sourceRef', 'Mayo');
    $response->assertJsonPath('labGroups.0.values.0.status', 'low');
});

test('patient profile falls back to population range when no curated match', function () {
    [$source, $person, $sourceSchema] = $this->createTestSourceAndPerson([
        'gender_concept_id' => 8507,    // M
        'year_of_birth' => 1970,
    ]);

    DB::connection('pgsql')->table('lab_reference_range_population')->insert([
        'source_id' => $source->id,
        'measurement_concept_id' => 3000963, 'unit_concept_id' => 8713,
        'range_low' => 11.0, 'range_high' => 18.0,
        'median' => 14.0, 'n_observations' => 12430,
        'computed_at' => now(), 'created_at' => now(), 'updated_at' => now(),
    ]);

    DB::connection('pgsql')->table("{$sourceSchema}.measurement")->insert([
        'measurement_id' => 1,
        'person_id' => $person->person_id,
        'measurement_concept_id' => 3000963,
        'measurement_date' => '2025-11-04',
        'value_as_number' => 14.2,
        'unit_concept_id' => 8713,
    ]);

    $response = $this->actingAs($this->adminUser())
        ->getJson("/api/v1/sources/{$source->id}/profiles/{$person->person_id}");

    $response->assertOk();
    $response->assertJsonPath('labGroups.0.range.source', 'population');
    $response->assertJsonPath('labGroups.0.range.nObservations', 12430);
    $response->assertJsonPath('labGroups.0.values.0.status', 'normal');
});

test('patient profile labGroups is empty list when no measurements exist', function () {
    [$source, $person] = $this->createTestSourceAndPerson([
        'gender_concept_id' => 8532,
        'year_of_birth' => 1990,
    ]);

    $response = $this->actingAs($this->adminUser())
        ->getJson("/api/v1/sources/{$source->id}/profiles/{$person->person_id}");

    $response->assertOk();
    $response->assertJsonPath('labGroups', []);
});
```

The test uses a `createTestSourceAndPerson()` helper. If the existing test file already has a similar helper, use it; otherwise add it to the top of the test file or a trait:

```php
/**
 * Create a test source, person, and minimal CDM schema.
 *
 * @return array{0: object, 1: object, 2: string}
 */
protected function createTestSourceAndPerson(array $personAttrs = []): array
{
    $schema = 'test_profile_' . Str::random(8);
    DB::connection('pgsql')->statement("CREATE SCHEMA IF NOT EXISTS {$schema}");
    DB::connection('pgsql')->statement("
        CREATE TABLE {$schema}.person (
            person_id BIGINT PRIMARY KEY,
            gender_concept_id INTEGER,
            year_of_birth INTEGER,
            race_concept_id INTEGER,
            ethnicity_concept_id INTEGER
        )
    ");
    DB::connection('pgsql')->statement("
        CREATE TABLE {$schema}.measurement (
            measurement_id BIGINT PRIMARY KEY,
            person_id BIGINT,
            measurement_concept_id INTEGER,
            measurement_date DATE,
            value_as_number NUMERIC,
            unit_concept_id INTEGER
        )
    ");

    $sourceId = DB::connection('pgsql')->table('sources')->insertGetId([
        'source_key' => 'test_'.Str::random(6),
        'source_name' => 'Test',
        'source_schema' => $schema,
        'is_enabled' => true,
        'created_at' => now(), 'updated_at' => now(),
    ]);
    $source = DB::connection('pgsql')->table('sources')->find($sourceId);

    DB::connection('pgsql')->table("{$schema}.person")->insert(array_merge([
        'person_id' => 1,
        'gender_concept_id' => 8507,
        'year_of_birth' => 1980,
    ], $personAttrs));
    $person = (object) ['person_id' => 1, ...$personAttrs];

    $this->beforeApplicationDestroyed(function () use ($schema) {
        DB::connection('pgsql')->statement("DROP SCHEMA IF EXISTS {$schema} CASCADE");
    });

    return [$source, $person, $schema];
}
```

**Note:** This test helper creates a *minimal* CDM schema — just enough columns to satisfy `PatientProfileService::fetchMeasurementRows()`. If the actual fetch SQL references more columns (e.g., joins to `observation_period`, `visit_occurrence`, `concept`), extend the fixture schema accordingly. Run the service once against the fixture to see what it complains about, then add the missing tables.

- [ ] **Step 4: Run tests to verify they fail**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Api/V1/PatientProfileControllerTest.php --filter='labGroups|fall back|empty list'"
```

Expected: tests fail because `labGroups` isn't in the response yet (or the helper needs wiring).

- [ ] **Step 5: Fix any missing plumbing in the controller/service/resource to make tests pass**

Likely fixes:
- Add `labGroups` to the output array in the controller/resource
- Verify `personSexFromGenderConceptId` + `personAgeYears` flow from `getProfile()` into `getMeasurements()`
- Expand the test schema fixture if fetchMeasurementRows requires more tables

- [ ] **Step 6: Run tests to verify they pass**

```bash
docker compose exec php sh -c "cd /var/www/html && vendor/bin/pest tests/Feature/Api/V1/PatientProfileControllerTest.php"
```

Expected: all controller tests pass, including the 3 new ones.

- [ ] **Step 7: Run Pint and PHPStan**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Http/Controllers/Api/V1/PatientProfileController.php tests/Feature/Api/V1/PatientProfileControllerTest.php"
docker compose exec php sh -c "cd /var/www/html && vendor/bin/phpstan analyse app/Http/Controllers/Api/V1/PatientProfileController.php --level=8"
```

Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/PatientProfileController.php backend/tests/Feature/Api/V1/PatientProfileControllerTest.php
git commit -m "feat(profiles): expose labGroups in patient profile API response"
```

---

### Task 13: Update `openapi.yaml` + regenerate frontend types

**Files:**
- Modify: `backend/openapi.yaml`
- Regenerate: `frontend/src/types/api.generated.ts`

- [ ] **Step 1: Locate the PatientProfile schema in `openapi.yaml`**

```bash
grep -n "PatientProfile:" backend/openapi.yaml
```

- [ ] **Step 2: Add `labGroups` to the PatientProfile schema**

In the `components/schemas/PatientProfile` definition, add under `properties`:

```yaml
        labGroups:
          type: array
          items:
            $ref: '#/components/schemas/LabGroup'
          description: Measurements grouped by (concept_id, unit_concept_id) with reference ranges
```

- [ ] **Step 3: Add the new supporting schemas**

Add to `components/schemas` in `openapi.yaml`:

```yaml
    LabStatus:
      type: string
      enum: [low, normal, high, critical, unknown]

    LabRange:
      type: object
      required: [low, high, source, sourceLabel]
      properties:
        low:
          type: number
          format: double
        high:
          type: number
          format: double
        source:
          type: string
          enum: [curated, population]
        sourceLabel:
          type: string
          description: Human-readable label, e.g. 'LOINC (F, 18+)' or 'SynPUF pop. P2.5–P97.5'
        sourceRef:
          type: string
          nullable: true
        nObservations:
          type: integer
          nullable: true

    LabValue:
      type: object
      required: [date, value, status]
      properties:
        date:
          type: string
          format: date
        value:
          type: number
          format: double
        status:
          $ref: '#/components/schemas/LabStatus'

    LabGroup:
      type: object
      required: [conceptId, conceptName, unitConceptId, unitName, n, values]
      properties:
        conceptId:
          type: integer
        conceptName:
          type: string
        loincCode:
          type: string
          nullable: true
        unitConceptId:
          type: integer
          nullable: true
        unitName:
          type: string
        n:
          type: integer
        latestValue:
          type: number
          format: double
          nullable: true
        latestDate:
          type: string
          format: date
          nullable: true
        trend:
          type: string
          enum: [up, down, flat]
        values:
          type: array
          items:
            $ref: '#/components/schemas/LabValue'
        range:
          $ref: '#/components/schemas/LabRange'
          nullable: true
```

- [ ] **Step 4: Validate the OpenAPI file**

```bash
docker compose exec node sh -c "cd /app && npx @redocly/cli lint ../backend/openapi.yaml"
```

Or whatever OpenAPI linter the repo uses (check `package.json` for a script called `openapi:lint` or similar). If no linter is configured, skip.

Expected: no errors.

- [ ] **Step 5: Regenerate frontend types**

```bash
./deploy.sh --openapi
```

Expected: `frontend/src/types/api.generated.ts` is updated with new `LabGroup`, `LabValue`, `LabRange`, `LabStatus` types. Check:

```bash
grep -n "LabGroup\|LabRange\|LabStatus\|LabValue" frontend/src/types/api.generated.ts | head
```

Expected: type definitions appear in the generated file.

- [ ] **Step 6: Verify TypeScript still compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

Expected: clean. If there are errors in `PatientLabPanel.tsx` because the generated types now carry fields the component was previously typed more loosely, that's OK — those fix up in Task 18.

- [ ] **Step 7: Commit**

```bash
git add backend/openapi.yaml frontend/src/types/api.generated.ts
git commit -m "feat(profiles): extend OpenAPI with LabGroup/LabRange/LabStatus/LabValue"
```

---

## Phase 5: Frontend Components

### Task 14: `LabStatusDot` component (TDD)

**Files:**
- Create: `frontend/src/features/profiles/components/__tests__/LabStatusDot.test.tsx`
- Create: `frontend/src/features/profiles/components/LabStatusDot.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LabStatusDot } from '../LabStatusDot';

const baseProps = { cx: 10, cy: 10, payload: { value: 1 } };

describe('LabStatusDot', () => {
  it('renders a blue dot for low status', () => {
    const { container } = render(
      <svg><LabStatusDot {...baseProps} payload={{ ...baseProps.payload, status: 'low' }} /></svg>
    );
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill')).toBe('#3B82F6');
    expect(circle?.getAttribute('r')).toBe('4');
  });

  it('renders a zinc dot for normal status', () => {
    const { container } = render(
      <svg><LabStatusDot {...baseProps} payload={{ ...baseProps.payload, status: 'normal' }} /></svg>
    );
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill')).toBe('#A1A1AA');
    expect(circle?.getAttribute('r')).toBe('3');
  });

  it('renders a crimson dot for high status', () => {
    const { container } = render(
      <svg><LabStatusDot {...baseProps} payload={{ ...baseProps.payload, status: 'high' }} /></svg>
    );
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill')).toBe('#9B1B30');
    expect(circle?.getAttribute('r')).toBe('4');
  });

  it('renders a crimson+gold-ring dot for critical status', () => {
    const { container } = render(
      <svg><LabStatusDot {...baseProps} payload={{ ...baseProps.payload, status: 'critical' }} /></svg>
    );
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill')).toBe('#9B1B30');
    expect(circle?.getAttribute('stroke')).toBe('#C9A227');
    expect(circle?.getAttribute('r')).toBe('5');
  });

  it('renders a hollow dot for unknown status', () => {
    const { container } = render(
      <svg><LabStatusDot {...baseProps} payload={{ ...baseProps.payload, status: 'unknown' }} /></svg>
    );
    const circle = container.querySelector('circle');
    expect(circle?.getAttribute('fill')).toBe('transparent');
    expect(circle?.getAttribute('stroke')).toBe('#71717a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/profiles/components/__tests__/LabStatusDot.test.tsx"
```

Expected: FAIL with `Cannot find module '../LabStatusDot'`.

- [ ] **Step 3: Implement the component**

```tsx
import type { LabStatus } from '@/types/api.generated';

// Accepts the shape Recharts passes to a dot renderer: cx, cy, and a payload
// object containing the underlying data point. We only need `status` off payload.
type LabStatusDotProps = {
  cx?: number;
  cy?: number;
  payload?: {
    status?: LabStatus;
    value?: number;
    [key: string]: unknown;
  };
  index?: number;
};

const STATUS_STYLES: Record<LabStatus, { fill: string; stroke: string; r: number; strokeWidth: number }> = {
  low:      { fill: '#3B82F6', stroke: '#3B82F6', r: 4, strokeWidth: 1 },
  normal:   { fill: '#A1A1AA', stroke: '#A1A1AA', r: 3, strokeWidth: 1 },
  high:     { fill: '#9B1B30', stroke: '#9B1B30', r: 4, strokeWidth: 1 },
  critical: { fill: '#9B1B30', stroke: '#C9A227', r: 5, strokeWidth: 3 },
  unknown:  { fill: 'transparent', stroke: '#71717a', r: 3, strokeWidth: 1 },
};

export const LabStatusDot = ({ cx, cy, payload }: LabStatusDotProps): JSX.Element | null => {
  if (cx === undefined || cy === undefined) return null;

  const status: LabStatus = payload?.status ?? 'unknown';
  const style = STATUS_STYLES[status];

  return (
    <circle
      cx={cx}
      cy={cy}
      r={style.r}
      fill={style.fill}
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
    />
  );
};
```

- [ ] **Step 4: Run test to verify pass**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/profiles/components/__tests__/LabStatusDot.test.tsx"
```

Expected: all 5 tests pass.

- [ ] **Step 5: Verify TypeScript + ESLint clean**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx eslint src/features/profiles/components/LabStatusDot.tsx src/features/profiles/components/__tests__/LabStatusDot.test.tsx"
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/profiles/components/LabStatusDot.tsx frontend/src/features/profiles/components/__tests__/LabStatusDot.test.tsx
git commit -m "feat(profiles): add LabStatusDot component with status-based styling"
```

---

### Task 15: `LabTrendTooltip` component

**Files:**
- Create: `frontend/src/features/profiles/components/LabTrendTooltip.tsx`

No TDD for this one — it's a pure render that reads props and outputs a tooltip card. A snapshot-style test in Vitest for a three-line render adds noise without catching real bugs. Coverage is provided by the `LabTrendChart` integration test in Task 17.

- [ ] **Step 1: Create the component**

```tsx
import { format } from 'date-fns';
import type { LabRange, LabStatus } from '@/types/api.generated';

type LabTrendTooltipPayload = {
  payload: {
    ts: number;
    value: number;
    status: LabStatus;
  };
};

type LabTrendTooltipProps = {
  active?: boolean;
  payload?: LabTrendTooltipPayload[];
  range?: LabRange | null;
  unitName: string;
};

const STATUS_LABELS: Record<LabStatus, { label: string; arrow: string; color: string }> = {
  low:      { label: 'Low',      arrow: '↓', color: 'text-blue-400' },
  normal:   { label: 'Normal',   arrow: '',  color: 'text-zinc-400' },
  high:     { label: 'High',     arrow: '↑', color: 'text-red-400' },
  critical: { label: 'Critical', arrow: '‼', color: 'text-amber-400' },
  unknown:  { label: 'Unknown',  arrow: '',  color: 'text-zinc-500' },
};

export const LabTrendTooltip = ({ active, payload, range, unitName }: LabTrendTooltipProps): JSX.Element | null => {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0].payload;
  const statusStyle = STATUS_LABELS[point.status];
  const bound =
    point.status === 'low' && range ? ` (below ${range.low})` :
    point.status === 'high' && range ? ` (above ${range.high})` :
    '';

  return (
    <div className="rounded-md border border-amber-600/40 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-100 shadow-lg">
      <div className="text-zinc-400">{format(new Date(point.ts), 'MMM d, yyyy')}</div>
      <div className="font-medium">
        {point.value} {unitName}
      </div>
      {point.status !== 'unknown' && (
        <div className={statusStyle.color}>
          {statusStyle.arrow} {statusStyle.label}{bound}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript + ESLint clean**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx eslint src/features/profiles/components/LabTrendTooltip.tsx"
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/profiles/components/LabTrendTooltip.tsx
git commit -m "feat(profiles): add LabTrendTooltip component"
```

---

### Task 16: `LabValuesTable` component (extracted) (TDD)

**Files:**
- Create: `frontend/src/features/profiles/components/__tests__/LabValuesTable.test.tsx`
- Create: `frontend/src/features/profiles/components/LabValuesTable.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LabValuesTable } from '../LabValuesTable';

describe('LabValuesTable', () => {
  const baseValues = [
    { date: '2025-11-04', value: 11.8, status: 'low' as const },
    { date: '2025-08-02', value: 12.4, status: 'normal' as const },
    { date: '2025-05-10', value: 13.1, status: 'normal' as const },
  ];

  it('renders headers', () => {
    render(<LabValuesTable values={baseValues} unitName="g/dL" range={null} />);
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
    expect(screen.getByText('Range')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders one row per value', () => {
    render(<LabValuesTable values={baseValues} unitName="g/dL" range={null} />);
    expect(screen.getAllByRole('row')).toHaveLength(4);  // header + 3 values
  });

  it('renders status text per row', () => {
    render(<LabValuesTable values={baseValues} unitName="g/dL" range={null} />);
    expect(screen.getAllByText('Normal')).toHaveLength(2);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('renders the range column when range is present', () => {
    render(
      <LabValuesTable
        values={baseValues}
        unitName="g/dL"
        range={{ low: 12.0, high: 15.5, source: 'curated', sourceLabel: 'LOINC (F, 18+)' }}
      />
    );
    expect(screen.getAllByText('12 – 15.5 g/dL')).toHaveLength(3);
  });

  it('renders em-dash in range column when range is null', () => {
    render(<LabValuesTable values={baseValues} unitName="g/dL" range={null} />);
    expect(screen.getAllByText('—')).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/profiles/components/__tests__/LabValuesTable.test.tsx"
```

Expected: FAIL with `Cannot find module '../LabValuesTable'`.

- [ ] **Step 3: Implement the component**

```tsx
import type { LabRange, LabValue, LabStatus } from '@/types/api.generated';

type LabValuesTableProps = {
  values: LabValue[];
  unitName: string;
  range: LabRange | null;
};

const STATUS_LABEL: Record<LabStatus, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
  unknown: '—',
};

const STATUS_CLASS: Record<LabStatus, string> = {
  low: 'text-blue-400',
  normal: 'text-zinc-400',
  high: 'text-red-400',
  critical: 'text-amber-400 font-semibold',
  unknown: 'text-zinc-500',
};

export const LabValuesTable = ({ values, unitName, range }: LabValuesTableProps): JSX.Element => {
  const rangeText = range ? `${range.low} – ${range.high} ${unitName}` : '—';

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-zinc-800 text-zinc-500">
          <th className="text-left py-1 pr-2">Date</th>
          <th className="text-right py-1 pr-2">Value</th>
          <th className="text-right py-1 pr-2">Range</th>
          <th className="text-right py-1">Status</th>
        </tr>
      </thead>
      <tbody>
        {values.map((v, i) => (
          <tr key={`${v.date}-${i}`} className="border-b border-zinc-900">
            <td className="py-1 pr-2 text-zinc-400">{v.date}</td>
            <td className="py-1 pr-2 text-right text-zinc-100">{v.value} {unitName}</td>
            <td className="py-1 pr-2 text-right text-zinc-500">{rangeText}</td>
            <td className={`py-1 text-right ${STATUS_CLASS[v.status]}`}>{STATUS_LABEL[v.status]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

- [ ] **Step 4: Run test to verify pass**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/profiles/components/__tests__/LabValuesTable.test.tsx"
```

Expected: all 5 tests pass.

- [ ] **Step 5: TypeScript + ESLint clean**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx eslint src/features/profiles/components/LabValuesTable.tsx src/features/profiles/components/__tests__/LabValuesTable.test.tsx"
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/profiles/components/LabValuesTable.tsx frontend/src/features/profiles/components/__tests__/LabValuesTable.test.tsx
git commit -m "feat(profiles): add extracted LabValuesTable component"
```

---

### Task 17: `LabTrendChart` Recharts component (TDD)

**Files:**
- Create: `frontend/src/features/profiles/components/__tests__/LabTrendChart.test.tsx`
- Create: `frontend/src/features/profiles/components/LabTrendChart.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it, beforeAll } from 'vitest';
import { LabTrendChart } from '../LabTrendChart';

// Recharts ResponsiveContainer needs non-zero dimensions in jsdom.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 200 });
});

const sampleValues = [
  { date: '2025-05-10', value: 13.1, status: 'normal' as const },
  { date: '2025-08-02', value: 12.4, status: 'normal' as const },
  { date: '2025-11-04', value: 11.8, status: 'low' as const },
];

describe('LabTrendChart', () => {
  it('renders one dot per value', () => {
    const { container } = render(
      <LabTrendChart
        conceptName="Hemoglobin"
        unitName="g/dL"
        values={sampleValues}
        range={{ low: 12.0, high: 15.5, source: 'curated', sourceLabel: 'LOINC (F, 18+)' }}
      />
    );
    expect(container.querySelectorAll('.recharts-line-dot').length).toBe(3);
  });

  it('renders reference area when range is provided', () => {
    const { container } = render(
      <LabTrendChart
        conceptName="Hemoglobin"
        unitName="g/dL"
        values={sampleValues}
        range={{ low: 12.0, high: 15.5, source: 'curated', sourceLabel: 'LOINC (F, 18+)' }}
      />
    );
    expect(container.querySelector('.recharts-reference-area')).not.toBeNull();
  });

  it('does not render reference area when range is null', () => {
    const { container } = render(
      <LabTrendChart
        conceptName="Hemoglobin"
        unitName="g/dL"
        values={sampleValues}
        range={null}
      />
    );
    expect(container.querySelector('.recharts-reference-area')).toBeNull();
  });

  it('renders the source label footnote when range is present', () => {
    const { container } = render(
      <LabTrendChart
        conceptName="Hemoglobin"
        unitName="g/dL"
        values={sampleValues}
        range={{ low: 12.0, high: 15.5, source: 'curated', sourceLabel: 'LOINC (F, 18+)' }}
      />
    );
    expect(container.textContent).toContain('LOINC (F, 18+)');
    expect(container.textContent).toContain('12 – 15.5');
  });

  it('does not render footnote when range is null', () => {
    const { container } = render(
      <LabTrendChart
        conceptName="Hemoglobin"
        unitName="g/dL"
        values={sampleValues}
        range={null}
      />
    );
    expect(container.textContent).not.toContain('Reference:');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/profiles/components/__tests__/LabTrendChart.test.tsx"
```

Expected: FAIL with `Cannot find module '../LabTrendChart'`.

- [ ] **Step 3: Implement the component**

```tsx
import { useMemo } from 'react';
import { format } from 'date-fns';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LabGroup } from '@/types/api.generated';
import { LabStatusDot } from './LabStatusDot';
import { LabTrendTooltip } from './LabTrendTooltip';

type LabTrendChartProps = Pick<LabGroup, 'values' | 'range' | 'unitName'> & {
  conceptName: string;
  height?: number;
};

export const LabTrendChart = ({
  values,
  range,
  unitName,
  conceptName: _conceptName,
  height = 180,
}: LabTrendChartProps): JSX.Element => {
  const data = useMemo(
    () =>
      values.map((v) => ({
        ts: new Date(v.date).getTime(),
        value: v.value,
        status: v.status,
      })),
    [values],
  );

  const domain = useMemo(() => {
    const vs = data.map((d) => d.value);
    const lo = Math.min(...vs, range?.low ?? Infinity);
    const hi = Math.max(...vs, range?.high ?? -Infinity);
    const span = hi - lo;
    const pad = span > 0 ? span * 0.1 : Math.abs(hi) * 0.05 || 1;
    return [lo - pad, hi + pad] as const;
  }, [data, range]);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="ts"
            type="number"
            domain={['dataMin', 'dataMax']}
            scale="time"
            tickFormatter={(ts: number) => format(new Date(ts), 'MMM yyyy')}
            stroke="#71717a"
            fontSize={11}
          />
          <YAxis
            domain={[domain[0], domain[1]]}
            stroke="#71717a"
            fontSize={11}
          />
          {range && (
            <ReferenceArea
              y1={range.low}
              y2={range.high}
              fill="#2DD4BF"
              fillOpacity={0.12}
              stroke="#2DD4BF"
              strokeOpacity={0.35}
              strokeDasharray="2 2"
              ifOverflow="extendDomain"
            />
          )}
          <Tooltip
            content={<LabTrendTooltip range={range} unitName={unitName} />}
            cursor={{ stroke: '#C9A227', strokeWidth: 1, strokeDasharray: '2 2' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#E4E4E7"
            strokeWidth={2}
            dot={(dotProps) => <LabStatusDot {...dotProps} key={`dot-${dotProps.index}`} />}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {range && (
        <div className="mt-1 flex items-center justify-between px-2 text-[11px] text-zinc-500">
          <span>
            Reference:{' '}
            <span className="text-zinc-400">
              {range.low} – {range.high} {unitName}
            </span>
          </span>
          <span className="italic">{range.sourceLabel}</span>
        </div>
      )}
    </div>
  );
};
```

**Note on the dot prop:** Using the function form `dot={(props) => <LabStatusDot {...props} />}` rather than a cloneElement form (`dot={<LabStatusDot payload={...} />}`) — the function form sidesteps the TypeScript complaint about providing a placeholder payload and cleanly forwards `cx`/`cy`/`payload` per point. The `key` on `LabStatusDot` avoids React's duplicate-key warning when Recharts re-renders the line.

- [ ] **Step 4: Run test to verify pass**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/profiles/components/__tests__/LabTrendChart.test.tsx"
```

Expected: all 5 tests pass. If Recharts ResponsiveContainer width=0 breaks the test (no `.recharts-line-dot` found), check that the `clientWidth`/`clientHeight` shim in `beforeAll` is being honored; sometimes Vitest needs `jsdom-global` or a config flag. Alternative: pass `width={800}` explicitly to `ResponsiveContainer` in a wrapped test-only variant, but prefer fixing the shim.

- [ ] **Step 5: TypeScript + ESLint clean**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx eslint src/features/profiles/components/LabTrendChart.tsx src/features/profiles/components/__tests__/LabTrendChart.test.tsx"
```

Expected: clean.

- [ ] **Step 6: Vite build (stricter than tsc)**

```bash
docker compose exec node sh -c "cd /app && npx vite build"
```

Expected: build succeeds. This catches stricter errors than `tsc --noEmit` per CLAUDE.md gotcha #5.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/profiles/components/LabTrendChart.tsx frontend/src/features/profiles/components/__tests__/LabTrendChart.test.tsx
git commit -m "feat(profiles): add LabTrendChart with Recharts ReferenceArea band"
```

---

### Task 18: `PatientLabPanel` integration — replace table, add toggle, remove grouping

**Files:**
- Modify: `frontend/src/features/profiles/components/PatientLabPanel.tsx`
- Create: `frontend/src/features/profiles/components/__tests__/PatientLabPanel.test.tsx`

- [ ] **Step 1: Read the current `PatientLabPanel.tsx`**

```bash
wc -l frontend/src/features/profiles/components/PatientLabPanel.tsx
```

Expected: ~400 lines currently. After this task it should shrink.

- [ ] **Step 2: Remove the client-side grouping logic**

Find the `groupMeasurementsByConcept` function (or similar) around lines 286-310 and any associated helper. Delete it. The data now comes from `profile.labGroups` directly.

- [ ] **Step 3: Replace the data source**

Change the component's input from:

```tsx
const measurements = events.filter((e) => e.domain === 'measurement');
const groups = groupMeasurementsByConcept(measurements);
```

to:

```tsx
const groups = profile.labGroups ?? [];
```

Update the component's props interface to take a `PatientProfile` (or at least its `labGroups` field) instead of the flat events list.

**Parent page update required.** Find the component that renders `<PatientLabPanel ...>` (likely `frontend/src/features/profiles/pages/PatientProfilePage.tsx` or similar):

```bash
grep -rn "PatientLabPanel" frontend/src/ | grep -v __tests__ | grep -v '\.test\.'
```

Update the parent to pass `profile` (or the `labGroups` slice) instead of the flat events list. Keep the change minimal — the parent already has `profile` from `usePatientProfile()`.

- [ ] **Step 4: Replace the expanded-row table with the chart + toggle**

Find the expanded-row body (around lines 229-280 currently). Replace it with:

```tsx
{expanded[group.conceptId] && (
  <div className="space-y-2 rounded-md bg-zinc-900/40 p-3">
    <LabTrendChart
      conceptName={group.conceptName}
      unitName={group.unitName}
      values={group.values}
      range={group.range}
    />

    <button
      type="button"
      onClick={() => toggleValuesTable(group.conceptId)}
      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
    >
      <ChevronRight
        className={cn(
          'h-3 w-3 transition-transform',
          showValues[group.conceptId] && 'rotate-90',
        )}
      />
      {showValues[group.conceptId] ? 'Hide values' : 'Show values'}
    </button>

    {showValues[group.conceptId] && (
      <LabValuesTable values={group.values} unitName={group.unitName} range={group.range} />
    )}
  </div>
)}
```

Add local state for the "Show values" toggle:

```tsx
const [showValues, setShowValues] = useState<Record<number, boolean>>({});
const toggleValuesTable = (conceptId: number) =>
  setShowValues((prev) => ({ ...prev, [conceptId]: !prev[conceptId] }));
```

Import the new components:

```tsx
import { LabTrendChart } from './LabTrendChart';
import { LabValuesTable } from './LabValuesTable';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
```

- [ ] **Step 5: Verify the collapsed row sparkline + status indicator get populated**

The collapsed row currently has a sparkline (around lines 62-75) and a status indicator. Previously both received null data. Now the component reads from `group.range` and `group.values[*].status`. Verify those consumer paths still work with the new types — they should, because the field names on the new `LabGroup` type match what the component was already reaching for (`range`, `values[].status`).

- [ ] **Step 6: Write the integration test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, beforeAll } from 'vitest';
import { PatientLabPanel } from '../PatientLabPanel';
import type { PatientProfile } from '@/types/api.generated';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 200 });
});

const mockProfile: Partial<PatientProfile> = {
  labGroups: [
    {
      conceptId: 3000963,
      conceptName: 'Hemoglobin',
      loincCode: '718-7',
      unitConceptId: 8713,
      unitName: 'g/dL',
      n: 3,
      latestValue: 11.8,
      latestDate: '2025-11-04',
      trend: 'down',
      values: [
        { date: '2025-05-10', value: 13.1, status: 'normal' },
        { date: '2025-08-02', value: 12.4, status: 'normal' },
        { date: '2025-11-04', value: 11.8, status: 'low' },
      ],
      range: {
        low: 12.0, high: 15.5, source: 'curated',
        sourceLabel: 'LOINC (F, 18+)', sourceRef: 'Mayo', nObservations: null,
      },
    },
  ],
};

describe('PatientLabPanel', () => {
  it('renders one row per lab group', () => {
    render(<PatientLabPanel profile={mockProfile as PatientProfile} />);
    expect(screen.getByText('Hemoglobin')).toBeInTheDocument();
  });

  it('expands row on click and shows the chart', () => {
    const { container } = render(<PatientLabPanel profile={mockProfile as PatientProfile} />);
    fireEvent.click(screen.getByText('Hemoglobin'));
    expect(container.querySelector('.recharts-reference-area')).not.toBeNull();
  });

  it('shows the values table when "Show values" is clicked', () => {
    render(<PatientLabPanel profile={mockProfile as PatientProfile} />);
    fireEvent.click(screen.getByText('Hemoglobin'));
    fireEvent.click(screen.getByText('Show values'));
    expect(screen.getByText('Date')).toBeInTheDocument();   // LabValuesTable header
    expect(screen.getByText('Low')).toBeInTheDocument();     // first value's status
  });
});
```

**Note:** The exact prop signature of `PatientLabPanel` (whether it takes `profile` or `events`) depends on the existing code — adapt this test to match after reading the current component.

- [ ] **Step 7: Run tests to verify pass**

```bash
docker compose exec node sh -c "cd /app && npx vitest run src/features/profiles/components/__tests__/PatientLabPanel.test.tsx"
```

Expected: all 3 tests pass.

- [ ] **Step 8: TypeScript + ESLint + Vite build all clean**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx eslint src/features/profiles/components/PatientLabPanel.tsx && npx vite build"
```

Expected: all clean. If any errors, fix before continuing.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/profiles/components/PatientLabPanel.tsx frontend/src/features/profiles/components/__tests__/PatientLabPanel.test.tsx
git commit -m "feat(profiles): replace labs table with LabTrendChart + Show values toggle"
```

---

## Phase 6: Deployment & Verification

### Task 19: Run migrations + seeder + compute command against dev

**Files:** none (deployment steps only)

- [ ] **Step 1: Apply migrations via deploy**

```bash
./deploy.sh --db
```

Expected: both new migrations run; `LabReferenceRangeSeeder` runs as part of `DatabaseSeeder`; curated rows land in `app.lab_reference_range_curated`.

- [ ] **Step 2: Verify curated rows present**

```bash
PGPASSWORD= psql -h localhost -U claude_dev -d parthenon -c "
SELECT COUNT(*) FROM app.lab_reference_range_curated;
SELECT COUNT(DISTINCT measurement_concept_id) FROM app.lab_reference_range_curated;"
```

Expected: ~50 rows, ~35 distinct concepts (from Task 7 YAML).

- [ ] **Step 3: Compute population ranges for small sources first**

Start with Pancreas and IRSF (smallest):

```bash
docker compose exec php php artisan labs:compute-reference-ranges --source=pancreas --min-n=30
docker compose exec php php artisan labs:compute-reference-ranges --source=irsf --min-n=30
```

Expected: each command prints `wrote N rows to lab_reference_range_population` and exits 0.

- [ ] **Step 4: Compute population ranges for SynPUF**

```bash
docker compose exec php php artisan labs:compute-reference-ranges --source=synpuf --min-n=100
```

SynPUF has 69M rows; expect 5-20 minutes depending on existing indexes. Use `--min-n=100` for better statistical confidence given the large cohort.

Expected: command completes, writes several hundred rows.

- [ ] **Step 5: Compute population ranges for OMOP (longest)**

```bash
docker compose exec php php artisan labs:compute-reference-ranges --source=omop --min-n=500
```

OMOP has 710M rows; this will take longer. Use `--min-n=500` given cohort size. Run in a `screen` or `tmux` session so the shell disconnect doesn't abort it.

Expected: command eventually completes. If it fails due to query timeout, narrow scope with `--concepts=` and run in batches.

- [ ] **Step 6: Verify all sources have population rows**

```bash
PGPASSWORD= psql -h localhost -U claude_dev -d parthenon -c "
SELECT s.source_key, COUNT(*) AS range_rows, MAX(p.computed_at) AS latest
FROM app.lab_reference_range_population p
JOIN app.sources s ON s.id = p.source_id
GROUP BY s.source_key
ORDER BY s.source_key;"
```

Expected: one row per source with counts > 0.

- [ ] **Step 7: No commit for this task — it's operational only**

---

### Task 20: End-to-end manual verification + devlog entry

**Files:**
- Create: `docs/devlog/modules/patient-profiles/2026-04-09-labs-trend-chart-shipped.md`

- [ ] **Step 1: Build the frontend production bundle**

```bash
./deploy.sh --frontend
```

Expected: build succeeds, `frontend/dist/` updated.

- [ ] **Step 2: Manual verification — SynPUF patient with measurements**

1. Navigate to `https://parthenon.acumenus.net` (or `http://localhost:8082` in dev)
2. Log in as `admin@acumenus.net`
3. Pick a SynPUF patient that has labs:
   ```bash
   PGPASSWORD= psql -h localhost -U claude_dev -d parthenon -c "
   SELECT person_id, COUNT(*) FROM synpuf.measurement
   WHERE value_as_number IS NOT NULL AND unit_concept_id IS NOT NULL
   GROUP BY person_id ORDER BY 2 DESC LIMIT 5;"
   ```
4. Open their Patient Profile → Labs tab
5. Verify:
   - [ ] Lab rows show a sparkline with a green reference band
   - [ ] Status column has Low/Normal/High text
   - [ ] Clicking a row expands to show the `LabTrendChart` with a teal range band behind the line
   - [ ] The chart footnote shows `"synpuf pop. P2.5–P97.5 (n=...)"` or `"Mayo (M/F, 18+)"` depending on whether curated matches
   - [ ] Hovering a dot shows the tooltip with date, value, and status label
   - [ ] Clicking "Show values" reveals the table beneath the chart
   - [ ] Clicking "Hide values" collapses it again

- [ ] **Step 3: Manual verification — Pancreas patient**

Pancreas has the `range_low` / `range_high` already populated in the ETL, but we are not reading those anymore — verify the new curated/population path overrides it cleanly.

- [ ] **Step 4: Manual verification — edge cases**

- [ ] Patient with 1 lab → chart renders (flat line, single dot)
- [ ] Patient with 0 labs → Labs panel shows "No lab data" or equivalent (existing behavior)
- [ ] Patient of unknown sex → sex-specific curated rows don't apply; fallback to sex='A' or population; verify it doesn't crash
- [ ] A lab that is not in the curated YAML and has no population rows → chart renders without band, status shows "—"

- [ ] **Step 5: Write the devlog entry**

```markdown
# Patient Labs Trend Chart — Shipped

**Date:** 2026-04-09
**Module:** Patient Profiles
**Spec:** `docs/superpowers/specs/2026-04-09-patient-labs-trend-chart-design.md`
**Plan:** `docs/superpowers/plans/2026-04-09-patient-labs-trend-chart.md`

## What shipped

The Patient Profile Labs Panel now renders a Recharts line chart with a
shaded reference-range band behind each expanded lab, replacing the
previous table view. Ranges and status are populated for every lab
across every CDM source via a two-tier resolver: curated LOINC
references first, per-source population P2.5–P97.5 fallback.

## Why it was broken

The Parthenon ETL doesn't populate `omop.measurement.range_low` /
`range_high` — 0% coverage across 780M rows of OMOP/SynPUF/IRSF. The
frontend was correctly showing "nothing" because there was nothing to
show. Fixed by layering a reference-range data model on top of the CDM
(HIGHSEC §3.2 compliance — CDM schemas stay read-only).

## Data

- `app.lab_reference_range_curated` — ~50 rows from the initial YAML
  seed (Task 7). Expandable via PR to `lab_reference_ranges.yaml`.
- `app.lab_reference_range_population` — per-source P2.5/P97.5,
  computed by `php artisan labs:compute-reference-ranges` (Task 19).

## UX

- Expanded lab row now shows a Recharts `ComposedChart` with a
  `ReferenceArea` teal band between `range.low` and `range.high`.
- Chart footnote shows which reference source is in use: curated
  (`"Mayo (F, 18+)"`) or population (`"synpuf pop. P2.5–P97.5 (n=...)"`).
- "Show values" toggle beneath the chart reveals the old table for
  clinicians who want the raw numbers.
- Collapsed-row sparkline + status indicator finally light up — the
  code was already in place, it just needed range data.

## Follow-ups

- Expand curated YAML to full Tier 3 (~170 labs). Task 21 in the plan,
  optional, clinical data-entry work.
- Time-range filter controls (3mo/6mo/1y/all) if clinicians ask for
  them; not in v1.
- Unit conversion (mg/dL ↔ mmol/L) if a non-US-units source ever
  lands; sampling shows all current sources use US-conventional.
- Consider adding a partial index on
  `{source}.measurement (measurement_concept_id, unit_concept_id)
  WHERE value_as_number IS NOT NULL` if `labs:compute-reference-ranges`
  is too slow on OMOP.
```

- [ ] **Step 6: Commit the devlog**

```bash
git add docs/devlog/modules/patient-profiles/2026-04-09-labs-trend-chart-shipped.md
git commit -m "docs(profiles): devlog for labs trend chart shipment"
```

- [ ] **Step 7: Push to remote**

```bash
git push origin main
```

Only after `./deploy.sh` runs cleanly on the production host. See memory `feedback_sprint_completion_sop.md`: test/debug → CI preflight → commit/push → deploy/devlog.

- [ ] **Step 8: Run full pre-commit equivalent locally as a final gate**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint --test && vendor/bin/phpstan analyse --memory-limit=2G && vendor/bin/pest"
docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx eslint . && npx vitest run && npx vite build"
```

Expected: all green.

---

### Task 21 (Optional, Stretch): Expand YAML to full Tier 3 coverage

**Files:**
- Modify: `backend/database/seeders/data/lab_reference_ranges.yaml`

This task is optional and can be a separate PR. It is **clinical data-entry work**, not engineering — the engineer should coordinate with the user (Dr. Udoshi) or copy values from the Mayo Clinical Laboratory Test Catalog, LOINC, and standard path references.

- [ ] **Step 1: Identify labs to add**

Cross-reference the initial YAML against the panel table in spec §4. Missing from the initial seed: MPV, neutrophil/lymphocyte/monocyte/eosinophil/basophil absolute and percent, Cl→many BMP labs present; LDL direct, Apo A1, Apo B, non-HDL, Fibrinogen, D-dimer, Trop T, hs-Trop, BNP, CK, CK-MB, % Fe sat, Free T3, Total T4, T Uptake, Fasting insulin, C-peptide, Fructosamine, eGFR, Cystatin C, Mg, Phos, UA protein, ACR, Vit D, B12, Folate (serum & RBC), Vit A, Vit E, LDH, Amylase, Lipase, Ammonia, AFP, PSA (free & total), CA 19-9, CA 125, CEA, CA 15-3, Reticulocytes, Haptoglobin, ESR, CRP, hs-CRP, Cortisol, Testosterone, Estradiol, FSH, LH, Prolactin, urinalysis, ABG.

- [ ] **Step 2: Add them to the YAML**

Use the existing format. Keep sex/age stratification where clinically relevant (see §4 table). Pull values from Mayo Clin Path Handbook or Mayo Clinical Laboratory Test Catalog. Use UCUM unit codes.

- [ ] **Step 3: Re-run the seeder**

```bash
docker compose exec php php artisan db:seed --class=LabReferenceRangeSeeder
```

Expected: new rows appear, existing rows update (idempotent upsert).

- [ ] **Step 4: Verify total coverage**

```bash
PGPASSWORD= psql -h localhost -U claude_dev -d parthenon -c "
SELECT COUNT(DISTINCT measurement_concept_id) AS distinct_labs, COUNT(*) AS total_rows
FROM app.lab_reference_range_curated;"
```

Target: ≥150 distinct labs.

- [ ] **Step 5: Commit**

```bash
git add backend/database/seeders/data/lab_reference_ranges.yaml
git commit -m "feat(profiles): expand lab reference ranges YAML to Tier 3 coverage"
```

---

## Self-Review Summary

- **Spec coverage**: Every section of the spec maps to at least one task — migrations (Tasks 1-2), DTO/enum (Task 3), services (Tasks 4-6), seeder/compute (Tasks 7-10), API integration (Tasks 11-13), frontend components (Tasks 14-18), deployment + verification (Tasks 19-20), stretch expansion (Task 21).
- **Placeholder scan**: No TBDs, TODOs, or "implement later" in any step. Every step that writes code shows the actual code.
- **Type consistency**: `LabRangeDto`, `LabStatus`, `LabGroup`, `LabValue`, `LabRange` used consistently across backend tasks and the OpenAPI schema; frontend tasks reference `@/types/api.generated` which is populated by Task 13 before any frontend task needs it.
- **Test-before-implementation**: TDD steps (write failing test → run → implement → run passing) present in Tasks 4, 5, 6, 8, 10, 14, 16, 17. Non-TDD tasks (migrations, YAML data file, tooltip, deployment) are flagged explicitly with rationale.
- **Commit cadence**: Every task ends with a commit step.
- **Risks** from spec §9 are addressed: per-source transaction isolation in Task 10, null-bound unique key in Task 1, idempotency test in Task 8, Vite build step in Tasks 17/18, manual verification of edge cases in Task 20.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-09-patient-labs-trend-chart.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best for a 20-task plan where each task has clear acceptance criteria.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints for review.

**Which approach?**
