# Studies Module — Phases S10–S13 Devlog

**Date:** 2026-03-04
**Scope:** Results & Synthesis, Activity Logging, Advanced Features, Seeder Expansion

---

## Phase S10 — Results & Synthesis

### Backend
- **StudyResultController** — CRUD for study results (index, show, update)
- **StudySynthesisController** — CRUD for study syntheses (index, store, show, destroy)
- 7 new API routes under `studies/{study}/` prefix
- Relationship naming fix: `reviewedBy()` → `reviewedByUser()`, `generatedBy()` → `generatedByUser()` to avoid FK/JSON serialization collision

### Frontend
- `StudyResult` and `StudySynthesis` TypeScript interfaces
- 7 API client functions + 5 React Query hooks
- **StudyResultsTab** component — filterable results table, expandable cards, primary/publishable toggles, synthesis creation workflow
- Integrated as 11th tab in StudyDetailPage

### Gotcha: FK/Relationship Naming Collision
When a BelongsTo relationship method name snake_cases to the same key as the FK column (e.g., `reviewedBy()` → `reviewed_by`), the relationship object overwrites the FK value in JSON serialization. Fix: suffix method name with `User`.

---

## Phase S11 — Activity Logging

- **StudySubResourceObserver** — universal Eloquent observer for 9 sub-resource models (Site, TeamMember, Cohort, Execution, Result, Synthesis, Artifact, Milestone, Comment)
- **StudyObserver** — dedicated observer for Study model with special `status_changed` tracking
- Both registered in `AppServiceProvider::boot()`
- Auto-logs: action names derived from model class (`site_added`, `cohort_removed`, `result_updated`)
- Captures old/new values on update, skips timestamp-only changes

---

## Phase S12 — Advanced Features

### S12.1: R Plumber HADES Bridge
- **`r-runtime/api/study_bridge.R`** — 4 HADES endpoints:
  - `POST /study/feasibility` — cohort counts with MIN_CELL_COUNT privacy suppression
  - `POST /study/characterize` — FeatureExtraction wrapper (top 50 features)
  - `POST /study/incidence` — SQL-based incidence rate with person-years
  - `POST /study/synthesis` — EvidenceSynthesis meta-analysis (fixed/random/bayesian)
- **HadesBridgeService.php** — Laravel HTTP client wrapping R Plumber calls
- Mounted in `plumber_api.R` at `/study`

### S12.2: AI-Assisted Study Design
- `AbbyAiService::suggestStudyProtocol()` — structured prompt to MedGemma, JSON extraction with 3 fallback strategies
- `AbbyAiController::suggestProtocol()` endpoint at `POST /api/v1/abby/suggest-protocol`
- "Generate with AI" banner in StudyCreatePage Step 2 (Sparkles icon, loading state)

### S12.3: Real-Time Updates
- **StudyExecutionUpdated** event (ShouldBroadcast) — broadcasts on `study.{studyId}.execution` channel
- Infrastructure ready, requires Reverb/Pusher setup to activate

---

## Phase S13 — Seeder Expansion

### StudySeeder Enhanced
Expanded with sub-resource seeding for 6 representative studies:
- **21 team members** — PI, co-investigator, data scientist, statistician, research coordinator, project manager, IRB liaison
- **8 sites** — coordinating centers and data partners linked to existing Sources, with IRB details
- **10 cohort assignments** — target, outcome, subgroup roles referencing existing CohortDefinitions
- **27 milestones** — full lifecycle tracking from protocol to publication, mixed completion states
- **16 artifacts** — protocols, SAPs, analysis packages, manuscripts, Shiny apps
- **17 activity log entries** — status changes, team additions, artifact uploads

All seeded idempotently via `firstOrCreate`. Dynamic lookups for admin user, sources, and cohort definitions.

---

## Files Changed

### Backend (New)
- `backend/app/Observers/StudySubResourceObserver.php`
- `backend/app/Observers/StudyObserver.php`
- `backend/app/Services/Analysis/HadesBridgeService.php`
- `backend/app/Events/StudyExecutionUpdated.php`

### Backend (Modified)
- `backend/routes/api.php` — results, synthesis, AI protocol routes
- `backend/app/Providers/AppServiceProvider.php` — observer registration
- `backend/app/Models/App/StudyResult.php` — relationship rename
- `backend/app/Models/App/StudySynthesis.php` — relationship rename
- `backend/app/Http/Controllers/Api/V1/StudyResultController.php` — eager-load fix
- `backend/app/Http/Controllers/Api/V1/StudySynthesisController.php` — eager-load fix
- `backend/app/Services/AI/AbbyAiService.php` — study protocol suggestion
- `backend/app/Http/Controllers/Api/V1/AbbyAiController.php` — suggest endpoint
- `backend/database/seeders/StudySeeder.php` — sub-resource expansion

### Frontend (New)
- `frontend/src/features/studies/components/StudyResultsTab.tsx`

### Frontend (Modified)
- `frontend/src/features/studies/types/study.ts` — Result & Synthesis interfaces
- `frontend/src/features/studies/api/studyApi.ts` — 7 API functions
- `frontend/src/features/studies/hooks/useStudies.ts` — 5 hooks
- `frontend/src/features/studies/pages/StudyDetailPage.tsx` — Results tab
- `frontend/src/features/studies/pages/StudyCreatePage.tsx` — AI suggest UI

### R Runtime
- `r-runtime/api/study_bridge.R` — HADES bridge endpoints
- `r-runtime/plumber_api.R` — study bridge mount
