<?php

namespace App\Services\Cohort\Criteria;

class DeathCriteriaBuilder extends AbstractCriteriaBuilder
{
    public function domainKey(): string
    {
        return 'Death';
    }

    public function cdmTable(): string
    {
        return 'death';
    }

    public function conceptIdColumn(): string
    {
        return 'cause_concept_id';
    }

    public function startDateColumn(): string
    {
        return 'death_date';
    }

    public function endDateColumn(): ?string
    {
        return null;
    }

    public function buildWhereClauses(array $criterion, string $alias): array
    {
        $clauses = [];

        // DeathType filter
        if (isset($criterion['DeathType']) && is_array($criterion['DeathType'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['DeathType'], "{$alias}.death_type_concept_id")
            );
        }

        // DeathSourceConcept filter
        if (isset($criterion['DeathSourceConcept'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildCodesetClause($criterion['DeathSourceConcept'], "{$alias}.cause_source_concept_id")
            );
        }

        return $clauses;
    }
}
