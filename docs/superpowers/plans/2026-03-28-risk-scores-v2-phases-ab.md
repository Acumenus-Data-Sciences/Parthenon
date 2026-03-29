# Risk Scores v2 — Phases A+B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cohort-scoped, recommendation-driven risk score engine with vocab-validated concepts, patient-level persistence, and Charlson CCI as the proof-of-concept migrated score.

**Architecture:** New `RiskScoreAnalysis` model + polymorphic `AnalysisExecution` (same pattern as Characterization). `ConceptResolutionService` for runtime vocab lookups. `PatientFeatureExtractor` for bulk CDM data extraction. `RiskScoreRecommendationService` profiles a cohort and recommends applicable scores. `RiskScoreExecutionService` runs selected scores scoped to a target cohort. Charlson CCI migrated to v2 interface as proof of concept.

**Tech Stack:** Laravel 11, PHP 8.4, PostgreSQL 17, OMOP CDM v5.4

**Spec:** `docs/superpowers/specs/2026-03-28-risk-scores-v2-design.md`

---

## File Structure

### Phase A: Core Infrastructure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/database/migrations/2026_03_28_300000_create_risk_score_v2_tables.php` | 3 new tables: risk_score_analyses, risk_score_patient_results, risk_score_run_steps |
| Create | `backend/app/Models/App/RiskScoreAnalysis.php` | Eloquent model with design_json cast, morphMany executions |
| Create | `backend/app/Models/App/RiskScoreRunStep.php` | Per-score execution step tracking |
| Create | `backend/app/Models/Results/RiskScorePatientResult.php` | Patient-level score results |
| Create | `backend/app/Contracts/PopulationRiskScoreV2Interface.php` | v2 interface with eligibilityCriteria, conditionGroups, compute() |
| Create | `backend/app/Services/PopulationRisk/ConceptResolutionService.php` | Runtime vocab.concept + concept_ancestor lookups |
| Create | `backend/app/Services/PopulationRisk/PatientFeatureExtractor.php` | Bulk feature extraction from CDM tables for a cohort |

### Phase B: Recommendation + Execution + Charlson Migration

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/app/Services/PopulationRisk/RiskScoreRecommendationService.php` | Profile cohort, match scores, return ranked recommendations |
| Create | `backend/app/Services/PopulationRisk/RiskScoreExecutionService.php` | Cohort-scoped execution with patient-level persistence |
| Create | `backend/app/Services/PopulationRisk/V2Scores/RS005CharlsonV2.php` | Charlson CCI rewritten to v2 interface |
| Create | `backend/app/Http/Controllers/Api/V1/RiskScoreAnalysisController.php` | CRUD + recommend + execute endpoints |
| Modify | `backend/routes/api.php` | Add v2 routes |
| Modify | `backend/app/Providers/PopulationRiskServiceProvider.php` | Register v2 services |

---

## Validated OMOP Concept Reference

All concept IDs verified against `vocab.concept` on 2026-03-28:

### Charlson CCI Condition Groups

| Group | Weight | Ancestor concept_id | Verified concept_name |
|-------|--------|---------------------|----------------------|
| MI | 1 | 4329847 | Myocardial infarction |
| CHF | 1 | 319835 | Congestive heart failure |
| PVD | 1 | 321052 | Peripheral vascular disease |
| CVD | 1 | 381591 | Cerebrovascular disease |
| Dementia | 1 | 4182210 | Dementia |
| COPD | 1 | 255573 | Chronic obstructive pulmonary disease |
| Rheumatic disease | 1 | 80809 | Rheumatoid arthritis |
| Peptic ulcer | 1 | 4027663 | Peptic ulcer |
| Mild liver | 1 | 4064161 | Cirrhosis of liver |
| DM (uncomplicated) | 1 | 201820 | Diabetes mellitus |
| Hemiplegia | 2 | 374022 | Hemiplegia |
| Paraplegia | 2 | 192606 | Paraplegia |
| Renal disease | 2 | 46271022 | Chronic kidney disease |
| Malignancy | 2 | 443392 | Malignant neoplastic disease |
| Moderate/severe liver | 3 | 192680 | Portal hypertension |
| Metastatic tumor | 6 | 432851 | Metastatic malignant neoplasm |
| AIDS/HIV | 6 | 439727 | Human immunodeficiency virus infection |

### Verified Ancestry Paths

- 4180793 (Malignant tumor of pancreas) → 443392 (Malignant neoplastic disease): 3 levels
- 201826 (Type 2 diabetes mellitus) → 201820 (Diabetes mellitus): 1 level

---

## Task 1: Database Migrations

**Files:**
- Create: `backend/database/migrations/2026_03_28_300000_create_risk_score_v2_tables.php`

- [ ] **Step 1: Create the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('risk_score_analyses', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->jsonb('design_json');
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('risk_score_run_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('execution_id')->constrained('analysis_executions')->cascadeOnDelete();
            $table->string('score_id', 10);
            $table->string('status', 20)->default('pending');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->integer('elapsed_ms')->nullable();
            $table->integer('patient_count')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['execution_id', 'score_id']);
        });

        Schema::create('risk_score_patient_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('execution_id')->constrained('analysis_executions')->cascadeOnDelete();
            $table->unsignedBigInteger('source_id');
            $table->unsignedBigInteger('cohort_definition_id');
            $table->unsignedBigInteger('person_id');
            $table->string('score_id', 10);
            $table->decimal('score_value', 10, 4)->nullable();
            $table->string('risk_tier', 20)->nullable();
            $table->decimal('confidence', 5, 4)->nullable();
            $table->decimal('completeness', 5, 4)->nullable();
            $table->jsonb('missing_components')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['execution_id']);
            $table->index(['cohort_definition_id', 'person_id']);
            $table->index(['score_id', 'risk_tier']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('risk_score_patient_results');
        Schema::dropIfExists('risk_score_run_steps');
        Schema::dropIfExists('risk_score_analyses');
    }
};
```

- [ ] **Step 2: Run the migration**

```bash
docker compose exec php php artisan migrate
```

- [ ] **Step 3: Run Pint and commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint database/migrations/2026_03_28_300000_create_risk_score_v2_tables.php"
git add backend/database/migrations/2026_03_28_300000_create_risk_score_v2_tables.php
git commit -m "feat(risk-scores-v2): add risk_score_analyses, run_steps, patient_results tables"
```

---

## Task 2: Eloquent Models

**Files:**
- Create: `backend/app/Models/App/RiskScoreAnalysis.php`
- Create: `backend/app/Models/App/RiskScoreRunStep.php`
- Create: `backend/app/Models/Results/RiskScorePatientResult.php`

- [ ] **Step 1: Create RiskScoreAnalysis model**

```php
<?php

namespace App\Models\App;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class RiskScoreAnalysis extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'description',
        'design_json',
        'author_id',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'design_json' => 'array',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    /** @return MorphMany<AnalysisExecution, $this> */
    public function executions(): MorphMany
    {
        return $this->morphMany(AnalysisExecution::class, 'analysis');
    }
}
```

- [ ] **Step 2: Create RiskScoreRunStep model**

```php
<?php

namespace App\Models\App;

use App\Enums\ExecutionStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiskScoreRunStep extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'execution_id',
        'score_id',
        'status',
        'started_at',
        'completed_at',
        'elapsed_ms',
        'patient_count',
        'error_message',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'status' => ExecutionStatus::class,
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<AnalysisExecution, $this> */
    public function execution(): BelongsTo
    {
        return $this->belongsTo(AnalysisExecution::class, 'execution_id');
    }
}
```

- [ ] **Step 3: Create RiskScorePatientResult model**

```php
<?php

namespace App\Models\Results;

use Illuminate\Database\Eloquent\Model;

class RiskScorePatientResult extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'execution_id',
        'source_id',
        'cohort_definition_id',
        'person_id',
        'score_id',
        'score_value',
        'risk_tier',
        'confidence',
        'completeness',
        'missing_components',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'score_value' => 'float',
            'confidence' => 'float',
            'completeness' => 'float',
            'missing_components' => 'array',
        ];
    }
}
```

- [ ] **Step 4: Run Pint and commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint \
  app/Models/App/RiskScoreAnalysis.php \
  app/Models/App/RiskScoreRunStep.php \
  app/Models/Results/RiskScorePatientResult.php"
git add \
  backend/app/Models/App/RiskScoreAnalysis.php \
  backend/app/Models/App/RiskScoreRunStep.php \
  backend/app/Models/Results/RiskScorePatientResult.php
git commit -m "feat(risk-scores-v2): add RiskScoreAnalysis, RunStep, PatientResult models"
```

---

## Task 3: v2 Score Interface

**Files:**
- Create: `backend/app/Contracts/PopulationRiskScoreV2Interface.php`

- [ ] **Step 1: Create the v2 interface**

```php
<?php

namespace App\Contracts;

interface PopulationRiskScoreV2Interface
{
    public function scoreId(): string;

    public function scoreName(): string;

    public function category(): string;

    public function description(): string;

    public function eligiblePopulation(): string;

    /**
     * Structured eligibility for the recommendation engine.
     *
     * @return array{
     *   population_type: 'universal'|'condition_specific'|'age_restricted',
     *   min_age?: int,
     *   max_age?: int,
     *   gender_concept_id?: int,
     *   required_condition_ancestors?: list<int>,
     *   required_measurement_concepts?: list<int>,
     * }
     */
    public function eligibilityCriteria(): array;

    /**
     * Condition groups with ancestor concept IDs for vocab resolution.
     * Each group is resolved at runtime via concept_ancestor.
     *
     * @return list<array{label: string, ancestor_concept_id: int, weight: int|float}>
     */
    public function conditionGroups(): array;

    /**
     * Measurement concepts needed for scoring.
     *
     * @return list<array{label: string, concept_id: int, unit: string, min_valid: float|null, max_valid: float|null}>
     */
    public function measurementRequirements(): array;

    /**
     * Risk tier definitions: tier_name => [lower_bound, upper_bound].
     * Upper bound null = unbounded.
     *
     * @return array<string, array{0: float|null, 1: float|null}>
     */
    public function riskTiers(): array;

    /**
     * Compute the score for a single patient. Pure function — no DB access.
     *
     * @param  array{
     *   person_id: int,
     *   age: int,
     *   gender_concept_id: int,
     *   conditions: list<int>,
     *   measurements: array<int, float>,
     * }  $patientData
     * @return array{score: float|null, tier: string, confidence: float, completeness: float, missing: list<string>}
     */
    public function compute(array $patientData): array;

    /**
     * CDM tables required for feature extraction.
     *
     * @return list<string>
     */
    public function requiredTables(): array;
}
```

- [ ] **Step 2: Run Pint and commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Contracts/PopulationRiskScoreV2Interface.php"
git add backend/app/Contracts/PopulationRiskScoreV2Interface.php
git commit -m "feat(risk-scores-v2): add PopulationRiskScoreV2Interface with compute() and eligibility"
```

---

## Task 4: ConceptResolutionService

**Files:**
- Create: `backend/app/Services/PopulationRisk/ConceptResolutionService.php`

- [ ] **Step 1: Create the service**

This service resolves OMOP ancestor concept IDs to their full descendant sets at runtime, using the actual vocab tables — never hardcoded concept IDs.

```php
<?php

namespace App\Services\PopulationRisk;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class ConceptResolutionService
{
    /**
     * Resolve all valid descendant concept IDs for a given ancestor.
     * Results are cached per connection+ancestor for 1 hour.
     *
     * @return list<int>
     */
    public function resolveDescendants(
        int $ancestorConceptId,
        string $connection,
        string $vocabSchema,
    ): array {
        $cacheKey = "concept_descendants:{$connection}:{$vocabSchema}:{$ancestorConceptId}";

        return Cache::remember($cacheKey, 3600, function () use ($ancestorConceptId, $connection, $vocabSchema): array {
            $rows = DB::connection($connection)->select("
                SELECT DISTINCT ca.descendant_concept_id
                FROM {$vocabSchema}.concept_ancestor ca
                JOIN {$vocabSchema}.concept c ON ca.descendant_concept_id = c.concept_id
                WHERE ca.ancestor_concept_id = ?
                  AND c.invalid_reason IS NULL
            ", [$ancestorConceptId]);

            return array_map(fn ($r) => (int) $r->descendant_concept_id, $rows);
        });
    }

    /**
     * Resolve multiple ancestor concepts to a merged set of descendants.
     * Used when a score group spans multiple ancestors (e.g., hemiplegia + paraplegia).
     *
     * @param  list<int>  $ancestorConceptIds
     * @return list<int>
     */
    public function resolveMultipleDescendants(
        array $ancestorConceptIds,
        string $connection,
        string $vocabSchema,
    ): array {
        $all = [];
        foreach ($ancestorConceptIds as $ancestor) {
            $all = array_merge($all, $this->resolveDescendants($ancestor, $connection, $vocabSchema));
        }

        return array_values(array_unique($all));
    }

    /**
     * Verify that a concept ID exists and is standard in the given vocab.
     */
    public function verifyConceptExists(
        int $conceptId,
        string $connection,
        string $vocabSchema,
    ): bool {
        $row = DB::connection($connection)->selectOne("
            SELECT 1 FROM {$vocabSchema}.concept
            WHERE concept_id = ? AND invalid_reason IS NULL
        ", [$conceptId]);

        return $row !== null;
    }

    /**
     * Clear cached descendants (useful after vocab updates).
     */
    public function clearCache(): void
    {
        // Cache keys are prefixed with "concept_descendants:" — Redis SCAN or tag-based clear
        // For simplicity, flush the entire cache
        Cache::flush();
    }
}
```

- [ ] **Step 2: Run Pint and commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/PopulationRisk/ConceptResolutionService.php"
git add backend/app/Services/PopulationRisk/ConceptResolutionService.php
git commit -m "feat(risk-scores-v2): add ConceptResolutionService for runtime vocab lookups"
```

---

## Task 5: PatientFeatureExtractor

**Files:**
- Create: `backend/app/Services/PopulationRisk/PatientFeatureExtractor.php`

- [ ] **Step 1: Create the feature extractor**

This service extracts clinical features (demographics, conditions, measurements) for all patients in a target cohort, in bulk. It's the data layer that feeds into the pure `compute()` methods.

```php
<?php

namespace App\Services\PopulationRisk;

use App\Contracts\PopulationRiskScoreV2Interface;
use App\Enums\DaimonType;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;

class PatientFeatureExtractor
{
    public function __construct(
        private readonly ConceptResolutionService $conceptResolver,
    ) {}

    /**
     * Extract all features needed by the given scores for a target cohort.
     *
     * @param  PopulationRiskScoreV2Interface[]  $scores
     * @return array<int, array{person_id: int, age: int, gender_concept_id: int, conditions: list<int>, measurements: array<int, float>}>
     */
    public function extractForCohort(
        int $cohortDefinitionId,
        array $scores,
        Source $source,
    ): array {
        $connection = $source->source_connection ?? 'omop';
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);

        // ── 1. Demographics for cohort members ──────────────────────────
        $patients = [];
        $rows = DB::connection($connection)->select("
            SELECT p.person_id,
                   EXTRACT(YEAR FROM CURRENT_DATE)::int - p.year_of_birth AS age,
                   p.gender_concept_id
            FROM {$cdmSchema}.person p
            INNER JOIN {$resultsSchema}.cohort c
                ON p.person_id = c.subject_id
                AND c.cohort_definition_id = ?
        ", [$cohortDefinitionId]);

        foreach ($rows as $r) {
            $patients[(int) $r->person_id] = [
                'person_id' => (int) $r->person_id,
                'age' => (int) $r->age,
                'gender_concept_id' => (int) $r->gender_concept_id,
                'conditions' => [],
                'measurements' => [],
            ];
        }

        if (empty($patients)) {
            return [];
        }

        $personIds = array_keys($patients);

        // ── 2. Conditions (resolve ancestors to descendants) ────────────
        $allConditionAncestors = [];
        foreach ($scores as $score) {
            foreach ($score->conditionGroups() as $group) {
                $allConditionAncestors[] = $group['ancestor_concept_id'];
            }
        }
        $allConditionAncestors = array_unique($allConditionAncestors);

        if (! empty($allConditionAncestors)) {
            // Resolve all needed descendants in one pass
            $allDescendants = $this->conceptResolver->resolveMultipleDescendants(
                $allConditionAncestors, $connection, $vocabSchema,
            );

            if (! empty($allDescendants)) {
                $placeholders = implode(',', array_fill(0, count($allDescendants), '?'));
                $condRows = DB::connection($connection)->select("
                    SELECT DISTINCT co.person_id, co.condition_concept_id
                    FROM {$cdmSchema}.condition_occurrence co
                    WHERE co.condition_concept_id IN ({$placeholders})
                      AND co.person_id = ANY(?::int[])
                ", array_merge($allDescendants, ['{' . implode(',', $personIds) . '}']));

                foreach ($condRows as $r) {
                    $pid = (int) $r->person_id;
                    if (isset($patients[$pid])) {
                        $patients[$pid]['conditions'][] = (int) $r->condition_concept_id;
                    }
                }
            }
        }

        // ── 3. Measurements (latest value per concept per patient) ──────
        $allMeasurementConcepts = [];
        foreach ($scores as $score) {
            foreach ($score->measurementRequirements() as $req) {
                $allMeasurementConcepts[] = $req['concept_id'];
            }
        }
        $allMeasurementConcepts = array_unique($allMeasurementConcepts);

        if (! empty($allMeasurementConcepts)) {
            $placeholders = implode(',', array_fill(0, count($allMeasurementConcepts), '?'));
            $measRows = DB::connection($connection)->select("
                SELECT DISTINCT ON (person_id, measurement_concept_id)
                       person_id, measurement_concept_id, value_as_number
                FROM {$cdmSchema}.measurement
                WHERE measurement_concept_id IN ({$placeholders})
                  AND person_id = ANY(?::int[])
                  AND value_as_number IS NOT NULL
                ORDER BY person_id, measurement_concept_id, measurement_date DESC
            ", array_merge($allMeasurementConcepts, ['{' . implode(',', $personIds) . '}']));

            foreach ($measRows as $r) {
                $pid = (int) $r->person_id;
                if (isset($patients[$pid])) {
                    $patients[$pid]['measurements'][(int) $r->measurement_concept_id] = (float) $r->value_as_number;
                }
            }
        }

        return $patients;
    }
}
```

- [ ] **Step 2: Run Pint and commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/PopulationRisk/PatientFeatureExtractor.php"
git add backend/app/Services/PopulationRisk/PatientFeatureExtractor.php
git commit -m "feat(risk-scores-v2): add PatientFeatureExtractor for bulk cohort feature extraction"
```

---

## Task 6: Charlson CCI v2 Score

**Files:**
- Create: `backend/app/Services/PopulationRisk/V2Scores/RS005CharlsonV2.php`

- [ ] **Step 1: Create the v2 Charlson implementation**

This is the first score migrated to the v2 interface. It uses verified ancestor concept IDs and a pure `compute()` method — no SQL template.

```php
<?php

namespace App\Services\PopulationRisk\V2Scores;

use App\Contracts\PopulationRiskScoreV2Interface;

/**
 * RS005 – Charlson Comorbidity Index v2
 *
 * Concept IDs verified against vocab.concept on 2026-03-28.
 * Uses concept_ancestor descendant lookups at runtime.
 */
class RS005CharlsonV2 implements PopulationRiskScoreV2Interface
{
    /** @var list<array{label: string, ancestor_concept_id: int, weight: int}> */
    private const CONDITION_GROUPS = [
        // Weight 1
        ['label' => 'Myocardial infarction', 'ancestor_concept_id' => 4329847, 'weight' => 1],
        ['label' => 'Congestive heart failure', 'ancestor_concept_id' => 319835, 'weight' => 1],
        ['label' => 'Peripheral vascular disease', 'ancestor_concept_id' => 321052, 'weight' => 1],
        ['label' => 'Cerebrovascular disease', 'ancestor_concept_id' => 381591, 'weight' => 1],
        ['label' => 'Dementia', 'ancestor_concept_id' => 4182210, 'weight' => 1],
        ['label' => 'COPD', 'ancestor_concept_id' => 255573, 'weight' => 1],
        ['label' => 'Rheumatic disease', 'ancestor_concept_id' => 80809, 'weight' => 1],
        ['label' => 'Peptic ulcer disease', 'ancestor_concept_id' => 4027663, 'weight' => 1],
        ['label' => 'Mild liver disease', 'ancestor_concept_id' => 4064161, 'weight' => 1],
        ['label' => 'Diabetes (uncomplicated)', 'ancestor_concept_id' => 201820, 'weight' => 1],
        // Weight 2
        ['label' => 'Hemiplegia/paraplegia', 'ancestor_concept_id' => 374022, 'weight' => 2],
        ['label' => 'Paraplegia', 'ancestor_concept_id' => 192606, 'weight' => 2],
        ['label' => 'Renal disease', 'ancestor_concept_id' => 46271022, 'weight' => 2],
        ['label' => 'Any malignancy', 'ancestor_concept_id' => 443392, 'weight' => 2],
        // Weight 3
        ['label' => 'Moderate/severe liver disease', 'ancestor_concept_id' => 192680, 'weight' => 3],
        // Weight 6
        ['label' => 'Metastatic solid tumor', 'ancestor_concept_id' => 432851, 'weight' => 6],
        ['label' => 'AIDS/HIV', 'ancestor_concept_id' => 439727, 'weight' => 6],
    ];

    public function scoreId(): string
    {
        return 'RS005';
    }

    public function scoreName(): string
    {
        return 'Charlson Comorbidity Index (CCI)';
    }

    public function category(): string
    {
        return 'Comorbidity Burden';
    }

    public function description(): string
    {
        return 'Weighted comorbidity score (Quan 2005 adaptation) predicting 10-year mortality. '
            . 'Conditions are weighted 1–6 and summed. Applicable to any hospitalized or chronic disease cohort.';
    }

    public function eligiblePopulation(): string
    {
        return 'All patients with at least one condition record';
    }

    public function eligibilityCriteria(): array
    {
        return [
            'population_type' => 'universal',
        ];
    }

    public function conditionGroups(): array
    {
        return self::CONDITION_GROUPS;
    }

    public function measurementRequirements(): array
    {
        return []; // CCI is conditions-only
    }

    public function riskTiers(): array
    {
        return [
            'low' => [0, 3],
            'moderate' => [3, 5],
            'high' => [5, 7],
            'very_high' => [7, null],
        ];
    }

    public function compute(array $patientData): array
    {
        $patientConditions = $patientData['conditions'] ?? [];
        if (empty($patientConditions)) {
            return [
                'score' => 0.0,
                'tier' => 'low',
                'confidence' => 0.8,
                'completeness' => 1.0,
                'missing' => [],
            ];
        }

        // This method receives resolved descendant concept IDs.
        // The engine pre-resolves ancestors → descendants and tags each patient condition
        // with which ancestor group it belongs to. We receive the ancestor IDs directly.
        $score = 0;
        $matchedGroups = [];

        foreach ($patientConditions as $conditionConceptId) {
            // conditionConceptId here is the ANCESTOR concept_id that this patient matched
            // (resolved by the engine before calling compute)
            foreach (self::CONDITION_GROUPS as $group) {
                if ($conditionConceptId === $group['ancestor_concept_id'] && ! in_array($group['label'], $matchedGroups, true)) {
                    // Hemiplegia and paraplegia are same weight, don't double-count
                    if (in_array($group['label'], ['Hemiplegia/paraplegia', 'Paraplegia'], true)) {
                        if (in_array('Hemiplegia/paraplegia', $matchedGroups, true) || in_array('Paraplegia', $matchedGroups, true)) {
                            continue;
                        }
                    }
                    // Malignancy (wt 2) superseded by metastatic (wt 6)
                    if ($group['label'] === 'Any malignancy' && in_array('Metastatic solid tumor', $matchedGroups, true)) {
                        continue;
                    }
                    if ($group['label'] === 'Metastatic solid tumor' && in_array('Any malignancy', $matchedGroups, true)) {
                        $score -= 2; // Remove the weight-2 malignancy, will add weight-6
                        $matchedGroups = array_filter($matchedGroups, fn ($g) => $g !== 'Any malignancy');
                    }
                    // Mild liver (wt 1) superseded by moderate/severe (wt 3)
                    if ($group['label'] === 'Mild liver disease' && in_array('Moderate/severe liver disease', $matchedGroups, true)) {
                        continue;
                    }
                    if ($group['label'] === 'Moderate/severe liver disease' && in_array('Mild liver disease', $matchedGroups, true)) {
                        $score -= 1;
                        $matchedGroups = array_filter($matchedGroups, fn ($g) => $g !== 'Mild liver disease');
                    }

                    $score += $group['weight'];
                    $matchedGroups[] = $group['label'];
                }
            }
        }

        $tier = $this->assignTier((float) $score);

        return [
            'score' => (float) $score,
            'tier' => $tier,
            'confidence' => 0.8, // Absent conditions may be uncoded
            'completeness' => 1.0, // Only needs conditions — always available
            'missing' => [],
        ];
    }

    public function requiredTables(): array
    {
        return ['person', 'condition_occurrence', 'concept_ancestor'];
    }

    private function assignTier(float $score): string
    {
        foreach ($this->riskTiers() as $tier => $range) {
            $lower = $range[0] ?? PHP_FLOAT_MIN;
            $upper = $range[1] ?? PHP_FLOAT_MAX;
            if ($score >= $lower && $score < $upper) {
                return $tier;
            }
        }

        return 'very_high';
    }
}
```

- [ ] **Step 2: Run Pint and commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/PopulationRisk/V2Scores/RS005CharlsonV2.php"
git add backend/app/Services/PopulationRisk/V2Scores/RS005CharlsonV2.php
git commit -m "feat(risk-scores-v2): Charlson CCI v2 with verified concepts and pure compute()"
```

---

## Task 7: RiskScoreRecommendationService

**Files:**
- Create: `backend/app/Services/PopulationRisk/RiskScoreRecommendationService.php`

- [ ] **Step 1: Create the recommendation service**

This service profiles a cohort and recommends which scores are clinically relevant.

```php
<?php

namespace App\Services\PopulationRisk;

use App\Contracts\PopulationRiskScoreV2Interface;
use App\Enums\DaimonType;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;

class RiskScoreRecommendationService
{
    /** @var PopulationRiskScoreV2Interface[] */
    private array $v2Scores = [];

    public function __construct(
        private readonly ConceptResolutionService $conceptResolver,
    ) {}

    public function registerV2Score(PopulationRiskScoreV2Interface $score): void
    {
        $this->v2Scores[$score->scoreId()] = $score;
    }

    /**
     * Profile a cohort and recommend applicable scores.
     *
     * @return array{cohort: array, profile: array, recommendations: list<array>}
     */
    public function recommend(int $cohortDefinitionId, Source $source): array
    {
        $connection = $source->source_connection ?? 'omop';
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);

        // ── Profile the cohort ──────────────────────────────────────────
        $profile = $this->profileCohort($cohortDefinitionId, $source, $connection, $cdmSchema, $vocabSchema, $resultsSchema);

        // ── Score each score's applicability ────────────────────────────
        $recommendations = [];
        foreach ($this->v2Scores as $score) {
            $recommendations[] = $this->evaluateScore($score, $profile, $connection, $cdmSchema, $vocabSchema);
        }

        // Sort: applicable + high relevance first
        usort($recommendations, function ($a, $b) {
            if ($a['applicable'] !== $b['applicable']) {
                return $a['applicable'] ? -1 : 1;
            }

            return $b['expected_completeness'] <=> $a['expected_completeness'];
        });

        return [
            'cohort' => [
                'id' => $cohortDefinitionId,
                'person_count' => $profile['person_count'],
            ],
            'profile' => $profile,
            'recommendations' => $recommendations,
        ];
    }

    private function profileCohort(
        int $cohortDefinitionId,
        Source $source,
        string $connection,
        string $cdmSchema,
        string $vocabSchema,
        string $resultsSchema,
    ): array {
        // Demographics
        $demo = DB::connection($connection)->selectOne("
            SELECT COUNT(DISTINCT p.person_id) AS person_count,
                   MIN(EXTRACT(YEAR FROM CURRENT_DATE)::int - p.year_of_birth) AS min_age,
                   MAX(EXTRACT(YEAR FROM CURRENT_DATE)::int - p.year_of_birth) AS max_age,
                   ROUND(AVG(CASE WHEN p.gender_concept_id = 8507 THEN 1.0 ELSE 0.0 END), 2) AS male_fraction
            FROM {$cdmSchema}.person p
            INNER JOIN {$resultsSchema}.cohort c
                ON p.person_id = c.subject_id AND c.cohort_definition_id = ?
        ", [$cohortDefinitionId]);

        // Top conditions by prevalence
        $topConditions = DB::connection($connection)->select("
            SELECT co.condition_concept_id, vc.concept_name,
                   COUNT(DISTINCT co.person_id) AS patient_count,
                   ROUND(COUNT(DISTINCT co.person_id)::numeric / NULLIF(?, 0), 4) AS prevalence
            FROM {$cdmSchema}.condition_occurrence co
            INNER JOIN {$resultsSchema}.cohort c
                ON co.person_id = c.subject_id AND c.cohort_definition_id = ?
            LEFT JOIN {$vocabSchema}.concept vc ON co.condition_concept_id = vc.concept_id
            GROUP BY co.condition_concept_id, vc.concept_name
            ORDER BY patient_count DESC
            LIMIT 20
        ", [(int) ($demo->person_count ?? 0), $cohortDefinitionId]);

        // Available measurement concepts
        $measurements = DB::connection($connection)->select("
            SELECT m.measurement_concept_id, COUNT(DISTINCT m.person_id) AS patient_count
            FROM {$cdmSchema}.measurement m
            INNER JOIN {$resultsSchema}.cohort c
                ON m.person_id = c.subject_id AND c.cohort_definition_id = ?
            WHERE m.value_as_number IS NOT NULL
            GROUP BY m.measurement_concept_id
            HAVING COUNT(DISTINCT m.person_id) >= 10
            ORDER BY patient_count DESC
            LIMIT 50
        ", [$cohortDefinitionId]);

        $measurementCoverage = [];
        foreach ($measurements as $m) {
            $measurementCoverage[(int) $m->measurement_concept_id] = (int) $m->patient_count;
        }

        return [
            'person_count' => (int) ($demo->person_count ?? 0),
            'age_range' => [(int) ($demo->min_age ?? 0), (int) ($demo->max_age ?? 0)],
            'male_fraction' => (float) ($demo->male_fraction ?? 0.5),
            'top_conditions' => array_map(fn ($r) => [
                'concept_id' => (int) $r->condition_concept_id,
                'name' => $r->concept_name,
                'prevalence' => (float) $r->prevalence,
            ], $topConditions),
            'measurement_coverage' => $measurementCoverage,
        ];
    }

    private function evaluateScore(
        PopulationRiskScoreV2Interface $score,
        array $profile,
        string $connection,
        string $cdmSchema,
        string $vocabSchema,
    ): array {
        $criteria = $score->eligibilityCriteria();
        $applicable = true;
        $reasons = [];

        // Check population type
        if ($criteria['population_type'] === 'condition_specific') {
            $requiredAncestors = $criteria['required_condition_ancestors'] ?? [];
            if (! empty($requiredAncestors)) {
                // Check if any of the required ancestor conditions appear in the cohort's top conditions
                $cohortConditionIds = array_column($profile['top_conditions'], 'concept_id');
                $hasRequired = false;
                foreach ($requiredAncestors as $ancestor) {
                    $descendants = $this->conceptResolver->resolveDescendants($ancestor, $connection, $vocabSchema);
                    if (! empty(array_intersect($cohortConditionIds, $descendants))) {
                        $hasRequired = true;
                        break;
                    }
                }
                if (! $hasRequired) {
                    $applicable = false;
                    $reasons[] = 'Cohort lacks the required prerequisite condition';
                }
            }
        }

        // Check age range
        if (isset($criteria['min_age']) && $profile['age_range'][1] < $criteria['min_age']) {
            $applicable = false;
            $reasons[] = "All patients below minimum age {$criteria['min_age']}";
        }
        if (isset($criteria['max_age']) && $profile['age_range'][0] > $criteria['max_age']) {
            $applicable = false;
            $reasons[] = "All patients above maximum age {$criteria['max_age']}";
        }

        // Check measurement completeness
        $missingMeasurements = [];
        $totalRequired = count($score->measurementRequirements());
        $available = 0;
        foreach ($score->measurementRequirements() as $req) {
            if (isset($profile['measurement_coverage'][$req['concept_id']])) {
                $available++;
            } else {
                $missingMeasurements[] = $req['label'];
            }
        }
        $expectedCompleteness = $totalRequired > 0 ? $available / $totalRequired : 1.0;

        // Determine relevance
        $relevance = 'none';
        if ($applicable) {
            $relevance = $expectedCompleteness >= 0.8 ? 'high' : ($expectedCompleteness >= 0.5 ? 'medium' : 'low');
        }

        if ($applicable && empty($reasons)) {
            $reasons[] = $this->generateRelevanceReason($score, $profile);
        }

        return [
            'score_id' => $score->scoreId(),
            'score_name' => $score->scoreName(),
            'category' => $score->category(),
            'applicable' => $applicable,
            'relevance' => $relevance,
            'reason' => implode('; ', $reasons),
            'expected_completeness' => round($expectedCompleteness, 2),
            'missing_components' => $missingMeasurements,
        ];
    }

    private function generateRelevanceReason(PopulationRiskScoreV2Interface $score, array $profile): string
    {
        $criteria = $score->eligibilityCriteria();
        if ($criteria['population_type'] === 'universal') {
            return "Applicable to all cohorts — {$profile['person_count']} patients eligible";
        }

        return "Cohort profile matches eligibility criteria — {$profile['person_count']} patients";
    }
}
```

- [ ] **Step 2: Run Pint and commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/PopulationRisk/RiskScoreRecommendationService.php"
git add backend/app/Services/PopulationRisk/RiskScoreRecommendationService.php
git commit -m "feat(risk-scores-v2): add RiskScoreRecommendationService with cohort profiling"
```

---

## Task 8: RiskScoreExecutionService

**Files:**
- Create: `backend/app/Services/PopulationRisk/RiskScoreExecutionService.php`

- [ ] **Step 1: Create the execution service**

This service runs selected scores scoped to a target cohort, storing patient-level results.

```php
<?php

namespace App\Services\PopulationRisk;

use App\Contracts\PopulationRiskScoreV2Interface;
use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\RiskScoreAnalysis;
use App\Models\App\RiskScoreRunStep;
use App\Models\App\Source;
use App\Models\Results\RiskScorePatientResult;
use Illuminate\Support\Facades\Log;
use Throwable;

class RiskScoreExecutionService
{
    /** @var array<string, PopulationRiskScoreV2Interface> */
    private array $v2Scores = [];

    public function __construct(
        private readonly PatientFeatureExtractor $featureExtractor,
        private readonly ConceptResolutionService $conceptResolver,
    ) {}

    public function registerV2Score(PopulationRiskScoreV2Interface $score): void
    {
        $this->v2Scores[$score->scoreId()] = $score;
    }

    /**
     * Execute a risk score analysis: extract features, compute scores, persist results.
     */
    public function execute(
        RiskScoreAnalysis $analysis,
        Source $source,
        AnalysisExecution $execution,
    ): void {
        $design = $analysis->design_json;
        $targetCohortIds = $design['targetCohortIds'] ?? [];
        $requestedScoreIds = $design['scoreIds'] ?? [];

        // Resolve which v2 scores to run
        $scoresToRun = [];
        foreach ($requestedScoreIds as $id) {
            if (isset($this->v2Scores[$id])) {
                $scoresToRun[] = $this->v2Scores[$id];
            }
        }

        if (empty($scoresToRun) || empty($targetCohortIds)) {
            $execution->update([
                'status' => ExecutionStatus::Failed,
                'fail_message' => 'No valid scores or target cohorts specified',
                'completed_at' => now(),
            ]);

            return;
        }

        $execution->update([
            'status' => ExecutionStatus::Running,
            'started_at' => now(),
        ]);

        // Create step records for tracking
        $steps = [];
        foreach ($scoresToRun as $score) {
            $steps[$score->scoreId()] = RiskScoreRunStep::create([
                'execution_id' => $execution->id,
                'score_id' => $score->scoreId(),
                'status' => ExecutionStatus::Pending,
            ]);
        }

        $totalCompleted = 0;
        $totalFailed = 0;

        foreach ($targetCohortIds as $cohortId) {
            // ── Extract features for this cohort ────────────────────────
            $patients = $this->featureExtractor->extractForCohort(
                $cohortId, $scoresToRun, $source,
            );

            if (empty($patients)) {
                Log::warning("[RS-V2] No patients in cohort {$cohortId} for source {$source->id}");

                continue;
            }

            // ── Pre-resolve condition ancestor mappings ─────────────────
            $ancestorMap = $this->buildAncestorMap($scoresToRun, $source);

            // ── Tag each patient's conditions with matching ancestors ───
            foreach ($patients as &$patient) {
                $patient['conditions'] = $this->mapConditionsToAncestors(
                    $patient['conditions'], $ancestorMap,
                );
            }
            unset($patient);

            // ── Run each score ──────────────────────────────────────────
            foreach ($scoresToRun as $score) {
                $step = $steps[$score->scoreId()];
                $step->update(['status' => ExecutionStatus::Running, 'started_at' => now()]);

                $start = microtime(true);
                try {
                    $results = [];
                    foreach ($patients as $patientData) {
                        $result = $score->compute($patientData);
                        $results[] = [
                            'execution_id' => $execution->id,
                            'source_id' => $source->id,
                            'cohort_definition_id' => $cohortId,
                            'person_id' => $patientData['person_id'],
                            'score_id' => $score->scoreId(),
                            'score_value' => $result['score'],
                            'risk_tier' => $result['tier'],
                            'confidence' => $result['confidence'],
                            'completeness' => $result['completeness'],
                            'missing_components' => ! empty($result['missing']) ? json_encode($result['missing']) : null,
                            'created_at' => now(),
                        ];
                    }

                    // Bulk insert
                    foreach (array_chunk($results, 500) as $chunk) {
                        RiskScorePatientResult::insert($chunk);
                    }

                    $elapsed = (int) ((microtime(true) - $start) * 1000);
                    $step->update([
                        'status' => ExecutionStatus::Completed,
                        'completed_at' => now(),
                        'elapsed_ms' => $elapsed,
                        'patient_count' => count($results),
                    ]);
                    $totalCompleted++;

                    Log::info("[RS-V2] {$score->scoreId()} completed: {$elapsed}ms, " . count($results) . ' patients');
                } catch (Throwable $e) {
                    $elapsed = (int) ((microtime(true) - $start) * 1000);
                    $step->update([
                        'status' => ExecutionStatus::Failed,
                        'completed_at' => now(),
                        'elapsed_ms' => $elapsed,
                        'error_message' => $e->getMessage(),
                    ]);
                    $totalFailed++;

                    Log::error("[RS-V2] {$score->scoreId()} failed: " . $e->getMessage());
                }
            }
        }

        $execution->update([
            'status' => $totalFailed === count($scoresToRun)
                ? ExecutionStatus::Failed
                : ExecutionStatus::Completed,
            'completed_at' => now(),
            'result_json' => [
                'completed' => $totalCompleted,
                'failed' => $totalFailed,
                'total_patients' => RiskScorePatientResult::where('execution_id', $execution->id)->count(),
            ],
        ]);
    }

    /**
     * Build a map: descendant_concept_id → list of ancestor_concept_ids.
     * This allows tagging patient conditions with the Charlson groups they belong to.
     *
     * @param  PopulationRiskScoreV2Interface[]  $scores
     * @return array<int, list<int>>
     */
    private function buildAncestorMap(array $scores, Source $source): array
    {
        $connection = $source->source_connection ?? 'omop';
        $vocabSchema = $source->getTableQualifier(\App\Enums\DaimonType::Vocabulary)
            ?? $source->getTableQualifier(\App\Enums\DaimonType::CDM);

        $map = [];
        foreach ($scores as $score) {
            foreach ($score->conditionGroups() as $group) {
                $ancestorId = $group['ancestor_concept_id'];
                $descendants = $this->conceptResolver->resolveDescendants($ancestorId, $connection, $vocabSchema);
                foreach ($descendants as $desc) {
                    $map[$desc][] = $ancestorId;
                }
            }
        }

        return $map;
    }

    /**
     * Replace raw condition concept IDs with their matching ancestor group IDs.
     *
     * @param  list<int>  $conditionConceptIds
     * @param  array<int, list<int>>  $ancestorMap
     * @return list<int>  Ancestor concept IDs that this patient matches
     */
    private function mapConditionsToAncestors(array $conditionConceptIds, array $ancestorMap): array
    {
        $matched = [];
        foreach ($conditionConceptIds as $cid) {
            if (isset($ancestorMap[$cid])) {
                foreach ($ancestorMap[$cid] as $ancestor) {
                    $matched[] = $ancestor;
                }
            }
        }

        return array_values(array_unique($matched));
    }
}
```

- [ ] **Step 2: Run Pint and commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/PopulationRisk/RiskScoreExecutionService.php"
git add backend/app/Services/PopulationRisk/RiskScoreExecutionService.php
git commit -m "feat(risk-scores-v2): add cohort-scoped RiskScoreExecutionService with patient-level persistence"
```

---

## Task 9: Controller, Routes, and Service Provider

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/RiskScoreAnalysisController.php`
- Modify: `backend/routes/api.php`
- Modify: `backend/app/Providers/PopulationRiskServiceProvider.php`

- [ ] **Step 1: Create the v2 controller**

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Http\Controllers\Controller;
use App\Models\App\AnalysisExecution;
use App\Models\App\RiskScoreAnalysis;
use App\Models\App\RiskScoreRunStep;
use App\Models\App\Source;
use App\Models\Results\RiskScorePatientResult;
use App\Services\PopulationRisk\RiskScoreExecutionService;
use App\Services\PopulationRisk\RiskScoreRecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RiskScoreAnalysisController extends Controller
{
    public function __construct(
        private readonly RiskScoreRecommendationService $recommender,
        private readonly RiskScoreExecutionService $executor,
    ) {}

    /**
     * POST /api/v1/sources/{source}/risk-scores/recommend
     */
    public function recommend(Source $source, Request $request): JsonResponse
    {
        $cohortId = (int) $request->input('cohort_definition_id');
        if ($cohortId <= 0) {
            return response()->json(['error' => 'cohort_definition_id is required'], 422);
        }

        $result = $this->recommender->recommend($cohortId, $source);

        return response()->json($result);
    }

    /**
     * POST /api/v1/risk-score-analyses
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'design_json' => 'required|array',
            'design_json.targetCohortIds' => 'required|array|min:1',
            'design_json.scoreIds' => 'required|array|min:1',
        ]);

        $analysis = RiskScoreAnalysis::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'design_json' => $validated['design_json'],
            'author_id' => $request->user()?->id,
        ]);

        return response()->json($analysis, 201);
    }

    /**
     * GET /api/v1/risk-score-analyses/{analysis}
     */
    public function show(RiskScoreAnalysis $analysis): JsonResponse
    {
        $analysis->load('author', 'executions.source');

        return response()->json($analysis);
    }

    /**
     * POST /api/v1/risk-score-analyses/{analysis}/execute
     */
    public function execute(RiskScoreAnalysis $analysis, Request $request): JsonResponse
    {
        $sourceId = (int) $request->input('source_id');
        $source = Source::findOrFail($sourceId);

        set_time_limit(300);

        $execution = $analysis->executions()->create([
            'source_id' => $source->id,
            'status' => ExecutionStatus::Pending,
        ]);

        $this->executor->execute($analysis, $source, $execution);

        $execution->refresh();

        return response()->json([
            'execution_id' => $execution->id,
            'status' => $execution->status,
            'result' => $execution->result_json,
            'steps' => RiskScoreRunStep::where('execution_id', $execution->id)
                ->orderBy('id')
                ->get()
                ->map(fn ($s) => [
                    'score_id' => $s->score_id,
                    'status' => $s->status,
                    'elapsed_ms' => $s->elapsed_ms,
                    'patient_count' => $s->patient_count,
                    'error_message' => $s->error_message,
                ]),
        ]);
    }

    /**
     * GET /api/v1/risk-score-analyses/{analysis}/executions/{execution}
     */
    public function executionDetail(RiskScoreAnalysis $analysis, AnalysisExecution $execution): JsonResponse
    {
        $steps = RiskScoreRunStep::where('execution_id', $execution->id)
            ->orderBy('id')
            ->get();

        // Aggregate patient-level results into population summaries
        $summaries = RiskScorePatientResult::where('execution_id', $execution->id)
            ->selectRaw("
                score_id,
                risk_tier,
                COUNT(*) AS patient_count,
                ROUND(AVG(score_value)::numeric, 4) AS mean_score,
                ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY score_value)::numeric, 4) AS p25_score,
                ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY score_value)::numeric, 4) AS median_score,
                ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY score_value)::numeric, 4) AS p75_score,
                ROUND(AVG(confidence)::numeric, 4) AS mean_confidence,
                ROUND(AVG(completeness)::numeric, 4) AS mean_completeness
            ")
            ->groupBy('score_id', 'risk_tier')
            ->orderBy('score_id')
            ->get();

        return response()->json([
            'execution_id' => $execution->id,
            'status' => $execution->status,
            'started_at' => $execution->started_at,
            'completed_at' => $execution->completed_at,
            'result' => $execution->result_json,
            'steps' => $steps,
            'summaries' => $summaries,
        ]);
    }

    /**
     * GET /api/v1/risk-score-analyses/{analysis}/executions/{execution}/patients
     */
    public function patients(RiskScoreAnalysis $analysis, AnalysisExecution $execution, Request $request): JsonResponse
    {
        $query = RiskScorePatientResult::where('execution_id', $execution->id);

        if ($request->filled('score_id')) {
            $query->where('score_id', $request->input('score_id'));
        }
        if ($request->filled('risk_tier')) {
            $query->where('risk_tier', $request->input('risk_tier'));
        }

        $perPage = (int) ($request->input('per_page', 25));
        $results = $query->orderBy('person_id')->paginate($perPage);

        return response()->json($results);
    }
}
```

- [ ] **Step 2: Add routes**

In `backend/routes/api.php`, add inside the authenticated group (near the existing risk-scores routes):

```php
// Risk Score Analysis v2
Route::post('sources/{source}/risk-scores/recommend', [RiskScoreAnalysisController::class, 'recommend']);
Route::apiResource('risk-score-analyses', RiskScoreAnalysisController::class)->only(['store', 'show']);
Route::post('risk-score-analyses/{analysis}/execute', [RiskScoreAnalysisController::class, 'execute']);
Route::get('risk-score-analyses/{analysis}/executions/{execution}', [RiskScoreAnalysisController::class, 'executionDetail']);
Route::get('risk-score-analyses/{analysis}/executions/{execution}/patients', [RiskScoreAnalysisController::class, 'patients']);
```

Also add the import at the top of `api.php`:
```php
use App\Http\Controllers\Api\V1\RiskScoreAnalysisController;
```

- [ ] **Step 3: Register v2 services and scores in PopulationRiskServiceProvider**

Add to the `register()` method:

```php
// V2 services
$this->app->singleton(ConceptResolutionService::class);
$this->app->singleton(PatientFeatureExtractor::class);

$this->app->singleton(RiskScoreRecommendationService::class, function ($app) {
    $service = new RiskScoreRecommendationService($app->make(ConceptResolutionService::class));
    $service->registerV2Score(new \App\Services\PopulationRisk\V2Scores\RS005CharlsonV2);
    return $service;
});

$this->app->singleton(RiskScoreExecutionService::class, function ($app) {
    $service = new RiskScoreExecutionService(
        $app->make(PatientFeatureExtractor::class),
        $app->make(ConceptResolutionService::class),
    );
    $service->registerV2Score(new \App\Services\PopulationRisk\V2Scores\RS005CharlsonV2);
    return $service;
});
```

Add necessary imports at the top of the service provider.

- [ ] **Step 4: Run Pint and PHPStan**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint \
  app/Http/Controllers/Api/V1/RiskScoreAnalysisController.php \
  app/Providers/PopulationRiskServiceProvider.php \
  routes/api.php"
```

- [ ] **Step 5: Commit**

```bash
git add \
  backend/app/Http/Controllers/Api/V1/RiskScoreAnalysisController.php \
  backend/routes/api.php \
  backend/app/Providers/PopulationRiskServiceProvider.php
git commit -m "feat(risk-scores-v2): add controller, routes, and service provider registration"
```

---

## Task 10: End-to-End Test on Pancreas Corpus

**Files:** None (verification only)

- [ ] **Step 1: Test recommendation endpoint**

```bash
TOKEN=$(curl -s -X POST http://localhost:8082/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acumenus.net","password":"superuser"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

# Recommend scores for "All PDAC Patients" cohort (ID 221)
curl -s -X POST "http://localhost:8082/api/v1/sources/58/risk-scores/recommend" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cohort_definition_id": 221}' | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Cohort: {data[\"cohort\"][\"person_count\"]} patients')
print(f'Age range: {data[\"profile\"][\"age_range\"]}')
for r in data['recommendations']:
    status = 'RECOMMENDED' if r['applicable'] else 'NOT APPLICABLE'
    print(f'  {r[\"score_id\"]} {r[\"score_name\"]}: {status} ({r[\"relevance\"]}) — {r[\"reason\"]}')
"
```

Expected: RS005 Charlson recommended as "high" relevance for a cancer cohort.

- [ ] **Step 2: Create a risk score analysis**

```bash
ANALYSIS_ID=$(curl -s -X POST "http://localhost:8082/api/v1/risk-score-analyses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "PDAC Comorbidity Assessment",
    "description": "Charlson CCI for all pancreatic cancer patients",
    "design_json": {
      "targetCohortIds": [221],
      "scoreIds": ["RS005"]
    }
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['id'])")
echo "Analysis ID: $ANALYSIS_ID"
```

- [ ] **Step 3: Execute the analysis**

```bash
curl -s -X POST "http://localhost:8082/api/v1/risk-score-analyses/${ANALYSIS_ID}/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source_id": 58}' | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Status: {data[\"status\"]}')
print(f'Result: {data[\"result\"]}')
for s in data['steps']:
    print(f'  {s[\"score_id\"]}: {s[\"status\"]} ({s[\"elapsed_ms\"]}ms, {s[\"patient_count\"]} patients)')
"
```

Expected: RS005 completed, 361 patients scored.

- [ ] **Step 4: Verify patient-level results**

```bash
psql -h localhost -U claude_dev -d parthenon -c "
SELECT score_id, risk_tier, count(*) as patients,
       round(avg(score_value)::numeric, 2) as mean_score
FROM app.risk_score_patient_results
WHERE score_id = 'RS005'
GROUP BY score_id, risk_tier ORDER BY risk_tier;"
```

Expected:
- low (CCI 0-2): ~226 patients (cancer only)
- moderate (CCI 3-4): ~135 patients (cancer + T2DM/other comorbidity)

- [ ] **Step 5: Verify patient drill-through**

```bash
curl -s "http://localhost:8082/api/v1/risk-score-analyses/${ANALYSIS_ID}/executions/EXEC_ID/patients?score_id=RS005&risk_tier=moderate&per_page=5" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20
```

Replace `EXEC_ID` with the actual execution ID from step 3.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(risk-scores-v2): complete Phase A+B — infrastructure, recommendation, execution, Charlson proof of concept"
git push
```
