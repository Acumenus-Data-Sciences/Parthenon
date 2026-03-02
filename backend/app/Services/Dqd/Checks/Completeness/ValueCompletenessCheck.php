<?php

namespace App\Services\Dqd\Checks\Completeness;

use App\Services\Dqd\Checks\AbstractDqdCheck;

/**
 * Checks that optional fields are populated above a configurable threshold.
 * These are typically "warning" severity since the field is optional but data quality is better when populated.
 */
class ValueCompletenessCheck extends AbstractDqdCheck
{
    public function __construct(
        private string $table,
        private string $column,
        private string $desc,
        private float $thresholdPct = 10.0,
    ) {}

    public function checkId(): string
    {
        return "completeness_value_{$this->table}_{$this->column}";
    }

    public function category(): string
    {
        return 'completeness';
    }

    public function subcategory(): string
    {
        return 'measureValueCompleteness';
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
        return $this->thresholdPct;
    }

    public function description(): string
    {
        return $this->desc;
    }

    public function sqlViolated(string $cdmSchema, string $vocabSchema): string
    {
        return "SELECT COUNT(*)::bigint AS count FROM {$cdmSchema}.{$this->table} WHERE {$this->column} IS NULL";
    }

    public function sqlTotal(string $cdmSchema, string $vocabSchema): string
    {
        return "SELECT COUNT(*)::bigint AS count FROM {$cdmSchema}.{$this->table}";
    }
}
