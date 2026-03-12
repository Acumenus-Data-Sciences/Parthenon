<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export\Builders;

use App\Services\Fhir\Export\ReverseVocabularyService;

class EncounterBuilder
{
    private const CLASS_REVERSE = [
        9202 => 'AMB',
        9201 => 'IMP',
        9203 => 'EMER',
        581476 => 'HH',
    ];

    public function __construct(
        private readonly ReverseVocabularyService $vocab,
    ) {}

    public function build(object $row): array
    {
        $classCode = self::CLASS_REVERSE[$row->visit_concept_id] ?? $row->visit_source_value ?? 'AMB';

        $resource = [
            'resourceType' => 'Encounter',
            'id' => (string) $row->visit_occurrence_id,
            'status' => 'finished',
            'class' => [
                'system' => 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                'code' => $classCode,
            ],
            'subject' => ['reference' => "Patient/{$row->person_id}"],
        ];

        // Period
        $period = [];
        if ($row->visit_start_datetime ?? $row->visit_start_date ?? null) {
            $period['start'] = $row->visit_start_datetime ?? $row->visit_start_date;
        }
        if ($row->visit_end_datetime ?? $row->visit_end_date ?? null) {
            $period['end'] = $row->visit_end_datetime ?? $row->visit_end_date;
        }
        if (! empty($period)) {
            $resource['period'] = $period;
        }

        // Provider
        if ($row->provider_id ?? null) {
            $resource['participant'] = [[
                'individual' => ['reference' => "Practitioner/{$row->provider_id}"],
            ]];
        }

        // Care site
        if ($row->care_site_id ?? null) {
            $resource['serviceProvider'] = ['reference' => "Organization/{$row->care_site_id}"];
        }

        return $resource;
    }
}
