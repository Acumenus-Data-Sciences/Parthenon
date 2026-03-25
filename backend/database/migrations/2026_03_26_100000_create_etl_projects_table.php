<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('etl_projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->string('cdm_version', 10)->default('5.4');
            $table->string('name', 255);
            $table->string('status', 20)->default('draft');
            $table->foreignId('created_by')->constrained('users'); // RESTRICT: user cannot be deleted while owning ETL projects
            $table->foreignId('scan_profile_id')->constrained('source_profiles');
            $table->text('notes')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        // Partial unique index: one active project per source + CDM version
        DB::statement('CREATE UNIQUE INDEX etl_projects_source_cdm_active ON etl_projects (source_id, cdm_version) WHERE deleted_at IS NULL');
    }

    public function down(): void
    {
        Schema::dropIfExists('etl_projects');
    }
};
