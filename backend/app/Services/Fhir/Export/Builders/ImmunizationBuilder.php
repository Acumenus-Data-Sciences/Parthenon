<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export\Builders;

use App\Services\Fhir\Export\ReverseVocabularyService;

class ImmunizationBuilder
{
    public function __construct(
        private readonly ReverseVocabularyService $vocab,
    ) {}

    public function build(object $row): array
    {
        $resource = [
            'resourceType' => 'Immunization',
            'id' => "imm-{$row->drug_exposure_id}",
            'status' => 'completed',
            'vaccineCode' => $this->vocab->buildCodeableConcept(
                $row->drug_concept_id,
                $row->drug_source_concept_id ?? 0,
                $row->drug_source_value ?? null,
            ),
            'patient' => ['reference' => "Patient/{$row->person_id}"],
        ];

        // Occurrence date
        if ($row->drug_exposure_start_datetime ?? $row->drug_exposure_start_date ?? null) {
            $resource['occurrenceDateTime'] = $row->drug_exposure_start_datetime ?? $row->drug_exposure_start_date;
        }

        // Lot number
        if ($row->lot_number ?? null) {
            $resource['lotNumber'] = $row->lot_number;
        }

        // Route
        if ($row->route_source_value ?? null) {
            $resource['route'] = ['text' => $row->route_source_value];
        }

        // Dose quantity
        if ($row->quantity ?? null) {
            $resource['doseQuantity'] = [
                'value' => (float) $row->quantity,
            ];
            if ($row->dose_unit_source_value ?? null) {
                $resource['doseQuantity']['unit'] = $row->dose_unit_source_value;
            }
        }

        return $resource;
    }
}
