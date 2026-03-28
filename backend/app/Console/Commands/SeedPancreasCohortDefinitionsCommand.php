<?php

namespace App\Console\Commands;

use App\Enums\ExecutionStatus;
use App\Models\App\CohortDefinition;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Seed 4 pancreatic cancer cohort definitions and pre-generate membership
 * from the pancreas schema OMOP CDM data (189 CPTAC-PDA/TCGA-PAAD patients).
 *
 * Usage: php artisan pancreas:seed-cohorts
 *
 * Idempotent: uses updateOrCreate on name, clears and repopulates cohort membership.
 * Source ID 58 = Pancreatic Cancer Corpus CDM source.
 */
class SeedPancreasCohortDefinitionsCommand extends Command
{
    protected $signature = 'pancreas:seed-cohorts';

    protected $description = 'Seed 4 pancreatic cancer cohort definitions with pre-generated membership';

    private const SOURCE_ID = 58;

    public function handle(): int
    {
        $adminId = User::where('email', 'admin@acumenus.net')->value('id');

        if (! $adminId) {
            $this->error('Admin user not found (admin@acumenus.net) — cannot seed cohort definitions.');

            return self::FAILURE;
        }

        foreach ($this->getCohortDefinitions($adminId) as $def) {
            /** @var CohortDefinition $cohort */
            $cohort = CohortDefinition::updateOrCreate(
                ['name' => $def['name']],
                $def,
            );

            $cohortId = $cohort->id;

            // Clear existing membership for this definition before repopulating.
            DB::connection('pancreas')->statement(
                'DELETE FROM pancreas_results.cohort WHERE cohort_definition_id = ?',
                [$cohortId],
            );

            // Insert membership via the pre-generation SQL for this cohort.
            DB::connection('pancreas')->statement(
                $this->getMembershipSql($cohortId, $def['_membership_key']),
            );

            $count = DB::connection('pancreas')
                ->table('pancreas_results.cohort')
                ->where('cohort_definition_id', $cohortId)
                ->count();

            $cohort->generations()->updateOrCreate(
                ['source_id' => self::SOURCE_ID],
                [
                    'status' => ExecutionStatus::Completed,
                    'started_at' => now(),
                    'completed_at' => now(),
                    'person_count' => $count,
                ],
            );

            $verb = $cohort->wasRecentlyCreated ? 'Created' : 'Updated';
            $this->info("{$verb}: {$cohort->name} — {$count} subjects");
        }

        return self::SUCCESS;
    }

    /**
     * Return the INSERT SQL for a given cohort membership key.
     * Each query selects from the pancreas schema using the cohort_definition_id placeholder.
     */
    private function getMembershipSql(int $cohortId, string $key): string
    {
        return match ($key) {
            'all_pdac' => "
                INSERT INTO pancreas_results.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
                SELECT DISTINCT
                    {$cohortId},
                    co.person_id,
                    MIN(co.condition_start_date) OVER (PARTITION BY co.person_id) AS cohort_start_date,
                    COALESCE(
                        MAX(co.condition_end_date)   OVER (PARTITION BY co.person_id),
                        MIN(co.condition_start_date) OVER (PARTITION BY co.person_id)
                    ) AS cohort_end_date
                FROM pancreas.condition_occurrence co
                WHERE co.condition_concept_id = 4180793
            ",

            'surgical_pdac' => "
                INSERT INTO pancreas_results.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
                SELECT DISTINCT
                    {$cohortId},
                    co.person_id,
                    MIN(co.condition_start_date) OVER (PARTITION BY co.person_id) AS cohort_start_date,
                    COALESCE(
                        MAX(co.condition_end_date)   OVER (PARTITION BY co.person_id),
                        MIN(co.condition_start_date) OVER (PARTITION BY co.person_id)
                    ) AS cohort_end_date
                FROM pancreas.condition_occurrence co
                WHERE co.condition_concept_id = 4180793
                  AND EXISTS (
                      SELECT 1
                      FROM pancreas.procedure_occurrence po
                      WHERE po.person_id = co.person_id
                        AND po.procedure_concept_id IN (4020329, 4144850)
                  )
            ",

            'folfirinox' => "
                INSERT INTO pancreas_results.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
                WITH first_pdac AS (
                    SELECT person_id, MIN(condition_start_date) AS dx_date
                    FROM pancreas.condition_occurrence
                    WHERE condition_concept_id = 4180793
                    GROUP BY person_id
                ),
                drug_flags AS (
                    SELECT
                        fp.person_id,
                        fp.dx_date,
                        MAX(CASE WHEN de.drug_concept_id = 955632  THEN 1 ELSE 0 END) AS has_5fu,
                        MAX(CASE WHEN de.drug_concept_id = 1318011 THEN 1 ELSE 0 END) AS has_oxali,
                        MAX(CASE WHEN de.drug_concept_id = 1367268 THEN 1 ELSE 0 END) AS has_irino
                    FROM first_pdac fp
                    JOIN pancreas.drug_exposure de
                        ON  fp.person_id = de.person_id
                        AND de.drug_exposure_start_date
                            BETWEEN fp.dx_date AND fp.dx_date + INTERVAL '90 days'
                    WHERE de.drug_concept_id IN (955632, 1318011, 1367268)
                    GROUP BY fp.person_id, fp.dx_date
                )
                SELECT
                    {$cohortId},
                    person_id,
                    dx_date AS cohort_start_date,
                    dx_date AS cohort_end_date
                FROM drug_flags
                WHERE has_5fu = 1 AND has_oxali = 1 AND has_irino = 1
            ",

            'high_ca199' => "
                INSERT INTO pancreas_results.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
                WITH first_pdac AS (
                    SELECT person_id, MIN(condition_start_date) AS dx_date
                    FROM pancreas.condition_occurrence
                    WHERE condition_concept_id = 4180793
                    GROUP BY person_id
                )
                SELECT DISTINCT
                    {$cohortId},
                    fp.person_id,
                    fp.dx_date      AS cohort_start_date,
                    fp.dx_date      AS cohort_end_date
                FROM first_pdac fp
                JOIN pancreas.measurement m
                    ON  fp.person_id = m.person_id
                    AND m.measurement_concept_id = 3022914
                    AND m.measurement_date
                        BETWEEN fp.dx_date AND fp.dx_date + INTERVAL '30 days'
                    AND m.value_as_number > 37
            ",

            'kras_mutant' => "
                INSERT INTO pancreas_results.cohort (cohort_definition_id, subject_id, cohort_start_date, cohort_end_date)
                SELECT DISTINCT
                    {$cohortId},
                    co.person_id,
                    MIN(co.condition_start_date) OVER (PARTITION BY co.person_id),
                    COALESCE(
                        MAX(co.condition_end_date) OVER (PARTITION BY co.person_id),
                        MIN(co.condition_start_date) OVER (PARTITION BY co.person_id) + INTERVAL '365 days'
                    )
                FROM pancreas.condition_occurrence co
                JOIN pancreas.measurement m
                    ON  co.person_id = m.person_id
                    AND m.measurement_concept_id = 3012200
                    AND m.value_as_concept_id = 4181412
                WHERE co.condition_concept_id = 4180793
            ",

            default => throw new \InvalidArgumentException("Unknown membership key: {$key}"),
        };
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function getCohortDefinitions(int $adminId): array
    {
        return [
            // ── 1. All PDAC Patients ──────────────────────────────────────────
            [
                'name' => 'All PDAC Patients',
                'description' => 'All patients with a diagnosis of malignant tumor of pancreas (SNOMED 4180793). Serves as the base cohort for all pancreatic cancer sub-analyses in the multimodal corpus.',
                'author_id' => $adminId,
                'is_public' => true,
                'version' => 1,
                'tags' => ['pancreatic-cancer', 'pdac', 'corpus'],
                '_membership_key' => 'all_pdac',
                'expression_json' => [
                    'ConceptSets' => [
                        [
                            'id' => 0,
                            'name' => 'PDAC Condition',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(4180793, 'Malignant tumor of pancreas', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                ],
                            ],
                        ],
                    ],
                    'PrimaryCriteria' => [
                        'CriteriaList' => [
                            ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
                        ],
                        'ObservationWindow' => ['PriorDays' => 0, 'PostDays' => 0],
                    ],
                    'QualifiedLimit' => ['Type' => 'First'],
                    'ExpressionLimit' => ['Type' => 'First'],
                    'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 0],
                ],
            ],

            // ── 2. Resectable PDAC with Surgical Intervention ─────────────────
            [
                'name' => 'Resectable PDAC with Surgical Intervention',
                'description' => 'PDAC patients who underwent pancreaticoduodenectomy (Whipple, concept 4020329) or distal pancreatectomy (concept 4144850), representing the surgically resectable subset.',
                'author_id' => $adminId,
                'is_public' => true,
                'version' => 1,
                'tags' => ['pancreatic-cancer', 'pdac', 'surgical', 'resectable', 'corpus'],
                '_membership_key' => 'surgical_pdac',
                'expression_json' => [
                    'ConceptSets' => [
                        [
                            'id' => 0,
                            'name' => 'PDAC Condition',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(4180793, 'Malignant tumor of pancreas', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                ],
                            ],
                        ],
                        [
                            'id' => 1,
                            'name' => 'Pancreatic Resection Procedures',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(4020329, 'Pancreaticoduodenectomy', 'Procedure', 'SNOMED', 'Procedure', 'S'),
                                    $this->conceptItem(4144850, 'Distal pancreatectomy', 'Procedure', 'SNOMED', 'Procedure', 'S'),
                                ],
                            ],
                        ],
                    ],
                    'PrimaryCriteria' => [
                        'CriteriaList' => [
                            ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
                        ],
                        'ObservationWindow' => ['PriorDays' => 0, 'PostDays' => 0],
                    ],
                    'AdditionalCriteria' => [
                        'Type' => 'ALL',
                        'CriteriaList' => [
                            [
                                'Criteria' => ['ProcedureOccurrence' => ['CodesetId' => 1]],
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

            // ── 3. FOLFIRINOX Recipients ──────────────────────────────────────
            [
                'name' => 'FOLFIRINOX Recipients',
                'description' => 'PDAC patients who received all three FOLFIRINOX components — fluorouracil (955632), oxaliplatin (1318011), and irinotecan (1367268) — within 90 days of first PDAC diagnosis.',
                'author_id' => $adminId,
                'is_public' => true,
                'version' => 1,
                'tags' => ['pancreatic-cancer', 'pdac', 'folfirinox', 'chemotherapy', 'corpus'],
                '_membership_key' => 'folfirinox',
                'expression_json' => [
                    'ConceptSets' => [
                        [
                            'id' => 0,
                            'name' => 'PDAC Condition',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(4180793, 'Malignant tumor of pancreas', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                ],
                            ],
                        ],
                        [
                            'id' => 1,
                            'name' => 'FOLFIRINOX Components',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(955632, 'Fluorouracil', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(1318011, 'Oxaliplatin', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                    $this->conceptItem(1367268, 'Irinotecan', 'Drug', 'RxNorm', 'Ingredient', 'S'),
                                ],
                            ],
                        ],
                    ],
                    'PrimaryCriteria' => [
                        'CriteriaList' => [
                            ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
                        ],
                        'ObservationWindow' => ['PriorDays' => 0, 'PostDays' => 0],
                    ],
                    'AdditionalCriteria' => [
                        'Type' => 'ALL',
                        'CriteriaList' => [
                            [
                                'Criteria' => ['DrugExposure' => ['CodesetId' => 1]],
                                'StartWindow' => [
                                    'Start' => ['Days' => 0, 'Coeff' => 1],
                                    'End' => ['Days' => 90, 'Coeff' => 1],
                                ],
                                'Occurrence' => ['Type' => 2, 'Count' => 3],
                            ],
                        ],
                        'Groups' => [],
                    ],
                    'QualifiedLimit' => ['Type' => 'First'],
                    'ExpressionLimit' => ['Type' => 'First'],
                    'CollapseSettings' => ['CollapseType' => 'ERA', 'EraPad' => 0],
                ],
            ],

            // ── 4. High CA 19-9 at Diagnosis ─────────────────────────────────
            [
                'name' => 'High CA 19-9 at Diagnosis',
                'description' => 'PDAC patients with CA 19-9 (LOINC 3022914) greater than 37 U/mL measured within 30 days of initial diagnosis. Elevated CA 19-9 is associated with advanced disease and worse prognosis.',
                'author_id' => $adminId,
                'is_public' => true,
                'version' => 1,
                'tags' => ['pancreatic-cancer', 'pdac', 'ca19-9', 'biomarker', 'corpus'],
                '_membership_key' => 'high_ca199',
                'expression_json' => [
                    'ConceptSets' => [
                        [
                            'id' => 0,
                            'name' => 'PDAC Condition',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(4180793, 'Malignant tumor of pancreas', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                ],
                            ],
                        ],
                        [
                            'id' => 1,
                            'name' => 'CA 19-9 Measurement',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(3022914, 'CA 19-9 [Units/volume] in Serum or Plasma', 'Measurement', 'LOINC', 'Lab Test', 'S'),
                                ],
                            ],
                        ],
                    ],
                    'PrimaryCriteria' => [
                        'CriteriaList' => [
                            ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
                        ],
                        'ObservationWindow' => ['PriorDays' => 0, 'PostDays' => 0],
                    ],
                    'AdditionalCriteria' => [
                        'Type' => 'ALL',
                        'CriteriaList' => [
                            [
                                'Criteria' => [
                                    'Measurement' => [
                                        'CodesetId' => 1,
                                        'ValueAsNumber' => ['Value' => 37, 'Op' => 'gt'],
                                    ],
                                ],
                                'StartWindow' => [
                                    'Start' => ['Days' => 0, 'Coeff' => 1],
                                    'End' => ['Days' => 30, 'Coeff' => 1],
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

            // ── 5. KRAS Mutant PDAC ─────────────────────────────────────────
            [
                'name' => 'KRAS Mutant PDAC',
                'description' => 'PDAC patients with a detected KRAS somatic mutation (concept 3012200, value Present). KRAS is mutated in ~93% of pancreatic adenocarcinomas and is the hallmark oncogenic driver.',
                'author_id' => $adminId,
                'is_public' => true,
                'version' => 1,
                'tags' => ['pancreatic-cancer', 'pdac', 'kras', 'genomics', 'corpus'],
                '_membership_key' => 'kras_mutant',
                'expression_json' => [
                    'ConceptSets' => [
                        [
                            'id' => 0,
                            'name' => 'PDAC Condition',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(4180793, 'Malignant tumor of pancreas', 'Condition', 'SNOMED', 'Clinical Finding', 'S'),
                                ],
                            ],
                        ],
                        [
                            'id' => 1,
                            'name' => 'KRAS Mutation Analysis',
                            'expression' => [
                                'items' => [
                                    $this->conceptItem(3012200, 'KRAS gene mutations found [Identifier] in Blood or Tissue by Molecular genetics method', 'Measurement', 'LOINC', 'Lab Test', 'S'),
                                ],
                            ],
                        ],
                    ],
                    'PrimaryCriteria' => [
                        'CriteriaList' => [
                            ['ConditionOccurrence' => ['CodesetId' => 0, 'First' => true]],
                        ],
                        'ObservationWindow' => ['PriorDays' => 0, 'PostDays' => 0],
                    ],
                    'AdditionalCriteria' => [
                        'Type' => 'ALL',
                        'CriteriaList' => [
                            [
                                'Criteria' => [
                                    'Measurement' => [
                                        'CodesetId' => 1,
                                        'ValueAsConcept' => [['CONCEPT_ID' => 4181412, 'CONCEPT_NAME' => 'Present']],
                                    ],
                                ],
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
