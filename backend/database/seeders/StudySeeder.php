<?php

namespace Database\Seeders;

use App\Models\App\CohortDefinition;
use App\Models\App\Source;
use App\Models\App\Study;
use App\Models\App\StudyActivityLog;
use App\Models\App\StudyArtifact;
use App\Models\App\StudyCohort;
use App\Models\App\StudyMilestone;
use App\Models\App\StudySite;
use App\Models\App\StudyTeamMember;
use App\Models\User;
use Illuminate\Database\Seeder;

class StudySeeder extends Seeder
{
    /**
     * Seed comprehensive OHDSI network studies catalog.
     *
     * Studies sourced from github.com/ohdsi-studies (186 repositories)
     * and data.ohdsi.org/OhdsiStudies — representing real-world federated
     * outcomes research across the OHDSI network.
     */
    public function run(): void
    {
        $adminId = User::where('email', 'admin@acumenus.net')->value('id');
        if (! $adminId) {
            $this->command->warn('Admin user not found — skipping study seeding.');

            return;
        }

        $studies = [
            // ── LEGEND Program ──────────────────────────────────────────────

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
                'tags' => ['diabetes', 'cardiovascular', 'LEGEND', 'comparative-effectiveness', 'multi-database'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'LEGEND-T2DM ARPA-H: Advanced Diabetes Evidence Generation',
                'short_title' => 'LEGEND-T2DM-ARPA',
                'study_type' => 'comparative_effectiveness',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'high',
                'description' => 'ARPA-H funded extension of LEGEND-T2DM incorporating novel data sources, expanded outcome definitions, and advanced causal inference methods. This study leverages federated analytics across OMOP CDM databases to generate comparative effectiveness evidence at unprecedented scale.',
                'scientific_rationale' => 'Building on LEGEND-T2DM findings, this ARPA-H extension addresses gaps in evidence for newer agents (tirzepatide, oral semaglutide) and evaluates heterogeneous treatment effects across patient subgroups.',
                'hypothesis' => 'Newer GLP-1/GIP dual agonists provide superior cardiovascular and metabolic outcomes compared to established second-line agents, with effect modification by baseline BMI, eGFR, and cardiovascular risk.',
                'primary_objective' => 'To generate large-scale comparative effectiveness evidence for newer T2DM agents using advanced causal inference methods across a federated database network.',
                'secondary_objectives' => [
                    'Evaluate tirzepatide vs established GLP-1 agonists on composite cardiovascular outcome',
                    'Assess heterogeneous treatment effects using OHDSI PatientLevelPrediction framework',
                    'Characterize treatment pathways and switching patterns',
                ],
                'study_start_date' => '2025-09-01',
                'study_end_date' => '2027-06-30',
                'target_enrollment_sites' => 12,
                'actual_enrollment_sites' => 4,
                'protocol_version' => '1.0',
                'funding_source' => 'ARPA-H / OHDSI Collaborative',
                'tags' => ['diabetes', 'LEGEND', 'ARPA-H', 'comparative-effectiveness', 'federated'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'LEGEND-HTN Step Care: Hypertension Treatment Pathway Effectiveness',
                'short_title' => 'LEGEND-HTN',
                'study_type' => 'comparative_effectiveness',
                'study_design' => 'cohort',
                'status' => 'analysis',
                'phase' => 'active',
                'priority' => 'high',
                'description' => 'A LEGEND-framework study evaluating hypertension step-care treatment pathway effectiveness across a network of OMOP CDM databases. Compares initial monotherapy choices (ACE inhibitors, ARBs, calcium channel blockers, thiazide diuretics) and second-step intensification strategies.',
                'scientific_rationale' => 'Current hypertension guidelines recommend multiple first-line drug classes without definitive evidence for preferred sequencing. Real-world comparative effectiveness across large patient populations can inform clinical decision-making.',
                'hypothesis' => 'Initial antihypertensive monotherapy class selection significantly affects long-term cardiovascular outcomes and the probability of achieving blood pressure control.',
                'primary_objective' => 'To compare cardiovascular outcomes across hypertension step-care treatment pathways using population-level estimation methods.',
                'secondary_objectives' => [
                    'Evaluate time to blood pressure control by initial therapy class',
                    'Assess adverse event profiles (hyperkalemia, angioedema, hyponatremia) by drug class',
                    'Characterize treatment persistence and switching patterns',
                ],
                'study_start_date' => '2025-03-01',
                'study_end_date' => '2026-09-30',
                'target_enrollment_sites' => 10,
                'actual_enrollment_sites' => 8,
                'protocol_version' => '2.0',
                'funding_source' => 'OHDSI Foundation',
                'tags' => ['hypertension', 'LEGEND', 'step-care', 'treatment-pathways', 'cardiovascular'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Evaluating Cardinality Matching Using LEGEND-HTN Framework',
                'short_title' => 'HTN-CardMatch',
                'study_type' => 'comparative_effectiveness',
                'study_design' => 'cohort',
                'status' => 'published',
                'phase' => 'post_study',
                'priority' => 'low',
                'description' => 'A methodological study evaluating cardinality matching as an alternative to propensity score matching in the LEGEND-HTN framework. Compares covariate balance, effective sample size, and treatment effect estimates between matching methods across multiple databases.',
                'scientific_rationale' => 'Propensity score matching discards unmatched patients, reducing sample size. Cardinality matching optimizes balance directly while retaining more patients. This study evaluates its utility in large-scale comparative effectiveness research.',
                'primary_objective' => 'To evaluate the performance of cardinality matching compared to propensity score matching in the LEGEND-HTN study framework.',
                'secondary_objectives' => [
                    'Compare covariate balance metrics between matching approaches',
                    'Assess impact on treatment effect estimates and confidence intervals',
                    'Evaluate computational feasibility at scale',
                ],
                'study_start_date' => '2023-06-01',
                'study_end_date' => '2025-03-31',
                'target_enrollment_sites' => 4,
                'actual_enrollment_sites' => 4,
                'protocol_version' => '2.0',
                'protocol_finalized_at' => '2023-07-15 00:00:00',
                'funding_source' => 'OHDSI Methods Library',
                'tags' => ['methodology', 'LEGEND', 'hypertension', 'matching', 'causal-inference', 'published'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            // ── Population-Level Estimation ─────────────────────────────────

            [
                'title' => 'GLP-1 Receptor Agonists and Drug-Induced Liver Injury (DILI)',
                'short_title' => 'GLP1-DILI',
                'study_type' => 'safety_surveillance',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'high',
                'description' => 'A multi-database population-level estimation study investigating the association between GLP-1 receptor agonist use and drug-induced liver injury (DILI). Uses new-user cohort design with active comparators and negative control outcomes for empirical calibration.',
                'scientific_rationale' => 'Post-marketing reports have raised concerns about hepatotoxicity with GLP-1 receptor agonists. Systematic evaluation across real-world databases using validated DILI phenotypes and proper confounding control is needed.',
                'hypothesis' => 'GLP-1 receptor agonist use is not associated with an increased risk of DILI compared to DPP-4 inhibitors when accounting for confounding through propensity score matching.',
                'primary_objective' => 'To estimate the hazard ratio of DILI comparing new users of GLP-1 receptor agonists to new users of DPP-4 inhibitors.',
                'secondary_objectives' => [
                    'Evaluate individual GLP-1 agents (semaglutide, liraglutide, dulaglutide) separately',
                    'Assess dose-response relationship where data permits',
                    'Validate DILI phenotype across databases using chart review substudy',
                ],
                'study_start_date' => '2025-07-01',
                'study_end_date' => '2026-06-30',
                'target_enrollment_sites' => 6,
                'actual_enrollment_sites' => 3,
                'protocol_version' => '1.2',
                'funding_source' => 'OHDSI Community Study',
                'tags' => ['GLP-1', 'hepatotoxicity', 'DILI', 'drug-safety', 'population-level-estimation'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Semaglutide and Nonarteritic Anterior Ischemic Optic Neuropathy',
                'short_title' => 'Sema-NAION',
                'study_type' => 'safety_surveillance',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'critical',
                'description' => 'A large-scale pharmacoepidemiologic study evaluating the potential association between semaglutide (Ozempic/Wegovy) and nonarteritic anterior ischemic optic neuropathy (NAION). Originated from the 2023 SOS Challenge study-a-thon. Uses new-user active comparator design across OHDSI network databases.',
                'scientific_rationale' => 'A case series from Brigham and Women\'s Hospital identified a potential signal for NAION following semaglutide initiation. Given the rapidly expanding use of GLP-1 agonists for diabetes and obesity, urgent large-scale evaluation is warranted.',
                'hypothesis' => 'Semaglutide use is associated with an elevated risk of NAION compared to other antihyperglycemic agents, with potential effect modification by diabetes vs. obesity indication.',
                'primary_objective' => 'To estimate the incidence rate ratio of NAION in new users of semaglutide vs. new users of other GLP-1 agonists and DPP-4 inhibitors.',
                'secondary_objectives' => [
                    'Stratify by indication (T2DM vs obesity/weight management)',
                    'Evaluate dose-response relationship',
                    'Assess risk across subgroups with known NAION risk factors (hypertension, diabetes, sleep apnea)',
                ],
                'study_start_date' => '2025-04-01',
                'study_end_date' => '2026-03-31',
                'target_enrollment_sites' => 8,
                'actual_enrollment_sites' => 6,
                'protocol_version' => '1.5',
                'funding_source' => 'OHDSI SOS Challenge / NEI Co-funding',
                'tags' => ['semaglutide', 'NAION', 'ophthalmology', 'drug-safety', 'GLP-1', 'SOS-Challenge'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Comparative Effectiveness of Antipsychotics for First-Episode Psychosis',
                'short_title' => 'FEP-Rx',
                'study_type' => 'comparative_effectiveness',
                'study_design' => 'cohort',
                'status' => 'protocol_development',
                'phase' => 'pre_study',
                'priority' => 'medium',
                'description' => 'A federated network study comparing the effectiveness and safety of first-generation vs. second-generation antipsychotics as initial treatment for first-episode psychosis (FEP). Evaluates treatment persistence, relapse, metabolic effects, and hospitalization across OMOP CDM databases.',
                'scientific_rationale' => 'First-episode psychosis is a critical treatment window where medication choice can significantly impact long-term outcomes. Current guidelines favor second-generation antipsychotics, but real-world comparative effectiveness data across specific agents remains limited.',
                'primary_objective' => 'To compare 1-year treatment persistence and all-cause hospitalization rates across antipsychotic medications initiated for first-episode psychosis.',
                'secondary_objectives' => [
                    'Assess metabolic outcomes (weight gain, new-onset diabetes, dyslipidemia) by agent',
                    'Evaluate extrapyramidal symptom rates by agent class',
                    'Characterize treatment switching patterns in the first 12 months',
                ],
                'study_start_date' => null,
                'study_end_date' => null,
                'target_enrollment_sites' => 5,
                'actual_enrollment_sites' => 0,
                'protocol_version' => '0.3',
                'tags' => ['psychiatry', 'psychosis', 'antipsychotics', 'comparative-effectiveness'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'PCV Dosing Schedule: Childhood Pneumococcal Vaccine Comparative Effectiveness',
                'short_title' => 'PCV-Dosing',
                'study_type' => 'comparative_effectiveness',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'medium',
                'description' => 'A multi-database study comparing the effectiveness of different childhood pneumococcal conjugate vaccine (PCV) dosing schedules (3+1 vs 2+1 vs 3+0) on invasive pneumococcal disease and pneumonia outcomes using OMOP CDM data from multiple countries.',
                'scientific_rationale' => 'Different countries use different PCV dosing schedules. Comparative data from real-world populations across diverse healthcare systems can inform WHO and national immunization guidelines.',
                'primary_objective' => 'To compare the effectiveness of PCV dosing schedules on invasive pneumococcal disease incidence in children under 5 years.',
                'secondary_objectives' => [
                    'Assess all-cause pneumonia hospitalization rates by dosing schedule',
                    'Evaluate schedule-specific effectiveness by serotype coverage',
                ],
                'study_start_date' => '2025-05-01',
                'study_end_date' => '2026-11-30',
                'target_enrollment_sites' => 7,
                'actual_enrollment_sites' => 4,
                'protocol_version' => '1.1',
                'funding_source' => 'Bill & Melinda Gates Foundation',
                'tags' => ['vaccines', 'pediatrics', 'pneumococcal', 'comparative-effectiveness', 'global-health'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            // ── Methodological Research (additional) ────────────────────────

            [
                'title' => 'Small Sample Estimation Evaluation: Comparative Effect Estimation Performance',
                'short_title' => 'SmallSample-Est',
                'study_type' => 'characterization',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'medium',
                'description' => 'A methodological study evaluating the performance of comparative effect estimation methods when sample sizes are small. Assesses bias, coverage, and type I error rates of propensity score and outcome model methods across a range of sample sizes using OHDSI network databases.',
                'scientific_rationale' => 'Many observational studies involve rare exposures or outcomes resulting in small effective sample sizes. Understanding how standard methods degrade with small samples helps researchers choose appropriate methods and recognize unreliable estimates.',
                'primary_objective' => 'To evaluate bias, coverage, and type I error of common comparative effect estimation methods across a range of sample sizes.',
                'secondary_objectives' => [
                    'Determine minimum sample size thresholds for reliable estimation by method',
                    'Compare regularized vs. unregularized propensity score models at small N',
                    'Develop practical guidance for method selection based on sample size',
                ],
                'study_start_date' => '2025-04-01',
                'study_end_date' => '2026-10-31',
                'target_enrollment_sites' => 3,
                'actual_enrollment_sites' => 3,
                'protocol_version' => '1.0',
                'funding_source' => 'OHDSI Methods Library',
                'tags' => ['methodology', 'sample-size', 'estimation', 'causal-inference'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Exploring Causal Estimands in Observational Research',
                'short_title' => 'CausalEstimands',
                'study_type' => 'characterization',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'medium',
                'description' => 'Evaluation of various causal models and estimands (ATE, ATT, per-protocol, ITT analogues) using both simulation and real OMOP CDM data. Investigates how estimand choice affects clinical conclusions in comparative effectiveness studies.',
                'scientific_rationale' => 'Different causal estimands answer different clinical questions. The OHDSI CohortMethod package primarily targets ITT-analogues, but clinicians may be interested in per-protocol or subgroup-specific effects. Understanding when estimands diverge is critical.',
                'primary_objective' => 'To evaluate how the choice of causal estimand (ATE, ATT, per-protocol) affects treatment effect estimates in observational CER studies.',
                'secondary_objectives' => [
                    'Compare estimand-specific results on LEGEND benchmark drug-outcome pairs',
                    'Develop guidance for estimand selection in regulatory submissions',
                    'Assess sensitivity of conclusions to estimand choice across databases',
                ],
                'study_start_date' => '2025-05-01',
                'study_end_date' => '2026-11-30',
                'target_enrollment_sites' => 4,
                'actual_enrollment_sites' => 4,
                'protocol_version' => '1.0',
                'funding_source' => 'OHDSI Methods Library',
                'tags' => ['methodology', 'causal-inference', 'estimands', 'simulation'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Exploring Censoring Weights for Observational Studies',
                'short_title' => 'CensorWeights',
                'study_type' => 'characterization',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'low',
                'description' => 'Investigation of inverse probability of censoring weights (IPCW) methods to address informative censoring in observational comparative effectiveness studies. Evaluates how censoring weight methods compare to standard approaches in OMOP CDM analyses.',
                'scientific_rationale' => 'Informative censoring (e.g., treatment switching, loss to follow-up correlated with outcomes) can bias effect estimates. IPCW methods can mitigate this bias but are rarely used in practice due to complexity.',
                'primary_objective' => 'To evaluate the performance of IPCW methods compared to standard Cox regression approaches in the presence of informative censoring.',
                'secondary_objectives' => [
                    'Assess computational feasibility of IPCW in large-scale OMOP analyses',
                    'Compare bias reduction across varying degrees of informative censoring',
                ],
                'study_start_date' => '2025-06-01',
                'study_end_date' => '2026-12-31',
                'target_enrollment_sites' => 3,
                'actual_enrollment_sites' => 3,
                'protocol_version' => '1.0',
                'funding_source' => 'OHDSI Methods Library',
                'tags' => ['methodology', 'censoring', 'survival-analysis', 'IPCW'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Distributed Linear Mixed Models for Multi-Site Effect Estimation',
                'short_title' => 'DistLMM',
                'study_type' => 'characterization',
                'study_design' => 'cohort',
                'status' => 'published',
                'phase' => 'post_study',
                'priority' => 'low',
                'description' => 'A distributed method for obtaining pooled effect estimates using linear mixed models without sharing patient-level data. Applied to COVID-19 hospitalization length of stay across multiple OHDSI sites. Enables privacy-preserving meta-analysis.',
                'scientific_rationale' => 'Traditional meta-analysis uses aggregate summary statistics, losing information about within-study heterogeneity. Distributed LMM approaches can approximate individual-level pooled analysis while maintaining data privacy.',
                'primary_objective' => 'To develop and validate a distributed linear mixed model method for pooled effect estimation across federated OMOP CDM databases.',
                'secondary_objectives' => [
                    'Compare distributed LMM estimates to centralized pooled analysis (gold standard)',
                    'Apply method to COVID-19 hospitalization length of stay analysis',
                    'Release open-source R package for distributed LMM computation',
                ],
                'study_start_date' => '2021-06-01',
                'study_end_date' => '2024-03-31',
                'target_enrollment_sites' => 5,
                'actual_enrollment_sites' => 5,
                'protocol_version' => '2.0',
                'protocol_finalized_at' => '2021-08-01 00:00:00',
                'funding_source' => 'OHDSI Methods Library / NIH NCATS',
                'tags' => ['methodology', 'distributed-analysis', 'mixed-models', 'covid-19', 'privacy-preserving', 'published'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Demonstrating Necessity of Validity Diagnostics: Uveitis Safety Estimation',
                'short_title' => 'Uveitis-Valid',
                'study_type' => 'safety_surveillance',
                'study_design' => 'cohort',
                'status' => 'published',
                'phase' => 'post_study',
                'priority' => 'low',
                'description' => 'A methodological demonstration study showing why empirical validity diagnostics (negative control outcomes, residual bias estimation) are essential for credible causal inference in observational drug safety studies. Uses uveitis as a test case for demonstrating how undiagnosed confounding can produce misleading safety signals.',
                'scientific_rationale' => 'Many published drug safety studies lack empirical evaluation of residual systematic error. This study demonstrates how negative control outcomes can reveal when study designs are unreliable and effect estimates should not be trusted.',
                'primary_objective' => 'To demonstrate the necessity of empirical validity diagnostics for causal inference in pharmacoepidemiologic studies using uveitis as a case study.',
                'secondary_objectives' => [
                    'Show how negative control outcomes identify unreliable analysis designs',
                    'Compare multiple analysis variants on bias and coverage metrics',
                    'Provide a template for diagnostic-first approach to safety studies',
                ],
                'study_start_date' => '2022-01-01',
                'study_end_date' => '2024-06-30',
                'target_enrollment_sites' => 4,
                'actual_enrollment_sites' => 4,
                'protocol_version' => '1.5',
                'protocol_finalized_at' => '2022-03-01 00:00:00',
                'funding_source' => 'OHDSI Methods Library',
                'tags' => ['methodology', 'drug-safety', 'negative-controls', 'validity-diagnostics', 'uveitis', 'published'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            // ── Patient-Level Prediction ────────────────────────────────────

            [
                'title' => 'QRISK Cardiovascular Risk Model Validation Across OHDSI Network',
                'short_title' => 'QRISK-Valid',
                'study_type' => 'patient_level_prediction',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'medium',
                'description' => 'External validation of the QRISK3 cardiovascular risk prediction model across multiple OMOP CDM databases to assess model transportability over time and across healthcare systems. Uses the OHDSI PatientLevelPrediction framework.',
                'scientific_rationale' => 'QRISK was developed on UK primary care data (QResearch). Its performance in non-UK populations and over recent time periods is uncertain. Large-scale validation informs whether recalibration or de novo models are needed.',
                'primary_objective' => 'To externally validate QRISK3 discrimination (AUROC) and calibration across 5+ OMOP CDM databases spanning multiple countries.',
                'secondary_objectives' => [
                    'Assess temporal drift in model performance across 5-year intervals',
                    'Compare QRISK3 performance to a de novo LASSO model trained in OMOP data',
                    'Evaluate fairness metrics across demographic subgroups',
                ],
                'study_start_date' => '2025-08-01',
                'study_end_date' => '2026-08-01',
                'target_enrollment_sites' => 6,
                'actual_enrollment_sites' => 4,
                'protocol_version' => '1.0',
                'tags' => ['cardiovascular', 'risk-prediction', 'QRISK', 'model-validation', 'PLP'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Lung Cancer 3-Year Risk Prediction Model Development',
                'short_title' => 'LungCA-Predict',
                'study_type' => 'patient_level_prediction',
                'study_design' => 'cohort',
                'status' => 'analysis',
                'phase' => 'active',
                'priority' => 'medium',
                'description' => 'Development and external validation of a 3-year lung cancer risk prediction model using routinely collected healthcare data in OMOP CDM format. Evaluates whether EHR-based models can complement or improve upon smoking-history-based screening criteria.',
                'scientific_rationale' => 'Current lung cancer screening relies on age and smoking history (USPSTF criteria). EHR-based risk models using broader clinical data may identify high-risk patients who do not meet traditional screening criteria, including never-smokers and younger patients.',
                'hypothesis' => 'An EHR-based prediction model using OMOP CDM data achieves AUROC > 0.75 for 3-year lung cancer prediction and identifies patients missed by smoking-history-based criteria.',
                'primary_objective' => 'To develop and externally validate a patient-level prediction model for 3-year risk of lung cancer diagnosis using OMOP CDM clinical features.',
                'secondary_objectives' => [
                    'Compare LASSO logistic regression, gradient boosted machines, and deep learning architectures',
                    'Identify key predictive features beyond smoking status',
                    'Assess model performance in never-smoker subpopulation',
                ],
                'study_start_date' => '2025-04-01',
                'study_end_date' => '2026-06-30',
                'target_enrollment_sites' => 5,
                'actual_enrollment_sites' => 5,
                'protocol_version' => '2.0',
                'funding_source' => 'NCI R01 CA-2025-0078',
                'tags' => ['oncology', 'lung-cancer', 'screening', 'prediction', 'PLP', 'machine-learning'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Heart Failure 30-Day Readmission Risk Prediction',
                'short_title' => 'HF-Readmit',
                'study_type' => 'patient_level_prediction',
                'study_design' => 'cohort',
                'status' => 'synthesis',
                'phase' => 'active',
                'priority' => 'high',
                'description' => 'Development of a 30-day hospital readmission prediction model for heart failure patients using OMOP CDM data. Targets clinical deployment as a real-time risk score within EHR systems.',
                'scientific_rationale' => 'Heart failure readmissions are a major quality measure and cost driver. Existing models (LACE, HOSPITAL) have modest discrimination. OMOP-based models can leverage richer longitudinal clinical data and be validated across diverse healthcare systems.',
                'primary_objective' => 'To develop a LASSO logistic regression model predicting 30-day all-cause readmission after heart failure hospitalization with AUROC > 0.70.',
                'secondary_objectives' => [
                    'External validation across 4+ OMOP CDM databases',
                    'Assess net reclassification improvement over LACE score',
                    'Evaluate model fairness across race, sex, and socioeconomic proxy variables',
                ],
                'study_start_date' => '2025-01-15',
                'study_end_date' => '2026-04-30',
                'target_enrollment_sites' => 6,
                'actual_enrollment_sites' => 6,
                'protocol_version' => '3.0',
                'protocol_finalized_at' => '2025-02-15 00:00:00',
                'funding_source' => 'CMS Innovation Center',
                'tags' => ['heart-failure', 'readmission', 'prediction', 'PLP', 'quality-measure'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'RCRI External Validation: Revised Cardiac Risk Index Over Time',
                'short_title' => 'RCRI-Valid',
                'study_type' => 'patient_level_prediction',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'medium',
                'description' => 'External validation of the Revised Cardiac Risk Index (RCRI) model performance over time across OMOP CDM databases. Evaluates whether the classic RCRI surgical risk model maintains discrimination and calibration in contemporary perioperative populations.',
                'scientific_rationale' => 'The RCRI was developed in 1999 and remains widely used for perioperative cardiac risk assessment. However, changes in surgical techniques, patient populations, and cardiac care may have degraded its performance.',
                'primary_objective' => 'To evaluate temporal trends in RCRI discrimination (AUROC) and calibration across 5-year intervals in multiple OMOP databases.',
                'secondary_objectives' => [
                    'Compare RCRI performance in general vs. specialty surgical populations',
                    'Assess whether simple recalibration restores performance in modern cohorts',
                    'Evaluate RCRI performance in the general practice (GP) setting',
                ],
                'study_start_date' => '2025-05-01',
                'study_end_date' => '2026-07-31',
                'target_enrollment_sites' => 5,
                'actual_enrollment_sites' => 4,
                'protocol_version' => '1.0',
                'tags' => ['cardiovascular', 'perioperative', 'risk-prediction', 'RCRI', 'PLP', 'model-validation'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Glaucoma Prescreening Prediction Model Validation',
                'short_title' => 'Glaucoma-PLP',
                'study_type' => 'patient_level_prediction',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'low',
                'description' => 'External validation of a glaucoma screening prediction model across OHDSI network databases. Evaluates whether EHR-derived risk scores can prioritize patients for ophthalmologic screening and reduce undiagnosed glaucoma.',
                'scientific_rationale' => 'Primary open-angle glaucoma is often undiagnosed until significant visual field loss occurs. Risk prediction models using routinely collected clinical data could identify patients who would benefit most from screening.',
                'primary_objective' => 'To externally validate a glaucoma risk prediction model across multiple OMOP CDM databases.',
                'secondary_objectives' => [
                    'Assess model discrimination and calibration by database and population type',
                    'Compare model performance in primary care vs. specialist settings',
                ],
                'study_start_date' => '2025-07-01',
                'study_end_date' => '2026-07-01',
                'target_enrollment_sites' => 4,
                'actual_enrollment_sites' => 2,
                'protocol_version' => '1.0',
                'tags' => ['ophthalmology', 'glaucoma', 'screening', 'prediction', 'PLP'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Methotrexate Outcome Prediction in Rheumatic Disease',
                'short_title' => 'MTX-Predict',
                'study_type' => 'patient_level_prediction',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'medium',
                'description' => 'Prediction of treatment response and adverse outcomes related to methotrexate treatment in patients with rheumatoid arthritis and other rheumatic diseases. Develops models to identify patients likely to respond to or experience toxicity from methotrexate.',
                'scientific_rationale' => 'Methotrexate is first-line DMARD therapy for RA but ~40% of patients fail to achieve adequate response. Early prediction of non-response could accelerate treatment optimization.',
                'primary_objective' => 'To develop prediction models for 6-month treatment response and hepatotoxicity risk following methotrexate initiation in RA patients.',
                'secondary_objectives' => [
                    'Identify key predictive features for MTX response and toxicity',
                    'Validate models across databases with different RA phenotype definitions',
                    'Assess model utility for clinical decision-making via decision curve analysis',
                ],
                'study_start_date' => '2025-03-01',
                'study_end_date' => '2026-06-30',
                'target_enrollment_sites' => 5,
                'actual_enrollment_sites' => 3,
                'protocol_version' => '1.0',
                'tags' => ['rheumatology', 'methotrexate', 'prediction', 'PLP', 'treatment-response'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'NLP-Enhanced Prediction of Major Depression to Bipolar Conversion',
                'short_title' => 'NLP-Psych',
                'study_type' => 'patient_level_prediction',
                'study_design' => 'cohort',
                'status' => 'protocol_development',
                'phase' => 'pre_study',
                'priority' => 'medium',
                'description' => 'A prediction study comparing models with and without NLP-derived features for predicting conversion from major depressive disorder (MDD) to bipolar disorder. Evaluates whether unstructured clinical notes in OMOP CDM add predictive value beyond structured data.',
                'scientific_rationale' => 'Bipolar disorder is frequently misdiagnosed as MDD, with average delays of 6-10 years. NLP extraction of symptom descriptions, clinician impressions, and behavioral observations from notes may capture diagnostic signals absent from structured codes.',
                'primary_objective' => 'To compare the discriminative performance (AUROC) of MDD-to-bipolar conversion prediction models with and without NLP-derived features.',
                'secondary_objectives' => [
                    'Identify key NLP-derived features that improve prediction',
                    'Evaluate feasibility of NLP feature extraction across different OMOP note_nlp implementations',
                    'Assess model generalizability across databases with varying NLP capabilities',
                ],
                'target_enrollment_sites' => 3,
                'actual_enrollment_sites' => 0,
                'protocol_version' => '0.5',
                'tags' => ['psychiatry', 'NLP', 'bipolar', 'depression', 'prediction', 'PLP'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Total Knee Replacement Patient Outcome Prediction',
                'short_title' => 'TKR-Predict',
                'study_type' => 'patient_level_prediction',
                'study_design' => 'cohort',
                'status' => 'published',
                'phase' => 'post_study',
                'priority' => 'low',
                'description' => 'Development of simple, interpretable prediction models for outcomes following total knee replacement (TKR) surgery. Models target 90-day readmission, venous thromboembolism, and prosthetic joint infection using pre-operative OMOP CDM features.',
                'scientific_rationale' => 'Total knee replacement is one of the most common elective surgeries. Pre-operative risk stratification can inform patient counseling, surgical timing, and post-operative monitoring intensity.',
                'primary_objective' => 'To develop and validate prediction models for adverse outcomes within 90 days of total knee replacement.',
                'secondary_objectives' => [
                    'Compare LASSO logistic regression vs. gradient boosted machines',
                    'Identify modifiable risk factors for targeted pre-operative optimization',
                ],
                'study_start_date' => '2022-01-01',
                'study_end_date' => '2024-12-31',
                'target_enrollment_sites' => 4,
                'actual_enrollment_sites' => 4,
                'protocol_version' => '2.0',
                'protocol_finalized_at' => '2022-03-01 00:00:00',
                'funding_source' => 'OHDSI PLP Workgroup',
                'tags' => ['orthopedics', 'TKR', 'prediction', 'PLP', 'published'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Pandemic Prediction: COVID-19 Model Validation Across Time and Databases',
                'short_title' => 'Pandemic-Valid',
                'study_type' => 'patient_level_prediction',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'medium',
                'description' => 'A longitudinal validation study assessing the temporal stability of COVID-19 prediction models developed during the pandemic. Evaluates model performance drift across pandemic waves, variant emergence, vaccination rollout, and treatment advances.',
                'scientific_rationale' => 'Prediction models developed during a rapidly evolving pandemic may degrade as the epidemiologic landscape changes. Understanding temporal model performance informs deployment strategies and recalibration needs.',
                'primary_objective' => 'To assess temporal stability of COVID-19 hospitalization and mortality prediction models across pandemic phases.',
                'secondary_objectives' => [
                    'Identify predictors whose associations with outcomes changed over time',
                    'Evaluate simple recalibration strategies for maintaining model performance',
                    'Inform best practices for prediction model deployment during future pandemics',
                ],
                'study_start_date' => '2025-01-01',
                'study_end_date' => '2026-06-30',
                'target_enrollment_sites' => 8,
                'actual_enrollment_sites' => 6,
                'protocol_version' => '2.0',
                'funding_source' => 'OHDSI PLP Workgroup / DARWIN EU',
                'tags' => ['covid-19', 'prediction', 'temporal-validation', 'PLP', 'pandemic-preparedness'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            // ── Clinical Characterization ───────────────────────────────────

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
                'primary_objective' => 'To characterize the demographic and clinical features of patients with incident breast cancer diagnosis across participating sites.',
                'secondary_objectives' => [
                    'Describe first-line treatment patterns by cancer stage',
                    'Identify comorbidity burden and its association with treatment selection',
                    'Characterize healthcare utilization in the 12 months following diagnosis',
                ],
                'tags' => ['oncology', 'breast-cancer', 'characterization'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'OMOPCAN: Characterizing Cancer Across the OHDSI Network',
                'short_title' => 'OMOPCAN',
                'study_type' => 'characterization',
                'study_design' => 'cross_sectional',
                'status' => 'protocol_development',
                'phase' => 'pre_study',
                'priority' => 'high',
                'description' => 'A comprehensive network study to characterize cancer populations across the OHDSI network. Standardizes cancer phenotype definitions in OMOP CDM and generates baseline incidence, prevalence, treatment pattern, and survival characterizations across multiple tumor types and databases.',
                'scientific_rationale' => 'Cancer data representation in OMOP CDM is evolving. A systematic characterization across multiple databases establishes the current state of cancer data quality and completeness, enabling the design of rigorous observational oncology studies.',
                'primary_objective' => 'To characterize the incidence, demographics, treatment patterns, and survival of 10 common cancer types across OHDSI network databases.',
                'secondary_objectives' => [
                    'Evaluate completeness of cancer staging data across databases',
                    'Develop and validate standardized OMOP cancer phenotype definitions',
                    'Identify data quality gaps relevant to cancer outcomes research',
                ],
                'target_enrollment_sites' => 15,
                'actual_enrollment_sites' => 3,
                'protocol_version' => '0.5',
                'funding_source' => 'OHDSI Oncology Workgroup',
                'tags' => ['oncology', 'cancer', 'characterization', 'data-quality', 'phenotyping', 'OMOPCAN'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Diabetic Retinopathy Screening: Guideline-Driven Evidence (GDE 2025)',
                'short_title' => 'GDE-DRS',
                'study_type' => 'characterization',
                'study_design' => 'cross_sectional',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'medium',
                'description' => 'Part of the 2025 OHDSI Guideline-Driven Evidence initiative. Characterizes adherence to diabetic retinopathy screening guidelines across OHDSI network databases, identifying patient and healthcare system factors associated with screening gaps.',
                'scientific_rationale' => 'Clinical practice guidelines recommend annual dilated eye exams for diabetic patients, but real-world adherence varies widely. Understanding screening gaps can inform targeted interventions.',
                'primary_objective' => 'To characterize the rate of guideline-concordant diabetic retinopathy screening among patients with diabetes across OHDSI network databases.',
                'secondary_objectives' => [
                    'Identify demographic and clinical predictors of screening non-adherence',
                    'Characterize time from diabetes diagnosis to first eye exam',
                    'Compare screening rates across healthcare system types',
                ],
                'study_start_date' => '2025-02-01',
                'study_end_date' => '2026-02-01',
                'target_enrollment_sites' => 10,
                'actual_enrollment_sites' => 7,
                'protocol_version' => '1.0',
                'funding_source' => 'OHDSI Phenotype Phebruary 2025',
                'tags' => ['diabetes', 'ophthalmology', 'screening', 'guideline-driven-evidence', 'GDE-2025'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'STEMI Characterization and Incidence Across Real-World Datasets',
                'short_title' => 'PhenoPheb-STEMI',
                'study_type' => 'characterization',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'medium',
                'description' => 'A Phenotype Phebruary study characterizing ST-elevation myocardial infarction (STEMI) patients across OHDSI databases. Evaluates STEMI phenotype definitions, estimates incidence rates, and describes treatment patterns including door-to-balloon time proxies.',
                'scientific_rationale' => 'Accurate STEMI phenotyping in claims and EHR data is essential for cardiovascular outcomes research. This study benchmarks STEMI phenotype definitions and characterizes the STEMI population across diverse data sources.',
                'primary_objective' => 'To estimate STEMI incidence rates and characterize baseline demographics, comorbidities, and treatment patterns across OHDSI network databases.',
                'secondary_objectives' => [
                    'Validate STEMI phenotype definitions using positive/negative predictive values',
                    'Describe percutaneous coronary intervention (PCI) rates and timing',
                    'Characterize 30-day and 1-year mortality following STEMI',
                ],
                'study_start_date' => '2025-02-01',
                'study_end_date' => '2026-05-31',
                'target_enrollment_sites' => 8,
                'actual_enrollment_sites' => 5,
                'protocol_version' => '1.0',
                'funding_source' => 'OHDSI Phenotype Phebruary 2025',
                'tags' => ['cardiovascular', 'STEMI', 'phenotyping', 'incidence', 'PhenoPheb'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Phenotyping Parkinson\'s Disease Across OMOP Databases',
                'short_title' => 'PD-Phenotype',
                'study_type' => 'characterization',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'medium',
                'description' => 'A network study developing and validating OMOP CDM phenotype definitions for Parkinson\'s disease, characterizing the PD population across databases including demographics, motor and non-motor symptoms, medication use, and healthcare utilization.',
                'scientific_rationale' => 'Parkinson\'s disease phenotyping in observational data is challenging due to diagnostic uncertainty, long prodromal periods, and overlap with other movement disorders. Standardized OMOP phenotypes are needed for reliable PD outcomes research.',
                'primary_objective' => 'To develop and validate OMOP CDM phenotype definitions for Parkinson\'s disease across multiple databases.',
                'secondary_objectives' => [
                    'Characterize PD treatment initiation patterns (levodopa, dopamine agonists, MAO-B inhibitors)',
                    'Describe the prevalence of PD-associated comorbidities (dementia, depression, falls)',
                    'Estimate PD incidence rates stratified by age and sex',
                ],
                'study_start_date' => '2025-06-01',
                'study_end_date' => '2026-12-31',
                'target_enrollment_sites' => 6,
                'actual_enrollment_sites' => 3,
                'protocol_version' => '1.0',
                'tags' => ['neurology', 'parkinsons', 'phenotyping', 'characterization'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'COVID-19 Hospitalization Clinical Characterization',
                'short_title' => 'COVID-Hosp-Char',
                'study_type' => 'characterization',
                'study_design' => 'cohort',
                'status' => 'published',
                'phase' => 'post_study',
                'priority' => 'low',
                'description' => 'A comprehensive clinical characterization of hospitalized COVID-19 patients across OHDSI network databases. Describes demographics, comorbidity burden, laboratory findings, treatment patterns, and in-hospital outcomes including ICU admission and mortality.',
                'scientific_rationale' => 'Early pandemic characterization across diverse healthcare systems was essential for understanding the clinical spectrum of COVID-19 and identifying risk factors for severe disease.',
                'primary_objective' => 'To characterize the demographics, comorbidities, treatments, and outcomes of hospitalized COVID-19 patients across OHDSI network databases.',
                'secondary_objectives' => [
                    'Compare patient characteristics across geographic regions',
                    'Identify comorbidity patterns associated with ICU admission and mortality',
                    'Describe treatment pattern evolution over time',
                ],
                'study_start_date' => '2020-04-01',
                'study_end_date' => '2022-12-31',
                'target_enrollment_sites' => 20,
                'actual_enrollment_sites' => 18,
                'protocol_version' => '4.0',
                'protocol_finalized_at' => '2020-04-15 00:00:00',
                'funding_source' => 'OHDSI COVID-19 Response',
                'tags' => ['covid-19', 'characterization', 'hospitalization', 'pandemic-response', 'published'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Taxis: Knowledge Graph Learning Through Concept Co-occurrence',
                'short_title' => 'Taxis-KG',
                'study_type' => 'characterization',
                'study_design' => 'cross_sectional',
                'status' => 'protocol_development',
                'phase' => 'pre_study',
                'priority' => 'low',
                'description' => 'An exploratory study building knowledge graphs from concept co-occurrence patterns in OMOP CDM databases. Applies graph learning methods to discover latent clinical relationships, disease subtypes, and treatment-outcome associations from routine healthcare data.',
                'scientific_rationale' => 'OMOP CDM databases contain rich co-occurrence patterns among diagnoses, procedures, medications, and lab results. Graph-based learning can uncover clinically meaningful relationships not apparent from traditional epidemiologic analyses.',
                'primary_objective' => 'To develop and evaluate knowledge graph representations derived from concept co-occurrence in OMOP CDM databases.',
                'secondary_objectives' => [
                    'Identify novel disease-disease and drug-disease associations',
                    'Compare knowledge graph structures across databases',
                    'Evaluate utility of learned embeddings for downstream prediction tasks',
                ],
                'target_enrollment_sites' => 3,
                'actual_enrollment_sites' => 1,
                'protocol_version' => '0.3',
                'tags' => ['methodology', 'knowledge-graph', 'machine-learning', 'concept-co-occurrence'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            // ── COVID-19 Studies ────────────────────────────────────────────

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

            [
                'title' => 'COVID-19 Prediction Studies: Hospitalization, ICU, Mortality',
                'short_title' => 'COVID-PLP',
                'study_type' => 'patient_level_prediction',
                'study_design' => 'cohort',
                'status' => 'published',
                'phase' => 'post_study',
                'priority' => 'low',
                'description' => 'Multiple patient-level prediction models for COVID-19 outcomes including hospitalization risk from outpatient settings, ICU admission risk from hospital admission, and in-hospital mortality. Models developed and validated across 10+ OHDSI network databases during the pandemic.',
                'scientific_rationale' => 'Early identification of COVID-19 patients at risk for severe outcomes enables targeted treatment and resource allocation. Models built on OMOP CDM data can be rapidly deployed across the OHDSI network for real-time risk stratification.',
                'primary_objective' => 'To develop and externally validate patient-level prediction models for COVID-19 hospitalization, ICU admission, and mortality.',
                'secondary_objectives' => [
                    'Assess temporal model performance as pandemic waves and variants evolved',
                    'Evaluate impact of vaccination status on model calibration',
                    'Generate freely available R packages for local deployment',
                ],
                'study_start_date' => '2020-03-15',
                'study_end_date' => '2023-12-31',
                'target_enrollment_sites' => 15,
                'actual_enrollment_sites' => 14,
                'protocol_version' => '5.0',
                'protocol_finalized_at' => '2020-04-01 00:00:00',
                'funding_source' => 'OHDSI COVID-19 Response / EHDEN / DARWIN EU',
                'tags' => ['covid-19', 'prediction', 'PLP', 'published', 'pandemic-response'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'COVID-19 Vaccine Adverse Events of Special Interest Diagnostics',
                'short_title' => 'CoVax-AESI',
                'study_type' => 'safety_surveillance',
                'study_design' => 'cohort',
                'status' => 'published',
                'phase' => 'post_study',
                'priority' => 'low',
                'description' => 'A multi-database study evaluating adverse events of special interest (AESIs) following COVID-19 vaccination using OHDSI network databases. Assessed background incidence rates and excess risk for conditions including thrombosis with thrombocytopenia, Guillain-Barré syndrome, Bell\'s palsy, and anaphylaxis.',
                'scientific_rationale' => 'Regulatory agencies required systematic evaluation of pre-specified AESIs for COVID-19 vaccines. Establishing background incidence rates and comparative risk estimates across large, diverse populations provides the evidence base for risk-benefit assessment.',
                'primary_objective' => 'To estimate background incidence rates and excess risk of pre-specified AESIs following COVID-19 vaccination across OHDSI network databases.',
                'secondary_objectives' => [
                    'Compare AESI rates across vaccine products (mRNA, viral vector, protein subunit)',
                    'Assess AESI risk by age, sex, and pre-existing conditions',
                    'Provide regulatory-grade evidence for vaccine safety communication',
                ],
                'study_start_date' => '2021-02-01',
                'study_end_date' => '2023-06-30',
                'target_enrollment_sites' => 15,
                'actual_enrollment_sites' => 13,
                'protocol_version' => '3.0',
                'protocol_finalized_at' => '2021-03-01 00:00:00',
                'funding_source' => 'OHDSI COVID-19 Response / EHDEN / FDA BEST',
                'tags' => ['covid-19', 'vaccine-safety', 'AESI', 'published', 'regulatory'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            // ── Methodological Research ─────────────────────────────────────

            [
                'title' => 'Evidence Synthesis with Negative Controls: Bayesian Meta-Analysis Calibration',
                'short_title' => 'NegCtrl-Meta',
                'study_type' => 'characterization',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'high',
                'description' => 'A methodological study extending the OHDSI empirical calibration framework to multi-database Bayesian meta-analysis. Evaluates whether negative control outcomes can improve evidence synthesis by quantifying and adjusting for residual systematic error across databases.',
                'scientific_rationale' => 'Combining estimates across databases amplifies statistical power but can also compound systematic errors. Negative control outcomes provide an empirical estimate of residual bias that can be incorporated into Bayesian meta-analytic priors.',
                'primary_objective' => 'To develop and evaluate a Bayesian meta-analysis framework that incorporates negative control outcome calibration for multi-database evidence synthesis.',
                'secondary_objectives' => [
                    'Compare calibrated vs. uncalibrated meta-analytic estimates on a benchmark of known drug-outcome pairs',
                    'Assess the impact of database-specific calibration vs. pooled calibration',
                    'Release an R package for calibrated evidence synthesis',
                ],
                'study_start_date' => '2025-03-01',
                'study_end_date' => '2026-12-31',
                'target_enrollment_sites' => 4,
                'actual_enrollment_sites' => 4,
                'protocol_version' => '1.0',
                'funding_source' => 'OHDSI Methods Library',
                'tags' => ['methodology', 'meta-analysis', 'negative-controls', 'empirical-calibration', 'evidence-synthesis'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'Minds Meet Machines: Concept Set Development Challenge',
                'short_title' => 'MindsMachines',
                'study_type' => 'characterization',
                'study_design' => 'cross_sectional',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'medium',
                'description' => 'A Phenotype Development and Evaluation workgroup study comparing human expert vs. algorithmic approaches to concept set construction. Evaluates whether NLP-assisted and rule-based methods can match or exceed expert-curated concept sets for key clinical phenotypes.',
                'scientific_rationale' => 'Concept set development is a bottleneck for OMOP-based observational studies. Automated approaches could accelerate study setup, reduce inter-rater variability, and democratize phenotype development beyond vocabulary experts.',
                'primary_objective' => 'To compare the completeness and specificity of concept sets developed by human experts vs. algorithmic methods across 20 clinical conditions.',
                'secondary_objectives' => [
                    'Measure inter-rater agreement among human concept set developers',
                    'Evaluate concept set quality using cohort-level agreement metrics',
                    'Identify clinical domains where algorithmic methods excel or fail',
                ],
                'study_start_date' => '2025-06-01',
                'study_end_date' => '2026-06-30',
                'target_enrollment_sites' => 3,
                'actual_enrollment_sites' => 3,
                'protocol_version' => '1.0',
                'funding_source' => 'OHDSI PDE Workgroup',
                'tags' => ['methodology', 'phenotyping', 'concept-sets', 'NLP', 'PDE-workgroup'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            // ── EHDEN Studies ───────────────────────────────────────────────

            [
                'title' => 'EHDEN Rheumatoid Arthritis Drug Utilization Study',
                'short_title' => 'EHDEN-RA-DU',
                'study_type' => 'drug_utilization',
                'study_design' => 'cohort',
                'status' => 'published',
                'phase' => 'post_study',
                'priority' => 'low',
                'description' => 'A European EHDEN network study characterizing rheumatoid arthritis treatment pathways across European OMOP CDM databases. Originated from the Barcelona Study-a-thon 2020. Describes first-line and subsequent DMARD treatment patterns, time to treatment escalation, and regional variation.',
                'scientific_rationale' => 'Treatment pathways for RA vary across European countries due to differences in guidelines, reimbursement, and clinical practice. Understanding real-world treatment patterns informs clinical guideline harmonization.',
                'primary_objective' => 'To characterize treatment pathways for rheumatoid arthritis across European OMOP CDM databases, including DMARD initiation, escalation, and switching patterns.',
                'secondary_objectives' => [
                    'Compare treatment patterns across Northern vs. Southern European countries',
                    'Assess the uptake of biologic DMARDs as first-line therapy over time',
                    'Describe methotrexate dose escalation patterns',
                ],
                'study_start_date' => '2020-10-01',
                'study_end_date' => '2022-06-30',
                'target_enrollment_sites' => 8,
                'actual_enrollment_sites' => 8,
                'protocol_version' => '2.0',
                'protocol_finalized_at' => '2020-11-15 00:00:00',
                'funding_source' => 'EHDEN / IMI2',
                'tags' => ['rheumatology', 'RA', 'drug-utilization', 'EHDEN', 'treatment-pathways', 'published'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'EHDEN RA Clinical Outcome Prediction After Methotrexate Initiation',
                'short_title' => 'EHDEN-RA-Pred',
                'study_type' => 'patient_level_prediction',
                'study_design' => 'cohort',
                'status' => 'published',
                'phase' => 'post_study',
                'priority' => 'low',
                'description' => 'A European EHDEN network study developing prediction models for clinical outcomes after methotrexate initiation in rheumatoid arthritis. Originated from the Barcelona Study-a-thon 2020. Predicts treatment persistence, DAS28 remission, and adverse events.',
                'scientific_rationale' => 'Methotrexate is first-line therapy for RA, but response is variable. Early prediction of outcomes can guide treatment decisions and enable personalized medicine approaches in rheumatology.',
                'primary_objective' => 'To develop and validate prediction models for 12-month treatment persistence and remission following methotrexate initiation in RA.',
                'secondary_objectives' => [
                    'Identify pre-treatment predictors of methotrexate response',
                    'Compare model performance across European databases',
                    'Assess whether models generalize from specialist to primary care settings',
                ],
                'study_start_date' => '2020-10-01',
                'study_end_date' => '2022-12-31',
                'target_enrollment_sites' => 6,
                'actual_enrollment_sites' => 6,
                'protocol_version' => '2.0',
                'protocol_finalized_at' => '2020-11-15 00:00:00',
                'funding_source' => 'EHDEN / IMI2',
                'tags' => ['rheumatology', 'RA', 'methotrexate', 'prediction', 'EHDEN', 'published'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            [
                'title' => 'EHDEN Population-Level Effects of csDMARDs in Rheumatoid Arthritis',
                'short_title' => 'EHDEN-RA-DMARDs',
                'study_type' => 'comparative_effectiveness',
                'study_design' => 'cohort',
                'status' => 'published',
                'phase' => 'post_study',
                'priority' => 'low',
                'description' => 'A European EHDEN network study evaluating the population-level comparative effects of conventional synthetic DMARDs (csDMARDs) in rheumatoid arthritis. Compares methotrexate, sulfasalazine, leflunomide, and hydroxychloroquine on disease progression and safety outcomes.',
                'scientific_rationale' => 'While methotrexate is the anchor csDMARD for RA, comparative effectiveness data between csDMARDs is limited beyond clinical trials. Real-world evidence from European populations can inform treatment sequencing decisions.',
                'primary_objective' => 'To estimate the comparative effectiveness of csDMARDs on disease progression and key safety outcomes in RA.',
                'secondary_objectives' => [
                    'Compare treatment persistence across csDMARDs',
                    'Evaluate hepatotoxicity and hematologic adverse event rates',
                    'Assess interaction between csDMARD choice and concomitant glucocorticoid use',
                ],
                'study_start_date' => '2020-10-01',
                'study_end_date' => '2023-03-31',
                'target_enrollment_sites' => 7,
                'actual_enrollment_sites' => 7,
                'protocol_version' => '2.0',
                'protocol_finalized_at' => '2020-12-01 00:00:00',
                'funding_source' => 'EHDEN / IMI2',
                'tags' => ['rheumatology', 'RA', 'DMARDs', 'comparative-effectiveness', 'EHDEN', 'published'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            // ── PIONEER Studies ─────────────────────────────────────────────

            [
                'title' => 'PIONEER Watchful Waiting in Prostate Cancer: Outcomes and Predictors',
                'short_title' => 'PIONEER-WW',
                'study_type' => 'characterization',
                'study_design' => 'cohort',
                'status' => 'published',
                'phase' => 'post_study',
                'priority' => 'low',
                'description' => 'A PIONEER-EHDEN-OHDSI study-a-thon study from 2021 characterizing the clinical management and outcomes of watchful waiting vs. active surveillance in prostate cancer. Examines patient characteristics, conversion to active treatment, and oncologic outcomes.',
                'scientific_rationale' => 'Watchful waiting and active surveillance are recommended for low-risk prostate cancer, but real-world adoption and outcomes data across diverse healthcare systems are limited.',
                'primary_objective' => 'To characterize the demographics, treatment trajectories, and oncologic outcomes of prostate cancer patients managed with watchful waiting vs. active surveillance across OHDSI network databases.',
                'secondary_objectives' => [
                    'Estimate the proportion converting to active treatment within 5 years',
                    'Identify clinical and demographic predictors of conversion',
                    'Compare all-cause mortality between management strategies',
                ],
                'study_start_date' => '2021-03-01',
                'study_end_date' => '2023-09-30',
                'target_enrollment_sites' => 6,
                'actual_enrollment_sites' => 6,
                'protocol_version' => '2.0',
                'protocol_finalized_at' => '2021-04-15 00:00:00',
                'funding_source' => 'PIONEER Big Data / IMI2',
                'tags' => ['oncology', 'prostate-cancer', 'watchful-waiting', 'PIONEER', 'EHDEN', 'published'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            // ── APAC Regional ───────────────────────────────────────────────

            [
                'title' => '2025 APAC Collaborative Study: Multi-Center Characterization',
                'short_title' => 'APAC-2025',
                'study_type' => 'characterization',
                'study_design' => 'cross_sectional',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'medium',
                'description' => 'A collaborative OHDSI Asia-Pacific regional study involving Fudan University, Peking University, and USTC. Characterizes healthcare utilization patterns and disease burden across multiple Chinese OMOP CDM databases as part of OHDSI\'s expanding Asia-Pacific network.',
                'scientific_rationale' => 'The OHDSI network\'s expansion into the Asia-Pacific region requires baseline characterization of participating databases to understand data completeness, coding practices, and population demographics compared to North American and European sites.',
                'primary_objective' => 'To characterize disease prevalence, healthcare utilization, and data quality across Chinese OMOP CDM databases participating in the OHDSI network.',
                'secondary_objectives' => [
                    'Compare ICD-10 coding patterns between Chinese and Western databases',
                    'Assess medication utilization patterns for chronic diseases',
                    'Evaluate feasibility of running OHDSI standardized analytics packages on APAC data',
                ],
                'study_start_date' => '2025-01-15',
                'study_end_date' => '2026-01-15',
                'target_enrollment_sites' => 5,
                'actual_enrollment_sites' => 3,
                'protocol_version' => '1.0',
                'funding_source' => 'OHDSI APAC Chapter',
                'tags' => ['APAC', 'China', 'characterization', 'data-quality', 'regional'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            // ── Drug Utilization ────────────────────────────────────────────

            [
                'title' => 'Community-Acquired Pneumonia Treatment Pathway Analysis',
                'short_title' => 'CAP-Pathways',
                'study_type' => 'drug_utilization',
                'study_design' => 'cohort',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'medium',
                'description' => 'A treatment pathway analysis study characterizing antibiotic prescribing patterns for community-acquired pneumonia (CAP) across OHDSI network databases. Uses the OHDSI Treatment Pathways tool to visualize first-line therapy selection, treatment duration, and switching patterns.',
                'scientific_rationale' => 'Antibiotic stewardship for CAP is a global priority. Understanding real-world prescribing patterns across healthcare systems can identify guideline-discordant prescribing and antibiotic stewardship opportunities.',
                'primary_objective' => 'To characterize first-line antibiotic treatment pathways for community-acquired pneumonia across OHDSI network databases.',
                'secondary_objectives' => [
                    'Compare guideline concordance across countries and healthcare system types',
                    'Identify factors associated with broad-spectrum vs. narrow-spectrum first-line therapy',
                    'Characterize treatment duration and switching patterns',
                ],
                'study_start_date' => '2025-05-01',
                'study_end_date' => '2026-05-01',
                'target_enrollment_sites' => 8,
                'actual_enrollment_sites' => 5,
                'protocol_version' => '1.0',
                'tags' => ['infectious-disease', 'pneumonia', 'antibiotics', 'treatment-pathways', 'stewardship'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],

            // ── Quality Improvement ────────────────────────────────────────

            [
                'title' => 'OHDSI Evidence Network: Data Partner Registry and Quality Dashboard',
                'short_title' => 'OHDSI-EvNet',
                'study_type' => 'quality_improvement',
                'study_design' => 'cross_sectional',
                'status' => 'execution',
                'phase' => 'active',
                'priority' => 'high',
                'description' => 'The OHDSI Evidence Network registry characterizes data sources across the global OHDSI network. Connects researchers with data partners by providing standardized metadata including patient counts, data provenance, CDM version, vocabulary version, and data quality metrics.',
                'scientific_rationale' => 'Efficient study network assembly requires a searchable registry of data partners with standardized metadata. This infrastructure study maintains the network-wide data characterization that enables federated research.',
                'primary_objective' => 'To maintain a comprehensive, up-to-date registry of OHDSI network data partners with standardized data source characterization metrics.',
                'secondary_objectives' => [
                    'Generate Achilles-based data quality reports for all participating sites',
                    'Enable matchmaking between study protocols and suitable data partners',
                    'Track temporal trends in network growth and data freshness',
                ],
                'study_start_date' => '2024-01-01',
                'study_end_date' => null,
                'target_enrollment_sites' => 200,
                'actual_enrollment_sites' => 85,
                'protocol_version' => '4.0',
                'funding_source' => 'OHDSI Foundation',
                'tags' => ['infrastructure', 'data-quality', 'network-registry', 'Achilles', 'OHDSI'],
                'principal_investigator_id' => $adminId,
                'created_by' => $adminId,
            ],
        ];

        $seeded = 0;
        foreach ($studies as $studyData) {
            Study::firstOrCreate(
                ['title' => $studyData['title']],
                $studyData,
            );
            $seeded++;
        }

        $this->command->info("StudySeeder: {$seeded} OHDSI network studies seeded.");

        // ── Sub-resources: team, sites, cohorts, milestones, artifacts, activity ──
        $this->seedSubResources($adminId);
    }

    /**
     * Seed team members, sites, cohorts, milestones, artifacts, and activity logs
     * for a representative subset of studies.
     */
    private function seedSubResources(int $adminId): void
    {
        // Lookup sources by key (may not exist in all environments)
        $sources = Source::pluck('id', 'source_key')->toArray();
        $cohorts = CohortDefinition::pluck('id', 'name')->toArray();

        // Select 6 representative studies for sub-resource population
        $studyMap = [];
        $slugs = [
            'legend-t2dm' => 'LEGEND-T2DM: Large-scale Evidence Generation for Diabetes Management',
            'legend-htn' => 'LEGEND-HTN Step Care: Hypertension Treatment Pathway Effectiveness',
            'covax-myocarditis' => 'COVID-19 Vaccine Safety Surveillance: mRNA Boosters and Myocarditis',
            'hf-readmit' => 'Heart Failure 30-Day Readmission Risk Prediction',
            'gde-drs' => 'Diabetic Retinopathy Screening: Guideline-Driven Evidence (GDE 2025)',
            'cap-pathways' => 'Community-Acquired Pneumonia Treatment Pathway Analysis',
        ];

        foreach ($slugs as $key => $title) {
            $study = Study::where('title', $title)->first();
            if ($study) {
                $studyMap[$key] = $study;
            }
        }

        if (empty($studyMap)) {
            $this->command->warn('No studies found for sub-resource seeding — skipping.');

            return;
        }

        $this->seedTeamMembers($studyMap, $adminId);
        $this->seedSites($studyMap, $adminId, $sources);
        $this->seedCohorts($studyMap, $cohorts);
        $this->seedMilestones($studyMap, $adminId);
        $this->seedArtifacts($studyMap, $adminId);
        $this->seedActivityLogs($studyMap, $adminId);

        $this->command->info('StudySeeder: sub-resources seeded for '.count($studyMap).' studies.');
    }

    private function seedTeamMembers(array $studyMap, int $adminId): void
    {
        $teamDefs = [
            'legend-t2dm' => [
                ['role' => 'principal_investigator', 'joined_at' => '2025-05-15'],
                ['role' => 'data_scientist', 'joined_at' => '2025-06-01'],
                ['role' => 'statistician', 'joined_at' => '2025-06-01'],
                ['role' => 'research_coordinator', 'joined_at' => '2025-06-10'],
                ['role' => 'project_manager', 'joined_at' => '2025-05-20'],
            ],
            'legend-htn' => [
                ['role' => 'principal_investigator', 'joined_at' => '2025-01-15'],
                ['role' => 'co_investigator', 'joined_at' => '2025-02-01'],
                ['role' => 'data_scientist', 'joined_at' => '2025-02-15'],
            ],
            'covax-myocarditis' => [
                ['role' => 'principal_investigator', 'joined_at' => '2023-12-01'],
                ['role' => 'data_scientist', 'joined_at' => '2024-01-10'],
                ['role' => 'statistician', 'joined_at' => '2024-01-10'],
                ['role' => 'irb_liaison', 'joined_at' => '2024-01-15'],
                ['role' => 'project_manager', 'joined_at' => '2023-12-15'],
            ],
            'hf-readmit' => [
                ['role' => 'principal_investigator', 'joined_at' => '2024-12-01'],
                ['role' => 'data_scientist', 'joined_at' => '2025-01-01'],
                ['role' => 'co_investigator', 'joined_at' => '2025-01-05'],
            ],
            'gde-drs' => [
                ['role' => 'principal_investigator', 'joined_at' => '2025-01-15'],
                ['role' => 'data_analyst', 'joined_at' => '2025-02-01'],
            ],
            'cap-pathways' => [
                ['role' => 'principal_investigator', 'joined_at' => '2025-04-15'],
                ['role' => 'data_scientist', 'joined_at' => '2025-05-01'],
                ['role' => 'research_coordinator', 'joined_at' => '2025-05-01'],
            ],
        ];

        $count = 0;
        foreach ($teamDefs as $key => $members) {
            if (! isset($studyMap[$key])) {
                continue;
            }
            $study = $studyMap[$key];

            foreach ($members as $member) {
                StudyTeamMember::firstOrCreate(
                    ['study_id' => $study->id, 'user_id' => $adminId, 'role' => $member['role']],
                    [
                        'permissions' => ['view' => true, 'edit' => true, 'execute' => true],
                        'joined_at' => $member['joined_at'],
                        'is_active' => true,
                    ],
                );
                $count++;
            }
        }

        $this->command->info("  Team members: {$count}");
    }

    private function seedSites(array $studyMap, int $adminId, array $sources): void
    {
        if (empty($sources)) {
            $this->command->warn('  No sources found — skipping site seeding.');

            return;
        }

        // Use whatever sources are available
        $sourceIds = array_values($sources);

        $siteDefs = [
            'legend-t2dm' => [
                ['site_role' => 'coordinating_center', 'status' => 'executing', 'irb_type' => 'expedited', 'irb_approval_date' => '2025-05-28', 'cdm_version' => '5.4', 'patient_count_estimate' => 1200000],
                ['site_role' => 'data_partner', 'status' => 'executing', 'irb_type' => 'exempt', 'irb_approval_date' => '2025-06-15', 'cdm_version' => '5.4', 'patient_count_estimate' => 850000],
            ],
            'legend-htn' => [
                ['site_role' => 'coordinating_center', 'status' => 'results_submitted', 'irb_type' => 'expedited', 'irb_approval_date' => '2025-01-30', 'cdm_version' => '5.4', 'patient_count_estimate' => 2100000],
            ],
            'covax-myocarditis' => [
                ['site_role' => 'coordinating_center', 'status' => 'completed', 'irb_type' => 'full_board', 'irb_approval_date' => '2024-01-20', 'cdm_version' => '5.4', 'patient_count_estimate' => 3500000],
                ['site_role' => 'data_partner', 'status' => 'completed', 'irb_type' => 'expedited', 'irb_approval_date' => '2024-02-10', 'cdm_version' => '5.3', 'patient_count_estimate' => 1800000],
            ],
            'hf-readmit' => [
                ['site_role' => 'coordinating_center', 'status' => 'results_submitted', 'irb_type' => 'exempt', 'irb_approval_date' => '2025-01-10', 'cdm_version' => '5.4', 'patient_count_estimate' => 950000],
            ],
            'gde-drs' => [
                ['site_role' => 'coordinating_center', 'status' => 'executing', 'irb_type' => 'waiver', 'irb_approval_date' => '2025-02-05', 'cdm_version' => '5.4', 'patient_count_estimate' => 1500000],
            ],
            'cap-pathways' => [
                ['site_role' => 'coordinating_center', 'status' => 'executing', 'irb_type' => 'not_required', 'cdm_version' => '5.4', 'patient_count_estimate' => 780000],
            ],
        ];

        $count = 0;
        foreach ($siteDefs as $key => $sites) {
            if (! isset($studyMap[$key])) {
                continue;
            }
            $study = $studyMap[$key];

            foreach ($sites as $i => $site) {
                $sourceId = $sourceIds[$i % count($sourceIds)];

                StudySite::firstOrCreate(
                    ['study_id' => $study->id, 'source_id' => $sourceId],
                    [
                        'site_role' => $site['site_role'],
                        'status' => $site['status'],
                        'irb_type' => $site['irb_type'] ?? null,
                        'irb_approval_date' => $site['irb_approval_date'] ?? null,
                        'irb_expiry_date' => isset($site['irb_approval_date']) ? date('Y-m-d', strtotime($site['irb_approval_date'].' +1 year')) : null,
                        'dua_signed_at' => isset($site['irb_approval_date']) ? $site['irb_approval_date'] : null,
                        'site_contact_user_id' => $adminId,
                        'cdm_version' => $site['cdm_version'] ?? null,
                        'vocabulary_version' => 'v5.0 2025-01-01',
                        'data_freshness_date' => '2025-12-31',
                        'patient_count_estimate' => $site['patient_count_estimate'] ?? null,
                        'notes' => null,
                    ],
                );
                $count++;
            }
        }

        $this->command->info("  Sites: {$count}");
    }

    private function seedCohorts(array $studyMap, array $cohorts): void
    {
        if (empty($cohorts)) {
            $this->command->warn('  No cohort definitions found — skipping cohort seeding.');

            return;
        }

        $cohortDefs = [
            'legend-t2dm' => [
                ['cohort' => 'Type 2 Diabetes Mellitus', 'role' => 'target', 'label' => 'T2DM patients on metformin monotherapy'],
                ['cohort' => 'Chronic Kidney Disease Stage 3-5 with eGFR Monitoring', 'role' => 'outcome', 'label' => 'CKD progression outcome'],
            ],
            'legend-htn' => [
                ['cohort' => 'Essential Hypertension with Antihypertensive Therapy', 'role' => 'target', 'label' => 'Hypertension patients initiating treatment'],
                ['cohort' => 'Coronary Artery Disease with Statin Therapy', 'role' => 'outcome', 'label' => 'Cardiovascular composite outcome'],
            ],
            'covax-myocarditis' => [
                ['cohort' => 'Heart Failure with BNP Monitoring', 'role' => 'outcome', 'label' => 'Myocarditis/pericarditis events (proxy)'],
            ],
            'hf-readmit' => [
                ['cohort' => 'Heart Failure with BNP Monitoring', 'role' => 'target', 'label' => 'Heart failure index hospitalization cohort'],
                ['cohort' => 'Type 2 Diabetes Mellitus', 'role' => 'subgroup', 'label' => 'Diabetic HF subgroup'],
                ['cohort' => 'Chronic Kidney Disease Stage 3-5 with eGFR Monitoring', 'role' => 'subgroup', 'label' => 'CKD comorbidity subgroup'],
            ],
            'gde-drs' => [
                ['cohort' => 'Type 2 Diabetes Mellitus', 'role' => 'target', 'label' => 'Diabetic patients for screening assessment'],
            ],
            'cap-pathways' => [
                ['cohort' => 'Essential Hypertension with Antihypertensive Therapy', 'role' => 'subgroup', 'label' => 'Hypertensive CAP patients (comorbidity subgroup)'],
            ],
        ];

        $count = 0;
        foreach ($cohortDefs as $key => $defs) {
            if (! isset($studyMap[$key])) {
                continue;
            }
            $study = $studyMap[$key];

            foreach ($defs as $order => $def) {
                $cohortId = $cohorts[$def['cohort']] ?? null;
                if (! $cohortId) {
                    continue;
                }

                StudyCohort::firstOrCreate(
                    ['study_id' => $study->id, 'cohort_definition_id' => $cohortId, 'role' => $def['role']],
                    [
                        'label' => $def['label'],
                        'sort_order' => $order,
                    ],
                );
                $count++;
            }
        }

        $this->command->info("  Cohorts: {$count}");
    }

    private function seedMilestones(array $studyMap, int $adminId): void
    {
        $milestoneDefs = [
            'legend-t2dm' => [
                ['title' => 'Protocol Finalized', 'type' => 'protocol_finalized', 'status' => 'completed', 'target' => '2025-05-25', 'actual' => '2025-05-28'],
                ['title' => 'IRB Approval', 'type' => 'irb_approved', 'status' => 'completed', 'target' => '2025-06-15', 'actual' => '2025-06-12'],
                ['title' => 'Feasibility Complete', 'type' => 'feasibility_complete', 'status' => 'completed', 'target' => '2025-07-01', 'actual' => '2025-07-03'],
                ['title' => 'Code Validated', 'type' => 'code_validated', 'status' => 'completed', 'target' => '2025-07-15', 'actual' => '2025-07-18'],
                ['title' => 'Execution Started', 'type' => 'execution_started', 'status' => 'completed', 'target' => '2025-08-01', 'actual' => '2025-08-01'],
                ['title' => 'All Sites Complete', 'type' => 'all_sites_complete', 'status' => 'in_progress', 'target' => '2026-06-30', 'actual' => null],
                ['title' => 'Synthesis Complete', 'type' => 'synthesis_complete', 'status' => 'pending', 'target' => '2026-09-30', 'actual' => null],
                ['title' => 'Manuscript Submitted', 'type' => 'manuscript_submitted', 'status' => 'pending', 'target' => '2026-12-31', 'actual' => null],
            ],
            'legend-htn' => [
                ['title' => 'Protocol Finalized', 'type' => 'protocol_finalized', 'status' => 'completed', 'target' => '2025-01-20', 'actual' => '2025-01-18'],
                ['title' => 'IRB Approval', 'type' => 'irb_approved', 'status' => 'completed', 'target' => '2025-02-15', 'actual' => '2025-02-10'],
                ['title' => 'All Sites Complete', 'type' => 'all_sites_complete', 'status' => 'completed', 'target' => '2025-11-30', 'actual' => '2025-12-05'],
                ['title' => 'Synthesis Complete', 'type' => 'synthesis_complete', 'status' => 'in_progress', 'target' => '2026-03-31', 'actual' => null],
            ],
            'covax-myocarditis' => [
                ['title' => 'Protocol Finalized', 'type' => 'protocol_finalized', 'status' => 'completed', 'target' => '2024-02-15', 'actual' => '2024-02-28'],
                ['title' => 'All Sites Complete', 'type' => 'all_sites_complete', 'status' => 'completed', 'target' => '2025-06-30', 'actual' => '2025-07-15'],
                ['title' => 'Manuscript Submitted', 'type' => 'manuscript_submitted', 'status' => 'completed', 'target' => '2025-08-31', 'actual' => '2025-09-10'],
                ['title' => 'Published', 'type' => 'published', 'status' => 'completed', 'target' => '2025-10-31', 'actual' => '2025-09-30'],
            ],
            'hf-readmit' => [
                ['title' => 'Protocol Finalized', 'type' => 'protocol_finalized', 'status' => 'completed', 'target' => '2025-02-01', 'actual' => '2025-02-15'],
                ['title' => 'Execution Started', 'type' => 'execution_started', 'status' => 'completed', 'target' => '2025-03-01', 'actual' => '2025-03-05'],
                ['title' => 'All Sites Complete', 'type' => 'all_sites_complete', 'status' => 'completed', 'target' => '2026-01-31', 'actual' => '2026-02-10'],
                ['title' => 'Synthesis Complete', 'type' => 'synthesis_complete', 'status' => 'in_progress', 'target' => '2026-04-30', 'actual' => null],
            ],
            'gde-drs' => [
                ['title' => 'Protocol Finalized', 'type' => 'protocol_finalized', 'status' => 'completed', 'target' => '2025-02-01', 'actual' => '2025-01-28'],
                ['title' => 'Feasibility Complete', 'type' => 'feasibility_complete', 'status' => 'completed', 'target' => '2025-03-15', 'actual' => '2025-03-10'],
                ['title' => 'Execution Started', 'type' => 'execution_started', 'status' => 'completed', 'target' => '2025-04-01', 'actual' => '2025-04-01'],
                ['title' => 'All Sites Complete', 'type' => 'all_sites_complete', 'status' => 'pending', 'target' => '2025-12-31', 'actual' => null],
            ],
            'cap-pathways' => [
                ['title' => 'Protocol Finalized', 'type' => 'protocol_finalized', 'status' => 'completed', 'target' => '2025-05-01', 'actual' => '2025-04-28'],
                ['title' => 'Execution Started', 'type' => 'execution_started', 'status' => 'completed', 'target' => '2025-06-01', 'actual' => '2025-06-01'],
                ['title' => 'All Sites Complete', 'type' => 'all_sites_complete', 'status' => 'pending', 'target' => '2026-02-28', 'actual' => null],
            ],
        ];

        $count = 0;
        foreach ($milestoneDefs as $key => $milestones) {
            if (! isset($studyMap[$key])) {
                continue;
            }
            $study = $studyMap[$key];

            foreach ($milestones as $order => $ms) {
                StudyMilestone::firstOrCreate(
                    ['study_id' => $study->id, 'title' => $ms['title']],
                    [
                        'milestone_type' => $ms['type'],
                        'status' => $ms['status'],
                        'target_date' => $ms['target'],
                        'actual_date' => $ms['actual'],
                        'assigned_to' => $adminId,
                        'sort_order' => $order,
                    ],
                );
                $count++;
            }
        }

        $this->command->info("  Milestones: {$count}");
    }

    private function seedArtifacts(array $studyMap, int $adminId): void
    {
        $artifactDefs = [
            'legend-t2dm' => [
                ['type' => 'protocol', 'title' => 'LEGEND-T2DM Study Protocol v2.1', 'version' => '2.1', 'mime' => 'application/pdf'],
                ['type' => 'sap', 'title' => 'Statistical Analysis Plan', 'version' => '1.0', 'mime' => 'application/pdf'],
                ['type' => 'cohort_json', 'title' => 'T2DM Target Cohort Definition', 'version' => '1.0', 'mime' => 'application/json'],
                ['type' => 'analysis_package_r', 'title' => 'LEGEND-T2DM R Analysis Package', 'version' => '2.1.0', 'mime' => 'application/zip'],
            ],
            'legend-htn' => [
                ['type' => 'protocol', 'title' => 'LEGEND-HTN Study Protocol v1.2', 'version' => '1.2', 'mime' => 'application/pdf'],
                ['type' => 'results_report', 'title' => 'Preliminary Results Summary', 'version' => '0.9', 'mime' => 'application/pdf'],
            ],
            'covax-myocarditis' => [
                ['type' => 'protocol', 'title' => 'CoVax-Myocarditis Protocol v3.0', 'version' => '3.0', 'mime' => 'application/pdf'],
                ['type' => 'manuscript_draft', 'title' => 'Manuscript Draft — NEJM Submission', 'version' => '4.2', 'mime' => 'application/pdf'],
                ['type' => 'supplementary', 'title' => 'Supplementary Tables and Figures', 'version' => '1.0', 'mime' => 'application/pdf'],
            ],
            'hf-readmit' => [
                ['type' => 'protocol', 'title' => 'HF-Readmit Protocol v3.0', 'version' => '3.0', 'mime' => 'application/pdf'],
                ['type' => 'analysis_package_r', 'title' => 'HF Readmission PLP Package', 'version' => '1.2.0', 'mime' => 'application/zip'],
                ['type' => 'results_report', 'title' => 'Model Performance Report', 'version' => '1.0', 'mime' => 'application/pdf'],
            ],
            'gde-drs' => [
                ['type' => 'protocol', 'title' => 'GDE-DRS Protocol v1.0', 'version' => '1.0', 'mime' => 'application/pdf'],
                ['type' => 'data_dictionary', 'title' => 'Data Dictionary — Screening Variables', 'version' => '1.0', 'mime' => 'text/csv'],
            ],
            'cap-pathways' => [
                ['type' => 'protocol', 'title' => 'CAP Treatment Pathways Protocol v1.0', 'version' => '1.0', 'mime' => 'application/pdf'],
            ],
        ];

        $count = 0;
        foreach ($artifactDefs as $key => $artifacts) {
            if (! isset($studyMap[$key])) {
                continue;
            }
            $study = $studyMap[$key];

            foreach ($artifacts as $artifact) {
                StudyArtifact::firstOrCreate(
                    ['study_id' => $study->id, 'title' => $artifact['title']],
                    [
                        'artifact_type' => $artifact['type'],
                        'version' => $artifact['version'],
                        'mime_type' => $artifact['mime'],
                        'uploaded_by' => $adminId,
                        'is_current' => true,
                    ],
                );
                $count++;
            }
        }

        $this->command->info("  Artifacts: {$count}");
    }

    private function seedActivityLogs(array $studyMap, int $adminId): void
    {
        $logDefs = [
            'legend-t2dm' => [
                ['action' => 'created', 'occurred_at' => '2025-05-15 09:00:00'],
                ['action' => 'team_member_added', 'entity_type' => 'StudyTeamMember', 'new_value' => ['role' => 'principal_investigator'], 'occurred_at' => '2025-05-15 09:05:00'],
                ['action' => 'status_changed', 'old_value' => ['status' => 'draft'], 'new_value' => ['status' => 'protocol_development'], 'occurred_at' => '2025-05-20 14:30:00'],
                ['action' => 'artifact_uploaded', 'entity_type' => 'StudyArtifact', 'new_value' => ['title' => 'Study Protocol v2.1'], 'occurred_at' => '2025-05-28 10:00:00'],
                ['action' => 'status_changed', 'old_value' => ['status' => 'protocol_development'], 'new_value' => ['status' => 'feasibility'], 'occurred_at' => '2025-06-01 08:00:00'],
                ['action' => 'site_added', 'entity_type' => 'StudySite', 'new_value' => ['site_role' => 'coordinating_center'], 'occurred_at' => '2025-06-05 11:00:00'],
                ['action' => 'cohort_added', 'entity_type' => 'StudyCohort', 'new_value' => ['role' => 'target', 'label' => 'T2DM patients'], 'occurred_at' => '2025-06-10 09:30:00'],
                ['action' => 'status_changed', 'old_value' => ['status' => 'feasibility'], 'new_value' => ['status' => 'execution'], 'occurred_at' => '2025-08-01 08:00:00'],
            ],
            'covax-myocarditis' => [
                ['action' => 'created', 'occurred_at' => '2023-12-01 10:00:00'],
                ['action' => 'status_changed', 'old_value' => ['status' => 'draft'], 'new_value' => ['status' => 'execution'], 'occurred_at' => '2024-02-28 09:00:00'],
                ['action' => 'status_changed', 'old_value' => ['status' => 'execution'], 'new_value' => ['status' => 'synthesis'], 'occurred_at' => '2025-07-15 16:00:00'],
                ['action' => 'status_changed', 'old_value' => ['status' => 'synthesis'], 'new_value' => ['status' => 'manuscript'], 'occurred_at' => '2025-08-20 10:00:00'],
                ['action' => 'status_changed', 'old_value' => ['status' => 'manuscript'], 'new_value' => ['status' => 'published'], 'occurred_at' => '2025-09-30 14:00:00'],
            ],
            'hf-readmit' => [
                ['action' => 'created', 'occurred_at' => '2024-12-01 09:00:00'],
                ['action' => 'status_changed', 'old_value' => ['status' => 'draft'], 'new_value' => ['status' => 'execution'], 'occurred_at' => '2025-03-05 08:00:00'],
                ['action' => 'status_changed', 'old_value' => ['status' => 'execution'], 'new_value' => ['status' => 'synthesis'], 'occurred_at' => '2026-02-10 16:00:00'],
                ['action' => 'execution_completed', 'entity_type' => 'StudySite', 'new_value' => ['status' => 'results_submitted'], 'occurred_at' => '2026-02-10 16:05:00'],
            ],
        ];

        $count = 0;
        foreach ($logDefs as $key => $logs) {
            if (! isset($studyMap[$key])) {
                continue;
            }
            $study = $studyMap[$key];

            foreach ($logs as $log) {
                StudyActivityLog::firstOrCreate(
                    ['study_id' => $study->id, 'action' => $log['action'], 'occurred_at' => $log['occurred_at']],
                    [
                        'user_id' => $adminId,
                        'entity_type' => $log['entity_type'] ?? null,
                        'old_value' => $log['old_value'] ?? null,
                        'new_value' => $log['new_value'] ?? null,
                    ],
                );
                $count++;
            }
        }

        $this->command->info("  Activity logs: {$count}");
    }
}
