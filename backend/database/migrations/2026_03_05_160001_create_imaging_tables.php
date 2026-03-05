<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates app-layer imaging metadata tables.
 *
 * Follows the OMOP Medical Imaging (MI-CDM) extension specification:
 * Park et al. 2024 — Image_occurrence and Image_feature table designs.
 *
 * App tables (Docker parthenon DB) track:
 * - imaging_studies: imported DICOM studies (mapped to Image_occurrence)
 * - imaging_series: DICOM series within studies
 * - imaging_features: AI/NLP derived structured features (mapped to Image_feature)
 * - imaging_criteria: saved imaging cohort criteria for the cohort builder
 */
return new class extends Migration
{
    public function up(): void
    {
        // Imaging studies — one row per DICOM study (STUDY_INSTANCE_UID)
        Schema::create('imaging_studies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->bigInteger('person_id')->nullable(); // matched OMOP person_id
            $table->string('study_instance_uid', 200)->unique();
            $table->string('accession_number', 100)->nullable();
            $table->string('modality', 20)->nullable();         // CT, MR, PET, CR, US, MG, NM
            $table->string('body_part_examined', 100)->nullable(); // CHEST, BRAIN, ABDOMEN, etc.
            $table->string('study_description', 300)->nullable();
            $table->string('referring_physician', 200)->nullable();
            $table->date('study_date')->nullable();
            $table->integer('num_series')->default(0);
            $table->integer('num_images')->default(0);
            $table->string('orthanc_study_id', 100)->nullable(); // Orthanc internal ID
            $table->string('wadors_uri', 500)->nullable();       // DICOMweb URI
            $table->string('status', 30)->default('indexed');   // indexed, etl_pending, etl_done, failed
            $table->bigInteger('image_occurrence_id')->nullable(); // FK to omop.image_occurrence
            $table->timestamps();

            $table->index(['source_id', 'modality']);
            $table->index(['source_id', 'person_id']);
            $table->index('study_date');
        });

        // Imaging series — one row per DICOM series (SERIES_INSTANCE_UID)
        Schema::create('imaging_series', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained('imaging_studies')->cascadeOnDelete();
            $table->string('series_instance_uid', 200)->unique();
            $table->string('series_description', 300)->nullable();
            $table->string('modality', 20)->nullable();
            $table->string('body_part_examined', 100)->nullable();
            $table->integer('series_number')->nullable();
            $table->integer('num_images')->default(0);
            $table->decimal('slice_thickness_mm', 8, 3)->nullable();
            $table->string('manufacturer', 200)->nullable();
            $table->string('manufacturer_model', 200)->nullable();
            $table->string('orthanc_series_id', 100)->nullable();
            $table->timestamps();

            $table->index('study_id');
        });

        // Imaging features — AI/NLP derived structured measurements (→ Image_feature in MI-CDM)
        Schema::create('imaging_features', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained('imaging_studies')->cascadeOnDelete();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->bigInteger('person_id')->nullable();
            $table->string('feature_type', 50);         // radiomic, ai_classification, nlp_finding, dose
            $table->string('algorithm_name', 200)->nullable();   // model name (e.g. "LungRADS-v2.1")
            $table->string('algorithm_version', 50)->nullable();
            $table->string('feature_name', 200);                 // e.g. "LungRADS", "SUVmax", "Volume_cm3"
            $table->string('feature_source_value', 300)->nullable(); // raw feature string
            $table->decimal('value_as_number', 15, 6)->nullable();
            $table->string('value_as_string', 200)->nullable();
            $table->bigInteger('value_concept_id')->nullable();  // OMOP concept for categorical value
            $table->string('unit_source_value', 50)->nullable(); // e.g. "cm3", "HU", "mGy"
            $table->decimal('confidence', 5, 4)->nullable();     // model confidence 0.0–1.0
            $table->string('body_site', 100)->nullable();        // RadLex/SNOMED body part
            $table->bigInteger('image_feature_id')->nullable();  // FK to omop.image_feature (MI-CDM)
            $table->timestamps();

            $table->index(['source_id', 'feature_type']);
            $table->index(['source_id', 'person_id']);
            $table->index('feature_name');
        });

        // Imaging cohort criteria — saved imaging filter criteria for cohort builder
        Schema::create('imaging_cohort_criteria', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users');
            $table->string('name', 200);
            $table->string('criteria_type', 50); // modality, anatomy, quantitative, ai_classification, dose
            $table->jsonb('criteria_definition');
            $table->string('description')->nullable();
            $table->boolean('is_shared')->default(false);
            $table->timestamps();

            $table->index('criteria_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('imaging_cohort_criteria');
        Schema::dropIfExists('imaging_features');
        Schema::dropIfExists('imaging_series');
        Schema::dropIfExists('imaging_studies');
    }
};
