# Repo Debugging Hardening Pass

**Date:** 2026-03-15
**Scope:** Frontend type/build fixes, backend test fixes, AI optional-dependency hardening

## Summary

This pass stabilized three areas that were blocking routine verification:

- frontend TypeScript/build regressions across shared icon and result typing
- backend test failures caused by a mix of real defects and test-environment assumptions
- AI service import-time crashes when optional GIS / Solr / sklearn dependencies were not installed

## Frontend

Several pages were failing `tsc -b` because icon props were typed too loosely for current `lucide-react` typings, some result objects no longer matched their declared interfaces, and a few `unknown` / union cases were being rendered directly.

The fixes were concentrated in shared types and component contracts rather than page-specific workarounds:

- switched icon-bearing props to `LucideIcon` where appropriate
- extended vector explorer projection stats typing
- normalized characterization result parsing to produce `FeatureResult`
- fixed a few strict-typing issues in notification, GIS, cohort-expression, and text-to-SQL components
- corrected Echo generic usage for `laravel-echo`

Result: frontend tests passed, and production build succeeded when writing to a fresh output directory.

## Backend

Two categories of backend issues showed up:

1. Environment-only failures: local host tests were trying to use an unreachable database, while the proper Docker test environment worked.
2. Real code/test defects:
   - `CsvProfilerService` triggered a PHP 8.4 deprecation for `setCsvControl()`
   - `AnalysisExecution` did not expose its existing factory
   - OHDSI SQL translation did not support shorthand `DATEADD(date, number)` / `DATEDIFF(start, end)` forms used in tests
   - GIS import security tests cleared the wrong throttle key
   - role-permission seeding could attempt duplicate pivot inserts

Files fixed:

- `backend/app/Services/Ingestion/CsvProfilerService.php`
- `backend/app/Models/App/AnalysisExecution.php`
- `backend/app/Services/SqlRenderer/OhdsiSqlTranslator.php`
- `backend/tests/Feature/ImportSecurityTest.php`
- `backend/database/seeders/RolePermissionSeeder.php`

Result: the previously failing targeted backend suites passed inside the PHP container, including auth, concept sets, cohort definitions, jobs, import security, vocabulary, and SQL renderer coverage.

## AI Service

`pytest` initially failed before collecting tests because importing `app.main` eagerly loaded routers that required missing optional packages like `pysolr`, `scikit-learn`, and GIS dependencies.

The service was hardened by:

- making `pysolr` optional in `solr_spatial`
- moving sklearn imports inside projection functions
- registering non-essential routers lazily and skipping them when imports fail
- skipping startup doc ingestion in test/minimal mode
- making Ollama health probing return quickly outside Docker when `host.docker.internal` is configured

Files fixed:

- `ai/app/main.py`
- `ai/app/services/solr_spatial.py`
- `ai/app/services/projection.py`
- `ai/app/services/ollama_client.py`

## Verification

- `frontend`: `npm test -- --run` passed
- `frontend`: `npx vite build --outDir /tmp/parthenon-frontend-build` passed
- `backend`: targeted Laravel suites passed inside `docker compose exec -T php`

## Remaining Notes

- Default frontend build still depends on the local `dist/` directory being writable/cleanable.
- AI request-path testing through `TestClient` still warrants a deeper pass even though import-time failures and health probe stalls were fixed.
