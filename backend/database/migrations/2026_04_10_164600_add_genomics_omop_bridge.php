<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('omop_genomic_test_map')) {
            Schema::create('omop_genomic_test_map', function (Blueprint $table) {
                $table->unsignedBigInteger('upload_id')->primary();
                $table->unsignedBigInteger('genomic_test_id')->nullable()->unique();
                $table->unsignedBigInteger('care_site_id')->nullable();
                $table->string('genomic_test_name', 255)->nullable();
                $table->string('genomic_test_version', 50)->nullable();
                $table->string('reference_genome', 50)->nullable();
                $table->string('sequencing_device', 50)->nullable();
                $table->string('library_preparation', 50)->nullable();
                $table->string('target_capture', 50)->nullable();
                $table->string('read_type', 50)->nullable();
                $table->integer('read_length')->nullable();
                $table->string('quality_control_tools', 255)->nullable();
                $table->integer('total_reads')->nullable();
                $table->double('mean_target_coverage')->nullable();
                $table->double('per_target_base_cover_100x')->nullable();
                $table->string('alignment_tools', 255)->nullable();
                $table->string('variant_calling_tools', 255)->nullable();
                $table->string('chromosome_corrdinate', 255)->nullable();
                $table->string('annotation_tools', 255)->nullable();
                $table->string('annotation_databases', 255)->nullable();
                $table->unsignedBigInteger('backfill_run_id')->nullable();
                $table->string('mapping_status', 30)->default('planned');
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index('mapping_status');
            });
        }

        if (! Schema::hasTable('omop_gene_symbol_map')) {
            Schema::create('omop_gene_symbol_map', function (Blueprint $table) {
                $table->string('gene_symbol', 100)->primary();
                $table->string('hgnc_id', 50);
                $table->string('hgnc_symbol', 50);
                $table->text('notes')->nullable();
            });
        }

        if (! Schema::hasTable('genomic_variant_omop_xref')) {
            Schema::create('genomic_variant_omop_xref', function (Blueprint $table) {
                $table->unsignedBigInteger('variant_id')->primary();
                $table->unsignedBigInteger('variant_occurrence_id')->nullable()->unique();
                $table->unsignedBigInteger('procedure_occurrence_id')->nullable();
                $table->unsignedBigInteger('specimen_id')->nullable();
                $table->unsignedBigInteger('reference_specimen_id')->nullable();
                $table->string('target_gene1_id', 50)->nullable();
                $table->string('target_gene1_symbol', 255)->nullable();
                $table->string('target_gene2_id', 50)->nullable();
                $table->string('target_gene2_symbol', 255)->nullable();
                $table->unsignedBigInteger('backfill_run_id')->nullable();
                $table->string('mapping_status', 30)->default('planned');
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index('mapping_status');
                $table->index('specimen_id');
            });
        }

        if (! Schema::hasTable('genomic_upload_omop_context_xref')) {
            Schema::create('genomic_upload_omop_context_xref', function (Blueprint $table) {
                $table->unsignedBigInteger('upload_id')->primary();
                $table->unsignedBigInteger('source_id');
                $table->unsignedBigInteger('person_id')->nullable();
                $table->string('sample_id', 255)->nullable();
                $table->unsignedBigInteger('procedure_occurrence_id')->nullable();
                $table->unsignedBigInteger('visit_occurrence_id')->nullable();
                $table->unsignedBigInteger('care_site_id')->nullable();
                $table->unsignedBigInteger('specimen_id')->nullable()->unique();
                $table->unsignedBigInteger('genomic_test_id')->nullable()->unique();
                $table->string('source_strategy', 50);
                $table->string('mapping_status', 30)->default('planned');
                $table->text('notes')->nullable();
                $table->timestamps();

                $table->index('mapping_status');
                $table->index('person_id');
            });
        }
    }

    public function down(): void
    {
        // Intentionally non-destructive: OMOP bridge rows may contain backfilled
        // clinical mappings that must not be dropped by rollback.
    }
};
