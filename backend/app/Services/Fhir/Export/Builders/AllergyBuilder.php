<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export\Builders;

use App\Services\Fhir\Export\ReverseVocabularyService;

class AllergyBuilder
{
    private const CATEGORY_REVERSE = [
        439224 => 'medication',
        4166257 => 'food',
        4196403 => 'environment',
    ];

    public function __construct(
        private readonly ReverseVocabularyService $vocab,
    ) {}

    public function build(object $row): array
    {
        $resource = [
            'resourceType' => 'AllergyIntolerance',
            'id' => "allergy-{$row->observation_id}",
            'patient' => ['reference' => "Patient/{$row->person_id}"],
        ];

        // Category from observation_concept_id (Value-as-Concept reverse)
        $category = self::CATEGORY_REVERSE[$row->observation_concept_id] ?? null;
        if ($category) {
            $resource['category'] = [$category];
        }

        // Substance from value_as_concept_id
        if ($row->value_as_concept_id ?? 0) {
            $resource['code'] = $this->vocab->buildCodeableConcept(
                $row->value_as_concept_id,
                $row->observation_source_concept_id ?? 0,
                $row->observation_source_value ?? null,
            );
        }

        // Recorded date
        if ($row->observation_datetime ?? $row->observation_date ?? null) {
            $resource['recordedDate'] = $row->observation_datetime ?? $row->observation_date;
        }

        return $resource;
    }
}
