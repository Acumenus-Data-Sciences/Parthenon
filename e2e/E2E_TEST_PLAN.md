# Parthenon E2E Test Plan

**Target:** `https://parthenon.acumenus.net`
**Framework:** Playwright 1.58+
**Last Updated:** 2026-03-07

---

## Current State

### What exists:
- `smoke.spec.ts` — Route smoke tests (29 routes), API health checks, auth guard, navigation
- `studies.spec.ts` / `studies-local.spec.ts` — Studies list + detail + 9 tab click tests
- `screenshots.spec.ts` — Full-page screenshots of all routes
- `login-debug.spec.ts` — Auth debugging utility
- `global-setup.ts` — Sanctum login (SPA session + Bearer token), saves storageState

### What's missing:
- No CRUD workflow tests (create, edit, delete)
- No feature-specific interaction tests (search, filter, sort, pagination)
- No cross-feature journey tests (cohort -> analysis -> study)
- No RBAC tests (admin vs regular user)
- No error/edge-case tests
- No performance baseline tests
- Duplicate helper code across spec files (collectErrors, getToken, BASE)

---

## Architecture Improvements

### 1. Shared Fixtures & Helpers

```
e2e/
  fixtures/
    auth.fixture.ts       # login as admin, login as regular user
    api.fixture.ts         # authenticated API client helper
    error-collector.ts     # reusable console/network error collector
  pages/                   # Page Object Models
    login.page.ts
    dashboard.page.ts
    sidebar.page.ts
    data-sources.page.ts
    vocabulary.page.ts
    cohort-definitions.page.ts
    concept-sets.page.ts
    analyses.page.ts
    studies.page.ts
    profiles.page.ts
    genomics.page.ts
    imaging.page.ts
    heor.page.ts
    admin.page.ts
  tests/
    tier-1/               # Critical path — run on every deploy
    tier-2/               # Feature coverage — run nightly
    tier-3/               # Edge cases & RBAC — run weekly
  playwright-prod.config.ts
  global-setup.ts
```

### 2. Page Object Model (POM)

Each POM encapsulates selectors and common actions for a feature, reducing test brittleness.

### 3. Config Updates

```ts
// playwright-prod.config.ts
{
  baseURL: "https://parthenon.acumenus.net",
  timeout: 60_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }], ["json", { outputFile: "results-prod.json" }]],
  projects: [
    { name: "setup", testMatch: /global-setup/ },
    { name: "tier-1", testDir: "./tests/tier-1", dependencies: ["setup"] },
    { name: "tier-2", testDir: "./tests/tier-2", dependencies: ["setup"] },
    { name: "tier-3", testDir: "./tests/tier-3", dependencies: ["setup"] },
  ],
}
```

---

## Test Tiers

### Tier 1: Critical Path (run on every deploy)

These tests cover the minimum viable user journey. If any fail, the deploy is broken.

| # | Test File | Description | Priority |
|---|-----------|-------------|----------|
| 1.1 | `auth.spec.ts` | Login, logout, unauthenticated redirect, CSRF cookie | P0 |
| 1.2 | `dashboard.spec.ts` | Dashboard loads, metric cards render, no crashes | P0 |
| 1.3 | `route-smoke.spec.ts` | All 29+ routes load without error boundary or 5xx (existing, refactored) | P0 |
| 1.4 | `api-health.spec.ts` | Key API endpoints return 200 (existing, refactored) | P0 |
| 1.5 | `navigation.spec.ts` | Sidebar links navigate correctly, active state highlights | P0 |

### Tier 2: Feature Coverage (run nightly)

Each test file covers one feature module's primary workflows.

| # | Test File | Scenarios | Priority |
|---|-----------|-----------|----------|
| 2.1 | `data-sources.spec.ts` | List sources, verify source card details, source selector works | P1 |
| 2.2 | `data-explorer.spec.ts` | Source dropdown, overview tab renders charts, domain tabs (Condition, Drug, etc.) load | P1 |
| 2.3 | `vocabulary-search.spec.ts` | Search by keyword, filter by domain/class/vocabulary, click concept detail, concept compare page | P1 |
| 2.4 | `cohort-definitions.spec.ts` | List/search/filter cohorts, open detail, view cohort expression, generate count (if source available) | P1 |
| 2.5 | `concept-sets.spec.ts` | List concept sets, open detail, view included concepts table | P1 |
| 2.6 | `analyses.spec.ts` | Stats bar renders 8 metrics, 7 analysis type tabs, open a characterization/IR detail | P1 |
| 2.7 | `studies-crud.spec.ts` | Create study, edit metadata, navigate all 9 tabs, delete study | P1 |
| 2.8 | `patient-profiles.spec.ts` | Search by person ID, timeline renders, condition/drug/measurement sections load | P1 |
| 2.9 | `genomics.spec.ts` | Genomics dashboard loads, analysis page renders, tumor board loads | P2 |
| 2.10 | `imaging.spec.ts` | Imaging list loads, study detail page renders (OHIF viewer status guard) | P2 |
| 2.11 | `heor.spec.ts` | HEOR dashboard loads, analysis detail page renders | P2 |
| 2.12 | `care-gaps.spec.ts` | Care gaps list loads, bundle detail page renders | P2 |
| 2.13 | `ingestion.spec.ts` | Ingestion dashboard loads, upload page renders form | P2 |
| 2.14 | `jobs.spec.ts` | Jobs page loads, job list renders (if any exist) | P2 |

### Tier 3: Admin, RBAC & Edge Cases (run weekly)

| # | Test File | Scenarios | Priority |
|---|-----------|-----------|----------|
| 3.1 | `admin-dashboard.spec.ts` | Admin dashboard loads, service cards render | P2 |
| 3.2 | `admin-users.spec.ts` | Users list, role assignment display | P2 |
| 3.3 | `admin-system-health.spec.ts` | Health cards for all services, service detail pages | P2 |
| 3.4 | `admin-ai-providers.spec.ts` | Provider list, active provider indicator | P2 |
| 3.5 | `admin-fhir.spec.ts` | FHIR connections page, sync monitor | P3 |
| 3.6 | `admin-solr.spec.ts` | Solr admin page loads | P3 |
| 3.7 | `shared-cohort.spec.ts` | Public `/shared/:token` link renders cohort (no auth) | P3 |
| 3.8 | `help-system.spec.ts` | Help button opens slide-over, content loads per route | P3 |
| 3.9 | `error-handling.spec.ts` | 404 page, invalid route, expired session redirect | P3 |

---

## Detailed Test Scenarios

### 1.1 auth.spec.ts

```
- Login page renders email + password fields
- Successful login redirects to dashboard
- Invalid credentials shows error message
- Unauthenticated access to / redirects to /login
- /register page renders registration form
- CSRF cookie endpoint returns 204
- Logout clears session (if logout button exists)
```

### 1.2 dashboard.spec.ts

```
- Dashboard renders without error boundary
- Sidebar is visible with expected nav items
- Dashboard has meaningful content (>50 chars)
- No 5xx API errors on load
- No uncaught JS errors (pageerror)
```

### 2.2 data-explorer.spec.ts

```
- Source dropdown renders available sources
- Selecting a source loads overview tab
- Overview tab shows summary cards (total persons, etc.)
- Domain tabs are clickable (Condition, Drug, Measurement, Procedure, etc.)
- Each domain tab renders without crash
- Charts render (canvas/svg elements present)
```

### 2.3 vocabulary-search.spec.ts

```
- Search input is visible
- Typing "diabetes" returns results
- Results table has columns: ID, Name, Domain, Class, Vocabulary
- Clicking a concept row opens detail view
- Domain filter dropdown filters results
- Compare page loads with concept selector
```

### 2.4 cohort-definitions.spec.ts

```
- Cohort list page loads with table
- Search/filter by name works
- Tag filter works (if tags exist)
- Clicking a cohort navigates to detail page
- Detail page shows expression builder or JSON view
- "Generate" button is present (don't click — would trigger real computation)
```

### 2.6 analyses.spec.ts

```
- AnalysisStatsBar renders 8 metrics with counts
- All 7 type tabs render: Characterizations, Incidence Rates, Pathways,
  Estimations, Predictions, SCCS, Evidence Synthesis
- Clicking a tab filters the table
- Opening a detail page renders without crash
- SCCS detail page handles missing studyPopulation gracefully (regression test for naivePeriod bug)
```

### 2.7 studies-crud.spec.ts

```
- Studies list page loads
- "Create Study" button navigates to /studies/create
- Fill study form (title, description, type)
- Submit creates study and redirects to detail page
- All 9 tabs load without crash: Overview, Design, Analyses, Results, Sites, Team, Cohorts, Milestones, Artifacts, Activity
- Edit study metadata (if edit button exists)
- Delete study (with confirmation dialog)
```

### 2.8 patient-profiles.spec.ts

```
- Profiles page loads with search input
- Entering person ID (e.g., 1005788) loads patient profile
- Timeline section renders
- Demographics card shows data
- Condition, Drug, Measurement sections render
- Precision Medicine panel renders (if genomic data exists)
```

---

## Regression Tests (from known bugs)

| Bug | Test | File |
|-----|------|------|
| SCCS naivePeriod crash | Open SCCS detail page, verify no TypeError on missing studyPopulation | `analyses.spec.ts` |
| OHIF iframe viewport sizing | Open imaging study, verify iframe renders without layout overflow | `imaging.spec.ts` |
| Login redirect loop | Login, verify stays on dashboard (not redirected back to /login) | `auth.spec.ts` |

---

## Implementation Order

### Phase 1 (immediate): Refactor + Tier 1
1. Create `fixtures/` with shared auth fixture, API helper, error collector
2. Create POMs for Login, Dashboard, Sidebar
3. Refactor existing `smoke.spec.ts` into `tier-1/route-smoke.spec.ts`
4. Write `tier-1/auth.spec.ts` and `tier-1/dashboard.spec.ts`
5. Write `tier-1/navigation.spec.ts`
6. Verify all Tier 1 tests pass against `parthenon.acumenus.net`

### Phase 2 (next session): Tier 2 core features
7. Create POMs for Vocabulary, CohortDefinitions, ConceptSets, Analyses, Studies
8. Write Tier 2 tests 2.1-2.8 (data-heavy features)
9. Write studies CRUD test (create/edit/delete cycle)

### Phase 3 (follow-up): Tier 2 remaining + Tier 3
10. Write Tier 2 tests 2.9-2.14 (genomics, imaging, HEOR, etc.)
11. Write Tier 3 admin and edge-case tests
12. Add regression tests for known bugs
13. Integrate into CI/CD (optional: `./deploy.sh --e2e`)

---

## Running Tests

```bash
# All tests against production
cd e2e
PLAYWRIGHT_BASE_URL=https://parthenon.acumenus.net \
PLAYWRIGHT_PASSWORD=<password> \
npx playwright test --config=playwright-prod.config.ts

# Tier 1 only (deploy gate)
npx playwright test --config=playwright-prod.config.ts --project=tier-1

# Tier 2 only (nightly)
npx playwright test --config=playwright-prod.config.ts --project=tier-2

# With headed browser (debugging)
npx playwright test --config=playwright-prod.config.ts --headed

# Single test file
npx playwright test --config=playwright-prod.config.ts tests/tier-1/auth.spec.ts
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PLAYWRIGHT_BASE_URL` | `https://parthenon.acumenus.net` | Target URL |
| `PLAYWRIGHT_EMAIL` | `admin@parthenon.local` | Login email |
| `PLAYWRIGHT_PASSWORD` | `superuser` | Login password |

---

## Success Criteria

- Tier 1: 100% pass rate on every deploy
- Tier 2: 95%+ pass rate nightly (data-dependent tests may skip)
- Tier 3: 90%+ pass rate weekly
- All tests complete within 5 minutes (Tier 1 < 90s)
- Zero false positives from flaky selectors (POMs handle timing)
