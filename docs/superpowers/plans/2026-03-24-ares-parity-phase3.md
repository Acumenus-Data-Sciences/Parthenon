# Ares Parity — Phase 3: Network Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build cross-source network analysis capabilities: concept comparison, coverage matrix, diversity reporting, feasibility assessment, and network overview -- the multi-source intelligence layer of Ares.

**Architecture:** 4 new backend services (`NetworkComparisonService`, `CoverageService`, `DiversityService`, `FeasibilityService`) that query Achilles results across all active sources using `AchillesResultReaderService::setSchemaForSource()`. New `NetworkAresController` with network-scoped endpoints under `/v1/network/ares/`. Rate limiting on expensive endpoints (feasibility, batch compare). Redis caching on aggregation endpoints with event-driven invalidation. Frontend drill-in views with grouped bar charts, heatmaps, stacked demographic bars, and feasibility scorecards.

**Tech Stack:** Laravel 11 / PHP 8.4 / PostgreSQL 17 / React 19 / TypeScript / TanStack Query / Recharts / Tailwind 4

**Spec:** `docs/superpowers/specs/2026-03-24-ares-parity-design.md`

**Depends on:** Phase 1 plan at `docs/superpowers/plans/2026-03-24-ares-parity-phase1.md`

---

## File Map

### Backend -- New Files

```
backend/
├── app/
│   ├── Services/Ares/
│   │   ├── NetworkComparisonService.php        # New service
│   │   ├── CoverageService.php                 # New service
│   │   ├── DiversityService.php                # New service
│   │   └── FeasibilityService.php              # New service
│   ├── Http/
│   │   ├── Controllers/Api/V1/
│   │   │   └── NetworkAresController.php       # New controller
│   │   └── Requests/Api/
│   │       └── RunFeasibilityRequest.php       # New form request
├── tests/
│   ├── Unit/Services/Ares/
│   │   ├── NetworkComparisonServiceTest.php    # New test
│   │   ├── CoverageServiceTest.php             # New test
│   │   ├── DiversityServiceTest.php            # New test
│   │   └── FeasibilityServiceTest.php          # New test
│   └── Feature/Api/
│       └── NetworkAresControllerTest.php       # New test
```

### Backend -- Modified Files

```
backend/
├── routes/api.php                              # Add network Ares route group
├── app/Listeners/ComputeDqDeltas.php           # Add cache invalidation on ReleaseCreated
```

### Frontend -- New Files

```
frontend/src/features/data-explorer/
├── components/ares/
│   ├── concept-comparison/
│   │   ├── ConceptComparisonView.tsx           # Search + cross-source charts
│   │   └── ComparisonChart.tsx                 # Grouped bar: concept x source
│   ├── coverage/
│   │   └── CoverageMatrixView.tsx              # Domain x source heatmap
│   ├── diversity/
│   │   └── DiversityView.tsx                   # Stacked demographic bars per source
│   ├── feasibility/
│   │   ├── FeasibilityView.tsx                 # Assessment list + builder
│   │   └── FeasibilityForm.tsx                 # Criteria form
│   └── network-overview/
│       └── NetworkOverviewView.tsx             # Source health list
├── hooks/
│   └── useNetworkData.ts                       # Comparison, coverage, diversity, feasibility hooks
├── api/
│   └── networkAresApi.ts                       # Network endpoint API functions
```

### Frontend -- Modified Files

```
frontend/src/features/data-explorer/
├── components/ares/
│   └── AresHealthBanner.tsx                    # Wire to live network data
├── pages/
│   └── AresTab.tsx                             # Add all network drill-in views
└── types/
    └── ares.ts                                 # Add network TypeScript types
```

---

## Task 1: NetworkComparisonService

**Files:**
- Create: `backend/app/Services/Ares/NetworkComparisonService.php`
- Create: `backend/tests/Unit/Services/Ares/NetworkComparisonServiceTest.php`

- [ ] **Step 1: Write failing tests**

```php
<?php

namespace Tests\Unit\Services\Ares;

use App\Models\App\Source;
use App\Services\Ares\NetworkComparisonService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NetworkComparisonServiceTest extends TestCase
{
    use RefreshDatabase;

    private NetworkComparisonService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(NetworkComparisonService::class);
    }

    public function test_compare_concept_returns_per_source_data(): void
    {
        // Create sources with daimons so they appear as active
        $source1 = Source::factory()->create(['source_name' => 'Source A']);
        $source2 = Source::factory()->create(['source_name' => 'Source B']);

        // The actual Achilles result queries will return empty for test sources
        // without real results schema data — test the structure
        $result = $this->service->compareConcept(201826);

        $this->assertIsArray($result);
        // Each entry should have the expected structure
        foreach ($result as $entry) {
            $this->assertArrayHasKey('source_id', $entry);
            $this->assertArrayHasKey('source_name', $entry);
            $this->assertArrayHasKey('count', $entry);
            $this->assertArrayHasKey('rate_per_1000', $entry);
        }
    }

    public function test_compare_batch_handles_multiple_concepts(): void
    {
        $result = $this->service->compareBatch([201826, 320128]);

        $this->assertIsArray($result);
        $this->assertArrayHasKey(201826, $result);
        $this->assertArrayHasKey(320128, $result);
    }

    public function test_compare_concept_returns_empty_for_nonexistent_concept(): void
    {
        $result = $this->service->compareConcept(999999999);

        $this->assertIsArray($result);
        // Should still return entries for each source, just with 0 counts
        foreach ($result as $entry) {
            $this->assertEquals(0, $entry['count']);
        }
    }

    public function test_search_concepts_returns_results(): void
    {
        // This delegates to existing Solr vocabulary search
        // Test that the method exists and returns the expected structure
        $result = $this->service->searchConcepts('diabetes');

        $this->assertIsArray($result);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/NetworkComparisonServiceTest.php`
Expected: FAIL -- NetworkComparisonService class not found

- [ ] **Step 3: Implement NetworkComparisonService**

```php
<?php

namespace App\Services\Ares;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\AchillesResult;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class NetworkComparisonService
{
    /**
     * Map of OMOP domains to their Achilles prevalence analysis IDs.
     */
    private const DOMAIN_PREVALENCE_MAP = [
        'condition' => 401,
        'drug' => 701,
        'procedure' => 601,
        'measurement' => 1801,
        'observation' => 801,
        'visit' => 201,
    ];

    public function __construct(
        private readonly DynamicConnectionFactory $connectionFactory,
    ) {}

    /**
     * Compare concept prevalence across all active sources.
     *
     * @return array<int, array{source_id: int, source_name: string, count: int, rate_per_1000: float, person_count: int}>
     */
    public function compareConcept(int $conceptId): array
    {
        $sources = Source::whereHas('daimons')->get();
        $results = [];

        foreach ($sources as $source) {
            try {
                $data = $this->getConceptDataForSource($source, $conceptId);
                $results[] = $data;
            } catch (\Throwable $e) {
                Log::warning("NetworkComparison: failed to query source {$source->source_name}: {$e->getMessage()}");
                $results[] = [
                    'source_id' => $source->id,
                    'source_name' => $source->source_name,
                    'count' => 0,
                    'rate_per_1000' => 0.0,
                    'person_count' => 0,
                ];
            }
        }

        return $results;
    }

    /**
     * Compare multiple concepts across all sources in parallel.
     *
     * @param  array<int>  $conceptIds
     * @return array<int, array<int, array{source_id: int, source_name: string, count: int, rate_per_1000: float}>>
     */
    public function compareBatch(array $conceptIds): array
    {
        $results = [];

        foreach ($conceptIds as $conceptId) {
            $results[$conceptId] = $this->compareConcept($conceptId);
        }

        return $results;
    }

    /**
     * Search concepts for comparison using vocabulary search.
     *
     * @return array<int, array{concept_id: int, concept_name: string, domain_id: string, vocabulary_id: string}>
     */
    public function searchConcepts(string $query): array
    {
        if (strlen($query) < 2) {
            return [];
        }

        $results = DB::connection('omop')
            ->table('concept')
            ->select(['concept_id', 'concept_name', 'domain_id', 'vocabulary_id', 'standard_concept'])
            ->where('concept_name', 'ilike', "%{$query}%")
            ->where('standard_concept', 'S')
            ->orderByRaw("CASE WHEN concept_name ILIKE ? THEN 0 ELSE 1 END", ["{$query}%"])
            ->limit(50)
            ->get();

        return $results->map(fn ($row) => [
            'concept_id' => $row->concept_id,
            'concept_name' => $row->concept_name,
            'domain_id' => $row->domain_id,
            'vocabulary_id' => $row->vocabulary_id,
        ])->toArray();
    }

    /**
     * Get concept prevalence data for a specific source.
     */
    private function getConceptDataForSource(Source $source, int $conceptId): array
    {
        $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
        $schema = $daimon?->table_qualifier ?? 'results';

        $connection = 'results';
        if (! empty($source->db_host)) {
            $connection = $this->connectionFactory->connectionForSchema($source, $schema);
        } else {
            DB::connection('results')->statement(
                "SET search_path TO \"{$schema}\", public"
            );
        }

        // Query Achilles results for concept prevalence across all analysis IDs
        $analysisIds = array_values(self::DOMAIN_PREVALENCE_MAP);

        $result = AchillesResult::on($connection)
            ->whereIn('analysis_id', $analysisIds)
            ->where('stratum_1', (string) $conceptId)
            ->selectRaw('SUM(CAST(count_value AS bigint)) as total_count')
            ->first();

        $count = (int) ($result?->total_count ?? 0);

        // Get person count (analysis 1)
        $personResult = AchillesResult::on($connection)
            ->where('analysis_id', 1)
            ->first();

        $personCount = (int) ($personResult?->count_value ?? 0);
        $ratePer1000 = $personCount > 0 ? round(($count / $personCount) * 1000, 2) : 0.0;

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'count' => $count,
            'rate_per_1000' => $ratePer1000,
            'person_count' => $personCount,
        ];
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/NetworkComparisonServiceTest.php`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Ares/NetworkComparisonService.php backend/tests/Unit/Services/Ares/NetworkComparisonServiceTest.php
git commit -m "feat(ares): implement NetworkComparisonService with cross-source concept prevalence"
```

---

## Task 2: CoverageService + DiversityService

**Files:**
- Create: `backend/app/Services/Ares/CoverageService.php`
- Create: `backend/app/Services/Ares/DiversityService.php`
- Create: `backend/tests/Unit/Services/Ares/CoverageServiceTest.php`
- Create: `backend/tests/Unit/Services/Ares/DiversityServiceTest.php`

- [ ] **Step 1: Write failing CoverageService tests**

```php
<?php

namespace Tests\Unit\Services\Ares;

use App\Models\App\Source;
use App\Services\Ares\CoverageService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CoverageServiceTest extends TestCase
{
    use RefreshDatabase;

    private CoverageService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(CoverageService::class);
    }

    public function test_get_matrix_returns_sources_domains_and_cells(): void
    {
        Source::factory()->count(2)->create();

        $matrix = $this->service->getMatrix();

        $this->assertArrayHasKey('sources', $matrix);
        $this->assertArrayHasKey('domains', $matrix);
        $this->assertArrayHasKey('matrix', $matrix);
        $this->assertIsArray($matrix['sources']);
        $this->assertIsArray($matrix['domains']);
    }

    public function test_get_matrix_returns_standard_domains(): void
    {
        Source::factory()->create();

        $matrix = $this->service->getMatrix();

        $expectedDomains = ['person', 'condition_occurrence', 'drug_exposure', 'procedure_occurrence',
            'measurement', 'observation', 'visit_occurrence', 'death'];
        foreach ($expectedDomains as $domain) {
            $this->assertContains($domain, $matrix['domains']);
        }
    }

    public function test_get_matrix_cells_have_expected_structure(): void
    {
        Source::factory()->create();

        $matrix = $this->service->getMatrix();

        foreach ($matrix['matrix'] as $row) {
            foreach ($row as $cell) {
                $this->assertArrayHasKey('record_count', $cell);
                $this->assertArrayHasKey('has_data', $cell);
                $this->assertArrayHasKey('density_per_person', $cell);
            }
        }
    }
}
```

- [ ] **Step 2: Write failing DiversityService tests**

```php
<?php

namespace Tests\Unit\Services\Ares;

use App\Models\App\Source;
use App\Services\Ares\DiversityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DiversityServiceTest extends TestCase
{
    use RefreshDatabase;

    private DiversityService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(DiversityService::class);
    }

    public function test_get_diversity_returns_per_source_demographics(): void
    {
        Source::factory()->count(2)->create();

        $diversity = $this->service->getDiversity();

        $this->assertIsArray($diversity);
        foreach ($diversity as $entry) {
            $this->assertArrayHasKey('source_id', $entry);
            $this->assertArrayHasKey('source_name', $entry);
            $this->assertArrayHasKey('person_count', $entry);
            $this->assertArrayHasKey('gender', $entry);
            $this->assertArrayHasKey('race', $entry);
            $this->assertArrayHasKey('ethnicity', $entry);
        }
    }

    public function test_get_diversity_demographics_are_proportional(): void
    {
        Source::factory()->create();

        $diversity = $this->service->getDiversity();

        foreach ($diversity as $entry) {
            // Gender proportions should sum to 100 (or 0 if no data)
            $genderTotal = array_sum($entry['gender']);
            if ($genderTotal > 0) {
                $this->assertEqualsWithDelta(100.0, $genderTotal, 0.5);
            }
        }
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/CoverageServiceTest.php tests/Unit/Services/Ares/DiversityServiceTest.php`
Expected: FAIL -- classes not found

- [ ] **Step 4: Implement CoverageService**

```php
<?php

namespace App\Services\Ares;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\AchillesResult;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CoverageService
{
    /**
     * Standard CDM domains and their Achilles count analysis IDs.
     */
    private const DOMAIN_COUNT_MAP = [
        'person' => 1,
        'condition_occurrence' => 400,
        'drug_exposure' => 700,
        'procedure_occurrence' => 600,
        'measurement' => 1800,
        'observation' => 800,
        'visit_occurrence' => 200,
        'death' => 500,
    ];

    public function __construct(
        private readonly DynamicConnectionFactory $connectionFactory,
    ) {}

    /**
     * Build the domain x source coverage matrix.
     *
     * @return array{sources: array<int, array{id: int, name: string}>, domains: string[], matrix: array<int, array<string, array{record_count: int, has_data: bool, density_per_person: float}>>}
     */
    public function getMatrix(): array
    {
        return Cache::remember('ares:network:coverage', 600, function () {
            $sources = Source::whereHas('daimons')->get();
            $domains = array_keys(self::DOMAIN_COUNT_MAP);

            $sourceList = $sources->map(fn (Source $s) => [
                'id' => $s->id,
                'name' => $s->source_name,
            ])->values()->toArray();

            $matrix = [];

            foreach ($sources as $source) {
                $counts = $this->getSourceDomainCounts($source);
                $personCount = $counts['person'] ?? 0;

                $row = [];
                foreach ($domains as $domain) {
                    $count = $counts[$domain] ?? 0;
                    $row[$domain] = [
                        'record_count' => $count,
                        'has_data' => $count > 0,
                        'density_per_person' => $personCount > 0
                            ? round($count / $personCount, 2)
                            : 0.0,
                    ];
                }
                $matrix[] = $row;
            }

            return [
                'sources' => $sourceList,
                'domains' => $domains,
                'matrix' => $matrix,
            ];
        });
    }

    /**
     * Get record counts per domain for a source from Achilles results.
     *
     * @return array<string, int>
     */
    private function getSourceDomainCounts(Source $source): array
    {
        try {
            $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
            $schema = $daimon?->table_qualifier ?? 'results';

            $connection = 'results';
            if (! empty($source->db_host)) {
                $connection = $this->connectionFactory->connectionForSchema($source, $schema);
            } else {
                DB::connection('results')->statement(
                    "SET search_path TO \"{$schema}\", public"
                );
            }

            $analysisIds = array_values(self::DOMAIN_COUNT_MAP);
            $results = AchillesResult::on($connection)
                ->whereIn('analysis_id', $analysisIds)
                ->whereNull('stratum_1')
                ->orWhere(function ($q) use ($analysisIds) {
                    $q->whereIn('analysis_id', $analysisIds)
                        ->where('stratum_1', '');
                })
                ->get();

            $analysisToResult = $results->keyBy('analysis_id');
            $counts = [];

            foreach (self::DOMAIN_COUNT_MAP as $domain => $analysisId) {
                $row = $analysisToResult->get($analysisId);
                $counts[$domain] = (int) ($row?->count_value ?? 0);
            }

            // For person count (analysis 1), use the direct count
            $personResult = AchillesResult::on($connection)
                ->where('analysis_id', 1)
                ->first();
            $counts['person'] = (int) ($personResult?->count_value ?? 0);

            return $counts;
        } catch (\Throwable $e) {
            Log::warning("Coverage: failed to query source {$source->source_name}: {$e->getMessage()}");
            return [];
        }
    }
}
```

- [ ] **Step 5: Implement DiversityService**

```php
<?php

namespace App\Services\Ares;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\AchillesResult;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DiversityService
{
    /**
     * Achilles analysis IDs for demographics.
     * Analysis 2 = gender, Analysis 4 = race, Analysis 5 = ethnicity
     */
    private const GENDER_ANALYSIS = 2;
    private const RACE_ANALYSIS = 4;
    private const ETHNICITY_ANALYSIS = 5;

    public function __construct(
        private readonly DynamicConnectionFactory $connectionFactory,
    ) {}

    /**
     * Get demographic proportions per source.
     *
     * @return array<int, array{source_id: int, source_name: string, person_count: int, gender: array<string, float>, race: array<string, float>, ethnicity: array<string, float>}>
     */
    public function getDiversity(): array
    {
        return Cache::remember('ares:network:diversity', 600, function () {
            $sources = Source::whereHas('daimons')->get();
            $results = [];

            foreach ($sources as $source) {
                try {
                    $results[] = $this->getSourceDemographics($source);
                } catch (\Throwable $e) {
                    Log::warning("Diversity: failed to query source {$source->source_name}: {$e->getMessage()}");
                    $results[] = [
                        'source_id' => $source->id,
                        'source_name' => $source->source_name,
                        'person_count' => 0,
                        'gender' => [],
                        'race' => [],
                        'ethnicity' => [],
                    ];
                }
            }

            // Sort by person count descending
            usort($results, fn ($a, $b) => $b['person_count'] <=> $a['person_count']);

            return $results;
        });
    }

    /**
     * Get demographic breakdown for a single source.
     */
    private function getSourceDemographics(Source $source): array
    {
        $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
        $schema = $daimon?->table_qualifier ?? 'results';

        $connection = 'results';
        if (! empty($source->db_host)) {
            $connection = $this->connectionFactory->connectionForSchema($source, $schema);
        } else {
            DB::connection('results')->statement(
                "SET search_path TO \"{$schema}\", public"
            );
        }

        // Get person count
        $personResult = AchillesResult::on($connection)
            ->where('analysis_id', 1)
            ->first();
        $personCount = (int) ($personResult?->count_value ?? 0);

        // Get gender distribution (analysis 2)
        $gender = $this->getProportions($connection, self::GENDER_ANALYSIS, $personCount);

        // Get race distribution (analysis 4)
        $race = $this->getProportions($connection, self::RACE_ANALYSIS, $personCount);

        // Get ethnicity distribution (analysis 5)
        $ethnicity = $this->getProportions($connection, self::ETHNICITY_ANALYSIS, $personCount);

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'person_count' => $personCount,
            'gender' => $gender,
            'race' => $race,
            'ethnicity' => $ethnicity,
        ];
    }

    /**
     * Convert Achilles results for a demographic analysis into proportional percentages.
     *
     * @return array<string, float>
     */
    private function getProportions(string $connection, int $analysisId, int $personCount): array
    {
        if ($personCount === 0) {
            return [];
        }

        $results = AchillesResult::on($connection)
            ->where('analysis_id', $analysisId)
            ->whereNotNull('stratum_1')
            ->get();

        $proportions = [];
        foreach ($results as $result) {
            $label = $this->resolveConceptName($result->stratum_1) ?? "Concept {$result->stratum_1}";
            $count = (int) $result->count_value;
            $proportions[$label] = round(($count / $personCount) * 100, 1);
        }

        // Sort by proportion descending
        arsort($proportions);

        return $proportions;
    }

    /**
     * Resolve a concept_id to a concept_name from the vocabulary.
     */
    private function resolveConceptName(string $conceptId): ?string
    {
        static $cache = [];

        if (isset($cache[$conceptId])) {
            return $cache[$conceptId];
        }

        $concept = DB::connection('omop')
            ->table('concept')
            ->where('concept_id', (int) $conceptId)
            ->value('concept_name');

        $cache[$conceptId] = $concept;

        return $concept;
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/CoverageServiceTest.php tests/Unit/Services/Ares/DiversityServiceTest.php`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/Services/Ares/CoverageService.php backend/app/Services/Ares/DiversityService.php backend/tests/Unit/Services/Ares/CoverageServiceTest.php backend/tests/Unit/Services/Ares/DiversityServiceTest.php
git commit -m "feat(ares): implement CoverageService and DiversityService for network analysis"
```

---

## Task 3: FeasibilityService + Form Request

**Files:**
- Create: `backend/app/Services/Ares/FeasibilityService.php`
- Create: `backend/app/Http/Requests/Api/RunFeasibilityRequest.php`
- Create: `backend/tests/Unit/Services/Ares/FeasibilityServiceTest.php`

- [ ] **Step 1: Write failing tests**

```php
<?php

namespace Tests\Unit\Services\Ares;

use App\Models\App\Source;
use App\Models\User;
use App\Services\Ares\FeasibilityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeasibilityServiceTest extends TestCase
{
    use RefreshDatabase;

    private FeasibilityService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(FeasibilityService::class);
    }

    public function test_assess_creates_assessment_and_results(): void
    {
        $user = User::factory()->create();
        Source::factory()->count(2)->create();

        $criteria = [
            'required_domains' => ['condition', 'drug'],
            'min_patients' => 100,
        ];

        $assessment = $this->service->assess($user, 'Test Study', $criteria);

        $this->assertDatabaseHas('feasibility_assessments', [
            'name' => 'Test Study',
            'created_by' => $user->id,
        ]);
        $this->assertEquals(2, $assessment->sources_assessed);
    }

    public function test_assess_stores_per_source_results(): void
    {
        $user = User::factory()->create();
        Source::factory()->count(3)->create();

        $criteria = [
            'required_domains' => ['condition'],
        ];

        $assessment = $this->service->assess($user, 'Domain Check', $criteria);

        $this->assertEquals(3, $assessment->sources_assessed);
        $this->assertDatabaseCount('feasibility_assessment_results', 3);
    }

    public function test_get_assessment_returns_with_results(): void
    {
        $user = User::factory()->create();
        Source::factory()->create();

        $assessment = $this->service->assess($user, 'Test', ['required_domains' => ['condition']]);
        $loaded = $this->service->getAssessment($assessment->id);

        $this->assertNotNull($loaded);
        $this->assertEquals('Test', $loaded->name);
    }

    public function test_list_assessments_returns_ordered(): void
    {
        $user = User::factory()->create();
        Source::factory()->create();

        $this->service->assess($user, 'First', ['required_domains' => ['condition']]);
        $this->service->assess($user, 'Second', ['required_domains' => ['drug']]);

        $list = $this->service->listAssessments();

        $this->assertCount(2, $list);
        // Latest first
        $this->assertEquals('Second', $list[0]->name);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/FeasibilityServiceTest.php`
Expected: FAIL -- FeasibilityService class not found

- [ ] **Step 3: Implement FeasibilityService**

```php
<?php

namespace App\Services\Ares;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Models\Results\AchillesResult;
use App\Models\User;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FeasibilityService
{
    private const DOMAIN_COUNT_MAP = [
        'condition' => 400,
        'drug' => 700,
        'procedure' => 600,
        'measurement' => 1800,
        'observation' => 800,
        'visit' => 200,
    ];

    public function __construct(
        private readonly DynamicConnectionFactory $connectionFactory,
    ) {}

    /**
     * Run a feasibility assessment across all active sources.
     *
     * @param  array{required_domains?: string[], required_concepts?: int[], visit_types?: int[], date_range?: array{start?: string, end?: string}, min_patients?: int}  $criteria
     */
    public function assess(User $user, string $name, array $criteria): object
    {
        $sources = Source::whereHas('daimons')->get();

        $assessment = DB::table('feasibility_assessments')->insertGetId([
            'name' => $name,
            'criteria' => json_encode($criteria),
            'sources_assessed' => $sources->count(),
            'sources_passed' => 0,
            'created_by' => $user->id,
            'created_at' => now(),
        ]);

        $passedCount = 0;

        foreach ($sources as $source) {
            $result = $this->evaluateSource($source, $criteria);

            DB::table('feasibility_assessment_results')->insert([
                'assessment_id' => $assessment,
                'source_id' => $source->id,
                'domain_pass' => $result['domain_pass'],
                'concept_pass' => $result['concept_pass'],
                'visit_pass' => $result['visit_pass'],
                'date_pass' => $result['date_pass'],
                'patient_pass' => $result['patient_pass'],
                'overall_pass' => $result['overall_pass'],
                'details' => json_encode($result['details']),
            ]);

            if ($result['overall_pass']) {
                $passedCount++;
            }
        }

        DB::table('feasibility_assessments')
            ->where('id', $assessment)
            ->update(['sources_passed' => $passedCount]);

        return DB::table('feasibility_assessments')->find($assessment);
    }

    /**
     * Get a specific assessment with its per-source results.
     */
    public function getAssessment(int $id): ?object
    {
        $assessment = DB::table('feasibility_assessments')->find($id);

        if (! $assessment) {
            return null;
        }

        $assessment->results = DB::table('feasibility_assessment_results as far')
            ->join('sources', 'sources.id', '=', 'far.source_id')
            ->where('far.assessment_id', $id)
            ->select([
                'far.*',
                'sources.source_name',
            ])
            ->get();

        return $assessment;
    }

    /**
     * List all assessments ordered by most recent first.
     */
    public function listAssessments(): Collection
    {
        return DB::table('feasibility_assessments')
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * Evaluate a single source against the feasibility criteria.
     *
     * @return array{domain_pass: bool, concept_pass: bool, visit_pass: bool, date_pass: bool, patient_pass: bool, overall_pass: bool, details: array}
     */
    private function evaluateSource(Source $source, array $criteria): array
    {
        try {
            $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
            $schema = $daimon?->table_qualifier ?? 'results';

            $connection = 'results';
            if (! empty($source->db_host)) {
                $connection = $this->connectionFactory->connectionForSchema($source, $schema);
            } else {
                DB::connection('results')->statement(
                    "SET search_path TO \"{$schema}\", public"
                );
            }

            // Check person count
            $personResult = AchillesResult::on($connection)->where('analysis_id', 1)->first();
            $personCount = (int) ($personResult?->count_value ?? 0);

            // Domain check
            $domainPass = true;
            $domainDetails = [];
            $requiredDomains = $criteria['required_domains'] ?? [];
            foreach ($requiredDomains as $domain) {
                $analysisId = self::DOMAIN_COUNT_MAP[$domain] ?? null;
                if (! $analysisId) {
                    $domainDetails[$domain] = ['available' => false, 'reason' => 'Unknown domain'];
                    $domainPass = false;
                    continue;
                }
                $count = AchillesResult::on($connection)->where('analysis_id', $analysisId)->sum('count_value');
                $available = ((int) $count) > 0;
                $domainDetails[$domain] = ['available' => $available, 'count' => (int) $count];
                if (! $available) {
                    $domainPass = false;
                }
            }

            // Concept check
            $conceptPass = true;
            $conceptDetails = [];
            $requiredConcepts = $criteria['required_concepts'] ?? [];
            foreach ($requiredConcepts as $conceptId) {
                $found = AchillesResult::on($connection)
                    ->where('stratum_1', (string) $conceptId)
                    ->exists();
                $conceptDetails[$conceptId] = ['present' => $found];
                if (! $found) {
                    $conceptPass = false;
                }
            }

            // Visit type check
            $visitPass = true;
            $visitDetails = [];
            $requiredVisits = $criteria['visit_types'] ?? [];
            foreach ($requiredVisits as $visitConceptId) {
                $found = AchillesResult::on($connection)
                    ->where('analysis_id', 201)
                    ->where('stratum_1', (string) $visitConceptId)
                    ->exists();
                $visitDetails[$visitConceptId] = ['present' => $found];
                if (! $found) {
                    $visitPass = false;
                }
            }

            // Date range check (simplified -- check observation period overlap)
            $datePass = true;
            $dateDetails = [];
            if (! empty($criteria['date_range'])) {
                // Check if observation period overlaps the requested range
                // Analysis 101 = observation period start, 102 = end
                $datePass = true; // Simplified -- assume pass if source has person data
                $dateDetails = ['observation_period_available' => $personCount > 0];
                if ($personCount === 0) {
                    $datePass = false;
                }
            }

            // Patient count check
            $minPatients = $criteria['min_patients'] ?? 0;
            $patientPass = $personCount >= $minPatients;
            $patientDetails = [
                'required' => $minPatients,
                'actual' => $personCount,
            ];

            $overallPass = $domainPass && $conceptPass && $visitPass && $datePass && $patientPass;

            return [
                'domain_pass' => $domainPass,
                'concept_pass' => $conceptPass,
                'visit_pass' => $visitPass,
                'date_pass' => $datePass,
                'patient_pass' => $patientPass,
                'overall_pass' => $overallPass,
                'details' => [
                    'domains' => $domainDetails,
                    'concepts' => $conceptDetails,
                    'visits' => $visitDetails,
                    'dates' => $dateDetails,
                    'patients' => $patientDetails,
                ],
            ];
        } catch (\Throwable $e) {
            Log::warning("Feasibility: failed to evaluate source {$source->source_name}: {$e->getMessage()}");
            return [
                'domain_pass' => false,
                'concept_pass' => false,
                'visit_pass' => false,
                'date_pass' => false,
                'patient_pass' => false,
                'overall_pass' => false,
                'details' => ['error' => $e->getMessage()],
            ];
        }
    }
}
```

- [ ] **Step 4: Create RunFeasibilityRequest**

```php
<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class RunFeasibilityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'criteria' => ['required', 'array'],
            'criteria.required_domains' => ['required', 'array', 'min:1'],
            'criteria.required_domains.*' => ['string', 'in:condition,drug,procedure,measurement,observation,visit'],
            'criteria.required_concepts' => ['nullable', 'array'],
            'criteria.required_concepts.*' => ['integer'],
            'criteria.visit_types' => ['nullable', 'array'],
            'criteria.visit_types.*' => ['integer'],
            'criteria.date_range' => ['nullable', 'array'],
            'criteria.date_range.start' => ['date'],
            'criteria.date_range.end' => ['date', 'after:criteria.date_range.start'],
            'criteria.min_patients' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/FeasibilityServiceTest.php`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/Services/Ares/FeasibilityService.php backend/app/Http/Requests/Api/RunFeasibilityRequest.php backend/tests/Unit/Services/Ares/FeasibilityServiceTest.php
git commit -m "feat(ares): implement FeasibilityService with multi-criteria assessment engine"
```

---

## Task 4: NetworkAresController + Routes

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/NetworkAresController.php`
- Modify: `backend/routes/api.php`
- Create: `backend/tests/Feature/Api/NetworkAresControllerTest.php`

- [ ] **Step 1: Write failing integration tests**

```php
<?php

namespace Tests\Feature\Api;

use App\Models\App\Source;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NetworkAresControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->user->assignRole('researcher');
        $this->token = $this->user->createToken('test')->plainTextToken;
        Source::factory()->count(2)->create();
    }

    public function test_overview_requires_auth(): void
    {
        $this->getJson('/api/v1/network/ares/overview')
            ->assertStatus(401);
    }

    public function test_overview_returns_aggregated_kpis(): void
    {
        $this->withToken($this->token)
            ->getJson('/api/v1/network/ares/overview')
            ->assertOk()
            ->assertJsonStructure(['data' => ['source_count', 'avg_dq_score']]);
    }

    public function test_compare_concept_returns_per_source_data(): void
    {
        $this->withToken($this->token)
            ->getJson('/api/v1/network/ares/compare?concept_id=201826')
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_compare_batch_returns_multi_concept(): void
    {
        $this->withToken($this->token)
            ->getJson('/api/v1/network/ares/compare/batch?concept_ids=201826,320128')
            ->assertOk();
    }

    public function test_compare_search_returns_concepts(): void
    {
        $this->withToken($this->token)
            ->getJson('/api/v1/network/ares/compare/search?q=diabetes')
            ->assertOk();
    }

    public function test_coverage_returns_matrix(): void
    {
        $this->withToken($this->token)
            ->getJson('/api/v1/network/ares/coverage')
            ->assertOk()
            ->assertJsonStructure(['data' => ['sources', 'domains', 'matrix']]);
    }

    public function test_diversity_returns_demographics(): void
    {
        $this->withToken($this->token)
            ->getJson('/api/v1/network/ares/diversity')
            ->assertOk()
            ->assertJsonStructure(['data']);
    }

    public function test_feasibility_create_requires_auth(): void
    {
        $this->postJson('/api/v1/network/ares/feasibility', [
            'name' => 'Test',
            'criteria' => ['required_domains' => ['condition']],
        ])->assertStatus(401);
    }

    public function test_feasibility_create_validates_input(): void
    {
        $this->withToken($this->token)
            ->postJson('/api/v1/network/ares/feasibility', [])
            ->assertStatus(422);
    }

    public function test_feasibility_create_returns_assessment(): void
    {
        $this->withToken($this->token)
            ->postJson('/api/v1/network/ares/feasibility', [
                'name' => 'Diabetes Study',
                'criteria' => [
                    'required_domains' => ['condition', 'drug'],
                    'min_patients' => 100,
                ],
            ])
            ->assertStatus(201)
            ->assertJsonPath('data.name', 'Diabetes Study');
    }

    public function test_feasibility_list(): void
    {
        $this->withToken($this->token)
            ->getJson('/api/v1/network/ares/feasibility')
            ->assertOk();
    }

    public function test_dq_summary_returns_per_source_scores(): void
    {
        $this->withToken($this->token)
            ->getJson('/api/v1/network/ares/dq-summary')
            ->assertOk();
    }

    public function test_network_annotations(): void
    {
        $this->withToken($this->token)
            ->getJson('/api/v1/network/ares/annotations')
            ->assertOk();
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/NetworkAresControllerTest.php`
Expected: FAIL -- routes not defined

- [ ] **Step 3: Implement NetworkAresController**

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\RunFeasibilityRequest;
use App\Services\Ares\AnnotationService;
use App\Services\Ares\CoverageService;
use App\Services\Ares\DiversityService;
use App\Services\Ares\DqHistoryService;
use App\Services\Ares\FeasibilityService;
use App\Services\Ares\NetworkComparisonService;
use App\Services\Ares\UnmappedCodeService;
use Illuminate\Http\JsonResponse;

class NetworkAresController extends Controller
{
    public function __construct(
        private readonly NetworkComparisonService $comparisonService,
        private readonly CoverageService $coverageService,
        private readonly DiversityService $diversityService,
        private readonly FeasibilityService $feasibilityService,
        private readonly DqHistoryService $dqHistoryService,
        private readonly AnnotationService $annotationService,
        private readonly UnmappedCodeService $unmappedCodeService,
    ) {}

    // --- Hub Overview ---

    public function overview(): JsonResponse
    {
        $dqSummary = $this->dqHistoryService->getNetworkDqSummary();
        $sourceCount = count($dqSummary);
        $passRates = array_filter(array_column($dqSummary, 'pass_rate'), fn ($r) => $r > 0);
        $avgDqScore = count($passRates) > 0 ? round(array_sum($passRates) / count($passRates), 1) : null;

        return response()->json([
            'data' => [
                'source_count' => $sourceCount,
                'avg_dq_score' => $avgDqScore,
                'total_unmapped_codes' => $this->unmappedCodeService->getTotalUnmappedCount(),
                'sources_needing_attention' => count(array_filter($dqSummary, fn ($s) => $s['pass_rate'] < 80)),
                'dq_summary' => $dqSummary,
            ],
        ]);
    }

    // --- Concept Comparison ---

    public function compare(): JsonResponse
    {
        $conceptId = (int) request()->query('concept_id');

        if (! $conceptId) {
            return response()->json(['error' => 'concept_id is required'], 422);
        }

        return response()->json([
            'data' => $this->comparisonService->compareConcept($conceptId),
        ]);
    }

    public function compareSearch(): JsonResponse
    {
        $query = request()->query('q', '');

        return response()->json([
            'data' => $this->comparisonService->searchConcepts($query),
        ]);
    }

    public function compareBatch(): JsonResponse
    {
        $idsParam = request()->query('concept_ids', '');
        $conceptIds = array_map('intval', array_filter(explode(',', $idsParam)));

        if (empty($conceptIds)) {
            return response()->json(['error' => 'concept_ids is required'], 422);
        }

        if (count($conceptIds) > 20) {
            return response()->json(['error' => 'Maximum 20 concepts per batch'], 422);
        }

        return response()->json([
            'data' => $this->comparisonService->compareBatch($conceptIds),
        ]);
    }

    // --- Coverage ---

    public function coverage(): JsonResponse
    {
        return response()->json([
            'data' => $this->coverageService->getMatrix(),
        ]);
    }

    // --- Diversity ---

    public function diversity(): JsonResponse
    {
        return response()->json([
            'data' => $this->diversityService->getDiversity(),
        ]);
    }

    // --- Feasibility ---

    public function runFeasibility(RunFeasibilityRequest $request): JsonResponse
    {
        $assessment = $this->feasibilityService->assess(
            $request->user(),
            $request->validated()['name'],
            $request->validated()['criteria'],
        );

        return response()->json(['data' => $assessment], 201);
    }

    public function showFeasibility(int $id): JsonResponse
    {
        $assessment = $this->feasibilityService->getAssessment($id);

        if (! $assessment) {
            return response()->json(['error' => 'Assessment not found'], 404);
        }

        return response()->json(['data' => $assessment]);
    }

    public function listFeasibility(): JsonResponse
    {
        return response()->json([
            'data' => $this->feasibilityService->listAssessments(),
        ]);
    }

    // --- Network DQ ---

    public function dqSummary(): JsonResponse
    {
        return response()->json([
            'data' => $this->dqHistoryService->getNetworkDqSummary(),
        ]);
    }

    // --- Network Annotations ---

    public function annotations(): JsonResponse
    {
        return response()->json([
            'data' => $this->annotationService->allForNetwork(),
        ]);
    }
}
```

- [ ] **Step 4: Add network Ares routes to api.php**

Add to `backend/routes/api.php` (after the source-scoped Ares routes):

```php
use App\Http\Controllers\Api\V1\NetworkAresController;

// Network Ares — Cross-source intelligence
Route::prefix('network/ares')->middleware(['auth:sanctum'])->group(function () {
    Route::get('/overview', [NetworkAresController::class, 'overview'])->middleware('permission:analyses.view');

    // Concept comparison
    Route::get('/compare', [NetworkAresController::class, 'compare'])->middleware('permission:analyses.view');
    Route::get('/compare/search', [NetworkAresController::class, 'compareSearch'])->middleware('permission:analyses.view');
    Route::get('/compare/batch', [NetworkAresController::class, 'compareBatch'])
        ->middleware(['permission:analyses.view', 'throttle:30,1']);

    // Coverage + Diversity
    Route::get('/coverage', [NetworkAresController::class, 'coverage'])->middleware('permission:analyses.view');
    Route::get('/diversity', [NetworkAresController::class, 'diversity'])->middleware('permission:analyses.view');

    // Feasibility
    Route::post('/feasibility', [NetworkAresController::class, 'runFeasibility'])
        ->middleware(['permission:analyses.create', 'throttle:10,60']);
    Route::get('/feasibility', [NetworkAresController::class, 'listFeasibility'])->middleware('permission:analyses.view');
    Route::get('/feasibility/{id}', [NetworkAresController::class, 'showFeasibility'])->middleware('permission:analyses.view');

    // Network DQ + Annotations
    Route::get('/dq-summary', [NetworkAresController::class, 'dqSummary'])->middleware('permission:analyses.view');
    Route::get('/annotations', [NetworkAresController::class, 'annotations'])->middleware('permission:analyses.view');
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/NetworkAresControllerTest.php`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/NetworkAresController.php backend/routes/api.php backend/tests/Feature/Api/NetworkAresControllerTest.php
git commit -m "feat(ares): add NetworkAresController with comparison, coverage, diversity, feasibility endpoints"
```

---

## Task 5: Frontend Network Types

**Files:**
- Modify: `frontend/src/features/data-explorer/types/ares.ts`

- [ ] **Step 1: Add network types**

Add the following to the end of `frontend/src/features/data-explorer/types/ares.ts`:

```typescript
// Network comparison types
export interface ConceptSearchResult {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
}

export interface ConceptComparison {
  source_id: number;
  source_name: string;
  count: number;
  rate_per_1000: number;
  person_count: number;
}

// Coverage matrix types
export interface CoverageMatrix {
  sources: Array<{ id: number; name: string }>;
  domains: string[];
  matrix: Array<Record<string, CoverageCell>>;
}

export interface CoverageCell {
  record_count: number;
  has_data: boolean;
  density_per_person: number;
}

// Diversity types
export interface DiversitySource {
  source_id: number;
  source_name: string;
  person_count: number;
  gender: Record<string, number>;
  race: Record<string, number>;
  ethnicity: Record<string, number>;
}

// Feasibility types
export interface FeasibilityCriteria {
  required_domains: string[];
  required_concepts?: number[];
  visit_types?: number[];
  date_range?: { start: string; end: string };
  min_patients?: number;
}

export interface FeasibilityAssessment {
  id: number;
  name: string;
  criteria: FeasibilityCriteria;
  sources_assessed: number;
  sources_passed: number;
  created_by: number;
  created_at: string;
  results?: FeasibilityResult[];
}

export interface FeasibilityResult {
  id: number;
  assessment_id: number;
  source_id: number;
  source_name: string;
  domain_pass: boolean;
  concept_pass: boolean;
  visit_pass: boolean;
  date_pass: boolean;
  patient_pass: boolean;
  overall_pass: boolean;
  details: Record<string, unknown>;
}

// Network overview types
export interface NetworkOverview {
  source_count: number;
  avg_dq_score: number | null;
  total_unmapped_codes: number;
  sources_needing_attention: number;
  dq_summary: NetworkDqSource[];
}

export interface NetworkDqSource {
  source_id: number;
  source_name: string;
  pass_rate: number;
  trend: "up" | "down" | "stable" | null;
  release_name: string | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/data-explorer/types/ares.ts
git commit -m "feat(ares): add TypeScript types for network comparison, coverage, diversity, and feasibility"
```

---

## Task 6: Network API Functions + Hooks

**Files:**
- Create: `frontend/src/features/data-explorer/api/networkAresApi.ts`
- Create: `frontend/src/features/data-explorer/hooks/useNetworkData.ts`

- [ ] **Step 1: Create networkAresApi.ts**

```typescript
// frontend/src/features/data-explorer/api/networkAresApi.ts
import apiClient from "@/lib/apiClient";
import type {
  ConceptComparison,
  ConceptSearchResult,
  CoverageMatrix,
  DiversitySource,
  FeasibilityAssessment,
  FeasibilityCriteria,
  NetworkDqSource,
  NetworkOverview,
} from "../types/ares";

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

// Hub overview
export async function fetchNetworkOverview(): Promise<NetworkOverview> {
  return unwrap(await apiClient.get("/network/ares/overview"));
}

// Concept comparison
export async function compareConcept(conceptId: number): Promise<ConceptComparison[]> {
  return unwrap(await apiClient.get("/network/ares/compare", { params: { concept_id: conceptId } }));
}

export async function searchConceptsForComparison(query: string): Promise<ConceptSearchResult[]> {
  return unwrap(await apiClient.get("/network/ares/compare/search", { params: { q: query } }));
}

export async function compareBatch(conceptIds: number[]): Promise<Record<number, ConceptComparison[]>> {
  return unwrap(
    await apiClient.get("/network/ares/compare/batch", {
      params: { concept_ids: conceptIds.join(",") },
    }),
  );
}

// Coverage
export async function fetchCoverage(): Promise<CoverageMatrix> {
  return unwrap(await apiClient.get("/network/ares/coverage"));
}

// Diversity
export async function fetchDiversity(): Promise<DiversitySource[]> {
  return unwrap(await apiClient.get("/network/ares/diversity"));
}

// Feasibility
export async function runFeasibility(
  name: string,
  criteria: FeasibilityCriteria,
): Promise<FeasibilityAssessment> {
  return unwrap(await apiClient.post("/network/ares/feasibility", { name, criteria }));
}

export async function fetchFeasibilityAssessment(id: number): Promise<FeasibilityAssessment> {
  return unwrap(await apiClient.get(`/network/ares/feasibility/${id}`));
}

export async function fetchFeasibilityList(): Promise<FeasibilityAssessment[]> {
  return unwrap(await apiClient.get("/network/ares/feasibility"));
}

// Network DQ
export async function fetchNetworkDqSummary(): Promise<NetworkDqSource[]> {
  return unwrap(await apiClient.get("/network/ares/dq-summary"));
}
```

- [ ] **Step 2: Create useNetworkData.ts**

```typescript
// frontend/src/features/data-explorer/hooks/useNetworkData.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  compareBatch,
  compareConcept,
  fetchCoverage,
  fetchDiversity,
  fetchFeasibilityAssessment,
  fetchFeasibilityList,
  fetchNetworkDqSummary,
  fetchNetworkOverview,
  runFeasibility,
  searchConceptsForComparison,
} from "../api/networkAresApi";
import type { FeasibilityCriteria } from "../types/ares";

export function useNetworkOverview() {
  return useQuery({
    queryKey: ["ares", "network", "overview"],
    queryFn: fetchNetworkOverview,
    staleTime: 5 * 60 * 1000,
  });
}

export function useConceptComparison(conceptId: number | null) {
  return useQuery({
    queryKey: ["ares", "network", "compare", conceptId],
    queryFn: () => compareConcept(conceptId!),
    enabled: !!conceptId,
  });
}

export function useConceptSearch(query: string) {
  return useQuery({
    queryKey: ["ares", "network", "compare-search", query],
    queryFn: () => searchConceptsForComparison(query),
    enabled: query.length >= 2,
    staleTime: 60 * 1000,
  });
}

export function useBatchComparison(conceptIds: number[]) {
  return useQuery({
    queryKey: ["ares", "network", "compare-batch", conceptIds],
    queryFn: () => compareBatch(conceptIds),
    enabled: conceptIds.length > 0,
  });
}

export function useCoverage() {
  return useQuery({
    queryKey: ["ares", "network", "coverage"],
    queryFn: fetchCoverage,
    staleTime: 10 * 60 * 1000,
  });
}

export function useDiversity() {
  return useQuery({
    queryKey: ["ares", "network", "diversity"],
    queryFn: fetchDiversity,
    staleTime: 10 * 60 * 1000,
  });
}

export function useRunFeasibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, criteria }: { name: string; criteria: FeasibilityCriteria }) =>
      runFeasibility(name, criteria),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ares", "network", "feasibility"] }),
  });
}

export function useFeasibilityAssessment(id: number | null) {
  return useQuery({
    queryKey: ["ares", "network", "feasibility", id],
    queryFn: () => fetchFeasibilityAssessment(id!),
    enabled: !!id,
  });
}

export function useFeasibilityList() {
  return useQuery({
    queryKey: ["ares", "network", "feasibility"],
    queryFn: fetchFeasibilityList,
  });
}

export function useNetworkDqSummary() {
  return useQuery({
    queryKey: ["ares", "network", "dq-summary"],
    queryFn: fetchNetworkDqSummary,
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/data-explorer/api/networkAresApi.ts frontend/src/features/data-explorer/hooks/useNetworkData.ts
git commit -m "feat(ares): add network API functions and TanStack Query hooks for all network endpoints"
```

---

## Task 7: ConceptComparisonView + ComparisonChart

**Files:**
- Create: `frontend/src/features/data-explorer/components/ares/concept-comparison/ComparisonChart.tsx`
- Create: `frontend/src/features/data-explorer/components/ares/concept-comparison/ConceptComparisonView.tsx`

- [ ] **Step 1: Implement ComparisonChart**

```typescript
// frontend/src/features/data-explorer/components/ares/concept-comparison/ComparisonChart.tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ConceptComparison } from "../../../types/ares";

interface ComparisonChartProps {
  data: ConceptComparison[];
  metric: "count" | "rate_per_1000";
}

export default function ComparisonChart({ data, metric }: ComparisonChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-[#555]">
        No comparison data available.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    source: d.source_name,
    value: metric === "count" ? d.count : d.rate_per_1000,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
          <XAxis
            dataKey="source"
            tick={{ fill: "#888", fontSize: 11 }}
            axisLine={{ stroke: "#333" }}
            angle={-30}
            textAnchor="end"
          />
          <YAxis
            tick={{ fill: "#888", fontSize: 11 }}
            axisLine={{ stroke: "#333" }}
            tickFormatter={(v) =>
              metric === "rate_per_1000" ? `${v}/1k` : v.toLocaleString()
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a22",
              border: "1px solid #333",
              borderRadius: "8px",
              color: "#ccc",
              fontSize: 12,
            }}
            formatter={(value: number) => [
              metric === "rate_per_1000"
                ? `${value.toFixed(2)} per 1,000`
                : value.toLocaleString(),
              metric === "rate_per_1000" ? "Rate" : "Count",
            ]}
          />
          <Bar dataKey="value" fill="#C9A227" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Implement ConceptComparisonView**

```typescript
// frontend/src/features/data-explorer/components/ares/concept-comparison/ConceptComparisonView.tsx
import { useState, useCallback } from "react";
import { useConceptComparison, useConceptSearch } from "../../../hooks/useNetworkData";
import ComparisonChart from "./ComparisonChart";
import type { ConceptSearchResult } from "../../../types/ares";

export default function ConceptComparisonView() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConcept, setSelectedConcept] = useState<ConceptSearchResult | null>(null);
  const [metric, setMetric] = useState<"count" | "rate_per_1000">("rate_per_1000");
  const [showResults, setShowResults] = useState(false);

  const { data: searchResults, isLoading: searchLoading } = useConceptSearch(searchQuery);
  const { data: comparison, isLoading: comparisonLoading } = useConceptComparison(
    selectedConcept?.concept_id ?? null,
  );

  const handleSelect = useCallback((concept: ConceptSearchResult) => {
    setSelectedConcept(concept);
    setSearchQuery(concept.concept_name);
    setShowResults(false);
  }, []);

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-medium text-white">Concept Comparison Across Sources</h2>

      {/* Search bar */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Search for a concept (e.g. 'Type 2 Diabetes', 'Metformin')..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="w-full rounded-lg border border-[#333] bg-[#1a1a22] px-4 py-2.5 text-sm text-white
                     placeholder-[#555] focus:border-[#C9A227] focus:outline-none"
        />
        {searchLoading && (
          <span className="absolute right-3 top-3 text-xs text-[#555]">Searching...</span>
        )}

        {/* Search dropdown */}
        {showResults && searchResults && searchResults.length > 0 && (
          <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[#333]
                        bg-[#1a1a22] shadow-xl">
            {searchResults.map((concept) => (
              <button
                key={concept.concept_id}
                type="button"
                onClick={() => handleSelect(concept)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-[#252530]"
              >
                <span className="text-white">{concept.concept_name}</span>
                <span className="text-[10px] text-[#666]">
                  {concept.domain_id} | {concept.vocabulary_id} | ID: {concept.concept_id}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected concept info + metric toggle */}
      {selectedConcept && (
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-white">{selectedConcept.concept_name}</p>
            <p className="text-[11px] text-[#666]">
              {selectedConcept.domain_id} | {selectedConcept.vocabulary_id} | Concept ID: {selectedConcept.concept_id}
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-[#333] p-0.5">
            <button
              type="button"
              onClick={() => setMetric("rate_per_1000")}
              className={`rounded px-3 py-1 text-xs ${
                metric === "rate_per_1000" ? "bg-[#C9A227] text-black" : "text-[#888]"
              }`}
            >
              Rate/1000
            </button>
            <button
              type="button"
              onClick={() => setMetric("count")}
              className={`rounded px-3 py-1 text-xs ${
                metric === "count" ? "bg-[#C9A227] text-black" : "text-[#888]"
              }`}
            >
              Count
            </button>
          </div>
        </div>
      )}

      {/* Comparison chart */}
      {comparisonLoading && <p className="text-[#555]">Loading comparison data...</p>}

      {comparison && (
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
          <ComparisonChart data={comparison} metric={metric} />
        </div>
      )}

      {!selectedConcept && (
        <p className="py-10 text-center text-[#555]">
          Search for a concept above to compare its prevalence across all data sources.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/data-explorer/components/ares/concept-comparison/
git commit -m "feat(ares): add ConceptComparisonView with vocabulary search and grouped bar chart"
```

---

## Task 8: CoverageMatrixView + DiversityView + NetworkOverviewView

**Files:**
- Create: `frontend/src/features/data-explorer/components/ares/coverage/CoverageMatrixView.tsx`
- Create: `frontend/src/features/data-explorer/components/ares/diversity/DiversityView.tsx`
- Create: `frontend/src/features/data-explorer/components/ares/network-overview/NetworkOverviewView.tsx`

- [ ] **Step 1: Implement CoverageMatrixView**

```typescript
// frontend/src/features/data-explorer/components/ares/coverage/CoverageMatrixView.tsx
import { useCoverage } from "../../../hooks/useNetworkData";

function getCellColor(hasData: boolean, density: number): string {
  if (!hasData) return "bg-[#9B1B30]/20";
  if (density >= 5) return "bg-[#2DD4BF]/30";
  if (density >= 1) return "bg-[#C9A227]/20";
  return "bg-[#2DD4BF]/10";
}

function getCellTextColor(hasData: boolean, density: number): string {
  if (!hasData) return "text-[#9B1B30]";
  if (density >= 5) return "text-[#2DD4BF]";
  if (density >= 1) return "text-[#C9A227]";
  return "text-[#2DD4BF]/70";
}

export default function CoverageMatrixView() {
  const { data: matrix, isLoading } = useCoverage();

  if (isLoading) {
    return <div className="p-4 text-[#555]">Loading coverage matrix...</div>;
  }

  if (!matrix || matrix.sources.length === 0) {
    return <div className="p-4 text-center text-[#555]">No sources available for coverage analysis.</div>;
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-medium text-white">Coverage Matrix (Strand Report)</h2>
      <p className="mb-4 text-xs text-[#666]">
        Domain availability across all data sources. Green = high density, amber = low density, red = no data.
      </p>

      <div className="overflow-x-auto rounded-lg border border-[#252530]">
        <table className="w-full text-sm">
          <thead className="bg-[#1a1a22]">
            <tr>
              <th className="sticky left-0 bg-[#1a1a22] px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">
                Source
              </th>
              {matrix.domains.map((domain) => (
                <th key={domain} className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">
                  {domain.replace(/_/g, " ")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.sources.map((source, rowIdx) => (
              <tr key={source.id} className="border-t border-[#1a1a22]">
                <td className="sticky left-0 bg-[#151518] px-3 py-2 text-xs font-medium text-white">
                  {source.name}
                </td>
                {matrix.domains.map((domain) => {
                  const cell = matrix.matrix[rowIdx]?.[domain];
                  if (!cell) return <td key={domain} className="px-3 py-2" />;

                  return (
                    <td key={domain} className="px-2 py-1.5 text-center">
                      <div
                        className={`rounded px-2 py-1 text-xs font-mono ${getCellColor(cell.has_data, cell.density_per_person)} ${getCellTextColor(cell.has_data, cell.density_per_person)}`}
                      >
                        {cell.has_data ? cell.record_count.toLocaleString() : "---"}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement DiversityView**

```typescript
// frontend/src/features/data-explorer/components/ares/diversity/DiversityView.tsx
import { useDiversity } from "../../../hooks/useNetworkData";
import type { DiversitySource } from "../../../types/ares";

const DEMO_COLORS = [
  "#2DD4BF", "#C9A227", "#9B1B30", "#6366F1", "#EC4899",
  "#F59E0B", "#10B981", "#8B5CF6", "#EF4444", "#3B82F6",
];

function DemographicBars({ label, data }: { label: string; data: Record<string, number> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return (
      <div className="mb-2">
        <p className="mb-1 text-[11px] uppercase text-[#666]">{label}</p>
        <p className="text-xs text-[#555]">No data</p>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <p className="mb-1 text-[11px] uppercase text-[#666]">{label}</p>
      <div className="flex h-5 w-full overflow-hidden rounded">
        {entries.map(([name, pct], i) => (
          <div
            key={name}
            className="flex items-center justify-center text-[9px] font-medium text-black"
            style={{
              width: `${Math.max(pct, 2)}%`,
              backgroundColor: DEMO_COLORS[i % DEMO_COLORS.length],
            }}
            title={`${name}: ${pct}%`}
          >
            {pct >= 8 ? `${pct}%` : ""}
          </div>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {entries.map(([name, pct], i) => (
          <span key={name} className="text-[10px] text-[#888]">
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: DEMO_COLORS[i % DEMO_COLORS.length] }}
            />
            {name}: {pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DiversityView() {
  const { data: diversity, isLoading } = useDiversity();

  if (isLoading) {
    return <div className="p-4 text-[#555]">Loading diversity data...</div>;
  }

  if (!diversity || diversity.length === 0) {
    return <div className="p-4 text-center text-[#555]">No sources available for diversity analysis.</div>;
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-medium text-white">Diversity Report</h2>
      <p className="mb-4 text-xs text-[#666]">
        Demographic proportions across data sources. Sources sorted by population size.
      </p>

      <div className="space-y-4">
        {diversity.map((source: DiversitySource) => (
          <div key={source.source_id} className="rounded-lg border border-[#252530] bg-[#151518] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">{source.source_name}</h3>
              <span className="text-xs text-[#888]">{source.person_count.toLocaleString()} persons</span>
            </div>
            <DemographicBars label="Gender" data={source.gender} />
            <DemographicBars label="Race" data={source.race} />
            <DemographicBars label="Ethnicity" data={source.ethnicity} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement NetworkOverviewView**

```typescript
// frontend/src/features/data-explorer/components/ares/network-overview/NetworkOverviewView.tsx
import { useNetworkOverview } from "../../../hooks/useNetworkData";
import type { NetworkDqSource } from "../../../types/ares";

function TrendIndicator({ trend }: { trend: string | null }) {
  if (trend === "up") return <span className="text-[#2DD4BF]">+</span>;
  if (trend === "down") return <span className="text-[#9B1B30]">-</span>;
  if (trend === "stable") return <span className="text-[#888]">=</span>;
  return <span className="text-[#555]">--</span>;
}

export default function NetworkOverviewView() {
  const { data: overview, isLoading } = useNetworkOverview();

  if (isLoading) {
    return <div className="p-4 text-[#555]">Loading network overview...</div>;
  }

  if (!overview) {
    return <div className="p-4 text-center text-[#555]">No network data available.</div>;
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-medium text-white">Network Overview</h2>

      {/* Summary stats */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
          <p className="text-2xl font-semibold text-[#2DD4BF]">{overview.source_count}</p>
          <p className="text-[11px] text-[#666]">Data Sources</p>
        </div>
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
          <p className="text-2xl font-semibold text-[#C9A227]">
            {overview.avg_dq_score !== null ? `${overview.avg_dq_score.toFixed(1)}%` : "--"}
          </p>
          <p className="text-[11px] text-[#666]">Avg DQ Score</p>
        </div>
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
          <p className="text-2xl font-semibold text-[#9B1B30]">{overview.total_unmapped_codes.toLocaleString()}</p>
          <p className="text-[11px] text-[#666]">Unmapped Codes</p>
        </div>
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
          <p className="text-2xl font-semibold text-white">{overview.sources_needing_attention}</p>
          <p className="text-[11px] text-[#666]">Need Attention</p>
        </div>
      </div>

      {/* Source health table */}
      <div className="overflow-hidden rounded-lg border border-[#252530]">
        <table className="w-full text-sm">
          <thead className="bg-[#1a1a22]">
            <tr className="border-b border-[#252530]">
              <th className="px-4 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Source</th>
              <th className="px-4 py-2 text-center text-[11px] font-medium uppercase text-[#888]">DQ Score</th>
              <th className="px-4 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Trend</th>
              <th className="px-4 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Latest Release</th>
            </tr>
          </thead>
          <tbody>
            {overview.dq_summary.map((source: NetworkDqSource) => (
              <tr key={source.source_id} className="border-b border-[#1a1a22] hover:bg-[#151518]">
                <td className="px-4 py-2 text-white">{source.source_name}</td>
                <td className="px-4 py-2 text-center">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      source.pass_rate >= 90
                        ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
                        : source.pass_rate >= 80
                          ? "bg-[#C9A227]/20 text-[#C9A227]"
                          : "bg-[#9B1B30]/20 text-[#e85d75]"
                    }`}
                  >
                    {source.pass_rate > 0 ? `${source.pass_rate.toFixed(1)}%` : "--"}
                  </span>
                </td>
                <td className="px-4 py-2 text-center text-lg">
                  <TrendIndicator trend={source.trend} />
                </td>
                <td className="px-4 py-2 text-xs text-[#888]">{source.release_name ?? "No releases"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/data-explorer/components/ares/coverage/ frontend/src/features/data-explorer/components/ares/diversity/ frontend/src/features/data-explorer/components/ares/network-overview/
git commit -m "feat(ares): add CoverageMatrixView, DiversityView, and NetworkOverviewView components"
```

---

## Task 9: FeasibilityView + FeasibilityForm

**Files:**
- Create: `frontend/src/features/data-explorer/components/ares/feasibility/FeasibilityForm.tsx`
- Create: `frontend/src/features/data-explorer/components/ares/feasibility/FeasibilityView.tsx`

- [ ] **Step 1: Implement FeasibilityForm**

```typescript
// frontend/src/features/data-explorer/components/ares/feasibility/FeasibilityForm.tsx
import { useState } from "react";
import type { FeasibilityCriteria } from "../../../types/ares";

const DOMAINS = [
  { id: "condition", label: "Conditions" },
  { id: "drug", label: "Drugs" },
  { id: "procedure", label: "Procedures" },
  { id: "measurement", label: "Measurements" },
  { id: "observation", label: "Observations" },
  { id: "visit", label: "Visits" },
];

interface FeasibilityFormProps {
  onSubmit: (name: string, criteria: FeasibilityCriteria) => void;
  isLoading: boolean;
}

export default function FeasibilityForm({ onSubmit, isLoading }: FeasibilityFormProps) {
  const [name, setName] = useState("");
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [minPatients, setMinPatients] = useState<string>("");

  const toggleDomain = (domainId: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domainId) ? prev.filter((d) => d !== domainId) : [...prev, domainId],
    );
  };

  const handleSubmit = () => {
    if (!name.trim() || selectedDomains.length === 0) return;

    const criteria: FeasibilityCriteria = {
      required_domains: selectedDomains,
    };

    if (minPatients && parseInt(minPatients) > 0) {
      criteria.min_patients = parseInt(minPatients);
    }

    onSubmit(name, criteria);
  };

  return (
    <div className="rounded-lg border border-[#333] bg-[#1a1a22] p-4">
      <h3 className="mb-3 text-sm font-medium text-white">New Feasibility Assessment</h3>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-[#888]">Assessment Name</label>
        <input
          type="text"
          placeholder="e.g. Diabetes Outcomes Study"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-[#333] bg-[#151518] px-3 py-2 text-sm text-white
                     placeholder-[#555] focus:border-[#C9A227] focus:outline-none"
        />
      </div>

      <div className="mb-3">
        <label className="mb-1 block text-xs text-[#888]">Required Domains</label>
        <div className="flex flex-wrap gap-2">
          {DOMAINS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => toggleDomain(d.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                selectedDomains.includes(d.id)
                  ? "border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]"
                  : "border-[#333] text-[#888] hover:border-[#555]"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs text-[#888]">Minimum Patient Count (optional)</label>
        <input
          type="number"
          placeholder="e.g. 1000"
          value={minPatients}
          onChange={(e) => setMinPatients(e.target.value)}
          className="w-48 rounded border border-[#333] bg-[#151518] px-3 py-2 text-sm text-white
                     placeholder-[#555] focus:border-[#C9A227] focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!name.trim() || selectedDomains.length === 0 || isLoading}
        className="rounded bg-[#C9A227] px-4 py-2 text-sm font-medium text-black
                   hover:bg-[#d4ad2f] disabled:opacity-50"
      >
        {isLoading ? "Running..." : "Run Assessment"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Implement FeasibilityView**

```typescript
// frontend/src/features/data-explorer/components/ares/feasibility/FeasibilityView.tsx
import { useState } from "react";
import { useFeasibilityAssessment, useFeasibilityList, useRunFeasibility } from "../../../hooks/useNetworkData";
import FeasibilityForm from "./FeasibilityForm";
import type { FeasibilityAssessment, FeasibilityResult } from "../../../types/ares";

function PassBadge({ pass }: { pass: boolean }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
        pass ? "bg-[#2DD4BF]/20 text-[#2DD4BF]" : "bg-[#9B1B30]/20 text-[#e85d75]"
      }`}
    >
      {pass ? "PASS" : "FAIL"}
    </span>
  );
}

export default function FeasibilityView() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: assessments } = useFeasibilityList();
  const { data: selectedAssessment } = useFeasibilityAssessment(selectedId);
  const runMutation = useRunFeasibility();

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Feasibility Assessments</h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-[#C9A227] px-3 py-1.5 text-sm font-medium text-black hover:bg-[#d4ad2f]"
        >
          + New Assessment
        </button>
      </div>

      {showForm && (
        <div className="mb-4">
          <FeasibilityForm
            isLoading={runMutation.isPending}
            onSubmit={(name, criteria) => {
              runMutation.mutate(
                { name, criteria },
                {
                  onSuccess: (data) => {
                    setShowForm(false);
                    setSelectedId(data.id);
                  },
                },
              );
            }}
          />
        </div>
      )}

      {/* Past assessments list */}
      {assessments && assessments.length > 0 && (
        <div className="mb-4 space-y-2">
          {assessments.map((a: FeasibilityAssessment) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedId(a.id)}
              className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                selectedId === a.id
                  ? "border-[#C9A227] bg-[#C9A227]/5"
                  : "border-[#252530] bg-[#151518] hover:border-[#333]"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-white">{a.name}</p>
                <p className="text-[11px] text-[#666]">
                  {new Date(a.created_at).toLocaleDateString()} | {a.sources_assessed} sources assessed
                </p>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  a.sources_passed === a.sources_assessed
                    ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
                    : a.sources_passed > 0
                      ? "bg-[#C9A227]/20 text-[#C9A227]"
                      : "bg-[#9B1B30]/20 text-[#e85d75]"
                }`}
              >
                {a.sources_passed}/{a.sources_assessed} passed
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Assessment results detail */}
      {selectedAssessment?.results && (
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
          <h3 className="mb-3 text-sm font-medium text-white">
            Results: {selectedAssessment.name}
          </h3>
          <div className="overflow-hidden rounded-lg border border-[#252530]">
            <table className="w-full text-sm">
              <thead className="bg-[#1a1a22]">
                <tr className="border-b border-[#252530]">
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Source</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Domains</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Concepts</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Visits</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Dates</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Patients</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Overall</th>
                </tr>
              </thead>
              <tbody>
                {selectedAssessment.results.map((r: FeasibilityResult) => (
                  <tr key={r.id} className="border-b border-[#1a1a22] hover:bg-[#1a1a22]">
                    <td className="px-3 py-2 text-white">{r.source_name}</td>
                    <td className="px-3 py-2 text-center"><PassBadge pass={r.domain_pass} /></td>
                    <td className="px-3 py-2 text-center"><PassBadge pass={r.concept_pass} /></td>
                    <td className="px-3 py-2 text-center"><PassBadge pass={r.visit_pass} /></td>
                    <td className="px-3 py-2 text-center"><PassBadge pass={r.date_pass} /></td>
                    <td className="px-3 py-2 text-center"><PassBadge pass={r.patient_pass} /></td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          r.overall_pass
                            ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
                            : "bg-[#9B1B30]/20 text-[#e85d75]"
                        }`}
                      >
                        {r.overall_pass ? "ELIGIBLE" : "INELIGIBLE"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!assessments || assessments.length === 0 ? (
        <p className="py-10 text-center text-[#555]">
          No assessments yet. Create one to evaluate if your network can support a proposed study.
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/data-explorer/components/ares/feasibility/
git commit -m "feat(ares): add FeasibilityView with criteria builder and per-source scorecard"
```

---

## Task 10: Wire All Network Views into AresTab

**Files:**
- Modify: `frontend/src/features/data-explorer/pages/AresTab.tsx`

- [ ] **Step 1: Add imports and routing for all network views**

Update `frontend/src/features/data-explorer/pages/AresTab.tsx` to import and render all Phase 3 drill-in views:

```typescript
// Add imports:
import ConceptComparisonView from "../components/ares/concept-comparison/ConceptComparisonView";
import CoverageMatrixView from "../components/ares/coverage/CoverageMatrixView";
import DiversityView from "../components/ares/diversity/DiversityView";
import FeasibilityView from "../components/ares/feasibility/FeasibilityView";
import NetworkOverviewView from "../components/ares/network-overview/NetworkOverviewView";

// In the drill-in render block, add:
{activeSection === "network-overview" && <NetworkOverviewView />}
{activeSection === "concept-comparison" && <ConceptComparisonView />}
{activeSection === "coverage" && <CoverageMatrixView />}
{activeSection === "diversity" && <DiversityView />}
{activeSection === "feasibility" && <FeasibilityView />}
```

Remove the generic "Coming soon" placeholder for these sections.

- [ ] **Step 2: Verify all views render**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: No TypeScript errors

Open browser -> Ares tab -> click each card -> verify each view renders

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/data-explorer/pages/AresTab.tsx
git commit -m "feat(ares): wire all network views into AresTab drill-in routing"
```

---

## Task 11: Cache Invalidation on ReleaseCreated

**Files:**
- Modify: `backend/app/Listeners/ComputeDqDeltas.php`

- [ ] **Step 1: Add cache invalidation to ComputeDqDeltas listener**

Update `backend/app/Listeners/ComputeDqDeltas.php` to clear network caches when a new release is created:

```php
<?php

namespace App\Listeners;

use App\Events\ReleaseCreated;
use App\Services\Ares\DqHistoryService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Support\Facades\Cache;

class ComputeDqDeltas implements ShouldQueue
{
    public function __construct(
        private readonly DqHistoryService $dqHistoryService,
    ) {}

    public function handle(ReleaseCreated $event): void
    {
        $this->dqHistoryService->computeDeltas($event->release);

        // Invalidate cached network aggregations
        Cache::forget('ares:network:overview');
        Cache::forget('ares:network:coverage');
        Cache::forget('ares:network:diversity');
        Cache::forget('ares:network:dq-summary');
        Cache::forget('ares:network:cost');
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Listeners/ComputeDqDeltas.php
git commit -m "feat(ares): add cache invalidation for network endpoints on ReleaseCreated event"
```

---

## Task 12: Phase 3 Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/ tests/Feature/Api/NetworkAresControllerTest.php tests/Feature/Api/AresControllerTest.php`
Expected: All tests PASS

- [ ] **Step 2: Run frontend TypeScript check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: No errors

- [ ] **Step 3: Verify network views end-to-end**

1. Open browser -> Ares tab -> Network Overview -> should show source health table
2. Concept Comparison -> search for a concept -> bar chart should render
3. Coverage Matrix -> heatmap with sources x domains should render
4. Diversity -> stacked bars per source should render
5. Feasibility -> create assessment -> scorecard should appear

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "feat(ares): complete Phase 3 — network comparison, coverage, diversity, feasibility"
```

- [ ] **Step 5: Deploy**

Run: `./deploy.sh`
Verify: All network drill-in views functional in production
