# Comprehensive Import Test Suite — Devlog

**Date:** 2026-03-13
**Branch:** `feature/fhir-omop-ig-compliance`
**Commits:** 9 (from `d8749bf6` to `b133b1bd`)

---

## What Was Built

A comprehensive test suite covering all data import pathways across the Parthenon application. The test plan followed the pattern: "upload messy data → Abby AI assists in conversion → mission-critical import." Tests span the PHP backend (Pest) and Python AI service (pytest).

### Test Inventory

| Test File | Tests | Assertions | Focus |
|-----------|-------|------------|-------|
| `GisImportTest.php` | 24 (19 new) | ~70 | File parsing, encoding detection, geo code detection, column stats |
| `IngestionPipelineTest.php` | 19 | 150 | CsvProfiler, type inference, PII detection, edge cases |
| `GisImportApiTest.php` | 20 | 55 | API endpoints, auth, permissions, upload validation, workflow |
| `IngestionApiTest.php` | 37 | 129 | Full ingestion pipeline: upload, profile, schema mapping, concept review, validation |
| `ImportSecurityTest.php` | 17 | 35 | Content sniffing, injection, traversal, permission matrix, rate limiting |
| `test_gis_import.py` | 9 | — | GIS analyzer endpoints, ChromaDB learning, Ollama graceful degradation |
| `test_schema_mapping.py` | 10 | — | Regex fallback, confidence scoring, CDM target mapping |
| **Total** | **136** | **447+** | |

### Test Fixture Library

Created `backend/tests/fixtures/imports/` with 22 curated test data files:

- **Golden (5):** county-svi.csv, hospitals.csv, clinical-data.csv, boundaries.geojson, iso-countries.csv
- **Messy (6):** bom-utf8.csv (actual BOM bytes), latin1-fips.csv (ISO-8859-1 encoded), mixed-types.csv, duplicate-headers.csv, quoted-commas.csv, mixed-line-endings.csv (CR/LF/CRLF)
- **Adversarial (5):** empty.csv (0 bytes), headers-only.csv, binary-as-csv.csv (binary data), no-geo.csv, injection-headers.csv (SQL injection + XSS in headers)
- **AI Responses (6):** Mock responses at high/medium/low confidence tiers, schema mapping, concept mapping, and AI-unavailable fallback

### Coverage Areas

**GIS Import (Tasks 2, 4):**
- File format parsing: CSV, TSV, UTF-8 BOM, Latin-1 encoding, quoted fields, mixed line endings
- Geography detection: FIPS county/tract/state, ISO country 2/3-letter, NUTS, empty/null handling
- Column statistics: numeric threshold (80%), all-null columns, single-row datasets
- API: Upload validation (50MB, MIME), auth/permissions, ownership, workflow guards, history pagination

**Structured Data Ingestion (Tasks 3, 5):**
- CsvProfiler: Type inference (integer, float, string, date), PII detection (SSN, email, phone patterns + column name heuristics), column statistics
- API: Full pipeline from upload through profile, schema mapping suggest/confirm, concept mapping review (approve/reject/remap), batch review, validation checks
- Isolation: Users can only see their own jobs

**Python AI Service (Task 6):**
- GIS Import: Column analysis with mocked Ollama, confidence range validation, ChromaDB learn/upsert, GeoJSON passthrough, graceful degradation when AI down
- Schema Mapping: Known CDM columns map correctly, regex patterns work without AI, drug/procedure/observation columns detected

**Cross-System Security (Task 7):**
- Content: Binary files rejected, PHP-as-CSV rejected, 50MB limit enforced, injection headers treated as strings
- Input: Path traversal sanitized, XSS in layer names stored safely, SQL injection parameterized, null bytes stripped
- Permissions: Full matrix across super-admin, admin, researcher, data-steward, mapping-reviewer, viewer roles
- Rate limiting: 5 requests/60s per user enforced, independent per-user counters

## Bug Found & Fixed

**UTF-8 BOM not stripped in GisImportService:** Both `previewCsv()` and `iterateFile()` were not handling the 3-byte BOM prefix (0xEF 0xBB 0xBF) that some editors/Excel add to CSV files. The BOM was appearing as part of the first column header, causing column mapping failures. Fixed by detecting and stripping BOM bytes from the first header value.

## Key Decisions

1. **Test isolation via RefreshDatabase:** All API integration tests use `RefreshDatabase` trait with `RolePermissionSeeder` seeded in setUp. No shared state between tests.
2. **Service mocking strategy:** External dependencies (Ollama, ChromaDB, Redis, file system) are mocked. Services that do pure computation (CsvProfiler, GisImportService for parsing) are tested against real fixture files.
3. **Rate limit testing:** Throttle middleware disabled for non-rate-limit tests, enabled explicitly for the 2 rate limit tests to avoid interference.
4. **No E2E tests yet:** Playwright E2E tests (Phase 5 of the test plan) deferred — requires running services. Current tests cover unit + integration layers thoroughly.

## Files Created

### Test Fixtures (22 files)
- `backend/tests/fixtures/imports/golden/{county-svi,hospitals,clinical-data,iso-countries}.csv`
- `backend/tests/fixtures/imports/golden/boundaries.geojson`
- `backend/tests/fixtures/imports/messy/{bom-utf8,latin1-fips,mixed-types,duplicate-headers,quoted-commas,mixed-line-endings}.csv`
- `backend/tests/fixtures/imports/adversarial/{empty,headers-only,binary-as-csv,no-geo,injection-headers}.csv`
- `backend/tests/fixtures/imports/ai-responses/{gis-high-confidence,gis-medium-confidence,gis-low-confidence,ingestion-schema-mapping,concept-mapping-results,ai-unavailable-fallback}.json`

### Test Files (7 files)
- `backend/tests/Feature/GisImportTest.php` (expanded)
- `backend/tests/Feature/IngestionPipelineTest.php` (new)
- `backend/tests/Feature/GisImportApiTest.php` (new)
- `backend/tests/Feature/IngestionApiTest.php` (new)
- `backend/tests/Feature/ImportSecurityTest.php` (new)
- `ai/tests/test_gis_import.py` (new)
- `ai/tests/test_schema_mapping.py` (new)

### Modified
- `backend/app/Services/GIS/GisImportService.php` — BOM stripping fix

### Documentation
- `docs/superpowers/specs/2026-03-12-comprehensive-import-test-plan.md` — Full test plan specification
