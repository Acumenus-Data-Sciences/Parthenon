<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates imaging outcomes research tables for longitudinal analysis.
 *
 * imaging_measurements: Quantitative imaging biomarkers per study (tumor volume,
 *   SUVmax, opacity scores, lesion diameters, etc.). These are the raw data points
 *   for longitudinal tracking and treatment response assessment.
 *
 * imaging_response_assessments: Computed treatment response classifications (RECIST 1.1,
 *   CT Severity Index, Deauville/Lugano, RANO) derived from serial measurements.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Quantitative imaging biomarkers — one row per measurement per study
        Schema::create('imaging_measurements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('study_id')->constrained('imaging_studies')->cascadeOnDelete();
            $table->bigInteger('person_id')->nullable()->index();
            $table->foreignId('series_id')->nullable()->constrained('imaging_series')->nullOnDelete();

            // What was measured
            $table->string('measurement_type', 50);
            // Types: tumor_volume, suvmax, opacity_score, lesion_count,
            //   longest_diameter, perpendicular_diameter, density_hu,
            //   enhancement_ratio, ground_glass_extent, consolidation_extent,
            //   metabolic_tumor_volume, total_lesion_glycolysis, ct_severity_score

            $table->string('measurement_name', 200);       // human label, e.g. "Right upper lobe GGO"
            $table->decimal('value_as_number', 15, 6);     // the measurement value
            $table->string('unit', 50);                    // mm, cm3, SUV, %, HU, score
            $table->string('body_site', 100)->nullable();  // anatomic location (CHEST, LIVER, etc.)
            $table->string('laterality', 20)->nullable();  // LEFT, RIGHT, BILATERAL, null

            // Provenance
            $table->string('algorithm_name', 200)->nullable(); // null = manual entry
            $table->decimal('confidence', 5, 4)->nullable();   // 0.0–1.0 for AI-derived
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            // Temporal
            $table->date('measured_at')->nullable(); // defaults to study_date if null

            // RECIST target lesion tracking
            $table->boolean('is_target_lesion')->default(false);
            $table->integer('target_lesion_number')->nullable(); // 1-5 per RECIST

            $table->timestamps();

            $table->index(['person_id', 'measurement_type']);
            $table->index(['study_id', 'measurement_type']);
            $table->index('measurement_type');
        });

        // Treatment response assessments — computed from serial measurements
        Schema::create('imaging_response_assessments', function (Blueprint $table) {
            $table->id();
            $table->bigInteger('person_id')->index();

            // Assessment criteria
            $table->string('criteria_type', 30);
            // Types: recist (RECIST 1.1), ct_severity (COVID CT Severity Index),
            //   deauville (Lugano/Deauville for PET), rano (RANO for brain tumors)

            $table->date('assessment_date');
            $table->string('body_site', 100)->nullable();

            // Study references
            $table->foreignId('baseline_study_id')->constrained('imaging_studies')->cascadeOnDelete();
            $table->foreignId('current_study_id')->constrained('imaging_studies')->cascadeOnDelete();

            // Computed values
            $table->decimal('baseline_value', 15, 6)->nullable();
            $table->decimal('nadir_value', 15, 6)->nullable();
            $table->decimal('current_value', 15, 6)->nullable();
            $table->decimal('percent_change_from_baseline', 8, 2)->nullable();
            $table->decimal('percent_change_from_nadir', 8, 2)->nullable();

            // Response classification
            $table->string('response_category', 20);
            // RECIST: CR (complete response), PR (partial response),
            //   SD (stable disease), PD (progressive disease), NE (not evaluable)
            // CT Severity: mild (0-7), moderate (8-17), severe (18-25)
            // Deauville: 1-5 scale

            $table->text('rationale')->nullable(); // human-readable explanation

            // Provenance
            $table->foreignId('assessed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_confirmed')->default(false); // clinician-confirmed vs auto-computed

            $table->timestamps();

            $table->index(['person_id', 'criteria_type']);
            $table->index('response_category');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('imaging_response_assessments');
        Schema::dropIfExists('imaging_measurements');
    }
};
