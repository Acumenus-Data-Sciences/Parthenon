<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The cohort_inclusion_stats table stores per-rule inclusion statistics
     * for cohort generation results.
     */
    public function up(): void
    {
        $connection = config('database.connections.results') ? 'results' : null;

        Schema::connection($connection)->create('cohort_inclusion_stats', function (Blueprint $table) {
            $table->bigInteger('cohort_definition_id');
            $table->integer('rule_sequence');
            $table->string('name');
            $table->bigInteger('person_count')->default(0);
            $table->decimal('person_percent', 8, 4)->default(0);

            $table->index('cohort_definition_id', 'idx_cohort_incl_stats_def');
        });
    }

    public function down(): void
    {
        $connection = config('database.connections.results') ? 'results' : null;

        Schema::connection($connection)->dropIfExists('cohort_inclusion_stats');
    }
};
