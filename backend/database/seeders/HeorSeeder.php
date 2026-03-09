<?php

namespace Database\Seeders;

use App\Models\App\HeorAnalysis;
use App\Models\App\HeorCostParameter;
use App\Models\App\HeorScenario;
use App\Models\App\HeorValueContract;
use App\Models\User;
use App\Services\Heor\HeorEconomicsService;
use Illuminate\Database\Seeder;

class HeorSeeder extends Seeder
{
    /**
     * Seed 5 HEOR analyses with scenarios, cost parameters, and value contracts.
     * Then execute each analysis to populate results.
     *
     * Fully idempotent — uses firstOrCreate throughout.
     */
    public function run(): void
    {
        $adminId = User::where('email', 'admin@acumenus.net')->value('id');
        if (! $adminId) {
            $this->command->warn('Admin user not found — skipping HEOR seeding.');

            return;
        }

        $this->seedCeaAnalysis($adminId);
        $this->seedBudgetImpactAnalysis($adminId);
        $this->seedRoiAnalysis($adminId);
        $this->seedCuaAnalysis($adminId);
        $this->seedCbaAnalysis($adminId);
        $this->seedValueContracts($adminId);

        // Execute all analyses
        $this->executeAllAnalyses();
    }

    // ─── 1. CEA: SGLT2i vs Standard of Care for T2DM with CKD ──────────

    private function seedCeaAnalysis(int $adminId): void
    {
        $analysis = HeorAnalysis::firstOrCreate(
            ['name' => 'SGLT2i vs Standard of Care for T2DM with CKD'],
            [
                'created_by' => $adminId,
                'analysis_type' => 'cea',
                'description' => 'Cost-effectiveness analysis comparing SGLT2 inhibitor therapy (dapagliflozin) to standard of care in Type 2 Diabetes patients with chronic kidney disease. Based on DAPA-CKD trial outcomes and US payer perspective.',
                'perspective' => 'payer',
                'time_horizon' => '10_year',
                'discount_rate' => 0.03,
                'currency' => 'USD',
                'target_cohort_id' => 1,
                'comparator_cohort_id' => 5,
                'status' => 'draft',
            ],
        );

        // Base case scenario (standard of care)
        $baseCase = HeorScenario::firstOrCreate(
            ['analysis_id' => $analysis->id, 'name' => 'Standard of Care'],
            [
                'scenario_type' => 'comparator',
                'description' => 'Conventional T2DM management without SGLT2i: metformin, insulin, ACE-I/ARB for nephroprotection.',
                'is_base_case' => true,
                'sort_order' => 0,
            ],
        );

        // Intervention scenario
        $intervention = HeorScenario::firstOrCreate(
            ['analysis_id' => $analysis->id, 'name' => 'SGLT2i Add-on Therapy'],
            [
                'scenario_type' => 'intervention',
                'description' => 'Dapagliflozin 10mg daily added to standard of care. Assumes 78% adherence rate (real-world).',
                'is_base_case' => false,
                'sort_order' => 1,
            ],
        );

        // Sensitivity scenario
        HeorScenario::firstOrCreate(
            ['analysis_id' => $analysis->id, 'name' => 'High Adherence Scenario'],
            [
                'scenario_type' => 'sensitivity',
                'description' => 'Optimistic scenario with 95% adherence and full DAPA-CKD trial efficacy.',
                'is_base_case' => false,
                'sort_order' => 2,
                'parameter_overrides' => ['sglt2i_annual_cost' => 5800, 'hospitalization_reduction' => 8500],
            ],
        );

        // Global parameters (apply to all scenarios)
        $this->createParams($analysis->id, null, [
            ['parameter_name' => 'baseline_drug_cost', 'parameter_type' => 'drug_cost', 'value' => 2400, 'unit' => 'USD/year', 'lower_bound' => 1800, 'upper_bound' => 3200, 'distribution' => 'gamma', 'source_reference' => 'GoodRx average wholesale price, metformin + insulin glargine'],
            ['parameter_name' => 'nephrology_visits', 'parameter_type' => 'admin_cost', 'value' => 1200, 'unit' => 'USD/year', 'lower_bound' => 800, 'upper_bound' => 1600, 'distribution' => 'gamma', 'source_reference' => 'Medicare physician fee schedule 2025'],
            ['parameter_name' => 'ckd_hospitalization', 'parameter_type' => 'hospitalization', 'value' => 18500, 'unit' => 'USD/year', 'lower_bound' => 12000, 'upper_bound' => 28000, 'distribution' => 'gamma', 'source_reference' => 'HCUP NIS 2023, CKD-related hospitalizations'],
            ['parameter_name' => 'dialysis_cost', 'parameter_type' => 'resource_use', 'value' => 5200, 'unit' => 'USD/year', 'lower_bound' => 3000, 'upper_bound' => 8000, 'distribution' => 'gamma', 'source_reference' => 'USRDS Annual Data Report 2024, pro-rated by progression probability'],
            ['parameter_name' => 'er_ckd_events', 'parameter_type' => 'er_visit', 'value' => 2800, 'unit' => 'USD/year', 'lower_bound' => 1500, 'upper_bound' => 4500, 'distribution' => 'gamma', 'source_reference' => 'MEPS 2023, CKD-related ED visits'],
            ['parameter_name' => 'baseline_utility', 'parameter_type' => 'qaly_weight', 'value' => 0.68, 'unit' => 'QALY/year', 'lower_bound' => 0.55, 'upper_bound' => 0.78, 'distribution' => 'beta', 'source_reference' => 'EQ-5D from DAPA-CKD, CKD Stage 3-4 baseline'],
        ]);

        // Intervention-specific parameters
        $this->createParams($analysis->id, $intervention->id, [
            ['parameter_name' => 'sglt2i_annual_cost', 'parameter_type' => 'drug_cost', 'value' => 5400, 'unit' => 'USD/year', 'lower_bound' => 4200, 'upper_bound' => 6800, 'distribution' => 'gamma', 'source_reference' => 'Dapagliflozin WAC + dispensing fee, net of rebates'],
            ['parameter_name' => 'sglt2i_monitoring', 'parameter_type' => 'admin_cost', 'value' => 450, 'unit' => 'USD/year', 'lower_bound' => 300, 'upper_bound' => 650, 'distribution' => 'gamma', 'source_reference' => 'Additional eGFR/potassium monitoring per FDA label'],
            ['parameter_name' => 'hospitalization_reduction', 'parameter_type' => 'hospitalization', 'value' => 6200, 'unit' => 'USD/year', 'lower_bound' => 3500, 'upper_bound' => 9000, 'distribution' => 'gamma', 'source_reference' => 'DAPA-CKD: 39% reduction in composite kidney outcome, annualized savings'],
            ['parameter_name' => 'sglt2i_utility_gain', 'parameter_type' => 'utility_value', 'value' => 0.08, 'unit' => 'QALY increment', 'lower_bound' => 0.04, 'upper_bound' => 0.14, 'distribution' => 'beta', 'source_reference' => 'DAPA-CKD QoL sub-study, EQ-5D improvement at 24 months'],
        ]);
    }

    // ─── 2. Budget Impact: GLP-1 RA for T2DM ──────────────────────────

    private function seedBudgetImpactAnalysis(int $adminId): void
    {
        $analysis = HeorAnalysis::firstOrCreate(
            ['name' => 'GLP-1 RA Budget Impact for T2DM Population'],
            [
                'created_by' => $adminId,
                'analysis_type' => 'budget_impact',
                'description' => 'Budget impact analysis of introducing GLP-1 receptor agonist therapy (semaglutide) into a health plan formulary for Type 2 Diabetes patients. Projects 5-year budget impact accounting for drug costs, cardiovascular event reductions, and weight-related comorbidity savings.',
                'perspective' => 'payer',
                'time_horizon' => '5_year',
                'discount_rate' => 0.03,
                'currency' => 'USD',
                'target_cohort_id' => 1,
                'status' => 'draft',
            ],
        );

        $baseCase = HeorScenario::firstOrCreate(
            ['analysis_id' => $analysis->id, 'name' => 'Current Formulary (No GLP-1 RA)'],
            [
                'scenario_type' => 'comparator',
                'description' => 'Current formulary without GLP-1 RA coverage. T2DM managed with metformin, sulfonylureas, DPP-4i, and insulin.',
                'is_base_case' => true,
                'sort_order' => 0,
            ],
        );

        $intervention = HeorScenario::firstOrCreate(
            ['analysis_id' => $analysis->id, 'name' => 'Add GLP-1 RA to Formulary'],
            [
                'scenario_type' => 'intervention',
                'description' => 'Add semaglutide 1mg weekly to preferred formulary tier. Assume 15% uptake in year 1, growing to 35% by year 5.',
                'is_base_case' => false,
                'sort_order' => 1,
            ],
        );

        $this->createParams($analysis->id, null, [
            ['parameter_name' => 'current_antidiabetic_cost', 'parameter_type' => 'drug_cost', 'value' => 3100, 'unit' => 'USD/year', 'lower_bound' => 2200, 'upper_bound' => 4200, 'distribution' => 'gamma', 'source_reference' => 'Weighted average: metformin + SU + DPP-4i mix'],
            ['parameter_name' => 'cv_hospitalization_cost', 'parameter_type' => 'hospitalization', 'value' => 22000, 'unit' => 'USD/event', 'lower_bound' => 15000, 'upper_bound' => 35000, 'distribution' => 'gamma', 'source_reference' => 'HCUP NIS 2023, MACE hospitalizations'],
            ['parameter_name' => 'obesity_comorbidity_cost', 'parameter_type' => 'resource_use', 'value' => 4200, 'unit' => 'USD/year', 'lower_bound' => 2800, 'upper_bound' => 6500, 'distribution' => 'gamma', 'source_reference' => 'Cawley et al. 2021, obesity-attributable medical costs'],
            ['parameter_name' => 'baseline_t2dm_utility', 'parameter_type' => 'qaly_weight', 'value' => 0.74, 'unit' => 'QALY/year', 'lower_bound' => 0.65, 'upper_bound' => 0.82, 'distribution' => 'beta', 'source_reference' => 'EQ-5D population norms, T2DM cohort'],
        ]);

        $this->createParams($analysis->id, $intervention->id, [
            ['parameter_name' => 'glp1ra_annual_cost', 'parameter_type' => 'drug_cost', 'value' => 9800, 'unit' => 'USD/year', 'lower_bound' => 7500, 'upper_bound' => 12500, 'distribution' => 'gamma', 'source_reference' => 'Semaglutide 1mg weekly WAC net of PBM rebates'],
            ['parameter_name' => 'cv_event_reduction_savings', 'parameter_type' => 'avoided_cost', 'value' => 6500, 'unit' => 'USD/year', 'lower_bound' => 3800, 'upper_bound' => 9200, 'distribution' => 'gamma', 'source_reference' => 'SUSTAIN-6/PIONEER-6: 26% MACE reduction, annualized'],
            ['parameter_name' => 'weight_loss_savings', 'parameter_type' => 'avoided_cost', 'value' => 2100, 'unit' => 'USD/year', 'lower_bound' => 1200, 'upper_bound' => 3500, 'distribution' => 'gamma', 'source_reference' => 'BMI reduction 4-5 kg/m², obesity cost offset model'],
            ['parameter_name' => 'glp1ra_utility_gain', 'parameter_type' => 'utility_value', 'value' => 0.05, 'unit' => 'QALY increment', 'lower_bound' => 0.02, 'upper_bound' => 0.09, 'distribution' => 'beta', 'source_reference' => 'SUSTAIN PRO sub-study, EQ-5D improvement'],
            ['parameter_name' => 'glp1ra_program_implementation', 'parameter_type' => 'program_cost', 'value' => 150000, 'unit' => 'USD one-time', 'lower_bound' => 80000, 'upper_bound' => 250000, 'distribution' => 'uniform', 'source_reference' => 'Formulary committee review, prior auth setup, provider education'],
        ]);
    }

    // ─── 3. ROI: Heart Failure Readmission Prevention Program ──────────

    private function seedRoiAnalysis(int $adminId): void
    {
        $analysis = HeorAnalysis::firstOrCreate(
            ['name' => 'Heart Failure Readmission Prevention Program ROI'],
            [
                'created_by' => $adminId,
                'analysis_type' => 'roi',
                'description' => 'Return on investment analysis for a comprehensive heart failure care management program including remote patient monitoring, nurse navigator, and transitional care. Targets 30-day readmission reduction per CMS Hospital Readmissions Reduction Program (HRRP).',
                'perspective' => 'provider',
                'time_horizon' => '5_year',
                'discount_rate' => 0.03,
                'currency' => 'USD',
                'target_cohort_id' => 4,
                'status' => 'draft',
            ],
        );

        $baseCase = HeorScenario::firstOrCreate(
            ['analysis_id' => $analysis->id, 'name' => 'No Care Management Program'],
            [
                'scenario_type' => 'comparator',
                'description' => 'Current state: standard discharge planning, no remote monitoring, no dedicated HF nurse navigator.',
                'is_base_case' => true,
                'sort_order' => 0,
            ],
        );

        $intervention = HeorScenario::firstOrCreate(
            ['analysis_id' => $analysis->id, 'name' => 'Comprehensive HF Care Management'],
            [
                'scenario_type' => 'intervention',
                'description' => 'RPM devices, nurse navigator FTE, pharmacist med reconciliation, 7-day post-discharge follow-up.',
                'is_base_case' => false,
                'sort_order' => 1,
            ],
        );

        $sensitivity = HeorScenario::firstOrCreate(
            ['analysis_id' => $analysis->id, 'name' => 'RPM-Only (Lean Program)'],
            [
                'scenario_type' => 'sensitivity',
                'description' => 'Remote patient monitoring only, no nurse navigator. Lower cost but potentially lower readmission reduction.',
                'is_base_case' => false,
                'sort_order' => 2,
                'parameter_overrides' => ['program_staffing' => 180000, 'readmission_savings' => 1800000],
            ],
        );

        // Global parameters
        $this->createParams($analysis->id, null, [
            ['parameter_name' => 'hf_readmission_cost', 'parameter_type' => 'hospitalization', 'value' => 15200, 'unit' => 'USD/admission', 'lower_bound' => 11000, 'upper_bound' => 22000, 'distribution' => 'gamma', 'source_reference' => 'CMS HRRP penalty-adjusted, mean HF readmission cost 2024'],
            ['parameter_name' => 'baseline_readmission_rate', 'parameter_type' => 'resource_use', 'value' => 3200, 'unit' => 'USD/year equivalent', 'lower_bound' => 2400, 'upper_bound' => 4500, 'distribution' => 'gamma', 'source_reference' => '22% 30-day readmission rate × cost, annualized'],
            ['parameter_name' => 'hf_ed_visits', 'parameter_type' => 'er_visit', 'value' => 4800, 'unit' => 'USD/year', 'lower_bound' => 3200, 'upper_bound' => 7000, 'distribution' => 'gamma', 'source_reference' => 'HF-related ED visits, MEPS 2023'],
            ['parameter_name' => 'baseline_hf_utility', 'parameter_type' => 'qaly_weight', 'value' => 0.56, 'unit' => 'QALY/year', 'lower_bound' => 0.42, 'upper_bound' => 0.68, 'distribution' => 'beta', 'source_reference' => 'EQ-5D, NYHA Class II-III average'],
        ]);

        // Intervention-specific
        $this->createParams($analysis->id, $intervention->id, [
            ['parameter_name' => 'rpm_technology', 'parameter_type' => 'program_cost', 'value' => 320000, 'unit' => 'USD/year', 'lower_bound' => 200000, 'upper_bound' => 500000, 'distribution' => 'gamma', 'source_reference' => 'RPM platform licensing + device costs for 500 patients'],
            ['parameter_name' => 'program_staffing', 'parameter_type' => 'program_cost', 'value' => 280000, 'unit' => 'USD/year', 'lower_bound' => 200000, 'upper_bound' => 380000, 'distribution' => 'gamma', 'source_reference' => '2 FTE nurse navigators + 0.5 FTE pharmacist'],
            ['parameter_name' => 'readmission_savings', 'parameter_type' => 'avoided_cost', 'value' => 2400000, 'unit' => 'USD/year', 'lower_bound' => 1500000, 'upper_bound' => 3500000, 'distribution' => 'gamma', 'source_reference' => '30% readmission reduction × 500 patients × $15.2K avg cost'],
            ['parameter_name' => 'hrrp_penalty_avoidance', 'parameter_type' => 'avoided_cost', 'value' => 450000, 'unit' => 'USD/year', 'lower_bound' => 200000, 'upper_bound' => 800000, 'distribution' => 'uniform', 'source_reference' => 'CMS HRRP penalty up to 3% of base DRG payments'],
            ['parameter_name' => 'care_mgmt_utility_gain', 'parameter_type' => 'utility_value', 'value' => 0.06, 'unit' => 'QALY increment', 'lower_bound' => 0.02, 'upper_bound' => 0.11, 'distribution' => 'beta', 'source_reference' => 'RPM + nurse navigator QoL improvement, systematic review'],
        ]);
    }

    // ─── 4. CUA: Antihypertensive Therapy Value Assessment ─────────────

    private function seedCuaAnalysis(int $adminId): void
    {
        $analysis = HeorAnalysis::firstOrCreate(
            ['name' => 'Antihypertensive Therapy Cost-Utility Analysis'],
            [
                'created_by' => $adminId,
                'analysis_type' => 'cua',
                'description' => 'Cost-utility analysis comparing intensive blood pressure control (target <120 mmHg systolic) versus standard control (<140 mmHg) in hypertensive patients. Based on SPRINT trial outcomes with lifetime horizon modeling.',
                'perspective' => 'societal',
                'time_horizon' => 'lifetime',
                'discount_rate' => 0.03,
                'currency' => 'USD',
                'target_cohort_id' => 2,
                'comparator_cohort_id' => 3,
                'status' => 'draft',
            ],
        );

        $baseCase = HeorScenario::firstOrCreate(
            ['analysis_id' => $analysis->id, 'name' => 'Standard BP Control (<140 mmHg)'],
            [
                'scenario_type' => 'comparator',
                'description' => 'Standard blood pressure target <140/90 mmHg. Average 1.8 antihypertensive medications.',
                'is_base_case' => true,
                'sort_order' => 0,
            ],
        );

        $intervention = HeorScenario::firstOrCreate(
            ['analysis_id' => $analysis->id, 'name' => 'Intensive BP Control (<120 mmHg)'],
            [
                'scenario_type' => 'intervention',
                'description' => 'Intensive target <120 mmHg systolic. Average 2.8 medications, more frequent monitoring.',
                'is_base_case' => false,
                'sort_order' => 1,
            ],
        );

        // Global parameters (standard care costs)
        $this->createParams($analysis->id, null, [
            ['parameter_name' => 'antihypertensive_drugs', 'parameter_type' => 'drug_cost', 'value' => 960, 'unit' => 'USD/year', 'lower_bound' => 600, 'upper_bound' => 1400, 'distribution' => 'gamma', 'source_reference' => 'Generic ACE-I/ARB + thiazide, GoodRx 2025'],
            ['parameter_name' => 'routine_monitoring', 'parameter_type' => 'admin_cost', 'value' => 680, 'unit' => 'USD/year', 'lower_bound' => 450, 'upper_bound' => 950, 'distribution' => 'gamma', 'source_reference' => 'Biannual BP checks, annual BMP, Medicare fee schedule'],
            ['parameter_name' => 'cv_event_hospitalization', 'parameter_type' => 'hospitalization', 'value' => 8500, 'unit' => 'USD/year', 'lower_bound' => 5000, 'upper_bound' => 14000, 'distribution' => 'gamma', 'source_reference' => 'HCUP NIS 2023, stroke/MI/HF probability-weighted annual cost'],
            ['parameter_name' => 'standard_bp_utility', 'parameter_type' => 'qaly_weight', 'value' => 0.82, 'unit' => 'QALY/year', 'lower_bound' => 0.74, 'upper_bound' => 0.89, 'distribution' => 'beta', 'source_reference' => 'EQ-5D controlled hypertension population norms'],
        ]);

        // Intensive control parameters
        $this->createParams($analysis->id, $intervention->id, [
            ['parameter_name' => 'intensive_drug_cost', 'parameter_type' => 'drug_cost', 'value' => 1680, 'unit' => 'USD/year', 'lower_bound' => 1200, 'upper_bound' => 2400, 'distribution' => 'gamma', 'source_reference' => 'Average 2.8 meds vs 1.8 in standard arm, SPRINT'],
            ['parameter_name' => 'intensive_monitoring', 'parameter_type' => 'admin_cost', 'value' => 1200, 'unit' => 'USD/year', 'lower_bound' => 800, 'upper_bound' => 1700, 'distribution' => 'gamma', 'source_reference' => 'Quarterly visits + additional labs for intensive monitoring'],
            ['parameter_name' => 'cv_reduction_savings', 'parameter_type' => 'hospitalization', 'value' => 5100, 'unit' => 'USD/year', 'lower_bound' => 3000, 'upper_bound' => 8000, 'distribution' => 'gamma', 'source_reference' => 'SPRINT: 25% CV composite reduction, lower hospitalization rate'],
            ['parameter_name' => 'ae_management_cost', 'parameter_type' => 'er_visit', 'value' => 420, 'unit' => 'USD/year', 'lower_bound' => 200, 'upper_bound' => 750, 'distribution' => 'gamma', 'source_reference' => 'Hypotension, syncope, AKI events from intensive therapy (SPRINT SAE data)'],
            ['parameter_name' => 'intensive_utility_gain', 'parameter_type' => 'utility_value', 'value' => 0.03, 'unit' => 'QALY increment', 'lower_bound' => 0.01, 'upper_bound' => 0.06, 'distribution' => 'beta', 'source_reference' => 'SPRINT QoL sub-study, net of adverse event disutility'],
        ]);
    }

    // ─── 5. CBA: CAD Secondary Prevention ──────────────────────────────

    private function seedCbaAnalysis(int $adminId): void
    {
        $analysis = HeorAnalysis::firstOrCreate(
            ['name' => 'CAD Secondary Prevention Cost-Benefit Analysis'],
            [
                'created_by' => $adminId,
                'analysis_type' => 'cba',
                'description' => 'Cost-benefit analysis of a comprehensive cardiac rehabilitation and secondary prevention program for post-ACS patients. Includes structured exercise, lipid optimization, and psychosocial support. Evaluates net monetary benefit over 10 years.',
                'perspective' => 'payer',
                'time_horizon' => '10_year',
                'discount_rate' => 0.03,
                'currency' => 'USD',
                'target_cohort_id' => 3,
                'comparator_cohort_id' => 4,
                'status' => 'draft',
            ],
        );

        $baseCase = HeorScenario::firstOrCreate(
            ['analysis_id' => $analysis->id, 'name' => 'Standard Post-ACS Care'],
            [
                'scenario_type' => 'comparator',
                'description' => 'Standard discharge with medication optimization only. No structured cardiac rehabilitation referral.',
                'is_base_case' => true,
                'sort_order' => 0,
            ],
        );

        $intervention = HeorScenario::firstOrCreate(
            ['analysis_id' => $analysis->id, 'name' => 'Comprehensive Cardiac Rehab Program'],
            [
                'scenario_type' => 'intervention',
                'description' => '36-session cardiac rehab + lipid clinic + psychosocial screening. Targets MACE reduction and improved functional capacity.',
                'is_base_case' => false,
                'sort_order' => 1,
            ],
        );

        HeorScenario::firstOrCreate(
            ['analysis_id' => $analysis->id, 'name' => 'Home-Based Cardiac Rehab'],
            [
                'scenario_type' => 'sensitivity',
                'description' => 'Hybrid model: 12 supervised sessions + 24 home-based sessions with telehealth monitoring. Lower cost, potentially lower completion rates.',
                'is_base_case' => false,
                'sort_order' => 2,
                'parameter_overrides' => ['cardiac_rehab_cost' => 3200, 'recurrent_mace_reduction' => 4500],
            ],
        );

        // Global parameters (standard care)
        $this->createParams($analysis->id, null, [
            ['parameter_name' => 'statin_therapy_cost', 'parameter_type' => 'drug_cost', 'value' => 1800, 'unit' => 'USD/year', 'lower_bound' => 1200, 'upper_bound' => 2800, 'distribution' => 'gamma', 'source_reference' => 'High-intensity statin + ezetimibe + antiplatelet, generic prices'],
            ['parameter_name' => 'cardiology_followup', 'parameter_type' => 'admin_cost', 'value' => 2200, 'unit' => 'USD/year', 'lower_bound' => 1500, 'upper_bound' => 3200, 'distribution' => 'gamma', 'source_reference' => 'Quarterly cardiology visits + annual stress testing'],
            ['parameter_name' => 'recurrent_mace_cost', 'parameter_type' => 'hospitalization', 'value' => 12000, 'unit' => 'USD/year', 'lower_bound' => 7000, 'upper_bound' => 20000, 'distribution' => 'gamma', 'source_reference' => 'Annualized recurrent MI/stroke/CV death probability × per-event cost'],
            ['parameter_name' => 'post_acs_ed_visits', 'parameter_type' => 'er_visit', 'value' => 3200, 'unit' => 'USD/year', 'lower_bound' => 2000, 'upper_bound' => 5500, 'distribution' => 'gamma', 'source_reference' => 'Chest pain/dyspnea ED visits post-ACS, MEPS'],
            ['parameter_name' => 'post_acs_utility', 'parameter_type' => 'qaly_weight', 'value' => 0.72, 'unit' => 'QALY/year', 'lower_bound' => 0.60, 'upper_bound' => 0.82, 'distribution' => 'beta', 'source_reference' => 'EQ-5D post-ACS population, systematic review'],
        ]);

        // Cardiac rehab intervention parameters
        $this->createParams($analysis->id, $intervention->id, [
            ['parameter_name' => 'cardiac_rehab_cost', 'parameter_type' => 'program_cost', 'value' => 5800, 'unit' => 'USD per patient', 'lower_bound' => 4000, 'upper_bound' => 8000, 'distribution' => 'gamma', 'source_reference' => '36-session outpatient cardiac rehab, Medicare reimbursement'],
            ['parameter_name' => 'lipid_clinic_cost', 'parameter_type' => 'admin_cost', 'value' => 800, 'unit' => 'USD/year', 'lower_bound' => 500, 'upper_bound' => 1200, 'distribution' => 'gamma', 'source_reference' => 'Quarterly pharmacist-led lipid clinic visits'],
            ['parameter_name' => 'recurrent_mace_reduction', 'parameter_type' => 'avoided_cost', 'value' => 5600, 'unit' => 'USD/year', 'lower_bound' => 3200, 'upper_bound' => 8500, 'distribution' => 'gamma', 'source_reference' => 'Cochrane review: 26% recurrent MACE reduction with cardiac rehab'],
            ['parameter_name' => 'ed_visit_reduction', 'parameter_type' => 'avoided_cost', 'value' => 1800, 'unit' => 'USD/year', 'lower_bound' => 900, 'upper_bound' => 3000, 'distribution' => 'gamma', 'source_reference' => 'Reduced chest pain presentations post-rehab'],
            ['parameter_name' => 'rehab_utility_gain', 'parameter_type' => 'utility_value', 'value' => 0.07, 'unit' => 'QALY increment', 'lower_bound' => 0.03, 'upper_bound' => 0.12, 'distribution' => 'beta', 'source_reference' => 'Cardiac rehab QoL improvement, Cochrane SR'],
        ]);
    }

    // ─── Value-Based Contracts ──────────────────────────────────────────

    private function seedValueContracts(int $adminId): void
    {
        $sglt2Analysis = HeorAnalysis::where('name', 'SGLT2i vs Standard of Care for T2DM with CKD')->first();
        $glp1Analysis = HeorAnalysis::where('name', 'GLP-1 RA Budget Impact for T2DM Population')->first();

        if ($sglt2Analysis) {
            HeorValueContract::firstOrCreate(
                ['contract_name' => 'Dapagliflozin Outcomes-Based Contract'],
                [
                    'analysis_id' => $sglt2Analysis->id,
                    'created_by' => $adminId,
                    'drug_name' => 'Dapagliflozin 10mg',
                    'contract_type' => 'outcomes_based',
                    'outcome_metric' => 'Composite kidney endpoint (50% eGFR decline, ESKD, or renal death)',
                    'baseline_rate' => 0.143,
                    'rebate_tiers' => [
                        ['threshold' => 0.10, 'rebate_percent' => 5],
                        ['threshold' => 0.20, 'rebate_percent' => 12],
                        ['threshold' => 0.30, 'rebate_percent' => 20],
                        ['threshold' => 0.40, 'rebate_percent' => 30],
                    ],
                    'list_price' => 540.00,
                    'net_price_floor' => 378.00,
                    'measurement_period_months' => 24,
                    'status' => 'active',
                    'effective_date' => now()->subMonths(6),
                ],
            );
        }

        if ($glp1Analysis) {
            HeorValueContract::firstOrCreate(
                ['contract_name' => 'Semaglutide HbA1c Performance Guarantee'],
                [
                    'analysis_id' => $glp1Analysis->id,
                    'created_by' => $adminId,
                    'drug_name' => 'Semaglutide 1mg weekly',
                    'contract_type' => 'outcomes_based',
                    'outcome_metric' => 'HbA1c reduction ≥1.0% at 12 months',
                    'baseline_rate' => 0.45,
                    'rebate_tiers' => [
                        ['threshold' => 0.15, 'rebate_percent' => 8],
                        ['threshold' => 0.25, 'rebate_percent' => 15],
                        ['threshold' => 0.35, 'rebate_percent' => 22],
                    ],
                    'list_price' => 850.00,
                    'net_price_floor' => 637.50,
                    'measurement_period_months' => 12,
                    'status' => 'active',
                    'effective_date' => now()->subMonths(3),
                ],
            );

            HeorValueContract::firstOrCreate(
                ['contract_name' => 'Semaglutide Weight Loss Warranty'],
                [
                    'analysis_id' => $glp1Analysis->id,
                    'created_by' => $adminId,
                    'drug_name' => 'Semaglutide 1mg weekly',
                    'contract_type' => 'warranty',
                    'outcome_metric' => 'Body weight reduction ≥5% at 6 months',
                    'baseline_rate' => 0.30,
                    'rebate_tiers' => [
                        ['threshold' => 0.20, 'rebate_percent' => 10],
                        ['threshold' => 0.40, 'rebate_percent' => 25],
                    ],
                    'list_price' => 850.00,
                    'net_price_floor' => 680.00,
                    'measurement_period_months' => 6,
                    'status' => 'draft',
                ],
            );
        }
    }

    // ─── Execute All Analyses ───────────────────────────────────────────

    private function executeAllAnalyses(): void
    {
        $service = app(HeorEconomicsService::class);
        $analyses = HeorAnalysis::whereIn('status', ['draft', 'failed'])->get();

        foreach ($analyses as $analysis) {
            $this->command->info("Running HEOR analysis: {$analysis->name}...");
            try {
                $result = $service->runAnalysis($analysis);
                $this->command->info("  ✓ {$result['scenarios_computed']} scenarios computed, {$result['errors']} errors.");
            } catch (\Throwable $e) {
                $this->command->error("  ✗ Failed: {$e->getMessage()}");
            }
        }
    }

    // ─── Helper: Batch Create Parameters ────────────────────────────────

    private function createParams(int $analysisId, ?int $scenarioId, array $params): void
    {
        foreach ($params as $p) {
            HeorCostParameter::firstOrCreate(
                [
                    'analysis_id' => $analysisId,
                    'scenario_id' => $scenarioId,
                    'parameter_name' => $p['parameter_name'],
                ],
                [
                    'parameter_type' => $p['parameter_type'],
                    'value' => $p['value'],
                    'unit' => $p['unit'] ?? null,
                    'lower_bound' => $p['lower_bound'] ?? null,
                    'upper_bound' => $p['upper_bound'] ?? null,
                    'distribution' => $p['distribution'] ?? null,
                    'source_reference' => $p['source_reference'] ?? null,
                ],
            );
        }
    }
}
