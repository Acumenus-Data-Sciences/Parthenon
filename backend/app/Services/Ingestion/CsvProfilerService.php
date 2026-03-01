<?php

namespace App\Services\Ingestion;

use SplFileObject;

class CsvProfilerService
{
    /**
     * PII detection patterns for value matching.
     */
    private const PII_PATTERNS = [
        'ssn' => '/^\d{3}-\d{2}-\d{4}$/',
        'phone' => '/^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/',
        'email' => '/^[^@]+@[^@]+\.[^@]+$/',
    ];

    /**
     * Column name heuristics for PII detection.
     */
    private const PII_COLUMN_NAMES = [
        'ssn',
        'social_security',
        'mrn',
        'medical_record',
        'patient_name',
        'first_name',
        'last_name',
        'phone',
        'email',
        'address',
        'dob',
        'date_of_birth',
    ];

    /**
     * Profile a CSV file and return per-column statistics.
     *
     * @return array<int, array<string, mixed>>
     */
    public function profile(string $filePath, string $delimiter = ','): array
    {
        if ($delimiter === 'tab') {
            $delimiter = "\t";
        }

        $file = new SplFileObject($filePath, 'r');
        $file->setFlags(SplFileObject::READ_CSV | SplFileObject::SKIP_EMPTY | SplFileObject::DROP_NEW_LINE);
        $file->setCsvControl($delimiter);

        // Read header row
        $headers = $file->current();
        if ($headers === false || $headers === [null]) {
            return [];
        }

        $columnCount = count($headers);

        // Initialize per-column tracking arrays
        $stats = [];
        for ($i = 0; $i < $columnCount; $i++) {
            $stats[$i] = [
                'column_name' => trim($headers[$i]),
                'column_index' => $i,
                'total_count' => 0,
                'null_count' => 0,
                'non_null_count' => 0,
                'values' => [],       // value => frequency
                'samples' => [],      // up to 5 non-null samples
                'numeric_values' => [],
                'type_checks' => [
                    'date' => true,
                    'integer' => true,
                    'float' => true,
                    'boolean' => true,
                ],
                'pii_matches' => [],
            ];
        }

        // Stream through data rows
        $rowCount = 0;
        $file->next();

        while (! $file->eof()) {
            $row = $file->current();
            $file->next();

            if ($row === false || $row === [null]) {
                continue;
            }

            $rowCount++;

            for ($i = 0; $i < $columnCount; $i++) {
                $value = $row[$i] ?? null;
                $stats[$i]['total_count']++;

                // Check for null/empty
                if ($value === null || $value === '' || strtolower(trim($value)) === 'null') {
                    $stats[$i]['null_count']++;

                    continue;
                }

                $value = trim($value);
                $stats[$i]['non_null_count']++;

                // Track value frequencies
                if (isset($stats[$i]['values'][$value])) {
                    $stats[$i]['values'][$value]++;
                } else {
                    $stats[$i]['values'][$value] = 1;
                }

                // Collect samples (up to 5)
                if (count($stats[$i]['samples']) < 5) {
                    $stats[$i]['samples'][] = $value;
                }

                // Type inference checks
                if ($stats[$i]['type_checks']['integer'] && ! $this->isInteger($value)) {
                    $stats[$i]['type_checks']['integer'] = false;
                }
                if ($stats[$i]['type_checks']['float'] && ! is_numeric($value)) {
                    $stats[$i]['type_checks']['float'] = false;
                }
                if ($stats[$i]['type_checks']['boolean'] && ! $this->isBoolean($value)) {
                    $stats[$i]['type_checks']['boolean'] = false;
                }
                if ($stats[$i]['type_checks']['date'] && ! $this->isDate($value)) {
                    $stats[$i]['type_checks']['date'] = false;
                }

                // Track numeric values for statistics
                if (is_numeric($value)) {
                    $stats[$i]['numeric_values'][] = (float) $value;
                }

                // PII pattern matching (check first 1000 rows only for performance)
                if ($rowCount <= 1000) {
                    foreach (self::PII_PATTERNS as $piiType => $pattern) {
                        if (preg_match($pattern, $value)) {
                            $stats[$i]['pii_matches'][$piiType] = ($stats[$i]['pii_matches'][$piiType] ?? 0) + 1;
                        }
                    }
                }
            }
        }

        // Build result array
        $results = [];
        for ($i = 0; $i < $columnCount; $i++) {
            $s = $stats[$i];
            $totalCount = $s['total_count'];
            $nonNullCount = $s['non_null_count'];
            $distinctCount = count($s['values']);

            // Determine inferred type
            $inferredType = $this->inferType($s);

            // Compute top 10 values by frequency
            arsort($s['values']);
            $topValues = array_slice($s['values'], 0, 10, true);
            $topValuesArray = [];
            foreach ($topValues as $val => $freq) {
                $topValuesArray[] = ['value' => (string) $val, 'count' => $freq];
            }

            // Compute numeric statistics
            $statistics = [];
            if (! empty($s['numeric_values'])) {
                $numVals = $s['numeric_values'];
                sort($numVals);
                $statistics = [
                    'min' => min($numVals),
                    'max' => max($numVals),
                    'mean' => round(array_sum($numVals) / count($numVals), 4),
                ];
            }

            // Detect PII
            $piiResult = $this->detectPii($s['column_name'], $s['pii_matches'], $nonNullCount);

            $results[] = [
                'column_name' => $s['column_name'],
                'column_index' => $s['column_index'],
                'inferred_type' => $inferredType,
                'non_null_count' => $nonNullCount,
                'null_count' => $s['null_count'],
                'null_percentage' => $totalCount > 0 ? round(($s['null_count'] / $totalCount) * 100, 2) : 0,
                'distinct_count' => $distinctCount,
                'distinct_percentage' => $nonNullCount > 0 ? round(($distinctCount / $nonNullCount) * 100, 2) : 0,
                'top_values' => $topValuesArray,
                'sample_values' => $s['samples'],
                'statistics' => $statistics,
                'is_potential_pii' => $piiResult['is_pii'],
                'pii_type' => $piiResult['pii_type'],
            ];
        }

        return $results;
    }

    /**
     * Get the total row count from the last profiling operation.
     */
    public function getRowCount(string $filePath, string $delimiter = ','): int
    {
        if ($delimiter === 'tab') {
            $delimiter = "\t";
        }

        $file = new SplFileObject($filePath, 'r');
        $file->setFlags(SplFileObject::READ_CSV | SplFileObject::SKIP_EMPTY | SplFileObject::DROP_NEW_LINE);
        $file->setCsvControl($delimiter);

        $count = 0;
        $file->next(); // skip header

        while (! $file->eof()) {
            $row = $file->current();
            $file->next();
            if ($row !== false && $row !== [null]) {
                $count++;
            }
        }

        return $count;
    }

    private function inferType(array $stats): string
    {
        $nonNullCount = $stats['non_null_count'];

        if ($nonNullCount === 0) {
            return 'string';
        }

        $distinctCount = count($stats['values']);

        if ($stats['type_checks']['boolean']) {
            return 'boolean';
        }

        if ($stats['type_checks']['integer']) {
            return 'integer';
        }

        if ($stats['type_checks']['float']) {
            return 'float';
        }

        if ($stats['type_checks']['date']) {
            return 'date';
        }

        // If low cardinality relative to row count, consider it a code
        if ($distinctCount > 0 && $distinctCount <= 50 && $nonNullCount > 10 && ($distinctCount / $nonNullCount) < 0.05) {
            return 'code';
        }

        return 'string';
    }

    private function isInteger(string $value): bool
    {
        return preg_match('/^-?\d+$/', $value) === 1;
    }

    private function isBoolean(string $value): bool
    {
        return in_array(strtolower($value), ['0', '1', 'true', 'false', 'yes', 'no', 'y', 'n'], true);
    }

    private function isDate(string $value): bool
    {
        // Common date patterns
        $patterns = [
            '/^\d{4}-\d{2}-\d{2}$/',                        // YYYY-MM-DD
            '/^\d{2}\/\d{2}\/\d{4}$/',                      // MM/DD/YYYY
            '/^\d{2}-\d{2}-\d{4}$/',                        // MM-DD-YYYY
            '/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/',   // ISO datetime
            '/^\d{4}\d{2}\d{2}$/',                          // YYYYMMDD
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $value)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array{is_pii: bool, pii_type: string|null}
     */
    private function detectPii(string $columnName, array $piiMatches, int $nonNullCount): array
    {
        // Check column name heuristics
        $normalizedName = strtolower(str_replace(['-', ' '], '_', $columnName));
        foreach (self::PII_COLUMN_NAMES as $piiName) {
            if (str_contains($normalizedName, $piiName)) {
                return ['is_pii' => true, 'pii_type' => $piiName];
            }
        }

        // Check value pattern matches (require at least 10% match rate)
        if ($nonNullCount > 0) {
            foreach ($piiMatches as $piiType => $matchCount) {
                if (($matchCount / min($nonNullCount, 1000)) >= 0.1) {
                    return ['is_pii' => true, 'pii_type' => $piiType];
                }
            }
        }

        return ['is_pii' => false, 'pii_type' => null];
    }
}
