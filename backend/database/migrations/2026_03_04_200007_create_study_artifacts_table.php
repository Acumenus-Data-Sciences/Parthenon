<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_artifacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained()->cascadeOnDelete();
            $table->string('artifact_type', 40); // protocol, sap, irb_submission, cohort_json, analysis_package_r, analysis_package_python, results_report, manuscript_draft, supplementary, presentation, data_dictionary, study_package_zip, shiny_app_url, other
            $table->string('title', 500);
            $table->text('description')->nullable();
            $table->string('version', 20)->default('1.0');
            $table->string('file_path', 500)->nullable();
            $table->bigInteger('file_size_bytes')->nullable();
            $table->string('mime_type', 100)->nullable();
            $table->string('url', 500)->nullable();
            $table->jsonb('metadata')->nullable();
            $table->foreignId('uploaded_by')->constrained('users');
            $table->boolean('is_current')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_artifacts');
    }
};
