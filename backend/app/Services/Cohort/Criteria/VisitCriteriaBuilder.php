<?php

namespace App\Services\Cohort\Criteria;

class VisitCriteriaBuilder extends AbstractCriteriaBuilder
{
    public function domainKey(): string
    {
        return 'VisitOccurrence';
    }

    public function cdmTable(): string
    {
        return 'visit_occurrence';
    }

    public function conceptIdColumn(): string
    {
        return 'visit_concept_id';
    }

    public function startDateColumn(): string
    {
        return 'visit_start_date';
    }

    public function endDateColumn(): ?string
    {
        return 'visit_end_date';
    }

    public function buildWhereClauses(array $criterion, string $alias): array
    {
        $clauses = [];

        // VisitType filter
        if (isset($criterion['VisitType']) && is_array($criterion['VisitType'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['VisitType'], "{$alias}.visit_type_concept_id")
            );
        }

        // VisitLength range (computed as date difference)
        if (isset($criterion['VisitLength']) && is_array($criterion['VisitLength'])) {
            $lengthExpr = "DATEDIFF({$alias}.visit_start_date, {$alias}.visit_end_date)";
            $clauses = array_merge(
                $clauses,
                $this->buildNumericRange($criterion['VisitLength'], $lengthExpr)
            );
        }

        // VisitSourceConcept filter
        if (isset($criterion['VisitSourceConcept'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildCodesetClause($criterion['VisitSourceConcept'], "{$alias}.visit_source_concept_id")
            );
        }

        return $clauses;
    }
}
