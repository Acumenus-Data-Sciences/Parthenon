# GIS Data Import v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a flexible GIS data import system with AI-assisted column mapping via Abby, replacing the existing boundary-only `gis_datasets` panel.

**Architecture:** Laravel backend with `GisImportController` + `GisImportService` + `GisImportJob` (Horizon). FastAPI AI service handles geo format conversion and Abby column analysis. React frontend provides a 6-step wizard in the admin System Health page. Two databases: Docker PG for `gis_imports` tracking, local PG for GIS data tables.

**Tech Stack:** Laravel 11, PHP 8.4, Horizon, Spatie RBAC, FastAPI, geopandas/fiona, React 19, TypeScript, TanStack Query, Zustand

**Spec:** `docs/superpowers/specs/2026-03-12-gis-data-import-v2-design.md`

---

## File Structure

### Backend (Create)
- `backend/database/migrations/2026_03_12_000001_create_gis_imports_table.php` — Laravel migration replacing `gis_datasets`
- `backend/app/Models/App/GisImport.php` — Eloquent model for import tracking
- `backend/app/Http/Controllers/Api/V1/GisImportController.php` — 10 endpoints
- `backend/app/Http/Requests/GisImportUploadRequest.php` — Upload validation
- `backend/app/Http/Requests/GisImportMappingRequest.php` — Column mapping validation
- `backend/app/Http/Requests/GisImportConfigRequest.php` — Layer config validation
- `backend/app/Services/GIS/GisImportService.php` — Core import logic
- `backend/app/Services/GIS/AbbyGisService.php` — Abby integration (Ollama + ChromaDB)
- `backend/app/Jobs/GisImportJob.php` — Horizon async import
- `backend/tests/Feature/GisImportTest.php` — Controller feature tests
- `scripts/gis/alter_schema_v2.sql` — ALTER statements for global support + import_id columns

### Backend (Modify)
- `backend/routes/api.php` — Add import routes
- `backend/database/seeders/RolePermissionSeeder.php` — Add `gis.import`, `gis.import.manage`

### AI Service (Create)
- `ai/app/routers/gis_import.py` — FastAPI router for geo conversion + Abby analysis
- `ai/app/services/abby_gis_analyzer.py` — Column analysis with ChromaDB + Ollama

### AI Service (Modify)
- `ai/app/main.py` — Register new router
- `ai/requirements.txt` — Add geopandas, fiona, pyproj

### Frontend (Create)
- `frontend/src/features/administration/api/gisImportApi.ts` — API functions
- `frontend/src/features/administration/hooks/useGisImport.ts` — TanStack Query hooks
- `frontend/src/features/administration/types/gisImport.ts` — TypeScript types
- `frontend/src/features/administration/components/gis-import/ImportWizard.tsx` — Main wizard container
- `frontend/src/features/administration/components/gis-import/UploadStep.tsx` — Step 1
- `frontend/src/features/administration/components/gis-import/AnalyzeStep.tsx` — Step 2
- `frontend/src/features/administration/components/gis-import/MappingStep.tsx` — Step 3
- `frontend/src/features/administration/components/gis-import/ConfigureStep.tsx` — Step 4
- `frontend/src/features/administration/components/gis-import/ValidateStep.tsx` — Step 5
- `frontend/src/features/administration/components/gis-import/ImportStep.tsx` — Step 6

### Frontend (Modify)
- `frontend/src/features/administration/components/GisDataPanel.tsx` — Add "Data Import" tab

---

## Chunk 1: Database, Model, Permissions

### Task 1: GIS Schema ALTER Script

**Files:**
- Create: `scripts/gis/alter_schema_v2.sql`

- [ ] **Step 1: Write the ALTER script**

```sql
-- GIS Schema v2: Global support + import tracking
-- Run against local PG 17 (ohdsi database) as superuser

SET search_path TO gis, public, app;

-- 1. Expand location_type for international geographies
ALTER TABLE gis.geographic_location
    DROP CONSTRAINT IF EXISTS geographic_location_location_type_check;
ALTER TABLE gis.geographic_location
    ADD CONSTRAINT geographic_location_location_type_check
    CHECK (location_type IN (
        'census_tract', 'county', 'zip', 'zcta',
        'state', 'country', 'district', 'province',
        'nuts1', 'nuts2', 'nuts3',
        'custom'
    ));

-- 2. Make state_fips optional (non-US data won't have it)
ALTER TABLE gis.geographic_location
    ALTER COLUMN state_fips DROP NOT NULL,
    ALTER COLUMN state_fips DROP DEFAULT;

-- 3. Add import_id tracking columns
ALTER TABLE gis.geographic_location
    ADD COLUMN IF NOT EXISTS import_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_geo_loc_import
    ON gis.geographic_location(import_id);

ALTER TABLE gis.external_exposure
    ADD COLUMN IF NOT EXISTS import_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_ext_exp_import
    ON gis.external_exposure(import_id);

-- 4. Create gis_point_feature table
CREATE TABLE IF NOT EXISTS gis.gis_point_feature (
    point_feature_id    BIGSERIAL PRIMARY KEY,
    import_id           BIGINT NOT NULL,
    feature_type        VARCHAR(100) NOT NULL,
    feature_name        VARCHAR(500),
    latitude            DOUBLE PRECISION NOT NULL,
    longitude           DOUBLE PRECISION NOT NULL,
    geometry            GEOMETRY(Point, 4326) NOT NULL,
    properties          JSONB DEFAULT '{}',
    geographic_location_id BIGINT REFERENCES gis.geographic_location(geographic_location_id),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_point_feature_import
    ON gis.gis_point_feature(import_id);
CREATE INDEX IF NOT EXISTS idx_point_feature_type
    ON gis.gis_point_feature(feature_type);
CREATE INDEX IF NOT EXISTS idx_point_feature_geom
    ON gis.gis_point_feature USING GIST(geometry);
```

- [ ] **Step 2: Run the script against local PG**

Run: `psql -U smudoshi -d ohdsi -f scripts/gis/alter_schema_v2.sql`
Expected: All ALTER/CREATE statements succeed (IF NOT EXISTS = idempotent)

- [ ] **Step 3: Verify changes**

Run: `psql -U smudoshi -d ohdsi -c "\d gis.geographic_location" | head -20`
Expected: `state_fips` shows no `NOT NULL`, `import_id` column exists

- [ ] **Step 4: Commit**

```bash
git add scripts/gis/alter_schema_v2.sql
git commit -m "feat(gis): add schema v2 ALTER script for global support and import tracking"
```

---

### Task 2: Laravel Migration — `gis_imports` Table

**Files:**
- Create: `backend/database/migrations/2026_03_12_000001_create_gis_imports_table.php`
- Create: `backend/app/Models/App/GisImport.php`

- [ ] **Step 1: Write the migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('gis_datasets');

        Schema::create('gis_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->string('filename', 500);
            $table->string('import_mode', 50);
            $table->string('status', 50)->default('pending');
            $table->jsonb('column_mapping')->default('{}');
            $table->jsonb('abby_suggestions')->default('{}');
            $table->jsonb('config')->default('{}');
            $table->jsonb('summary_snapshot')->default('{}');
            $table->integer('row_count')->nullable();
            $table->integer('progress_percentage')->default(0);
            $table->jsonb('error_log')->default('[]');
            $table->text('log_output')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gis_imports');
    }
};
```

- [ ] **Step 2: Write the Eloquent model**

```php
<?php

namespace App\Models\App;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GisImport extends Model
{
    protected $table = 'gis_imports';

    protected $fillable = [
        'user_id',
        'filename',
        'import_mode',
        'status',
        'column_mapping',
        'abby_suggestions',
        'config',
        'summary_snapshot',
        'row_count',
        'progress_percentage',
        'error_log',
        'log_output',
        'started_at',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'column_mapping' => 'array',
            'abby_suggestions' => 'array',
            'config' => 'array',
            'summary_snapshot' => 'array',
            'error_log' => 'array',
            'row_count' => 'integer',
            'progress_percentage' => 'integer',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class);
    }

    public function appendLog(string $line): void
    {
        $timestamp = now()->format('H:i:s');
        $current = $this->log_output ?? '';
        $this->update(['log_output' => $current . "[{$timestamp}] {$line}\n"]);
    }

    public function markStatus(string $status, array $extra = []): void
    {
        $this->update(array_merge(['status' => $status], $extra));
    }
}
```

- [ ] **Step 3: Run migration**

Run: `docker compose exec php php artisan migrate`
Expected: `gis_datasets` dropped, `gis_imports` created

- [ ] **Step 4: Verify**

Run: `docker compose exec php php artisan tinker --execute="echo \App\Models\App\GisImport::query()->toSql();"`
Expected: `select * from "gis_imports"`

- [ ] **Step 5: Commit**

```bash
git add backend/database/migrations/2026_03_12_000001_create_gis_imports_table.php backend/app/Models/App/GisImport.php
git commit -m "feat(gis): add gis_imports table replacing gis_datasets"
```

---

### Task 3: Spatie Permissions — `gis.import` and `gis.import.manage`

**Files:**
- Modify: `backend/database/seeders/RolePermissionSeeder.php`

- [ ] **Step 1: Add permissions to the PERMISSIONS constant**

In `RolePermissionSeeder.php`, find the `'gis'` entry in the `PERMISSIONS` array and change:
```php
// OLD:
'gis' => ['view', 'load-data'],
// NEW:
'gis' => ['view', 'load-data', 'import', 'import.manage'],
```

- [ ] **Step 2: Add role assignments**

In the `ROLES` constant, add `gis.import` to the `admin` role's permission list (find existing `gis.view`, `gis.load-data` entries and add after them):
```php
// admin role: add 'gis.import', 'gis.import.manage'
// researcher role: add 'gis.import' (no manage)
```

- [ ] **Step 3: Re-seed permissions**

Run: `docker compose exec php php artisan db:seed --class=RolePermissionSeeder`
Expected: Permissions created, roles synced

- [ ] **Step 4: Verify**

Run: `docker compose exec php php artisan tinker --execute="echo \Spatie\Permission\Models\Permission::where('name', 'like', 'gis.import%')->pluck('name');"`
Expected: `["gis.import","gis.import.manage"]`

- [ ] **Step 5: Commit**

```bash
git add backend/database/seeders/RolePermissionSeeder.php
git commit -m "feat(gis): add gis.import and gis.import.manage Spatie permissions"
```

---

## Chunk 2: Backend Services

### Task 4: GisImportService — File Parsing & Geography Matching

**Files:**
- Create: `backend/app/Services/GIS/GisImportService.php`
- Create: `backend/tests/Feature/GisImportTest.php`

- [ ] **Step 1: Write failing test for file preview**

```php
<?php

namespace Tests\Feature;

use App\Models\App\GisImport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class GisImportTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolePermissionSeeder::class);
        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
    }

    public function test_preview_csv_returns_headers_and_sample_rows(): void
    {
        $csv = "FIPS,County,SVI_Score\n42001,Adams,0.45\n42003,Allegheny,0.62\n";
        $file = UploadedFile::fake()->createWithContent('test.csv', $csv);

        $service = app(\App\Services\GIS\GisImportService::class);
        $preview = $service->previewFile($file->getRealPath(), 'csv');

        $this->assertCount(3, $preview['headers']);
        $this->assertEquals(['FIPS', 'County', 'SVI_Score'], $preview['headers']);
        $this->assertCount(2, $preview['rows']);
        $this->assertEquals('42001', $preview['rows'][0]['FIPS']);
    }

    public function test_detect_geography_code_type(): void
    {
        $service = app(\App\Services\GIS\GisImportService::class);

        $this->assertEquals('fips_county', $service->detectGeoCodeType(['42001', '42003', '36061']));
        $this->assertEquals('fips_tract', $service->detectGeoCodeType(['42001000100', '42003010200']));
        $this->assertEquals('iso_country', $service->detectGeoCodeType(['USA', 'GBR', 'FRA']));
        $this->assertEquals('custom', $service->detectGeoCodeType(['ABC123', 'XYZ789']));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/pest tests/Feature/GisImportTest.php`
Expected: FAIL — class not found

- [ ] **Step 3: Write GisImportService**

```php
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
```

- [ ] **Step 4: Run tests**

Run: `cd backend && vendor/bin/pest tests/Feature/GisImportTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/GIS/GisImportService.php backend/tests/Feature/GisImportTest.php
git commit -m "feat(gis): add GisImportService with file parsing, geo matching, and rollback"
```

---

### Task 5: AbbyGisService — Ollama + ChromaDB Integration

**Files:**
- Create: `backend/app/Services/GIS/AbbyGisService.php`

- [ ] **Step 1: Write the service**

```php
<?php

namespace App\Services\GIS;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AbbyGisService
{
    private string $aiServiceUrl;

    public function __construct()
    {
        $this->aiServiceUrl = config('services.ai.url', 'http://python-ai:8000');
    }

    /**
     * Send file preview to Abby for column analysis.
     */
    public function analyzeColumns(array $headers, array $sampleRows, array $stats, string $filename): array
    {
        try {
            $response = Http::timeout(60)->post("{$this->aiServiceUrl}/gis-import/analyze", [
                'filename' => $filename,
                'headers' => $headers,
                'sample_rows' => array_slice($sampleRows, 0, 20),
                'column_stats' => $stats,
            ]);

            if ($response->successful()) {
                return $response->json();
            }

            Log::warning('Abby GIS analysis failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return $this->fallbackAnalysis($headers, $stats);
        } catch (\Throwable $e) {
            Log::warning('Abby GIS analysis error', ['error' => $e->getMessage()]);
            return $this->fallbackAnalysis($headers, $stats);
        }
    }

    /**
     * Ask Abby about a specific column.
     */
    public function askAboutColumn(string $columnName, array $sampleValues, array $stats, string $question): array
    {
        try {
            $response = Http::timeout(30)->post("{$this->aiServiceUrl}/gis-import/ask", [
                'column_name' => $columnName,
                'sample_values' => $sampleValues,
                'stats' => $stats,
                'question' => $question,
            ]);

            if ($response->successful()) {
                return $response->json();
            }

            return ['answer' => 'Abby is unavailable right now. Please map this column manually.'];
        } catch (\Throwable $e) {
            return ['answer' => 'Abby is unavailable right now. Please map this column manually.'];
        }
    }

    /**
     * Store confirmed mapping in ChromaDB.
     */
    public function storeConfirmedMapping(array $mapping): void
    {
        try {
            Http::timeout(10)->post("{$this->aiServiceUrl}/gis-import/learn", [
                'mappings' => $mapping,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to store Abby mapping', ['error' => $e->getMessage()]);
        }
    }

    /**
     * Convert geospatial file to GeoJSON via AI service.
     */
    public function convertGeoFile(string $filePath): array
    {
        $response = Http::timeout(120)
            ->attach('file', file_get_contents($filePath), basename($filePath))
            ->post("{$this->aiServiceUrl}/gis-import/convert");

        if (!$response->successful()) {
            throw new \RuntimeException('Geo file conversion failed: ' . $response->body());
        }

        return $response->json();
    }

    /**
     * Fallback: rule-based analysis when Abby is unavailable.
     */
    private function fallbackAnalysis(array $headers, array $stats): array
    {
        $suggestions = [];
        foreach ($headers as $col) {
            $lower = strtolower($col);
            $colStats = $stats[$col] ?? [];

            $purpose = 'metadata';
            $confidence = 0.3;
            $geoType = null;

            if (preg_match('/fips|geo_?code|geographic_?code/', $lower)) {
                $purpose = 'geography_code';
                $confidence = 0.8;
            } elseif (preg_match('/^lat(itude)?$/', $lower)) {
                $purpose = 'latitude';
                $confidence = 0.95;
            } elseif (preg_match('/^lo?ng(itude)?$/', $lower)) {
                $purpose = 'longitude';
                $confidence = 0.95;
            } elseif (preg_match('/county|state|country|region|name/', $lower)) {
                $purpose = 'geography_name';
                $confidence = 0.7;
            } elseif (($colStats['is_numeric'] ?? false) && ($colStats['distinct_count'] ?? 0) > 5) {
                $purpose = 'value';
                $confidence = 0.5;
            }

            $suggestions[] = [
                'column' => $col,
                'purpose' => $purpose,
                'geo_type' => $geoType,
                'confidence' => $confidence,
                'reasoning' => 'Rule-based fallback (Abby unavailable)',
            ];
        }

        return ['suggestions' => $suggestions, 'source' => 'fallback'];
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Services/GIS/AbbyGisService.php
git commit -m "feat(gis): add AbbyGisService for Ollama/ChromaDB column analysis"
```

---

### Task 6: GisImportJob — Horizon Async Processing

**Files:**
- Create: `backend/app/Jobs/GisImportJob.php`

- [ ] **Step 1: Write the job**

```php
<?php

namespace App\Jobs;

use App\Models\App\GisImport;
use App\Services\GIS\GisImportService;
use App\Services\GIS\AbbyGisService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
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

            if (!file_exists($filePath)) {
                throw new \RuntimeException("Import file not found: {$filePath}");
            }

            // Determine format
            $ext = strtolower(pathinfo($this->import->filename, PATHINFO_EXTENSION));
            $format = in_array($ext, ['csv', 'tsv']) ? $ext : 'geojson';

            // Find mapped columns from user-confirmed mapping
            $geoCodeCol = null;
            $geoNameCol = null;
            $valueCol = null;
            foreach ($mapping as $col => $target) {
                if ($target['purpose'] === 'geography_code') $geoCodeCol = $col;
                if ($target['purpose'] === 'geography_name') $geoNameCol = $col;
                if ($target['purpose'] === 'value') $valueCol = $col;
            }

            if (!$geoCodeCol) {
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
                    if ($geoNameCol && !empty($row[$geoNameCol])) {
                        $nameMap[$code] = $row[$geoNameCol];
                    }
                }
                $totalRows++;
            }
            $uniqueCodes = array_keys($codes);
            $this->import->update(['row_count' => $totalRows]);
            $this->import->appendLog("Found {$totalRows} rows, " . count($uniqueCodes) . " unique geographies");

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
            if (!empty($matchResult['unmatched'])) {
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

            // Second pass: stream rows and aggregate (no full load into memory)
            $this->import->appendLog('Importing data...');
            $summaryRows = [];
            $processed = 0;

            foreach ($importService->iterateFile($filePath, $format) as $row) {
                $code = $row[$geoCodeCol] ?? '';
                $geoId = $allGeoMap[$code] ?? null;
                if (!$geoId) continue;

                if ($valueCol) {
                    $value = is_numeric($row[$valueCol]) ? (float) $row[$valueCol] : null;
                    $exposureType = $config['exposure_type'] ?? $valueCol;

                    if (!isset($summaryRows[$code])) {
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
            if (!empty($summaryRows)) {
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
        // Clean up temp file on failure too
        $filePath = storage_path("app/gis-imports/{$this->import->id}/{$this->import->filename}");
        @unlink($filePath);

        $this->import->markStatus('failed', [
            'completed_at' => now(),
            'error_log' => [['time' => now()->toISOString(), 'message' => $e->getMessage()]],
        ]);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Jobs/GisImportJob.php
git commit -m "feat(gis): add GisImportJob for async Horizon import processing"
```

---

## Chunk 3: Backend API Controller & Routes

### Task 7: GisImportController — Form Requests

**Files:**
- Create: `backend/app/Http/Requests/GisImportUploadRequest.php`
- Create: `backend/app/Http/Requests/GisImportMappingRequest.php`
- Create: `backend/app/Http/Requests/GisImportConfigRequest.php`

- [ ] **Step 1: Write GisImportUploadRequest**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class GisImportUploadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => [
                'required',
                'file',
                'max:51200', // 50MB
                'mimes:csv,txt,xlsx,xls,json,zip,kml,gpkg',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'file.max' => 'Files over 50MB must be uploaded via CLI: php artisan gis:import <file>',
        ];
    }
}
```

- [ ] **Step 2: Write GisImportMappingRequest**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GisImportMappingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'mapping' => ['required', 'array'],
            'mapping.*.purpose' => ['required', Rule::in([
                'geography_code', 'geography_name', 'latitude', 'longitude',
                'value', 'metadata', 'skip',
            ])],
            'mapping.*.geo_type' => ['nullable', 'string'],
            'mapping.*.exposure_type' => ['nullable', 'string'],
        ];
    }
}
```

- [ ] **Step 3: Write GisImportConfigRequest**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class GisImportConfigRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'layer_name' => ['required', 'string', 'max:100'],
            'exposure_type' => ['required', 'string', 'max:50'],
            'geography_level' => ['required', 'string'],
            'value_type' => ['required', Rule::in(['continuous', 'categorical', 'binary'])],
            'aggregation' => ['required', Rule::in(['sum', 'mean', 'max', 'min', 'latest'])],
        ];
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/Http/Requests/GisImportUploadRequest.php backend/app/Http/Requests/GisImportMappingRequest.php backend/app/Http/Requests/GisImportConfigRequest.php
git commit -m "feat(gis): add Form Request validation for GIS import endpoints"
```

---

### Task 8: GisImportController + Routes

**Files:**
- Create: `backend/app/Http/Controllers/Api/V1/GisImportController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Write GisImportController**

```php
<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\GisImportUploadRequest;
use App\Http\Requests\GisImportMappingRequest;
use App\Http\Requests\GisImportConfigRequest;
use App\Jobs\GisImportJob;
use App\Models\App\GisImport;
use App\Services\GIS\AbbyGisService;
use App\Services\GIS\GisImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;

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
     * POST /gis/import/{id}/analyze — Trigger Abby column analysis.
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
     * POST /gis/import/{id}/ask — Ask Abby about a specific column.
     * Note: uses inline validation (simple 2-field check, not worth a dedicated FormRequest).
     */
    public function ask(GisImport $import, Request $request): JsonResponse
    {
        $this->authorizeImport($import);

        $validated = $request->validate([
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
     * PUT /gis/import/{id}/mapping — Save confirmed column mapping.
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
     * PUT /gis/import/{id}/config — Save layer configuration.
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
     * POST /gis/import/{id}/validate — Dry-run validation.
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

        if (!$geoCodeCol) {
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
     * POST /gis/import/{id}/execute — Start import job.
     */
    public function execute(GisImport $import): JsonResponse
    {
        $this->authorizeImport($import);

        if (!in_array($import->status, ['configured', 'mapped'])) {
            return response()->json(['error' => 'Import must be configured before execution'], 422);
        }

        GisImportJob::dispatch($import);
        $import->markStatus('queued');

        return response()->json(['data' => ['status' => 'queued', 'import_id' => $import->id]]);
    }

    /**
     * GET /gis/import/{id}/status — Poll job progress.
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
     * DELETE /gis/import/{id} — Rollback import.
     */
    public function rollback(GisImport $import): JsonResponse
    {
        if (!request()->user()->can('gis.import.manage') && $import->user_id !== request()->user()->id) {
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
     * POST /gis/import/{id}/learn — Store confirmed mappings in ChromaDB.
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

        if (!$request->user()->can('gis.import.manage')) {
            $query->where('user_id', $request->user()->id);
        }

        $imports = $query->paginate(20);

        return response()->json(['data' => $imports]);
    }

    // --- Helpers ---

    private function authorizeImport(GisImport $import): void
    {
        if ($import->user_id !== request()->user()->id && !request()->user()->can('gis.import.manage')) {
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
```

- [ ] **Step 2: Add routes to `backend/routes/api.php`**

Find the GIS routes section (after the `Route::prefix('gis')` blocks, around line 810) and add:

```php
// GIS Data Import (v2)
Route::prefix('gis/import')->middleware(['auth:sanctum', 'permission:gis.import', 'throttle:5,60'])->group(function () {
    // Non-parameterized routes FIRST (before {import} wildcard)
    Route::get('/history', [GisImportController::class, 'history']);
    Route::post('/upload', [GisImportController::class, 'upload']);

    // Parameterized routes
    Route::post('/{import}/analyze', [GisImportController::class, 'analyze']);
    Route::post('/{import}/ask', [GisImportController::class, 'ask']);
    Route::put('/{import}/mapping', [GisImportController::class, 'saveMapping']);
    Route::put('/{import}/config', [GisImportController::class, 'saveConfig']);
    Route::post('/{import}/validate', [GisImportController::class, 'validateImport']);
    Route::post('/{import}/execute', [GisImportController::class, 'execute']);
    Route::post('/{import}/learn', [GisImportController::class, 'learn']);
    Route::get('/{import}/status', [GisImportController::class, 'status']);
    Route::delete('/{import}', [GisImportController::class, 'rollback']);
});
```

Add the import at the top of `api.php`:
```php
use App\Http\Controllers\Api\V1\GisImportController;
```

- [ ] **Step 3: Run route list to verify**

Run: `docker compose exec php php artisan route:list --path=gis/import`
Expected: 10 routes listed under `gis/import`

- [ ] **Step 4: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/GisImportController.php backend/routes/api.php
git commit -m "feat(gis): add GisImportController with 10 endpoints and routes"
```

---

## Chunk 4: AI Service Endpoints

### Task 9: FastAPI Router for GIS Import

**Files:**
- Create: `ai/app/routers/gis_import.py`
- Create: `ai/app/services/abby_gis_analyzer.py`
- Modify: `ai/app/main.py`
- Modify: `ai/requirements.txt`

- [ ] **Step 1: Add dependencies to requirements.txt**

Append to `ai/requirements.txt`:
```
geopandas>=0.14.0
fiona>=1.9.0
pyproj>=3.6.0
chromadb>=0.4.0
```

- [ ] **Step 2: Write abby_gis_analyzer.py**

```python
"""Abby GIS column analyzer — Ollama + ChromaDB integration."""

import json
import logging
from typing import Any

import chromadb
import httpx

logger = logging.getLogger(__name__)

OLLAMA_URL = "http://ollama:11434"
CHROMA_COLLECTION = "gis_import_mappings"

ANALYZE_PROMPT = """You are Abby, a GIS data analysis assistant. Analyze these columns from a data file upload.

File: {filename}
Columns: {headers}
Sample data (first 20 rows):
{sample_rows}

Statistics:
{stats}

Previously seen patterns:
{similar_mappings}

For each column, determine:
1. Purpose: geography_code, geography_name, latitude, longitude, value, metadata, skip
2. If geography_code: what type? (fips_county, fips_tract, fips_state, iso_country, iso_subdivision, nuts, custom)
3. If value: what does it measure? Suggest an exposure_type name.
4. Confidence: 0.0 to 1.0
5. Reasoning: brief explanation

Respond ONLY with a JSON object:
{{"suggestions": [{{"column": "...", "purpose": "...", "geo_type": null, "exposure_type": null, "confidence": 0.9, "reasoning": "..."}}]}}"""


def _get_chroma_client() -> chromadb.Client:
    """Get or create ChromaDB client (persistent storage)."""
    return chromadb.PersistentClient(path="/app/data/chromadb")


def _get_collection(client: chromadb.Client) -> chromadb.Collection:
    """Get or create the GIS import mappings collection."""
    return client.get_or_create_collection(
        name=CHROMA_COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )


def search_similar_mappings(headers: list[str]) -> list[dict[str, Any]]:
    """Search ChromaDB for similar column names from past imports."""
    try:
        client = _get_chroma_client()
        collection = _get_collection(client)

        if collection.count() == 0:
            return []

        results = collection.query(
            query_texts=headers,
            n_results=min(3, collection.count()),
        )

        mappings = []
        if results and results.get("documents"):
            for docs in results["documents"]:
                for doc in docs:
                    try:
                        mappings.append(json.loads(doc))
                    except json.JSONDecodeError:
                        pass

        return mappings
    except Exception as e:
        logger.warning(f"ChromaDB search failed: {e}")
        return []


async def analyze_columns(
    filename: str,
    headers: list[str],
    sample_rows: list[dict[str, Any]],
    column_stats: dict[str, Any],
) -> dict[str, Any]:
    """Analyze columns using Ollama + ChromaDB."""

    # Search for similar past mappings
    similar = search_similar_mappings(headers)

    prompt = ANALYZE_PROMPT.format(
        filename=filename,
        headers=json.dumps(headers),
        sample_rows=json.dumps(sample_rows[:10], indent=2),
        stats=json.dumps(column_stats, indent=2),
        similar_mappings=json.dumps(similar, indent=2) if similar else "None found",
    )

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": "MedAIBase/MedGemma1.5:4b",
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                },
            )
            resp.raise_for_status()

            result = resp.json()
            response_text = result.get("response", "")

            parsed = json.loads(response_text)
            return {"suggestions": parsed.get("suggestions", []), "source": "abby"}

    except Exception as e:
        logger.warning(f"Ollama analysis failed: {e}")
        return {"suggestions": [], "source": "error", "error": str(e)}


async def ask_about_column(
    column_name: str,
    sample_values: list[Any],
    stats: dict[str, Any],
    question: str,
) -> dict[str, Any]:
    """Ask Abby about a specific column."""
    prompt = f"""You are Abby, a GIS data analysis assistant.

Column: {column_name}
Sample values: {json.dumps(sample_values[:10])}
Statistics: {json.dumps(stats)}

User question: {question}

Answer concisely and helpfully."""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": "MedAIBase/MedGemma1.5:4b",
                    "prompt": prompt,
                    "stream": False,
                },
            )
            resp.raise_for_status()
            return {"answer": resp.json().get("response", "")}
    except Exception as e:
        return {"answer": f"Abby is unavailable: {e}"}


def store_confirmed_mappings(mappings: list[dict[str, Any]]) -> int:
    """Store user-confirmed mappings in ChromaDB (curated learning)."""
    try:
        client = _get_chroma_client()
        collection = _get_collection(client)

        ids = []
        documents = []
        metadatas = []

        for m in mappings:
            col_name = m.get("column_name", "")
            doc = json.dumps(m)
            ids.append(f"mapping_{col_name}")
            documents.append(doc)
            metadatas.append({
                "column_name": col_name,
                "mapped_to": m.get("mapped_to", ""),
                "data_type": m.get("data_type", ""),
            })

        collection.upsert(ids=ids, documents=documents, metadatas=metadatas)
        return len(ids)
    except Exception as e:
        logger.warning(f"ChromaDB store failed: {e}")
        return 0
```

- [ ] **Step 3: Write gis_import.py router**

```python
"""GIS Import API router — file conversion + Abby analysis."""

import io
import json
import logging
import tempfile
from pathlib import Path
from typing import Any

import geopandas as gpd
from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel

from app.services.abby_gis_analyzer import (
    analyze_columns,
    ask_about_column,
    store_confirmed_mappings,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/gis-import", tags=["GIS Import"])


class AnalyzeRequest(BaseModel):
    filename: str
    headers: list[str]
    sample_rows: list[dict[str, Any]]
    column_stats: dict[str, Any]


class AskRequest(BaseModel):
    column_name: str
    sample_values: list[Any]
    stats: dict[str, Any]
    question: str


class LearnRequest(BaseModel):
    mappings: list[dict[str, Any]]


@router.post("/analyze")
async def analyze(req: AnalyzeRequest) -> dict[str, Any]:
    """Analyze columns using Abby (Ollama + ChromaDB)."""
    result = await analyze_columns(
        filename=req.filename,
        headers=req.headers,
        sample_rows=req.sample_rows,
        column_stats=req.column_stats,
    )
    return result


@router.post("/ask")
async def ask(req: AskRequest) -> dict[str, Any]:
    """Ask Abby about a specific column."""
    result = await ask_about_column(
        column_name=req.column_name,
        sample_values=req.sample_values,
        stats=req.stats,
        question=req.question,
    )
    return result


@router.post("/learn")
async def learn(req: LearnRequest) -> dict[str, Any]:
    """Store confirmed mappings in ChromaDB for curated learning."""
    count = store_confirmed_mappings(req.mappings)
    return {"stored": count}


@router.post("/convert")
async def convert_geo_file(file: UploadFile = File(...)) -> dict[str, Any]:
    """Convert geospatial file (Shapefile, KML, GeoPackage) to GeoJSON.

    Reprojects to EPSG:4326 if source CRS differs.
    """
    suffix = Path(file.filename or "upload").suffix.lower()
    allowed = {".zip", ".shp", ".geojson", ".json", ".kml", ".kmz", ".gpkg"}

    if suffix not in allowed:
        raise HTTPException(400, f"Unsupported format: {suffix}")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        if suffix == ".zip":
            gdf = gpd.read_file(f"zip://{tmp_path}")
        else:
            gdf = gpd.read_file(tmp_path)

        # Reproject to WGS84 if needed
        if gdf.crs and gdf.crs.to_epsg() != 4326:
            logger.info(f"Reprojecting from {gdf.crs} to EPSG:4326")
            gdf = gdf.to_crs(epsg=4326)

        geojson = json.loads(gdf.to_json())

        return {
            "type": "FeatureCollection",
            "features": geojson.get("features", []),
            "feature_count": len(gdf),
            "crs": "EPSG:4326",
            "columns": list(gdf.columns.drop("geometry", errors="ignore")),
        }
    except Exception as e:
        logger.error(f"Geo conversion failed: {e}")
        raise HTTPException(500, f"Conversion failed: {e}")
    finally:
        Path(tmp_path).unlink(missing_ok=True)
```

- [ ] **Step 4: Register router in main.py**

In `ai/app/main.py`, add the import and registration:

```python
from app.routers import gis_import
app.include_router(gis_import.router)  # prefix and tags defined in router itself
```

- [ ] **Step 5: Commit**

```bash
git add ai/app/routers/gis_import.py ai/app/services/abby_gis_analyzer.py ai/app/main.py ai/requirements.txt
git commit -m "feat(gis): add FastAPI endpoints for Abby analysis and geo file conversion"
```

---

## Chunk 5: Frontend — Types, API, Hooks

### Task 10: TypeScript Types

**Files:**
- Create: `frontend/src/features/administration/types/gisImport.ts`

- [ ] **Step 1: Write types**

```typescript
export type ImportStatus =
  | "pending"
  | "uploaded"
  | "analyzed"
  | "mapped"
  | "configured"
  | "queued"
  | "importing"
  | "complete"
  | "failed"
  | "rolled_back";

export type ColumnPurpose =
  | "geography_code"
  | "geography_name"
  | "latitude"
  | "longitude"
  | "value"
  | "metadata"
  | "skip";

export interface ColumnSuggestion {
  column: string;
  purpose: ColumnPurpose;
  geo_type: string | null;
  exposure_type: string | null;
  confidence: number;
  reasoning: string;
}

export interface ColumnMapping {
  [column: string]: {
    purpose: ColumnPurpose;
    geo_type?: string;
    exposure_type?: string;
  };
}

export interface ImportConfig {
  layer_name: string;
  exposure_type: string;
  geography_level: string;
  value_type: "continuous" | "categorical" | "binary";
  aggregation: "sum" | "mean" | "max" | "min" | "latest";
}

export interface GisImport {
  id: number;
  user_id: number;
  filename: string;
  import_mode: string;
  status: ImportStatus;
  column_mapping: ColumnMapping;
  abby_suggestions: { suggestions: ColumnSuggestion[]; source: string };
  config: ImportConfig | Record<string, never>;
  row_count: number | null;
  progress_percentage: number;
  log_output: string | null;
  error_log: Array<{ time: string; message: string }>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  user?: { id: number; name: string };
}

export interface UploadResult {
  import_id: number;
  filename: string;
  import_mode: string;
  preview: {
    headers: string[];
    rows: Record<string, string>[];
    row_count: number;
    encoding: string;
  };
}

export interface ValidationResult {
  total_rows: number;
  unique_geographies: number;
  matched: number;
  unmatched: number;
  match_rate: number;
  stubs_to_create: number;
  location_type: string;
}

export interface ImportWizardState {
  step: number;
  importId: number | null;
  preview: UploadResult["preview"] | null;
  suggestions: ColumnSuggestion[];
  mapping: ColumnMapping;
  config: Partial<ImportConfig>;
  validation: ValidationResult | null;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/administration/types/gisImport.ts
git commit -m "feat(gis): add TypeScript types for GIS import wizard"
```

---

### Task 11: API Functions + TanStack Query Hooks

**Files:**
- Create: `frontend/src/features/administration/api/gisImportApi.ts`
- Create: `frontend/src/features/administration/hooks/useGisImport.ts`

- [ ] **Step 1: Write API functions**

```typescript
import apiClient from "@/lib/api-client";
import type {
  UploadResult,
  ColumnSuggestion,
  ColumnMapping,
  ImportConfig,
  ValidationResult,
  GisImport,
} from "../types/gisImport";

const BASE = "/gis/import";

export async function uploadGisFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiClient.post(`${BASE}/upload`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
}

export async function analyzeImport(
  importId: number,
): Promise<{ suggestions: ColumnSuggestion[]; source: string }> {
  const { data } = await apiClient.post(`${BASE}/${importId}/analyze`);
  return data.data;
}

export async function askAbbyColumn(
  importId: number,
  column: string,
  question: string,
): Promise<{ answer: string }> {
  const { data } = await apiClient.post(`${BASE}/${importId}/ask`, {
    column,
    question,
  });
  return data.data;
}

export async function saveMapping(
  importId: number,
  mapping: ColumnMapping,
): Promise<void> {
  await apiClient.put(`${BASE}/${importId}/mapping`, { mapping });
}

export async function saveConfig(
  importId: number,
  config: ImportConfig,
): Promise<void> {
  await apiClient.put(`${BASE}/${importId}/config`, config);
}

export async function validateImport(
  importId: number,
): Promise<ValidationResult> {
  const { data } = await apiClient.post(`${BASE}/${importId}/validate`);
  return data.data;
}

export async function executeImport(
  importId: number,
): Promise<{ status: string; import_id: number }> {
  const { data } = await apiClient.post(`${BASE}/${importId}/execute`);
  return data.data;
}

export async function fetchImportStatus(importId: number): Promise<GisImport> {
  const { data } = await apiClient.get(`${BASE}/${importId}/status`);
  return data.data;
}

export async function rollbackImport(importId: number): Promise<void> {
  await apiClient.delete(`${BASE}/${importId}`);
}

export async function fetchImportHistory(): Promise<GisImport[]> {
  const { data } = await apiClient.get(`${BASE}/history`);
  return data.data.data; // paginated: { data: { data: [...] } }
}

export async function storeAbbyLearning(
  importId: number,
  mappings: Array<{
    column_name: string;
    mapped_to: string;
    source_description: string;
    data_type: string;
  }>,
): Promise<void> {
  await apiClient.post(`${BASE}/${importId}/learn`, { mappings });
}
```

- [ ] **Step 2: Write TanStack Query hooks**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  uploadGisFile,
  analyzeImport,
  askAbbyColumn,
  saveMapping,
  saveConfig,
  validateImport,
  executeImport,
  fetchImportStatus,
  rollbackImport,
  fetchImportHistory,
} from "../api/gisImportApi";
import type { ColumnMapping, ImportConfig } from "../types/gisImport";

const IMPORT_KEY = "gis-import";

export function useUploadGisFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadGisFile(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: [IMPORT_KEY] }),
  });
}

export function useAnalyzeImport() {
  return useMutation({
    mutationFn: (importId: number) => analyzeImport(importId),
  });
}

export function useAskAbbyColumn() {
  return useMutation({
    mutationFn: ({
      importId,
      column,
      question,
    }: {
      importId: number;
      column: string;
      question: string;
    }) => askAbbyColumn(importId, column, question),
  });
}

export function useSaveMapping() {
  return useMutation({
    mutationFn: ({
      importId,
      mapping,
    }: {
      importId: number;
      mapping: ColumnMapping;
    }) => saveMapping(importId, mapping),
  });
}

export function useSaveConfig() {
  return useMutation({
    mutationFn: ({
      importId,
      config,
    }: {
      importId: number;
      config: ImportConfig;
    }) => saveConfig(importId, config),
  });
}

export function useValidateImport() {
  return useMutation({
    mutationFn: (importId: number) => validateImport(importId),
  });
}

export function useExecuteImport() {
  return useMutation({
    mutationFn: (importId: number) => executeImport(importId),
  });
}

export function useImportStatus(importId: number | null) {
  return useQuery({
    queryKey: [IMPORT_KEY, "status", importId],
    queryFn: () => fetchImportStatus(importId!),
    enabled: importId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "importing" || status === "queued" ? 2000 : false;
    },
  });
}

export function useRollbackImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (importId: number) => rollbackImport(importId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [IMPORT_KEY] }),
  });
}

export function useImportHistory() {
  return useQuery({
    queryKey: [IMPORT_KEY, "history"],
    queryFn: fetchImportHistory,
    staleTime: 30_000,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/administration/api/gisImportApi.ts frontend/src/features/administration/hooks/useGisImport.ts
git commit -m "feat(gis): add GIS import API functions and TanStack Query hooks"
```

---

## Chunk 6: Frontend — Import Wizard Components

### Task 12: ImportWizard Container + UploadStep

**Files:**
- Create: `frontend/src/features/administration/components/gis-import/ImportWizard.tsx`
- Create: `frontend/src/features/administration/components/gis-import/UploadStep.tsx`

- [ ] **Step 1: Write ImportWizard**

```typescript
import { useState, useCallback } from "react";
import { Upload, Brain, Columns3, Settings, CheckCircle2, Loader2 } from "lucide-react";
import type {
  ImportWizardState,
  ColumnSuggestion,
  ColumnMapping,
  ImportConfig,
  ValidationResult,
  UploadResult,
} from "../../types/gisImport";
import { UploadStep } from "./UploadStep";
import { AnalyzeStep } from "./AnalyzeStep";
import { MappingStep } from "./MappingStep";
import { ConfigureStep } from "./ConfigureStep";
import { ValidateStep } from "./ValidateStep";
import { ImportStep } from "./ImportStep";

const STEPS = [
  { label: "Upload", icon: Upload },
  { label: "Analyze", icon: Brain },
  { label: "Map Columns", icon: Columns3 },
  { label: "Configure", icon: Settings },
  { label: "Validate", icon: CheckCircle2 },
  { label: "Import", icon: Loader2 },
];

export function ImportWizard() {
  const [state, setState] = useState<ImportWizardState>({
    step: 0,
    importId: null,
    preview: null,
    suggestions: [],
    mapping: {},
    config: {},
    validation: null,
  });

  const goTo = useCallback((step: number) => {
    setState((s) => ({ ...s, step }));
  }, []);

  const handleUploadComplete = useCallback((result: UploadResult) => {
    setState((s) => ({
      ...s,
      importId: result.import_id,
      preview: result.preview,
      step: 1,
    }));
  }, []);

  const handleAnalysisComplete = useCallback((suggestions: ColumnSuggestion[]) => {
    // Auto-apply high-confidence suggestions as initial mapping
    const autoMapping: ColumnMapping = {};
    for (const s of suggestions) {
      if (s.confidence >= 0.5) {
        autoMapping[s.column] = {
          purpose: s.purpose,
          geo_type: s.geo_type ?? undefined,
          exposure_type: s.exposure_type ?? undefined,
        };
      }
    }
    setState((s) => ({
      ...s,
      suggestions,
      mapping: autoMapping,
      step: 2,
    }));
  }, []);

  const handleMappingComplete = useCallback((mapping: ColumnMapping) => {
    setState((s) => ({ ...s, mapping, step: 3 }));
  }, []);

  const handleConfigComplete = useCallback((config: ImportConfig) => {
    setState((s) => ({ ...s, config, step: 4 }));
  }, []);

  const handleValidationComplete = useCallback((validation: ValidationResult) => {
    setState((s) => ({ ...s, validation, step: 5 }));
  }, []);

  const handleReset = useCallback(() => {
    setState({
      step: 0,
      importId: null,
      preview: null,
      suggestions: [],
      mapping: {},
      config: {},
      validation: null,
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === state.step;
          const isDone = i < state.step;
          return (
            <div key={s.label} className="flex items-center">
              <button
                onClick={() => i < state.step && goTo(i)}
                disabled={i >= state.step}
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs transition ${
                  isActive
                    ? "bg-[#C9A227]/20 text-[#C9A227]"
                    : isDone
                      ? "text-[#2DD4BF] hover:text-[#2DD4BF]/80 cursor-pointer"
                      : "text-[#5A5650]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`mx-1 h-px w-4 ${isDone ? "bg-[#2DD4BF]" : "bg-[#323238]"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      {state.step === 0 && <UploadStep onComplete={handleUploadComplete} />}
      {state.step === 1 && state.importId && (
        <AnalyzeStep importId={state.importId} onComplete={handleAnalysisComplete} />
      )}
      {state.step === 2 && state.importId && state.preview && (
        <MappingStep
          importId={state.importId}
          headers={state.preview.headers}
          suggestions={state.suggestions}
          mapping={state.mapping}
          onComplete={handleMappingComplete}
        />
      )}
      {state.step === 3 && state.importId && (
        <ConfigureStep
          importId={state.importId}
          suggestions={state.suggestions}
          onComplete={handleConfigComplete}
        />
      )}
      {state.step === 4 && state.importId && (
        <ValidateStep
          importId={state.importId}
          onComplete={handleValidationComplete}
          onBack={() => goTo(2)}
        />
      )}
      {state.step === 5 && state.importId && (
        <ImportStep
          importId={state.importId}
          mapping={state.mapping}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write UploadStep**

```typescript
import { useState, useRef, useCallback } from "react";
import { Upload, FileUp, FileText } from "lucide-react";
import { useUploadGisFile } from "../../hooks/useGisImport";
import type { UploadResult } from "../../types/gisImport";

const ACCEPTED_TYPES = ".csv,.tsv,.xlsx,.xls,.json,.geojson,.zip,.kml,.kmz,.gpkg";
const MAX_SIZE_MB = 50;

interface Props {
  onComplete: (result: UploadResult) => void;
}

export function UploadStep({ onComplete }: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadGisFile();

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(
          `File exceeds ${MAX_SIZE_MB}MB. Use CLI: php artisan gis:import ${file.name}`,
        );
        return;
      }

      try {
        const result = await upload.mutateAsync(file);
        onComplete(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      }
    },
    [upload, onComplete],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition ${
          isDragOver
            ? "border-[#C9A227] bg-[#C9A227]/5"
            : "border-[#323238] hover:border-[#5A5650]"
        }`}
      >
        {upload.isPending ? (
          <>
            <FileUp className="mb-2 h-8 w-8 animate-pulse text-[#C9A227]" />
            <p className="text-sm text-[#8A857D]">Uploading...</p>
          </>
        ) : (
          <>
            <Upload className="mb-2 h-8 w-8 text-[#5A5650]" />
            <p className="text-sm text-[#E8E4DC]">Drop a file here or click to browse</p>
            <p className="mt-1 text-xs text-[#5A5650]">
              CSV, TSV, Excel, Shapefile (.zip), GeoJSON, KML, GeoPackage — max {MAX_SIZE_MB}MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="hidden"
        />
      </div>

      {error && (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="rounded border border-[#232328] bg-[#0E0E11] p-4">
        <h4 className="mb-2 flex items-center gap-2 text-xs font-medium text-[#8A857D]">
          <FileText className="h-3.5 w-3.5" />
          For large files (&gt;{MAX_SIZE_MB}MB)
        </h4>
        <code className="block rounded bg-[#1C1C20] px-3 py-2 text-xs text-[#E8E4DC]">
          php artisan gis:import &lt;path-to-file&gt;
        </code>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/administration/components/gis-import/ImportWizard.tsx frontend/src/features/administration/components/gis-import/UploadStep.tsx
git commit -m "feat(gis): add ImportWizard container and UploadStep component"
```

---

### Task 13: AnalyzeStep + MappingStep

**Files:**
- Create: `frontend/src/features/administration/components/gis-import/AnalyzeStep.tsx`
- Create: `frontend/src/features/administration/components/gis-import/MappingStep.tsx`

- [ ] **Step 1: Write AnalyzeStep**

```typescript
import { useEffect } from "react";
import { Brain, Loader2 } from "lucide-react";
import { useAnalyzeImport } from "../../hooks/useGisImport";
import type { ColumnSuggestion } from "../../types/gisImport";

interface Props {
  importId: number;
  onComplete: (suggestions: ColumnSuggestion[]) => void;
}

export function AnalyzeStep({ importId, onComplete }: Props) {
  const analyze = useAnalyzeImport();

  useEffect(() => {
    if (!analyze.data && !analyze.isPending && !analyze.isError) {
      analyze.mutate(importId, {
        onSuccess: (data) => {
          onComplete(data.suggestions || []);
        },
      });
    }
  }, [importId, analyze, onComplete]);

  if (analyze.isError) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        <p>Abby encountered an issue analyzing this file.</p>
        <p className="mt-1 text-xs">{analyze.error instanceof Error ? analyze.error.message : "Unknown error"}</p>
        <button
          onClick={() => analyze.mutate(importId, { onSuccess: (d) => onComplete(d.suggestions || []) })}
          className="mt-2 rounded bg-[#232328] px-3 py-1 text-xs text-[#E8E4DC] hover:bg-[#323238]"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#C9A227]/10">
        {analyze.isPending ? (
          <Loader2 className="h-8 w-8 animate-spin text-[#C9A227]" />
        ) : (
          <Brain className="h-8 w-8 text-[#C9A227]" />
        )}
      </div>
      <p className="text-sm text-[#E8E4DC]">Abby is analyzing your data...</p>
      <p className="mt-1 text-xs text-[#5A5650]">Detecting column types, geography codes, and value semantics</p>
    </div>
  );
}
```

- [ ] **Step 2: Write MappingStep**

```typescript
import { useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, HelpCircle, MessageSquare } from "lucide-react";
import { useSaveMapping, useAskAbbyColumn } from "../../hooks/useGisImport";
import type { ColumnSuggestion, ColumnMapping, ColumnPurpose } from "../../types/gisImport";

const PURPOSE_OPTIONS: { value: ColumnPurpose; label: string }[] = [
  { value: "geography_code", label: "Geography Code" },
  { value: "geography_name", label: "Geography Name" },
  { value: "latitude", label: "Latitude" },
  { value: "longitude", label: "Longitude" },
  { value: "value", label: "Value (metric)" },
  { value: "metadata", label: "Metadata" },
  { value: "skip", label: "Skip" },
];

interface Props {
  importId: number;
  headers: string[];
  suggestions: ColumnSuggestion[];
  mapping: ColumnMapping;
  onComplete: (mapping: ColumnMapping) => void;
}

export function MappingStep({ importId, headers, suggestions, mapping: initialMapping, onComplete }: Props) {
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping);
  const [askingColumn, setAskingColumn] = useState<string | null>(null);
  const [abbyAnswer, setAbbyAnswer] = useState<string | null>(null);
  const saveMutation = useSaveMapping();
  const askMutation = useAskAbbyColumn();

  const getSuggestion = useCallback(
    (col: string) => suggestions.find((s) => s.column === col),
    [suggestions],
  );

  const handlePurposeChange = useCallback((col: string, purpose: ColumnPurpose) => {
    setMapping((prev) => ({
      ...prev,
      [col]: { ...prev[col], purpose },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    await saveMutation.mutateAsync({ importId, mapping });
    onComplete(mapping);
  }, [saveMutation, importId, mapping, onComplete]);

  const handleAskAbby = useCallback(
    async (col: string) => {
      setAskingColumn(col);
      setAbbyAnswer(null);
      const result = await askMutation.mutateAsync({
        importId,
        column: col,
        question: `What is this column "${col}" likely used for in a GIS dataset?`,
      });
      setAbbyAnswer(result.answer);
    },
    [askMutation, importId],
  );

  const confidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) return <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] text-green-400">High</span>;
    if (confidence >= 0.5) return <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">Medium</span>;
    return <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">Low</span>;
  };

  return (
    <div className="space-y-4">
      <div className="rounded border border-[#232328] bg-[#0E0E11]">
        <div className="border-b border-[#232328] px-4 py-2">
          <h3 className="text-sm font-medium text-[#E8E4DC]">Column Mapping</h3>
          <p className="text-xs text-[#5A5650]">Map each source column to its purpose</p>
        </div>

        <div className="divide-y divide-[#232328]">
          {headers.map((col) => {
            const suggestion = getSuggestion(col);
            const current = mapping[col];

            return (
              <div key={col} className="flex items-center gap-4 px-4 py-3">
                {/* Column name */}
                <div className="w-48 shrink-0">
                  <span className="font-mono text-sm text-[#E8E4DC]">{col}</span>
                  {suggestion && (
                    <div className="mt-0.5 flex items-center gap-1">
                      {confidenceBadge(suggestion.confidence)}
                    </div>
                  )}
                </div>

                {/* Purpose dropdown */}
                <select
                  value={current?.purpose ?? "skip"}
                  onChange={(e) => handlePurposeChange(col, e.target.value as ColumnPurpose)}
                  className="rounded border border-[#323238] bg-[#1C1C20] px-2 py-1 text-sm text-[#E8E4DC]"
                >
                  {PURPOSE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {/* Reasoning */}
                {suggestion?.reasoning && (
                  <span className="text-xs text-[#5A5650] truncate max-w-[200px]" title={suggestion.reasoning}>
                    {suggestion.reasoning}
                  </span>
                )}

                {/* Ask Abby */}
                <button
                  onClick={() => handleAskAbby(col)}
                  className="ml-auto shrink-0 rounded border border-[#323238] p-1 text-[#5A5650] hover:text-[#C9A227]"
                  title="Ask Abby"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Abby answer panel */}
      {askingColumn && (
        <div className="rounded border border-[#C9A227]/30 bg-[#C9A227]/5 p-3">
          <p className="text-xs font-medium text-[#C9A227]">Abby on "{askingColumn}":</p>
          {askMutation.isPending ? (
            <p className="mt-1 text-xs text-[#8A857D]">Thinking...</p>
          ) : abbyAnswer ? (
            <p className="mt-1 text-xs text-[#E8E4DC]">{abbyAnswer}</p>
          ) : null}
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="rounded bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#C9A227]/90 disabled:opacity-50"
        >
          {saveMutation.isPending ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/administration/components/gis-import/AnalyzeStep.tsx frontend/src/features/administration/components/gis-import/MappingStep.tsx
git commit -m "feat(gis): add AnalyzeStep and MappingStep wizard components"
```

---

### Task 14: ConfigureStep + ValidateStep + ImportStep

**Files:**
- Create: `frontend/src/features/administration/components/gis-import/ConfigureStep.tsx`
- Create: `frontend/src/features/administration/components/gis-import/ValidateStep.tsx`
- Create: `frontend/src/features/administration/components/gis-import/ImportStep.tsx`

- [ ] **Step 1: Write ConfigureStep**

```typescript
import { useState, useCallback } from "react";
import { useSaveConfig } from "../../hooks/useGisImport";
import type { ImportConfig, ColumnSuggestion } from "../../types/gisImport";

interface Props {
  importId: number;
  suggestions: ColumnSuggestion[];
  onComplete: (config: ImportConfig) => void;
}

export function ConfigureStep({ importId, suggestions, onComplete }: Props) {
  const valueSuggestion = suggestions.find((s) => s.purpose === "value");
  const geoSuggestion = suggestions.find((s) => s.purpose === "geography_code");

  const [config, setConfig] = useState<ImportConfig>({
    layer_name: valueSuggestion?.exposure_type ?? "",
    exposure_type: valueSuggestion?.exposure_type ?? "",
    geography_level: geoSuggestion?.geo_type === "fips_tract" ? "tract" : "county",
    value_type: "continuous",
    aggregation: "mean",
  });

  const saveMutation = useSaveConfig();

  const handleSave = useCallback(async () => {
    await saveMutation.mutateAsync({ importId, config });
    onComplete(config);
  }, [saveMutation, importId, config, onComplete]);

  const field = (label: string, children: React.ReactNode) => (
    <div>
      <label className="mb-1 block text-xs font-medium text-[#8A857D]">{label}</label>
      {children}
    </div>
  );

  const inputClass = "w-full rounded border border-[#323238] bg-[#1C1C20] px-3 py-1.5 text-sm text-[#E8E4DC]";

  return (
    <div className="space-y-4">
      <div className="rounded border border-[#232328] bg-[#0E0E11] p-4 space-y-4">
        {field("Layer Name", (
          <input
            type="text"
            value={config.layer_name}
            onChange={(e) => setConfig((c) => ({ ...c, layer_name: e.target.value }))}
            placeholder="e.g., Social Vulnerability Index"
            className={inputClass}
          />
        ))}
        {field("Exposure Type", (
          <input
            type="text"
            value={config.exposure_type}
            onChange={(e) => setConfig((c) => ({ ...c, exposure_type: e.target.value }))}
            placeholder="e.g., svi_overall"
            className={inputClass}
          />
        ))}
        {field("Geography Level", (
          <select
            value={config.geography_level}
            onChange={(e) => setConfig((c) => ({ ...c, geography_level: e.target.value }))}
            className={inputClass}
          >
            <option value="county">County</option>
            <option value="tract">Census Tract</option>
            <option value="state">State</option>
            <option value="country">Country</option>
            <option value="custom">Custom</option>
          </select>
        ))}
        {field("Value Type", (
          <select
            value={config.value_type}
            onChange={(e) => setConfig((c) => ({ ...c, value_type: e.target.value as ImportConfig["value_type"] }))}
            className={inputClass}
          >
            <option value="continuous">Continuous (choropleth)</option>
            <option value="categorical">Categorical (discrete colors)</option>
            <option value="binary">Binary (presence/absence)</option>
          </select>
        ))}
        {field("Aggregation", (
          <select
            value={config.aggregation}
            onChange={(e) => setConfig((c) => ({ ...c, aggregation: e.target.value as ImportConfig["aggregation"] }))}
            className={inputClass}
          >
            <option value="mean">Mean</option>
            <option value="sum">Sum</option>
            <option value="max">Maximum</option>
            <option value="min">Minimum</option>
            <option value="latest">Latest</option>
          </select>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending || !config.layer_name || !config.exposure_type}
          className="rounded bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#C9A227]/90 disabled:opacity-50"
        >
          {saveMutation.isPending ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write ValidateStep**

```typescript
import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useValidateImport } from "../../hooks/useGisImport";
import type { ValidationResult } from "../../types/gisImport";

interface Props {
  importId: number;
  onComplete: (result: ValidationResult) => void;
  onBack: () => void;
}

export function ValidateStep({ importId, onComplete, onBack }: Props) {
  const validate = useValidateImport();

  useEffect(() => {
    if (!validate.data && !validate.isPending && !validate.isError) {
      validate.mutate(importId);
    }
  }, [importId, validate]);

  if (validate.isPending) {
    return (
      <div className="flex flex-col items-center py-8">
        <Loader2 className="mb-2 h-8 w-8 animate-spin text-[#C9A227]" />
        <p className="text-sm text-[#8A857D]">Validating...</p>
      </div>
    );
  }

  if (validate.isError) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        Validation failed: {validate.error instanceof Error ? validate.error.message : "Unknown error"}
      </div>
    );
  }

  const result = validate.data;
  if (!result) return null;

  return (
    <div className="space-y-4">
      <div className="rounded border border-[#232328] bg-[#0E0E11] p-4">
        <h3 className="mb-3 text-sm font-medium text-[#E8E4DC]">Validation Results</h3>
        <div className="grid grid-cols-2 gap-4">
          <Stat label="Total Rows" value={result.total_rows} />
          <Stat label="Unique Geographies" value={result.unique_geographies} />
          <Stat label="Matched" value={result.matched} color="text-green-400" />
          <Stat label="Unmatched (stubs)" value={result.unmatched} color={result.unmatched > 0 ? "text-amber-400" : "text-green-400"} />
          <Stat label="Match Rate" value={`${result.match_rate}%`} />
          <Stat label="Geography Type" value={result.location_type} />
        </div>
      </div>

      {result.unmatched > 0 && (
        <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="text-xs text-amber-300">
            <p>{result.unmatched} geographies not found in the database. Stub entries will be created (no boundary geometry).</p>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="rounded border border-[#323238] px-4 py-2 text-sm text-[#8A857D] hover:border-[#5A5650]"
        >
          Back to Mapping
        </button>
        <button
          onClick={() => onComplete(result)}
          className="rounded bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#C9A227]/90"
        >
          Proceed with Import
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className="text-xs text-[#5A5650]">{label}</p>
      <p className={`text-lg font-semibold ${color ?? "text-[#E8E4DC]"}`}>{value}</p>
    </div>
  );
}
```

- [ ] **Step 3: Write ImportStep**

```typescript
import { useCallback, useState } from "react";
import { CheckCircle2, Loader2, ExternalLink, BookOpen } from "lucide-react";
import { useExecuteImport, useImportStatus } from "../../hooks/useGisImport";
import { storeAbbyLearning } from "../../api/gisImportApi";
import type { ColumnMapping } from "../../types/gisImport";

interface Props {
  importId: number;
  mapping: ColumnMapping;
  onReset: () => void;
}

export function ImportStep({ importId, mapping, onReset }: Props) {
  const [started, setStarted] = useState(false);
  const [saveLearning, setSaveLearning] = useState(true);
  const execute = useExecuteImport();
  const { data: status } = useImportStatus(started ? importId : null);

  const handleStart = useCallback(async () => {
    await execute.mutateAsync(importId);
    setStarted(true);
  }, [execute, importId]);

  const isRunning = status?.status === "importing" || status?.status === "queued";
  const isComplete = status?.status === "complete";
  const isFailed = status?.status === "failed";

  if (!started) {
    return (
      <div className="flex flex-col items-center py-8">
        <button
          onClick={handleStart}
          disabled={execute.isPending}
          className="rounded bg-[#C9A227] px-6 py-3 text-sm font-medium text-[#0E0E11] hover:bg-[#C9A227]/90 disabled:opacity-50"
        >
          {execute.isPending ? "Starting..." : "Start Import"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      {isRunning && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#C9A227]" />
            <span className="text-sm text-[#E8E4DC]">Importing... {status?.progress_percentage ?? 0}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#232328]">
            <div
              className="h-2 rounded-full bg-[#C9A227] transition-all"
              style={{ width: `${status?.progress_percentage ?? 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Log output */}
      {status?.log_output && (
        <div className="rounded border border-[#232328] bg-[#0A0A0F] p-3">
          <pre className="max-h-48 overflow-y-auto font-mono text-xs text-[#8A857D] whitespace-pre-wrap">
            {status.log_output}
          </pre>
        </div>
      )}

      {/* Complete */}
      {isComplete && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded border border-green-500/30 bg-green-500/10 p-3">
            <CheckCircle2 className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-sm font-medium text-green-400">Import Complete</p>
              <p className="text-xs text-green-300/70">{status.row_count} rows imported</p>
            </div>
          </div>

          {/* Learn prompt */}
          <div className="rounded border border-[#232328] bg-[#0E0E11] p-3">
            <label className="flex items-center gap-2 text-sm text-[#E8E4DC]">
              <input
                type="checkbox"
                checked={saveLearning}
                onChange={(e) => setSaveLearning(e.target.checked)}
                className="rounded border-[#323238]"
              />
              <BookOpen className="h-3.5 w-3.5 text-[#C9A227]" />
              Save mappings so Abby learns for next time
            </label>
            {saveLearning && (
              <button
                onClick={async () => {
                  const learnings = Object.entries(mapping).map(([col, m]) => ({
                    column_name: col,
                    mapped_to: m.exposure_type ?? m.purpose,
                    source_description: `Imported from ${status?.filename ?? "file"}`,
                    data_type: m.purpose === "value" ? "float" : "string",
                  }));
                  await storeAbbyLearning(importId, learnings);
                }}
                className="mt-2 rounded bg-[#232328] px-3 py-1 text-xs text-[#C9A227] hover:bg-[#323238]"
              >
                Save to Abby
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <a
              href="/gis"
              className="flex items-center gap-1.5 rounded bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#C9A227]/90"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View in GIS Explorer
            </a>
            <button
              onClick={onReset}
              className="rounded border border-[#323238] px-4 py-2 text-sm text-[#8A857D] hover:border-[#5A5650]"
            >
              Import Another
            </button>
          </div>
        </div>
      )}

      {/* Failed */}
      {isFailed && (
        <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          <p className="font-medium">Import Failed</p>
          {status.error_log?.map((e, i) => (
            <p key={i} className="mt-1 text-xs">{e.message}</p>
          ))}
          <button
            onClick={onReset}
            className="mt-3 rounded border border-red-500/30 px-3 py-1 text-xs hover:bg-red-500/10"
          >
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/administration/components/gis-import/ConfigureStep.tsx frontend/src/features/administration/components/gis-import/ValidateStep.tsx frontend/src/features/administration/components/gis-import/ImportStep.tsx
git commit -m "feat(gis): add ConfigureStep, ValidateStep, and ImportStep wizard components"
```

---

### Task 15: Integrate ImportWizard into GisDataPanel

**Files:**
- Modify: `frontend/src/features/administration/components/GisDataPanel.tsx`

- [ ] **Step 1: Add tab UI and import the wizard**

At the top of `GisDataPanel.tsx`, add:
```typescript
import { ImportWizard } from "./gis-import/ImportWizard";
```

Add tab state inside the component:
```typescript
const [activeTab, setActiveTab] = useState<"boundaries" | "import">("boundaries");
```

Wrap the existing panel content in a tab structure. After the header section (with the "GIS Boundary Data" title), add:

```typescript
{/* Tabs */}
<div className="flex gap-1 border-b border-[#232328] px-4">
  <button
    onClick={() => setActiveTab("boundaries")}
    className={`px-3 py-2 text-xs font-medium transition ${
      activeTab === "boundaries"
        ? "border-b-2 border-[#C9A227] text-[#C9A227]"
        : "text-[#5A5650] hover:text-[#8A857D]"
    }`}
  >
    Boundaries
  </button>
  <button
    onClick={() => setActiveTab("import")}
    className={`px-3 py-2 text-xs font-medium transition ${
      activeTab === "import"
        ? "border-b-2 border-[#C9A227] text-[#C9A227]"
        : "text-[#5A5650] hover:text-[#8A857D]"
    }`}
  >
    Data Import
  </button>
</div>
```

Then conditionally render the existing boundaries content vs the import wizard:
```typescript
{activeTab === "boundaries" ? (
  {/* existing boundary panel content */}
) : (
  <div className="p-4">
    <ImportWizard />
  </div>
)}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/administration/components/GisDataPanel.tsx
git commit -m "feat(gis): add Data Import tab to GisDataPanel with ImportWizard"
```

---

### Task 16: Build + Deploy

- [ ] **Step 1: Run linting**

Run: `cd frontend && npx eslint src/features/administration/components/gis-import/ src/features/administration/api/gisImportApi.ts src/features/administration/hooks/useGisImport.ts src/features/administration/types/gisImport.ts`
Expected: No errors (warnings OK)

- [ ] **Step 2: Run PHP analysis**

Run: `cd backend && vendor/bin/phpstan analyse app/Http/Controllers/Api/V1/GisImportController.php app/Services/GIS/GisImportService.php app/Services/GIS/AbbyGisService.php app/Jobs/GisImportJob.php app/Models/App/GisImport.php --level 6`
Expected: No errors (or baseline-eligible)

- [ ] **Step 3: Build frontend**

Run: `docker compose exec node sh -c "cd /app && npx vite build"`
Expected: Build succeeds

- [ ] **Step 4: Deploy**

Run: `./deploy.sh`
Expected: Caches cleared, migrations run, frontend built

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(gis): complete GIS Data Import v2 with Abby AI-assisted column mapping"
```
