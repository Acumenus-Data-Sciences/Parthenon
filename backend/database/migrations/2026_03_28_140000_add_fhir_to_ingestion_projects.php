<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ingestion_projects', function (Blueprint $table) {
            $table->foreignId('fhir_connection_id')
                ->nullable()
                ->after('source_id')
                ->constrained('fhir_connections')
                ->nullOnDelete();

            $table->string('fhir_sync_mode', 30)
                ->nullable()
                ->after('selected_tables');

            $table->text('fhir_config')
                ->nullable()
                ->after('fhir_sync_mode');

            $table->foreignId('last_fhir_sync_run_id')
                ->nullable()
                ->after('fhir_config')
                ->constrained('fhir_sync_runs')
                ->nullOnDelete();

            $table->timestamp('last_fhir_sync_at')
                ->nullable()
                ->after('last_fhir_sync_run_id');

            $table->string('last_fhir_sync_status', 30)
                ->nullable()
                ->after('last_fhir_sync_at');
        });

        Schema::table('fhir_sync_runs', function (Blueprint $table) {
            $table->foreignId('ingestion_project_id')
                ->nullable()
                ->after('fhir_connection_id')
                ->constrained('ingestion_projects')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('fhir_sync_runs', function (Blueprint $table) {
            $table->dropForeign(['ingestion_project_id']);
            $table->dropColumn('ingestion_project_id');
        });

        Schema::table('ingestion_projects', function (Blueprint $table) {
            $table->dropForeign(['fhir_connection_id']);
            $table->dropForeign(['last_fhir_sync_run_id']);
            $table->dropColumn([
                'fhir_connection_id',
                'fhir_sync_mode',
                'fhir_config',
                'last_fhir_sync_run_id',
                'last_fhir_sync_at',
                'last_fhir_sync_status',
            ]);
        });
    }
};
