<?php

namespace App\Services\Cohort\Criteria;

class ProcedureCriteriaBuilder extends AbstractCriteriaBuilder
{
    public function domainKey(): string
    {
        return 'ProcedureOccurrence';
    }

    public function cdmTable(): string
    {
        return 'procedure_occurrence';
    }

    public function conceptIdColumn(): string
    {
        return 'procedure_concept_id';
    }

    public function startDateColumn(): string
    {
        return 'procedure_date';
    }

    public function endDateColumn(): ?string
    {
        return null;
    }

    public function buildWhereClauses(array $criterion, string $alias): array
    {
        $clauses = [];

        // ProcedureType filter
        if (isset($criterion['ProcedureType']) && is_array($criterion['ProcedureType'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['ProcedureType'], "{$alias}.procedure_type_concept_id")
            );
        }

        // Modifier filter
        if (isset($criterion['Modifier']) && is_array($criterion['Modifier'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['Modifier'], "{$alias}.modifier_concept_id")
            );
        }

        // Quantity range
        if (isset($criterion['Quantity']) && is_array($criterion['Quantity'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildNumericRange($criterion['Quantity'], "{$alias}.quantity")
            );
        }

        // ProcedureSourceConcept filter
        if (isset($criterion['ProcedureSourceConcept'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildCodesetClause($criterion['ProcedureSourceConcept'], "{$alias}.procedure_source_concept_id")
            );
        }

        return $clauses;
    }
}
