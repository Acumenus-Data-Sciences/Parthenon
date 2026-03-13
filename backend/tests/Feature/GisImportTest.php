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
}
