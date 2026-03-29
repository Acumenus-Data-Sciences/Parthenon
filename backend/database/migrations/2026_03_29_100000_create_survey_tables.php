<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── Instrument registry ──────────────────────────────────────────
        Schema::create('survey_instruments', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('abbreviation', 30);
            $table->string('version', 20)->default('1.0');
            $table->text('description')->nullable();
            $table->string('domain', 60);
            $table->unsignedSmallInteger('item_count')->default(0);
            $table->jsonb('scoring_method')->nullable();
            $table->string('loinc_panel_code', 20)->nullable();
            $table->unsignedBigInteger('omop_concept_id')->nullable();
            $table->string('license_type', 20)->default('public');
            $table->string('license_detail')->nullable();
            $table->boolean('is_public_domain')->default(true);
            $table->boolean('is_active')->default(true);
            $table->string('omop_coverage', 10)->default('no');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique('abbreviation');
            $table->index('domain');
            $table->index('is_active');
        });

        // ── Individual question items ────────────────────────────────────
        Schema::create('survey_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('survey_instrument_id')->constrained('survey_instruments')->cascadeOnDelete();
            $table->unsignedSmallInteger('item_number');
            $table->text('item_text');
            $table->string('response_type', 20)->default('likert');
            $table->unsignedBigInteger('omop_concept_id')->nullable();
            $table->string('loinc_code', 20)->nullable();
            $table->string('subscale_name', 60)->nullable();
            $table->boolean('is_reverse_coded')->default(false);
            $table->decimal('min_value', 8, 2)->nullable();
            $table->decimal('max_value', 8, 2)->nullable();
            $table->unsignedSmallInteger('display_order');
            $table->timestamps();

            $table->unique(['survey_instrument_id', 'item_number']);
            $table->index('omop_concept_id');
        });

        // ── Answer choices for categorical items ─────────────────────────
        Schema::create('survey_answer_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('survey_item_id')->constrained('survey_items')->cascadeOnDelete();
            $table->string('option_text');
            $table->decimal('option_value', 8, 2)->nullable();
            $table->unsignedBigInteger('omop_concept_id')->nullable();
            $table->string('loinc_la_code', 20)->nullable();
            $table->unsignedSmallInteger('display_order');
            $table->timestamps();

            $table->index('survey_item_id');
        });

        // ── Survey administration metadata (v6.0-forward-compatible) ─────
        Schema::create('survey_conduct', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('person_id');
            $table->foreignId('survey_instrument_id')->constrained('survey_instruments')->cascadeOnDelete();
            $table->unsignedBigInteger('survey_concept_id')->nullable();
            $table->unsignedBigInteger('visit_occurrence_id')->nullable();
            $table->timestamp('survey_start_datetime')->nullable();
            $table->timestamp('survey_end_datetime')->nullable();
            $table->unsignedBigInteger('respondent_type_concept_id')->nullable();
            $table->unsignedBigInteger('survey_mode_concept_id')->nullable();
            $table->string('completion_status', 20)->default('complete');
            $table->decimal('total_score', 10, 2)->nullable();
            $table->jsonb('subscale_scores')->nullable();
            $table->string('source_identifier')->nullable();
            $table->unsignedBigInteger('source_id')->nullable();
            $table->timestamps();

            $table->index('person_id');
            $table->index('survey_instrument_id');
            $table->index(['person_id', 'survey_instrument_id']);
        });

        // ── Bridge: survey_conduct → observation rows ────────────────────
        Schema::create('survey_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('survey_conduct_id')->constrained('survey_conduct')->cascadeOnDelete();
            $table->foreignId('survey_item_id')->constrained('survey_items')->cascadeOnDelete();
            $table->unsignedBigInteger('observation_id')->nullable();
            $table->decimal('value_as_number', 10, 4)->nullable();
            $table->unsignedBigInteger('value_as_concept_id')->nullable();
            $table->text('value_as_string')->nullable();
            $table->timestamp('response_datetime')->nullable();
            $table->timestamps();

            $table->index('survey_conduct_id');
            $table->index('observation_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('survey_responses');
        Schema::dropIfExists('survey_conduct');
        Schema::dropIfExists('survey_answer_options');
        Schema::dropIfExists('survey_items');
        Schema::dropIfExists('survey_instruments');
    }
};
