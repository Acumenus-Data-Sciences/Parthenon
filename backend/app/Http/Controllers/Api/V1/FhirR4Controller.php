<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\FhirSearchRequest;
use App\Services\Fhir\Export\FhirBundleAssembler;
use App\Services\Fhir\Export\OmopToFhirService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FhirR4Controller extends Controller
{
    public function __construct(
        private readonly OmopToFhirService $service,
    ) {}

    /**
     * FHIR CapabilityStatement (public).
     */
    public function metadata(): JsonResponse
    {
        $resourceTypes = [
            'Patient', 'Condition', 'Encounter', 'Observation',
            'MedicationStatement', 'Procedure', 'Immunization', 'AllergyIntolerance',
        ];

        $rest = [];
        foreach ($resourceTypes as $type) {
            $interactions = [
                ['code' => 'read'],
                ['code' => 'search-type'],
            ];

            $searchParams = $this->getSearchParams($type);

            $entry = [
                'type' => $type,
                'interaction' => $interactions,
                'searchParam' => $searchParams,
            ];

            $rest[] = $entry;
        }

        $capability = [
            'resourceType' => 'CapabilityStatement',
            'status' => 'active',
            'date' => '2026-03-12',
            'kind' => 'instance',
            'software' => [
                'name' => 'Parthenon FHIR Server',
                'version' => '1.0.0',
            ],
            'implementation' => [
                'description' => 'Parthenon OMOP-to-FHIR R4 Bridge',
                'url' => config('app.url') . '/api/v1/fhir',
            ],
            'fhirVersion' => '4.0.1',
            'format' => ['json'],
            'rest' => [[
                'mode' => 'server',
                'resource' => $rest,
            ]],
        ];

        return response()->json($capability)
            ->header('Content-Type', 'application/fhir+json');
    }

    /**
     * FHIR search-type interaction.
     */
    public function search(FhirSearchRequest $request): JsonResponse
    {
        $type = $request->route('type', 'Patient');
        $params = $request->validated();

        $result = $this->service->search($type, $params);

        $bundle = FhirBundleAssembler::searchset(
            $result['resources'],
            $result['total'],
        );

        return response()->json($bundle)
            ->header('Content-Type', 'application/fhir+json');
    }

    /**
     * FHIR read interaction.
     */
    public function read(Request $request, int $id): JsonResponse
    {
        $type = $request->route('type', 'Patient');
        $resource = $this->service->read($type, $id);

        if (! $resource) {
            return response()->json([
                'resourceType' => 'OperationOutcome',
                'issue' => [[
                    'severity' => 'error',
                    'code' => 'not-found',
                    'diagnostics' => "{$type}/{$id} not found",
                ]],
            ], 404)->header('Content-Type', 'application/fhir+json');
        }

        return response()->json($resource)
            ->header('Content-Type', 'application/fhir+json');
    }

    /**
     * Get FHIR search parameters for a resource type.
     *
     * @return list<array{name: string, type: string}>
     */
    private function getSearchParams(string $type): array
    {
        $common = [
            ['name' => '_id', 'type' => 'token'],
            ['name' => '_count', 'type' => 'number'],
            ['name' => '_offset', 'type' => 'number'],
        ];

        $specific = match ($type) {
            'Patient' => [
                ['name' => 'gender', 'type' => 'token'],
                ['name' => 'birthdate', 'type' => 'date'],
            ],
            'Condition' => [
                ['name' => 'patient', 'type' => 'reference'],
                ['name' => 'code', 'type' => 'token'],
                ['name' => 'onset-date', 'type' => 'date'],
                ['name' => 'clinical-status', 'type' => 'token'],
            ],
            'Encounter' => [
                ['name' => 'patient', 'type' => 'reference'],
                ['name' => 'class', 'type' => 'token'],
                ['name' => 'date', 'type' => 'date'],
            ],
            'Observation', 'MedicationStatement', 'Procedure', 'Immunization', 'AllergyIntolerance' => [
                ['name' => 'patient', 'type' => 'reference'],
                ['name' => 'code', 'type' => 'token'],
                ['name' => 'date', 'type' => 'date'],
            ],
            default => [],
        };

        return [...$common, ...$specific];
    }
}
