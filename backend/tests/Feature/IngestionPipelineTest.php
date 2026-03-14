<?php

namespace Tests\Feature;

use App\Services\Ingestion\CsvProfilerService;
use Tests\TestCase;

class IngestionPipelineTest extends TestCase
{
    private CsvProfilerService $profiler;

    protected function setUp(): void
    {
        parent::setUp();
        $this->profiler = app(CsvProfilerService::class);
    }

    // -------------------------------------------------------------------------
    // CsvProfiler: Column Stats
    // -------------------------------------------------------------------------

    public function test_profile_returns_column_stats_for_each_column(): void
    {
        $path = base_path('tests/fixtures/imports/golden/clinical-data.csv');

        $result = $this->profiler->profile($path);

        // golden/clinical-data.csv has 7 columns
        $this->assertCount(7, $result);

        $expectedKeys = [
            'column_name', 'column_index', 'inferred_type',
            'non_null_count', 'null_count', 'null_percentage',
            'distinct_count', 'distinct_percentage',
            'top_values', 'sample_values', 'statistics',
            'is_potential_pii', 'pii_type',
        ];

        foreach ($result as $colStat) {
            foreach ($expectedKeys as $key) {
                $this->assertArrayHasKey($key, $colStat, "Column stat missing key: {$key}");
            }
        }

        $names = array_column($result, 'column_name');
        $this->assertContains('patient_id', $names);
        $this->assertContains('gender', $names);
        $this->assertContains('condition_code', $names);
    }

    public function test_profile_detects_numeric_columns(): void
    {
        $path = base_path('tests/fixtures/imports/adversarial/no-geo.csv');

        $result = $this->profiler->profile($path);
        $byName = $this->indexByName($result);

        // price (9.99, 14.99) → float; quantity (100, 50) → integer
        $this->assertContains($byName['price']['inferred_type'], ['float', 'integer'],
            'price should be a numeric type');
        $this->assertEquals('integer', $byName['quantity']['inferred_type']);

        // product_name is not numeric
        $this->assertEquals('string', $byName['product_name']['inferred_type']);
    }

    public function test_profile_detects_date_columns(): void
    {
        $path = base_path('tests/fixtures/imports/golden/clinical-data.csv');

        $result = $this->profiler->profile($path);
        $byName = $this->indexByName($result);

        $this->assertEquals('date', $byName['date_of_birth']['inferred_type']);
        $this->assertEquals('date', $byName['visit_date']['inferred_type']);
    }

    public function test_profile_computes_distinct_count(): void
    {
        $path = base_path('tests/fixtures/imports/golden/clinical-data.csv');

        $result = $this->profiler->profile($path);
        $byName = $this->indexByName($result);

        // gender column has 2 distinct values: M, F
        $this->assertEquals(2, $byName['gender']['distinct_count']);

        // All 5 patient_ids are distinct
        $this->assertEquals(5, $byName['patient_id']['distinct_count']);
    }

    public function test_profile_computes_null_count(): void
    {
        $path = base_path('tests/fixtures/imports/messy/mixed-types.csv');

        $result = $this->profiler->profile($path);
        $byName = $this->indexByName($result);

        // Row 3 has empty value for "value" column; also N/A is non-empty string, not null
        // Row 3: id=3, value='', date='Jan 15 2024', code='C003'
        // Row 4: id=4, value='25', date='2024-03-10', code=''
        // "value" column: row 3 is empty string → null_count >= 1
        $this->assertGreaterThanOrEqual(1, $byName['value']['null_count']);

        // "code" column: row 4 is empty → null_count >= 1
        $this->assertGreaterThanOrEqual(1, $byName['code']['null_count']);
    }

    public function test_profile_handles_empty_file(): void
    {
        $path = base_path('tests/fixtures/imports/adversarial/empty.csv');

        $result = $this->profiler->profile($path);

        // Empty file (0 bytes) → no headers → return empty array
        $this->assertIsArray($result);
        $this->assertEmpty($result);
    }

    public function test_profile_handles_headers_only(): void
    {
        $path = base_path('tests/fixtures/imports/adversarial/headers-only.csv');

        $result = $this->profiler->profile($path);

        // headers-only.csv has 3 columns: FIPS, County, Value
        $this->assertCount(3, $result);

        foreach ($result as $colStat) {
            $this->assertEquals(0, $colStat['non_null_count']);
            $this->assertEquals(0, $colStat['null_count']);
            $this->assertEquals(0, $colStat['distinct_count']);
            $this->assertEmpty($colStat['sample_values']);
        }
    }

    public function test_profile_tab_delimited(): void
    {
        $tsv = "col_a\tcol_b\tcol_c\n1\talpha\t0.1\n2\tbeta\t0.2\n3\tgamma\t0.3\n";
        $path = tempnam(sys_get_temp_dir(), 'profiler_tsv_');
        file_put_contents($path, $tsv);

        $result = $this->profiler->profile($path, 'tab');

        $this->assertCount(3, $result);
        $names = array_column($result, 'column_name');
        $this->assertEquals(['col_a', 'col_b', 'col_c'], $names);

        $byName = $this->indexByName($result);
        $this->assertEquals(3, $byName['col_a']['distinct_count']);
        $this->assertEquals(3, $byName['col_b']['non_null_count']);

        unlink($path);
    }

    // -------------------------------------------------------------------------
    // PII Detection Tests
    // -------------------------------------------------------------------------

    public function test_profile_detects_ssn_pattern(): void
    {
        $csv = "person_id,identifier\n1,123-45-6789\n2,987-65-4321\n3,111-22-3333\n";
        $path = tempnam(sys_get_temp_dir(), 'profiler_pii_ssn_');
        file_put_contents($path, $csv);

        $result = $this->profiler->profile($path);
        $byName = $this->indexByName($result);

        $this->assertTrue($byName['identifier']['is_potential_pii']);
        $this->assertEquals('ssn', $byName['identifier']['pii_type']);

        unlink($path);
    }

    public function test_profile_detects_email_pattern(): void
    {
        $csv = "user_id,contact\n1,alice@example.com\n2,bob@test.org\n3,carol@domain.net\n";
        $path = tempnam(sys_get_temp_dir(), 'profiler_pii_email_');
        file_put_contents($path, $csv);

        $result = $this->profiler->profile($path);
        $byName = $this->indexByName($result);

        $this->assertTrue($byName['contact']['is_potential_pii']);
        $this->assertEquals('email', $byName['contact']['pii_type']);

        unlink($path);
    }

    public function test_profile_detects_phone_pattern(): void
    {
        $csv = "id,phone_number\n1,(555)555-1234\n2,555-867-5309\n3,800-555-0199\n";
        $path = tempnam(sys_get_temp_dir(), 'profiler_pii_phone_');
        file_put_contents($path, $csv);

        $result = $this->profiler->profile($path);
        $byName = $this->indexByName($result);

        $this->assertTrue($byName['phone_number']['is_potential_pii']);
        $this->assertEquals('phone', $byName['phone_number']['pii_type']);

        unlink($path);
    }

    public function test_profile_detects_pii_by_column_name(): void
    {
        // Values are not PII-patterned, but column names are in the PII list
        $csv = "first_name,last_name,dob\nAlice,Smith,1990-01-15\nBob,Jones,1985-07-22\n";
        $path = tempnam(sys_get_temp_dir(), 'profiler_pii_colname_');
        file_put_contents($path, $csv);

        $result = $this->profiler->profile($path);
        $byName = $this->indexByName($result);

        $this->assertTrue($byName['first_name']['is_potential_pii']);
        $this->assertTrue($byName['last_name']['is_potential_pii']);
        $this->assertTrue($byName['dob']['is_potential_pii']);

        unlink($path);
    }

    public function test_profile_no_false_pii_on_regular_data(): void
    {
        $path = base_path('tests/fixtures/imports/adversarial/no-geo.csv');

        $result = $this->profiler->profile($path);

        foreach ($result as $colStat) {
            $this->assertFalse(
                $colStat['is_potential_pii'],
                "Column '{$colStat['column_name']}' was unexpectedly flagged as PII"
            );
        }
    }

    // -------------------------------------------------------------------------
    // Type Inference Tests
    // -------------------------------------------------------------------------

    public function test_profile_infers_integer_type(): void
    {
        $csv = "id,count\n1,10\n2,20\n3,30\n";
        $path = tempnam(sys_get_temp_dir(), 'profiler_int_');
        file_put_contents($path, $csv);

        $result = $this->profiler->profile($path);
        $byName = $this->indexByName($result);

        $this->assertEquals('integer', $byName['id']['inferred_type']);
        $this->assertEquals('integer', $byName['count']['inferred_type']);

        unlink($path);
    }

    public function test_profile_infers_float_type(): void
    {
        $csv = "id,score\n1,0.45\n2,0.67\n3,0.89\n";
        $path = tempnam(sys_get_temp_dir(), 'profiler_float_');
        file_put_contents($path, $csv);

        $result = $this->profiler->profile($path);
        $byName = $this->indexByName($result);

        $this->assertEquals('float', $byName['score']['inferred_type']);

        unlink($path);
    }

    public function test_profile_infers_string_type(): void
    {
        $csv = "id,description\n1,Red wide widget\n2,Blue narrow gadget\n3,Green tall doohickey\n";
        $path = tempnam(sys_get_temp_dir(), 'profiler_str_');
        file_put_contents($path, $csv);

        $result = $this->profiler->profile($path);
        $byName = $this->indexByName($result);

        $this->assertEquals('string', $byName['description']['inferred_type']);

        unlink($path);
    }

    public function test_profile_mixed_types_defaults_to_string(): void
    {
        // messy/mixed-types.csv: value column has "10.5", "N/A", "", "25", "high"
        $path = base_path('tests/fixtures/imports/messy/mixed-types.csv');

        $result = $this->profiler->profile($path);
        $byName = $this->indexByName($result);

        // N/A and "high" are non-numeric → float inference breaks → string
        $this->assertEquals('string', $byName['value']['inferred_type']);
    }

    // -------------------------------------------------------------------------
    // Edge Cases
    // -------------------------------------------------------------------------

    public function test_profile_large_column_count(): void
    {
        // Build a CSV with 50 columns and 20 data rows
        $headers = [];
        for ($c = 1; $c <= 50; $c++) {
            $headers[] = "col_{$c}";
        }

        $lines = [implode(',', $headers)];
        for ($r = 1; $r <= 20; $r++) {
            $values = [];
            for ($c = 1; $c <= 50; $c++) {
                $values[] = "val_{$r}_{$c}";
            }
            $lines[] = implode(',', $values);
        }

        $path = tempnam(sys_get_temp_dir(), 'profiler_wide_');
        file_put_contents($path, implode("\n", $lines)."\n");

        $start = microtime(true);
        $result = $this->profiler->profile($path);
        $elapsed = microtime(true) - $start;

        $this->assertCount(50, $result);
        $this->assertLessThan(5.0, $elapsed, 'Profiling 50 columns should complete within 5 seconds');

        unlink($path);
    }

    public function test_profile_single_column_csv(): void
    {
        $csv = "score\n10\n20\n30\n40\n";
        $path = tempnam(sys_get_temp_dir(), 'profiler_single_');
        file_put_contents($path, $csv);

        $result = $this->profiler->profile($path);

        $this->assertCount(1, $result);
        $this->assertEquals('score', $result[0]['column_name']);
        $this->assertEquals(0, $result[0]['column_index']);
        $this->assertEquals(4, $result[0]['non_null_count']);
        $this->assertEquals('integer', $result[0]['inferred_type']);

        unlink($path);
    }

    // -------------------------------------------------------------------------
    // Helper
    // -------------------------------------------------------------------------

    /**
     * Re-index a profile result array by column_name for easy lookup.
     *
     * @param  array<int, array<string, mixed>>  $result
     * @return array<string, array<string, mixed>>
     */
    private function indexByName(array $result): array
    {
        $indexed = [];
        foreach ($result as $col) {
            $indexed[$col['column_name']] = $col;
        }

        return $indexed;
    }
}
