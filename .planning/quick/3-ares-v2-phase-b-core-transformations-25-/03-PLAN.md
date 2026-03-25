---
title: "Ares v2 Phase B — Core Transformations"
mode: quick
wave: 1
tasks: 10
source: docs/devlog/plans/2026-03-24-ares-v2-phase-b.md
must_haves:
  truths:
    - 8 new database migrations
    - 2 new services (AutoAnnotation, ReleaseDiff)
    - 4 new models (DqSlaTarget, FeasibilityTemplate, AcceptedMapping, UnmappedCodeReview)
    - ~20 new API endpoints
    - ~23 new frontend components
    - All routes have auth:sanctum + permission middleware
    - TypeScript compiles clean
  artifacts:
    - backend/app/Services/Ares/AutoAnnotationService.php
    - backend/app/Services/Ares/ReleaseDiffService.php
    - 23 new frontend components in ares/ subdirectories
---

# Ares v2 Phase B — Core Transformations

**Goal:** Implement ~25 medium-effort enhancements including new services, database tables, and significant frontend components.

**Full plan:** `docs/devlog/plans/2026-03-24-ares-v2-phase-b.md`

## Execution Strategy

Phase B is large (2540 lines, 10 tasks). Execute via parallel agents, each handling one panel's full stack (migration + model + service + controller + routes + frontend).

### Wave 1: Migrations + Models + Types (sequential, one agent)
All 8 migrations, 4 new models, type extensions.

### Wave 2: Service + Controller + Frontend (parallel, 5 agents)
- Agent A: Tasks 1+9 (Alerts + Annotations — share AutoAnnotationService)
- Agent B: Tasks 2+3 (Concept Comparison + DQ History)
- Agent C: Tasks 4+5 (Coverage + Feasibility)
- Agent D: Tasks 6+7 (Diversity + Releases)
- Agent E: Tasks 8+10 (Unmapped Codes + Cost)
