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

        // Collect all domain data in parallel structure
        $profile = [
            'demographics' => $this->getDemographics($personId, $params, $dialect, $connectionName),
            'observation_periods' => $this->getObservationPeriods($personId, $params, $dialect, $connectionName),
            'conditions' => $this->getConditions($personId, $params, $dialect, $connectionName),
            'drugs' => $this->getDrugs($personId, $params, $dialect, $connectionName),
            'procedures' => $this->getProcedures($personId, $params, $dialect, $connectionName),
            'measurements' => $this->getMeasurements($personId, $params, $dialect, $connectionName),
            'observations' => $this->getObservations($personId, $params, $dialect, $connectionName),
            'visits' => $this->getVisits($personId, $params, $dialect, $connectionName),
            'condition_eras' => $this->getConditionEras($personId, $params, $dialect, $connectionName),
            'drug_eras' => $this->getDrugEras($personId, $params, $dialect, $connectionName),
        ];

        return $profile;
    }

    /**
     * Get paginated cohort members with basic demographics.
     *
     * @return array<string, mixed>
     */
    public function getCohortMembers(
        int $cohortDefinitionId,
        Source $source,
        int $limit = 100,
        int $offset = 0,
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
            'cohortTable' => $cohortTable,
        ];

        // Get total count
        $countSql = "
            SELECT COUNT(DISTINCT c.subject_id) AS total_count
            FROM {$cohortTable} c
            WHERE c.cohort_definition_id = {$cohortDefinitionId}
        ";

        $renderedCountSql = $this->sqlRenderer->render($countSql, $params, $dialect);
        $countResult = DB::connection($connectionName)->select($renderedCountSql);
        $totalCount = ! empty($countResult) ? (int) $countResult[0]->total_count : 0;

        // Get paginated members
        $membersSql = "
            SELECT
                c.subject_id AS person_id,
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
            LIMIT {$limit} OFFSET {$offset}
        ";

        $renderedMembersSql = $this->sqlRenderer->render($membersSql, $params, $dialect);
        $memberRows = DB::connection($connectionName)->select($renderedMembersSql);

        return [
            'total_count' => $totalCount,
            'offset' => $offset,
            'limit' => $limit,
            'members' => array_map(fn ($row) => (array) $row, $memberRows),
        ];
    }

    /**
     * Get person demographics.
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
     * Get observation periods for a person.
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
                op.observation_period_start_date,
                op.observation_period_end_date,
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
     * Get conditions for a person.
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
                co.condition_occurrence_id,
                co.condition_concept_id,
                COALESCE(c.concept_name, 'Unknown') AS condition_name,
                COALESCE(c.domain_id, '') AS domain,
                COALESCE(c.vocabulary_id, '') AS vocabulary,
                co.condition_start_date,
                co.condition_end_date,
                COALESCE(tc.concept_name, 'Unknown') AS condition_type
            FROM {@cdmSchema}.condition_occurrence co
            LEFT JOIN {@vocabSchema}.concept c
                ON co.condition_concept_id = c.concept_id
            LEFT JOIN {@vocabSchema}.concept tc
                ON co.condition_type_concept_id = tc.concept_id
            WHERE co.person_id = {$personId}
            ORDER BY co.condition_start_date
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get drug exposures for a person.
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
                de.drug_exposure_id,
                de.drug_concept_id,
                COALESCE(c.concept_name, 'Unknown') AS drug_name,
                COALESCE(c.domain_id, '') AS domain,
                COALESCE(c.vocabulary_id, '') AS vocabulary,
                de.drug_exposure_start_date,
                de.drug_exposure_end_date,
                de.quantity,
                de.days_supply,
                COALESCE(rc.concept_name, '') AS route,
                COALESCE(tc.concept_name, 'Unknown') AS drug_type
            FROM {@cdmSchema}.drug_exposure de
            LEFT JOIN {@vocabSchema}.concept c
                ON de.drug_concept_id = c.concept_id
            LEFT JOIN {@vocabSchema}.concept rc
                ON de.route_concept_id = rc.concept_id
            LEFT JOIN {@vocabSchema}.concept tc
                ON de.drug_type_concept_id = tc.concept_id
            WHERE de.person_id = {$personId}
            ORDER BY de.drug_exposure_start_date
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get procedures for a person.
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
                po.procedure_occurrence_id,
                po.procedure_concept_id,
                COALESCE(c.concept_name, 'Unknown') AS procedure_name,
                COALESCE(c.domain_id, '') AS domain,
                COALESCE(c.vocabulary_id, '') AS vocabulary,
                po.procedure_date,
                po.quantity,
                COALESCE(tc.concept_name, 'Unknown') AS procedure_type
            FROM {@cdmSchema}.procedure_occurrence po
            LEFT JOIN {@vocabSchema}.concept c
                ON po.procedure_concept_id = c.concept_id
            LEFT JOIN {@vocabSchema}.concept tc
                ON po.procedure_type_concept_id = tc.concept_id
            WHERE po.person_id = {$personId}
            ORDER BY po.procedure_date
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get measurements for a person.
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
                m.measurement_id,
                m.measurement_concept_id,
                COALESCE(c.concept_name, 'Unknown') AS measurement_name,
                m.measurement_date,
                m.value_as_number,
                COALESCE(vc.concept_name, '') AS value_as_concept,
                COALESCE(uc.concept_name, '') AS unit,
                m.range_low,
                m.range_high,
                COALESCE(tc.concept_name, 'Unknown') AS measurement_type
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
            ORDER BY m.measurement_date
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get observations for a person.
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
                o.observation_id,
                o.observation_concept_id,
                COALESCE(c.concept_name, 'Unknown') AS observation_name,
                o.observation_date,
                o.value_as_number,
                o.value_as_string,
                COALESCE(vc.concept_name, '') AS value_as_concept,
                COALESCE(uc.concept_name, '') AS unit,
                COALESCE(tc.concept_name, 'Unknown') AS observation_type
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
            ORDER BY o.observation_date
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get visits for a person.
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
                vo.visit_concept_id,
                COALESCE(c.concept_name, 'Unknown') AS visit_type,
                vo.visit_start_date,
                vo.visit_end_date,
                COALESCE(tc.concept_name, 'Unknown') AS visit_type_concept
            FROM {@cdmSchema}.visit_occurrence vo
            LEFT JOIN {@vocabSchema}.concept c
                ON vo.visit_concept_id = c.concept_id
            LEFT JOIN {@vocabSchema}.concept tc
                ON vo.visit_type_concept_id = tc.concept_id
            WHERE vo.person_id = {$personId}
            ORDER BY vo.visit_start_date
        ";

        $renderedSql = $this->sqlRenderer->render($sql, $params, $dialect);
        $rows = DB::connection($connectionName)->select($renderedSql);

        return array_map(fn ($row) => (array) $row, $rows);
    }

    /**
     * Get condition eras for a person.
     * Condition eras merge overlapping condition records into continuous spans.
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
     * Get drug eras for a person.
     * Drug eras merge overlapping drug exposure records with a persistence window.
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
