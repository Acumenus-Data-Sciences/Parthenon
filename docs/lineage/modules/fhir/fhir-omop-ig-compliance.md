# FHIR-OMOP IG Compliance & Bidirectional Bridge — Devlog

**Date:** 2026-03-12
**Branch:** `feature/fhir-omop-ig-compliance`
**Commits:** 26 FHIR-specific commits (103 total on branch including prior work)
**Tests:** 56 FHIR tests, 223 assertions — all passing

---

## What Was Built

A full HL7 FHIR-OMOP IG v1.0.0 compliance pass plus a reverse OMOP-to-FHIR R4 server, creating a bidirectional bridge between FHIR and OMOP CDM v5.4.

### Phase A — Field-Level IG Compliance

Brought all existing FHIR-to-OMOP mappers up to IG spec:

- **Gender:** Fixed concept IDs (8507 male, 8532 female, 8551 unknown, 8570 ambiguous)
- **UCUM units:** Added `resolveUcumUnit()` to VocabularyLookupService for measurement/observation units
- **Multi-row return type:** `mapResource()` now returns `array[]` — one FHIR resource can produce multiple CDM rows (e.g., Encounter → visit_occurrence + provider + care_site + location)
- **Condition:** Status mapping (active→32817, resolved→32818, etc.), category mapping (encounter-diagnosis→32817, problem-list-item→32840)
- **Encounter:** Admission/discharge source concepts, R4 vs R5 `class` detection (Coding vs CodeableConcept[]), provider/location/care_site row generation
- **Medication:** Conditional start/end dates from effectivePeriod, sig from dosageInstruction, route concept
- **Procedure:** End dates from performedPeriod.end, provider from performer[0].actor, status filter (completed only)
- **Immunization:** lot_number, route, quantity, dose_unit, status filter (completed/in-progress → drug_exposure, not-done → observation, entered-in-error → skip)
- **Observation/Measurement:** unit_concept_id via UCUM, value_as_concept_id with interpretation fallback (H/L/N/A codes)
- **AllergyIntolerance:** Value-as-Concept pattern — category → observation_concept_id, substance → value_as_concept_id

### Phase B — Structural Expansion

New CDM table generators and crosswalk infrastructure:

- **Crosswalk tables:** `fhir_location_crosswalk`, `fhir_caresite_crosswalk` (migration + service methods with in-memory caching)
- **Multi-row Encounter:** Single Encounter resource now generates up to 4 CDM rows: visit_occurrence, provider, location, care_site
- **Death table:** Deceased patients (deceasedDateTime or deceasedBoolean) generate `death` table rows alongside `person` rows
- **ObservationPeriod:** Post-processing step builds UNION ALL across 6 CDM tables (condition, drug, measurement, observation, procedure, visit) to compute min/max event dates per person
- **VisitDetail:** Encounter resources with `partOf` references map to `visit_detail` table (sub-encounters)

### Phase C — OMOP-to-FHIR Reverse Direction

Complete reverse pipeline from OMOP CDM back to FHIR R4:

- **ReverseVocabularyService:** Maps concept_id → FHIR {system, code, display} with 12-vocabulary support (SNOMED, LOINC, RxNorm, ICD10, CPT4, etc.) and 50K entry cache
- **9 resource builders:** Patient, Condition, Encounter, Observation, Measurement, Medication, Procedure, Immunization, Allergy — each maps CDM row → FHIR R4 JSON with proper extensions (US Core race/ethnicity, data-absent-reason)
- **FhirBundleAssembler:** Wraps resources in FHIR Bundle (searchset/single types)
- **FhirResourceBuilderFactory:** Factory dispatching CDM table names to builder instances
- **OmopToFhirService:** Orchestrator with search (pagination + filters) and read (single resource)
- **FHIR R4 API:** `FhirR4Controller` with CapabilityStatement (`GET /fhir/metadata`), search (`GET /fhir/{Type}`), read (`GET /fhir/{Type}/{id}`)
- **Bulk export:** `RunFhirExportJob` queue job producing NDJSON files, status polling, download endpoints
- **Frontend dashboard:** React page at `/admin/fhir-export` with source selector, resource type checkboxes, status polling, download links (dark clinical theme)

## Architecture Decisions

1. **Multi-row mapper return type** — Changed `mapResource()` from returning a single row to `array[]`. The normalization layer in `mapResource()` handles backward compatibility: null/skip → [], single-row (has `cdm_table` key) → wrapped in array, multi-row → passthrough.

2. **`__skip` sentinel** — Mappers return `['__skip' => true]` for filtered-out resources (entered-in-error status). This is caught by the normalization layer and converted to `[]`.

3. **Value-as-Concept pattern** — AllergyIntolerance uses category as the primary concept and substance as value_as_concept_id, matching the IG's recommendation for allergy observations.

4. **Composite dedup keys** — Multi-row resources use `fhir_resource_id|cdm_table` for tracking, ensuring each CDM row from a single FHIR resource gets its own dedup entry.

5. **Builder pattern for reverse** — Each CDM table has a dedicated builder class rather than a monolithic mapper, making it easy to add new resource types.

## Key Files

| Area | Files |
|------|-------|
| Forward mapper | `app/Services/Fhir/FhirBulkMapper.php` |
| Crosswalks | `app/Services/Fhir/CrosswalkService.php` |
| Processor | `app/Services/Fhir/FhirNdjsonProcessorService.php` |
| Reverse vocab | `app/Services/Fhir/Export/ReverseVocabularyService.php` |
| Builders (9) | `app/Services/Fhir/Export/Builders/*.php` |
| Factory | `app/Services/Fhir/Export/FhirResourceBuilderFactory.php` |
| Orchestrator | `app/Services/Fhir/Export/OmopToFhirService.php` |
| Assembler | `app/Services/Fhir/Export/FhirBundleAssembler.php` |
| Controller | `app/Http/Controllers/Api/V1/FhirR4Controller.php` |
| Routes | `routes/fhir.php` |
| Export job | `app/Jobs/Fhir/RunFhirExportJob.php` |
| Migration | `database/migrations/2026_03_12_010001_add_fhir_ig_crosswalk_tables.php` |
| Export job table | `database/migrations/2026_03_12_020001_create_fhir_export_jobs_table.php` |
| Frontend | `frontend/src/features/administration/pages/FhirExportPage.tsx` |
| Tests (forward) | `tests/Unit/Services/Fhir/FhirBulkMapperTest.php` (22 tests) |
| Tests (reverse) | `tests/Unit/Services/Fhir/Export/BuilderTest.php` (20 tests) |
| Tests (round-trip) | `tests/Feature/Fhir/RoundTripTest.php` (12 tests) |
| Tests (other) | `tests/Unit/Services/Fhir/Export/ReverseVocabularyServiceTest.php` (2 tests) |

## Test Coverage

- **56 total FHIR tests**, 223 assertions, all green in 0.54s
- 22 forward mapper tests covering all resource types + edge cases
- 20 builder tests for all 9 reverse builders + bundle assembler
- 12 round-trip tests (FHIR → OMOP → FHIR) verifying field preservation
- 2 reverse vocabulary boundary tests
- 2 orchestrator guard-path tests

## Gotchas & Lessons

1. **R4 vs R5 Encounter.class** — R4 uses `class.code` (single Coding), R5 uses `class[0].coding[0].code` (array of CodeableConcept). The mapper detects both formats.

2. **Date vs DateTime round-trip** — The forward mapper converts date strings (`2024-01-15`) to datetimes (`2024-01-15 00:00:00`). Round-trip tests use `assertStringStartsWith` for date prefix matching.

3. **Immunization status branching** — `not-done` immunizations map to `observation` (not drug_exposure) per the IG. `entered-in-error` is skipped entirely.

4. **ObservationPeriod SQL** — Uses a UNION ALL across 6 tables with GROUP BY person_id to avoid N+1 queries. The `updateOrInsert` handles both initial and incremental syncs.

5. **PHPStan `mixed` types** — Query builder results are `mixed` at level 8. The OmopToFhirService uses explicit `\Illuminate\Database\Query\Builder` type hints to satisfy PHPStan.

## What's Next

- Run the full pipeline against real FHIR data from a bulk export endpoint
- Add SMART on FHIR authentication to the FHIR R4 API
- Consider adding $everything operation for patient-centric exports
- Frontend: add FHIR resource browser for searching/viewing individual resources
