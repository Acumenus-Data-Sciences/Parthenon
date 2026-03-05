<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 17 — Health Economics & Outcomes Research (HEOR) Tables
 *
 * Tables:
 *   heor_analyses          — top-level HEOR study / economic analysis record
 *   heor_scenarios         — alternative scenarios within an analysis (e.g., "with intervention" vs "status quo")
 *   heor_cost_parameters   — cost inputs (unit costs, resource utilization rates)
 *   heor_results           — aggregated results per scenario (QALYs, costs, ICERs, net benefit)
 *   heor_value_contracts   — value-based contract definitions (outcome thresholds, rebate tiers)
 */
return new class extends Migration
{
    public function up(): void
    {
        // Top-level HEOR analysis record
        Schema::create('heor_analyses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('created_by')->constrained('users');
            $table->foreignId('source_id')->nullable()->constrained('sources')->nullOnDelete();
            $table->string('name');
            $table->string('analysis_type', 50)->default('cea'); // cea, cba, cua, budget_impact, roi
            $table->text('description')->nullable();
            $table->string('perspective', 50)->default('payer'); // payer, societal, provider, patient
            $table->string('time_horizon', 30)->default('1_year'); // 1_year, 5_year, lifetime
            $table->decimal('discount_rate', 5, 4)->default(0.03); // 3%
            $table->string('currency', 10)->default('USD');
            $table->integer('target_cohort_id')->nullable(); // cohort_definition_id
            $table->integer('comparator_cohort_id')->nullable();
            $table->string('status', 30)->default('draft'); // draft, running, completed, failed
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        // Scenario definitions (e.g., "Intervention", "Status Quo", "Alternative Drug")
        Schema::create('heor_scenarios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('analysis_id')->constrained('heor_analyses')->cascadeOnDelete();
            $table->string('name');
            $table->string('scenario_type', 30)->default('intervention'); // intervention, comparator, sensitivity
            $table->text('description')->nullable();
            $table->jsonb('parameter_overrides')->nullable(); // scenario-specific cost/utility overrides
            $table->boolean('is_base_case')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamps();
        });

        // Cost and utility parameter inputs
        Schema::create('heor_cost_parameters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('analysis_id')->constrained('heor_analyses')->cascadeOnDelete();
            $table->foreignId('scenario_id')->nullable()->constrained('heor_scenarios')->nullOnDelete();
            $table->string('parameter_name');
            $table->string('parameter_type', 50); // drug_cost, admin_cost, hospitalization, er_visit, qaly_weight, utility_value, resource_use
            $table->decimal('value', 15, 4);
            $table->string('unit', 50)->nullable(); // USD/month, per_event, QALY, etc.
            $table->decimal('lower_bound', 15, 4)->nullable();
            $table->decimal('upper_bound', 15, 4)->nullable();
            $table->string('distribution', 30)->nullable(); // normal, gamma, beta, log_normal
            $table->integer('omop_concept_id')->nullable();
            $table->text('source_reference')->nullable();
            $table->timestamps();
        });

        // Aggregated results per scenario
        Schema::create('heor_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('analysis_id')->constrained('heor_analyses')->cascadeOnDelete();
            $table->foreignId('scenario_id')->constrained('heor_scenarios')->cascadeOnDelete();
            $table->decimal('total_cost', 18, 2)->nullable();
            $table->decimal('total_qalys', 10, 4)->nullable();
            $table->decimal('total_lys', 10, 4)->nullable(); // life years
            $table->decimal('incremental_cost', 18, 2)->nullable();
            $table->decimal('incremental_qalys', 10, 4)->nullable();
            $table->decimal('icer', 18, 2)->nullable(); // cost per QALY gained
            $table->decimal('net_monetary_benefit', 18, 2)->nullable(); // at willingness-to-pay threshold
            $table->decimal('willingness_to_pay_threshold', 18, 2)->nullable();
            $table->decimal('roi_percent', 10, 4)->nullable();
            $table->decimal('payback_period_months', 10, 2)->nullable();
            $table->decimal('budget_impact_year1', 18, 2)->nullable();
            $table->decimal('budget_impact_year3', 18, 2)->nullable();
            $table->decimal('budget_impact_year5', 18, 2)->nullable();
            $table->jsonb('sensitivity_results')->nullable(); // one-way + PSA summary
            $table->jsonb('tornado_data')->nullable(); // sorted parameter impacts
            $table->integer('cohort_size')->nullable();
            $table->timestamps();
        });

        // Value-based contract definitions
        Schema::create('heor_value_contracts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('analysis_id')->constrained('heor_analyses')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users');
            $table->string('contract_name');
            $table->string('drug_name')->nullable();
            $table->string('contract_type', 50)->default('outcomes_based'); // outcomes_based, amortized, warranty
            $table->string('outcome_metric', 100); // e.g., "hba1c_reduction", "readmission_rate", "survival_12mo"
            $table->decimal('baseline_rate', 10, 4)->nullable();
            $table->jsonb('rebate_tiers')->nullable(); // [{threshold, rebate_percent}]
            $table->decimal('list_price', 18, 2)->nullable();
            $table->decimal('net_price_floor', 18, 2)->nullable();
            $table->integer('measurement_period_months')->default(12);
            $table->string('status', 30)->default('draft');
            $table->timestamp('effective_date')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('heor_value_contracts');
        Schema::dropIfExists('heor_results');
        Schema::dropIfExists('heor_cost_parameters');
        Schema::dropIfExists('heor_scenarios');
        Schema::dropIfExists('heor_analyses');
    }
};
