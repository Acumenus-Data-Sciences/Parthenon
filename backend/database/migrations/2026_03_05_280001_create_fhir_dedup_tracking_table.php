<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fhir_dedup_tracking', function (Blueprint $table) {
            $table->id();
            $table->string('site_key', 50);
            $table->string('fhir_resource_type', 50);   // Patient, Condition, etc.
            $table->string('fhir_resource_id', 200);     // FHIR resource.id
            $table->string('cdm_table', 50);             // person, condition_occurrence, etc.
            $table->bigInteger('cdm_row_id');             // PK in CDM table
            $table->string('content_hash', 64);           // SHA-256 of mapped data — skip update if unchanged
            $table->timestamp('last_synced_at');
            $table->timestamps();

            // One mapping per (site, resource type, resource id)
            $table->unique(
                ['site_key', 'fhir_resource_type', 'fhir_resource_id'],
                'fhir_dedup_unique'
            );

            // For cleanup queries: find all CDM rows for a site+table
            $table->index(['site_key', 'cdm_table'], 'fhir_dedup_site_table');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fhir_dedup_tracking');
    }
};
