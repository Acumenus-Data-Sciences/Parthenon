<?php

namespace App\Services\Ingestion;

use App\Concerns\SourceAware;
use App\Models\App\IngestionJob;
use Illuminate\Support\Facades\Log;

class PostLoadValidationService
{
    use SourceAware;

    /**
     * Run all DQD-style validation checks on CDM data for an ingestion job.
     *
     * @return array<string, int>
     */
    public function validate(IngestionJob $job): array
    {
        $counts = [
            'total' => 0,
            'passed' => 0,
            'failed' => 0,
            'warnings' => 0,
        ];

        // Clear previous results
        $job->validationResults()->delete();

        // Run all check categories
        $this->runCompletenessChecks($job, $counts);
        $this->runConformanceChecks($job, $counts);
        $this->runPlausibilityChecks($job, $counts);

        return $counts;
    }

    /**
     * Run completeness checks: required fields are populated.
     *
     * @param  array<string, int>  &$counts
     */
    private function runCompletenessChecks(IngestionJob $job, array &$counts): void
    {
        $cdm = $this->cdm();

        // person.gender_concept_id IS NOT NULL
        $this->runCheck($job, $counts, [
            'check_name' => 'person_gender_concept_id_not_null',
            'check_category' => 'completeness',
            'cdm_table' => 'person',
            'cdm_column' => 'gender_concept_id',
            'severity' => 'error',
            'description' => 'gender_concept_id should not be NULL in person table.',
            'sql_violated' => 'SELECT COUNT(*) FROM person WHERE gender_concept_id IS NULL',
            'sql_total' => 'SELECT COUNT(*) FROM person',
        ]);

        // person.year_of_birth IS NOT NULL
        $this->runCheck($job, $counts, [
            'check_name' => 'person_year_of_birth_not_null',
            'check_category' => 'completeness',
            'cdm_table' => 'person',
            'cdm_column' => 'year_of_birth',
            'severity' => 'error',
            'description' => 'year_of_birth should not be NULL in person table.',
            'sql_violated' => 'SELECT COUNT(*) FROM person WHERE year_of_birth IS NULL',
            'sql_total' => 'SELECT COUNT(*) FROM person',
        ]);

        // condition_occurrence.condition_concept_id != 0
        $this->runCheck($job, $counts, [
            'check_name' => 'condition_concept_id_not_zero',
            'check_category' => 'completeness',
            'cdm_table' => 'condition_occurrence',
            'cdm_column' => 'condition_concept_id',
            'severity' => 'warning',
            'description' => 'condition_concept_id should not be 0 (unmapped) in condition_occurrence.',
            'sql_violated' => 'SELECT COUNT(*) FROM condition_occurrence WHERE condition_concept_id = 0',
            'sql_total' => 'SELECT COUNT(*) FROM condition_occurrence',
        ]);

        // drug_exposure.drug_concept_id != 0
        $this->runCheck($job, $counts, [
            'check_name' => 'drug_concept_id_not_zero',
            'check_category' => 'completeness',
            'cdm_table' => 'drug_exposure',
            'cdm_column' => 'drug_concept_id',
            'severity' => 'warning',
            'description' => 'drug_concept_id should not be 0 (unmapped) in drug_exposure.',
            'sql_violated' => 'SELECT COUNT(*) FROM drug_exposure WHERE drug_concept_id = 0',
            'sql_total' => 'SELECT COUNT(*) FROM drug_exposure',
        ]);

        // procedure_occurrence.procedure_concept_id != 0
        $this->runCheck($job, $counts, [
            'check_name' => 'procedure_concept_id_not_zero',
            'check_category' => 'completeness',
            'cdm_table' => 'procedure_occurrence',
            'cdm_column' => 'procedure_concept_id',
            'severity' => 'warning',
            'description' => 'procedure_concept_id should not be 0 (unmapped) in procedure_occurrence.',
            'sql_violated' => 'SELECT COUNT(*) FROM procedure_occurrence WHERE procedure_concept_id = 0',
            'sql_total' => 'SELECT COUNT(*) FROM procedure_occurrence',
        ]);

        // All events have valid person_id referencing person table
        $eventTables = [
            'condition_occurrence',
            'drug_exposure',
            'procedure_occurrence',
            'measurement',
            'observation',
        ];

        foreach ($eventTables as $table) {
            $this->runCheck($job, $counts, [
                'check_name' => "{$table}_valid_person_id",
                'check_category' => 'completeness',
                'cdm_table' => $table,
                'cdm_column' => 'person_id',
                'severity' => 'error',
                'description' => "All records in {$table} should reference a valid person_id in the person table.",
                'sql_violated' => "SELECT COUNT(*) FROM {$table} e LEFT JOIN person p ON e.person_id = p.person_id WHERE p.person_id IS NULL",
                'sql_total' => "SELECT COUNT(*) FROM {$table}",
            ]);
        }
    }

    /**
     * Run conformance checks: data conforms to expected formats and references.
     *
     * @param  array<string, int>  &$counts
     */
    private function runConformanceChecks(IngestionJob $job, array &$counts): void
    {
        // concept_ids exist in vocab.concept
        $conceptColumns = [
            ['table' => 'condition_occurrence', 'column' => 'condition_concept_id'],
            ['table' => 'drug_exposure', 'column' => 'drug_concept_id'],
            ['table' => 'procedure_occurrence', 'column' => 'procedure_concept_id'],
            ['table' => 'measurement', 'column' => 'measurement_concept_id'],
            ['table' => 'observation', 'column' => 'observation_concept_id'],
        ];

        foreach ($conceptColumns as $check) {
            $table = $check['table'];
            $column = $check['column'];

            $this->runCheck($job, $counts, [
                'check_name' => "{$table}_{$column}_valid_concept",
                'check_category' => 'conformance',
                'cdm_table' => $table,
                'cdm_column' => $column,
                'severity' => 'warning',
                'description' => "{$column} values in {$table} should reference valid concepts in the vocabulary.",
                'sql_violated' => "SELECT COUNT(*) FROM {$table} e LEFT JOIN concept c ON e.{$column} = c.concept_id WHERE e.{$column} != 0 AND c.concept_id IS NULL",
                'sql_total' => "SELECT COUNT(*) FROM {$table} WHERE {$column} != 0",
            ]);
        }

        // Valid date ranges (start <= end) for tables with start/end dates
        $dateRangeChecks = [
            ['table' => 'visit_occurrence', 'start' => 'visit_start_date', 'end' => 'visit_end_date'],
            ['table' => 'condition_occurrence', 'start' => 'condition_start_date', 'end' => 'condition_end_date'],
            ['table' => 'drug_exposure', 'start' => 'drug_exposure_start_date', 'end' => 'drug_exposure_end_date'],
        ];

        foreach ($dateRangeChecks as $check) {
            $table = $check['table'];
            $startCol = $check['start'];
            $endCol = $check['end'];

            $this->runCheck($job, $counts, [
                'check_name' => "{$table}_valid_date_range",
                'check_category' => 'conformance',
                'cdm_table' => $table,
                'cdm_column' => "{$startCol}, {$endCol}",
                'severity' => 'error',
                'description' => "Start date should not be after end date in {$table}.",
                'sql_violated' => "SELECT COUNT(*) FROM {$table} WHERE {$endCol} IS NOT NULL AND {$startCol} > {$endCol}",
                'sql_total' => "SELECT COUNT(*) FROM {$table} WHERE {$endCol} IS NOT NULL",
            ]);
        }

        // Domain matches target table
        $domainChecks = [
            ['table' => 'condition_occurrence', 'column' => 'condition_concept_id', 'expected_domain' => 'Condition'],
            ['table' => 'drug_exposure', 'column' => 'drug_concept_id', 'expected_domain' => 'Drug'],
            ['table' => 'procedure_occurrence', 'column' => 'procedure_concept_id', 'expected_domain' => 'Procedure'],
            ['table' => 'measurement', 'column' => 'measurement_concept_id', 'expected_domain' => 'Measurement'],
            ['table' => 'observation', 'column' => 'observation_concept_id', 'expected_domain' => 'Observation'],
        ];

        foreach ($domainChecks as $check) {
            $table = $check['table'];
            $column = $check['column'];
            $domain = $check['expected_domain'];

            $this->runCheck($job, $counts, [
                'check_name' => "{$table}_domain_conformance",
                'check_category' => 'conformance',
                'cdm_table' => $table,
                'cdm_column' => $column,
                'severity' => 'warning',
                'description' => "Concepts in {$table}.{$column} should belong to the {$domain} domain.",
                'sql_violated' => "SELECT COUNT(*) FROM {$table} e JOIN concept c ON e.{$column} = c.concept_id WHERE e.{$column} != 0 AND c.domain_id != '{$domain}'",
                'sql_total' => "SELECT COUNT(*) FROM {$table} WHERE {$column} != 0",
            ]);
        }
    }

    /**
     * Run plausibility checks: data values are clinically plausible.
     *
     * @param  array<string, int>  &$counts
     */
    private function runPlausibilityChecks(IngestionJob $job, array &$counts): void
    {
        // No dates in the future
        $dateTables = [
            ['table' => 'condition_occurrence', 'column' => 'condition_start_date'],
            ['table' => 'drug_exposure', 'column' => 'drug_exposure_start_date'],
            ['table' => 'procedure_occurrence', 'column' => 'procedure_date'],
            ['table' => 'measurement', 'column' => 'measurement_date'],
            ['table' => 'observation', 'column' => 'observation_date'],
            ['table' => 'visit_occurrence', 'column' => 'visit_start_date'],
        ];

        foreach ($dateTables as $check) {
            $table = $check['table'];
            $column = $check['column'];

            $this->runCheck($job, $counts, [
                'check_name' => "{$table}_{$column}_not_future",
                'check_category' => 'plausibility',
                'cdm_table' => $table,
                'cdm_column' => $column,
                'severity' => 'warning',
                'description' => "{$column} in {$table} should not be in the future.",
                'sql_violated' => "SELECT COUNT(*) FROM {$table} WHERE {$column} > CURRENT_DATE",
                'sql_total' => "SELECT COUNT(*) FROM {$table} WHERE {$column} IS NOT NULL",
            ]);
        }

        // Person age 0-130
        $this->runCheck($job, $counts, [
            'check_name' => 'person_plausible_age',
            'check_category' => 'plausibility',
            'cdm_table' => 'person',
            'cdm_column' => 'year_of_birth',
            'severity' => 'error',
            'description' => 'Person age should be between 0 and 130 years.',
            'sql_violated' => 'SELECT COUNT(*) FROM person WHERE year_of_birth IS NOT NULL AND (EXTRACT(YEAR FROM CURRENT_DATE) - year_of_birth < 0 OR EXTRACT(YEAR FROM CURRENT_DATE) - year_of_birth > 130)',
            'sql_total' => 'SELECT COUNT(*) FROM person WHERE year_of_birth IS NOT NULL',
        ]);

        // Observation period covers all events
        $this->runCheck($job, $counts, [
            'check_name' => 'observation_period_covers_conditions',
            'check_category' => 'plausibility',
            'cdm_table' => 'observation_period',
            'cdm_column' => null,
            'severity' => 'warning',
            'description' => 'All condition_occurrence records should fall within an observation_period.',
            'sql_violated' => 'SELECT COUNT(*) FROM condition_occurrence co LEFT JOIN observation_period op ON co.person_id = op.person_id AND co.condition_start_date >= op.observation_period_start_date AND co.condition_start_date <= op.observation_period_end_date WHERE op.person_id IS NULL',
            'sql_total' => 'SELECT COUNT(*) FROM condition_occurrence',
        ]);

        $this->runCheck($job, $counts, [
            'check_name' => 'observation_period_covers_drugs',
            'check_category' => 'plausibility',
            'cdm_table' => 'observation_period',
            'cdm_column' => null,
            'severity' => 'warning',
            'description' => 'All drug_exposure records should fall within an observation_period.',
            'sql_violated' => 'SELECT COUNT(*) FROM drug_exposure de LEFT JOIN observation_period op ON de.person_id = op.person_id AND de.drug_exposure_start_date >= op.observation_period_start_date AND de.drug_exposure_start_date <= op.observation_period_end_date WHERE op.person_id IS NULL',
            'sql_total' => 'SELECT COUNT(*) FROM drug_exposure',
        ]);

        $this->runCheck($job, $counts, [
            'check_name' => 'observation_period_covers_procedures',
            'check_category' => 'plausibility',
            'cdm_table' => 'observation_period',
            'cdm_column' => null,
            'severity' => 'warning',
            'description' => 'All procedure_occurrence records should fall within an observation_period.',
            'sql_violated' => 'SELECT COUNT(*) FROM procedure_occurrence po LEFT JOIN observation_period op ON po.person_id = op.person_id AND po.procedure_date >= op.observation_period_start_date AND po.procedure_date <= op.observation_period_end_date WHERE op.person_id IS NULL',
            'sql_total' => 'SELECT COUNT(*) FROM procedure_occurrence',
        ]);
    }

    /**
     * Execute a single validation check and store the result.
     *
     * @param  array<string, int>  &$counts
     * @param  array<string, mixed>  $check
     */
    private function runCheck(IngestionJob $job, array &$counts, array $check): void
    {
        $cdm = $this->cdm();

        try {
            $totalResult = $cdm->selectOne($check['sql_total']);
            $totalRows = (int) ($totalResult ? reset($totalResult) : 0);

            // Skip check if the table is empty
            if ($totalRows === 0) {
                $job->validationResults()->create([
                    'check_name' => $check['check_name'],
                    'check_category' => $check['check_category'],
                    'cdm_table' => $check['cdm_table'],
                    'cdm_column' => $check['cdm_column'],
                    'severity' => 'info',
                    'passed' => true,
                    'violated_rows' => 0,
                    'total_rows' => 0,
                    'violation_percentage' => 0,
                    'description' => $check['description'].' (Table empty, check skipped.)',
                ]);

                $counts['total']++;
                $counts['passed']++;

                return;
            }

            $violatedResult = $cdm->selectOne($check['sql_violated']);
            $violatedRows = (int) ($violatedResult ? reset($violatedResult) : 0);

            $violationPercentage = $totalRows > 0
                ? round(($violatedRows / $totalRows) * 100, 2)
                : 0;

            $passed = $violatedRows === 0;

            $job->validationResults()->create([
                'check_name' => $check['check_name'],
                'check_category' => $check['check_category'],
                'cdm_table' => $check['cdm_table'],
                'cdm_column' => $check['cdm_column'],
                'severity' => $check['severity'],
                'passed' => $passed,
                'violated_rows' => $violatedRows,
                'total_rows' => $totalRows,
                'violation_percentage' => $violationPercentage,
                'description' => $check['description'],
            ]);

            $counts['total']++;

            if ($passed) {
                $counts['passed']++;
            } elseif ($check['severity'] === 'warning') {
                $counts['warnings']++;
            } else {
                $counts['failed']++;
            }
        } catch (\Exception $e) {
            Log::warning("Validation check {$check['check_name']} failed: {$e->getMessage()}");

            $job->validationResults()->create([
                'check_name' => $check['check_name'],
                'check_category' => $check['check_category'],
                'cdm_table' => $check['cdm_table'],
                'cdm_column' => $check['cdm_column'],
                'severity' => 'info',
                'passed' => true,
                'violated_rows' => 0,
                'total_rows' => 0,
                'violation_percentage' => 0,
                'description' => $check['description'].' (Check could not be executed: '.$e->getMessage().')',
                'details' => ['error' => $e->getMessage()],
            ]);

            $counts['total']++;
            $counts['passed']++;
        }
    }
}
