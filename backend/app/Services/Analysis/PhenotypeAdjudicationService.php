<?php

namespace App\Services\Analysis;

use App\Enums\DaimonType;
use App\Models\App\CohortPhenotypeAdjudication;
use App\Models\App\CohortPhenotypeAdjudicationReview;
use App\Models\App\CohortPhenotypeValidation;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;

class PhenotypeAdjudicationService
{
    public function __construct(
        private readonly SqlRendererService $sqlRenderer,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function sample(
        CohortPhenotypeValidation $validation,
        int $memberCount,
        int $nonMemberCount,
        ?string $seed = null,
        string $strategy = 'random',
    ): array {
        $validation->loadMissing(['cohortDefinition', 'source.daimons']);
        $source = $validation->source;
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);

        if ($cdmSchema === null || $resultsSchema === null) {
            throw new \RuntimeException('Source is missing required CDM or Results schema configuration.');
        }

        $dialect = $source->source_dialect ?? 'postgresql';
        $connectionName = $source->source_connection ?? 'omop';
        $seed = $seed !== null && trim($seed) !== '' ? trim($seed) : bin2hex(random_bytes(8));
        $strategy = in_array($strategy, ['random', 'balanced_demographics'], true)
            ? $strategy
            : 'random';
        $memberCandidateLimit = $this->candidateLimit($memberCount, $strategy);
        $nonMemberCandidateLimit = $this->candidateLimit($nonMemberCount, $strategy);

        $params = [
            'cdmSchema' => $cdmSchema,
            'vocabSchema' => $vocabSchema,
            'resultsSchema' => $resultsSchema,
        ];

        $memberRows = $this->selectSampleRows(
            $connectionName,
            $dialect,
            $params,
            $this->memberSampleSql(
                $validation->cohort_definition_id,
                $memberCandidateLimit,
                $this->orderExpression($dialect, 'c.subject_id', $seed),
            ),
        );

        $nonMemberRows = $this->selectSampleRows(
            $connectionName,
            $dialect,
            $params,
            $this->nonMemberSampleSql(
                $validation->cohort_definition_id,
                $nonMemberCandidateLimit,
                $this->orderExpression($dialect, 'p.person_id', $seed),
            ),
        );
        $memberRows = $this->pickRows($memberRows, $memberCount, $strategy);
        $nonMemberRows = $this->pickRows($nonMemberRows, $nonMemberCount, $strategy);

        $created = 0;
        foreach ($memberRows as $row) {
            $created += $this->upsertAdjudication($validation, $row, 'cohort_member', $seed, $strategy) ? 1 : 0;
        }

        foreach ($nonMemberRows as $row) {
            $created += $this->upsertAdjudication($validation, $row, 'non_member', $seed, $strategy) ? 1 : 0;
        }

        return [
            'created' => $created,
            'cohort_member_count' => count($memberRows),
            'non_member_count' => count($nonMemberRows),
            'seed' => $seed,
            'strategy' => $strategy,
        ];
    }

    /**
     * @return array{true_positives: int, false_positives: int, true_negatives: int, false_negatives: int, reviewed: int, uncertain: int, unreviewed: int}
     */
    public function counts(CohortPhenotypeValidation $validation): array
    {
        $rows = CohortPhenotypeAdjudication::query()
            ->where('phenotype_validation_id', $validation->id)
            ->get(['sample_group', 'label']);

        $counts = [
            'true_positives' => 0,
            'false_positives' => 0,
            'true_negatives' => 0,
            'false_negatives' => 0,
            'reviewed' => 0,
            'uncertain' => 0,
            'unreviewed' => 0,
        ];

        foreach ($rows as $row) {
            $label = $row->label;
            $group = $row->sample_group;

            if ($label === null) {
                $counts['unreviewed']++;

                continue;
            }

            if ($label === 'uncertain') {
                $counts['uncertain']++;

                continue;
            }

            $counts['reviewed']++;
            if ($group === 'cohort_member' && $label === 'case') {
                $counts['true_positives']++;
            } elseif ($group === 'cohort_member' && $label === 'non_case') {
                $counts['false_positives']++;
            } elseif ($group === 'non_member' && $label === 'case') {
                $counts['false_negatives']++;
            } elseif ($group === 'non_member' && $label === 'non_case') {
                $counts['true_negatives']++;
            }
        }

        return $counts;
    }

    public function recordReview(
        CohortPhenotypeValidation $validation,
        CohortPhenotypeAdjudication $adjudication,
        ?int $reviewerId,
        ?string $label,
        ?string $notes,
    ): CohortPhenotypeAdjudication {
        CohortPhenotypeAdjudicationReview::query()->updateOrCreate(
            [
                'adjudication_id' => $adjudication->id,
                'reviewer_id' => $reviewerId,
            ],
            [
                'phenotype_validation_id' => $validation->id,
                'label' => $label,
                'notes' => $notes,
                'reviewed_at' => $label ? now() : null,
            ],
        );

        return $this->syncConsensusLabel($adjudication);
    }

    public function syncConsensusLabel(CohortPhenotypeAdjudication $adjudication): CohortPhenotypeAdjudication
    {
        $reviews = CohortPhenotypeAdjudicationReview::query()
            ->where('adjudication_id', $adjudication->id)
            ->whereNotNull('label')
            ->orderBy('updated_at')
            ->get();

        $definitive = $reviews->filter(fn ($review) => in_array($review->label, ['case', 'non_case'], true));
        $finalLabel = null;
        if ($definitive->isNotEmpty()) {
            $labels = $definitive->pluck('label')->unique()->values();
            $finalLabel = $labels->count() === 1 ? $labels->first() : null;
        } elseif ($reviews->where('label', 'uncertain')->isNotEmpty()) {
            $finalLabel = 'uncertain';
        }

        $latestReview = $reviews->last();
        $adjudication->update([
            'label' => $finalLabel,
            'notes' => $latestReview?->notes,
            'reviewer_id' => $finalLabel ? $latestReview?->reviewer_id : null,
            'reviewed_at' => $finalLabel ? $latestReview?->reviewed_at : null,
        ]);

        return $adjudication->fresh();
    }

    public function resolveFinalLabel(
        CohortPhenotypeAdjudication $adjudication,
        string $label,
        ?string $notes,
        ?int $reviewerId,
    ): CohortPhenotypeAdjudication {
        $adjudication->update([
            'label' => $label,
            'notes' => $notes,
            'reviewer_id' => $reviewerId,
            'reviewed_at' => now(),
        ]);

        return $adjudication->fresh();
    }

    /**
     * @return array<string, mixed>
     */
    public function agreementSummary(CohortPhenotypeValidation $validation): array
    {
        $reviews = CohortPhenotypeAdjudicationReview::query()
            ->where('phenotype_validation_id', $validation->id)
            ->with('reviewer:id,name,email')
            ->get();
        $adjudications = CohortPhenotypeAdjudication::query()
            ->where('phenotype_validation_id', $validation->id)
            ->get(['id', 'label']);
        $adjudicationCount = $adjudications->count();
        $finalLabels = $adjudications->keyBy('id');

        $byAdjudication = $reviews->groupBy('adjudication_id');
        $totalReviewed = 0;
        $doubleReviewed = 0;
        $consensus = 0;
        $conflicts = 0;
        $resolvedConflicts = 0;
        $unresolvedConflicts = 0;
        $uncertain = 0;
        $pairAgreements = 0;
        $pairComparisons = 0;
        $labelTotals = ['case' => 0, 'non_case' => 0];

        foreach ($byAdjudication as $rows) {
            $labels = $rows->pluck('label')->filter()->values();
            if ($labels->isEmpty()) {
                continue;
            }

            $totalReviewed++;
            $definitiveLabels = $labels
                ->filter(fn ($label) => in_array($label, ['case', 'non_case'], true))
                ->values();
            $uncertain += $labels->filter(fn ($label) => $label === 'uncertain')->count();
            if ($definitiveLabels->count() >= 2) {
                $doubleReviewed++;
                $uniqueLabels = $definitiveLabels->unique()->values();
                if ($uniqueLabels->count() === 1) {
                    $consensus++;
                } else {
                    $conflicts++;
                    $finalLabel = $finalLabels->get($rows->first()->adjudication_id)?->label;
                    if (in_array($finalLabel, ['case', 'non_case'], true)) {
                        $resolvedConflicts++;
                    } else {
                        $unresolvedConflicts++;
                    }
                }

                $labelsArray = $definitiveLabels->all();
                for ($i = 0; $i < count($labelsArray); $i++) {
                    for ($j = $i + 1; $j < count($labelsArray); $j++) {
                        $pairComparisons++;
                        if ($labelsArray[$i] === $labelsArray[$j]) {
                            $pairAgreements++;
                        }
                    }
                }
            }

            foreach ($definitiveLabels as $label) {
                $labelTotals[$label]++;
            }
        }

        $observedAgreement = $pairComparisons > 0 ? $pairAgreements / $pairComparisons : null;
        $totalLabels = array_sum($labelTotals);
        $expectedAgreement = null;
        $kappa = null;
        if ($totalLabels > 0 && $observedAgreement !== null) {
            $caseShare = $labelTotals['case'] / $totalLabels;
            $nonCaseShare = $labelTotals['non_case'] / $totalLabels;
            $expectedAgreement = ($caseShare ** 2) + ($nonCaseShare ** 2);
            $kappa = abs(1 - $expectedAgreement) < 0.000001
                ? null
                : ($observedAgreement - $expectedAgreement) / (1 - $expectedAgreement);
        }

        $reviewers = $reviews
            ->groupBy('reviewer_id')
            ->map(fn ($rows) => [
                'reviewer_id' => $rows->first()->reviewer_id,
                'reviewer' => $rows->first()->reviewer,
                'reviews' => $rows->count(),
                'case' => $rows->where('label', 'case')->count(),
                'non_case' => $rows->where('label', 'non_case')->count(),
                'uncertain' => $rows->where('label', 'uncertain')->count(),
            ])
            ->values()
            ->all();

        $finalCounts = $this->counts($validation);

        return [
            'adjudications' => $adjudicationCount,
            'review_records' => $reviews->count(),
            'reviewed_adjudications' => $totalReviewed,
            'double_reviewed_adjudications' => $doubleReviewed,
            'consensus_adjudications' => $consensus,
            'conflict_adjudications' => $conflicts,
            'resolved_conflict_adjudications' => $resolvedConflicts,
            'unresolved_conflict_adjudications' => $unresolvedConflicts,
            'uncertain_reviews' => $uncertain,
            'observed_pairwise_agreement' => $observedAgreement,
            'expected_pairwise_agreement' => $expectedAgreement,
            'cohen_kappa' => $kappa,
            'ready_for_promotion' => $adjudicationCount > 0
                && $finalCounts['unreviewed'] === 0
                && $finalCounts['uncertain'] === 0
                && $unresolvedConflicts === 0,
            'reviewers' => $reviewers,
        ];
    }

    /**
     * @param  array<string, string>  $params
     * @return array<int, object>
     */
    private function selectSampleRows(
        string $connectionName,
        string $dialect,
        array $params,
        string $sql,
    ): array {
        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);

        return DB::connection($connectionName)->select($renderedSql);
    }

    private function memberSampleSql(int $cohortDefinitionId, int $limit, string $orderExpression): string
    {
        return "
            SELECT
                c.subject_id AS person_id,
                p.year_of_birth,
                COALESCE(gc.concept_name, 'Unknown') AS gender,
                c.cohort_start_date,
                c.cohort_end_date
            FROM {@resultsSchema}.cohort c
            INNER JOIN {@cdmSchema}.person p
                ON c.subject_id = p.person_id
            LEFT JOIN {@vocabSchema}.concept gc
                ON p.gender_concept_id = gc.concept_id
            WHERE c.cohort_definition_id = {$cohortDefinitionId}
            ORDER BY {$orderExpression}
            LIMIT {$limit}
        ";
    }

    private function nonMemberSampleSql(int $cohortDefinitionId, int $limit, string $orderExpression): string
    {
        return "
            SELECT
                p.person_id,
                p.year_of_birth,
                COALESCE(gc.concept_name, 'Unknown') AS gender,
                NULL AS cohort_start_date,
                NULL AS cohort_end_date
            FROM {@cdmSchema}.person p
            LEFT JOIN {@vocabSchema}.concept gc
                ON p.gender_concept_id = gc.concept_id
            WHERE NOT EXISTS (
                SELECT 1
                FROM {@resultsSchema}.cohort c
                WHERE c.cohort_definition_id = {$cohortDefinitionId}
                  AND c.subject_id = p.person_id
            )
            ORDER BY {$orderExpression}
            LIMIT {$limit}
        ";
    }

    private function orderExpression(string $dialect, string $personIdExpression, string $seed): string
    {
        $escapedSeed = str_replace("'", "''", $seed);

        return match (strtolower($dialect)) {
            'sql server', 'sqlserver', 'synapse' => "CHECKSUM(CONCAT(CAST({$personIdExpression} AS VARCHAR(64)), '{$escapedSeed}'))",
            default => "MD5(CAST({$personIdExpression} AS VARCHAR) || '{$escapedSeed}')",
        };
    }

    private function candidateLimit(int $requestedLimit, string $strategy): int
    {
        if ($requestedLimit <= 0) {
            return 0;
        }

        if ($strategy !== 'balanced_demographics') {
            return $requestedLimit;
        }

        return min(5000, max($requestedLimit, $requestedLimit * 10));
    }

    /**
     * @param  array<int, object>  $rows
     * @return array<int, object>
     */
    private function pickRows(array $rows, int $limit, string $strategy): array
    {
        if ($limit <= 0) {
            return [];
        }

        if ($strategy !== 'balanced_demographics') {
            return array_slice($rows, 0, $limit);
        }

        $strata = [];
        foreach ($rows as $row) {
            $strata[$this->stratumForRow($row)][] = $row;
        }

        ksort($strata);
        $selected = [];
        while (count($selected) < $limit && count($strata) > 0) {
            foreach (array_keys($strata) as $stratum) {
                $row = array_shift($strata[$stratum]);
                if ($row !== null) {
                    $selected[] = $row;
                }
                if (count($selected) >= $limit) {
                    break 2;
                }
                if ($strata[$stratum] === []) {
                    unset($strata[$stratum]);
                }
            }
        }

        return $selected;
    }

    private function upsertAdjudication(
        CohortPhenotypeValidation $validation,
        object $row,
        string $sampleGroup,
        string $seed,
        string $strategy,
    ): bool {
        $personId = (int) $row->person_id;
        $stratum = $this->stratumForRow($row);
        $payload = [
            'sample_group' => $sampleGroup,
            'demographics_json' => [
                'year_of_birth' => $row->year_of_birth ?? null,
                'gender' => $row->gender ?? null,
                'cohort_start_date' => $row->cohort_start_date ?? null,
                'cohort_end_date' => $row->cohort_end_date ?? null,
            ],
            'sampling_json' => [
                'seed' => $seed,
                'strategy' => $strategy,
                'stratum' => $stratum,
            ],
            'sampled_at' => now(),
        ];

        $adjudication = CohortPhenotypeAdjudication::query()
            ->firstOrCreate(
                [
                    'phenotype_validation_id' => $validation->id,
                    'person_id' => $personId,
                ],
                $payload,
            );

        if (! $adjudication->wasRecentlyCreated) {
            $adjudication->update($payload);
        }

        return $adjudication->wasRecentlyCreated;
    }

    private function stratumForRow(object $row): string
    {
        $gender = strtolower((string) ($row->gender ?? 'unknown'));
        $year = is_numeric($row->year_of_birth ?? null) ? (int) $row->year_of_birth : null;
        if ($year === null) {
            return "{$gender}|age_unknown";
        }

        $age = max(0, (int) now()->format('Y') - $year);
        $bandStart = intdiv($age, 10) * 10;
        $bandEnd = $bandStart + 9;

        return "{$gender}|age_{$bandStart}_{$bandEnd}";
    }
}
