<?php

namespace App\Services\Cohort\Criteria;

class ObservationCriteriaBuilder extends AbstractCriteriaBuilder
{
    public function domainKey(): string
    {
        return 'Observation';
    }

    public function cdmTable(): string
    {
        return 'observation';
    }

    public function conceptIdColumn(): string
    {
        return 'observation_concept_id';
    }

    public function startDateColumn(): string
    {
        return 'observation_date';
    }

    public function endDateColumn(): ?string
    {
        return null;
    }

    public function buildWhereClauses(array $criterion, string $alias): array
    {
        $clauses = [];

        // ObservationType filter
        if (isset($criterion['ObservationType']) && is_array($criterion['ObservationType'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['ObservationType'], "{$alias}.observation_type_concept_id")
            );
        }

        // ValueAsNumber range
        if (isset($criterion['ValueAsNumber']) && is_array($criterion['ValueAsNumber'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildNumericRange($criterion['ValueAsNumber'], "{$alias}.value_as_number")
            );
        }

        // ValueAsString filter
        if (isset($criterion['ValueAsString']) && is_string($criterion['ValueAsString'])) {
            $escaped = addslashes($criterion['ValueAsString']);
            $clauses[] = "{$alias}.value_as_string LIKE '%{$escaped}%'";
        }

        // ValueAsConcept filter
        if (isset($criterion['ValueAsConcept']) && is_array($criterion['ValueAsConcept'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['ValueAsConcept'], "{$alias}.value_as_concept_id")
            );
        }

        // Unit filter
        if (isset($criterion['Unit']) && is_array($criterion['Unit'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['Unit'], "{$alias}.unit_concept_id")
            );
        }

        // Qualifier filter
        if (isset($criterion['Qualifier']) && is_array($criterion['Qualifier'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['Qualifier'], "{$alias}.qualifier_concept_id")
            );
        }

        // ObservationSourceConcept filter
        if (isset($criterion['ObservationSourceConcept'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildCodesetClause($criterion['ObservationSourceConcept'], "{$alias}.observation_source_concept_id")
            );
        }

        return $clauses;
    }
}
