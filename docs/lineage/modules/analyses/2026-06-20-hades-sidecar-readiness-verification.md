---
doc_type: lineage
status: historical
date: 2026-06-20
owner: acumenus
module: analyses
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/app/Services/RService.php
  - backend/app/Services/Analysis/EstimationService.php
  - backend/app/Services/Analysis/PredictionService.php
  - backend/app/Services/Analysis/SccsService.php
  - backend/app/Services/Analysis/EvidenceSynthesisService.php
  - backend/tests/Unit/Services/RServiceTest.php
  - backend/tests/Feature/Api/V1/DarkstarContractTest.php
  - darkstar/api/evidence_synthesis.R
related_prs: []
---
# HADES / Darkstar Sidecar Readiness Verification

**Date:** 2026-06-20
**Context:** Production-readiness roadmap item **A2 — HADES/Darkstar analytics
proven end-to-end.** Records local verification that the R statistical sidecar
is functional, the real `/analysis/*/run` endpoints are implemented (not stubs),
and at least one HADES method executes end-to-end. Hosted-staging verification
remains a separate A2 task.

## Package readiness (`GET /hades/packages`)

```
status: complete · parity_status: ready · freshness_status: current
total: 40 · installed: 40 · missing: 0
required: 25 · required_missing: 0 · required_outdated: 0
current: 38 · outdated: 0 · ahead: 2 (Cyclops, BrokenAdaptiveRidge)
release_profile: 2026Q1 (OHDSI HADES-wide release renv.lock)
```

All required HADES packages are installed and at the pinned 2026Q1 release
profile. No required package is missing or outdated.

## Endpoint implementation (live probe, empty body)

The real `RService` endpoints all respond with **input validation (HTTP 400)**,
not `not_implemented` (HTTP 501) — i.e. they are implemented and validating,
not stubs. (The `/stubs/*` 501 endpoints in `darkstar/api/stubs.R` are a
separate legacy surface that `RService` does not call.)

| Endpoint (`POST /analysis/{x}/run`) | Empty-body response |
|---|---|
| `estimation/run` | 400 "Missing required fields: source, cohorts, model" |
| `prediction/run` | 400 "Missing required fields: source, cohorts, model" |
| `sccs/run` | 400 "Missing: source, cohorts" |
| `self-controlled-cohort/run` | 400 "Missing required fields: source, cohorts" |
| `evidence-synthesis/run` | 400 "At least 2 site estimates are required" |
| `phenotype-validation/run` | 400 "counts is required" |

## End-to-end execution proof (evidence synthesis)

Evidence synthesis runs `EvidenceSynthesis::computeFixedEffectMetaAnalysis` on
provided site estimates with no CDM scan, making it a fast, deterministic
end-to-end check of the HADES compute path. A real call with three synthetic
site estimates returned **HTTP 200** with a correct fixed-effect meta-analysis:

```
input:  logRr/seLogRr = (0.10/0.05), (0.20/0.07), (0.15/0.06)
output: pooled log_rr 0.1389, se 0.0337, HR 1.149, 95% CI [1.0756, 1.2274]
        elapsed 0.7s
```

The pooled estimate matches the inverse-variance weighted mean by hand
(0.1389) and pooled SE (0.0337), confirming the HADES `EvidenceSynthesis`
package executed correctly through Darkstar — not a stub or echo.

## RService contract hardening

`RService::runEstimation`, `runSccs`, and `runEvidenceSynthesis` returned
`$response->json()` with no null fallback (the other runners already coalesced
to an error array). A non-JSON error body (e.g. a proxy 502) returned `null`,
which TypeError'd when the calling service passed it to
`isNotImplemented(array $result)`. All runners now uniformly coalesce to
`['status' => 'error', 'message' => '… (HTTP <code>) …']` with an actionable
hint naming the relevant HADES package.

`tests/Unit/Services/RServiceTest.php` pins the sidecar contract hermetically
(via `Http::fake`, no live Darkstar) for all six runners across success,
sidecar-error/invalid-input, legacy `not_implemented`, empty/non-JSON body, and
connection-failure states. `DarkstarContractTest.php` continues to cover the
live `/health` shape (skipping when Darkstar is absent).

## Decision: `r_not_implemented`

**Retained** as a defensive compatibility fallback. Darkstar now implements all
six analysis endpoints, so the `not_implemented` detection is effectively dead
in a correctly-provisioned deployment; it is kept to fail safe (mark the
execution Failed with an actionable message rather than record an empty
"completed" result) should a future deployment lack a specific HADES package.

## Remaining for A2

- Full real-data execution of CohortMethod (estimation) and
  PatientLevelPrediction (prediction) against a CDM source — heavier, requires
  generated cohorts; deferred from this local verification.
- Hosted-staging readiness verification (the same probes against the staging
  Darkstar), to be recorded when staging access is available.
