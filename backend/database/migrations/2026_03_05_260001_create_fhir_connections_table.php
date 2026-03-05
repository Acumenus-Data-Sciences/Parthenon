<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fhir_connections', function (Blueprint $table) {
            $table->id();
            $table->string('site_name');                        // e.g. "Johns Hopkins Epic"
            $table->string('site_key', 50)->unique();           // e.g. "jhu-epic" — slug for partitioning
            $table->string('ehr_vendor', 50)->default('epic');  // epic, cerner, other
            $table->string('fhir_base_url');                    // e.g. https://fhir.hospital.org/api/FHIR/R4
            $table->string('token_endpoint');                   // OAuth2 token URL
            $table->string('client_id');                        // SMART Backend Services client_id
            $table->text('private_key_pem')->nullable();        // encrypted RSA private key
            $table->string('jwks_url')->nullable();             // optional JWKS endpoint
            $table->string('scopes')->default('system/*.read'); // OAuth scopes
            $table->string('group_id')->nullable();             // FHIR Group ID for bulk export (preferred)
            $table->string('export_resource_types')->nullable(); // comma-sep list, null = all supported

            // Target OMOP destination
            $table->foreignId('target_source_id')->nullable()->constrained('sources')->nullOnDelete();

            // Sync configuration
            $table->json('sync_config')->nullable();            // schedule, _since tracking, etc.
            $table->boolean('is_active')->default(false);
            $table->boolean('incremental_enabled')->default(true);
            $table->timestamp('last_sync_at')->nullable();
            $table->string('last_sync_status', 30)->nullable(); // completed, failed, running
            $table->integer('last_sync_records')->default(0);

            $table->foreignId('created_by')->constrained('users');
            $table->timestamps();
        });

        Schema::create('fhir_sync_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('fhir_connection_id')->constrained('fhir_connections')->cascadeOnDelete();
            $table->string('status', 30)->default('pending'); // pending, exporting, downloading, processing, validating, completed, failed
            $table->string('export_url')->nullable();          // FHIR async polling URL
            $table->timestamp('since_param')->nullable();      // _since used for this run
            $table->json('resource_types')->nullable();         // which types were exported

            // Counts
            $table->integer('files_downloaded')->default(0);
            $table->integer('records_extracted')->default(0);
            $table->integer('records_mapped')->default(0);
            $table->integer('records_written')->default(0);
            $table->integer('records_failed')->default(0);
            $table->decimal('mapping_coverage', 5, 2)->nullable(); // % with concept_id != 0

            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->foreignId('triggered_by')->nullable()->constrained('users');
            $table->timestamps();

            $table->index(['fhir_connection_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fhir_sync_runs');
        Schema::dropIfExists('fhir_connections');
    }
};
