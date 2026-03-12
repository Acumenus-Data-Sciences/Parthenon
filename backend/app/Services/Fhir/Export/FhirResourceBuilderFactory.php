<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export;

use App\Services\Fhir\Export\Builders\ConditionBuilder;
use App\Services\Fhir\Export\Builders\PatientBuilder;

class FhirResourceBuilderFactory
{
    public function __construct(
        private readonly ReverseVocabularyService $vocab,
    ) {}

    public function patient(): PatientBuilder
    {
        return new PatientBuilder($this->vocab);
    }

    public function condition(): ConditionBuilder
    {
        return new ConditionBuilder($this->vocab);
    }

    /**
     * Get builder by CDM table name.
     */
    public function forTable(string $cdmTable): ?object
    {
        return match ($cdmTable) {
            'person' => $this->patient(),
            'condition_occurrence' => $this->condition(),
            default => null,
        };
    }
}
