<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Make study_results projectable from single-site analysis executions.
 *
 * Results are computed into `analysis_executions.result_json` (morph-keyed),
 * but the original schema required every study_results row to point at a
 * `study_executions` row (the federated/multi-site execution concept), which is
 * empty for locally-run studies. That left the Results tab structurally empty.
 *
 * This migration (additive, reversible):
 *   1. Makes `execution_id` (→ study_executions) nullable, so a result can be
 *      recorded without a federated execution row.
 *   2. Adds nullable `analysis_execution_id` (→ analysis_executions) so each
 *      projected result keeps a precise link back to the run that produced it.
 */
return new class extends Migration
{
    public function up(): void
    {
        // 1. Drop NOT NULL on execution_id via raw SQL to avoid Laravel
        //    re-creating the existing foreign key during a ->change().
        DB::statement('ALTER TABLE study_results ALTER COLUMN execution_id DROP NOT NULL');

        // 2. Add the precise provenance link to the analysis execution.
        if (! Schema::hasColumn('study_results', 'analysis_execution_id')) {
            Schema::table('study_results', function (Blueprint $table) {
                $table->foreignId('analysis_execution_id')
                    ->nullable()
                    ->after('execution_id')
                    ->constrained('analysis_executions')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('study_results', 'analysis_execution_id')) {
            Schema::table('study_results', function (Blueprint $table) {
                $table->dropConstrainedForeignId('analysis_execution_id');
            });
        }

        // Restore NOT NULL only when no projected (null-execution) rows remain,
        // so the rollback never fails on existing data.
        $nullCount = (int) DB::table('study_results')->whereNull('execution_id')->count();
        if ($nullCount === 0) {
            DB::statement('ALTER TABLE study_results ALTER COLUMN execution_id SET NOT NULL');
        }
    }
};
