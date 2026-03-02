<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The cohort results table stores generated cohort membership.
     *
     * This table is created on the results connection and follows the
     * OHDSI cohort table specification.
     */
    public function up(): void
    {
        $connection = config('database.connections.results') ? 'results' : null;

        Schema::connection($connection)->create('cohort', function (Blueprint $table) {
            $table->bigInteger('cohort_definition_id');
            $table->bigInteger('subject_id');
            $table->date('cohort_start_date');
            $table->date('cohort_end_date');

            $table->index(['cohort_definition_id', 'subject_id'], 'idx_cohort_def_subject');
            $table->index(['cohort_definition_id', 'cohort_start_date'], 'idx_cohort_def_start');
        });
    }

    public function down(): void
    {
        $connection = config('database.connections.results') ? 'results' : null;

        Schema::connection($connection)->dropIfExists('cohort');
    }
};
