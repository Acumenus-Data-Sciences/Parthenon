<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Phase 19 Plan 02 (Wave 1) — legacy gis audit checkpoint.
 *
 * Migration 2026_03_11_000002_create_gis_boundary_tables.php attempted to
 * create app.gis_admin_boundaries with a PostGIS geometry column. Its
 * postgisAvailable() guard ran before 2026_03_11_000001 had committed,
 * so on hosts where PostGIS was not yet installed the table was either
 * not created or created without the geometry column. Live verification
 * 2026-04-26 against parthenon shows: app.gis_boundary_levels,
 * app.gis_datasets, and app.gis_imports exist; app.gis_admin_boundaries
 * does NOT.
 *
 * Disposition (per 19-02-AUDIT.md): DEPRECATE — gis.geographic_location
 * (created in 2026_04_27_000001) is the canonical replacement with a
 * proper PostGIS column declared at table-creation time. Re-creating
 * gis_admin_boundaries would duplicate effort and conflict with the new
 * schema.
 *
 * This migration is a NO-OP-WITH-LOG: it records the audit decision in
 * the migrations table and the application log, but takes no
 * destructive action. The migration is committed so subsequent
 * `migrate:status` reports it as applied.
 */
return new class extends Migration
{
    public function up(): void
    {
        $exists = DB::selectOne(
            'SELECT 1 AS ok FROM information_schema.tables '
            ."WHERE table_schema = 'app' AND table_name = 'gis_admin_boundaries'"
        );

        if ($exists) {
            Log::info(
                'Phase 19 audit: app.gis_admin_boundaries exists. '
                .'Disposition: DEFER (reviewed in 19-02-AUDIT.md; '
                .'gis.geographic_location is the canonical Phase 19+ surface). '
                .'No action taken.'
            );
        } else {
            Log::info(
                'Phase 19 audit: app.gis_admin_boundaries MISSING (silent skip from '
                .'2026_03_11_000002_create_gis_boundary_tables). '
                .'Disposition: DEPRECATE — superseded by gis.geographic_location '
                .'(2026_04_27_000001). See 19-02-AUDIT.md for rationale. No action taken.'
            );
        }
    }

    public function down(): void
    {
        // No-op — this migration takes no destructive action on up(),
        // so down() has nothing to reverse.
    }
};
