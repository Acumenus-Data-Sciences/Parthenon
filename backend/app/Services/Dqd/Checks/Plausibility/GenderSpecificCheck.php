<?php

namespace App\Services\Dqd\Checks\Plausibility;

use App\Services\Dqd\Checks\AbstractDqdCheck;

/**
 * Checks for gender-specific conditions appearing in the wrong gender.
 * Uses OMOP concept hierarchy to identify gender-specific concepts.
 */
class GenderSpecificCheck extends AbstractDqdCheck
{
    /**
     * @param  string  $table  CDM event table
     * @param  string  $conceptColumn  The concept_id column in the event table
     * @param  int  $genderConceptId  The gender concept_id to check against (8507=Male, 8532=Female)
     * @param  string  $genderLabel  Human-readable gender label
     * @param  string  $conceptClassId  The concept_class_id that indicates gender-specificity
     * @param  string  $desc  Description of this check
     */
    public function __construct(
        private string $table,
        private string $conceptColumn,
        private int $genderConceptId,
        private string $genderLabel,
        private string $conceptClassId,
        private string $desc,
    ) {}

    public function checkId(): string
    {
        return "plausibility_genderSpecific_{$this->table}_{$this->genderLabel}";
    }

    public function category(): string
    {
        return 'plausibility';
    }

    public function subcategory(): string
    {
        return 'plausibleGender';
    }

    public function cdmTable(): string
    {
        return $this->table;
    }

    public function cdmColumn(): ?string
    {
        return $this->conceptColumn;
    }

    public function severity(): string
    {
        return 'warning';
    }

    public function threshold(): float
    {
        return 1.0;
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
            JOIN {$vocabSchema}.concept c ON e.{$this->conceptColumn} = c.concept_id
            WHERE c.concept_class_id = '{$this->conceptClassId}'
              AND p.gender_concept_id = {$this->genderConceptId}
            SQL;
    }

    public function sqlTotal(string $cdmSchema, string $vocabSchema): string
    {
        return <<<SQL
            SELECT COUNT(*)::bigint AS count
            FROM {$cdmSchema}.{$this->table} e
            JOIN {$vocabSchema}.concept c ON e.{$this->conceptColumn} = c.concept_id
            WHERE c.concept_class_id = '{$this->conceptClassId}'
            SQL;
    }
}
