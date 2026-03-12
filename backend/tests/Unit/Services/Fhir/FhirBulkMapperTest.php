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

    public function test_encounter_maps_admission_discharge_provider(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
        $this->crosswalk->shouldReceive('resolveVisitId')->andReturn(100);
        $this->crosswalk->shouldReceive('resolveProviderId')->andReturn(50);
        $this->vocab->shouldReceive('resolve')
            ->with([['system' => 'http://snomed.info/sct', 'code' => 'admit-src']])
            ->andReturn(['concept_id' => 8717, 'domain_id' => 'Visit', 'source_concept_id' => 8717, 'source_value' => 'admit-src', 'cdm_table' => null, 'mapping_type' => 'direct_standard']);
        $this->vocab->shouldReceive('resolve')
            ->with([['system' => 'http://snomed.info/sct', 'code' => 'disch-disp']])
            ->andReturn(['concept_id' => 8536, 'domain_id' => 'Visit', 'source_concept_id' => 8536, 'source_value' => 'disch-disp', 'cdm_table' => null, 'mapping_type' => 'direct_standard']);

        $resource = [
            'resourceType' => 'Encounter',
            'id' => 'enc-1',
            'class' => ['code' => 'IMP'],
            'subject' => ['reference' => 'Patient/patient-1'],
            'period' => ['start' => '2025-01-01', 'end' => '2025-01-05'],
            'hospitalization' => [
                'admitSource' => [
                    'coding' => [['system' => 'http://snomed.info/sct', 'code' => 'admit-src']],
                    'text' => 'Emergency Room',
                ],
                'dischargeDisposition' => [
                    'coding' => [['system' => 'http://snomed.info/sct', 'code' => 'disch-disp']],
                    'text' => 'Home',
                ],
            ],
            'participant' => [
                ['individual' => ['reference' => 'Practitioner/prac-1', 'display' => 'Dr. Smith']],
            ],
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');
        $visitRow = collect($rows)->firstWhere('cdm_table', 'visit_occurrence');

        $this->assertEquals(8717, $visitRow['data']['admitted_from_concept_id']);
        $this->assertEquals('Emergency Room', $visitRow['data']['admitted_from_source_value']);
        $this->assertEquals(8536, $visitRow['data']['discharged_to_concept_id']);
        $this->assertEquals('Home', $visitRow['data']['discharged_to_source_value']);
        $this->assertEquals(50, $visitRow['data']['provider_id']);
    }

    public function test_encounter_r5_class_format(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
        $this->crosswalk->shouldReceive('resolveVisitId')->andReturn(100);

        $resource = [
            'resourceType' => 'Encounter',
            'id' => 'enc-r5',
            'class' => [['coding' => [['code' => 'AMB']]]],
            'subject' => ['reference' => 'Patient/patient-1'],
            'period' => ['start' => '2025-01-01'],
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');
        $visitRow = collect($rows)->firstWhere('cdm_table', 'visit_occurrence');

        $this->assertEquals(9202, $visitRow['data']['visit_concept_id']);
    }

    public function test_medication_statement_uses_effective_period(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
        $this->crosswalk->shouldReceive('lookupVisitId')->andReturn(null);
        $this->vocab->shouldReceive('resolve')->andReturn([
            'concept_id' => 789, 'domain_id' => 'Drug', 'source_concept_id' => 789,
            'source_value' => 'rxnorm|789', 'cdm_table' => 'drug_exposure', 'mapping_type' => 'direct_standard',
        ]);

        $resource = [
            'resourceType' => 'MedicationStatement',
            'id' => 'med-1',
            'medicationCodeableConcept' => ['coding' => [['system' => 'http://www.nlm.nih.gov/research/umls/rxnorm', 'code' => '789']]],
            'subject' => ['reference' => 'Patient/patient-1'],
            'effectivePeriod' => ['start' => '2025-01-01', 'end' => '2025-01-30'],
            'dosageInstruction' => [['text' => 'Take 1 tablet daily', 'route' => ['coding' => [['code' => 'oral', 'display' => 'Oral']]]]],
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');
        $drugRow = collect($rows)->firstWhere('cdm_table', 'drug_exposure');

        $this->assertEquals('2025-01-01', $drugRow['data']['drug_exposure_start_date']);
        $this->assertEquals('2025-01-30', $drugRow['data']['drug_exposure_end_date']);
        $this->assertEquals('Take 1 tablet daily', $drugRow['data']['sig']);
    }

    public function test_medication_request_uses_authored_on(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
        $this->crosswalk->shouldReceive('lookupVisitId')->andReturn(null);
        $this->vocab->shouldReceive('resolve')->andReturn([
            'concept_id' => 101, 'domain_id' => 'Drug', 'source_concept_id' => 101,
            'source_value' => 'rxnorm|101', 'cdm_table' => 'drug_exposure', 'mapping_type' => 'direct_standard',
        ]);

        $resource = [
            'resourceType' => 'MedicationRequest',
            'id' => 'med-2',
            'medicationCodeableConcept' => ['coding' => [['system' => 'http://www.nlm.nih.gov/research/umls/rxnorm', 'code' => '101']]],
            'subject' => ['reference' => 'Patient/patient-1'],
            'authoredOn' => '2025-03-01',
            'dispenseRequest' => ['expectedSupplyDuration' => ['value' => 30, 'unit' => 'days']],
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');
        $drugRow = collect($rows)->firstWhere('cdm_table', 'drug_exposure');

        $this->assertEquals('2025-03-01', $drugRow['data']['drug_exposure_start_date']);
        $this->assertEquals('2025-03-31', $drugRow['data']['drug_exposure_end_date']);
    }

    public function test_procedure_extracts_end_date_and_provider(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
        $this->crosswalk->shouldReceive('lookupVisitId')->andReturn(null);
        $this->crosswalk->shouldReceive('resolveProviderId')->andReturn(25);
        $this->vocab->shouldReceive('resolve')->andReturn([
            'concept_id' => 500, 'domain_id' => 'Procedure', 'source_concept_id' => 500,
            'source_value' => 'cpt4|500', 'cdm_table' => 'procedure_occurrence', 'mapping_type' => 'direct_standard',
        ]);

        $resource = [
            'resourceType' => 'Procedure',
            'id' => 'proc-1',
            'status' => 'completed',
            'code' => ['coding' => [['system' => 'http://www.ama-assn.org/go/cpt', 'code' => '500']]],
            'subject' => ['reference' => 'Patient/patient-1'],
            'performedPeriod' => ['start' => '2025-01-01T10:00:00Z', 'end' => '2025-01-01T11:30:00Z'],
            'performer' => [['actor' => ['reference' => 'Practitioner/prac-1']]],
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');
        $procRow = collect($rows)->firstWhere('cdm_table', 'procedure_occurrence');

        $this->assertNotNull($procRow);
        $this->assertEquals('2025-01-01', $procRow['data']['procedure_end_date']);
        $this->assertNotNull($procRow['data']['procedure_end_datetime']);
        $this->assertEquals(25, $procRow['data']['provider_id']);
    }

    public function test_procedure_non_completed_is_skipped(): void
    {
        $resource = [
            'resourceType' => 'Procedure',
            'id' => 'proc-2',
            'status' => 'preparation',
            'code' => ['coding' => [['system' => 'http://www.ama-assn.org/go/cpt', 'code' => '123']]],
            'subject' => ['reference' => 'Patient/patient-1'],
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');

        $this->assertEmpty($rows);
    }

    public function test_immunization_maps_lot_route_quantity(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
        $this->vocab->shouldReceive('resolve')->andReturn([
            'concept_id' => 600, 'domain_id' => 'Drug', 'source_concept_id' => 600,
            'source_value' => 'cvx|600', 'cdm_table' => 'drug_exposure', 'mapping_type' => 'direct_standard',
        ]);

        $resource = [
            'resourceType' => 'Immunization',
            'id' => 'imm-1',
            'status' => 'completed',
            'vaccineCode' => ['coding' => [['system' => 'http://hl7.org/fhir/sid/cvx', 'code' => '600']]],
            'patient' => ['reference' => 'Patient/patient-1'],
            'occurrenceDateTime' => '2025-06-01',
            'lotNumber' => 'LOT123ABC',
            'route' => ['coding' => [['code' => 'IM', 'display' => 'Intramuscular']], 'text' => 'Intramuscular'],
            'doseQuantity' => ['value' => 0.5, 'unit' => 'mL'],
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');
        $drugRow = collect($rows)->firstWhere('cdm_table', 'drug_exposure');

        $this->assertEquals('LOT123ABC', $drugRow['data']['lot_number']);
        $this->assertEquals(0.5, $drugRow['data']['quantity']);
        $this->assertEquals('mL', $drugRow['data']['dose_unit_source_value']);
        $this->assertEquals('Intramuscular', $drugRow['data']['route_source_value']);
    }

    public function test_immunization_not_done_routes_to_observation(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
        $this->vocab->shouldReceive('resolve')->andReturn([
            'concept_id' => 999, 'domain_id' => 'Drug', 'source_concept_id' => 999,
            'source_value' => 'cvx|999', 'cdm_table' => 'drug_exposure', 'mapping_type' => 'direct_standard',
        ]);

        $resource = [
            'resourceType' => 'Immunization',
            'id' => 'imm-2',
            'status' => 'not-done',
            'vaccineCode' => ['coding' => [['system' => 'http://hl7.org/fhir/sid/cvx', 'code' => '999']]],
            'patient' => ['reference' => 'Patient/patient-1'],
            'occurrenceDateTime' => '2025-06-01',
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');
        $obsRow = collect($rows)->firstWhere('cdm_table', 'observation');

        $this->assertNotNull($obsRow, 'not-done immunization should route to observation table per IG');
        $this->assertEquals(1, $obsRow['data']['person_id']);
    }

    public function test_immunization_entered_in_error_is_skipped(): void
    {
        $resource = [
            'resourceType' => 'Immunization',
            'id' => 'imm-3',
            'status' => 'entered-in-error',
            'vaccineCode' => ['coding' => [['system' => 'http://hl7.org/fhir/sid/cvx', 'code' => '999']]],
            'patient' => ['reference' => 'Patient/patient-1'],
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');

        $this->assertEmpty($rows);
    }

    public function test_measurement_resolves_unit_concept_id(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
        $this->crosswalk->shouldReceive('lookupVisitId')->andReturn(null);
        $this->vocab->shouldReceive('resolve')->andReturn([
            'concept_id' => 3000963, 'domain_id' => 'Measurement', 'source_concept_id' => 3000963,
            'source_value' => 'loinc|2345-7', 'cdm_table' => 'measurement', 'mapping_type' => 'direct_standard',
        ]);
        $this->vocab->shouldReceive('resolveUcumUnit')->with('mg/dL')->andReturn(8840);

        $resource = [
            'resourceType' => 'Observation',
            'id' => 'obs-1',
            'code' => ['coding' => [['system' => 'http://loinc.org', 'code' => '2345-7']]],
            'subject' => ['reference' => 'Patient/patient-1'],
            'effectiveDateTime' => '2025-01-01',
            'category' => [['coding' => [['code' => 'laboratory']]]],
            'valueQuantity' => ['value' => 95.5, 'unit' => 'mg/dL', 'code' => 'mg/dL'],
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');
        $measRow = collect($rows)->firstWhere('cdm_table', 'measurement');

        $this->assertEquals(8840, $measRow['data']['unit_concept_id']);
        $this->assertEquals('mg/dL', $measRow['data']['unit_source_value']);
    }

    public function test_observation_maps_value_as_concept_id(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
        $this->crosswalk->shouldReceive('lookupVisitId')->andReturn(null);
        $this->vocab->shouldReceive('resolve')
            ->with([['system' => 'http://snomed.info/sct', 'code' => '365980008']])
            ->andReturn([
                'concept_id' => 4275495, 'domain_id' => 'Observation', 'source_concept_id' => 4275495,
                'source_value' => 'snomed|365980008', 'cdm_table' => 'observation', 'mapping_type' => 'direct_standard',
            ]);
        $this->vocab->shouldReceive('resolve')
            ->with([['system' => 'http://snomed.info/sct', 'code' => '260373001']])
            ->andReturn([
                'concept_id' => 4181412, 'domain_id' => 'Meas Value', 'source_concept_id' => 4181412,
                'source_value' => 'snomed|260373001', 'cdm_table' => null, 'mapping_type' => 'direct_standard',
            ]);

        $resource = [
            'resourceType' => 'Observation',
            'id' => 'obs-2',
            'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '365980008']]],
            'subject' => ['reference' => 'Patient/patient-1'],
            'effectiveDateTime' => '2025-01-01',
            'category' => [['coding' => [['code' => 'social-history']]]],
            'valueCodeableConcept' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '260373001']]],
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');
        $obsRow = collect($rows)->firstWhere('cdm_table', 'observation');

        $this->assertEquals(4181412, $obsRow['data']['value_as_concept_id']);
    }

    public function test_allergy_uses_value_as_concept_pattern(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
        $this->vocab->shouldReceive('resolve')
            ->with([['system' => 'http://snomed.info/sct', 'code' => '372687004']])
            ->andReturn([
                'concept_id' => 1500, 'domain_id' => 'Drug', 'source_concept_id' => 1500,
                'source_value' => 'snomed|372687004', 'cdm_table' => 'drug_exposure', 'mapping_type' => 'direct_standard',
            ]);

        $resource = [
            'resourceType' => 'AllergyIntolerance',
            'id' => 'allergy-1',
            'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '372687004']]],
            'patient' => ['reference' => 'Patient/patient-1'],
            'recordedDate' => '2025-01-01',
            'category' => ['medication'],
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');
        $obsRow = collect($rows)->firstWhere('cdm_table', 'observation');

        $this->assertEquals(439224, $obsRow['data']['observation_concept_id']); // Drug allergy category
        $this->assertEquals(1500, $obsRow['data']['value_as_concept_id']); // Specific substance
    }

    public function test_encounter_generates_provider_and_caresite_rows(): void
    {
        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
        $this->crosswalk->shouldReceive('resolveVisitId')->andReturn(100);
        $this->crosswalk->shouldReceive('resolveProviderId')->andReturn(50);
        $this->crosswalk->shouldReceive('resolveCareSiteId')->andReturn(10);
        $this->crosswalk->shouldReceive('resolveLocationId')->andReturn(5);

        $resource = [
            'resourceType' => 'Encounter',
            'id' => 'enc-multi',
            'class' => ['code' => 'IMP'],
            'subject' => ['reference' => 'Patient/patient-1'],
            'period' => ['start' => '2025-01-01', 'end' => '2025-01-05'],
            'participant' => [
                ['individual' => ['reference' => 'Practitioner/prac-1', 'display' => 'Dr. Smith']],
            ],
            'serviceProvider' => ['reference' => 'Organization/org-1', 'display' => 'General Hospital'],
            'location' => [['location' => ['reference' => 'Location/loc-1']]],
        ];

        $rows = $this->mapper->mapResource($resource, 'test-site');

        $visitRow = collect($rows)->firstWhere('cdm_table', 'visit_occurrence');
        $providerRow = collect($rows)->firstWhere('cdm_table', 'provider');
        $careSiteRow = collect($rows)->firstWhere('cdm_table', 'care_site');

        $this->assertNotNull($visitRow);
        $this->assertEquals(50, $visitRow['data']['provider_id']);
        $this->assertEquals(10, $visitRow['data']['care_site_id']);

        $this->assertNotNull($providerRow);
        $this->assertEquals(50, $providerRow['data']['provider_id']);
        $this->assertEquals('Dr. Smith', $providerRow['data']['provider_name']);

        $this->assertNotNull($careSiteRow);
        $this->assertEquals(10, $careSiteRow['data']['care_site_id']);
        $this->assertEquals('General Hospital', $careSiteRow['data']['care_site_name']);
    }
}
