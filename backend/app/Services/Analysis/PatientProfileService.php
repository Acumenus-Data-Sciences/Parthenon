<?php

namespace App\Services\Analysis;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Services\SqlRenderer\SqlRendererService;
use Illuminate\Support\Facades\DB;

class PatientProfileService
{
    public function __construct(
        private readonly SqlRendererService $sqlRenderer,
    ) {}

    /**
     * Get per-domain row counts for a person (single UNION ALL query).
     * Used by the frontend to detect when results are truncated at the LIMIT.
     *
     * @return array<string, int>
     */
    public function getProfileStats(int $personId, Source $source): array
    {
        $source->load('daimons');
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);

        if ($cdmSchema === null) {
            throw new \RuntimeException('Source is missing required CDM schema configuration.');
        }

        $dialect = $source->source_dialect ?? 'postgresql';
        $connectionName = $source->source_connection ?? 'cdm';

        $params = ['cdmSchema' => $cdmSchema];

        $sql = "
            SELECT 'condition'     AS domain, COUNT(*) AS total FROM {@cdmSchema}.condition_occurrence WHERE person_id = {$personId}
            UNION ALL
            SELECT 'drug',                    COUNT(*) FROM {@cdmSchema}.drug_exposure          WHERE person_id = {$personId}
            UNION ALL
            SELECT 'procedure',               COUNT(*) FROM {@cdmSchema}.procedure_occurrence   WHERE person_id = {$personId}
            UNION ALL
            SELECT 'measurement',             COUNT(*) FROM {@cdmSchema}.measurement            WHERE person_id = {$personId}
            UNION ALL
            SELECT 'observation',             COUNT(*) FROM {@cdmSchema}.observation            WHERE person_id = {$personId}
            UNION ALL
            SELECT 'visit',                   COUNT(*) FROM {@cdmSchema}.visit_occurrence       WHERE person_id = {$personId}
            UNION ALL
            SELECT 'condition_era',           COUNT(*) FROM {@cdmSchema}.condition_era          WHERE person_id = {$personId}
            UNION ALL
            SELECT 'drug_era',                COUNT(*) FROM {@cdmSchema}.drug_era               WHERE person_id = {$personId}
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);

        try {
            $conn = DB::connection($connectionName);
            $conn->statement('SET enable_seqscan = off');
            $conn->statement('SET statement_timeout = 5000');
            $rows = $conn->select($renderedSql);
            $conn->statement('SET enable_seqscan = on');
            $conn->statement('SET statement_timeout = 0');
        } catch (\Throwable $e) {
            \Log::warning('PatientProfileService: stats query failed', ['error' => $e->getMessage()]);
            try { $conn->statement('SET enable_seqscan = on'); $conn->statement('SET statement_timeout = 0'); } catch (\Throwable) {}
            $rows = [];
        }

        $counts = [];
        foreach ($rows as $row) {
            $counts[$row->domain] = (int) $row->total;
        }

        return $counts;
    }

    /**
     * Get the full clinical profile for a single person.
     *
     * @return array<string, mixed>
     */
    public function getProfile(int $personId, Source $source): array
    {
        $source->load('daimons');
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;

        if ($cdmSchema === null) {
            throw new \RuntimeException(
                'Source is missing required CDM schema configuration.'
            );
        }

        $dialect = $source->source_dialect ?? 'postgresql';
        $connectionName = $source->source_connection ?? 'cdm';

        $params = [
            'cdmSchema' => $cdmSchema,
            'vocabSchema' => $vocabSchema,
        ];

        // On this HDD-backed server the planner prefers parallel seq scans over
        // index scans (random_page_cost=4). For person-level profile queries the
        // person_id-first indexes are far faster in practice, so disable seq scans
        // for this session. Also cap each query to 15 s so a stale index path
        // never hangs the whole request.
        $conn = DB::connection($connectionName);
        $conn->statement('SET enable_seqscan = off');
        $conn->statement('SET statement_timeout = 5000');

        try {
            $result = [
                'demographics'        => $this->getDemographics($personId, $params, $dialect, $connectionName),
                'observation_periods' => $this->getObservationPeriods($personId, $params, $dialect, $connectionName),
                'conditions'          => $this->safeQuery(fn () => $this->getConditions($personId, $params, $dialect, $connectionName)),
                'drugs'               => $this->safeQuery(fn () => $this->getDrugs($personId, $params, $dialect, $connectionName)),
                'procedures'          => $this->safeQuery(fn () => $this->getProcedures($personId, $params, $dialect, $connectionName)),
                'measurements'        => $this->safeQuery(fn () => $this->getMeasurements($personId, $params, $dialect, $connectionName)),
                'observations'        => $this->safeQuery(fn () => $this->getObservations($personId, $params, $dialect, $connectionName)),
                'visits'              => $this->safeQuery(fn () => $this->getVisits($personId, $params, $dialect, $connectionName)),
                'condition_eras'      => $this->safeQuery(fn () => $this->getConditionEras($personId, $params, $dialect, $connectionName)),
                'drug_eras'           => $this->safeQuery(fn () => $this->getDrugEras($personId, $params, $dialect, $connectionName)),
            ];
        } finally {
            // Always reset so subsequent requests on this connection aren't affected
            try {
                $conn->statement('SET enable_seqscan = on');
                $conn->statement('SET statement_timeout = 0');
            } catch (\Throwable) {}
        }

        return $result;
    }

    /**
     * Run a query closure and return [] on timeout or query failure.
     * Allows partial profile loads when indexes are missing on large tables.
     *
     * @param  callable(): list<array<string,mixed>>  $fn
     * @return list<array<string,mixed>>
     */
    private function safeQuery(callable $fn): array
    {
        try {
            return $fn();
        } catch (\Throwable $e) {
            // Log but don't bubble — return empty so other domains still load
            \Log::warning('PatientProfileService: domain query failed', [
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * Search for persons by ID prefix or person_source_value (MRN) substring.
     * Returns up to $limit matching persons with basic demographics.
     *
     * @return list<array<string, mixed>>
     */
    public function searchPersons(string $query, Source $source, int $limit = 20): array
    {
        $source->load('daimons');
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;

        if ($cdmSchema === null) {
            throw new \RuntimeException(
                'Source is missing required CDM schema configuration.'
            );
        }

        $dialect = $source->source_dialect ?? 'postgresql';
        $connectionName = $source->source_connection ?? 'cdm';

        $params = [
            'cdmSchema' => $cdmSchema,
            'vocabSchema' => $vocabSchema,
        ];

        // Determine bindings: numeric = id prefix match, else source_value contains match
        $isNumeric = ctype_digit(ltrim($query, ' '));
        $idPattern = $isNumeric ? $query.'%' : '%__no_match__%';
        $srcPattern = '%'.mb_strtolower($query).'%';

        $sql = "
            SELECT
                p.person_id,
                COALESCE(p.person_source_value, '') AS person_source_value,
                p.year_of_birth,
                p.month_of_birth,
                COALESCE(gc.concept_name, 'Unknown') AS gender,
                COALESCE(rc.concept_name, 'Unknown') AS race
            FROM {@cdmSchema}.person p
            LEFT JOIN {@vocabSchema}.concept gc
                ON p.gender_concept_id = gc.concept_id
            LEFT JOIN {@vocabSchema}.concept rc
                ON p.race_concept_id = rc.concept_id
            WHERE (
                CAST(p.person_id AS VARCHAR) LIKE ?
                OR LOWER(COALESCE(p.person_source_value, '')) LIKE ?
            )
            ORDER BY p.person_id
            LIMIT {$limit}
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql, [$idPattern, $srcPattern]);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get paginated cohort members with basic demographics.
     * Returns {data: [...], meta: {current_page, last_page, per_page, total}}
     *
     * @return array<string, mixed>
     */
    public function getCohortMembers(
        int $cohortDefinitionId,
        Source $source,
        int $page = 1,
        int $perPage = 15,
    ): array {
        $source->load('daimons');
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);

        if ($cdmSchema === null || $resultsSchema === null) {
            throw new \RuntimeException(
                'Source is missing required CDM or Results schema configuration.'
            );
        }

        $dialect = $source->source_dialect ?? 'postgresql';
        $connectionName = $source->source_connection ?? 'cdm';
        $cohortTable = "{$resultsSchema}.cohort";

        $params = [
            'cdmSchema' => $cdmSchema,
            'vocabSchema' => $vocabSchema,
            'resultsSchema' => $resultsSchema,
        ];

        $offset = ($page - 1) * $perPage;

        $countSql = "
            SELECT COUNT(DISTINCT c.subject_id) AS total_count
            FROM {$cohortTable} c
            WHERE c.cohort_definition_id = {$cohortDefinitionId}
        ";

        $renderedCountSql = $this->sqlRenderer->render($countSql, $params, $dialect);
        $countResult = DB::connection($connectionName)->select($renderedCountSql);
        $totalCount = ! empty($countResult) ? (int) $countResult[0]->total_count : 0;

        $lastPage = max(1, (int) ceil($totalCount / $perPage));

        $membersSql = "
            SELECT
                c.subject_id,
                c.cohort_start_date,
                c.cohort_end_date,
                p.year_of_birth,
                COALESCE(gc.concept_name, 'Unknown') AS gender
            FROM {$cohortTable} c
            INNER JOIN {@cdmSchema}.person p
                ON c.subject_id = p.person_id
            LEFT JOIN {@vocabSchema}.concept gc
                ON p.gender_concept_id = gc.concept_id
            WHERE c.cohort_definition_id = {$cohortDefinitionId}
            ORDER BY c.subject_id
            LIMIT {$perPage} OFFSET {$offset}
        ";

        $renderedMembersSql = $this->sqlRenderer->render($membersSql, $params, $dialect);
        $memberRows = DB::connection($connectionName)->select($renderedMembersSql);

        return [
            'data' => array_map(fn ($row) => (array) $row, $memberRows),
            'meta' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $totalCount,
            ],
        ];
    }

    /**
     * Get person demographics including location.
     *
     * @param  array<string, string>  $params
     * @return array<string, mixed>
     */
    private function getDemographics(
        int $personId,
        array $params,
        string $dialect,
        string $connectionName,
    ): array {
        $sql = "
            SELECT
                p.person_id,
                p.year_of_birth,
                p.month_of_birth,
                p.day_of_birth,
                COALESCE(gc.concept_name, 'Unknown') AS gender,
                COALESCE(rc.concept_name, 'Unknown') AS race,
                COALESCE(ec.concept_name, 'Unknown') AS ethnicity,
                loc.city,
                loc.state,
                loc.zip,
                loc.county
            FROM {@cdmSchema}.person p
            LEFT JOIN {@vocabSchema}.concept gc
                ON p.gender_concept_id = gc.concept_id
            LEFT JOIN {@vocabSchema}.concept rc
                ON p.race_concept_id = rc.concept_id
            LEFT JOIN {@vocabSchema}.concept ec
                ON p.ethnicity_concept_id = ec.concept_id
            LEFT JOIN {@cdmSchema}.location loc
                ON p.location_id = loc.location_id
            WHERE p.person_id = {$personId}
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return ! empty($rows) ? (array) $rows[0] : [];
    }

    /**
     * Get observation periods — normalized to start_date / end_date.
     *
     * @param  array<string, string>  $params
     * @return list<array<string, mixed>>
     */
    private function getObservationPeriods(
        int $personId,
        array $params,
        string $dialect,
        string $connectionName,
    ): array {
        $sql = "
            SELECT
                op.observation_period_id,
                op.observation_period_start_date AS start_date,
                op.observation_period_end_date AS end_date,
                COALESCE(ptc.concept_name, 'Unknown') AS period_type
            FROM {@cdmSchema}.observation_period op
            LEFT JOIN {@vocabSchema}.concept ptc
                ON op.period_type_concept_id = ptc.concept_id
            WHERE op.person_id = {$personId}
            ORDER BY op.observation_period_start_date
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get conditions — normalized to shared ClinicalEvent schema.
     *
     * @param  array<string, string>  $params
     * @return list<array<string, mixed>>
     */
    private function getConditions(
        int $personId,
        array $params,
        string $dialect,
        string $connectionName,
    ): array {
        $sql = "
            SELECT
                co.condition_occurrence_id AS occurrence_id,
                co.condition_concept_id AS concept_id,
                COALESCE(c.concept_name, 'Unknown') AS concept_name,
                'condition' AS domain,
                COALESCE(c.vocabulary_id, '') AS vocabulary,
                co.condition_start_date AS start_date,
                co.condition_end_date AS end_date,
                COALESCE(tc.concept_name, 'Unknown') AS type_name
            FROM {@cdmSchema}.condition_occurrence co
            LEFT JOIN {@vocabSchema}.concept c
                ON co.condition_concept_id = c.concept_id
            LEFT JOIN {@vocabSchema}.concept tc
                ON co.condition_type_concept_id = tc.concept_id
            WHERE co.person_id = {$personId}
            ORDER BY co.condition_start_date DESC
            LIMIT 2000
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get drug exposures — normalized with route, quantity, days_supply.
     *
     * @param  array<string, string>  $params
     * @return list<array<string, mixed>>
     */
    private function getDrugs(
        int $personId,
        array $params,
        string $dialect,
        string $connectionName,
    ): array {
        $sql = "
            SELECT
                de.drug_exposure_id AS occurrence_id,
                de.drug_concept_id AS concept_id,
                COALESCE(c.concept_name, 'Unknown') AS concept_name,
                'drug' AS domain,
                COALESCE(c.vocabulary_id, '') AS vocabulary,
                de.drug_exposure_start_date AS start_date,
                de.drug_exposure_end_date AS end_date,
                COALESCE(tc.concept_name, 'Unknown') AS type_name,
                COALESCE(rc.concept_name, '') AS route,
                de.quantity,
                de.days_supply
            FROM {@cdmSchema}.drug_exposure de
            LEFT JOIN {@vocabSchema}.concept c
                ON de.drug_concept_id = c.concept_id
            LEFT JOIN {@vocabSchema}.concept rc
                ON de.route_concept_id = rc.concept_id
            LEFT JOIN {@vocabSchema}.concept tc
                ON de.drug_type_concept_id = tc.concept_id
            WHERE de.person_id = {$personId}
            ORDER BY de.drug_exposure_start_date DESC
            LIMIT 2000
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get procedures — normalized, includes quantity.
     *
     * @param  array<string, string>  $params
     * @return list<array<string, mixed>>
     */
    private function getProcedures(
        int $personId,
        array $params,
        string $dialect,
        string $connectionName,
    ): array {
        $sql = "
            SELECT
                po.procedure_occurrence_id AS occurrence_id,
                po.procedure_concept_id AS concept_id,
                COALESCE(c.concept_name, 'Unknown') AS concept_name,
                'procedure' AS domain,
                COALESCE(c.vocabulary_id, '') AS vocabulary,
                po.procedure_date AS start_date,
                NULL AS end_date,
                COALESCE(tc.concept_name, 'Unknown') AS type_name,
                po.quantity
            FROM {@cdmSchema}.procedure_occurrence po
            LEFT JOIN {@vocabSchema}.concept c
                ON po.procedure_concept_id = c.concept_id
            LEFT JOIN {@vocabSchema}.concept tc
                ON po.procedure_type_concept_id = tc.concept_id
            WHERE po.person_id = {$personId}
            ORDER BY po.procedure_date DESC
            LIMIT 2000
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get measurements — normalized with value, unit, and reference range.
     *
     * @param  array<string, string>  $params
     * @return list<array<string, mixed>>
     */
    private function getMeasurements(
        int $personId,
        array $params,
        string $dialect,
        string $connectionName,
    ): array {
        $sql = "
            SELECT
                m.measurement_id AS occurrence_id,
                m.measurement_concept_id AS concept_id,
                COALESCE(c.concept_name, 'Unknown') AS concept_name,
                'measurement' AS domain,
                COALESCE(c.vocabulary_id, '') AS vocabulary,
                m.measurement_date AS start_date,
                NULL AS end_date,
                COALESCE(tc.concept_name, 'Unknown') AS type_name,
                m.value_as_number AS value,
                COALESCE(vc.concept_name, '') AS value_as_concept,
                COALESCE(uc.concept_name, '') AS unit,
                m.range_low,
                m.range_high
            FROM {@cdmSchema}.measurement m
            LEFT JOIN {@vocabSchema}.concept c
                ON m.measurement_concept_id = c.concept_id
            LEFT JOIN {@vocabSchema}.concept vc
                ON m.value_as_concept_id = vc.concept_id
            LEFT JOIN {@vocabSchema}.concept uc
                ON m.unit_concept_id = uc.concept_id
            LEFT JOIN {@vocabSchema}.concept tc
                ON m.measurement_type_concept_id = tc.concept_id
            WHERE m.person_id = {$personId}
            ORDER BY m.measurement_date DESC
            LIMIT 500
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get observations — normalized with value fields.
     *
     * @param  array<string, string>  $params
     * @return list<array<string, mixed>>
     */
    private function getObservations(
        int $personId,
        array $params,
        string $dialect,
        string $connectionName,
    ): array {
        $sql = "
            SELECT
                o.observation_id AS occurrence_id,
                o.observation_concept_id AS concept_id,
                COALESCE(c.concept_name, 'Unknown') AS concept_name,
                'observation' AS domain,
                COALESCE(c.vocabulary_id, '') AS vocabulary,
                o.observation_date AS start_date,
                NULL AS end_date,
                COALESCE(tc.concept_name, 'Unknown') AS type_name,
                o.value_as_number AS value,
                o.value_as_string,
                COALESCE(vc.concept_name, '') AS value_as_concept,
                COALESCE(uc.concept_name, '') AS unit
            FROM {@cdmSchema}.observation o
            LEFT JOIN {@vocabSchema}.concept c
                ON o.observation_concept_id = c.concept_id
            LEFT JOIN {@vocabSchema}.concept vc
                ON o.value_as_concept_id = vc.concept_id
            LEFT JOIN {@vocabSchema}.concept uc
                ON o.unit_concept_id = uc.concept_id
            LEFT JOIN {@vocabSchema}.concept tc
                ON o.observation_type_concept_id = tc.concept_id
            WHERE o.person_id = {$personId}
            ORDER BY o.observation_date DESC
            LIMIT 500
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get visits — normalized, includes visit_occurrence_id for event binning.
     *
     * @param  array<string, string>  $params
     * @return list<array<string, mixed>>
     */
    private function getVisits(
        int $personId,
        array $params,
        string $dialect,
        string $connectionName,
    ): array {
        $sql = "
            SELECT
                vo.visit_occurrence_id,
                vo.visit_concept_id AS concept_id,
                COALESCE(c.concept_name, 'Unknown') AS concept_name,
                'visit' AS domain,
                'Visit' AS vocabulary,
                vo.visit_start_date AS start_date,
                vo.visit_end_date AS end_date,
                COALESCE(tc.concept_name, 'Unknown') AS type_name
            FROM {@cdmSchema}.visit_occurrence vo
            LEFT JOIN {@vocabSchema}.concept c
                ON vo.visit_concept_id = c.concept_id
            LEFT JOIN {@vocabSchema}.concept tc
                ON vo.visit_type_concept_id = tc.concept_id
            WHERE vo.person_id = {$personId}
            ORDER BY vo.visit_start_date DESC
            LIMIT 500
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get condition eras.
     *
     * @param  array<string, string>  $params
     * @return list<array<string, mixed>>
     */
    private function getConditionEras(
        int $personId,
        array $params,
        string $dialect,
        string $connectionName,
    ): array {
        $sql = "
            SELECT
                ce.condition_era_id,
                ce.condition_concept_id,
                COALESCE(c.concept_name, 'Unknown') AS condition_name,
                ce.condition_era_start_date,
                ce.condition_era_end_date,
                ce.condition_occurrence_count
            FROM {@cdmSchema}.condition_era ce
            LEFT JOIN {@vocabSchema}.concept c
                ON ce.condition_concept_id = c.concept_id
            WHERE ce.person_id = {$personId}
            ORDER BY ce.condition_era_start_date
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get drug eras.
     *
     * @param  array<string, string>  $params
     * @return list<array<string, mixed>>
     */
    private function getDrugEras(
        int $personId,
        array $params,
        string $dialect,
        string $connectionName,
    ): array {
        $sql = "
            SELECT
                de.drug_era_id,
                de.drug_concept_id,
                COALESCE(c.concept_name, 'Unknown') AS drug_name,
                de.drug_era_start_date,
                de.drug_era_end_date,
                de.drug_exposure_count,
                de.gap_days
            FROM {@cdmSchema}.drug_era de
            LEFT JOIN {@vocabSchema}.concept c
                ON de.drug_concept_id = c.concept_id
            WHERE de.person_id = {$personId}
            ORDER BY de.drug_era_start_date
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }
}
