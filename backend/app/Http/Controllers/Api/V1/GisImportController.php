<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\GisImportConfigRequest;
use App\Http\Requests\GisImportMappingRequest;
use App\Http\Requests\GisImportUploadRequest;
use App\Jobs\GisImportJob;
use App\Models\App\GisImport;
use App\Services\GIS\AbbyGisService;
use App\Services\GIS\GisImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

/**
 * @group GIS Explorer
 */
class GisImportController extends Controller
{
    public function __construct(
        private readonly GisImportService $importService,
        private readonly AbbyGisService $abbyService,
    ) {}

    /**
     * POST /gis/import/upload — Upload file, return import_id + preview.
     */
    public function upload(GisImportUploadRequest $request): JsonResponse
    {
        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension());
        $format = in_array($ext, ['csv', 'tsv', 'txt']) ? 'csv' : $ext;

        $import = GisImport::create([
            'user_id' => $request->user()->id,
            'filename' => $file->getClientOriginalName(),
            'import_mode' => $this->detectImportMode($format),
            'status' => 'uploaded',
        ]);

        // Store file
        $dir = "gis-imports/{$import->id}";
        $file->storeAs($dir, $file->getClientOriginalName());

        // Preview
        $filePath = storage_path("app/{$dir}/{$file->getClientOriginalName()}");
        $preview = [];
        if (in_array($format, ['csv', 'tsv'])) {
            $preview = $this->importService->previewFile($filePath, $format);
        }

        return response()->json([
            'data' => [
                'import_id' => $import->id,
                'filename' => $import->filename,
                'import_mode' => $import->import_mode,
                'preview' => $preview,
            ],
        ], 201);
    }

    /**
     * POST /gis/import/{import}/analyze — Trigger Abby column analysis.
     */
    public function analyze(GisImport $import): JsonResponse
    {
        $this->authorizeImport($import);

        $filePath = storage_path("app/gis-imports/{$import->id}/{$import->filename}");
        $ext = strtolower(pathinfo($import->filename, PATHINFO_EXTENSION));
        $format = in_array($ext, ['csv', 'tsv', 'txt']) ? ($ext === 'tsv' ? 'tsv' : 'csv') : $ext;

        $preview = $this->importService->previewFile($filePath, $format);
        $stats = $this->importService->columnStats($preview['headers'], $preview['rows']);

        $suggestions = $this->abbyService->analyzeColumns(
            $preview['headers'],
            $preview['rows'],
            $stats,
            $import->filename
        );

        $import->update([
            'status' => 'analyzed',
            'abby_suggestions' => $suggestions,
        ]);

        return response()->json(['data' => $suggestions]);
    }

    /**
     * POST /gis/import/{import}/ask — Ask Abby about a specific column.
     */
    public function ask(GisImport $import, Request $request): JsonResponse
    {
        $this->authorizeImport($import);

        $request->validate([
            'column' => 'required|string',
            'question' => 'required|string|max:500',
        ]);

        $preview = $this->getPreview($import);
        $values = array_column($preview['rows'], $request->column);
        $stats = $this->importService->columnStats([$request->column], $preview['rows']);

        $answer = $this->abbyService->askAboutColumn(
            $request->column,
            array_slice($values, 0, 20),
            $stats[$request->column] ?? [],
            $request->question
        );

        return response()->json(['data' => $answer]);
    }

    /**
     * PUT /gis/import/{import}/mapping — Save confirmed column mapping.
     */
    public function saveMapping(GisImportMappingRequest $request, GisImport $import): JsonResponse
    {
        $this->authorizeImport($import);

        $import->update([
            'column_mapping' => $request->mapping,
            'status' => 'mapped',
        ]);

        return response()->json(['data' => ['status' => 'mapping_saved']]);
    }

    /**
     * PUT /gis/import/{import}/config — Save layer configuration.
     */
    public function saveConfig(GisImportConfigRequest $request, GisImport $import): JsonResponse
    {
        $this->authorizeImport($import);

        $import->update([
            'config' => $request->validated(),
            'status' => 'configured',
        ]);

        return response()->json(['data' => ['status' => 'config_saved']]);
    }

    /**
     * POST /gis/import/{import}/validate — Dry-run validation.
     */
    public function validateImport(GisImport $import): JsonResponse
    {
        $this->authorizeImport($import);

        $mapping = $import->column_mapping;
        $geoCodeCol = null;
        foreach ($mapping as $col => $target) {
            if ($target['purpose'] === 'geography_code') {
                $geoCodeCol = $col;
                break;
            }
        }

        if (! $geoCodeCol) {
            return response()->json(['error' => 'No geography code column mapped'], 422);
        }

        $preview = $this->getPreview($import, PHP_INT_MAX);
        $codes = array_unique(array_column($preview['rows'], $geoCodeCol));
        $geoType = $mapping[$geoCodeCol]['geo_type'] ?? $this->importService->detectGeoCodeType($codes);
        $matchResult = $this->importService->matchGeographies($codes, $geoType);

        return response()->json([
            'data' => [
                'total_rows' => count($preview['rows']),
                'unique_geographies' => count($codes),
                'matched' => count($matchResult['matched']),
                'unmatched' => count($matchResult['unmatched']),
                'match_rate' => $matchResult['match_rate'],
                'stubs_to_create' => count($matchResult['unmatched']),
                'location_type' => $matchResult['location_type'],
            ],
        ]);
    }

    /**
     * POST /gis/import/{import}/execute — Start import job.
     */
    public function execute(GisImport $import): JsonResponse
    {
        $this->authorizeImport($import);

        if (! in_array($import->status, ['configured', 'mapped'])) {
            return response()->json(['error' => 'Import must be configured before execution'], 422);
        }

        GisImportJob::dispatch($import);
        $import->markStatus('queued');

        return response()->json(['data' => ['status' => 'queued', 'import_id' => $import->id]]);
    }

    /**
     * GET /gis/import/{import}/status — Poll job progress.
     */
    public function status(GisImport $import): JsonResponse
    {
        $progress = Redis::get("gis:import:{$import->id}:progress");

        return response()->json([
            'data' => [
                'id' => $import->id,
                'status' => $import->status,
                'progress_percentage' => $progress !== null ? (int) $progress : $import->progress_percentage,
                'row_count' => $import->row_count,
                'log_output' => $import->log_output,
                'error_log' => $import->error_log,
                'started_at' => $import->started_at?->toISOString(),
                'completed_at' => $import->completed_at?->toISOString(),
            ],
        ]);
    }

    /**
     * DELETE /gis/import/{import} — Rollback import.
     */
    public function rollback(GisImport $import): JsonResponse
    {
        if (! request()->user()->can('gis.import.manage') && $import->user_id !== request()->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($import->status !== 'complete') {
            return response()->json(['error' => 'Only completed imports can be rolled back'], 422);
        }

        $this->importService->rollback($import->id, $import->summary_snapshot ?? []);
        $import->markStatus('rolled_back');

        return response()->json(['data' => ['status' => 'rolled_back']]);
    }

    /**
     * POST /gis/import/{import}/learn — Store confirmed mappings in ChromaDB.
     */
    public function learn(GisImport $import, Request $request): JsonResponse
    {
        $this->authorizeImport($import);

        $request->validate(['mappings' => 'required|array']);

        $this->abbyService->storeConfirmedMapping($request->mappings);

        return response()->json(['data' => ['status' => 'learned']]);
    }

    /**
     * GET /gis/import/history — List past imports.
     */
    public function history(Request $request): JsonResponse
    {
        $query = GisImport::with('user:id,name')
            ->orderByDesc('created_at');

        if (! $request->user()->can('gis.import.manage')) {
            $query->where('user_id', $request->user()->id);
        }

        $imports = $query->paginate(20);

        return response()->json(['data' => $imports]);
    }

    // --- Helpers ---

    private function authorizeImport(GisImport $import): void
    {
        if ($import->user_id !== request()->user()->id && ! request()->user()->can('gis.import.manage')) {
            abort(403, 'Unauthorized');
        }
    }

    private function detectImportMode(string $format): string
    {
        return match ($format) {
            'csv', 'tsv', 'xlsx', 'xls' => 'tabular_geocode',
            'json', 'geojson' => 'geospatial',
            'zip', 'kml', 'kmz', 'gpkg' => 'geospatial',
            default => 'tabular_geocode',
        };
    }

    private function getPreview(GisImport $import, int $maxRows = 20): array
    {
        $filePath = storage_path("app/gis-imports/{$import->id}/{$import->filename}");
        $ext = strtolower(pathinfo($import->filename, PATHINFO_EXTENSION));
        $format = in_array($ext, ['csv', 'tsv', 'txt']) ? ($ext === 'tsv' ? 'tsv' : 'csv') : $ext;

        return $this->importService->previewFile($filePath, $format, $maxRows);
    }
}
