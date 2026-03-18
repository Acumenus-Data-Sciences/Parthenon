# Requirements: Parthenon Codebase Health Fixes

**Defined:** 2026-03-18
**Core Value:** All production-facing features must actually work

## v1 Requirements

### Email Delivery

- [ ] **EMAIL-01**: RESEND_KEY environment variable in `.env` matches what Laravel's `config/services.php` reads via `env('RESEND_KEY')`
- [ ] **EMAIL-02**: Registration flow successfully sends temp password email via Resend
- [ ] **EMAIL-03**: Forgot password flow successfully sends new temp password email via Resend

### FHIR Export

- [ ] **FHIR-01**: FHIR Export page at `/admin/fhir-export` either has working backend endpoints (`POST /fhir/$export`, `GET /fhir/$export/{id}`) or is disabled with a clear "coming soon" message
- [ ] **FHIR-02**: No runtime errors when navigating to `/admin/fhir-export`

### Ingestion API

- [ ] **INGEST-01**: All API functions in `ingestionApi.ts` correctly unwrap Laravel's `{data: T}` response envelope using `data.data ?? data` pattern
- [ ] **INGEST-02**: Ingestion Dashboard page renders job list correctly (not `[object Object]`)
- [ ] **INGEST-03**: Upload page correctly receives and navigates to new job after file upload
- [ ] **INGEST-04**: Job Detail page correctly displays job status, steps, and progress

## v2 Requirements

### Genomics UX

- **GEN-01**: Genomic Analysis page allows user to select data source (replace hardcoded sourceId=9)
- **GEN-02**: Top Mutated Genes buttons filter ClinVar search when clicked

### Query History

- **HIST-01**: Clicking a history entry in Natural Language tab restores full metadata (explanation, tables_referenced)

### Accessibility & Type Safety

- **A11Y-01**: Dashboard table rows have proper `role="button"` and keyboard handlers
- **TYPE-01**: Imaging page uses type guards instead of unsafe `as` casts
- **TYPE-02**: GIS viewport handler uses proper typing

### Infrastructure

- **INFRA-01**: Solr `query_library` core registered in `backend/config/solr.php`
- **INFRA-02**: Studies stats bar renders error state on API failure

### Code Quality

- **QUAL-01**: ShareCohortModal uses `<Modal>` component for consistency
- **QUAL-02**: Deduplicate `getErrorMessage()` across text-to-sql components
- **QUAL-03**: Empty state pages show guidance on importing seed data

## Out of Scope

| Feature | Reason |
|---------|--------|
| New features or UI redesigns | This is a bugfix-only project |
| Stash@{0} Abby agency framework | Separate decision, not a bug |
| Refactoring working code | If it ain't broke, don't fix it |
| E2E test suite creation | Separate follow-up project |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EMAIL-01 | Phase 1 | Pending |
| EMAIL-02 | Phase 1 | Pending |
| EMAIL-03 | Phase 1 | Pending |
| FHIR-01 | Phase 2 | Pending |
| FHIR-02 | Phase 2 | Pending |
| INGEST-01 | Phase 3 | Pending |
| INGEST-02 | Phase 3 | Pending |
| INGEST-03 | Phase 3 | Pending |
| INGEST-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after initial definition*
