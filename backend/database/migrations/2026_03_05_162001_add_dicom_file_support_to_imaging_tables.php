<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds local-file DICOM support to imaging tables.
 *
 * - imaging_studies: file metadata fields for locally imported studies
 * - imaging_series: pixel geometry + file_dir for the series directory
 * - imaging_instances: per-SOP instance registry for viewer navigation
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('imaging_studies', function (Blueprint $table) {
            $table->string('patient_name_dicom', 200)->nullable()->after('person_id');
            $table->string('patient_id_dicom', 100)->nullable()->after('patient_name_dicom');
            $table->string('institution_name', 200)->nullable()->after('referring_physician');
            $table->string('file_dir', 500)->nullable()->after('wadors_uri'); // local directory path
        });

        Schema::table('imaging_series', function (Blueprint $table) {
            $table->string('pixel_spacing', 50)->nullable()->after('slice_thickness_mm');  // e.g. "0.25\0.25"
            $table->string('rows_x_cols', 30)->nullable()->after('pixel_spacing');          // e.g. "640x640"
            $table->string('kvp', 20)->nullable()->after('rows_x_cols');
            $table->string('file_dir', 500)->nullable()->after('kvp'); // path to directory containing instances
        });

        // Per-SOP-instance registry — needed for viewer to know each slice's file path
        Schema::create('imaging_instances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained('imaging_studies')->cascadeOnDelete();
            $table->foreignId('series_id')->constrained('imaging_series')->cascadeOnDelete();
            $table->string('sop_instance_uid', 200)->unique();
            $table->string('sop_class_uid', 100)->nullable();
            $table->integer('instance_number')->nullable();
            $table->decimal('slice_location', 10, 4)->nullable();
            $table->string('file_path', 500)->nullable(); // path relative to app root
            $table->timestamps();

            $table->index(['series_id', 'instance_number']);
            $table->index('study_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('imaging_instances');

        Schema::table('imaging_series', function (Blueprint $table) {
            $table->dropColumn(['pixel_spacing', 'rows_x_cols', 'kvp', 'file_dir']);
        });

        Schema::table('imaging_studies', function (Blueprint $table) {
            $table->dropColumn(['patient_name_dicom', 'patient_id_dicom', 'institution_name', 'file_dir']);
        });
    }
};
