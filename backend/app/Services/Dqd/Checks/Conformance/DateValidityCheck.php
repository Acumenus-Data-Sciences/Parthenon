<?php

namespace App\Services\Dqd\Checks\Conformance;

use App\Services\Dqd\Checks\AbstractDqdCheck;

/**
 * Checks that date ordering is valid (start_date <= end_date).
 * Only considers rows where the end_date is not null (since end_date is often optional).
 */
class DateValidityCheck extends AbstractDqdCheck
{
    public function __construct(
        private string $table,
        private string $startColumn,
        private string $endColumn,
        private string $desc,
    ) {}

    public function checkId(): string
    {
        return "conformance_dateOrder_{$this->table}_{$this->startColumn}";
    }

    public function category(): string
    {
        return 'conformance';
    }

    public function subcategory(): string
    {
        return 'dateValidity';
    }

    public function cdmTable(): string
    {
        return $this->table;
    }

    public function cdmColumn(): ?string
    {
        return "{$this->startColumn},{$this->endColumn}";
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
            FROM {$cdmSchema}.{$this->table}
            WHERE {$this->endColumn} IS NOT NULL
              AND {$this->startColumn} > {$this->endColumn}
            SQL;
    }

    public function sqlTotal(string $cdmSchema, string $vocabSchema): string
    {
        return <<<SQL
            SELECT COUNT(*)::bigint AS count
            FROM {$cdmSchema}.{$this->table}
            WHERE {$this->endColumn} IS NOT NULL
            SQL;
    }
}
