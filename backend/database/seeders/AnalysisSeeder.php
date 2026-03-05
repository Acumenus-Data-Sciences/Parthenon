<?php

namespace Database\Seeders;

use App\Models\App\Characterization;
use App\Models\App\CohortDefinition;
use App\Models\App\ConceptSet;
use App\Models\App\EstimationAnalysis;
use App\Models\App\EvidenceSynthesisAnalysis;
use App\Models\App\IncidenceRateAnalysis;
use App\Models\App\PathwayAnalysis;
use App\Models\App\PredictionAnalysis;
use App\Models\App\SccsAnalysis;
use App\Models\User;
use Illuminate\Database\Seeder;

class AnalysisSeeder extends Seeder
{
    /**
     * Seed 13 sample analyses across 7 types, referencing existing cohorts and concept sets.
     */
    public function run(): void
    {
        $adminId = User::where('email', 'admin@parthenon.local')->value('id');
        if (! $adminId) {
            $this->command->warn('Admin user not found — skipping analysis seeding.');

            return;
        }

        // Look up cohort IDs by name
        $cohorts = CohortDefinition::pluck('id', 'name')->toArray();
        // Look up concept set IDs by name
        $conceptSets = ConceptSet::pluck('id', 'name')->toArray();

        $this->seedCharacterizations($adminId, $cohorts, $conceptSets);
        $this->seedIncidenceRates($adminId, $cohorts, $conceptSets);
        $this->seedPathways($adminId, $cohorts, $conceptSets);
        $this->seedEstimations($adminId, $cohorts, $conceptSets);
        $this->seedPredictions($adminId, $cohorts, $conceptSets);
        $this->seedSccs($adminId, $cohorts, $conceptSets);
        $this->seedEvidenceSynthesis($adminId);
    }

    private function seedCharacterizations(int $adminId, array $cohorts, array $conceptSets): void
    {
        $t2dmCohortId = $cohorts['Type 2 Diabetes Mellitus Management'] ?? 0;
        $hfCohortId = $cohorts['Heart Failure with BNP Monitoring'] ?? 0;
        $hba1cCsId = $conceptSets['HbA1c Lab Tests'] ?? 0;
        $bnpCsId = $conceptSets['BNP/NT-proBNP Lab Tests'] ?? 0;
        $hfMedsCsId = $conceptSets['Heart Failure Medications'] ?? 0;

        Characterization::firstOrCreate(
            ['name' => 'T2DM Patient Characterization'],
            [
                'description' => 'Baseline and follow-up characterization of Type 2 Diabetes patients including demographics, conditions, medications, and HbA1c lab monitoring patterns.',
                'author_id' => $adminId,
                'design_json' => [
                    'targetCohortIds' => [$t2dmCohortId],
                    'comparatorCohortIds' => [],
                    'featureTypes' => ['demographics', 'conditions', 'drugs', 'measurements'],
                    'conceptSetIds' => [$hba1cCsId],
                    'stratifyByGender' => true,
                    'stratifyByAge' => true,
                    'topN' => 100,
                    'minCellCount' => 5,
                    'timeWindows' => [
                        ['start' => -365, 'end' => 0, 'label' => 'Baseline (1yr pre-index)'],
                        ['start' => 0, 'end' => 365, 'label' => 'Follow-up (1yr post-index)'],
                    ],
                ],
            ],
        );

        Characterization::firstOrCreate(
            ['name' => 'Heart Failure Baseline Profile'],
            [
                'description' => 'Comprehensive baseline characterization of Heart Failure patients including BNP/NT-proBNP biomarker levels and medication utilization patterns.',
                'author_id' => $adminId,
                'design_json' => [
                    'targetCohortIds' => [$hfCohortId],
                    'comparatorCohortIds' => [],
                    'featureTypes' => ['demographics', 'conditions', 'drugs', 'measurements'],
                    'conceptSetIds' => [$bnpCsId, $hfMedsCsId],
                    'stratifyByGender' => true,
                    'stratifyByAge' => false,
                    'topN' => 50,
                    'minCellCount' => 5,
                    'timeWindows' => [
                        ['start' => -365, 'end' => 0, 'label' => 'Baseline (1yr pre-index)'],
                    ],
                ],
            ],
        );
    }

    private function seedIncidenceRates(int $adminId, array $cohorts, array $conceptSets): void
    {
        $t2dmCohortId = $cohorts['Type 2 Diabetes Mellitus Management'] ?? 0;
        $ckdCohortId = $cohorts['Chronic Kidney Disease Stage 3-5 with eGFR Monitoring'] ?? 0;
        $hfCohortId = $cohorts['Heart Failure with BNP Monitoring'] ?? 0;

        IncidenceRateAnalysis::firstOrCreate(
            ['name' => 'New-Onset CKD in T2DM Patients'],
            [
                'description' => 'Incidence rate of new-onset chronic kidney disease among patients with Type 2 Diabetes, stratified by age and gender.',
                'author_id' => $adminId,
                'design_json' => [
                    'targetCohortId' => $t2dmCohortId,
                    'outcomeCohortIds' => [$ckdCohortId],
                    'timeAtRisk' => [
                        'start' => ['dateField' => 'StartDate', 'offset' => 0],
                        'end' => ['dateField' => 'EndDate', 'offset' => 0],
                    ],
                    'stratifyByGender' => true,
                    'stratifyByAge' => true,
                    'ageGroups' => ['18-44', '45-64', '65-74', '75+'],
                    'minCellCount' => 5,
                ],
            ],
        );

        IncidenceRateAnalysis::firstOrCreate(
            ['name' => 'Heart Failure Hospitalization Rate'],
            [
                'description' => 'Incidence rate of heart failure-related hospitalizations among diagnosed HF patients, stratified by age and gender.',
                'author_id' => $adminId,
                'design_json' => [
                    'targetCohortId' => $hfCohortId,
                    'outcomeCohortIds' => [$hfCohortId],
                    'timeAtRisk' => [
                        'start' => ['dateField' => 'StartDate', 'offset' => 1],
                        'end' => ['dateField' => 'EndDate', 'offset' => 0],
                    ],
                    'stratifyByGender' => true,
                    'stratifyByAge' => true,
                    'ageGroups' => ['18-44', '45-64', '65-74', '75+'],
                    'minCellCount' => 5,
                ],
            ],
        );
    }

    private function seedPathways(int $adminId, array $cohorts, array $conceptSets): void
    {
        $htnCohortId = $cohorts['Essential Hypertension with Antihypertensive Therapy'] ?? 0;
        $t2dmCohortId = $cohorts['Type 2 Diabetes Mellitus Management'] ?? 0;

        PathwayAnalysis::firstOrCreate(
            ['name' => 'Antihypertensive Treatment Pathway'],
            [
                'description' => 'Treatment pathway analysis for hypertension patients showing sequences of antihypertensive drug classes (ACE inhibitors, ARBs, beta-blockers, CCBs, thiazides).',
                'author_id' => $adminId,
                'design_json' => [
                    'targetCohortId' => $htnCohortId,
                    'eventCohortIds' => [$htnCohortId],
                    'drugConceptSetIds' => [$conceptSets['Antihypertensive Medications'] ?? 0],
                    'maxDepth' => 5,
                    'minCellCount' => 5,
                    'combinationWindow' => 1,
                    'maxPathLength' => 5,
                ],
            ],
        );

        PathwayAnalysis::firstOrCreate(
            ['name' => 'T2DM Medication Escalation'],
            [
                'description' => 'Treatment escalation pathway analysis for Type 2 Diabetes patients showing progression through oral antidiabetics and insulin therapy.',
                'author_id' => $adminId,
                'design_json' => [
                    'targetCohortId' => $t2dmCohortId,
                    'eventCohortIds' => [$t2dmCohortId],
                    'maxDepth' => 4,
                    'minCellCount' => 5,
                    'combinationWindow' => 30,
                    'maxPathLength' => 4,
                ],
            ],
        );
    }

    private function seedEstimations(int $adminId, array $cohorts, array $conceptSets): void
    {
        $cadCohortId = $cohorts['Coronary Artery Disease with Statin Therapy'] ?? 0;
        $htnCohortId = $cohorts['Essential Hypertension with Antihypertensive Therapy'] ?? 0;

        EstimationAnalysis::firstOrCreate(
            ['name' => 'Statin Effect on CAD Outcomes'],
            [
                'description' => 'Population-level estimation of statin therapy effect on cardiovascular outcomes in CAD patients using propensity score matching with Cox proportional hazards model.',
                'author_id' => $adminId,
                'design_json' => [
                    'targetCohortId' => $cadCohortId,
                    'comparatorCohortId' => $cadCohortId,
                    'outcomeCohortIds' => [$cadCohortId],
                    'model' => [
                        'type' => 'cox',
                        'timeAtRiskStart' => 0,
                        'timeAtRiskEnd' => 0,
                        'endAnchor' => 'cohort end',
                    ],
                    'propensityScore' => [
                        'enabled' => true,
                        'trimming' => 0.05,
                        'matching' => ['ratio' => 1, 'caliper' => 0.2],
                        'stratification' => ['strata' => 5],
                    ],
                    'covariateSettings' => [
                        'useDemographics' => true,
                        'useConditionOccurrence' => true,
                        'useDrugExposure' => true,
                        'useProcedureOccurrence' => true,
                        'useMeasurement' => true,
                        'timeWindows' => [['start' => -365, 'end' => 0]],
                    ],
                    'negativeControlOutcomes' => [],
                ],
            ],
        );

        EstimationAnalysis::firstOrCreate(
            ['name' => 'ACE-I vs ARB for Hypertension'],
            [
                'description' => 'Comparative effectiveness study of ACE inhibitors versus ARBs for hypertension management using propensity score stratification.',
                'author_id' => $adminId,
                'design_json' => [
                    'targetCohortId' => $htnCohortId,
                    'comparatorCohortId' => $htnCohortId,
                    'outcomeCohortIds' => [$htnCohortId],
                    'model' => [
                        'type' => 'cox',
                        'timeAtRiskStart' => 0,
                        'timeAtRiskEnd' => 0,
                        'endAnchor' => 'cohort end',
                    ],
                    'propensityScore' => [
                        'enabled' => true,
                        'method' => 'stratification',
                        'trimming' => 0.05,
                        'matching' => ['ratio' => 1, 'caliper' => 0.2],
                        'stratification' => ['strata' => 10],
                    ],
                    'covariateSettings' => [
                        'useDemographics' => true,
                        'useConditionOccurrence' => true,
                        'useDrugExposure' => true,
                        'useProcedureOccurrence' => false,
                        'useMeasurement' => true,
                        'timeWindows' => [['start' => -365, 'end' => 0]],
                    ],
                    'negativeControlOutcomes' => [],
                ],
            ],
        );
    }

    private function seedPredictions(int $adminId, array $cohorts, array $conceptSets): void
    {
        $ckdCohortId = $cohorts['Chronic Kidney Disease Stage 3-5 with eGFR Monitoring'] ?? 0;
        $hfCohortId = $cohorts['Heart Failure with BNP Monitoring'] ?? 0;

        PredictionAnalysis::firstOrCreate(
            ['name' => 'CKD Progression Risk Model'],
            [
                'description' => 'Patient-level prediction model for CKD progression risk using LASSO logistic regression with demographics, lab values, and comorbidity features.',
                'author_id' => $adminId,
                'design_json' => [
                    'targetCohortId' => $ckdCohortId,
                    'outcomeCohortId' => $ckdCohortId,
                    'model' => [
                        'type' => 'lasso_logistic_regression',
                        'hyperParameters' => ['variance' => 0.01],
                    ],
                    'timeAtRisk' => [
                        'start' => 1,
                        'end' => 365,
                        'endAnchor' => 'cohort start',
                    ],
                    'covariateSettings' => [
                        'useDemographics' => true,
                        'useConditionOccurrence' => true,
                        'useDrugExposure' => true,
                        'useProcedureOccurrence' => false,
                        'useMeasurement' => true,
                        'timeWindows' => [['start' => -365, 'end' => 0]],
                    ],
                    'populationSettings' => [
                        'washoutPeriod' => 365,
                        'removeSubjectsWithPriorOutcome' => true,
                        'requireTimeAtRisk' => true,
                        'minTimeAtRisk' => 365,
                    ],
                    'splitSettings' => [
                        'testFraction' => 0.25,
                        'splitSeed' => 42,
                    ],
                ],
            ],
        );

        PredictionAnalysis::firstOrCreate(
            ['name' => 'Heart Failure Readmission Risk'],
            [
                'description' => 'Prediction model for 30-day heart failure readmission risk using gradient boosting with comprehensive baseline covariates.',
                'author_id' => $adminId,
                'design_json' => [
                    'targetCohortId' => $hfCohortId,
                    'outcomeCohortId' => $hfCohortId,
                    'model' => [
                        'type' => 'gradient_boosting',
                        'hyperParameters' => [
                            'nTrees' => 100,
                            'maxDepth' => 4,
                            'learningRate' => 0.1,
                        ],
                    ],
                    'timeAtRisk' => [
                        'start' => 1,
                        'end' => 30,
                        'endAnchor' => 'cohort start',
                    ],
                    'covariateSettings' => [
                        'useDemographics' => true,
                        'useConditionOccurrence' => true,
                        'useDrugExposure' => true,
                        'useProcedureOccurrence' => true,
                        'useMeasurement' => true,
                        'useVisitCount' => true,
                        'useCharlsonIndex' => true,
                        'timeWindows' => [
                            ['start' => -365, 'end' => 0],
                            ['start' => -30, 'end' => 0],
                        ],
                    ],
                    'populationSettings' => [
                        'washoutPeriod' => 180,
                        'removeSubjectsWithPriorOutcome' => false,
                        'requireTimeAtRisk' => true,
                        'minTimeAtRisk' => 30,
                    ],
                    'splitSettings' => [
                        'testFraction' => 0.25,
                        'splitSeed' => 42,
                        'nFold' => 3,
                    ],
                ],
            ],
        );
    }

    private function seedSccs(int $adminId, array $cohorts, array $conceptSets): void
    {
        $statinCsId = $conceptSets['Statin Medications'] ?? 0;

        SccsAnalysis::firstOrCreate(
            ['name' => 'NSAID Exposure and GI Bleeding'],
            [
                'description' => 'Self-controlled case series analysis evaluating the temporal association between NSAID exposure and gastrointestinal bleeding events.',
                'author_id' => $adminId,
                'design_json' => [
                    'exposureCohortId' => 0,
                    'outcomeCohortId' => 0,
                    'riskWindows' => [
                        [
                            'start' => 1,
                            'end' => 30,
                            'startAnchor' => 'era_start',
                            'endAnchor' => 'era_start',
                            'label' => 'Acute risk (1-30 days)',
                        ],
                        [
                            'start' => 31,
                            'end' => 60,
                            'startAnchor' => 'era_start',
                            'endAnchor' => 'era_start',
                            'label' => 'Extended risk (31-60 days)',
                        ],
                    ],
                    'model' => [
                        'type' => 'age_season_adjusted',
                    ],
                    'studyPopulation' => [
                        'naivePeriod' => 180,
                        'firstOutcomeOnly' => true,
                        'minAge' => 18,
                    ],
                ],
            ],
        );

        SccsAnalysis::firstOrCreate(
            ['name' => 'Statin Exposure and Myopathy'],
            [
                'description' => 'Self-controlled case series analysis of statin therapy and myopathy/rhabdomyolysis risk using age-adjusted conditional Poisson regression.',
                'author_id' => $adminId,
                'design_json' => [
                    'exposureCohortId' => 0,
                    'outcomeCohortId' => 0,
                    'conceptSetIds' => [$statinCsId],
                    'riskWindows' => [
                        [
                            'start' => 1,
                            'end' => 90,
                            'startAnchor' => 'era_start',
                            'endAnchor' => 'era_start',
                            'label' => 'Risk window (1-90 days)',
                        ],
                    ],
                    'model' => [
                        'type' => 'age_adjusted',
                    ],
                    'studyPopulation' => [
                        'naivePeriod' => 365,
                        'firstOutcomeOnly' => true,
                        'minAge' => 40,
                    ],
                ],
            ],
        );
    }

    private function seedEvidenceSynthesis(int $adminId): void
    {
        EvidenceSynthesisAnalysis::firstOrCreate(
            ['name' => 'Meta-Analysis: Statin Cardioprotection'],
            [
                'description' => 'Random-effects meta-analysis synthesizing evidence on statin cardioprotective effects across multiple data sources, with forest plot and heterogeneity assessment.',
                'author_id' => $adminId,
                'design_json' => [
                    'estimates' => [
                        ['logRr' => -0.35, 'seLogRr' => 0.12, 'siteName' => 'Acumenus CDM (Primary)'],
                        ['logRr' => -0.28, 'seLogRr' => 0.15, 'siteName' => 'Eunomia GiBleed'],
                        ['logRr' => -0.42, 'seLogRr' => 0.18, 'siteName' => 'External Registry A'],
                        ['logRr' => -0.31, 'seLogRr' => 0.10, 'siteName' => 'External Registry B'],
                    ],
                    'method' => 'bayesian',
                    'chainLength' => 1100000,
                    'burnIn' => 100000,
                    'subSample' => 1000,
                ],
            ],
        );
    }
}
