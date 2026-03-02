<?php

namespace App\Services\Dqd\Checks\Completeness;

use App\Services\Dqd\Checks\AbstractDqdCheck;

class RequiredFieldCheck extends AbstractDqdCheck
{
    public function __construct(
        private string $table,
        private string $column,
        private string $desc,
    ) {}

    public function checkId(): string
    {
        return "completeness_required_{$this->table}_{$this->column}";
    }

    public function category(): string
    {
        return 'completeness';
    }

    public function subcategory(): string
    {
        return 'isRequired';
    }

    public function cdmTable(): string
    {
        return $this->table;
    }

    public function cdmColumn(): ?string
    {
        return $this->column;
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
