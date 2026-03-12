<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export\Builders;

use App\Services\Fhir\Export\ReverseVocabularyService;

class ProcedureBuilder
{
    public function __construct(
        private readonly ReverseVocabularyService $vocab,
    ) {}

    public function build(object $row): array
    {
        $resource = [
            'resourceType' => 'Procedure',
            'id' => (string) $row->procedure_occurrence_id,
            'status' => 'completed',
            'code' => $this->vocab->buildCodeableConcept(
                $row->procedure_concept_id,
                $row->procedure_source_concept_id ?? 0,
                $row->procedure_source_value ?? null,
            ),
            'subject' => ['reference' => "Patient/{$row->person_id}"],
        ];

        // Performed period
        $period = [];
        if ($row->procedure_datetime ?? $row->procedure_date ?? null) {
            $period['start'] = $row->procedure_datetime ?? $row->procedure_date;
        }
        if ($row->procedure_end_datetime ?? $row->procedure_end_date ?? null) {
            $period['end'] = $row->procedure_end_datetime ?? $row->procedure_end_date;
        }
        if (! empty($period)) {
            $resource['performedPeriod'] = $period;
        }

        // Provider
        if ($row->provider_id ?? null) {
            $resource['performer'] = [[
                'actor' => ['reference' => "Practitioner/{$row->provider_id}"],
            ]];
        }

        // Visit reference
        if ($row->visit_occurrence_id ?? null) {
            $resource['encounter'] = ['reference' => "Encounter/{$row->visit_occurrence_id}"];
        }

        return $resource;
    }
}
