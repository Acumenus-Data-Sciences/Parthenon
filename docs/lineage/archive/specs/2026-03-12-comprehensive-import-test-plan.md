# Comprehensive Data Import Test Plan

**Date:** 2026-03-12
**Scope:** All application pathways following the pattern: messy data upload → Abby AI-assisted conversion → mission-critical import
**Status:** Draft

---

## 1. Import Systems Inventory

The application has 12 distinct import systems. Of these, **5 have direct Abby AI integration** and **7 are import-only** (no AI assist). This test plan covers all 12 but prioritizes the 5 Abby-integrated pathways.

### Abby-Integrated Pathways (Priority 1)

| # | System | Entry Point | AI Role | Status |
|---|--------|------------|---------|--------|
| 1 | Structured Data Ingestion | `POST /api/v1/ingestion/upload` | Schema mapping, concept mapping, profiling | Fully implemented |
| 2 | GIS Data Import | `POST /api/v1/gis/import/upload` | Column analysis, geo code detection, mapping suggestions | Fully implemented |
| 3 | FHIR Ingestion | `POST /api/v1/fhir/upload` | Bundle parsing, metadata extraction | Partial (no FHIR→CDM transform) |
| 4 | Concept Mapping Review | `POST /api/v1/mapping-review/{id}/remap` | 5-strategy concept mapping pipeline | Fully implemented |
| 5 | Clinical NLP | `POST /api/v1/clinical-nlp/extract` | Entity extraction from clinical notes | Stub only |

### Import-Only Pathways (Priority 2)

| # | System | Entry Point | Status |
|---|--------|------------|--------|
| 6 | Genomics (VCF/MAF) | `php artisan vcf:import` | Implemented |
| 7 | Concept Set Import | `POST /api/v1/concept-sets` (JSON body) | Implemented |
| 8 | Cohort Definition Import | `POST /api/v1/cohort-definitions` (JSON body) | Implemented |
| 9 | Phenotype Library Sync | `POST /api/v1/phenotype-library/sync` | Implemented |
| 10 | WebAPI Migration | `php artisan webapi:import-sources` | Implemented |
| 11 | Eunomia Demo Data | `php artisan parthenon:load-eunomia` | Implemented |
| 12 | Vocabulary Import | Manual SQL / ATHENA download | Manual process |

---

## 2. Test Strategy

### 2.1 Test Layers

```
┌─────────────────────────────────────────────────┐
│  E2E Tests (Playwright)                         │
│  Full user flow: upload → AI → map → import     │
├─────────────────────────────────────────────────┤
│  Integration Tests (Pest/pytest)                │
│  Service ↔ DB, Service ↔ AI, Job pipelines      │
├─────────────────────────────────────────────────┤
│  Unit Tests (Pest/Vitest/pytest)                │
│  Parsers, validators, confidence scoring        │
└─────────────────────────────────────────────────┘
```

### 2.2 Test Data Strategy

Each import system needs curated test fixtures:

| Fixture Category | Description | Location |
|-----------------|-------------|----------|
| **Golden files** | Known-good files that import cleanly | `backend/tests/fixtures/imports/golden/` |
| **Messy files** | Encoding issues, missing columns, mixed types | `backend/tests/fixtures/imports/messy/` |
| **Adversarial files** | Oversized, malformed, malicious content | `backend/tests/fixtures/imports/adversarial/` |
| **AI responses** | Mocked Ollama/ChromaDB responses at each confidence tier | `backend/tests/fixtures/imports/ai-responses/` |

### 2.3 AI Service Test Modes

Abby's behavior must be testable with AND without the AI service running:

- **Live mode**: Real Ollama + ChromaDB (integration tests, requires services running)
- **Mock mode**: Deterministic responses from fixture files (unit tests, CI)
- **Fallback mode**: AI service unavailable → verify rule-based heuristics activate

---

## 3. Pathway 1: Structured Data Ingestion (CSV/JSON/HL7 → CDM)

**The most critical import path.** Transforms arbitrary clinical data files into OMOP CDM tables.

### 3.1 Upload & Profiling

#### Unit Tests

| Test | Input | Expected |
|------|-------|----------|
| CSV parsing with UTF-8 BOM | `messy/bom-utf8.csv` | BOM stripped, columns detected correctly |
| CSV with mixed line endings | `messy/mixed-crlf.csv` | All rows parsed (CR, LF, CRLF) |
| CSV with quoted commas | `messy/quoted-commas.csv` | Commas inside quotes not treated as delimiters |
| Excel .xlsx parsing | `golden/clinical-data.xlsx` | All sheets enumerable, first sheet default |
| Excel .xls (legacy) parsing | `golden/legacy-format.xls` | Falls back to PhpSpreadsheet reader |
| JSON array format | `golden/clinical-array.json` | Each array element = one row |
| JSON lines format | `golden/clinical-jsonl.jsonl` | Each line parsed independently |
| Empty file upload | `adversarial/empty.csv` | 422 validation error, not 500 |
| File >50MB browser upload | `adversarial/oversized.csv` | 422 with size limit message |
| File with 500+ columns | `messy/wide-table.csv` | Profiled without timeout (30s limit) |
| Binary file with .csv extension | `adversarial/binary-as-csv.csv` | Rejected by content sniffing |
| CSV with duplicate column names | `messy/duplicate-headers.csv` | Columns suffixed with `_1`, `_2` |

#### Integration Tests

| Test | Scenario | Verification |
|------|----------|-------------|
| Profile generates column stats | Upload CSV → call profile endpoint | Returns min, max, mean, distinct count, nulls per column |
| CsvProfilerService type inference | Upload with mixed-type columns | `date_of_birth` → date, `age` → integer, `name` → string |
| PII detection flags | Upload with SSN, email columns | `pii_detected: true` in profile response |
| Large file streaming | Upload 10MB CSV | Memory stays under 256MB during profiling |

### 3.2 Abby Schema Mapping

#### Unit Tests (AI Mocked)

| Test | Input | AI Response | Expected |
|------|-------|-------------|----------|
| High-confidence auto-map | Columns: `patient_id`, `condition_code` | >0.90 confidence | Auto-mapped to `person_id`, `condition_concept_id` |
| Medium-confidence suggestion | Column: `dx_code` | 0.70 confidence | Suggested mapping, user confirmation required |
| Low-confidence manual | Column: `misc_field_1` | 0.30 confidence | No suggestion, manual mapping required |
| AI service down | Any upload | Connection refused | Rule-based fallback (117 regex patterns) activates |
| Conflicting AI suggestions | Two columns both map to `person_id` | N/A | Conflict flagged, user must resolve |

#### Integration Tests (AI Live)

| Test | Scenario | Verification |
|------|----------|-------------|
| Full schema mapping flow | Upload → profile → map | All CDM target tables suggested with confidence scores |
| ChromaDB learning persistence | Map columns → confirm → upload similar file | Second upload gets higher confidence from learned patterns |
| ChromaDB curated learning | Override AI suggestion → confirm | Only user-confirmed mapping stored (not original AI suggestion) |

### 3.3 Concept Mapping (5-Strategy Pipeline)

#### Unit Tests

| Test | Strategy Tested | Input | Expected |
|------|----------------|-------|----------|
| Historical cache hit | Strategy 1 | Previously mapped code | Instant match, no AI call |
| Exact code match | Strategy 2 | ICD-10 `E11.9` | Maps to concept `201826` (Type 2 DM) |
| SapBERT similarity | Strategy 3 | Free text `heart attack` | Top match: `4329847` (MI), similarity >0.85 |
| LLM reasoning | Strategy 4 | Ambiguous `DM` | Ollama disambiguates with context |
| Ensemble ranking | Strategy 5 | All strategies produce candidates | Weighted combination, highest wins |
| Confidence routing: AutoAccepted | Score ≥0.95 | Exact ICD-10 match | Status = `auto_accepted`, no review needed |
| Confidence routing: QuickReview | Score 0.70-0.95 | SapBERT near-match | Status = `quick_review`, reviewer sees top 3 |
| Confidence routing: FullReview | Score 0.10-0.70 | Ambiguous free text | Status = `full_review`, reviewer sees all candidates |
| Confidence routing: Unmappable | Score <0.10 | Gibberish input | Status = `unmappable`, flagged for manual entry |

#### Integration Tests

| Test | Scenario | Verification |
|------|----------|-------------|
| Batch concept mapping job | 100 source codes submitted | All processed, statuses assigned per confidence |
| Mapping review approve | Reviewer approves suggestion | `concept_mapping.status` = `accepted`, used in CDM write |
| Mapping review reject + remap | Reviewer rejects, provides correct concept | New mapping saved, old discarded |
| Partial batch failure | 50 codes succeed, 50 fail AI call | Succeeded codes persisted, failed codes retried |

### 3.4 CDM Write & Validation

#### Integration Tests

| Test | Scenario | Verification |
|------|----------|-------------|
| Full pipeline: upload → CDM | Golden CSV with person + conditions | Rows in `person`, `condition_occurrence` tables |
| Observation period calculation | Person with multiple visits | `observation_period` start/end spans all visits |
| Batch insert performance | 10,000 rows | Completes in <30s, uses batch inserts (1000/batch) |
| Post-load validation | Imported CDM data | 17 DQD-style checks pass (or report specific failures) |
| Rollback on job failure | Simulate mid-import crash | All partially-imported rows deleted |
| Duplicate import prevention | Import same file twice | Upsert behavior, no duplicate rows |

### 3.5 E2E Tests (Playwright)

| Test | User Flow | Verification |
|------|-----------|-------------|
| Happy path CSV import | Login → Upload CSV → Accept Abby mappings → Confirm → Import → View results | Data visible in Data Explorer |
| Messy data recovery | Upload CSV with encoding issues → Abby suggests fixes → User corrects → Import succeeds | Error count in summary matches expectations |
| AI-down graceful degradation | Stop Ollama → Upload CSV → Rule-based mapping shown → Manual correction → Import | Import completes without AI service |

---

## 4. Pathway 2: GIS Data Import

### 4.1 Upload & Format Detection

#### Unit Tests

| Test | Input | Expected |
|------|-------|----------|
| CSV with FIPS codes | `golden/county-svi.csv` | Detected as `tabular_geocode` mode |
| CSV with lat/lon | `golden/hospitals.csv` | Detected as `tabular_coords` mode |
| GeoJSON upload | `golden/boundaries.geojson` | Detected as `geospatial` mode |
| Shapefile .zip | `golden/counties.zip` (contains .shp/.dbf/.prj/.shx) | Validated and accepted |
| Shapefile .zip missing .prj | `adversarial/no-prj.zip` | 422 with specific missing file error |
| KML upload | `golden/facilities.kml` | Accepted, sent to AI service for conversion |
| Excel with geo codes | `golden/state-data.xlsx` | Parsed, columns available for mapping |
| CSV with mixed encoding | `messy/latin1-fips.csv` | Auto-detected encoding, parsed correctly |
| File with no geography columns | `adversarial/no-geo.csv` | Abby reports no geographic data found |

### 4.2 Abby Column Analysis

#### Unit Tests (AI Mocked)

| Test | Columns | AI Response | Expected |
|------|---------|-------------|----------|
| FIPS county detection | `FIPS`, `RPL_THEMES` | 95% confidence | `FIPS` → `geographic_code` (fips_county), auto-applied |
| ISO country detection | `iso3`, `population` | 92% confidence | `iso3` → `geographic_code` (iso_country), auto-applied |
| Coordinate detection | `lat`, `lng`, `name` | 88% confidence | `lat` → `latitude`, `lng` → `longitude`, suggested |
| Ambiguous column | `code` | 45% confidence | Manual mapping required |
| Value column detection | `RPL_THEMES`, `E_TOTPOP` | Varies | Exposure types suggested |
| ChromaDB-boosted confidence | Previously confirmed `RPL_THEMES` mapping | 98% | Higher confidence from learned pattern |

### 4.3 Geography Matching & Stub Creation

#### Integration Tests

| Test | Scenario | Verification |
|------|----------|-------------|
| Match existing geographies | Import FIPS codes that exist in `geographic_location` | All matched, 0 stubs created |
| Create stubs for unknown | Import FIPS codes NOT in `geographic_location` | Stubs created with `import_id`, flagged in summary |
| Mixed match/stub | Some FIPS exist, some don't | Correct counts in validation summary |
| Global geography support | ISO country codes | Matched/stubbed with `location_type = 'country'` |
| NUTS codes (EU) | NUTS2 codes | Matched with `location_type = 'nuts2'` |

### 4.4 Import Execution & Rollback

#### Integration Tests

| Test | Scenario | Verification |
|------|----------|-------------|
| Tabular + geocode import | CSV with FIPS + values | `geography_summary` rows created with correct `import_id` |
| Tabular + coordinates import | CSV with lat/lon | `gis_point_feature` records created, PostGIS geometry correct |
| Geospatial native import | GeoJSON file | AI service converts, features loaded into PostGIS |
| Streaming large file | 100K row CSV | No OOM, progress updates via Redis polling |
| Rollback: simple tables | Delete import | `gis_point_feature` + `external_exposure` rows removed |
| Rollback: aggregate table | Delete import | `geography_summary` restored from `summary_snapshot` |
| Rollback: stubs removed | Delete import | `geographic_location` stubs with matching `import_id` removed |
| Multi-import same geography | Import A updates row, Import B updates same row, rollback B | Row restored to post-A values (from snapshot) |
| Progress tracking | Start import, poll `/status` | Progress percentage updates from 0 → 100 |

### 4.5 E2E Tests (Playwright)

| Test | User Flow | Verification |
|------|-----------|-------------|
| Import CDC SVI data | Upload SVI CSV → Abby maps FIPS + RPL_THEMES → Configure as choropleth → Import | Layer visible in GIS Explorer |
| Import hospital points | Upload hospital CSV with lat/lon → Map coordinates → Import | Points visible on map |
| Import + rollback | Import data → Verify in GIS Explorer → Rollback → Verify removed | Data appears then disappears cleanly |
| AI-assisted GeoJSON | Upload GeoJSON → Abby analyzes properties → Configure → Import | Polygons rendered on map |

---

## 5. Pathway 3: FHIR Ingestion

### 5.1 Current State Tests (Metadata Only)

| Test | Input | Expected |
|------|-------|----------|
| FHIR R4 Bundle parsing | `golden/patient-bundle.json` | Patient, Condition, Observation resources extracted |
| FHIR metadata extraction | Valid bundle | Resource counts, date ranges, patient demographics |
| Invalid FHIR bundle | `adversarial/malformed-fhir.json` | 422 with validation errors |
| Empty bundle | `adversarial/empty-bundle.json` | Handled gracefully, 0 resources reported |

### 5.2 Future: FHIR → CDM Transformation (Not Yet Implemented)

These tests should be written when the FHIR→CDM transform is built:

| Test | Input | Expected |
|------|-------|----------|
| Patient → person | FHIR Patient resource | Row in `cdm.person` with correct demographics |
| Condition → condition_occurrence | FHIR Condition resource | Row with mapped concept_id, dates |
| Observation → measurement | FHIR Observation (lab) | Row with value_as_number, unit_concept_id |
| MedicationRequest → drug_exposure | FHIR MedicationRequest | Row with drug_concept_id, quantity |

---

## 6. Pathway 4: Concept Mapping Review

Already covered in Section 3.3. Additional edge cases:

| Test | Scenario | Expected |
|------|----------|----------|
| Bulk approve | Select 50 `auto_accepted` mappings → approve all | All status = `accepted` in single transaction |
| Reject with custom concept | Reject suggestion → search concepts → select alternative | New mapping saved with `reviewer_id` |
| Audit trail | View mapping history | Shows original AI suggestion, user action, timestamp |
| Concurrent reviewers | Two reviewers approve same mapping simultaneously | One succeeds, other gets conflict error |

---

## 7. Pathway 5: Clinical NLP (Stub — Future)

| Test | Scenario | Expected |
|------|----------|----------|
| Entity extraction | Clinical note text | Named entities: conditions, medications, procedures |
| AI service integration | Note → FastAPI → Ollama | Structured JSON response with entity spans |
| Fallback when AI down | Note submitted, Ollama offline | Graceful error, note queued for retry |

---

## 8. Import-Only Pathways

### 8.1 Genomics (VCF/MAF)

| Test | Input | Expected |
|------|-------|----------|
| Valid VCF import | `golden/sample.vcf.gz` | Variants inserted into genomics tables |
| Malformed VCF | `adversarial/bad-header.vcf` | Error with line number and description |
| MAF import | `golden/mutations.maf` | Somatic variants loaded |
| Large VCF streaming | 1M+ variants | Streaming, no OOM |

### 8.2 Concept Set Import (Atlas JSON)

| Test | Input | Expected |
|------|-------|----------|
| Valid Atlas export | `{"items": [{"concept": {"CONCEPT_ID": 201826}}]}` | Concept set created with items |
| Missing concept IDs | References non-existent concepts | Warning, partial import |
| Duplicate import | Same concept set JSON twice | Updates existing, no duplicates |

### 8.3 Cohort Definition Import (Atlas JSON)

| Test | Input | Expected |
|------|-------|----------|
| Valid cohort JSON | Atlas-format cohort definition | Stored in `cohort_definitions` table |
| Invalid expression | Malformed cohort logic | 422 with validation details |
| Import with concept sets | Cohort referencing concept sets | Concept sets auto-created if missing |

### 8.4 Phenotype Library Sync

| Test | Scenario | Expected |
|------|----------|----------|
| Fresh sync | No existing phenotypes | All OHDSI phenotypes imported |
| Incremental sync | Some phenotypes exist | Only new/updated imported |
| Network failure | GitHub API unreachable | Graceful error, existing data preserved |

### 8.5 WebAPI Migration

| Test | Scenario | Expected |
|------|----------|----------|
| Import legacy sources | WebAPI database accessible | Sources + daimons created |
| Missing daimons | Source without CDM daimon | Warning, source created without daimon |
| Duplicate source names | Name collision | Suffixed with `_imported` |

### 8.6 Eunomia Demo Data

| Test | Scenario | Expected |
|------|----------|----------|
| Fresh load | `--fresh` flag | All 30 tables loaded, 2,694 patients |
| Idempotent reload | Run twice | No duplicate data |
| Vocabulary subset | After load | 444 concepts present and queryable |

---

## 9. Cross-System Integration Tests

### 9.1 Data Flow Verification

| Test | Scenario | Verification |
|------|----------|-------------|
| Ingested data in cohort builder | Import CSV → Create cohort using imported conditions | Cohort generates with correct patients |
| GIS import in Explorer | Import SVI data → Open GIS Explorer | New layer selectable and renders choropleth |
| Concept mapping in CDM write | Map concepts → Run CDM write job | `condition_occurrence.condition_concept_id` uses mapped concept |
| Imported source in Achilles | Add source → Run Achilles | Characterization results generated |

### 9.2 Concurrent Import Safety

| Test | Scenario | Verification |
|------|----------|-------------|
| Two CSV ingestions simultaneously | Upload file A and file B, import both | Both complete, no data cross-contamination |
| GIS import during CSV ingestion | Start GIS import while CDM write running | Both succeed independently |
| Rollback during active import | Rollback import A while import B running | A rolled back cleanly, B unaffected |

### 9.3 Permission & Security

| Test | Scenario | Verification |
|------|----------|-------------|
| Researcher can import GIS | User with `gis.import` permission | Upload and import succeed |
| Viewer cannot import GIS | User with only `gis.view` | 403 on upload attempt |
| Rate limiting enforced | 6 imports in 60 seconds | 6th request returns 429 |
| File content sniffing | Upload PHP file renamed to .csv | Rejected by MIME validation |
| SQL injection in column names | Column named `'; DROP TABLE users;--` | Parameterized query, no injection |
| XSS in import metadata | Layer name `<script>alert(1)</script>` | Escaped in all rendered contexts |
| Path traversal in filename | Filename `../../etc/passwd` | Sanitized, stored safely |

---

## 10. Performance & Stress Tests

| Test | Scenario | Threshold |
|------|----------|-----------|
| CSV profiling speed | 50MB CSV, 500K rows | <60 seconds |
| Concept mapping throughput | 10,000 source codes | <5 minutes with AI, <30s cached |
| GIS import large file | 100K row CSV | <2 minutes, memory <512MB |
| CDM batch write | 50,000 clinical records | <3 minutes using 1000-row batches |
| Concurrent profiling | 5 simultaneous uploads | All complete, no timeout |
| Redis progress accuracy | Import 10K rows, poll every 2s | Progress monotonically increases, reaches 100% |

---

## 11. Failure & Recovery Tests

| Test | Scenario | Verification |
|------|----------|-------------|
| AI service crash mid-import | Kill Ollama during concept mapping | Job fails gracefully, retryable |
| Database connection drop | Drop PG connection mid-CDM-write | Transaction rolled back, no partial data |
| Redis unavailable | Stop Redis during GIS import | Job fails, status queryable from DB |
| Disk full during upload | Fill temp storage | 500 with clear error, no orphaned files |
| Worker timeout | Import exceeds 30-min Horizon timeout | Job marked failed, temp file cleaned |
| Container restart during job | Restart PHP container mid-import | Job re-queued on restart (Horizon retry) |

---

## 12. Implementation Priority

### Phase 1: Unit Test Fixtures & Mocks (1-2 days)
- [ ] Create test fixture directories with golden/messy/adversarial files
- [ ] Create AI response mock fixtures for each confidence tier
- [ ] Build `FakeAbbyService` for unit testing without Ollama

### Phase 2: Structured Ingestion Tests (2-3 days)
- [ ] CSV profiler unit tests (encoding, types, PII)
- [ ] Schema mapping tests with mocked AI
- [ ] Concept mapping 5-strategy pipeline tests
- [ ] CDM write integration tests
- [ ] Post-load validation tests

### Phase 3: GIS Import Tests (1-2 days)
- [ ] File format detection tests
- [ ] Column analysis with mocked AI
- [ ] Geography matching and stub creation tests
- [ ] Import execution and rollback tests
- [ ] Streaming/OOM prevention tests

### Phase 4: Cross-System & Security (1 day)
- [ ] Data flow verification (ingested data usable in cohorts, GIS explorer)
- [ ] Permission enforcement tests
- [ ] Content sniffing, injection, and traversal tests
- [ ] Concurrent import safety tests

### Phase 5: E2E Tests (1-2 days)
- [ ] Playwright: Structured ingestion happy path
- [ ] Playwright: GIS import happy path
- [ ] Playwright: AI-down graceful degradation
- [ ] Playwright: Import + rollback cycle

### Phase 6: Performance Baselines (1 day)
- [ ] Establish timing baselines for each import pathway
- [ ] Memory profiling for large file scenarios
- [ ] Concurrent import stress test

---

## 13. Test Infrastructure Requirements

| Requirement | Purpose | Notes |
|-------------|---------|-------|
| Ollama test instance | AI integration tests | Can share dev instance, or run dedicated |
| ChromaDB test collection | Learning persistence tests | Separate collection `gis_import_mappings_test` |
| Test database | Integration tests | Dedicated `parthenon_test` DB, migrated fresh per suite |
| GIS test database | GIS integration tests | Dedicated schema in test DB |
| Test fixtures in VCS | Reproducible test data | `backend/tests/fixtures/imports/` |
| CI pipeline update | Run tests on PR | Add import test suite to `.github/workflows/ci.yml` |
| Mock server | AI service unavailability tests | Configurable response delay/failure |
