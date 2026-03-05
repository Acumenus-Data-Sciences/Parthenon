<?php

namespace App\Services\Cohort\Criteria;

class DemographicCriteriaBuilder
{
    /**
     * Build WHERE clause fragments for demographic criteria applied to the person table.
     *
     * Each demographic criterion can filter on Age, Gender, Race, or Ethnicity.
     *
     * @param  list<array<string, mixed>>  $demographicCriteria
     * @param  string  $personAlias  The alias for the person table
     * @param  string  $eventDateExpr  The expression for the index event date (for age calculation)
     * @return list<string> SQL WHERE clause fragments
     */
    public function buildWhereClauses(array $demographicCriteria, string $personAlias, string $eventDateExpr): array
    {
        $clauses = [];

        foreach ($demographicCriteria as $criterion) {
            $clauses = array_merge($clauses, $this->buildSingleCriterion($criterion, $personAlias, $eventDateExpr));
        }

        return $clauses;
    }

    /**
     * Build WHERE clauses for a single demographic criterion.
     *
     * @return list<string>
     */
    private function buildSingleCriterion(array $criterion, string $personAlias, string $eventDateExpr): array
    {
        $clauses = [];

        // Age filter — computed from year_of_birth
        if (isset($criterion['Age']) && is_array($criterion['Age'])) {
            $age = $criterion['Age'];
            $ageExpr = "(EXTRACT(YEAR FROM {$eventDateExpr}) - {$personAlias}.year_of_birth)";

            $op = $age['Op'] ?? null;
            $value = $age['Value'] ?? null;

            if ($op !== null && $value !== null) {
                $value = (int) $value;
                $extent = isset($age['Extent']) ? (int) $age['Extent'] : null;

                $clause = match ($op) {
                    'lt' => "{$ageExpr} < {$value}",
                    'lte' => "{$ageExpr} <= {$value}",
                    'gt' => "{$ageExpr} > {$value}",
                    'gte' => "{$ageExpr} >= {$value}",
                    'eq' => "{$ageExpr} = {$value}",
                    'neq' => "{$ageExpr} <> {$value}",
                    'bt' => $extent !== null
                        ? "{$ageExpr} BETWEEN {$value} AND {$extent}"
                        : "{$ageExpr} >= {$value}",
                    default => "{$ageExpr} = {$value}",
                };

                $clauses[] = $clause;
            }
        }

        // Gender filter — gender_concept_id IN (...)
        if (isset($criterion['Gender']) && is_array($criterion['Gender'])) {
            $ids = array_map('intval', $criterion['Gender']);
            if (! empty($ids)) {
                $idList = implode(', ', $ids);
                $clauses[] = "{$personAlias}.gender_concept_id IN ({$idList})";
            }
        }

        // Race filter — race_concept_id IN (...)
        if (isset($criterion['Race']) && is_array($criterion['Race'])) {
            $ids = array_map('intval', $criterion['Race']);
            if (! empty($ids)) {
                $idList = implode(', ', $ids);
                $clauses[] = "{$personAlias}.race_concept_id IN ({$idList})";
            }
        }

        // Ethnicity filter — ethnicity_concept_id IN (...)
        if (isset($criterion['Ethnicity']) && is_array($criterion['Ethnicity'])) {
            $ids = array_map('intval', $criterion['Ethnicity']);
            if (! empty($ids)) {
                $idList = implode(', ', $ids);
                $clauses[] = "{$personAlias}.ethnicity_concept_id IN ({$idList})";
            }
        }

        return $clauses;
    }
}
