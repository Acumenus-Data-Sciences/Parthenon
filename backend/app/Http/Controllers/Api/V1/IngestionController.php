<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ExecutionStatus;
use App\Enums\IngestionStep;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UploadIngestionFileRequest;
use App\Jobs\Ingestion\ProfileSourceJob;
use App\Models\App\IngestionJob;
use App\Services\AiService;
use App\Services\Ingestion\CdmTableRegistry;
use App\Services\Ingestion\FileUploadService;
use Dedoc\Scramble\Attributes\Group;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Group('Data Ingestion', weight: 200)]
class IngestionController extends Controller
{
    public function __construct(
        private readonly FileUploadService $fileUploadService,
    ) {}

    /**
     * Upload a file and create an ingestion job.
     */
    public function upload(UploadIngestionFileRequest $request): JsonResponse
    {
        $ingestionJob = IngestionJob::create([
            'source_id' => $request->validated('source_id'),
            'status' => ExecutionStatus::Pending,
            'current_step' => IngestionStep::Profiling,
            'progress_percentage' => 0,
            'created_by' => $request->user()->id,
        ]);

        $fileData = $this->fileUploadService->store(
            $request->file('file'),
            $ingestionJob->id,
        );

        $sourceProfile = $ingestionJob->profiles()->create([
            'file_name' => $fileData['file_name'],
            'file_format' => $fileData['file_format'],
            'file_size' => $fileData['file_size'],
            'storage_path' => $fileData['storage_path'],
            'format_metadata' => $fileData['format_metadata'],
        ]);

        ProfileSourceJob::dispatch($ingestionJob);

        return response()->json([
            'data' => $ingestionJob->load('profiles'),
        ], 201);
    }

    /**
     * List ingestion jobs for the authenticated user with pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = IngestionJob::with('profiles')
            ->where('created_by', $request->user()->id)
            ->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        $jobs = $query->paginate($request->input('per_page', 15));

        return response()->json($jobs);
    }

    /**
     * Show a single ingestion job with profiles and fields.
     */
    public function show(IngestionJob $ingestionJob): JsonResponse
    {
        return response()->json([
            'data' => $ingestionJob->load('profiles.fields'),
        ]);
    }

    /**
     * Return the first source profile for a job.
     */
    public function profile(IngestionJob $ingestionJob): JsonResponse
    {
        $profile = $ingestionJob->profiles()->with('fields')->first();

        if (! $profile) {
            return response()->json(['message' => 'No profile found for this job.'], 404);
        }

        return response()->json([
            'data' => $profile,
        ]);
    }

    /**
     * Delete an ingestion job and its associated files.
     */
    public function destroy(IngestionJob $ingestionJob): JsonResponse
    {
        $this->fileUploadService->delete($ingestionJob->id);
        $ingestionJob->delete();

        return response()->json(null, 204);
    }

    /**
     * Retry a failed or cancelled ingestion job.
     */
    public function retry(IngestionJob $ingestionJob): JsonResponse
    {
        $ingestionJob->update([
            'status' => ExecutionStatus::Pending,
            'error_message' => null,
        ]);

        $step = $ingestionJob->current_step ?? IngestionStep::Profiling;

        if ($step === IngestionStep::Profiling) {
            ProfileSourceJob::dispatch($ingestionJob);
        }

        return response()->json([
            'data' => $ingestionJob->fresh()->load('profiles'),
        ]);
    }

    /**
     * Suggest schema mappings for an ingestion job using the AI service.
     */
    public function suggestSchemaMapping(IngestionJob $ingestionJob, AiService $aiService): JsonResponse
    {
        $sourceProfile = $ingestionJob->profiles()->with('fields')->first();

        if (! $sourceProfile) {
            return response()->json(['message' => 'No source profile found for this job.'], 404);
        }

        $columns = $sourceProfile->fields->map(fn ($field) => [
            'source_table' => $sourceProfile->file_name,
            'column_name' => $field->column_name,
            'inferred_type' => $field->inferred_type,
            'sample_values' => $field->sample_values ?? [],
        ])->toArray();

        $response = $aiService->suggestSchemaMapping($columns);
        $suggestions = $response['suggestions'] ?? [];

        // Clear any existing unmapped suggestions for this job
        $ingestionJob->schemaMappings()->where('is_confirmed', false)->delete();

        // Store the suggestions
        foreach ($suggestions as $suggestion) {
            $ingestionJob->schemaMappings()->create([
                'source_table' => $suggestion['source_table'],
                'source_column' => $suggestion['source_column'],
                'cdm_table' => $suggestion['cdm_table'] ?? null,
                'cdm_column' => $suggestion['cdm_column'] ?? null,
                'confidence' => $suggestion['confidence'] ?? null,
                'mapping_logic' => $suggestion['mapping_logic'] ?? 'direct',
                'is_confirmed' => false,
            ]);
        }

        $ingestionJob->update([
            'current_step' => IngestionStep::SchemaMapping,
        ]);

        return response()->json([
            'data' => $ingestionJob->schemaMappings()->get(),
        ]);
    }

    /**
     * Get schema mappings for an ingestion job.
     */
    public function getSchemaMapping(IngestionJob $ingestionJob): JsonResponse
    {
        $mappings = $ingestionJob->schemaMappings()->get();

        return response()->json([
            'data' => $mappings,
            'cdm_tables' => CdmTableRegistry::tableNames(),
        ]);
    }

    /**
     * Update schema mappings for an ingestion job.
     */
    public function updateSchemaMapping(Request $request, IngestionJob $ingestionJob): JsonResponse
    {
        $validated = $request->validate([
            'mappings' => ['required', 'array', 'min:1'],
            'mappings.*.id' => ['required', 'integer'],
            'mappings.*.cdm_table' => ['nullable', 'string'],
            'mappings.*.cdm_column' => ['nullable', 'string'],
            'mappings.*.mapping_logic' => ['nullable', 'string', 'in:direct,transform,concat,lookup,constant'],
            'mappings.*.transform_config' => ['nullable', 'array'],
        ]);

        $updated = 0;

        foreach ($validated['mappings'] as $mappingData) {
            $mapping = $ingestionJob->schemaMappings()->find($mappingData['id']);

            if (! $mapping) {
                continue;
            }

            $mapping->update([
                'cdm_table' => $mappingData['cdm_table'] ?? $mapping->cdm_table,
                'cdm_column' => $mappingData['cdm_column'] ?? $mapping->cdm_column,
                'mapping_logic' => $mappingData['mapping_logic'] ?? $mapping->mapping_logic,
                'transform_config' => $mappingData['transform_config'] ?? $mapping->transform_config,
            ]);

            $updated++;
        }

        return response()->json([
            'data' => $ingestionJob->schemaMappings()->get(),
            'updated' => $updated,
        ]);
    }

    /**
     * Confirm all schema mappings for an ingestion job.
     */
    public function confirmSchemaMapping(IngestionJob $ingestionJob): JsonResponse
    {
        $mappings = $ingestionJob->schemaMappings()->whereNotNull('cdm_table')->get();

        if ($mappings->isEmpty()) {
            return response()->json([
                'message' => 'No mappings with CDM table assignments to confirm.',
            ], 422);
        }

        $ingestionJob->schemaMappings()
            ->whereNotNull('cdm_table')
            ->update(['is_confirmed' => true]);

        $existingStats = $ingestionJob->stats_json ?? [];
        $existingStats['schema_mapping'] = [
            'confirmed_count' => $mappings->count(),
            'completed_at' => now()->toIso8601String(),
        ];

        $ingestionJob->update([
            'progress_percentage' => 33,
            'stats_json' => $existingStats,
        ]);

        return response()->json([
            'data' => $ingestionJob->schemaMappings()->get(),
            'confirmed' => $mappings->count(),
        ]);
    }

    /**
     * Return validation results for an ingestion job grouped by category.
     */
    public function validation(IngestionJob $ingestionJob): JsonResponse
    {
        $results = $ingestionJob->validationResults()
            ->orderBy('check_category')
            ->orderBy('severity')
            ->get()
            ->groupBy('check_category');

        return response()->json([
            'data' => $results,
        ]);
    }

    /**
     * Return a summary of validation results for an ingestion job.
     */
    public function validationSummary(IngestionJob $ingestionJob): JsonResponse
    {
        $results = $ingestionJob->validationResults();

        $total = $results->count();
        $passed = (clone $results)->where('passed', true)->count();
        $failed = (clone $results)->where('passed', false)->where('severity', 'error')->count();
        $warnings = (clone $results)->where('passed', false)->where('severity', 'warning')->count();

        return response()->json([
            'data' => [
                'total' => $total,
                'passed' => $passed,
                'failed' => $failed,
                'warnings' => $warnings,
                'pass_rate' => $total > 0 ? round(($passed / $total) * 100, 2) : 0,
            ],
        ]);
    }
}
