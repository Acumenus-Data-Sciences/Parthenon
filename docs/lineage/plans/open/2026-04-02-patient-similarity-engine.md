# Patient Similarity Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-modal patient similarity engine with dual scoring modes (interpretable + embedding), bidirectional cohort integration, and tiered privacy controls.

**Architecture:** Split Responsibility — Laravel handles feature extraction, interpretable scoring, auth/RBAC, and orchestration. Python AI service handles SapBERT embedding generation. PostgreSQL + pgvector stores structured features and dense embeddings. Both scoring modes produce identical response shapes with per-dimension breakdowns.

**Tech Stack:** Laravel 11 / PHP 8.4, FastAPI / Python 3.12, PostgreSQL 17 + pgvector, SapBERT (768-dim → 512-dim patient vectors), React 19 + TypeScript + TanStack Query, Horizon queues.

**Spec:** `docs/architecture/2026-04-02-patient-similarity-engine-design.md`

---

## File Structure

### Backend — New Files

```
backend/database/migrations/
  2026_04_03_000001_create_patient_feature_vectors_table.php
  2026_04_03_000002_create_source_measurement_stats_table.php
  2026_04_03_000003_create_similarity_dimensions_table.php
  2026_04_03_000004_create_patient_similarity_cache_table.php
  2026_04_03_000005_seed_similarity_dimensions.php
  2026_04_03_000006_add_patient_similarity_permissions.php

backend/app/Models/App/
  PatientFeatureVector.php
  SimilarityDimension.php
  SourceMeasurementStat.php
  PatientSimilarityCache.php

backend/app/Services/PatientSimilarity/
  PatientSimilarityService.php          — Orchestrates search, mode routing, caching
  SimilarityFeatureExtractor.php        — Extracts all 6 dimensions from CDM
  Scorers/
    DimensionScorerInterface.php        — Contract for all scorers
    DemographicsScorer.php
    ConditionScorer.php
    MeasurementScorer.php
    DrugScorer.php
    ProcedureScorer.php
    GenomicScorer.php
  CohortCentroidBuilder.php
  EmbeddingClient.php                   — HTTP client to Python AI service

backend/app/Http/Controllers/Api/V1/
  PatientSimilarityController.php

backend/app/Http/Requests/
  PatientSimilaritySearchRequest.php
  PatientSimilarityComputeRequest.php
  PatientSimilarityExportCohortRequest.php

backend/app/Jobs/
  ComputePatientFeatureVectors.php
```

### Backend — Modified Files

```
backend/routes/api.php                               — New route group
backend/database/seeders/RolePermissionSeeder.php     — Add patient-similarity permissions
```

### Python AI Service — New Files

```
ai/app/routers/patient_similarity.py
ai/app/services/patient_embeddings.py
```

### Frontend — New Files

```
frontend/src/features/patient-similarity/
  types/
    patientSimilarity.ts
  api/
    patientSimilarityApi.ts
  hooks/
    usePatientSimilarity.ts
  components/
    SimilaritySearchForm.tsx
    SimilarPatientTable.tsx
    DimensionScoreBar.tsx
    SimilarityModeToggle.tsx
    StalenessIndicator.tsx
    CohortExportDialog.tsx
    CohortSeedForm.tsx
  pages/
    PatientSimilarityPage.tsx
    PatientComparisonPage.tsx
```

### Frontend — Modified Files

```
frontend/src/app/router.tsx                          — New routes
frontend/src/components/layout/Sidebar.tsx            — New sidebar entry
```

---

## Phase 1: Feature Extraction + Interpretable Scoring

### Task 1: Database Migrations

**Files:**
- Create: `backend/database/migrations/2026_04_03_000001_create_patient_feature_vectors_table.php`
- Create: `backend/database/migrations/2026_04_03_000002_create_source_measurement_stats_table.php`
- Create: `backend/database/migrations/2026_04_03_000003_create_similarity_dimensions_table.php`
- Create: `backend/database/migrations/2026_04_03_000004_create_patient_similarity_cache_table.php`

- [ ] **Step 1: Create patient_feature_vectors migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Ensure pgvector extension exists
        DB::statement('CREATE EXTENSION IF NOT EXISTS vector');

        Schema::create('patient_feature_vectors', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('source_id');
            $table->bigInteger('person_id');

            // Demographics
            $table->smallInteger('age_bucket')->nullable();
            $table->integer('gender_concept_id')->nullable();
            $table->integer('race_concept_id')->nullable();

            // Clinical summaries (JSONB)
            $table->jsonb('condition_concepts')->nullable();
            $table->integer('condition_count')->default(0);
            $table->jsonb('lab_vector')->nullable();
            $table->integer('lab_count')->default(0);
            $table->jsonb('drug_concepts')->nullable();
            $table->jsonb('procedure_concepts')->nullable();

            // Genomic (nullable — only for sources with genomic data)
            $table->jsonb('variant_genes')->nullable();
            $table->integer('variant_count')->default(0);

            // Metadata
            $table->jsonb('dimensions_available');
            $table->timestampTz('computed_at')->useCurrent();
            $table->smallInteger('version')->default(1);

            $table->unique(['source_id', 'person_id']);
            $table->index('source_id');

            $table->foreign('source_id')->references('id')->on('sources')->cascadeOnDelete();
        });

        // Add pgvector column (not supported by Blueprint)
        DB::statement('ALTER TABLE patient_feature_vectors ADD COLUMN embedding vector(512)');

        // IVFFlat index for ANN search (requires some rows to exist — create after data load)
        // Will be created by ComputePatientFeatureVectors job after first batch
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_feature_vectors');
    }
};
```

Write this to `backend/database/migrations/2026_04_03_000001_create_patient_feature_vectors_table.php`.

- [ ] **Step 2: Create source_measurement_stats migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('source_measurement_stats', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('source_id');
            $table->integer('measurement_concept_id');
            $table->doublePrecision('mean');
            $table->doublePrecision('stddev');
            $table->integer('n_patients');
            $table->doublePrecision('percentile_25')->nullable();
            $table->doublePrecision('percentile_75')->nullable();
            $table->timestampTz('computed_at')->useCurrent();

            $table->unique(['source_id', 'measurement_concept_id']);
            $table->foreign('source_id')->references('id')->on('sources')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('source_measurement_stats');
    }
};
```

Write this to `backend/database/migrations/2026_04_03_000002_create_source_measurement_stats_table.php`.

- [ ] **Step 3: Create similarity_dimensions migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('similarity_dimensions', function (Blueprint $table) {
            $table->id();
            $table->string('key', 50)->unique();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->float('default_weight')->default(1.0);
            $table->boolean('is_active')->default(true);
            $table->jsonb('config')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('similarity_dimensions');
    }
};
```

Write this to `backend/database/migrations/2026_04_03_000003_create_similarity_dimensions_table.php`.

- [ ] **Step 4: Create patient_similarity_cache migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patient_similarity_cache', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('source_id');
            $table->bigInteger('seed_person_id');
            $table->string('mode', 20);
            $table->string('weights_hash', 64);
            $table->jsonb('results');
            $table->timestampTz('computed_at')->useCurrent();
            $table->timestampTz('expires_at');

            $table->unique(['source_id', 'seed_person_id', 'mode', 'weights_hash'], 'psc_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_similarity_cache');
    }
};
```

Write this to `backend/database/migrations/2026_04_03_000004_create_patient_similarity_cache_table.php`.

- [ ] **Step 5: Run migrations**

Run: `docker compose exec php php artisan migrate`
Expected: 4 tables created in `app` schema.

- [ ] **Step 6: Commit**

```bash
git add backend/database/migrations/2026_04_03_00000*.php
git commit -m "feat: patient similarity engine database migrations"
```

---

### Task 2: Seed Similarity Dimensions + Permissions

**Files:**
- Create: `backend/database/migrations/2026_04_03_000005_seed_similarity_dimensions.php`
- Create: `backend/database/migrations/2026_04_03_000006_add_patient_similarity_permissions.php`
- Modify: `backend/database/seeders/RolePermissionSeeder.php`

- [ ] **Step 1: Create dimension seed migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('similarity_dimensions')->insert([
            [
                'key' => 'demographics',
                'name' => 'Demographics',
                'description' => 'Age, gender, and race matching',
                'default_weight' => 1.0,
                'is_active' => true,
                'config' => null,
            ],
            [
                'key' => 'conditions',
                'name' => 'Conditions',
                'description' => 'Diagnosis overlap using ancestor-weighted Jaccard similarity',
                'default_weight' => 1.0,
                'is_active' => true,
                'config' => json_encode(['ancestor_rollup_levels' => 3]),
            ],
            [
                'key' => 'measurements',
                'name' => 'Measurements',
                'description' => 'Lab value similarity using z-score normalized Euclidean distance',
                'default_weight' => 1.0,
                'is_active' => true,
                'config' => null,
            ],
            [
                'key' => 'drugs',
                'name' => 'Drugs',
                'description' => 'Medication overlap at ingredient level using Jaccard similarity',
                'default_weight' => 1.0,
                'is_active' => true,
                'config' => null,
            ],
            [
                'key' => 'procedures',
                'name' => 'Procedures',
                'description' => 'Procedure overlap using Jaccard similarity',
                'default_weight' => 1.0,
                'is_active' => true,
                'config' => null,
            ],
            [
                'key' => 'genomics',
                'name' => 'Genomics',
                'description' => 'Variant overlap weighted by pathogenicity tier',
                'default_weight' => 1.0,
                'is_active' => true,
                'config' => json_encode([
                    'weights' => ['Pathogenic' => 3, 'Likely pathogenic' => 2, 'Uncertain significance' => 1],
                ]),
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('similarity_dimensions')->whereIn('key', [
            'demographics', 'conditions', 'measurements', 'drugs', 'procedures', 'genomics',
        ])->delete();
    }
};
```

Write this to `backend/database/migrations/2026_04_03_000005_seed_similarity_dimensions.php`.

- [ ] **Step 2: Create permissions migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        $permissions = [
            'patient-similarity.view',
            'patient-similarity.compute',
        ];

        foreach ($permissions as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }

        // Assign view to researcher and viewer roles
        $viewPerm = Permission::findByName('patient-similarity.view', 'web');
        foreach (['researcher', 'viewer'] as $roleName) {
            $role = Role::findByName($roleName, 'web');
            if (! $role->hasPermissionTo($viewPerm)) {
                $role->givePermissionTo($viewPerm);
            }
        }

        // Assign compute to data-steward role
        $computePerm = Permission::findByName('patient-similarity.compute', 'web');
        $dataSteward = Role::findByName('data-steward', 'web');
        if (! $dataSteward->hasPermissionTo($computePerm)) {
            $dataSteward->givePermissionTo($computePerm);
        }
    }

    public function down(): void
    {
        Permission::where('name', 'like', 'patient-similarity.%')->delete();
    }
};
```

Write this to `backend/database/migrations/2026_04_03_000006_add_patient_similarity_permissions.php`.

- [ ] **Step 3: Update RolePermissionSeeder**

In `backend/database/seeders/RolePermissionSeeder.php`, add `'patient-similarity' => ['view', 'compute']` to the permissions array alongside the existing domains. Add `'patient-similarity.view'` to the `researcher` and `viewer` role assignments, and `'patient-similarity.compute'` to the `data-steward` role assignment. Follow the existing pattern in the file.

- [ ] **Step 4: Run migrations**

Run: `docker compose exec php php artisan migrate`
Expected: 6 dimension rows seeded, 2 permissions created and assigned.

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/2026_04_03_00000[56].php backend/database/seeders/RolePermissionSeeder.php
git commit -m "feat: seed similarity dimensions and patient-similarity permissions"
```

---

### Task 3: Eloquent Models

**Files:**
- Create: `backend/app/Models/App/PatientFeatureVector.php`
- Create: `backend/app/Models/App/SimilarityDimension.php`
- Create: `backend/app/Models/App/SourceMeasurementStat.php`
- Create: `backend/app/Models/App/PatientSimilarityCache.php`

- [ ] **Step 1: Create PatientFeatureVector model**

```php
<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PatientFeatureVector extends Model
{
    public $timestamps = false;

    protected $table = 'patient_feature_vectors';

    protected $fillable = [
        'source_id',
        'person_id',
        'age_bucket',
        'gender_concept_id',
        'race_concept_id',
        'condition_concepts',
        'condition_count',
        'lab_vector',
        'lab_count',
        'drug_concepts',
        'procedure_concepts',
        'variant_genes',
        'variant_count',
        'dimensions_available',
        'computed_at',
        'version',
    ];

    protected function casts(): array
    {
        return [
            'condition_concepts' => 'array',
            'lab_vector' => 'array',
            'drug_concepts' => 'array',
            'procedure_concepts' => 'array',
            'variant_genes' => 'array',
            'dimensions_available' => 'array',
            'computed_at' => 'datetime',
        ];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }

    public function scopeForSource($query, int $sourceId)
    {
        return $query->where('source_id', $sourceId);
    }

    public function hasDimension(string $key): bool
    {
        return in_array($key, $this->dimensions_available ?? [], true);
    }
}
```

Write to `backend/app/Models/App/PatientFeatureVector.php`.

- [ ] **Step 2: Create SimilarityDimension model**

```php
<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class SimilarityDimension extends Model
{
    public $timestamps = false;

    protected $table = 'similarity_dimensions';

    protected $fillable = [
        'key',
        'name',
        'description',
        'default_weight',
        'is_active',
        'config',
    ];

    protected function casts(): array
    {
        return [
            'default_weight' => 'float',
            'is_active' => 'boolean',
            'config' => 'array',
        ];
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
```

Write to `backend/app/Models/App/SimilarityDimension.php`.

- [ ] **Step 3: Create SourceMeasurementStat model**

```php
<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SourceMeasurementStat extends Model
{
    public $timestamps = false;

    protected $table = 'source_measurement_stats';

    protected $fillable = [
        'source_id',
        'measurement_concept_id',
        'mean',
        'stddev',
        'n_patients',
        'percentile_25',
        'percentile_75',
        'computed_at',
    ];

    protected function casts(): array
    {
        return [
            'mean' => 'float',
            'stddev' => 'float',
            'n_patients' => 'integer',
            'percentile_25' => 'float',
            'percentile_75' => 'float',
            'computed_at' => 'datetime',
        ];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Source::class);
    }
}
```

Write to `backend/app/Models/App/SourceMeasurementStat.php`.

- [ ] **Step 4: Create PatientSimilarityCache model**

```php
<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;

class PatientSimilarityCache extends Model
{
    public $timestamps = false;

    protected $table = 'patient_similarity_cache';

    protected $fillable = [
        'source_id',
        'seed_person_id',
        'mode',
        'weights_hash',
        'results',
        'computed_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'results' => 'array',
            'computed_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function scopeValid($query)
    {
        return $query->where('expires_at', '>', now());
    }

    public static function hashWeights(array $weights): string
    {
        ksort($weights);

        return hash('sha256', json_encode($weights));
    }
}
```

Write to `backend/app/Models/App/PatientSimilarityCache.php`.

- [ ] **Step 5: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 6: Commit**

```bash
git add backend/app/Models/App/PatientFeatureVector.php backend/app/Models/App/SimilarityDimension.php backend/app/Models/App/SourceMeasurementStat.php backend/app/Models/App/PatientSimilarityCache.php
git commit -m "feat: Eloquent models for patient similarity engine"
```

---

### Task 4: Dimension Scorer Interface + Demographics Scorer

**Files:**
- Create: `backend/app/Services/PatientSimilarity/Scorers/DimensionScorerInterface.php`
- Create: `backend/app/Services/PatientSimilarity/Scorers/DemographicsScorer.php`

- [ ] **Step 1: Create DimensionScorerInterface**

```php
<?php

namespace App\Services\PatientSimilarity\Scorers;

interface DimensionScorerInterface
{
    /**
     * Return the dimension key (e.g., 'demographics', 'conditions').
     */
    public function key(): string;

    /**
     * Score similarity between two patients for this dimension.
     *
     * @param  array  $patientA  Feature vector data for patient A
     * @param  array  $patientB  Feature vector data for patient B
     * @return float  Score in [0, 1], or -1 if dimension is not available for comparison
     */
    public function score(array $patientA, array $patientB): float;
}
```

Write to `backend/app/Services/PatientSimilarity/Scorers/DimensionScorerInterface.php`.

- [ ] **Step 2: Create DemographicsScorer**

```php
<?php

namespace App\Services\PatientSimilarity\Scorers;

class DemographicsScorer implements DimensionScorerInterface
{
    private const MAX_AGE_SPAN = 20;

    public function key(): string
    {
        return 'demographics';
    }

    public function score(array $patientA, array $patientB): float
    {
        $ageBucketA = $patientA['age_bucket'] ?? null;
        $ageBucketB = $patientB['age_bucket'] ?? null;

        if ($ageBucketA === null && $ageBucketB === null) {
            return -1.0;
        }

        $ageScore = 0.0;
        if ($ageBucketA !== null && $ageBucketB !== null) {
            $ageDiff = abs($ageBucketA - $ageBucketB) * 5; // 5-year buckets
            $ageScore = max(0, 1 - ($ageDiff / self::MAX_AGE_SPAN));
        }

        $genderScore = ($patientA['gender_concept_id'] ?? 0) === ($patientB['gender_concept_id'] ?? 0) ? 1.0 : 0.0;
        $raceScore = ($patientA['race_concept_id'] ?? 0) === ($patientB['race_concept_id'] ?? 0) ? 1.0 : 0.0;

        return 0.4 * $ageScore + 0.4 * $genderScore + 0.2 * $raceScore;
    }
}
```

Write to `backend/app/Services/PatientSimilarity/Scorers/DemographicsScorer.php`.

- [ ] **Step 3: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 4: Commit**

```bash
git add backend/app/Services/PatientSimilarity/Scorers/
git commit -m "feat: DimensionScorerInterface and DemographicsScorer"
```

---

### Task 5: Remaining Dimension Scorers

**Files:**
- Create: `backend/app/Services/PatientSimilarity/Scorers/ConditionScorer.php`
- Create: `backend/app/Services/PatientSimilarity/Scorers/MeasurementScorer.php`
- Create: `backend/app/Services/PatientSimilarity/Scorers/DrugScorer.php`
- Create: `backend/app/Services/PatientSimilarity/Scorers/ProcedureScorer.php`
- Create: `backend/app/Services/PatientSimilarity/Scorers/GenomicScorer.php`

- [ ] **Step 1: Create ConditionScorer**

```php
<?php

namespace App\Services\PatientSimilarity\Scorers;

class ConditionScorer implements DimensionScorerInterface
{
    public function key(): string
    {
        return 'conditions';
    }

    public function score(array $patientA, array $patientB): float
    {
        $setA = $patientA['condition_concepts'] ?? [];
        $setB = $patientB['condition_concepts'] ?? [];

        if (empty($setA) && empty($setB)) {
            return -1.0;
        }

        if (empty($setA) || empty($setB)) {
            return 0.0;
        }

        return $this->jaccard($setA, $setB);
    }

    private function jaccard(array $a, array $b): float
    {
        $setA = array_flip($a);
        $setB = array_flip($b);

        $intersection = count(array_intersect_key($setA, $setB));
        $union = count($setA) + count($setB) - $intersection;

        return $union > 0 ? $intersection / $union : 0.0;
    }
}
```

Write to `backend/app/Services/PatientSimilarity/Scorers/ConditionScorer.php`.

- [ ] **Step 2: Create MeasurementScorer**

```php
<?php

namespace App\Services\PatientSimilarity\Scorers;

class MeasurementScorer implements DimensionScorerInterface
{
    public function key(): string
    {
        return 'measurements';
    }

    public function score(array $patientA, array $patientB): float
    {
        $labsA = $patientA['lab_vector'] ?? [];
        $labsB = $patientB['lab_vector'] ?? [];

        if (empty($labsA) && empty($labsB)) {
            return -1.0;
        }

        // Only compare measurement types present in both patients
        $sharedKeys = array_intersect(array_keys($labsA), array_keys($labsB));

        if (empty($sharedKeys)) {
            return 0.0;
        }

        $sumSquaredDiff = 0.0;
        foreach ($sharedKeys as $key) {
            $diff = (float) $labsA[$key] - (float) $labsB[$key];
            $sumSquaredDiff += $diff * $diff;
        }

        $euclidean = sqrt($sumSquaredDiff / count($sharedKeys));

        return 1.0 / (1.0 + $euclidean);
    }
}
```

Write to `backend/app/Services/PatientSimilarity/Scorers/MeasurementScorer.php`.

- [ ] **Step 3: Create DrugScorer**

```php
<?php

namespace App\Services\PatientSimilarity\Scorers;

class DrugScorer implements DimensionScorerInterface
{
    public function key(): string
    {
        return 'drugs';
    }

    public function score(array $patientA, array $patientB): float
    {
        $setA = $patientA['drug_concepts'] ?? [];
        $setB = $patientB['drug_concepts'] ?? [];

        if (empty($setA) && empty($setB)) {
            return -1.0;
        }

        if (empty($setA) || empty($setB)) {
            return 0.0;
        }

        $flippedA = array_flip($setA);
        $flippedB = array_flip($setB);

        $intersection = count(array_intersect_key($flippedA, $flippedB));
        $union = count($flippedA) + count($flippedB) - $intersection;

        return $union > 0 ? $intersection / $union : 0.0;
    }
}
```

Write to `backend/app/Services/PatientSimilarity/Scorers/DrugScorer.php`.

- [ ] **Step 4: Create ProcedureScorer**

```php
<?php

namespace App\Services\PatientSimilarity\Scorers;

class ProcedureScorer implements DimensionScorerInterface
{
    public function key(): string
    {
        return 'procedures';
    }

    public function score(array $patientA, array $patientB): float
    {
        $setA = $patientA['procedure_concepts'] ?? [];
        $setB = $patientB['procedure_concepts'] ?? [];

        if (empty($setA) && empty($setB)) {
            return -1.0;
        }

        if (empty($setA) || empty($setB)) {
            return 0.0;
        }

        $flippedA = array_flip($setA);
        $flippedB = array_flip($setB);

        $intersection = count(array_intersect_key($flippedA, $flippedB));
        $union = count($flippedA) + count($flippedB) - $intersection;

        return $union > 0 ? $intersection / $union : 0.0;
    }
}
```

Write to `backend/app/Services/PatientSimilarity/Scorers/ProcedureScorer.php`.

- [ ] **Step 5: Create GenomicScorer**

```php
<?php

namespace App\Services\PatientSimilarity\Scorers;

class GenomicScorer implements DimensionScorerInterface
{
    private const PATHOGENICITY_WEIGHTS = [
        'Pathogenic' => 3.0,
        'Likely pathogenic' => 2.0,
        'Uncertain significance' => 1.0,
    ];

    public function key(): string
    {
        return 'genomics';
    }

    public function score(array $patientA, array $patientB): float
    {
        $variantsA = $patientA['variant_genes'] ?? [];
        $variantsB = $patientB['variant_genes'] ?? [];

        if (empty($variantsA) && empty($variantsB)) {
            return -1.0;
        }

        if (empty($variantsA) || empty($variantsB)) {
            return 0.0;
        }

        // Build gene → max pathogenicity weight maps
        $genesA = $this->buildGeneWeightMap($variantsA);
        $genesB = $this->buildGeneWeightMap($variantsB);

        $sharedWeight = 0.0;
        $totalWeight = 0.0;

        $allGenes = array_unique(array_merge(array_keys($genesA), array_keys($genesB)));

        foreach ($allGenes as $gene) {
            $wA = $genesA[$gene] ?? 0.0;
            $wB = $genesB[$gene] ?? 0.0;
            $totalWeight += max($wA, $wB);

            if ($wA > 0 && $wB > 0) {
                $sharedWeight += min($wA, $wB);
            }
        }

        return $totalWeight > 0 ? $sharedWeight / $totalWeight : 0.0;
    }

    /**
     * @param  array<int, array{gene: string, pathogenicity: string}>  $variants
     * @return array<string, float>  gene → highest pathogenicity weight
     */
    private function buildGeneWeightMap(array $variants): array
    {
        $map = [];
        foreach ($variants as $v) {
            $gene = $v['gene'] ?? '';
            $pathogenicity = $v['pathogenicity'] ?? 'Uncertain significance';
            $weight = self::PATHOGENICITY_WEIGHTS[$pathogenicity] ?? 0.5;
            $map[$gene] = max($map[$gene] ?? 0, $weight);
        }

        return $map;
    }
}
```

Write to `backend/app/Services/PatientSimilarity/Scorers/GenomicScorer.php`.

- [ ] **Step 6: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 7: Commit**

```bash
git add backend/app/Services/PatientSimilarity/Scorers/
git commit -m "feat: dimension scorers — Condition, Measurement, Drug, Procedure, Genomic"
```

---

### Task 6: Similarity Feature Extractor

**Files:**
- Create: `backend/app/Services/PatientSimilarity/SimilarityFeatureExtractor.php`

This service extracts all 6 feature dimensions from OMOP CDM tables for a given source. Unlike the existing `PatientFeatureExtractor` (which is cohort-scoped and score-driven), this extracts broadly across the full patient population of a source.

- [ ] **Step 1: Create SimilarityFeatureExtractor**

```php
<?php

namespace App\Services\PatientSimilarity;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\App\SourceMeasurementStat;
use App\Services\PopulationRisk\ConceptResolutionService;
use Illuminate\Support\Facades\DB;

class SimilarityFeatureExtractor
{
    public function __construct(
        private readonly ConceptResolutionService $conceptResolver,
    ) {}

    /**
     * Extract feature vector data for a batch of person_ids.
     *
     * @param  int[]  $personIds
     * @return array<int, array>  person_id → feature data
     */
    public function extractBatch(array $personIds, Source $source): array
    {
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
        $connection = $source->source_connection;
        $personIdList = '{' . implode(',', $personIds) . '}';

        $patients = $this->extractDemographics($connection, $cdmSchema, $personIdList);
        $this->extractConditions($patients, $connection, $cdmSchema, $vocabSchema, $personIdList);
        $this->extractMeasurements($patients, $connection, $cdmSchema, $source->id, $personIdList);
        $this->extractDrugs($patients, $connection, $cdmSchema, $vocabSchema, $personIdList);
        $this->extractProcedures($patients, $connection, $cdmSchema, $personIdList);
        $this->extractGenomics($patients, $personIds, $source->id);

        // Set dimensions_available for each patient
        foreach ($patients as $pid => &$p) {
            $dims = ['demographics']; // Always present if person exists
            if (! empty($p['condition_concepts'])) {
                $dims[] = 'conditions';
            }
            if (! empty($p['lab_vector'])) {
                $dims[] = 'measurements';
            }
            if (! empty($p['drug_concepts'])) {
                $dims[] = 'drugs';
            }
            if (! empty($p['procedure_concepts'])) {
                $dims[] = 'procedures';
            }
            if (! empty($p['variant_genes'])) {
                $dims[] = 'genomics';
            }
            $p['dimensions_available'] = $dims;
        }
        unset($p);

        return $patients;
    }

    /**
     * @return array<int, array>
     */
    private function extractDemographics(string $connection, string $cdmSchema, string $personIdList): array
    {
        $rows = DB::connection($connection)->select(
            "SELECT p.person_id,
                    EXTRACT(YEAR FROM CURRENT_DATE)::int - p.year_of_birth AS age,
                    p.gender_concept_id,
                    p.race_concept_id,
                    p.ethnicity_concept_id
             FROM {$cdmSchema}.person p
             WHERE p.person_id = ANY(?::bigint[])",
            [$personIdList]
        );

        $patients = [];
        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            $age = (int) $row->age;
            $patients[$pid] = [
                'person_id' => $pid,
                'age_bucket' => intdiv($age, 5), // 5-year buckets: 0-4=0, 5-9=1, ...
                'gender_concept_id' => (int) $row->gender_concept_id,
                'race_concept_id' => (int) $row->race_concept_id,
                'condition_concepts' => [],
                'lab_vector' => [],
                'drug_concepts' => [],
                'procedure_concepts' => [],
                'variant_genes' => [],
            ];
        }

        return $patients;
    }

    private function extractConditions(array &$patients, string $connection, string $cdmSchema, string $vocabSchema, string $personIdList): void
    {
        if (empty($patients)) {
            return;
        }

        // Get distinct conditions per patient, rolled up to ancestor level 3
        $rows = DB::connection($connection)->select(
            "SELECT DISTINCT co.person_id, ca.ancestor_concept_id
             FROM {$cdmSchema}.condition_occurrence co
             JOIN {$vocabSchema}.concept_ancestor ca
               ON ca.descendant_concept_id = co.condition_concept_id
              AND ca.min_levels_of_separation BETWEEN 0 AND 3
             WHERE co.person_id = ANY(?::bigint[])
               AND co.condition_concept_id > 0",
            [$personIdList]
        );

        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            if (isset($patients[$pid])) {
                $patients[$pid]['condition_concepts'][] = (int) $row->ancestor_concept_id;
            }
        }

        // Deduplicate
        foreach ($patients as $pid => &$p) {
            $p['condition_concepts'] = array_values(array_unique($p['condition_concepts']));
        }
        unset($p);
    }

    private function extractMeasurements(array &$patients, string $connection, string $cdmSchema, int $sourceId, string $personIdList): void
    {
        if (empty($patients)) {
            return;
        }

        // Get population stats for z-score normalization
        $stats = SourceMeasurementStat::where('source_id', $sourceId)
            ->get()
            ->keyBy('measurement_concept_id');

        if ($stats->isEmpty()) {
            return;
        }

        $measurementIds = $stats->keys()->toArray();
        $measurementIdList = '{' . implode(',', $measurementIds) . '}';

        $rows = DB::connection($connection)->select(
            "SELECT DISTINCT ON (m.person_id, m.measurement_concept_id)
                    m.person_id,
                    m.measurement_concept_id,
                    m.value_as_number
             FROM {$cdmSchema}.measurement m
             WHERE m.person_id = ANY(?::bigint[])
               AND m.measurement_concept_id = ANY(?::int[])
               AND m.value_as_number IS NOT NULL
             ORDER BY m.person_id, m.measurement_concept_id, m.measurement_date DESC",
            [$personIdList, $measurementIdList]
        );

        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            $conceptId = (int) $row->measurement_concept_id;
            $stat = $stats->get($conceptId);

            if (isset($patients[$pid]) && $stat && $stat->stddev > 0) {
                $zScore = ((float) $row->value_as_number - $stat->mean) / $stat->stddev;
                $patients[$pid]['lab_vector'][$conceptId] = round($zScore, 4);
            }
        }
    }

    private function extractDrugs(array &$patients, string $connection, string $cdmSchema, string $vocabSchema, string $personIdList): void
    {
        if (empty($patients)) {
            return;
        }

        // Roll up to ingredient level via concept_ancestor
        $rows = DB::connection($connection)->select(
            "SELECT DISTINCT de.person_id, ca.ancestor_concept_id
             FROM {$cdmSchema}.drug_exposure de
             JOIN {$vocabSchema}.concept_ancestor ca
               ON ca.descendant_concept_id = de.drug_concept_id
             JOIN {$vocabSchema}.concept c
               ON c.concept_id = ca.ancestor_concept_id
              AND c.concept_class_id = 'Ingredient'
             WHERE de.person_id = ANY(?::bigint[])
               AND de.drug_concept_id > 0",
            [$personIdList]
        );

        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            if (isset($patients[$pid])) {
                $patients[$pid]['drug_concepts'][] = (int) $row->ancestor_concept_id;
            }
        }

        foreach ($patients as $pid => &$p) {
            $p['drug_concepts'] = array_values(array_unique($p['drug_concepts']));
        }
        unset($p);
    }

    private function extractProcedures(array &$patients, string $connection, string $cdmSchema, string $personIdList): void
    {
        if (empty($patients)) {
            return;
        }

        $rows = DB::connection($connection)->select(
            "SELECT DISTINCT po.person_id, po.procedure_concept_id
             FROM {$cdmSchema}.procedure_occurrence po
             WHERE po.person_id = ANY(?::bigint[])
               AND po.procedure_concept_id > 0",
            [$personIdList]
        );

        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            if (isset($patients[$pid])) {
                $patients[$pid]['procedure_concepts'][] = (int) $row->procedure_concept_id;
            }
        }

        foreach ($patients as $pid => &$p) {
            $p['procedure_concepts'] = array_values(array_unique($p['procedure_concepts']));
        }
        unset($p);
    }

    private function extractGenomics(array &$patients, array $personIds, int $sourceId): void
    {
        // Genomic variants are stored in app schema, not CDM
        $rows = DB::connection('pgsql')->select(
            "SELECT gv.person_id, gv.gene_symbol, gv.clinvar_significance
             FROM genomic_variants gv
             WHERE gv.person_id = ANY(?::bigint[])
               AND gv.source_id = ?
               AND gv.clinvar_significance IS NOT NULL",
            ['{' . implode(',', $personIds) . '}', $sourceId]
        );

        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            if (isset($patients[$pid])) {
                $patients[$pid]['variant_genes'][] = [
                    'gene' => $row->gene_symbol,
                    'pathogenicity' => $row->clinvar_significance,
                ];
            }
        }
    }

    /**
     * Compute and store population-level measurement statistics for z-score normalization.
     */
    public function computeMeasurementStats(Source $source): int
    {
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $connection = $source->source_connection;

        // Top 50 measurement types by patient count
        $rows = DB::connection($connection)->select(
            "SELECT m.measurement_concept_id,
                    AVG(m.value_as_number) AS mean,
                    STDDEV(m.value_as_number) AS stddev,
                    COUNT(DISTINCT m.person_id) AS n_patients,
                    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY m.value_as_number) AS p25,
                    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY m.value_as_number) AS p75
             FROM {$cdmSchema}.measurement m
             WHERE m.value_as_number IS NOT NULL
               AND m.measurement_concept_id > 0
             GROUP BY m.measurement_concept_id
             HAVING COUNT(DISTINCT m.person_id) >= 10
                AND STDDEV(m.value_as_number) > 0
             ORDER BY COUNT(DISTINCT m.person_id) DESC
             LIMIT 50"
        );

        // Upsert stats
        foreach ($rows as $row) {
            SourceMeasurementStat::updateOrCreate(
                [
                    'source_id' => $source->id,
                    'measurement_concept_id' => (int) $row->measurement_concept_id,
                ],
                [
                    'mean' => (float) $row->mean,
                    'stddev' => (float) $row->stddev,
                    'n_patients' => (int) $row->n_patients,
                    'percentile_25' => $row->p25 !== null ? (float) $row->p25 : null,
                    'percentile_75' => $row->p75 !== null ? (float) $row->p75 : null,
                    'computed_at' => now(),
                ]
            );
        }

        return count($rows);
    }
}
```

Write to `backend/app/Services/PatientSimilarity/SimilarityFeatureExtractor.php`.

- [ ] **Step 2: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/PatientSimilarity/SimilarityFeatureExtractor.php
git commit -m "feat: SimilarityFeatureExtractor — 6-dimension patient feature extraction"
```

---

### Task 7: PatientSimilarityService (Interpretable Mode)

**Files:**
- Create: `backend/app/Services/PatientSimilarity/PatientSimilarityService.php`

- [ ] **Step 1: Create PatientSimilarityService**

```php
<?php

namespace App\Services\PatientSimilarity;

use App\Models\App\PatientFeatureVector;
use App\Models\App\PatientSimilarityCache;
use App\Models\App\SimilarityDimension;
use App\Models\App\Source;
use App\Services\PatientSimilarity\Scorers\ConditionScorer;
use App\Services\PatientSimilarity\Scorers\DemographicsScorer;
use App\Services\PatientSimilarity\Scorers\DimensionScorerInterface;
use App\Services\PatientSimilarity\Scorers\DrugScorer;
use App\Services\PatientSimilarity\Scorers\GenomicScorer;
use App\Services\PatientSimilarity\Scorers\MeasurementScorer;
use App\Services\PatientSimilarity\Scorers\ProcedureScorer;

class PatientSimilarityService
{
    /** @var array<string, DimensionScorerInterface> */
    private array $scorers;

    public function __construct()
    {
        $this->scorers = [
            'demographics' => new DemographicsScorer,
            'conditions' => new ConditionScorer,
            'measurements' => new MeasurementScorer,
            'drugs' => new DrugScorer,
            'procedures' => new ProcedureScorer,
            'genomics' => new GenomicScorer,
        ];
    }

    /**
     * Search for patients similar to a seed patient.
     *
     * @param  array<string, float>  $weights  Dimension key → weight
     * @param  array<string, mixed>  $filters  Optional filters (age_range, gender_concept_id)
     * @return array{seed: array, similar_patients: array[], metadata: array}
     */
    public function search(
        int $personId,
        Source $source,
        string $mode,
        array $weights,
        int $limit = 25,
        float $minScore = 0.0,
        array $filters = [],
    ): array {
        $startTime = microtime(true);

        // Check cache first
        $weightsHash = PatientSimilarityCache::hashWeights($weights);
        $cached = PatientSimilarityCache::where('source_id', $source->id)
            ->where('seed_person_id', $personId)
            ->where('mode', $mode)
            ->where('weights_hash', $weightsHash)
            ->valid()
            ->first();

        if ($cached) {
            return $cached->results;
        }

        $seed = PatientFeatureVector::where('source_id', $source->id)
            ->where('person_id', $personId)
            ->first();

        if (! $seed) {
            return [
                'seed' => null,
                'similar_patients' => [],
                'metadata' => ['error' => 'Seed patient not found. Run feature extraction first.'],
            ];
        }

        if ($mode === 'interpretable') {
            $results = $this->searchInterpretable($seed, $source, $weights, $limit, $minScore, $filters);
        } else {
            $results = $this->searchEmbedding($seed, $source, $weights, $limit, $minScore, $filters);
        }

        $results['metadata']['computed_in_ms'] = round((microtime(true) - $startTime) * 1000);

        // Cache results for 1 hour
        PatientSimilarityCache::updateOrCreate(
            [
                'source_id' => $source->id,
                'seed_person_id' => $personId,
                'mode' => $mode,
                'weights_hash' => $weightsHash,
            ],
            [
                'results' => $results,
                'computed_at' => now(),
                'expires_at' => now()->addHour(),
            ]
        );

        return $results;
    }

    private function searchInterpretable(
        PatientFeatureVector $seed,
        Source $source,
        array $weights,
        int $limit,
        float $minScore,
        array $filters,
    ): array {
        $seedData = $seed->toArray();

        // Load all candidates for this source (exclude seed patient)
        $query = PatientFeatureVector::where('source_id', $source->id)
            ->where('person_id', '!=', $seed->person_id);

        // Apply filters
        if (! empty($filters['gender_concept_id'])) {
            $query->where('gender_concept_id', $filters['gender_concept_id']);
        }
        if (! empty($filters['age_range'])) {
            $minBucket = intdiv((int) $filters['age_range'][0], 5);
            $maxBucket = intdiv((int) $filters['age_range'][1], 5);
            $query->whereBetween('age_bucket', [$minBucket, $maxBucket]);
        }

        $candidates = $query->get();
        $scored = [];

        foreach ($candidates as $candidate) {
            $candidateData = $candidate->toArray();
            $result = $this->scorePatientPair($seedData, $candidateData, $weights);

            if ($result['overall_score'] >= $minScore) {
                $scored[] = array_merge($result, [
                    'person_id' => $candidate->person_id,
                ]);
            }
        }

        // Sort by overall_score descending
        usort($scored, fn ($a, $b) => $b['overall_score'] <=> $a['overall_score']);
        $scored = array_slice($scored, 0, $limit);

        return [
            'seed' => [
                'person_id' => $seed->person_id,
                'age_bucket' => $seed->age_bucket,
                'gender_concept_id' => $seed->gender_concept_id,
                'condition_count' => $seed->condition_count,
                'lab_count' => $seed->lab_count,
                'dimensions_available' => $seed->dimensions_available,
            ],
            'mode' => 'interpretable',
            'similar_patients' => $scored,
            'metadata' => [
                'candidates_evaluated' => $candidates->count(),
                'dimensions_used' => array_keys($weights),
            ],
        ];
    }

    private function searchEmbedding(
        PatientFeatureVector $seed,
        Source $source,
        array $weights,
        int $limit,
        float $minScore,
        array $filters,
    ): array {
        // Phase 2 — ANN search via pgvector, then re-rank with interpretable scorers
        // For now, fall back to interpretable search
        return $this->searchInterpretable($seed, $source, $weights, $limit, $minScore, $filters);
    }

    /**
     * Score a pair of patients across all available dimensions.
     *
     * @param  array<string, float>  $weights
     * @return array{overall_score: float, dimension_scores: array<string, float|null>}
     */
    public function scorePatientPair(array $seedData, array $candidateData, array $weights): array
    {
        $dimensionScores = [];
        $weightedSum = 0.0;
        $weightDenominator = 0.0;

        foreach ($this->scorers as $key => $scorer) {
            $weight = $weights[$key] ?? 0.0;
            if ($weight <= 0) {
                $dimensionScores[$key] = null;

                continue;
            }

            $score = $scorer->score($seedData, $candidateData);

            if ($score < 0) {
                // Dimension not available — exclude from denominator
                $dimensionScores[$key] = null;

                continue;
            }

            $dimensionScores[$key] = round($score, 4);
            $weightedSum += $weight * $score;
            $weightDenominator += $weight;
        }

        $overallScore = $weightDenominator > 0 ? round($weightedSum / $weightDenominator, 4) : 0.0;

        return [
            'overall_score' => $overallScore,
            'dimension_scores' => $dimensionScores,
        ];
    }

    /**
     * Get feature vector computation status for a source.
     */
    public function getStatus(Source $source): array
    {
        $count = PatientFeatureVector::where('source_id', $source->id)->count();
        $latest = PatientFeatureVector::where('source_id', $source->id)
            ->orderByDesc('computed_at')
            ->value('computed_at');

        $daysOld = $latest ? now()->diffInDays($latest) : null;

        return [
            'source_id' => $source->id,
            'patient_count' => $count,
            'last_computed_at' => $latest,
            'staleness_warning' => $daysOld !== null && $daysOld > 7,
            'days_since_compute' => $daysOld,
        ];
    }
}
```

Write to `backend/app/Services/PatientSimilarity/PatientSimilarityService.php`.

- [ ] **Step 2: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/PatientSimilarity/PatientSimilarityService.php
git commit -m "feat: PatientSimilarityService — interpretable search with caching"
```

---

### Task 8: Horizon Job — ComputePatientFeatureVectors

**Files:**
- Create: `backend/app/Jobs/ComputePatientFeatureVectors.php`

- [ ] **Step 1: Create the job**

```php
<?php

namespace App\Jobs;

use App\Models\App\PatientFeatureVector;
use App\Models\App\Source;
use App\Services\PatientSimilarity\SimilarityFeatureExtractor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ComputePatientFeatureVectors implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 7200; // 2 hours

    public int $tries = 1;

    public function __construct(
        public Source $source,
        public bool $force = false,
    ) {
        $this->onQueue('similarity');
    }

    public function handle(SimilarityFeatureExtractor $extractor): void
    {
        $cdmSchema = $source = $this->source;
        Log::info("ComputePatientFeatureVectors: starting for source {$source->source_name} (ID: {$source->id})");

        // Step 1: Compute measurement stats first (needed for z-scores)
        $statCount = $extractor->computeMeasurementStats($source);
        Log::info("ComputePatientFeatureVectors: computed {$statCount} measurement stats");

        // Step 2: Get all person_ids from this source's CDM
        $cdmSchema = $source->getTableQualifier(\App\Enums\DaimonType::CDM);
        $connection = $source->source_connection;

        $personIds = DB::connection($connection)
            ->table(DB::raw("{$cdmSchema}.person"))
            ->pluck('person_id')
            ->map(fn ($id) => (int) $id)
            ->toArray();

        $totalPatients = count($personIds);
        Log::info("ComputePatientFeatureVectors: found {$totalPatients} patients");

        // Step 3: Process in batches of 500
        $batchSize = 500;
        $processed = 0;
        $batches = array_chunk($personIds, $batchSize);

        foreach ($batches as $batch) {
            $features = $extractor->extractBatch($batch, $source);

            foreach ($features as $pid => $data) {
                PatientFeatureVector::updateOrCreate(
                    [
                        'source_id' => $source->id,
                        'person_id' => $pid,
                    ],
                    [
                        'age_bucket' => $data['age_bucket'] ?? null,
                        'gender_concept_id' => $data['gender_concept_id'] ?? null,
                        'race_concept_id' => $data['race_concept_id'] ?? null,
                        'condition_concepts' => $data['condition_concepts'],
                        'condition_count' => count($data['condition_concepts']),
                        'lab_vector' => $data['lab_vector'],
                        'lab_count' => count($data['lab_vector']),
                        'drug_concepts' => $data['drug_concepts'],
                        'procedure_concepts' => $data['procedure_concepts'],
                        'variant_genes' => $data['variant_genes'],
                        'variant_count' => count($data['variant_genes']),
                        'dimensions_available' => $data['dimensions_available'],
                        'computed_at' => now(),
                        'version' => 1,
                    ]
                );
            }

            $processed += count($batch);
            Log::info("ComputePatientFeatureVectors: {$processed}/{$totalPatients} patients processed");
        }

        // Step 4: Create IVFFlat index if not exists and enough rows
        if ($totalPatients >= 100) {
            try {
                DB::statement(
                    'CREATE INDEX IF NOT EXISTS idx_pfv_embedding ON patient_feature_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)'
                );
                Log::info('ComputePatientFeatureVectors: IVFFlat index created/verified');
            } catch (\Throwable $e) {
                Log::warning("ComputePatientFeatureVectors: IVFFlat index creation skipped — {$e->getMessage()}");
            }
        }

        // Step 5: Invalidate cache for this source
        DB::table('patient_similarity_cache')
            ->where('source_id', $source->id)
            ->delete();

        Log::info("ComputePatientFeatureVectors: completed for source {$source->source_name} — {$processed} patients");
    }

    public function failed(\Throwable $e): void
    {
        Log::error("ComputePatientFeatureVectors: failed for source {$this->source->id} — {$e->getMessage()}");
    }
}
```

Write to `backend/app/Jobs/ComputePatientFeatureVectors.php`.

- [ ] **Step 2: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/Jobs/ComputePatientFeatureVectors.php
git commit -m "feat: ComputePatientFeatureVectors Horizon job — batch extraction"
```

---

### Task 9: Controller + Form Requests + Routes

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php`
- Create: `backend/app/Http/Requests/PatientSimilaritySearchRequest.php`
- Create: `backend/app/Http/Requests/PatientSimilarityComputeRequest.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Create PatientSimilaritySearchRequest**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PatientSimilaritySearchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'person_id' => ['required', 'integer'],
            'source_id' => ['required', 'integer', 'exists:sources,id'],
            'mode' => ['sometimes', 'string', 'in:interpretable,embedding'],
            'weights' => ['sometimes', 'array'],
            'weights.*' => ['numeric', 'min:0', 'max:10'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'min_score' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'filters' => ['sometimes', 'array'],
            'filters.age_range' => ['sometimes', 'array', 'size:2'],
            'filters.age_range.*' => ['integer', 'min:0', 'max:150'],
            'filters.gender_concept_id' => ['sometimes', 'integer'],
        ];
    }
}
```

Write to `backend/app/Http/Requests/PatientSimilaritySearchRequest.php`.

- [ ] **Step 2: Create PatientSimilarityComputeRequest**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PatientSimilarityComputeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'source_id' => ['required', 'integer', 'exists:sources,id'],
            'force' => ['sometimes', 'boolean'],
        ];
    }
}
```

Write to `backend/app/Http/Requests/PatientSimilarityComputeRequest.php`.

- [ ] **Step 3: Create PatientSimilarityController**

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PatientSimilarityComputeRequest;
use App\Http\Requests\PatientSimilaritySearchRequest;
use App\Jobs\ComputePatientFeatureVectors;
use App\Models\App\SimilarityDimension;
use App\Models\App\Source;
use App\Services\PatientSimilarity\PatientSimilarityService;
use Illuminate\Http\JsonResponse;

class PatientSimilarityController extends Controller
{
    public function __construct(
        private readonly PatientSimilarityService $service,
    ) {}

    public function search(PatientSimilaritySearchRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $source = Source::findOrFail($validated['source_id']);

        // Build weights: use provided weights or fall back to dimension defaults
        $dimensions = SimilarityDimension::active()->get()->keyBy('key');
        $weights = [];
        foreach ($dimensions as $key => $dim) {
            $weights[$key] = $validated['weights'][$key] ?? $dim->default_weight;
        }

        $results = $this->service->search(
            personId: (int) $validated['person_id'],
            source: $source,
            mode: $validated['mode'] ?? 'interpretable',
            weights: $weights,
            limit: $validated['limit'] ?? 25,
            minScore: (float) ($validated['min_score'] ?? 0.0),
            filters: $validated['filters'] ?? [],
        );

        // Tiered access: redact person-level details unless user has profiles.view
        if (! $request->user()->can('profiles.view')) {
            $results['similar_patients'] = array_map(function ($patient) {
                return [
                    'overall_score' => $patient['overall_score'],
                    'dimension_scores' => $patient['dimension_scores'],
                ];
            }, $results['similar_patients']);
        }

        return response()->json($results);
    }

    public function dimensions(): JsonResponse
    {
        $dimensions = SimilarityDimension::active()->get();

        return response()->json(['dimensions' => $dimensions]);
    }

    public function compute(PatientSimilarityComputeRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $source = Source::findOrFail($validated['source_id']);
        $force = $validated['force'] ?? false;

        // Check if already recently computed
        $status = $this->service->getStatus($source);
        if (! $force && $status['patient_count'] > 0 && ! $status['staleness_warning']) {
            return response()->json([
                'status' => 'skipped',
                'message' => 'Feature vectors are still fresh. Use force=true to recompute.',
                'current_status' => $status,
            ]);
        }

        ComputePatientFeatureVectors::dispatch($source, $force);

        return response()->json([
            'status' => 'queued',
            'source_id' => $source->id,
            'source_name' => $source->source_name,
        ]);
    }

    public function status(int $sourceId): JsonResponse
    {
        $source = Source::findOrFail($sourceId);
        $status = $this->service->getStatus($source);

        return response()->json($status);
    }
}
```

Write to `backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php`.

- [ ] **Step 4: Add routes to api.php**

Add inside the existing `auth:sanctum` middleware group in `backend/routes/api.php`:

```php
        // Patient Similarity
        Route::prefix('patient-similarity')->group(function () {
            Route::post('/search', [PatientSimilarityController::class, 'search'])
                ->middleware(['permission:patient-similarity.view', 'throttle:30,1']);
            Route::get('/dimensions', [PatientSimilarityController::class, 'dimensions'])
                ->middleware('permission:patient-similarity.view');
            Route::get('/status/{sourceId}', [PatientSimilarityController::class, 'status'])
                ->middleware('permission:patient-similarity.view');
            Route::post('/compute', [PatientSimilarityController::class, 'compute'])
                ->middleware(['permission:patient-similarity.compute', 'throttle:5,60']);
        });
```

Add the controller import at the top of the file:
```php
use App\Http\Controllers\Api\V1\PatientSimilarityController;
```

- [ ] **Step 5: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 6: Verify routes**

Run: `docker compose exec php php artisan route:list --path=patient-similarity`
Expected: 4 routes listed with correct middleware.

- [ ] **Step 7: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php backend/app/Http/Requests/PatientSimilarity*.php backend/routes/api.php
git commit -m "feat: patient similarity API — search, dimensions, compute, status endpoints"
```

---

## Phase 2: Embedding Mode + ANN Search

### Task 10: Python Patient Embedding Service

**Files:**
- Create: `ai/app/services/patient_embeddings.py`
- Create: `ai/app/routers/patient_similarity.py`

- [ ] **Step 1: Create patient_embeddings service**

```python
"""Patient embedding service.

Generates 512-dimensional patient embeddings by aggregating SapBERT concept
embeddings across clinical dimensions.
"""

import logging
from typing import Any

import numpy as np

from app.services.sapbert import get_sapbert_service

logger = logging.getLogger(__name__)

# Target patient embedding dimension
PATIENT_EMBEDDING_DIM = 512

# Per-dimension allocation within the 512-dim vector
# demographics: 32, conditions: 128, measurements: 64, drugs: 128, procedures: 96, genomics: 64
DIMENSION_SLICES = {
    "demographics": (0, 32),
    "conditions": (32, 160),
    "measurements": (160, 224),
    "drugs": (224, 352),
    "procedures": (352, 448),
    "genomics": (448, 512),
}


def compute_patient_embedding(features: dict[str, Any]) -> list[float]:
    """Compute a 512-dim patient embedding from structured features.

    Each clinical dimension gets a slice of the embedding vector.
    Concept-based dimensions use mean-pooled SapBERT embeddings projected
    to their slice size. Numeric dimensions use direct encoding.
    """
    sapbert = get_sapbert_service()
    embedding = np.zeros(PATIENT_EMBEDDING_DIM, dtype=np.float32)

    # Demographics: encode as normalized numeric features
    start, end = DIMENSION_SLICES["demographics"]
    dim_size = end - start
    demo_vec = np.zeros(dim_size, dtype=np.float32)
    if features.get("age_bucket") is not None:
        demo_vec[0] = features["age_bucket"] / 20.0  # Normalize: max bucket ~20 (100 years)
    if features.get("gender_concept_id"):
        demo_vec[1] = 1.0 if features["gender_concept_id"] == 8507 else -1.0  # M=1, F=-1
    if features.get("race_concept_id"):
        # One-hot style encoding for top race concepts
        demo_vec[2 + (features["race_concept_id"] % (dim_size - 2))] = 1.0
    embedding[start:end] = demo_vec

    # Conditions: SapBERT embeddings of condition concept names
    start, end = DIMENSION_SLICES["conditions"]
    condition_concepts = features.get("condition_concepts", [])
    if condition_concepts:
        embedding[start:end] = _aggregate_concept_embeddings(
            sapbert, condition_concepts, end - start
        )

    # Measurements: z-scores as direct features
    start, end = DIMENSION_SLICES["measurements"]
    lab_vector = features.get("lab_vector", {})
    if lab_vector:
        dim_size = end - start
        lab_vec = np.zeros(dim_size, dtype=np.float32)
        for i, (_, z_score) in enumerate(sorted(lab_vector.items())):
            if i >= dim_size:
                break
            lab_vec[i] = np.clip(z_score, -5.0, 5.0) / 5.0  # Normalize to [-1, 1]
        embedding[start:end] = lab_vec

    # Drugs: SapBERT embeddings of drug concept names
    start, end = DIMENSION_SLICES["drugs"]
    drug_concepts = features.get("drug_concepts", [])
    if drug_concepts:
        embedding[start:end] = _aggregate_concept_embeddings(
            sapbert, drug_concepts, end - start
        )

    # Procedures: SapBERT embeddings of procedure concept names
    start, end = DIMENSION_SLICES["procedures"]
    procedure_concepts = features.get("procedure_concepts", [])
    if procedure_concepts:
        embedding[start:end] = _aggregate_concept_embeddings(
            sapbert, procedure_concepts, end - start
        )

    # Genomics: encode gene names via SapBERT
    start, end = DIMENSION_SLICES["genomics"]
    variant_genes = features.get("variant_genes", [])
    if variant_genes:
        gene_names = list({v["gene"] for v in variant_genes if v.get("gene")})
        if gene_names:
            embedding[start:end] = _aggregate_concept_embeddings(
                sapbert, gene_names, end - start, is_text=True
            )

    # L2 normalize the full vector
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    return embedding.tolist()


def _aggregate_concept_embeddings(
    sapbert: Any,
    concept_ids_or_names: list,
    target_dim: int,
    is_text: bool = False,
) -> np.ndarray:
    """Aggregate concept embeddings via mean pooling, then project to target dimension.

    If is_text=True, inputs are already text strings. Otherwise, they are concept IDs
    that need to be converted to strings for SapBERT encoding.
    """
    if is_text:
        texts = concept_ids_or_names[:50]  # Cap at 50 concepts per dimension
    else:
        # For concept IDs, encode as string — SapBERT will handle concept names
        # In production, look up concept_name from vocab. For now, encode ID as string.
        texts = [str(cid) for cid in concept_ids_or_names[:50]]

    if not texts:
        return np.zeros(target_dim, dtype=np.float32)

    # SapBERT returns 768-dim vectors
    raw_embeddings = sapbert.encode(texts)
    mean_embedding = np.mean(raw_embeddings, axis=0)  # 768-dim

    # Project to target dimension via truncation + normalization
    if len(mean_embedding) > target_dim:
        projected = mean_embedding[:target_dim]
    else:
        projected = np.zeros(target_dim, dtype=np.float32)
        projected[: len(mean_embedding)] = mean_embedding

    norm = np.linalg.norm(projected)
    if norm > 0:
        projected = projected / norm

    return projected.astype(np.float32)
```

Write to `ai/app/services/patient_embeddings.py`.

- [ ] **Step 2: Create patient_similarity router**

```python
"""Patient similarity embedding endpoints."""

import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.patient_embeddings import compute_patient_embedding

logger = logging.getLogger(__name__)
router = APIRouter()


class PatientFeatures(BaseModel):
    """Structured patient features for embedding generation."""

    person_id: int
    age_bucket: int | None = None
    gender_concept_id: int | None = None
    race_concept_id: int | None = None
    condition_concepts: list[int] = []
    lab_vector: dict[str, float] = {}
    drug_concepts: list[int] = []
    procedure_concepts: list[int] = []
    variant_genes: list[dict[str, str]] = []


class EmbeddingResponse(BaseModel):
    """Response with computed patient embedding."""

    person_id: int
    embedding: list[float]
    dimension: int


class BatchEmbeddingRequest(BaseModel):
    """Batch embedding request."""

    patients: list[PatientFeatures]


class BatchEmbeddingResponse(BaseModel):
    """Batch embedding response."""

    embeddings: list[EmbeddingResponse]
    count: int


@router.post("/patient-similarity/embed", response_model=EmbeddingResponse)
async def embed_patient(features: PatientFeatures) -> dict[str, Any]:
    """Generate a 512-dim embedding for a single patient."""
    embedding = compute_patient_embedding(features.model_dump())
    return {
        "person_id": features.person_id,
        "embedding": embedding,
        "dimension": len(embedding),
    }


@router.post("/patient-similarity/embed-batch", response_model=BatchEmbeddingResponse)
async def embed_batch(request: BatchEmbeddingRequest) -> dict[str, Any]:
    """Generate embeddings for a batch of patients."""
    results = []
    for patient in request.patients:
        embedding = compute_patient_embedding(patient.model_dump())
        results.append({
            "person_id": patient.person_id,
            "embedding": embedding,
            "dimension": len(embedding),
        })

    return {
        "embeddings": results,
        "count": len(results),
    }
```

Write to `ai/app/routers/patient_similarity.py`.

- [ ] **Step 3: Register router in FastAPI app**

Find the main FastAPI app file (likely `ai/app/main.py`) and add:

```python
from app.routers import patient_similarity
app.include_router(patient_similarity.router, tags=["patient-similarity"])
```

Follow the existing pattern for how other routers are included.

- [ ] **Step 4: Commit**

```bash
git add ai/app/services/patient_embeddings.py ai/app/routers/patient_similarity.py ai/app/main.py
git commit -m "feat: Python patient embedding service — SapBERT aggregation to 512-dim vectors"
```

---

### Task 11: Embedding Client + ANN Search in Laravel

**Files:**
- Create: `backend/app/Services/PatientSimilarity/EmbeddingClient.php`
- Modify: `backend/app/Services/PatientSimilarity/PatientSimilarityService.php`
- Modify: `backend/app/Jobs/ComputePatientFeatureVectors.php`

- [ ] **Step 1: Create EmbeddingClient**

```php
<?php

namespace App\Services\PatientSimilarity;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EmbeddingClient
{
    private string $baseUrl;

    public function __construct()
    {
        $this->baseUrl = config('services.ai.url', 'http://python-ai:8000');
    }

    /**
     * Generate embedding for a single patient.
     *
     * @return float[]|null  512-dim vector or null on failure
     */
    public function embed(array $features): ?array
    {
        try {
            $response = Http::timeout(30)->post("{$this->baseUrl}/patient-similarity/embed", $features);

            if ($response->successful()) {
                return $response->json('embedding');
            }

            Log::warning("EmbeddingClient: embed failed — {$response->status()}");

            return null;
        } catch (\Throwable $e) {
            Log::warning("EmbeddingClient: embed error — {$e->getMessage()}");

            return null;
        }
    }

    /**
     * Generate embeddings for a batch of patients.
     *
     * @param  array[]  $patientFeatures
     * @return array<int, float[]>  person_id → embedding
     */
    public function embedBatch(array $patientFeatures): array
    {
        try {
            $response = Http::timeout(120)->post("{$this->baseUrl}/patient-similarity/embed-batch", [
                'patients' => $patientFeatures,
            ]);

            if (! $response->successful()) {
                Log::warning("EmbeddingClient: batch embed failed — {$response->status()}");

                return [];
            }

            $results = [];
            foreach ($response->json('embeddings', []) as $item) {
                $results[(int) $item['person_id']] = $item['embedding'];
            }

            return $results;
        } catch (\Throwable $e) {
            Log::warning("EmbeddingClient: batch embed error — {$e->getMessage()}");

            return [];
        }
    }
}
```

Write to `backend/app/Services/PatientSimilarity/EmbeddingClient.php`.

- [ ] **Step 2: Update PatientSimilarityService::searchEmbedding**

Replace the `searchEmbedding` method in `PatientSimilarityService.php`:

```php
    private function searchEmbedding(
        PatientFeatureVector $seed,
        Source $source,
        array $weights,
        int $limit,
        float $minScore,
        array $filters,
    ): array {
        $seedData = $seed->toArray();

        // Stage 1: ANN candidate retrieval via pgvector
        $embeddingStr = $seed->getRawOriginal('embedding');
        if (! $embeddingStr) {
            // No embedding available — fall back to interpretable
            return $this->searchInterpretable($seed, $source, $weights, $limit, $minScore, $filters);
        }

        $candidateLimit = min(200, max($limit * 4, 100));

        $query = "SELECT person_id, 1 - (embedding <=> ?::vector) AS cosine_similarity
                  FROM patient_feature_vectors
                  WHERE source_id = ?
                    AND person_id != ?
                    AND embedding IS NOT NULL";
        $params = [$embeddingStr, $source->id, $seed->person_id];

        if (! empty($filters['gender_concept_id'])) {
            $query .= ' AND gender_concept_id = ?';
            $params[] = $filters['gender_concept_id'];
        }
        if (! empty($filters['age_range'])) {
            $query .= ' AND age_bucket BETWEEN ? AND ?';
            $params[] = intdiv((int) $filters['age_range'][0], 5);
            $params[] = intdiv((int) $filters['age_range'][1], 5);
        }

        $query .= " ORDER BY embedding <=> ?::vector LIMIT ?";
        $params[] = $embeddingStr;
        $params[] = $candidateLimit;

        $candidateRows = \Illuminate\Support\Facades\DB::select($query, $params);

        // Stage 2: Re-rank with interpretable scorers
        $candidateIds = array_map(fn ($r) => (int) $r->person_id, $candidateRows);

        $candidates = PatientFeatureVector::where('source_id', $source->id)
            ->whereIn('person_id', $candidateIds)
            ->get()
            ->keyBy('person_id');

        $scored = [];
        foreach ($candidates as $candidate) {
            $result = $this->scorePatientPair($seedData, $candidate->toArray(), $weights);
            if ($result['overall_score'] >= $minScore) {
                $scored[] = array_merge($result, [
                    'person_id' => $candidate->person_id,
                ]);
            }
        }

        usort($scored, fn ($a, $b) => $b['overall_score'] <=> $a['overall_score']);
        $scored = array_slice($scored, 0, $limit);

        return [
            'seed' => [
                'person_id' => $seed->person_id,
                'age_bucket' => $seed->age_bucket,
                'gender_concept_id' => $seed->gender_concept_id,
                'condition_count' => $seed->condition_count,
                'lab_count' => $seed->lab_count,
                'dimensions_available' => $seed->dimensions_available,
            ],
            'mode' => 'embedding',
            'similar_patients' => $scored,
            'metadata' => [
                'candidates_evaluated' => count($candidateRows),
                'dimensions_used' => array_keys($weights),
            ],
        ];
    }
```

- [ ] **Step 3: Update ComputePatientFeatureVectors to generate embeddings**

In `ComputePatientFeatureVectors.php`, update the `handle` method signature to also inject `EmbeddingClient`:

```php
    public function handle(SimilarityFeatureExtractor $extractor, EmbeddingClient $embeddingClient): void
```

After the existing batch loop that stores feature vectors, add embedding generation:

```php
            // Generate embeddings for this batch
            $batchForEmbedding = [];
            foreach ($features as $pid => $data) {
                $batchForEmbedding[] = array_merge($data, ['person_id' => $pid]);
            }

            $embeddings = $embeddingClient->embedBatch($batchForEmbedding);
            foreach ($embeddings as $pid => $embedding) {
                $embeddingStr = '[' . implode(',', $embedding) . ']';
                DB::statement(
                    'UPDATE patient_feature_vectors SET embedding = ?::vector WHERE source_id = ? AND person_id = ?',
                    [$embeddingStr, $source->id, $pid]
                );
            }
```

- [ ] **Step 4: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/PatientSimilarity/EmbeddingClient.php backend/app/Services/PatientSimilarity/PatientSimilarityService.php backend/app/Jobs/ComputePatientFeatureVectors.php
git commit -m "feat: embedding mode — ANN search via pgvector + EmbeddingClient"
```

---

## Phase 3: Frontend

### Task 12: TypeScript Types + API Client + Hooks

**Files:**
- Create: `frontend/src/features/patient-similarity/types/patientSimilarity.ts`
- Create: `frontend/src/features/patient-similarity/api/patientSimilarityApi.ts`
- Create: `frontend/src/features/patient-similarity/hooks/usePatientSimilarity.ts`

- [ ] **Step 1: Create types**

```typescript
export interface SimilarityDimension {
  id: number;
  key: string;
  name: string;
  description: string | null;
  default_weight: number;
  is_active: boolean;
  config: Record<string, unknown> | null;
}

export interface DimensionScores {
  demographics: number | null;
  conditions: number | null;
  measurements: number | null;
  drugs: number | null;
  procedures: number | null;
  genomics: number | null;
}

export interface SimilarPatient {
  person_id?: number;
  overall_score: number;
  dimension_scores: DimensionScores;
  shared_conditions?: string[];
  shared_drugs?: string[];
  shared_variants?: string[];
  demographics?: {
    age: number;
    gender: string;
  };
}

export interface SeedPatient {
  person_id: number;
  age_bucket: number | null;
  gender_concept_id: number | null;
  condition_count: number;
  lab_count: number;
  dimensions_available: string[];
}

export interface SimilaritySearchResult {
  seed: SeedPatient | null;
  mode: "interpretable" | "embedding";
  similar_patients: SimilarPatient[];
  cohort_outcomes?: {
    n_patients: number;
    median_survival_days: number | null;
    event_rate: number | null;
    treatment_patterns: unknown[];
  };
  metadata: {
    computed_in_ms?: number;
    candidates_evaluated?: number;
    dimensions_used?: string[];
    error?: string;
  };
}

export interface SimilaritySearchParams {
  person_id: number;
  source_id: number;
  mode?: "interpretable" | "embedding";
  weights?: Partial<Record<string, number>>;
  limit?: number;
  min_score?: number;
  filters?: {
    age_range?: [number, number];
    gender_concept_id?: number;
  };
}

export interface ComputeStatus {
  source_id: number;
  patient_count: number;
  last_computed_at: string | null;
  staleness_warning: boolean;
  days_since_compute: number | null;
}
```

Write to `frontend/src/features/patient-similarity/types/patientSimilarity.ts`.

- [ ] **Step 2: Create API client**

```typescript
import apiClient from "@/lib/api-client";
import type {
  ComputeStatus,
  SimilarityDimension,
  SimilaritySearchParams,
  SimilaritySearchResult,
} from "../types/patientSimilarity";

export async function searchSimilarPatients(
  params: SimilaritySearchParams,
): Promise<SimilaritySearchResult> {
  const { data } = await apiClient.post<SimilaritySearchResult>(
    "/patient-similarity/search",
    params,
  );
  return data;
}

export async function fetchDimensions(): Promise<SimilarityDimension[]> {
  const { data } = await apiClient.get<{ dimensions: SimilarityDimension[] }>(
    "/patient-similarity/dimensions",
  );
  return data.dimensions;
}

export async function fetchComputeStatus(
  sourceId: number,
): Promise<ComputeStatus> {
  const { data } = await apiClient.get<ComputeStatus>(
    `/patient-similarity/status/${sourceId}`,
  );
  return data;
}

export async function triggerCompute(
  sourceId: number,
  force: boolean = false,
): Promise<{ status: string; message?: string }> {
  const { data } = await apiClient.post("/patient-similarity/compute", {
    source_id: sourceId,
    force,
  });
  return data;
}
```

Write to `frontend/src/features/patient-similarity/api/patientSimilarityApi.ts`.

- [ ] **Step 3: Create hooks**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchComputeStatus,
  fetchDimensions,
  searchSimilarPatients,
  triggerCompute,
} from "../api/patientSimilarityApi";
import type { SimilaritySearchParams } from "../types/patientSimilarity";

export const SIMILARITY_KEYS = {
  dimensions: ["patient-similarity", "dimensions"] as const,
  status: (sourceId: number) =>
    ["patient-similarity", "status", sourceId] as const,
  search: (params: SimilaritySearchParams) =>
    ["patient-similarity", "search", params] as const,
};

export function useSimilarityDimensions() {
  return useQuery({
    queryKey: SIMILARITY_KEYS.dimensions,
    queryFn: fetchDimensions,
    staleTime: 60 * 60 * 1000,
  });
}

export function useComputeStatus(sourceId: number) {
  return useQuery({
    queryKey: SIMILARITY_KEYS.status(sourceId),
    queryFn: () => fetchComputeStatus(sourceId),
    enabled: sourceId > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSimilaritySearch() {
  return useMutation({
    mutationFn: searchSimilarPatients,
  });
}

export function useTriggerCompute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceId,
      force,
    }: {
      sourceId: number;
      force?: boolean;
    }) => triggerCompute(sourceId, force),
    onSuccess: (_data, { sourceId }) => {
      qc.invalidateQueries({
        queryKey: SIMILARITY_KEYS.status(sourceId),
      });
    },
  });
}
```

Write to `frontend/src/features/patient-similarity/hooks/usePatientSimilarity.ts`.

- [ ] **Step 4: Verify TypeScript**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: No errors related to patient-similarity files.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/patient-similarity/
git commit -m "feat: patient similarity types, API client, and React Query hooks"
```

---

### Task 13: Core UI Components

**Files:**
- Create: `frontend/src/features/patient-similarity/components/DimensionScoreBar.tsx`
- Create: `frontend/src/features/patient-similarity/components/SimilarityModeToggle.tsx`
- Create: `frontend/src/features/patient-similarity/components/StalenessIndicator.tsx`
- Create: `frontend/src/features/patient-similarity/components/SimilaritySearchForm.tsx`
- Create: `frontend/src/features/patient-similarity/components/SimilarPatientTable.tsx`

These are the building blocks for the main page. Implement each component following the dark clinical theme (#0E0E11 base, #9B1B30 crimson, #C9A227 gold, #2DD4BF teal) and existing Parthenon component patterns. Use Tailwind CSS classes.

The components should:

- `DimensionScoreBar` — renders a small horizontal bar with color based on score (teal >0.7, gold >0.4, grey otherwise). Props: `score: number | null, label: string`.
- `SimilarityModeToggle` — toggle between "Interpretable" and "Embedding" modes. Props: `mode: string, onChange: (mode) => void`.
- `StalenessIndicator` — shows last computed date and warning if stale. Uses `useComputeStatus` hook. Props: `sourceId: number`.
- `SimilaritySearchForm` — left panel: mode toggle, source selector, patient ID input, dimension weight sliders (range 0-5, step 0.5), age/gender filters, search button. Uses `useSimilarityDimensions` for slider labels/defaults.
- `SimilarPatientTable` — results table with rank, overall score, patient summary, per-dimension score bars, compare link. Props: `patients: SimilarPatient[], showPersonId: boolean` (tiered access).

Each component should be in its own file. Follow the existing pattern in `frontend/src/features/risk-scores/components/` for styling conventions.

- [ ] **Step 1: Implement all 5 components** (one file each, following the patterns described above)

- [ ] **Step 2: Verify TypeScript**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patient-similarity/components/
git commit -m "feat: patient similarity UI components — score bars, search form, results table"
```

---

### Task 14: Main Page + Router + Sidebar

**Files:**
- Create: `frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create PatientSimilarityPage**

This is the main page that composes `SimilaritySearchForm`, `SimilarPatientTable`, `StalenessIndicator`, and `SimilarityModeToggle`. Layout: search form on the left (320px sidebar), results on the right. Uses `useSimilaritySearch` mutation. Reads query params for pre-filled context (`person_id`, `source_id`, `weights[genomics]`).

Uses `useAuthStore` to check `profiles.view` permission for tiered access on results display.

Export as `default` (required for lazy loading in router).

- [ ] **Step 2: Add route to router.tsx**

In `frontend/src/app/router.tsx`, add inside the protected layout children, after the existing `risk-scores` route:

```tsx
      {
        path: "patient-similarity",
        lazy: () =>
          import(
            "@/features/patient-similarity/pages/PatientSimilarityPage"
          ).then((m) => ({ Component: m.default })),
      },
```

- [ ] **Step 3: Add sidebar entry**

In `frontend/src/components/layout/Sidebar.tsx`, add `UsersRound` icon usage (already imported) and add to the "Evidence" nav group children:

```typescript
      { path: "/patient-similarity", label: "Patient Similarity", icon: UsersRound },
```

Add it after the "Patient Profiles" entry in the Evidence children array.

- [ ] **Step 4: Verify TypeScript and build**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Run: `docker compose exec node sh -c "cd /app && npx vite build"`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/patient-similarity/pages/ frontend/src/app/router.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: patient similarity page, route, and sidebar navigation"
```

---

## Phase 4: Cohort Integration

### Task 15: Cohort Export + Seed from Cohort

**Files:**
- Create: `backend/app/Http/Requests/PatientSimilarityExportCohortRequest.php`
- Create: `backend/app/Services/PatientSimilarity/CohortCentroidBuilder.php`
- Modify: `backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Create PatientSimilarityExportCohortRequest**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PatientSimilarityExportCohortRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'cache_id' => ['required', 'integer', 'exists:patient_similarity_cache,id'],
            'min_score' => ['sometimes', 'numeric', 'min:0', 'max:1'],
            'cohort_name' => ['required', 'string', 'max:255'],
            'cohort_description' => ['nullable', 'string'],
        ];
    }
}
```

Write to `backend/app/Http/Requests/PatientSimilarityExportCohortRequest.php`.

- [ ] **Step 2: Create CohortCentroidBuilder**

```php
<?php

namespace App\Services\PatientSimilarity;

use App\Models\App\PatientFeatureVector;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;

class CohortCentroidBuilder
{
    /**
     * Build a virtual "centroid patient" from a cohort's member feature vectors.
     *
     * @param  int[]  $personIds  Cohort member person_ids
     * @return array  Feature vector data representing the cohort centroid
     */
    public function buildCentroid(array $personIds, Source $source): array
    {
        $members = PatientFeatureVector::where('source_id', $source->id)
            ->whereIn('person_id', $personIds)
            ->get();

        if ($members->isEmpty()) {
            return [];
        }

        // Demographics: median age bucket, mode gender/race
        $ageBuckets = $members->pluck('age_bucket')->filter()->values();
        $genders = $members->pluck('gender_concept_id')->filter()->countBy();
        $races = $members->pluck('race_concept_id')->filter()->countBy();

        // Conditions: union of all member conditions
        $allConditions = [];
        foreach ($members as $m) {
            $allConditions = array_merge($allConditions, $m->condition_concepts ?? []);
        }

        // Drugs: union of all member drugs
        $allDrugs = [];
        foreach ($members as $m) {
            $allDrugs = array_merge($allDrugs, $m->drug_concepts ?? []);
        }

        // Procedures: union of all member procedures
        $allProcedures = [];
        foreach ($members as $m) {
            $allProcedures = array_merge($allProcedures, $m->procedure_concepts ?? []);
        }

        // Labs: mean of z-scores per measurement type
        $labSums = [];
        $labCounts = [];
        foreach ($members as $m) {
            foreach ($m->lab_vector ?? [] as $conceptId => $zScore) {
                $labSums[$conceptId] = ($labSums[$conceptId] ?? 0) + $zScore;
                $labCounts[$conceptId] = ($labCounts[$conceptId] ?? 0) + 1;
            }
        }
        $labVector = [];
        foreach ($labSums as $conceptId => $sum) {
            $labVector[$conceptId] = round($sum / $labCounts[$conceptId], 4);
        }

        // Genomics: union of all variant genes
        $allVariants = [];
        foreach ($members as $m) {
            $allVariants = array_merge($allVariants, $m->variant_genes ?? []);
        }

        // Determine available dimensions
        $dims = ['demographics'];
        if (! empty($allConditions)) {
            $dims[] = 'conditions';
        }
        if (! empty($labVector)) {
            $dims[] = 'measurements';
        }
        if (! empty($allDrugs)) {
            $dims[] = 'drugs';
        }
        if (! empty($allProcedures)) {
            $dims[] = 'procedures';
        }
        if (! empty($allVariants)) {
            $dims[] = 'genomics';
        }

        return [
            'person_id' => 0, // Virtual patient
            'age_bucket' => $ageBuckets->isNotEmpty() ? (int) $ageBuckets->median() : null,
            'gender_concept_id' => $genders->isNotEmpty() ? $genders->sortDesc()->keys()->first() : null,
            'race_concept_id' => $races->isNotEmpty() ? $races->sortDesc()->keys()->first() : null,
            'condition_concepts' => array_values(array_unique($allConditions)),
            'lab_vector' => $labVector,
            'drug_concepts' => array_values(array_unique($allDrugs)),
            'procedure_concepts' => array_values(array_unique($allProcedures)),
            'variant_genes' => $allVariants,
            'dimensions_available' => $dims,
        ];
    }

    /**
     * Compute centroid embedding by averaging member embeddings.
     *
     * @param  int[]  $personIds
     * @return string|null  pgvector-formatted embedding string, or null if no embeddings
     */
    public function buildCentroidEmbedding(array $personIds, Source $source): ?string
    {
        $result = DB::selectOne(
            "SELECT AVG(embedding)::text AS centroid
             FROM patient_feature_vectors
             WHERE source_id = ?
               AND person_id = ANY(?::bigint[])
               AND embedding IS NOT NULL",
            [$source->id, '{' . implode(',', $personIds) . '}']
        );

        return $result?->centroid;
    }
}
```

Write to `backend/app/Services/PatientSimilarity/CohortCentroidBuilder.php`.

- [ ] **Step 3: Add searchFromCohort and exportCohort methods to controller**

Add to `PatientSimilarityController.php`:

```php
    public function searchFromCohort(PatientSimilaritySearchRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $source = Source::findOrFail($validated['source_id']);
        $cohortDefinitionId = (int) $validated['cohort_definition_id'];

        // Get cohort member person_ids from results schema
        $resultsSchema = $source->getTableQualifier(\App\Enums\DaimonType::Results);
        $memberIds = \Illuminate\Support\Facades\DB::connection($source->source_connection)
            ->table(DB::raw("{$resultsSchema}.cohort"))
            ->where('cohort_definition_id', $cohortDefinitionId)
            ->pluck('subject_id')
            ->map(fn ($id) => (int) $id)
            ->toArray();

        if (empty($memberIds)) {
            return response()->json(['error' => 'Cohort has no members'], 404);
        }

        $centroidBuilder = app(CohortCentroidBuilder::class);
        $centroid = $centroidBuilder->buildCentroid($memberIds, $source);

        if (empty($centroid)) {
            return response()->json(['error' => 'No feature vectors for cohort members. Run compute first.'], 404);
        }

        // Build weights
        $dimensions = SimilarityDimension::active()->get()->keyBy('key');
        $weights = [];
        foreach ($dimensions as $key => $dim) {
            $weights[$key] = $validated['weights'][$key] ?? $dim->default_weight;
        }

        // Use the centroid as a virtual seed patient for scoring
        $results = $this->service->searchFromCentroid(
            centroid: $centroid,
            excludePersonIds: $memberIds,
            source: $source,
            mode: $validated['mode'] ?? 'interpretable',
            weights: $weights,
            limit: $validated['limit'] ?? 25,
            minScore: (float) ($validated['min_score'] ?? 0.0),
            filters: $validated['filters'] ?? [],
        );

        return response()->json($results);
    }

    public function exportCohort(PatientSimilarityExportCohortRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $cache = \App\Models\App\PatientSimilarityCache::findOrFail($validated['cache_id']);
        $minScore = (float) ($validated['min_score'] ?? 0.0);

        $personIds = collect($cache->results['similar_patients'] ?? [])
            ->filter(fn ($p) => ($p['overall_score'] ?? 0) >= $minScore)
            ->pluck('person_id')
            ->filter()
            ->values()
            ->toArray();

        if (empty($personIds)) {
            return response()->json(['error' => 'No patients meet the score threshold'], 422);
        }

        // Create cohort definition and insert members
        $cohort = \App\Models\App\CohortDefinition::create([
            'name' => $validated['cohort_name'],
            'description' => $validated['cohort_description'] ?? "Generated from patient similarity search (n={count($personIds)})",
            'created_by' => $request->user()->id,
            'expression_type' => 'similarity',
        ]);

        $resultsConnection = config('database.connections.results.schema', 'results');
        $inserts = array_map(fn ($pid) => [
            'cohort_definition_id' => $cohort->id,
            'subject_id' => $pid,
            'cohort_start_date' => now()->toDateString(),
            'cohort_end_date' => now()->toDateString(),
        ], $personIds);

        \Illuminate\Support\Facades\DB::connection('results')->table('cohort')->insert($inserts);

        return response()->json([
            'cohort_definition_id' => $cohort->id,
            'patient_count' => count($personIds),
        ]);
    }
```

Also add `searchFromCentroid` method to `PatientSimilarityService` — similar to `searchInterpretable` but takes a centroid array instead of a `PatientFeatureVector` model, and excludes the cohort member person_ids from results.

- [ ] **Step 4: Add routes**

Add to the patient-similarity route group in `api.php`:

```php
            Route::post('/search-from-cohort', [PatientSimilarityController::class, 'searchFromCohort'])
                ->middleware(['permission:patient-similarity.view', 'permission:cohorts.view', 'throttle:30,1']);
            Route::post('/export-cohort', [PatientSimilarityController::class, 'exportCohort'])
                ->middleware(['permission:patient-similarity.view', 'permission:cohorts.create']);
            Route::get('/compare', [PatientSimilarityController::class, 'compare'])
                ->middleware(['permission:patient-similarity.view', 'permission:profiles.view']);
```

- [ ] **Step 5: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 6: Verify routes**

Run: `docker compose exec php php artisan route:list --path=patient-similarity`
Expected: 7 routes listed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/Services/PatientSimilarity/CohortCentroidBuilder.php backend/app/Http/Requests/PatientSimilarityExportCohortRequest.php backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php backend/app/Services/PatientSimilarity/PatientSimilarityService.php backend/routes/api.php
git commit -m "feat: cohort integration — search from cohort centroid + export as cohort"
```

---

### Task 16: Frontend Cohort Integration Components

**Files:**
- Create: `frontend/src/features/patient-similarity/components/CohortExportDialog.tsx`
- Create: `frontend/src/features/patient-similarity/components/CohortSeedForm.tsx`
- Modify: `frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx`
- Modify: `frontend/src/features/patient-similarity/api/patientSimilarityApi.ts`
- Modify: `frontend/src/features/patient-similarity/hooks/usePatientSimilarity.ts`

- [ ] **Step 1: Add API functions for cohort endpoints**

Add to `patientSimilarityApi.ts`:

```typescript
export async function searchFromCohort(params: {
  cohort_definition_id: number;
  source_id: number;
  mode?: "interpretable" | "embedding";
  weights?: Partial<Record<string, number>>;
  limit?: number;
  min_score?: number;
  strategy?: "centroid" | "exemplar";
}): Promise<SimilaritySearchResult> {
  const { data } = await apiClient.post<SimilaritySearchResult>(
    "/patient-similarity/search-from-cohort",
    params,
  );
  return data;
}

export async function exportCohort(params: {
  cache_id: number;
  min_score?: number;
  cohort_name: string;
  cohort_description?: string;
}): Promise<{ cohort_definition_id: number; patient_count: number }> {
  const { data } = await apiClient.post("/patient-similarity/export-cohort", params);
  return data;
}
```

- [ ] **Step 2: Add hooks**

Add to `usePatientSimilarity.ts`:

```typescript
export function useCohortSimilaritySearch() {
  return useMutation({
    mutationFn: searchFromCohort,
  });
}

export function useExportCohort() {
  return useMutation({
    mutationFn: exportCohort,
  });
}
```

- [ ] **Step 3: Implement CohortExportDialog and CohortSeedForm**

`CohortExportDialog`: Modal dialog with cohort name input, description textarea, min_score slider, patient count preview, and "Export" button. Uses `useExportCohort` mutation.

`CohortSeedForm`: Dropdown to select an existing cohort definition (fetched via existing cohort API), strategy toggle (centroid/exemplar). Replaces the patient ID input when "From Cohort" mode is selected in the search form.

- [ ] **Step 4: Update PatientSimilarityPage to support cohort mode**

Add search mode toggle (Single Patient / From Cohort) that swaps between patient ID input and CohortSeedForm. Add "Export as Cohort" button in results header that opens CohortExportDialog.

- [ ] **Step 5: Verify TypeScript and build**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Run: `docker compose exec node sh -c "cd /app && npx vite build"`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/patient-similarity/
git commit -m "feat: cohort integration UI — export dialog and seed from cohort"
```

---

### Task 17: Comparison Page

**Files:**
- Create: `frontend/src/features/patient-similarity/pages/PatientComparisonPage.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php`

- [ ] **Step 1: Add compare endpoint to controller**

Add `compare` method to `PatientSimilarityController`:

```php
    public function compare(\Illuminate\Http\Request $request): JsonResponse
    {
        $request->validate([
            'person_a' => 'required|integer',
            'person_b' => 'required|integer',
            'source_id' => 'required|integer|exists:sources,id',
        ]);

        $source = Source::findOrFail($request->source_id);

        $vectorA = PatientFeatureVector::where('source_id', $source->id)
            ->where('person_id', $request->person_a)
            ->firstOrFail();

        $vectorB = PatientFeatureVector::where('source_id', $source->id)
            ->where('person_id', $request->person_b)
            ->firstOrFail();

        $dimensions = SimilarityDimension::active()->get()->keyBy('key');
        $weights = [];
        foreach ($dimensions as $key => $dim) {
            $weights[$key] = $dim->default_weight;
        }

        $scores = $this->service->scorePatientPair($vectorA->toArray(), $vectorB->toArray(), $weights);

        // Compute shared/different features
        $sharedConditions = array_values(array_intersect(
            $vectorA->condition_concepts ?? [],
            $vectorB->condition_concepts ?? [],
        ));
        $sharedDrugs = array_values(array_intersect(
            $vectorA->drug_concepts ?? [],
            $vectorB->drug_concepts ?? [],
        ));

        return response()->json([
            'patient_a' => $vectorA->toArray(),
            'patient_b' => $vectorB->toArray(),
            'scores' => $scores,
            'shared' => [
                'condition_count' => count($sharedConditions),
                'drug_count' => count($sharedDrugs),
            ],
        ]);
    }
```

Add the `use App\Models\App\PatientFeatureVector;` import.

- [ ] **Step 2: Create PatientComparisonPage**

Side-by-side view showing two patients' feature summaries with shared/different features highlighted. Uses dimension score bars for each dimension. Link back to search results. Route: `/patient-similarity/compare?person_a=X&person_b=Y&source_id=Z`.

Export as `default`.

- [ ] **Step 3: Add route to router.tsx**

```tsx
      {
        path: "patient-similarity/compare",
        lazy: () =>
          import(
            "@/features/patient-similarity/pages/PatientComparisonPage"
          ).then((m) => ({ Component: m.default })),
      },
```

- [ ] **Step 4: Run Pint, TypeScript, and build**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`
Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Run: `docker compose exec node sh -c "cd /app && npx vite build"`

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php frontend/src/features/patient-similarity/pages/PatientComparisonPage.tsx frontend/src/app/router.tsx
git commit -m "feat: patient comparison page — side-by-side feature comparison"
```

---

## Validation

### Task 18: End-to-End Validation

- [ ] **Step 1: Run feature vector computation on SynPUF**

Use the API or artisan tinker to dispatch the job:
```bash
docker compose exec php php artisan tinker --execute="
  \$source = \App\Models\App\Source::where('source_key', 'synpuf')->first();
  \App\Jobs\ComputePatientFeatureVectors::dispatch(\$source);
"
```

Monitor Horizon dashboard. Expect ~2.3M patients processed over 30-60 minutes.

- [ ] **Step 2: Run feature vector computation on Pancreas**

```bash
docker compose exec php php artisan tinker --execute="
  \$source = \App\Models\App\Source::where('source_key', 'pancreas')->first();
  \App\Jobs\ComputePatientFeatureVectors::dispatch(\$source);
"
```

Expect ~361 patients processed in under 1 minute.

- [ ] **Step 3: Test interpretable search**

```bash
curl -X POST http://localhost:8082/api/v1/patient-similarity/search \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "person_id": 1,
    "source_id": <synpuf_source_id>,
    "mode": "interpretable",
    "limit": 10
  }'
```

Expected: 10 similar patients with per-dimension score breakdowns.

- [ ] **Step 4: Verify missing dimension handling on SynPUF**

SynPUF has no genomic data. Confirm that `genomics` dimension shows `null` in dimension_scores and doesn't penalize the overall score.

- [ ] **Step 5: Verify multi-modal scoring on Pancreas**

Pancreas has genomic data. Search with `weights.genomics: 3.0` and confirm genomic dimension scores appear.

- [ ] **Step 6: Test staleness indicator**

```bash
curl http://localhost:8082/api/v1/patient-similarity/status/<source_id> \
  -H "Authorization: Bearer <token>"
```

Expected: `patient_count > 0`, `staleness_warning: false`, `last_computed_at` is recent.

- [ ] **Step 7: Commit validation results as devlog**

```bash
git commit --allow-empty -m "test: patient similarity engine validated on SynPUF + Pancreas"
```
