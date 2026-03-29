<?php

namespace App\Services\PopulationRisk;

use App\Contracts\PopulationRiskScoreV2Interface;
use App\Enums\DaimonType;
use App\Models\App\Source;
use Illuminate\Support\Facades\DB;

class PatientFeatureExtractor
{
    public function __construct(
        private readonly ConceptResolutionService $conceptResolver,
    ) {}

    /**
     * Extract patient features for all patients in a cohort, tailored to the given scores.
     *
     * @param  PopulationRiskScoreV2Interface[]  $scores
     * @return array<int, array{person_id: int, age: int, gender_concept_id: int, conditions: int[], measurements: array<int, float>}>
     */
    public function extractForCohort(int $cohortDefinitionId, array $scores, Source $source): array
    {
        $cdmSchema = $source->getTableQualifier(DaimonType::CDM);
        $vocabSchema = $source->getTableQualifier(DaimonType::Vocabulary) ?? $cdmSchema;
        $resultsSchema = $source->getTableQualifier(DaimonType::Results);
        $connection = $source->source_connection;

        // Step 1: Demographics — join person with cohort
        $patients = $this->extractDemographics($connection, $cdmSchema, $resultsSchema, $cohortDefinitionId);

        if (empty($patients)) {
            return [];
        }

        $personIds = array_keys($patients);
        $personIdList = '{'.implode(',', $personIds).'}';

        // Step 2: Collect all ancestor concept IDs from all scores' conditionGroups
        $allAncestorIds = [];
        foreach ($scores as $score) {
            foreach ($score->conditionGroups() as $group) {
                $allAncestorIds[] = $group['ancestor_concept_id'];
            }
        }
        $allAncestorIds = array_values(array_unique($allAncestorIds));

        // Step 3: Resolve ancestors to descendants
        $allDescendantIds = [];
        if (! empty($allAncestorIds)) {
            $allDescendantIds = $this->conceptResolver->resolveMultipleDescendants(
                $allAncestorIds,
                $connection,
                $vocabSchema
            );
        }

        // Step 4: Query condition_occurrence for descendant concepts
        if (! empty($allDescendantIds)) {
            $descendantList = '{'.implode(',', $allDescendantIds).'}';
            $conditionRows = DB::connection($connection)->select(
                "SELECT DISTINCT co.person_id, co.condition_concept_id
                 FROM {$cdmSchema}.condition_occurrence co
                 WHERE co.person_id = ANY(?::int[])
                   AND co.condition_concept_id = ANY(?::int[])",
                [$personIdList, $descendantList]
            );

            foreach ($conditionRows as $row) {
                $pid = (int) $row->person_id;
                if (isset($patients[$pid])) {
                    $patients[$pid]['conditions'][] = (int) $row->condition_concept_id;
                }
            }
        }

        // Step 5: Collect measurement concept IDs from scores
        $measurementConceptIds = [];
        foreach ($scores as $score) {
            foreach ($score->measurementRequirements() as $req) {
                $measurementConceptIds[] = $req['concept_id'];
            }
        }
        $measurementConceptIds = array_values(array_unique($measurementConceptIds));

        // Step 6: Query measurement for latest value per concept per patient
        if (! empty($measurementConceptIds)) {
            $measurementList = '{'.implode(',', $measurementConceptIds).'}';
            $measurementRows = DB::connection($connection)->select(
                "SELECT DISTINCT ON (m.person_id, m.measurement_concept_id)
                        m.person_id,
                        m.measurement_concept_id,
                        m.value_as_number
                 FROM {$cdmSchema}.measurement m
                 WHERE m.person_id = ANY(?::int[])
                   AND m.measurement_concept_id = ANY(?::int[])
                   AND m.value_as_number IS NOT NULL
                 ORDER BY m.person_id, m.measurement_concept_id, m.measurement_date DESC",
                [$personIdList, $measurementList]
            );

            foreach ($measurementRows as $row) {
                $pid = (int) $row->person_id;
                if (isset($patients[$pid])) {
                    $patients[$pid]['measurements'][(int) $row->measurement_concept_id] = (float) $row->value_as_number;
                }
            }
        }

        return $patients;
    }

    /**
     * Extract demographics for cohort patients.
     *
     * @return array<int, array{person_id: int, age: int, gender_concept_id: int, conditions: int[], measurements: array<int, float>}>
     */
    private function extractDemographics(string $connection, string $cdmSchema, string $resultsSchema, int $cohortDefinitionId): array
    {
        $rows = DB::connection($connection)->select(
            "SELECT p.person_id,
                    EXTRACT(YEAR FROM CURRENT_DATE)::int - p.year_of_birth AS age,
                    p.gender_concept_id
             FROM {$cdmSchema}.person p
             JOIN {$resultsSchema}.cohort c
               ON c.subject_id = p.person_id
             WHERE c.cohort_definition_id = ?",
            [$cohortDefinitionId]
        );

        $patients = [];
        foreach ($rows as $row) {
            $pid = (int) $row->person_id;
            $patients[$pid] = [
                'person_id' => $pid,
                'age' => (int) $row->age,
                'gender_concept_id' => (int) $row->gender_concept_id,
                'conditions' => [],
                'measurements' => [],
            ];
        }

        return $patients;
    }
}
