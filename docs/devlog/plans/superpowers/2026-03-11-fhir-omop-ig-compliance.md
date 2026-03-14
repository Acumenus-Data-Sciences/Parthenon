# FHIR-OMOP IG Compliance & Bidirectional Bridge — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Parthenon's FHIR pipeline to full HL7 FHIR-OMOP IG v1.0.0 compliance and add a reverse OMOP-to-FHIR R4 server, creating a bidirectional bridge.

**Architecture:** Enhance existing `FhirBulkMapper` with missing field-level mappings (Phase A), add new CDM table generators with multi-row mapper return type (Phase B), then build a new `Services/Fhir/Export/` layer with per-resource builders, a FHIR R4 read/search API, and bulk export job (Phase C).

**Tech Stack:** Laravel 11 / PHP 8.4, PostgreSQL (OMOP CDM v5.4 vocabulary), FHIR R4 JSON, TanStack Query (frontend)

**Spec:** `docs/superpowers/specs/2026-03-11-fhir-omop-ig-compliance-design.md`

---

## Chunk 1: Phase A — Field-Level IG Compliance

### Task 1: Gender Concept Fix + UCUM Vocabulary Support

**Files:**
- Modify: `backend/app/Services/Fhir/FhirBulkMapper.php:21-26` (GENDER_MAP)
- Modify: `backend/app/Services/Fhir/VocabularyLookupService.php:24-37` (SYSTEM_TO_VOCAB)
- Test: `backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php` (create)

- [ ] **Step 1: Create test file with gender mapping tests**

```php
// backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php
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
}
```

- [ ] **Step 2: Change mapResource() to return array[] (prerequisite for all Phase A tests)**

This change is pulled forward from Phase B (B1) because all Phase A tests expect multi-row return. In `backend/app/Services/Fhir/FhirBulkMapper.php`, change `mapResource()`:

```php
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

    if ($result === null || isset($result['__skip'])) {
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
```

This normalization layer means existing private mapper methods (which return single `['cdm_table' => ..., 'data' => ...]`) continue to work. Methods that return multiple rows (like `mapPatient()` after Task 13) return an array of arrays which passes through unchanged.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php -v`
Expected: FAIL — `gender_concept_id` for 'other' returns 8521 instead of 44814653

- [ ] **Step 5: Fix GENDER_MAP in FhirBulkMapper**

In `backend/app/Services/Fhir/FhirBulkMapper.php`, change the GENDER_MAP constant:

```php
private const GENDER_MAP = [
    'male' => 8507,
    'female' => 8532,
    'other' => 44814653,
    'unknown' => 8551,
];
```

And update `mapPatient()` line 100 to handle null gender:

```php
'gender_concept_id' => self::GENDER_MAP[$r['gender'] ?? ''] ?? 0,
```

- [ ] **Step 6: Add UCUM to VocabularyLookupService**

In `backend/app/Services/Fhir/VocabularyLookupService.php`, add to SYSTEM_TO_VOCAB:

```php
'http://unitsofmeasure.org' => 'UCUM',
```

And add the `resolveUcumUnit()` public method after the `domainToTable()` method:

```php
/**
 * Resolve a UCUM unit code to an OMOP concept_id.
 * Returns 0 if not found in vocabulary.
 */
public function resolveUcumUnit(string $ucumCode): int
{
    if ($ucumCode === '') {
        return 0;
    }

    $concept = $this->lookupConcept('UCUM', $ucumCode);

    return $concept ? (int) $concept['concept_id'] : 0;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php -v`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/app/Services/Fhir/FhirBulkMapper.php backend/app/Services/Fhir/VocabularyLookupService.php backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php
git commit -m "feat(fhir): multi-row return type, gender fix, UCUM vocabulary support

Change mapResource() to return array[] for composite CDM output.
Per HL7 FHIR-OMOP IG v1.0.0: 'other' gender maps to 44814653 (non-binary),
null gender maps to 0. Add UCUM code system to vocabulary lookup for
unit_concept_id resolution."
```

---

### Task 2: Condition Mapper — Status & Category Fields

**Files:**
- Modify: `backend/app/Services/Fhir/FhirBulkMapper.php:141-189` (mapCondition)
- Test: `backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php` (append)

- [ ] **Step 1: Write failing tests for condition status and category**

Append to `FhirBulkMapperTest.php`:

```php
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php -v`
Expected: FAIL — `condition_status_concept_id` key does not exist

- [ ] **Step 3: Add constants and update mapCondition()**

Add new constants to `FhirBulkMapper`:

```php
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
```

Add helper methods:

```php
private function extractConditionStatus(array $r): ?string
{
    return $r['clinicalStatus']['coding'][0]['code'] ?? null;
}

private function extractConditionCategory(array $r): ?string
{
    return $r['category'][0]['coding'][0]['code'] ?? null;
}
```

Update `mapCondition()` — in the `condition_occurrence` return block, **replace** the hardcoded `'condition_type_concept_id' => 32817` with:

```php
'condition_type_concept_id' => self::CONDITION_CATEGORY_MAP[$this->extractConditionCategory($r) ?? ''] ?? 32817,
'condition_status_concept_id' => self::CONDITION_STATUS_MAP[$this->extractConditionStatus($r) ?? ''] ?? 0,
'condition_status_source_value' => $this->extractConditionStatus($r),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Fhir/FhirBulkMapper.php backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php
git commit -m "feat(fhir): add condition status and category mapping per IG

Map clinicalStatus to condition_status_concept_id (active→4230359,
resolved→4201906). Replace hardcoded condition_type_concept_id with
category-based logic (problem-list-item→32840, encounter-diagnosis→32817)."
```

---

### Task 3: Encounter Mapper — Admission, Discharge, Provider, R4/R5 Class

**Files:**
- Modify: `backend/app/Services/Fhir/FhirBulkMapper.php:115-139` (mapEncounter)
- Test: `backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php` (append)

- [ ] **Step 1: Write failing test for encounter admission/discharge/provider**

Append to `FhirBulkMapperTest.php`:

```php
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="encounter" -v`
Expected: FAIL — `admitted_from_concept_id` key does not exist

- [ ] **Step 3: Update mapEncounter() with admission, discharge, provider, R4/R5 class**

In `FhirBulkMapper::mapEncounter()`, replace `$classCode = $r['class']['code'] ?? '';` with:

```php
// R4: class is Coding {code: "AMB"}; R5: class is CodeableConcept[] [{coding: [{code: "AMB"}]}]
$classCode = isset($r['class']['code'])
    ? $r['class']['code']
    : ($r['class'][0]['coding'][0]['code'] ?? '');
```

Add admission/discharge/provider fields to the return data array:

```php
'admitted_from_concept_id' => $this->resolveAdmitSource($r),
'admitted_from_source_value' => $r['hospitalization']['admitSource']['text']
    ?? $r['hospitalization']['admitSource']['coding'][0]['display'] ?? null,
'discharged_to_concept_id' => $this->resolveDischargeDisposition($r),
'discharged_to_source_value' => $r['hospitalization']['dischargeDisposition']['text']
    ?? $r['hospitalization']['dischargeDisposition']['coding'][0]['display'] ?? null,
'provider_id' => $this->resolveEncounterProvider($r, $siteKey),
```

Add helper methods:

```php
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="encounter" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Fhir/FhirBulkMapper.php backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php
git commit -m "feat(fhir): add encounter admission, discharge, provider, R4/R5 class

Map hospitalization.admitSource/dischargeDisposition via vocab lookup.
Extract provider_id from participant[0].individual. Support both R4
Coding and R5 CodeableConcept[] formats for Encounter.class."
```

---

### Task 4: Medication Mapper — Conditional Dates, Sig, Route, Dose

**Files:**
- Modify: `backend/app/Services/Fhir/FhirBulkMapper.php:191-217` (mapMedication)
- Test: `backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php` (append)

- [ ] **Step 1: Write failing tests**

Append to `FhirBulkMapperTest.php`:

```php
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="medication" -v`
Expected: FAIL — dates are wrong, `sig` key missing

- [ ] **Step 3: Rewrite mapMedication() with conditional date logic**

Replace the body of `mapMedication()`:

```php
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="medication" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Fhir/FhirBulkMapper.php backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php
git commit -m "feat(fhir): medication mapper conditional dates, sig, route concept

MedicationStatement uses effectivePeriod; MedicationRequest uses
authoredOn + expectedSupplyDuration. Add sig text, route_concept_id
via vocab lookup."
```

---

### Task 5: Procedure Mapper — End Date, Provider, Status Filter

**Files:**
- Modify: `backend/app/Services/Fhir/FhirBulkMapper.php:243-264` (mapProcedure)
- Test: `backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php` (append)

- [ ] **Step 1: Write failing tests**

Append to `FhirBulkMapperTest.php`:

```php
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="procedure" -v`
Expected: FAIL

- [ ] **Step 3: Update mapProcedure() with end date, provider, status filter**

```php
private function mapProcedure(array $r, string $siteKey): array
{
    // Status filter: only completed procedures per IG
    if (($r['status'] ?? '') !== 'completed') {
        return ['__skip' => true]; // Signal to skip
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
```

Update `mapResource()` to handle the skip signal — after the match block, before setting fhir_resource_type:

```php
if ($mapped !== null && isset($mapped['__skip'])) {
    return null;
}
```

Note: After Phase B's multi-row change, this becomes checking for empty array instead.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="procedure" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Fhir/FhirBulkMapper.php backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php
git commit -m "feat(fhir): procedure end date, provider, status filter per IG

Extract performedPeriod.end for procedure_end_date/datetime. Resolve
provider_id from performer[0].actor. Skip non-completed procedures
per IG requirement."
```

---

### Task 6: Immunization Mapper — Lot, Route, Quantity, Status Filter

**Files:**
- Modify: `backend/app/Services/Fhir/FhirBulkMapper.php:348-368` (mapImmunization)
- Test: `backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php` (append)

- [ ] **Step 1: Write failing tests**

Append to `FhirBulkMapperTest.php`:

```php
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="immunization" -v`
Expected: FAIL

- [ ] **Step 3: Update mapImmunization() with lot, route, quantity, status filter**

```php
private function mapImmunization(array $r, string $siteKey): array
{
    // Status filter per IG: completed/in-progress → drug_exposure, not-done → observation, else skip
    $status = $r['status'] ?? '';
    if (! in_array($status, ['completed', 'in-progress', 'not-done'], true)) {
        return ['__skip' => true];
    }

    // not-done immunizations route to observation table per IG
    if ($status === 'not-done') {
        $codings = $this->extractCodings($r['vaccineCode'] ?? []);
        $resolved = $this->vocab->resolve($codings);
        $personId = $this->resolveSubjectPersonId($r, $siteKey, 'patient');
        $occurrence = $r['occurrenceDateTime'] ?? $r['occurrenceString'] ?? null;

        return [
            'cdm_table' => 'observation',
            'data' => [
                'person_id' => $personId,
                'observation_concept_id' => $resolved['concept_id'],
                'observation_date' => $this->parseDate($occurrence),
                'observation_datetime' => $this->parseDatetime($occurrence),
                'observation_type_concept_id' => 32817,
                'observation_source_value' => $resolved['source_value'],
                'observation_source_concept_id' => $resolved['source_concept_id'],
            ],
        ];
    }

    $codings = $this->extractCodings($r['vaccineCode'] ?? []);
    $resolved = $this->vocab->resolve($codings);
    $personId = $this->resolveSubjectPersonId($r, $siteKey, 'patient');
    $occurrence = $r['occurrenceDateTime'] ?? $r['occurrenceString'] ?? null;

    // Route concept resolution
    $routeCodings = $r['route']['coding'] ?? [];
    $routeResolved = ! empty($routeCodings) ? $this->vocab->resolve($routeCodings) : null;

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
            'lot_number' => $r['lotNumber'] ?? null,
            'route_concept_id' => $routeResolved ? $routeResolved['concept_id'] : 0,
            'route_source_value' => $r['route']['text'] ?? $r['route']['coding'][0]['display'] ?? null,
            'quantity' => isset($r['doseQuantity']['value']) ? (float) $r['doseQuantity']['value'] : null,
            'dose_unit_source_value' => $r['doseQuantity']['unit'] ?? null,
        ],
    ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="immunization" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Fhir/FhirBulkMapper.php backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php
git commit -m "feat(fhir): immunization lot number, route, quantity, status filter

Extract lotNumber, doseQuantity, route with vocab lookup. Filter
out not-done immunizations per IG (only completed/in-progress mapped)."
```

---

### Task 7: Observation/Measurement — Unit Concept, Value-as-Concept, Interpretation

**Files:**
- Modify: `backend/app/Services/Fhir/FhirBulkMapper.php:266-322` (mapObservation)
- Test: `backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php` (append)

- [ ] **Step 1: Write failing tests**

Append to `FhirBulkMapperTest.php`:

```php
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="observation|measurement" -v`
Expected: FAIL

- [ ] **Step 3: Update mapObservation() with unit_concept_id, value_as_concept_id on observation, interpretation**

Add interpretation constant:

```php
/** FHIR Observation.interpretation → OMOP value_as_concept_id. */
private const INTERPRETATION_MAP = [
    'H' => 4328749,    // High
    'L' => 4267416,    // Low
    'N' => 4069590,    // Normal
    'A' => 4135422,    // Abnormal
    'HH' => 4328749,   // Critically high → High
    'LL' => 4267416,   // Critically low → Low
];
```

In the measurement return block, add `unit_concept_id`:

```php
'unit_concept_id' => $this->vocab->resolveUcumUnit($r['valueQuantity']['code'] ?? ''),
```

In the observation return block, add `value_as_concept_id`:

```php
'value_as_concept_id' => $this->extractValueConceptId($r) ?: $this->extractInterpretation($r),
```

Add helper:

```php
private function extractInterpretation(array $r): int
{
    $code = $r['interpretation'][0]['coding'][0]['code'] ?? '';
    return self::INTERPRETATION_MAP[$code] ?? 0;
}
```

Also add `unit_concept_id` and `unit_source_value` to the measurement block (unit_source_value already exists).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="observation|measurement" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Fhir/FhirBulkMapper.php backend/app/Services/Fhir/VocabularyLookupService.php backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php
git commit -m "feat(fhir): observation unit_concept_id, value_as_concept_id, interpretation

Resolve UCUM unit codes to concept IDs for measurements. Add
value_as_concept_id extraction for observation table rows.
Map interpretation codes (H/L/N/A) to OMOP concepts."
```

---

### Task 8: AllergyIntolerance — Value-as-Concept Pattern (Pre-B1, Single Row)

This task implements the allergy category mapping within the current single-row return type. Reaction decomposition into multiple rows will be added in Phase B after the multi-row signature change.

**Files:**
- Modify: `backend/app/Services/Fhir/FhirBulkMapper.php:370-390` (mapAllergyIntolerance)
- Test: `backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php` (append)

- [ ] **Step 1: Write failing test**

Append to `FhirBulkMapperTest.php`:

```php
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="allergy" -v`
Expected: FAIL

- [ ] **Step 3: Update mapAllergyIntolerance() with Value-as-Concept pattern**

Add constant:

```php
/** FHIR AllergyIntolerance.category → OMOP observation_concept_id (Value-as-Concept). */
private const ALLERGY_CATEGORY_MAP = [
    'medication' => 439224,     // Drug allergy
    'food' => 4166257,          // Food allergy
    'environment' => 4196403,   // Environmental allergy
    'biologic' => 439224,       // Fallback to drug allergy
];
```

Rewrite `mapAllergyIntolerance()`:

```php
private function mapAllergyIntolerance(array $r, string $siteKey): array
{
    $codings = $this->extractCodings($r['code'] ?? []);
    $resolved = $this->vocab->resolve($codings);
    $personId = $this->resolveSubjectPersonId($r, $siteKey, 'patient');
    $recorded = $r['recordedDate'] ?? $r['onsetDateTime'] ?? null;

    // Value-as-Concept: category → observation_concept_id, substance → value_as_concept_id
    $category = $r['category'][0] ?? '';
    $categoryConceptId = self::ALLERGY_CATEGORY_MAP[$category] ?? 439224;

    return [
        'cdm_table' => 'observation',
        'data' => [
            'person_id' => $personId,
            'observation_concept_id' => $categoryConceptId,
            'observation_date' => $this->parseDate($recorded),
            'observation_datetime' => $this->parseDatetime($recorded),
            'observation_type_concept_id' => 32817,
            'value_as_concept_id' => $resolved['concept_id'],
            'observation_source_value' => $resolved['source_value'],
            'observation_source_concept_id' => $resolved['source_concept_id'],
        ],
    ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="allergy" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Fhir/FhirBulkMapper.php backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php
git commit -m "feat(fhir): allergy Value-as-Concept pattern per IG

Decompose AllergyIntolerance into observation_concept_id (allergy
category: drug/food/environment) + value_as_concept_id (specific
substance). Reaction decomposition deferred to Phase B multi-row."
```

---

### Task 9: Run Full Test Suite — Phase A Regression Check

**Files:** None (verification only)

- [ ] **Step 1: Run all FHIR mapper tests**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/ -v`
Expected: All tests pass

- [ ] **Step 2: Run existing FHIR ingestion tests**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ingestion/FhirParserTest.php -v`
Expected: All existing tests still pass (no regression)

- [ ] **Step 3: Run PHPStan**

Run: `cd backend && vendor/bin/phpstan analyse app/Services/Fhir/ --level=8`
Expected: No new errors (may have baseline errors)

- [ ] **Step 4: Run Pint**

Run: `cd backend && vendor/bin/pint app/Services/Fhir/ --test`
Expected: No formatting issues (or fix them)

- [ ] **Step 5: Commit any formatting fixes**

```bash
cd backend && vendor/bin/pint app/Services/Fhir/
git add backend/app/Services/Fhir/ backend/tests/Unit/Services/Fhir/
git commit -m "style: pint formatting for FHIR services"
```

---

## Chunk 2: Phase B — Structural Expansion (New CDM Tables)

### Task 10: Migration — New Crosswalk Tables

**Files:**
- Create: `backend/database/migrations/2026_03_12_010001_add_fhir_ig_crosswalk_tables.php`

- [ ] **Step 1: Create migration file**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fhir_location_crosswalk', function (Blueprint $table) {
            $table->bigIncrements('location_id');
            $table->string('site_key', 100);
            $table->string('fhir_location_id', 255);
            $table->timestamps();

            $table->unique(['site_key', 'fhir_location_id']);
        });

        Schema::create('fhir_caresite_crosswalk', function (Blueprint $table) {
            $table->bigIncrements('care_site_id');
            $table->string('site_key', 100);
            $table->string('fhir_organization_id', 255);
            $table->timestamps();

            $table->unique(['site_key', 'fhir_organization_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fhir_caresite_crosswalk');
        Schema::dropIfExists('fhir_location_crosswalk');
    }
};
```

- [ ] **Step 2: Run migration**

Run: `cd backend && php artisan migrate`
Expected: Tables created successfully

- [ ] **Step 3: Commit**

```bash
git add backend/database/migrations/2026_03_12_010001_add_fhir_ig_crosswalk_tables.php
git commit -m "feat(fhir): add location and care_site crosswalk tables

New tables for IG-compliant Location and CareSite CDM generation
from FHIR Encounter.location and Encounter.serviceProvider."
```

---

### Task 11: CrosswalkService — Location & CareSite Methods

**Files:**
- Modify: `backend/app/Services/Fhir/CrosswalkService.php`
- Test: `backend/tests/Unit/Services/Fhir/CrosswalkServiceTest.php` (create)

- [ ] **Step 1: Write failing test**

```php
// backend/tests/Unit/Services/Fhir/CrosswalkServiceTest.php
<?php

declare(strict_types=1);

namespace Tests\Unit\Services\Fhir;

use App\Services\Fhir\CrosswalkService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CrosswalkServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_resolve_location_id_creates_new_entry(): void
    {
        $service = new CrosswalkService();
        $id1 = $service->resolveLocationId('test-site', 'Location/loc-1');
        $id2 = $service->resolveLocationId('test-site', 'Location/loc-1');

        $this->assertIsInt($id1);
        $this->assertGreaterThan(0, $id1);
        $this->assertEquals($id1, $id2); // Same FHIR ID returns same location_id
    }

    public function test_resolve_care_site_id_creates_new_entry(): void
    {
        $service = new CrosswalkService();
        $id1 = $service->resolveCareSiteId('test-site', 'Organization/org-1');
        $id2 = $service->resolveCareSiteId('test-site', 'Organization/org-1');

        $this->assertIsInt($id1);
        $this->assertGreaterThan(0, $id1);
        $this->assertEquals($id1, $id2);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/CrosswalkServiceTest.php -v`
Expected: FAIL — `resolveLocationId` method does not exist

- [ ] **Step 3: Add resolveLocationId() and resolveCareSiteId() to CrosswalkService**

Add caches:

```php
/** @var array<string, int> */
private array $locationCache = [];

/** @var array<string, int> */
private array $careSiteCache = [];
```

Add methods (follow existing resolvePersonId pattern):

```php
public function resolveLocationId(string $siteKey, string $fhirLocationId): int
{
    $cacheKey = "{$siteKey}|{$fhirLocationId}";

    if (isset($this->locationCache[$cacheKey])) {
        return $this->locationCache[$cacheKey];
    }

    $row = DB::table('fhir_location_crosswalk')
        ->where('site_key', $siteKey)
        ->where('fhir_location_id', $fhirLocationId)
        ->first();

    if ($row) {
        $this->locationCache[$cacheKey] = (int) $row->location_id;
        return (int) $row->location_id;
    }

    $locationId = DB::table('fhir_location_crosswalk')->insertGetId([
        'site_key' => $siteKey,
        'fhir_location_id' => $fhirLocationId,
        'created_at' => now(),
        'updated_at' => now(),
    ], 'location_id');

    $this->locationCache[$cacheKey] = (int) $locationId;
    return (int) $locationId;
}

public function resolveCareSiteId(string $siteKey, string $fhirOrganizationId): int
{
    $cacheKey = "{$siteKey}|{$fhirOrganizationId}";

    if (isset($this->careSiteCache[$cacheKey])) {
        return $this->careSiteCache[$cacheKey];
    }

    $row = DB::table('fhir_caresite_crosswalk')
        ->where('site_key', $siteKey)
        ->where('fhir_organization_id', $fhirOrganizationId)
        ->first();

    if ($row) {
        $this->careSiteCache[$cacheKey] = (int) $row->care_site_id;
        return (int) $row->care_site_id;
    }

    $careSiteId = DB::table('fhir_caresite_crosswalk')->insertGetId([
        'site_key' => $siteKey,
        'fhir_organization_id' => $fhirOrganizationId,
        'created_at' => now(),
        'updated_at' => now(),
    ], 'care_site_id');

    $this->careSiteCache[$cacheKey] = (int) $careSiteId;
    return (int) $careSiteId;
}
```

Update `clearCache()` to also clear location and careSite caches.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/CrosswalkServiceTest.php -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Fhir/CrosswalkService.php backend/tests/Unit/Services/Fhir/CrosswalkServiceTest.php
git commit -m "feat(fhir): add location and care_site crosswalk resolution

New resolveLocationId() and resolveCareSiteId() methods with in-memory
caching, following the existing resolvePersonId/resolveVisitId pattern."
```

---

### Task 12: Multi-Row processFile() + Provider/Location/CareSite Row Generation

The `mapResource()` return type change was already done in Task 1. This task updates `processFile()` to iterate over multi-row results and adds Provider/Location/CareSite row generation from Encounter mapper (spec B3, B4).

**Files:**
- Modify: `backend/app/Services/Fhir/FhirNdjsonProcessorService.php:135-218` (processFile)
- Modify: `backend/app/Services/Fhir/FhirBulkMapper.php` (add provider/location/caresite rows to mapEncounter)
- Test: `backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php` (append)

- [ ] **Step 1: Write failing tests for provider and care_site row generation from Encounter**

Append to `FhirBulkMapperTest.php`:

```php
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="generates_provider" -v`
Expected: FAIL — no provider or care_site rows returned

- [ ] **Step 3: Update mapEncounter() to return multi-row with provider/location/caresite**

Change `mapEncounter()` to return array of rows:

```php
private function mapEncounter(array $r, string $siteKey): array
{
    // ... existing class code detection, person/visit resolution ...

    $rows = [];

    // Provider row (spec B3)
    $providerRef = $this->extractRef($r['participant'][0]['individual'] ?? []);
    $providerId = null;
    if ($providerRef) {
        $providerId = $this->crosswalk->resolveProviderId($siteKey, $providerRef);
        $rows[] = [
            'cdm_table' => 'provider',
            'data' => [
                'provider_id' => $providerId,
                'provider_name' => $r['participant'][0]['individual']['display'] ?? null,
                'provider_source_value' => $providerRef,
                'specialty_concept_id' => 0,
            ],
        ];
    }

    // Location row (spec B4)
    $locationRef = $this->extractRef($r['location'][0]['location'] ?? []);
    $locationId = null;
    if ($locationRef) {
        $locationId = $this->crosswalk->resolveLocationId($siteKey, $locationRef);
        $rows[] = [
            'cdm_table' => 'location',
            'data' => [
                'location_id' => $locationId,
                'location_source_value' => $locationRef,
            ],
        ];
    }

    // CareSite row (spec B4)
    $orgRef = $this->extractRef($r['serviceProvider'] ?? []);
    $careSiteId = null;
    if ($orgRef) {
        $careSiteId = $this->crosswalk->resolveCareSiteId($siteKey, $orgRef);
        $rows[] = [
            'cdm_table' => 'care_site',
            'data' => [
                'care_site_id' => $careSiteId,
                'care_site_name' => $r['serviceProvider']['display'] ?? null,
                'care_site_source_value' => $orgRef,
                'location_id' => $locationId,
                'place_of_service_concept_id' => self::ENCOUNTER_CLASS_MAP[$classCode] ?? 0,
            ],
        ];
    }

    // Visit occurrence row (main)
    $rows[] = [
        'cdm_table' => 'visit_occurrence',
        'data' => [
            // ... existing visit fields ...
            'provider_id' => $providerId,
            'care_site_id' => $careSiteId,
            // ... rest of existing fields ...
        ],
    ];

    return $rows;
}
```

- [ ] **Step 4: Update processFile() to iterate over multi-row results**

Replace lines 168-214 in `processFile()` — change from single-row to multi-row processing:

```php
// Map FHIR resource to OMOP CDM rows (may be multiple)
$rows = $this->mapper->mapResource($resource, $siteKey);
if (empty($rows)) {
    continue;
}

foreach ($rows as $mapped) {
    $cdmTable = $mapped['cdm_table'];
    $data = $mapped['data'];
    $fhirType = $mapped['fhir_resource_type'] ?? '';
    $fhirId = $mapped['fhir_resource_id'] ?? '';

    // Track concept mapping (skip check for non-clinical tables)
    $nonClinicalTables = ['death', 'provider', 'care_site', 'location'];
    if (! in_array($cdmTable, $nonClinicalTables, true) && $this->hasMappedConcept($data)) {
        $stats['mapped']++;
    }

    // Incremental dedup check — composite key includes cdm_table
    if ($this->incrementalMode && $fhirId !== '') {
        $dedupResourceId = "{$fhirId}|{$cdmTable}";
        $dedupStatus = $this->dedup->checkStatus($siteKey, $fhirType, $dedupResourceId, $data);

        if ($dedupStatus === 'unchanged') {
            $stats['skipped']++;
            continue;
        }

        if ($dedupStatus === 'changed') {
            $this->dedup->deleteOldRow($siteKey, $fhirType, $dedupResourceId);
            $stats['updated']++;
        }
    }

    // Add to buffer
    $buffers[$cdmTable] = $buffers[$cdmTable] ?? [];
    $buffers[$cdmTable][] = [
        'data' => $data,
        'fhir_type' => $fhirType,
        'fhir_id' => $fhirId !== '' ? "{$fhirId}|{$cdmTable}" : '',
    ];

    // Flush if buffer is full
    if (count($buffers[$cdmTable]) >= self::BATCH_SIZE) {
        $written = $this->flushBuffer($cdmTable, $buffers[$cdmTable]);
        $stats['written'] += $written;
        $stats['failed'] += count($buffers[$cdmTable]) - $written;
        $stats['by_table'][$cdmTable] = ($stats['by_table'][$cdmTable] ?? 0) + $written;
        $buffers[$cdmTable] = [];
    }
}
```

- [ ] **Step 5: Run all tests**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/ -v`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/Services/Fhir/FhirBulkMapper.php backend/app/Services/Fhir/FhirNdjsonProcessorService.php backend/tests/Unit/Services/Fhir/
git commit -m "feat(fhir): multi-row processFile, provider/location/caresite from Encounter

processFile() updated with per-row iteration, composite dedup keys,
and non-clinical table concept check bypass. Encounter mapper now
emits provider, location, and care_site CDM rows (spec B3/B4)."
```

---

### Task 13: Death Table Generation from Patient

**Files:**
- Modify: `backend/app/Services/Fhir/FhirBulkMapper.php:90-113` (mapPatient)
- Test: `backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php` (append)

- [ ] **Step 1: Write failing test**

```php
public function test_deceased_patient_generates_death_row(): void
{
    $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);

    $resource = [
        'resourceType' => 'Patient',
        'id' => 'patient-deceased',
        'gender' => 'female',
        'birthDate' => '1950-03-15',
        'deceasedDateTime' => '2025-06-01T14:30:00Z',
    ];

    $rows = $this->mapper->mapResource($resource, 'test-site');

    $personRow = collect($rows)->firstWhere('cdm_table', 'person');
    $deathRow = collect($rows)->firstWhere('cdm_table', 'death');

    $this->assertNotNull($personRow);
    $this->assertNotNull($deathRow);
    $this->assertEquals(1, $deathRow['data']['person_id']);
    $this->assertEquals('2025-06-01', $deathRow['data']['death_date']);
    $this->assertEquals(32817, $deathRow['data']['death_type_concept_id']);
}

public function test_deceased_boolean_patient_generates_death_row_without_date(): void
{
    $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);

    $resource = [
        'resourceType' => 'Patient',
        'id' => 'patient-deceased-bool',
        'gender' => 'male',
        'birthDate' => '1960-01-01',
        'deceasedBoolean' => true,
    ];

    $rows = $this->mapper->mapResource($resource, 'test-site');
    $deathRow = collect($rows)->firstWhere('cdm_table', 'death');

    $this->assertNotNull($deathRow);
    $this->assertNull($deathRow['data']['death_date']);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="deceased" -v`
Expected: FAIL

- [ ] **Step 3: Update mapPatient() to return multiple rows**

Change `mapPatient()` to return array of rows:

```php
private function mapPatient(array $r, string $siteKey): array
{
    $fhirId = $r['id'] ?? '';
    $personId = $this->crosswalk->resolvePersonId($siteKey, $fhirId);
    $birthDate = isset($r['birthDate']) ? Carbon::parse($r['birthDate']) : null;

    $rows = [
        [
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
        ],
    ];

    // Death row if deceased
    $deceasedDt = $r['deceasedDateTime'] ?? null;
    $deceasedBool = $r['deceasedBoolean'] ?? false;

    if ($deceasedDt || $deceasedBool) {
        $rows[] = [
            'cdm_table' => 'death',
            'data' => [
                'person_id' => $personId,
                'death_date' => $this->parseDate($deceasedDt),
                'death_datetime' => $this->parseDatetime($deceasedDt),
                'death_type_concept_id' => 32817,
                'cause_concept_id' => 0,
                'cause_source_value' => null,
            ],
        ];
    }

    return $rows;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php -v`
Expected: All pass (including existing patient tests adapted for multi-row)

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Fhir/FhirBulkMapper.php backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php
git commit -m "feat(fhir): generate death table rows from deceased patients

Extract deceasedDateTime/deceasedBoolean from Patient resources.
Emit death CDM row alongside person row using multi-row return."
```

---

### Task 14: ObservationPeriod Post-Processing

**Files:**
- Modify: `backend/app/Services/Fhir/FhirNdjsonProcessorService.php`
- Test: `backend/tests/Unit/Services/Fhir/ObservationPeriodTest.php` (create)

- [ ] **Step 1: Write failing test**

```php
// backend/tests/Unit/Services/Fhir/ObservationPeriodTest.php
<?php

declare(strict_types=1);

namespace Tests\Unit\Services\Fhir;

use App\Services\Fhir\FhirNdjsonProcessorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ObservationPeriodTest extends TestCase
{
    use RefreshDatabase;

    public function test_generates_observation_period_from_event_dates(): void
    {
        // Seed CDM tables with test data
        DB::connection('cdm')->table('condition_occurrence')->insert([
            'person_id' => 1,
            'condition_concept_id' => 123,
            'condition_start_date' => '2024-01-15',
            'condition_type_concept_id' => 32817,
        ]);
        DB::connection('cdm')->table('drug_exposure')->insert([
            'person_id' => 1,
            'drug_concept_id' => 456,
            'drug_exposure_start_date' => '2024-06-01',
            'drug_exposure_end_date' => '2024-12-31',
            'drug_type_concept_id' => 32817,
        ]);

        // Seed dedup tracking to scope by site_key
        DB::table('fhir_dedup_tracking')->insert([
            'site_key' => 'test-site',
            'fhir_resource_type' => 'Patient',
            'fhir_resource_id' => 'patient-1|person',
            'cdm_table' => 'person',
            'cdm_row_id' => 1,
            'content_hash' => 'abc',
            'last_synced_at' => now(),
        ]);

        $service = app(FhirNdjsonProcessorService::class);
        $method = new \ReflectionMethod($service, 'generateObservationPeriods');
        $method->setAccessible(true);
        $method->invoke($service, 'test-site');

        $op = DB::connection('cdm')->table('observation_period')
            ->where('person_id', 1)
            ->first();

        $this->assertNotNull($op);
        $this->assertEquals('2024-01-15', $op->observation_period_start_date);
        $this->assertEquals('2024-12-31', $op->observation_period_end_date);
        $this->assertEquals(32817, $op->period_type_concept_id);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/ObservationPeriodTest.php -v`
Expected: FAIL — method does not exist

- [ ] **Step 3: Add generateObservationPeriods() to FhirNdjsonProcessorService**

Add method after `flushAllBuffers()`:

```php
/**
 * Generate observation_period rows from the min/max event dates per person.
 * Called after all resource processing completes.
 */
private function generateObservationPeriods(string $siteKey): void
{
    // Find all person_ids with events, scoped to this site via dedup tracking
    $personIds = DB::table('fhir_dedup_tracking')
        ->where('site_key', $siteKey)
        ->where('cdm_table', 'person')
        ->pluck('cdm_row_id');

    if ($personIds->isEmpty()) {
        return;
    }

    $tables = [
        'condition_occurrence' => 'condition_start_date',
        'drug_exposure' => 'drug_exposure_start_date',
        'measurement' => 'measurement_date',
        'observation' => 'observation_date',
        'procedure_occurrence' => 'procedure_date',
        'visit_occurrence' => 'visit_start_date',
    ];

    // Also check end dates
    $endDateTables = [
        'drug_exposure' => 'drug_exposure_end_date',
        'visit_occurrence' => 'visit_end_date',
    ];

    // Build UNION ALL query across all tables grouped by person_id (avoids N+1)
    $unions = [];
    foreach ($tables as $table => $dateCol) {
        $endCol = $endDateTables[$table] ?? $dateCol;
        $unions[] = "SELECT person_id, MIN({$dateCol}) as min_date, MAX({$endCol}) as max_date FROM {$table} WHERE person_id IN (" . $personIds->implode(',') . ") GROUP BY person_id";
    }

    $unionSql = implode(' UNION ALL ', $unions);
    $aggregated = DB::connection('cdm')
        ->select("SELECT person_id, MIN(min_date) as earliest, MAX(max_date) as latest FROM ({$unionSql}) sub GROUP BY person_id");

    foreach ($aggregated as $row) {
        if ($row->earliest && $row->latest) {
            DB::connection('cdm')->table('observation_period')->updateOrInsert(
                ['person_id' => $row->person_id, 'period_type_concept_id' => 32817],
                [
                    'observation_period_start_date' => $row->earliest,
                    'observation_period_end_date' => $row->latest,
                ],
            );
        }
    }

    Log::info('FHIR observation periods generated', [
        'site_key' => $siteKey,
        'person_count' => $personIds->count(),
    ]);
}
```

Call it at the end of `processFiles()`, before the final `$run->update()`:

```php
// Generate observation periods from all mapped events
$this->generateObservationPeriods($siteKey);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/ObservationPeriodTest.php -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Fhir/FhirNdjsonProcessorService.php backend/tests/Unit/Services/Fhir/ObservationPeriodTest.php
git commit -m "feat(fhir): generate observation_period from mapped event dates

Post-processing step queries min/max dates across CDM tables per
person, creates observation_period rows. Scoped by site_key via
dedup tracking. Supports incremental expansion via updateOrInsert."
```

---

### Task 14b: VisitDetail Mapping for Sub-Encounters (Spec B6)

**Files:**
- Modify: `backend/app/Services/Fhir/FhirBulkMapper.php` (mapEncounter, add mapVisitDetail)
- Test: `backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php` (append)

- [ ] **Step 1: Write failing test**

Append to `FhirBulkMapperTest.php`:

```php
public function test_encounter_with_partof_maps_to_visit_detail(): void
{
    $this->crosswalk->shouldReceive('resolvePersonId')->andReturn(1);
    $this->crosswalk->shouldReceive('resolveVisitId')
        ->with('test-site', 'enc-parent', Mockery::any())
        ->andReturn(100);
    $this->crosswalk->shouldReceive('resolveVisitId')
        ->with('test-site', 'enc-child', Mockery::any())
        ->andReturn(101);

    $resource = [
        'resourceType' => 'Encounter',
        'id' => 'enc-child',
        'class' => ['code' => 'AMB'],
        'subject' => ['reference' => 'Patient/patient-1'],
        'period' => ['start' => '2025-01-01T10:00:00Z', 'end' => '2025-01-01T11:00:00Z'],
        'partOf' => ['reference' => 'Encounter/enc-parent'],
    ];

    $rows = $this->mapper->mapResource($resource, 'test-site');
    $visitDetailRow = collect($rows)->firstWhere('cdm_table', 'visit_detail');

    $this->assertNotNull($visitDetailRow, 'Encounter with partOf should map to visit_detail');
    $this->assertEquals(100, $visitDetailRow['data']['visit_occurrence_id']);
    $this->assertEquals(9202, $visitDetailRow['data']['visit_detail_concept_id']);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="partof" -v`
Expected: FAIL — visit_detail row not returned

- [ ] **Step 3: Add partOf detection and mapVisitDetail()**

In `mapEncounter()`, add at the top before building rows:

```php
// Sub-encounter detection: partOf → visit_detail instead of visit_occurrence (spec B6)
if (isset($r['partOf']['reference'])) {
    return $this->mapVisitDetail($r, $siteKey);
}
```

Add new private method:

```php
private function mapVisitDetail(array $r, string $siteKey): array
{
    $classCode = isset($r['class']['code'])
        ? $r['class']['code']
        : ($r['class'][0]['coding'][0]['code'] ?? '');

    $personId = $this->resolveSubjectPersonId($r, $siteKey);
    $fhirId = $r['id'] ?? '';
    $parentRef = $this->extractRef($r['partOf']);
    $parentVisitId = $parentRef ? $this->crosswalk->resolveVisitId($siteKey, $parentRef, $personId) : null;
    $visitDetailId = $this->crosswalk->resolveVisitId($siteKey, $fhirId, $personId);

    return [
        'cdm_table' => 'visit_detail',
        'data' => [
            'visit_detail_id' => $visitDetailId,
            'person_id' => $personId,
            'visit_detail_concept_id' => self::ENCOUNTER_CLASS_MAP[$classCode] ?? 0,
            'visit_detail_start_date' => $this->parseDate($r['period']['start'] ?? null),
            'visit_detail_start_datetime' => $this->parseDatetime($r['period']['start'] ?? null),
            'visit_detail_end_date' => $this->parseDate($r['period']['end'] ?? null),
            'visit_detail_end_datetime' => $this->parseDatetime($r['period']['end'] ?? null),
            'visit_detail_type_concept_id' => 32817,
            'visit_occurrence_id' => $parentVisitId,
            'visit_detail_source_value' => $classCode,
        ],
    ];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/FhirBulkMapperTest.php --filter="partof" -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Fhir/FhirBulkMapper.php backend/tests/Unit/Services/Fhir/FhirBulkMapperTest.php
git commit -m "feat(fhir): visit_detail mapping for sub-encounters (spec B6)

Detect Encounter.partOf reference and route to visit_detail table
instead of visit_occurrence. Links via visit_occurrence_id to parent."
```

---

### Task 15: Phase B Regression Check

**Files:** None (verification only)

- [ ] **Step 1: Run all FHIR tests**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/ -v`
Expected: All pass

- [ ] **Step 2: Run PHPStan + Pint**

Run: `cd backend && vendor/bin/phpstan analyse app/Services/Fhir/ --level=8 && vendor/bin/pint app/Services/Fhir/ --test`
Expected: Clean

- [ ] **Step 3: Commit any fixes**

---

## Chunk 3: Phase C — OMOP-to-FHIR Reverse Direction (Part 1: Core Services)

### Task 16: ReverseVocabularyService

**Files:**
- Create: `backend/app/Services/Fhir/Export/ReverseVocabularyService.php`
- Test: `backend/tests/Unit/Services/Fhir/Export/ReverseVocabularyServiceTest.php`

- [ ] **Step 1: Write failing test**

```php
// backend/tests/Unit/Services/Fhir/Export/ReverseVocabularyServiceTest.php
<?php

declare(strict_types=1);

namespace Tests\Unit\Services\Fhir\Export;

use App\Services\Fhir\Export\ReverseVocabularyService;
use Tests\TestCase;

class ReverseVocabularyServiceTest extends TestCase
{
    public function test_resolves_concept_id_to_fhir_coding(): void
    {
        // concept_id 0 is a boundary case that does not hit the DB
        $service = new ReverseVocabularyService();

        // concept_id 0 always returns empty coding
        $coding = $service->resolve(0);

        $this->assertEmpty($coding['coding']);
        $this->assertEquals(0, $coding['concept_id']);
    }

    public function test_zero_concept_returns_data_absent_reason(): void
    {
        $service = new ReverseVocabularyService();
        $result = $service->buildCodeableConcept(0, 0, 'ICD10CM|J06.9');

        $this->assertArrayHasKey('text', $result);
        $this->assertEquals('ICD10CM|J06.9', $result['text']);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/Export/ReverseVocabularyServiceTest.php -v`
Expected: FAIL — class does not exist

- [ ] **Step 3: Create ReverseVocabularyService**

```php
// backend/app/Services/Fhir/Export/ReverseVocabularyService.php
<?php

declare(strict_types=1);

namespace App\Services\Fhir\Export;

use Illuminate\Support\Facades\DB;

class ReverseVocabularyService
{
    private const VOCAB_TO_SYSTEM = [
        'SNOMED'  => 'http://snomed.info/sct',
        'LOINC'   => 'http://loinc.org',
        'RxNorm'  => 'http://www.nlm.nih.gov/research/umls/rxnorm',
        'ICD10CM' => 'http://hl7.org/fhir/sid/icd-10-cm',
        'ICD10'   => 'http://hl7.org/fhir/sid/icd-10',
        'ICD9CM'  => 'http://hl7.org/fhir/sid/icd-9-cm',
        'CPT4'    => 'http://www.ama-assn.org/go/cpt',
        'NDC'     => 'http://hl7.org/fhir/sid/ndc',
        'CVX'     => 'http://hl7.org/fhir/sid/cvx',
        'HCPCS'   => 'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets',
        'Race'    => 'urn:oid:2.16.840.1.113883.6.238',
        'UCUM'    => 'http://unitsofmeasure.org',
    ];

    private const MAX_CACHE = 50000;

    /** @var array<int, array{system: string, code: string, display: string}|null> */
    private array $cache = [];

    private string $vocabSchema;

    public function __construct()
    {
        $this->vocabSchema = config('database.connections.vocab.search_path', 'omop') ?: 'omop';
        $this->vocabSchema = explode(',', $this->vocabSchema)[0];
    }

    /**
     * Resolve an OMOP concept_id to a FHIR coding.
     *
     * @return array{concept_id: int, coding: list<array{system: string, code: string, display: string}>}
     */
    public function resolve(int $conceptId): array
    {
        if ($conceptId === 0) {
            return ['concept_id' => 0, 'coding' => []];
        }

        $coding = $this->lookupConcept($conceptId);

        return [
            'concept_id' => $conceptId,
            'coding' => $coding ? [$coding] : [],
        ];
    }

    /**
     * Build a FHIR CodeableConcept from standard + source concept IDs.
     *
     * @return array{coding?: list<array{system: string, code: string, display: string}>, text?: string, extension?: list<array>}
     */
    public function buildCodeableConcept(int $conceptId, int $sourceConceptId = 0, ?string $sourceValue = null): array
    {
        $result = [];
        $codings = [];

        // Standard concept
        if ($conceptId > 0) {
            $coding = $this->lookupConcept($conceptId);
            if ($coding) {
                $codings[] = $coding;
            }
        }

        // Source concept (if different from standard)
        if ($sourceConceptId > 0 && $sourceConceptId !== $conceptId) {
            $sourceCoding = $this->lookupConcept($sourceConceptId);
            if ($sourceCoding) {
                $codings[] = $sourceCoding;
            }
        }

        if (! empty($codings)) {
            $result['coding'] = $codings;
        }

        // Preserve source_value as text
        if ($sourceValue) {
            $result['text'] = $sourceValue;
        }

        // Data absent reason for unmapped concepts
        if ($conceptId === 0 && empty($codings)) {
            $result['extension'] = [[
                'url' => 'http://hl7.org/fhir/StructureDefinition/data-absent-reason',
                'valueCode' => 'unknown',
            ]];
        }

        return $result;
    }

    /**
     * Check if a concept belongs to a specific vocabulary.
     */
    public function isVocabulary(int $conceptId, string $vocabularyId): bool
    {
        $coding = $this->lookupConcept($conceptId);

        if (! $coding) {
            return false;
        }

        $system = self::VOCAB_TO_SYSTEM[$vocabularyId] ?? '';

        return $coding['system'] === $system;
    }

    /**
     * Resolve a concept_id to its vocabulary_id.
     */
    public function getVocabularyId(int $conceptId): ?string
    {
        if ($conceptId === 0) {
            return null;
        }

        if (array_key_exists($conceptId, $this->cache)) {
            return $this->cache[$conceptId] ? ($this->reverseSystemLookup($this->cache[$conceptId]['system']) ?? null) : null;
        }

        $row = DB::connection('vocab')
            ->table("{$this->vocabSchema}.concept")
            ->where('concept_id', $conceptId)
            ->select('vocabulary_id')
            ->first();

        return $row ? $row->vocabulary_id : null;
    }

    private function lookupConcept(int $conceptId): ?array
    {
        if (array_key_exists($conceptId, $this->cache)) {
            return $this->cache[$conceptId];
        }

        $row = DB::connection('vocab')
            ->table("{$this->vocabSchema}.concept")
            ->where('concept_id', $conceptId)
            ->select('concept_code', 'vocabulary_id', 'concept_name')
            ->first();

        if (! $row) {
            if (count($this->cache) < self::MAX_CACHE) {
                $this->cache[$conceptId] = null;
            }
            return null;
        }

        $system = self::VOCAB_TO_SYSTEM[$row->vocabulary_id] ?? null;

        $result = $system ? [
            'system' => $system,
            'code' => $row->concept_code,
            'display' => $row->concept_name,
        ] : null;

        if (count($this->cache) < self::MAX_CACHE) {
            $this->cache[$conceptId] = $result;
        }

        return $result;
    }

    private function reverseSystemLookup(string $system): ?string
    {
        $key = array_search($system, self::VOCAB_TO_SYSTEM, true);

        return $key !== false ? $key : null;
    }

    public function clearCache(): void
    {
        $this->cache = [];
    }
}
```

- [ ] **Step 4: Run tests**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Fhir/Export/ReverseVocabularyServiceTest.php -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Fhir/Export/ReverseVocabularyService.php backend/tests/Unit/Services/Fhir/Export/ReverseVocabularyServiceTest.php
git commit -m "feat(fhir): add ReverseVocabularyService for OMOP-to-FHIR coding

Inverse of VocabularyLookupService. Maps concept_id to FHIR coding
{system, code, display}. Builds CodeableConcept with data-absent-reason
for unmapped concepts. 50K LRU cache."
```

---

### Task 17: PatientBuilder + ConditionBuilder + FhirBundleAssembler

**Files:**
- Create: `backend/app/Services/Fhir/Export/Builders/PatientBuilder.php`
- Create: `backend/app/Services/Fhir/Export/Builders/ConditionBuilder.php`
- Create: `backend/app/Services/Fhir/Export/FhirBundleAssembler.php`
- Create: `backend/app/Services/Fhir/Export/FhirResourceBuilderFactory.php`
- Test: `backend/tests/Unit/Services/Fhir/Export/BuilderTest.php`

This task creates the first 2 builders, the factory, and the bundle assembler to establish the pattern. Remaining builders follow in Tasks 18-19.

- [ ] **Step 1: Write failing tests for PatientBuilder and ConditionBuilder**

Full test file with builder tests — verifying FHIR resource shape, gender reversal, birth date, death join for PatientBuilder; code, onset, abatement, status for ConditionBuilder. Use mocked ReverseVocabularyService.

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Create PatientBuilder, ConditionBuilder, FhirBundleAssembler, FhirResourceBuilderFactory**

Each builder: `build(array $cdmRow): array` returning FHIR R4 resource.
PatientBuilder also accepts optional death row for deceasedDateTime.
Factory maps CDM table names to builder instances.
BundleAssembler wraps resources in FHIR Bundle (searchset type).

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(fhir): add PatientBuilder, ConditionBuilder, BundleAssembler, Factory

Core Phase C infrastructure: per-resource builders for OMOP-to-FHIR
conversion with reverse vocabulary resolution. Bundle assembler
for FHIR searchset responses."
```

---

### Task 18: Remaining Builders (Encounter, Observation, Measurement, Medication, Procedure)

**Files:**
- Create: `backend/app/Services/Fhir/Export/Builders/EncounterBuilder.php`
- Create: `backend/app/Services/Fhir/Export/Builders/ObservationBuilder.php`
- Create: `backend/app/Services/Fhir/Export/Builders/MeasurementBuilder.php`
- Create: `backend/app/Services/Fhir/Export/Builders/MedicationBuilder.php`
- Create: `backend/app/Services/Fhir/Export/Builders/ProcedureBuilder.php`
- Test: `backend/tests/Unit/Services/Fhir/Export/BuilderTest.php` (append)

- [ ] **Step 1: Write failing tests for each builder**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Implement all 5 builders following the spec mappings**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

---

### Task 19: Immunization + Allergy Builders

**Files:**
- Create: `backend/app/Services/Fhir/Export/Builders/ImmunizationBuilder.php`
- Create: `backend/app/Services/Fhir/Export/Builders/AllergyBuilder.php`
- Test: `backend/tests/Unit/Services/Fhir/Export/BuilderTest.php` (append)

- [ ] **Step 1: Write failing tests**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Implement ImmunizationBuilder (CVX detection) and AllergyBuilder (allergy concept detection)**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit**

---

### Task 20: OmopToFhirService Orchestrator

**Files:**
- Create: `backend/app/Services/Fhir/Export/OmopToFhirService.php`
- Test: `backend/tests/Unit/Services/Fhir/Export/OmopToFhirServiceTest.php`

- [ ] **Step 1: Write failing tests for search and read operations**
- [ ] **Step 2: Run tests to verify they fail**
- [ ] **Step 3: Implement OmopToFhirService with CDM queries + builder delegation**
- [ ] **Step 4: Run tests**
- [ ] **Step 5: Commit**

---

## Chunk 4: Phase C — FHIR R4 API + Bulk Export + Frontend

### Task 21: FHIR R4 Routes + Controller

**Files:**
- Create: `backend/routes/fhir.php`
- Create: `backend/app/Http/Controllers/Api/V1/FhirR4Controller.php`
- Create: `backend/app/Http/Requests/FhirSearchRequest.php`
- Modify: `backend/bootstrap/app.php` (register fhir.php routes)

- [ ] **Step 1: Create route file `backend/routes/fhir.php`**

```php
<?php

use App\Http\Controllers\Api\V1\FhirR4Controller;
use Illuminate\Support\Facades\Route;

// Public endpoint — no auth required
Route::get('fhir/metadata', [FhirR4Controller::class, 'metadata']);

// FHIR R4 read/search — requires auth
Route::middleware(['auth:sanctum', 'throttle:fhir'])->prefix('fhir')->group(function () {
    $resourceTypes = ['Patient', 'Condition', 'Encounter', 'Observation',
        'MedicationStatement', 'Procedure', 'Immunization', 'AllergyIntolerance'];

    foreach ($resourceTypes as $type) {
        Route::get($type, [FhirR4Controller::class, 'search']);
        Route::get("{$type}/{id}", [FhirR4Controller::class, 'read']);
    }
});
```

- [ ] **Step 2: Register fhir.php in `backend/bootstrap/app.php`**

Add `then:` callback to `withRouting()`:

```php
->withRouting(
    api: __DIR__.'/../routes/api.php',
    commands: __DIR__.'/../routes/console.php',
    health: '/up',
    then: function () {
        Route::prefix('api/v1')
            ->middleware(['api'])
            ->group(base_path('routes/fhir.php'));
    },
)
```

- [ ] **Step 3: Create FhirSearchRequest with FHIR search parameter validation**

Include `source_id` (required for multi-source), `_id`, `_count`, `_offset`, and resource-specific params (`patient`, `code`, `date`, `category`, `clinical-status`, `onset-date`, `class`, `gender`, `birthdate`, `vaccine-code`).

- [ ] **Step 4: Create FhirR4Controller with metadata, search, and read actions**

Controller methods: `metadata()` (public), `search(FhirSearchRequest $request)`, `read(string $type, int $id)`. Search delegates to `OmopToFhirService`, wraps result in `FhirBundleAssembler::searchset()`.

- [ ] **Step 5: Write feature tests for API endpoints**

Test: `GET /api/v1/fhir/metadata` returns 200 with CapabilityStatement. `GET /api/v1/fhir/Patient` requires auth. `GET /api/v1/fhir/Patient/1` returns FHIR Patient resource.

- [ ] **Step 6: Commit**

---

### Task 22: CapabilityStatement Endpoint

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/FhirR4Controller.php` (metadata method)
- Test: Feature test for `/api/v1/fhir/metadata`

- [ ] **Step 1: Write test verifying CapabilityStatement structure**
- [ ] **Step 2: Implement metadata() returning full CapabilityStatement JSON**
- [ ] **Step 3: Run test**
- [ ] **Step 4: Commit**

---

### Task 23: Bulk Export Job (OMOP→FHIR)

**Files:**
- Create: `backend/app/Jobs/Fhir/RunFhirExportJob.php`
- Create: `backend/app/Models/App/FhirExportJob.php`
- Create: `backend/database/migrations/2026_03_12_020001_create_fhir_export_jobs_table.php`
- Modify: `backend/routes/fhir.php` (export endpoints)
- Modify: `backend/app/Http/Controllers/Api/V1/FhirR4Controller.php` (export actions)

- [ ] **Step 1: Create migration for fhir_export_jobs table**

```php
Schema::create('fhir_export_jobs', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->unsignedBigInteger('source_id');
    $table->string('status', 20)->default('pending'); // pending, processing, completed, failed
    $table->jsonb('resource_types'); // ["Patient", "Condition", ...]
    $table->timestamp('since')->nullable();
    $table->jsonb('patient_ids')->nullable();
    $table->jsonb('files')->nullable(); // [{resource_type, url, count}, ...]
    $table->timestamp('started_at')->nullable();
    $table->timestamp('finished_at')->nullable();
    $table->text('error_message')->nullable();
    $table->unsignedBigInteger('user_id');
    $table->timestamps();

    $table->index('status');
    $table->foreign('source_id')->references('id')->on('sources');
    $table->foreign('user_id')->references('id')->on('users');
});
```

- [ ] **Step 2: Create FhirExportJob model**
- [ ] **Step 3: Create RunFhirExportJob queue job**
- [ ] **Step 4: Add export endpoints to controller**
- [ ] **Step 5: Write tests**
- [ ] **Step 6: Commit**

---

### Task 24: Frontend — FHIR Export Dashboard

**Files:**
- Create: `frontend/src/features/administration/pages/FhirExportPage.tsx`
- Create: `frontend/src/features/administration/hooks/useFhirExports.ts`
- Modify: `frontend/src/app/router.tsx` (add route)
- Modify: `frontend/src/features/administration/api/adminApi.ts` (add types + functions)

- [ ] **Step 1: Add TypeScript types for FhirExportJob**
- [ ] **Step 2: Create API functions and TanStack Query hooks**
- [ ] **Step 3: Create FhirExportPage component**
- [ ] **Step 4: Add route to router**
- [ ] **Step 5: Build frontend to verify no TypeScript errors**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(fhir): add FHIR export dashboard page

Source selector, resource type checkboxes, export trigger with
progress polling, export history table with file downloads."
```

---

### Task 25: Full Integration Test — Round-Trip Verification

**Files:**
- Create: `backend/tests/Feature/Fhir/RoundTripTest.php`

- [ ] **Step 1: Write round-trip integration test**

Test: Take a FHIR Patient/Condition/Observation JSON → map to OMOP via FhirBulkMapper → read back via OmopToFhirService → verify key fields preserved (concept codes, dates, demographics).

- [ ] **Step 2: Run test**

Run: `cd backend && vendor/bin/pest tests/Feature/Fhir/RoundTripTest.php -v`
Expected: PASS

- [ ] **Step 3: Commit**

---

### Task 26: Final Regression + Deploy

- [ ] **Step 1: Run full test suite**

Run: `cd backend && vendor/bin/pest -v`
Expected: All tests pass

- [ ] **Step 2: Run linting**

Run: `cd backend && vendor/bin/pint --test && vendor/bin/phpstan analyse --level=8`

- [ ] **Step 3: Build frontend**

Run: `cd frontend && npx tsc --noEmit && npx vite build`
Expected: Clean build

- [ ] **Step 4: Deploy**

Run: `./deploy.sh`

- [ ] **Step 5: Final commit and push**

```bash
git add backend/app/Services/Fhir/ backend/app/Http/Controllers/Api/V1/FhirR4Controller.php \
  backend/app/Http/Requests/FhirSearchRequest.php backend/app/Jobs/Fhir/ \
  backend/app/Models/App/FhirExportJob.php backend/routes/fhir.php \
  backend/database/migrations/ backend/tests/ \
  frontend/src/features/administration/pages/FhirExportPage.tsx \
  frontend/src/features/administration/hooks/useFhirExports.ts \
  frontend/src/app/router.tsx
git commit -m "feat(fhir): complete FHIR-OMOP IG compliance + bidirectional bridge

Phase A: Field-level IG compliance (condition status, encounter
admission/discharge, medication dates, procedure end dates, immunization
detail, allergy Value-as-Concept, observation units).
Phase B: Death table, provider/location/care_site generation,
observation_period post-processing, visit_detail.
Phase C: OMOP-to-FHIR R4 server with 9 resource types, CapabilityStatement,
bulk export, frontend dashboard."
```

Note: Create a dedicated feature branch (`feature/fhir-omop-ig-compliance`) before starting execution. Push to that branch, not the current `feature/chromadb-abby-brain`.
