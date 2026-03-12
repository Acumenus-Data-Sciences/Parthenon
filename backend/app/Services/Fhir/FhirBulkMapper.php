<?php

declare(strict_types=1);

namespace App\Services\Fhir;

use Illuminate\Support\Carbon;

/**
 * Maps FHIR R4 resources to OMOP CDM rows with full vocabulary resolution.
 *
 * Unlike the basic FhirResourceMapper (used for bundle uploads), this mapper:
 * - Resolves concept_ids via the OMOP vocabulary tables
 * - Uses concept-driven domain routing (HL7 Vulcan IG principle)
 * - Resolves person_id, visit_occurrence_id, provider_id via crosswalks
 * - Generates observation_period records
 */
class FhirBulkMapper
{
    /** FHIR gender → OMOP concept_id. */
    private const GENDER_MAP = [
        'male' => 8507,
        'female' => 8532,
        'other' => 44814653,
        'unknown' => 8551,
    ];

    /** FHIR race extension codes → OMOP concept_id. */
    private const RACE_MAP = [
        '2106-3' => 8527,    // White
        '2054-5' => 8516,    // Black or African American
        '2028-9' => 8515,    // Asian
        '1002-5' => 8657,    // American Indian or Alaska Native
        '2076-8' => 8557,    // Native Hawaiian or Other Pacific Islander
    ];

    private const ETHNICITY_MAP = [
        '2135-2' => 38003563, // Hispanic or Latino
        '2186-5' => 38003564, // Not Hispanic or Latino
    ];

    /** FHIR Condition.clinicalStatus → OMOP condition_status_concept_id. */
    private const CONDITION_STATUS_MAP = [
        'active' => 4230359,
        'recurrence' => 4230359,
        'relapse' => 4230359,
        'inactive' => 4201906,
        'remission' => 4201906,
        'resolved' => 4201906,
    ];

    /** FHIR Condition.category → OMOP condition_type_concept_id. */
    private const CONDITION_CATEGORY_MAP = [
        'encounter-diagnosis' => 32817,
        'problem-list-item' => 32840,
    ];

    /** FHIR Encounter.class → OMOP visit_concept_id. */
    private const VISIT_CLASS_MAP = [
        'AMB' => 9202,    // Outpatient
        'IMP' => 9201,    // Inpatient
        'EMER' => 9203,    // Emergency
        'HH' => 581476,  // Home Health
        'OBSENC' => 9201,   // Observation → Inpatient
        'SS' => 9202,    // Short stay → Outpatient
    ];

    public function __construct(
        private readonly VocabularyLookupService $vocab,
        private readonly CrosswalkService $crosswalk,
    ) {}

    /**
     * Map a FHIR resource to one or more OMOP CDM rows.
     *
     * @return list<array{cdm_table: string, data: array<string, mixed>, fhir_resource_type: string, fhir_resource_id: string}>
     */
    public function mapResource(array $resource, string $siteKey): array
    {
        $result = match ($resource['resourceType'] ?? null) {
            'Patient' => $this->mapPatient($resource, $siteKey),
            'Encounter' => $this->mapEncounter($resource, $siteKey),
            'Condition' => $this->mapCondition($resource, $siteKey),
            'MedicationRequest', 'MedicationStatement' => $this->mapMedication($resource, $siteKey),
            'MedicationAdministration' => $this->mapMedicationAdmin($resource, $siteKey),
            'Procedure' => $this->mapProcedure($resource, $siteKey),
            'Observation' => $this->mapObservation($resource, $siteKey),
            'DiagnosticReport' => $this->mapDiagnosticReport($resource, $siteKey),
            'Immunization' => $this->mapImmunization($resource, $siteKey),
            'AllergyIntolerance' => $this->mapAllergyIntolerance($resource, $siteKey),
            default => null,
        };

        if ($result === null || isset($result['__skip'])) { // Used by mapProcedure/mapImmunization status filters (Tasks 5/6)
            return [];
        }

        $fhirType = $resource['resourceType'];
        $fhirId = $resource['id'] ?? '';

        // Normalize: if result has 'cdm_table' key, it's a single row — wrap in array
        if (isset($result['cdm_table'])) {
            $result = [$result];
        }

        // Stamp each row with FHIR metadata
        foreach ($result as &$row) {
            $row['fhir_resource_type'] = $fhirType;
            $row['fhir_resource_id'] = $fhirId;
        }

        return $result;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Resource mappers
    // ──────────────────────────────────────────────────────────────────────────

    private function mapPatient(array $r, string $siteKey): array
    {
        $fhirId = $r['id'] ?? '';
        $personId = $this->crosswalk->resolvePersonId($siteKey, $fhirId);
        $birthDate = isset($r['birthDate']) ? Carbon::parse($r['birthDate']) : null;

        return [
            'cdm_table' => 'person',
            'data' => [
                'person_id' => $personId,
                'gender_concept_id' => self::GENDER_MAP[$r['gender'] ?? ''] ?? 0,
                'gender_source_value' => $r['gender'] ?? null,
                'year_of_birth' => $birthDate?->year,
                'month_of_birth' => $birthDate?->month,
                'day_of_birth' => $birthDate?->day,
                'birth_datetime' => $birthDate?->toDateTimeString(),
                'race_concept_id' => $this->extractRaceConcept($r),
                'race_source_value' => $this->extractExtensionText($r, 'us-core-race'),
                'ethnicity_concept_id' => $this->extractEthnicityConcept($r),
                'ethnicity_source_value' => $this->extractExtensionText($r, 'us-core-ethnicity'),
                'person_source_value' => $fhirId,
            ],
        ];
    }

    private function mapEncounter(array $r, string $siteKey): array
    {
        $fhirId = $r['id'] ?? '';
        $patientRef = $this->extractRef($r['subject'] ?? []);
        $personId = $patientRef ? $this->crosswalk->resolvePersonId($siteKey, $patientRef) : 0;
        $visitId = $this->crosswalk->resolveVisitId($siteKey, $fhirId, $personId);

        $period = $r['period'] ?? [];

        // R4: class is Coding {code: "AMB"}; R5: class is CodeableConcept[] [{coding: [{code: "AMB"}]}]
        $classCode = isset($r['class']['code'])
            ? $r['class']['code']
            : ($r['class'][0]['coding'][0]['code'] ?? '');

        return [
            'cdm_table' => 'visit_occurrence',
            'data' => [
                'visit_occurrence_id' => $visitId,
                'person_id' => $personId,
                'visit_concept_id' => self::VISIT_CLASS_MAP[strtoupper($classCode)] ?? 0,
                'visit_start_date' => $this->parseDate($period['start'] ?? null),
                'visit_start_datetime' => $this->parseDatetime($period['start'] ?? null),
                'visit_end_date' => $this->parseDate($period['end'] ?? null),
                'visit_end_datetime' => $this->parseDatetime($period['end'] ?? null),
                'visit_type_concept_id' => 32817, // EHR
                'visit_source_value' => $classCode,
                'admitted_from_concept_id' => $this->resolveAdmitSource($r),
                'admitted_from_source_value' => $r['hospitalization']['admitSource']['text']
                    ?? $r['hospitalization']['admitSource']['coding'][0]['display'] ?? null,
                'discharged_to_concept_id' => $this->resolveDischargeDisposition($r),
                'discharged_to_source_value' => $r['hospitalization']['dischargeDisposition']['text']
                    ?? $r['hospitalization']['dischargeDisposition']['coding'][0]['display'] ?? null,
                'provider_id' => $this->resolveEncounterProvider($r, $siteKey),
            ],
        ];
    }

    private function mapCondition(array $r, string $siteKey): array
    {
        $codings = $this->extractCodings($r['code'] ?? []);
        $resolved = $this->vocab->resolve($codings);

        // Concept-driven routing: if vocab says domain is Observation, route there
        $cdmTable = $resolved['cdm_table'] ?? 'condition_occurrence';
        if ($cdmTable !== 'condition_occurrence' && $cdmTable !== 'observation') {
            $cdmTable = 'condition_occurrence'; // fallback for conditions
        }

        $personId = $this->resolveSubjectPersonId($r, $siteKey);
        $visitId = $this->resolveEncounterVisitId($r, $siteKey);

        $onset = $r['onsetDateTime'] ?? $r['onsetPeriod']['start'] ?? $r['recordedDate'] ?? null;
        $abatement = $r['abatementDateTime'] ?? $r['abatementPeriod']['end'] ?? null;

        if ($cdmTable === 'observation') {
            return [
                'cdm_table' => 'observation',
                'data' => [
                    'person_id' => $personId,
                    'observation_concept_id' => $resolved['concept_id'],
                    'observation_date' => $this->parseDate($onset),
                    'observation_datetime' => $this->parseDatetime($onset),
                    'observation_type_concept_id' => 32817,
                    'observation_source_value' => $resolved['source_value'],
                    'observation_source_concept_id' => $resolved['source_concept_id'],
                    'visit_occurrence_id' => $visitId,
                ],
            ];
        }

        return [
            'cdm_table' => 'condition_occurrence',
            'data' => [
                'person_id' => $personId,
                'condition_concept_id' => $resolved['concept_id'],
                'condition_start_date' => $this->parseDate($onset),
                'condition_start_datetime' => $this->parseDatetime($onset),
                'condition_end_date' => $this->parseDate($abatement),
                'condition_end_datetime' => $this->parseDatetime($abatement),
                'condition_type_concept_id' => self::CONDITION_CATEGORY_MAP[$this->extractConditionCategory($r) ?? ''] ?? 32817,
                'condition_status_concept_id' => self::CONDITION_STATUS_MAP[$this->extractConditionStatus($r) ?? ''] ?? 0,
                'condition_status_source_value' => $this->extractConditionStatus($r),
                'condition_source_value' => $resolved['source_value'],
                'condition_source_concept_id' => $resolved['source_concept_id'],
                'visit_occurrence_id' => $visitId,
            ],
        ];
    }

    private function mapMedication(array $r, string $siteKey): array
    {
        $codings = $this->extractMedCodings($r);
        $resolved = $this->vocab->resolve($codings);
        $personId = $this->resolveSubjectPersonId($r, $siteKey);
        $visitId = $this->resolveEncounterVisitId($r, $siteKey);

        // Conditional date extraction based on resource type
        if (($r['resourceType'] ?? '') === 'MedicationStatement') {
            $startDate = $r['effectiveDateTime'] ?? $r['effectivePeriod']['start'] ?? null;
            $endDate = $r['effectivePeriod']['end'] ?? $startDate;
            $typeConceptId = 32865; // Patient Self-Reported
        } else {
            // MedicationRequest
            $startDate = $r['authoredOn'] ?? null;
            $duration = $r['dispenseRequest']['expectedSupplyDuration']['value'] ?? null;
            $durationUnit = $r['dispenseRequest']['expectedSupplyDuration']['unit'] ?? 'days';
            $endDate = ($startDate && $duration)
                ? Carbon::parse($startDate)->add($durationUnit, (int) $duration)->toDateString()
                : $startDate;
            $typeConceptId = 32817; // EHR
        }

        // Route concept resolution
        $routeCodings = $r['dosageInstruction'][0]['route']['coding'] ?? [];
        $routeResolved = ! empty($routeCodings) ? $this->vocab->resolve($routeCodings) : null;

        return [
            'cdm_table' => 'drug_exposure',
            'data' => [
                'person_id' => $personId,
                'drug_concept_id' => $resolved['concept_id'],
                'drug_exposure_start_date' => $this->parseDate($startDate),
                'drug_exposure_start_datetime' => $this->parseDatetime($startDate),
                'drug_exposure_end_date' => $this->parseDate($endDate),
                'drug_type_concept_id' => $typeConceptId,
                'drug_source_value' => $resolved['source_value'],
                'drug_source_concept_id' => $resolved['source_concept_id'],
                'visit_occurrence_id' => $visitId,
                'quantity' => $this->extractQuantity($r),
                'sig' => isset($r['dosageInstruction'][0]['text'])
                    ? substr($r['dosageInstruction'][0]['text'], 0, 2000)
                    : null,
                'route_concept_id' => $routeResolved ? $routeResolved['concept_id'] : 0,
                'route_source_value' => $this->extractRoute($r),
            ],
        ];
    }

    private function mapMedicationAdmin(array $r, string $siteKey): array
    {
        $codings = $this->extractMedCodings($r);
        $resolved = $this->vocab->resolve($codings);
        $personId = $this->resolveSubjectPersonId($r, $siteKey);
        $visitId = $this->resolveEncounterVisitId($r, $siteKey, 'context');
        $effective = $r['effectiveDateTime'] ?? $r['effectivePeriod']['start'] ?? null;

        return [
            'cdm_table' => 'drug_exposure',
            'data' => [
                'person_id' => $personId,
                'drug_concept_id' => $resolved['concept_id'],
                'drug_exposure_start_date' => $this->parseDate($effective),
                'drug_exposure_start_datetime' => $this->parseDatetime($effective),
                'drug_exposure_end_date' => $this->parseDate($effective),
                'drug_type_concept_id' => 32818, // Administered
                'drug_source_value' => $resolved['source_value'],
                'drug_source_concept_id' => $resolved['source_concept_id'],
                'visit_occurrence_id' => $visitId,
            ],
        ];
    }

    private function mapProcedure(array $r, string $siteKey): array
    {
        // Status filter: only completed procedures per IG
        if (($r['status'] ?? '') !== 'completed') {
            return ['__skip' => true];
        }

        $codings = $this->extractCodings($r['code'] ?? []);
        $resolved = $this->vocab->resolve($codings);
        $personId = $this->resolveSubjectPersonId($r, $siteKey);
        $visitId = $this->resolveEncounterVisitId($r, $siteKey, 'encounter');
        $performed = $r['performedDateTime'] ?? $r['performedPeriod']['start'] ?? null;
        $performedEnd = $r['performedPeriod']['end'] ?? null;

        // Provider from performer
        $providerRef = $this->extractRef($r['performer'][0]['actor'] ?? []);
        $providerId = $providerRef ? $this->crosswalk->resolveProviderId($siteKey, $providerRef) : null;

        return [
            'cdm_table' => $resolved['cdm_table'] ?? 'procedure_occurrence',
            'data' => [
                'person_id' => $personId,
                'procedure_concept_id' => $resolved['concept_id'],
                'procedure_date' => $this->parseDate($performed),
                'procedure_datetime' => $this->parseDatetime($performed),
                'procedure_end_date' => $this->parseDate($performedEnd),
                'procedure_end_datetime' => $this->parseDatetime($performedEnd),
                'procedure_type_concept_id' => 32817,
                'procedure_source_value' => $resolved['source_value'],
                'procedure_source_concept_id' => $resolved['source_concept_id'],
                'visit_occurrence_id' => $visitId,
                'provider_id' => $providerId,
            ],
        ];
    }

    private function mapObservation(array $r, string $siteKey): array
    {
        $codings = $this->extractCodings($r['code'] ?? []);
        $resolved = $this->vocab->resolve($codings);

        // Concept-driven routing — vocabulary domain overrides category-based heuristic
        $cdmTable = $resolved['cdm_table'];
        if (! $cdmTable) {
            // Fallback to category-based routing
            $category = $this->extractObservationCategory($r);
            $cdmTable = match ($category) {
                'laboratory', 'vital-signs' => 'measurement',
                default => 'observation',
            };
        }

        $personId = $this->resolveSubjectPersonId($r, $siteKey);
        $visitId = $this->resolveEncounterVisitId($r, $siteKey, 'encounter');
        $effective = $r['effectiveDateTime'] ?? $r['effectivePeriod']['start'] ?? $r['issued'] ?? null;

        if ($cdmTable === 'measurement') {
            return [
                'cdm_table' => 'measurement',
                'data' => [
                    'person_id' => $personId,
                    'measurement_concept_id' => $resolved['concept_id'],
                    'measurement_date' => $this->parseDate($effective),
                    'measurement_datetime' => $this->parseDatetime($effective),
                    'measurement_type_concept_id' => 32817,
                    'value_as_number' => $this->extractNumericValue($r),
                    'value_as_concept_id' => $this->extractValueConceptId($r),
                    'unit_source_value' => $this->extractUnit($r),
                    'range_low' => $r['referenceRange'][0]['low']['value'] ?? null,
                    'range_high' => $r['referenceRange'][0]['high']['value'] ?? null,
                    'measurement_source_value' => $resolved['source_value'],
                    'measurement_source_concept_id' => $resolved['source_concept_id'],
                    'visit_occurrence_id' => $visitId,
                ],
            ];
        }

        return [
            'cdm_table' => 'observation',
            'data' => [
                'person_id' => $personId,
                'observation_concept_id' => $resolved['concept_id'],
                'observation_date' => $this->parseDate($effective),
                'observation_datetime' => $this->parseDatetime($effective),
                'observation_type_concept_id' => 32817,
                'value_as_string' => $this->extractValueString($r),
                'value_as_number' => $this->extractNumericValue($r),
                'observation_source_value' => $resolved['source_value'],
                'observation_source_concept_id' => $resolved['source_concept_id'],
                'visit_occurrence_id' => $visitId,
            ],
        ];
    }

    private function mapDiagnosticReport(array $r, string $siteKey): array
    {
        $codings = $this->extractCodings($r['code'] ?? []);
        $resolved = $this->vocab->resolve($codings);
        $personId = $this->resolveSubjectPersonId($r, $siteKey);
        $visitId = $this->resolveEncounterVisitId($r, $siteKey, 'encounter');
        $effective = $r['effectiveDateTime'] ?? $r['effectivePeriod']['start'] ?? $r['issued'] ?? null;

        return [
            'cdm_table' => 'measurement',
            'data' => [
                'person_id' => $personId,
                'measurement_concept_id' => $resolved['concept_id'],
                'measurement_date' => $this->parseDate($effective),
                'measurement_datetime' => $this->parseDatetime($effective),
                'measurement_type_concept_id' => 32817,
                'value_as_string' => substr($r['conclusion'] ?? '', 0, 2000) ?: null,
                'measurement_source_value' => $resolved['source_value'],
                'measurement_source_concept_id' => $resolved['source_concept_id'],
                'visit_occurrence_id' => $visitId,
            ],
        ];
    }

    private function mapImmunization(array $r, string $siteKey): array
    {
        $codings = $this->extractCodings($r['vaccineCode'] ?? []);
        $resolved = $this->vocab->resolve($codings);
        $personId = $this->resolveSubjectPersonId($r, $siteKey, 'patient');
        $occurrence = $r['occurrenceDateTime'] ?? $r['occurrenceString'] ?? null;

        return [
            'cdm_table' => 'drug_exposure',
            'data' => [
                'person_id' => $personId,
                'drug_concept_id' => $resolved['concept_id'],
                'drug_exposure_start_date' => $this->parseDate($occurrence),
                'drug_exposure_start_datetime' => $this->parseDatetime($occurrence),
                'drug_exposure_end_date' => $this->parseDate($occurrence),
                'drug_type_concept_id' => 32817,
                'drug_source_value' => $resolved['source_value'],
                'drug_source_concept_id' => $resolved['source_concept_id'],
            ],
        ];
    }

    private function mapAllergyIntolerance(array $r, string $siteKey): array
    {
        $codings = $this->extractCodings($r['code'] ?? []);
        $resolved = $this->vocab->resolve($codings);
        $personId = $this->resolveSubjectPersonId($r, $siteKey, 'patient');
        $recorded = $r['recordedDate'] ?? $r['onsetDateTime'] ?? null;

        return [
            'cdm_table' => 'observation',
            'data' => [
                'person_id' => $personId,
                'observation_concept_id' => $resolved['concept_id'],
                'observation_date' => $this->parseDate($recorded),
                'observation_datetime' => $this->parseDatetime($recorded),
                'observation_type_concept_id' => 32817,
                'value_as_string' => $r['type'] ?? null,
                'observation_source_value' => $resolved['source_value'],
                'observation_source_concept_id' => $resolved['source_concept_id'],
            ],
        ];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helper methods
    // ──────────────────────────────────────────────────────────────────────────

    private function resolveAdmitSource(array $r): int
    {
        $codings = $r['hospitalization']['admitSource']['coding'] ?? [];
        if (empty($codings)) {
            return 0;
        }
        $resolved = $this->vocab->resolve($codings);

        return $resolved['concept_id'];
    }

    private function resolveDischargeDisposition(array $r): int
    {
        $codings = $r['hospitalization']['dischargeDisposition']['coding'] ?? [];
        if (empty($codings)) {
            return 0;
        }
        $resolved = $this->vocab->resolve($codings);

        return $resolved['concept_id'];
    }

    private function resolveEncounterProvider(array $r, string $siteKey): ?int
    {
        $ref = $this->extractRef($r['participant'][0]['individual'] ?? []);

        return $ref ? $this->crosswalk->resolveProviderId($siteKey, $ref) : null;
    }

    private function extractConditionStatus(array $r): ?string
    {
        return $r['clinicalStatus']['coding'][0]['code'] ?? null;
    }

    private function extractConditionCategory(array $r): ?string
    {
        return $r['category'][0]['coding'][0]['code'] ?? null;
    }

    private function resolveSubjectPersonId(array $r, string $siteKey, string $field = 'subject'): int
    {
        $ref = $this->extractRef($r[$field] ?? []);

        return $ref ? $this->crosswalk->resolvePersonId($siteKey, $ref) : 0;
    }

    private function resolveEncounterVisitId(array $r, string $siteKey, string $field = 'encounter'): ?int
    {
        $ref = $this->extractRef($r[$field] ?? []);
        if (! $ref) {
            return null;
        }

        return $this->crosswalk->lookupVisitId($siteKey, $ref);
    }

    private function extractRef(array $reference): ?string
    {
        $ref = $reference['reference'] ?? null;
        if ($ref === null) {
            return null;
        }
        $parts = explode('/', $ref);

        return end($parts);
    }

    private function extractCodings(array $codeableConcept): array
    {
        return $codeableConcept['coding'] ?? [];
    }

    private function extractMedCodings(array $r): array
    {
        if (isset($r['medicationCodeableConcept'])) {
            return $r['medicationCodeableConcept']['coding'] ?? [];
        }

        return [];
    }

    private function extractObservationCategory(array $r): string
    {
        foreach ($r['category'] ?? [] as $cat) {
            foreach ($cat['coding'] ?? [] as $coding) {
                return $coding['code'] ?? '';
            }
        }

        return '';
    }

    private function extractNumericValue(array $r): ?float
    {
        if (isset($r['valueQuantity']['value'])) {
            return (float) $r['valueQuantity']['value'];
        }

        return null;
    }

    private function extractValueConceptId(array $r): int
    {
        if (isset($r['valueCodeableConcept']['coding'])) {
            $resolved = $this->vocab->resolve($r['valueCodeableConcept']['coding']);

            return $resolved['concept_id'];
        }

        return 0;
    }

    private function extractValueString(array $r): ?string
    {
        if (isset($r['valueString'])) {
            return $r['valueString'];
        }
        if (isset($r['valueCodeableConcept']['text'])) {
            return $r['valueCodeableConcept']['text'];
        }
        if (isset($r['valueQuantity'])) {
            return $r['valueQuantity']['value'].' '.($r['valueQuantity']['unit'] ?? '');
        }

        return null;
    }

    private function extractUnit(array $r): ?string
    {
        return $r['valueQuantity']['unit'] ?? $r['valueQuantity']['code'] ?? null;
    }

    private function extractQuantity(array $r): ?float
    {
        $dose = $r['dosageInstruction'][0]['doseAndRate'][0]['doseQuantity']['value'] ?? null;

        return $dose !== null ? (float) $dose : null;
    }

    private function extractRoute(array $r): ?string
    {
        return $r['dosageInstruction'][0]['route']['text']
            ?? $r['dosageInstruction'][0]['route']['coding'][0]['display']
            ?? null;
    }

    private function extractRaceConcept(array $r): int
    {
        foreach ($r['extension'] ?? [] as $ext) {
            if (str_contains($ext['url'] ?? '', 'us-core-race')) {
                foreach ($ext['extension'] ?? [] as $inner) {
                    if (($inner['url'] ?? '') === 'ombCategory') {
                        return self::RACE_MAP[$inner['valueCoding']['code'] ?? ''] ?? 0;
                    }
                }
            }
        }

        return 0;
    }

    private function extractEthnicityConcept(array $r): int
    {
        foreach ($r['extension'] ?? [] as $ext) {
            if (str_contains($ext['url'] ?? '', 'us-core-ethnicity')) {
                foreach ($ext['extension'] ?? [] as $inner) {
                    if (($inner['url'] ?? '') === 'ombCategory') {
                        return self::ETHNICITY_MAP[$inner['valueCoding']['code'] ?? ''] ?? 0;
                    }
                }
            }
        }

        return 0;
    }

    private function extractExtensionText(array $r, string $urlPart): ?string
    {
        foreach ($r['extension'] ?? [] as $ext) {
            if (str_contains($ext['url'] ?? '', $urlPart)) {
                foreach ($ext['extension'] ?? [] as $inner) {
                    if (($inner['url'] ?? '') === 'text') {
                        return $inner['valueString'] ?? null;
                    }
                }
            }
        }

        return null;
    }

    private function parseDate(?string $value): ?string
    {
        if (! $value) {
            return null;
        }
        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    private function parseDatetime(?string $value): ?string
    {
        if (! $value) {
            return null;
        }
        try {
            return Carbon::parse($value)->toDateTimeString();
        } catch (\Throwable) {
            return null;
        }
    }
}
