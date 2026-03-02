<?php

namespace App\Services\Dqd\Checks\Plausibility;

use App\Services\Dqd\Checks\AbstractDqdCheck;

/**
 * Checks that date values are not in the future.
 * Some small tolerance may be allowed (e.g., lab results arriving a day late).
 */
class NoFutureDateCheck extends AbstractDqdCheck
{
    public function __construct(
        private string $table,
        private string $column,
        private string $desc,
        private float $thresholdPct = 0.0,
    ) {}

    public function checkId(): string
    {
        return "plausibility_noFutureDate_{$this->table}_{$this->column}";
    }

    public function category(): string
    {
        return 'plausibility';
    }

    public function subcategory(): string
    {
        return 'temporalPlausibility';
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
        return <<<SQL
            SELECT COUNT(*)::bigint AS count
            FROM {$cdmSchema}.{$this->table}
            WHERE {$this->column} > CURRENT_DATE
            SQL;
    }

    public function sqlTotal(string $cdmSchema, string $vocabSchema): string
    {
        return <<<SQL
            SELECT COUNT(*)::bigint AS count
            FROM {$cdmSchema}.{$this->table}
            WHERE {$this->column} IS NOT NULL
            SQL;
    }
}
