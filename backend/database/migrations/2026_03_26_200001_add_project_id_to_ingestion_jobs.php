<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ingestion_jobs', function (Blueprint $table) {
            $table->foreignId('ingestion_project_id')->nullable()->after('id')
                ->constrained('ingestion_projects')->nullOnDelete();
            $table->string('staging_table_name', 255)->nullable()->after('source_id');
        });
    }

    public function down(): void
    {
        Schema::table('ingestion_jobs', function (Blueprint $table) {
            $table->dropForeign(['ingestion_project_id']);
            $table->dropColumn(['ingestion_project_id', 'staging_table_name']);
        });
    }
};
