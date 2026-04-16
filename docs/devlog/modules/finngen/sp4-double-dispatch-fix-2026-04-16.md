# SP4 Workbench — double-dispatch fix (2026-04-16)

**Commit:** `ec4a3dde9`
**Surfaced by:** `/gsd-quick` live smoke `260416-owf` (full live E2E of SP4
workbench workers).

## Symptom

`POST /api/v1/finngen/workbench/materialize` against PANCREAS for
`UNION(222, 223)` produced **474 rows / 237 distinct subjects** (exact 2×
inflation) on the overwrite path. Fresh-create with the same tree happened to
land 237 rows because the second submission hit a guard before INSERT.

## Root cause

`WorkbenchSessionController::matchCohort` and `::materializeCohort` each
dispatched the analysis job twice:

1. Implicitly inside `FinnGenRunService::create()` line 59 — the canonical
   path used by every other FinnGen controller (`CodeExplorerController`,
   `RunController`).
2. Explicitly via a trailing `Bus::dispatch(new RunFinnGenAnalysisJob($run->id))`
   in the controller method.

Two Darkstar submissions landed 33–36 ms apart per smoke evidence. Match
appeared healthy because the matcher's DELETE-then-INSERT shape is
self-stabilizing; materialize is not.

## Fix

`backend/app/Http/Controllers/Api/V1/FinnGen/WorkbenchSessionController.php`

- Removed redundant `Bus::dispatch(...)` from both controller methods.
- Removed orphaned `Bus` and `RunFinnGenAnalysisJob` imports.

`backend/tests/Feature/FinnGen/WorkbenchSessionTest.php`

- Tightened `Bus::assertDispatched(...)` → `Bus::assertDispatched(..., 1)` in
  the match + materialize tests so the single-dispatch invariant is now
  enforced by CI.

`docker-compose.yml`

- Bumped `php` container memory cap 1G → 2G. PHPStan was OOM-killed silently
  inside the pre-commit hook at the previous cap, hiding any real signal.

## Verification (production live re-smoke)

| Path | Run ID | Darkstar job(s) | DB rows | Distinct | Verdict |
|------|--------|------------------|---------|----------|---------|
| Materialize (fresh) | `01kpc7hcvyehen31wvpf19gget` | 1 | 237 | 237 | ✅ |
| Materialize (overwrite) | `01kpc7kysqt5qsn387k61qb8gx` | 1 | 237 | 237 | ✅ |
| Match | `01kpc7mh3wgr463919mba54s49` | 1 | n/a (208 matched) | — | ✅ |

Compare with pre-fix overwrite run (cohort 247): 474 rows / 237 distinct.

## Tests

- `WorkbenchSessionTest` — 30 passing (83 assertions) including the two
  tightened single-dispatch regressions.
- Full FinnGen suite — 179 passing.
- PHPStan + Pint clean.
