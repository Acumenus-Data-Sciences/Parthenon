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

    public function test_encounter_builder_basic(): void
    {
        $row = (object) [
            'visit_occurrence_id' => 100,
            'person_id' => 1,
            'visit_concept_id' => 9201,
            'visit_start_date' => '2025-01-01',
            'visit_start_datetime' => '2025-01-01 08:00:00',
            'visit_end_date' => '2025-01-05',
            'visit_end_datetime' => null,
            'visit_source_value' => 'IMP',
            'visit_type_concept_id' => 32817,
            'provider_id' => 50,
            'care_site_id' => 10,
        ];

        $builder = new \App\Services\Fhir\Export\Builders\EncounterBuilder($this->vocab);
        $resource = $builder->build($row);

        $this->assertEquals('Encounter', $resource['resourceType']);
        $this->assertEquals('100', $resource['id']);
        $this->assertEquals('IMP', $resource['class']['code']);
        $this->assertEquals('Patient/1', $resource['subject']['reference']);
        $this->assertArrayHasKey('period', $resource);
        $this->assertEquals('Practitioner/50', $resource['participant'][0]['individual']['reference']);
        $this->assertEquals('Organization/10', $resource['serviceProvider']['reference']);
    }

    public function test_encounter_builder_unknown_concept_falls_back_to_source_value(): void
    {
        $row = (object) [
            'visit_occurrence_id' => 101,
            'person_id' => 2,
            'visit_concept_id' => 0,
            'visit_start_date' => '2025-02-01',
            'visit_start_datetime' => null,
            'visit_end_date' => null,
            'visit_end_datetime' => null,
            'visit_source_value' => 'EMER',
            'provider_id' => null,
            'care_site_id' => null,
        ];

        $builder = new \App\Services\Fhir\Export\Builders\EncounterBuilder($this->vocab);
        $resource = $builder->build($row);

        $this->assertEquals('EMER', $resource['class']['code']);
        $this->assertArrayNotHasKey('participant', $resource);
        $this->assertArrayNotHasKey('serviceProvider', $resource);
    }

    public function test_encounter_builder_no_source_value_defaults_to_amb(): void
    {
        $row = (object) [
            'visit_occurrence_id' => 102,
            'person_id' => 3,
            'visit_concept_id' => 0,
            'visit_start_date' => null,
            'visit_start_datetime' => null,
            'visit_end_date' => null,
            'visit_end_datetime' => null,
            'visit_source_value' => null,
            'provider_id' => null,
            'care_site_id' => null,
        ];

        $builder = new \App\Services\Fhir\Export\Builders\EncounterBuilder($this->vocab);
        $resource = $builder->build($row);

        $this->assertEquals('AMB', $resource['class']['code']);
        $this->assertArrayNotHasKey('period', $resource);
    }

    public function test_observation_builder_with_numeric_value(): void
    {
        $this->vocab->shouldReceive('buildCodeableConcept')
            ->andReturn(['coding' => [['system' => 'http://loinc.org', 'code' => '8302-2', 'display' => 'Height']]]);
        $this->vocab->shouldReceive('resolve')->andReturn(['concept_id' => 0, 'coding' => []]);

        $row = (object) [
            'observation_id' => 500,
            'person_id' => 1,
            'observation_concept_id' => 3036277,
            'observation_source_concept_id' => 3036277,
            'observation_source_value' => 'loinc|8302-2',
            'observation_date' => '2025-01-01',
            'observation_datetime' => '2025-01-01 09:00:00',
            'value_as_number' => 170.5,
            'value_as_string' => null,
            'value_as_concept_id' => 0,
            'visit_occurrence_id' => 100,
        ];

        $builder = new \App\Services\Fhir\Export\Builders\ObservationBuilder($this->vocab);
        $resource = $builder->build($row);

        $this->assertEquals('Observation', $resource['resourceType']);
        $this->assertEquals('500', $resource['id']);
        $this->assertEquals('final', $resource['status']);
        $this->assertEquals('social-history', $resource['category'][0]['coding'][0]['code']);
        $this->assertEquals(170.5, $resource['valueQuantity']['value']);
        $this->assertEquals('2025-01-01 09:00:00', $resource['effectiveDateTime']);
        $this->assertEquals('Encounter/100', $resource['encounter']['reference']);
    }

    public function test_observation_builder_with_string_value(): void
    {
        $this->vocab->shouldReceive('buildCodeableConcept')
            ->andReturn(['coding' => []]);
        $this->vocab->shouldReceive('resolve')->andReturn(['concept_id' => 0, 'coding' => []]);

        $row = (object) [
            'observation_id' => 501,
            'person_id' => 1,
            'observation_concept_id' => 0,
            'observation_source_concept_id' => 0,
            'observation_source_value' => 'smoking-status',
            'observation_date' => '2025-01-01',
            'observation_datetime' => null,
            'value_as_number' => null,
            'value_as_string' => 'Never smoker',
            'value_as_concept_id' => 0,
            'visit_occurrence_id' => null,
        ];

        $builder = new \App\Services\Fhir\Export\Builders\ObservationBuilder($this->vocab);
        $resource = $builder->build($row);

        $this->assertEquals('Never smoker', $resource['valueString']);
        $this->assertArrayNotHasKey('encounter', $resource);
        $this->assertEquals('2025-01-01', $resource['effectiveDateTime']);
    }

    public function test_measurement_builder_with_value_and_range(): void
    {
        $this->vocab->shouldReceive('buildCodeableConcept')
            ->andReturn(['coding' => [['system' => 'http://loinc.org', 'code' => '2345-7', 'display' => 'Glucose']]]);

        $row = (object) [
            'measurement_id' => 200,
            'person_id' => 1,
            'measurement_concept_id' => 3000963,
            'measurement_source_concept_id' => 3000963,
            'measurement_source_value' => 'loinc|2345-7',
            'measurement_date' => '2025-01-01',
            'measurement_datetime' => '2025-01-01 10:00:00',
            'value_as_number' => 95.5,
            'unit_source_value' => 'mg/dL',
            'range_low' => 70.0,
            'range_high' => 100.0,
            'visit_occurrence_id' => 100,
        ];

        $builder = new \App\Services\Fhir\Export\Builders\MeasurementBuilder($this->vocab);
        $resource = $builder->build($row);

        $this->assertEquals('Observation', $resource['resourceType']);
        $this->assertEquals('laboratory', $resource['category'][0]['coding'][0]['code']);
        $this->assertEquals(95.5, $resource['valueQuantity']['value']);
        $this->assertEquals('mg/dL', $resource['valueQuantity']['unit']);
        $this->assertEquals(70.0, $resource['referenceRange'][0]['low']['value']);
        $this->assertEquals(100.0, $resource['referenceRange'][0]['high']['value']);
    }

    public function test_measurement_builder_id_prefix(): void
    {
        $this->vocab->shouldReceive('buildCodeableConcept')->andReturn(['coding' => []]);

        $row = (object) [
            'measurement_id' => 999,
            'person_id' => 5,
            'measurement_concept_id' => 0,
            'measurement_source_concept_id' => 0,
            'measurement_source_value' => null,
            'measurement_date' => null,
            'measurement_datetime' => null,
            'value_as_number' => null,
            'unit_source_value' => null,
            'range_low' => null,
            'range_high' => null,
            'visit_occurrence_id' => null,
        ];

        $builder = new \App\Services\Fhir\Export\Builders\MeasurementBuilder($this->vocab);
        $resource = $builder->build($row);

        $this->assertEquals('measurement-999', $resource['id']);
        $this->assertArrayNotHasKey('referenceRange', $resource);
        $this->assertArrayNotHasKey('valueQuantity', $resource);
    }

    public function test_medication_builder_with_dosage(): void
    {
        $this->vocab->shouldReceive('buildCodeableConcept')
            ->andReturn(['coding' => [['system' => 'http://www.nlm.nih.gov/research/umls/rxnorm', 'code' => '789']]]);

        $row = (object) [
            'drug_exposure_id' => 300,
            'person_id' => 1,
            'drug_concept_id' => 789,
            'drug_source_concept_id' => 789,
            'drug_source_value' => 'rxnorm|789',
            'drug_exposure_start_date' => '2025-01-01',
            'drug_exposure_start_datetime' => null,
            'drug_exposure_end_date' => '2025-01-30',
            'drug_type_concept_id' => 32817,
            'sig' => 'Take 1 tablet daily',
            'route_source_value' => 'Oral',
            'visit_occurrence_id' => null,
        ];

        $builder = new \App\Services\Fhir\Export\Builders\MedicationBuilder($this->vocab);
        $resource = $builder->build($row);

        $this->assertEquals('MedicationStatement', $resource['resourceType']);
        $this->assertEquals('300', $resource['id']);
        $this->assertEquals('2025-01-01', $resource['effectivePeriod']['start']);
        $this->assertEquals('2025-01-30', $resource['effectivePeriod']['end']);
        $this->assertEquals('Take 1 tablet daily', $resource['dosage'][0]['text']);
        $this->assertEquals('Oral', $resource['dosage'][0]['route']['text']);
        $this->assertArrayNotHasKey('context', $resource);
    }

    public function test_medication_builder_with_visit_reference(): void
    {
        $this->vocab->shouldReceive('buildCodeableConcept')->andReturn(['coding' => []]);

        $row = (object) [
            'drug_exposure_id' => 301,
            'person_id' => 2,
            'drug_concept_id' => 0,
            'drug_source_concept_id' => 0,
            'drug_source_value' => null,
            'drug_exposure_start_date' => null,
            'drug_exposure_start_datetime' => null,
            'drug_exposure_end_date' => null,
            'sig' => null,
            'route_source_value' => null,
            'visit_occurrence_id' => 200,
        ];

        $builder = new \App\Services\Fhir\Export\Builders\MedicationBuilder($this->vocab);
        $resource = $builder->build($row);

        $this->assertEquals('Encounter/200', $resource['context']['reference']);
        $this->assertArrayNotHasKey('dosage', $resource);
        $this->assertArrayNotHasKey('effectivePeriod', $resource);
    }

    public function test_procedure_builder_with_provider(): void
    {
        $this->vocab->shouldReceive('buildCodeableConcept')
            ->andReturn(['coding' => [['system' => 'http://www.ama-assn.org/go/cpt', 'code' => '99213']]]);

        $row = (object) [
            'procedure_occurrence_id' => 400,
            'person_id' => 1,
            'procedure_concept_id' => 500,
            'procedure_source_concept_id' => 500,
            'procedure_source_value' => 'cpt4|99213',
            'procedure_date' => '2025-01-01',
            'procedure_datetime' => '2025-01-01 10:00:00',
            'procedure_end_date' => '2025-01-01',
            'procedure_end_datetime' => '2025-01-01 11:30:00',
            'provider_id' => 25,
            'visit_occurrence_id' => 100,
        ];

        $builder = new \App\Services\Fhir\Export\Builders\ProcedureBuilder($this->vocab);
        $resource = $builder->build($row);

        $this->assertEquals('Procedure', $resource['resourceType']);
        $this->assertEquals('completed', $resource['status']);
        $this->assertEquals('2025-01-01 10:00:00', $resource['performedPeriod']['start']);
        $this->assertEquals('2025-01-01 11:30:00', $resource['performedPeriod']['end']);
        $this->assertEquals('Practitioner/25', $resource['performer'][0]['actor']['reference']);
        $this->assertEquals('Encounter/100', $resource['encounter']['reference']);
    }

    public function test_procedure_builder_no_provider_or_visit(): void
    {
        $this->vocab->shouldReceive('buildCodeableConcept')->andReturn(['coding' => []]);

        $row = (object) [
            'procedure_occurrence_id' => 401,
            'person_id' => 3,
            'procedure_concept_id' => 0,
            'procedure_source_concept_id' => 0,
            'procedure_source_value' => null,
            'procedure_date' => '2025-03-01',
            'procedure_datetime' => null,
            'procedure_end_date' => null,
            'procedure_end_datetime' => null,
            'provider_id' => null,
            'visit_occurrence_id' => null,
        ];

        $builder = new \App\Services\Fhir\Export\Builders\ProcedureBuilder($this->vocab);
        $resource = $builder->build($row);

        $this->assertEquals('401', $resource['id']);
        $this->assertEquals('2025-03-01', $resource['performedPeriod']['start']);
        $this->assertArrayNotHasKey('performer', $resource);
        $this->assertArrayNotHasKey('encounter', $resource);
    }

    public function test_factory_for_table_dispatches_all_builders(): void
    {
        $factory = new \App\Services\Fhir\Export\FhirResourceBuilderFactory($this->vocab);

        $this->assertInstanceOf(\App\Services\Fhir\Export\Builders\PatientBuilder::class, $factory->forTable('person'));
        $this->assertInstanceOf(\App\Services\Fhir\Export\Builders\ConditionBuilder::class, $factory->forTable('condition_occurrence'));
        $this->assertInstanceOf(\App\Services\Fhir\Export\Builders\EncounterBuilder::class, $factory->forTable('visit_occurrence'));
        $this->assertInstanceOf(\App\Services\Fhir\Export\Builders\ObservationBuilder::class, $factory->forTable('observation'));
        $this->assertInstanceOf(\App\Services\Fhir\Export\Builders\MeasurementBuilder::class, $factory->forTable('measurement'));
        $this->assertInstanceOf(\App\Services\Fhir\Export\Builders\MedicationBuilder::class, $factory->forTable('drug_exposure'));
        $this->assertInstanceOf(\App\Services\Fhir\Export\Builders\ProcedureBuilder::class, $factory->forTable('procedure_occurrence'));
        $this->assertNull($factory->forTable('unknown_table'));
    }

    public function test_immunization_builder_with_lot_and_dose(): void
    {
        $this->vocab->shouldReceive('buildCodeableConcept')
            ->andReturn(['coding' => [['system' => 'http://hl7.org/fhir/sid/cvx', 'code' => '207', 'display' => 'COVID-19']]]);

        $row = (object) [
            'drug_exposure_id' => 500,
            'person_id' => 1,
            'drug_concept_id' => 600,
            'drug_source_concept_id' => 600,
            'drug_source_value' => 'cvx|207',
            'drug_exposure_start_date' => '2025-06-01',
            'drug_exposure_start_datetime' => null,
            'drug_exposure_end_date' => '2025-06-01',
            'lot_number' => 'LOT123ABC',
            'route_source_value' => 'Intramuscular',
            'quantity' => 0.5,
            'dose_unit_source_value' => 'mL',
        ];

        $builder = new \App\Services\Fhir\Export\Builders\ImmunizationBuilder($this->vocab);
        $resource = $builder->build($row);

        $this->assertEquals('Immunization', $resource['resourceType']);
        $this->assertEquals('completed', $resource['status']);
        $this->assertEquals('LOT123ABC', $resource['lotNumber']);
        $this->assertEquals(0.5, $resource['doseQuantity']['value']);
        $this->assertEquals('mL', $resource['doseQuantity']['unit']);
        $this->assertEquals('Intramuscular', $resource['route']['text']);
    }

    public function test_allergy_builder_with_category(): void
    {
        $this->vocab->shouldReceive('buildCodeableConcept')
            ->andReturn(['coding' => [['system' => 'http://snomed.info/sct', 'code' => '372687004', 'display' => 'Amoxicillin']]]);

        $row = (object) [
            'observation_id' => 600,
            'person_id' => 1,
            'observation_concept_id' => 439224,
            'observation_source_concept_id' => 1500,
            'observation_source_value' => 'snomed|372687004',
            'observation_date' => '2025-01-01',
            'observation_datetime' => null,
            'value_as_concept_id' => 1500,
        ];

        $builder = new \App\Services\Fhir\Export\Builders\AllergyBuilder($this->vocab);
        $resource = $builder->build($row);

        $this->assertEquals('AllergyIntolerance', $resource['resourceType']);
        $this->assertEquals(['medication'], $resource['category']);
        $this->assertEquals('2025-01-01', $resource['recordedDate']);
    }
}
