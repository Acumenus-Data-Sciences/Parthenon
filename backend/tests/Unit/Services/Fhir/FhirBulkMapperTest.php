<?php

declare(strict_types=1);

namespace Tests\Unit\Services\Fhir;

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\FhirBulkMapper;
use App\Services\Fhir\VocabularyLookupService;
use Mockery;
use Tests\TestCase;

class FhirBulkMapperTest extends TestCase
{
    private FhirBulkMapper $mapper;
    private VocabularyLookupService $vocab;
    private CrosswalkService $crosswalk;

    protected function setUp(): void
    {
        parent::setUp();
        $this->vocab = Mockery::mock(VocabularyLookupService::class);
        $this->crosswalk = Mockery::mock(CrosswalkService::class);
        $this->mapper = new FhirBulkMapper($this->vocab, $this->crosswalk);
    }

    public function test_patient_gender_other_maps_to_44814653(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);

        $resource = [
            'resourceType' => 'Patient',
            'id' => 'patient-1',
            'gender' => 'other',
            'birthDate' => '1990-01-15',
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');
        $personRow = collect($rows)->firstWhere('cdm_table', 'person');

        $this->assertNotNull($personRow);
        $this->assertEquals(44814653, $personRow['data']['gender_concept_id']);
        $this->assertEquals('other', $personRow['data']['gender_source_value']);
    }

    public function test_patient_null_gender_maps_to_zero(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);

        $resource = [
            'resourceType' => 'Patient',
            'id' => 'patient-2',
            'birthDate' => '1990-01-15',
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');
        $personRow = collect($rows)->firstWhere('cdm_table', 'person');

        $this->assertNotNull($personRow);
        $this->assertEquals(0, $personRow['data']['gender_concept_id']);
    }

    public function test_map_resource_returns_array_of_rows(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);

        $resource = [
            'resourceType' => 'Patient',
            'id' => 'patient-3',
            'gender' => 'male',
            'birthDate' => '1985-06-20',
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');

        $this->assertIsArray($rows);
        $this->assertCount(1, $rows);
        $this->assertEquals('Patient', $rows[0]['fhir_resource_type']);
        $this->assertEquals('patient-3', $rows[0]['fhir_resource_id']);
        $this->assertEquals('person', $rows[0]['cdm_table']);
    }

    public function test_unknown_resource_type_returns_empty_array(): void
    {
        $resource = [
            'resourceType' => 'UnsupportedType',
            'id' => 'unknown-1',
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');

        $this->assertIsArray($rows);
        $this->assertEmpty($rows);
    }

    public function test_condition_active_status_maps_to_concept(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
        $this->crosswalk->shouldReceive('lookupVisitId')->andReturn(null);
        $this->vocab->shouldReceive('resolve')->andReturn([
            'concept_id' => 123,
            'domain_id' => 'Condition',
            'source_concept_id' => 123,
            'source_value' => 'http://snomed.info/sct|123',
            'cdm_table' => 'condition_occurrence',
            'mapping_type' => 'direct_standard',
        ]);

        $resource = [
            'resourceType' => 'Condition',
            'id' => 'cond-1',
            'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '123']]],
            'subject' => ['reference' => 'Patient/patient-1'],
            'clinicalStatus' => ['coding' => [['code' => 'active']]],
            'category' => [['coding' => [['code' => 'problem-list-item']]]],
            'onsetDateTime' => '2025-01-01',
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');
        $condRow = collect($rows)->firstWhere('cdm_table', 'condition_occurrence');

        $this->assertEquals(4230359, $condRow['data']['condition_status_concept_id']);
        $this->assertEquals('active', $condRow['data']['condition_status_source_value']);
        $this->assertEquals(32840, $condRow['data']['condition_type_concept_id']);
    }

    public function test_condition_resolved_status_maps_to_concept(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
        $this->crosswalk->shouldReceive('lookupVisitId')->andReturn(null);
        $this->vocab->shouldReceive('resolve')->andReturn([
            'concept_id' => 456,
            'domain_id' => 'Condition',
            'source_concept_id' => 456,
            'source_value' => 'http://snomed.info/sct|456',
            'cdm_table' => 'condition_occurrence',
            'mapping_type' => 'direct_standard',
        ]);

        $resource = [
            'resourceType' => 'Condition',
            'id' => 'cond-2',
            'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '456']]],
            'subject' => ['reference' => 'Patient/patient-1'],
            'clinicalStatus' => ['coding' => [['code' => 'resolved']]],
            'category' => [['coding' => [['code' => 'encounter-diagnosis']]]],
            'onsetDateTime' => '2025-01-01',
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');
        $condRow = collect($rows)->firstWhere('cdm_table', 'condition_occurrence');

        $this->assertEquals(4201906, $condRow['data']['condition_status_concept_id']);
        $this->assertEquals(32817, $condRow['data']['condition_type_concept_id']);
    }
}
