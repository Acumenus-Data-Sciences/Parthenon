<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export\Builders;

use App\Services\Fhir\Export\ReverseVocabularyService;

class MedicationBuilder
{
    public function __construct(
        private readonly ReverseVocabularyService $vocab,
    ) {}

    public function build(object $row): array
    {
        $resource = [
            'resourceType' => 'MedicationStatement',
            'id' => (string) $row->drug_exposure_id,
            'status' => 'active',
            'medicationCodeableConcept' => $this->vocab->buildCodeableConcept(
                $row->drug_concept_id,
                $row->drug_source_concept_id ?? 0,
                $row->drug_source_value ?? null,
            ),
            'subject' => ['reference' => "Patient/{$row->person_id}"],
        ];

        // Effective period
        $period = [];
        if ($row->drug_exposure_start_datetime ?? $row->drug_exposure_start_date ?? null) {
            $period['start'] = $row->drug_exposure_start_datetime ?? $row->drug_exposure_start_date;
        }
        if ($row->drug_exposure_end_date ?? null) {
            $period['end'] = $row->drug_exposure_end_date;
        }
        if (! empty($period)) {
            $resource['effectivePeriod'] = $period;
        }

        // Dosage
        $dosage = [];
        if ($row->sig ?? null) {
            $dosage['text'] = $row->sig;
        }
        if ($row->route_source_value ?? null) {
            $dosage['route'] = ['text' => $row->route_source_value];
        }
        if (! empty($dosage)) {
            $resource['dosage'] = [$dosage];
        }

        // Visit reference
        if ($row->visit_occurrence_id ?? null) {
            $resource['context'] = ['reference' => "Encounter/{$row->visit_occurrence_id}"];
        }

        return $resource;
    }
}
