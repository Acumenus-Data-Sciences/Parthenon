<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds the results.achilles_analysis table with the standard OHDSI Achilles
 * analysis catalog. This is infrastructure data required for the Achilles
 * Results Explorer to function — it maps analysis IDs to human-readable names,
 * stratum definitions, and categories.
 *
 * Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING.
 */
class AchillesAnalysisSeeder extends Seeder
{
    public function run(): void
    {
        $analyses = $this->getAnalysisCatalog();

        // Batch insert with conflict handling for idempotency
        $chunks = array_chunk($analyses, 100);
        foreach ($chunks as $chunk) {
            $values = [];
            $bindings = [];
            foreach ($chunk as $row) {
                $values[] = '(?, ?, ?, ?, ?, ?, ?, ?, ?)';
                $bindings = array_merge($bindings, [
                    $row[0], // analysis_id
                    $row[1], // analysis_name
                    $row[2], // stratum_1_name
                    $row[3], // stratum_2_name
                    $row[4], // stratum_3_name
                    $row[5], // stratum_4_name
                    $row[6], // stratum_5_name
                    $row[7], // analysis_type
                    $row[8], // category
                ]);
            }

            $sql = 'INSERT INTO achilles_analysis '
                .'(analysis_id, analysis_name, stratum_1_name, stratum_2_name, '
                .'stratum_3_name, stratum_4_name, stratum_5_name, analysis_type, category) '
                .'VALUES '.implode(', ', $values)
                .' ON CONFLICT (analysis_id) DO NOTHING';

            DB::connection('results')->statement($sql, $bindings);
        }

        $count = DB::connection('results')
            ->table('achilles_analysis')
            ->count();

        $this->command?->info("Achilles analysis catalog: {$count} definitions loaded.");
    }

    /**
     * Standard OHDSI Achilles analysis definitions.
     *
     * Format: [analysis_id, analysis_name, stratum_1, stratum_2, stratum_3, stratum_4, stratum_5, type, category]
     *
     * @return array<int, array{0: int, 1: string, 2: ?string, 3: ?string, 4: ?string, 5: ?string, 6: ?string, 7: ?string, 8: string}>
     */
    private function getAnalysisCatalog(): array
    {
        return [
            // ── Person / Demographics ──────────────────────────────────────
            [0, 'Number of persons', null, null, null, null, null, 'prevalence', 'Person'],
            [1, 'Number of persons', null, null, null, null, null, 'prevalence', 'Person'],
            [2, 'Number of persons by gender', 'gender_concept_id', null, null, null, null, 'prevalence', 'Person'],
            [3, 'Number of persons by year of birth', 'year_of_birth', null, null, null, null, 'prevalence', 'Person'],
            [4, 'Number of persons by race', 'race_concept_id', null, null, null, null, 'prevalence', 'Person'],
            [5, 'Number of persons by ethnicity', 'ethnicity_concept_id', null, null, null, null, 'prevalence', 'Person'],
            [7, 'Number of persons with invalid provider', null, null, null, null, null, 'prevalence', 'Person'],
            [8, 'Number of persons with invalid location', null, null, null, null, null, 'prevalence', 'Person'],
            [9, 'Number of persons with invalid care site', null, null, null, null, null, 'prevalence', 'Person'],
            [10, 'Number of persons by year of birth by gender', 'year_of_birth', 'gender_concept_id', null, null, null, 'prevalence', 'Person'],
            [11, 'Number of non-deceased persons with no observation period', null, null, null, null, null, 'prevalence', 'Person'],
            [12, 'Number of persons by race and ethnicity', 'race_concept_id', 'ethnicity_concept_id', null, null, null, 'prevalence', 'Person'],

            // ── Observation Period ─────────────────────────────────────────
            [101, 'Number of observation period records', null, null, null, null, null, 'prevalence', 'Observation Period'],
            [102, 'Number of persons by gender with observation period', 'gender_concept_id', null, null, null, null, 'prevalence', 'Observation Period'],
            [103, 'Distribution of observation period length', null, null, null, null, null, 'distribution', 'Observation Period'],
            [104, 'Distribution of observation period start year', null, null, null, null, null, 'distribution', 'Observation Period'],
            [105, 'Length of observation (days) of first observation period', null, null, null, null, null, 'distribution', 'Observation Period'],
            [106, 'Number of persons with observation period end by month', 'calendar_month', null, null, null, null, 'prevalence', 'Observation Period'],
            [107, 'Number of observation period records with invalid person', null, null, null, null, null, 'prevalence', 'Observation Period'],
            [108, 'Number of persons by number of observation periods', 'number_of_observation_periods', null, null, null, null, 'prevalence', 'Observation Period'],
            [109, 'Number of persons with continuous observation in each year', 'calendar_year', null, null, null, null, 'prevalence', 'Observation Period'],
            [110, 'Number of persons with observation period before year-of-birth', null, null, null, null, null, 'prevalence', 'Observation Period'],
            [111, 'Number of persons by observation period start month', 'calendar_month', null, null, null, null, 'prevalence', 'Observation Period'],
            [112, 'Number of persons by observation period end month', 'calendar_month', null, null, null, null, 'prevalence', 'Observation Period'],
            [113, 'Distribution of age at first observation period', null, null, null, null, null, 'distribution', 'Observation Period'],
            [114, 'Distribution of age at last observation period', null, null, null, null, null, 'distribution', 'Observation Period'],
            [115, 'Number of persons by observation period start year', 'calendar_year', null, null, null, null, 'prevalence', 'Observation Period'],
            [116, 'Number of persons by observation period end year', 'calendar_year', null, null, null, null, 'prevalence', 'Observation Period'],
            [117, 'Number of observation periods by duration', 'observation_period_duration', null, null, null, null, 'prevalence', 'Observation Period'],

            // ── Visit Occurrence ───────────────────────────────────────────
            [200, 'Number of visit occurrence records by visit_concept_id', 'visit_concept_id', null, null, null, null, 'prevalence', 'Visit'],
            [201, 'Number of visit occurrence records by visit type', 'visit_concept_id', 'visit_type_concept_id', null, null, null, 'prevalence', 'Visit'],
            [202, 'Number of persons by visit type by gender', 'visit_concept_id', 'gender_concept_id', null, null, null, 'prevalence', 'Visit'],
            [203, 'Number of distinct visit concepts per person', null, null, null, null, null, 'distribution', 'Visit'],
            [204, 'Distribution of age at visit occurrence', 'visit_concept_id', null, null, null, null, 'distribution', 'Visit'],
            [206, 'Distribution of visit occurrence duration by visit_concept_id', 'visit_concept_id', null, null, null, null, 'distribution', 'Visit'],
            [207, 'Number of visit records with invalid person', null, null, null, null, null, 'prevalence', 'Visit'],
            [208, 'Number of visit records outside observation period', null, null, null, null, null, 'prevalence', 'Visit'],
            [209, 'Number of visit records with end before start', null, null, null, null, null, 'prevalence', 'Visit'],
            [210, 'Number of visit records per person', null, null, null, null, null, 'distribution', 'Visit'],
            [211, 'Number of visit records by visit start month', 'visit_concept_id', 'calendar_month', null, null, null, 'prevalence', 'Visit'],
            [212, 'Number of visit records by visit end month', 'visit_concept_id', 'calendar_month', null, null, null, 'prevalence', 'Visit'],
            [220, 'Number of visit records by visit concept and year', 'visit_concept_id', 'calendar_year', null, null, null, 'prevalence', 'Visit'],

            // ── Condition Occurrence ───────────────────────────────────────
            [400, 'Number of condition occurrence records by condition_concept_id', 'condition_concept_id', null, null, null, null, 'prevalence', 'Condition'],
            [401, 'Number of condition occurrence records by condition type', 'condition_concept_id', 'condition_type_concept_id', null, null, null, 'prevalence', 'Condition'],
            [402, 'Number of persons by condition by gender', 'condition_concept_id', 'gender_concept_id', null, null, null, 'prevalence', 'Condition'],
            [403, 'Number of distinct condition occurrence concepts per person', null, null, null, null, null, 'distribution', 'Condition'],
            [404, 'Distribution of age at condition occurrence', 'condition_concept_id', null, null, null, null, 'distribution', 'Condition'],
            [405, 'Number of condition occurrence records by age decile', 'condition_concept_id', 'age_decile', null, null, null, 'prevalence', 'Condition'],
            [406, 'Number of condition occurrence records with invalid person', null, null, null, null, null, 'prevalence', 'Condition'],
            [409, 'Number of condition occurrence records with end before start', null, null, null, null, null, 'prevalence', 'Condition'],
            [410, 'Number of condition records per person', null, null, null, null, null, 'distribution', 'Condition'],
            [411, 'Number of condition records by concept and month', 'condition_concept_id', 'calendar_month', null, null, null, 'prevalence', 'Condition'],
            [412, 'Number of condition records by concept and year', 'condition_concept_id', 'calendar_year', null, null, null, 'prevalence', 'Condition'],
            [413, 'Number of condition records by condition status', 'condition_concept_id', 'condition_status_concept_id', null, null, null, 'prevalence', 'Condition'],

            // ── Death ─────────────────────────────────────────────────────
            [500, 'Number of death records', null, null, null, null, null, 'prevalence', 'Death'],
            [501, 'Number of death records by cause of death', 'cause_concept_id', null, null, null, null, 'prevalence', 'Death'],
            [502, 'Number of persons by death month', 'calendar_month', null, null, null, null, 'prevalence', 'Death'],
            [504, 'Distribution of age at death', null, null, null, null, null, 'distribution', 'Death'],
            [505, 'Number of death records by death type', 'death_type_concept_id', null, null, null, null, 'prevalence', 'Death'],
            [506, 'Number of death records with invalid person', null, null, null, null, null, 'prevalence', 'Death'],

            // ── Procedure Occurrence ──────────────────────────────────────
            [600, 'Number of procedure occurrence records by procedure_concept_id', 'procedure_concept_id', null, null, null, null, 'prevalence', 'Procedure'],
            [601, 'Number of procedure records by procedure type', 'procedure_concept_id', 'procedure_type_concept_id', null, null, null, 'prevalence', 'Procedure'],
            [602, 'Number of persons by procedure by gender', 'procedure_concept_id', 'gender_concept_id', null, null, null, 'prevalence', 'Procedure'],
            [603, 'Number of distinct procedure concepts per person', null, null, null, null, null, 'distribution', 'Procedure'],
            [604, 'Distribution of age at procedure occurrence', 'procedure_concept_id', null, null, null, null, 'distribution', 'Procedure'],
            [605, 'Number of procedure records by age decile', 'procedure_concept_id', 'age_decile', null, null, null, 'prevalence', 'Procedure'],
            [606, 'Number of procedure records with invalid person', null, null, null, null, null, 'prevalence', 'Procedure'],
            [609, 'Number of procedure records outside observation period', null, null, null, null, null, 'prevalence', 'Procedure'],
            [610, 'Number of procedure records per person', null, null, null, null, null, 'distribution', 'Procedure'],
            [611, 'Number of procedure records by concept and month', 'procedure_concept_id', 'calendar_month', null, null, null, 'prevalence', 'Procedure'],
            [612, 'Number of procedure records by concept and year', 'procedure_concept_id', 'calendar_year', null, null, null, 'prevalence', 'Procedure'],

            // ── Drug Exposure ─────────────────────────────────────────────
            [700, 'Number of drug exposure records by drug_concept_id', 'drug_concept_id', null, null, null, null, 'prevalence', 'Drug'],
            [701, 'Number of drug records by drug type', 'drug_concept_id', 'drug_type_concept_id', null, null, null, 'prevalence', 'Drug'],
            [702, 'Number of persons by drug by gender', 'drug_concept_id', 'gender_concept_id', null, null, null, 'prevalence', 'Drug'],
            [703, 'Number of distinct drug concepts per person', null, null, null, null, null, 'distribution', 'Drug'],
            [704, 'Distribution of age at drug exposure', 'drug_concept_id', null, null, null, null, 'distribution', 'Drug'],
            [705, 'Number of drug exposure records by age decile', 'drug_concept_id', 'age_decile', null, null, null, 'prevalence', 'Drug'],
            [706, 'Number of drug records with invalid person', null, null, null, null, null, 'prevalence', 'Drug'],
            [709, 'Number of drug records outside observation period', null, null, null, null, null, 'prevalence', 'Drug'],
            [710, 'Number of drug records per person', null, null, null, null, null, 'distribution', 'Drug'],
            [711, 'Number of drug records by concept and month', 'drug_concept_id', 'calendar_month', null, null, null, 'prevalence', 'Drug'],
            [712, 'Number of drug records by concept and year', 'drug_concept_id', 'calendar_year', null, null, null, 'prevalence', 'Drug'],
            [715, 'Distribution of days supply', 'drug_concept_id', null, null, null, null, 'distribution', 'Drug'],
            [716, 'Distribution of refills', 'drug_concept_id', null, null, null, null, 'distribution', 'Drug'],
            [717, 'Distribution of quantity', 'drug_concept_id', null, null, null, null, 'distribution', 'Drug'],

            // ── Observation ───────────────────────────────────────────────
            [800, 'Number of observation records by observation_concept_id', 'observation_concept_id', null, null, null, null, 'prevalence', 'Observation'],
            [801, 'Number of observation records by observation type', 'observation_concept_id', 'observation_type_concept_id', null, null, null, 'prevalence', 'Observation'],
            [802, 'Number of persons by observation by gender', 'observation_concept_id', 'gender_concept_id', null, null, null, 'prevalence', 'Observation'],
            [803, 'Number of distinct observation concepts per person', null, null, null, null, null, 'distribution', 'Observation'],
            [804, 'Distribution of age at observation', 'observation_concept_id', null, null, null, null, 'distribution', 'Observation'],
            [805, 'Number of observation records by age decile', 'observation_concept_id', 'age_decile', null, null, null, 'prevalence', 'Observation'],
            [806, 'Number of observation records with invalid person', null, null, null, null, null, 'prevalence', 'Observation'],
            [809, 'Number of observation records outside observation period', null, null, null, null, null, 'prevalence', 'Observation'],
            [810, 'Number of observation records per person', null, null, null, null, null, 'distribution', 'Observation'],
            [811, 'Number of observation records by concept and month', 'observation_concept_id', 'calendar_month', null, null, null, 'prevalence', 'Observation'],
            [812, 'Number of observation records by concept and year', 'observation_concept_id', 'calendar_year', null, null, null, 'prevalence', 'Observation'],

            // ── Drug Era ──────────────────────────────────────────────────
            [900, 'Number of drug era records by drug_concept_id', 'drug_concept_id', null, null, null, null, 'prevalence', 'Drug Era'],
            [901, 'Number of persons by drug era concept by age decile', 'drug_concept_id', 'age_decile', null, null, null, 'prevalence', 'Drug Era'],
            [902, 'Number of persons by drug era concept by gender', 'drug_concept_id', 'gender_concept_id', null, null, null, 'prevalence', 'Drug Era'],
            [907, 'Distribution of drug era length by drug concept', 'drug_concept_id', null, null, null, null, 'distribution', 'Drug Era'],
            [908, 'Number of drug eras without valid person', null, null, null, null, null, 'prevalence', 'Drug Era'],

            // ── Condition Era ─────────────────────────────────────────────
            [1000, 'Number of condition era records by condition_concept_id', 'condition_concept_id', null, null, null, null, 'prevalence', 'Condition Era'],
            [1001, 'Number of persons by condition era concept by age decile', 'condition_concept_id', 'age_decile', null, null, null, 'prevalence', 'Condition Era'],
            [1002, 'Number of persons by condition era concept by gender', 'condition_concept_id', 'gender_concept_id', null, null, null, 'prevalence', 'Condition Era'],
            [1007, 'Distribution of condition era length by condition concept', 'condition_concept_id', null, null, null, null, 'distribution', 'Condition Era'],
            [1008, 'Number of condition eras without valid person', null, null, null, null, null, 'prevalence', 'Condition Era'],

            // ── Location ──────────────────────────────────────────────────
            [1100, 'Number of persons by location', 'location_id', null, null, null, null, 'prevalence', 'Location'],
            [1101, 'Number of persons by location state', 'state', null, null, null, null, 'prevalence', 'Location'],

            // ── Care Site ─────────────────────────────────────────────────
            [1200, 'Number of persons by place of service', 'place_of_service_concept_id', null, null, null, null, 'prevalence', 'Care Site'],
            [1201, 'Number of visit occurrences by place of service', 'place_of_service_concept_id', null, null, null, null, 'prevalence', 'Care Site'],

            // ── Payer Plan Period ─────────────────────────────────────────
            [1600, 'Number of payer plan period records', null, null, null, null, null, 'prevalence', 'Payer Plan'],
            [1601, 'Number of payer plan period records by payer concept', 'payer_concept_id', null, null, null, null, 'prevalence', 'Payer Plan'],
            [1603, 'Number of distinct payer plan concepts per person', null, null, null, null, null, 'distribution', 'Payer Plan'],
            [1606, 'Distribution of payer plan period length', null, null, null, null, null, 'distribution', 'Payer Plan'],

            // ── Cost ──────────────────────────────────────────────────────
            [1700, 'Number of cost records', null, null, null, null, null, 'prevalence', 'Cost'],
            [1701, 'Number of cost records by currency', 'currency_concept_id', null, null, null, null, 'prevalence', 'Cost'],

            // ── Measurement ───────────────────────────────────────────────
            [1800, 'Number of measurement records by measurement_concept_id', 'measurement_concept_id', null, null, null, null, 'prevalence', 'Measurement'],
            [1801, 'Number of measurement records by measurement type', 'measurement_concept_id', 'measurement_type_concept_id', null, null, null, 'prevalence', 'Measurement'],
            [1802, 'Number of persons by measurement by gender', 'measurement_concept_id', 'gender_concept_id', null, null, null, 'prevalence', 'Measurement'],
            [1803, 'Number of distinct measurement concepts per person', null, null, null, null, null, 'distribution', 'Measurement'],
            [1804, 'Distribution of age at measurement', 'measurement_concept_id', null, null, null, null, 'distribution', 'Measurement'],
            [1805, 'Number of measurement records by age decile', 'measurement_concept_id', 'age_decile', null, null, null, 'prevalence', 'Measurement'],
            [1806, 'Number of measurement records with invalid person', null, null, null, null, null, 'prevalence', 'Measurement'],
            [1807, 'Distribution of measurement value as number', 'measurement_concept_id', null, null, null, null, 'distribution', 'Measurement'],
            [1809, 'Number of measurement records outside observation period', null, null, null, null, null, 'prevalence', 'Measurement'],
            [1810, 'Number of measurement records per person', null, null, null, null, null, 'distribution', 'Measurement'],
            [1811, 'Number of measurement records by concept and month', 'measurement_concept_id', 'calendar_month', null, null, null, 'prevalence', 'Measurement'],
            [1812, 'Number of measurement records by concept and year', 'measurement_concept_id', 'calendar_year', null, null, null, 'prevalence', 'Measurement'],
            [1813, 'Distribution of measurement value as number by unit', 'measurement_concept_id', 'unit_concept_id', null, null, null, 'distribution', 'Measurement'],
            [1814, 'Number of measurement records with abnormal value', 'measurement_concept_id', null, null, null, null, 'prevalence', 'Measurement'],
            [1815, 'Distribution of numeric values by measurement concept', 'measurement_concept_id', null, null, null, null, 'distribution', 'Measurement'],

            // ── Device Exposure ───────────────────────────────────────────
            [2100, 'Number of device exposure records by device_concept_id', 'device_concept_id', null, null, null, null, 'prevalence', 'Device'],
            [2101, 'Number of device records by device type', 'device_concept_id', 'device_type_concept_id', null, null, null, 'prevalence', 'Device'],
            [2102, 'Number of persons by device by gender', 'device_concept_id', 'gender_concept_id', null, null, null, 'prevalence', 'Device'],
            [2104, 'Distribution of age at device exposure', 'device_concept_id', null, null, null, null, 'distribution', 'Device'],
            [2105, 'Number of device records by age decile', 'device_concept_id', 'age_decile', null, null, null, 'prevalence', 'Device'],
            [2110, 'Number of device records per person', null, null, null, null, null, 'distribution', 'Device'],
            [2111, 'Number of device records by concept and month', 'device_concept_id', 'calendar_month', null, null, null, 'prevalence', 'Device'],

            // ── Note ──────────────────────────────────────────────────────
            [2200, 'Number of note records', null, null, null, null, null, 'prevalence', 'Note'],
            [2201, 'Number of note records by note type', 'note_type_concept_id', null, null, null, null, 'prevalence', 'Note'],

            // ── Specimen ──────────────────────────────────────────────────
            [2300, 'Number of specimen records', null, null, null, null, null, 'prevalence', 'Specimen'],
            [2301, 'Number of specimen records by specimen concept', 'specimen_concept_id', null, null, null, null, 'prevalence', 'Specimen'],

            // ── Data Density / Completeness ───────────────────────────────
            [2000, 'Number of persons with at least one visit', null, null, null, null, null, 'prevalence', 'Completeness'],
            [2001, 'Number of raw records by domain', 'table_name', null, null, null, null, 'prevalence', 'Completeness'],
            [2002, 'Number of persons by number of records', 'table_name', null, null, null, null, 'prevalence', 'Completeness'],
            [2003, 'Number of distinct concepts per person by domain', 'table_name', null, null, null, null, 'distribution', 'Completeness'],
            [2004, 'Records per person over time', 'table_name', 'calendar_month', null, null, null, 'prevalence', 'Completeness'],

            // ── Visit Detail ──────────────────────────────────────────────
            [2400, 'Number of visit detail records by visit_detail_concept_id', 'visit_detail_concept_id', null, null, null, null, 'prevalence', 'Visit Detail'],
            [2401, 'Number of visit detail records by visit detail type', 'visit_detail_concept_id', 'visit_detail_type_concept_id', null, null, null, 'prevalence', 'Visit Detail'],
        ];
    }
}
