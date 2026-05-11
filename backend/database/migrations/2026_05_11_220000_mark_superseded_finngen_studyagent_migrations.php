<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const SUPERSEDED_MIGRATIONS = [
        '2026_03_15_230000_create_finngen_runs_table',
        '2026_03_20_030221_add_investigation_id_to_finngen_runs',
    ];

    public function up(): void
    {
        $runtimeExists = DB::selectOne("SELECT to_regclass('finngen.runs') AS table_name");
        $replacementExists = DB::selectOne("SELECT to_regclass('app.finngen_runs') AS table_name");

        if ($runtimeExists?->table_name === null && $replacementExists?->table_name === null) {
            return;
        }

        $batch = max(1, (int) DB::table('migrations')->max('batch'));

        foreach (self::SUPERSEDED_MIGRATIONS as $migration) {
            if (DB::table('migrations')->where('migration', $migration)->exists()) {
                continue;
            }

            DB::table('migrations')->insert([
                'migration' => $migration,
                'batch' => $batch,
            ]);
        }
    }

    public function down(): void
    {
        // Intentionally no-op. These historical migration rows prevent the
        // superseded StudyAgent schema from reappearing as actionable pending
        // work after the FinnGen runtime schema replacement.
    }
};
