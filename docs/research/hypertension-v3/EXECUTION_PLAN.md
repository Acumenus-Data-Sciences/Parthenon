---
doc_type: research
status: active
date: 2026-05-12
owner: acumenus
module: hypertension-v3
lineage_anchor: true
supersedes: []
superseded_by: null
related_code: []
related_prs: []
---

# Hypertension v3 — Detailed Execution Plan

**Target study:** `hypertension-study-v3-2` (already created)
**Workbench URL:** https://parthenon.acumenus.net/studies/hypertension-study-v3-2?tab=design
**Companion document:** [`CLAUDE_PROMPT.md`](./CLAUDE_PROMPT.md) — protocol-level scope, acceptance criteria, open questions.

This plan drives the v3 study through the **Study Designer** using the exact same API surface the FE workbench drives. Every step here is something a human user could perform by clicking through the workbench panels — the agent simply automates the click-path. **No service-layer back-door writes.**

---

## 0 — Why this exists

The original prompt asked the agent to write directly to `study_design_assets` and call materializers in a seeder. That works, but it bypasses RBAC, audit events (`study_design_ai_events`), the lock-readiness gate, the cohort-readiness gate, the feasibility cohort-generation pipeline, and the executeAll dispatcher. Worse, anything created that way is invisible to the workbench panels in unexpected ways (asset_type, role, status, version_id must match exactly what the panels filter on).

**This plan goes through the controller.** Each phase is one or more HTTP requests with payloads the FE would send. The agent's Artisan command (`php artisan study:htn-v3 --action=<phase>`) is a thin shell that calls the controller via the route handler — it does **not** bypass it.

---

## 1 — Workbench panel ↔ API endpoint map

Panel order in `frontend/src/features/studies/components/StudyDesignWorkbench.tsx` lines 256–342:

| # | Workbench panel | Primary endpoints (FE → BE) | Service backing |
|---|---|---|---|
| 1 | `StudyCompilerGuidancePanel` | `GET .../versions/{v}/guidance` | `StudyDesignGuidanceService` |
| 2 | `IntentReviewPanel` | `PUT .../versions/{v}`, `POST .../versions/{v}/accept` | `StudyIntentService` |
| 3 | `BottomUpCompatibilityPanel` | `POST .../import-existing`, `POST .../versions/{v}/critique` | `StudyDesignCritiqueService` |
| 4 | `PhenotypeRecommendationPanel` | `POST .../versions/{v}/phenotypes/recommend`, `POST .../assets/{a}/review` | `StudyPhenotypeRecommendationService` |
| 5 | `ConceptSetDraftPanel` | `POST .../versions/{v}/concept-sets/draft`, `POST .../versions/{v}/concept-sets/verify`, `POST .../assets/{a}/concept-sets/verify`, `PUT .../assets/{a}/concept-sets/draft`, `POST .../assets/{a}/concept-sets/materialize` | `StudyConceptSetDraftService` / `Verifier` / `Materializer` |
| 6 | `CohortDraftPanel` | `POST .../versions/{v}/cohorts/draft`, `GET .../versions/{v}/cohorts/readiness`, `POST .../assets/{a}/cohorts/verify`, `PUT .../assets/{a}/cohorts/draft`, `POST .../assets/{a}/cohorts/materialize`, `POST .../assets/{a}/cohorts/link-to-study` | `StudyCohortDraftService` / `Verifier` / `Materializer` / `RoleLinker` |
| 7 | `FeasibilityDashboard` | `POST .../versions/{v}/feasibility/run` | `StudyFeasibilityService` |
| 8 | `AnalysisPlanPanel` | `POST .../versions/{v}/analysis-plans/draft`, `POST .../assets/{a}/analysis-plans/verify`, `POST .../assets/{a}/analysis-plans/materialize` | `StudyAnalysisPlanService` / `Verifier` / `Materializer` |
| 9 | `StudyDesignLockPanel` | `GET .../versions/{v}/lock-readiness`, `POST .../versions/{v}/lock` | `StudyDesignLockService` |
| 10 | (Top-of-study) `executeAll` | `POST /studies/{study}/execute` | `StudyService::executeAll` |

All endpoints route through `auth:sanctum` + `permission:studies.view|create|execute`.

---

## 2 — Pre-flight: environment & identity (run once)

```bash
# Sanity
docker compose ps
php artisan migrate:status | tail -5

# Resolve canonical IDs into shell env
export STUDY_SLUG="hypertension-study-v3-2"
export API_BASE="https://parthenon.acumenus.net/api/v1"

# Source: Acumenus OMOP
SOURCE_ID=$(docker compose exec -T php php artisan tinker --execute="echo App\Models\App\Source::where('source_key','omop')->value('id');" | tr -d '[:space:]')
export OMOP_SOURCE_ID="$SOURCE_ID"

# Acquire a Sanctum token for an account with studies.execute
# Recommended: use the dedicated study-runner role, NOT super-admin
TOKEN=$(curl -fsS -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"<runner-email>","password":"<password>"}' \
  | jq -r '.data.token')
export TOK="Authorization: Bearer $TOKEN"
```

**Verification:** `curl -s -H "$TOK" "$API_BASE/auth/user" | jq '.data.email'` returns the runner email; `permission:studies.execute` is in the response permissions list.

---

## 3 — Phase 1: Discover the study and its design session

```bash
# Fetch study (uses route-model binding via slug)
STUDY_JSON=$(curl -fsS -H "$TOK" "$API_BASE/studies/$STUDY_SLUG")
STUDY_ID=$(echo "$STUDY_JSON" | jq -r '.data.id')

# Existing design sessions
SESSIONS=$(curl -fsS -H "$TOK" "$API_BASE/studies/$STUDY_ID/design-sessions")
SESSION_ID=$(echo "$SESSIONS" | jq -r '.data[0].id // empty')

# If none, create one
if [ -z "$SESSION_ID" ]; then
  SESSION_ID=$(curl -fsS -X POST -H "$TOK" -H "Content-Type: application/json" \
    "$API_BASE/studies/$STUDY_ID/design-sessions" \
    -d '{"title":"HTN v3 (Bock) Design","source_mode":"study_designer"}' \
    | jq -r '.data.id')
fi

# Existing versions
VERSIONS=$(curl -fsS -H "$TOK" "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/versions")
VERSION_ID=$(echo "$VERSIONS" | jq -r '.data | sort_by(.version_number) | last.id // empty')
```

**UI verification:** open `https://parthenon.acumenus.net/studies/$STUDY_SLUG?tab=design`. The session pill shows up; if a version exists, it shows `v{n} · <status>`. Capture the session/version IDs to `docs/research/hypertension-v3/reports/preflight.md`.

**Idempotency contract:** subsequent runs reuse `$SESSION_ID` and `$VERSION_ID`.

**Checkpoint:** confirm session + at least a draft version exists before Phase 2.

---

## 4 — Phase 2: Intent (IntentReviewPanel)

If `$VERSION_ID` is empty, create a first version via `generateIntent` (uses `StudyIntentService` to seed the version's `intent_json`):

```bash
INTENT_PAYLOAD='{
  "research_question": "Does diagnostic delay in incident hypertension predict worse cardiovascular and renal outcomes, and does it identify resistant-HTN candidates for advanced therapy?",
  "pico": {
    "population": "Adults ≥18 with two consecutive elevated office BPs and no prior CVD/CKD/thyroid disease and no prior antihypertensive exposure",
    "intervention": "Time from elevated BP to recorded HTN diagnosis (latency)",
    "comparator": "Matched normotensive cohort",
    "outcome": "MACE composite and incident CKD"
  },
  "design_type": "retrospective_outcomes",
  "study_period": {"start": null, "end": null, "max_followup_days": 1825}
}'

VERSION_ID=$(curl -fsS -X POST -H "$TOK" -H "Content-Type: application/json" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/intent" \
  -d "$INTENT_PAYLOAD" | jq -r '.data.id')
```

If a version exists, edit instead of recreate:

```bash
curl -fsS -X PUT -H "$TOK" -H "Content-Type: application/json" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/versions/$VERSION_ID" \
  -d "{\"intent_json\": $INTENT_PAYLOAD}"

curl -fsS -X POST -H "$TOK" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/versions/$VERSION_ID/accept"
```

**Open questions:** seed each row from `CLAUDE_PROMPT.md §12` as an asset via the workbench's free-form asset path. There is no first-class "open question" panel, so use:

```bash
# For each open question:
curl -fsS -X POST -H "$TOK" -H "Content-Type: application/json" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/versions/$VERSION_ID/critique" \
  -d "{}"   # triggers deterministic critique; open questions surface as design_critique assets
```

The `BottomUpCompatibilityPanel` will render these as critique items needing review. For protocol-specific open questions not captured by the critique service, fall back to writing `study_design_assets` rows with `asset_type='open_question'` directly via a seeder — this is the **one** sanctioned bypass, and it still shows up in the workbench because the assets endpoint returns all asset_types for the version.

**Checkpoint:** version status reaches `accepted` (Intent panel shows green); `BottomUpCompatibilityPanel` shows the critique findings.

---

## 5 — Phase 3: Phenotype recommendations (PhenotypeRecommendationPanel)

```bash
curl -fsS -X POST -H "$TOK" -H "Content-Type: application/json" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/versions/$VERSION_ID/phenotypes/recommend" \
  -d '{}'
```

This calls `StudyPhenotypeRecommendationService::recommend()` which proposes phenotype assets based on the intent (likely tied to the OHDSI phenotype library — 1,100 definitions per project CLAUDE.md). The agent reviews each:

```bash
# List assets created in this phase
ASSETS=$(curl -fsS -H "$TOK" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/assets?version_id=$VERSION_ID" \
  | jq '.data[] | select(.asset_type == "phenotype_recommendation")')

# Approve/reject each
for ASSET_ID in $(echo "$ASSETS" | jq -r '.id'); do
  curl -fsS -X POST -H "$TOK" -H "Content-Type: application/json" \
    "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/assets/$ASSET_ID/review" \
    -d '{"decision":"accepted","notes":"matches HTN v3 protocol"}'
done
```

**Decision rule:** accept phenotypes that match the §5 concept-set table of `CLAUDE_PROMPT.md`; reject duplicates and items outside protocol scope.

**Checkpoint:** all phenotype assets either `accepted` or `rejected`; workbench panel shows zero `needs_review` rows.

---

## 6 — Phase 4: Concept sets (ConceptSetDraftPanel)

For each of the 28 concept sets listed in `CLAUDE_PROMPT.md §5`, build a single bulk-draft request grouped by role (the controller validates `role` against `population|exposure|intervention|comparator|outcome|exclusion|subgroup`). Map protocol roles → API roles:

| Protocol set prefix | API `role` |
|---|---|
| `dx_essential_hypertension`, `dx_secondary_hypertension`, `dx_primary_aldosteronism` | `population` (essential) / `exclusion` (secondary, aldosteronism) |
| `dx_ckd`, `dx_mi`, `dx_stroke`, `dx_heart_failure` | `outcome` |
| `dx_thyroid_disease`, `dx_prior_cv_disease`, `dx_abnormal_kidney_function` | `exclusion` |
| `lab_*` | `exposure` (BP) / `exposure` (lab utilization) |
| `rx_*` | `exclusion` (treatment-naive) / `subgroup` (resistant-HTN regimen classes) |
| `proc_renal_denervation` | `subgroup` |
| `device_*` | `subgroup` |

### 6.1 Build the draft payload

For each concept set: resolve concept IDs against `vocab.concept` (do not hard-code), expand class concepts with `vocab.concept_ancestor`. Reference SQL:

```sql
-- Example: essential HTN descendants (run via php artisan tinker or psql)
SELECT c.concept_id, c.concept_name, c.standard_concept
FROM vocab.concept c
JOIN vocab.concept_ancestor ca ON ca.descendant_concept_id = c.concept_id
WHERE ca.ancestor_concept_id = 320128  -- Essential hypertension SNOMED
  AND c.standard_concept = 'S'
  AND c.domain_id = 'Condition'
  AND c.invalid_reason IS NULL;
```

### 6.2 Submit the bulk draft

```bash
# One request per role-group; example for `exclusion` (treatment-naive antihypertensives)
DRAFTS_JSON=$(cat <<'JSON'
{
  "role": "exclusion",
  "drafts": [
    {
      "title": "rx_antihypertensives_all",
      "role": "exclusion",
      "domain": "Drug",
      "clinical_rationale": "Any prior antihypertensive use disqualifies treatment-naive cohort",
      "search_terms": ["antihypertensive","ATC C02","ATC C03","ATC C07","ATC C08","ATC C09"],
      "concepts": [
        {"concept_id": 21601461, "is_excluded": false}
      ]
    }
  ]
}
JSON
)

curl -fsS -X POST -H "$TOK" -H "Content-Type: application/json" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/versions/$VERSION_ID/concept-sets/draft" \
  -d "$DRAFTS_JSON"
```

### 6.3 Verify all in version, then per-asset

```bash
# Bulk verify
curl -fsS -X POST -H "$TOK" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/versions/$VERSION_ID/concept-sets/verify"

# Per-asset re-check (after edits)
for ASSET_ID in $(curl -fsS -H "$TOK" \
    "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/assets?version_id=$VERSION_ID" \
    | jq -r '.data[] | select(.asset_type=="concept_set") | .id'); do
  curl -fsS -X POST -H "$TOK" \
    "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/assets/$ASSET_ID/concept-sets/verify"
done
```

### 6.4 Edit & re-verify any blocked drafts

For each asset with `verification_status='blocked'`, inspect `verification_json.blocking_reasons` and PATCH the payload:

```bash
curl -fsS -X PUT -H "$TOK" -H "Content-Type: application/json" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/assets/$ASSET_ID/concept-sets/draft" \
  -d "$FIXED_DRAFTS_JSON"
```

### 6.5 Materialize each verified draft

```bash
for ASSET_ID in $(curl -fsS -H "$TOK" \
    "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/assets?version_id=$VERSION_ID" \
    | jq -r '.data[] | select(.asset_type=="concept_set" and .verification_status=="verified") | .id'); do
  curl -fsS -X POST -H "$TOK" \
    "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/assets/$ASSET_ID/concept-sets/materialize"
done
```

**UI verification:** ConceptSetDraftPanel shows all 28 entries with green "verified" + materialized badges; the workbench links each to its canonical `concept_sets` row.

**Checkpoint:** all 28 sets verified and materialized; zero `needs_review` or `blocked` rows.

---

## 7 — Phase 5: Cohorts (CohortDraftPanel)

`CLAUDE_PROMPT.md §6` defines T, C, S1, S2, O1, O2. Each maps to a draft submission. The controller validates the cohort role against the `study_cohorts.role` enum (`target | comparator | outcome | exclusion | subgroup | event`).

### 7.1 Draft

For each cohort, submit a `DraftStudyCohortsRequest`-shaped payload. The exact field shape lives in `backend/app/Http/Requests/StudyDesign/DraftStudyCohortsRequest.php`; read it first to align on field names. Common skeleton:

```bash
COHORT_T='{
  "drafts": [{
    "title": "Incident HTN, treatment-naive (T)",
    "role": "target",
    "description": "Adults ≥18 with two consecutive elevated BPs, treatment-naive",
    "concept_set_refs": [
      {"role":"index_event_sbp","concept_set_id": <materialized lab_sbp id>},
      {"role":"index_event_dbp","concept_set_id": <materialized lab_dbp id>},
      {"role":"diagnosis","concept_set_id": <materialized dx_essential_hypertension id>},
      ...
    ],
    "parameters": {
      "min_bp_count": 3,
      "lookback_days": 730,
      "max_gap_between_consecutive_bps_days": 365,
      "min_age_years": 18,
      "bp_threshold_operator": ">"   // pending Dr. Bock; switch to ">=" per AHA 2017
    },
    "expression_json": { ... Circe-style index/inclusion/exclusion ... }
  }]
}'

curl -fsS -X POST -H "$TOK" -H "Content-Type: application/json" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/versions/$VERSION_ID/cohorts/draft" \
  -d "$COHORT_T"
```

Repeat for C (`comparator`), S1 (`subgroup`), S2 (`subgroup`), O1 (`outcome`), O2 (`outcome`).

### 7.2 Verify, materialize, link-to-study

For each cohort asset:

```bash
# Verify
curl -fsS -X POST -H "$TOK" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/assets/$ASSET_ID/cohorts/verify"

# Materialize → cohort_definitions row
curl -fsS -X POST -H "$TOK" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/assets/$ASSET_ID/cohorts/materialize"

# Link → study_cohorts row with the correct role
curl -fsS -X POST -H "$TOK" -H "Content-Type: application/json" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/assets/$ASSET_ID/cohorts/link-to-study" \
  -d '{"role":"target","label":"Incident HTN, treatment-naive","sort_order":1}'
```

### 7.3 Check readiness

```bash
curl -fsS -H "$TOK" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/versions/$VERSION_ID/cohorts/readiness" \
  | jq '.data'
```

The response includes `ready_for_feasibility` — required to be `true` before Phase 6.

**UI verification:** CohortDraftPanel shows all six cohorts in green; `cohorts/readiness` returns ready=true; the `Cohorts` tab on the study page lists T/C/S1/S2/O1/O2.

**Checkpoint:** `ready_for_feasibility=true` AND every cohort asset is `verified` + materialized + linked.

---

## 8 — Phase 6: Feasibility / cohort generation (FeasibilityDashboard)

The Study Designer wraps cohort generation in the **feasibility** step. This is where the Acumenus `omop` source binding happens.

```bash
curl -fsS -X POST -H "$TOK" -H "Content-Type: application/json" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/versions/$VERSION_ID/feasibility/run" \
  -d "{\"source_ids\":[$OMOP_SOURCE_ID],\"min_cell_count\":5}"
```

`StudyFeasibilityService::run()` dispatches cohort generation jobs (visible in Horizon at `/horizon`). The response includes a feasibility asset; the dashboard refreshes via `cohorts/readiness` polling.

**UI verification:**
- FeasibilityDashboard shows per-cohort counts.
- Horizon dashboard shows the dispatched cohort-generation jobs.
- T, C, O1, O2 counts are non-zero; S1 small but non-zero; S2 may be zero (record as expected).

**Checkpoint:** feasibility asset `verification_status='verified'`; counts logged to `docs/research/hypertension-v3/reports/feasibility.md`.

---

## 9 — Phase 7: Analysis plans (AnalysisPlanPanel)

`CLAUDE_PROMPT.md §8` lists 12 analyses (A–L). The draft endpoint takes `analysis_types[]`. Submit them as a batch:

```bash
ANALYSIS_TYPES='{
  "analysis_types": [
    "cohort_characterization",
    "prevalence",
    "diagnostic_latency_survival",
    "treatment_trajectory",
    "resistant_htn_composition",
    "lu_replication",
    "mace_incidence",
    "ckd_incidence",
    "rdn_eligibility",
    "baseline_lab_ordering",
    "geographic_stratification",
    "cost_heor"
  ]
}'

curl -fsS -X POST -H "$TOK" -H "Content-Type: application/json" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/versions/$VERSION_ID/analysis-plans/draft" \
  -d "$ANALYSIS_TYPES"
```

> **Confirm before run:** the canonical taxonomy of `analysis_type` strings recognized by `StudyAnalysisPlanService::draft()` may differ from the protocol labels above. Read `backend/app/Services/StudyDesign/StudyAnalysisPlanService.php` to align — the controller blindly forwards the list.

Then for each created asset:

```bash
for ASSET_ID in $(curl -fsS -H "$TOK" \
    "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/assets?version_id=$VERSION_ID" \
    | jq -r '.data[] | select(.asset_type=="analysis_plan") | .id'); do
  curl -fsS -X POST -H "$TOK" \
    "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/assets/$ASSET_ID/analysis-plans/verify"
  curl -fsS -X POST -H "$TOK" \
    "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/assets/$ASSET_ID/analysis-plans/materialize"
done
```

Materialization writes a `study_analyses` polymorphic-link row pointing to the domain analysis row.

**UI verification:** AnalysisPlanPanel shows all 12 entries verified + materialized; the study's `Analyses` tab lists them all.

**Checkpoint:** every drafted analysis plan is materialized; SAP artifact persisted (covered in Phase 9 lock).

---

## 10 — Phase 8: Lock (StudyDesignLockPanel)

```bash
# Pre-flight: confirm lock-readiness
READINESS=$(curl -fsS -H "$TOK" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/versions/$VERSION_ID/lock-readiness")
echo "$READINESS" | jq '.data'
# Should report ready=true with all gates green

# Lock with optimistic concurrency control
UPDATED_AT=$(curl -fsS -H "$TOK" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/versions/$VERSION_ID" \
  | jq -r '.data.updated_at')

curl -fsS -X POST -H "$TOK" -H "Content-Type: application/json" \
  "$API_BASE/studies/$STUDY_ID/design-sessions/$SESSION_ID/versions/$VERSION_ID/lock" \
  -d "{\"if_unmodified_since\":\"$UPDATED_AT\"}"
```

**UI verification:** the version pill flips to `locked`; the workbench refuses further drafts/edits; a "Locked v{n}" badge appears in the header.

**Checkpoint:** version `status='locked'`; lock asset persisted (often emitted as a `study_artifacts` row of `artifact_type='sap'`).

---

## 11 — Phase 9: Execute (top-of-study, not workbench)

```bash
# Dispatch all materialized analyses against Acumenus omop
curl -fsS -X POST -H "$TOK" -H "Content-Type: application/json" \
  "$API_BASE/studies/$STUDY_ID/execute" \
  -d "{\"source_id\":$OMOP_SOURCE_ID}"

# Poll progress
until curl -fsS -H "$TOK" "$API_BASE/studies/$STUDY_ID/progress" | jq -e '.data.all_completed == true' > /dev/null; do
  sleep 15
  echo "still running: $(curl -fsS -H "$TOK" "$API_BASE/studies/$STUDY_ID/progress" | jq -c '.data.summary')"
done
```

`StudyService::executeAll($study, $source)` creates one `study_executions` row per analysis with `execution_params.source_id = $OMOP_SOURCE_ID` and dispatches the appropriate engine (`hades_r`, `strategic_sql`, `python_fastapi`). Result tables land in `results.htn_v3_*` (the Acumenus source's results daimon).

**UI verification:**
- Study page `Progress` tab streams each analysis through queued → running → completed.
- `Results` tab populates as each completes.
- Horizon shows the dispatched jobs.

**Checkpoint:** every `study_executions` row reaches `status='completed'` with a non-null `result_hash`.

---

## 12 — Phase 10: Report (post-execution, write to docs)

Once executions are complete:

```bash
# Pull results JSON
curl -fsS -H "$TOK" "$API_BASE/studies/$STUDY_ID/analyses" \
  | jq '.data[] | {analysis_type, result_summary: .analysis.result_summary}' \
  > docs/research/hypertension-v3/results/analyses-summary.json
```

Generate the HTML report via the existing `Services/Publication` pipeline (the FE has a "Publish" feature at `frontend/src/features/publish/` — use its API surface rather than hand-rolling HTML). Persist the report as a `study_artifacts` row:

```bash
# Upload via existing study artifacts endpoint (path varies; check backend/routes/api.php near StudyArtifactController)
curl -fsS -X POST -H "$TOK" -F "file=@docs/research/hypertension-v3/reports/htn_v3_report.html" \
  -F "artifact_type=results_report" -F "title=Hypertension v3 Outcomes Report" \
  -F "is_current=true" \
  "$API_BASE/studies/$STUDY_ID/artifacts"
```

**UI verification:** the study's `Artifacts` tab lists the report; `Results` tab links to it.

---

## 13 — Acceptance gates (rolled up from `CLAUDE_PROMPT.md §13`)

The plan is complete when:

1. Workbench shows version status `locked` and the study transitions to `in_progress` / `run_complete`.
2. ConceptSetDraftPanel: 28 concept sets, all `verified`, all materialized.
3. CohortDraftPanel: 6 cohorts (T, C, S1, S2, O1, O2), all verified/materialized/linked, `cohorts/readiness.ready_for_feasibility=true`.
4. FeasibilityDashboard: T, C, O1, O2 counts non-zero; S1 small but non-zero; S2 zero acceptable.
5. AnalysisPlanPanel: 12 analyses materialized (down-scope ahead of time if `StudyAnalysisPlanService` doesn't recognize a label — note in `open-questions.md`).
6. StudyDesignLockPanel: `lock-readiness.ready=true`, version `locked`.
7. Progress tab: every `study_executions` row `completed`.
8. Artifacts tab: results_report artifact `is_current=true`.
9. CI: `make lint`, `make test`, `npx vite build`, `phpstan analyse` all green on touched files.

---

## 14 — Idempotency & re-run safety

- Every phase's first action is a discovery query. Re-running uses existing IDs.
- The agent MUST NOT create new sessions/versions/assets when matching ones exist by role + version.
- Cohort generation is naturally non-idempotent (each run creates a new `cohort_generation_id`). Pin the canonical generation in `studies.metadata.canonical_generations` after Phase 6 and use that for Phase 9 execution params.
- Locked versions reject all draft/edit endpoints — the workbench surfaces "Locked v{n} — generate a new draft version first" guidance. If a re-run is needed after lock, create a v{n+1} draft (`POST .../design-sessions/{session}` re-uses session, or use the existing un-lock-by-fork pattern in `StudyDesignLockService`).

---

## 15 — What the agent does NOT do

- **No direct writes** to `study_design_assets`, `concept_sets`, `cohort_definitions`, `study_cohorts`, `study_analyses`, or `study_executions` outside the documented endpoints. The one sanctioned exception is `open_question` assets in Phase 2 if the deterministic critique service doesn't surface them.
- **No `php artisan migrate`** in this plan — schema is assumed in place. If a migration is needed, surface it as a separate PR and pause.
- **No DELETE** without explicit confirmation. If a draft must be retired, mark it via `review` with `decision='rejected'`.
- **No bypass of `auth:sanctum`** — every request carries the runner token.
- **No bypass of CdmModel** — all clinical reads go through OMOP/vocab connection routes the controllers already use.

---

## 16 — Run command (one phase per invocation)

```bash
# Each invocation runs ONE phase and stops
./scripts/htn-v3/run.sh preflight
./scripts/htn-v3/run.sh discover
./scripts/htn-v3/run.sh intent
./scripts/htn-v3/run.sh phenotypes
./scripts/htn-v3/run.sh concept-sets
./scripts/htn-v3/run.sh cohorts
./scripts/htn-v3/run.sh feasibility
./scripts/htn-v3/run.sh analysis-plans
./scripts/htn-v3/run.sh lock
./scripts/htn-v3/run.sh execute
./scripts/htn-v3/run.sh report
```

The shell script wraps the curl commands above with envar resolution, response logging to `docs/research/hypertension-v3/reports/<phase>.json`, and a checkpoint gate (`exit 1` on failure so the agent stops cleanly).

End of plan.
