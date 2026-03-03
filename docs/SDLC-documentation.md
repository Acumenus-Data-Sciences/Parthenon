# Parthenon SDLC — Documentation & Testing Playbook

**Purpose:** This playbook defines the exact steps to execute the Phase 8 (Testing) and Phase 9 (Documentation) obligations whenever a new feature phase ships — specifically targeting Phases 15 (Genomics), 16 (Medical Imaging), and 17 (HEOR), but applicable to any future phase.

Execute every section in order. Nothing ships without all gates passing.

---

## Overview: The Phase 8/9 Loop

Every feature phase produces:
1. New Laravel controllers and services (backend)
2. New React pages and components (frontend)
3. New Python AI endpoints (optional)
4. New R Plumber routes (optional)

Phase 8 applies quality gates to each of these. Phase 9 then surfaces them to users through API docs, the Docusaurus manual, in-app help, and the changelog.

```
New Phase Ships
      │
      ▼
┌──────────────────────────────────────────────┐
│  PHASE 8 — QUALITY GATES                    │
│  8A. Static analysis (PHPStan + Pint)        │
│  8B. Backend tests (Pest)                    │
│  8C. Frontend types + lint + tests (Vitest)  │
│  8D. Python types + tests (mypy + pytest)    │
│  8E. CI pipeline green                       │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│  PHASE 9 — DOCUMENTATION                    │
│  9A. API grouping + OpenAPI regeneration     │
│  9B. Docusaurus user manual chapters         │
│  9C. In-app help JSON files                  │
│  9D. HelpButton wiring                       │
│  9E. Changelog entry                         │
│  9F. Migration / upgrade notes               │
└──────────────────────────────────────────────┘
```

---

## Phase 8: Quality Gates

### 8A. Static Analysis

#### PHP (every new controller, service, job, model)

```bash
cd backend

# 1. Style — auto-fix first, then verify
./vendor/bin/pint app/Http/Controllers/Api/V1/{NewFeature}Controller.php
./vendor/bin/pint app/Services/{NewFeature}/
./vendor/bin/pint app/Jobs/{NewFeature}/
./vendor/bin/pint --test   # must exit 0

# 2. Types — full suite must stay clean against baseline
./vendor/bin/phpstan analyse
# If new legitimate errors arise from new code, add to baseline:
./vendor/bin/phpstan analyse --generate-baseline phpstan-baseline.neon
```

**Rules:**
- Never suppress a new PHPStan error without a `// @phpstan-ignore-next-line` comment explaining why.
- `file_get_contents()` return values must be cast with `(string)` before use (PHP returns `string|false`).
- `preg_match()` capture groups must be validated non-empty before use.
- Typed class properties must not redeclare untyped trait properties (PHP 8.4 FatalError — fixed in ingestion jobs §9.10, don't repeat).

#### TypeScript (every new component, page, hook, API function)

```bash
cd frontend
npx tsc --noEmit   # must exit 0
npm run lint       # ESLint must exit 0
```

**Rules:**
- All API response types must have corresponding interfaces in `src/types/`.
- `useQuery` stale times must be appropriate: `staleTime: Infinity` for static content (help, changelog, catalogue endpoints), `staleTime: 30_000` for frequently changing data.
- Never use `any` — use `unknown` and narrow with type guards.

#### Python (every new AI router or service)

```bash
cd ai
mypy app/        # must exit 0
```

---

### 8B. Backend Tests (Pest)

For each new feature, add tests in these three layers:

#### 8B.1 Feature Tests (HTTP)

Location: `backend/tests/Feature/Api/V1/{NewFeature}Test.php`

Minimum test set per new controller:

```php
// 1. Unauthenticated access returns 401
it('requires authentication', function () {
    $this->getJson('/api/v1/{new-endpoint}')->assertStatus(401);
});

// 2. Authenticated user can list/index
it('returns paginated results', function () {
    $user = User::factory()->create();
    // seed 3 records using factory
    $this->actingAs($user)
         ->getJson('/api/v1/{new-endpoint}')
         ->assertOk()
         ->assertJsonStructure(['data', 'total', 'current_page']);
});

// 3. Store validates required fields
it('validates required fields on store', function () {
    $user = User::factory()->create();
    $this->actingAs($user)
         ->postJson('/api/v1/{new-endpoint}', [])
         ->assertStatus(422)
         ->assertJsonValidationErrors([...]);
});

// 4. Store creates correctly
it('creates a new record', function () {
    $user = User::factory()->create();
    $this->actingAs($user)
         ->postJson('/api/v1/{new-endpoint}', $validPayload)
         ->assertCreated()
         ->assertJsonPath('data.name', $validPayload['name']);
});

// 5. Update/destroy work correctly
// 6. Role-gated endpoints deny unauthorized roles
// 7. Job dispatch returns 202 + job_id
```

#### 8B.2 Unit Tests (Services)

Location: `backend/tests/Unit/Services/{NewFeature}/`

Cover pure business logic in isolation. Use fakes/stubs for external dependencies (R sidecar, Python AI service). Assert:
- Correct domain objects returned from service methods
- Edge cases (empty input, null CDM data)
- Exception types thrown for invalid states

#### 8B.3 Model Factories

For every new Eloquent model, add a factory in `database/factories/`:

```php
// database/factories/{NewFeature}Factory.php
class {NewFeature}Factory extends Factory
{
    public function definition(): array
    {
        return [
            'name'       => $this->faker->sentence(3),
            'user_id'    => User::factory(),
            'status'     => 'draft',
            // ...
        ];
    }
}
```

Factories must support all meaningful states:
```php
->pending()  ->running()  ->completed()  ->failed()
```

#### 8B.4 Running Tests

```bash
cd backend
php artisan test --parallel   # all tests
php artisan test tests/Feature/Api/V1/{NewFeature}Test.php  # specific
php artisan test --filter "creates a new"   # by description
```

**Coverage target:** 80% overall; 90% on new service classes.

---

### 8C. Frontend Tests (Vitest)

Location: `frontend/src/features/{new-feature}/__tests__/`

Minimum per new feature:

```typescript
// Component render test
it('renders without crashing', () => {
  render(<NewFeaturePage />);
  expect(screen.getByRole('heading')).toBeInTheDocument();
});

// API hook test (mock axios)
it('fetches and displays records', async () => {
  server.use(
    http.get('/api/v1/new-endpoint', () =>
      HttpResponse.json({ data: [mockRecord], total: 1 })
    )
  );
  render(<NewFeaturePage />);
  expect(await screen.findByText(mockRecord.name)).toBeInTheDocument();
});

// Empty state test
it('shows empty state when no records', async () => { ... });

// Error state test
it('shows error message on API failure', async () => { ... });
```

```bash
cd frontend
npx vitest run                         # all tests
npx vitest run src/features/{name}/    # specific feature
```

---

### 8D. Python Tests (pytest)

Location: `ai/tests/`

For every new router endpoint:

```python
def test_new_endpoint_returns_expected_schema(client):
    response = client.post("/new-endpoint", json={...})
    assert response.status_code == 200
    assert "key" in response.json()

def test_new_endpoint_validates_input(client):
    response = client.post("/new-endpoint", json={})
    assert response.status_code == 422
```

```bash
cd ai
pytest tests/ -v
```

---

### 8E. CI Pipeline

After all local checks pass, push to a feature branch. The CI pipeline must go **fully green** before merge to `main`:

| Job | Must Pass |
|-----|-----------|
| `backend` | PHPStan + Pint + Pest |
| `frontend` | TSC + ESLint + Vitest + Build |
| `ai` | mypy + pytest |
| `docs-build` | Docusaurus build |
| `openapi-export` | Scramble export + TypeScript compile |
| `docker` | All 4 image builds |

---

## Phase 9: Documentation

### 9A. API Grouping + OpenAPI Regeneration

Every new controller must have a `#[Group]` attribute before the class declaration.

#### Step 1 — Assign a group to each new controller

```php
use Dedoc\Scramble\Attributes\Group;

// Phase 15 — Genomics
#[Group('Genomics', weight: 110)]
class GenomicVariantController extends Controller { ... }

#[Group('Genomics', weight: 110)]
class GenomicCohortController extends Controller { ... }

// Phase 16 — Imaging
#[Group('Medical Imaging', weight: 120)]
class DicomStudyController extends Controller { ... }

// Phase 17 — HEOR
#[Group('Health Economics', weight: 130)]
class CareGapEconomicsController extends Controller { ... }
```

**Weight numbering convention:**

| Weight range | Domain |
|---|---|
| 10–20 | Auth & User |
| 30–50 | Core research (cohorts, concepts, vocabulary) |
| 60–80 | Analyses (characterization, IR, pathways, estimation, prediction) |
| 85–90 | Data & Ingestion |
| 95 | Help & Changelog |
| 100–109 | Phase 14 (HADES) |
| 110–119 | Phase 15 (Genomics) |
| 120–129 | Phase 16 (Imaging) |
| 130–139 | Phase 17 (HEOR) |

#### Step 2 — Export and regenerate

```bash
# Regenerate OpenAPI spec
docker compose exec php php artisan scramble:export
# → backend/api.json (gitignored; regenerated in CI)

# Regenerate TypeScript types
docker compose exec node sh -c "cd /app && npm run generate:api-types"
# → frontend/src/types/api.generated.ts (gitignored)

# Or use the deploy flag:
./deploy.sh --openapi
```

#### Step 3 — Verify

```bash
# Count new paths
python3 -c "
import json
with open('backend/api.json') as f: spec = json.load(f)
print(f'Total paths: {len(spec[\"paths\"])}')
tags = {op.get(\"tags\",[\"\"])[0] for p in spec[\"paths\"].values() for op in p.values() if isinstance(op, dict)}
print(f'Groups: {sorted(tags)}')
"
```

New groups from the phase must appear. If a controller is missing its group, it will appear in the ungrouped `default` tag — check the Scramble UI at `/docs/api`.

---

### 9B. Docusaurus User Manual

New phases add new chapters to the Docusaurus site at `docs/site/`.

#### Step 1 — Determine chapter numbers and parts

Following the existing convention:

| Existing parts | Chapters |
|---|---|
| Part 1 — Getting Started | 01–02 |
| Part 2 — Vocabulary | 03–04 |
| Part 3 — Cohorts | 05–08 |
| Part 4 — Analyses | 09–14 |
| Part 5 — Ingestion | 15–17 |
| Part 6 — Data Explorer | 18–20 |
| Part 7 — Patient Profiles | 21 |
| Part 8 — Administration | 22–26 |
| Appendices | A–G |

New phases append new parts:

| Phase | Part | Suggested chapters |
|---|---|---|
| Phase 15 — Genomics | Part 9 | 27–30 (Genomic Data, Variant Analysis, Cohort Builder Extensions, Tumor Board) |
| Phase 16 — Imaging | Part 10 | 31–34 (DICOM Sources, OHIF Viewer, Imaging Cohorts, Radiomic Features) |
| Phase 17 — HEOR | Part 11 | 35–38 (Care Gap Economics, Cost Analysis, ROI Modeling, Value-Based Contracts) |

#### Step 2 — Create chapter MDX files

```
docs/site/docs/part9-genomics/
  27-genomic-data-sources.mdx
  28-variant-analysis.mdx
  29-genomic-cohort-builder.mdx
  30-molecular-tumor-board.mdx
```

**Chapter template:**

```mdx
---
sidebar_position: 1
title: Genomic Data Sources
---

# Genomic Data Sources

One or two sentences establishing what this chapter covers and why it matters in the OMOP context.

## Overview

3–5 paragraphs covering: what it does, what OMOP extension tables it touches,
how it relates to existing Parthenon workflows.

## Prerequisites

- Bullet list of what must be configured first
- Any required vocabularies, extensions, or roles

## Step-by-Step Workflow

1. Numbered steps
2. Each with clear action + expected outcome

## Key Concepts

| Term | Definition |
|------|-----------|
| VCF | Variant Call Format — ... |
| HGVS | Human Genome Variation Society notation — ... |

## Mermaid Diagram (optional, for complex workflows)

```mermaid
sequenceDiagram
  ...
```

:::tip
Key tip or best practice.
:::

:::note Under Development
Mark any features not yet implemented.
:::

## Related Sections

- [Cohort Builder](../part3-cohorts/06-building-cohorts) — for genomic criteria in cohort definitions
- [Data Explorer](../part6-data-explorer/18-characterization-achilles) — for variant frequency analysis
```

#### Step 3 — Update `sidebars.ts`

```typescript
// docs/site/sidebars.ts
{
  type: 'category',
  label: 'Part 9 — Genomics',
  items: [
    'part9-genomics/27-genomic-data-sources',
    'part9-genomics/28-variant-analysis',
    'part9-genomics/29-genomic-cohort-builder',
    'part9-genomics/30-molecular-tumor-board',
  ],
},
```

#### Step 4 — Add Mermaid diagrams for key workflows

Every complex async workflow (job dispatch → queue → result) should have a `sequenceDiagram` in the relevant chapter. Every architectural overview should have a `graph LR` or `flowchart LR`.

#### Step 5 — Build and verify

```bash
cd docs/site
npm run build
# → [SUCCESS] Generated static files in "build"
# Spot-check that new chapters appear in sidebar
```

---

### 9C. In-App Help JSON Files

For every new page or major UI section, create a corresponding help JSON file.

#### File naming convention

```
backend/resources/help/
  {feature}.json                     # Main page
  {feature}.{sub-feature}.json       # Sub-panel or modal
```

**Phase 15 examples:**
```
genomics.json
genomics.variant-analysis.json
genomics.cohort-builder.json
genomics.tumor-board.json
```

**Phase 16 examples:**
```
imaging.json
imaging.dicom-sources.json
imaging.ohif-viewer.json
imaging.radiomic-features.json
```

**Phase 17 examples:**
```
heor.json
heor.cost-analysis.json
heor.roi-modeling.json
heor.value-contracts.json
```

#### Template for each JSON file

```json
{
  "key": "genomics.variant-analysis",
  "title": "Variant Analysis",
  "description": "The Variant Analysis module enables population-level queries across genomic variants stored in the OMOP MEASUREMENT table using the OMOP Genomic Vocabulary (HGVS, ClinVar, COSMIC). Build cohorts stratified by gene, variant type, TMB, or MSI status, and correlate variant presence with clinical outcomes, treatment response, or survival.",
  "docs_url": "/docs/part9-genomics/28-variant-analysis",
  "video_url": null,
  "tips": [
    "Use the Gene filter before searching for variants to reduce result set size — searching all variants without a gene filter can return thousands of results.",
    "TMB and MSI status are stored as MEASUREMENT records with specific LOINC concept IDs — use the concept picker to add them as cohort inclusion criteria.",
    "The OMOP Genomic Vocabulary uses HGVS notation (e.g., NM_007294.4:c.5266dupC). Search by gene symbol or HGVS string; ClinVar IDs are also indexed.",
    "Variant-outcome associations require at least 5 patients per variant cell (minimum cell count) to prevent de-identification risk.",
    "Export variant frequency tables as CSV for downstream analysis in R packages (CohortMethod, PLP) or PLINK."
  ]
}
```

**Checklist for each entry:**
- [ ] `key` matches file name (without `.json`)
- [ ] `description` is 2–3 sentences: what it does, what OMOP tables it touches, when to use it
- [ ] `docs_url` points to the correct Docusaurus chapter path
- [ ] `tips` contains 4–6 items; each actionable, not generic ("use filters" → specific filter name)
- [ ] `video_url` is `null` unless a video was recorded

---

### 9D. HelpButton Wiring

For every new list/landing page (not detail pages), add `HelpButton` to the page header.

#### Pattern

```typescript
// At top of new page file
import { HelpButton } from "@/features/help";

// In the page header — right side of the flex row
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold text-[#F0EDE8]">Genomic Variants</h1>
    <p className="mt-1 text-sm text-[#8A857D]">
      Population-level analysis of genomic variants across the CDM
    </p>
  </div>
  <div className="flex items-center gap-2">
    <HelpButton helpKey="genomics.variant-analysis" />
    {/* other action buttons */}
  </div>
</div>
```

#### Pages to wire for each new phase

| Phase 15 — Genomics | Help Key |
|---|---|
| Genomic Data Sources page | `genomics` |
| Variant Analysis page | `genomics.variant-analysis` |
| Genomic Cohort Builder tab | `genomics.cohort-builder` |
| Molecular Tumor Board | `genomics.tumor-board` |

| Phase 16 — Imaging | Help Key |
|---|---|
| DICOM Sources management | `imaging` |
| OHIF Viewer / Study list | `imaging.ohif-viewer` |
| Imaging Cohort criteria | `imaging.cohort-builder` |
| Radiomic Features dashboard | `imaging.radiomic-features` |

| Phase 17 — HEOR | Help Key |
|---|---|
| Care Gap Economics dashboard | `heor` |
| Cost Analysis module | `heor.cost-analysis` |
| ROI Modeling | `heor.roi-modeling` |
| Value-Based Contract simulator | `heor.value-contracts` |

Use `InfoTooltip` for complex form fields with non-obvious semantics:

```typescript
import { InfoTooltip } from "@/features/help";

<label className="flex items-center gap-1.5 text-sm text-[#8A857D]">
  Minimum Cell Count
  <InfoTooltip text="Suppresses counts below this threshold to prevent re-identification of individuals. OHDSI standard is 5." />
</label>
```

---

### 9E. Changelog Entry

Update `backend/resources/changelog.md` before every version bump.

#### Format

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- Phase 15: Genomic variant ingestion (VCF, FHIR Genomics, panel reports) with AI-powered HGVS → OMOP mapping
- Phase 15: Variant-outcome correlation engine with population-level stratification
- Phase 15: Genomic criteria in cohort builder (gene, variant type, TMB, MSI, fusions)
- Phase 15: Molecular Tumor Board dashboard (§15c)

### Fixed
- [any bug fixes]

### Changed
- [any breaking changes or behavior changes]
```

#### Rules
- Keep entries in reverse chronological order (newest first).
- Each item starts with `Phase N:` for major additions so users can scan by phase.
- Bug fixes should reference the symptom, not the implementation: `Fixed: incidence rate calculations returning 0 when observation window straddles a year boundary` (not "Fixed null pointer in IncidenceRateService line 247").
- The `WhatsNewModal` in the frontend reads this file — every version bump will trigger it on next login.

---

### 9F. Migration / Upgrade Notes

If the new phase adds database migrations, new required config, or new Docker services, add a section to `docs/site/docs/migration/`.

#### When migration notes are required

| Trigger | Action |
|---|---|
| New `docker-compose.yml` service | Add to migration notes: new container, env vars, ports |
| New `.env` variable (required) | Add to migration notes with default and description |
| New DB migration that modifies existing data | Add upgrade query and rollback |
| Removal of an API endpoint or field | Add deprecation notice with replacement |
| New required permission/role | Document: which existing roles get it automatically |

#### Template

```markdown
## Upgrading to vX.Y.Z (Phase 15)

### New Containers
- `orthanc` — DICOM server (port 4242 DICOM, 8042 HTTP). Add the `orthanc` profile to existing deployments.

### New Environment Variables
| Variable | Required | Default | Description |
|---|---|---|---|
| `ORTHANC_URL` | No | `http://orthanc:8042` | Orthanc DICOMweb base URL |
| `GENOMICS_VCF_STORAGE` | No | `local` | Storage driver for uploaded VCFs |

### Database Migrations
Run `php artisan migrate` — adds `genomic_variants`, `molecular_sequences`, `variant_annotations` tables.

### New Permissions
`genomics.view` — granted automatically to `researcher` and above.
`genomics.ingest` — granted automatically to `admin` and above.

### Atlas Parity Notes
This phase adds variant-level cohort criteria. Atlas 2.x had no equivalent. Migration guide: n/a.
```

---

## Sequencing Summary

This is the order of operations within a phase:

```
1.  Implement backend (models, migrations, services, controllers, jobs)
2.  Implement frontend (types, API client, hooks, pages, components)
3.  Implement Python AI endpoints (if any)
4.  8A: Run Pint + PHPStan — fix all issues
5.  8B: Write Pest tests — feature + unit + factories
6.  8C: Run TSC + ESLint + Vitest — fix all issues
7.  8D: Run mypy + pytest (if Python changes)
8.  8E: Push to feature branch — confirm CI green
9.  9A: Add #[Group] to new controllers — regenerate api.json + api.generated.ts
10. 9B: Write Docusaurus chapters — update sidebars.ts — run docs build
11. 9C: Create help JSON files in backend/resources/help/
12. 9D: Wire HelpButton into new pages
13. 9E: Add changelog entry — bump version
14. 9F: Write migration notes if needed
15. Devlog: Write docs/devlog/phase-{N}-{slug}.md
16. Commit: Stage all files (never .claudeapikey, .resendapikey, secrets)
17. Push: git push origin main
18. Deploy: ./deploy.sh
```

---

## Quick Reference Checklist

Use this as a PR checklist for every new phase:

```
### Phase 8 — Testing
- [ ] Pint: ./vendor/bin/pint --test exits 0
- [ ] PHPStan: ./vendor/bin/phpstan analyse exits 0
- [ ] Pest: php artisan test exits 0, coverage ≥ 80%
- [ ] TSC: npx tsc --noEmit exits 0
- [ ] ESLint: npm run lint exits 0
- [ ] Vitest: npx vitest run exits 0
- [ ] mypy: mypy app/ exits 0 (if Python changed)
- [ ] pytest: pytest exits 0 (if Python changed)
- [ ] CI: all jobs green on feature branch

### Phase 9 — Documentation
- [ ] #[Group] added to all new controllers
- [ ] api.json regenerated (./deploy.sh --openapi)
- [ ] api.generated.ts regenerated
- [ ] Docusaurus chapters written (one per major UI area)
- [ ] sidebars.ts updated
- [ ] docs build passes (npm run build in docs/site)
- [ ] help JSON files created for each new page
- [ ] HelpButton wired into each new list page
- [ ] changelog.md updated with version bump
- [ ] Migration notes written (if new containers/env vars/migrations)
- [ ] Devlog written in docs/devlog/
```
