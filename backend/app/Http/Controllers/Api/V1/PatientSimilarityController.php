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
use App\Services\PatientSimilarity\PatientSimilarityService;
use App\Services\PatientSimilarity\SimilarityExplainer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @group Patient Similarity Engine
 */
class PatientSimilarityController extends Controller
{
    use SourceAware;

    public function __construct(
        private readonly PatientSimilarityService $service,
        private readonly CohortCentroidBuilder $centroidBuilder,
        private readonly SimilarityExplainer $explainer,
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
                    'mode' => $mode,
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
                'strategy' => ['sometimes', 'string', 'in:centroid,exemplar'],
                'filters' => ['sometimes', 'array'],
            ]);

            $source = Source::with('daimons')->findOrFail($validated['source_id']);
            $strategy = $validated['strategy'] ?? 'centroid';
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

            return response()->json([
                'data' => $results,
                'meta' => [
                    'strategy' => $strategy,
                    'cohort_definition_id' => (int) $validated['cohort_definition_id'],
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
        if ($seedPersonId === null) {
            return $results;
        }

        // Collect person IDs to load
        $personIds = array_filter(
            array_merge(
                [$seedPersonId],
                array_map(fn (array $p): int => (int) ($p['person_id'] ?? 0), $similarPatients),
            ),
        );

        // Batch load feature vectors
        $vectors = PatientFeatureVector::query()
            ->forSource($sourceId)
            ->whereIn('person_id', $personIds)
            ->get()
            ->keyBy('person_id');

        $seedVector = $vectors->get($seedPersonId);
        if ($seedVector === null) {
            return $results;
        }

        $seedData = $seedVector->toArray();
        $candidateVectors = [];
        foreach ($vectors as $personId => $vector) {
            if ($personId !== $seedPersonId) {
                $candidateVectors[$personId] = $vector->toArray();
            }
        }

        $results['similar_patients'] = $this->explainer->enrichResults(
            $seedData,
            $similarPatients,
            $candidateVectors,
        );

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

            $centroid = $this->centroidBuilder->buildCentroid($memberIds, $source);
            $vectors = PatientFeatureVector::query()
                ->forSource($source->id)
                ->whereIn('person_id', $memberIds)
                ->get();

            $memberCount = $vectors->count();

            // Compute per-dimension richness (fraction of members with data)
            $dimensionProfile = [
                'demographics' => [
                    'coverage' => 1.0, // always available
                    'median_age_bucket' => $centroid['age_bucket'],
                    'dominant_gender' => $centroid['gender_concept_id'],
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
        } catch (\Throwable $e) {
            return $this->errorResponse('Cohort profile failed', $e);
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
}
