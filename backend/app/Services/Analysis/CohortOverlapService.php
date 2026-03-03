<?php

namespace App\Services\Analysis;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;

class CohortOverlapService
{
    public function __construct(
        private readonly SqlRendererService $sqlRenderer,
    ) {}

    /**
     * Compute pairwise overlap between 2-4 cohort definitions.
     *
     * @param  list<int>  $cohortIds
     * @return array{pairs: list<array<string, mixed>>, summary: array<string, mixed>}
     */
    public function computeOverlap(array $cohortIds, Source $source): array
    {
        $source->load('daimons');
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);

        if ($resultsSchema === null) {
            throw new \RuntimeException('Source is missing required Results schema configuration.');
        }

        $dialect = $source->source_dialect ?? 'postgresql';
        $connectionName = $source->source_connection ?? 'cdm';
        $cohortTable = "{$resultsSchema}.cohort";

        $params = ['resultsSchema' => $resultsSchema];

        // Get distinct subject counts per cohort
        $cohortCounts = [];
        foreach ($cohortIds as $cohortId) {
            $sql = "
                SELECT COUNT(DISTINCT subject_id) AS person_count
                FROM {$cohortTable}
                WHERE cohort_definition_id = {$cohortId}
            ";
            $rendered = $this->sqlRenderer->render($sql, $params, $dialect);
            $row = DB::connection($connectionName)->select($rendered);
            $cohortCounts[$cohortId] = ! empty($row) ? (int) $row[0]->person_count : 0;
        }

        // Compute pairwise overlaps
        $pairs = [];
        for ($i = 0; $i < count($cohortIds); $i++) {
            for ($j = $i + 1; $j < count($cohortIds); $j++) {
                $idA = $cohortIds[$i];
                $idB = $cohortIds[$j];

                $overlapSql = "
                    SELECT COUNT(DISTINCT a.subject_id) AS overlap_count
                    FROM {$cohortTable} a
                    INNER JOIN {$cohortTable} b
                        ON a.subject_id = b.subject_id
                    WHERE a.cohort_definition_id = {$idA}
                      AND b.cohort_definition_id = {$idB}
                ";

                $rendered = $this->sqlRenderer->render($overlapSql, $params, $dialect);
                $row = DB::connection($connectionName)->select($rendered);
                $overlapCount = ! empty($row) ? (int) $row[0]->overlap_count : 0;

                $countA = $cohortCounts[$idA];
                $countB = $cohortCounts[$idB];

                $pairs[] = [
                    'cohort_id_a' => $idA,
                    'cohort_id_b' => $idB,
                    'count_a' => $countA,
                    'count_b' => $countB,
                    'overlap_count' => $overlapCount,
                    'only_a' => $countA - $overlapCount,
                    'only_b' => $countB - $overlapCount,
                    'jaccard_index' => ($countA + $countB - $overlapCount) > 0
                        ? round($overlapCount / ($countA + $countB - $overlapCount), 4)
                        : 0,
                ];
            }
        }

        // Compute union of all subjects across all cohorts
        $allIdsPlaceholder = implode(',', $cohortIds);
        $unionSql = "
            SELECT COUNT(DISTINCT subject_id) AS total_subjects
            FROM {$cohortTable}
            WHERE cohort_definition_id IN ({$allIdsPlaceholder})
        ";
        $rendered = $this->sqlRenderer->render($unionSql, $params, $dialect);
        $unionRow = DB::connection($connectionName)->select($rendered);
        $totalSubjects = ! empty($unionRow) ? (int) $unionRow[0]->total_subjects : 0;

        return [
            'cohort_counts' => $cohortCounts,
            'pairs' => $pairs,
            'summary' => [
                'cohort_ids' => $cohortIds,
                'total_unique_subjects' => $totalSubjects,
            ],
        ];
    }
}
