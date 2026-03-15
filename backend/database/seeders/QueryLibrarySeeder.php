<?php

namespace Database\Seeders;

use App\Models\App\QueryLibraryEntry;
use Illuminate\Database\Seeder;

class QueryLibrarySeeder extends Seeder
{
    public function run(): void
    {
        if (QueryLibraryEntry::query()->exists()) {
            return;
        }

        foreach ($this->entries() as $entry) {
            QueryLibraryEntry::updateOrCreate(
                ['slug' => $entry['slug']],
                $entry,
            );
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function entries(): array
    {
        return [
            [
                'slug' => 'condition-prevalence-top-conditions',
                'name' => 'Top Conditions By Patient Count',
                'domain' => 'condition',
                'category' => 'prevalence',
                'summary' => 'Counts patients by condition concept and returns the highest-prevalence conditions.',
                'description' => 'A reusable prevalence query for common diagnosis discovery. It counts distinct patients by standard condition concept, joins to the OMOP vocabulary for labels, and returns the top concepts by patient count.',
                'sql_template' => <<<'SQL'
SELECT
  co.condition_concept_id,
  c.concept_name,
  COUNT(DISTINCT co.person_id) AS patient_count
FROM {@cdmSchema}.condition_occurrence co
JOIN {@cdmSchema}.concept c
  ON c.concept_id = co.condition_concept_id
WHERE co.condition_concept_id > 0
GROUP BY co.condition_concept_id, c.concept_name
ORDER BY patient_count DESC
LIMIT {@limit}
SQL,
                'parameters_json' => [
                    ['key' => 'cdmSchema', 'label' => 'CDM schema', 'type' => 'string', 'default' => 'omop', 'description' => 'Qualified OMOP schema name.'],
                    ['key' => 'limit', 'label' => 'Row limit', 'type' => 'number', 'default' => '10', 'description' => 'Maximum number of concepts returned.'],
                ],
                'tags_json' => ['condition', 'prevalence', 'top-n', 'omop'],
                'example_questions_json' => ['What are the top 10 conditions by prevalence?', 'Which diagnoses are most common in the CDM?'],
                'template_language' => 'ohdsi_sql',
                'is_aggregate' => true,
                'safety' => 'safe',
                'source' => 'ohdsi_inspired',
            ],
            [
                'slug' => 'drug-exposure-counts-by-ingredient',
                'name' => 'Drug Exposure Counts By Ingredient',
                'domain' => 'drug',
                'category' => 'utilization',
                'summary' => 'Counts distinct patients with exposure to a target ingredient concept and its descendants.',
                'description' => 'A reusable drug-utilization template that uses concept_ancestor expansion from a standard RxNorm ingredient concept to all descendant drug exposures.',
                'sql_template' => <<<'SQL'
SELECT
  de.drug_concept_id,
  c.concept_name,
  COUNT(DISTINCT de.person_id) AS patient_count
FROM {@cdmSchema}.drug_exposure de
JOIN {@cdmSchema}.concept_ancestor ca
  ON ca.descendant_concept_id = de.drug_concept_id
  AND ca.ancestor_concept_id = {@ingredientConceptId}
JOIN {@cdmSchema}.concept c
  ON c.concept_id = de.drug_concept_id
GROUP BY de.drug_concept_id, c.concept_name
ORDER BY patient_count DESC
LIMIT {@limit}
SQL,
                'parameters_json' => [
                    ['key' => 'cdmSchema', 'label' => 'CDM schema', 'type' => 'string', 'default' => 'omop', 'description' => 'Qualified OMOP schema name.'],
                    ['key' => 'ingredientConceptId', 'label' => 'Ingredient concept ID', 'type' => 'number', 'default' => '1503297', 'description' => 'Standard RxNorm ingredient concept, e.g. metformin.'],
                    ['key' => 'limit', 'label' => 'Row limit', 'type' => 'number', 'default' => '25', 'description' => 'Maximum number of drug concepts returned.'],
                ],
                'tags_json' => ['drug', 'rxnorm', 'utilization', 'concept_ancestor'],
                'example_questions_json' => ['How many patients were exposed to metformin?', 'Show drug exposure counts for statins.'],
                'template_language' => 'ohdsi_sql',
                'is_aggregate' => true,
                'safety' => 'safe',
                'source' => 'ohdsi_inspired',
            ],
            [
                'slug' => 'patients-with-condition',
                'name' => 'Patients With A Condition',
                'domain' => 'condition',
                'category' => 'cohort-identification',
                'summary' => 'Retrieves patients who have a target condition concept or any descendants.',
                'description' => 'A cohort-identification query that finds patients with a diagnosis of interest using standard OMOP concept hierarchy expansion.',
                'sql_template' => <<<'SQL'
SELECT
  co.person_id,
  MIN(co.condition_start_date) AS first_condition_date
FROM {@cdmSchema}.condition_occurrence co
JOIN {@cdmSchema}.concept_ancestor ca
  ON ca.descendant_concept_id = co.condition_concept_id
  AND ca.ancestor_concept_id = {@conditionConceptId}
GROUP BY co.person_id
ORDER BY first_condition_date DESC
LIMIT {@limit}
SQL,
                'parameters_json' => [
                    ['key' => 'cdmSchema', 'label' => 'CDM schema', 'type' => 'string', 'default' => 'omop', 'description' => 'Qualified OMOP schema name.'],
                    ['key' => 'conditionConceptId', 'label' => 'Condition concept ID', 'type' => 'number', 'default' => '201826', 'description' => 'Standard SNOMED concept, e.g. type 2 diabetes mellitus.'],
                    ['key' => 'limit', 'label' => 'Row limit', 'type' => 'number', 'default' => '1000', 'description' => 'Maximum patients returned for row-level browsing.'],
                ],
                'tags_json' => ['condition', 'cohort', 'snomed', 'descendants'],
                'example_questions_json' => ['Which patients have diabetes?', 'Find people with congestive heart failure.'],
                'template_language' => 'ohdsi_sql',
                'is_aggregate' => false,
                'safety' => 'safe',
                'source' => 'ohdsi_inspired',
            ],
            [
                'slug' => 'measurement-values-for-lab',
                'name' => 'Measurement Values For A Lab Test',
                'domain' => 'measurement',
                'category' => 'retrieval',
                'summary' => 'Returns recent measurement values for a target standard measurement concept.',
                'description' => 'A lab-retrieval template for pulling person-level measurement values, units, and dates for a specific LOINC concept.',
                'sql_template' => <<<'SQL'
SELECT
  m.person_id,
  m.measurement_date,
  m.value_as_number,
  unit.concept_name AS unit_name
FROM {@cdmSchema}.measurement m
LEFT JOIN {@cdmSchema}.concept unit
  ON unit.concept_id = m.unit_concept_id
WHERE m.measurement_concept_id = {@measurementConceptId}
  AND m.value_as_number IS NOT NULL
ORDER BY m.measurement_date DESC
LIMIT {@limit}
SQL,
                'parameters_json' => [
                    ['key' => 'cdmSchema', 'label' => 'CDM schema', 'type' => 'string', 'default' => 'omop', 'description' => 'Qualified OMOP schema name.'],
                    ['key' => 'measurementConceptId', 'label' => 'Measurement concept ID', 'type' => 'number', 'default' => '3013682', 'description' => 'Standard LOINC concept, e.g. HbA1c.'],
                    ['key' => 'limit', 'label' => 'Row limit', 'type' => 'number', 'default' => '100', 'description' => 'Maximum results returned.'],
                ],
                'tags_json' => ['measurement', 'labs', 'loinc', 'person-level'],
                'example_questions_json' => ['Show recent HbA1c values.', 'Retrieve systolic blood pressure measurements.'],
                'template_language' => 'ohdsi_sql',
                'is_aggregate' => false,
                'safety' => 'safe',
                'source' => 'ohdsi_inspired',
            ],
            [
                'slug' => 'average-age-for-condition',
                'name' => 'Average Age For Patients With A Condition',
                'domain' => 'condition',
                'category' => 'demographics',
                'summary' => 'Computes the average patient age for people with a target diagnosis.',
                'description' => 'A demographic summary query that calculates approximate age from year_of_birth for patients who have a target condition concept hierarchy.',
                'sql_template' => <<<'SQL'
SELECT
  AVG(DATE_PART('year', AGE(CURRENT_DATE, MAKE_DATE(p.year_of_birth, 1, 1)))) AS average_age,
  COUNT(DISTINCT p.person_id) AS patient_count
FROM {@cdmSchema}.person p
JOIN {@cdmSchema}.condition_occurrence co
  ON co.person_id = p.person_id
JOIN {@cdmSchema}.concept_ancestor ca
  ON ca.descendant_concept_id = co.condition_concept_id
  AND ca.ancestor_concept_id = {@conditionConceptId}
SQL,
                'parameters_json' => [
                    ['key' => 'cdmSchema', 'label' => 'CDM schema', 'type' => 'string', 'default' => 'omop', 'description' => 'Qualified OMOP schema name.'],
                    ['key' => 'conditionConceptId', 'label' => 'Condition concept ID', 'type' => 'number', 'default' => '319835', 'description' => 'Standard SNOMED concept, e.g. congestive heart failure.'],
                ],
                'tags_json' => ['condition', 'age', 'demographics', 'aggregate'],
                'example_questions_json' => ['Average age of patients with heart failure.', 'How old are patients with atrial fibrillation?'],
                'template_language' => 'ohdsi_sql',
                'is_aggregate' => true,
                'safety' => 'safe',
                'source' => 'ohdsi_inspired',
            ],
            [
                'slug' => 'yearly-drug-exposure-trend',
                'name' => 'Yearly Drug Exposure Trend',
                'domain' => 'drug',
                'category' => 'trend',
                'summary' => 'Counts yearly exposure volume for a target ingredient concept hierarchy.',
                'description' => 'A trend-analysis query for medication exposures grouped by calendar year to inspect uptake over time.',
                'sql_template' => <<<'SQL'
SELECT
  DATE_PART('year', de.drug_exposure_start_date) AS exposure_year,
  COUNT(*) AS exposure_count,
  COUNT(DISTINCT de.person_id) AS patient_count
FROM {@cdmSchema}.drug_exposure de
JOIN {@cdmSchema}.concept_ancestor ca
  ON ca.descendant_concept_id = de.drug_concept_id
  AND ca.ancestor_concept_id = {@ingredientConceptId}
WHERE de.drug_exposure_start_date BETWEEN DATE '{@startDate}' AND DATE '{@endDate}'
GROUP BY DATE_PART('year', de.drug_exposure_start_date)
ORDER BY exposure_year
SQL,
                'parameters_json' => [
                    ['key' => 'cdmSchema', 'label' => 'CDM schema', 'type' => 'string', 'default' => 'omop', 'description' => 'Qualified OMOP schema name.'],
                    ['key' => 'ingredientConceptId', 'label' => 'Ingredient concept ID', 'type' => 'number', 'default' => '1503297', 'description' => 'Standard RxNorm ingredient concept.'],
                    ['key' => 'startDate', 'label' => 'Start date', 'type' => 'date', 'default' => '2020-01-01', 'description' => 'Start of the date window.'],
                    ['key' => 'endDate', 'label' => 'End date', 'type' => 'date', 'default' => '2024-12-31', 'description' => 'End of the date window.'],
                ],
                'tags_json' => ['drug', 'trend', 'time-series', 'aggregate'],
                'example_questions_json' => ['Drug exposure counts for statins in 2024.', 'How have metformin exposures changed over time?'],
                'template_language' => 'ohdsi_sql',
                'is_aggregate' => true,
                'safety' => 'safe',
                'source' => 'ohdsi_inspired',
            ],
        ];
    }
}
