<?php

namespace App\Services\Cohort\Criteria;

abstract class AbstractCriteriaBuilder implements CriteriaBuilderInterface
{
    public function personIdColumn(): string
    {
        return 'person_id';
    }

    /**
     * Build a numeric range WHERE clause.
     *
     * Supports: Value+Op (single comparison) or Value+Extent (range).
     * Op values: 'lt', 'lte', 'gt', 'gte', 'eq', 'neq', 'bt' (between).
     *
     * @return list<string>
     */
    protected function buildNumericRange(array $range, string $column): array
    {
        $clauses = [];

        $op = $range['Op'] ?? null;
        $value = $range['Value'] ?? null;
        $extent = $range['Extent'] ?? null;

        if ($op === null || $value === null) {
            return $clauses;
        }

        $value = (float) $value;

        $clauses[] = match ($op) {
            'lt' => "{$column} < {$value}",
            'lte' => "{$column} <= {$value}",
            'gt' => "{$column} > {$value}",
            'gte' => "{$column} >= {$value}",
            'eq' => "{$column} = {$value}",
            'neq' => "{$column} <> {$value}",
            'bt' => $extent !== null
                ? "{$column} BETWEEN {$value} AND ".(float) $extent
                : "{$column} >= {$value}",
            default => "{$column} = {$value}",
        };

        return $clauses;
    }

    /**
     * Build a concept list WHERE clause (IN list).
     *
     * Accepts plain integer IDs or concept objects with a CONCEPT_ID key
     * (e.g. ValueAsConcept: [{"CONCEPT_ID": 4181412, "CONCEPT_NAME": "Present"}]).
     *
     * @param  list<int|array<string, mixed>>  $conceptIds
     * @return list<string>
     */
    protected function buildConceptListClause(array $conceptIds, string $column): array
    {
        if (empty($conceptIds)) {
            return [];
        }

        $ids = array_map(function ($item) {
            if (is_array($item)) {
                return (int) ($item['CONCEPT_ID'] ?? $item['concept_id'] ?? 0);
            }

            return (int) $item;
        }, $conceptIds);

        return ["{$column} IN (".implode(', ', $ids).')'];
    }

    /**
     * Build a codeset join reference WHERE clause.
     *
     * When a criterion references a CodesetId for a secondary concept column,
     * generate a subquery to the codeset CTE.
     *
     * @return list<string>
     */
    protected function buildCodesetClause(?int $codesetId, string $column): array
    {
        if ($codesetId === null) {
            return [];
        }

        return ["{$column} IN (SELECT concept_id FROM codesetId_{$codesetId})"];
    }
}
