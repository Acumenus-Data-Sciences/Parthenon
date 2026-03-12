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
}
