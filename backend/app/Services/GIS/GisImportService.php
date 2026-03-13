<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\DB;

class GisImportService
{
    /**
     * Parse file and return headers + first N rows for preview.
     */
    public function previewFile(string $path, string $format, int $maxRows = 20): array
    {
        if ($format === 'csv' || $format === 'tsv') {
            return $this->previewCsv($path, $format === 'tsv' ? "\t" : ',', $maxRows);
        }

        if (in_array($format, ['xlsx', 'xls'])) {
            throw new \InvalidArgumentException('Excel support coming soon. Please export as CSV.');
        }

        throw new \InvalidArgumentException("Unsupported format for preview: {$format}");
    }

    /**
     * Streaming row iterator for large files (used by GisImportJob).
     * Yields associative arrays row-by-row to avoid OOM on large files.
     *
     * @return \Generator<int, array<string, string>>
     */
    public function iterateFile(string $path, string $format): \Generator
    {
        if ($format !== 'csv' && $format !== 'tsv') {
            throw new \InvalidArgumentException("Streaming only supports CSV/TSV: {$format}");
        }

        $delimiter = $format === 'tsv' ? "\t" : ',';
        $handle = fopen($path, 'r');
        if (!$handle) {
            throw new \RuntimeException("Cannot open file: {$path}");
        }

        $encoding = mb_detect_encoding(
            file_get_contents($path, false, null, 0, 8192),
            ['UTF-8', 'ISO-8859-1', 'Windows-1252'],
            true
        );

        $headers = fgetcsv($handle, 0, $delimiter);
        if ($headers === false) {
            fclose($handle);
            throw new \RuntimeException('Cannot read CSV headers');
        }

        if ($encoding && $encoding !== 'UTF-8') {
            $headers = array_map(fn ($h) => mb_convert_encoding($h, 'UTF-8', $encoding), $headers);
        }

        // Strip UTF-8 BOM (EF BB BF) from the first header if present
        if (!empty($headers[0]) && str_starts_with($headers[0], "\xEF\xBB\xBF")) {
            $headers[0] = substr($headers[0], 3);
        }

        $rowNum = 0;
        while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
            if ($encoding && $encoding !== 'UTF-8') {
                $row = array_map(fn ($v) => mb_convert_encoding($v, 'UTF-8', $encoding), $row);
            }
            if (count($row) === count($headers)) {
                yield $rowNum => array_combine($headers, $row);
            }
            $rowNum++;
        }

        fclose($handle);
    }

    private function previewCsv(string $path, string $delimiter, int $maxRows): array
    {
        $handle = fopen($path, 'r');
        if (!$handle) {
            throw new \RuntimeException("Cannot open file: {$path}");
        }

        $encoding = mb_detect_encoding(file_get_contents($path, false, null, 0, 8192), ['UTF-8', 'ISO-8859-1', 'Windows-1252'], true);

        $headers = fgetcsv($handle, 0, $delimiter);
        if ($headers === false) {
            fclose($handle);
            throw new \RuntimeException('Cannot read CSV headers');
        }

        if ($encoding && $encoding !== 'UTF-8') {
            $headers = array_map(fn ($h) => mb_convert_encoding($h, 'UTF-8', $encoding), $headers);
        }

        // Strip UTF-8 BOM (EF BB BF) from the first header if present
        if (!empty($headers[0]) && str_starts_with($headers[0], "\xEF\xBB\xBF")) {
            $headers[0] = substr($headers[0], 3);
        }

        $rows = [];
        $count = 0;
        while ($count < $maxRows && ($row = fgetcsv($handle, 0, $delimiter)) !== false) {
            if ($encoding && $encoding !== 'UTF-8') {
                $row = array_map(fn ($v) => mb_convert_encoding($v, 'UTF-8', $encoding), $row);
            }
            $rows[] = array_combine($headers, $row);
            $count++;
        }

        fclose($handle);

        return [
            'headers' => $headers,
            'rows' => $rows,
            'row_count' => $count,
            'encoding' => $encoding ?: 'UTF-8',
        ];
    }

    /**
     * Detect geography code type from sample values.
     */
    public function detectGeoCodeType(array $samples): string
    {
        $samples = array_filter($samples, fn ($v) => $v !== null && $v !== '');
        if (empty($samples)) {
            return 'custom';
        }

        $lengths = array_map('strlen', $samples);
        $avgLen = array_sum($lengths) / count($lengths);
        $allNumeric = array_reduce($samples, fn ($carry, $v) => $carry && ctype_digit((string) $v), true);
        $allAlpha3 = array_reduce($samples, fn ($carry, $v) => $carry && preg_match('/^[A-Z]{3}$/', (string) $v), true);
        $allAlpha2 = array_reduce($samples, fn ($carry, $v) => $carry && preg_match('/^[A-Z]{2}$/', (string) $v), true);

        if ($allNumeric) {
            if ($avgLen >= 10 && $avgLen <= 12) {
                return 'fips_tract';
            }
            if ($avgLen >= 4 && $avgLen <= 5) {
                return 'fips_county';
            }
            if ($avgLen >= 1 && $avgLen <= 2) {
                return 'fips_state';
            }
        }

        if ($allAlpha3) {
            return 'iso_country';
        }
        if ($allAlpha2) {
            return 'iso_country_2';
        }

        return 'custom';
    }

    /**
     * Compute column statistics for Abby analysis.
     */
    public function columnStats(array $headers, array $rows): array
    {
        $stats = [];
        foreach ($headers as $col) {
            $values = array_column($rows, $col);
            $numeric = array_filter($values, fn ($v) => is_numeric($v));
            $distinct = array_unique($values);

            $stats[$col] = [
                'distinct_count' => count($distinct),
                'null_count' => count(array_filter($values, fn ($v) => $v === null || $v === '')),
                'sample_values' => array_slice($distinct, 0, 5),
                'is_numeric' => count($numeric) > count($values) * 0.8,
            ];

            if (count($numeric) > 0) {
                $numericVals = array_map('floatval', $numeric);
                $stats[$col]['min'] = min($numericVals);
                $stats[$col]['max'] = max($numericVals);
                $stats[$col]['mean'] = round(array_sum($numericVals) / count($numericVals), 4);
            }
        }

        return $stats;
    }

    /**
     * Match geographic codes against existing geographic_location records.
     */
    public function matchGeographies(array $codes, string $codeType): array
    {
        $locationType = match ($codeType) {
            'fips_county' => 'county',
            'fips_tract' => 'census_tract',
            'fips_state' => 'state',
            'iso_country', 'iso_country_2' => 'country',
            default => 'custom',
        };

        $existing = DB::connection('gis')
            ->table('gis.geographic_location')
            ->whereIn('geographic_code', $codes)
            ->where('location_type', $locationType)
            ->pluck('geographic_location_id', 'geographic_code')
            ->toArray();

        $matched = [];
        $unmatched = [];
        foreach ($codes as $code) {
            if (isset($existing[$code])) {
                $matched[$code] = $existing[$code];
            } else {
                $unmatched[] = $code;
            }
        }

        return [
            'matched' => $matched,
            'unmatched' => $unmatched,
            'location_type' => $locationType,
            'match_rate' => count($codes) > 0
                ? round(count($matched) / count($codes) * 100, 1)
                : 0,
        ];
    }

    /**
     * Create stub geographic_location entries for unmatched codes.
     */
    public function createStubs(array $codes, string $locationType, int $importId, array $nameMap = []): array
    {
        $created = [];
        foreach ($codes as $code) {
            $id = DB::connection('gis')->table('gis.geographic_location')->insertGetId([
                'location_name' => $nameMap[$code] ?? "Unknown ({$code})",
                'location_type' => $locationType,
                'geographic_code' => $code,
                'import_id' => $importId,
            ]);
            $created[$code] = $id;
        }

        return $created;
    }

    /**
     * Batch insert rows into geography_summary.
     */
    public function insertGeographySummary(array $rows, int $importId): int
    {
        $inserted = 0;
        foreach (array_chunk($rows, 1000) as $chunk) {
            foreach ($chunk as $row) {
                DB::connection('gis')->table('gis.geography_summary')->upsert(
                    [
                        'geographic_location_id' => $row['geographic_location_id'],
                        'exposure_type' => $row['exposure_type'],
                        'patient_count' => $row['patient_count'] ?? null,
                        'avg_value' => $row['avg_value'],
                        'median_value' => $row['median_value'] ?? null,
                        'min_value' => $row['min_value'] ?? null,
                        'max_value' => $row['max_value'] ?? null,
                    ],
                    ['geographic_location_id', 'exposure_type'],
                    ['avg_value', 'median_value', 'min_value', 'max_value', 'patient_count']
                );
                $inserted++;
            }
        }

        return $inserted;
    }

    /**
     * Snapshot current geography_summary values for rollback.
     */
    public function snapshotSummary(array $geoIds, string $exposureType): array
    {
        return DB::connection('gis')
            ->table('gis.geography_summary')
            ->whereIn('geographic_location_id', $geoIds)
            ->where('exposure_type', $exposureType)
            ->get()
            ->map(fn ($row) => (array) $row)
            ->toArray();
    }

    /**
     * Rollback an import: delete imported data, restore snapshots.
     */
    public function rollback(int $importId, array $summarySnapshot): void
    {
        DB::connection('gis')->table('gis.gis_point_feature')
            ->where('import_id', $importId)->delete();

        DB::connection('gis')->table('gis.external_exposure')
            ->where('import_id', $importId)->delete();

        DB::connection('gis')->table('gis.geographic_location')
            ->where('import_id', $importId)->delete();

        // Restore geography_summary from snapshot
        foreach ($summarySnapshot as $row) {
            DB::connection('gis')->table('gis.geography_summary')->upsert(
                $row,
                ['geographic_location_id', 'exposure_type'],
                ['avg_value', 'median_value', 'min_value', 'max_value', 'patient_count']
            );
        }
    }
}
