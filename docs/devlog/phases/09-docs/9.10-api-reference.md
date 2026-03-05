# Phase 9.10 — API Reference (Scramble + OpenAPI + TypeScript Types)

**Date:** 2026-03-03
**Status:** Complete

---

## What Was Built

### 1. API Grouping — `#[Group()]` Attributes on 34 Controllers

Added Scramble `#[Group(name, weight)]` PHP 8 attributes to every API controller, creating 23 logical sections in the Stoplight Elements sidebar (ordered by `weight`):

| Weight | Group | Controllers |
|--------|-------|------------|
| 10 | Authentication | AuthController, OnboardingController, NotificationPreferenceController |
| 20 | Data Sources | SourceController |
| 30 | Vocabulary | VocabularyController |
| 40 | Concept Sets | ConceptSetController |
| 50 | Cohort Definitions | CohortDefinitionController |
| 60 | Characterization | CharacterizationController |
| 70 | Incidence Rates | IncidenceRateController |
| 80 | Treatment Pathways | PathwayController |
| 90 | Population-Level Estimation | EstimationController |
| 100 | Patient-Level Prediction | PredictionController |
| 110 | SCCS | SccsController |
| 120 | Evidence Synthesis | EvidenceSynthesisController |
| 130 | Negative Controls | NegativeControlController |
| 140 | Care Bundles & Gaps | CareGapController |
| 150 | Studies | StudyController |
| 160 | Data Explorer | AchillesController, DataQualityController |
| 170 | Population Analytics | PopulationCharacterizationController, PopulationRiskScoreController, ClinicalCoherenceController |
| 180 | Network Analysis | NetworkAnalysisController |
| 190 | Patient Profiles | PatientProfileController |
| 200 | Data Ingestion | IngestionController, MappingReviewController |
| 210 | AI Assistant (Abby) | AbbyAiController |
| 220 | Administration | Admin/* (UserController, RoleController, AuthProviderController, AiProviderController, WebApiRegistryController, SystemHealthController) |
| 230 | System | HealthController |

Pint auto-fixed `ordered_imports` on all 34 files (use statements reordered alphabetically, placing `use Dedoc\Scramble\Attributes\Group` in the correct position).

### 2. OpenAPI Spec Export

`php artisan scramble:export` now produces `backend/api.json` with:
- **173 paths** across 23 groups
- Full request/response schemas inferred from PHP type hints and FormRequest classes
- Interactive "Try It" enabled (Sanctum cookie auth)

`backend/api.json` added to `.gitignore` (generated artifact).

### 3. TypeScript Types Generation

Added `openapi-typescript@^7.13.0` to `frontend/package.json` devDependencies.

New npm script:
```json
"generate:api-types": "openapi-typescript ../backend/api.json -o src/types/api.generated.ts"
```

Generated file: `frontend/src/types/api.generated.ts` — **13,364 lines** of TypeScript interfaces covering every request/response shape across all 173 endpoints.

`frontend/src/types/api.generated.ts` added to `.gitignore` (generated artifact).

### 4. `deploy.sh` — `--openapi` Flag

```bash
./deploy.sh --openapi   # export spec + regenerate TypeScript types
```

Also included in the default full deploy (`./deploy.sh`). Runs:
1. `php artisan scramble:export` (in PHP container)
2. `npm run generate:api-types` (in Node container)

### 5. CI — `openapi-export` Job

New CI job that runs in parallel with `docs-build`:
1. Spins up PostgreSQL, installs PHP 8.4 + Composer deps
2. `php artisan scramble:export` — exports `backend/api.json`
3. Validates spec in Python: checks ≥100 paths, prints group list
4. Installs Node deps, runs `npm run generate:api-types`
5. `npx tsc --noEmit` — verifies generated types compile cleanly

`docker` job updated to `needs: [backend, frontend, ai, openapi-export]`.

---

## Bug Fix — PHP 8.4 Trait Property Conflict (4 Ingestion Jobs)

**Problem:** PHP 8.4 forbids a class from redeclaring a property defined in a used trait, even with the same type. The `Queueable` trait defines `public $queue` (untyped); the four ingestion jobs redeclared it as `public string $queue = 'ingestion'`.

This was a latent issue in the codebase — it caused a FatalError when Scramble tried to load all classes to generate the OpenAPI spec.

**Fix:** Removed the `public string $queue` property declaration from all 4 jobs; added `$this->queue = 'ingestion'` to each constructor body instead.

Files fixed:
- `app/Jobs/Ingestion/ProfileSourceJob.php`
- `app/Jobs/Ingestion/RunConceptMappingJob.php`
- `app/Jobs/Ingestion/WriteCdmDataJob.php`
- `app/Jobs/Ingestion/RunValidationJob.php`

---

## Architecture Notes

- Scramble `#[Group]` attribute is from `Dedoc\Scramble\Attributes\Group` (available in Scramble ≥0.12). The `weight` parameter controls sidebar ordering (lower = higher up).
- The `openapi-typescript` tool (v7) generates TypeScript interfaces, not a full SDK. The generated `paths`, `operations`, and `components` interfaces can be used with type-safe fetch wrappers or left as a reference.
- `api.json` is excluded from git because it changes on every Scramble version bump and would produce noisy diffs. It is regenerated in CI and on each deploy.

---

## Verification

```bash
# Export OpenAPI spec
cd backend && php artisan scramble:export
# → "OpenAPI document exported to api.json."
# → 173 paths, 23 groups

# Generate TypeScript types
cd frontend && npm run generate:api-types
# → 13,364 lines in src/types/api.generated.ts

# TypeScript check
npx tsc --noEmit
# → (no output = pass)

# CI: openapi-export job passes on push
```
