<?php

namespace App\Services\Profiler;

use App\Models\App\FieldProfile;
use App\Models\App\Source;
use App\Models\App\SourceProfile;
use App\Services\Analysis\HadesBridgeService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SourceProfilerService
{
    private string $whiteRabbitUrl;

    public function __construct(
        private readonly PiiDetectionService $piiDetectionService,
    ) {
        $this->whiteRabbitUrl = rtrim(config('services.whiterabbit.url', 'http://whiterabbit:8090'), '/');
    }

    /**
     * Run a WhiteRabbit scan and persist results.
     *
     * @param  list<string>|null  $tables
     */
    public function scan(Source $source, ?array $tables = null, int $sampleRows = 100000): SourceProfile
    {
        $source->loadMissing('daimons');

        // Build connection spec from HADES bridge, then map to WhiteRabbit's expected format.
        // WhiteRabbit expects FLAT keys (no 'connection' wrapper) and for PostgreSQL,
        // the server field must be <host>/<database>.
        $hadesSpec = HadesBridgeService::buildSourceSpec($source);
        $payload = [
            'dbms' => $hadesSpec['dbms'] ?? 'postgresql',
            'server' => $hadesSpec['server'] ?? '', // Already in host/database format from HADES
            'port' => (int) ($hadesSpec['port'] ?? 5432),
            'user' => $hadesSpec['user'] ?? '',
            'password' => $hadesSpec['password'] ?? '',
            'schema' => $hadesSpec['cdm_schema'] ?? 'public',
            'sample_size' => $sampleRows,
        ];

        if ($tables) {
            $payload['tables'] = $tables;
        }

        Log::info('Profiler scan started', ['source_id' => $source->id]);

        $startTime = microtime(true);

        $response = Http::timeout(1200)->post(
            "{$this->whiteRabbitUrl}/scan",
            $payload,
        );

        $elapsed = round(microtime(true) - $startTime, 3);

        if ($response->failed()) {
            Log::error('Profiler scan failed', [
                'source_id' => $source->id,
                'status' => $response->status(),
            ]);

            throw new \RuntimeException(
                'WhiteRabbit scan failed: '.($response->json('message') ?? $response->body())
            );
        }

        $scanData = $response->json();

        return $this->persistResults($source, $scanData, $elapsed);
    }

    /**
     * Persist WhiteRabbit scan results to source_profiles + field_profiles.
     *
     * @param  array<string, mixed>  $scanData
     */
    private function persistResults(Source $source, array $scanData, float $elapsed): SourceProfile
    {
        $tables = $scanData['tables'] ?? [];

        $tableCount = count($tables);
        $columnCount = 0;
        $totalRows = 0;
        $highNullColumns = 0;
        $emptyTables = 0;
        $lowCardinalityColumns = 0;
        $singleValueColumns = 0;

        foreach ($tables as $table) {
            // Skip WhiteRabbit's "Field Overview" metadata table
            $tName = $table['table_name'] ?? $table['name'] ?? '';
            if ($tName === '' || $tName === 'Field Overview') {
                continue;
            }

            $totalRows += $table['row_count'] ?? 0;
            $columnCount += $table['column_count'] ?? count($table['columns'] ?? []);

            if (($table['row_count'] ?? 0) === 0) {
                $emptyTables++;
            }

            foreach ($table['columns'] ?? [] as $col) {
                $nullPct = ($col['fraction_empty'] ?? 0) * 100;
                if ($nullPct > 50) {
                    $highNullColumns++;
                }
                $uniqueCount = $col['unique_count'] ?? 0;
                if ($uniqueCount < 5 && ($table['row_count'] ?? 0) > 0) {
                    $lowCardinalityColumns++;
                }
                if ($uniqueCount <= 1 && ($table['row_count'] ?? 0) > 0) {
                    $singleValueColumns++;
                }
            }
        }

        $grade = $this->computeOverallGrade($tables);

        $profile = SourceProfile::create([
            'source_id' => $source->id,
            'scan_type' => 'whiterabbit',
            'scan_time_seconds' => $elapsed,
            'overall_grade' => $grade,
            'table_count' => $tableCount,
            'column_count' => $columnCount,
            'total_rows' => $totalRows,
            'row_count' => $totalRows,
            'summary_json' => [
                'high_null_columns' => $highNullColumns,
                'empty_tables' => $emptyTables,
                'low_cardinality_columns' => $lowCardinalityColumns,
                'single_value_columns' => $singleValueColumns,
            ],
        ]);

        // Persist field profiles
        foreach ($tables as $table) {
            // WhiteRabbit uses 'name' not 'table_name'; skip the "Field Overview" metadata table
            $tableName = $table['table_name'] ?? $table['name'] ?? '';
            if ($tableName === '' || $tableName === 'Field Overview') {
                continue;
            }
            $tableRowCount = $table['row_count'] ?? 0;

            foreach ($table['columns'] ?? [] as $idx => $col) {
                $nullPct = round(($col['fraction_empty'] ?? 0) * 100, 2);
                $nRows = $col['n_rows'] ?? $tableRowCount;
                $nullCount = (int) round($nRows * ($col['fraction_empty'] ?? 0));

                // WhiteRabbit returns values as [{value, frequency}] — normalize to {value: frequency}
                $sampleValues = null;
                if (! empty($col['values'])) {
                    if (is_array($col['values']) && isset($col['values'][0]['value'])) {
                        $sampleValues = [];
                        foreach (array_slice($col['values'], 0, 10) as $v) {
                            $sampleValues[$v['value'] ?? ''] = $v['frequency'] ?? 0;
                        }
                    } else {
                        $sampleValues = $col['values'];
                    }
                }

                FieldProfile::create([
                    'source_profile_id' => $profile->id,
                    'table_name' => $tableName,
                    'row_count' => $tableRowCount,
                    'column_name' => $col['name'],
                    'column_index' => $idx,
                    'inferred_type' => $col['type'] ?? 'unknown',
                    'non_null_count' => $nRows - $nullCount,
                    'null_count' => $nullCount,
                    'null_percentage' => $nullPct,
                    'distinct_count' => $col['unique_count'] ?? 0,
                    'distinct_percentage' => $nRows > 0
                        ? round(($col['unique_count'] ?? 0) / $nRows * 100, 2)
                        : 0,
                    'sample_values' => $sampleValues,
                ]);
            }
        }

        // Run PII detection on all field profiles
        $this->piiDetectionService->detectAndFlag($profile);

        Log::info('Profiler scan persisted', [
            'source_id' => $source->id,
            'profile_id' => $profile->id,
            'tables' => $tableCount,
            'columns' => $columnCount,
            'grade' => $grade,
            'elapsed' => $elapsed,
        ]);

        return $profile;
    }

    /**
     * Compute overall A-F grade from average null fraction across all columns.
     *
     * @param  list<array{columns?: list<array{fraction_empty?: float}>}>  $tables
     */
    private function computeOverallGrade(array $tables): string
    {
        $totalNull = 0;
        $totalCols = 0;

        foreach ($tables as $table) {
            foreach ($table['columns'] ?? [] as $col) {
                $totalNull += $col['fraction_empty'] ?? 0;
                $totalCols++;
            }
        }

        if ($totalCols === 0) {
            return 'F';
        }

        $avgNull = ($totalNull / $totalCols) * 100;

        return match (true) {
            $avgNull <= 5 => 'A',
            $avgNull <= 15 => 'B',
            $avgNull <= 30 => 'C',
            $avgNull <= 50 => 'D',
            default => 'F',
        };
    }
}
