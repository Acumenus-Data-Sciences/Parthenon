# Workbench: Toolset Selector + Evidence Investigation Platform (Phase 1a)

**Date:** 2026-03-20
**Phase:** Workbench Restructure + Evidence Investigation Phase 1a
**Commits:** e36fb1f – 162cd8a (21 commits total)
**Status:** Deployed to production

---

## Overview

Two major efforts shipped today. The first refactored the Workbench page from a single-tool FinnGen launcher into a proper toolset selection gateway. The second — the larger of the two — designed and built the foundation of a new **Evidence Investigation** platform, transforming the FinnGen workbench into a persistent, question-driven workspace that bridges clinical phenotyping, observational analytics, and genomic evidence.

---

## Effort 1: Workbench Toolset Selector

**Commits:** e36fb1f – d4326b9 (8 commits)

### Motivation

The Workbench page was hardcoded to launch FinnGen tools, gated behind a `VITE_STUDY_AGENT_ENABLED` env flag. Morpheus (MIMIC-IV) is on the roadmap, a Community SDK is planned, and the Aqueduct ETL workbench (ported from Perseus) had been superseded by Parthenon's native ingestion pipeline. The page needed to become a proper gateway.

### What Changed

**Aqueduct removal** — Deleted the entire Aqueduct feature directory from the frontend, plus the backend controller, service, models, migrations, routes, and tests. Removed the `StudyAgentController` dependency that Aqueduct had introduced. Aqueduct was dead code at this point.

**WorkbenchLauncherPage** — New landing page at `/workbench` presenting three toolset cards:

| Toolset | Status | Accent | Badge |
|---------|--------|--------|-------|
| FinnGen | Available | Teal (`#2DD4BF`) | StudyAgent |
| Morpheus | Coming soon | Crimson (`#9B1B30`) | MIMIC-IV |
| Build a Toolset / Community SDK | Available | Gold (`#C9A227`) | — |

**Route restructure:**
- FinnGen moved from `/workbench` → `/workbench/finngen`
- `/workbench/aqueduct` → redirect to `/workbench`
- `/workbench/help` → redirect to `/workbench/finngen/help`
- `/finngen-tools` → redirect to `/workbench/finngen`

**Sidebar** — Removed the `VITE_STUDY_AGENT_ENABLED` guard. Workbench is always visible.

**FinnGen cleanup** — Replaced the toolset dropdown (previously switching between FinnGen and Aqueduct) with a back-to-workbench breadcrumb. Removed the Aqueduct promotion card from the FinnGen landing view. Updated help link targets.

### Key Files

```
frontend/src/features/workbench/pages/WorkbenchLauncherPage.tsx   (new)
frontend/src/features/workbench/pages/FinnGenPage.tsx              (modified)
frontend/src/features/aqueduct/                                    (deleted)
backend/app/Http/Controllers/Api/V1/AqueductController.php         (deleted)
backend/app/Services/Aqueduct/                                     (deleted)
```

---

## Effort 2: Evidence Investigation Platform — Phase 1a

**Commits:** 97ba731 – 162cd8a (13 commits)

### Research & Design

Before implementation, conducted deep research into:

- **FinnGen** as a genomics research consortium — biobank model, endpoint definitions, GWAS summary stat distribution, FinRegistry population cohort
- **OHDSI tooling UX** — Atlas cohort builder interaction model, HADES package ecosystem (CohortMethod, PatientLevelPrediction, FeatureExtraction), ROMOP, CO2/CohortOperations2 as prior art for set-operation UX
- **The gap** — clinical observational research tools and population genomics tools exist in separate silos with no shared evidence model

This informed a design decision: rather than wrapping FinnGen as a job launcher, build a **persistent investigation workspace** where clinical and genomic evidence are collected, pinned, and synthesized into a structured deliverable.

### Design Decisions

**Investigation model** — A named, persistent workspace with a defined lifecycle: `draft → active → complete → archived`. Each investigation has a research question, optional ICD-10/SNOMED focus concepts, and a collection of pinned evidence items.

**Evidence Board** — Focus+context layout with four domains:
1. **Phenotype** — concept search, cohort definition, validation
2. **Clinical** — observational analytics (HADES modules, OMOP analyses)
3. **Genomic** — FinnGen endpoints, GWAS Catalog, Open Targets
4. **Synthesis** — cross-domain dossier construction

**Evidence Dossier** — The concrete deliverable: a structured document grouping pinned findings by domain, exportable as PDF/JSON, shareable by link.

**Cross-domain linking** — Concept and gene resolution as the bridge between clinical and genomic evidence layers.

**Phased build plan:**
- **Phase 1a** (today) — Foundation: Investigation CRUD, Evidence Board shell, Concept Explorer, Phenotype panel (Explore tab), Synthesis panel
- **Phase 1b** — Cohort Builder (Venn set operations), CodeWAS/TimeCodeWAS, Guided mode (StudyAgent)
- **Phase 2** — Clinical Evidence domain (analysis gallery, HADES modules, Horizon-backed execution)
- **Phase 3** — Genomic Evidence domain (Open Targets GraphQL, GWAS Catalog REST, Risteys API, GWAS summary stats upload)
- **Phase 4** — Synthesis polish, PDF/JSON export, colocalization import, split view, collaboration

### Implementation

#### Backend

**Migrations (4):**

```
database/migrations/xxxx_create_investigations_table.php
database/migrations/xxxx_create_evidence_pins_table.php
database/migrations/xxxx_add_investigation_id_to_finngen_runs_table.php
database/migrations/xxxx_add_workbench_mode_to_users_table.php
```

`investigations` — id, user_id, title, description, research_question, status (enum), focus_concept_id, focus_concept_name, focus_concept_code, metadata (jsonb), timestamps/soft deletes

`evidence_pins` — id, investigation_id, user_id, domain (enum: phenotype/clinical/genomic/synthesis), pin_type, title, summary, content (jsonb), source_ref, is_key_finding, display_order, timestamps

**Models (2 new, 2 modified):**

```
backend/app/Models/App/Investigation.php
backend/app/Models/App/EvidencePin.php
backend/app/Models/App/FinnGenRun.php       (added investigation_id FK)
backend/app/Models/User.php                 (added workbench_mode cast)
```

**Form Requests (5):**

```
backend/app/Http/Requests/StoreInvestigationRequest.php
backend/app/Http/Requests/UpdateInvestigationRequest.php
backend/app/Http/Requests/StoreEvidencePinRequest.php
backend/app/Http/Requests/UpdateEvidencePinRequest.php
backend/app/Http/Requests/ConceptSearchRequest.php
```

**Services (3):**

```
backend/app/Services/Investigation/InvestigationService.php
backend/app/Services/Investigation/EvidencePinService.php
backend/app/Services/Investigation/ConceptSearchService.php
```

`ConceptSearchService` queries the `omop` connection for type-ahead search across `concept` table (name, code, domain, vocabulary), hierarchy navigation via `concept_ancestor`, and Redis-cached patient counts from `results` schema.

**Controllers (3):**

```
backend/app/Http/Controllers/Api/V1/InvestigationController.php
backend/app/Http/Controllers/Api/V1/EvidencePinController.php
backend/app/Http/Controllers/Api/V1/ConceptExplorerController.php
```

All mutating endpoints enforce ownership authorization — users can only modify their own investigations and pins.

**API endpoints (13)** under `/api/v1/`:

```
GET    /investigations
POST   /investigations
GET    /investigations/{id}
PUT    /investigations/{id}
DELETE /investigations/{id}
GET    /investigations/{id}/pins
POST   /investigations/{id}/pins
PUT    /investigations/{id}/pins/{pinId}
DELETE /investigations/{id}/pins/{pinId}
PATCH  /investigations/{id}/pins/reorder

GET    /concept-explorer/search
GET    /concept-explorer/concept/{conceptId}
GET    /concept-explorer/concept/{conceptId}/children
```

**Tests (15 Pest feature tests, all passing, 36 assertions):**

```
backend/tests/Feature/InvestigationTest.php
backend/tests/Feature/EvidencePinTest.php
backend/tests/Feature/ConceptExplorerTest.php
```

#### Frontend

**TypeScript types** — Full type system covering `Investigation`, `EvidencePin`, `InvestigationDomain` enum, `EvidenceBoard` state (4 domain state interfaces), concept search/hierarchy types, dossier section types.

```
frontend/src/features/workbench/types/investigation.ts
```

**API client (13 async functions):**

```
frontend/src/features/workbench/api/investigationApi.ts
frontend/src/features/workbench/api/conceptExplorerApi.ts
```

**State layer (12 TanStack Query hooks + 1 Zustand store):**

```
frontend/src/features/workbench/hooks/useInvestigations.ts
frontend/src/features/workbench/hooks/useEvidencePins.ts
frontend/src/features/workbench/hooks/useConceptExplorer.ts
frontend/src/features/workbench/stores/investigationStore.ts
```

**Evidence Board shell:**

```
frontend/src/features/workbench/components/evidence-board/EvidenceBoard.tsx
frontend/src/features/workbench/components/evidence-board/LeftRail.tsx
frontend/src/features/workbench/components/evidence-board/ContextBar.tsx
frontend/src/features/workbench/components/evidence-board/ContextCard.tsx
frontend/src/features/workbench/components/evidence-board/EvidenceSidebar.tsx
frontend/src/features/workbench/components/evidence-board/PinCard.tsx
frontend/src/features/workbench/components/evidence-board/DomainPlaceholder.tsx
```

**Concept Explorer** — debounced type-ahead search (300ms), domain filtering (Condition/Drug/Measurement/Procedure/Observation), hierarchy tree navigation, concept set builder with include/exclude descendants toggles and Redis-backed patient count badges.

```
frontend/src/features/workbench/components/concept-explorer/ConceptExplorer.tsx
frontend/src/features/workbench/components/concept-explorer/ConceptSearchBar.tsx
frontend/src/features/workbench/components/concept-explorer/ConceptHierarchyTree.tsx
frontend/src/features/workbench/components/concept-explorer/ConceptSetBuilder.tsx
```

**Domain panels:**

```
frontend/src/features/workbench/components/panels/PhenotypePanel.tsx
  └── Explore tab (Concept Explorer, active)
  └── Build tab (stub — Phase 1b: cohort builder)
  └── Validate tab (stub — Phase 1b: CodeWAS)

frontend/src/features/workbench/components/panels/SynthesisPanel.tsx
  └── 8 dossier sections: Research Question, Key Findings, Phenotype Definition,
      Clinical Evidence, Genomic Evidence, Colocalization, Conclusions, References
  └── Renders grouped pinned evidence, key findings highlighted
```

**Pages:**

```
frontend/src/features/workbench/pages/InvestigationPage.tsx
frontend/src/features/workbench/pages/NewInvestigationPage.tsx
```

**Router integration** — Investigation routes nested under `/workbench/finngen/investigations/`. Recent Investigations section added to `WorkbenchLauncherPage`.

**Dependencies added:** `d3`, `@types/d3`, `recharts` (for Phase 2+ visualization work).

### Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | 0 errors |
| `vendor/bin/phpstan analyse` (level 8) | 0 errors on all new files |
| `vendor/bin/pest --filter Investigation` | 15/15 passing (36 assertions) |
| Production deploy | Deployed via `./deploy.sh` |

---

## What's Next

### Phase 1b — Cohort Builder + CodeWAS
- Venn diagram set-operation cohort builder (include/exclude/intersect/difference)
- CodeWAS and TimeCodeWAS execution against OMOP CDM
- Guided Investigation mode via StudyAgent

### Phase 2 — Clinical Evidence Domain
- Analysis gallery (HADES modules: CohortMethod, PatientLevelPrediction, FeatureExtraction)
- Background execution via Horizon job queue
- Result cards pinnable to Evidence Board

### Phase 3 — Genomic Evidence Domain
- Open Targets GraphQL integration (gene-disease associations, drugs, pathways)
- GWAS Catalog REST (top associations, studies by trait)
- Risteys API (FinnGen endpoint statistics, correlations)
- GWAS summary stats upload + local query

### Phase 4 — Synthesis + Export
- PDF export (Evidence Dossier)
- JSON export (machine-readable)
- Shareable link (read-only investigation view)
- Colocalization import (coloc2/HyPrColoc output)
- Split-pane view (Clinical | Genomic side by side)
- Collaboration (shared investigations, comments)
