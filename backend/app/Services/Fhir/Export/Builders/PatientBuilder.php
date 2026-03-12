<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export\Builders;

use App\Services\Fhir\Export\ReverseVocabularyService;

class PatientBuilder
{
    private const GENDER_REVERSE = [
        8507 => 'male',
        8532 => 'female',
        44814653 => 'other',
        8551 => 'unknown',
    ];

    public function __construct(
        private readonly ReverseVocabularyService $vocab,
    ) {}

    /**
     * Build a FHIR Patient resource from an OMOP person row.
     *
     * @param  object  $person  OMOP person row (stdClass)
     * @param  object|null  $death  OMOP death row if deceased
     * @return array<string, mixed>  FHIR R4 Patient resource
     */
    public function build(object $person, ?object $death = null): array
    {
        $resource = [
            'resourceType' => 'Patient',
            'id' => (string) $person->person_id,
            'gender' => self::GENDER_REVERSE[$person->gender_concept_id] ?? 'unknown',
        ];

        // Birth date
        if ($person->year_of_birth) {
            $month = str_pad((string) ($person->month_of_birth ?? 1), 2, '0', STR_PAD_LEFT);
            $day = str_pad((string) ($person->day_of_birth ?? 1), 2, '0', STR_PAD_LEFT);
            $resource['birthDate'] = "{$person->year_of_birth}-{$month}-{$day}";
        }

        // Deceased
        if ($death) {
            if ($death->death_datetime) {
                $resource['deceasedDateTime'] = $death->death_datetime;
            } else {
                $resource['deceasedBoolean'] = true;
            }
        }

        // Race extension (US Core)
        if ($person->race_concept_id && $person->race_concept_id > 0) {
            $raceCoding = $this->vocab->resolve($person->race_concept_id);
            if (! empty($raceCoding['coding'])) {
                $resource['extension'][] = [
                    'url' => 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race',
                    'extension' => [
                        [
                            'url' => 'ombCategory',
                            'valueCoding' => $raceCoding['coding'][0],
                        ],
                        [
                            'url' => 'text',
                            'valueString' => $person->race_source_value ?? $raceCoding['coding'][0]['display'],
                        ],
                    ],
                ];
            }
        }

        // Ethnicity extension (US Core)
        if ($person->ethnicity_concept_id && $person->ethnicity_concept_id > 0) {
            $ethCoding = $this->vocab->resolve($person->ethnicity_concept_id);
            if (! empty($ethCoding['coding'])) {
                $resource['extension'][] = [
                    'url' => 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity',
                    'extension' => [
                        [
                            'url' => 'ombCategory',
                            'valueCoding' => $ethCoding['coding'][0],
                        ],
                        [
                            'url' => 'text',
                            'valueString' => $person->ethnicity_source_value ?? $ethCoding['coding'][0]['display'],
                        ],
                    ],
                ];
            }
        }

        return $resource;
    }
}
