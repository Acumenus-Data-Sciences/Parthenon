# Phase 0 Templates — Final Sign-off

**Date:** 2026-05-03
**Status:** Engineering complete — staging sign-off pending
**Milestone:** parthenon-ingestion-templates Phase 0
**Branch (this plan):** `feature/phase-0-templates-real` (NOT pushed; orchestrator handles push)

This is the closeout marker for the Phase 0 milestone. Quality gates were
re-run on 2026-05-03 against the tip of `feature/phase-0-templates-real`
after Plan 4 Phase E (Tasks 17–22) landed.

## Quality gates — final state

| Gate | Result |
|---|---|
| `parthenon-templates validate-manifests --root manifests` | exit 0; 4/4 OK (`hello_cdm`, `nodes_test`, `load_athena_vocabulary`, `load_synpuf`) |
| `parthenon-templates lint-secret-keys --root manifests` | clean |
| `pytest -q` (templates) | 172 passed, 1 xfailed, 0 failed |
| `ruff check .` (templates) | All checks passed |
| `black --check --line-length 100 .` (templates) | 82 files unchanged |
| `mypy --strict runtime/` (templates) | Success: no issues found in 39 source files |
| `pytest tests/test_adrs.py -q` | 24/24 passed (3 MADR-shape + 21 decision-vs-implementation) |

The single xfail is the documented `hello_cdm.query_person.fetch_query`
artifact gap — `SqlNode`'s `fetch_query` parameter emits the result frame
under a different artifact key than the manifest's post-condition asserts.
Tracked as a Phase 1 fix; not a regression.

## Phase 0 totals (across all four plans plus the runtime-gap fix)

- **Total Phase 0 commits:** 64 (including the closeout commit that lands
  with this document)
- **Templates shipped:** 4 (`hello_cdm`, `nodes_test`, `load_athena_vocabulary`,
  `load_synpuf`)
- **ADRs:** 3 (`docs/adr/000{1,2,3}-*.md`)
- **Tests:** 172 unit + integration (templates Python suite); 24 ADR
  guards; Pest feature tests for the Laravel API; 1 Playwright E2E
- **Phase 0 branches:**
  * `feature/phase-0-templates-foundations` — Plan 1 (pushed)
  * `feature/phase-0-templates-laravel` — Plan 2 (pushed)
  * `feature/phase-0-templates-frontend` — Plan 3 (pushed)
  * `feature/phase-0-templates-runtime-gap` — mid-flight fix (pushed)
  * `feature/phase-0-templates-real` — Plan 4 (NOT pushed by this agent)

## Open issues (consolidated, no blockers for Phase 0 close)

| Plan | Issue | Status |
|---|---|---|
| Plan 1 | `typer` pinned to 0.13.x (Prefect 3.1.5 transitive constraint) | Accepted |
| Plan 1 | `pyomop` 4.3.0 lacked declarative models for v5.3 / v5.4 — used CDM v6 SQL stand-in for the bootstrap path | Phase E task 32 deviation; Phase 1 follow-up |
| Plan 1 | `multimethod<2.0` pin (transitive) | Accepted |
| Plan 1 | `parthenon_migrator` per-run credential pull deferred | Phase 1 follow-up |
| Plan 2 | 5 Phase A commits used `--no-verify` due to pre-existing GIS Pint failures + missing devlog gate | Resolved mid-flight (devlog gate now in pre-commit hook) |
| Plan 3 | Task 1 was a no-op — `rjsf` already in repo at 6.5.1 from FinnGen | Accepted |
| Plan 3 | Task 15 unit test dropped (set-state-in-effect cascade hung the runner) | Accepted; Playwright E2E covers the same flow |
| Plan 3 | Pre-existing `localeParity` test failure (PHP not in node container) | Pre-existing, not introduced by Phase 0 |
| Plan 4 | Plan 1 runtime gap fixed mid-flight (parameter interpolation, db_dsn threading, factory wiring) | Resolved on `feature/phase-0-templates-runtime-gap` |
| Plan 4 | `hello_cdm.query_person.fetch_query` artifact gap | xfail in Phase 0; Phase 1 fix |
| Plan 4 | All 4 manifest YAMLs adapted from plan's outdated pseudo-API to actual JSON Schema in `template.v1.json` | Accepted |

## Sign-off boxes

- [ ] Platform engineer: ___________________  date: __________
- [ ] ETL engineer: ___________________  date: __________
- [ ] Security review: ___________________  date: __________

When the platform and ETL boxes are signed, set Status: APPROVED at the
top of `templates-phase-0-dod.md` and flip the
`ingestion.templates_enabled` feature flag in production per the runbook.

## Phase 1 readiness

Phase 1 starts with these in-place foundations:

- A working `parthenon-templates` Docker service on the internal network.
- A node SDK that 4 real templates already use end-to-end.
- A Laravel ↔ Python integration with auth, polling, and IngestionJob
  linkage.
- An Aqueduct sub-tab UX behind a feature flag.
- ADRs that are guarded against drift by the test suite.

Phase 1 priorities (per `templates-phase-0.md`):

1. FHIR / DICOM / EQ-5D templates (devplan T-010 through T-015).
2. S3/GCS storage adapter.
3. mTLS for Laravel ↔ Python.
4. `parthenon_app` / `parthenon_migrator` role split.
5. Close the `SqlNode.fetch_query` artifact gap (the one xfail).

Phase 0 is engineering-complete.
