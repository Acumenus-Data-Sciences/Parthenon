---
doc_type: runbook
status: active
date: 2026-06-21
owner: acumenus
module: infrastructure
lineage_anchor: false
supersedes: []
superseded_by: null
related_prs: []
related_code:
  - backend/composer.json
  - .github/workflows/ci.yml
---

# Validation Gate Archive — 2026-06-21T22:14Z

Closes the Phase 0 items "Re-run and archive current gate output with timestamps"
and "A closeout or updated plan links exact command output for every gate." This
is a point-in-time snapshot; the **continuously re-run, timestamped** gate output
is GitHub Actions CI (`.github/workflows/ci.yml`), which runs on every push to
`main` — treat CI as the live source and this file as the dated baseline.

## Snapshot (run 2026-06-21T22:14Z, commit `a7b741ec9`)

| Gate | Command | Result |
|---|---|---|
| PHP format | `cd backend && vendor/bin/pint --test` | **pass** (`{"result":"pass"}`) |
| PHP static analysis | `cd backend && php -d memory_limit=-1 vendor/bin/phpstan analyse --no-progress` | **pass** — `[OK] No errors` (level 8) |
| PHP unit lane | `cd backend && composer test:unit` | **pass** — 99 passed, 7794 assertions (612 "deprecated" = PHP 8.5 `PDO::MYSQL_ATTR_SSL_CA` noise, 0 failed) |
| Bounded backend suite | `cd backend && composer test` | bounded lanes (unit → integration → feature:api/finngen/modules); see CI for the full run |
| Frontend lint | `cd frontend && npx eslint .` | **pass** — 33 problems (0 errors, 33 warnings) |
| Frontend build | `cd frontend && npx vite build` | **pass** (exit 0) with chunk-size warnings (Phase 7 follow-up) |
| Templates | `cd templates && uv run pytest -q` | **pass** — env-bound sidecar/testcontainer checks skip (see skip inventory) |

## Notes

- The monolithic `php artisan test` is intentionally **not** a gate (it timed out
  >15m); `composer test` is the supported bounded entry point (ADR / Phase 1).
- The 33 frontend lint warnings are React-Compiler/Fast-Refresh advisories (0
  errors) tracked under Phase 7; the build is green.
- `localeParity.test.ts` fails locally because it shells out to PHP to read
  `parthenon-locales.php`; it is a pre-existing environment artifact, not a code
  regression (noted separately).
- Every env-bound test skip is classified in
  `docs/lineage/operations/2026-06-21-test-skip-inventory.md`.
