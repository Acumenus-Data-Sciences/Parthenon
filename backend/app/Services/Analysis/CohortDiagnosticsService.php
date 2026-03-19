<?php

namespace App\Services\Analysis;

use App\Enums\DaimonType;
use App\Models\App\CohortDefinition;
use App\Models\App\Source;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;

/**
 * Cohort Diagnostics Service.
 *
 * Provides SQL-based cohort diagnostics without requiring R. This covers the
 * core OHDSI CohortDiagnostics checks that can be done in pure SQL:
 * - Cohort counts & attrition
 * - Index event breakdown (which domain criteria matched)
 * - Visit context (inpatient vs outpatient distribution)
 * - Time distribution (observation time before/after index)
 *
 * For advanced diagnostics (incidence rate temporal, overlap via phenotype
 * library), these can be extended via an optional R hook point (see RService).
 */
class CohortDiagnosticsService
{
    public function __construct(
        private readonly SqlRendererService $sqlRenderer,
    ) {}

    /**
     * Run SQL-based cohort diagnostics.
     *
     * @return array<string, mixed>
     */
    public function run(CohortDefinition $cohortDef, Source $source): array
    {
        $source->load('daimons');
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);

        if ($cdmSchema === null || $resultsSchema === null) {
            throw new \RuntimeException('Source is missing required CDM or Results schema configuration.');
        }

        $dialect = $source->source_dialect ?? 'postgresql';
        $connectionName = $source->source_connection ?? 'omop';
        $cohortTable = "{$resultsSchema}.cohort";
        $cohortId = $cohortDef->id;

        $params = [
            'cdmSchema' => $cdmSchema,
            'vocabSchema' => $vocabSchema,
            'resultsSchema' => $resultsSchema,
        ];

        return [
            'cohort_id' => $cohortId,
            'cohort_name' => $cohortDef->name,
            'counts' => $this->getCohortCounts($cohortId, $cohortTable, $params, $dialect, $connectionName),
            'visit_context' => $this->getVisitContext($cohortId, $cohortTable, $cdmSchema, $vocabSchema, $params, $dialect, $connectionName),
            'time_distributions' => $this->getTimeDistributions($cohortId, $cohortTable, $cdmSchema, $params, $dialect, $connectionName),
            'age_at_index' => $this->getAgeAtIndex($cohortId, $cohortTable, $cdmSchema, $params, $dialect, $connectionName),
        ];
    }

    /**
     * Cohort person/record counts.
     */
    private function getCohortCounts(
        int $cohortId,
        string $cohortTable,
        array $params,
        string $dialect,
        string $connectionName,
    ): array {
        $sql = "
            SELECT
                COUNT(*) AS total_records,
                COUNT(DISTINCT subject_id) AS distinct_persons
            FROM {$cohortTable}
            WHERE cohort_definition_id = {$cohortId}
        ";

        $rendered = $this->sqlRenderer->render($sql, $params, $dialect);
        $row = DB::connection($connectionName)->select($rendered);

        return ! empty($row) ? (array) $row[0] : ['total_records' => 0, 'distinct_persons' => 0];
    }

    /**
     * Visit type distribution at index date.
     */
    private function getVisitContext(
        int $cohortId,
        string $cohortTable,
        string $cdmSchema,
        string $vocabSchema,
        array $params,
        string $dialect,
        string $connectionName,
    ): array {
        $sql = "
            SELECT
                COALESCE(vc.concept_name, 'No visit') AS visit_type,
                COUNT(DISTINCT c.subject_id) AS person_count
            FROM {$cohortTable} c
            LEFT JOIN {$cdmSchema}.visit_occurrence vo
                ON c.subject_id = vo.person_id
                AND c.cohort_start_date >= vo.visit_start_date
                AND c.cohort_start_date <= vo.visit_end_date
            LEFT JOIN {$vocabSchema}.concept vc
                ON vo.visit_concept_id = vc.concept_id
            WHERE c.cohort_definition_id = {$cohortId}
            GROUP BY COALESCE(vc.concept_name, 'No visit')
            ORDER BY person_count DESC
            LIMIT 10
        ";

        $rendered = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($rendered);

        return array_map(fn ($r) => (array) $r, $rows);
    }

    /**
     * Observation time before and after index date.
     */
    private function getTimeDistributions(
        int $cohortId,
        string $cohortTable,
        string $cdmSchema,
        array $params,
        string $dialect,
        string $connectionName,
    ): array {
        $sql = "
            SELECT
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY days_before) AS p25_before,
                PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY days_before) AS median_before,
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY days_before) AS p75_before,
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY days_after) AS p25_after,
                PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY days_after) AS median_after,
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY days_after) AS p75_after
            FROM (
                SELECT
                    c.cohort_start_date - op.observation_period_start_date AS days_before,
                    op.observation_period_end_date - c.cohort_start_date AS days_after
                FROM {$cohortTable} c
                INNER JOIN {$cdmSchema}.observation_period op
                    ON c.subject_id = op.person_id
                    AND c.cohort_start_date >= op.observation_period_start_date
                    AND c.cohort_start_date <= op.observation_period_end_date
                WHERE c.cohort_definition_id = {$cohortId}
            ) obs_times
        ";

        $rendered = $this->sqlRenderer->render($sql, $params, $dialect);
        $row = DB::connection($connectionName)->select($rendered);

        return ! empty($row) ? (array) $row[0] : [];
    }

    /**
     * Age distribution at index date.
     */
    private function getAgeAtIndex(
        int $cohortId,
        string $cohortTable,
        string $cdmSchema,
        array $params,
        string $dialect,
        string $connectionName,
    ): array {
        $sql = "
            SELECT
                FLOOR((EXTRACT(YEAR FROM c.cohort_start_date) - p.year_of_birth) / 10) * 10 AS age_group,
                COUNT(DISTINCT c.subject_id) AS person_count
            FROM {$cohortTable} c
            INNER JOIN {$cdmSchema}.person p
                ON c.subject_id = p.person_id
            WHERE c.cohort_definition_id = {$cohortId}
            GROUP BY FLOOR((EXTRACT(YEAR FROM c.cohort_start_date) - p.year_of_birth) / 10) * 10
            ORDER BY age_group
        ";

        $rendered = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($rendered);

        return array_map(fn ($r) => (array) $r, $rows);
    }
}
