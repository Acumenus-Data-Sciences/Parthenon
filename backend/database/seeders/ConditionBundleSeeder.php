<?php

namespace Database\Seeders;

use App\Models\App\BundleOverlapRule;
use App\Models\App\ConditionBundle;
use App\Models\App\QualityMeasure;
use Illuminate\Database\Seeder;

class ConditionBundleSeeder extends Seeder
{
    /**
     * Seed 10 core disease bundles with quality measures and overlap rules.
     */
    public function run(): void
    {
        $bundles = $this->getBundleDefinitions();

        foreach ($bundles as $bundleDef) {
            $measures = $bundleDef['measures'];
            unset($bundleDef['measures']);

            $bundleDef['bundle_size'] = count($measures);

            $bundle = ConditionBundle::firstOrCreate(
                ['bundle_code' => $bundleDef['bundle_code']],
                $bundleDef,
            );

            foreach ($measures as $ordinal => $measureDef) {
                $measure = QualityMeasure::firstOrCreate(
                    ['measure_code' => $measureDef['measure_code']],
                    $measureDef,
                );

                if (! $bundle->measures()->where('measure_id', $measure->id)->exists()) {
                    $bundle->measures()->attach($measure->id, ['ordinal' => $ordinal]);
                }
            }
        }

        $this->seedOverlapRules();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function getBundleDefinitions(): array
    {
        return [
            // ── 1. Type 2 Diabetes Mellitus ──────────────────────────────────
            [
                'bundle_code' => 'DM',
                'condition_name' => 'Type 2 Diabetes Mellitus',
                'description' => 'Comprehensive quality measures for Type 2 Diabetes management including glycemic control, screening, and preventive care.',
                'icd10_patterns' => ['E11%'],
                'omop_concept_ids' => [201826, 443238, 4193704],
                'ecqm_references' => ['CMS122v11', 'CMS131v11', 'CMS134v11'],
                'disease_category' => 'Endocrine',
                'is_active' => true,
                'measures' => [
                    [
                        'measure_code' => 'DM-01',
                        'measure_name' => 'HbA1c Testing',
                        'description' => 'Percentage of patients with diabetes who had HbA1c testing performed at least semi-annually.',
                        'measure_type' => 'chronic',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3004410, 3034639, 40758583],
                            'lookback_days' => 183,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [201826, 443238],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'semi-annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'DM-02',
                        'measure_name' => 'HbA1c Poor Control (>9%)',
                        'description' => 'Percentage of patients with diabetes whose most recent HbA1c level was greater than 9.0% (poor control).',
                        'measure_type' => 'chronic',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3004410],
                            'lookback_days' => 365,
                            'value_threshold' => 9.0,
                            'operator' => '>',
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [201826, 443238],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'DM-03',
                        'measure_name' => 'Dilated Retinal Eye Exam',
                        'description' => 'Percentage of patients with diabetes who had a dilated retinal eye exam or negative retinal exam within the measurement period.',
                        'measure_type' => 'preventive',
                        'domain' => 'procedure',
                        'numerator_criteria' => [
                            'concept_ids' => [4213297, 4088219, 2106344],
                            'lookback_days' => 365,
                            'table' => 'procedure_occurrence',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [201826, 443238],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'DM-04',
                        'measure_name' => 'Nephropathy Screening',
                        'description' => 'Percentage of patients with diabetes who had a nephropathy screening test (urine albumin) or evidence of nephropathy treatment.',
                        'measure_type' => 'preventive',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3006923, 3013682, 3002888],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [201826, 443238],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'DM-05',
                        'measure_name' => 'Blood Pressure Control (<140/90)',
                        'description' => 'Percentage of patients with diabetes whose most recent blood pressure was adequately controlled (<140/90 mmHg).',
                        'measure_type' => 'chronic',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3004249, 3012888],
                            'lookback_days' => 365,
                            'systolic_threshold' => 140,
                            'diastolic_threshold' => 90,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [201826, 443238],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'every_visit',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'DM-06',
                        'measure_name' => 'Statin Therapy',
                        'description' => 'Percentage of patients aged 40-75 with diabetes who were prescribed or are receiving statin therapy.',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [1510813, 1549686, 1551860, 1545958, 1592085, 1583722],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [201826, 443238],
                            'age_min' => 40,
                            'age_max' => 75,
                        ],
                        'exclusion_criteria' => [
                            'allergy_concept_ids' => [],
                            'contraindication_concept_ids' => [],
                        ],
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'DM-07',
                        'measure_name' => 'Foot Examination',
                        'description' => 'Percentage of patients with diabetes who had a comprehensive foot exam during the measurement period.',
                        'measure_type' => 'preventive',
                        'domain' => 'procedure',
                        'numerator_criteria' => [
                            'concept_ids' => [4163948, 4220299],
                            'lookback_days' => 365,
                            'table' => 'procedure_occurrence',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [201826, 443238],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'DM-08',
                        'measure_name' => 'Diabetes Self-Management Education',
                        'description' => 'Percentage of patients with a new diabetes diagnosis who received diabetes self-management education within 12 months.',
                        'measure_type' => 'behavioral',
                        'domain' => 'procedure',
                        'numerator_criteria' => [
                            'concept_ids' => [4058949, 4219681],
                            'lookback_days' => 365,
                            'table' => 'procedure_occurrence',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [201826, 443238],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                ],
            ],

            // ── 2. Hypertension ──────────────────────────────────────────────
            [
                'bundle_code' => 'HTN',
                'condition_name' => 'Hypertension',
                'description' => 'Quality measures for hypertension management focusing on blood pressure control and cardiovascular risk reduction.',
                'icd10_patterns' => ['I10%', 'I11%', 'I12%', 'I13%'],
                'omop_concept_ids' => [316866, 4028741],
                'ecqm_references' => ['CMS165v11'],
                'disease_category' => 'Cardiovascular',
                'is_active' => true,
                'measures' => [
                    [
                        'measure_code' => 'HTN-01',
                        'measure_name' => 'Blood Pressure Control (<140/90)',
                        'description' => 'Percentage of patients with hypertension whose blood pressure was adequately controlled (<140/90 mmHg).',
                        'measure_type' => 'chronic',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3004249, 3012888],
                            'lookback_days' => 365,
                            'systolic_threshold' => 140,
                            'diastolic_threshold' => 90,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316866],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'every_visit',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'HTN-02',
                        'measure_name' => 'Antihypertensive Medication Adherence',
                        'description' => 'Percentage of patients with hypertension who are prescribed and adherent to antihypertensive medication.',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [1308216, 1310756, 1313200, 1314002, 1317640, 1341927, 1353776],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316866],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'HTN-03',
                        'measure_name' => 'Annual Metabolic Panel',
                        'description' => 'Percentage of patients with hypertension who had a comprehensive metabolic panel within the measurement year.',
                        'measure_type' => 'preventive',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3016723, 3024128, 3006906],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316866],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'HTN-04',
                        'measure_name' => 'Lipid Panel Screening',
                        'description' => 'Percentage of patients with hypertension who had a lipid panel within the measurement period.',
                        'measure_type' => 'preventive',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3027114, 3028437, 3019900, 3007070],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316866],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'HTN-05',
                        'measure_name' => 'Renal Function Monitoring',
                        'description' => 'Percentage of patients with hypertension who had serum creatinine or eGFR testing within the measurement period.',
                        'measure_type' => 'preventive',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3016723, 3049187, 3053283],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316866],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'HTN-06',
                        'measure_name' => 'Lifestyle Counseling',
                        'description' => 'Percentage of patients with hypertension who received lifestyle modification counseling (diet, exercise, weight).',
                        'measure_type' => 'behavioral',
                        'domain' => 'procedure',
                        'numerator_criteria' => [
                            'concept_ids' => [4054933, 4218106],
                            'lookback_days' => 365,
                            'table' => 'procedure_occurrence',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316866],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                ],
            ],

            // ── 3. Coronary Artery Disease ───────────────────────────────────
            [
                'bundle_code' => 'CAD',
                'condition_name' => 'Coronary Artery Disease',
                'description' => 'Quality measures for coronary artery disease management including secondary prevention and cardiac monitoring.',
                'icd10_patterns' => ['I25%', 'I20%', 'I21%'],
                'omop_concept_ids' => [316139, 321318, 4329847],
                'ecqm_references' => ['CMS347v6'],
                'disease_category' => 'Cardiovascular',
                'is_active' => true,
                'measures' => [
                    [
                        'measure_code' => 'CAD-01',
                        'measure_name' => 'Antiplatelet Therapy',
                        'description' => 'Percentage of patients with CAD who are prescribed antiplatelet therapy (aspirin or P2Y12 inhibitor).',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [1112807, 1322184, 1328165],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316139, 321318],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'CAD-02',
                        'measure_name' => 'Statin Therapy',
                        'description' => 'Percentage of patients with CAD who are prescribed high-intensity statin therapy.',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [1510813, 1549686, 1551860, 1545958],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316139, 321318],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'CAD-03',
                        'measure_name' => 'Blood Pressure Control (<140/90)',
                        'description' => 'Percentage of patients with CAD whose blood pressure was adequately controlled.',
                        'measure_type' => 'chronic',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3004249, 3012888],
                            'lookback_days' => 365,
                            'systolic_threshold' => 140,
                            'diastolic_threshold' => 90,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316139, 321318],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'every_visit',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'CAD-04',
                        'measure_name' => 'LDL Cholesterol Monitoring',
                        'description' => 'Percentage of patients with CAD who had LDL cholesterol testing within the measurement period.',
                        'measure_type' => 'preventive',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3028437, 3009966],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316139, 321318],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'CAD-05',
                        'measure_name' => 'Beta-Blocker Post-MI',
                        'description' => 'Percentage of patients with prior MI who are prescribed beta-blocker therapy.',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [1314002, 1338005, 1353776, 1346686],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [4329847],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'CAD-06',
                        'measure_name' => 'ACE Inhibitor or ARB Therapy',
                        'description' => 'Percentage of patients with CAD and LVEF <40% who are prescribed ACE inhibitor or ARB therapy.',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [1308216, 1310756, 1335471, 1341927, 1363749],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316139, 321318],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'CAD-07',
                        'measure_name' => 'Cardiac Rehabilitation Referral',
                        'description' => 'Percentage of eligible patients with CAD who were referred to cardiac rehabilitation.',
                        'measure_type' => 'preventive',
                        'domain' => 'procedure',
                        'numerator_criteria' => [
                            'concept_ids' => [4143316, 4051924],
                            'lookback_days' => 365,
                            'table' => 'procedure_occurrence',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316139, 321318, 4329847],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                ],
            ],

            // ── 4. Heart Failure ─────────────────────────────────────────────
            [
                'bundle_code' => 'HF',
                'condition_name' => 'Heart Failure',
                'description' => 'Quality measures for heart failure management including medication optimization and monitoring.',
                'icd10_patterns' => ['I50%'],
                'omop_concept_ids' => [316139, 4229440],
                'ecqm_references' => ['CMS144v11', 'CMS145v11'],
                'disease_category' => 'Cardiovascular',
                'is_active' => true,
                'measures' => [
                    [
                        'measure_code' => 'HF-01',
                        'measure_name' => 'ACE Inhibitor or ARB Therapy',
                        'description' => 'Percentage of patients with heart failure (LVEF <40%) prescribed ACE inhibitor, ARB, or ARNI.',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [1308216, 1310756, 1335471, 1341927, 1363749],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316139, 4229440],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'HF-02',
                        'measure_name' => 'Beta-Blocker Therapy',
                        'description' => 'Percentage of patients with heart failure (LVEF <40%) prescribed evidence-based beta-blocker.',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [1314002, 1338005, 1353776],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316139, 4229440],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'HF-03',
                        'measure_name' => 'Blood Pressure Monitoring',
                        'description' => 'Percentage of patients with heart failure who had blood pressure monitoring during the measurement period.',
                        'measure_type' => 'chronic',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3004249, 3012888],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316139, 4229440],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'every_visit',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'HF-04',
                        'measure_name' => 'BNP/NT-proBNP Monitoring',
                        'description' => 'Percentage of patients with heart failure who had BNP or NT-proBNP testing during the measurement period.',
                        'measure_type' => 'chronic',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3035452, 3029435],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316139, 4229440],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'HF-05',
                        'measure_name' => 'Diuretic Therapy',
                        'description' => 'Percentage of patients with heart failure and fluid overload symptoms prescribed diuretic therapy.',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [932745, 956874, 942350],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316139, 4229440],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'HF-06',
                        'measure_name' => 'Renal Function Monitoring',
                        'description' => 'Percentage of patients with heart failure who had renal function testing (creatinine/eGFR) during the measurement period.',
                        'measure_type' => 'preventive',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3016723, 3049187, 3053283],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [316139, 4229440],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                ],
            ],

            // ── 5. COPD ─────────────────────────────────────────────────────
            [
                'bundle_code' => 'COPD',
                'condition_name' => 'Chronic Obstructive Pulmonary Disease',
                'description' => 'Quality measures for COPD management including pulmonary function testing, medication use, and preventive care.',
                'icd10_patterns' => ['J44%', 'J43%'],
                'omop_concept_ids' => [255573, 4063381],
                'ecqm_references' => ['CMS165v11'],
                'disease_category' => 'Respiratory',
                'is_active' => true,
                'measures' => [
                    [
                        'measure_code' => 'COPD-01',
                        'measure_name' => 'Spirometry Testing',
                        'description' => 'Percentage of patients with COPD who had spirometry testing to confirm diagnosis and assess severity.',
                        'measure_type' => 'chronic',
                        'domain' => 'procedure',
                        'numerator_criteria' => [
                            'concept_ids' => [4052536, 4265394],
                            'lookback_days' => 365,
                            'table' => 'procedure_occurrence',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [255573, 4063381],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'COPD-02',
                        'measure_name' => 'Bronchodilator Therapy',
                        'description' => 'Percentage of patients with COPD who are prescribed bronchodilator therapy (LABA, LAMA, or combination).',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [1196878, 1154343, 1106270],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [255573, 4063381],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'COPD-03',
                        'measure_name' => 'Influenza Vaccination',
                        'description' => 'Percentage of patients with COPD who received influenza vaccination during the measurement period.',
                        'measure_type' => 'preventive',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [40213160, 40213154],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [255573, 4063381],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'COPD-04',
                        'measure_name' => 'Pneumococcal Vaccination',
                        'description' => 'Percentage of patients with COPD who received pneumococcal vaccination.',
                        'measure_type' => 'preventive',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [40213152, 40213186],
                            'lookback_days' => 1825,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [255573, 4063381],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'COPD-05',
                        'measure_name' => 'Smoking Cessation Counseling',
                        'description' => 'Percentage of patients with COPD who are current smokers and received smoking cessation counseling or pharmacotherapy.',
                        'measure_type' => 'behavioral',
                        'domain' => 'procedure',
                        'numerator_criteria' => [
                            'concept_ids' => [4054933, 4218106],
                            'lookback_days' => 365,
                            'table' => 'procedure_occurrence',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [255573, 4063381],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                ],
            ],

            // ── 6. Asthma ───────────────────────────────────────────────────
            [
                'bundle_code' => 'ASTH',
                'condition_name' => 'Asthma',
                'description' => 'Quality measures for asthma management focusing on controller medication use and rescue inhaler frequency.',
                'icd10_patterns' => ['J45%'],
                'omop_concept_ids' => [317009, 4051466],
                'ecqm_references' => ['CMS126v11'],
                'disease_category' => 'Respiratory',
                'is_active' => true,
                'measures' => [
                    [
                        'measure_code' => 'ASTH-01',
                        'measure_name' => 'Controller Medication Prescribed',
                        'description' => 'Percentage of patients with persistent asthma who are prescribed a controller medication (ICS, ICS/LABA).',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [1196878, 1154343, 975125],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [317009, 4051466],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'ASTH-02',
                        'measure_name' => 'Asthma Action Plan',
                        'description' => 'Percentage of patients with asthma who have a documented asthma action plan.',
                        'measure_type' => 'behavioral',
                        'domain' => 'procedure',
                        'numerator_criteria' => [
                            'concept_ids' => [4058949, 4219681],
                            'lookback_days' => 365,
                            'table' => 'procedure_occurrence',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [317009, 4051466],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'ASTH-03',
                        'measure_name' => 'Spirometry Assessment',
                        'description' => 'Percentage of patients with asthma who had spirometry assessment during the measurement period.',
                        'measure_type' => 'chronic',
                        'domain' => 'procedure',
                        'numerator_criteria' => [
                            'concept_ids' => [4052536, 4265394],
                            'lookback_days' => 365,
                            'table' => 'procedure_occurrence',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [317009, 4051466],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'ASTH-04',
                        'measure_name' => 'Tobacco Use Screening',
                        'description' => 'Percentage of patients with asthma who were screened for tobacco use and received cessation intervention if identified.',
                        'measure_type' => 'preventive',
                        'domain' => 'observation',
                        'numerator_criteria' => [
                            'concept_ids' => [4052536, 4218106],
                            'lookback_days' => 365,
                            'table' => 'observation',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [317009, 4051466],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                ],
            ],

            // ── 7. Major Depressive Disorder ─────────────────────────────────
            [
                'bundle_code' => 'MDD',
                'condition_name' => 'Major Depressive Disorder',
                'description' => 'Quality measures for major depressive disorder management including screening, treatment response, and remission.',
                'icd10_patterns' => ['F32%', 'F33%'],
                'omop_concept_ids' => [440383, 4152280],
                'ecqm_references' => ['CMS159v11'],
                'disease_category' => 'Behavioral Health',
                'is_active' => true,
                'measures' => [
                    [
                        'measure_code' => 'MDD-01',
                        'measure_name' => 'Depression Screening (PHQ-9)',
                        'description' => 'Percentage of patients with MDD who had a PHQ-9 or equivalent depression screening assessment.',
                        'measure_type' => 'chronic',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [40758583, 4196147],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [440383, 4152280],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'MDD-02',
                        'measure_name' => 'Antidepressant Medication Management (Acute Phase)',
                        'description' => 'Percentage of patients with new MDD diagnosis who remained on antidepressant therapy for at least 84 days.',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [739138, 750982, 755695, 797617, 1110410],
                            'lookback_days' => 84,
                            'min_days_supply' => 84,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [440383, 4152280],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'MDD-03',
                        'measure_name' => 'Antidepressant Medication Management (Continuation Phase)',
                        'description' => 'Percentage of patients with MDD who remained on antidepressant therapy for at least 180 days.',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [739138, 750982, 755695, 797617, 1110410],
                            'lookback_days' => 180,
                            'min_days_supply' => 180,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [440383, 4152280],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'MDD-04',
                        'measure_name' => 'Follow-up After New Diagnosis',
                        'description' => 'Percentage of patients with new MDD diagnosis who had a follow-up visit within 30 days.',
                        'measure_type' => 'preventive',
                        'domain' => 'procedure',
                        'numerator_criteria' => [
                            'concept_ids' => [4143316, 4146284],
                            'lookback_days' => 30,
                            'table' => 'procedure_occurrence',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [440383, 4152280],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'MDD-05',
                        'measure_name' => 'Suicide Risk Assessment',
                        'description' => 'Percentage of patients with MDD who had a suicide risk assessment documented during the measurement period.',
                        'measure_type' => 'preventive',
                        'domain' => 'observation',
                        'numerator_criteria' => [
                            'concept_ids' => [4219336],
                            'lookback_days' => 365,
                            'table' => 'observation',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [440383, 4152280],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                ],
            ],

            // ── 8. Chronic Kidney Disease ────────────────────────────────────
            [
                'bundle_code' => 'CKD',
                'condition_name' => 'Chronic Kidney Disease',
                'description' => 'Quality measures for chronic kidney disease management including renal function monitoring and cardiovascular risk management.',
                'icd10_patterns' => ['N18%'],
                'omop_concept_ids' => [46271022, 443611],
                'ecqm_references' => ['CMS951v1'],
                'disease_category' => 'Renal',
                'is_active' => true,
                'measures' => [
                    [
                        'measure_code' => 'CKD-01',
                        'measure_name' => 'eGFR Monitoring',
                        'description' => 'Percentage of patients with CKD who had eGFR testing within the measurement period.',
                        'measure_type' => 'chronic',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3049187, 3053283],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [46271022, 443611],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'CKD-02',
                        'measure_name' => 'Urine Albumin-to-Creatinine Ratio',
                        'description' => 'Percentage of patients with CKD who had urine albumin-to-creatinine ratio (UACR) testing.',
                        'measure_type' => 'chronic',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3006923, 3013682],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [46271022, 443611],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'CKD-03',
                        'measure_name' => 'Blood Pressure Control (<130/80)',
                        'description' => 'Percentage of patients with CKD whose blood pressure was controlled to <130/80 mmHg.',
                        'measure_type' => 'chronic',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3004249, 3012888],
                            'lookback_days' => 365,
                            'systolic_threshold' => 130,
                            'diastolic_threshold' => 80,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [46271022, 443611],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'every_visit',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'CKD-04',
                        'measure_name' => 'ACE Inhibitor or ARB Therapy',
                        'description' => 'Percentage of patients with CKD and proteinuria who are prescribed ACE inhibitor or ARB therapy.',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [1308216, 1310756, 1335471, 1341927],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [46271022, 443611],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'CKD-05',
                        'measure_name' => 'Hemoglobin Monitoring',
                        'description' => 'Percentage of patients with CKD stage 3-5 who had hemoglobin testing for anemia evaluation.',
                        'measure_type' => 'preventive',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3000963, 3006239],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [46271022, 443611],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'CKD-06',
                        'measure_name' => 'Nephrology Referral',
                        'description' => 'Percentage of patients with CKD stage 4-5 who were referred to nephrology.',
                        'measure_type' => 'preventive',
                        'domain' => 'procedure',
                        'numerator_criteria' => [
                            'concept_ids' => [4143316, 4146284],
                            'lookback_days' => 365,
                            'table' => 'procedure_occurrence',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [46271022, 443611],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                ],
            ],

            // ── 9. Atrial Fibrillation ───────────────────────────────────────
            [
                'bundle_code' => 'AFIB',
                'condition_name' => 'Atrial Fibrillation',
                'description' => 'Quality measures for atrial fibrillation management including anticoagulation and rate/rhythm control.',
                'icd10_patterns' => ['I48%'],
                'omop_concept_ids' => [313217, 4141360],
                'ecqm_references' => ['CMS104v11'],
                'disease_category' => 'Cardiovascular',
                'is_active' => true,
                'measures' => [
                    [
                        'measure_code' => 'AFIB-01',
                        'measure_name' => 'Anticoagulation Therapy',
                        'description' => 'Percentage of patients with atrial fibrillation and CHA2DS2-VASc >= 2 who are prescribed oral anticoagulation.',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [1310149, 40228152, 40241331, 43013024],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [313217, 4141360],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'AFIB-02',
                        'measure_name' => 'Rate or Rhythm Control',
                        'description' => 'Percentage of patients with atrial fibrillation who are receiving rate or rhythm control therapy.',
                        'measure_type' => 'chronic',
                        'domain' => 'drug',
                        'numerator_criteria' => [
                            'concept_ids' => [1314002, 1338005, 1307046, 1309799],
                            'lookback_days' => 365,
                            'table' => 'drug_exposure',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [313217, 4141360],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'AFIB-03',
                        'measure_name' => 'Echocardiogram',
                        'description' => 'Percentage of patients with atrial fibrillation who had an echocardiogram for structural assessment.',
                        'measure_type' => 'preventive',
                        'domain' => 'procedure',
                        'numerator_criteria' => [
                            'concept_ids' => [4063934, 4168194],
                            'lookback_days' => 365,
                            'table' => 'procedure_occurrence',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [313217, 4141360],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'AFIB-04',
                        'measure_name' => 'Thyroid Function Testing',
                        'description' => 'Percentage of patients with new atrial fibrillation who had thyroid function testing (TSH).',
                        'measure_type' => 'preventive',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3016502, 3019170],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [313217, 4141360],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'AFIB-05',
                        'measure_name' => 'Renal Function and CBC Monitoring',
                        'description' => 'Percentage of patients on anticoagulation who had renal function and CBC monitoring.',
                        'measure_type' => 'preventive',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3016723, 3000963, 3010813],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [313217, 4141360],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                ],
            ],

            // ── 10. Obesity ─────────────────────────────────────────────────
            [
                'bundle_code' => 'OB',
                'condition_name' => 'Obesity',
                'description' => 'Quality measures for obesity management including BMI screening, lifestyle counseling, and comorbidity screening.',
                'icd10_patterns' => ['E66%'],
                'omop_concept_ids' => [433736, 4215968],
                'ecqm_references' => ['CMS69v11'],
                'disease_category' => 'Metabolic',
                'is_active' => true,
                'measures' => [
                    [
                        'measure_code' => 'OB-01',
                        'measure_name' => 'BMI Screening and Follow-up',
                        'description' => 'Percentage of patients with obesity who had BMI documented and follow-up plan during the measurement period.',
                        'measure_type' => 'preventive',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3038553, 3036277],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [433736, 4215968],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'OB-02',
                        'measure_name' => 'Nutritional Counseling',
                        'description' => 'Percentage of patients with obesity who received nutritional counseling or dietitian referral.',
                        'measure_type' => 'behavioral',
                        'domain' => 'procedure',
                        'numerator_criteria' => [
                            'concept_ids' => [4054933, 4218106],
                            'lookback_days' => 365,
                            'table' => 'procedure_occurrence',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [433736, 4215968],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'OB-03',
                        'measure_name' => 'Diabetes Screening',
                        'description' => 'Percentage of patients with obesity who had diabetes screening (fasting glucose or HbA1c) within the measurement period.',
                        'measure_type' => 'preventive',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3004410, 3004501],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [433736, 4215968],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                    [
                        'measure_code' => 'OB-04',
                        'measure_name' => 'Lipid Panel Screening',
                        'description' => 'Percentage of patients with obesity who had lipid panel testing within the measurement period.',
                        'measure_type' => 'preventive',
                        'domain' => 'measurement',
                        'numerator_criteria' => [
                            'concept_ids' => [3027114, 3028437, 3019900, 3007070],
                            'lookback_days' => 365,
                            'table' => 'measurement',
                        ],
                        'denominator_criteria' => [
                            'condition_concept_ids' => [433736, 4215968],
                        ],
                        'exclusion_criteria' => null,
                        'frequency' => 'annually',
                        'is_active' => true,
                    ],
                ],
            ],
        ];
    }

    private function seedOverlapRules(): void
    {
        $rules = [
            [
                'rule_code' => 'DEDUP_BP_CONTROL',
                'shared_domain' => 'Blood Pressure Control',
                'applicable_bundle_codes' => ['HTN', 'DM', 'CAD', 'HF'],
                'canonical_measure_code' => 'HTN-01',
                'description' => 'Blood pressure control measures shared across HTN, DM, CAD, and HF. HTN-01 is canonical; DM-05, CAD-03, HF-03 are deduplicated.',
                'is_active' => true,
            ],
            [
                'rule_code' => 'DEDUP_LIPID_MGMT',
                'shared_domain' => 'Lipid Management',
                'applicable_bundle_codes' => ['DM', 'CAD'],
                'canonical_measure_code' => 'CAD-02',
                'description' => 'Statin therapy measures shared across DM and CAD. CAD-02 is canonical; DM-06 is deduplicated.',
                'is_active' => true,
            ],
            [
                'rule_code' => 'DEDUP_RENAL',
                'shared_domain' => 'Renal Function Monitoring',
                'applicable_bundle_codes' => ['DM', 'CKD', 'HF'],
                'canonical_measure_code' => 'CKD-01',
                'description' => 'Renal function monitoring shared across DM, CKD, and HF. CKD-01 is canonical; DM-04, HF-06 are deduplicated.',
                'is_active' => true,
            ],
        ];

        foreach ($rules as $ruleDef) {
            BundleOverlapRule::firstOrCreate(
                ['rule_code' => $ruleDef['rule_code']],
                $ruleDef,
            );
        }
    }
}
