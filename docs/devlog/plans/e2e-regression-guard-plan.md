# E2E Regression Guard — Implementation Plan

**Date:** 2026-03-18
**Triggered by:** Full codebase health audit revealed issues that E2E tests would have caught
**Goal:** Every critical user flow has a Playwright test that catches regressions before they reach production

## What Exists

- `e2e/` directory with Playwright 1.58+ configuration
- `global-setup.ts` — Sanctum auth (SPA session + Bearer token)
- `smoke.spec.ts` — Route smoke tests (29 routes), API health checks
- `screenshots.spec.ts` — Full-page screenshots
- 20+ spec files covering various modules
- Page Object Model architecture planned in `E2E_TEST_PLAN.md`
- Last run: 2026-03-06 (12 days ago)

## What's Missing (from the audit)

Each of these bugs would have been caught by an E2E test:

| Bug | E2E test that would catch it |
|-----|------------------------------|
| RESEND_KEY mismatch (email fails silently) | API test: `POST /auth/register` → check 200 response |
| FHIR Export page crashes | Smoke: navigate to `/admin/fhir-export` → no errors |
| Ingestion API returns envelope | Load `/ingestion` → verify job list renders real text (not `[object Object]`) |
| Genomics hardcoded sourceId | Load `/genomics/analysis` → verify source selector dropdown exists |
| Gene buttons don't filter | Click gene → verify ClinVar search input contains gene name |
| History loses metadata | Generate query → click history → verify explanation is not empty |
| Dashboard rows not keyboard-accessible | Tab to table row → press Enter → verify navigation |

## Plan: 3 Phases

### Phase 1: Fix & Run Existing Tests (Quick Win)

**Goal:** Get existing test suite green against current production.

1. Run `npx playwright test` and capture baseline results
2. Fix any failures caused by our changes (e.g., FHIR Export now shows "coming soon" instead of the old form)
3. Add missing routes to smoke.spec.ts:
   - `/admin/fhir-export` (new coming-soon state)
   - `/admin/solr` (Solr admin)
   - `/query-assistant` (Query Library + NL tabs)
   - `/admin/user-audit` (User Audit)
   - `/phenotype-library` (Phenotype Library)
   - `/schema-mapping` (Schema Mapping)
   - `/gis` (GIS Explorer)
   - `/commons` (Commons Workspace)
4. Update `smoke.spec.ts` to check for `[object Object]` text — instant detection of unwrapping bugs

### Phase 2: Critical Flow Tests (Regression Guards)

**Goal:** One test per critical user flow that would have caught our audit findings.

New spec files:

```
e2e/tests/
  regression/
    email-config.spec.ts       — API: POST /auth/register returns 200 (not 500)
    ingestion-renders.spec.ts  — Navigate to /ingestion, verify job cards render
    fhir-export.spec.ts        — Navigate to /admin/fhir-export, verify no crash
    genomics-source.spec.ts    — Load /genomics/analysis, verify SourceSelector exists
    query-history.spec.ts      — Generate SQL → click history → verify metadata
    dashboard-a11y.spec.ts     — Tab through dashboard → verify keyboard nav works
    stats-drill.spec.ts        — Click stats bar card → verify list filters
```

Each test:
- Navigates to the page
- Checks for console errors and 5xx responses
- Verifies the specific element/behavior that was broken
- Takes a screenshot on failure

### Phase 3: Cross-Feature Journey Tests

**Goal:** Test end-to-end user workflows that span multiple pages.

```
e2e/tests/
  journeys/
    cohort-to-analysis.spec.ts     — Create cohort → run characterization → view results
    concept-to-cohort.spec.ts      — Create concept set → use in cohort → generate
    study-lifecycle.spec.ts        — Create study → add cohorts → run analysis
    data-explorer-drill.spec.ts    — Dashboard CDM card → Data Explorer → domain tab
    query-library-to-results.spec.ts — Browse library → select query → render → execute
```

## Architecture

### Page Object Models (from E2E_TEST_PLAN.md)

```
e2e/
  fixtures/
    auth.fixture.ts           # Reusable login fixture
    error-collector.fixture.ts # Console + network error collection
  pages/
    dashboard.page.ts
    ingestion.page.ts
    genomics.page.ts
    query-assistant.page.ts
    admin.page.ts
  tests/
    regression/               # Phase 2: one test per audit finding
    journeys/                 # Phase 3: cross-feature flows
```

### CI Integration

Add to `.github/workflows/ci.yml`:

```yaml
e2e:
  name: E2E Smoke Tests
  runs-on: ubuntu-latest
  needs: [build]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npx playwright install chromium
    - run: npx playwright test tests/smoke.spec.ts tests/regression/
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: e2e/test-results/
```

### Pre-Deploy Hook

Add to `deploy.sh`:

```bash
# Run quick smoke before deploy
if [ "$SKIP_E2E" != "1" ]; then
  echo "Running E2E smoke..."
  cd e2e && npx playwright test tests/smoke.spec.ts --reporter=line 2>&1 | tail -5
  if [ $? -ne 0 ]; then
    echo "E2E smoke failed — deploy aborted"
    exit 1
  fi
  cd ..
fi
```

## Success Criteria

- [ ] All 29+ existing smoke routes pass green
- [ ] 7 regression guard tests cover the audit findings
- [ ] No `[object Object]` text detected on any page
- [ ] CI pipeline runs E2E on every push
- [ ] Zero-error navigation for all admin pages
- [ ] Cross-feature journeys pass for cohort and query workflows

## Estimated Effort

| Phase | Tests | Effort |
|-------|-------|--------|
| 1: Fix & run existing | ~30 smoke tests | 30 min |
| 2: Regression guards | 7 new spec files | 1-2 hours |
| 3: Journey tests | 5 new spec files | 2-3 hours |

**Total:** Half a day to go from "no regression coverage" to "every audit finding has a guard test"
