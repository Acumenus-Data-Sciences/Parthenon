<?php

namespace App\Services\Cohort\Criteria;

class ConditionCriteriaBuilder extends AbstractCriteriaBuilder
{
    public function domainKey(): string
    {
        return 'ConditionOccurrence';
    }

    public function cdmTable(): string
    {
        return 'condition_occurrence';
    }

    public function conceptIdColumn(): string
    {
        return 'condition_concept_id';
    }

    public function startDateColumn(): string
    {
        return 'condition_start_date';
    }

    public function endDateColumn(): ?string
    {
        return 'condition_end_date';
    }

    public function buildWhereClauses(array $criterion, string $alias): array
    {
        $clauses = [];

        // ConditionType filter
        if (isset($criterion['ConditionType']) && is_array($criterion['ConditionType'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['ConditionType'], "{$alias}.condition_type_concept_id")
            );
        }

        // ConditionSourceConcept filter
        if (isset($criterion['ConditionSourceConcept'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildCodesetClause($criterion['ConditionSourceConcept'], "{$alias}.condition_source_concept_id")
            );
        }

        // ConditionStatus filter
        if (isset($criterion['ConditionStatus']) && is_array($criterion['ConditionStatus'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['ConditionStatus'], "{$alias}.condition_status_concept_id")
            );
        }

        // StopReason filter
        if (isset($criterion['StopReason']) && is_string($criterion['StopReason'])) {
            $escaped = str_replace("'", "''", $criterion['StopReason']);
            $clauses[] = "{$alias}.stop_reason = '{$escaped}'";
        }

        return $clauses;
    }
}
