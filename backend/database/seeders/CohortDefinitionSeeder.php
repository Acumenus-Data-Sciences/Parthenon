<?php

namespace Database\Seeders;

use App\Models\App\CohortDefinition;
use App\Models\User;
use Illuminate\Database\Seeder;

class CohortDefinitionSeeder extends Seeder
{
    /**
     * Seed 5 sample cohort definitions with realistic OHDSI expressions.
     * Concept IDs sourced from ConditionBundleSeeder.
     */
    public function run(): void
    {
        $adminId = User::where('email', 'admin@parthenon.local')->value('id');
        if (! $adminId) {
            $this->command->warn('Admin user not found — skipping cohort definition seeding.');

            return;
        }

        foreach ($this->getCohortDefinitions($adminId) as $def) {
            CohortDefinition::firstOrCreate(
                ['name' => $def['name']],
                $def,
            );
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function getCohortDefinitions(int $adminId): array
    {
        return [
            // ── 1. Type 2 Diabetes Mellitus ──────────────────────────────────
            [
                'name' => 'Type 2 Diabetes Mellitus',
                'description' => 'Patients with at least one diagnosis of Type 2 Diabetes (including descendants) and a prior 365-day observation window. Includes HbA1c testing as additional criteria.',
                'author_id' => $adminId,
                'is_public' => true,
                'version' => 1,
                'tags' => ['diabetes', 'endocrine', 'sample'],
                'expression_json' => [
                    'ConceptSets' => [
                        [
                            'id' => 0,
                            'name' => 'Type 2 Diabetes Conditions',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(201826, 'Type 2 diabetes mellitus', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                    $this->conceptItem(443238, 'Diabetes mellitus type 2 without complication', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                    $this->conceptItem(4193704, 'Type 2 diabetes mellitus uncontrolled', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                ],
                            ],
                        ],
                        [
                            'id' => 1,
                            'name' => 'HbA1c Lab Tests',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(3004410, 'Hemoglobin A1c/Hemoglobin.total in Blood', 'Measurement', 'LOINC', 'Lab Test', 'S'),
                                    $this->conceptItem(3034639, 'Hemoglobin A1c in Blood by HPLC', 'Measurement', 'LOINC', 'Lab Test', 'S'),
                                    $this->conceptItem(40758583, 'Hemoglobin A1c in Blood by calculation', 'Measurement', 'LOINC', 'Lab Test', 'S'),
                                ],
                            ],
                        ],
                    ],
                    'PrimaryCriteria' => [
                        'CriteriaList' => [
                            ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
                        ],
                        'ObservationWindow' => ['PriorDays' => 365, 'PostDays' => 0],
                    ],
                    'AdditionalCriteria' => [
                        'Type' => 'ALL',
                        'CriteriaList' => [
                            [
                                'Criteria' => ['Measurement' => ['CodesetId' => 1]],
                                'StartWindow' => [
                                    'Start' => ['Days' => 365, 'Coeff' => -1],
                                    'End' => ['Days' => 0, 'Coeff' => 1],
                                ],
                                'Occurrence' => ['Type' => 2, 'Count' => 1],
                            ],
                        ],
                        'Groups' => [],
                    ],
                    'QualifiedLimit' => ['Type' => 'First'],
                    'ExpressionLimit' => ['Type' => 'First'],
                    'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 0],
                ],
            ],

            // ── 2. Essential Hypertension ────────────────────────────────────
            [
                'name' => 'Essential Hypertension with Antihypertensive Therapy',
                'description' => 'Patients diagnosed with essential hypertension who are receiving antihypertensive medication therapy within 365 days of diagnosis.',
                'author_id' => $adminId,
                'is_public' => true,
                'version' => 1,
                'tags' => ['hypertension', 'cardiovascular', 'sample'],
                'expression_json' => [
                    'ConceptSets' => [
                        [
                            'id' => 0,
                            'name' => 'Hypertension Conditions',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(316866, 'Hypertensive disorder', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                    $this->conceptItem(4028741, 'Essential hypertension', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                ],
                            ],
                        ],
                        [
                            'id' => 1,
                            'name' => 'Antihypertensive Medications',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(1308216, 'Lisinopril', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(1310756, 'Losartan', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(1313200, 'Metoprolol', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(1314002, 'Amlodipine', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(1317640, 'Hydrochlorothiazide', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(1341927, 'Valsartan', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(1353776, 'Ramipril', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                ],
                            ],
                        ],
                    ],
                    'PrimaryCriteria' => [
                        'CriteriaList' => [
                            ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
                        ],
                        'ObservationWindow' => ['PriorDays' => 365, 'PostDays' => 0],
                    ],
                    'AdditionalCriteria' => [
                        'Type' => 'ALL',
                        'CriteriaList' => [
                            [
                                'Criteria' => ['DrugExposure' => ['CodesetId' => 1]],
                                'StartWindow' => [
                                    'Start' => ['Days' => 0, 'Coeff' => -1],
                                    'End' => ['Days' => 365, 'Coeff' => 1],
                                ],
                                'Occurrence' => ['Type' => 2, 'Count' => 1],
                            ],
                        ],
                        'Groups' => [],
                    ],
                    'QualifiedLimit' => ['Type' => 'First'],
                    'ExpressionLimit' => ['Type' => 'First'],
                    'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 0],
                ],
            ],

            // ── 3. Coronary Artery Disease with Statin Therapy ───────────────
            [
                'name' => 'Coronary Artery Disease with Statin Therapy',
                'description' => 'Patients with coronary artery disease or angina who receive statin therapy for secondary prevention of cardiovascular events.',
                'author_id' => $adminId,
                'is_public' => true,
                'version' => 1,
                'tags' => ['cad', 'cardiovascular', 'sample'],
                'expression_json' => [
                    'ConceptSets' => [
                        [
                            'id' => 0,
                            'name' => 'CAD Conditions',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(316139, 'Heart failure', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                    $this->conceptItem(321318, 'Angina pectoris', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                    $this->conceptItem(4329847, 'Myocardial infarction', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                ],
                            ],
                        ],
                        [
                            'id' => 1,
                            'name' => 'Statin Medications',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(1510813, 'Atorvastatin', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(1549686, 'Rosuvastatin', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(1551860, 'Simvastatin', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(1545958, 'Pravastatin', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                ],
                            ],
                        ],
                    ],
                    'PrimaryCriteria' => [
                        'CriteriaList' => [
                            ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
                        ],
                        'ObservationWindow' => ['PriorDays' => 365, 'PostDays' => 0],
                    ],
                    'AdditionalCriteria' => [
                        'Type' => 'ALL',
                        'CriteriaList' => [
                            [
                                'Criteria' => ['DrugExposure' => ['CodesetId' => 1]],
                                'StartWindow' => [
                                    'Start' => ['Days' => 0, 'Coeff' => -1],
                                    'End' => ['Days' => 365, 'Coeff' => 1],
                                ],
                                'Occurrence' => ['Type' => 2, 'Count' => 1],
                            ],
                        ],
                        'Groups' => [],
                    ],
                    'QualifiedLimit' => ['Type' => 'First'],
                    'ExpressionLimit' => ['Type' => 'First'],
                    'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 0],
                ],
            ],

            // ── 4. Heart Failure with BNP Monitoring ─────────────────────────
            [
                'name' => 'Heart Failure with BNP Monitoring',
                'description' => 'Patients with heart failure who have BNP or NT-proBNP biomarker monitoring within 365 days, indicating active disease management.',
                'author_id' => $adminId,
                'is_public' => true,
                'version' => 1,
                'tags' => ['heart-failure', 'cardiovascular', 'sample'],
                'expression_json' => [
                    'ConceptSets' => [
                        [
                            'id' => 0,
                            'name' => 'Heart Failure Conditions',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(316139, 'Heart failure', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                    $this->conceptItem(4229440, 'Congestive heart failure', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                ],
                            ],
                        ],
                        [
                            'id' => 1,
                            'name' => 'BNP/NT-proBNP Lab Tests',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(3035452, 'Natriuretic peptide B [Mass/volume] in Blood', 'Measurement', 'LOINC', 'Lab Test', 'S'),
                                    $this->conceptItem(3029435, 'N-terminal proBNP [Mass/volume] in Serum or Plasma', 'Measurement', 'LOINC', 'Lab Test', 'S'),
                                ],
                            ],
                        ],
                        [
                            'id' => 2,
                            'name' => 'Heart Failure Medications',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(1308216, 'Lisinopril', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(1310756, 'Losartan', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(1314002, 'Amlodipine', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(1338005, 'Carvedilol', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(932745, 'Furosemide', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                ],
                            ],
                        ],
                    ],
                    'PrimaryCriteria' => [
                        'CriteriaList' => [
                            ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
                        ],
                        'ObservationWindow' => ['PriorDays' => 365, 'PostDays' => 0],
                    ],
                    'AdditionalCriteria' => [
                        'Type' => 'ALL',
                        'CriteriaList' => [
                            [
                                'Criteria' => ['Measurement' => ['CodesetId' => 1]],
                                'StartWindow' => [
                                    'Start' => ['Days' => 365, 'Coeff' => -1],
                                    'End' => ['Days' => 365, 'Coeff' => 1],
                                ],
                                'Occurrence' => ['Type' => 2, 'Count' => 1],
                            ],
                        ],
                        'Groups' => [],
                    ],
                    'QualifiedLimit' => ['Type' => 'First'],
                    'ExpressionLimit' => ['Type' => 'First'],
                    'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 0],
                ],
            ],

            // ── 5. Chronic Kidney Disease Stage 3-5 ──────────────────────────
            [
                'name' => 'Chronic Kidney Disease Stage 3-5 with eGFR Monitoring',
                'description' => 'Patients with CKD stages 3-5 who have eGFR laboratory monitoring, representing patients with significant renal impairment under active surveillance.',
                'author_id' => $adminId,
                'is_public' => true,
                'version' => 1,
                'tags' => ['ckd', 'renal', 'sample'],
                'expression_json' => [
                    'ConceptSets' => [
                        [
                            'id' => 0,
                            'name' => 'CKD Conditions',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(46271022, 'Chronic kidney disease', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                    $this->conceptItem(443611, 'Chronic kidney disease stage 3', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                ],
                            ],
                        ],
                        [
                            'id' => 1,
                            'name' => 'eGFR Lab Tests',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(3049187, 'Glomerular filtration rate/1.73 sq M.predicted', 'Measurement', 'LOINC', 'Lab Test', 'S'),
                                    $this->conceptItem(3053283, 'Glomerular filtration rate/1.73 sq M.predicted by Creatinine-based formula', 'Measurement', 'LOINC', 'Lab Test', 'S'),
                                ],
                            ],
                        ],
                        [
                            'id' => 2,
                            'name' => 'Urine Protein Tests',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(3006923, 'Albumin [Mass/volume] in Urine', 'Measurement', 'LOINC', 'Lab Test', 'S'),
                                    $this->conceptItem(3013682, 'Albumin/Creatinine [Ratio] in Urine', 'Measurement', 'LOINC', 'Lab Test', 'S'),
                                ],
                            ],
                        ],
                    ],
                    'PrimaryCriteria' => [
                        'CriteriaList' => [
                            ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
                        ],
                        'ObservationWindow' => ['PriorDays' => 365, 'PostDays' => 0],
                    ],
                    'AdditionalCriteria' => [
                        'Type' => 'ALL',
                        'CriteriaList' => [
                            [
                                'Criteria' => ['Measurement' => ['CodesetId' => 1]],
                                'StartWindow' => [
                                    'Start' => ['Days' => 365, 'Coeff' => -1],
                                    'End' => ['Days' => 365, 'Coeff' => 1],
                                ],
                                'Occurrence' => ['Type' => 2, 'Count' => 1],
                            ],
                        ],
                        'Groups' => [],
                    ],
                    'QualifiedLimit' => ['Type' => 'First'],
                    'ExpressionLimit' => ['Type' => 'First'],
                    'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 0],
                ],
            ],
        ];
    }

    /**
     * Build a concept set expression item with standard flags.
     *
     * @return array<string, mixed>
     */
    private function conceptItem(
        int $conceptId,
        string $name,
        string $domain,
        string $vocabulary,
        string $conceptClass,
        string $standard,
    ): array {
        return [
            'concept' => [
                'CONCEPT_ID' => $conceptId,
                'CONCEPT_NAME' => $name,
                'DOMAIN_ID' => $domain,
                'VOCABULARY_ID' => $vocabulary,
                'CONCEPT_CLASS_ID' => $conceptClass,
                'STANDARD_CONCEPT' => $standard,
                'CONCEPT_CODE' => '',
            ],
            'isExcluded' => false,
            'includeDescendants' => true,
            'includeMapped' => false,
        ];
    }
}
