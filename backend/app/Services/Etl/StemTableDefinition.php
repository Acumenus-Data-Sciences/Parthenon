<?php

namespace App\Services\Etl;

class StemTableDefinition
{
    /**
     * Stem table columns — union of all clinical event tables.
     * When a source table maps through the stem, records are routed
     * to the final CDM table based on the concept's domain_id.
     *
     * @return list<array{name: string, type: string, description: string}>
     */
    public static function columns(): array
    {
        return [
            ['name' => 'domain_id', 'type' => 'varchar', 'description' => 'Domain that determines target CDM table'],
            ['name' => 'person_id', 'type' => 'integer', 'description' => 'FK to person'],
            ['name' => 'concept_id', 'type' => 'integer', 'description' => 'Standard concept ID'],
            ['name' => 'start_date', 'type' => 'date', 'description' => 'Event start date'],
            ['name' => 'start_datetime', 'type' => 'timestamp', 'description' => 'Event start datetime'],
            ['name' => 'end_date', 'type' => 'date', 'description' => 'Event end date'],
            ['name' => 'end_datetime', 'type' => 'timestamp', 'description' => 'Event end datetime'],
            ['name' => 'type_concept_id', 'type' => 'integer', 'description' => 'Type concept (e.g., EHR, claim)'],
            ['name' => 'visit_occurrence_id', 'type' => 'integer', 'description' => 'FK to visit_occurrence'],
            ['name' => 'source_value', 'type' => 'varchar', 'description' => 'Original source code/value'],
            ['name' => 'source_concept_id', 'type' => 'integer', 'description' => 'Source concept ID (before mapping)'],
            ['name' => 'value_as_number', 'type' => 'numeric', 'description' => 'Numeric result value'],
            ['name' => 'value_as_string', 'type' => 'varchar', 'description' => 'String result value'],
            ['name' => 'value_as_concept_id', 'type' => 'integer', 'description' => 'Concept result value'],
            ['name' => 'unit_concept_id', 'type' => 'integer', 'description' => 'Unit of measurement concept'],
            ['name' => 'unit_source_value', 'type' => 'varchar', 'description' => 'Original unit string'],
            ['name' => 'quantity', 'type' => 'numeric', 'description' => 'Quantity/dose'],
            ['name' => 'range_low', 'type' => 'numeric', 'description' => 'Normal range low'],
            ['name' => 'range_high', 'type' => 'numeric', 'description' => 'Normal range high'],
            ['name' => 'operator_concept_id', 'type' => 'integer', 'description' => 'Operator (=, <, >, etc.)'],
            ['name' => 'provider_id', 'type' => 'integer', 'description' => 'FK to provider'],
            ['name' => 'route_concept_id', 'type' => 'integer', 'description' => 'Route of administration'],
            ['name' => 'route_source_value', 'type' => 'varchar', 'description' => 'Original route string'],
            ['name' => 'dose_unit_source_value', 'type' => 'varchar', 'description' => 'Original dose unit string'],
            ['name' => 'stop_reason', 'type' => 'varchar', 'description' => 'Reason for stopping'],
            ['name' => 'modifier_concept_id', 'type' => 'integer', 'description' => 'Modifier concept'],
            ['name' => 'modifier_source_value', 'type' => 'varchar', 'description' => 'Original modifier string'],
            ['name' => 'qualifier_concept_id', 'type' => 'integer', 'description' => 'Qualifier concept'],
            ['name' => 'qualifier_source_value', 'type' => 'varchar', 'description' => 'Original qualifier string'],
        ];
    }

    /**
     * Default domain routing rules.
     * Maps domain_id values to CDM target tables.
     *
     * @return array<string, string>
     */
    public static function domainRouting(): array
    {
        return [
            'Condition' => 'condition_occurrence',
            'Drug' => 'drug_exposure',
            'Procedure' => 'procedure_occurrence',
            'Measurement' => 'measurement',
            'Observation' => 'observation',
            'Device' => 'device_exposure',
            'Specimen' => 'specimen',
            'Note' => 'note',
        ];
    }
}
