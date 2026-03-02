<?php

namespace App\Services\Dqd\Checks\Conformance;

use App\Services\Dqd\Checks\AbstractDqdCheck;

/**
 * Checks that concept_id values have the correct domain_id for the table they reside in.
 * For example, condition_concept_id should reference concepts with domain_id = 'Condition'.
 */
class DomainConformanceCheck extends AbstractDqdCheck
{
    public function __construct(
        private string $table,
        private string $column,
        private string $expectedDomain,
        private string $desc,
    ) {}

    public function checkId(): string
    {
        return "conformance_domainMatch_{$this->table}_{$this->column}";
    }

    public function category(): string
    {
        return 'conformance';
    }

    public function subcategory(): string
    {
        return 'domainConformance';
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
              AND c.domain_id != '{$this->expectedDomain}'
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
