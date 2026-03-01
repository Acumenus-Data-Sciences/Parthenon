<?php

declare(strict_types=1);

namespace App\Services\Ingestion;

class FhirProfilerService
{
    public function __construct(
        private readonly FhirParserService $parser,
    ) {}

    public function profile(string $filePath): array
    {
        $bundle = $this->parser->parseBundle($filePath);
        $resources = $this->parser->extractResources($bundle);

        $resourceCounts = $this->parser->getResourceCount($bundle);
        $codeSystems = $this->parser->extractCodeSystems($bundle);

        $totalEntries = count($bundle['entry'] ?? []);
        $supportedCount = $resources->flatten(1)->count();

        $samplesByType = [];
        foreach ($resources as $type => $typeResources) {
            $samplesByType[$type] = $typeResources->take(3)->map(function (array $resource) {
                // Return a summary of each sample resource
                $summary = ['resourceType' => $resource['resourceType']];
                if (isset($resource['id'])) {
                    $summary['id'] = $resource['id'];
                }
                if (isset($resource['code'])) {
                    $summary['code'] = $this->summarizeCode($resource['code']);
                }
                if (isset($resource['vaccineCode'])) {
                    $summary['vaccineCode'] = $this->summarizeCode($resource['vaccineCode']);
                }

                return $summary;
            })->toArray();
        }

        return [
            'file_format' => 'fhir_bundle',
            'bundle_type' => $bundle['type'] ?? 'unknown',
            'total_entries' => $totalEntries,
            'supported_entries' => $supportedCount,
            'unsupported_entries' => $totalEntries - $supportedCount,
            'resource_counts' => $resourceCounts,
            'code_systems' => $codeSystems,
            'samples_by_type' => $samplesByType,
        ];
    }

    private function summarizeCode(array $codeableConcept): ?string
    {
        $coding = $codeableConcept['coding'][0] ?? null;
        if ($coding) {
            return ($coding['system'] ?? '').'|'.($coding['code'] ?? '').' ('.($coding['display'] ?? '').')';
        }

        return $codeableConcept['text'] ?? null;
    }
}
