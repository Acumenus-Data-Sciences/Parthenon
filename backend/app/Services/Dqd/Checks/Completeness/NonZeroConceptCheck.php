<?php

namespace App\Services\Dqd\Checks\Completeness;

use App\Services\Dqd\Checks\AbstractDqdCheck;

/**
 * Checks that concept_id fields are populated with non-zero values (i.e., properly mapped).
 * A concept_id of 0 means "unmapped" in OMOP CDM.
 */
class NonZeroConceptCheck extends AbstractDqdCheck
{
    public function __construct(
        private string $table,
        private string $column,
        private string $desc,
        private float $thresholdPct = 5.0,
    ) {}

    public function checkId(): string
    {
        return "completeness_nonzero_{$this->table}_{$this->column}";
    }

    public function category(): string
    {
        return 'completeness';
    }

    public function subcategory(): string
    {
        return 'measurePersonCompleteness';
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
        return "SELECT COUNT(*)::bigint AS count FROM {$cdmSchema}.{$this->table} WHERE {$this->column} = 0";
    }

    public function sqlTotal(string $cdmSchema, string $vocabSchema): string
    {
        return "SELECT COUNT(*)::bigint AS count FROM {$cdmSchema}.{$this->table}";
    }
}
