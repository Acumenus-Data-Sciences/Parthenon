<?php

use App\Services\Ingestion\CsvProfilerService;

describe('CsvProfilerService', function () {

    beforeEach(function () {
        $this->profiler = new CsvProfilerService;
        $this->tempDir = sys_get_temp_dir();
    });

    afterEach(function () {
        // Clean up temp CSV files created during tests
        foreach (glob($this->tempDir.'/csv_profiler_test_*.csv') as $file) {
            @unlink($file);
        }
    });

    /**
     * Helper: write a CSV to a temp file and return its path.
     */
    function writeTempCsv(array $headers, array $rows, string $tempDir): string
    {
        $path = $tempDir.'/csv_profiler_test_'.uniqid().'.csv';
        $fp = fopen($path, 'w');
        fputcsv($fp, $headers, ',', '"', '');
        foreach ($rows as $row) {
            fputcsv($fp, $row, ',', '"', '');
        }
        fclose($fp);

        return $path;
    }

    // ---------------------------------------------------------------
    // Type inference tests
    // ---------------------------------------------------------------

    it('infers integer type for columns with only integer values', function () {
        $path = writeTempCsv(
            ['id', 'count'],
            [['1', '100'], ['2', '200'], ['3', '300']],
            $this->tempDir
        );

        $results = $this->profiler->profile($path);

        expect($results[0]['inferred_type'])->toBe('integer')
            ->and($results[1]['inferred_type'])->toBe('integer');
    });

    it('infers float type for columns with decimal values', function () {
        $path = writeTempCsv(
            ['price'],
            [['19.99'], ['3.14'], ['100.5']],
            $this->tempDir
        );

        $results = $this->profiler->profile($path);

        expect($results[0]['inferred_type'])->toBe('float');
    });

    it('infers date type for columns with date-formatted values', function () {
        $path = writeTempCsv(
            ['start_date'],
            [['2024-01-15'], ['2024-02-20'], ['2024-03-25']],
            $this->tempDir
        );

        $results = $this->profiler->profile($path);

        expect($results[0]['inferred_type'])->toBe('date');
    });

    it('infers boolean type for columns with boolean-like values', function () {
        $path = writeTempCsv(
            ['active'],
            [['true'], ['false'], ['true'], ['false']],
            $this->tempDir
        );

        $results = $this->profiler->profile($path);

        expect($results[0]['inferred_type'])->toBe('boolean');
    });

    it('infers code type for low-cardinality categorical columns', function () {
        // Code detection requires: distinct <= 50, nonNull > 10, distinct/nonNull < 0.05
        // So we need at least 3 distinct values with > 60 rows (3/61 < 0.05)
        $rows = [];
        $codes = ['ICD10', 'CPT4', 'SNOMED'];
        for ($i = 0; $i < 90; $i++) {
            $rows[] = [$codes[$i % 3]];
        }

        $path = writeTempCsv(['vocabulary_id'], $rows, $this->tempDir);

        $results = $this->profiler->profile($path);

        expect($results[0]['inferred_type'])->toBe('code');
    });

    it('defaults to string type for free-text values', function () {
        $path = writeTempCsv(
            ['description'],
            [
                ['Patient presents with cough'],
                ['Follow-up for diabetes management'],
                ['Routine physical examination completed'],
                ['Chest pain reported during exercise'],
                ['Blood pressure slightly elevated today'],
            ],
            $this->tempDir
        );

        $results = $this->profiler->profile($path);

        expect($results[0]['inferred_type'])->toBe('string');
    });

    // ---------------------------------------------------------------
    // PII detection tests
    // ---------------------------------------------------------------

    it('detects SSN pattern in column names', function () {
        $path = writeTempCsv(
            ['patient_ssn'],
            [['some_value']],
            $this->tempDir
        );

        $results = $this->profiler->profile($path);

        expect($results[0]['is_potential_pii'])->toBeTrue()
            ->and($results[0]['pii_type'])->toBe('ssn');
    });

    it('detects email pattern in column names', function () {
        $path = writeTempCsv(
            ['contact_email'],
            [['test@example.com']],
            $this->tempDir
        );

        $results = $this->profiler->profile($path);

        expect($results[0]['is_potential_pii'])->toBeTrue()
            ->and($results[0]['pii_type'])->toBe('email');
    });

    it('detects phone pattern in column names', function () {
        $path = writeTempCsv(
            ['phone_number'],
            [['5551234567']],
            $this->tempDir
        );

        $results = $this->profiler->profile($path);

        expect($results[0]['is_potential_pii'])->toBeTrue()
            ->and($results[0]['pii_type'])->toBe('phone');
    });

    it('detects MRN pattern in column names', function () {
        $path = writeTempCsv(
            ['patient_mrn'],
            [['MRN-12345']],
            $this->tempDir
        );

        $results = $this->profiler->profile($path);

        expect($results[0]['is_potential_pii'])->toBeTrue()
            ->and($results[0]['pii_type'])->toBe('mrn');
    });

    it('does not flag non-PII column names', function () {
        $path = writeTempCsv(
            ['condition_concept_id'],
            [['4129519']],
            $this->tempDir
        );

        $results = $this->profiler->profile($path);

        expect($results[0]['is_potential_pii'])->toBeFalse()
            ->and($results[0]['pii_type'])->toBeNull();
    });
});
