<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Phase 19 Plan 02 (Wave 1) — register the census_ua_2020 dataset row in
 * app.gis_datasets. Plan 03's load_ua_county.py reads this row to
 * determine the source_url, file_path, and feature_count expected.
 *
 * Idempotent via slug uniqueness: re-running updates timestamps but
 * preserves any feature_count drift the loader may have written.
 *
 * Decisions enforced:
 *   D-06: status='pending' until Plan 03's loader flips it to 'loaded'
 *         after a successful import.
 */
return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('gis_datasets')->updateOrInsert(
            ['slug' => 'census_ua_2020'],
            [
                'name' => 'Census 2020 Urban Area County Dataset',
                'description' => 'Census Bureau official 2020 UA delineation, 3,234 county rows. '
                    .'Source: 2020_UA_COUNTY.xlsx (10 MB, repo root). '
                    .'Loader: scripts/gis/load_ua_county.py (Plan 03). '
                    .'CT_2022 sheet skipped per D-06.',
                'source' => 'census-bureau',
                'source_version' => '2020',
                'source_url' => 'https://www2.census.gov/geo/docs/reference/ua/2020_UA_COUNTY.xlsx',
                'data_type' => 'tabular',
                'geometry_type' => null,
                'file_path' => '2020_UA_COUNTY.xlsx',
                'feature_count' => 3234,
                'status' => 'pending',
                'updated_at' => $now,
                // Preserve original created_at on re-run; only set on first insert.
                'created_at' => DB::raw(
                    "COALESCE((SELECT created_at FROM app.gis_datasets WHERE slug='census_ua_2020'), NOW())"
                ),
            ],
        );
    }

    public function down(): void
    {
        DB::table('gis_datasets')->where('slug', 'census_ua_2020')->delete();
    }
};
