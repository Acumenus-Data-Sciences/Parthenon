<?php

declare(strict_types=1);

namespace App\Services\Ingestion;

use Illuminate\Support\Carbon;

class FhirResourceMapper
{
    /**
     * FHIR code system URI to OMOP vocabulary_id mapping.
     */
    private const CODE_SYSTEM_MAP = [
        'http://snomed.info/sct' => 'SNOMED',
        'http://www.nlm.nih.gov/research/umls/rxnorm' => 'RxNorm',
        'http://loinc.org' => 'LOINC',
        'http://hl7.org/fhir/sid/icd-10-cm' => 'ICD10CM',
        'http://hl7.org/fhir/sid/icd-10' => 'ICD10',
        'http://hl7.org/fhir/sid/icd-9-cm' => 'ICD9CM',
        'http://hl7.org/fhir/sid/cvx' => 'CVX',
        'http://hl7.org/fhir/sid/ndc' => 'NDC',
        'http://www.ama-assn.org/go/cpt' => 'CPT4',
        'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets' => 'HCPCS',
        'urn:oid:2.16.840.1.113883.6.238' => 'Race',
        'urn:oid:2.16.840.1.113883.6.12' => 'CPT4',
    ];

    /**
     * FHIR gender to OMOP concept_id mapping.
     */
    private const GENDER_MAP = [
        'male' => 8507,
        'female' => 8532,
        'other' => 8521,
        'unknown' => 8551,
    ];

    /**
     * FHIR race extension URL to concept_id.
     */
    private const RACE_MAP = [
        '2106-3' => 8527, // White
        '2054-5' => 8516, // Black or African American
        '2028-9' => 8515, // Asian
        '1002-5' => 8657, // American Indian or Alaska Native
        '2076-8' => 8557, // Native Hawaiian or Other Pacific Islander
    ];

    private const ETHNICITY_MAP = [
        '2135-2' => 38003563, // Hispanic or Latino
        '2186-5' => 38003564, // Not Hispanic or Latino
    ];

    public function mapPatient(array $resource): array
    {
        $birthDate = isset($resource['birthDate']) ? Carbon::parse($resource['birthDate']) : null;

        $genderConceptId = self::GENDER_MAP[$resource['gender'] ?? 'unknown'] ?? 8551;

        $raceConceptId = 0;
        $ethnicityConceptId = 0;

        foreach ($resource['extension'] ?? [] as $ext) {
            $url = $ext['url'] ?? '';
            if (str_contains($url, 'us-core-race')) {
                foreach ($ext['extension'] ?? [] as $inner) {
                    if (($inner['url'] ?? '') === 'ombCategory') {
                        $code = $inner['valueCoding']['code'] ?? '';
                        $raceConceptId = self::RACE_MAP[$code] ?? 0;
                    }
                }
            } elseif (str_contains($url, 'us-core-ethnicity')) {
                foreach ($ext['extension'] ?? [] as $inner) {
                    if (($inner['url'] ?? '') === 'ombCategory') {
                        $code = $inner['valueCoding']['code'] ?? '';
                        $ethnicityConceptId = self::ETHNICITY_MAP[$code] ?? 0;
                    }
                }
            }
        }

        return [
            'cdm_table' => 'person',
            'data' => [
                'person_source_value' => $this->extractId($resource),
                'gender_concept_id' => $genderConceptId,
                'gender_source_value' => $resource['gender'] ?? null,
                'year_of_birth' => $birthDate?->year,
                'month_of_birth' => $birthDate?->month,
                'day_of_birth' => $birthDate?->day,
                'birth_datetime' => $birthDate?->toDateTimeString(),
                'race_concept_id' => $raceConceptId,
                'race_source_value' => $this->extractRaceSource($resource),
                'ethnicity_concept_id' => $ethnicityConceptId,
                'ethnicity_source_value' => $this->extractEthnicitySource($resource),
            ],
        ];
    }

    public function mapEncounter(array $resource): array
    {
        $period = $resource['period'] ?? [];
        $typeCode = $this->extractFirstCode($resource['type'] ?? []);

        return [
            'cdm_table' => 'visit_occurrence',
            'data' => [
                'person_source_value' => $this->extractReference($resource['subject'] ?? []),
                'visit_start_date' => isset($period['start']) ? Carbon::parse($period['start'])->toDateString() : null,
                'visit_start_datetime' => isset($period['start']) ? Carbon::parse($period['start'])->toDateTimeString() : null,
                'visit_end_date' => isset($period['end']) ? Carbon::parse($period['end'])->toDateString() : null,
                'visit_end_datetime' => isset($period['end']) ? Carbon::parse($period['end'])->toDateTimeString() : null,
                'visit_concept_id' => 0, // Resolved via concept mapping
                'visit_source_value' => $typeCode['code'] ?? null,
                'visit_source_concept_id' => 0,
                'visit_type_concept_id' => 32817, // EHR
                'source_vocabulary_id' => $this->resolveVocabulary($typeCode['system'] ?? ''),
            ],
        ];
    }

    public function mapCondition(array $resource): array
    {
        $code = $this->extractCodeableConcept($resource['code'] ?? []);
        $onset = $resource['onsetDateTime'] ?? $resource['onsetPeriod']['start'] ?? $resource['recordedDate'] ?? null;
        $abatement = $resource['abatementDateTime'] ?? $resource['abatementPeriod']['end'] ?? null;

        return [
            'cdm_table' => 'condition_occurrence',
            'data' => [
                'person_source_value' => $this->extractReference($resource['subject'] ?? []),
                'condition_start_date' => $onset ? Carbon::parse($onset)->toDateString() : null,
                'condition_start_datetime' => $onset ? Carbon::parse($onset)->toDateTimeString() : null,
                'condition_end_date' => $abatement ? Carbon::parse($abatement)->toDateString() : null,
                'condition_end_datetime' => $abatement ? Carbon::parse($abatement)->toDateTimeString() : null,
                'condition_concept_id' => 0,
                'condition_source_value' => $code['code'] ?? null,
                'condition_source_concept_id' => 0,
                'condition_type_concept_id' => 32817,
                'source_vocabulary_id' => $this->resolveVocabulary($code['system'] ?? ''),
            ],
        ];
    }

    public function mapMedicationRequest(array $resource): array
    {
        $code = $this->extractMedicationCode($resource);
        $authored = $resource['authoredOn'] ?? null;

        return [
            'cdm_table' => 'drug_exposure',
            'data' => [
                'person_source_value' => $this->extractReference($resource['subject'] ?? []),
                'drug_exposure_start_date' => $authored ? Carbon::parse($authored)->toDateString() : null,
                'drug_exposure_start_datetime' => $authored ? Carbon::parse($authored)->toDateTimeString() : null,
                'drug_exposure_end_date' => $authored ? Carbon::parse($authored)->toDateString() : null,
                'drug_concept_id' => 0,
                'drug_source_value' => $code['code'] ?? null,
                'drug_source_concept_id' => 0,
                'drug_type_concept_id' => 32817,
                'source_vocabulary_id' => $this->resolveVocabulary($code['system'] ?? ''),
            ],
        ];
    }

    public function mapProcedure(array $resource): array
    {
        $code = $this->extractCodeableConcept($resource['code'] ?? []);
        $performed = $resource['performedDateTime'] ?? $resource['performedPeriod']['start'] ?? null;

        return [
            'cdm_table' => 'procedure_occurrence',
            'data' => [
                'person_source_value' => $this->extractReference($resource['subject'] ?? []),
                'procedure_date' => $performed ? Carbon::parse($performed)->toDateString() : null,
                'procedure_datetime' => $performed ? Carbon::parse($performed)->toDateTimeString() : null,
                'procedure_concept_id' => 0,
                'procedure_source_value' => $code['code'] ?? null,
                'procedure_source_concept_id' => 0,
                'procedure_type_concept_id' => 32817,
                'source_vocabulary_id' => $this->resolveVocabulary($code['system'] ?? ''),
            ],
        ];
    }

    public function mapObservation(array $resource): array
    {
        $code = $this->extractCodeableConcept($resource['code'] ?? []);
        $effective = $resource['effectiveDateTime'] ?? $resource['effectivePeriod']['start'] ?? $resource['issued'] ?? null;

        // Determine CDM table based on category
        $category = $this->extractObservationCategory($resource);
        $cdmTable = match ($category) {
            'laboratory', 'vital-signs' => 'measurement',
            default => 'observation',
        };

        $mapped = [
            'cdm_table' => $cdmTable,
            'data' => [
                'person_source_value' => $this->extractReference($resource['subject'] ?? []),
                'source_vocabulary_id' => $this->resolveVocabulary($code['system'] ?? ''),
            ],
        ];

        if ($cdmTable === 'measurement') {
            $mapped['data'] += [
                'measurement_date' => $effective ? Carbon::parse($effective)->toDateString() : null,
                'measurement_datetime' => $effective ? Carbon::parse($effective)->toDateTimeString() : null,
                'measurement_concept_id' => 0,
                'measurement_source_value' => $code['code'] ?? null,
                'measurement_source_concept_id' => 0,
                'measurement_type_concept_id' => 32817,
                'value_as_number' => $this->extractNumericValue($resource),
                'value_source_value' => $this->extractValueString($resource),
                'unit_source_value' => $this->extractUnit($resource),
            ];
        } else {
            $mapped['data'] += [
                'observation_date' => $effective ? Carbon::parse($effective)->toDateString() : null,
                'observation_datetime' => $effective ? Carbon::parse($effective)->toDateTimeString() : null,
                'observation_concept_id' => 0,
                'observation_source_value' => $code['code'] ?? null,
                'observation_source_concept_id' => 0,
                'observation_type_concept_id' => 32817,
                'value_as_string' => $this->extractValueString($resource),
                'value_as_number' => $this->extractNumericValue($resource),
                'unit_source_value' => $this->extractUnit($resource),
            ];
        }

        return $mapped;
    }

    public function mapDiagnosticReport(array $resource): array
    {
        $code = $this->extractCodeableConcept($resource['code'] ?? []);
        $effective = $resource['effectiveDateTime'] ?? $resource['effectivePeriod']['start'] ?? $resource['issued'] ?? null;
        $conclusion = $resource['conclusion'] ?? null;

        return [
            'cdm_table' => 'measurement',
            'data' => [
                'person_source_value' => $this->extractReference($resource['subject'] ?? []),
                'measurement_date' => $effective ? Carbon::parse($effective)->toDateString() : null,
                'measurement_datetime' => $effective ? Carbon::parse($effective)->toDateTimeString() : null,
                'measurement_concept_id' => 0,
                'measurement_source_value' => $code['code'] ?? null,
                'measurement_source_concept_id' => 0,
                'measurement_type_concept_id' => 32817,
                'value_as_string' => $conclusion,
                'source_vocabulary_id' => $this->resolveVocabulary($code['system'] ?? ''),
            ],
        ];
    }

    public function mapImmunization(array $resource): array
    {
        $code = $this->extractCodeableConcept($resource['vaccineCode'] ?? []);
        $occurrence = $resource['occurrenceDateTime'] ?? $resource['occurrenceString'] ?? null;

        return [
            'cdm_table' => 'drug_exposure',
            'data' => [
                'person_source_value' => $this->extractReference($resource['patient'] ?? []),
                'drug_exposure_start_date' => $occurrence ? Carbon::parse($occurrence)->toDateString() : null,
                'drug_exposure_start_datetime' => $occurrence ? Carbon::parse($occurrence)->toDateTimeString() : null,
                'drug_exposure_end_date' => $occurrence ? Carbon::parse($occurrence)->toDateString() : null,
                'drug_concept_id' => 0,
                'drug_source_value' => $code['code'] ?? null,
                'drug_source_concept_id' => 0,
                'drug_type_concept_id' => 32817,
                'source_vocabulary_id' => $this->resolveVocabulary($code['system'] ?? ''),
            ],
        ];
    }

    public function mapClaim(array $resource): array
    {
        $period = $resource['billablePeriod'] ?? [];
        $total = $resource['total'] ?? [];

        return [
            'cdm_table' => 'cost',
            'data' => [
                'person_source_value' => $this->extractReference($resource['patient'] ?? []),
                'cost_date' => isset($period['start']) ? Carbon::parse($period['start'])->toDateString() : null,
                'total_charge' => $total['value'] ?? null,
                'currency_concept_id' => ($total['currency'] ?? 'USD') === 'USD' ? 44818668 : 0,
                'cost_type_concept_id' => 32817,
            ],
        ];
    }

    public function mapResource(array $resource): ?array
    {
        return match ($resource['resourceType'] ?? null) {
            'Patient' => $this->mapPatient($resource),
            'Encounter' => $this->mapEncounter($resource),
            'Condition' => $this->mapCondition($resource),
            'MedicationRequest', 'MedicationStatement' => $this->mapMedicationRequest($resource),
            'Procedure' => $this->mapProcedure($resource),
            'Observation' => $this->mapObservation($resource),
            'DiagnosticReport' => $this->mapDiagnosticReport($resource),
            'Immunization' => $this->mapImmunization($resource),
            'Claim' => $this->mapClaim($resource),
            default => null,
        };
    }

    private function resolveVocabulary(string $system): ?string
    {
        return self::CODE_SYSTEM_MAP[$system] ?? null;
    }

    private function extractId(array $resource): ?string
    {
        return $resource['id'] ?? null;
    }

    private function extractReference(array $reference): ?string
    {
        $ref = $reference['reference'] ?? null;
        if ($ref === null) {
            return null;
        }

        // Extract ID from "Patient/123" format
        $parts = explode('/', $ref);

        return end($parts);
    }

    private function extractCodeableConcept(array $codeableConcept): array
    {
        $codings = $codeableConcept['coding'] ?? [];

        return $codings[0] ?? ['code' => $codeableConcept['text'] ?? null, 'system' => ''];
    }

    private function extractFirstCode(array $types): array
    {
        foreach ($types as $type) {
            $codings = $type['coding'] ?? [];
            if (! empty($codings)) {
                return $codings[0];
            }
        }

        return [];
    }

    private function extractMedicationCode(array $resource): array
    {
        if (isset($resource['medicationCodeableConcept'])) {
            return $this->extractCodeableConcept($resource['medicationCodeableConcept']);
        }

        return ['code' => null, 'system' => ''];
    }

    private function extractObservationCategory(array $resource): string
    {
        foreach ($resource['category'] ?? [] as $category) {
            foreach ($category['coding'] ?? [] as $coding) {
                return $coding['code'] ?? '';
            }
        }

        return '';
    }

    private function extractNumericValue(array $resource): ?float
    {
        if (isset($resource['valueQuantity']['value'])) {
            return (float) $resource['valueQuantity']['value'];
        }

        return null;
    }

    private function extractValueString(array $resource): ?string
    {
        if (isset($resource['valueString'])) {
            return $resource['valueString'];
        }
        if (isset($resource['valueCodeableConcept'])) {
            return $resource['valueCodeableConcept']['text']
                ?? ($resource['valueCodeableConcept']['coding'][0]['display'] ?? null);
        }
        if (isset($resource['valueQuantity'])) {
            return $resource['valueQuantity']['value'].' '.($resource['valueQuantity']['unit'] ?? '');
        }

        return null;
    }

    private function extractUnit(array $resource): ?string
    {
        return $resource['valueQuantity']['unit'] ?? $resource['valueQuantity']['code'] ?? null;
    }

    private function extractRaceSource(array $resource): ?string
    {
        foreach ($resource['extension'] ?? [] as $ext) {
            if (str_contains($ext['url'] ?? '', 'us-core-race')) {
                foreach ($ext['extension'] ?? [] as $inner) {
                    if (($inner['url'] ?? '') === 'text') {
                        return $inner['valueString'] ?? null;
                    }
                }
            }
        }

        return null;
    }

    private function extractEthnicitySource(array $resource): ?string
    {
        foreach ($resource['extension'] ?? [] as $ext) {
            if (str_contains($ext['url'] ?? '', 'us-core-ethnicity')) {
                foreach ($ext['extension'] ?? [] as $inner) {
                    if (($inner['url'] ?? '') === 'text') {
                        return $inner['valueString'] ?? null;
                    }
                }
            }
        }

        return null;
    }
}
