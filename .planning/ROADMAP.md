# Roadmap: Parthenon Codebase Health Fixes

## Overview

Three critical production bugs found during a full-codebase health audit. Each is an independent fix targeting a different subsystem: email delivery (config mismatch), FHIR export (missing backend), and ingestion API (response envelope unwrapping). Phases are ordered by complexity: simplest first to build momentum, largest last.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Email Delivery** - Fix RESEND_KEY env mismatch so registration and password reset emails send
- [x] **Phase 2: FHIR Export** - Make FHIR Export page functional or gracefully disabled (completed 2026-03-18)
- [x] **Phase 3: Ingestion API** - Unwrap Laravel response envelopes so ingestion pages render correctly (completed 2026-03-18)
- [x] **Phase 4: HIGH UX Fixes** - Fix broken genomics source selector, gene filter, and query history metadata (completed 2026-03-18)
- [x] **Phase 5: MEDIUM Quality Fixes** - Solr config, accessibility, error states, type safety (completed 2026-03-18)
- [x] **Phase 6: LOW Polish** - Modal consistency, dead code cleanup, empty state guidance (completed 2026-03-18)

## Phase Details

### Phase 1: Email Delivery
**Goal**: Users receive emails when they register or reset their password
**Depends on**: Nothing (first phase)
**Requirements**: EMAIL-01, EMAIL-02, EMAIL-03
**Success Criteria** (what must be TRUE):
  1. `.env` variable name matches what `config/services.php` reads via `env()` -- no config mismatch
  2. New user registration triggers a temp password email that arrives in their inbox
  3. Forgot password flow triggers a new temp password email that arrives in their inbox
**Plans**: 1 plan

Plans:
- [ ] 01-01-PLAN.md -- Fix env variable mismatch and verify email delivery end-to-end

### Phase 2: FHIR Export
**Goal**: The FHIR Export admin page works without errors
**Depends on**: Nothing (independent of Phase 1)
**Requirements**: FHIR-01, FHIR-02
**Success Criteria** (what must be TRUE):
  1. Navigating to `/admin/fhir-export` does not produce any runtime errors or blank screens
  2. The page either has working export functionality (backend endpoints respond) or displays a clear "coming soon" message explaining the feature is not yet available
**Plans**: 1 plan

Plans:
- [ ] 02-01-PLAN.md -- Replace broken FHIR Export page with coming-soon state

### Phase 3: Ingestion API
**Goal**: All ingestion pages render real data instead of broken object representations
**Depends on**: Nothing (independent of Phases 1-2)
**Requirements**: INGEST-01, INGEST-02, INGEST-03, INGEST-04
**Success Criteria** (what must be TRUE):
  1. All 18+ API functions in `ingestionApi.ts` unwrap the Laravel `{data: T}` envelope correctly
  2. Ingestion Dashboard page renders a readable job list (no `[object Object]` text)
  3. Uploading a file on the Upload page creates a job and navigates to the new job detail
  4. Job Detail page displays job status, steps, and progress accurately
**Plans**: 1 plan

Plans:
- [ ] 03-01-PLAN.md -- Add data.data ?? data envelope unwrapping to all ingestion API functions

### Phase 4: HIGH UX Fixes
**Goal**: Broken UX flows in genomics and query assistant work correctly
**Depends on**: Nothing (independent)
**Requirements**: GEN-01, GEN-02, HIST-01
**Success Criteria** (what must be TRUE):
  1. Genomic Analysis page has a source selector dropdown (not hardcoded sourceId=9)
  2. Clicking a gene in Top Mutated Genes switches to ClinVar tab AND pre-fills the gene filter
  3. Clicking a history entry in NL tab restores full metadata (explanation, tables_referenced)
**Plans**: TBD

### Phase 5: MEDIUM Quality Fixes
**Goal**: Accessibility, type safety, error handling, and infrastructure gaps resolved
**Depends on**: Nothing (independent)
**Requirements**: A11Y-01, TYPE-01, TYPE-02, INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. Dashboard clickable table rows have `role="button"`, `tabIndex={0}`, and keyboard handlers
  2. Imaging page uses type guards instead of unsafe `as` casts
  3. GIS viewport handler uses proper typing (no `as` cast)
  4. Solr `query_library` core is registered in `backend/config/solr.php`
  5. Studies stats bar renders an error message when API fails
**Plans**: TBD

### Phase 6: LOW Polish
**Goal**: Code consistency and UX polish across minor issues
**Depends on**: Nothing (independent)
**Requirements**: QUAL-01, QUAL-02, QUAL-03
**Success Criteria** (what must be TRUE):
  1. ShareCohortModal uses the shared `<Modal>` component wrapper
  2. `getErrorMessage()` is defined once in a shared utility, not duplicated
  3. Empty state pages include guidance text on how to import/seed data
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Email Delivery | 0/1 | Not started | - |
| 2. FHIR Export | 0/1 | Complete    | 2026-03-18 |
| 3. Ingestion API | 0/1 | Complete    | 2026-03-18 |
| 4. HIGH UX Fixes | 0/0 | Complete    | 2026-03-18 |
| 5. MEDIUM Quality | 0/0 | Complete    | 2026-03-18 |
| 6. LOW Polish | 0/0 | Complete    | 2026-03-18 |
