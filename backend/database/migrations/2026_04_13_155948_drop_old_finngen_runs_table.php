<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Drop the deprecated StudyAgent-era app.finngen_runs table and mark its
 * prior migrations as reverted, so the SP1 runtime-foundation schema
 * (created by the accompanying create_finngen_runs_table migration) can
 * own this name cleanly. The old StudyAgent FinnGen service + FinnGenRun
 * model are removed in Task C14; this migration is the schema half of
 * the same transition.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('DROP TABLE IF EXISTS app.finngen_runs CASCADE');

        DB::table('migrations')
            ->whereIn('migration', [
                '2026_03_15_230000_create_finngen_runs_table',
                '2026_03_20_030221_add_investigation_id_to_finngen_runs',
            ])
            ->delete();
    }

    public function down(): void
    {
        // Intentionally no-op: the superseded StudyAgent schema is not
        // restored. Rollback path is to drop the SP1 table via its own
        // migration's down() and re-run the archived StudyAgent migrations.
    }
};
