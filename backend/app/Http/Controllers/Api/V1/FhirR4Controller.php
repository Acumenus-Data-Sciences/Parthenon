<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\FhirSearchRequest;
use App\Jobs\Fhir\RunFhirExportJob;
use App\Models\App\FhirExportJob;
use App\Models\App\Source;
use App\Models\User;
use App\Services\Fhir\Export\FhirBundleAssembler;
use App\Services\Fhir\Export\OmopToFhirService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * @group FHIR to CDM
 */
class FhirR4Controller extends Controller
{
    /** @var list<string> */
    private const RESOURCE_TYPES = [
        'Patient',
        'Condition',
        'Encounter',
        'Observation',
        'MedicationStatement',
        'Procedure',
        'Immunization',
        'AllergyIntolerance',
    ];

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
                'url' => config('app.url').'/api/v1/fhir',
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
     * Start a bulk FHIR export.
     */
    public function startExport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_id' => ['required', 'integer', Rule::exists('sources', 'id')->whereNull('deleted_at')],
            'resource_types' => ['sometimes', 'array', 'min:1'],
            'resource_types.*' => ['string', 'distinct', Rule::in(self::RESOURCE_TYPES)],
            'patient_ids' => ['sometimes', 'array'],
            'patient_ids.*' => ['integer', 'min:1', 'distinct'],
        ]);

        $user = $this->authenticatedUser($request);
        $source = Source::query()
            ->visibleToUser($user)
            ->find($validated['source_id']);

        abort_unless($source instanceof Source, 403, 'You do not have access to this source.');

        $job = FhirExportJob::create([
            'source_id' => $source->id,
            'resource_types' => $validated['resource_types'] ?? self::RESOURCE_TYPES,
            'patient_ids' => $validated['patient_ids'] ?? null,
            'user_id' => $user->id,
        ]);

        RunFhirExportJob::dispatch($job->id);

        return response()->json([
            'id' => $job->id,
            'status' => 'pending',
            'message' => 'Export started',
        ], 202)
            ->header('Content-Location', "/api/v1/fhir/\$export/{$job->id}");
    }

    /**
     * Check bulk export status.
     */
    public function exportStatus(Request $request, string $id): JsonResponse
    {
        $job = FhirExportJob::findOrFail($id);
        $this->authorizeExportJob($request, $job);

        return response()->json([
            'id' => $job->id,
            'status' => $job->status,
            'resource_types' => $job->resource_types,
            'files' => $job->files,
            'started_at' => $job->started_at?->toIso8601String(),
            'finished_at' => $job->finished_at?->toIso8601String(),
            'error_message' => $job->error_message,
        ]);
    }

    /**
     * Download an exported NDJSON file.
     */
    public function downloadExportFile(Request $request, string $id, string $file): StreamedResponse
    {
        $job = FhirExportJob::findOrFail($id);
        $this->authorizeExportJob($request, $job);

        $entry = $this->exportFileEntry($job, $file);
        if ($entry === null) {
            abort(404, 'Export file not found');
        }

        $path = $entry['url'];

        if (! Storage::disk('local')->exists($path)) {
            abort(404, 'Export file not found');
        }

        return Storage::disk('local')->download(
            $path,
            "{$file}.ndjson",
            ['Content-Type' => 'application/fhir+ndjson'],
        );
    }

    private function authenticatedUser(Request $request): User
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        return $user;
    }

    private function authorizeExportJob(Request $request, FhirExportJob $job): void
    {
        $user = $this->authenticatedUser($request);

        abort_unless($job->user_id === $user->id || $user->hasRole('super-admin'), 403);
    }

    /**
     * @return array{resource_type: string, url: string, count?: int}|null
     */
    private function exportFileEntry(FhirExportJob $job, string $file): ?array
    {
        if (! in_array($file, self::RESOURCE_TYPES, true)) {
            return null;
        }

        $expectedPath = "fhir-exports/{$job->id}/{$file}.ndjson";

        foreach ($job->files ?? [] as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            if (($entry['resource_type'] ?? null) !== $file || ($entry['url'] ?? null) !== $expectedPath) {
                continue;
            }

            /** @var array{resource_type: string, url: string, count?: int} $entry */
            return $entry;
        }

        return null;
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
