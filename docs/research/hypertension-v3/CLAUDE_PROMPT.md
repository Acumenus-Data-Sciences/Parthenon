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

# Claude-Code Prompt — Hypertension v3 Outcomes Study

**Protocol:** "The failure of hypertension interventions in a large study population (V3)"
**PI:** Glenn H. Bock, MD — 2026-04-17
**Use case:** Demo outcomes use case — retrospective
**Target platform:** Parthenon (OMOP CDM v5.4, schema-isolated) — single data source: the Acumenus OHDSI CDM (`omop` schema, `omop` connection). No other CDM is used in this study.
**Owner agent:** claude-code, run from the Parthenon repo root.

> **Revision note (2026-05-12):** technical-deficit pass #1 applied — service and table references aligned to actual repo schema; execution restructured into checkpointed phases. Clinical-deficit pass pending Dr. Bock review (see §12).

---

## How to use this prompt

Open this file in `claude-code` while sitting at the root of the `Parthenon` repository, then issue:

```
/clear
Read docs/research/hypertension-v3/CLAUDE_PROMPT.md and execute --action=preflight only.
After preflight, STOP and report. Do not proceed to the next phase without explicit go-ahead.
```

claude-code MUST follow `.claude/CLAUDE.md`, `.claude/rules/HIGHSEC.spec.md`, and `.claude/rules/auth-system.md`. It MUST use the Parthenon Brain MCP (`parthenon-brain`) before introducing any new pattern, and it MUST run Pint (Docker), PHPStan, `tsc --noEmit`, and `npx vite build` after touching backend/frontend code.

**One phase per invocation.** Each `--action` is a checkpoint. The agent stops, reports, and waits for go-ahead before the next phase. This is non-negotiable and matches the anti-drift rules in `.claude/CLAUDE.md`.

---

## 0 — Mission

Implement, persist, and execute the Hypertension v3 outcomes study inside Parthenon as a fully reproducible study package: concept sets, cohort definitions, analyses, outcomes, and a publishable HTML report. Reproduce the Lu et al. 2025 finding (median 16–18-month diagnostic delay; 29% higher CV risk score when delay > 1 year) and extend it with:

1. CKD as a co-equal outcome with MACE.
2. Two-component diagnostic latency (first-elevated → second-elevated, second-elevated → recorded Dx).
3. A baseline-lab ordering analysis including serum aldosterone.
4. A resistant-HTN class-composition breakdown.
5. A renal-sympathetic-denervation eligibility estimate.

All work persists through the **actual** StudyDesign infrastructure: `study_design_sessions`, `study_design_versions`, `study_design_assets` (with `draft_payload_json` + `verification_status` + materialization back-pointer), and the canonical domain tables (`concept_sets`, `cohort_definitions`, `study_cohorts`, `study_analyses`, `study_executions`, `study_artifacts`). **Do not write directly to OMOP clinical schemas.** All clinical reads go through `CdmModel` against the source's `search_path`.

---

## 1 — Canonical persistence model (READ THIS FIRST)

The original v1 of this prompt referenced services and tables that don't exist. Use these actual entry points:

### 1.1 Studies (`app.studies`)

Columns: `id, name, description, study_type, author_id, status, metadata (jsonb), timestamps, soft_deletes`. There is **no** `key`, `pi`, `sources`, or `phi_review` column. Encode those in `metadata`:

```json
{
  "key": "htn-v3-bock-2026",
  "pi": {"name": "Glenn H. Bock, MD", "email": null},
  "sources": ["omop"],
  "phi_review": "required",
  "protocol_version": "v3",
  "lu_reference": {"doi": null, "pmid": null, "year": 2025, "status": "pending_pi_confirmation"}
}
```

### 1.2 Concept sets — actual workflow

The canonical flow is exposed by `StudyDesignController` and matches the `ConceptSetDraftPanel` in the workbench:

1. **Draft**: `POST /api/v1/studies/{study}/design-sessions/{session}/versions/{version}/concept-sets/draft` (controller `draftConceptSets`, service `StudyConceptSetDraftService`). Payload `{ role?, drafts: [{title, role, domain, clinical_rationale, search_terms[], concepts: [{concept_id, is_excluded?}]}] }`. Creates one `study_design_assets` row per draft (`asset_type='concept_set'`, `status='needs_review'`, `verification_status='unverified'`).
2. **Verify** (single): `POST /api/v1/.../assets/{asset}/concept-sets/verify` → runs `StudyConceptSetDraftVerifier::verify(payload)`. Or **verify-all**: `POST /api/v1/.../versions/{version}/concept-sets/verify`. The verifier flags invalid local IDs, missing concept IDs, non-standard concepts, domain mismatches. On pass: `verification_status='passed'` + `verification_json.checks`. On fail: `verification_status='blocked'` with reasons.
3. **Edit & re-verify** (if needed): `PUT /api/v1/.../assets/{asset}/concept-sets/draft` to update `draft_payload_json`, then re-verify.
4. **Materialize**: `POST /api/v1/.../assets/{asset}/concept-sets/materialize` → `StudyConceptSetMaterializer::materialize($asset, $userId)` writes the canonical `concept_sets` row and back-fills `materialized_type/id/at` on the asset.

`StudyConceptSetDraftService`, `StudyConceptSetDraftVerifier`, and `StudyConceptSetMaterializer` all exist in `backend/app/Services/StudyDesign/`. The Artisan command in §5 below is a thin shell that calls these endpoints in sequence; it MUST NOT bypass the controller (so RBAC and audit events fire identically to the UI path).

### 1.3 Cohorts (`app.cohort_definitions`, `app.study_cohorts`)

Use `StudyCohortDraftService` (real) to build a draft asset, run `StudyCohortDraftVerifier`, and `StudyCohortMaterializer::materialize($asset, $userId)` to write `cohort_definitions` and link via `study_cohorts`. The `study_cohorts.role` enum is **`target | comparator | outcome | exclusion | subgroup | event`** — use those exact values for T, C, O1, O2, S1, S2.

### 1.4 Analyses (`app.study_analyses` is polymorphic)

`study_analyses` columns are: `study_id, analysis_type, analysis_id, timestamps`. It is a polymorphic link, not the analysis itself. The actual analysis row lives in the domain table (e.g., `AchillesAnalysis`, `FeatureExtractionPackage`, `CohortMethodAnalysis`, custom R packages). Use `StudyAnalysisPlanService` → `StudyAnalysisPlanMaterializer` to register each analysis; the materializer returns the domain row, and the link row is written automatically.

### 1.5 Execution (`app.study_executions` is the source-aware unit)

Source binding does NOT live on `studies`. It lives on each execution:

```php
StudyExecution::create([
    'study_id' => $study->id,
    'study_analysis_id' => $studyAnalysis->id,
    'execution_engine' => 'hades_r' | 'strategic_sql' | 'python_fastapi' | 'custom',
    'execution_params' => [
        'source_id' => $omopSource->id,
        'source_key' => 'omop',
        'cdm_schema' => 'omop',
        'vocab_schema' => 'vocab',
        'results_schema' => $omopSource->daimon(DaimonType::RESULTS)->table_qualifier, // e.g., 'results'
        'parameters' => [...],
    ],
    'submitted_by' => $userId,
]);
```

For the Acumenus `omop` source, the resolved `results_schema` is `results`. Write per-study result tables as `{results_schema}.htn_v3_<artifact>` (e.g., `results.htn_v3_table1_demographics`).

### 1.6 Open questions

There is **no** `study_design_open_question` table. Open questions persist as `study_design_assets` rows with:

- `asset_type = 'open_question'`
- `role = '<short slug, e.g., antihypertensive_scope>'`
- `status = 'needs_review'`
- `draft_payload_json = { question, default, options, assignee, answered_at, answer }`
- `verification_status = 'unverified'` until answered, then `'passed'` with the answer in `verification_json`.

Materialization for `open_question` assets is a no-op (no canonical domain row); the asset itself is the record of truth.

### 1.7 Study artifacts (`app.study_artifacts`)

The `artifact_type` taxonomy is fixed in migration:
`protocol | sap | irb_submission | cohort_json | analysis_package_r | analysis_package_python | results_report | manuscript_draft | supplementary | presentation | data_dictionary | study_package_zip | other`.

Per-phase checkpoint status rows use `artifact_type = 'other'` with `metadata = { phase, status, ran_at, summary, next_phase }`.

---

## 2 — Phased execution model

This prompt defines **8 phases**. Each phase has explicit inputs, outputs, idempotency contract, acceptance criteria, and a checkpoint payload. The agent runs **one** phase per invocation, writes a `study_artifacts` row, and stops.

| # | Action | Inputs | Outputs | Checkpoint gate |
|---|--------|--------|---------|-----------------|
| 1 | `--action=preflight` | env | Brain query results + readiness report | Human go-ahead |
| 2 | `--action=scaffold` | preflight pass | `studies` row + `study_design_session` + open-question assets | Human go-ahead |
| 3 | `--action=concept-sets` | scaffold pass | `concept_sets` rows + verified assets for every set in §5 | All sets `verification_status = passed` |
| 4 | `--action=cohorts` | concept-sets pass | `cohort_definitions` + `study_cohorts` rows for T, C, S1, S2, O1, O2; latency derivations registered as cohort attributes | All cohort drafts verified |
| 5 | `--action=cohort-gen` | cohorts pass | `cohort_generation` per cohort on Acumenus `omop`; counts persisted | Non-zero T/C/O1/O2; S2 allowed zero with note |
| 6 | `--action=analyses` | cohort-gen pass | `study_analyses` polymorphic links + domain analysis rows + analysis-plan lock | Plan lock written to `study_artifacts` (`artifact_type = sap`) |
| 7 | `--action=run` | analyses pass | `study_executions` per analysis × Acumenus `omop`; result tables in `results.htn_v3_*` | All executions `status = completed`; result_hash recorded |
| 8 | `--action=report` | run pass | `reports/htn_v3_report.html` + PDF + `study_artifacts` row (`artifact_type = results_report`) | Report renders cleanly, badge resolved |

Idempotency contract for every phase: re-running MUST be a no-op if the previous run completed. Match by `studies.metadata.key` + asset `role`. The Artisan command is the single entry point: `php artisan study:htn-v3 --action=<phase> [--source=omop] [--dry-run]`.

---

## 3 — Phase 1: `--action=preflight`

1. `docker compose ps` — assert `php`, `postgres`, `redis`, `solr`, `r-runtime`, `python-ai`, `horizon`, `node` are `healthy`.
2. Resolve the Acumenus source: `Source::where('source_key', 'omop')->firstOrFail()`. Capture `id`, daimon mapping (must have CDM → `omop`, VOCABULARY → `vocab`, RESULTS → `results`).
3. Assert `omop` connection `search_path` is `omop,vocab,php` (via `DB::connection('omop')->select('SHOW search_path')`).
4. `SELECT count(*) FROM vocab.concept_ancestor` ≥ 100M (or note actual count if lower — do NOT block; many Acumenus deployments load a curated subset).
5. Parthenon Brain queries (`parthenon-brain` MCP). Capture top 5 results from each:
   - `chroma_query collection=parthenon_docs query="hypertension cohort definition OMOP"`
   - `chroma_query collection=parthenon_docs query="MACE outcome cohort Parthenon"`
   - `chroma_query collection=parthenon_docs query="resistant hypertension OMOP cohort"`
   - `chroma_query collection=parthenon_code query="StudyConceptSetMaterializer materialize"`
   - `chroma_query collection=parthenon_code query="CohortGenerationService SQL template OMOP"`
   - `chroma_query collection=parthenon_code query="EmpiricalCalibration negative control"`
6. List any reusable assets surfaced (e.g., an existing MACE concept set, an Achilles HTN characterization).

**Acceptance:** A `docs/research/hypertension-v3/reports/preflight.md` file is written with each check's result and reusable-asset shortlist. No code changes in this phase.

**Checkpoint:** Report to the user. **Do not proceed.**

---

## 4 — Phase 2: `--action=scaffold`

1. Run the migration check (`php artisan migrate:status`) — no pending migrations.
2. Idempotently create (or fetch) the Study via `HypertensionV3StudySeeder`:

```php
Study::firstOrCreate(
    ['name' => 'Failure of Hypertension Interventions in a Large Study Population (V3)'],
    [
        'description' => '...',
        'study_type' => 'retrospective_outcomes',
        'author_id' => $authorId,
        'status' => 'draft',
        'metadata' => [
            'key' => 'htn-v3-bock-2026',
            'pi' => ['name' => 'Glenn H. Bock, MD'],
            'sources' => ['omop'],
            'phi_review' => 'required',
            'protocol_version' => 'v3',
        ],
    ]
);
```

3. Create one `study_design_sessions` row anchored to the study, and a `study_design_versions` row (`version = 1`).
4. Seed all open questions from §12 as `study_design_assets` rows (`asset_type = 'open_question'`, `status = 'needs_review'`).
5. Write a `study_artifacts` checkpoint row (`artifact_type = 'other'`, metadata `phase = scaffold, status = ok`).

**Deliverables:**
- `backend/database/seeders/HypertensionV3StudySeeder.php` (idempotent).
- `backend/app/Console/Commands/StudyHtnV3.php` with `--action=<phase>` dispatch.

**Acceptance:** Re-running `php artisan study:htn-v3 --action=scaffold` produces zero new rows.

**Checkpoint:** Report row counts. **Do not proceed.**

---

## 5 — Phase 3: `--action=concept-sets`

Walk each concept set through the §1.2 workflow. **Every set MUST pass `StudyConceptSetDraftVerifier` before materialization.** Use SNOMED, RxNorm, LOINC, and HCPCS as appropriate; expand class-level concepts with `vocab.concept_ancestor`.

| Key (asset.role) | Vocabulary | Description |
|---|---|---|
| `dx_essential_hypertension` | SNOMED | I10 / SNOMED 38341003 + descendants. Excludes secondary HTN. |
| `dx_secondary_hypertension` | SNOMED | I15.x family + descendants. (For sensitivity.) |
| `dx_primary_aldosteronism` | SNOMED | Conn syndrome / primary hyperaldosteronism + descendants. |
| `dx_ckd` | SNOMED | N18.x (CKD stage 1–5) + ESRD. |
| `dx_mi` | SNOMED | Acute MI + sequelae. |
| `dx_stroke` | SNOMED | Ischemic + hemorrhagic stroke. |
| `dx_heart_failure` | SNOMED | I50.x family. |
| `dx_thyroid_disease` | SNOMED | Hyper- and hypothyroidism (exclusion). |
| `dx_prior_cv_disease` | SNOMED | Composite of MI / stroke / HF / PVD / CABG / PCI history (exclusion). |
| `dx_abnormal_kidney_function` | SNOMED | CKD + AKI + abnormal creatinine (exclusion). |
| `lab_sbp` | LOINC | 8480-6 + valid descendants. |
| `lab_dbp` | LOINC | 8462-4 + valid descendants. |
| `lab_cbc_panel` | LOINC | CBC w/ diff parent + descendants. |
| `lab_cmp_panel` | LOINC | CMP parent + descendants (incl. eGFR, creatinine, sodium, potassium). |
| `lab_lipid_panel` | LOINC | LDL/HDL/TC/TG + lipid panel parent. |
| `lab_aldosterone` | LOINC | 1763-2 (aldosterone, serum) + plasma renin activity 2915-7 (for ARR). |
| `lab_tsh` | LOINC | 3016-3. |
| `rx_antihypertensives_all` | RxNorm + ATC | C02–C09 (any antihypertensive). |
| `rx_diuretics` | RxNorm + ATC | C03 thiazides, loops, K-sparing. |
| `rx_acei_arb` | RxNorm + ATC | C09. |
| `rx_ccb` | RxNorm + ATC | C08. |
| `rx_beta_blocker` | RxNorm + ATC | C07. |
| `rx_alpha_blocker` | RxNorm | Alpha-1 antagonists used for HTN. |
| `rx_mra` | RxNorm | Spironolactone, eplerenone (resistant-HTN diuretic class). |
| `rx_central_alpha_agonist` | RxNorm | Clonidine, methyldopa. |
| `rx_vasodilator` | RxNorm | Hydralazine, minoxidil. |
| `proc_renal_denervation` | HCPCS / CPT / SNOMED | 0338T / 0339T / 33999 (unlisted) + Symplicity / Recor catheter device codes. |
| `device_abpm` | HCPCS | 93784, 93786, 93788, 93790 (ABPM). |
| `device_home_bp_monitor` | HCPCS | A4670 + descendants; SNOMED home BP device concepts. |

> **Open question persisted as `open_question` asset (slug: `antihypertensive_scope`)**: "Lu 2025 used what specific antihypertensive RxNorm/ATC scope? If the citation differs from RxNorm class C02–C09, we must align before claiming reproduction."

**Acceptance:** Every row in this table has a `study_design_assets` row with `verification_status = 'passed'` and a `concept_sets` row materialized.

**Checkpoint:** Report verified count + any blocked set. **Do not proceed.**

---

## 6 — Phase 4: `--action=cohorts`

Use `StudyCohortDraftService` → `StudyCohortDraftVerifier` → `StudyCohortMaterializer::materialize($asset, $userId)`. Each materialized cohort writes a `cohort_definitions` row plus a `study_cohorts` link with the correct `role`. SQL templates use `{@cdmSchema}` and `{@vocabSchema}`.

> Clinical content of cohort definitions is unchanged from v1 (pending Dr. Bock review). See §12 for the open methodological questions that will affect this section.

### T — Target cohort (incident HTN, treatment-naive) — `role = target`

Index event = the **second** of two consecutive office BP measurements on **distinct calendar days** within a 24-month window where:
- SBP > 130 mmHg OR DBP > 80 mmHg, AND
- the patient is ≥ 18 years old at the second measurement.

**Inclusion (all):** ≥ 3 recorded BPs in the 24 months ending at index; ≥ 365 days of prior observation; new-onset HTN diagnosis ≤ 365 days after index OR no diagnosis (feeds latency analysis).

**Exclusion (any):** `dx_prior_cv_disease`, `dx_abnormal_kidney_function`, `dx_thyroid_disease` ever before index; `rx_antihypertensives_all` ever before index; `dx_secondary_hypertension` ever before index.

**Configurable parameters** (cohort attributes, NOT hardcoded):
- `min_bp_count = 3`
- `lookback_days = 730`
- `max_gap_between_consecutive_bps_days` ← **open question** (Lu used what?). Default 365.
- `latency_tertile_cutoffs_months = [6, 12]` ← **open question** (single Lu 16-mo cutoff vs. tertiles).

### C — Comparator (matched normotensive) — `role = comparator`

≥ 3 BPs in the same 24-month window, all SBP ≤ 130 AND DBP ≤ 80. Identical exclusions as T. Match 1:1 by age (±2 yr), sex, race, calendar quarter of index, and `data_partner_id` if present, using PSM (R `MatchIt` via `r-runtime`) by default; greedy fallback toggleable.

### S1 — Resistant-HTN sub-cohort — `role = subgroup`

Subset of T members with a recorded HTN Dx, ≥ 3 antihypertensive **classes** with ≥ 30-day overlap (`drug_era`-style), AND a recorded SBP ≥ 130 OR DBP ≥ 80 during that overlap window. Capture diuretic-class membership as an attribute.

### S2 — Renal-denervation sub-cohort — `role = subgroup`

Members of S1 with `proc_renal_denervation` after index. Capture procedure date(s) and follow-up BPs at 1, 3, 6, 12 months (±30 days).

### O1 — Composite MACE outcome — `role = outcome`

Time-to-first-event for MI, ischemic/hemorrhagic stroke, HF hospitalization, all-cause death. Persist `event_type ∈ {mi, stroke, hf, death}`.

### O2 — Incident CKD outcome — `role = outcome`

First `dx_ckd` after index. Co-equal with O1.

### O3 — Diagnostic latency (derived attributes on T)

For each T member: `t1`, `t2`, `tdx`, `latency_a_days = t2 - t1`, `latency_b_days = tdx - t2` (NULL when tdx is NULL). Persist as JSONB attributes on T's `study_cohorts.json_definition.derived_attributes`.

**Acceptance:** All six cohorts have verified draft assets and materialized rows. SQL templates render without errors against the `omop` connection (use `php artisan tinker` to dry-render).

**Checkpoint:** Report row counts and any verifier blocks. **Do not proceed.**

---

## 7 — Phase 5: `--action=cohort-gen`

Generate each cohort on the Acumenus `omop` source via `CohortGenerationService`. Each generation writes a `cohort_generation` row and populates the `results.cohort` table (per the Acumenus source's results daimon). Persist counts in a per-study summary at `results.htn_v3_cohort_counts`.

**Acceptance:**
- T, C, O1, O2 counts are non-zero on the Acumenus `omop` CDM.
- S1 count is non-zero (warn if very small).
- S2 count MAY be zero — record as expected note, do not block.
- Re-running with `--source=omop` is idempotent within ±0.1% (record canonical `cohort_generation_id` per cohort in `studies.metadata.canonical_generations`).

**Checkpoint:** Report counts. **Do not proceed.**

---

## 8 — Phase 6: `--action=analyses`

Use `StudyAnalysisPlanService` → `StudyAnalysisPlanMaterializer` and the polymorphic `study_analyses` link. Each analysis registers its domain row, links via `study_analyses(analysis_type, analysis_id)`, and stores the analysis spec as a `study_artifacts` row (`artifact_type = 'sap'` or `analysis_package_r`).

| ID | Analysis | Engine | Notes |
|---|---|---|---|
| A | Cohort characterization (Table 1) | Achilles + R `FeatureExtraction` | Stratify by latency tertile and S1 membership. |
| B | Prevalence of Stage-1+ HTN | SQL (`strategic_sql`) | Population-level numerator/denominator. |
| C | Diagnostic latency distribution | R survival (`hades_r`) | KM for `latency_b_days`; Cox PH for MACE & CKD ~ `latency_b_days_tertile` + matched C. |
| D | Treatment trajectory | SQL | Drug class at Dx, time from Dx to first Rx, longitudinal class additions, BP change ±30d around regimen change. |
| E | Resistant-HTN composition | SQL | Class distribution within S1; share with diuretic. |
| F | Lu replication head-to-head | R | Reproduce 29% CV risk delta with `latency_b > 365 days`. |
| G | MACE incidence | R survival | Per-1k person-years; competing risk = death. |
| H | CKD incidence | R survival | Same template as G. |
| I | Renal-denervation eligibility | SQL | Counts by demographics & geography. |
| J | Baseline lab ordering | SQL | Frequency of CBC / CMP / lipid / TSH / aldosterone within ±14 days of Dx. % of aldosterone-orders → `dx_primary_aldosteronism` within 12 mo. |
| K | Geographic stratification | GIS service | Urban vs rural via `gis` schema population density quintiles, joined by ZIP3 / county FIPS. |
| L | Cost (best-effort) | HEOR service | Mark **CAUTION** in report — only reliable if claims-mapped source is present. |

For A, F, G, H: write negative-control outcomes via `Services/Network/NegativeControlService` (use the curated OHDSI HTN negative-control list, not improvised codes). Empirical calibration via OHDSI `EmpiricalCalibration` R package.

**Analysis-plan lock:** Write `analysis_plan.lock.json` as a `study_artifacts` row (`artifact_type = 'sap'`, `is_current = true`). This is the pre-registered Holm-Bonferroni / sample-size / power-analysis declaration.

**Acceptance:** Every analysis above has a `study_analyses` link and a corresponding domain row. The SAP artifact exists and is `is_current = true`.

**Checkpoint:** Report registered analyses. **Do not proceed.**

---

## 9 — Phase 7: `--action=run`

For each analysis registered in Phase 6, create one `study_executions` row bound to the Acumenus `omop` source via `execution_params.source_id`. Run engines per the table in §8.

**Result-table contract:**
- Long-form result tables live in `<source-results-schema>.htn_v3_<artifact>` (Acumenus = `results.htn_v3_*`).
- Result file paths persist on `study_executions.result_file_path`, parquet hashes on `result_hash`.
- Per-execution `result_summary.json` payload is materialized as a `study_artifacts` row (`artifact_type = 'supplementary'`, metadata-linked to the execution).

**Acceptance:**
- Every `study_executions` row reaches `status = 'completed'`.
- `result_hash` populated and stable across re-runs (±0.1% tolerance recorded as drift metadata).
- Negative-control distribution recorded for analyses A, F, G, H (do not block on |mean log-HR| > 0.1 — record as diagnostic).

**Checkpoint:** Report execution roster + headline numbers. **Do not proceed.**

---

## 10 — Phase 8: `--action=report`

Build the deliverables under `docs/research/hypertension-v3/`:

```
docs/research/hypertension-v3/
├── CLAUDE_PROMPT.md                     ← this file
├── PROTOCOL.md                          ← protocol body (markdown)
├── README.md                            ← run instructions + status badges
├── concept-sets/                        ← one .json per set (Atlas-compatible export)
├── cohort-definitions/                  ← Circe-compatible JSON per cohort
├── sql/                                 ← rendered SQL per cohort & analysis (Postgres)
├── r/                                   ← R Plumber payloads + matched-cohort scripts
├── results/
│   └── omop/                            ← Acumenus OMOP CDM result tables (CSV + parquet)
├── reports/
│   ├── preflight.md                     ← from Phase 1
│   ├── htn_v3_report.html               ← published interactive report
│   └── htn_v3_report.pdf                ← printable PDF (see note below)
└── docs/
    └── open-questions.md                ← rendered snapshot of `open_question` assets
```

The HTML report MUST:
- Use the Acumenus palette (Crimson #9B1B30, Dark #0E0E11, Gold #C9A227, Teal #2DD4BF) and Arial throughout.
- Show negative-control p-value calibration plots.
- Render tables with the Parthenon `data:build-dashboard` skill conventions.
- Include a "Reproduces Lu 2025?" badge — `PASS | FAIL | N/A (citation unconfirmed)` per the Lu citation open question.

**PDF rendering note:** the existing pipeline is `Services/Publication`. If LibreOffice headless is not configured in the container, scope the PDF as a follow-up and emit a `study_artifacts` row noting the deferral instead of failing the phase.

A final `study_artifacts` row is written: `artifact_type = 'results_report'`, `is_current = true`, `file_path = reports/htn_v3_report.html`.

---

## 11 — Statistical & methodological guardrails (unchanged from v1)

- Index alignment: T's index = `t2`; C's index = synthetic equivalent (second of three normal BPs).
- Censor at: end of observation, death, or `max_followup_days` (parameter; default 1825).
- Pre-register the seven secondary goals; apply Holm-Bonferroni; lock via `analysis_plan.lock.json`.
- Calibrated p-values via OHDSI `EmpiricalCalibration` on the negative-control distribution.
- Missing data: report % missingness per covariate; do not impute BPs or labs.

---

## 12 — Open questions (persisted as `open_question` assets in Phase 2)

The following questions are seeded in Phase 2 and live in `study_design_assets` (`asset_type='open_question'`). They block phases that depend on them, NOT the whole run.

| Slug | Question | Blocks phase | Default |
|---|---|---|---|
| `bp_threshold_operator` | ACC/AHA 2017 uses `≥ 130/80`; v1 prompt used strict `>`. Confirm. | cohorts | `≥` |
| `max_gap_consecutive_bps` | Lu 2025 max-gap parameter? | cohorts | 365 days |
| `latency_cutoff_scheme` | Single Lu 16-mo cutoff vs. tertiles [6, 12]? | analyses | run both, tertiles primary |
| `lu_citation` | Lu 2025 DOI / PMID / page (ref 5 incomplete) | run | unconfirmed |
| `antihypertensive_scope` | RxNorm class C02–C09 vs. JNC-8 first-line restriction | concept-sets | C02–C09 |
| `comparator_match_method` | PSM (logistic + caliper 0.2 SD) vs greedy 1:1 | cohorts | PSM |
| `resistant_htn_diuretic_required` | Require diuretic inclusion for AHA-canonical resistant HTN, or apparent treatment-resistant? | cohorts | apparent (no diuretic requirement) — rename label |
| `hf_outcome_visit_qualified` | Require inpatient `visit_occurrence` for HF in MACE composite? | cohorts | yes |
| `treatment_naive_lookback` | Ever-before-index vs. 12-month lookback for `rx_antihypertensives_all` exclusion | cohorts | ever (run 12-mo as sensitivity) |
| `latency_b_null_handling` | Method for `tdx = NULL` (interval censoring vs. Cox time-varying vs. competing-risk)? | analyses | competing-risk, Dx as event |
| `ckd_baseline_treatment` | Exclude baseline CKD (current) or include as covariate? | cohorts | exclude, sensitivity with covariate |
| `censoring_window` | 5-year default OK vs. all-available follow-up | analyses | 5-year primary, all-available sensitivity |
| `cost_data_availability` | Confirm Acumenus `cost` table fidelity for Goal g | analyses | demote to encounter-counts if cost sparse |
| `sample_size_pre_registration` | Feasibility-first or pre-register min N? | run | feasibility-first, retrospective power |
| `irb_data_governance` | Confirm Acumenus retrospective use authorization | run | capture in `study_artifacts` |
| `rdn_procedure_completeness` | Pre-2018 CPT III alternates for renal denervation | concept-sets | accept low recall, document |

The Phase 8 report MUST render the current state of every open question; unanswered ones appear as red banners in the report header.

---

## 13 — Acceptance criteria (final, for the whole study)

1. `app.studies` row `metadata.key = 'htn-v3-bock-2026'` has `status = 'run_complete'`.
2. Every concept set in §5 has a `study_design_assets` row with `verification_status = 'passed'` and a materialized `concept_sets` row.
3. T, C, S1, O1, O2 generations have non-zero counts on the Acumenus `omop` CDM; counts stable across re-runs (±0.1%). S2 may be zero (logged, not failing).
4. Each registered analysis has a corresponding `study_executions` row with `status = 'completed'` and `result_hash` populated.
5. The HTML report renders without console errors and the "Reproduces Lu 2025" badge is set.
6. Negative-control diagnostic recorded (do NOT block on `|mean log-HR| > 0.1` — record as report banner if it exceeds).
7. `make lint` and `make test` pass on the touched test groups; `npx vite build` succeeds.
8. PHPStan level 8 clean for new code; no new entries in `phpstan-baseline.neon`.
9. Log hygiene check passes (Laravel log scrubber configured; spot-check via `grep` on storage/logs).
10. All `open_question` assets are either `verification_status='passed'` (answered) or rendered as outstanding in the report.

---

## 14 — Style & safety rules (enforced)

- **HIGHSEC:** no public/unauthenticated endpoint serves cohort/PHI data. New routes use `auth:sanctum` + `permission:studies.execute` (or stricter).
- **CdmModel is read-only.** No `INSERT`/`UPDATE`/`DELETE` against `omop.*` or `vocab.*`. Writes only to `app.*`, `<source-results-schema>.htn_v3_*`, and `php.*`.
- **No `cdm` or `docker_pg` connection** — they don't exist. Use `omop` (search_path `omop,vocab,php`). The `interrogation` connection is permitted for read-only Abby analytics only.
- **Pint must run in Docker** after every PHP edit: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`.
- **TypeScript strict** — verify with `npx vite build`, not just `tsc --noEmit`.
- **Recharts Tooltip formatter** cast `as never` (project convention).
- **Branch:** `feature/htn-v3-outcomes-study` from `main`. Conventional commits.
- **No `--no-verify`** unless emergency — note reason in commit body if used.
- **One phase per invocation.** Stop and report. Do not chain phases without explicit go-ahead.

---

## 15 — Done definition

When all acceptance criteria pass, post a final status comment:

```
Hypertension v3 study run complete on Acumenus omop CDM @ <commit>.
T={count} C={count} S1={count} S2={count}
MACE/1k-py: T=<x> C=<y>  CKD/1k-py: T=<x> C=<y>
Median latency_b: <m> mo (Lu reported 16–18 mo)
Lu 29% CV-risk replication: <PASS|FAIL|N/A>
Negative-control |mean log-HR|: <value> (target < 0.1)
Open questions outstanding: <n>
Report: docs/research/hypertension-v3/reports/htn_v3_report.html
```

End of prompt.
