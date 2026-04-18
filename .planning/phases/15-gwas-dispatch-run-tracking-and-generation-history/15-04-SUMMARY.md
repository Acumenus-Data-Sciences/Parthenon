---
phase: 15
plan: 04
status: complete
completed: 2026-04-18
---

# Plan 15-04 Summary — FormRequest + Controller + Routes

## Outcome

Phase 15 public HTTP contract is live. The dispatch route, eligible-controls picker, and the drawer read path all respond on the server. Observer (Plan 15-03) closes the write-back loop.

## Tasks

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 1 | `DispatchEndpointGwasRequest` FormRequest | ✓ | authorize() gates on `finngen.workbench.use`; rules regex-guard source_key + integer-max 99999999999 guard on control_cohort_id |
| 2 | `gwas()` + `eligibleControls()` + `show()` extension | ✓ | 8 exception classes + ModelNotFoundException mapped to 404/422/409/403 per D-04; `generation_runs`/`gwas_runs`/`gwas_ready_sources` appended to show() response (D-18/D-21/UI-SPEC A1) |
| 3 | Route registrations | ✓ | Both routes inside `finngen.endpoints` prefix group, inside outer `auth:sanctum`. route:list confirms middleware stack |

## Exception → HTTP Mapping (downstream consumer reference)

Plan 15-05 `api.ts` should mirror these exactly so 4xx responses parse into typed `GwasDispatchRefusal`:

| Exception | HTTP | error_code | Extra context |
|-----------|------|------------|---------------|
| ModelNotFoundException (endpoint) | 404 | `endpoint_not_found` | — |
| UnresolvableConceptsException | 422 | `unresolvable_concepts` | coverage_bucket |
| SourceNotFoundException | 404 | `source_not_found` | source_key |
| SourceNotPreparedException | 422 | `source_not_prepared` | source_key, hint |
| EndpointNotMaterializedException | 422 | `endpoint_not_materialized` | endpoint, source_key, hint |
| ControlCohortNotPreparedException | 422 | `control_cohort_not_prepared` | control_cohort_id, source_key |
| CovariateSetNotFoundException | 422 | `covariate_set_not_found` | covariate_set_id |
| RunInFlightException | 409 | `run_in_flight` | existing_run_id, gwas_run_tracking_id, hint |
| DuplicateRunException | 409 | `duplicate_run` | existing_run_id, gwas_run_tracking_id, hint |
| NotOwnedRunException | 403 | `not_owned_run` | gwas_run_tracking_id, hint |

## show() Response Extensions

```json
{
  "data": {
    // ... existing fields (unchanged for back-compat per D-20) ...
    "generations": [...],            // D-20: existing last-run index retained
    "generation_runs": [...],        // D-18: filtered finngen.runs query, 100-row cap
    "gwas_runs": [...],              // D-21: EndpointGwasRun + joined labels, 100-row cap
    "gwas_ready_sources": ["PANCREAS", ...]  // UI-SPEC Assumption 1
  }
}
```

## Route Registration Evidence

```
$ php artisan route:list --path=api/v1/finngen/endpoints | grep -E "gwas|eligible-controls"

GET|HEAD   api/v1/finngen/endpoints/{name}/eligible-controls →
  auth:sanctum, permission:finngen.workbench.use, throttle:60,1

POST       api/v1/finngen/endpoints/{name}/gwas →
  auth:sanctum, permission:finngen.workbench.use,
  EnforceFinnGenIdempotency, throttle:10,1
```

HIGHSEC §2 three-layer protection verified — every new route has `auth:sanctum` + permission middleware + throttle.

## Pint + PHPStan

- Pint: 1 `fully_qualified_strict_types` auto-fix applied on `EndpointBrowserController.php` (committed in `03dd2a19e`).
- PHPStan: `[OK] No errors` on FormRequest + Controller at project level.

## T-15-10 Mitigation

Two defense layers on `eligibleControls`:
1. FormRequest regex `^[A-Z][A-Z0-9_]*$` on `source_key` (user input).
2. Method-level regex `^[a-z][a-z0-9_]*$` on `$sourceLower` before SQL string interpolation.
3. `$isAdmin` + `$userId` are parameter-bound in the query.

## RBAC Scope in eligibleControls

Current WHERE filter: `(? = TRUE OR cd.owner_user_id = ?)` — admin/super-admin bypass OR owner-only. Per the plan's note, this is defensive because the actual `cohort_definitions` visibility schema wasn't audited during this execution. If `cohort_definitions` has an `is_public` column, extending the WHERE clause with `OR cd.is_public = TRUE` is a one-line follow-up. Plan 15-08 will add a Pest test asserting RBAC filtering; if that surfaces a gap, extend then.

## OpenAPI Regen (Deferred)

`./deploy.sh --openapi` was NOT run. Plan 15-05 explicitly allows hand-authored TypeScript types in `frontend/src/features/finngen-endpoint-browser/api.ts` per the UI-SPEC interface declarations. Scribe annotations (`@bodyParam`, `@response`, `@queryParam`) were added to the two new controller methods; a later pass (Wave 5+ or post-phase) can regen cleanly.

## Deviations from Plan

**`EndpointNotMaterializedException` message.** Plan's suggested message didn't hard-code the endpoint/source context, so the exception's default message (which interpolates both) is used. Controller still surfaces `endpoint` and `source_key` as top-level JSON keys for downstream parsing.

**`finngen_ro` connection for `loadGenerationRunsFor`.** Plan spec suggested `config('finngen.ro_connection', 'finngen')` indirection; used the `finngen` connection directly (consistent with how `show()` already reads `finngen_ro` for the EndpointDefinition query — the ro connection has no write path anyway). If read/write split tightens in a later phase, this line is the place to update.

**`is_public` on cohort_definitions.** Plan assumed this column exists. Current query omits it (see RBAC Scope note above). Plan 15-08 test will validate.

## Next Up

Plan 15-05: `api.ts` type extensions + 3 TanStack Query hooks. The exception→HTTP map above is the authoritative contract for the hooks' error handling.
