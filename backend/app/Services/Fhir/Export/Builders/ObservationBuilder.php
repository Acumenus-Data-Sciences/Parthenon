<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export\Builders;

use App\Services\Fhir\Export\ReverseVocabularyService;

class ObservationBuilder
{
    public function __construct(
        private readonly ReverseVocabularyService $vocab,
    ) {}

    public function build(object $row): array
    {
        $resource = [
            'resourceType' => 'Observation',
            'id' => (string) $row->observation_id,
            'status' => 'final',
            'code' => $this->vocab->buildCodeableConcept(
                $row->observation_concept_id,
                $row->observation_source_concept_id ?? 0,
                $row->observation_source_value ?? null,
            ),
            'subject' => ['reference' => "Patient/{$row->person_id}"],
            'category' => [[
                'coding' => [[
                    'system' => 'http://terminology.hl7.org/CodeSystem/observation-category',
                    'code' => 'social-history',
                ]],
            ]],
        ];

        // Effective date
        if ($row->observation_datetime ?? $row->observation_date ?? null) {
            $resource['effectiveDateTime'] = $row->observation_datetime ?? $row->observation_date;
        }

        // Value
        if ($row->value_as_number ?? null) {
            $resource['valueQuantity'] = ['value' => (float) $row->value_as_number];
        } elseif ($row->value_as_string ?? null) {
            $resource['valueString'] = $row->value_as_string;
        }

        // Value as concept
        if ($row->value_as_concept_id ?? 0) {
            $valueCoding = $this->vocab->resolve($row->value_as_concept_id);
            if (! empty($valueCoding['coding'])) {
                $resource['valueCodeableConcept'] = ['coding' => $valueCoding['coding']];
            }
        }

        // Visit reference
        if ($row->visit_occurrence_id ?? null) {
            $resource['encounter'] = ['reference' => "Encounter/{$row->visit_occurrence_id}"];
        }

        return $resource;
    }
}
