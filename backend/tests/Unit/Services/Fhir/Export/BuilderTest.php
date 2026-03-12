<?php

declare(strict_types=1);

namespace Tests\Unit\Services\Fhir\Export;

use App\Services\Fhir\Export\Builders\ConditionBuilder;
use App\Services\Fhir\Export\Builders\PatientBuilder;
use App\Services\Fhir\Export\FhirBundleAssembler;
use App\Services\Fhir\Export\ReverseVocabularyService;
use Mockery;
use Tests\TestCase;

class BuilderTest extends TestCase
{
    private ReverseVocabularyService $vocab;

    protected function setUp(): void
    {
        parent::setUp();
        $this->vocab = Mockery::mock(ReverseVocabularyService::class);
    }

    public function test_patient_builder_basic_demographics(): void
    {
        $this->vocab->shouldReceive('resolve')->andReturn(['concept_id' => 0, 'coding' => []]);

        $person = (object) [
            'person_id' => 1,
            'gender_concept_id' => 8532,
            'year_of_birth' => 1990,
            'month_of_birth' => 3,
            'day_of_birth' => 15,
            'birth_datetime' => null,
            'race_concept_id' => 0,
            'race_source_value' => null,
            'ethnicity_concept_id' => 0,
            'ethnicity_source_value' => null,
            'person_source_value' => 'patient-1',
        ];

        $builder = new PatientBuilder($this->vocab);
        $resource = $builder->build($person);

        $this->assertEquals('Patient', $resource['resourceType']);
        $this->assertEquals('1', $resource['id']);
        $this->assertEquals('female', $resource['gender']);
        $this->assertEquals('1990-03-15', $resource['birthDate']);
    }

    public function test_patient_builder_with_death(): void
    {
        $this->vocab->shouldReceive('resolve')->andReturn(['concept_id' => 0, 'coding' => []]);

        $person = (object) [
            'person_id' => 2,
            'gender_concept_id' => 8507,
            'year_of_birth' => 1950,
            'month_of_birth' => 1,
            'day_of_birth' => 1,
            'birth_datetime' => null,
            'race_concept_id' => 0,
            'race_source_value' => null,
            'ethnicity_concept_id' => 0,
            'ethnicity_source_value' => null,
            'person_source_value' => 'patient-2',
        ];

        $death = (object) [
            'person_id' => 2,
            'death_datetime' => '2025-06-01 14:30:00',
        ];

        $builder = new PatientBuilder($this->vocab);
        $resource = $builder->build($person, $death);

        $this->assertEquals('male', $resource['gender']);
        $this->assertEquals('2025-06-01 14:30:00', $resource['deceasedDateTime']);
    }

    public function test_condition_builder_with_status_and_category(): void
    {
        $this->vocab->shouldReceive('buildCodeableConcept')
            ->with(123, 456, 'SNOMED|123')
            ->andReturn([
                'coding' => [['system' => 'http://snomed.info/sct', 'code' => '123', 'display' => 'Test Condition']],
                'text' => 'SNOMED|123',
            ]);

        $row = (object) [
            'condition_occurrence_id' => 10,
            'person_id' => 1,
            'condition_concept_id' => 123,
            'condition_source_concept_id' => 456,
            'condition_source_value' => 'SNOMED|123',
            'condition_start_date' => '2025-01-01',
            'condition_start_datetime' => '2025-01-01 08:00:00',
            'condition_end_date' => '2025-02-01',
            'condition_end_datetime' => null,
            'condition_type_concept_id' => 32817,
            'condition_status_concept_id' => 4230359,
            'visit_occurrence_id' => 100,
        ];

        $builder = new ConditionBuilder($this->vocab);
        $resource = $builder->build($row);

        $this->assertEquals('Condition', $resource['resourceType']);
        $this->assertEquals('10', $resource['id']);
        $this->assertEquals('Patient/1', $resource['subject']['reference']);
        $this->assertEquals('active', $resource['clinicalStatus']['coding'][0]['code']);
        $this->assertEquals('encounter-diagnosis', $resource['category'][0]['coding'][0]['code']);
        $this->assertEquals('2025-01-01 08:00:00', $resource['onsetDateTime']);
        $this->assertEquals('2025-02-01', $resource['abatementDateTime']);
        $this->assertEquals('Encounter/100', $resource['encounter']['reference']);
    }

    public function test_bundle_assembler_creates_searchset(): void
    {
        $resources = [
            ['resourceType' => 'Patient', 'id' => '1'],
            ['resourceType' => 'Patient', 'id' => '2'],
        ];

        $bundle = FhirBundleAssembler::searchset($resources, 2);

        $this->assertEquals('Bundle', $bundle['resourceType']);
        $this->assertEquals('searchset', $bundle['type']);
        $this->assertEquals(2, $bundle['total']);
        $this->assertCount(2, $bundle['entry']);
        $this->assertEquals('match', $bundle['entry'][0]['search']['mode']);
    }
}
