<?php

use App\Services\Ingestion\FhirParserService;
use App\Services\Ingestion\FhirResourceMapper;

// ---------------------------------------------------------------------------
// FhirParserService tests
// ---------------------------------------------------------------------------
describe('FhirParserService', function () {

    beforeEach(function () {
        $this->parser = new FhirParserService;
        $this->tempDir = sys_get_temp_dir();
    });

    afterEach(function () {
        foreach (glob($this->tempDir.'/fhir_test_*.json') as $file) {
            @unlink($file);
        }
    });

    /**
     * Helper: write JSON content to a temp file and return its path.
     */
    function writeTempJson(string $content, string $tempDir): string
    {
        $path = $tempDir.'/fhir_test_'.uniqid().'.json';
        file_put_contents($path, $content);

        return $path;
    }

    it('throws on invalid JSON', function () {
        $path = writeTempJson('{ not valid json !!!', $this->tempDir);

        expect(fn () => $this->parser->parseBundle($path))
            ->toThrow(RuntimeException::class, 'Invalid JSON');
    });

    it('throws when resourceType is not Bundle', function () {
        $path = writeTempJson(json_encode([
            'resourceType' => 'Patient',
            'id' => 'example',
        ]), $this->tempDir);

        expect(fn () => $this->parser->parseBundle($path))
            ->toThrow(RuntimeException::class, 'not a Bundle');
    });

    it('extractResources groups entries by resource type', function () {
        $bundle = [
            'resourceType' => 'Bundle',
            'type' => 'collection',
            'entry' => [
                ['resource' => ['resourceType' => 'Patient', 'id' => 'p1']],
                ['resource' => ['resourceType' => 'Condition', 'id' => 'c1']],
                ['resource' => ['resourceType' => 'Patient', 'id' => 'p2']],
                ['resource' => ['resourceType' => 'Condition', 'id' => 'c2']],
                ['resource' => ['resourceType' => 'Observation', 'id' => 'o1']],
            ],
        ];

        $grouped = $this->parser->extractResources($bundle);

        expect($grouped)->toHaveKeys(['Patient', 'Condition', 'Observation'])
            ->and($grouped['Patient'])->toHaveCount(2)
            ->and($grouped['Condition'])->toHaveCount(2)
            ->and($grouped['Observation'])->toHaveCount(1);
    });

    it('extractResources filters out unsupported resource types', function () {
        $bundle = [
            'resourceType' => 'Bundle',
            'type' => 'collection',
            'entry' => [
                ['resource' => ['resourceType' => 'Patient', 'id' => 'p1']],
                ['resource' => ['resourceType' => 'Organization', 'id' => 'org1']],
                ['resource' => ['resourceType' => 'Practitioner', 'id' => 'pr1']],
                ['resource' => ['resourceType' => 'Condition', 'id' => 'c1']],
            ],
        ];

        $grouped = $this->parser->extractResources($bundle);

        expect($grouped)->toHaveKeys(['Patient', 'Condition'])
            ->and($grouped->has('Organization'))->toBeFalse()
            ->and($grouped->has('Practitioner'))->toBeFalse();
    });

    it('getResourceCount returns counts per resource type', function () {
        $bundle = [
            'resourceType' => 'Bundle',
            'type' => 'collection',
            'entry' => [
                ['resource' => ['resourceType' => 'Patient', 'id' => 'p1']],
                ['resource' => ['resourceType' => 'Patient', 'id' => 'p2']],
                ['resource' => ['resourceType' => 'Condition', 'id' => 'c1']],
                ['resource' => ['resourceType' => 'Observation', 'id' => 'o1']],
                ['resource' => ['resourceType' => 'Observation', 'id' => 'o2']],
                ['resource' => ['resourceType' => 'Observation', 'id' => 'o3']],
            ],
        ];

        $counts = $this->parser->getResourceCount($bundle);

        expect($counts['Observation'])->toBe(3)
            ->and($counts['Patient'])->toBe(2)
            ->and($counts['Condition'])->toBe(1);
    });
});

// ---------------------------------------------------------------------------
// FhirResourceMapper tests
// ---------------------------------------------------------------------------
describe('FhirResourceMapper', function () {

    beforeEach(function () {
        $this->mapper = new FhirResourceMapper;
    });

    it('mapPatient extracts gender and birth date', function () {
        $patient = [
            'resourceType' => 'Patient',
            'id' => 'patient-123',
            'gender' => 'female',
            'birthDate' => '1985-06-15',
        ];

        $result = $this->mapper->mapPatient($patient);

        expect($result['cdm_table'])->toBe('person')
            ->and($result['data']['gender_concept_id'])->toBe(8532)
            ->and($result['data']['gender_source_value'])->toBe('female')
            ->and($result['data']['year_of_birth'])->toBe(1985)
            ->and($result['data']['month_of_birth'])->toBe(6)
            ->and($result['data']['day_of_birth'])->toBe(15)
            ->and($result['data']['person_source_value'])->toBe('patient-123');
    });

    it('mapCondition extracts codes and dates', function () {
        $condition = [
            'resourceType' => 'Condition',
            'subject' => ['reference' => 'Patient/patient-456'],
            'code' => [
                'coding' => [
                    [
                        'system' => 'http://snomed.info/sct',
                        'code' => '44054006',
                        'display' => 'Type 2 diabetes mellitus',
                    ],
                ],
            ],
            'onsetDateTime' => '2023-03-10T00:00:00Z',
            'abatementDateTime' => '2023-09-15T00:00:00Z',
        ];

        $result = $this->mapper->mapCondition($condition);

        expect($result['cdm_table'])->toBe('condition_occurrence')
            ->and($result['data']['condition_source_value'])->toBe('44054006')
            ->and($result['data']['condition_start_date'])->toBe('2023-03-10')
            ->and($result['data']['condition_end_date'])->toBe('2023-09-15')
            ->and($result['data']['person_source_value'])->toBe('patient-456')
            ->and($result['data']['source_vocabulary_id'])->toBe('SNOMED');
    });

    it('mapObservation routes labs to measurement table', function () {
        $observation = [
            'resourceType' => 'Observation',
            'subject' => ['reference' => 'Patient/patient-789'],
            'category' => [
                [
                    'coding' => [
                        [
                            'system' => 'http://terminology.hl7.org/CodeSystem/observation-category',
                            'code' => 'laboratory',
                        ],
                    ],
                ],
            ],
            'code' => [
                'coding' => [
                    [
                        'system' => 'http://loinc.org',
                        'code' => '2339-0',
                        'display' => 'Glucose',
                    ],
                ],
            ],
            'effectiveDateTime' => '2024-01-20T08:30:00Z',
            'valueQuantity' => [
                'value' => 95.5,
                'unit' => 'mg/dL',
                'code' => 'mg/dL',
            ],
        ];

        $result = $this->mapper->mapObservation($observation);

        expect($result['cdm_table'])->toBe('measurement')
            ->and($result['data']['measurement_source_value'])->toBe('2339-0')
            ->and($result['data']['measurement_date'])->toBe('2024-01-20')
            ->and($result['data']['value_as_number'])->toBe(95.5)
            ->and($result['data']['unit_source_value'])->toBe('mg/dL')
            ->and($result['data']['source_vocabulary_id'])->toBe('LOINC');
    });

    it('mapObservation routes social history to observation table', function () {
        $observation = [
            'resourceType' => 'Observation',
            'subject' => ['reference' => 'Patient/patient-111'],
            'category' => [
                [
                    'coding' => [
                        [
                            'system' => 'http://terminology.hl7.org/CodeSystem/observation-category',
                            'code' => 'social-history',
                        ],
                    ],
                ],
            ],
            'code' => [
                'coding' => [
                    [
                        'system' => 'http://loinc.org',
                        'code' => '72166-2',
                        'display' => 'Tobacco smoking status',
                    ],
                ],
            ],
            'effectiveDateTime' => '2024-02-10T10:00:00Z',
            'valueCodeableConcept' => [
                'coding' => [
                    [
                        'system' => 'http://snomed.info/sct',
                        'code' => '266919005',
                        'display' => 'Never smoker',
                    ],
                ],
                'text' => 'Never smoker',
            ],
        ];

        $result = $this->mapper->mapObservation($observation);

        expect($result['cdm_table'])->toBe('observation')
            ->and($result['data']['observation_source_value'])->toBe('72166-2')
            ->and($result['data']['observation_date'])->toBe('2024-02-10')
            ->and($result['data']['value_as_string'])->toBe('Never smoker');
    });

    it('mapResource returns null for unsupported resource types', function () {
        $resource = [
            'resourceType' => 'Organization',
            'id' => 'org-1',
            'name' => 'General Hospital',
        ];

        $result = $this->mapper->mapResource($resource);

        expect($result)->toBeNull();
    });

    it('resolveVocabulary maps SNOMED URI correctly via mapCondition', function () {
        $condition = [
            'resourceType' => 'Condition',
            'subject' => ['reference' => 'Patient/p1'],
            'code' => [
                'coding' => [
                    [
                        'system' => 'http://snomed.info/sct',
                        'code' => '386661006',
                    ],
                ],
            ],
            'onsetDateTime' => '2024-01-01',
        ];

        $result = $this->mapper->mapCondition($condition);

        expect($result['data']['source_vocabulary_id'])->toBe('SNOMED');
    });

    it('resolveVocabulary maps ICD10CM URI correctly via mapCondition', function () {
        $condition = [
            'resourceType' => 'Condition',
            'subject' => ['reference' => 'Patient/p2'],
            'code' => [
                'coding' => [
                    [
                        'system' => 'http://hl7.org/fhir/sid/icd-10-cm',
                        'code' => 'E11.9',
                    ],
                ],
            ],
            'onsetDateTime' => '2024-01-01',
        ];

        $result = $this->mapper->mapCondition($condition);

        expect($result['data']['source_vocabulary_id'])->toBe('ICD10CM');
    });
});
