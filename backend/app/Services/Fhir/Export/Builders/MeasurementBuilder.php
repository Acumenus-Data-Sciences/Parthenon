<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export\Builders;

use App\Services\Fhir\Export\ReverseVocabularyService;

class MeasurementBuilder
{
    public function __construct(
        private readonly ReverseVocabularyService $vocab,
    ) {}

    public function build(object $row): array
    {
        $resource = [
            'resourceType' => 'Observation',
            'id' => "measurement-{$row->measurement_id}",
            'status' => 'final',
            'code' => $this->vocab->buildCodeableConcept(
                $row->measurement_concept_id,
                $row->measurement_source_concept_id ?? 0,
                $row->measurement_source_value ?? null,
            ),
            'subject' => ['reference' => "Patient/{$row->person_id}"],
            'category' => [[
                'coding' => [[
                    'system' => 'http://terminology.hl7.org/CodeSystem/observation-category',
                    'code' => 'laboratory',
                ]],
            ]],
        ];

        // Effective date
        if ($row->measurement_datetime ?? $row->measurement_date ?? null) {
            $resource['effectiveDateTime'] = $row->measurement_datetime ?? $row->measurement_date;
        }

        // Value
        if ($row->value_as_number ?? null) {
            $quantity = ['value' => (float) $row->value_as_number];
            if ($row->unit_source_value ?? null) {
                $quantity['unit'] = $row->unit_source_value;
                $quantity['code'] = $row->unit_source_value;
                $quantity['system'] = 'http://unitsofmeasure.org';
            }
            $resource['valueQuantity'] = $quantity;
        }

        // Reference range
        if (($row->range_low ?? null) !== null || ($row->range_high ?? null) !== null) {
            $range = [];
            if ($row->range_low !== null) {
                $range['low'] = ['value' => (float) $row->range_low];
            }
            if ($row->range_high !== null) {
                $range['high'] = ['value' => (float) $row->range_high];
            }
            $resource['referenceRange'] = [$range];
        }

        // Visit reference
        if ($row->visit_occurrence_id ?? null) {
            $resource['encounter'] = ['reference' => "Encounter/{$row->visit_occurrence_id}"];
        }

        return $resource;
    }
}
