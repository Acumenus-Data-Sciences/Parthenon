<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('imaging_series', function (Blueprint $table) {
            if (! Schema::hasColumn('imaging_series', 'image_occurrence_id')) {
                $table->unsignedBigInteger('image_occurrence_id')->nullable()->after('file_dir');
                $table->index('image_occurrence_id');
            }
        });

        if (! Schema::hasTable('imaging_series_omop_xref')) {
            Schema::create('imaging_series_omop_xref', function (Blueprint $table) {
                $table->unsignedBigInteger('series_id')->primary();
                $table->unsignedBigInteger('image_occurrence_id')->nullable()->unique();
                $table->unsignedBigInteger('procedure_occurrence_id')->nullable();
                $table->unsignedBigInteger('visit_occurrence_id')->nullable();
                $table->unsignedInteger('modality_concept_id')->nullable();
                $table->unsignedInteger('anatomic_site_concept_id')->nullable();
                $table->unsignedBigInteger('backfill_run_id')->nullable();
                $table->string('mapping_status', 30)->default('planned');
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index('mapping_status');
            });
        }

        if (! Schema::hasTable('imaging_procedure_omop_xref')) {
            Schema::create('imaging_procedure_omop_xref', function (Blueprint $table) {
                $table->unsignedBigInteger('study_id');
                $table->string('modality', 20);
                $table->unsignedBigInteger('procedure_occurrence_id')->unique();
                $table->unsignedInteger('procedure_concept_id');
                $table->unsignedInteger('procedure_type_concept_id');
                $table->string('source_strategy', 30);
                $table->unsignedBigInteger('source_procedure_occurrence_id')->nullable();
                $table->unsignedBigInteger('visit_occurrence_id')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->primary(['study_id', 'modality']);
                $table->index('source_strategy');
            });
        }
    }

    public function down(): void
    {
        // Intentionally non-destructive: OMOP bridge rows and link columns may
        // contain backfilled clinical data that must not be dropped by rollback.
    }
};
