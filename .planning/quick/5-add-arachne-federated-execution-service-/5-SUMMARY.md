---
phase: quick-5
plan: 01
subsystem: studies/federated-execution
tags: [arachne, ohdsi, federated, studies, backend, frontend]
dependency_graph:
  requires: [studies-module, strategus-controller]
  provides: [arachne-service, arachne-api, federated-tab]
  affects: [StudyDetailPage, docker-compose, services-config]
tech_stack:
  added: [arachne-rest-api-client]
  patterns: [http-client-service, tanstack-query-hooks, tab-composition]
key_files:
  created:
    - backend/app/Services/ArachneService.php
    - backend/app/Http/Controllers/Api/V1/ArachneController.php
    - backend/app/Http/Requests/ArachneDistributeRequest.php
    - frontend/src/features/studies/hooks/useArachne.ts
    - frontend/src/features/studies/components/FederatedExecutionTab.tsx
  modified:
    - backend/config/services.php
    - backend/routes/api.php
    - docker-compose.yml
    - frontend/src/features/studies/types/study.ts
    - frontend/src/features/studies/pages/StudyDetailPage.tsx
decisions:
  - "Arachne URL/token/timeout from env vars (no hardcoded secrets)"
  - "Optional arachne-datanode via Docker profiles (only starts with --profile arachne)"
  - "studies.execute permission on all Arachne routes (HIGHSEC compliant)"
  - "Auto-poll every 15s when submissions are PENDING/EXECUTING"
metrics:
  duration: 4min
  completed: "2026-03-27T19:56:36Z"
---

# Quick Task 5: Add Arachne Federated Execution Service Summary

Arachne REST API client with 5 methods, 4 API endpoints behind studies.execute permission, frontend Federated tab on StudyDetailPage with node selection, distribution controls, and live execution status polling.

## What Was Built

### Backend
- **ArachneService** (backend/app/Services/ArachneService.php): HTTP client wrapping Arachne Central REST API with 5 methods (listNodes, createAnalysis, distribute, getStatus, getResults). All calls use bearer token auth, configurable timeout, and structured error handling with descriptive exceptions.
- **ArachneController** (backend/app/Http/Controllers/Api/V1/ArachneController.php): 4 endpoints (nodes, distribute, status, results). Distribute creates local StudyExecution records with execution_engine='arachne'. Status merges local and remote execution state. Returns 502 for connection errors, 422 for validation errors.
- **ArachneDistributeRequest**: FormRequest validating study_slug (exists), node_ids (array of integers), optional analysis_spec.
- **Routes**: 4 routes at /api/v1/arachne/* inside auth:sanctum group with permission:studies.execute middleware.
- **Config**: Arachne URL, token, timeout in services.php from environment variables.
- **Docker**: Optional arachne-datanode service under "arachne" profile.

### Frontend
- **Arachne types**: ArachneNode, ArachneSubmission, ArachneDistributePayload, ArachneDistributeResponse, ArachneStatusResponse added to study.ts.
- **useArachne hooks**: 4 TanStack Query hooks (useArachneNodes with 60s stale time, useDistributeStudy mutation, useArachneStatus with 15s auto-poll, useArachneResults on-demand).
- **FederatedExecutionTab**: Node selection table with checkboxes (name, status dot, CDM version, patient count, last seen), distribute button with confirmation, execution status table with color-coded submission badges, inline results preview for completed submissions.
- **StudyDetailPage**: Added "Federated" tab with Globe2 icon.

## Deviations from Plan

None - plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | be97f8072 | Backend: ArachneService, Controller, routes, config, Docker service |
| 2 | fa228d5e5 | Frontend: types, hooks, FederatedExecutionTab, StudyDetailPage tab |

## Verification Results

- `php artisan route:list --path=arachne` -- 4 routes with studies.execute middleware
- `docker compose config --quiet` -- valid YAML
- `vendor/bin/pint --test` -- passes
- `tsc --noEmit` -- passes
- `vite build` -- succeeds (via Docker node container)
