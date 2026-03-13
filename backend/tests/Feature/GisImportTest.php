<?php

namespace Tests\Feature;

use App\Services\GIS\GisImportService;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class GisImportTest extends TestCase
{
    private GisImportService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(GisImportService::class);
    }

    // -------------------------------------------------------------------------
    // Original 5 tests (preserved)
    // -------------------------------------------------------------------------

    public function test_preview_csv_returns_headers_and_sample_rows(): void
    {
        $csv = "FIPS,County,SVI_Score\n42001,Adams,0.45\n42003,Allegheny,0.62\n";
        $path = tempnam(sys_get_temp_dir(), 'gis_test_');
        file_put_contents($path, $csv);

        $preview = $this->service->previewFile($path, 'csv');

        $this->assertCount(3, $preview['headers']);
        $this->assertEquals(['FIPS', 'County', 'SVI_Score'], $preview['headers']);
        $this->assertCount(2, $preview['rows']);
        $this->assertEquals('42001', $preview['rows'][0]['FIPS']);

        unlink($path);
    }

    public function test_iterate_file_streams_rows(): void
    {
        $csv = "A,B\n1,x\n2,y\n3,z\n";
        $path = tempnam(sys_get_temp_dir(), 'gis_test_');
        file_put_contents($path, $csv);

        $rows = [];
        foreach ($this->service->iterateFile($path, 'csv') as $row) {
            $rows[] = $row;
        }

        $this->assertCount(3, $rows);
        $this->assertEquals('1', $rows[0]['A']);
        $this->assertEquals('z', $rows[2]['B']);

        unlink($path);
    }

    public function test_detect_geography_code_type(): void
    {
        $this->assertEquals('fips_county', $this->service->detectGeoCodeType(['42001', '42003', '36061']));
        $this->assertEquals('fips_tract', $this->service->detectGeoCodeType(['42001000100', '42003010200']));
        $this->assertEquals('iso_country', $this->service->detectGeoCodeType(['USA', 'GBR', 'FRA']));
        $this->assertEquals('custom', $this->service->detectGeoCodeType(['ABC123', 'XYZ789']));
    }

    public function test_column_stats_computes_numeric_statistics(): void
    {
        $headers = ['value', 'name'];
        $rows = [
            ['value' => '10', 'name' => 'A'],
            ['value' => '20', 'name' => 'B'],
            ['value' => '30', 'name' => 'A'],
        ];

        $stats = $this->service->columnStats($headers, $rows);

        $this->assertTrue($stats['value']['is_numeric']);
        $this->assertEquals(10, $stats['value']['min']);
        $this->assertEquals(30, $stats['value']['max']);
        $this->assertEquals(20, $stats['value']['mean']);
        $this->assertFalse($stats['name']['is_numeric']);
        $this->assertEquals(2, $stats['name']['distinct_count']);
    }

    public function test_excel_format_throws_helpful_error(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Excel support coming soon');
        $this->service->previewFile('/tmp/test.xlsx', 'xlsx');
    }

    // -------------------------------------------------------------------------
    // File Parsing Tests
    // -------------------------------------------------------------------------

    public function test_preview_csv_with_utf8_bom_strips_bom(): void
    {
        $path = base_path('tests/fixtures/imports/messy/bom-utf8.csv');

        $preview = $this->service->previewFile($path, 'csv');

        // BOM (EF BB BF) must be stripped — first header should be plain "FIPS"
        $this->assertEquals('FIPS', $preview['headers'][0]);
        $this->assertEquals(['FIPS', 'County', 'Value'], $preview['headers']);
        $this->assertStringNotContainsString("\xEF\xBB\xBF", $preview['headers'][0]);
    }

    public function test_preview_csv_with_quoted_commas(): void
    {
        $path = base_path('tests/fixtures/imports/messy/quoted-commas.csv');

        $preview = $this->service->previewFile($path, 'csv');

        // Commas inside quotes must not split columns — should have exactly 4 headers
        $this->assertCount(4, $preview['headers']);
        $this->assertEquals(['id', 'name', 'description', 'value'], $preview['headers']);

        // Values with commas inside quotes should be preserved as single field
        $this->assertEquals('Adams, County', $preview['rows'][0]['name']);
        $this->assertEquals('Rural area, low population', $preview['rows'][0]['description']);
    }

    public function test_iterate_file_skips_mismatched_columns(): void
    {
        // Row 2 has too few columns, row 4 has too many — only rows 1 and 3 match
        $csv = "A,B,C\n1,x,foo\n2,y\n3,z,bar\n4,w,baz,extra\n";
        $path = tempnam(sys_get_temp_dir(), 'gis_test_');
        file_put_contents($path, $csv);

        $rows = [];
        foreach ($this->service->iterateFile($path, 'csv') as $row) {
            $rows[] = $row;
        }

        $this->assertCount(2, $rows);
        $this->assertEquals('1', $rows[0]['A']);
        $this->assertEquals('3', $rows[1]['A']);

        unlink($path);
    }

    public function test_preview_empty_file_throws_exception(): void
    {
        $path = base_path('tests/fixtures/imports/adversarial/empty.csv');

        $this->expectException(\RuntimeException::class);
        $this->service->previewFile($path, 'csv');
    }

    public function test_preview_headers_only_returns_empty_rows(): void
    {
        $path = base_path('tests/fixtures/imports/adversarial/headers-only.csv');

        $preview = $this->service->previewFile($path, 'csv');

        $this->assertCount(3, $preview['headers']);
        $this->assertEquals(['FIPS', 'County', 'Value'], $preview['headers']);
        $this->assertCount(0, $preview['rows']);
        $this->assertEquals(0, $preview['row_count']);
    }

    public function test_preview_tsv_format(): void
    {
        $tsv = "FIPS\tCounty\tSVI_Score\n42001\tAdams\t0.45\n42003\tAllegheny\t0.62\n";
        $path = tempnam(sys_get_temp_dir(), 'gis_tsv_');
        file_put_contents($path, $tsv);

        $preview = $this->service->previewFile($path, 'tsv');

        $this->assertCount(3, $preview['headers']);
        $this->assertEquals(['FIPS', 'County', 'SVI_Score'], $preview['headers']);
        $this->assertCount(2, $preview['rows']);
        $this->assertEquals('42001', $preview['rows'][0]['FIPS']);
        $this->assertEquals('Adams', $preview['rows'][0]['County']);

        unlink($path);
    }

    // -------------------------------------------------------------------------
    // Encoding Tests
    // -------------------------------------------------------------------------

    public function test_preview_latin1_auto_converts_to_utf8(): void
    {
        $path = base_path('tests/fixtures/imports/messy/latin1-fips.csv');

        $preview = $this->service->previewFile($path, 'csv');

        // All header and row values must be valid UTF-8 after conversion
        foreach ($preview['headers'] as $header) {
            $this->assertTrue(mb_check_encoding($header, 'UTF-8'), "Header '{$header}' is not valid UTF-8");
        }
        foreach ($preview['rows'] as $row) {
            foreach ($row as $key => $value) {
                $this->assertTrue(mb_check_encoding((string) $value, 'UTF-8'), "Value '{$value}' in column '{$key}' is not valid UTF-8");
            }
        }

        // Verify the accented characters are correctly converted (é = U+00E9)
        $countyValues = array_column($preview['rows'], 'County');
        $this->assertStringContainsString('é', $countyValues[0]); // Montréal
    }

    public function test_iterate_latin1_file_converts_encoding(): void
    {
        $path = base_path('tests/fixtures/imports/messy/latin1-fips.csv');

        $rows = [];
        foreach ($this->service->iterateFile($path, 'csv') as $row) {
            $rows[] = $row;
        }

        $this->assertNotEmpty($rows);

        // All yielded values must be valid UTF-8
        foreach ($rows as $row) {
            foreach ($row as $key => $value) {
                $this->assertTrue(mb_check_encoding((string) $value, 'UTF-8'), "Value '{$value}' in column '{$key}' is not valid UTF-8");
            }
        }

        // Confirm accented character is present after conversion
        $this->assertStringContainsString('é', $rows[0]['County']); // Montréal
    }

    // -------------------------------------------------------------------------
    // Geography Detection Tests (expanded)
    // -------------------------------------------------------------------------

    public function test_detect_fips_state_codes(): void
    {
        $result = $this->service->detectGeoCodeType(['01', '06', '36']);
        $this->assertEquals('fips_state', $result);
    }

    public function test_detect_iso_country_2_letter(): void
    {
        $result = $this->service->detectGeoCodeType(['US', 'GB', 'FR']);
        $this->assertEquals('iso_country_2', $result);
    }

    public function test_detect_geo_code_empty_array(): void
    {
        $result = $this->service->detectGeoCodeType([]);
        $this->assertEquals('custom', $result);
    }

    public function test_detect_geo_code_with_nulls(): void
    {
        // Nulls and empty strings should be filtered; remaining codes should detect fips_county
        $result = $this->service->detectGeoCodeType([null, '', '42001', '42003']);
        $this->assertEquals('fips_county', $result);
    }

    public function test_detect_geo_code_mixed_formats(): void
    {
        // Mix of numeric FIPS and alpha codes — no consistent pattern → custom
        $result = $this->service->detectGeoCodeType(['42001', 'ABC', '123']);
        $this->assertEquals('custom', $result);
    }

    // -------------------------------------------------------------------------
    // Column Stats Tests (expanded)
    // -------------------------------------------------------------------------

    public function test_column_stats_handles_all_null_column(): void
    {
        $headers = ['id', 'notes'];
        $rows = [
            ['id' => '1', 'notes' => ''],
            ['id' => '2', 'notes' => ''],
            ['id' => '3', 'notes' => null],
        ];

        $stats = $this->service->columnStats($headers, $rows);

        $this->assertEquals(3, $stats['notes']['null_count']);
        $this->assertFalse($stats['notes']['is_numeric']);
    }

    public function test_column_stats_single_row(): void
    {
        $headers = ['fips', 'score'];
        $rows = [
            ['fips' => '42001', 'score' => '0.75'],
        ];

        $stats = $this->service->columnStats($headers, $rows);

        $this->assertEquals(1, $stats['fips']['distinct_count']);
        $this->assertTrue($stats['score']['is_numeric']);
        $this->assertEquals(0.75, $stats['score']['min']);
        $this->assertEquals(0.75, $stats['score']['max']);
        $this->assertEquals(0.75, $stats['score']['mean']);
    }

    public function test_column_stats_with_mixed_numeric_strings(): void
    {
        // Only 2 of 4 values (50%) are numeric — below 80% threshold → is_numeric = false
        $headers = ['value'];
        $rows = [
            ['value' => '10'],
            ['value' => 'N/A'],
            ['value' => '20'],
            ['value' => ''],
        ];

        $stats = $this->service->columnStats($headers, $rows);

        $this->assertFalse($stats['value']['is_numeric']);
    }

    // -------------------------------------------------------------------------
    // Edge Cases
    // -------------------------------------------------------------------------

    public function test_preview_binary_file_handles_gracefully(): void
    {
        $path = base_path('tests/fixtures/imports/adversarial/binary-as-csv.csv');

        // Should either throw a RuntimeException or return without crashing.
        // The service must not produce a fatal error or uncaught exception of unexpected type.
        try {
            $result = $this->service->previewFile($path, 'csv');
            // If it returns, the result must at least be an array
            $this->assertIsArray($result);
        } catch (\RuntimeException $e) {
            // Expected — fgetcsv on binary content may fail to read headers
            $this->assertNotEmpty($e->getMessage());
        } catch (\InvalidArgumentException $e) {
            // Also acceptable
            $this->assertNotEmpty($e->getMessage());
        }
    }

    public function test_preview_injection_headers_are_raw_strings(): void
    {
        $path = base_path('tests/fixtures/imports/adversarial/injection-headers.csv');

        $preview = $this->service->previewFile($path, 'csv');

        // The service should return headers as raw strings without modification.
        // Sanitization is the controller's responsibility, not the service's.
        $this->assertCount(4, $preview['headers']);
        $this->assertContains("'; DROP TABLE users;--", $preview['headers']);
        $this->assertContains('<script>alert(1)</script>', $preview['headers']);
    }

    public function test_preview_respects_max_rows_limit(): void
    {
        // Build a CSV with 100 data rows
        $lines = ["col_a,col_b,col_c"];
        for ($i = 1; $i <= 100; $i++) {
            $lines[] = "{$i},value_{$i},extra_{$i}";
        }
        $csv = implode("\n", $lines) . "\n";
        $path = tempnam(sys_get_temp_dir(), 'gis_maxrows_');
        file_put_contents($path, $csv);

        $preview = $this->service->previewFile($path, 'csv', 5);

        $this->assertCount(5, $preview['rows']);
        $this->assertEquals(5, $preview['row_count']);

        // Verify it's the first 5 rows
        $this->assertEquals('1', $preview['rows'][0]['col_a']);
        $this->assertEquals('5', $preview['rows'][4]['col_a']);

        unlink($path);
    }
}
