<?php

namespace App\Services\Aqueduct;

class AqueductService
{
    public function __construct(
        private readonly AqueductLookupGeneratorService $lookups,
    ) {}

    public function lookups(): AqueductLookupGeneratorService
    {
        return $this->lookups;
    }

    /** @return array<string, mixed> */
    public function serviceEntry(): array
    {
        return [
            'name' => 'etl_mapping_workbench',
            'endpoint' => '/flows/etl-mapping',
            'description' => 'Visual source-to-CDM mapping with concept matching and vocabulary lookup generation.',
            'mcp_tools' => ['etl_mapping_workbench_catalog'],
            'input' => ['source_key', 'scan_report', 'mapping_config', 'source_codes_csv', 'vocabulary_filters'],
            'output' => ['mapping_summary', 'concept_matches', 'lookup_sql', 'etl_archive'],
            'validation' => [
                'registration gated by ETL_MAPPING_WORKBENCH_ENABLED',
                'writes require explicit confirmation before execution tools are added',
            ],
            'ui_hints' => [
                'title' => 'Aqueduct',
                'summary' => 'Design and validate ETL mappings from source data to OMOP CDM.',
                'accent' => 'teal',
                'repository' => null,
                'workspace' => 'etl-workbench',
            ],
            'implemented' => true,
            'source' => 'parthenon',
        ];
    }
}
