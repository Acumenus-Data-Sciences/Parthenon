<?php

namespace App\Services\Cohort\Criteria;

class MeasurementCriteriaBuilder extends AbstractCriteriaBuilder
{
    public function domainKey(): string
    {
        return 'Measurement';
    }

    public function cdmTable(): string
    {
        return 'measurement';
    }

    public function conceptIdColumn(): string
    {
        return 'measurement_concept_id';
    }

    public function startDateColumn(): string
    {
        return 'measurement_date';
    }

    public function endDateColumn(): ?string
    {
        return null;
    }

    public function buildWhereClauses(array $criterion, string $alias): array
    {
        $clauses = [];

        // MeasurementType filter
        if (isset($criterion['MeasurementType']) && is_array($criterion['MeasurementType'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['MeasurementType'], "{$alias}.measurement_type_concept_id")
            );
        }

        // ValueAsNumber range
        if (isset($criterion['ValueAsNumber']) && is_array($criterion['ValueAsNumber'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildNumericRange($criterion['ValueAsNumber'], "{$alias}.value_as_number")
            );
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

        // RangeLow range
        if (isset($criterion['RangeLow']) && is_array($criterion['RangeLow'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildNumericRange($criterion['RangeLow'], "{$alias}.range_low")
            );
        }

        // RangeHigh range
        if (isset($criterion['RangeHigh']) && is_array($criterion['RangeHigh'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildNumericRange($criterion['RangeHigh'], "{$alias}.range_high")
            );
        }

        // Abnormal flag — value outside normal range
        if (isset($criterion['Abnormal']) && $criterion['Abnormal'] === true) {
            $clauses[] = "({$alias}.value_as_number < {$alias}.range_low OR {$alias}.value_as_number > {$alias}.range_high)";
        }

        // MeasurementSourceConcept filter
        if (isset($criterion['MeasurementSourceConcept'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildCodesetClause($criterion['MeasurementSourceConcept'], "{$alias}.measurement_source_concept_id")
            );
        }

        // Operator filter
        if (isset($criterion['Operator']) && is_array($criterion['Operator'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['Operator'], "{$alias}.operator_concept_id")
            );
        }

        return $clauses;
    }
}
