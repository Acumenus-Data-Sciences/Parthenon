<?php

namespace App\Services\Dqd\Checks\Conformance;

use App\Services\Dqd\Checks\AbstractDqdCheck;

/**
 * Checks that concept_id values are standard concepts (standard_concept = 'S').
 * In OMOP CDM, the primary concept_id columns should reference standard vocabulary concepts.
 */
class StandardConceptCheck extends AbstractDqdCheck
{
    public function __construct(
        private string $table,
        private string $column,
        private string $desc,
    ) {}

    public function checkId(): string
    {
        return "conformance_standardConcept_{$this->table}_{$this->column}";
    }

    public function category(): string
    {
        return 'conformance';
    }

    public function subcategory(): string
    {
        return 'standardConcept';
    }

    public function cdmTable(): string
    {
        return $this->table;
    }

    public function cdmColumn(): ?string
    {
        return $this->column;
    }

    public function severity(): string
    {
        return 'warning';
    }

    public function threshold(): float
    {
        return 5.0;
    }

    public function description(): string
    {
        return $this->desc;
    }

    public function sqlViolated(string $cdmSchema, string $vocabSchema): string
    {
        return <<<SQL
            SELECT COUNT(*)::bigint AS count
            FROM {$cdmSchema}.{$this->table} t
            JOIN {$vocabSchema}.concept c ON t.{$this->column} = c.concept_id
            WHERE t.{$this->column} != 0
              AND t.{$this->column} IS NOT NULL
              AND (c.standard_concept IS NULL OR c.standard_concept != 'S')
            SQL;
    }

    public function sqlTotal(string $cdmSchema, string $vocabSchema): string
    {
        return <<<SQL
            SELECT COUNT(*)::bigint AS count
            FROM {$cdmSchema}.{$this->table}
            WHERE {$this->column} != 0
              AND {$this->column} IS NOT NULL
            SQL;
    }
}
