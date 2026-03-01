<?php

namespace App\Services\Ingestion;

class CdmTableRegistry
{
    /**
     * Return the full CDM table registry with column definitions.
     *
     * @return array<string, array<string, array<string, mixed>>>
     */
    public static function tables(): array
    {
        return [
            'person' => [
                'person_id' => ['type' => 'bigint', 'required' => true, 'is_pk' => true],
                'gender_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'year_of_birth' => ['type' => 'integer', 'required' => true],
                'month_of_birth' => ['type' => 'integer', 'required' => false],
                'day_of_birth' => ['type' => 'integer', 'required' => false],
                'birth_datetime' => ['type' => 'timestamp', 'required' => false, 'is_date' => true],
                'race_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'ethnicity_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'location_id' => ['type' => 'bigint', 'required' => false],
                'provider_id' => ['type' => 'bigint', 'required' => false],
                'care_site_id' => ['type' => 'bigint', 'required' => false],
                'person_source_value' => ['type' => 'varchar', 'required' => false],
                'gender_source_value' => ['type' => 'varchar', 'required' => false],
                'gender_source_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'race_source_value' => ['type' => 'varchar', 'required' => false],
                'race_source_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'ethnicity_source_value' => ['type' => 'varchar', 'required' => false],
                'ethnicity_source_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
            ],
            'visit_occurrence' => [
                'visit_occurrence_id' => ['type' => 'bigint', 'required' => true, 'is_pk' => true],
                'person_id' => ['type' => 'bigint', 'required' => true],
                'visit_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'visit_start_date' => ['type' => 'date', 'required' => true, 'is_date' => true],
                'visit_start_datetime' => ['type' => 'timestamp', 'required' => false, 'is_date' => true],
                'visit_end_date' => ['type' => 'date', 'required' => true, 'is_date' => true],
                'visit_end_datetime' => ['type' => 'timestamp', 'required' => false, 'is_date' => true],
                'visit_type_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'provider_id' => ['type' => 'bigint', 'required' => false],
                'care_site_id' => ['type' => 'bigint', 'required' => false],
                'visit_source_value' => ['type' => 'varchar', 'required' => false],
                'visit_source_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'admitted_from_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'admitted_from_source_value' => ['type' => 'varchar', 'required' => false],
                'discharged_to_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'discharged_to_source_value' => ['type' => 'varchar', 'required' => false],
                'preceding_visit_occurrence_id' => ['type' => 'bigint', 'required' => false],
            ],
            'condition_occurrence' => [
                'condition_occurrence_id' => ['type' => 'bigint', 'required' => true, 'is_pk' => true],
                'person_id' => ['type' => 'bigint', 'required' => true],
                'condition_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'condition_start_date' => ['type' => 'date', 'required' => true, 'is_date' => true],
                'condition_start_datetime' => ['type' => 'timestamp', 'required' => false, 'is_date' => true],
                'condition_end_date' => ['type' => 'date', 'required' => false, 'is_date' => true],
                'condition_end_datetime' => ['type' => 'timestamp', 'required' => false, 'is_date' => true],
                'condition_type_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'condition_status_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'stop_reason' => ['type' => 'varchar', 'required' => false],
                'provider_id' => ['type' => 'bigint', 'required' => false],
                'visit_occurrence_id' => ['type' => 'bigint', 'required' => false],
                'visit_detail_id' => ['type' => 'bigint', 'required' => false],
                'condition_source_value' => ['type' => 'varchar', 'required' => false],
                'condition_source_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'condition_status_source_value' => ['type' => 'varchar', 'required' => false],
            ],
            'drug_exposure' => [
                'drug_exposure_id' => ['type' => 'bigint', 'required' => true, 'is_pk' => true],
                'person_id' => ['type' => 'bigint', 'required' => true],
                'drug_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'drug_exposure_start_date' => ['type' => 'date', 'required' => true, 'is_date' => true],
                'drug_exposure_start_datetime' => ['type' => 'timestamp', 'required' => false, 'is_date' => true],
                'drug_exposure_end_date' => ['type' => 'date', 'required' => true, 'is_date' => true],
                'drug_exposure_end_datetime' => ['type' => 'timestamp', 'required' => false, 'is_date' => true],
                'verbatim_end_date' => ['type' => 'date', 'required' => false, 'is_date' => true],
                'drug_type_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'stop_reason' => ['type' => 'varchar', 'required' => false],
                'refills' => ['type' => 'integer', 'required' => false],
                'quantity' => ['type' => 'numeric', 'required' => false],
                'days_supply' => ['type' => 'integer', 'required' => false],
                'sig' => ['type' => 'text', 'required' => false],
                'route_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'lot_number' => ['type' => 'varchar', 'required' => false],
                'provider_id' => ['type' => 'bigint', 'required' => false],
                'visit_occurrence_id' => ['type' => 'bigint', 'required' => false],
                'visit_detail_id' => ['type' => 'bigint', 'required' => false],
                'drug_source_value' => ['type' => 'varchar', 'required' => false],
                'drug_source_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'route_source_value' => ['type' => 'varchar', 'required' => false],
                'dose_unit_source_value' => ['type' => 'varchar', 'required' => false],
            ],
            'procedure_occurrence' => [
                'procedure_occurrence_id' => ['type' => 'bigint', 'required' => true, 'is_pk' => true],
                'person_id' => ['type' => 'bigint', 'required' => true],
                'procedure_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'procedure_date' => ['type' => 'date', 'required' => true, 'is_date' => true],
                'procedure_datetime' => ['type' => 'timestamp', 'required' => false, 'is_date' => true],
                'procedure_end_date' => ['type' => 'date', 'required' => false, 'is_date' => true],
                'procedure_end_datetime' => ['type' => 'timestamp', 'required' => false, 'is_date' => true],
                'procedure_type_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'modifier_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'quantity' => ['type' => 'integer', 'required' => false],
                'provider_id' => ['type' => 'bigint', 'required' => false],
                'visit_occurrence_id' => ['type' => 'bigint', 'required' => false],
                'visit_detail_id' => ['type' => 'bigint', 'required' => false],
                'procedure_source_value' => ['type' => 'varchar', 'required' => false],
                'procedure_source_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'modifier_source_value' => ['type' => 'varchar', 'required' => false],
            ],
            'measurement' => [
                'measurement_id' => ['type' => 'bigint', 'required' => true, 'is_pk' => true],
                'person_id' => ['type' => 'bigint', 'required' => true],
                'measurement_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'measurement_date' => ['type' => 'date', 'required' => true, 'is_date' => true],
                'measurement_datetime' => ['type' => 'timestamp', 'required' => false, 'is_date' => true],
                'measurement_time' => ['type' => 'varchar', 'required' => false],
                'measurement_type_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'operator_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'value_as_number' => ['type' => 'numeric', 'required' => false],
                'value_as_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'unit_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'range_low' => ['type' => 'numeric', 'required' => false],
                'range_high' => ['type' => 'numeric', 'required' => false],
                'provider_id' => ['type' => 'bigint', 'required' => false],
                'visit_occurrence_id' => ['type' => 'bigint', 'required' => false],
                'visit_detail_id' => ['type' => 'bigint', 'required' => false],
                'measurement_source_value' => ['type' => 'varchar', 'required' => false],
                'measurement_source_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'unit_source_value' => ['type' => 'varchar', 'required' => false],
                'unit_source_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'value_source_value' => ['type' => 'varchar', 'required' => false],
            ],
            'observation' => [
                'observation_id' => ['type' => 'bigint', 'required' => true, 'is_pk' => true],
                'person_id' => ['type' => 'bigint', 'required' => true],
                'observation_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'observation_date' => ['type' => 'date', 'required' => true, 'is_date' => true],
                'observation_datetime' => ['type' => 'timestamp', 'required' => false, 'is_date' => true],
                'observation_type_concept_id' => ['type' => 'integer', 'required' => true, 'is_concept_id' => true],
                'value_as_number' => ['type' => 'numeric', 'required' => false],
                'value_as_string' => ['type' => 'varchar', 'required' => false],
                'value_as_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'qualifier_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'unit_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'provider_id' => ['type' => 'bigint', 'required' => false],
                'visit_occurrence_id' => ['type' => 'bigint', 'required' => false],
                'visit_detail_id' => ['type' => 'bigint', 'required' => false],
                'observation_source_value' => ['type' => 'varchar', 'required' => false],
                'observation_source_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
                'unit_source_value' => ['type' => 'varchar', 'required' => false],
                'qualifier_source_value' => ['type' => 'varchar', 'required' => false],
                'value_source_value' => ['type' => 'varchar', 'required' => false],
                'observation_event_id' => ['type' => 'bigint', 'required' => false],
                'obs_event_field_concept_id' => ['type' => 'integer', 'required' => false, 'is_concept_id' => true],
            ],
        ];
    }

    /**
     * Get all CDM table names.
     *
     * @return list<string>
     */
    public static function tableNames(): array
    {
        return array_keys(static::tables());
    }

    /**
     * Get column names for a specific CDM table.
     *
     * @return list<string>
     */
    public static function columns(string $tableName): array
    {
        $tables = static::tables();

        if (! isset($tables[$tableName])) {
            return [];
        }

        return array_keys($tables[$tableName]);
    }
}
