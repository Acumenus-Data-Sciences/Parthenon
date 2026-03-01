<?php

declare(strict_types=1);

namespace App\Services\Ingestion;

use Illuminate\Support\Collection;
use RuntimeException;

class FhirParserService
{
    /**
     * Supported FHIR R4 resource types for CDM mapping.
     */
    private const SUPPORTED_RESOURCES = [
        'Patient',
        'Encounter',
        'Condition',
        'MedicationRequest',
        'MedicationStatement',
        'Procedure',
        'Observation',
        'DiagnosticReport',
        'Immunization',
        'Claim',
    ];

    public function parseBundle(string $filePath): array
    {
        $content = file_get_contents($filePath);
        if ($content === false) {
            throw new RuntimeException("Cannot read FHIR file: {$filePath}");
        }

        $bundle = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException('Invalid JSON: '.json_last_error_msg());
        }

        if (($bundle['resourceType'] ?? null) !== 'Bundle') {
            throw new RuntimeException('FHIR resource is not a Bundle');
        }

        return $bundle;
    }

    public function extractResources(array $bundle): Collection
    {
        $entries = $bundle['entry'] ?? [];

        return collect($entries)
            ->map(fn (array $entry) => $entry['resource'] ?? null)
            ->filter()
            ->filter(fn (array $resource) => in_array($resource['resourceType'] ?? '', self::SUPPORTED_RESOURCES, true))
            ->groupBy(fn (array $resource) => $resource['resourceType']);
    }

    public function getResourceCount(array $bundle): array
    {
        $entries = $bundle['entry'] ?? [];

        return collect($entries)
            ->map(fn (array $entry) => ($entry['resource'] ?? [])['resourceType'] ?? 'Unknown')
            ->countBy()
            ->sortDesc()
            ->toArray();
    }

    public function extractCodeSystems(array $bundle): array
    {
        $entries = $bundle['entry'] ?? [];
        $codeSystems = [];

        foreach ($entries as $entry) {
            $resource = $entry['resource'] ?? [];
            $this->collectCodeSystems($resource, $codeSystems);
        }

        return $codeSystems;
    }

    private function collectCodeSystems(array $data, array &$codeSystems): void
    {
        if (isset($data['system'])) {
            $system = $data['system'];
            $codeSystems[$system] = ($codeSystems[$system] ?? 0) + 1;
        }

        if (isset($data['coding']) && is_array($data['coding'])) {
            foreach ($data['coding'] as $coding) {
                if (isset($coding['system'])) {
                    $system = $coding['system'];
                    $codeSystems[$system] = ($codeSystems[$system] ?? 0) + 1;
                }
            }
        }

        foreach ($data as $value) {
            if (is_array($value)) {
                $this->collectCodeSystems($value, $codeSystems);
            }
        }
    }
}
