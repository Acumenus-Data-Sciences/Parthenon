# Workbench: Evidence Investigation Platform — Phase 2

**Date:** 2026-03-20
**Phase:** Evidence Investigation Phase 2 (Clinical Evidence Domain)
**Commits:** b639a92 – dd41bcf (10 commits)
**Status:** Deployed to production

---

## Overview

Phase 2 delivered the Clinical Evidence domain panel for the Evidence Investigation platform. The key discovery of this phase was that all 7 analysis types — characterization, incidence rate, cohort method estimation, patient-level prediction, SCCS, evidence synthesis, and pathway analysis — were already fully implemented in the backend. Services, Horizon queue jobs, R Plumber endpoints, controllers, and routes all existed from prior work. Phase 2 was therefore a **frontend integration task**: building the Clinical Evidence panel that wraps this infrastructure into the Evidence Board UI and surfaces results to the investigator.

---

## Key Discovery: Backend Already Complete

Before writing any code, a survey of the backend confirmed that every analysis type had:

- A dedicated Laravel service class under `backend/app/Services/`
- A Horizon queue job under `backend/app/Jobs/`
- A Laravel controller under `backend/app/Http/Controllers/Api/V1/`
- Routes registered in `backend/routes/api.php`
- R Plumber endpoints in `r-runtime/plumber_api.R` (where applicable)

No backend code was written or modified in Phase 2. The 10 commits are entirely frontend.

---

## Commit Log

| Commit | Description |
|--------|-------------|
| `b639a92` | feat(investigation): add clinical analysis types, registry, API wrappers, and polling hooks |
| `dc8171939` | feat(investigation): add AnalysisGallery and AnalysisCard components |
| `5ed1a81f8` | feat(investigation): add analysis ConfigDrawer with type-specific parameter forms |
| `28d66877c` | feat(investigation): add ExecutionTracker with 2s polling and elapsed time counter |
| `c96d86304` | feat(investigation): add pinnable ResultCards for all 7 analysis types |
| `40b2b0e24` | feat(investigation): add dark-themed D3 Kaplan-Meier curve and PS distribution charts |
| `5fbd3b30c` | feat(investigation): add Run History panel for clinical analysis executions |
| `777a7067b` | feat(investigation): add ClinicalPanel with gallery → config → execute → results flow |
| `8d75d46e9` | refactor: rename R container parthenon-r to parthenon-darkstar |
| `dd41bcf0b` | feat(investigation): add live Clinical domain summary to context bar |

---

## Task-by-Task Breakdown

### Task 1 — Foundation Types, Registry, and API Layer

**Commit:** `b639a92`

Established the clinical analysis type system:

- `ClinicalAnalysisType` — union string literal enum for all 7 analysis identifiers
- `AnalysisTypeDescriptor` — metadata shape: label, description, group, icon name, prerequisites, estimated runtime
- `ClinicalAnalysisConfig` — parameter bag per analysis type (union discriminated on `type`)
- `ClinicalState` — updated to track `api_prefix`, `analysis_id`, and `execution_id` per queued analysis
- `CLINICAL_ANALYSIS_REGISTRY` — 7 descriptors organized into 3 groups: Characterize, Compare, Predict

Re-exported the existing `AnalysisExecution` type from `frontend/src/features/analyses/` rather than duplicating it. The workbench clinical layer is a consumer of the analyses feature, not a replacement.

API wrapper functions (`createAnalysis`, `executeAnalysis`, `fetchExecution`, `fetchExecutions`) map each analysis type to its correct API prefix. TanStack Query hooks poll at 2s intervals and automatically stop on terminal status (`completed`, `failed`, `cancelled`).

Key files:
```
frontend/src/features/workbench/types/clinical.ts
frontend/src/features/workbench/lib/clinicalRegistry.ts
frontend/src/features/workbench/api/clinicalApi.ts
frontend/src/features/workbench/hooks/useClinicalAnalysis.ts
```

### Task 2 — Analysis Gallery

**Commit:** `dc8171939`

- `AnalysisCard` — dynamic Lucide icon lookup by string name from the registry descriptor, group color coding (teal for Characterize, crimson for Compare, gold for Predict), prerequisite badges, and estimated runtime display
- `AnalysisGallery` — three-section grid with labeled group headers; cards are gated by prerequisite availability from the investigation's phenotype state

Key files:
```
frontend/src/features/workbench/components/clinical/AnalysisCard.tsx
frontend/src/features/workbench/components/clinical/AnalysisGallery.tsx
```

### Task 3 — Configuration Drawer

**Commit:** `5ed1a81f8`

- `ConfigDrawer` — slide-in panel (480px wide) with CSS transition animation, hosting type-specific parameter forms for all 7 analysis types
- Source selector hidden for evidence synthesis (which aggregates across sources)
- Cohort selectors pre-filled from investigation phenotype state; cohorts sourced from the investigation are marked with a "From investigation" badge
- Type-specific fields: minimum cell count (characterization), time-at-risk windows (incidence rate), PS method and trimming (estimation), model type and train/test split (prediction), naive period and risk windows (SCCS), analysis weighting (evidence synthesis), combination window (pathway)

Key file:
```
frontend/src/features/workbench/components/clinical/ConfigDrawer.tsx
```

### Task 4 — Execution Tracker

**Commit:** `28d66877c`

- `ExecutionTracker` — consumes `useExecution` hook with 2s polling
- Elapsed time counter via `setInterval` — counts up from dispatch time
- Four rendered states: queued (pulsing indicator with "Waiting in queue..." message), running (spinner with elapsed time), completed (renders ResultCards), failed (error message display)

Key file:
```
frontend/src/features/workbench/components/clinical/ExecutionTracker.tsx
```

### Task 5 — Result Cards

**Commit:** `c96d86304`

Pinnable result cards for all 7 analysis types, each with a "Pin to Dossier" button that fires `domain: "clinical"`, `section: "clinical_evidence"`:

- **Characterization:** cohort counts table, top features ranked by SMD
- **Incidence Rate:** rate table with confidence intervals per strata
- **Estimation:** hazard ratio card (teal if HR < 1, crimson if HR > 1), ForestPlotWrapper slot for existing forest plot component
- **Prediction:** AUC/AUROC card, optional sensitivity/specificity metric display
- **SCCS:** incidence rate ratio with CI
- **Evidence Synthesis:** pooled HR, heterogeneity statistics (tau, I²)
- **Pathway:** top-N treatment sequence list with frequency percentages

Key file:
```
frontend/src/features/workbench/components/clinical/ResultCards.tsx
```

### Task 6 — D3 Clinical Charts

**Commit:** `40b2b0e24`

Two standalone D3 charts with the dark clinical theme (#0E0E11 background, teal/crimson palette). The existing publish-module chart components had hardcoded white backgrounds and were not suitable for the Evidence Board dark surface.

- `KaplanMeierChart` — D3 step-function survival curves with censoring tick marks, bisector-based hover tooltip showing survival probability at cursor position, legend. Wired into estimation ResultCards when KM data is present in the execution result.
- `PSDistributionChart` — D3 mirrored histogram showing propensity score overlap. Target cohort bars extend upward in teal; comparator bars extend downward in crimson. X-axis spans 0–1 (propensity score range). Wired into estimation ResultCards alongside the KM chart.

Key files:
```
frontend/src/features/workbench/components/clinical/KaplanMeierChart.tsx
frontend/src/features/workbench/components/clinical/PSDistributionChart.tsx
```

### Task 7 — Run History Panel

**Commit:** `5fbd3b30c`

- `RunHistoryPanel` — lists all tracked executions from `clinical_state.queued_analyses` in reverse chronological order
- Status badges (teal for completed, amber for running/queued, crimson for failed)
- Analysis type badge per row
- Relative timestamps ("2 minutes ago" style)
- Replay button on completed runs re-opens the ExecutionTracker for that execution
- Compare button stub (disabled, targeted for Phase 4 run comparison feature)

Key file:
```
frontend/src/features/workbench/components/clinical/RunHistoryPanel.tsx
```

### Task 8 — ClinicalPanel and EvidenceBoard Integration

**Commit:** `777a7067b`

`ClinicalPanel` is the top-level orchestrator for the Clinical Evidence domain:

- Three sub-tabs: Gallery (analysis selection), Active Run (ExecutionTracker), History (RunHistoryPanel)
- Flow: user selects analysis from Gallery → ConfigDrawer slides in → on submit, `createAnalysis` then `executeAnalysis` are called → tab switches to Active Run → ExecutionTracker polls until terminal → results rendered with pin-to-dossier buttons
- `buildDesignPayload` maps `ClinicalAnalysisConfig` fields to the exact request body shape each controller expects
- Auto-saves clinical state via `useAutoSave` on every state transition

Replaced the `DomainPlaceholder` stub in `EvidenceBoard.tsx` for the `clinical` domain with `ClinicalPanel`.

Key files:
```
frontend/src/features/workbench/components/clinical/ClinicalPanel.tsx
frontend/src/features/workbench/pages/EvidenceBoard.tsx  (integration point)
```

### Task 9 — Context Bar Summary

**Commit:** `dd41bcf0b`

The context bar's Clinical card now shows live execution status: "N complete · N running · N failed" with per-count color coding (teal / amber / crimson).

`ContextCard` was extended with an optional `summaryNode: React.ReactNode` prop. When provided, it renders below the card's description line. The clinical domain passes a `ClinicalSummary` component that derives counts from `clinical_state.queued_analyses` and re-renders as polls complete.

Key files:
```
frontend/src/features/workbench/components/ContextCard.tsx
frontend/src/features/workbench/components/ClinicalSummary.tsx
```

---

## Architecture Notes

### Polling vs. WebSocket

Phase 2 uses 2s polling via TanStack Query, consistent with the existing analyses feature pattern. The Reverb WebSocket broadcast exists on the backend (`AnalysisCompleted` event) but is not yet wired to the Evidence Board. Polling is adequate for the current use case and avoids WebSocket auth complexity for now.

### R Analysis Queue Concurrency

The `r-analysis` Horizon queue runs with `maxProcesses: 1` — only one R job executes at a time. Users submitting multiple analyses concurrently will see "Waiting in queue..." in the ExecutionTracker for all but the active job. This is intentional; R's memory profile makes parallel HADES jobs on a single machine inadvisable without horizontal scaling.

### Design Payload Construction

`ClinicalPanel.buildDesignPayload` is the single translation point between the UI's `ClinicalAnalysisConfig` shape and the varied JSON schemas expected by each controller. This is intentionally centralized rather than distributed across components.

### No Type Duplication

`AnalysisExecution` is re-exported from `frontend/src/features/analyses/types.ts` rather than redefined in the workbench feature. The workbench is a UI layer over existing domain features; it does not own analysis execution semantics.

---

## Verification

- TypeScript: zero errors (`npx tsc --noEmit`)
- Backend tests: 15/15 passing (no backend changes in this phase)
- Deployed to production at `https://parthenon.acumenus.net`

---

## What's Next

### Phase 3 — Genomic Evidence Domain

- Open Targets GraphQL integration (drug-target associations, disease evidence)
- GWAS Catalog REST API (variant associations, mapped traits)
- Risteys API (Finnish biobank endpoint-level statistics)
- GWAS summary statistics upload + local Manhattan/QQ plot rendering
- Cross-domain linking: genomic signals → clinical analyses (e.g., variant → incidence rate for carriers vs. non-carriers)

### Phase 4 — Synthesis, Export, and Collaboration

- Love plots (calibration plots for estimation results)
- Run comparison view (diff two executions of the same analysis type)
- Dossier export to PDF / structured JSON
- Shared investigation links with read-only Evidence Board view
