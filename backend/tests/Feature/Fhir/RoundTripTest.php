<?php

declare(strict_types=1);

namespace Tests\Feature\Fhir;

use App\Services\Fhir\CrosswalkService;
use App\Services\Fhir\Export\Builders\ConditionBuilder;
use App\Services\Fhir\Export\Builders\ObservationBuilder;
use App\Services\Fhir\Export\Builders\PatientBuilder;
use App\Services\Fhir\Export\ReverseVocabularyService;
use App\Services\Fhir\FhirBulkMapper;
use App\Services\Fhir\VocabularyLookupService;
use Mockery;
use Tests\TestCase;

/**
 * Round-trip integration tests: FHIR → OMOP (via FhirBulkMapper) → FHIR (via Export Builders).
 *
 * These tests verify that key fields survive a full round trip through both layers
 * without requiring a live database connection. Vocabulary and crosswalk services
 * are mocked to provide deterministic concept resolution.
 */
class RoundTripTest extends TestCase
{
    private FhirBulkMapper $mapper;

    private VocabularyLookupService $vocab;

    private CrosswalkService $crosswalk;

    private ReverseVocabularyService $reverseVocab;

    protected function setUp(): void
    {
        parent::setUp();
        $this->vocab = Mockery::mock(VocabularyLookupService::class);
        $this->crosswalk = Mockery::mock(CrosswalkService::class);
        $this->mapper = new FhirBulkMapper($this->vocab, $this->crosswalk);
        $this->reverseVocab = Mockery::mock(ReverseVocabularyService::class);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Patient round-trip
    // ──────────────────────────────────────────────────────────────────────────

    public function test_patient_round_trip_preserves_gender_and_birthdate(): void
    {
        // Arrange: FHIR Patient resource
        $fhirPatient = [
            'resourceType' => 'Patient',
            'id' => 'patient-rt-1',
            'gender' => 'female',
            'birthDate' => '1985-03-15',
        ];

        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(42);
        $this->reverseVocab->shouldReceive('resolve')->andReturn(['concept_id' => 0, 'coding' => []]);

        // Forward: FHIR → OMOP
        $rows = $this->mapper->mapResource($fhirPatient, 'test-site');
        $personRow = collect($rows)->firstWhere('cdm_table', 'person');

        $this->assertNotNull($personRow);
        $omopPerson = $personRow['data'];

        // Verify intermediate OMOP state
        $this->assertEquals(42, $omopPerson['person_id']);
        $this->assertEquals(8532, $omopPerson['gender_concept_id']); // female
        $this->assertEquals(1985, $omopPerson['year_of_birth']);
        $this->assertEquals(3, $omopPerson['month_of_birth']);
        $this->assertEquals(15, $omopPerson['day_of_birth']);
        $this->assertEquals('patient-rt-1', $omopPerson['person_source_value']);

        // Reverse: OMOP → FHIR (PatientBuilder)
        $personObj = (object) array_merge($omopPerson, [
            'birth_datetime' => null,
            'race_concept_id' => 0,
            'race_source_value' => null,
            'ethnicity_concept_id' => 0,
            'ethnicity_source_value' => null,
        ]);

        $builder = new PatientBuilder($this->reverseVocab);
        $resultFhir = $builder->build($personObj);

        // Assert key fields preserved
        $this->assertEquals('Patient', $resultFhir['resourceType']);
        $this->assertEquals('female', $resultFhir['gender']);
        $this->assertEquals('1985-03-15', $resultFhir['birthDate']);
    }

    public function test_patient_round_trip_preserves_male_gender(): void
    {
        $fhirPatient = [
            'resourceType' => 'Patient',
            'id' => 'patient-rt-2',
            'gender' => 'male',
            'birthDate' => '1970-11-08',
        ];

        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(99);
        $this->reverseVocab->shouldReceive('resolve')->andReturn(['concept_id' => 0, 'coding' => []]);

        $rows = $this->mapper->mapResource($fhirPatient, 'test-site');
        $personRow = collect($rows)->firstWhere('cdm_table', 'person');
        $omopPerson = $personRow['data'];

        $this->assertEquals(8507, $omopPerson['gender_concept_id']); // male

        $personObj = (object) ($omopPerson + [
            'birth_datetime' => null,
            'race_concept_id' => 0,
            'race_source_value' => null,
            'ethnicity_concept_id' => 0,
            'ethnicity_source_value' => null,
        ]);

        $builder = new PatientBuilder($this->reverseVocab);
        $resultFhir = $builder->build($personObj);

        $this->assertEquals('male', $resultFhir['gender']);
        $this->assertEquals('1970-11-08', $resultFhir['birthDate']);
    }

    public function test_patient_round_trip_preserves_deceased_datetime(): void
    {
        $fhirPatient = [
            'resourceType' => 'Patient',
            'id' => 'patient-rt-deceased',
            'gender' => 'female',
            'birthDate' => '1950-01-01',
            'deceasedDateTime' => '2025-06-01T14:30:00Z',
        ];

        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(10);
        $this->reverseVocab->shouldReceive('resolve')->andReturn(['concept_id' => 0, 'coding' => []]);

        $rows = $this->mapper->mapResource($fhirPatient, 'test-site');
        $personRow = collect($rows)->firstWhere('cdm_table', 'person');
        $deathRow = collect($rows)->firstWhere('cdm_table', 'death');

        $this->assertNotNull($deathRow, 'Expected a death row for deceased patient');
        $this->assertEquals('2025-06-01', $deathRow['data']['death_date']);
        $this->assertEquals(32817, $deathRow['data']['death_type_concept_id']);

        // Reverse: build FHIR Patient with death object
        $personObj = (object) ($personRow['data'] + [
            'birth_datetime' => null,
            'race_concept_id' => 0,
            'race_source_value' => null,
            'ethnicity_concept_id' => 0,
            'ethnicity_source_value' => null,
        ]);

        $deathObj = (object) [
            'person_id' => 10,
            'death_datetime' => '2025-06-01 14:30:00',
        ];

        $builder = new PatientBuilder($this->reverseVocab);
        $resultFhir = $builder->build($personObj, $deathObj);

        $this->assertEquals('female', $resultFhir['gender']);
        $this->assertArrayHasKey('deceasedDateTime', $resultFhir);
        $this->assertEquals('2025-06-01 14:30:00', $resultFhir['deceasedDateTime']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Condition round-trip
    // ──────────────────────────────────────────────────────────────────────────

    public function test_condition_round_trip_preserves_code_status_and_dates(): void
    {
        // Arrange: FHIR Condition with SNOMED code and active status
        $snomedCode = '44054006'; // Diabetes mellitus type 2
        $conceptId = 201826;

        $fhirCondition = [
            'resourceType' => 'Condition',
            'id' => 'cond-rt-1',
            'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => $snomedCode]]],
            'subject' => ['reference' => 'Patient/patient-rt-1'],
            'clinicalStatus' => ['coding' => [['code' => 'active']]],
            'category' => [['coding' => [['code' => 'encounter-diagnosis']]]],
            'onsetDateTime' => '2024-01-15',
            'abatementDateTime' => '2024-06-30',
        ];

        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(42);
        $this->crosswalk->shouldReceive('lookupVisitId')->andReturn(null);
        $this->vocab->shouldReceive('resolve')->andReturn([
            'concept_id' => $conceptId,
            'domain_id' => 'Condition',
            'source_concept_id' => $conceptId,
            'source_value' => "http://snomed.info/sct|{$snomedCode}",
            'cdm_table' => 'condition_occurrence',
            'mapping_type' => 'direct_standard',
        ]);

        // Forward: FHIR → OMOP
        $rows = $this->mapper->mapResource($fhirCondition, 'test-site');
        $condRow = collect($rows)->firstWhere('cdm_table', 'condition_occurrence');

        $this->assertNotNull($condRow);
        $omopCond = $condRow['data'];

        // Verify OMOP fields
        $this->assertEquals($conceptId, $omopCond['condition_concept_id']);
        $this->assertEquals(4230359, $omopCond['condition_status_concept_id']); // active
        $this->assertEquals(32817, $omopCond['condition_type_concept_id']); // encounter-diagnosis
        $this->assertEquals('2024-01-15', $omopCond['condition_start_date']);
        $this->assertEquals('2024-06-30', $omopCond['condition_end_date']);

        // Reverse: OMOP → FHIR (ConditionBuilder)
        $this->reverseVocab->shouldReceive('buildCodeableConcept')
            ->with($conceptId, $conceptId, "http://snomed.info/sct|{$snomedCode}")
            ->andReturn([
                'coding' => [['system' => 'http://snomed.info/sct', 'code' => $snomedCode, 'display' => 'Diabetes mellitus type 2']],
                'text' => "http://snomed.info/sct|{$snomedCode}",
            ]);

        $condObj = (object) ($omopCond + ['condition_occurrence_id' => 55, 'condition_start_datetime' => null, 'condition_end_datetime' => null]);

        $builder = new ConditionBuilder($this->reverseVocab);
        $resultFhir = $builder->build($condObj);

        // Assert key fields preserved through round trip.
        // The mapper converts dates to datetimes (YYYY-MM-DD HH:MM:SS) — ConditionBuilder
        // prefers condition_start_datetime when set, so onsetDateTime has the full datetime.
        $this->assertEquals('Condition', $resultFhir['resourceType']);
        $this->assertEquals('Patient/42', $resultFhir['subject']['reference']);
        $this->assertEquals('active', $resultFhir['clinicalStatus']['coding'][0]['code']);
        $this->assertEquals('encounter-diagnosis', $resultFhir['category'][0]['coding'][0]['code']);
        $this->assertStringStartsWith('2024-01-15', $resultFhir['onsetDateTime']);
        $this->assertStringStartsWith('2024-06-30', $resultFhir['abatementDateTime']);

        // Verify the SNOMED code survives through
        $this->assertEquals($snomedCode, $resultFhir['code']['coding'][0]['code']);
    }

    public function test_condition_round_trip_resolved_status_maps_correctly(): void
    {
        $fhirCondition = [
            'resourceType' => 'Condition',
            'id' => 'cond-rt-2',
            'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '195967001']]],
            'subject' => ['reference' => 'Patient/patient-rt-1'],
            'clinicalStatus' => ['coding' => [['code' => 'resolved']]],
            'category' => [['coding' => [['code' => 'problem-list-item']]]],
            'onsetDateTime' => '2020-05-01',
        ];

        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(7);
        $this->crosswalk->shouldReceive('lookupVisitId')->andReturn(null);
        $this->vocab->shouldReceive('resolve')->andReturn([
            'concept_id' => 317009,
            'domain_id' => 'Condition',
            'source_concept_id' => 317009,
            'source_value' => 'http://snomed.info/sct|195967001',
            'cdm_table' => 'condition_occurrence',
            'mapping_type' => 'direct_standard',
        ]);

        $rows = $this->mapper->mapResource($fhirCondition, 'test-site');
        $condRow = collect($rows)->firstWhere('cdm_table', 'condition_occurrence');
        $omopCond = $condRow['data'];

        // resolved → 4201906, problem-list-item → 32840
        $this->assertEquals(4201906, $omopCond['condition_status_concept_id']);
        $this->assertEquals(32840, $omopCond['condition_type_concept_id']);

        // Reverse
        $this->reverseVocab->shouldReceive('buildCodeableConcept')
            ->andReturn(['coding' => [['system' => 'http://snomed.info/sct', 'code' => '195967001', 'display' => 'Asthma']]]);

        $condObj = (object) ($omopCond + ['condition_occurrence_id' => 88, 'condition_start_datetime' => null, 'condition_end_datetime' => null]);
        $builder = new ConditionBuilder($this->reverseVocab);
        $resultFhir = $builder->build($condObj);

        // "resolved" maps back to "resolved" in ConditionBuilder STATUS_REVERSE
        $this->assertEquals('resolved', $resultFhir['clinicalStatus']['coding'][0]['code']);
        $this->assertEquals('problem-list-item', $resultFhir['category'][0]['coding'][0]['code']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Observation round-trip
    // ──────────────────────────────────────────────────────────────────────────

    public function test_social_history_observation_round_trip_preserves_string_value(): void
    {
        $fhirObs = [
            'resourceType' => 'Observation',
            'id' => 'obs-rt-1',
            'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '365980008']]],
            'subject' => ['reference' => 'Patient/patient-rt-1'],
            'effectiveDateTime' => '2024-03-01',
            'category' => [['coding' => [['code' => 'social-history']]]],
            'valueString' => 'Never smoker',
        ];

        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(42);
        $this->crosswalk->shouldReceive('lookupVisitId')->andReturn(null);
        $this->vocab->shouldReceive('resolve')->andReturn([
            'concept_id' => 4275495,
            'domain_id' => 'Observation',
            'source_concept_id' => 4275495,
            'source_value' => 'snomed|365980008',
            'cdm_table' => 'observation',
            'mapping_type' => 'direct_standard',
        ]);

        // Forward: FHIR → OMOP
        $rows = $this->mapper->mapResource($fhirObs, 'test-site');
        $obsRow = collect($rows)->firstWhere('cdm_table', 'observation');

        $this->assertNotNull($obsRow);
        $omopObs = $obsRow['data'];

        $this->assertEquals(4275495, $omopObs['observation_concept_id']);
        $this->assertEquals('2024-03-01', $omopObs['observation_date']);
        $this->assertEquals('Never smoker', $omopObs['value_as_string']);

        // Reverse: OMOP → FHIR (ObservationBuilder)
        $this->reverseVocab->shouldReceive('buildCodeableConcept')
            ->andReturn(['coding' => [['system' => 'http://snomed.info/sct', 'code' => '365980008', 'display' => 'Tobacco use']]]);
        $this->reverseVocab->shouldReceive('resolve')->andReturn(['concept_id' => 0, 'coding' => []]);

        $obsObj = (object) ($omopObs + [
            'observation_id' => 101,
            'observation_datetime' => null,
            'value_as_number' => null,
            'value_as_concept_id' => 0,
            'visit_occurrence_id' => null,
        ]);

        $builder = new ObservationBuilder($this->reverseVocab);
        $resultFhir = $builder->build($obsObj);

        // Assert key fields preserved.
        // The mapper converts effectiveDateTime to observation_datetime (YYYY-MM-DD HH:MM:SS);
        // ObservationBuilder uses observation_datetime when set, so the output has the full timestamp.
        $this->assertEquals('Observation', $resultFhir['resourceType']);
        $this->assertEquals('final', $resultFhir['status']);
        $this->assertEquals('Patient/42', $resultFhir['subject']['reference']);
        $this->assertEquals('Never smoker', $resultFhir['valueString']);
        $this->assertStringStartsWith('2024-03-01', $resultFhir['effectiveDateTime']);
        $this->assertArrayNotHasKey('encounter', $resultFhir);
    }

    public function test_observation_round_trip_preserves_value_as_concept(): void
    {
        $fhirObs = [
            'resourceType' => 'Observation',
            'id' => 'obs-rt-2',
            'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '365980008']]],
            'subject' => ['reference' => 'Patient/patient-rt-1'],
            'effectiveDateTime' => '2024-04-10',
            'category' => [['coding' => [['code' => 'social-history']]]],
            'valueCodeableConcept' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '260373001']]],
        ];

        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(42);
        $this->crosswalk->shouldReceive('lookupVisitId')->andReturn(null);

        // First resolve() call: the observation code itself
        $this->vocab->shouldReceive('resolve')
            ->with([['system' => 'http://snomed.info/sct', 'code' => '365980008']])
            ->andReturn([
                'concept_id' => 4275495,
                'domain_id' => 'Observation',
                'source_concept_id' => 4275495,
                'source_value' => 'snomed|365980008',
                'cdm_table' => 'observation',
                'mapping_type' => 'direct_standard',
            ]);

        // Second resolve() call: the valueCodeableConcept
        $this->vocab->shouldReceive('resolve')
            ->with([['system' => 'http://snomed.info/sct', 'code' => '260373001']])
            ->andReturn([
                'concept_id' => 4181412,
                'domain_id' => 'Meas Value',
                'source_concept_id' => 4181412,
                'source_value' => 'snomed|260373001',
                'cdm_table' => null,
                'mapping_type' => 'direct_standard',
            ]);

        // Forward: FHIR → OMOP
        $rows = $this->mapper->mapResource($fhirObs, 'test-site');
        $obsRow = collect($rows)->firstWhere('cdm_table', 'observation');
        $omopObs = $obsRow['data'];

        $this->assertEquals(4275495, $omopObs['observation_concept_id']);
        $this->assertEquals(4181412, $omopObs['value_as_concept_id']);

        // Reverse: OMOP → FHIR — value_as_concept_id should be rendered as valueCodeableConcept
        $this->reverseVocab->shouldReceive('buildCodeableConcept')
            ->andReturn(['coding' => [['system' => 'http://snomed.info/sct', 'code' => '365980008', 'display' => 'Tobacco use']]]);

        $valueCoding = ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '260373001', 'display' => 'Detected']]];
        $this->reverseVocab->shouldReceive('resolve')
            ->with(4181412)
            ->andReturn(['concept_id' => 4181412, 'coding' => $valueCoding['coding']]);

        $obsObj = (object) ($omopObs + [
            'observation_id' => 102,
            'observation_datetime' => null,
            'value_as_number' => null,
            'value_as_string' => null,
            'visit_occurrence_id' => null,
        ]);

        $builder = new ObservationBuilder($this->reverseVocab);
        $resultFhir = $builder->build($obsObj);

        $this->assertEquals('Observation', $resultFhir['resourceType']);
        $this->assertArrayHasKey('valueCodeableConcept', $resultFhir);
        $this->assertEquals('260373001', $resultFhir['valueCodeableConcept']['coding'][0]['code']);
    }

    public function test_observation_round_trip_with_visit_reference(): void
    {
        $fhirObs = [
            'resourceType' => 'Observation',
            'id' => 'obs-rt-3',
            'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '365980008']]],
            'subject' => ['reference' => 'Patient/patient-rt-1'],
            'encounter' => ['reference' => 'Encounter/enc-1'],
            'effectiveDateTime' => '2024-05-20',
            'category' => [['coding' => [['code' => 'social-history']]]],
            'valueString' => 'Ex-smoker',
        ];

        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(42);
        $this->crosswalk->shouldReceive('lookupVisitId')->with('test-site', 'enc-1')->andReturn(500);
        $this->vocab->shouldReceive('resolve')->andReturn([
            'concept_id' => 4275495,
            'domain_id' => 'Observation',
            'source_concept_id' => 4275495,
            'source_value' => 'snomed|365980008',
            'cdm_table' => 'observation',
            'mapping_type' => 'direct_standard',
        ]);

        $rows = $this->mapper->mapResource($fhirObs, 'test-site');
        $obsRow = collect($rows)->firstWhere('cdm_table', 'observation');
        $omopObs = $obsRow['data'];

        // Visit ID must survive forward pass
        $this->assertEquals(500, $omopObs['visit_occurrence_id']);

        // Reverse: encounter reference must appear in output FHIR
        $this->reverseVocab->shouldReceive('buildCodeableConcept')->andReturn(['coding' => []]);
        $this->reverseVocab->shouldReceive('resolve')->andReturn(['concept_id' => 0, 'coding' => []]);

        $obsObj = (object) ($omopObs + [
            'observation_id' => 103,
            'observation_datetime' => null,
            'value_as_number' => null,
            'value_as_concept_id' => 0,
        ]);

        $builder = new ObservationBuilder($this->reverseVocab);
        $resultFhir = $builder->build($obsObj);

        $this->assertArrayHasKey('encounter', $resultFhir);
        $this->assertEquals('Encounter/500', $resultFhir['encounter']['reference']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Source value preservation
    // ──────────────────────────────────────────────────────────────────────────

    public function test_condition_source_value_preserved_through_round_trip(): void
    {
        $sourceValue = 'http://snomed.info/sct|44054006';

        $fhirCondition = [
            'resourceType' => 'Condition',
            'id' => 'cond-sv-1',
            'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '44054006']]],
            'subject' => ['reference' => 'Patient/patient-1'],
            'clinicalStatus' => ['coding' => [['code' => 'active']]],
            'category' => [['coding' => [['code' => 'encounter-diagnosis']]]],
            'onsetDateTime' => '2023-01-01',
        ];

        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
        $this->crosswalk->shouldReceive('lookupVisitId')->andReturn(null);
        $this->vocab->shouldReceive('resolve')->andReturn([
            'concept_id' => 201826,
            'domain_id' => 'Condition',
            'source_concept_id' => 201826,
            'source_value' => $sourceValue,
            'cdm_table' => 'condition_occurrence',
            'mapping_type' => 'direct_standard',
        ]);

        $rows = $this->mapper->mapResource($fhirCondition, 'test-site');
        $condRow = collect($rows)->firstWhere('cdm_table', 'condition_occurrence');
        $omopCond = $condRow['data'];

        // Source value preserved in OMOP
        $this->assertEquals($sourceValue, $omopCond['condition_source_value']);

        // Source value becomes 'text' in reverse FHIR resource via buildCodeableConcept
        $this->reverseVocab->shouldReceive('buildCodeableConcept')
            ->with(201826, 201826, $sourceValue)
            ->andReturn(['coding' => [], 'text' => $sourceValue]);

        $condObj = (object) ($omopCond + [
            'condition_occurrence_id' => 99,
            'condition_start_datetime' => null,
            'condition_end_datetime' => null,
        ]);

        $builder = new ConditionBuilder($this->reverseVocab);
        $resultFhir = $builder->build($condObj);

        // text field carries the original source value
        $this->assertEquals($sourceValue, $resultFhir['code']['text']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Person-ID linkage across resources
    // ──────────────────────────────────────────────────────────────────────────

    public function test_patient_and_condition_share_same_person_id(): void
    {
        $personId = 77;

        $fhirPatient = [
            'resourceType' => 'Patient',
            'id' => 'shared-patient',
            'gender' => 'male',
            'birthDate' => '1960-07-04',
        ];

        $fhirCondition = [
            'resourceType' => 'Condition',
            'id' => 'shared-cond',
            'code' => ['coding' => [['system' => 'http://snomed.info/sct', 'code' => '73211009']]],
            'subject' => ['reference' => 'Patient/shared-patient'],
            'clinicalStatus' => ['coding' => [['code' => 'active']]],
            'category' => [['coding' => [['code' => 'problem-list-item']]]],
            'onsetDateTime' => '2022-01-01',
        ];

        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn($personId);
        $this->crosswalk->shouldReceive('lookupVisitId')->andReturn(null);
        $this->vocab->shouldReceive('resolve')->andReturn([
            'concept_id' => 44831230,
            'domain_id' => 'Condition',
            'source_concept_id' => 44831230,
            'source_value' => 'snomed|73211009',
            'cdm_table' => 'condition_occurrence',
            'mapping_type' => 'direct_standard',
        ]);

        $patientRows = $this->mapper->mapResource($fhirPatient, 'test-site');
        $conditionRows = $this->mapper->mapResource($fhirCondition, 'test-site');

        $personRow = collect($patientRows)->firstWhere('cdm_table', 'person');
        $condRow = collect($conditionRows)->firstWhere('cdm_table', 'condition_occurrence');

        // Both resources must share the same person_id
        $this->assertEquals($personId, $personRow['data']['person_id']);
        $this->assertEquals($personId, $condRow['data']['person_id']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // FHIR metadata stamps
    // ──────────────────────────────────────────────────────────────────────────

    public function test_mapper_stamps_fhir_metadata_on_all_rows(): void
    {
        $fhirPatient = [
            'resourceType' => 'Patient',
            'id' => 'meta-patient',
            'gender' => 'other',
            'birthDate' => '2000-01-01',
        ];

        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(5);

        $rows = $this->mapper->mapResource($fhirPatient, 'test-site');

        foreach ($rows as $row) {
            $this->assertEquals('Patient', $row['fhir_resource_type']);
            $this->assertEquals('meta-patient', $row['fhir_resource_id']);
        }
    }

    public function test_mapper_stamps_fhir_metadata_on_multi_row_response(): void
    {
        // Deceased patient → person + death rows (two rows, both stamped)
        $fhirPatient = [
            'resourceType' => 'Patient',
            'id' => 'deceased-meta',
            'gender' => 'female',
            'birthDate' => '1940-05-10',
            'deceasedBoolean' => true,
        ];

        $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(3);

        $rows = $this->mapper->mapResource($fhirPatient, 'test-site');

        $this->assertCount(2, $rows);
        foreach ($rows as $row) {
            $this->assertEquals('Patient', $row['fhir_resource_type']);
            $this->assertEquals('deceased-meta', $row['fhir_resource_id']);
        }
    }
}
