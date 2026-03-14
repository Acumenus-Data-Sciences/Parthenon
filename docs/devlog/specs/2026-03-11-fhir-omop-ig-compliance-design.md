# FHIR-OMOP IG Compliance & Bidirectional Bridge — Design Spec

**Date:** 2026-03-11
**Status:** Draft
**IG Reference:** HL7 FHIR-OMOP IG v1.0.0 (2026-03-06), FHIR R5/R4, OMOP CDM v5.4
**Approach:** Incremental Enhancement (Approach 1)

## Overview

Bring Parthenon's FHIR integration to full compliance with the HL7 FHIR-OMOP Implementation Guide v1.0.0, then go beyond with a reverse OMOP-to-FHIR direction that the IG does not define. The result is a production-grade bidirectional FHIR/OMOP bridge.

### Current State

Parthenon already covers all 9 IG Structure Maps (Patient→Person, Condition→ConditionOccurrence, Observation→Measurement/Observation, MedicationStatement→DrugExposure, Procedure→ProcedureOccurrence, Encounter→VisitOccurrence, AllergyIntolerance→Observation, Immunization→DrugExposure) plus 3 resource types beyond the IG (DiagnosticReport, MedicationRequest, MedicationAdministration). Full production infrastructure exists: SMART Backend Services auth, FHIR Bulk Data Export, incremental sync with SHA-256 dedup, crosswalk ID management, admin UI, and 12 code system mappings with 50K LRU cache.

### Gaps Identified

- ~15 field-level mapping gaps across existing resource mappers
- 5 missing CDM table generators (Death, Provider, Location/CareSite, ObservationPeriod, VisitDetail)
- No OMOP-to-FHIR reverse direction

### Phases

- **Phase A:** Field-level IG compliance (existing mappers)
- **Phase B:** Structural expansion (new CDM tables)
- **Phase C:** OMOP-to-FHIR reverse direction (differentiation)

---

## Phase A: Field-Level IG Compliance

All changes are to `backend/app/Services/Fhir/FhirBulkMapper.php` and `backend/app/Services/Fhir/VocabularyLookupService.php`.

### A1. Condition Mapper Enhancements

**File:** `FhirBulkMapper::mapCondition()`

Add the following field extractions:

| IG Field | FHIR Source | Mapping Rule |
|---|---|---|
| `condition_status_concept_id` | `clinicalStatus.coding.code` | active/recurrence/relapse → 4230359; inactive/remission/resolved → 4201906 |
| `condition_type_concept_id` | `category.coding.code` | **Replace** existing hardcoded `32817` with category-based logic: encounter-diagnosis → 32817 (EHR); problem-list-item → 32840 (Problem list); fallback → 32817 |
| `condition_status_source_value` | `clinicalStatus.coding.code` | Verbatim string preserved |

New constant: `CONDITION_STATUS_MAP` and `CONDITION_CATEGORY_MAP`. Note: the existing hardcoded `'condition_type_concept_id' => 32817` on line 183 of `FhirBulkMapper.php` must be **replaced** with the category-based lookup, not duplicated.

### A2. Encounter Mapper Enhancements

**File:** `FhirBulkMapper::mapEncounter()`

Add the following field extractions:

| IG Field | FHIR Source | Mapping Rule |
|---|---|---|
| `admitted_from_concept_id` | `hospitalization.admitSource.coding` | Vocab lookup via `VocabularyLookupService` |
| `admitted_from_source_value` | `hospitalization.admitSource.text` or first coding display | Verbatim |
| `discharged_to_concept_id` | `hospitalization.dischargeDisposition.coding` | Vocab lookup |
| `discharged_to_source_value` | `hospitalization.dischargeDisposition.text` or first coding display | Verbatim |
| `provider_id` | `participant[0].individual` | Via `CrosswalkService::resolveProviderId()` |

Handle R4 vs R5 `class` field differences with detection logic:
- **R4**: `class` is a Coding → extract via `$r['class']['code']`
- **R5**: `class` is an array of CodeableConcepts → extract via `$r['class'][0]['coding'][0]['code']`
- **Detection**: if `isset($r['class']['code'])` → R4 format; if `isset($r['class'][0])` → R5 format

### A3. Medication Mapper Enhancements

**File:** `FhirBulkMapper::mapMedication()`

| IG Field | FHIR Source | Mapping Rule |
|---|---|---|
| `drug_exposure_start_date` | Conditional: MedicationStatement uses `effectivePeriod.start` or `effectiveDateTime`; MedicationRequest uses `authoredOn` | Branch on `$r['resourceType']` |
| `drug_exposure_end_date` | Conditional: MedicationStatement uses `effectivePeriod.end`; MedicationRequest derives from `dispenseRequest.expectedSupplyDuration` added to start_date | Fall back to start_date only when unavailable |
| `sig` | `dosageInstruction[0].text` | Verbatim string, truncate to 2000 chars |
| `route_concept_id` | `dosageInstruction[0].route.coding` | Vocab lookup (not just source_value) |
| `dose_value` | `dosageInstruction[0].doseAndRate[0].doseQuantity.value` | Numeric |

**Conditional logic** (the existing `mapMedication()` handles both resource types):
```php
if ($r['resourceType'] === 'MedicationStatement') {
    $startDate = $r['effectiveDateTime'] ?? $r['effectivePeriod']['start'] ?? null;
    $endDate = $r['effectivePeriod']['end'] ?? $startDate;
} else { // MedicationRequest
    $startDate = $r['authoredOn'] ?? null;
    $duration = $r['dispenseRequest']['expectedSupplyDuration']['value'] ?? null;
    $durationUnit = $r['dispenseRequest']['expectedSupplyDuration']['unit'] ?? 'days';
    $endDate = ($startDate && $duration) ? Carbon::parse($startDate)->add($durationUnit, $duration)->toDateString() : $startDate;
}
```

### A4. Procedure Mapper Enhancements

**File:** `FhirBulkMapper::mapProcedure()`

| IG Field | FHIR Source | Mapping Rule |
|---|---|---|
| `procedure_end_date` | `performedPeriod.end` | Date extraction |
| `procedure_end_datetime` | `performedPeriod.end` | Datetime extraction |
| `provider_id` | `performer[0].actor` | Via provider crosswalk |
| Status filter | `status` | Skip if not `completed`; log skipped count |

### A5. Immunization Mapper Enhancements

**File:** `FhirBulkMapper::mapImmunization()`

| IG Field | FHIR Source | Mapping Rule |
|---|---|---|
| `lot_number` | `lotNumber` | Verbatim string |
| `route_concept_id` | `route.coding` | Vocab lookup |
| `route_source_value` | `route.coding[0].display` or `route.text` | Verbatim |
| `quantity` | `doseQuantity.value` | Numeric |
| `dose_unit_source_value` | `doseQuantity.unit` | Verbatim |
| Status filter | `status` | Only `completed` or `in-progress`; `not-done` → route to observation table |

### A6. AllergyIntolerance — Value-as-Concept Pattern

**File:** `FhirBulkMapper::mapAllergyIntolerance()`

Implement the IG's Value-as-Concept decomposition:

- `observation_concept_id` = allergy **category** concept:
  - `medication` → 439224 (Drug allergy)
  - `food` → 4166257 (Food allergy)
  - `environment` → 4196403 (Environmental allergy)
  - `biologic` → 439224 (fallback to Drug allergy)
- `value_as_concept_id` = specific **substance** from `code.coding` vocab lookup
- `observation_source_value` = verbatim code string

**Reactions**: Each `reaction[].manifestation` produces a separate observation row:
- `observation_concept_id` = manifestation concept (vocab lookup on manifestation coding)
- `observation_event_id` = parent allergy observation's ID
- `obs_event_field_concept_id` = 1147127 (observation.observation_id)

This requires the mapper to return multiple CDM rows per resource (see B1 for signature change).

### A7. Observation/Measurement — Unit & Interpretation

**Files:** `FhirBulkMapper::mapObservation()`, `VocabularyLookupService`

| Gap | Fix |
|---|---|
| No `unit_concept_id` | Resolve `valueQuantity.code` via UCUM vocabulary lookup. New method `VocabularyLookupService::resolveUcumUnit(string $ucumCode): int`. Uses the same `lookupConcept('UCUM', $ucumCode)` method internally. Returns 0 when UCUM code not found in vocabulary. Always populate `unit_source_value` alongside as fallback. |
| No `value_as_concept_id` on Observation | Call `extractValueConceptId()` for observation table rows (already exists for measurement) |
| No interpretation mapping | Map `interpretation.coding.code` → `value_as_concept_id` when no valueCodeableConcept: H→4328749, L→4267416, N→4069590, A→4135422, HH→4328749, LL→4267416 |

Add UCUM code system to `SYSTEM_TO_VOCAB`: `'http://unitsofmeasure.org' => 'UCUM'`.

### A8. Patient — Gender Concept Fix

**File:** `FhirBulkMapper::GENDER_MAP`

Change `'other' => 8521` to `'other' => 44814653` (non-binary concept per IG). Add `null` / missing → 0 explicit handling.

---

## Phase B: Structural Expansion — New CDM Tables

### B1. Mapper Signature Change

**File:** `FhirBulkMapper::mapResource()`

Change return type from `?array` (single row) to `array[]` (array of rows). Each row retains the shape `{cdm_table, data, fhir_resource_type, fhir_resource_id}`.

This enables:
- Patient → person row + death row
- AllergyIntolerance → allergy observation + reaction observations
- Encounter → visit_occurrence + provider + care_site rows

**File:** `FhirNdjsonProcessorService::processFile()` — cascading changes required:

1. **Iteration**: Wrap the current single-row processing in a `foreach ($rows as $mapped)` loop
2. **Concept check**: Call `hasMappedConcept()` per-row (not per-resource), since secondary rows (death, provider, care_site) may have concept_id = 0 legitimately — skip the check for non-clinical tables (`death`, `provider`, `care_site`, `location`)
3. **Dedup**: The dedup service tracks by `(site_key, fhir_resource_type, fhir_resource_id)`. When one FHIR resource produces multiple CDM rows:
   - Track each CDM row separately in `fhir_dedup_tracking` using a composite key: `fhir_resource_id` + `cdm_table` (e.g., `Patient/123|person`, `Patient/123|death`)
   - `FhirDedupService::checkStatus()` accepts an optional `cdm_table` parameter to disambiguate
   - `deleteOldRow()` targets the specific CDM table, not all rows for the FHIR resource
4. **Counters**: `records_mapped` and `records_written` count CDM rows (not FHIR resources), so the multi-row approach naturally inflates these counts — document this in sync run reporting

### B2. Death Table

**Source:** `Patient.deceasedDateTime`, `Patient.deceasedBoolean`

Enhance `mapPatient()` to emit a second row when deceased data is present:

| CDM Field | FHIR Source | Rule |
|---|---|---|
| `person_id` | Crosswalk | Same as person row |
| `death_date` | `deceasedDateTime` | Date extraction |
| `death_datetime` | `deceasedDateTime` | Datetime extraction |
| `death_type_concept_id` | — | 32817 (EHR) |
| `cause_concept_id` | `extension[cause-of-death]` | Vocab lookup if present, else 0 |
| `cause_source_value` | Extension text | Verbatim |

When `deceasedBoolean = true` without datetime: emit death row with `death_date = null`, preserving the fact of death without a specific date.

### B3. Provider Table

**Source:** `Encounter.participant[].individual`, `Procedure.performer[].actor`

New private method `buildProviderRow()` called from Encounter and Procedure mappers when a practitioner reference is found.

| CDM Field | FHIR Source | Rule |
|---|---|---|
| `provider_id` | `CrosswalkService::resolveProviderId()` | Auto-increment via crosswalk |
| `provider_name` | `participant.individual.display` / `performer.actor.display` | Verbatim |
| `provider_source_value` | FHIR Practitioner ID | Reference ID |
| `specialty_concept_id` | — | 0 (Practitioner resource not in default export) |

Dedup: if provider already exists for this site_key + practitioner ID in crosswalk, skip the provider row but still use the `provider_id` on the parent encounter/procedure.

### B4. Location & CareSite Tables

**Source:** `Encounter.location[].location`, `Encounter.serviceProvider`

**New crosswalk tables** (via migration):
- `fhir_location_crosswalk` (`location_id PK`, `site_key`, `fhir_location_id`, unique on site_key+fhir_location_id)
- `fhir_caresite_crosswalk` (`care_site_id PK`, `site_key`, `fhir_organization_id`, unique on site_key+fhir_organization_id)

**CrosswalkService** extended with `resolveLocationId()` and `resolveCareSiteId()`.

**Location row:**

| CDM Field | FHIR Source | Rule |
|---|---|---|
| `location_id` | Crosswalk | Auto-increment |
| `location_source_value` | FHIR Location reference ID | Reference ID |

Address fields (`address_1`, `city`, `state`, `zip`) are not available from Encounter alone (Location resource not in default export). Store `location_source_value` for future enrichment.

**CareSite row:**

| CDM Field | FHIR Source | Rule |
|---|---|---|
| `care_site_id` | Crosswalk | Auto-increment |
| `care_site_name` | `serviceProvider.display` | Verbatim |
| `care_site_source_value` | FHIR Organization reference ID | Reference ID |
| `location_id` | Linked if location also resolved | Crosswalk lookup |
| `place_of_service_concept_id` | Encounter class | AMB→9202, IMP→9201, EMER→9203 |

**Encounter linkage**: `visit_occurrence.care_site_id` populated from resolved care_site.

### B5. ObservationPeriod Generation

**Source:** Derived from all mapped clinical events per person.

**Implementation:** Post-processing step in `FhirNdjsonProcessorService`, called after all resource processing completes via new method `generateObservationPeriods()`.

Algorithm:
1. Query min/max event dates across CDM tables (condition_occurrence, drug_exposure, measurement, observation, procedure_occurrence, visit_occurrence) grouped by person_id
2. For each person, generate one `observation_period` row:
   - `observation_period_id` → auto-increment
   - `person_id` → from query
   - `observation_period_start_date` → earliest event date
   - `observation_period_end_date` → latest event date
   - `period_type_concept_id` → 32817 (EHR)
3. On incremental sync: expand existing observation_period date range if new events fall outside it (UPDATE, not INSERT)

**Multi-source handling**: Each FHIR connection (identified by `site_key`) generates observation_periods scoped to data from that source only. Use `period_type_concept_id` to tag the source: 32817 (EHR) for all FHIR-sourced data. When multiple sources feed the same person_id (via crosswalk), each source maintains its own observation_period row. The query filters CDM tables by joining through the dedup tracking table's `site_key` to scope events to the current sync source.

### B6. VisitDetail Table

**Source:** Encounter resources with `partOf` references (sub-encounters).

When `Encounter.partOf` is present:
- Map to `visit_detail` instead of `visit_occurrence`
- `visit_detail_id` → auto-increment
- `visit_occurrence_id` → resolved from parent encounter's crosswalk entry
- Same field mappings as visit_occurrence (class→concept, period→dates, admitted/discharged, provider)

Detection: check for `partOf` reference in `mapEncounter()`. If present, call `mapVisitDetail()` instead.

### B7. Migration

**File:** `database/migrations/2026_03_12_010001_add_fhir_ig_crosswalk_tables.php`

Creates:
- `fhir_location_crosswalk` (location_id BIGSERIAL PK, site_key VARCHAR, fhir_location_id VARCHAR, unique index)
- `fhir_caresite_crosswalk` (care_site_id BIGSERIAL PK, site_key VARCHAR, fhir_organization_id VARCHAR, unique index)

---

## Phase C: OMOP-to-FHIR Reverse Direction

### C1. Architecture

New service layer at `backend/app/Services/Fhir/Export/`:

```
Services/Fhir/Export/
├── OmopToFhirService.php          — Orchestrator: reads CDM, delegates to builders
├── FhirResourceBuilderFactory.php — Factory: CDM table → correct builder
├── Builders/
│   ├── PatientBuilder.php         — person + death → FHIR Patient
│   ├── ConditionBuilder.php       — condition_occurrence → FHIR Condition
│   ├── EncounterBuilder.php       — visit_occurrence → FHIR Encounter
│   ├── ObservationBuilder.php     — observation → FHIR Observation
│   ├── MeasurementBuilder.php     — measurement → FHIR Observation (lab/vital)
│   ├── MedicationBuilder.php      — drug_exposure → FHIR MedicationStatement
│   ├── ProcedureBuilder.php       — procedure_occurrence → FHIR Procedure
│   ├── ImmunizationBuilder.php    — drug_exposure (CVX) → FHIR Immunization
│   └── AllergyBuilder.php         — observation (allergy) → FHIR AllergyIntolerance
└── FhirBundleAssembler.php        — Wraps resources into FHIR Bundle (searchset/collection)
```

Each builder: ~100-150 lines, single `build(array $cdmRow): array` method returning a FHIR R4 resource array.

### C2. Reverse Vocabulary Resolution

**File:** `Services/Fhir/Export/ReverseVocabularyService.php`

Inverse of `VocabularyLookupService`:

1. Input: OMOP `concept_id`
2. Look up in `concept` table: get `concept_code`, `vocabulary_id`, `concept_name`
3. Map `vocabulary_id` → FHIR code system URI (reverse of `SYSTEM_TO_VOCAB`)
4. Return FHIR coding: `{system, code, display}`
5. When `*_source_concept_id` differs from standard concept, include both as multiple codings in `CodeableConcept.coding[]`

Same LRU cache pattern as forward service (50K entries).

Constant: `VOCAB_TO_SYSTEM` — canonical reverse of `VocabularyLookupService::SYSTEM_TO_VOCAB`:

```php
private const VOCAB_TO_SYSTEM = [
    'SNOMED'  => 'http://snomed.info/sct',
    'LOINC'   => 'http://loinc.org',
    'RxNorm'  => 'http://www.nlm.nih.gov/research/umls/rxnorm',
    'ICD10CM' => 'http://hl7.org/fhir/sid/icd-10-cm',
    'ICD10'   => 'http://hl7.org/fhir/sid/icd-10',
    'ICD9CM'  => 'http://hl7.org/fhir/sid/icd-9-cm',
    'CPT4'    => 'http://www.ama-assn.org/go/cpt',       // canonical URI (not the OID)
    'NDC'     => 'http://hl7.org/fhir/sid/ndc',
    'CVX'     => 'http://hl7.org/fhir/sid/cvx',
    'HCPCS'   => 'http://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets',
    'Race'    => 'urn:oid:2.16.840.1.113883.6.238',
    'UCUM'    => 'http://unitsofmeasure.org',
];
```

Note: `CPT4` has two forward URIs (`http://www.ama-assn.org/go/cpt` and `urn:oid:2.16.840.1.113883.6.12`). The reverse always uses the canonical `http://www.ama-assn.org/go/cpt`.

### C3. Resource Builder Specifications

#### PatientBuilder (person + death → FHIR Patient)

| CDM Field | FHIR Field | Rule |
|---|---|---|
| `person_id` | `id` | String cast |
| `gender_concept_id` | `gender` | 8507→male, 8532→female, 44814653→other, 8551→unknown |
| `year/month/day_of_birth` | `birthDate` | ISO 8601 (YYYY-MM-DD, partial OK) |
| `race_concept_id` | `extension[us-core-race]` | Reverse race map → OMB category coding |
| `ethnicity_concept_id` | `extension[us-core-ethnicity]` | Reverse ethnicity map → OMB category coding |
| `person_source_value` | `identifier[0].value` | Source system ID |
| Death row join | `deceasedDateTime` / `deceasedBoolean` | If death record exists |

#### ConditionBuilder (condition_occurrence → FHIR Condition)

| CDM Field | FHIR Field | Rule |
|---|---|---|
| `condition_concept_id` | `code.coding[0]` | Via ReverseVocabularyService (standard) |
| `condition_source_concept_id` | `code.coding[1]` | Source coding if different |
| `condition_start_date/datetime` | `onsetDateTime` | Prefer datetime, fall back to date |
| `condition_end_date/datetime` | `abatementDateTime` | If present |
| `condition_status_concept_id` | `clinicalStatus` | Reverse status map |
| `condition_source_value` | `code.text` | Verbatim |
| `visit_occurrence_id` | `encounter.reference` | `Encounter/{id}` |
| `person_id` | `subject.reference` | `Patient/{id}` |

#### EncounterBuilder (visit_occurrence → FHIR Encounter)

| CDM Field | FHIR Field | Rule |
|---|---|---|
| `visit_concept_id` | `class` | 9202→AMB, 9201→IMP, 9203→EMER, 581476→HH |
| `visit_start_date/datetime` | `period.start` | ISO datetime |
| `visit_end_date/datetime` | `period.end` | ISO datetime |
| `admitted_from_concept_id` | `hospitalization.admitSource` | Via ReverseVocabularyService |
| `discharged_to_concept_id` | `hospitalization.dischargeDisposition` | Via ReverseVocabularyService |
| `provider_id` | `participant[0].individual` | `Practitioner/{id}` |
| `care_site_id` | `serviceProvider` | `Organization/{id}` |

#### ObservationBuilder (observation → FHIR Observation)

| CDM Field | FHIR Field | Rule |
|---|---|---|
| `observation_concept_id` | `code` | Via ReverseVocabularyService |
| `observation_date/datetime` | `effectiveDateTime` | ISO |
| `value_as_string` | `valueString` | If present |
| `value_as_number` | `valueQuantity.value` | If present |
| `value_as_concept_id` | `valueCodeableConcept` | Via ReverseVocabularyService |
| Category | `category` | `social-history`, `survey`, etc. based on domain heuristics |

#### MeasurementBuilder (measurement → FHIR Observation)

| CDM Field | FHIR Field | Rule |
|---|---|---|
| `measurement_concept_id` | `code` | Via ReverseVocabularyService |
| `measurement_date/datetime` | `effectiveDateTime` | ISO |
| `value_as_number` | `valueQuantity.value` | Numeric |
| `unit_source_value` | `valueQuantity.unit` | String |
| `unit_concept_id` | `valueQuantity.code` + `valueQuantity.system` | UCUM reverse lookup |
| `value_as_concept_id` | `valueCodeableConcept` | Via ReverseVocabularyService |
| `range_low`/`range_high` | `referenceRange` | Numeric |
| Category | `category` | `laboratory` or `vital-signs` based on concept domain |

#### MedicationBuilder (drug_exposure → FHIR MedicationStatement)

| CDM Field | FHIR Field | Rule |
|---|---|---|
| `drug_concept_id` | `medicationCodeableConcept` | Via ReverseVocabularyService |
| `drug_exposure_start_date` | `effectivePeriod.start` | ISO |
| `drug_exposure_end_date` | `effectivePeriod.end` | ISO |
| `sig` | `dosage[0].text` | Verbatim |
| `quantity` | `dosage[0].doseAndRate[0].doseQuantity.value` | Numeric |
| `route_concept_id` | `dosage[0].route` | Via ReverseVocabularyService |
| `drug_type_concept_id` | `status` | 32817→active, 32818→active |

#### ProcedureBuilder (procedure_occurrence → FHIR Procedure)

| CDM Field | FHIR Field | Rule |
|---|---|---|
| `procedure_concept_id` | `code` | Via ReverseVocabularyService |
| `procedure_date/datetime` | `performedDateTime` or `performedPeriod.start` | ISO |
| `procedure_end_date/datetime` | `performedPeriod.end` | If present, use Period |
| `provider_id` | `performer[0].actor` | `Practitioner/{id}` |
| `visit_occurrence_id` | `encounter` | `Encounter/{id}` |
| Status | `status` | Always `completed` (OMOP stores only completed) |

#### ImmunizationBuilder (drug_exposure [CVX] → FHIR Immunization)

Detection: `drug_source_concept_id` resolves to CVX vocabulary, or `drug_source_value` contains CVX system URI.

| CDM Field | FHIR Field | Rule |
|---|---|---|
| `drug_concept_id` | `vaccineCode` | Via ReverseVocabularyService |
| `drug_exposure_start_date` | `occurrenceDateTime` | ISO |
| `lot_number` | `lotNumber` | Verbatim |
| `route_concept_id` | `route` | Via ReverseVocabularyService |
| `quantity` | `doseQuantity.value` | Numeric |
| Status | `status` | `completed` |

#### AllergyBuilder (observation [allergy] → FHIR AllergyIntolerance)

Detection: `observation_concept_id` matches known allergy category concepts (439224, 4166257, 4196403).

| CDM Field | FHIR Field | Rule |
|---|---|---|
| `value_as_concept_id` | `code` | Specific substance via ReverseVocabularyService |
| `observation_concept_id` | `category` | 439224→medication, 4166257→food, 4196403→environment |
| `observation_date/datetime` | `recordedDate` | ISO |
| Linked reaction observations | `reaction[].manifestation` | Query by `observation_event_id` |

### C4. FHIR R4 API Endpoints

**Controller:** `Http/Controllers/Api/V1/FhirR4Controller.php`

All endpoints under `/api/v1/fhir/`, requiring `auth:sanctum` middleware.

| Endpoint | Method | Description | Search Parameters |
|---|---|---|---|
| `/fhir/metadata` | GET | CapabilityStatement | — (public, no auth) |
| `/fhir/Patient` | GET | Search patients | `_count`, `_offset`, `gender`, `birthdate` |
| `/fhir/Patient/{id}` | GET | Read patient | — |
| `/fhir/Condition` | GET | Search conditions | `patient`, `code`, `onset-date`, `clinical-status` |
| `/fhir/Condition/{id}` | GET | Read condition | — |
| `/fhir/Encounter` | GET | Search encounters | `patient`, `date`, `class` |
| `/fhir/Encounter/{id}` | GET | Read encounter | — |
| `/fhir/Observation` | GET | Search observations | `patient`, `category`, `code`, `date` |
| `/fhir/Observation/{id}` | GET | Read observation | — |
| `/fhir/MedicationStatement` | GET | Search medications | `patient`, `code` |
| `/fhir/MedicationStatement/{id}` | GET | Read medication | — |
| `/fhir/Procedure` | GET | Search procedures | `patient`, `code`, `date` |
| `/fhir/Procedure/{id}` | GET | Read procedure | — |
| `/fhir/Immunization` | GET | Search immunizations | `patient`, `vaccine-code` |
| `/fhir/Immunization/{id}` | GET | Read immunization | — |
| `/fhir/AllergyIntolerance` | GET | Search allergies | `patient` |
| `/fhir/AllergyIntolerance/{id}` | GET | Read allergy | — |

**Response format:** FHIR Bundle with `type: searchset`, proper `total`, `link` for pagination.

**Source selection:** Query parameter `source_id` determines which CDM schema/connection to read from.

**Rate limiting:** Separate `throttle:fhir` group.

**Authorization:** Configurable role (default `fhir-read`). CapabilityStatement (`/fhir/metadata`) is public.

### C5. CapabilityStatement

Returned by `GET /fhir/metadata`:

```json
{
  "resourceType": "CapabilityStatement",
  "status": "active",
  "kind": "instance",
  "fhirVersion": "4.0.1",
  "format": ["json"],
  "implementation": {
    "description": "Parthenon OMOP-to-FHIR R4 Server",
    "url": "<configured base URL>"
  },
  "rest": [{
    "mode": "server",
    "security": {
      "service": [{"coding": [{"code": "Bearer"}]}],
      "description": "Bearer token via Sanctum"
    },
    "resource": [
      {"type": "Patient", "interaction": [{"code": "read"}, {"code": "search-type"}], "searchParam": [...]},
      {"type": "Condition", ...},
      ...
    ]
  }],
  "instantiates": ["http://hl7.org/fhir/uv/omop/ImplementationGuide/hl7.fhir.uv.omop"]
}
```

### C6. Bulk Export (OMOP→FHIR Direction)

**Job:** `Jobs/Fhir/RunFhirExportJob.php`

Pipeline:
1. Accept resource types + optional patient group/date range filter
2. Query CDM tables in batches (1000 rows per batch)
3. Build FHIR resources via builders
4. Write NDJSON files to `storage/app/fhir-exports/{job-id}/`
5. Return polling endpoint per FHIR Bulk Data Access spec

**Endpoints:**

| Endpoint | Method | Description |
|---|---|---|
| `/fhir/$export` | POST | Kick off export; returns 202 + `Content-Location` header |
| `/fhir/$export/{job-id}` | GET | Poll status: 202 (in-progress with X-Progress header) or 200 (complete with file manifest) |
| `/fhir/$export/{job-id}/files/{filename}` | GET | Download NDJSON file |

**Request body** for `POST /fhir/$export`:
```json
{
  "source_id": 1,
  "resource_types": ["Patient", "Condition", "Observation"],
  "since": "2025-01-01T00:00:00Z",
  "patient_ids": [1, 2, 3]
}
```

File TTL: configurable, default 24 hours, cleaned up by scheduled command.

### C7. Frontend — FHIR Export Dashboard

**Page:** `frontend/src/features/administration/pages/FhirExportPage.tsx`

Features:
- Source selector dropdown
- Resource type checkboxes (all 9 types)
- Optional date range filter
- "Start Export" button → triggers `POST /fhir/$export`
- Active export progress indicator (polling)
- Export history table with status, resource counts, file download links
- Download individual NDJSON files or ZIP bundle

**React hooks:**
- `useFhirExports(sourceId)` — list export jobs
- `useStartFhirExport()` — mutation
- `useFhirExportStatus(jobId, refetchInterval)` — poll active export

**API types:**
```typescript
interface FhirExportJob {
  id: string;
  source_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resource_types: string[];
  since?: string;
  files: Array<{resource_type: string; url: string; count: number}>;
  started_at: string;
  finished_at?: string;
  error_message?: string;
}
```

---

## New Files Summary

### Phase A (modifications only)
- `backend/app/Services/Fhir/FhirBulkMapper.php` — enhanced
- `backend/app/Services/Fhir/VocabularyLookupService.php` — UCUM support added

### Phase B (new + modifications)
- `backend/database/migrations/2026_03_12_010001_add_fhir_ig_crosswalk_tables.php` — new
- `backend/app/Services/Fhir/FhirBulkMapper.php` — multi-row return, death/provider/caresite/visitdetail
- `backend/app/Services/Fhir/FhirNdjsonProcessorService.php` — multi-row iteration, observation_period generation
- `backend/app/Services/Fhir/CrosswalkService.php` — resolveLocationId(), resolveCareSiteId()

### Phase C (all new)
- `backend/app/Services/Fhir/Export/OmopToFhirService.php`
- `backend/app/Services/Fhir/Export/ReverseVocabularyService.php`
- `backend/app/Services/Fhir/Export/FhirResourceBuilderFactory.php`
- `backend/app/Services/Fhir/Export/FhirBundleAssembler.php`
- `backend/app/Services/Fhir/Export/Builders/PatientBuilder.php`
- `backend/app/Services/Fhir/Export/Builders/ConditionBuilder.php`
- `backend/app/Services/Fhir/Export/Builders/EncounterBuilder.php`
- `backend/app/Services/Fhir/Export/Builders/ObservationBuilder.php`
- `backend/app/Services/Fhir/Export/Builders/MeasurementBuilder.php`
- `backend/app/Services/Fhir/Export/Builders/MedicationBuilder.php`
- `backend/app/Services/Fhir/Export/Builders/ProcedureBuilder.php`
- `backend/app/Services/Fhir/Export/Builders/ImmunizationBuilder.php`
- `backend/app/Services/Fhir/Export/Builders/AllergyBuilder.php`
- `backend/app/Http/Controllers/Api/V1/FhirR4Controller.php`
- `backend/app/Http/Requests/FhirSearchRequest.php`
- `backend/app/Jobs/Fhir/RunFhirExportJob.php`
- `backend/routes/fhir.php` — separate route file for FHIR R4 read/search endpoints. Registered in `bootstrap/app.php` via `->withRouting(then: fn () => Route::prefix('api/v1')->middleware(['api'])->group(base_path('routes/fhir.php')))`. Keeps FHIR R4 server routes separate from admin FHIR connection management routes (which remain in `routes/api.php`).
- `frontend/src/features/administration/pages/FhirExportPage.tsx`
- `frontend/src/features/administration/hooks/useFhirExports.ts`

---

## Design Notes

### Lossy Reverse Mappings (Known Limitations)

The OMOP→FHIR direction is inherently lossy in some cases:
- **Encounter class**: `visit_concept_id` 9201 could be IMP or OBSENC. Reverse always picks the canonical code (IMP). Documented as known one-way loss.
- **Medication status**: Both `drug_type_concept_id` 32817 (EHR) and 32818 (Administered) map to FHIR status `active`. Consider using `category` to distinguish in future iteration.
- **AllergyIntolerance detection**: Relies on `observation_concept_id` matching known allergy category concepts (439224, 4166257, 4196403). Non-FHIR-sourced allergy observations with different concept IDs will not be detected. Acceptable tradeoff for initial implementation.

### Builder Error Handling

When a builder encounters a CDM row with `*_concept_id = 0` (unmapped):
- Emit the resource with `code.coding` omitted and `code.text` set to `*_source_value`
- Add FHIR `data-absent-reason` extension with value `unknown` on the code element
- Never skip a resource silently — all CDM rows produce FHIR resources, even with degraded coding

### FHIR Search Parameter `_id`

All search endpoints support `_id` as a standard FHIR search parameter in addition to the `/{id}` read interaction.

---

## Testing Strategy

### Unit Tests
- Each builder: verify correct FHIR resource shape for known CDM input
- ReverseVocabularyService: verify concept_id → coding mapping
- FhirBulkMapper: verify all new field extractions per IG
- Status filtering: verify skipped resources logged correctly

### Integration Tests
- Full round-trip: FHIR→OMOP→FHIR for each resource type, verify semantic equivalence
- ObservationPeriod generation from heterogeneous event dates
- Crosswalk integrity for new tables (location, caresite)

### E2E Tests
- FHIR R4 API: search, read, pagination for each resource type
- CapabilityStatement structure validation
- Bulk export: trigger, poll, download, verify NDJSON content
- Frontend export dashboard: trigger export, verify progress, download files

---

## Success Criteria

1. All 9 IG Structure Map field-level mappings fully implemented (no missing fields)
2. New CDM tables generated: death, provider, location, care_site, observation_period, visit_detail
3. OMOP→FHIR R4 read/search API serving 9 resource types
4. CapabilityStatement conformant with FHIR R4 spec
5. Bulk Data Export (OMOP→FHIR) producing valid NDJSON
6. Round-trip test: FHIR→OMOP→FHIR preserves key clinical semantics
7. Frontend export dashboard functional
8. All existing FHIR sync functionality unbroken (backward compatible)
