<?php

use App\Services\Ingestion\FhirResourceMapper;

// ---------------------------------------------------------------------------
// FhirResourceMapper — FHIR-to-CDM transformation fidelity tests
// ---------------------------------------------------------------------------
describe('FhirResourceMapper', function () {

    beforeEach(function () {
        $this->mapper = new FhirResourceMapper;
    });

    // -----------------------------------------------------------------------
    // Patient mapping
    // -----------------------------------------------------------------------
    describe('mapPatient', function () {
        it('maps female gender to OMOP concept 8532', function () {
            $result = $this->mapper->mapPatient([
                'resourceType' => 'Patient',
                'id' => 'pt-001',
                'gender' => 'female',
                'birthDate' => '1985-06-15',
            ]);

            expect($result['cdm_table'])->toBe('person');
            expect($result['data']['gender_concept_id'])->toBe(8532);
            expect($result['data']['gender_source_value'])->toBe('female');
        });

        it('maps male gender to OMOP concept 8507', function () {
            $result = $this->mapper->mapPatient([
                'resourceType' => 'Patient',
                'id' => 'pt-002',
                'gender' => 'male',
                'birthDate' => '1990-01-01',
            ]);

            expect($result['data']['gender_concept_id'])->toBe(8507);
            expect($result['data']['gender_source_value'])->toBe('male');
        });

        it('maps other gender to OMOP concept 8521', function () {
            $result = $this->mapper->mapPatient([
                'id' => 'pt-003',
                'gender' => 'other',
            ]);

            expect($result['data']['gender_concept_id'])->toBe(8521);
        });

        it('maps unknown gender to OMOP concept 8551', function () {
            $result = $this->mapper->mapPatient([
                'id' => 'pt-004',
                'gender' => 'unknown',
            ]);

            expect($result['data']['gender_concept_id'])->toBe(8551);
        });

        it('defaults to unknown (8551) when gender is missing', function () {
            $result = $this->mapper->mapPatient([
                'id' => 'pt-005',
            ]);

            expect($result['data']['gender_concept_id'])->toBe(8551);
        });

        it('parses birth date components correctly', function () {
            $result = $this->mapper->mapPatient([
                'id' => 'pt-006',
                'gender' => 'female',
                'birthDate' => '1978-11-23',
            ]);

            expect($result['data']['year_of_birth'])->toBe(1978);
            expect($result['data']['month_of_birth'])->toBe(11);
            expect($result['data']['day_of_birth'])->toBe(23);
            expect($result['data']['person_source_value'])->toBe('pt-006');
        });

        it('handles missing birth date gracefully', function () {
            $result = $this->mapper->mapPatient([
                'id' => 'pt-007',
                'gender' => 'male',
            ]);

            expect($result['data']['year_of_birth'])->toBeNull();
            expect($result['data']['month_of_birth'])->toBeNull();
            expect($result['data']['day_of_birth'])->toBeNull();
            expect($result['data']['birth_datetime'])->toBeNull();
        });

        it('extracts US Core race extension', function () {
            $result = $this->mapper->mapPatient([
                'id' => 'pt-008',
                'gender' => 'female',
                'extension' => [
                    [
                        'url' => 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race',
                        'extension' => [
                            [
                                'url' => 'ombCategory',
                                'valueCoding' => ['code' => '2106-3', 'display' => 'White'],
                            ],
                            [
                                'url' => 'text',
                                'valueString' => 'White',
                            ],
                        ],
                    ],
                ],
            ]);

            expect($result['data']['race_concept_id'])->toBe(8527);
            expect($result['data']['race_source_value'])->toBe('White');
        });

        it('extracts US Core ethnicity extension', function () {
            $result = $this->mapper->mapPatient([
                'id' => 'pt-009',
                'gender' => 'male',
                'extension' => [
                    [
                        'url' => 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity',
                        'extension' => [
                            [
                                'url' => 'ombCategory',
                                'valueCoding' => ['code' => '2135-2', 'display' => 'Hispanic or Latino'],
                            ],
                            [
                                'url' => 'text',
                                'valueString' => 'Hispanic or Latino',
                            ],
                        ],
                    ],
                ],
            ]);

            expect($result['data']['ethnicity_concept_id'])->toBe(38003563);
            expect($result['data']['ethnicity_source_value'])->toBe('Hispanic or Latino');
        });

        it('returns required OMOP person fields', function () {
            $result = $this->mapper->mapPatient([
                'id' => 'pt-010',
                'gender' => 'female',
                'birthDate' => '2000-01-01',
            ]);

            $requiredKeys = [
                'person_source_value',
                'gender_concept_id',
                'gender_source_value',
                'year_of_birth',
                'month_of_birth',
                'day_of_birth',
                'birth_datetime',
                'race_concept_id',
                'race_source_value',
                'ethnicity_concept_id',
                'ethnicity_source_value',
            ];

            foreach ($requiredKeys as $key) {
                expect($result['data'])->toHaveKey($key);
            }
        });
    });

    // -----------------------------------------------------------------------
    // Condition mapping
    // -----------------------------------------------------------------------
    describe('mapCondition', function () {
        it('maps SNOMED condition with correct source value and date', function () {
            $result = $this->mapper->mapCondition([
                'resourceType' => 'Condition',
                'subject' => ['reference' => 'Patient/pt-100'],
                'code' => [
                    'coding' => [
                        ['system' => 'http://snomed.info/sct', 'code' => '73211009', 'display' => 'Diabetes mellitus'],
                    ],
                ],
                'onsetDateTime' => '2023-03-15T10:30:00Z',
            ]);

            expect($result['cdm_table'])->toBe('condition_occurrence');
            expect($result['data']['condition_source_value'])->toBe('73211009');
            expect($result['data']['condition_start_date'])->toBe('2023-03-15');
            expect($result['data']['source_vocabulary_id'])->toBe('SNOMED');
            expect($result['data']['person_source_value'])->toBe('pt-100');
        });

        it('maps ICD-10-CM condition', function () {
            $result = $this->mapper->mapCondition([
                'resourceType' => 'Condition',
                'subject' => ['reference' => 'Patient/pt-101'],
                'code' => [
                    'coding' => [
                        ['system' => 'http://hl7.org/fhir/sid/icd-10-cm', 'code' => 'E11.9'],
                    ],
                ],
                'recordedDate' => '2024-01-20',
            ]);

            expect($result['data']['condition_source_value'])->toBe('E11.9');
            expect($result['data']['source_vocabulary_id'])->toBe('ICD10CM');
            expect($result['data']['condition_start_date'])->toBe('2024-01-20');
        });

        it('uses onsetPeriod.start when onsetDateTime is absent', function () {
            $result = $this->mapper->mapCondition([
                'subject' => ['reference' => 'Patient/pt-102'],
                'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '123456']]],
                'onsetPeriod' => ['start' => '2022-06-01'],
            ]);

            expect($result['data']['condition_start_date'])->toBe('2022-06-01');
        });

        it('extracts abatement dates', function () {
            $result = $this->mapper->mapCondition([
                'subject' => ['reference' => 'Patient/pt-103'],
                'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '999']]],
                'onsetDateTime' => '2023-01-01',
                'abatementDateTime' => '2023-06-30',
            ]);

            expect($result['data']['condition_end_date'])->toBe('2023-06-30');
        });

        it('returns required OMOP condition_occurrence fields', function () {
            $result = $this->mapper->mapCondition([
                'subject' => ['reference' => 'Patient/pt-104'],
                'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '444']]],
                'onsetDateTime' => '2023-01-01',
            ]);

            $requiredKeys = [
                'person_source_value',
                'condition_start_date',
                'condition_concept_id',
                'condition_source_value',
                'condition_type_concept_id',
            ];

            foreach ($requiredKeys as $key) {
                expect($result['data'])->toHaveKey($key);
            }
            expect($result['data']['condition_type_concept_id'])->toBe(32817);
        });
    });

    // -----------------------------------------------------------------------
    // MedicationRequest mapping
    // -----------------------------------------------------------------------
    describe('mapMedicationRequest', function () {
        it('maps RxNorm medication with correct source value and date', function () {
            $result = $this->mapper->mapMedicationRequest([
                'resourceType' => 'MedicationRequest',
                'subject' => ['reference' => 'Patient/pt-200'],
                'medicationCodeableConcept' => [
                    'coding' => [
                        ['system' => 'http://www.nlm.nih.gov/research/umls/rxnorm', 'code' => '1049502', 'display' => 'Metformin 500mg'],
                    ],
                ],
                'authoredOn' => '2024-02-10T08:00:00Z',
            ]);

            expect($result['cdm_table'])->toBe('drug_exposure');
            expect($result['data']['drug_source_value'])->toBe('1049502');
            expect($result['data']['drug_exposure_start_date'])->toBe('2024-02-10');
            expect($result['data']['source_vocabulary_id'])->toBe('RxNorm');
            expect($result['data']['person_source_value'])->toBe('pt-200');
        });

        it('handles missing medicationCodeableConcept gracefully', function () {
            $result = $this->mapper->mapMedicationRequest([
                'resourceType' => 'MedicationRequest',
                'subject' => ['reference' => 'Patient/pt-201'],
                'authoredOn' => '2024-03-01',
            ]);

            expect($result['data']['drug_source_value'])->toBeNull();
            expect($result['data']['source_vocabulary_id'])->toBeNull();
        });

        it('returns required OMOP drug_exposure fields', function () {
            $result = $this->mapper->mapMedicationRequest([
                'subject' => ['reference' => 'Patient/pt-202'],
                'medicationCodeableConcept' => [
                    'coding' => [['system' => 'http://www.nlm.nih.gov/research/umls/rxnorm', 'code' => '999']],
                ],
                'authoredOn' => '2024-01-01',
            ]);

            $requiredKeys = [
                'person_source_value',
                'drug_exposure_start_date',
                'drug_concept_id',
                'drug_source_value',
                'drug_type_concept_id',
            ];

            foreach ($requiredKeys as $key) {
                expect($result['data'])->toHaveKey($key);
            }
            expect($result['data']['drug_type_concept_id'])->toBe(32817);
        });
    });

    // -----------------------------------------------------------------------
    // Observation mapping
    // -----------------------------------------------------------------------
    describe('mapObservation', function () {
        it('routes laboratory observations to measurement table', function () {
            $result = $this->mapper->mapObservation([
                'resourceType' => 'Observation',
                'subject' => ['reference' => 'Patient/pt-300'],
                'code' => [
                    'coding' => [
                        ['system' => 'http://loinc.org', 'code' => '2339-0', 'display' => 'Glucose'],
                    ],
                ],
                'category' => [
                    ['coding' => [['code' => 'laboratory']]],
                ],
                'effectiveDateTime' => '2024-04-15T14:00:00Z',
                'valueQuantity' => ['value' => 95.5, 'unit' => 'mg/dL', 'code' => 'mg/dL'],
            ]);

            expect($result['cdm_table'])->toBe('measurement');
            expect($result['data']['measurement_source_value'])->toBe('2339-0');
            expect($result['data']['measurement_date'])->toBe('2024-04-15');
            expect($result['data']['source_vocabulary_id'])->toBe('LOINC');
            expect($result['data']['value_as_number'])->toBe(95.5);
            expect($result['data']['unit_source_value'])->toBe('mg/dL');
        });

        it('routes vital-signs to measurement table', function () {
            $result = $this->mapper->mapObservation([
                'resourceType' => 'Observation',
                'subject' => ['reference' => 'Patient/pt-301'],
                'code' => ['coding' => [['system' => 'http://loinc.org', 'code' => '8480-6']]],
                'category' => [['coding' => [['code' => 'vital-signs']]]],
                'effectiveDateTime' => '2024-05-01',
                'valueQuantity' => ['value' => 120, 'unit' => 'mmHg'],
            ]);

            expect($result['cdm_table'])->toBe('measurement');
            expect($result['data']['measurement_source_value'])->toBe('8480-6');
            expect($result['data']['value_as_number'])->toBe(120.0);
        });

        it('routes uncategorized observations to observation table', function () {
            $result = $this->mapper->mapObservation([
                'resourceType' => 'Observation',
                'subject' => ['reference' => 'Patient/pt-302'],
                'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '272741003']]],
                'category' => [['coding' => [['code' => 'social-history']]]],
                'effectiveDateTime' => '2024-06-01',
                'valueString' => 'Never smoker',
            ]);

            expect($result['cdm_table'])->toBe('observation');
            expect($result['data']['observation_source_value'])->toBe('272741003');
            expect($result['data']['observation_date'])->toBe('2024-06-01');
            expect($result['data']['value_as_string'])->toBe('Never smoker');
        });

        it('extracts valueCodeableConcept display text', function () {
            $result = $this->mapper->mapObservation([
                'resourceType' => 'Observation',
                'subject' => ['reference' => 'Patient/pt-303'],
                'code' => ['coding' => [['system' => 'http://loinc.org', 'code' => '72166-2']]],
                'category' => [['coding' => [['code' => 'social-history']]]],
                'effectiveDateTime' => '2024-07-01',
                'valueCodeableConcept' => [
                    'coding' => [['display' => 'Never smoker']],
                ],
            ]);

            expect($result['data']['value_as_string'])->toBe('Never smoker');
        });
    });

    // -----------------------------------------------------------------------
    // mapResource dispatcher
    // -----------------------------------------------------------------------
    describe('mapResource', function () {
        it('dispatches Patient to mapPatient', function () {
            $result = $this->mapper->mapResource([
                'resourceType' => 'Patient',
                'id' => 'dispatch-test',
                'gender' => 'male',
            ]);

            expect($result['cdm_table'])->toBe('person');
        });

        it('dispatches Condition to mapCondition', function () {
            $result = $this->mapper->mapResource([
                'resourceType' => 'Condition',
                'subject' => ['reference' => 'Patient/1'],
                'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '1']]],
                'onsetDateTime' => '2024-01-01',
            ]);

            expect($result['cdm_table'])->toBe('condition_occurrence');
        });

        it('dispatches MedicationRequest to mapMedicationRequest', function () {
            $result = $this->mapper->mapResource([
                'resourceType' => 'MedicationRequest',
                'subject' => ['reference' => 'Patient/1'],
                'medicationCodeableConcept' => ['coding' => [['system' => 'http://www.nlm.nih.gov/research/umls/rxnorm', 'code' => '1']]],
                'authoredOn' => '2024-01-01',
            ]);

            expect($result['cdm_table'])->toBe('drug_exposure');
        });

        it('dispatches MedicationStatement to mapMedicationRequest', function () {
            $result = $this->mapper->mapResource([
                'resourceType' => 'MedicationStatement',
                'subject' => ['reference' => 'Patient/1'],
                'medicationCodeableConcept' => ['coding' => [['system' => 'http://www.nlm.nih.gov/research/umls/rxnorm', 'code' => '1']]],
                'authoredOn' => '2024-01-01',
            ]);

            expect($result['cdm_table'])->toBe('drug_exposure');
        });

        it('returns null for unsupported resource types', function () {
            $result = $this->mapper->mapResource([
                'resourceType' => 'AllergyIntolerance',
            ]);

            expect($result)->toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // Code system vocabulary resolution
    // -----------------------------------------------------------------------
    describe('code system mapping', function () {
        it('maps SNOMED URI to SNOMED vocabulary', function () {
            $result = $this->mapper->mapCondition([
                'subject' => ['reference' => 'Patient/1'],
                'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '1']]],
                'onsetDateTime' => '2024-01-01',
            ]);

            expect($result['data']['source_vocabulary_id'])->toBe('SNOMED');
        });

        it('maps RxNorm URI to RxNorm vocabulary', function () {
            $result = $this->mapper->mapMedicationRequest([
                'subject' => ['reference' => 'Patient/1'],
                'medicationCodeableConcept' => ['coding' => [['system' => 'http://www.nlm.nih.gov/research/umls/rxnorm', 'code' => '1']]],
                'authoredOn' => '2024-01-01',
            ]);

            expect($result['data']['source_vocabulary_id'])->toBe('RxNorm');
        });

        it('maps LOINC URI to LOINC vocabulary', function () {
            $result = $this->mapper->mapObservation([
                'subject' => ['reference' => 'Patient/1'],
                'code' => ['coding' => [['system' => 'http://loinc.org', 'code' => '1']]],
                'category' => [['coding' => [['code' => 'laboratory']]]],
                'effectiveDateTime' => '2024-01-01',
            ]);

            expect($result['data']['source_vocabulary_id'])->toBe('LOINC');
        });

        it('returns null for unknown code systems', function () {
            $result = $this->mapper->mapCondition([
                'subject' => ['reference' => 'Patient/1'],
                'code' => ['coding' => [['system' => 'http://unknown.org', 'code' => '1']]],
                'onsetDateTime' => '2024-01-01',
            ]);

            expect($result['data']['source_vocabulary_id'])->toBeNull();
        });
    });
});
