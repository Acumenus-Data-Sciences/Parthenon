# Genomics #2 — FinnGen endpoint generation against CDM (full reconciliation)

**Commit:** `6a2cb4a78`
**Date:** 2026-04-16

## What this closes

Genomics #1 (commit `44909d0b5` / 260416-qpg) imported 5,161 FinnGen DF14
endpoint definitions into `app.cohort_definitions`. They sat in the
catalog with `kind: "finngen_endpoint"` `expression_json` containing
fully-resolved OMOP standard concept_ids (SNOMED for conditions, RxNorm
for drugs) — but nothing could turn those concept lists into actual
cohort rows in `{cohort_schema}.cohort` against any source CDM.

Genomics #1.5 (commit `e16973cfe`) doubled the resolved-concept coverage
and shipped the FinnGen Endpoint Browser UI. The browser's "Use in
Workbench" CTA was a placeholder Link — researchers had to manually
recreate the cohort definition in the workbench, defeating most of the
catalog's value.

Genomics #2 wires the missing path end-to-end: any researcher can now
pick a source from the browser detail drawer and materialize the
endpoint as cohort rows against that CDM with one click.

## Pipeline (top to bottom)

```
Frontend GeneratePanel
  ↓ POST /api/v1/finngen/endpoints/{name}/generate
EndpointBrowserController::generate
  ├─ validates source_key (404 if unknown)
  ├─ reads expression_json.resolved_concepts (cond + drug + source ids)
  ├─ rejects CONTROL_ONLY / no-resolved-concepts (422)
  ├─ extracts sex_restriction → 'male' | 'female' | null
  └─ FinnGenRunService::create('endpoint.generate', params)
       ↓ dispatches RunFinnGenAnalysisJob (single dispatch)
       ↓ POSTs to darkstar /finngen/endpoint/generate
finngen_endpoint_generate_execute (R)
  ├─ check_existing — refuse unless overwrite_existing
  ├─ build qualifying-event UNION (conditions + drugs + source-fallback)
  ├─ concept_ancestor descendant expansion per branch
  ├─ optional gender_concept_id filter (8507/8532)
  └─ INSERT INTO {cohort_schema}.cohort using same cohort_definition_id
       ↓ returns subject_count + cohort_definition_id
Frontend: navigate to /workbench/finngen-analyses?run={id}
```

## Live verification

### Local smoke (after R column-name fix)

| Run | Endpoint | Source | Result |
|-----|----------|--------|--------|
| `01kpcdzv562fmf5efm4nkv4xfc` | E4_DM2 (Type 2 diabetes) | PANCREAS | succeeded, 135 subjects |

### Production smoke (post-deploy)

| Run | Endpoint | Source | Mode | Result |
|-----|----------|--------|------|--------|
| `01kpce3rz43x40n9rhdfhvpmd4` | E4_DM2 | PANCREAS | overwrite | succeeded, 135 subjects |

DB verification (`pancreas_results.cohort` for `cohort_definition_id = 969`):
- 135 rows / 135 distinct subjects (1:1 — no inflation, single Darkstar job)
- Subject percentage: 135 / 361 PANCREAS subjects = **37%** with T2DM
- Clinically plausible for a pancreatic-cancer corpus where T2DM is a
  highly prevalent comorbidity (and a known risk factor for PDAC)

Concept counts dispatched for E4_DM2:
- 41 SNOMED conditions (diabetes-related diagnoses)
- 55 RxNorm drugs (antidiabetic medications)
- 227 ICD-10 source concepts (fallback for codes not yet mapped to standard)

## What changed

### R worker — `darkstar/api/finngen/cohort_ops.R`

Added `finngen_endpoint_generate_execute(source_envelope, run_id, export_folder, params)`:
- Builds qualifying-event CTEs only for non-empty concept lists (so a
  drug-only or condition-only endpoint gets minimal SQL)
- Each branch expands through `vocab.concept_ancestor` so descendants
  count (FinnGen endpoints rely on the full hierarchy under each ICD)
- Source-concept-id fallback catches ICD codes the resolver matched in
  vocab but never traversed Maps-to to standard SNOMED — useful for
  Finnish-only ICD-10 extensions where source_concept_id is recorded
  but standard_concept is null
- Optional sex filter via `gender_concept_id` (8507 male / 8532 female)
- Same overwrite gate as `cohort.materialize`: refuses to write if rows
  already exist for `cohort_definition_id` unless `overwrite_existing`
- Writes summary.json with `analysis_type`, `cohort_definition_id`,
  `subject_count`, per-branch concept counts, sex_restriction

**Bug caught and fixed in live smoke:** First dispatch failed with
`missing value where TRUE/FALSE needed` because
`DatabaseConnector::querySql` returned the count column as uppercase
`$C[1]` rather than the `$c[1]` I assumed. The existing materialize
function explicitly downcases column names — adopted the same pattern.

### R route — `darkstar/api/finngen/routes.R`

- Added `"finngen.endpoint.generate"` to the dispatcher map
- Added `#* @post /finngen/endpoint/generate` plumber route

### Backend — Parthenon

- `FinnGenAnalysisModuleSeeder`: registered `endpoint.generate` module
  (researcher role, `/finngen/endpoint/generate` darkstar endpoint,
  full settings_schema with concept ID arrays + sex_restriction enum)
- `EndpointBrowserController::generate(Request, string $name)`:
  validates `source_key` + optional `overwrite_existing`, looks up the
  cohort_definition by name, reads resolved_concepts from
  expression_json, derives sex_restriction via `match` (PHPStan-clean),
  dispatches via `FinnGenRunService::create` (single dispatch — the
  same canonical pattern code-explorer and cohort-match use). Returns
  202 with run + expected_concept_counts.
- `routes/api.php`: `POST /api/v1/finngen/endpoints/{name}/generate`
  with `permission:finngen.workbench.use`, `finngen.idempotency`,
  `throttle:10,1`

### Frontend — Parthenon

- `api.ts`: `GenerateEndpointPayload` + `generateEndpoint()` axios
  wrapper
- `useEndpoints.ts`: `useGenerateEndpoint(name)` mutation hook
- `FinnGenEndpointBrowserPage`: detail-drawer CTA replaced with
  `GeneratePanel`:
  - **Source picker** — derived value (no setState in effect): explicit
    user pick if any, else first source from `/api/v1/sources`
  - **Generate cohort button** — disabled while pending, shows
    "Dispatching…" during submission
  - **Optional overwrite checkbox** — uncheck by default
  - **CONTROL_ONLY / UNMAPPED guard** — endpoints with no resolvable
    concepts show a notice instead of the picker, with a manual
    "Use in Workbench" link as fallback
  - **Error banner** — surfaces backend message on failure
  - **Success** — navigates to `/workbench/finngen-analyses?run={id}`
    so researchers see the standard run-tail UI with progress + summary

## Honest gaps

- The success redirect goes to the FinnGen analyses page rather than a
  dedicated "this endpoint × this source" view. A future iteration
  could show a compact "Generation history" tab in the endpoint detail
  drawer (`GET /finngen/endpoints/{name}/generations` listing all runs
  + cohort row counts per source).
- No tracking table records which (endpoint × source) pairs have been
  generated. Today the truth lives in `{source}_results.cohort` and
  has to be inferred. A `app.finngen_endpoint_generations` sidecar
  with `(endpoint_name, source_key, run_id, subject_count, generated_at)`
  would let the browser show "Available on: PANCREAS / SYNPUF" badges
  per row.
- The "expected_concept_counts" in the API response (cond/drug/source)
  could power a confidence indicator in the UI ("This endpoint will
  search for matches across 41 conditions + 55 drugs"). Cheap follow-up.
- ICD-8 endpoints (~25% of catalog) still can't generate — sources have
  no ICD-8 concept_ids in their condition_source_concept_id columns.
  Closing that gap requires loading Finnish ICD-8 as a custom OMOP
  vocabulary (separate task).

## How to use

```bash
# Production page
https://parthenon.acumenus.net/workbench/finngen-endpoints

# 1. Find an endpoint (search "diabetes" or filter by tag #E4)
# 2. Click the row → detail drawer
# 3. In the GeneratePanel at the bottom: pick PANCREAS / IRSF / etc.
# 4. Click "Generate cohort →"
# 5. You're redirected to the run page; on success, the cohort exists
#    in {source_results}.cohort with the same cohort_definition_id

# Direct API
curl -X POST https://parthenon.acumenus.net/api/v1/finngen/endpoints/E4_DM2/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source_key":"PANCREAS","overwrite_existing":false}'
```

## References

- Genomics #1: `docs/devlog/modules/finngen/genomics-01-endpoint-import.md`
- Genomics #1.5: `docs/devlog/modules/finngen/genomics-01b-resolver-fixes-and-browser.md`
- Source: `darkstar/api/finngen/cohort_ops.R::finngen_endpoint_generate_execute`
- Live runs: `01kpcdzv562fmf5efm4nkv4xfc` (local), `01kpce3rz43x40n9rhdfhvpmd4` (prod)
