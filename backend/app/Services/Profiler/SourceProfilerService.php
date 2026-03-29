<?php

namespace App\Services\Profiler;

use App\Models\App\FieldProfile;
use App\Models\App\IngestionProject;
use App\Models\App\Source;
use App\Models\App\SourceProfile;
use App\Services\Analysis\HadesBridgeService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SourceProfilerService
{
    private string $blackRabbitUrl;

    public function __construct(
        private readonly PiiDetectionService $piiDetectionService,
    ) {
        $this->blackRabbitUrl = rtrim(
            config('services.blackrabbit.url', config('services.whiterabbit.url', 'http://blackrabbit:8090')),
            '/'
        );
    }

    /**
     * Start a scan and return the scan_id for SSE progress tracking.
     *
     * @param  list<string>|null  $tables
     */
    public function startScan(Source $source, ?array $tables = null, int $sampleRows = 100000): string
    {
        $source->loadMissing('daimons');

        $hadesSpec = HadesBridgeService::buildSourceSpec($source);
        $payload = [
            'dbms' => $hadesSpec['dbms'] ?? 'postgresql',
            'server' => $hadesSpec['server'] ?? '',
            'port' => (int) ($hadesSpec['port'] ?? 5432),
            'user' => $hadesSpec['user'] ?? '',
            'password' => $hadesSpec['password'] ?? '',
            'schema' => $hadesSpec['cdm_schema'] ?? 'public',
            'rows_per_table' => $sampleRows,
        ];

        if ($tables) {
            $payload['tables'] = $tables;
        }

        Log::info('BlackRabbit scan started', ['source_id' => $source->id]);

        $response = Http::timeout(30)->post("{$this->blackRabbitUrl}/scan", $payload);

        if ($response->failed()) {
            throw new \RuntimeException(
                'BlackRabbit scan failed to start: '.($response->json('detail') ?? $response->body())
            );
        }

        return $response->json('scan_id');
    }

    /**
     * Get the SSE progress stream URL for a scan.
     */
    public function progressUrl(string $scanId): string
    {
        return "{$this->blackRabbitUrl}/scan/{$scanId}";
    }

    /**
     * Start a scan from an ingestion project's DB connection config.
     *
     * @param  array{dbms: string, host: string, port: int, user: string, password: string, database: string, schema: string}  $dbConfig
     * @param  list<string>|null  $tables
     */
    public function startScanFromConfig(array $dbConfig, ?array $tables = null, int $sampleRows = 100000): string
    {
        $payload = [
            'dbms' => $dbConfig['dbms'] ?? 'postgresql',
            'server' => $dbConfig['host'] ?? '',
            'port' => (int) ($dbConfig['port'] ?? 5432),
            'user' => $dbConfig['user'] ?? '',
            'password' => $dbConfig['password'] ?? '',
            'database' => $dbConfig['database'] ?? '',
            'schema' => $dbConfig['schema'] ?? 'public',
            'rows_per_table' => $sampleRows,
        ];

        if ($tables) {
            $payload['tables'] = $tables;
        }

        Log::info('BlackRabbit scan started from DB config', ['dbms' => $dbConfig['dbms'], 'host' => $dbConfig['host']]);

        $response = Http::timeout(30)->post("{$this->blackRabbitUrl}/scan", $payload);

        if ($response->failed()) {
            throw new \RuntimeException(
                'BlackRabbit scan failed to start: '.($response->json('detail') ?? $response->body())
            );
        }

        return $response->json('scan_id');
    }

    /**
     * Fetch the completed scan result and persist it for an ingestion project.
     */
    public function fetchAndPersistForProject(IngestionProject $project, string $scanId): SourceProfile
    {
        $response = Http::timeout(1200)->get("{$this->blackRabbitUrl}/scan/{$scanId}/result");

        if ($response->failed()) {
            throw new \RuntimeException(
                'BlackRabbit result fetch failed: '.($response->json('detail') ?? $response->body())
            );
        }

        $scanData = $response->json();
        $elapsed = $scanData['scan_time_seconds'] ?? 0;

        return $this->persistResultsForProject($project, $scanData, $elapsed);
    }

    /**
     * Fetch the completed scan result and persist it.
     */
    public function fetchAndPersist(Source $source, string $scanId): SourceProfile
    {
        $response = Http::timeout(1200)->get("{$this->blackRabbitUrl}/scan/{$scanId}/result");

        if ($response->failed()) {
            throw new \RuntimeException(
                'BlackRabbit result fetch failed: '.($response->json('detail') ?? $response->body())
            );
        }

        $scanData = $response->json();
        $elapsed = $scanData['scan_time_seconds'] ?? 0;

        return $this->persistResults($source, $scanData, $elapsed);
    }

    /**
     * Run a BlackRabbit scan and persist results (synchronous, backward-compat).
     *
     * @param  list<string>|null  $tables
     */
    public function scan(Source $source, ?array $tables = null, int $sampleRows = 100000): SourceProfile
    {
        $scanId = $this->startScan($source, $tables, $sampleRows);

        // Poll until complete
        $maxWait = 1200;
        $waited = 0;
        while ($waited < $maxWait) {
            usleep(500_000); // 500ms
            $waited += 0.5;

            $response = Http::timeout(10)->get("{$this->blackRabbitUrl}/scan/{$scanId}/result");
            if ($response->status() === 404) {
                continue; // Still running
            }
            if ($response->successful()) {
                $scanData = $response->json();
                $elapsed = $scanData['scan_time_seconds'] ?? $waited;

                return $this->persistResults($source, $scanData, $elapsed);
            }
            if ($response->status() === 410) {
                throw new \RuntimeException('Scan expired before result could be fetched');
            }
        }

        throw new \RuntimeException('Scan timed out after '.$maxWait.' seconds');
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
                // BlackRabbit: null_percentage (0-100), WhiteRabbit: fraction_empty (0-1)
                $nullPct = $col['null_percentage'] ?? (($col['fraction_empty'] ?? 0) * 100);
                if ($nullPct > 50) {
                    $highNullColumns++;
                }
                $uniqueCount = $col['distinct_count'] ?? $col['unique_count'] ?? 0;
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
            'scan_type' => 'blackrabbit',
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
                // BlackRabbit provides these directly; WhiteRabbit uses fraction_empty (0-1)
                $nRows = $col['row_count'] ?? $col['n_rows'] ?? $tableRowCount;
                $nullCount = $col['null_count'] ?? (int) round($nRows * ($col['fraction_empty'] ?? 0));
                $nonNullCount = $col['non_null_count'] ?? ($nRows - $nullCount);
                $nullPct = $col['null_percentage'] ?? round(($col['fraction_empty'] ?? 0) * 100, 2);
                $distinctCount = $col['distinct_count'] ?? $col['unique_count'] ?? 0;
                $distinctPct = $col['distinct_percentage'] ?? ($nRows > 0 ? round($distinctCount / $nRows * 100, 2) : 0);

                // Normalize sample values — WhiteRabbit: [{value, frequency}], BlackRabbit: {value: count}
                $sampleValues = null;
                if (! empty($col['top_values'])) {
                    $sampleValues = $col['top_values'];
                } elseif (! empty($col['values'])) {
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
                    'non_null_count' => $nonNullCount,
                    'null_count' => $nullCount,
                    'null_percentage' => $nullPct,
                    'distinct_count' => $distinctCount,
                    'distinct_percentage' => $distinctPct,
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
     * Persist scan results for an ingestion project.
     *
     * @param  array<string, mixed>  $scanData
     */
    private function persistResultsForProject(IngestionProject $project, array $scanData, float $elapsed): SourceProfile
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
                $nullPct = $col['null_percentage'] ?? (($col['fraction_empty'] ?? 0) * 100);
                if ($nullPct > 50) {
                    $highNullColumns++;
                }
                $uniqueCount = $col['distinct_count'] ?? $col['unique_count'] ?? 0;
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
            'ingestion_project_id' => $project->id,
            'scan_type' => 'blackrabbit',
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

        foreach ($tables as $table) {
            $tableName = $table['table_name'] ?? $table['name'] ?? '';
            if ($tableName === '' || $tableName === 'Field Overview') {
                continue;
            }
            $tableRowCount = $table['row_count'] ?? 0;

            foreach ($table['columns'] ?? [] as $idx => $col) {
                $nRows = $col['row_count'] ?? $col['n_rows'] ?? $tableRowCount;
                $nullCount = $col['null_count'] ?? (int) round($nRows * ($col['fraction_empty'] ?? 0));
                $nonNullCount = $col['non_null_count'] ?? ($nRows - $nullCount);
                $nullPctVal = $col['null_percentage'] ?? round(($col['fraction_empty'] ?? 0) * 100, 2);
                $distinctCount = $col['distinct_count'] ?? $col['unique_count'] ?? 0;
                $distinctPct = $col['distinct_percentage'] ?? ($nRows > 0 ? round($distinctCount / $nRows * 100, 2) : 0);

                $sampleValues = null;
                if (! empty($col['top_values'])) {
                    $sampleValues = $col['top_values'];
                } elseif (! empty($col['values'])) {
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
                    'non_null_count' => $nonNullCount,
                    'null_count' => $nullCount,
                    'null_percentage' => $nullPctVal,
                    'distinct_count' => $distinctCount,
                    'distinct_percentage' => $distinctPct,
                    'sample_values' => $sampleValues,
                ]);
            }
        }

        $this->piiDetectionService->detectAndFlag($profile);

        Log::info('Profiler scan persisted for project', [
            'ingestion_project_id' => $project->id,
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
                // BlackRabbit: null_percentage (0-100), WhiteRabbit: fraction_empty (0-1)
                if (isset($col['null_percentage'])) {
                    $totalNull += $col['null_percentage'] / 100;
                } else {
                    $totalNull += $col['fraction_empty'] ?? 0;
                }
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
