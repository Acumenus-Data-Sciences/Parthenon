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
use Illuminate\Support\Carbon;

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
     * Interpretable multi-dimension weighted search.
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

        // Load candidates (exclude seed patient)
        $query = PatientFeatureVector::query()
            ->forSource($source->id)
            ->where('person_id', '!=', $seed->person_id);

        // Apply pre-filters to reduce candidate set
        if (! empty($filters['gender_concept_id'])) {
            $query->where('gender_concept_id', (int) $filters['gender_concept_id']);
        }

        if (! empty($filters['age_range'])) {
            $range = $filters['age_range'];
            $minAge = (int) ($range['min'] ?? 0);
            $maxAge = (int) ($range['max'] ?? 120);
            // Convert ages to bucket indices (5-year buckets: 0=0-4, 1=5-9, ...)
            $minBucket = intdiv($minAge, 5);
            $maxBucket = intdiv($maxAge, 5);
            $query->whereBetween('age_bucket', [$minBucket, $maxBucket]);
        }

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
     * Embedding-based ANN search (Phase 2 stub — falls back to interpretable).
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
        // Phase 2: implement ANN search via Python embedding service
        // For now, fall back to interpretable search
        $results = $this->searchInterpretable($seed, $source, $weights, $limit, $minScore, $filters);
        $results['mode'] = 'embedding_fallback';

        return $results;
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
