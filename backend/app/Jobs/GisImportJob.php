<?php

namespace App\Jobs;

use App\Models\App\GisImport;
use App\Services\GIS\GisImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;

class GisImportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 1800;

    public int $tries = 1;

    public function __construct(
        public GisImport $import,
    ) {
        $this->onQueue('gis-import');
    }

    public function handle(GisImportService $importService): void
    {
        $this->import->markStatus('importing', ['started_at' => now()]);
        $this->import->appendLog('Import started');

        try {
            $mapping = $this->import->column_mapping;
            $config = $this->import->config;
            $filePath = storage_path("app/gis-imports/{$this->import->id}/{$this->import->filename}");

            if (! file_exists($filePath)) {
                throw new \RuntimeException("Import file not found: {$filePath}");
            }

            $ext = strtolower(pathinfo($this->import->filename, PATHINFO_EXTENSION));
            $format = in_array($ext, ['csv', 'tsv']) ? $ext : 'geojson';

            // Find mapped columns
            $geoCodeCol = null;
            $geoNameCol = null;
            $valueCol = null;
            foreach ($mapping as $col => $target) {
                if ($target['purpose'] === 'geography_code') {
                    $geoCodeCol = $col;
                }
                if ($target['purpose'] === 'geography_name') {
                    $geoNameCol = $col;
                }
                if ($target['purpose'] === 'value') {
                    $valueCol = $col;
                }
            }

            if (! $geoCodeCol) {
                throw new \RuntimeException('No geography code column mapped');
            }

            // First pass: collect unique geo codes (stream to avoid OOM)
            $this->import->appendLog('Scanning file for geography codes...');
            $codes = [];
            $nameMap = [];
            $totalRows = 0;
            foreach ($importService->iterateFile($filePath, $format) as $row) {
                $code = $row[$geoCodeCol] ?? '';
                if ($code) {
                    $codes[$code] = true;
                    if ($geoNameCol && ! empty($row[$geoNameCol])) {
                        $nameMap[$code] = $row[$geoNameCol];
                    }
                }
                $totalRows++;
            }
            $uniqueCodes = array_keys($codes);
            $this->import->update(['row_count' => $totalRows]);
            $this->import->appendLog("Found {$totalRows} rows, ".count($uniqueCodes).' unique geographies');

            // Match geographies
            $geoType = $mapping[$geoCodeCol]['geo_type'] ?? 'custom';
            $matchResult = $importService->matchGeographies($uniqueCodes, $geoType);

            $this->import->appendLog(sprintf(
                'Geography matching: %d matched, %d unmatched (%.1f%% match rate)',
                count($matchResult['matched']),
                count($matchResult['unmatched']),
                $matchResult['match_rate']
            ));

            // Create stubs for unmatched
            $stubs = [];
            if (! empty($matchResult['unmatched'])) {
                $stubs = $importService->createStubs(
                    $matchResult['unmatched'],
                    $matchResult['location_type'],
                    $this->import->id,
                    $nameMap
                );
                $this->import->appendLog(sprintf('Created %d geography stubs', count($stubs)));
            }

            $allGeoMap = array_merge($matchResult['matched'], $stubs);

            // Snapshot existing summary for rollback
            if ($valueCol) {
                $exposureType = $config['exposure_type'] ?? $valueCol;
                $geoIds = array_values($allGeoMap);
                $snapshot = $importService->snapshotSummary($geoIds, $exposureType);
                $this->import->update(['summary_snapshot' => $snapshot]);
            }

            // Second pass: stream rows and aggregate
            $this->import->appendLog('Importing data...');
            $summaryRows = [];
            $processed = 0;

            foreach ($importService->iterateFile($filePath, $format) as $row) {
                $code = $row[$geoCodeCol] ?? '';
                $geoId = $allGeoMap[$code] ?? null;
                if (! $geoId) {
                    continue;
                }

                if ($valueCol) {
                    $value = is_numeric($row[$valueCol]) ? (float) $row[$valueCol] : null;
                    $exposureType = $config['exposure_type'] ?? $valueCol;

                    if (! isset($summaryRows[$code])) {
                        $summaryRows[$code] = [
                            'geographic_location_id' => $geoId,
                            'exposure_type' => $exposureType,
                            'avg_value' => $value,
                            'patient_count' => 1,
                        ];
                    } else {
                        $agg = $config['aggregation'] ?? 'mean';
                        $existing = $summaryRows[$code]['avg_value'];
                        $count = $summaryRows[$code]['patient_count'] + 1;
                        $summaryRows[$code]['patient_count'] = $count;
                        $summaryRows[$code]['avg_value'] = match ($agg) {
                            'sum' => $existing + $value,
                            'max' => max($existing, $value),
                            'min' => min($existing, $value),
                            default => (($existing * ($count - 1)) + $value) / $count,
                        };
                    }
                }

                $processed++;
                if ($processed % 500 === 0) {
                    $pct = (int) round($processed / $totalRows * 100);
                    $this->import->update(['progress_percentage' => $pct]);
                    Redis::set("gis:import:{$this->import->id}:progress", $pct);
                }
            }

            // Batch insert summaries
            if (! empty($summaryRows)) {
                $inserted = $importService->insertGeographySummary(
                    array_values($summaryRows),
                    $this->import->id
                );
                $this->import->appendLog("Inserted {$inserted} geography summary records");
            }

            // Clean up temp file
            @unlink($filePath);
            $importDir = dirname($filePath);
            if (is_dir($importDir) && count(scandir($importDir)) === 2) {
                @rmdir($importDir);
            }

            $this->import->markStatus('complete', [
                'progress_percentage' => 100,
                'completed_at' => now(),
            ]);
            $this->import->appendLog('Import complete');
            Redis::set("gis:import:{$this->import->id}:progress", 100);

        } catch (\Throwable $e) {
            Log::error('GIS import failed', [
                'import_id' => $this->import->id,
                'error' => $e->getMessage(),
            ]);

            $this->import->markStatus('failed', [
                'completed_at' => now(),
                'error_log' => array_merge($this->import->error_log ?? [], [
                    ['time' => now()->toISOString(), 'message' => $e->getMessage()],
                ]),
            ]);
            $this->import->appendLog("ERROR: {$e->getMessage()}");
        }
    }

    public function failed(\Throwable $e): void
    {
        $filePath = storage_path("app/gis-imports/{$this->import->id}/{$this->import->filename}");
        @unlink($filePath);

        $this->import->markStatus('failed', [
            'completed_at' => now(),
            'error_log' => [['time' => now()->toISOString(), 'message' => $e->getMessage()]],
        ]);
    }
}
