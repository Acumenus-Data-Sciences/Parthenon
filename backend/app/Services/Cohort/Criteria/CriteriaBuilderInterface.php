<?php

namespace App\Services\Cohort\Criteria;

interface CriteriaBuilderInterface
{
    /**
     * The PascalCase domain key used in the expression JSON.
     * e.g., 'ConditionOccurrence'
     */
    public function domainKey(): string;

    /**
     * The CDM table name.
     * e.g., 'condition_occurrence'
     */
    public function cdmTable(): string;

    /**
     * The concept ID column in the CDM table.
     * e.g., 'condition_concept_id'
     */
    public function conceptIdColumn(): string;

    /**
     * The start date column in the CDM table.
     * e.g., 'condition_start_date'
     */
    public function startDateColumn(): string;

    /**
     * The end date column in the CDM table (nullable for domains without end dates).
     * e.g., 'condition_end_date' or null for death
     */
    public function endDateColumn(): ?string;

    /**
     * The person ID column. Always 'person_id' in CDM.
     */
    public function personIdColumn(): string;

    /**
     * Build additional WHERE clause fragments from the criterion configuration.
     *
     * @param  array<string, mixed>  $criterion  The domain-specific criterion config
     * @param  string  $alias  The table alias used in the query
     * @return list<string> SQL WHERE clause fragments (without leading AND)
     */
    public function buildWhereClauses(array $criterion, string $alias): array;
}
