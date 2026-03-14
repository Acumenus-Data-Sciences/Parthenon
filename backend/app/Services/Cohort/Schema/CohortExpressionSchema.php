<?php

namespace App\Services\Cohort\Schema;

use InvalidArgumentException;

class CohortExpressionSchema
{
    /**
     * Known domain criteria keys that map to CDM tables.
     *
     * @var list<string>
     */
    private const DOMAIN_KEYS = [
        'ConditionOccurrence',
        'DrugExposure',
        'ProcedureOccurrence',
        'Measurement',
        'Observation',
        'VisitOccurrence',
        'Death',
    ];

    /**
     * Validate and normalize a cohort expression array.
     *
     * @return array<string, mixed> Normalized expression
     *
     * @throws InvalidArgumentException
     */
    public function validate(array $expression): array
    {
        // PrimaryCriteria is required
        if (! isset($expression['PrimaryCriteria'])) {
            throw new InvalidArgumentException('PrimaryCriteria is required in cohort expression.');
        }

        $primary = $expression['PrimaryCriteria'];

        if (! isset($primary['CriteriaList']) || ! is_array($primary['CriteriaList'])) {
            throw new InvalidArgumentException('PrimaryCriteria.CriteriaList must be an array.');
        }

        // Validate each primary criterion has exactly one domain key (empty list is valid for drafts)
        foreach ($primary['CriteriaList'] as $index => $criterion) {
            $this->validateCriterionHasDomain($criterion, "PrimaryCriteria.CriteriaList[{$index}]");
        }

        // Normalize ObservationWindow
        if (! isset($primary['ObservationWindow'])) {
            $expression['PrimaryCriteria']['ObservationWindow'] = [
                'PriorDays' => 0,
                'PostDays' => 0,
            ];
        } else {
            $expression['PrimaryCriteria']['ObservationWindow'] = [
                'PriorDays' => (int) ($primary['ObservationWindow']['PriorDays'] ?? 0),
                'PostDays' => (int) ($primary['ObservationWindow']['PostDays'] ?? 0),
            ];
        }

        // Normalize conceptSets (optional) — accept Atlas-style "ConceptSets" too
        if (! isset($expression['conceptSets']) && isset($expression['ConceptSets'])) {
            $expression['conceptSets'] = $expression['ConceptSets'];
            unset($expression['ConceptSets']);
        }
        if (! isset($expression['conceptSets'])) {
            $expression['conceptSets'] = [];
        }

        foreach ($expression['conceptSets'] as $index => $cs) {
            if (! isset($cs['id']) || ! isset($cs['expression']['items'])) {
                throw new InvalidArgumentException("conceptSets[{$index}] must have 'id' and 'expression.items'.");
            }
        }

        // Normalize AdditionalCriteria (optional)
        if (! isset($expression['AdditionalCriteria'])) {
            $expression['AdditionalCriteria'] = null;
        } else {
            $expression['AdditionalCriteria'] = $this->normalizeGroup($expression['AdditionalCriteria']);
        }

        // Normalize CensoringCriteria (optional)
        if (! isset($expression['CensoringCriteria'])) {
            $expression['CensoringCriteria'] = [];
        }

        // Normalize EndStrategy (optional)
        if (! isset($expression['EndStrategy'])) {
            $expression['EndStrategy'] = null;
        }

        // Normalize QualifiedLimit
        if (! isset($expression['QualifiedLimit'])) {
            $expression['QualifiedLimit'] = ['Type' => 'First'];
        }

        // Normalize ExpressionLimit
        if (! isset($expression['ExpressionLimit'])) {
            $expression['ExpressionLimit'] = ['Type' => 'First'];
        }

        // Normalize DemographicCriteria (optional)
        if (! isset($expression['DemographicCriteria'])) {
            $expression['DemographicCriteria'] = [];
        }

        // Normalize CollapseSettings (optional)
        if (! isset($expression['CollapseSettings'])) {
            $expression['CollapseSettings'] = ['CollapseType' => 'ERA', 'EraPad' => 0];
        }

        return $expression;
    }

    /**
     * Validate that a criterion array contains exactly one recognized domain key.
     *
     * @throws InvalidArgumentException
     */
    private function validateCriterionHasDomain(array $criterion, string $path): void
    {
        $found = [];

        foreach (self::DOMAIN_KEYS as $key) {
            if (isset($criterion[$key])) {
                $found[] = $key;
            }
        }

        if (count($found) === 0) {
            $allowed = implode(', ', self::DOMAIN_KEYS);
            throw new InvalidArgumentException("{$path} must contain one of: {$allowed}.");
        }

        if (count($found) > 1) {
            $keys = implode(', ', $found);
            throw new InvalidArgumentException("{$path} contains multiple domain keys: {$keys}. Only one is allowed.");
        }
    }

    /**
     * Normalize an AdditionalCriteria group (recursively handles nested Groups).
     *
     * @return array<string, mixed>
     */
    private function normalizeGroup(array $group): array
    {
        $group['Type'] = $group['Type'] ?? 'ALL';
        $group['CriteriaList'] = $group['CriteriaList'] ?? [];
        $group['Groups'] = $group['Groups'] ?? [];

        // Validate individual criteria in the group
        foreach ($group['CriteriaList'] as $index => $item) {
            if (isset($item['Criteria'])) {
                $this->validateCriterionHasDomain($item['Criteria'], "AdditionalCriteria.CriteriaList[{$index}].Criteria");
            }
        }

        // Recursively normalize nested groups
        foreach ($group['Groups'] as $index => $nestedGroup) {
            $group['Groups'][$index] = $this->normalizeGroup($nestedGroup);
        }

        return $group;
    }

    /**
     * Extract the domain key from a criterion array.
     */
    public function extractDomainKey(array $criterion): ?string
    {
        foreach (self::DOMAIN_KEYS as $key) {
            if (isset($criterion[$key])) {
                return $key;
            }
        }

        return null;
    }

    /**
     * Get all recognized domain keys.
     *
     * @return list<string>
     */
    public function domainKeys(): array
    {
        return self::DOMAIN_KEYS;
    }
}
