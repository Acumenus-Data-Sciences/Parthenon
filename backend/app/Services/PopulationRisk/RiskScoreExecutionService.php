<?php

namespace App\Services\PopulationRisk;

use App\Contracts\PopulationRiskScoreV2Interface;
use App\Enums\DaimonType;
use App\Enums\ExecutionStatus;
use App\Models\App\AnalysisExecution;
use App\Models\App\RiskScoreAnalysis;
use App\Models\App\RiskScoreRunStep;
use App\Models\App\Source;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class RiskScoreExecutionService
{
    /** @var array<string, PopulationRiskScoreV2Interface> */
    private array $scores = [];

    public function __construct(
        private readonly PatientFeatureExtractor $featureExtractor,
        private readonly ConceptResolutionService $conceptResolver,
    ) {}

    public function registerV2Score(PopulationRiskScoreV2Interface $score): void
    {
        $this->scores[$score->scoreId()] = $score;
    }

    /**
     * Get all registered scores filtered by category.
     *
     * @return array<int, array{score_id: string, score_name: string, category: string}>
     */
    public function getScoresByCategory(string $category): array
    {
        return collect($this->scores)
            ->filter(fn (PopulationRiskScoreV2Interface $score): bool => $score->category() === $category)
            ->map(fn (PopulationRiskScoreV2Interface $score): array => [
                'score_id' => $score->scoreId(),
                'score_name' => $score->scoreName(),
                'category' => $score->category(),
            ])
            ->values()
            ->toArray();
    }

    /**
     * Execute risk score analysis: extract features, compute scores, store results.
     */
    public function execute(RiskScoreAnalysis $analysis, Source $source, AnalysisExecution $execution): void
    {
        $design = $analysis->design_json;
        $targetCohortIds = $design['targetCohortIds'] ?? [];
        $scoreIds = $design['scoreIds'] ?? [];

        // Filter to only requested scores that are registered
        $requestedScores = array_filter(
            $this->scores,
            fn (PopulationRiskScoreV2Interface $s): bool => in_array($s->scoreId(), $scoreIds, true)
        );

        if (empty($requestedScores) || empty($targetCohortIds)) {
            $execution->update([
                'status' => ExecutionStatus::Failed,
                'fail_message' => 'No valid scores or cohorts specified',
                'completed_at' => now(),
            ]);

            return;
        }

        $execution->update([
            'status' => ExecutionStatus::Running,
            'started_at' => now(),
        ]);

        // Create run steps for each score
        $steps = [];
        foreach ($requestedScores as $score) {
            $steps[$score->scoreId()] = RiskScoreRunStep::create([
                'execution_id' => $execution->id,
                'score_id' => $score->scoreId(),
                'status' => ExecutionStatus::Pending,
            ]);
        }

        $allSucceeded = true;

        foreach ($targetCohortIds as $cohortId) {
            // Extract features for all scores at once (efficient: single pass per domain)
            try {
                $patients = $this->featureExtractor->extractForCohort(
                    $cohortId,
                    array_values($requestedScores),
                    $source
                );
            } catch (\Throwable $e) {
                Log::error("Risk score feature extraction failed for cohort {$cohortId}", [
                    'execution_id' => $execution->id,
                    'error' => $e->getMessage(),
                ]);

                // Mark all steps as failed
                foreach ($steps as $step) {
                    $step->update([
                        'status' => ExecutionStatus::Failed,
                        'error_message' => "Feature extraction failed: {$e->getMessage()}",
                        'completed_at' => now(),
                    ]);
                }

                $execution->update([
                    'status' => ExecutionStatus::Failed,
                    'fail_message' => "Feature extraction failed: {$e->getMessage()}",
                    'completed_at' => now(),
                ]);

                return;
            }

            // Build ancestor map: descendant_concept_id → list of ancestor_concept_ids
            $ancestorMap = $this->buildAncestorMap($requestedScores, $source);

            // For each score, compute and store results
            foreach ($requestedScores as $score) {
                $step = $steps[$score->scoreId()];
                $stepStart = Carbon::now();

                $step->update([
                    'status' => ExecutionStatus::Running,
                    'started_at' => $stepStart,
                ]);

                try {
                    $results = [];
                    $conditionGroups = $score->conditionGroups();
                    $groupAncestorIds = array_map(
                        fn (array $g): int => $g['ancestor_concept_id'],
                        $conditionGroups
                    );

                    foreach ($patients as $patient) {
                        // Map raw condition concept IDs to ancestor concept IDs
                        $matchedAncestors = [];
                        foreach ($patient['conditions'] as $conditionId) {
                            if (isset($ancestorMap[$conditionId])) {
                                foreach ($ancestorMap[$conditionId] as $ancestorId) {
                                    if (in_array($ancestorId, $groupAncestorIds, true)) {
                                        $matchedAncestors[] = $ancestorId;
                                    }
                                }
                            }
                        }

                        $patientData = [
                            'person_id' => $patient['person_id'],
                            'age' => $patient['age'],
                            'gender_concept_id' => $patient['gender_concept_id'],
                            'conditions' => array_values(array_unique($matchedAncestors)),
                            'measurements' => $patient['measurements'],
                        ];

                        $result = $score->compute($patientData);

                        $results[] = [
                            'execution_id' => $execution->id,
                            'source_id' => $source->id,
                            'cohort_definition_id' => $cohortId,
                            'person_id' => $patient['person_id'],
                            'score_id' => $score->scoreId(),
                            'score_value' => $result['score'],
                            'risk_tier' => $result['tier'],
                            'confidence' => $result['confidence'],
                            'completeness' => $result['completeness'],
                            'missing_components' => json_encode($result['missing']),
                            'created_at' => now(),
                        ];
                    }

                    // Bulk insert in chunks of 500
                    foreach (array_chunk($results, 500) as $chunk) {
                        DB::table('risk_score_patient_results')->insert($chunk);
                    }

                    $stepEnd = Carbon::now();
                    $step->update([
                        'status' => ExecutionStatus::Completed,
                        'completed_at' => $stepEnd,
                        'elapsed_ms' => (int) $stepStart->diffInMilliseconds($stepEnd),
                        'patient_count' => count($results),
                    ]);
                } catch (\Throwable $e) {
                    Log::error("Risk score {$score->scoreId()} execution failed", [
                        'execution_id' => $execution->id,
                        'cohort_id' => $cohortId,
                        'error' => $e->getMessage(),
                    ]);

                    $step->update([
                        'status' => ExecutionStatus::Failed,
                        'completed_at' => now(),
                        'error_message' => $e->getMessage(),
                    ]);

                    $allSucceeded = false;
                }
            }
        }

        $execution->update([
            'status' => $allSucceeded ? ExecutionStatus::Completed : ExecutionStatus::Failed,
            'completed_at' => now(),
            'fail_message' => $allSucceeded ? null : 'One or more scores failed — see run steps for details',
        ]);
    }

    /**
     * Build a reverse map: descendant_concept_id → list of ancestor_concept_ids.
     *
     * @param  PopulationRiskScoreV2Interface[]  $scores
     * @return array<int, int[]>
     */
    private function buildAncestorMap(array $scores, Source $source): array
    {
        $connection = $source->source_connection;
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary)
            ?? $source->getTableQualifier(DaimonType::CDM);

        $allAncestorIds = [];
        foreach ($scores as $score) {
            foreach ($score->conditionGroups() as $group) {
                $allAncestorIds[] = $group['ancestor_concept_id'];
            }
        }
        $allAncestorIds = array_values(array_unique($allAncestorIds));

        $ancestorMap = [];
        foreach ($allAncestorIds as $ancestorId) {
            $descendants = $this->conceptResolver->resolveDescendants($ancestorId, $connection, $vocabSchema);
            foreach ($descendants as $descendantId) {
                $ancestorMap[$descendantId][] = $ancestorId;
            }
        }

        return $ancestorMap;
    }
}
