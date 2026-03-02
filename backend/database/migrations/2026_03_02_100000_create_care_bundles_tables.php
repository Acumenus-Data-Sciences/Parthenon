<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Condition bundles (disease frameworks)
        Schema::create('condition_bundles', function (Blueprint $table) {
            $table->id();
            $table->string('bundle_code')->unique();
            $table->string('condition_name');
            $table->text('description')->nullable();
            $table->jsonb('icd10_patterns');
            $table->jsonb('omop_concept_ids');
            $table->integer('bundle_size')->default(0);
            $table->jsonb('ecqm_references')->nullable();
            $table->string('disease_category')->nullable();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        // Quality measures within bundles
        Schema::create('quality_measures', function (Blueprint $table) {
            $table->id();
            $table->string('measure_code')->unique();
            $table->string('measure_name');
            $table->text('description')->nullable();
            $table->string('measure_type'); // preventive, chronic, behavioral
            $table->string('domain'); // condition, drug, procedure, measurement, observation
            $table->foreignId('concept_set_id')->nullable()->constrained('concept_sets')->nullOnDelete();
            $table->jsonb('numerator_criteria')->nullable();
            $table->jsonb('denominator_criteria')->nullable();
            $table->jsonb('exclusion_criteria')->nullable();
            $table->string('frequency')->nullable(); // annually, semi-annually, every_visit
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Junction: bundle <-> measure
        Schema::create('bundle_measures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_id')->constrained('condition_bundles')->cascadeOnDelete();
            $table->foreignId('measure_id')->constrained('quality_measures')->cascadeOnDelete();
            $table->integer('ordinal')->default(0);
            $table->unique(['bundle_id', 'measure_id']);
        });

        // Overlap/deduplication rules
        Schema::create('bundle_overlap_rules', function (Blueprint $table) {
            $table->id();
            $table->string('rule_code')->unique();
            $table->string('shared_domain');
            $table->jsonb('applicable_bundle_codes');
            $table->string('canonical_measure_code');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Care gap evaluations (population-level results)
        Schema::create('care_gap_evaluations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bundle_id')->constrained('condition_bundles')->cascadeOnDelete();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->foreignId('cohort_definition_id')->nullable()->constrained('cohort_definitions')->nullOnDelete();
            $table->string('status')->default('pending'); // pending, running, completed, failed
            $table->timestamp('evaluated_at')->nullable();
            $table->jsonb('result_json')->nullable();
            $table->integer('person_count')->nullable();
            $table->jsonb('compliance_summary')->nullable();
            $table->text('fail_message')->nullable();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('care_gap_evaluations');
        Schema::dropIfExists('bundle_overlap_rules');
        Schema::dropIfExists('bundle_measures');
        Schema::dropIfExists('quality_measures');
        Schema::dropIfExists('condition_bundles');
    }
};
