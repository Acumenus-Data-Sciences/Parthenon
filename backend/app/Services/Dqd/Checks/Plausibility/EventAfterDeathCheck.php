<?php

namespace App\Services\Dqd\Checks\Plausibility;

use App\Services\Dqd\Checks\AbstractDqdCheck;

/**
 * Checks that clinical events do not occur after the person's death date.
 * Only evaluates persons who have a death record.
 */
class EventAfterDeathCheck extends AbstractDqdCheck
{
    public function __construct(
        private string $table,
        private string $dateColumn,
        private string $desc,
    ) {}

    public function checkId(): string
    {
        return "plausibility_afterDeath_{$this->table}_{$this->dateColumn}";
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
        return $this->dateColumn;
    }

    public function severity(): string
    {
        return 'error';
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
            JOIN {$cdmSchema}.death d ON e.person_id = d.person_id
            WHERE e.{$this->dateColumn} IS NOT NULL
              AND e.{$this->dateColumn} > d.death_date
            SQL;
    }

    public function sqlTotal(string $cdmSchema, string $vocabSchema): string
    {
        return <<<SQL
            SELECT COUNT(*)::bigint AS count
            FROM {$cdmSchema}.{$this->table} e
            JOIN {$cdmSchema}.death d ON e.person_id = d.person_id
            WHERE e.{$this->dateColumn} IS NOT NULL
            SQL;
    }
}
