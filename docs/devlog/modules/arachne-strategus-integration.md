# Arachne Federated Execution + Strategus Spec Builder

**Date:** 2026-03-27
**Scope:** Studies module — federated execution and analysis pipeline composition
**Commits:** `be97f8072` through `fed378b5e`

## Context

Parthenon already had Strategus execution via the R Runtime (Darkstar) — a working pipeline where PHP sends analysis specs to R Plumber, which runs HADES modules locally. What was missing:

1. **Federated execution** — distributing studies to remote OMOP CDM data nodes
2. **Visual spec composition** — researchers had to hand-write Strategus JSON; no UI for configuring analysis modules

## What Was Built

### Quick Task 5: Arachne Federated Execution (Option A — External Service)

Arachne is OHDSI's collaborative platform for distributing and executing federated research studies. We integrated it as an external service that Parthenon coordinates with.

**Architecture:**

```
Parthenon (coordinator)
  ├── Local execution    → Darkstar R Plumber     (existing)
  ├── AI-assisted design → Study Agent MCP/ACP    (existing)
  └── Federated execution → Arachne Central API   (NEW)
        ├── GET  /nodes           — list available data nodes
        ├── POST /distribute      — push Strategus spec to remote nodes
        ├── GET  /studies/{id}/status   — poll execution progress
        └── GET  /studies/{id}/results  — collect aggregated results
```

**Backend:**

| File | Purpose |
|------|---------|
| `app/Services/ArachneService.php` | HTTP client wrapping Arachne Central REST API (5 methods) |
| `app/Http/Controllers/Api/V1/ArachneController.php` | 4 API endpoints with `studies.execute` permission |
| `app/Http/Requests/ArachneDistributeRequest.php` | FormRequest validation for study distribution |

**Frontend:**

| File | Purpose |
|------|---------|
| `features/studies/hooks/useArachne.ts` | 4 TanStack Query hooks (nodes, distribute, status, results) |
| `features/studies/components/FederatedExecutionTab.tsx` | Node selection, distribution trigger, execution status tracking |

**Configuration:** `ARACHNE_URL` and `ARACHNE_API_KEY` in `.env`. Without an Arachne Central instance, the endpoints return a clean connection error — no crashes.

**Route protection:** All endpoints require `auth:sanctum` + `studies.execute` permission, consistent with HIGHSEC spec.

### Quick Task 6: Strategus Spec Builder UI

The existing `StudyPackagePage.tsx` had a 5-step wizard for Strategus execution. This task enhanced it to 7 steps with per-module configuration and JSON preview/editing.

**Wizard flow (5 → 7 steps):**

```
1. Study Info
2. Select Cohorts (target, comparator, outcome)
3. Choose Modules
4. Module Settings          ← NEW
5. JSON Preview / Editor    ← NEW
6. Validate
7. Execute
```

**New types** (`strategus/types.ts`):
- 8 typed settings interfaces: CohortMethod, PLP, SCCS, CohortDiagnostics, Characterization, CohortIncidence, EvidenceSynthesis, CohortGenerator
- `ModuleSettings` union type + `ModuleSettingsMap` + `getDefaultSettings()` factory

**New components:**

| Component | Lines | Purpose |
|-----------|-------|---------|
| `ModuleConfigPanels.tsx` | ~580 | Collapsible per-module config forms with cohort-aware multi-select, toggles, numeric inputs |
| `JsonSpecEditor.tsx` | ~130 | JSON textarea with parse validation, copy-to-clipboard, reset-to-generated |

**Spec override pattern:** The wizard maintains a `specOverride` state. If the researcher edits JSON manually, the override takes precedence over the generated spec when submitting to `/strategus/execute`. Resetting clears the override.

## Available Strategus Modules (from Darkstar)

All 8 HADES modules confirmed available:

| Module | Version |
|--------|---------|
| CohortGenerator | 1.1.0 |
| CohortMethod | 6.0.1 |
| PatientLevelPrediction | 6.6.0 |
| SelfControlledCaseSeries | 6.1.1 |
| CohortDiagnostics | 3.4.2 |
| Characterization | 3.0.0 |
| CohortIncidence | 4.1.1 |
| EvidenceSynthesis | 1.1.0 |

## Test Results

| Check | Result |
|-------|--------|
| Pint (PHP formatting) | PASS — 1240 files |
| PHP syntax (new files) | PASS — 3 files clean |
| TypeScript (`tsc --noEmit`) | PASS — zero errors |
| Vite production build | PASS — 1.25s |
| Arachne GET /nodes | PASS — expected connection error (no Central deployed) |
| Arachne POST /distribute | PASS — FormRequest validation works |
| Strategus GET /modules | PASS — returns 8 modules |
| Strategus POST /validate | PASS — validation works |

## Future Work

- Deploy an Arachne Central instance and connect a data node for end-to-end federated testing
- Add result visualization for federated study outputs (aggregated across nodes)
- Integrate Study Agent phenotype recommendations into the Strategus cohort selection step
- Add Strategus spec templates for common study designs (comparative effectiveness, safety surveillance)
