<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // ── care_gap_patient_bundles ──────────────────────────────────────────
        // Pre-computed bundle denominator membership: which patients qualify for
        // each condition bundle based on their CDM condition_occurrence records.
        Schema::create('care_gap_patient_bundles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->foreignId('bundle_id')->constrained('condition_bundles')->cascadeOnDelete();
            $table->bigInteger('person_id');
            $table->date('enrolled_at');          // date of first qualifying condition event
            $table->timestampTz('refreshed_at');

            $table->unique(['source_id', 'bundle_id', 'person_id']);
        });

        Schema::table('care_gap_patient_bundles', function (Blueprint $table) {
            $table->index(['source_id', 'bundle_id'], 'idx_cgpb_source_bundle');
            $table->index(['source_id', 'person_id'], 'idx_cgpb_source_person');
            $table->index(['source_id', 'bundle_id', 'enrolled_at'], 'idx_cgpb_enrolled_at');
        });

        // ── care_gap_patient_measures ─────────────────────────────────────────
        // Per-patient × measure compliance status. One row per (source, measure,
        // person). Updated nightly by CareGapRefreshService.
        Schema::create('care_gap_patient_measures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->foreignId('bundle_id')->constrained('condition_bundles')->cascadeOnDelete();
            $table->foreignId('measure_id')->constrained('quality_measures')->cascadeOnDelete();
            $table->bigInteger('person_id');
            $table->string('status', 20)->default('open'); // met | open | excluded
            $table->date('last_service_date')->nullable();  // most recent qualifying event
            $table->date('due_date')->nullable();            // last_service_date + frequency window
            $table->integer('days_overdue')->nullable();    // NULL if not overdue
            $table->boolean('is_deduplicated')->default(false);
            $table->timestampTz('refreshed_at');

            $table->unique(['source_id', 'measure_id', 'person_id']);
        });

        Schema::table('care_gap_patient_measures', function (Blueprint $table) {
            $table->index(['source_id', 'bundle_id', 'measure_id'], 'idx_cgpm_source_bundle_measure');
            $table->index(['source_id', 'bundle_id', 'status'], 'idx_cgpm_source_bundle_status');
            $table->index(['source_id', 'person_id'], 'idx_cgpm_source_person');
        });

        // ── care_gap_snapshots ────────────────────────────────────────────────
        // Daily aggregate compliance summary per (bundle × source).
        // Powers trend dashboards and population-level reporting.
        Schema::create('care_gap_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('source_id')->constrained('sources')->cascadeOnDelete();
            $table->foreignId('bundle_id')->constrained('condition_bundles')->cascadeOnDelete();
            $table->foreignId('cohort_definition_id')->nullable()->constrained('cohort_definitions')->nullOnDelete();
            $table->date('snapshot_date');
            $table->integer('person_count')->default(0);
            $table->integer('measures_met')->default(0);
            $table->integer('measures_open')->default(0);
            $table->integer('measures_excluded')->default(0);
            $table->decimal('compliance_pct', 5, 2)->default(0);
            $table->integer('risk_high_count')->default(0);
            $table->integer('risk_medium_count')->default(0);
            $table->integer('risk_low_count')->default(0);
            $table->integer('etl_duration_ms')->nullable();
            $table->timestampTz('computed_at');

            $table->unique(
                ['source_id', 'bundle_id', 'snapshot_date', 'cohort_definition_id'],
                'uq_cgs_source_bundle_date',
            );
        });

        Schema::table('care_gap_snapshots', function (Blueprint $table) {
            $table->index(['source_id', 'bundle_id', 'snapshot_date'], 'idx_cgs_source_bundle_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('care_gap_snapshots');
        Schema::dropIfExists('care_gap_patient_measures');
        Schema::dropIfExists('care_gap_patient_bundles');
    }
};
