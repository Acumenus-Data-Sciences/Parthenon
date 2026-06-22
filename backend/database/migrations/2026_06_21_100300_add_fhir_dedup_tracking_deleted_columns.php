<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Soft-delete audit columns on the unified FHIR resource→CDM tracking table.
 * When a resource arrives `entered-in-error` (or via a Bulk `deleted` manifest),
 * FhirDedupService::deleteByResource removes the mapped CDM row and stamps the
 * tracking row with deleted_at / deleted_reason so the audit trail survives the
 * append-only OMOP delete.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fhir_dedup_tracking', function (Blueprint $table) {
            if (! Schema::hasColumn('fhir_dedup_tracking', 'deleted_at')) {
                $table->timestamp('deleted_at')->nullable();
            }
            if (! Schema::hasColumn('fhir_dedup_tracking', 'deleted_reason')) {
                $table->string('deleted_reason', 250)->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('fhir_dedup_tracking', function (Blueprint $table) {
            foreach (['deleted_at', 'deleted_reason'] as $col) {
                if (Schema::hasColumn('fhir_dedup_tracking', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
