<?php

namespace App\Services\Cohort\Criteria;

class DrugCriteriaBuilder extends AbstractCriteriaBuilder
{
    public function domainKey(): string
    {
        return 'DrugExposure';
    }

    public function cdmTable(): string
    {
        return 'drug_exposure';
    }

    public function conceptIdColumn(): string
    {
        return 'drug_concept_id';
    }

    public function startDateColumn(): string
    {
        return 'drug_exposure_start_date';
    }

    public function endDateColumn(): ?string
    {
        return 'drug_exposure_end_date';
    }

    public function buildWhereClauses(array $criterion, string $alias): array
    {
        $clauses = [];

        // DrugType filter
        if (isset($criterion['DrugType']) && is_array($criterion['DrugType'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['DrugType'], "{$alias}.drug_type_concept_id")
            );
        }

        // DaysSupply range
        if (isset($criterion['DaysSupply']) && is_array($criterion['DaysSupply'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildNumericRange($criterion['DaysSupply'], "{$alias}.days_supply")
            );
        }

        // Quantity range
        if (isset($criterion['Quantity']) && is_array($criterion['Quantity'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildNumericRange($criterion['Quantity'], "{$alias}.quantity")
            );
        }

        // RouteConcept filter
        if (isset($criterion['RouteConcept']) && is_array($criterion['RouteConcept'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['RouteConcept'], "{$alias}.route_concept_id")
            );
        }

        // DoseUnit filter
        if (isset($criterion['DoseUnit']) && is_array($criterion['DoseUnit'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildConceptListClause($criterion['DoseUnit'], "{$alias}.dose_unit_concept_id")
            );
        }

        // DrugSourceConcept filter
        if (isset($criterion['DrugSourceConcept'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildCodesetClause($criterion['DrugSourceConcept'], "{$alias}.drug_source_concept_id")
            );
        }

        // Refills range
        if (isset($criterion['Refills']) && is_array($criterion['Refills'])) {
            $clauses = array_merge(
                $clauses,
                $this->buildNumericRange($criterion['Refills'], "{$alias}.refills")
            );
        }

        return $clauses;
    }
}
