<?php

namespace App\Services\PopulationRisk;

use App\Contracts\PopulationRiskScoreV2Interface;
use App\Enums\DaimonType;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;

class RiskScoreRecommendationService
{
    /** @var array<string, PopulationRiskScoreV2Interface> */
    private array $scores = [];

    public function __construct(
        private readonly ConceptResolutionService $conceptResolver,
    ) {}

    public function registerV2Score(PopulationRiskScoreV2Interface $score): void
    {
        $this->scores[$score->scoreId()] = $score;
    }

    /**
     * Recommend applicable risk scores for a cohort.
     *
     * @return list<array{
     *     score_id: string,
     *     score_name: string,
     *     category: string,
     *     description: string,
     *     applicable: bool,
     *     reason: string,
     *     expected_completeness: float,
     * }>
     */
    public function recommend(int $cohortDefinitionId, Source $source): array
    {
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);
        $connection = $source->source_connection;

        // Profile the cohort
        $profile = $this->profileCohort($connection, $cdmSchema, $vocabSchema, $resultsSchema, $cohortDefinitionId);

        $recommendations = [];

        foreach ($this->scores as $score) {
            $criteria = $score->eligibilityCriteria();
            $applicable = true;
            $reason = 'Applicable to this cohort';
            $expectedCompleteness = 1.0;

            // Check population type
            switch ($criteria['population_type']) {
                case 'universal':
                    // Always applicable
                    break;

                case 'condition_specific':
                    $requiredAncestors = $criteria['required_condition_ancestors'] ?? [];
                    if (! empty($requiredAncestors)) {
                        $hasRelevantCondition = false;
                        foreach ($requiredAncestors as $ancestorId) {
                            $descendants = $this->conceptResolver->resolveDescendants($ancestorId, $connection, $vocabSchema);
                            $overlap = array_intersect($descendants, $profile['top_condition_ids']);
                            if (! empty($overlap)) {
                                $hasRelevantCondition = true;
                                break;
                            }
                        }
                        if (! $hasRelevantCondition) {
                            $applicable = false;
                            $reason = 'Required conditions not prevalent in this cohort';
                        }
                    }
                    break;

                case 'age_restricted':
                    $minAge = $criteria['min_age'] ?? 0;
                    $maxAge = $criteria['max_age'] ?? 999;
                    if ($profile['max_age'] < $minAge || $profile['min_age'] > $maxAge) {
                        $applicable = false;
                        $reason = "Age range [{$profile['min_age']}-{$profile['max_age']}] outside required [{$minAge}-{$maxAge}]";
                    }
                    break;
            }

            // Check measurement completeness
            $measurementReqs = $score->measurementRequirements();
            if (! empty($measurementReqs) && $applicable) {
                $availableCount = 0;
                foreach ($measurementReqs as $req) {
                    if (in_array($req['concept_id'], $profile['measurement_concept_ids'], true)) {
                        $availableCount++;
                    }
                }
                $expectedCompleteness = count($measurementReqs) > 0
                    ? round($availableCount / count($measurementReqs), 2)
                    : 1.0;

                if ($expectedCompleteness < 0.5) {
                    $reason = "Low measurement coverage ({$availableCount}/".count($measurementReqs).' required measurements available)';
                }
            }

            $recommendations[] = [
                'score_id' => $score->scoreId(),
                'score_name' => $score->scoreName(),
                'category' => $score->category(),
                'description' => $score->description(),
                'applicable' => $applicable,
                'reason' => $reason,
                'expected_completeness' => $expectedCompleteness,
            ];
        }

        // Sort: applicable first, then by expected_completeness descending
        usort($recommendations, function (array $a, array $b): int {
            if ($a['applicable'] !== $b['applicable']) {
                return $b['applicable'] <=> $a['applicable'];
            }

            return $b['expected_completeness'] <=> $a['expected_completeness'];
        });

        return $recommendations;
    }

    /**
     * Profile a cohort for recommendation evaluation.
     *
     * @return array{
     *     patient_count: int,
     *     min_age: int,
     *     max_age: int,
     *     female_pct: float,
     *     top_condition_ids: int[],
     *     measurement_concept_ids: int[],
     * }
     */
    private function profileCohort(
        string $connection,
        string $cdmSchema,
        string $vocabSchema,
        string $resultsSchema,
        int $cohortDefinitionId,
    ): array {
        // Demographics
        $demo = DB::connection($connection)->selectOne(
            "SELECT COUNT(DISTINCT p.person_id) AS patient_count,
                    MIN(EXTRACT(YEAR FROM CURRENT_DATE)::int - p.year_of_birth) AS min_age,
                    MAX(EXTRACT(YEAR FROM CURRENT_DATE)::int - p.year_of_birth) AS max_age,
                    ROUND(
                        SUM(CASE WHEN p.gender_concept_id = 8532 THEN 1 ELSE 0 END)::numeric
                        / NULLIF(COUNT(DISTINCT p.person_id), 0), 2
                    ) AS female_pct
             FROM {$cdmSchema}.person p
             JOIN {$resultsSchema}.cohort c ON c.subject_id = p.person_id
             WHERE c.cohort_definition_id = ?",
            [$cohortDefinitionId]
        );

        // Top 20 conditions by prevalence
        $topConditions = DB::connection($connection)->select(
            "SELECT co.condition_concept_id, COUNT(DISTINCT co.person_id) AS cnt
             FROM {$cdmSchema}.condition_occurrence co
             JOIN {$resultsSchema}.cohort c ON c.subject_id = co.person_id
             WHERE c.cohort_definition_id = ?
             GROUP BY co.condition_concept_id
             ORDER BY cnt DESC
             LIMIT 20",
            [$cohortDefinitionId]
        );

        // Measurement coverage: distinct measurement concept IDs present
        $measurements = DB::connection($connection)->select(
            "SELECT DISTINCT m.measurement_concept_id
             FROM {$cdmSchema}.measurement m
             JOIN {$resultsSchema}.cohort c ON c.subject_id = m.person_id
             WHERE c.cohort_definition_id = ?
               AND m.value_as_number IS NOT NULL",
            [$cohortDefinitionId]
        );

        return [
            'patient_count' => (int) ($demo->patient_count ?? 0),
            'min_age' => (int) ($demo->min_age ?? 0),
            'max_age' => (int) ($demo->max_age ?? 0),
            'female_pct' => (float) ($demo->female_pct ?? 0),
            'top_condition_ids' => array_map(fn (object $r): int => (int) $r->condition_concept_id, $topConditions),
            'measurement_concept_ids' => array_map(fn (object $r): int => (int) $r->measurement_concept_id, $measurements),
        ];
    }
}
