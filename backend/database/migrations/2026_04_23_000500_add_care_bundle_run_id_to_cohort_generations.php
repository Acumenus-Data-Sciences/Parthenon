<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cohort_generations', function (Blueprint $table) {
            $table->foreignId('care_bundle_run_id')
                ->nullable()
                ->after('source_id')
                ->constrained('care_bundle_runs')
                ->nullOnDelete();
            $table->index('care_bundle_run_id', 'idx_cohort_generations_care_bundle_run');
        });
    }

    public function down(): void
    {
        Schema::table('cohort_generations', function (Blueprint $table) {
            $table->dropIndex('idx_cohort_generations_care_bundle_run');
            $table->dropConstrainedForeignId('care_bundle_run_id');
        });
    }
};
