<?php

namespace App\Services\Dqd\Checks\Plausibility;

use App\Services\Dqd\Checks\AbstractDqdCheck;

/**
 * Checks that clinical events fall within an observation period for their person.
 * Events outside observation periods suggest data integrity issues.
 */
class ObservationPeriodBoundsCheck extends AbstractDqdCheck
{
    public function __construct(
        private string $table,
        private string $dateColumn,
        private string $desc,
    ) {}

    public function checkId(): string
    {
        return "plausibility_obsPeriodBounds_{$this->table}_{$this->dateColumn}";
    }

    public function category(): string
    {
        return 'plausibility';
    }

    public function subcategory(): string
    {
        return 'observationPeriodBounds';
    }

    public function cdmTable(): string
    {
        return $this->table;
    }

    public function cdmColumn(): ?string
    {
        return $this->dateColumn;
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
            FROM {$cdmSchema}.{$this->table} e
            LEFT JOIN {$cdmSchema}.observation_period op
              ON e.person_id = op.person_id
              AND e.{$this->dateColumn} >= op.observation_period_start_date
              AND e.{$this->dateColumn} <= op.observation_period_end_date
            WHERE op.person_id IS NULL
            SQL;
    }

    public function sqlTotal(string $cdmSchema, string $vocabSchema): string
    {
        return "SELECT COUNT(*)::bigint AS count FROM {$cdmSchema}.{$this->table}";
    }
}
