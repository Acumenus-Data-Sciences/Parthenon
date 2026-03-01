<?php

namespace App\Services\Ingestion;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ObservationPeriodCalculator
{
    /**
     * Event tables and their date columns to scan for observation period boundaries.
     *
     * @var array<string, array{start: string, end: string}>
     */
    private const EVENT_TABLES = [
        'visit_occurrence' => ['start' => 'visit_start_date', 'end' => 'visit_end_date'],
        'condition_occurrence' => ['start' => 'condition_start_date', 'end' => 'condition_end_date'],
        'drug_exposure' => ['start' => 'drug_exposure_start_date', 'end' => 'drug_exposure_end_date'],
        'procedure_occurrence' => ['start' => 'procedure_date', 'end' => 'procedure_end_date'],
        'measurement' => ['start' => 'measurement_date', 'end' => 'measurement_date'],
        'observation' => ['start' => 'observation_date', 'end' => 'observation_date'],
    ];

    /**
     * OMOP type concept ID for "Period covering healthcare encounters" (32880).
     */
    private const PERIOD_TYPE_CONCEPT_ID = 32880;

    /**
     * Calculate and insert observation periods for all persons in CDM.
     *
     * For each person, finds the minimum start date and maximum end date
     * across all event tables, then inserts into observation_period.
     *
     * @return int Number of observation periods created.
     */
    public function calculate(): int
    {
        $cdm = DB::connection('cdm');

        // Build a UNION query to get min/max dates across all event tables per person
        $unionParts = [];

        foreach (self::EVENT_TABLES as $table => $dateColumns) {
            $startCol = $dateColumns['start'];
            $endCol = $dateColumns['end'];

            // Check if the table has any rows
            $exists = $cdm->table($table)->exists();

            if (! $exists) {
                continue;
            }

            $unionParts[] = "SELECT person_id, {$startCol} AS event_date FROM {$table} WHERE {$startCol} IS NOT NULL";

            if ($startCol !== $endCol) {
                $unionParts[] = "SELECT person_id, {$endCol} AS event_date FROM {$table} WHERE {$endCol} IS NOT NULL";
            }
        }

        if (empty($unionParts)) {
            Log::info('No event tables with data found for observation period calculation.');

            return 0;
        }

        $unionSql = implode(' UNION ALL ', $unionParts);

        $sql = '
            INSERT INTO observation_period (person_id, observation_period_start_date, observation_period_end_date, period_type_concept_id)
            SELECT
                person_id,
                MIN(event_date) AS observation_period_start_date,
                MAX(event_date) AS observation_period_end_date,
                '.self::PERIOD_TYPE_CONCEPT_ID." AS period_type_concept_id
            FROM ({$unionSql}) AS all_events
            GROUP BY person_id
        ";

        // Clear existing observation periods before recalculating
        $cdm->table('observation_period')->truncate();

        $inserted = $cdm->statement($sql);

        $count = $cdm->table('observation_period')->count();

        Log::info("Calculated {$count} observation periods.");

        return $count;
    }
}
