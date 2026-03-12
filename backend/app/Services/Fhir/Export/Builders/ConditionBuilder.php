<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export\Builders;

use App\Services\Fhir\Export\ReverseVocabularyService;

class ConditionBuilder
{
    private const STATUS_REVERSE = [
        4230359 => 'active',
        4201906 => 'resolved',
    ];

    private const CATEGORY_REVERSE = [
        32817 => 'encounter-diagnosis',
        32840 => 'problem-list-item',
    ];

    public function __construct(
        private readonly ReverseVocabularyService $vocab,
    ) {}

    /**
     * Build a FHIR Condition resource from an OMOP condition_occurrence row.
     *
     * @return array<string, mixed>  FHIR R4 Condition resource
     */
    public function build(object $row): array
    {
        $resource = [
            'resourceType' => 'Condition',
            'id' => (string) $row->condition_occurrence_id,
            'subject' => ['reference' => "Patient/{$row->person_id}"],
            'code' => $this->vocab->buildCodeableConcept(
                $row->condition_concept_id,
                $row->condition_source_concept_id ?? 0,
                $row->condition_source_value ?? null,
            ),
        ];

        // Clinical status
        $statusCode = self::STATUS_REVERSE[$row->condition_status_concept_id ?? 0] ?? null;
        if ($statusCode) {
            $resource['clinicalStatus'] = [
                'coding' => [[
                    'system' => 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                    'code' => $statusCode,
                ]],
            ];
        }

        // Category
        $categoryCode = self::CATEGORY_REVERSE[$row->condition_type_concept_id ?? 0] ?? null;
        if ($categoryCode) {
            $resource['category'] = [[
                'coding' => [[
                    'system' => 'http://terminology.hl7.org/CodeSystem/condition-category',
                    'code' => $categoryCode,
                ]],
            ]];
        }

        // Onset
        if ($row->condition_start_datetime ?? null) {
            $resource['onsetDateTime'] = $row->condition_start_datetime;
        } elseif ($row->condition_start_date ?? null) {
            $resource['onsetDateTime'] = $row->condition_start_date;
        }

        // Abatement
        if ($row->condition_end_datetime ?? null) {
            $resource['abatementDateTime'] = $row->condition_end_datetime;
        } elseif ($row->condition_end_date ?? null) {
            $resource['abatementDateTime'] = $row->condition_end_date;
        }

        // Visit reference
        if ($row->visit_occurrence_id ?? null) {
            $resource['encounter'] = ['reference' => "Encounter/{$row->visit_occurrence_id}"];
        }

        return $resource;
    }
}
