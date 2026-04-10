<?php

namespace App\Http\Controllers\Api\V1;

use App\Concerns\SourceAware;
use App\Context\SourceContext;
use App\Http\Controllers\Controller;
use App\Http\Requests\PatientSimilarityComputeRequest;
use App\Http\Requests\PatientSimilarityExportCohortRequest;
use App\Http\Requests\PatientSimilaritySearchRequest;
use App\Jobs\ComputePatientFeatureVectors;
use App\Models\App\CohortDefinition;
use App\Models\App\PatientFeatureVector;
use App\Models\App\PatientSimilarityCache;
use App\Models\App\SimilarityDimension;
use App\Models\App\Source;
use App\Services\PatientSimilarity\CohortCentroidBuilder;
use App\Services\PatientSimilarity\CohortComparisonService;
use App\Services\PatientSimilarity\PatientSimilarityService;
use App\Services\PatientSimilarity\SearchResultDiagnosticsService;
use App\Services\PatientSimilarity\SimilarityExplainer;
use Illuminate\Http\Client\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

/**
 * @group Patient Similarity Engine
 */
class PatientSimilarityController extends Controller
{
    use SourceAware;

    public function __construct(
        private readonly PatientSimilarityService $service,
        private readonly CohortCentroidBuilder $centroidBuilder,
        private readonly SearchResultDiagnosticsService $diagnosticsService,
        private readonly SimilarityExplainer $explainer,
        private readonly CohortComparisonService $comparisonService,
    ) {}

    /**
     * POST /v1/patient-similarity/search
     *
     * Find patients similar to a seed patient.
     */
    public function search(PatientSimilaritySearchRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();
            $source = Source::with('daimons')->findOrFail($validated['source_id']);

            // Merge user-supplied weights with dimension defaults
            $dimensions = SimilarityDimension::active()->get();
            $weights = [];
            foreach ($dimensions as $dimension) {
                $weights[$dimension->key] = $validated['weights'][$dimension->key]
                    ?? $dimension->default_weight;
            }

            $mode = $validated['mode'] ?? 'interpretable';
            $limit = $validated['limit'] ?? 20;
            $minScore = $validated['min_score'] ?? 0.0;
            $filters = $validated['filters'] ?? [];

            $results = $this->service->search(
                personId: (int) $validated['person_id'],
                source: $source,
                mode: $mode,
                weights: $weights,
                limit: $limit,
                minScore: $minScore,
                filters: $filters,
            );

            // Cache may return more results than requested limit — trim
            if (count($results['similar_patients'] ?? []) > $limit) {
                $results['similar_patients'] = array_slice($results['similar_patients'], 0, $limit);
            }

            // Enrich results with shared features and similarity explanations
            $results = $this->enrichSearchResults($results, $source->id);
            $results = $this->appendDiagnostics($results, $source->id);

            $results = $this->mergeMetadata($results, [
                'mode' => $results['mode'] ?? $mode,
                'seed_person_id' => (int) $validated['person_id'],
                'source_id' => $source->id,
                'limit' => $limit,
                'min_score' => $minScore,
                'count' => count($results['similar_patients'] ?? []),
            ]);

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

            return response()->json([
                'data' => $results,
                'meta' => [
                    'mode' => $results['mode'] ?? $mode,
                    'seed_person_id' => (int) $validated['person_id'],
                    'source_id' => $source->id,
                    'limit' => $limit,
                    'min_score' => $minScore,
                    'count' => count($results['similar_patients'] ?? []),
                ],
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Patient similarity search failed', $e);
        }
    }

    /**
     * GET /v1/patient-similarity/dimensions
     *
     * List active similarity dimensions with their default weights.
     */
    public function dimensions(): JsonResponse
    {
        try {
            $dimensions = SimilarityDimension::active()->get();

            return response()->json([
                'data' => $dimensions,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve similarity dimensions', $e);
        }
    }

    /**
     * POST /v1/patient-similarity/compute
     *
     * Dispatch feature vector computation for a source.
     */
    public function compute(PatientSimilarityComputeRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();
            $source = Source::with('daimons')->findOrFail($validated['source_id']);
            $force = $validated['force'] ?? false;

            // Check staleness — skip dispatch if vectors are fresh and not forced
            if (! $force) {
                $status = $this->service->getStatus($source);
                if ($status['total_vectors'] > 0 && ! $status['staleness_warning']) {
                    return response()->json([
                        'message' => 'Feature vectors are up-to-date. Use force=true to recompute.',
                        'data' => $status,
                    ]);
                }
            }

            ComputePatientFeatureVectors::dispatch($source, $force);

            return response()->json([
                'message' => 'Feature vector computation queued.',
                'data' => [
                    'source_id' => $source->id,
                    'source_name' => $source->source_name,
                    'force' => $force,
                ],
            ], 202);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to queue feature vector computation', $e);
        }
    }

    /**
     * GET /v1/patient-similarity/status/{sourceId}
     *
     * Get feature vector computation status for a source.
     */
    public function status(int $sourceId): JsonResponse
    {
        try {
            $source = Source::findOrFail($sourceId);
            $status = $this->service->getStatus($source);

            return response()->json([
                'data' => $status,
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Failed to retrieve similarity status', $e);
        }
    }

    /**
     * POST /v1/patient-similarity/search-from-cohort
     *
     * Find patients similar to a cohort centroid or exemplar.
     */
    public function searchFromCohort(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'cohort_definition_id' => ['required', 'integer', 'exists:cohort_definitions,id'],
                'source_id' => ['required', 'integer', 'exists:sources,id'],
                'mode' => ['sometimes', 'string', 'in:interpretable,embedding,auto'],
                'weights' => ['sometimes', 'array'],
                'weights.*' => ['numeric', 'min:0', 'max:10'],
                'limit' => ['sometimes', 'integer', 'min:1', 'max:100'],
                'min_score' => ['sometimes', 'numeric', 'min:0', 'max:1'],
                'filters' => ['sometimes', 'array'],
                'filters.age_range' => ['sometimes', 'array', 'size:2'],
                'filters.age_range.*' => ['integer', 'min:0', 'max:150'],
                'filters.age_min' => ['sometimes', 'integer', 'min:0', 'max:150'],
                'filters.age_max' => ['sometimes', 'integer', 'min:0', 'max:150'],
                'filters.gender_concept_id' => ['sometimes', 'integer'],
                'filters.gender' => ['sometimes', 'string', 'in:MALE,FEMALE'],
            ]);

            $source = Source::with('daimons')->findOrFail($validated['source_id']);
            $limit = $validated['limit'] ?? 20;
            $minScore = $validated['min_score'] ?? 0.0;
            $filters = $validated['filters'] ?? [];

            // Merge user-supplied weights with dimension defaults
            $dimensions = SimilarityDimension::active()->get();
            $weights = [];
            foreach ($dimensions as $dimension) {
                $weights[$dimension->key] = $validated['weights'][$dimension->key]
                    ?? $dimension->default_weight;
            }

            // Get cohort member person_ids from results.cohort
            SourceContext::forSource($source);
            $memberRows = $this->results()
                ->table('cohort')
                ->where('cohort_definition_id', $validated['cohort_definition_id'])
                ->pluck('subject_id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all();

            if (empty($memberRows)) {
                return response()->json([
                    'data' => [],
                    'meta' => [
                        'error' => 'Cohort has no members. Generate the cohort first.',
                        'cohort_definition_id' => $validated['cohort_definition_id'],
                    ],
                ]);
            }

            // Build centroid from cohort members
            $centroid = $this->centroidBuilder->buildCentroid($memberRows, $source);

            $results = $this->service->searchFromCentroid(
                centroidData: $centroid,
                source: $source,
                excludePersonIds: $memberRows,
                weights: $weights,
                limit: $limit,
                minScore: $minScore,
                filters: $filters,
            );

            // Enrich results with shared features and explanations
            $results = $this->enrichSearchResults($results, $source->id);
            $results = $this->appendDiagnostics($results, $source->id, $memberRows);

            $results = $this->mergeMetadata($results, [
                'cohort_definition_id' => (int) $validated['cohort_definition_id'],
                'cohort_name' => CohortDefinition::find($validated['cohort_definition_id'])?->name ?? 'Unknown Cohort',
                'cohort_member_count' => count($memberRows),
                'source_id' => $source->id,
                'limit' => $limit,
                'min_score' => $minScore,
                'count' => count($results['similar_patients'] ?? []),
            ]);

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

            return response()->json([
                'data' => $results,
                'meta' => [
                    'cohort_definition_id' => (int) $validated['cohort_definition_id'],
                    'cohort_name' => $results['metadata']['cohort_name'] ?? 'Unknown Cohort',
                    'cohort_member_count' => count($memberRows),
                    'source_id' => $source->id,
                    'limit' => $limit,
                    'min_score' => $minScore,
                    'count' => count($results['similar_patients'] ?? []),
                ],
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Cohort similarity search failed', $e);
        }
    }

    /**
     * POST /v1/patient-similarity/export-cohort
     *
     * Export cached similarity results as a new cohort definition.
     */
    public function exportCohort(PatientSimilarityExportCohortRequest $request): JsonResponse
    {
        try {
            $validated = $request->validated();

            $cache = PatientSimilarityCache::findOrFail($validated['cache_id']);
            $results = $cache->results;
            $minScore = $validated['min_score'] ?? 0.0;

            // Filter similar_patients by min_score
            $similarPatients = $results['similar_patients'] ?? [];
            $filteredPatients = array_filter(
                $similarPatients,
                fn (array $p) => ($p['overall_score'] ?? 0) >= $minScore
            );

            $personIds = array_map(fn (array $p) => (int) $p['person_id'], $filteredPatients);

            if (empty($personIds)) {
                return response()->json([
                    'error' => 'No patients meet the minimum score threshold.',
                    'min_score' => $minScore,
                ], 422);
            }

            // Create cohort definition
            $cohort = CohortDefinition::create([
                'name' => $validated['cohort_name'],
                'description' => $validated['cohort_description'] ?? 'Generated from patient similarity search results.',
                'expression_json' => [
                    'type' => 'patient_similarity_export',
                    'cache_id' => $cache->id,
                    'seed_person_id' => $cache->seed_person_id,
                    'source_id' => $cache->source_id,
                    'min_score' => $minScore,
                    'query_hash' => $results['metadata']['query_hash'] ?? null,
                    'weights' => $results['metadata']['weights'] ?? null,
                    'filters_applied' => $results['metadata']['filters_applied'] ?? null,
                    'temporal_window_days' => $results['metadata']['temporal_window_days'] ?? null,
                    'feature_vector_version' => $results['metadata']['feature_vector_version'] ?? null,
                    'diagnostics' => $results['metadata']['diagnostics'] ?? null,
                ],
                'author_id' => $request->user()->id,
                'is_public' => false,
            ]);

            // Insert person_ids into results.cohort via source-aware connection
            $source = Source::with('daimons')->findOrFail($cache->source_id);
            SourceContext::forSource($source);

            $today = now()->toDateString();
            $rows = array_map(fn (int $personId) => [
                'cohort_definition_id' => $cohort->id,
                'subject_id' => $personId,
                'cohort_start_date' => $today,
                'cohort_end_date' => $today,
            ], $personIds);

            $this->results()->table('cohort')->insert($rows);

            return response()->json([
                'data' => [
                    'cohort_definition_id' => $cohort->id,
                    'patient_count' => count($personIds),
                    'cohort_name' => $cohort->name,
                ],
            ], 201);
        } catch (\Throwable $e) {
            return $this->errorResponse('Cohort export failed', $e);
        }
    }

    /**
     * GET /v1/patient-similarity/compare
     *
     * Compare two patients head-to-head.
     */
    public function compare(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'person_a' => ['required', 'integer'],
                'person_b' => ['required', 'integer'],
                'source_id' => ['required', 'integer', 'exists:sources,id'],
            ]);

            $source = Source::findOrFail($validated['source_id']);

            $vectorA = PatientFeatureVector::query()
                ->forSource($source->id)
                ->where('person_id', $validated['person_a'])
                ->first();

            $vectorB = PatientFeatureVector::query()
                ->forSource($source->id)
                ->where('person_id', $validated['person_b'])
                ->first();

            if ($vectorA === null || $vectorB === null) {
                $missing = [];
                if ($vectorA === null) {
                    $missing[] = $validated['person_a'];
                }
                if ($vectorB === null) {
                    $missing[] = $validated['person_b'];
                }

                return response()->json([
                    'error' => 'Feature vectors not found for one or both patients.',
                    'missing_person_ids' => $missing,
                ], 404);
            }

            // Score with default dimension weights
            $dimensions = SimilarityDimension::active()->get();
            $weights = [];
            foreach ($dimensions as $dimension) {
                $weights[$dimension->key] = $dimension->default_weight;
            }

            $dataA = $vectorA->toArray();
            $dataB = $vectorB->toArray();

            $scores = $this->service->scorePatientPair($dataA, $dataB, $weights);

            // Compute shared features
            $sharedConditions = array_values(array_intersect(
                $dataA['condition_concepts'] ?? [],
                $dataB['condition_concepts'] ?? []
            ));
            $sharedDrugs = array_values(array_intersect(
                $dataA['drug_concepts'] ?? [],
                $dataB['drug_concepts'] ?? []
            ));
            $sharedProcedures = array_values(array_intersect(
                $dataA['procedure_concepts'] ?? [],
                $dataB['procedure_concepts'] ?? []
            ));

            $rawResult = [
                'person_a' => [
                    'person_id' => $vectorA->person_id,
                    'age_bucket' => $vectorA->age_bucket,
                    'gender_concept_id' => $vectorA->gender_concept_id,
                    'condition_count' => $vectorA->condition_count,
                    'lab_count' => $vectorA->lab_count,
                    'dimensions_available' => $vectorA->dimensions_available,
                ],
                'person_b' => [
                    'person_id' => $vectorB->person_id,
                    'age_bucket' => $vectorB->age_bucket,
                    'gender_concept_id' => $vectorB->gender_concept_id,
                    'condition_count' => $vectorB->condition_count,
                    'lab_count' => $vectorB->lab_count,
                    'dimensions_available' => $vectorB->dimensions_available,
                ],
                'scores' => $scores,
                'shared_features' => [
                    'conditions' => $sharedConditions,
                    'drugs' => $sharedDrugs,
                    'procedures' => $sharedProcedures,
                    'condition_count' => count($sharedConditions),
                    'drug_count' => count($sharedDrugs),
                    'procedure_count' => count($sharedProcedures),
                ],
            ];

            // Resolve concept IDs to human-readable names
            $enriched = $this->explainer->enrichComparison($rawResult);

            return response()->json(['data' => $enriched]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Patient comparison failed', $e);
        }
    }

    /**
     * Enrich search results with shared features and similarity explanations.
     *
     * Loads the seed + candidate feature vectors and passes them through
     * the SimilarityExplainer for concept name resolution and narrative generation.
     *
     * @param  array<string, mixed>  $results  Raw search results
     * @return array<string, mixed> Enriched results
     */
    private function enrichSearchResults(array $results, int $sourceId): array
    {
        $similarPatients = $results['similar_patients'] ?? [];
        if ($similarPatients === []) {
            return $results;
        }

        $seedPersonId = $results['seed']['person_id'] ?? null;

        // For centroid-based searches (person_id = 0), use the seed array from results as feature data
        $seedData = null;
        if ($seedPersonId === 0 || $seedPersonId === null) {
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

    /**
     * Append researcher-facing diagnostics for the returned result cohort.
     *
     * @param  array<string, mixed>  $results
     * @param  array<int>|null  $referencePersonIds
     * @return array<string, mixed>
     */
    private function appendDiagnostics(array $results, int $sourceId, ?array $referencePersonIds = null): array
    {
        $similarPatients = $results['similar_patients'] ?? [];

        if ($similarPatients === []) {
            $results['metadata'] = array_merge($results['metadata'] ?? [], [
                'diagnostics' => [
                    'result_profile' => [
                        'result_count' => 0,
                        'dimension_coverage' => [],
                    ],
                    'balance' => [
                        'applicable' => false,
                        'reference' => $referencePersonIds !== null ? 'seed_cohort' : 'single_patient',
                        'verdict' => 'insufficient_data',
                        'covariates' => [],
                    ],
                    'warnings' => ['No similar patients were returned.'],
                ],
            ]);

            return $results;
        }

        $seedPersonId = $results['seed']['person_id'] ?? null;
        $seedData = null;
        if ($seedPersonId === 0 || $seedPersonId === null) {
            $seedData = $results['seed'] ?? null;
        }

        $candidatePersonIds = array_values(array_filter(
            array_map(fn (array $patient): int => (int) ($patient['person_id'] ?? 0), $similarPatients),
        ));

        $resultVectors = PatientFeatureVector::query()
            ->forSource($sourceId)
            ->whereIn('person_id', $candidatePersonIds)
            ->get();

        if ($seedData === null && $seedPersonId !== null) {
            $seedVector = PatientFeatureVector::query()
                ->forSource($sourceId)
                ->where('person_id', $seedPersonId)
                ->first();

            if ($seedVector !== null) {
                $seedData = $seedVector->toArray();
            }
        }

        if ($seedData === null) {
            return $results;
        }

        $referenceVectors = null;
        if ($referencePersonIds !== null && $referencePersonIds !== []) {
            $referenceVectors = PatientFeatureVector::query()
                ->forSource($sourceId)
                ->whereIn('person_id', $referencePersonIds)
                ->get()
                ->map(fn (PatientFeatureVector $vector): array => $vector->toArray())
                ->all();
        }

        $diagnostics = $this->diagnosticsService->build(
            $seedData,
            $resultVectors->map(fn (PatientFeatureVector $vector): array => $vector->toArray())->all(),
            $referenceVectors,
        );

        $results['metadata'] = array_merge($results['metadata'] ?? [], [
            'diagnostics' => $diagnostics,
        ]);

        return $results;
    }

    /**
     * Build a standardized error response for service failures.
     */
    /**
     * GET /v1/patient-similarity/cohort-profile
     *
     * Get a cohort's centroid profile for radar chart visualization.
     * Returns per-dimension richness scores (0-1) representing how much
     * clinical data exists in each dimension across cohort members.
     */
    public function cohortProfile(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'cohort_definition_id' => ['required', 'integer', 'exists:cohort_definitions,id'],
                'source_id' => ['required', 'integer', 'exists:sources,id'],
            ]);

            $source = Source::with('daimons')->findOrFail($validated['source_id']);
            SourceContext::forSource($source);

            $memberIds = $this->results()
                ->table('cohort')
                ->where('cohort_definition_id', $validated['cohort_definition_id'])
                ->pluck('subject_id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all();

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

            // Use SQL-based coverage counting to avoid loading all vectors into memory
            // For large cohorts (100K+), loading all vectors would OOM
            $dimensionProfile = $this->buildDimensionProfileFromSql($memberIds, $source->id);

            // Derive dimensions_available from coverage > 0
            $dimensionsAvailable = [];
            foreach ($dimensionProfile as $key => $dim) {
                if ($dim['coverage'] > 0) {
                    $dimensionsAvailable[] = $key;
                }
            }

            return response()->json([
                'data' => [
                    'cohort_definition_id' => (int) $validated['cohort_definition_id'],
                    'source_id' => $source->id,
                    'member_count' => count($memberIds),
                    'generated' => true,
                    'dimensions' => $dimensionProfile,
                    'dimensions_available' => $dimensionsAvailable,
                ],
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Cohort profile failed', $e);
        }
    }

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

    /**
     * Build a dimension profile from feature vectors and centroid data.
     *
     * @param  Collection  $vectors
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

    /**
     * Build a dimension profile using SQL COUNT queries instead of loading all vectors.
     * Handles large cohorts (100K+ members) without memory issues.
     *
     * @param  array<int>  $memberIds
     * @param  array<string, mixed>  $centroid
     * @return array<string, array<string, mixed>>
     */
    private function buildDimensionProfileFromSql(array $memberIds, int $sourceId, ?array $centroid = null): array
    {
        $memberCount = count($memberIds);
        if ($memberCount === 0) {
            return $this->buildDimensionProfile(collect(), $centroid ?? []);
        }

        $pgArray = '{'.implode(',', $memberIds).'}';

        $coverage = DB::selectOne("
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE condition_concepts IS NOT NULL AND condition_concepts != '[]' AND condition_concepts != 'null') AS has_conditions,
                COUNT(*) FILTER (WHERE lab_vector IS NOT NULL AND lab_vector != '{}' AND lab_vector != 'null') AS has_labs,
                COUNT(*) FILTER (WHERE drug_concepts IS NOT NULL AND drug_concepts != '[]' AND drug_concepts != 'null') AS has_drugs,
                COUNT(*) FILTER (WHERE procedure_concepts IS NOT NULL AND procedure_concepts != '[]' AND procedure_concepts != 'null') AS has_procedures,
                COUNT(*) FILTER (WHERE variant_genes IS NOT NULL AND variant_genes != '[]' AND variant_genes != 'null') AS has_genomics
            FROM patient_feature_vectors
            WHERE source_id = ? AND person_id = ANY(?::bigint[])
        ", [$sourceId, $pgArray]);

        $total = (int) ($coverage->total ?? 0);

        return [
            'demographics' => [
                'coverage' => 1.0,
                'label' => 'Demographics',
            ],
            'conditions' => [
                'coverage' => $total > 0 ? round((int) $coverage->has_conditions / $total, 4) : 0,
                'unique_concepts' => count($centroid['condition_concepts'] ?? []),
                'label' => 'Conditions',
            ],
            'measurements' => [
                'coverage' => $total > 0 ? round((int) $coverage->has_labs / $total, 4) : 0,
                'unique_measurements' => count($centroid['lab_vector'] ?? []),
                'label' => 'Measurements',
            ],
            'drugs' => [
                'coverage' => $total > 0 ? round((int) $coverage->has_drugs / $total, 4) : 0,
                'unique_concepts' => count($centroid['drug_concepts'] ?? []),
                'label' => 'Drugs',
            ],
            'procedures' => [
                'coverage' => $total > 0 ? round((int) $coverage->has_procedures / $total, 4) : 0,
                'unique_concepts' => count($centroid['procedure_concepts'] ?? []),
                'label' => 'Procedures',
            ],
            'genomics' => [
                'coverage' => $total > 0 ? round((int) $coverage->has_genomics / $total, 4) : 0,
                'unique_genes' => count($centroid['variant_genes'] ?? []),
                'label' => 'Genomics',
            ],
        ];
    }

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

            $sourceCentroid = $this->centroidBuilder->buildCentroid($sourceMemberIds, $source);
            $targetCentroid = $this->centroidBuilder->buildCentroid($targetMemberIds, $source);

            $sourceProfile = $this->buildDimensionProfileFromSql($sourceMemberIds, $source->id, $sourceCentroid);
            $targetProfile = $this->buildDimensionProfileFromSql($targetMemberIds, $source->id, $targetCentroid);
            $comparison = $this->service->compareProfiles($sourceCentroid, $targetCentroid);

            // Load raw member vectors for covariate balance and distributional divergence
            $sourceVectors = PatientFeatureVector::query()
                ->forSource($source->id)
                ->whereIn('person_id', $sourceMemberIds)
                ->get()
                ->map(fn (PatientFeatureVector $v): array => $v->toArray())
                ->all();

            $targetVectors = PatientFeatureVector::query()
                ->forSource($source->id)
                ->whereIn('person_id', $targetMemberIds)
                ->get()
                ->map(fn (PatientFeatureVector $v): array => $v->toArray())
                ->all();

            $covariateBalance = $this->comparisonService->computeCovariateBalance($sourceVectors, $targetVectors);
            $distributionalDivergence = $this->comparisonService->computeDistributionalDivergence(
                $sourceCentroid,
                $targetCentroid,
                $sourceVectors,
                $targetVectors,
            );

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
                    'divergence' => $comparison['divergence'],
                    'overall_divergence' => $comparison['overall_divergence'],
                    'covariate_balance' => $covariateBalance,
                    'distributional_divergence' => $distributionalDivergence,
                ],
            ]);
        } catch (\Throwable $e) {
            return $this->errorResponse('Cohort comparison failed', $e);
        }
    }

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

            $centroid = $this->centroidBuilder->buildCentroid($sourceMemberIds, $source);

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

            $results = $this->enrichSearchResults($results, $source->id);
            $results = $this->appendDiagnostics($results, $source->id, $sourceMemberIds);

            $results = $this->mergeMetadata($results, [
                'source_cohort_id' => (int) $validated['source_cohort_id'],
                'source_cohort_name' => CohortDefinition::find($validated['source_cohort_id'])?->name ?? 'Unknown',
                'target_cohort_id' => (int) $validated['target_cohort_id'],
                'source_id' => $source->id,
                'excluded_count' => count($excludeIds),
                'limit' => $limit,
                'count' => count($results['similar_patients'] ?? []),
            ]);

            return response()->json([
                'data' => $results,
                'meta' => [
                    'source_cohort_id' => (int) $validated['source_cohort_id'],
                    'source_cohort_name' => $results['metadata']['source_cohort_name'] ?? 'Unknown',
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

    private function errorResponse(string $message, \Throwable $exception): JsonResponse
    {
        $response = [
            'error' => $message,
            'message' => $exception->getMessage(),
        ];

        if (config('app.debug')) {
            $response['trace'] = $exception->getTraceAsString();
        }

        return response()->json($response, 500);
    }

    /**
     * POST /v1/patient-similarity/landscape
     *
     * Project all patient embeddings for a source into 2D/3D UMAP space.
     */
    public function landscape(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'source_id' => ['required', 'integer', 'exists:sources,id'],
                'cohort_definition_id' => ['sometimes', 'integer'],
                'dimensions' => ['sometimes', 'integer', 'in:2,3'],
                'max_points' => ['sometimes', 'integer', 'min:10', 'max:50000'],
            ]);

            $payload = [
                'source_id' => $validated['source_id'],
                'dimensions' => $validated['dimensions'] ?? 3,
                'max_points' => $validated['max_points'] ?? 5000,
            ];

            // Resolve cohort member person_ids if cohort_definition_id provided
            if (! empty($validated['cohort_definition_id'])) {
                $source = Source::with('daimons')->findOrFail($validated['source_id']);
                SourceContext::forSource($source);

                $cohortPersonIds = $this->results()
                    ->table('cohort')
                    ->where('cohort_definition_id', $validated['cohort_definition_id'])
                    ->pluck('subject_id')
                    ->map(fn ($id) => (int) $id)
                    ->unique()
                    ->values()
                    ->all();

                $payload['cohort_person_ids'] = $cohortPersonIds;
            }

            $aiUrl = rtrim((string) config('services.ai.url', 'http://python-ai:8000'), '/');

            /** @var Response $aiResponse */
            $aiResponse = Http::timeout(120)
                ->post("{$aiUrl}/patient-similarity/project", $payload);

            if (! $aiResponse->successful()) {
                return response()->json([
                    'error' => 'AI service returned an error',
                    'detail' => $aiResponse->json('detail', 'Unknown error'),
                ], $aiResponse->status());
            }

            return response()->json($aiResponse->json());
        } catch (ValidationException $e) {
            return response()->json(['error' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Landscape projection failed: '.$e->getMessage()], 500);
        }
    }

    /**
     * POST /v1/patient-similarity/temporal-compare
     *
     * Proxy to Python AI temporal similarity (DTW) endpoint.
     */
    public function temporalCompare(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'source_id' => ['required', 'integer', 'exists:sources,id'],
                'person_a_id' => ['required', 'integer'],
                'person_b_id' => ['required', 'integer'],
                'measurement_concept_ids' => ['sometimes', 'array'],
                'measurement_concept_ids.*' => ['integer'],
            ]);

            $aiUrl = rtrim((string) config('services.ai.url', 'http://python-ai:8000'), '/');

            /** @var Response $aiResponse */
            $aiResponse = Http::timeout(30)
                ->post("{$aiUrl}/patient-similarity/temporal-similarity", $validated);

            if (! $aiResponse->successful()) {
                return response()->json([
                    'error' => 'AI service returned an error',
                    'detail' => $aiResponse->json('detail', 'Unknown error'),
                ], $aiResponse->status());
            }

            return response()->json(['data' => $aiResponse->json()]);
        } catch (ValidationException $e) {
            return response()->json(['error' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Temporal comparison failed: '.$e->getMessage()], 500);
        }
    }

    /**
     * Merge controller-level metadata into the canonical data.metadata payload.
     *
     * @param  array<string, mixed>  $results
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function mergeMetadata(array $results, array $metadata): array
    {
        $results['metadata'] = array_merge($results['metadata'] ?? [], $metadata);

        return $results;
    }
}
