<?php

namespace App\Services\Dqd\Checks\Plausibility;

use App\Services\Dqd\Checks\AbstractDqdCheck;

/**
 * Checks that clinical events do not occur before the person's birth year.
 * Uses EXTRACT(YEAR FROM date_column) >= year_of_birth.
 */
class EventAfterBirthCheck extends AbstractDqdCheck
{
    public function __construct(
        private string $table,
        private string $dateColumn,
        private string $desc,
    ) {}

    public function checkId(): string
    {
        return "plausibility_afterBirth_{$this->table}_{$this->dateColumn}";
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
            JOIN {$cdmSchema}.person p ON e.person_id = p.person_id
            WHERE e.{$this->dateColumn} IS NOT NULL
              AND p.year_of_birth IS NOT NULL
              AND EXTRACT(YEAR FROM e.{$this->dateColumn}) < p.year_of_birth
            SQL;
    }

    public function sqlTotal(string $cdmSchema, string $vocabSchema): string
    {
        return <<<SQL
            SELECT COUNT(*)::bigint AS count
            FROM {$cdmSchema}.{$this->table}
            WHERE {$this->dateColumn} IS NOT NULL
            SQL;
    }
}
