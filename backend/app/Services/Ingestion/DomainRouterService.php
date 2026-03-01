<?php

namespace App\Services\Ingestion;

class DomainRouterService
{
    /**
     * Map from concept domain_id to CDM target table.
     *
     * @var array<string, string>
     */
    private const DOMAIN_TABLE_MAP = [
        'Condition' => 'condition_occurrence',
        'Drug' => 'drug_exposure',
        'Procedure' => 'procedure_occurrence',
        'Measurement' => 'measurement',
        'Observation' => 'observation',
        'Device' => 'device_exposure',
        'Specimen' => 'specimen',
    ];

    /**
     * Get the CDM table name for a given domain_id.
     */
    public function getTable(string $domainId): ?string
    {
        return self::DOMAIN_TABLE_MAP[$domainId] ?? null;
    }

    /**
     * Get the full domain-to-table mapping.
     *
     * @return array<string, string>
     */
    public function getMap(): array
    {
        return self::DOMAIN_TABLE_MAP;
    }

    /**
     * Check if a domain_id is supported.
     */
    public function isSupported(string $domainId): bool
    {
        return isset(self::DOMAIN_TABLE_MAP[$domainId]);
    }

    /**
     * Get the concept column prefix for a CDM table.
     *
     * For example, condition_occurrence uses "condition" as the prefix,
     * producing condition_concept_id, condition_source_concept_id, and
     * condition_source_value.
     */
    public function getConceptPrefix(string $tableName): ?string
    {
        $prefixMap = [
            'condition_occurrence' => 'condition',
            'drug_exposure' => 'drug',
            'procedure_occurrence' => 'procedure',
            'measurement' => 'measurement',
            'observation' => 'observation',
            'device_exposure' => 'device',
            'specimen' => 'specimen',
        ];

        return $prefixMap[$tableName] ?? null;
    }
}
