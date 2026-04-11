<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add indexes that were defined in the original bridge migrations but
     * never created because the tables already existed (built by SQL scripts)
     * and the Schema::hasTable() guards skipped the CREATE TABLE blocks.
     */
    public function up(): void
    {
        // imaging_procedure_omop_xref: source_strategy index
        if (Schema::hasTable('imaging_procedure_omop_xref') && ! $this->indexExists('imaging_procedure_omop_xref', 'imaging_procedure_omop_xref_source_strategy_index')) {
            Schema::table('imaging_procedure_omop_xref', function (Blueprint $table) {
                $table->index('source_strategy');
            });
        }

        // omop_genomic_test_map: mapping_status index
        if (Schema::hasTable('omop_genomic_test_map') && ! $this->indexExists('omop_genomic_test_map', 'omop_genomic_test_map_mapping_status_index')) {
            Schema::table('omop_genomic_test_map', function (Blueprint $table) {
                $table->index('mapping_status');
            });
        }

        // genomic_variant_omop_xref: mapping_status + specimen_id indexes
        if (Schema::hasTable('genomic_variant_omop_xref')) {
            Schema::table('genomic_variant_omop_xref', function (Blueprint $table) {
                if (! $this->indexExists('genomic_variant_omop_xref', 'genomic_variant_omop_xref_mapping_status_index')) {
                    $table->index('mapping_status');
                }
                if (! $this->indexExists('genomic_variant_omop_xref', 'genomic_variant_omop_xref_specimen_id_index')) {
                    $table->index('specimen_id');
                }
            });
        }

        // genomic_upload_omop_context_xref: mapping_status + person_id indexes
        if (Schema::hasTable('genomic_upload_omop_context_xref')) {
            Schema::table('genomic_upload_omop_context_xref', function (Blueprint $table) {
                if (! $this->indexExists('genomic_upload_omop_context_xref', 'genomic_upload_omop_context_xref_mapping_status_index')) {
                    $table->index('mapping_status');
                }
                if (! $this->indexExists('genomic_upload_omop_context_xref', 'genomic_upload_omop_context_xref_person_id_index')) {
                    $table->index('person_id');
                }
            });
        }
    }

    public function down(): void
    {
        // Intentionally non-destructive: indexes are safe to leave in place
    }

    private function indexExists(string $table, string $indexName): bool
    {
        return DB::select(
            "SELECT 1 FROM pg_indexes WHERE schemaname = 'app' AND tablename = ? AND indexname = ?",
            [$table, $indexName]
        ) !== [];
    }
};
