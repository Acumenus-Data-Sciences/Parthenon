<?php

namespace Database\Seeders;

use App\Models\App\Study;
use App\Models\User;
use Illuminate\Database\Seeder;

class StudySeeder extends Seeder
{
    /**
     * Seed 3 sample studies at different lifecycle stages.
     */
    public function run(): void
    {
        $adminId = User::where('email', 'admin@parthenon.local')->value('id');
        if (! $adminId) {
            $this->command->warn('Admin user not found — skipping study seeding.');

            return;
        }

        $studies = [
            [
                'title' => 'LEGEND-T2DM: Large-scale Evidence Generation for Diabetes Management',
                'short_title' => 'LEGEND-T2DM',
                'study_type' => 'comparative_effectiveness',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'high',
                'description' => 'A large-scale, multi-database comparative effectiveness study evaluating second-line antihyperglycemic agents in patients with type 2 diabetes mellitus who have inadequate glycemic control on metformin monotherapy. This study follows the OHDSI LEGEND framework for systematic evidence generation.',
                'scientific_rationale' => 'Despite numerous antihyperglycemic agents available, comparative effectiveness data between second-line agents remains limited. Most clinical trials compare agents to placebo rather than active comparators, leaving clinicians without evidence-based guidance for treatment selection.',
                'hypothesis' => 'There are clinically meaningful differences in cardiovascular outcomes, glycemic control, and safety profiles between GLP-1 receptor agonists, SGLT2 inhibitors, DPP-4 inhibitors, and sulfonylureas when used as second-line therapy after metformin.',
                'primary_objective' => 'To estimate the comparative effectiveness and safety of second-line antihyperglycemic agents on a composite cardiovascular outcome (MACE) in patients with T2DM.',
                'secondary_objectives' => [
                    'Evaluate HbA1c reduction at 12 months across treatment groups',
                    'Assess risk of hypoglycemia across treatment classes',
                    'Characterize renal outcomes (eGFR decline, progression to CKD stage 4+)',
                    'Evaluate weight change trajectories',
                ],
                'study_start_date' => '2025-06-01',
                'study_end_date' => '2026-12-31',
                'target_enrollment_sites' => 8,
                'actual_enrollment_sites' => 5,
                'protocol_version' => '2.1',
                'funding_source' => 'OHDSI Foundation Grant #2025-0142',
                'clinicaltrials_gov_id' => 'NCT06123456',
                'tags' => ['diabetes', 'cardiovascular', 'LEGEND', 'comparative-effectiveness'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],
            [
                'title' => 'SCDM Breast Cancer Characterization Study',
                'short_title' => 'SCDM-BC',
                'study_type' => 'characterization',
                'study_design' => 'cross_sectional',
                'status' => 'draft',
                'phase' => 'pre_study',
                'priority' => 'medium',
                'description' => 'A multi-site characterization study to describe the baseline demographics, comorbidity burden, treatment patterns, and healthcare utilization of patients with newly diagnosed breast cancer across multiple OMOP CDM databases.',
                'scientific_rationale' => 'Understanding the real-world patient population with breast cancer is essential for designing future interventional studies and identifying potential treatment disparities.',
                'hypothesis' => null,
                'primary_objective' => 'To characterize the demographic and clinical features of patients with incident breast cancer diagnosis across participating sites.',
                'secondary_objectives' => [
                    'Describe first-line treatment patterns by cancer stage',
                    'Identify comorbidity burden and its association with treatment selection',
                    'Characterize healthcare utilization in the 12 months following diagnosis',
                ],
                'study_start_date' => null,
                'study_end_date' => null,
                'target_enrollment_sites' => 5,
                'actual_enrollment_sites' => 0,
                'protocol_version' => null,
                'funding_source' => null,
                'clinicaltrials_gov_id' => null,
                'tags' => ['oncology', 'breast-cancer', 'characterization'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],
            [
                'title' => 'COVID-19 Vaccine Safety Surveillance: mRNA Boosters and Myocarditis',
                'short_title' => 'CoVax-Myocarditis',
                'study_type' => 'safety_surveillance',
                'study_design' => 'self_controlled_case_series',
                'status' => 'published',
                'phase' => 'post_study',
                'priority' => 'critical',
                'description' => 'A multinational self-controlled case series (SCCS) study examining the association between mRNA COVID-19 booster vaccinations and myocarditis/pericarditis events, stratified by age, sex, and vaccine product.',
                'scientific_rationale' => 'Signal detection from passive surveillance systems (VAERS, EudraVigilance) identified a potential association between mRNA vaccines and myocarditis. Rigorous pharmacoepidemiologic studies using OMOP CDM data are needed to quantify this risk in the general population.',
                'hypothesis' => 'mRNA COVID-19 booster vaccines are associated with an increased short-term risk of myocarditis, particularly in males aged 16-39, with the risk varying by vaccine product (BNT162b2 vs mRNA-1273).',
                'primary_objective' => 'To estimate the incidence rate ratio of myocarditis in the 1-28 day risk window following mRNA booster vaccination using self-controlled case series methodology.',
                'secondary_objectives' => [
                    'Stratify risk by age group (12-15, 16-39, 40-64, 65+)',
                    'Compare risk between BNT162b2 (Pfizer) and mRNA-1273 (Moderna)',
                    'Assess risk by booster dose number (3rd vs 4th dose)',
                    'Evaluate pericarditis as a separate outcome',
                ],
                'study_start_date' => '2024-01-15',
                'study_end_date' => '2025-09-30',
                'target_enrollment_sites' => 12,
                'actual_enrollment_sites' => 12,
                'protocol_version' => '3.0',
                'protocol_finalized_at' => '2024-02-28 00:00:00',
                'funding_source' => 'FDA Sentinel Initiative / BEST',
                'clinicaltrials_gov_id' => 'NCT05678901',
                'tags' => ['covid-19', 'vaccine-safety', 'myocarditis', 'SCCS', 'published'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],
        ];

        foreach ($studies as $studyData) {
            Study::firstOrCreate(
                ['title' => $studyData['title']],
                $studyData,
            );
        }

        $this->command->info('StudySeeder: 3 sample studies seeded.');
    }
}
