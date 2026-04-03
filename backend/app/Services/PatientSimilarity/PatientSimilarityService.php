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
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final class PatientSimilarityService
{
    private const int CACHE_TTL_MINUTES = 60;

    private const int STALENESS_THRESHOLD_DAYS = 7;

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
        $weightsHash = PatientSimilarityCache::hashWeights($weights);

        // Check cache first
        $cached = PatientSimilarityCache::query()
            ->where('source_id', $source->id)
            ->where('seed_person_id', $personId)
            ->where('mode', $mode)
            ->where('weights_hash', $weightsHash)
            ->valid()
            ->first();

        if ($cached !== null) {
            return $cached->results;
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
                    'computed_at' => now()->toIso8601String(),
                ],
            ];
        }

        // Route to search strategy
        $results = match ($mode) {
            'embedding' => $this->searchEmbedding($seed, $source, $weights, $limit, $minScore, $filters),
            default => $this->searchInterpretable($seed, $source, $weights, $limit, $minScore, $filters),
        };

        // Cache results
        PatientSimilarityCache::query()->updateOrCreate(
            [
                'source_id' => $source->id,
                'seed_person_id' => $personId,
                'mode' => $mode,
                'weights_hash' => $weightsHash,
            ],
            [
                'results' => $results,
                'computed_at' => now(),
                'expires_at' => now()->addMinutes(self::CACHE_TTL_MINUTES),
            ],
        );

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

        // Check source size to decide strategy
        $totalCandidates = PatientFeatureVector::query()
            ->forSource($source->id)
            ->where('person_id', '!=', $seed->person_id)
            ->count();

        if ($totalCandidates > self::IN_MEMORY_THRESHOLD) {
            return $this->searchInterpretableSql($seed, $source, $weights, $limit, $minScore, $filters, $totalCandidates);
        }

        // Small source: load all candidates into PHP
        $query = PatientFeatureVector::query()
            ->forSource($source->id)
            ->where('person_id', '!=', $seed->person_id);

        $this->applyFilters($query, $filters);

        $candidates = $query->get();
        $totalCandidates = $candidates->count();

        // Score each candidate
        $scored = [];
        foreach ($candidates as $candidate) {
            $result = $this->scorePatientPair($seedData, $candidate->toArray(), $weights);

            if ($result['overall_score'] >= $minScore) {
                $scored[] = [
                    'person_id' => $candidate->person_id,
                    'overall_score' => $result['overall_score'],
                    'dimension_scores' => $result['dimension_scores'],
                    'age_bucket' => $candidate->age_bucket,
                    'gender_concept_id' => $candidate->gender_concept_id,
                ];
            }
        }

        // Sort by overall_score descending, take top $limit
        usort($scored, static fn (array $a, array $b): int => $b['overall_score'] <=> $a['overall_score']);
        $scored = array_slice($scored, 0, $limit);

        return [
            'seed' => [
                'person_id' => $seed->person_id,
                'age_bucket' => $seed->age_bucket,
                'gender_concept_id' => $seed->gender_concept_id,
                'dimensions_available' => $seed->dimensions_available,
            ],
            'mode' => 'interpretable',
            'similar_patients' => $scored,
            'metadata' => [
                'total_candidates' => $totalCandidates,
                'above_threshold' => count($scored),
                'weights' => $weights,
                'min_score' => $minScore,
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

        // Demographics-first SQL pre-filter: narrow 932K rows to a manageable
        // set using indexed columns (gender, age_bucket), then score in PHP.
        // JSONB Jaccard in SQL is too expensive as a correlated subquery at this scale.
        $sql = <<<'SQL'
            SELECT *
            FROM patient_feature_vectors
            WHERE source_id = ?
              AND person_id != ?
              AND gender_concept_id = ?
              AND age_bucket BETWEEN ? AND ?
            ORDER BY
                CASE WHEN race_concept_id = ? THEN 0 ELSE 1 END,
                ABS(age_bucket - ?)
            LIMIT ?
            SQL;

        $ageBucketRange = 3; // +/- 15 years
        $params = [
            $source->id,
            $seed->person_id,
            $seed->gender_concept_id,
            max(0, $seed->age_bucket - $ageBucketRange),
            $seed->age_bucket + $ageBucketRange,
            $seed->race_concept_id ?? 0,
            $seed->age_bucket,
            $candidateLimit,
        ];

        $rows = DB::select($sql, $params);

        // Hydrate only the top candidates for full scoring.
        // Strip SQL-computed score columns before hydrating to avoid cast conflicts.
        $candidates = collect($rows)->map(function (object $row): PatientFeatureVector {
            $attrs = (array) $row;
            unset($attrs['demo_score'], $attrs['cond_score'], $attrs['drug_score']);

            $model = new PatientFeatureVector;
            $model->setRawAttributes($attrs, true);

            return $model;
        });

        // Full scoring with all dimension scorers
        $scored = [];
        foreach ($candidates as $candidate) {
            $result = $this->scorePatientPair($seedData, $candidate->toArray(), $weights);

            if ($result['overall_score'] >= $minScore) {
                $scored[] = [
                    'person_id' => $candidate->person_id,
                    'overall_score' => $result['overall_score'],
                    'dimension_scores' => $result['dimension_scores'],
                    'age_bucket' => $candidate->age_bucket,
                    'gender_concept_id' => $candidate->gender_concept_id,
                ];
            }
        }

        usort($scored, static fn (array $a, array $b): int => $b['overall_score'] <=> $a['overall_score']);
        $scored = array_slice($scored, 0, $limit);

        return [
            'seed' => [
                'person_id' => $seed->person_id,
                'age_bucket' => $seed->age_bucket,
                'gender_concept_id' => $seed->gender_concept_id,
                'dimensions_available' => $seed->dimensions_available,
            ],
            'mode' => 'interpretable',
            'similar_patients' => $scored,
            'metadata' => [
                'total_candidates' => $totalCandidates,
                'sql_prescored' => true,
                'candidates_loaded' => count($rows),
                'above_threshold' => count($scored),
                'weights' => $weights,
                'min_score' => $minScore,
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
        if (! empty($filters['gender_concept_id'])) {
            $query->where('gender_concept_id', (int) $filters['gender_concept_id']);
        }

        if (! empty($filters['age_range'])) {
            $range = $filters['age_range'];
            $minAge = (int) ($range['min'] ?? 0);
            $maxAge = (int) ($range['max'] ?? 120);
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
        $embeddingStr = $seed->getRawOriginal('embedding');

        if (! $embeddingStr) {
            return $this->searchInterpretable($seed, $source, $weights, $limit, $minScore, $filters);
        }

        $candidateLimit = min(200, max($limit * 4, 100));

        $query = 'SELECT person_id, 1 - (embedding <=> ?::public.vector) AS cosine_similarity
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

        $query .= ' ORDER BY embedding <=> ?::public.vector LIMIT ?';
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
                $scored[] = array_merge($result, ['person_id' => $candidate->person_id]);
            }
        }

        usort($scored, static fn (array $a, array $b): int => $b['overall_score'] <=> $a['overall_score']);
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
            $query->limit(min($limit * self::SQL_CANDIDATE_MULTIPLIER, 500));
        }

        $candidates = $query->get();

        // Score each candidate against the centroid
        $scored = [];
        foreach ($candidates as $candidate) {
            $result = $this->scorePatientPair($centroidData, $candidate->toArray(), $weights);

            if ($result['overall_score'] >= $minScore) {
                $scored[] = [
                    'person_id' => $candidate->person_id,
                    'overall_score' => $result['overall_score'],
                    'dimension_scores' => $result['dimension_scores'],
                    'age_bucket' => $candidate->age_bucket,
                    'gender_concept_id' => $candidate->gender_concept_id,
                ];
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
            ],
            'mode' => 'interpretable',
            'similar_patients' => $scored,
            'metadata' => [
                'total_candidates' => $totalCandidates,
                'above_threshold' => count($scored),
                'weights' => $weights,
                'min_score' => $minScore,
                'excluded_members' => count($excludePersonIds),
                'computed_at' => now()->toIso8601String(),
            ],
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
     * Get feature vector computation status for a source.
     *
     * @return array<string, mixed>
     */
    public function getStatus(Source $source): array
    {
        $count = PatientFeatureVector::query()
            ->forSource($source->id)
            ->count();

        $latest = PatientFeatureVector::query()
            ->forSource($source->id)
            ->max('computed_at');

        $latestAt = $latest !== null ? Carbon::parse($latest) : null;
        $stalenessWarning = $latestAt !== null && $latestAt->diffInDays(now()) > self::STALENESS_THRESHOLD_DAYS;

        return [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'total_vectors' => $count,
            'latest_computed_at' => $latestAt?->toIso8601String(),
            'staleness_warning' => $stalenessWarning,
            'staleness_threshold_days' => self::STALENESS_THRESHOLD_DAYS,
        ];
    }
}
