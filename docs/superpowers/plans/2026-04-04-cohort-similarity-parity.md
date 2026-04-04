# Cohort Similarity Parity Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Patient Similarity "From Cohort" workflow to full parity with "Single Patient", add cohort-vs-cohort comparison, and cohort expansion.

**Architecture:** Three-tab search mode (Single Patient / From Cohort / Compare Cohorts). The CohortSeedForm gets upgraded with source selector, weight sliders, filters, and generation status. Three new backend endpoints: expand-cohort, compare-cohorts, cross-cohort-search. The existing searchFromCohort endpoint gets enrichment parity.

**Tech Stack:** Laravel 11 (PHP 8.4), React 19, TypeScript, TanStack Query, Recharts, Zustand, Tailwind

**Spec:** `docs/superpowers/specs/2026-04-04-cohort-similarity-parity-design.md`

---

## File Map

### Backend (Modify)
- `backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php` — modify `searchFromCohort()`, `cohortProfile()`; add `expandCohort()`, `compareCohorts()`, `crossCohortSearch()`
- `backend/routes/api.php` — add 3 new routes

### Frontend — Types & API (Modify)
- `frontend/src/features/patient-similarity/types/patientSimilarity.ts` — add new types, update existing
- `frontend/src/features/patient-similarity/api/patientSimilarityApi.ts` — add 3 new API functions
- `frontend/src/features/patient-similarity/hooks/usePatientSimilarity.ts` — add 3 new hooks

### Frontend — Components (Modify)
- `frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx` — add third tab, cohort-specific results header
- `frontend/src/features/patient-similarity/components/CohortSeedForm.tsx` — full rewrite: add source selector, weights, filters, generation status

### Frontend — Components (Create)
- `frontend/src/features/patient-similarity/components/CohortExpandDialog.tsx` — confirmation dialog for "Add to Cohort"
- `frontend/src/features/patient-similarity/components/CohortCompareForm.tsx` — two cohort dropdowns + compare button
- `frontend/src/features/patient-similarity/components/CohortComparisonRadar.tsx` — overlaid dual-cohort radar chart
- `frontend/src/features/patient-similarity/components/DivergenceScores.tsx` — per-dimension divergence bars
- `frontend/src/features/patient-similarity/components/GenerationStatusBanner.tsx` — reusable generation status + "Generate Now" action

---

## Task 1: Backend — Fix cohort-profile to return 200 for ungenerated cohorts

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php:531-535`

- [ ] **Step 1: Change the empty cohort response from 404 to 200**

In `PatientSimilarityController.php`, replace the 404 response in `cohortProfile()`:

```php
// REPLACE this block (lines 531-535):
if (empty($memberIds)) {
    return response()->json([
        'data' => null,
        'meta' => ['error' => 'Cohort has no members.'],
    ], 404);
}

// WITH:
if (empty($memberIds)) {
    return response()->json([
        'data' => [
            'cohort_definition_id' => (int) $validated['cohort_definition_id'],
            'source_id' => $source->id,
            'member_count' => 0,
            'generated' => false,
            'dimensions' => [],
            'dimensions_available' => [],
        ],
    ]);
}
```

- [ ] **Step 2: Add `generated: true` to the successful response**

In the same method, add `'generated' => true` to the successful response data array (around line 593):

```php
return response()->json([
    'data' => [
        'cohort_definition_id' => (int) $validated['cohort_definition_id'],
        'source_id' => $source->id,
        'member_count' => $memberCount,
        'generated' => true,
        'dimensions' => $dimensionProfile,
        'dimensions_available' => $centroid['dimensions_available'] ?? [],
    ],
]);
```

- [ ] **Step 3: Verify with curl**

Run:
```bash
# Test ungenerated cohort — should return 200 with generated: false
curl -s -H "Accept: application/json" -H "Authorization: Bearer $TOKEN" \
  "https://parthenon.acumenus.net/api/v1/patient-similarity/cohort-profile?cohort_definition_id=225&source_id=58" \
  | python3 -m json.tool | head -10
```

Expected: 200 response with `"generated": false`

- [ ] **Step 4: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php
git commit -m "fix(similarity): return 200 for ungenerated cohort profiles instead of 404"
```

---

## Task 2: Backend — Add enrichment to searchFromCohort + add cohort name to metadata

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php:188-266`

- [ ] **Step 1: Remove the `strategy` validation and variable**

In `searchFromCohort()`, remove `'strategy'` from the validation rules and the `$strategy` variable:

```php
// Remove this validation rule:
'strategy' => ['sometimes', 'string', 'in:centroid,exemplar'],

// Remove this variable:
$strategy = $validated['strategy'] ?? 'centroid';
```

- [ ] **Step 2: Add enrichment and cohort name to the response**

Replace the return block (lines 251-265) with:

```php
            // Enrich results with shared features and explanations
            $results = $this->enrichSearchResults($results, $source->id);

            // Tiered access: strip person-level details if user lacks profiles.view
            if (! $request->user()->can('profiles.view')) {
                $results['similar_patients'] = array_map(function (array $patient): array {
                    return [
                        'overall_score' => $patient['overall_score'] ?? null,
                        'dimension_scores' => $patient['dimension_scores'] ?? [],
                        'age_bucket' => $patient['age_bucket'] ?? null,
                        'gender_concept_id' => $patient['gender_concept_id'] ?? null,
                        'shared_features' => $patient['shared_features'] ?? null,
                        'similarity_summary' => $patient['similarity_summary'] ?? null,
                    ];
                }, $results['similar_patients'] ?? []);
            }

            // Get cohort name for frontend display
            $cohortDef = CohortDefinition::find($validated['cohort_definition_id']);

            return response()->json([
                'data' => $results,
                'meta' => [
                    'cohort_definition_id' => (int) $validated['cohort_definition_id'],
                    'cohort_name' => $cohortDef?->name ?? 'Unknown Cohort',
                    'cohort_member_count' => count($memberRows),
                    'source_id' => $source->id,
                    'limit' => $limit,
                    'min_score' => $minScore,
                    'count' => count($results['similar_patients'] ?? []),
                ],
            ]);
```

- [ ] **Step 3: Fix enrichSearchResults to handle centroid seeds (person_id = 0)**

The `enrichSearchResults` method bails out if `seedPersonId` is null or if no seed vector is found. For cohort searches, the seed is a virtual centroid with `person_id = 0` — no real vector exists. We need to skip seed-dependent enrichment but still resolve concept names on candidates.

Add a centroid-aware path at the top of `enrichSearchResults()`:

```php
private function enrichSearchResults(array $results, int $sourceId): array
{
    $similarPatients = $results['similar_patients'] ?? [];
    if ($similarPatients === []) {
        return $results;
    }

    $seedPersonId = $results['seed']['person_id'] ?? null;

    // For centroid-based searches (person_id = 0), use the centroid data directly
    $seedData = null;
    if ($seedPersonId === 0 || $seedPersonId === null) {
        // Use the seed array from results as the feature data (it IS the centroid)
        $seedData = $results['seed'] ?? null;
    }

    // Collect candidate person IDs to load
    $candidatePersonIds = array_filter(
        array_map(fn (array $p): int => (int) ($p['person_id'] ?? 0), $similarPatients),
    );

    // Batch load candidate feature vectors
    $vectors = PatientFeatureVector::query()
        ->forSource($sourceId)
        ->whereIn('person_id', $candidatePersonIds)
        ->get()
        ->keyBy('person_id');

    // If we have a real seed patient, load their vector
    if ($seedData === null && $seedPersonId !== null) {
        $seedVector = PatientFeatureVector::query()
            ->forSource($sourceId)
            ->where('person_id', $seedPersonId)
            ->first();

        if ($seedVector === null) {
            return $results;
        }
        $seedData = $seedVector->toArray();
    }

    if ($seedData === null) {
        return $results;
    }

    $candidateVectors = [];
    foreach ($vectors as $personId => $vector) {
        $candidateVectors[$personId] = $vector->toArray();
    }

    $results['similar_patients'] = $this->explainer->enrichResults(
        $seedData,
        $similarPatients,
        $candidateVectors,
    );

    return $results;
}
```

- [ ] **Step 4: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php
git commit -m "feat(similarity): add enrichment to cohort search results, include cohort name in metadata"
```

---

## Task 3: Backend — Add expand-cohort endpoint

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php` — add `expandCohort()` method
- Modify: `backend/routes/api.php` — add route

- [ ] **Step 1: Add the expandCohort method to PatientSimilarityController**

Add before the `errorResponse()` method:

```php
/**
 * POST /v1/patient-similarity/expand-cohort
 *
 * Append similar patients to an existing cohort.
 */
public function expandCohort(Request $request): JsonResponse
{
    try {
        $validated = $request->validate([
            'cohort_definition_id' => ['required', 'integer', 'exists:cohort_definitions,id'],
            'source_id' => ['required', 'integer', 'exists:sources,id'],
            'person_ids' => ['required', 'array', 'min:1'],
            'person_ids.*' => ['integer'],
        ]);

        $source = Source::with('daimons')->findOrFail($validated['source_id']);
        SourceContext::forSource($source);

        $cohort = CohortDefinition::findOrFail($validated['cohort_definition_id']);

        // Get existing members to deduplicate
        $existingIds = $this->results()
            ->table('cohort')
            ->where('cohort_definition_id', $cohort->id)
            ->pluck('subject_id')
            ->map(fn ($id) => (int) $id)
            ->toArray();

        $newIds = array_values(array_diff($validated['person_ids'], $existingIds));

        if (empty($newIds)) {
            return response()->json([
                'data' => [
                    'cohort_definition_id' => $cohort->id,
                    'added_count' => 0,
                    'skipped_duplicates' => count($validated['person_ids']),
                    'new_total' => count($existingIds),
                ],
            ]);
        }

        // Get visit dates for cohort_start_date / cohort_end_date
        $today = now()->toDateString();
        $rows = array_map(fn (int $personId) => [
            'cohort_definition_id' => $cohort->id,
            'subject_id' => $personId,
            'cohort_start_date' => $today,
            'cohort_end_date' => $today,
        ], $newIds);

        $this->results()->table('cohort')->insert($rows);

        return response()->json([
            'data' => [
                'cohort_definition_id' => $cohort->id,
                'added_count' => count($newIds),
                'skipped_duplicates' => count($validated['person_ids']) - count($newIds),
                'new_total' => count($existingIds) + count($newIds),
            ],
        ]);
    } catch (\Throwable $e) {
        return $this->errorResponse('Cohort expansion failed', $e);
    }
}
```

- [ ] **Step 2: Add the route**

In `backend/routes/api.php`, inside the `patient-similarity` prefix group (after the `cohort-profile` route around line 743), add:

```php
Route::post('/expand-cohort', [PatientSimilarityController::class, 'expandCohort'])
    ->middleware('permission:patient-similarity.view');
```

- [ ] **Step 3: Run Pint and clear route cache**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
docker compose exec -T php php artisan route:clear && docker compose exec -T php php artisan route:cache
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php backend/routes/api.php
git commit -m "feat(similarity): add expand-cohort endpoint to append similar patients to existing cohorts"
```

---

## Task 4: Backend — Add compare-cohorts and cross-cohort-search endpoints

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php` — add `compareCohorts()` and `crossCohortSearch()` methods
- Modify: `backend/routes/api.php` — add 2 routes

- [ ] **Step 1: Add the compareCohorts method**

Add before `errorResponse()`:

```php
/**
 * POST /v1/patient-similarity/compare-cohorts
 *
 * Compare two cohort profiles with per-dimension divergence scores.
 */
public function compareCohorts(Request $request): JsonResponse
{
    try {
        $validated = $request->validate([
            'source_cohort_id' => ['required', 'integer', 'exists:cohort_definitions,id'],
            'target_cohort_id' => ['required', 'integer', 'exists:cohort_definitions,id'],
            'source_id' => ['required', 'integer', 'exists:sources,id'],
        ]);

        $source = Source::with('daimons')->findOrFail($validated['source_id']);
        SourceContext::forSource($source);

        // Get member IDs for both cohorts
        $sourceMemberIds = $this->results()
            ->table('cohort')
            ->where('cohort_definition_id', $validated['source_cohort_id'])
            ->pluck('subject_id')
            ->map(fn ($id) => (int) $id)
            ->unique()->values()->all();

        $targetMemberIds = $this->results()
            ->table('cohort')
            ->where('cohort_definition_id', $validated['target_cohort_id'])
            ->pluck('subject_id')
            ->map(fn ($id) => (int) $id)
            ->unique()->values()->all();

        if (empty($sourceMemberIds) || empty($targetMemberIds)) {
            $emptyName = empty($sourceMemberIds) ? 'source' : 'target';

            return response()->json([
                'error' => "The {$emptyName} cohort has no members. Generate it first.",
            ], 422);
        }

        // Build centroids
        $sourceCentroid = $this->centroidBuilder->buildCentroid($sourceMemberIds, $source);
        $targetCentroid = $this->centroidBuilder->buildCentroid($targetMemberIds, $source);

        // Build cohort profiles (reuse cohortProfile logic)
        $sourceVectors = PatientFeatureVector::query()
            ->forSource($source->id)
            ->whereIn('person_id', $sourceMemberIds)
            ->get();
        $targetVectors = PatientFeatureVector::query()
            ->forSource($source->id)
            ->whereIn('person_id', $targetMemberIds)
            ->get();

        $sourceProfile = $this->buildDimensionProfile($sourceVectors, $sourceCentroid);
        $targetProfile = $this->buildDimensionProfile($targetVectors, $targetCentroid);

        // Compute per-dimension divergence
        $divergence = [];
        foreach ($sourceProfile as $dimKey => $sourceDim) {
            $targetDim = $targetProfile[$dimKey] ?? null;
            if ($targetDim === null) {
                $divergence[$dimKey] = ['score' => 1.0, 'label' => 'No data'];
                continue;
            }

            $sourceCov = $sourceDim['coverage'];
            $targetCov = $targetDim['coverage'];
            $score = abs($sourceCov - $targetCov);
            $divergence[$dimKey] = [
                'score' => round($score, 4),
                'label' => $score < 0.3 ? 'Similar' : ($score < 0.6 ? 'Moderate' : 'Divergent'),
            ];
        }

        // Overall divergence (simple mean)
        $divScores = array_column($divergence, 'score');
        $overallDivergence = count($divScores) > 0 ? round(array_sum($divScores) / count($divScores), 4) : 0;

        $sourceCohortDef = CohortDefinition::find($validated['source_cohort_id']);
        $targetCohortDef = CohortDefinition::find($validated['target_cohort_id']);

        return response()->json([
            'data' => [
                'source_cohort' => [
                    'cohort_definition_id' => (int) $validated['source_cohort_id'],
                    'name' => $sourceCohortDef?->name ?? 'Unknown',
                    'member_count' => count($sourceMemberIds),
                    'dimensions' => $sourceProfile,
                ],
                'target_cohort' => [
                    'cohort_definition_id' => (int) $validated['target_cohort_id'],
                    'name' => $targetCohortDef?->name ?? 'Unknown',
                    'member_count' => count($targetMemberIds),
                    'dimensions' => $targetProfile,
                ],
                'divergence' => $divergence,
                'overall_divergence' => $overallDivergence,
            ],
        ]);
    } catch (\Throwable $e) {
        return $this->errorResponse('Cohort comparison failed', $e);
    }
}
```

- [ ] **Step 2: Add the buildDimensionProfile helper method**

Add as a private method:

```php
/**
 * Build a dimension profile from feature vectors and centroid data.
 *
 * @param  \Illuminate\Support\Collection  $vectors
 * @param  array<string, mixed>  $centroid
 * @return array<string, array<string, mixed>>
 */
private function buildDimensionProfile($vectors, array $centroid): array
{
    $memberCount = $vectors->count();

    return [
        'demographics' => [
            'coverage' => 1.0,
            'label' => 'Demographics',
        ],
        'conditions' => [
            'coverage' => $memberCount > 0
                ? round($vectors->filter(fn ($v) => ! empty($v->condition_concepts))->count() / $memberCount, 4)
                : 0,
            'unique_concepts' => count($centroid['condition_concepts'] ?? []),
            'label' => 'Conditions',
        ],
        'measurements' => [
            'coverage' => $memberCount > 0
                ? round($vectors->filter(fn ($v) => ! empty($v->lab_vector))->count() / $memberCount, 4)
                : 0,
            'unique_measurements' => count($centroid['lab_vector'] ?? []),
            'label' => 'Measurements',
        ],
        'drugs' => [
            'coverage' => $memberCount > 0
                ? round($vectors->filter(fn ($v) => ! empty($v->drug_concepts))->count() / $memberCount, 4)
                : 0,
            'unique_concepts' => count($centroid['drug_concepts'] ?? []),
            'label' => 'Drugs',
        ],
        'procedures' => [
            'coverage' => $memberCount > 0
                ? round($vectors->filter(fn ($v) => ! empty($v->procedure_concepts))->count() / $memberCount, 4)
                : 0,
            'unique_concepts' => count($centroid['procedure_concepts'] ?? []),
            'label' => 'Procedures',
        ],
        'genomics' => [
            'coverage' => $memberCount > 0
                ? round($vectors->filter(fn ($v) => ! empty($v->variant_genes))->count() / $memberCount, 4)
                : 0,
            'unique_genes' => count($centroid['variant_genes'] ?? []),
            'label' => 'Genomics',
        ],
    ];
}
```

- [ ] **Step 3: Refactor cohortProfile() to use buildDimensionProfile()**

Replace the inline `$dimensionProfile` construction in `cohortProfile()` (lines 547-589) with:

```php
$dimensionProfile = $this->buildDimensionProfile($vectors, $centroid);
```

- [ ] **Step 4: Add the crossCohortSearch method**

```php
/**
 * POST /v1/patient-similarity/cross-cohort-search
 *
 * Find patients similar to source cohort's centroid, excluding both cohorts' members.
 */
public function crossCohortSearch(Request $request): JsonResponse
{
    try {
        $validated = $request->validate([
            'source_cohort_id' => ['required', 'integer', 'exists:cohort_definitions,id'],
            'target_cohort_id' => ['required', 'integer', 'exists:cohort_definitions,id'],
            'source_id' => ['required', 'integer', 'exists:sources,id'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'min_score' => ['sometimes', 'numeric', 'min:0', 'max:1'],
        ]);

        $source = Source::with('daimons')->findOrFail($validated['source_id']);
        SourceContext::forSource($source);
        $limit = $validated['limit'] ?? 20;
        $minScore = $validated['min_score'] ?? 0.0;

        // Get member IDs for both cohorts
        $sourceMemberIds = $this->results()
            ->table('cohort')
            ->where('cohort_definition_id', $validated['source_cohort_id'])
            ->pluck('subject_id')
            ->map(fn ($id) => (int) $id)
            ->unique()->values()->all();

        $targetMemberIds = $this->results()
            ->table('cohort')
            ->where('cohort_definition_id', $validated['target_cohort_id'])
            ->pluck('subject_id')
            ->map(fn ($id) => (int) $id)
            ->unique()->values()->all();

        if (empty($sourceMemberIds)) {
            return response()->json([
                'error' => 'Source cohort has no members.',
            ], 422);
        }

        $excludeIds = array_unique(array_merge($sourceMemberIds, $targetMemberIds));

        // Build centroid from source cohort
        $centroid = $this->centroidBuilder->buildCentroid($sourceMemberIds, $source);

        // Default weights
        $dimensions = SimilarityDimension::active()->get();
        $weights = [];
        foreach ($dimensions as $dimension) {
            $weights[$dimension->key] = $dimension->default_weight;
        }

        $results = $this->service->searchFromCentroid(
            centroidData: $centroid,
            source: $source,
            excludePersonIds: $excludeIds,
            weights: $weights,
            limit: $limit,
            minScore: $minScore,
            filters: [],
        );

        // Enrich results
        $results = $this->enrichSearchResults($results, $source->id);

        $sourceCohortDef = CohortDefinition::find($validated['source_cohort_id']);

        return response()->json([
            'data' => $results,
            'meta' => [
                'source_cohort_id' => (int) $validated['source_cohort_id'],
                'source_cohort_name' => $sourceCohortDef?->name ?? 'Unknown',
                'target_cohort_id' => (int) $validated['target_cohort_id'],
                'source_id' => $source->id,
                'excluded_count' => count($excludeIds),
                'limit' => $limit,
                'count' => count($results['similar_patients'] ?? []),
            ],
        ]);
    } catch (\Throwable $e) {
        return $this->errorResponse('Cross-cohort search failed', $e);
    }
}
```

- [ ] **Step 5: Add the routes**

In `backend/routes/api.php`, inside the `patient-similarity` prefix group:

```php
Route::post('/compare-cohorts', [PatientSimilarityController::class, 'compareCohorts'])
    ->middleware('permission:patient-similarity.view');
Route::post('/cross-cohort-search', [PatientSimilarityController::class, 'crossCohortSearch'])
    ->middleware(['permission:patient-similarity.view', 'throttle:30,1']);
```

- [ ] **Step 6: Run Pint and rebuild route cache**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
docker compose exec -T php php artisan route:clear && docker compose exec -T php php artisan route:cache
```

- [ ] **Step 7: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php backend/routes/api.php
git commit -m "feat(similarity): add compare-cohorts and cross-cohort-search endpoints"
```

---

## Task 5: Frontend — Update types, API functions, and hooks

**Files:**
- Modify: `frontend/src/features/patient-similarity/types/patientSimilarity.ts`
- Modify: `frontend/src/features/patient-similarity/api/patientSimilarityApi.ts`
- Modify: `frontend/src/features/patient-similarity/hooks/usePatientSimilarity.ts`

- [ ] **Step 1: Update types**

In `patientSimilarity.ts`, add the `generated` field to `CohortProfileResult` and add new types. Remove `strategy` from `CohortSimilaritySearchParams` and add `weights`/`filters`:

Replace the `CohortSimilaritySearchParams` interface:

```typescript
export interface CohortSimilaritySearchParams {
  cohort_definition_id: number;
  source_id: number;
  mode?: string;
  weights?: Record<string, number>;
  limit?: number;
  min_score?: number;
  filters?: Record<string, unknown>;
}
```

Update `CohortProfileResult` to include `generated`:

```typescript
export interface CohortProfileResult {
  cohort_definition_id: number;
  source_id: number;
  member_count: number;
  generated: boolean;
  dimensions: Record<string, CohortDimensionProfile>;
  dimensions_available: string[];
}
```

Add new types at the end of the file:

```typescript
// ── Cohort Expansion ────────────────────────────────────────────

export interface ExpandCohortParams {
  cohort_definition_id: number;
  source_id: number;
  person_ids: number[];
}

export interface ExpandCohortResult {
  cohort_definition_id: number;
  added_count: number;
  skipped_duplicates: number;
  new_total: number;
}

// ── Cohort Comparison ────────────────────────────────────────────

export interface CohortComparisonParams {
  source_cohort_id: number;
  target_cohort_id: number;
  source_id: number;
}

export interface CohortDivergence {
  score: number;
  label: string;
}

export interface CohortComparisonCohort {
  cohort_definition_id: number;
  name: string;
  member_count: number;
  dimensions: Record<string, CohortDimensionProfile>;
}

export interface CohortComparisonResult {
  source_cohort: CohortComparisonCohort;
  target_cohort: CohortComparisonCohort;
  divergence: Record<string, CohortDivergence>;
  overall_divergence: number;
}

export interface CrossCohortSearchParams {
  source_cohort_id: number;
  target_cohort_id: number;
  source_id: number;
  limit?: number;
  min_score?: number;
}
```

- [ ] **Step 2: Add API functions**

In `patientSimilarityApi.ts`, add after the existing `comparePatients` function:

```typescript
import type {
  // ... existing imports ...
  ExpandCohortParams,
  ExpandCohortResult,
  CohortComparisonParams,
  CohortComparisonResult,
  CrossCohortSearchParams,
} from "../types/patientSimilarity";

// ── Cohort Expansion ────────────────────────────────────────────

export async function expandCohort(
  params: ExpandCohortParams,
): Promise<ExpandCohortResult> {
  const { data } = await apiClient.post(
    "/patient-similarity/expand-cohort",
    params,
  );
  return data.data ?? data;
}

// ── Cohort Comparison ────────────────────────────────────────────

export async function compareCohorts(
  params: CohortComparisonParams,
): Promise<CohortComparisonResult> {
  const { data } = await apiClient.post(
    "/patient-similarity/compare-cohorts",
    params,
  );
  return data.data ?? data;
}

export async function crossCohortSearch(
  params: CrossCohortSearchParams,
): Promise<SimilaritySearchResult> {
  const { data } = await apiClient.post(
    "/patient-similarity/cross-cohort-search",
    params,
  );
  return data.data ?? data;
}
```

- [ ] **Step 3: Add hooks**

In `usePatientSimilarity.ts`, add the new imports and hooks:

```typescript
import {
  // ... existing imports ...
  expandCohort,
  compareCohorts,
  crossCohortSearch,
} from "../api/patientSimilarityApi";
import type {
  // ... existing imports ...
  ExpandCohortParams,
  CohortComparisonParams,
  CrossCohortSearchParams,
} from "../types/patientSimilarity";

// ── Cohort Expansion ────────────────────────────────────────────

export function useExpandCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: ExpandCohortParams) => expandCohort(params),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["patient-similarity", "cohort-profile", variables.cohort_definition_id],
      });
    },
  });
}

// ── Cohort Comparison ────────────────────────────────────────────

export function useCompareCohorts() {
  return useMutation({
    mutationFn: (params: CohortComparisonParams) => compareCohorts(params),
  });
}

export function useCrossCohortSearch() {
  return useMutation({
    mutationFn: (params: CrossCohortSearchParams) => crossCohortSearch(params),
  });
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/patient-similarity/types/patientSimilarity.ts \
  frontend/src/features/patient-similarity/api/patientSimilarityApi.ts \
  frontend/src/features/patient-similarity/hooks/usePatientSimilarity.ts
git commit -m "feat(similarity): add types, API functions, and hooks for cohort expansion and comparison"
```

---

## Task 6: Frontend — Create GenerationStatusBanner component

**Files:**
- Create: `frontend/src/features/patient-similarity/components/GenerationStatusBanner.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGenerateCohort } from "@/features/cohort-definitions/hooks/useCohortDefinitions";
import type { CohortProfileResult } from "../types/patientSimilarity";

interface GenerationStatusBannerProps {
  profile: CohortProfileResult | undefined;
  isLoading: boolean;
  cohortDefinitionId: number;
  sourceId: number;
}

export function GenerationStatusBanner({
  profile,
  isLoading,
  cohortDefinitionId,
  sourceId,
}: GenerationStatusBannerProps) {
  const generateMutation = useGenerateCohort();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-[#5A5650] py-1.5">
        <Loader2 size={12} className="animate-spin" />
        Checking generation status...
      </div>
    );
  }

  if (!profile) return null;

  // Generating in progress
  if (generateMutation.isPending) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[#2DD4BF]/5 border border-[#2DD4BF]/20 px-3 py-2 mt-1.5">
        <Loader2 size={14} className="animate-spin text-[#2DD4BF]" />
        <span className="text-xs text-[#2DD4BF]">Generating cohort...</span>
      </div>
    );
  }

  // Not generated
  if (!profile.generated) {
    return (
      <div className="rounded-lg bg-[#C9A227]/5 border border-[#C9A227]/20 px-3 py-2 mt-1.5">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-[#C9A227] shrink-0" />
          <span className="text-xs text-[#C9A227]">
            Not generated for this source
          </span>
        </div>
        <button
          type="button"
          onClick={() =>
            generateMutation.mutate({ defId: cohortDefinitionId, sourceId })
          }
          className={cn(
            "mt-2 w-full rounded px-3 py-1.5 text-xs font-medium transition-colors",
            "bg-[#C9A227]/10 text-[#C9A227] hover:bg-[#C9A227]/20 border border-[#C9A227]/30",
          )}
        >
          Generate Now
        </button>
        {generateMutation.isSuccess && (
          <p className="mt-1.5 text-[10px] text-[#2DD4BF]">
            Generation queued. This may take a moment.
          </p>
        )}
      </div>
    );
  }

  // Generated
  return (
    <div className="flex items-center gap-2 py-1.5">
      <CheckCircle2 size={12} className="text-[#2DD4BF]" />
      <span className="text-xs text-[#8A857D]">
        <span className="font-medium text-[#C5C0B8]">
          {profile.member_count}
        </span>{" "}
        members
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patient-similarity/components/GenerationStatusBanner.tsx
git commit -m "feat(similarity): add GenerationStatusBanner component for cohort generation status"
```

---

## Task 7: Frontend — Upgrade CohortSeedForm with source selector, weights, filters, and generation status

**Files:**
- Modify: `frontend/src/features/patient-similarity/components/CohortSeedForm.tsx`

- [ ] **Step 1: Rewrite CohortSeedForm**

Replace the entire contents of `CohortSeedForm.tsx`:

```typescript
import { useState, useEffect, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSourceStore } from "@/stores/sourceStore";
import { useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";
import {
  useSimilarityDimensions,
  useCohortProfile,
} from "../hooks/usePatientSimilarity";
import { CohortCentroidRadar } from "./CohortCentroidRadar";
import { GenerationStatusBanner } from "./GenerationStatusBanner";
import type { CohortSimilaritySearchParams } from "../types/patientSimilarity";

interface CohortSeedFormProps {
  onSearch: (params: CohortSimilaritySearchParams) => void;
  isLoading: boolean;
}

export function CohortSeedForm({ onSearch, isLoading }: CohortSeedFormProps) {
  const { activeSourceId, defaultSourceId, sources } = useSourceStore();
  const { data: dimensions } = useSimilarityDimensions();

  const [sourceId, setSourceId] = useState<number>(
    activeSourceId ?? defaultSourceId ?? 0,
  );
  const [selectedCohortId, setSelectedCohortId] = useState<number>(0);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [gender, setGender] = useState("");

  const { data: cohortsData, isLoading: cohortsLoading } =
    useCohortDefinitions({ limit: 100 });
  const cohorts = cohortsData?.items ?? [];

  const {
    data: cohortProfile,
    isLoading: profileLoading,
  } = useCohortProfile(
    selectedCohortId > 0 ? selectedCohortId : undefined,
    sourceId,
  );

  // Initialize weights from dimensions
  useEffect(() => {
    if (!dimensions) return;
    const defaults: Record<string, number> = {};
    for (const dim of dimensions) {
      defaults[dim.key] = dim.default_weight;
    }
    setWeights(defaults);
  }, [dimensions]);

  // Sync source when activeSourceId changes
  useEffect(() => {
    if (activeSourceId) {
      setSourceId(activeSourceId);
    }
  }, [activeSourceId]);

  // Reset cohort when source changes
  useEffect(() => {
    setSelectedCohortId(0);
  }, [sourceId]);

  const handleWeightChange = useCallback((key: string, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }));
  }, []);

  const isGenerated = cohortProfile?.generated === true;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCohortId <= 0 || sourceId <= 0 || !isGenerated) return;

    const filters: Record<string, unknown> = {};
    const minAge = parseInt(ageMin, 10);
    const maxAge = parseInt(ageMax, 10);
    if (!isNaN(minAge)) filters.age_min = minAge;
    if (!isNaN(maxAge)) filters.age_max = maxAge;
    if (gender) filters.gender = gender;

    onSearch({
      cohort_definition_id: selectedCohortId,
      source_id: sourceId,
      weights: Object.keys(weights).length > 0 ? weights : undefined,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Source Selector */}
      <div>
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
          Data Source
        </label>
        <select
          value={sourceId}
          onChange={(e) => setSourceId(parseInt(e.target.value, 10))}
          className={cn(
            "w-full rounded-lg px-3 py-2 text-sm",
            "bg-[#0E0E11] border border-[#232328]",
            "text-[#F0EDE8]",
            "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
          )}
        >
          <option value={0}>Select source...</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.source_name}
            </option>
          ))}
        </select>
      </div>

      {/* Cohort Selector */}
      <div>
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
          Seed Cohort
        </label>
        {cohortsLoading ? (
          <div className="flex items-center gap-2 text-xs text-[#5A5650] py-2">
            <Loader2 size={12} className="animate-spin" />
            Loading cohorts...
          </div>
        ) : (
          <select
            value={selectedCohortId}
            onChange={(e) =>
              setSelectedCohortId(parseInt(e.target.value, 10))
            }
            className={cn(
              "w-full rounded-lg px-3 py-2 text-sm",
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8]",
              "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
            )}
          >
            <option value={0}>Select a cohort...</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {/* Generation Status */}
        {selectedCohortId > 0 && sourceId > 0 && (
          <GenerationStatusBanner
            profile={cohortProfile}
            isLoading={profileLoading}
            cohortDefinitionId={selectedCohortId}
            sourceId={sourceId}
          />
        )}
      </div>

      {/* Radar Chart */}
      {cohortProfile?.generated && (
        <CohortCentroidRadar profile={cohortProfile} />
      )}

      {/* Dimension Weight Sliders */}
      {dimensions && dimensions.length > 0 && (
        <div>
          <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-2">
            Dimension Weights
          </label>
          <div className="space-y-3">
            {dimensions
              .filter((d) => d.is_active)
              .map((dim) => (
                <div key={dim.key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#C5C0B8]">{dim.name}</span>
                    <span className="text-[10px] font-medium text-[#2DD4BF] tabular-nums">
                      {(weights[dim.key] ?? dim.default_weight).toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={0.5}
                    value={weights[dim.key] ?? dim.default_weight}
                    onChange={(e) =>
                      handleWeightChange(dim.key, parseFloat(e.target.value))
                    }
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#232328] accent-[#2DD4BF]"
                  />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider">
          Filters (optional)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={ageMin}
            onChange={(e) => setAgeMin(e.target.value)}
            placeholder="Min age"
            className={cn(
              "w-1/2 rounded-lg px-3 py-1.5 text-xs",
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8] placeholder:text-[#5A5650]",
              "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
            )}
          />
          <span className="text-[#5A5650] text-xs">-</span>
          <input
            type="text"
            value={ageMax}
            onChange={(e) => setAgeMax(e.target.value)}
            placeholder="Max age"
            className={cn(
              "w-1/2 rounded-lg px-3 py-1.5 text-xs",
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8] placeholder:text-[#5A5650]",
              "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
            )}
          />
        </div>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className={cn(
            "w-full rounded-lg px-3 py-1.5 text-xs",
            "bg-[#0E0E11] border border-[#232328]",
            "text-[#F0EDE8]",
            "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
          )}
        >
          <option value="">Any gender</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </select>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={
          isLoading || selectedCohortId <= 0 || sourceId <= 0 || !isGenerated
        }
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
          "bg-[#9B1B30] text-white hover:bg-[#B22040]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <Search size={16} />
        )}
        Find Similar Patients
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Update PatientSimilarityPage to pass new props**

In `PatientSimilarityPage.tsx`, the `CohortSeedForm` no longer takes `sourceId` as a prop (it manages its own source state). Update the import and usage:

Replace:
```typescript
<CohortSeedForm
  onSearch={handleCohortSearch}
  sourceId={sourceId}
  isLoading={isLoading}
/>
```

With:
```typescript
<CohortSeedForm
  onSearch={handleCohortSearch}
  isLoading={isLoading}
/>
```

- [ ] **Step 3: Run TypeScript check**

```bash
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/patient-similarity/components/CohortSeedForm.tsx \
  frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx
git commit -m "feat(similarity): upgrade CohortSeedForm with source selector, weights, filters, and generation status"
```

---

## Task 8: Frontend — Create CohortExpandDialog component

**Files:**
- Create: `frontend/src/features/patient-similarity/components/CohortExpandDialog.tsx`

- [ ] **Step 1: Create the component**

```typescript
import { useState } from "react";
import { X, UserPlus, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExpandCohort } from "../hooks/usePatientSimilarity";
import type { SimilarPatient } from "../types/patientSimilarity";

interface CohortExpandDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cohortDefinitionId: number;
  cohortName: string;
  sourceId: number;
  currentMemberCount: number;
  patients: SimilarPatient[];
}

export function CohortExpandDialog({
  isOpen,
  onClose,
  cohortDefinitionId,
  cohortName,
  sourceId,
  currentMemberCount,
  patients,
}: CohortExpandDialogProps) {
  const [minScore, setMinScore] = useState(0.5);

  const expandMutation = useExpandCohort();

  const filteredPatients = patients.filter(
    (p) => p.overall_score >= minScore && p.person_id != null,
  );
  const filteredCount = filteredPatients.length;

  const handleExpand = () => {
    const personIds = filteredPatients
      .map((p) => p.person_id)
      .filter((id): id is number => id != null);

    if (personIds.length === 0) return;

    expandMutation.mutate({
      cohort_definition_id: cohortDefinitionId,
      source_id: sourceId,
      person_ids: personIds,
    });
  };

  const handleClose = () => {
    setMinScore(0.5);
    expandMutation.reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-lg border border-[#232328] bg-[#151518] shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#232328] px-5 py-4">
          <h2 className="text-base font-semibold text-[#F0EDE8]">
            Expand {cohortName}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {expandMutation.isSuccess ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle size={40} className="text-[#2DD4BF] mb-3" />
              <p className="text-sm text-[#F0EDE8] font-medium">
                Cohort expanded successfully
              </p>
              <p className="text-xs text-[#8A857D] mt-1">
                Added {expandMutation.data.added_count} patients
                {expandMutation.data.skipped_duplicates > 0 && (
                  <> ({expandMutation.data.skipped_duplicates} duplicates skipped)</>
                )}
              </p>
              <p className="text-xs text-[#8A857D] mt-0.5">
                New total: {expandMutation.data.new_total} members
              </p>
            </div>
          ) : (
            <>
              {/* Info */}
              <div className="rounded-lg bg-[#0E0E11] border border-[#232328] px-3 py-2.5">
                <p className="text-xs text-[#8A857D]">
                  Add similar patients to{" "}
                  <span className="font-medium text-[#C5C0B8]">
                    {cohortName}
                  </span>
                </p>
                <p className="text-xs text-[#5A5650] mt-1">
                  Current size:{" "}
                  <span className="text-[#C5C0B8]">{currentMemberCount}</span>{" "}
                  members &rarr; New size:{" "}
                  <span className="text-[#2DD4BF]">
                    {currentMemberCount + filteredCount}
                  </span>
                </p>
              </div>

              {/* Min Score Slider */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] text-[#5A5650] uppercase tracking-wider">
                    Minimum Score
                  </label>
                  <span className="text-xs font-medium text-[#2DD4BF] tabular-nums">
                    {minScore.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={minScore}
                  onChange={(e) => setMinScore(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#232328] accent-[#2DD4BF]"
                />
              </div>

              {/* Count Preview */}
              <div className="rounded-lg bg-[#0E0E11] border border-[#232328] px-3 py-2">
                <p className="text-xs text-[#8A857D]">
                  <span className="font-medium text-[#C5C0B8]">
                    {filteredCount}
                  </span>{" "}
                  of {patients.length} patients meet the threshold
                </p>
              </div>

              {expandMutation.isError && (
                <p className="text-xs text-[#E85A6B]">
                  Expansion failed. Please try again.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-[#232328] px-5 py-3">
          {expandMutation.isSuccess ? (
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                "bg-[#2DD4BF]/10 text-[#2DD4BF] hover:bg-[#2DD4BF]/20",
              )}
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-[#8A857D] hover:text-[#C5C0B8] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExpand}
                disabled={filteredCount === 0 || expandMutation.isPending}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  "bg-[#9B1B30] text-white hover:bg-[#B22040]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {expandMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <UserPlus size={14} />
                )}
                Add {filteredCount} Patients
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patient-similarity/components/CohortExpandDialog.tsx
git commit -m "feat(similarity): add CohortExpandDialog for iterative cohort expansion"
```

---

## Task 9: Frontend — Update PatientSimilarityPage with third tab, cohort-specific results header, and expand action

**Files:**
- Modify: `frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx`

- [ ] **Step 1: Add imports and update SearchMode type**

Add at the top with existing imports:

```typescript
import { UserPlus } from "lucide-react";
import { CohortExpandDialog } from "../components/CohortExpandDialog";
```

Change the `SearchMode` type:

```typescript
type SearchMode = "single" | "cohort" | "compare";
```

- [ ] **Step 2: Add expand dialog state and cohort metadata tracking**

After the existing `exportOpen` state, add:

```typescript
const [expandOpen, setExpandOpen] = useState(false);
```

After the `metadata` extraction block, add cohort metadata extraction:

```typescript
const cohortName =
  typeof metadata.cohort_name === "string" ? metadata.cohort_name : undefined;
const cohortMemberCount =
  typeof metadata.cohort_member_count === "number"
    ? metadata.cohort_member_count
    : 0;
const cohortDefinitionId =
  typeof metadata.cohort_definition_id === "number"
    ? metadata.cohort_definition_id
    : 0;
```

- [ ] **Step 3: Update the tab toggle to include "Compare Cohorts"**

Replace the search mode toggle `div` with:

```typescript
<div className="flex rounded-lg border border-[#232328] overflow-hidden">
  {(["single", "cohort", "compare"] as const).map((m) => (
    <button
      key={m}
      type="button"
      onClick={() => setSearchMode(m)}
      className={cn(
        "flex-1 px-3 py-2 text-xs font-medium transition-colors",
        searchMode === m
          ? "bg-[#9B1B30]/10 text-[#9B1B30]"
          : "bg-[#0E0E11] text-[#5A5650] hover:text-[#C5C0B8]",
      )}
    >
      {m === "single"
        ? "Single Patient"
        : m === "cohort"
          ? "From Cohort"
          : "Compare Cohorts"}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Add cohort-specific metadata to results header bar**

In the results header bar (the `{result && (` block), add cohort seed info after the results count `div`:

```typescript
{cohortName && (
  <div className="flex items-center gap-1.5 text-xs text-[#5A5650]">
    <span>Seed:</span>
    <span className="font-medium text-[#C5C0B8]">{cohortName}</span>
    <span>({cohortMemberCount} members)</span>
  </div>
)}
```

- [ ] **Step 5: Add "Add to Cohort" button in the results header**

After the existing "Export as Cohort" button, add the expand button (only in cohort mode):

```typescript
{searchMode === "cohort" && cohortName && (
  <button
    type="button"
    onClick={() => setExpandOpen(true)}
    disabled={patients.length === 0}
    className={cn(
      "flex items-center gap-1.5 text-xs border rounded px-2.5 py-1 transition-colors",
      patients.length > 0
        ? "text-[#C9A227] border-[#C9A227]/30 hover:bg-[#C9A227]/10 cursor-pointer"
        : "text-[#5A5650] border-[#232328] cursor-not-allowed opacity-50",
    )}
  >
    <UserPlus size={12} />
    Add to {cohortName}
  </button>
)}
```

- [ ] **Step 6: Add the CohortExpandDialog**

After the existing `CohortExportDialog`, add:

```typescript
<CohortExpandDialog
  isOpen={expandOpen}
  onClose={() => setExpandOpen(false)}
  cohortDefinitionId={cohortDefinitionId}
  cohortName={cohortName ?? "Cohort"}
  sourceId={sourceId}
  currentMemberCount={cohortMemberCount}
  patients={patients}
/>
```

- [ ] **Step 7: Add placeholder for Compare Cohorts tab in the left panel**

In the left panel, after the `CohortSeedForm` conditional, add:

```typescript
{searchMode === "compare" && (
  <div className="rounded-lg border border-dashed border-[#323238] bg-[#151518] p-4">
    <p className="text-xs text-[#8A857D] text-center">
      Compare Cohorts form — implemented in Task 10
    </p>
  </div>
)}
```

**Note:** This placeholder will be replaced in Task 10.

- [ ] **Step 8: Run TypeScript check and build**

```bash
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
docker compose exec -T node sh -c "cd /app && npx vite build"
```

- [ ] **Step 9: Fix file permissions**

```bash
chmod -R o+r /home/smudoshi/Github/Parthenon/frontend/dist/ && chmod o+x /home/smudoshi/Github/Parthenon/frontend/dist /home/smudoshi/Github/Parthenon/frontend/dist/assets
```

- [ ] **Step 10: Commit**

```bash
git add frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx
git commit -m "feat(similarity): add third tab, cohort results header, and expand-cohort action to PatientSimilarityPage"
```

---

## Task 10: Frontend — Create CohortCompareForm, CohortComparisonRadar, and DivergenceScores

**Files:**
- Create: `frontend/src/features/patient-similarity/components/CohortCompareForm.tsx`
- Create: `frontend/src/features/patient-similarity/components/CohortComparisonRadar.tsx`
- Create: `frontend/src/features/patient-similarity/components/DivergenceScores.tsx`

- [ ] **Step 1: Create DivergenceScores component**

```typescript
import { cn } from "@/lib/utils";
import type { CohortDivergence } from "../types/patientSimilarity";

interface DivergenceScoresProps {
  divergence: Record<string, CohortDivergence>;
  overallDivergence: number;
}

function getColor(score: number): string {
  if (score < 0.3) return "#2DD4BF";
  if (score < 0.6) return "#C9A227";
  return "#E85A6B";
}

function getBgColor(score: number): string {
  if (score < 0.3) return "bg-[#2DD4BF]/10";
  if (score < 0.6) return "bg-[#C9A227]/10";
  return "bg-[#E85A6B]/10";
}

const DIMENSION_LABELS: Record<string, string> = {
  demographics: "Demographics",
  conditions: "Conditions",
  measurements: "Measurements",
  drugs: "Drugs",
  procedures: "Procedures",
  genomics: "Genomics",
};

export function DivergenceScores({
  divergence,
  overallDivergence,
}: DivergenceScoresProps) {
  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Divergence Scores
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#5A5650] uppercase tracking-wider">
            Overall:
          </span>
          <span
            className="text-sm font-semibold tabular-nums"
            style={{ color: getColor(overallDivergence) }}
          >
            {overallDivergence.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {Object.entries(divergence).map(([key, div]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-[#8A857D] w-24 shrink-0">
              {DIMENSION_LABELS[key] ?? key}
            </span>
            <div className="flex-1 h-2 rounded-full bg-[#232328] overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all")}
                style={{
                  width: `${Math.min(div.score * 100, 100)}%`,
                  backgroundColor: getColor(div.score),
                }}
              />
            </div>
            <span
              className="text-[10px] font-medium tabular-nums w-8 text-right"
              style={{ color: getColor(div.score) }}
            >
              {div.score.toFixed(2)}
            </span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded",
                getBgColor(div.score),
              )}
              style={{ color: getColor(div.score) }}
            >
              {div.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CohortComparisonRadar component**

```typescript
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { CohortDimensionProfile } from "../types/patientSimilarity";

interface CohortComparisonRadarProps {
  sourceDimensions: Record<string, CohortDimensionProfile>;
  targetDimensions: Record<string, CohortDimensionProfile>;
  sourceName: string;
  targetName: string;
}

interface RadarDataPoint {
  dimension: string;
  source: number;
  target: number;
  fullMark: number;
}

export function CohortComparisonRadar({
  sourceDimensions,
  targetDimensions,
  sourceName,
  targetName,
}: CohortComparisonRadarProps) {
  const allKeys = [
    ...new Set([
      ...Object.keys(sourceDimensions),
      ...Object.keys(targetDimensions),
    ]),
  ];

  const data: RadarDataPoint[] = allKeys.map((key) => ({
    dimension: sourceDimensions[key]?.label ?? targetDimensions[key]?.label ?? key,
    source: Math.round((sourceDimensions[key]?.coverage ?? 0) * 100),
    target: Math.round((targetDimensions[key]?.coverage ?? 0) * 100),
    fullMark: 100,
  }));

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <h3 className="text-sm font-semibold text-[#F0EDE8] mb-3">
        Profile Comparison
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#323238" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "#8A857D", fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "#5A5650", fontSize: 9 }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Radar
            name={sourceName}
            dataKey="source"
            stroke="#2DD4BF"
            fill="#2DD4BF"
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Radar
            name={targetName}
            dataKey="target"
            stroke="#C9A227"
            fill="#C9A227"
            fillOpacity={0.1}
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1A1A1E",
              border: "1px solid #323238",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={((value: number, name: string) => [
              `${value}%`,
              name,
            ]) as never}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", color: "#8A857D" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Create CohortCompareForm component**

```typescript
import { useState, useEffect } from "react";
import { GitCompareArrows, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSourceStore } from "@/stores/sourceStore";
import { useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";
import { useCohortProfile } from "../hooks/usePatientSimilarity";
import { GenerationStatusBanner } from "./GenerationStatusBanner";
import type { CohortComparisonParams, CrossCohortSearchParams } from "../types/patientSimilarity";

interface CohortCompareFormProps {
  onCompare: (params: CohortComparisonParams) => void;
  onCrossSearch: (params: CrossCohortSearchParams) => void;
  isComparing: boolean;
  isSearching: boolean;
  hasComparisonResult: boolean;
}

export function CohortCompareForm({
  onCompare,
  onCrossSearch,
  isComparing,
  isSearching,
  hasComparisonResult,
}: CohortCompareFormProps) {
  const { activeSourceId, defaultSourceId, sources } = useSourceStore();

  const [sourceId, setSourceId] = useState<number>(
    activeSourceId ?? defaultSourceId ?? 0,
  );
  const [sourceCohortId, setSourceCohortId] = useState<number>(0);
  const [targetCohortId, setTargetCohortId] = useState<number>(0);

  const { data: cohortsData, isLoading: cohortsLoading } =
    useCohortDefinitions({ limit: 100 });
  const cohorts = cohortsData?.items ?? [];

  const { data: sourceProfile, isLoading: sourceProfileLoading } =
    useCohortProfile(
      sourceCohortId > 0 ? sourceCohortId : undefined,
      sourceId,
    );
  const { data: targetProfile, isLoading: targetProfileLoading } =
    useCohortProfile(
      targetCohortId > 0 ? targetCohortId : undefined,
      sourceId,
    );

  useEffect(() => {
    if (activeSourceId) setSourceId(activeSourceId);
  }, [activeSourceId]);

  useEffect(() => {
    setSourceCohortId(0);
    setTargetCohortId(0);
  }, [sourceId]);

  const bothGenerated =
    sourceProfile?.generated === true && targetProfile?.generated === true;

  const handleCompare = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bothGenerated || sourceId <= 0) return;

    onCompare({
      source_cohort_id: sourceCohortId,
      target_cohort_id: targetCohortId,
      source_id: sourceId,
    });
  };

  const handleCrossSearch = () => {
    if (!bothGenerated || sourceId <= 0) return;

    onCrossSearch({
      source_cohort_id: sourceCohortId,
      target_cohort_id: targetCohortId,
      source_id: sourceId,
    });
  };

  return (
    <form onSubmit={handleCompare} className="space-y-5">
      {/* Source Selector */}
      <div>
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
          Data Source
        </label>
        <select
          value={sourceId}
          onChange={(e) => setSourceId(parseInt(e.target.value, 10))}
          className={cn(
            "w-full rounded-lg px-3 py-2 text-sm",
            "bg-[#0E0E11] border border-[#232328]",
            "text-[#F0EDE8]",
            "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
          )}
        >
          <option value={0}>Select source...</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.source_name}
            </option>
          ))}
        </select>
      </div>

      {/* Source Cohort */}
      <div>
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
          Source Cohort
        </label>
        {cohortsLoading ? (
          <div className="flex items-center gap-2 text-xs text-[#5A5650] py-2">
            <Loader2 size={12} className="animate-spin" />
            Loading...
          </div>
        ) : (
          <select
            value={sourceCohortId}
            onChange={(e) =>
              setSourceCohortId(parseInt(e.target.value, 10))
            }
            className={cn(
              "w-full rounded-lg px-3 py-2 text-sm",
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8]",
              "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
            )}
          >
            <option value={0}>Select source cohort...</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {sourceCohortId > 0 && sourceId > 0 && (
          <GenerationStatusBanner
            profile={sourceProfile}
            isLoading={sourceProfileLoading}
            cohortDefinitionId={sourceCohortId}
            sourceId={sourceId}
          />
        )}
      </div>

      {/* Target Cohort */}
      <div>
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1.5">
          Target Cohort
        </label>
        {cohortsLoading ? (
          <div className="flex items-center gap-2 text-xs text-[#5A5650] py-2">
            <Loader2 size={12} className="animate-spin" />
            Loading...
          </div>
        ) : (
          <select
            value={targetCohortId}
            onChange={(e) =>
              setTargetCohortId(parseInt(e.target.value, 10))
            }
            className={cn(
              "w-full rounded-lg px-3 py-2 text-sm",
              "bg-[#0E0E11] border border-[#232328]",
              "text-[#F0EDE8]",
              "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
            )}
          >
            <option value={0}>Select target cohort...</option>
            {cohorts
              .filter((c) => c.id !== sourceCohortId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        )}
        {targetCohortId > 0 && sourceId > 0 && (
          <GenerationStatusBanner
            profile={targetProfile}
            isLoading={targetProfileLoading}
            cohortDefinitionId={targetCohortId}
            sourceId={sourceId}
          />
        )}
      </div>

      {/* Compare Button */}
      <button
        type="submit"
        disabled={isComparing || !bothGenerated || sourceId <= 0}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
          "bg-[#9B1B30] text-white hover:bg-[#B22040]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {isComparing ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <GitCompareArrows size={16} />
        )}
        Compare Profiles
      </button>

      {/* Cross-Cohort Search Button */}
      {hasComparisonResult && (
        <button
          type="button"
          onClick={handleCrossSearch}
          disabled={isSearching}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
            "bg-[#2DD4BF]/10 text-[#2DD4BF] border border-[#2DD4BF]/30 hover:bg-[#2DD4BF]/20",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isSearching ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Search size={16} />
          )}
          Find Matching Patients
        </button>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/patient-similarity/components/DivergenceScores.tsx \
  frontend/src/features/patient-similarity/components/CohortComparisonRadar.tsx \
  frontend/src/features/patient-similarity/components/CohortCompareForm.tsx
git commit -m "feat(similarity): add CohortCompareForm, CohortComparisonRadar, and DivergenceScores components"
```

---

## Task 11: Frontend — Wire Compare Cohorts tab into PatientSimilarityPage

**Files:**
- Modify: `frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { CohortCompareForm } from "../components/CohortCompareForm";
import { CohortComparisonRadar } from "../components/CohortComparisonRadar";
import { DivergenceScores } from "../components/DivergenceScores";
import {
  // ... existing imports ...
  useCompareCohorts,
  useCrossCohortSearch,
} from "../hooks/usePatientSimilarity";
import type {
  // ... existing imports ...
  CohortComparisonParams,
  CrossCohortSearchParams,
} from "../types/patientSimilarity";
```

- [ ] **Step 2: Add comparison mutations and state**

After the existing `cohortSearchMutation`, add:

```typescript
const compareMutation = useCompareCohorts();
const crossSearchMutation = useCrossCohortSearch();

const handleCompare = (params: CohortComparisonParams) => {
  compareMutation.mutate(params);
};

const handleCrossSearch = (params: CrossCohortSearchParams) => {
  crossSearchMutation.mutate(params);
  setLastSearchParams({
    person_id: 0,
    source_id: params.source_id,
    mode,
  });
};
```

- [ ] **Step 3: Update activeMutation to handle compare mode**

Update the active mutation logic:

```typescript
const activeMutation =
  searchMode === "compare"
    ? crossSearchMutation
    : searchMode === "cohort"
      ? cohortSearchMutation
      : searchMutation;
```

- [ ] **Step 4: Replace the Compare Cohorts placeholder in the left panel**

Replace the placeholder `div` from Task 9 with:

```typescript
{searchMode === "compare" && (
  <CohortCompareForm
    onCompare={handleCompare}
    onCrossSearch={handleCrossSearch}
    isComparing={compareMutation.isPending}
    isSearching={crossSearchMutation.isPending}
    hasComparisonResult={compareMutation.data != null}
  />
)}
```

- [ ] **Step 5: Add comparison results to the right panel**

Before the results table section (`{result ? (`), add the comparison visualization:

```typescript
{/* Compare Cohorts visualization */}
{searchMode === "compare" && compareMutation.data && (
  <div className="space-y-4">
    <CohortComparisonRadar
      sourceDimensions={compareMutation.data.source_cohort.dimensions}
      targetDimensions={compareMutation.data.target_cohort.dimensions}
      sourceName={compareMutation.data.source_cohort.name}
      targetName={compareMutation.data.target_cohort.name}
    />
    <DivergenceScores
      divergence={compareMutation.data.divergence}
      overallDivergence={compareMutation.data.overall_divergence}
    />
  </div>
)}
```

- [ ] **Step 6: Run TypeScript check and build**

```bash
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
docker compose exec -T node sh -c "cd /app && npx vite build"
```

- [ ] **Step 7: Fix file permissions**

```bash
chmod -R o+r /home/smudoshi/Github/Parthenon/frontend/dist/ && chmod o+x /home/smudoshi/Github/Parthenon/frontend/dist /home/smudoshi/Github/Parthenon/frontend/dist/assets
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx
git commit -m "feat(similarity): wire Compare Cohorts tab with radar overlay and divergence scores"
```

---

## Task 12: Final verification and cleanup

- [ ] **Step 1: Run Pint on all modified PHP files**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 2: Run TypeScript check**

```bash
docker compose exec -T node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 3: Build frontend**

```bash
docker compose exec -T node sh -c "cd /app && npx vite build"
chmod -R o+r /home/smudoshi/Github/Parthenon/frontend/dist/ && chmod o+x /home/smudoshi/Github/Parthenon/frontend/dist /home/smudoshi/Github/Parthenon/frontend/dist/assets
```

- [ ] **Step 4: Clear route cache**

```bash
docker compose exec -T php php artisan route:clear && docker compose exec -T php php artisan route:cache
```

- [ ] **Step 5: Verify routes are registered**

```bash
docker compose exec -T php php artisan route:list --path=patient-similarity
```

Expected: should show all routes including `expand-cohort`, `compare-cohorts`, `cross-cohort-search`

- [ ] **Step 6: Smoke test the cohort-profile endpoint**

```bash
curl -s -H "Accept: application/json" -H "Authorization: Bearer $TOKEN" \
  "https://parthenon.acumenus.net/api/v1/patient-similarity/cohort-profile?cohort_definition_id=225&source_id=58" \
  | python3 -m json.tool | head -5
```

Expected: 200 with `"generated": false` or `"generated": true`

- [ ] **Step 7: Commit any remaining fixes**

```bash
git add -A
git status
# Only commit if there are changes
git commit -m "chore(similarity): final cleanup for cohort similarity parity upgrade"
```
