<?php

declare(strict_types=1);

namespace App\Services\PatientSimilarity;

use App\Models\App\PatientFeatureVector;
use App\Models\App\PatientSimilarityCache;
use App\Models\App\Source;
use App\Services\PatientSimilarity\Scorers\ConditionScorer;
use App\Services\PatientSimilarity\Scorers\DemographicsScorer;
use App\Services\PatientSimilarity\Scorers\DimensionScorerInterface;
use App\Services\PatientSimilarity\Scorers\DrugScorer;
use App\Services\PatientSimilarity\Scorers\GenomicScorer;
use App\Services\PatientSimilarity\Scorers\MeasurementScorer;
use App\Services\PatientSimilarity\Scorers\ProcedureScorer;
use App\Services\PatientSimilarity\Scorers\TemporalScorer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class PatientSimilarityService
{
    private const int CACHE_TTL_MINUTES = 60;

    private const int STALENESS_THRESHOLD_DAYS = 7;

    private const int RECENT_WINDOW_DAYS = 365;

    /** @var array<string, int> */
    private const array GENDER_CONCEPT_MAP = [
        'MALE' => 8507,
        'FEMALE' => 8532,
    ];

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
            'temporal' => new TemporalScorer,
        ];
    }

    /**
     * Search for patients similar to the seed patient.
     *
     * @param  array<string, float>  $weights  Dimension weights (key => 0.0–1.0)
     * @param  array<string, mixed>  $filters  Optional filters (gender_concept_id, age_range)
     * @return array<string, mixed> {seed, mode, similar_patients[], metadata}
     */
    public function search(
        int $personId,
        Source $source,
        string $mode,
        array $weights,
        int $limit,
        float $minScore,
        array $filters = [],
    ): array {
        $filters = $this->normalizeFilters($filters);
        $weightsHash = PatientSimilarityCache::hashWeights($weights);
        $queryHash = PatientSimilarityCache::hashQuery($filters, $limit, $minScore);

        // Check cache first
        $cached = PatientSimilarityCache::query()
            ->where('source_id', $source->id)
            ->where('seed_person_id', $personId)
            ->where('mode', $mode)
            ->where('weights_hash', $weightsHash)
            ->where('query_hash', $queryHash)
            ->valid()
            ->first();

        if ($cached !== null) {
            $results = $cached->results;
            $results['metadata'] = array_merge($results['metadata'] ?? [], [
                'cache_id' => $cached->id,
                'query_hash' => $queryHash,
            ]);

            return $results;
        }

        // Load seed patient's feature vector
        $seed = PatientFeatureVector::query()
            ->forSource($source->id)
            ->where('person_id', $personId)
            ->first();

        if ($seed === null) {
            return [
                'seed' => ['person_id' => $personId],
                'mode' => $mode,
                'similar_patients' => [],
                'metadata' => [
                    'error' => 'Seed patient has no feature vector. Run feature extraction first.',
                    'total_candidates' => 0,
                    'filters_applied' => $filters,
                    'limit' => $limit,
                    'min_score' => $minScore,
                    'query_hash' => $queryHash,
                    'computed_at' => now()->toIso8601String(),
                ],
            ];
        }

        // Auto-select embedding mode for large sources when mode is 'auto' or 'embedding'
        $effectiveMode = $mode;
        if ($mode === 'auto') {
            $vectorCount = PatientFeatureVector::query()
                ->forSource($source->id)
                ->count();
            $embeddingCount = PatientFeatureVector::query()
                ->forSource($source->id)
                ->whereNotNull('embedding')
                ->count();
            $embeddingsReady = $vectorCount > 0 && $embeddingCount === $vectorCount;
            $effectiveMode = ($embeddingsReady && $vectorCount > self::IN_MEMORY_THRESHOLD)
                ? 'embedding'
                : 'interpretable';
        }

        // Route to search strategy
        $results = match ($effectiveMode) {
            'embedding' => $this->searchEmbedding($seed, $source, $weights, $limit, $minScore, $filters),
            default => $this->searchInterpretable($seed, $source, $weights, $limit, $minScore, $filters),
        };

        // Cache results
        $cache = PatientSimilarityCache::query()->updateOrCreate(
            [
                'source_id' => $source->id,
                'seed_person_id' => $personId,
                'mode' => $mode,
                'weights_hash' => $weightsHash,
                'query_hash' => $queryHash,
            ],
            [
                'results' => $results,
                'computed_at' => now(),
                'expires_at' => now()->addMinutes(self::CACHE_TTL_MINUTES),
            ],
        );

        $results['metadata'] = array_merge($results['metadata'] ?? [], [
            'cache_id' => $cache->id,
            'query_hash' => $queryHash,
        ]);

        return $results;
    }

    /**
     * Maximum candidates to load into PHP for in-memory scoring.
     * Sources above this threshold use SQL-side pre-scoring.
     */
    private const int IN_MEMORY_THRESHOLD = 5000;

    /**
     * Pre-score candidate pool size multiplier for SQL-side filtering.
     * We fetch limit * multiplier candidates from SQL, then re-score in PHP.
     */
    private const int SQL_CANDIDATE_MULTIPLIER = 10;

    /**
     * Interpretable multi-dimension weighted search.
     *
     * For small sources (<5K vectors): loads all candidates into PHP for scoring.
     * For large sources: pre-scores in SQL using demographics + condition overlap,
     * loads only the top candidates, then re-scores with full dimension scorers.
     *
     * @param  array<string, float>  $weights
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function searchInterpretable(
        PatientFeatureVector $seed,
        Source $source,
        array $weights,
        int $limit,
        float $minScore,
        array $filters = [],
    ): array {
        $seedData = $seed->toArray();

        $query = PatientFeatureVector::query()
            ->forSource($source->id)
            ->where('person_id', '!=', $seed->person_id)
            ->orderBy('person_id');

        $this->applyFilters($query, $filters);

        // Check filtered candidate count to decide strategy
        $totalCandidates = (clone $query)->count();

        if ($totalCandidates > self::IN_MEMORY_THRESHOLD) {
            return $this->searchInterpretableSql($seed, $source, $weights, $limit, $minScore, $filters, $totalCandidates);
        }

        // Small source: load all filtered candidates into PHP
        $candidates = $query->get();

        // Score each candidate
        $scored = [];
        foreach ($candidates as $candidate) {
            $result = $this->scorePatientPair($seedData, $candidate->toArray(), $weights);

            if ($result['overall_score'] >= $minScore) {
                $scored[] = $this->buildScoredPatient($candidate, $result);
            }
        }

        // Sort by overall_score descending, take top $limit
        usort($scored, static fn (array $a, array $b): int => $b['overall_score'] <=> $a['overall_score']);
        $scored = array_slice($scored, 0, $limit);

        return [
            'seed' => $this->buildSeedSummary($seed),
            'mode' => 'interpretable',
            'similar_patients' => $scored,
            'metadata' => [
                'total_candidates' => $totalCandidates,
                'above_threshold' => count($scored),
                'returned_count' => count($scored),
                'weights' => $weights,
                'filters_applied' => $filters,
                'limit' => $limit,
                'min_score' => $minScore,
                'temporal_window_days' => self::RECENT_WINDOW_DAYS,
                'feature_vector_version' => $seed->version,
                'seed_anchor_date' => $seed->anchor_date?->toDateString(),
                'computed_at' => now()->toIso8601String(),
            ],
        ];
    }

    /**
     * SQL-side pre-scored interpretable search for large sources.
     *
     * Computes a rough similarity score in PostgreSQL using:
     * - Demographics: age bucket proximity + gender match
     * - Conditions: JSONB array overlap (Jaccard approximation)
     * - Drugs: JSONB array overlap (Jaccard approximation)
     *
     * Returns the top N*multiplier candidates, then re-scores them in PHP
     * with all dimension scorers for full accuracy.
     *
     * @param  array<string, float>  $weights
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function searchInterpretableSql(
        PatientFeatureVector $seed,
        Source $source,
        array $weights,
        int $limit,
        float $minScore,
        array $filters,
        int $totalCandidates,
    ): array {
        $seedData = $seed->toArray();
        $candidateLimit = min($limit * self::SQL_CANDIDATE_MULTIPLIER, 500);

        $candidateQuery = PatientFeatureVector::query()
            ->forSource($source->id)
            ->where('person_id', '!=', $seed->person_id);

        $this->applyFilters($candidateQuery, $filters);

        if (($weights['demographics'] ?? 0.0) > 0.0 && $seed->age_bucket !== null) {
            $candidateQuery->orderByRaw('ABS(age_bucket - ?)', [$seed->age_bucket]);
        }

        if (($weights['demographics'] ?? 0.0) > 0.0 && $seed->gender_concept_id !== null) {
            $candidateQuery->orderByRaw(
                'CASE WHEN gender_concept_id = ? THEN 0 ELSE 1 END',
                [$seed->gender_concept_id]
            );
        }

        if (($weights['demographics'] ?? 0.0) > 0.0 && $seed->race_concept_id !== null) {
            $candidateQuery->orderByRaw(
                'CASE WHEN race_concept_id = ? THEN 0 ELSE 1 END',
                [$seed->race_concept_id]
            );
        }

        $candidates = $candidateQuery
            ->orderBy('person_id')
            ->limit($candidateLimit)
            ->get();

        // Full scoring with all dimension scorers
        $scored = [];
        foreach ($candidates as $candidate) {
            $result = $this->scorePatientPair($seedData, $candidate->toArray(), $weights);

            if ($result['overall_score'] >= $minScore) {
                $scored[] = $this->buildScoredPatient($candidate, $result);
            }
        }

        usort($scored, static fn (array $a, array $b): int => $b['overall_score'] <=> $a['overall_score']);
        $scored = array_slice($scored, 0, $limit);

        return [
            'seed' => $this->buildSeedSummary($seed),
            'mode' => 'interpretable',
            'similar_patients' => $scored,
            'metadata' => [
                'total_candidates' => $totalCandidates,
                'sql_prescored' => true,
                'candidates_loaded' => $candidates->count(),
                'above_threshold' => count($scored),
                'returned_count' => count($scored),
                'weights' => $weights,
                'filters_applied' => $filters,
                'limit' => $limit,
                'min_score' => $minScore,
                'temporal_window_days' => self::RECENT_WINDOW_DAYS,
                'feature_vector_version' => $seed->version,
                'seed_anchor_date' => $seed->anchor_date?->toDateString(),
                'computed_at' => now()->toIso8601String(),
            ],
        ];
    }

    /**
     * Apply user-supplied filters to a feature vector query.
     *
     * @param  Builder<PatientFeatureVector>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        $filters = $this->normalizeFilters($filters);

        if (! empty($filters['gender_concept_id'])) {
            $query->where('gender_concept_id', (int) $filters['gender_concept_id']);
        }

        if (! empty($filters['age_range'])) {
            $range = $filters['age_range'];
            $minAge = (int) ($range[0] ?? 0);
            $maxAge = (int) ($range[1] ?? 120);
            $minBucket = intdiv($minAge, 5);
            $maxBucket = intdiv($maxAge, 5);
            $query->whereBetween('age_bucket', [$minBucket, $maxBucket]);
        }
    }

    /**
     * Embedding-based ANN search using pgvector cosine distance.
     *
     * Retrieves candidate patients via ANN (approximate nearest neighbor) search
     * on pre-computed embeddings, then re-scores them with interpretable dimension
     * scorers for explainability. Falls back to interpretable search if the seed
     * patient has no embedding.
     *
     * @param  array<string, float>  $weights
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function searchEmbedding(
        PatientFeatureVector $seed,
        Source $source,
        array $weights,
        int $limit,
        float $minScore,
        array $filters = [],
    ): array {
        $seedData = $seed->toArray();
        $filters = $this->normalizeFilters($filters);
        $embeddingStr = $seed->getRawOriginal('embedding');

        if (! $embeddingStr) {
            return $this->searchInterpretable($seed, $source, $weights, $limit, $minScore, $filters);
        }

        $candidateLimit = min(200, max($limit * 4, 100));

        $query = 'SELECT person_id, 1 - (embedding OPERATOR(public.<=>) ?::public.vector) AS cosine_similarity
                  FROM patient_feature_vectors
                  WHERE source_id = ? AND person_id != ? AND embedding IS NOT NULL';
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

        $query .= ' ORDER BY embedding OPERATOR(public.<=>) ?::public.vector LIMIT ?';
        $params[] = $embeddingStr;
        $params[] = $candidateLimit;

        $candidateRows = DB::select($query, $params);
        $candidateIds = array_map(fn ($r) => (int) $r->person_id, $candidateRows);

        $candidates = PatientFeatureVector::where('source_id', $source->id)
            ->whereIn('person_id', $candidateIds)
            ->get()
            ->keyBy('person_id');

        $scored = [];
        foreach ($candidates as $candidate) {
            $result = $this->scorePatientPair($seedData, $candidate->toArray(), $weights);
            if ($result['overall_score'] >= $minScore) {
                $scored[] = $this->buildScoredPatient($candidate, $result);
            }
        }

        usort($scored, static fn (array $a, array $b): int => $b['overall_score'] <=> $a['overall_score']);
        $scored = array_slice($scored, 0, $limit);

        return [
            'seed' => $this->buildSeedSummary($seed),
            'mode' => 'embedding',
            'similar_patients' => $scored,
            'metadata' => [
                'candidates_evaluated' => count($candidateRows),
                'returned_count' => count($scored),
                'dimensions_used' => array_keys($weights),
                'filters_applied' => $filters,
                'limit' => $limit,
                'min_score' => $minScore,
                'weights' => $weights,
                'temporal_window_days' => self::RECENT_WINDOW_DAYS,
                'feature_vector_version' => $seed->version,
                'seed_anchor_date' => $seed->anchor_date?->toDateString(),
                'computed_at' => now()->toIso8601String(),
            ],
        ];
    }

    /**
     * Search from a centroid (virtual patient) — used for cohort-seeded search.
     *
     * Works like searchInterpretable but takes a centroid array instead of a model,
     * and excludes a list of person_ids (the cohort members) from results.
     *
     * @param  array<string, mixed>  $centroidData  Virtual patient feature array (person_id = 0)
     * @param  array<int>  $excludePersonIds  Person IDs to exclude (cohort members)
     * @param  array<string, float>  $weights
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function searchFromCentroid(
        array $centroidData,
        Source $source,
        array $excludePersonIds,
        array $weights,
        int $limit,
        float $minScore,
        array $filters = [],
    ): array {
        $filters = $this->normalizeFilters($filters);
        $query = PatientFeatureVector::query()
            ->forSource($source->id);

        // Exclude cohort members
        if (! empty($excludePersonIds)) {
            $query->whereNotIn('person_id', $excludePersonIds);
        }

        $this->applyFilters($query, $filters);

        $totalCandidates = (clone $query)->count();

        // For large sources, limit to demographically similar candidates
        if ($totalCandidates > self::IN_MEMORY_THRESHOLD) {
            $centroidGender = $centroidData['gender_concept_id'] ?? null;
            $centroidAgeBucket = $centroidData['age_bucket'] ?? null;

            if ($centroidGender !== null) {
                $query->where('gender_concept_id', $centroidGender);
            }
            if ($centroidAgeBucket !== null) {
                $query->whereBetween('age_bucket', [
                    max(0, $centroidAgeBucket - 2),
                    $centroidAgeBucket + 2,
                ]);
            }
            $query
                ->orderByRaw('ABS(age_bucket - ?)', [$centroidAgeBucket ?? 0])
                ->orderByRaw(
                    'CASE WHEN gender_concept_id = ? THEN 0 ELSE 1 END',
                    [$centroidGender ?? 0]
                )
                ->orderBy('person_id')
                ->limit(min($limit * self::SQL_CANDIDATE_MULTIPLIER, 500));
        } else {
            $query->orderBy('person_id');
        }

        $candidates = $query->get();

        // Score each candidate against the centroid
        $scored = [];
        foreach ($candidates as $candidate) {
            $result = $this->scorePatientPair($centroidData, $candidate->toArray(), $weights);

            if ($result['overall_score'] >= $minScore) {
                $scored[] = $this->buildScoredPatient($candidate, $result);
            }
        }

        usort($scored, static fn (array $a, array $b): int => $b['overall_score'] <=> $a['overall_score']);
        $scored = array_slice($scored, 0, $limit);

        return [
            'seed' => [
                'person_id' => 0,
                'type' => 'centroid',
                'member_count' => count($excludePersonIds),
                'dimensions_available' => $centroidData['dimensions_available'] ?? [],
                'feature_vector_version' => $centroidData['version'] ?? null,
            ],
            'mode' => 'interpretable',
            'similar_patients' => $scored,
            'metadata' => [
                'total_candidates' => $totalCandidates,
                'above_threshold' => count($scored),
                'returned_count' => count($scored),
                'weights' => $weights,
                'filters_applied' => $filters,
                'limit' => $limit,
                'min_score' => $minScore,
                'excluded_members' => count($excludePersonIds),
                'temporal_window_days' => self::RECENT_WINDOW_DAYS,
                'feature_vector_version' => $centroidData['version'] ?? null,
                'computed_at' => now()->toIso8601String(),
            ],
        ];
    }

    /**
     * @param  array{overall_score: float, dimension_scores: array<string, float|null>}  $result
     * @return array<string, mixed>
     */
    private function buildScoredPatient(PatientFeatureVector $candidate, array $result): array
    {
        return [
            'person_id' => $candidate->person_id,
            'overall_score' => $result['overall_score'],
            'dimension_scores' => $result['dimension_scores'],
            'age_bucket' => $candidate->age_bucket,
            'gender_concept_id' => $candidate->gender_concept_id,
            'anchor_date' => $candidate->anchor_date?->toDateString(),
            'condition_count' => $candidate->condition_count,
            'lab_count' => $candidate->lab_count,
            'dimensions_available' => $candidate->dimensions_available,
            'feature_vector_version' => $candidate->version,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildSeedSummary(PatientFeatureVector $seed): array
    {
        return [
            'person_id' => $seed->person_id,
            'age_bucket' => $seed->age_bucket,
            'gender_concept_id' => $seed->gender_concept_id,
            'anchor_date' => $seed->anchor_date?->toDateString(),
            'condition_count' => $seed->condition_count,
            'lab_count' => $seed->lab_count,
            'dimensions_available' => $seed->dimensions_available,
            'feature_vector_version' => $seed->version,
        ];
    }

    /**
     * Score similarity between two patients across all weighted dimensions.
     *
     * @param  array<string, mixed>  $seedData  Seed patient feature vector data
     * @param  array<string, mixed>  $candidateData  Candidate patient feature vector data
     * @param  array<string, float>  $weights  Dimension weights (key => 0.0–1.0)
     * @return array{overall_score: float, dimension_scores: array<string, float|null>}
     */
    public function scorePatientPair(array $seedData, array $candidateData, array $weights): array
    {
        $weightedSum = 0.0;
        $weightDenominator = 0.0;
        /** @var array<string, float|null> $dimensionScores */
        $dimensionScores = [];

        foreach ($this->scorers as $key => $scorer) {
            $weight = $weights[$key] ?? 0.0;

            // Skip dimensions with zero weight
            if ($weight <= 0.0) {
                $dimensionScores[$key] = null;

                continue;
            }

            $score = $scorer->score($seedData, $candidateData);

            // -1 means dimension not available for this patient pair
            if ($score < 0.0) {
                $dimensionScores[$key] = null;

                continue;
            }

            $dimensionScores[$key] = round($score, 4);
            $weightedSum += $weight * $score;
            $weightDenominator += $weight;
        }

        $overallScore = $weightDenominator > 0.0
            ? round($weightedSum / $weightDenominator, 4)
            : 0.0;

        return [
            'overall_score' => $overallScore,
            'dimension_scores' => $dimensionScores,
        ];
    }

    /**
     * Compare two feature profiles and return per-dimension divergence.
     *
     * Divergence is defined as 1 - similarity for dimensions with available data.
     * Dimensions that are unavailable for both profiles are marked as "No data"
     * and excluded from the overall divergence average.
     *
     * @param  array<string, mixed>  $sourceData
     * @param  array<string, mixed>  $targetData
     * @return array{
     *     overall_similarity: float,
     *     overall_divergence: float,
     *     similarity: array<string, float|null>,
     *     divergence: array<string, array{score: float, label: string}>
     * }
     */
    public function compareProfiles(array $sourceData, array $targetData): array
    {
        $weights = [];
        foreach (array_keys($this->scorers) as $dimensionKey) {
            $weights[$dimensionKey] = 1.0;
        }

        $comparison = $this->scorePatientPair($sourceData, $targetData, $weights);
        $dimensionSimilarities = $comparison['dimension_scores'];

        $divergence = [];
        $divergenceScores = [];

        foreach ($dimensionSimilarities as $dimensionKey => $similarityScore) {
            if ($similarityScore === null) {
                $divergence[$dimensionKey] = [
                    'score' => 0.0,
                    'label' => 'No data',
                ];

                continue;
            }

            $score = round(1.0 - $similarityScore, 4);
            $divergence[$dimensionKey] = [
                'score' => $score,
                'label' => $score < 0.3 ? 'Similar' : ($score < 0.6 ? 'Moderate' : 'Divergent'),
            ];
            $divergenceScores[] = $score;
        }

        $overallDivergence = count($divergenceScores) > 0
            ? round(array_sum($divergenceScores) / count($divergenceScores), 4)
            : 0.0;

        return [
            'overall_similarity' => $comparison['overall_score'],
            'overall_divergence' => $overallDivergence,
            'similarity' => $dimensionSimilarities,
            'divergence' => $divergence,
        ];
    }

    /**
     * Get feature vector computation status for a source.
     *
     * @return array<string, mixed>
     */
    public function getStatus(Source $source): array
    {
        $count = PatientFeatureVector::query()
            ->forSource($source->id)
            ->count();

        $embeddingCount = PatientFeatureVector::query()
            ->forSource($source->id)
            ->whereNotNull('embedding')
            ->count();

        $latest = PatientFeatureVector::query()
            ->forSource($source->id)
            ->max('computed_at');

        $latestAt = $latest !== null ? Carbon::parse($latest) : null;
        $stalenessWarning = $latestAt !== null && $latestAt->diffInDays(now()) > self::STALENESS_THRESHOLD_DAYS;

        $embeddingsReady = $embeddingCount > 0 && $embeddingCount === $count;
        $recommendedMode = ($embeddingsReady && $count > self::IN_MEMORY_THRESHOLD) ? 'embedding' : 'interpretable';

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'total_vectors' => $count,
            'total_embeddings' => $embeddingCount,
            'embeddings_ready' => $embeddingsReady,
            'recommended_mode' => $recommendedMode,
            'latest_computed_at' => $latestAt?->toIso8601String(),
            'staleness_warning' => $stalenessWarning,
            'staleness_threshold_days' => self::STALENESS_THRESHOLD_DAYS,
        ];
    }

    /**
     * Normalize supported filter shapes to a canonical format.
     *
     * Canonical shape:
     * - age_range: [minAge, maxAge]
     * - gender_concept_id: OMOP concept id
     *
     * Backward compatibility:
     * - age_min / age_max
     * - age_range as {min, max}
     * - gender as MALE/FEMALE
     *
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function normalizeFilters(array $filters): array
    {
        $normalized = [];

        $genderConceptId = $filters['gender_concept_id'] ?? null;
        if ($genderConceptId === null && isset($filters['gender']) && is_string($filters['gender'])) {
            $genderConceptId = self::GENDER_CONCEPT_MAP[strtoupper($filters['gender'])] ?? null;
        }
        if (is_numeric($genderConceptId)) {
            $normalized['gender_concept_id'] = (int) $genderConceptId;
        }

        $ageRange = $filters['age_range'] ?? null;
        $minAge = null;
        $maxAge = null;

        if (is_array($ageRange)) {
            if (array_is_list($ageRange)) {
                $minAge = $ageRange[0] ?? null;
                $maxAge = $ageRange[1] ?? null;
            } else {
                $minAge = $ageRange['min'] ?? null;
                $maxAge = $ageRange['max'] ?? null;
            }
        }

        if ($minAge === null && isset($filters['age_min'])) {
            $minAge = $filters['age_min'];
        }
        if ($maxAge === null && isset($filters['age_max'])) {
            $maxAge = $filters['age_max'];
        }

        if ($minAge !== null || $maxAge !== null) {
            $normalizedMin = max(0, (int) ($minAge ?? 0));
            $normalizedMax = min(150, (int) ($maxAge ?? 150));
            $normalized['age_range'] = [
                min($normalizedMin, $normalizedMax),
                max($normalizedMin, $normalizedMax),
            ];
        }

        return $normalized;
    }
}
