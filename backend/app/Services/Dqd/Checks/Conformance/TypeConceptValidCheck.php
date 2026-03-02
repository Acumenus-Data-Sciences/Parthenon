<?php

namespace App\Services\Dqd\Checks\Conformance;

use App\Services\Dqd\Checks\AbstractDqdCheck;

/**
 * Checks that type_concept_id values exist in the vocabulary.
 * Type concepts indicate the provenance of the data (e.g., EHR, claim, etc.).
 */
class TypeConceptValidCheck extends AbstractDqdCheck
{
    public function __construct(
        private string $table,
        private string $column,
        private string $desc,
    ) {}

    public function checkId(): string
    {
        return "conformance_typeConceptValid_{$this->table}_{$this->column}";
    }

    public function category(): string
    {
        return 'conformance';
    }

    public function subcategory(): string
    {
        return 'typeConceptValid';
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

    public function description(): string
    {
        return $this->desc;
    }

    public function sqlViolated(string $cdmSchema, string $vocabSchema): string
    {
        return <<<SQL
            SELECT COUNT(*)::bigint AS count
            FROM {$cdmSchema}.{$this->table} t
            LEFT JOIN {$vocabSchema}.concept c ON t.{$this->column} = c.concept_id
            WHERE t.{$this->column} != 0
              AND t.{$this->column} IS NOT NULL
              AND c.concept_id IS NULL
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
