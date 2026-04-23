# FinnGen Workbench — Demo Guide

**Audience:** Internal demos, investor walkthroughs, conference presentations  
**Environment:** `beastmode` dev server — http://localhost:8082  
**Login:** admin@acumenus.net (super-admin)  
**Last validated:** 2026-04-23

---

## What the FinnGen Workbench Does

Parthenon's FinnGen module ports the FinnGen DF14 endpoint library (2,400+ curated disease endpoints) into an OMOP CDM environment, allowing researchers to:

1. Browse endpoints by disease category, coverage profile, and tags
2. Materialize endpoint cohorts against any connected CDM source
3. Generate Risteys-style endpoint profiles (survival, comorbidities, drug exposures)
4. Run GWAS via regenie (step1 null model → step2 association scan) with in-app Manhattan plots
5. Compute polygenic risk scores (PRS) against PGS Catalog scores
6. Build and match custom cohorts in a visual workbench
7. Run CodeWAS / timeCodeWAS and cohort demographic analyses

All compute runs through Darkstar (R Plumber API) with async job tracking, artifact storage, and pinnable run history.

---

## Demo Corpora

### SYNPUF — Primary Demo Corpus

**Best for:** Endpoint profile, comorbidity matrix, drug panel, large-scale feature demo  
**Size:** 2.3M persons, 127M drug records, 302M condition records (CMS Medicare claims)  
**Available endpoints (all status=succeeded):**

| Endpoint | Description | Subjects |
|----------|-------------|----------|
| `I9_HEARTFAIL` | Heart failure, strict | 3,137,258 |
| `E4_DM2` | Type 2 diabetes | 1,940,353 |
| `I9_CHD` | Major coronary heart disease | 1,705,573 |
| `I9_AF` | Atrial fibrillation and flutter | 1,284,495 |
| `J10_ASTHMA` | Asthma | 815,993 |
| `E4_DMICD8COMA` | Diabetic coma (ICD-8; partial coverage) | — |

> E4_DMICD8COMA is a `partial`-coverage endpoint with no longname — skip it in demos; the 5 universal endpoints above are the featured set.

**Endpoint profile results cached in:** `synpuf_co2_results` schema  
**Known profile result:** E4_DM2 — 1,121 KM points, comorbidities (I9_HEARTFAIL OR 2.95, I9_AF OR 2.82), 10 drug classes (C10A statins 21%, C09A ACE-I 18%)

### PANCREAS — Oncology Demo Corpus

**Best for:** GWAS (VCF data present), PRS, small-cohort endpoint profile  
**Size:** 361 pancreatic cancer patients, multimodal (imaging + genomics + clinical)  
**Available endpoints:**

| Endpoint | Description | Subjects |
|----------|-------------|----------|
| `R18_ABDOMI_PELVIC_PAIN` | Abdominal/pelvic pain | 361 |
| `E4_DM2` | Type 2 diabetes | 135 |

**GWAS history:** 7 succeeded step1 runs, 3 succeeded step2 runs (cohort: All PDAC Patients, n=221)  
**PRS history:** 1 succeeded run (PGS999999 against PANCREAS)  
**Known limitation:** Drug panel empty — PANCREAS drug records are post-diagnosis chemotherapy only; no pre-index drug window.

### EUNOMIA — Quick Validation Corpus

**Best for:** CodeWAS, cohort demographics, fast sanity checks  
**Size:** ~2,600 persons (GiBleed demo dataset, synthetic)  
**Note:** No endpoint cohorts materialized. Use for CO2 analysis demos only.

---

## Demo Flow: Full Workbench Walkthrough (~25 minutes)

### 1. Endpoint Browser (3 min)

**Navigate to:** FinnGen → Endpoint Browser

Show the searchable library of 2,400+ FinnGen DF14 endpoints.

- Search `"diabetes"` → shows E4_DM2 with coverage badge `universal`
- Search `"heart failure"` → shows I9_HEARTFAIL
- Click E4_DM2 → show the detail view: longname, description, source codes (ICD-10 E11, ATC A10B), resolved concept counts (41 standard condition concepts, 55 drug concepts)
- Show the **Coverage Profile** badge: `universal` = endpoint resolves across OMOP ICD-10 codes in all CDMs

**Talking point:** The library is curated by FinnGen (Finland's 500k-person biobank) and maps Finnish registry codes to OMOP standard concepts. Every endpoint has been resolved via concept_ancestor expansion — no manual SQL required.

### 2. Endpoint Cohort Generation (2 min)

Still on the E4_DM2 detail view.

- Click **Generate Cohort** → select source `SYNPUF` → submit
- Show the async job tracker (status: queued → running → succeeded)
- Navigate to **Generation History** tab — shows the run with subject_count=1,940,353

**Talking point:** The UNION + concept_ancestor pattern matches the OHDSI cohort generation standard. All 41 T2DM concept descendants are included, not just the top-level ICD-10 code.

> Skip waiting in demo — all 5 SYNPUF cohorts are already materialized.

### 3. Endpoint Profile — Survival Panel (4 min)

On E4_DM2 detail view → click **Compute Profile** → source: SYNPUF → submit.

> Use the cached result: navigate to the profile view after dispatch (result is pre-cached by expression hash).

**Survival panel:**
- 1,121 KM data points across 1.94M subjects
- Survival at t=0: 99.996% → t=1126 days: 94.6%
- Median survival: not reached (>94% survive the observation window — correct for a prevalent chronic disease in Medicare)

**Talking point:** This mirrors the Risteys phenotype browser from FinnGen, but running against your own OMOP CDM. Any endpoint in the 2,400-definition library can be profiled against any connected data source in ~85 seconds.

### 4. Endpoint Profile — Comorbidity Matrix (4 min)

Same profile view → **Comorbidities** tab.

| Comorbid endpoint | Co-occurring subjects | Odds Ratio | Phi |
|-------------------|-----------------------|------------|-----|
| I9_HEARTFAIL | 1,521,994 | **2.95** | 0.111 |
| I9_AF | 1,251,396 | **2.82** | 0.105 |
| J10_ASTHMA | 799,027 | **2.79** | 0.086 |
| I9_CHD | 1,635,254 | 1.08 | 0.006 |

**Talking point:** The phi coefficient (phi = OR normalized by marginal distributions) quantifies endpoint co-clustering. T2DM shows strong phi with HF (0.111) and AFib (0.105), reflecting the metabolic-cardiovascular disease cluster. CHD's near-zero phi (0.006) despite 1.6M co-occurrences tells the clinically interesting story — CHD is so prevalent in Medicare that it has no discriminating power; it's not specifically associated with T2DM beyond baseline risk.

**How it works:** The phi matrix is computed across all materialized endpoint generations on the selected source. Adding more endpoints to SYNPUF (currently 5) will expand the matrix.

### 5. Endpoint Profile — Drug Classes Panel (3 min)

Same profile view → **Drug Classes** tab.

Top 5 ATC-3 classes among T2DM subjects (90-day pre-index window):

| Class | Name | Coverage |
|-------|------|----------|
| C10A | Lipid-modifying agents (statins) | 21.2% |
| C09A | ACE inhibitors | 18.4% |
| C07A | Beta-blocking agents | 18.7% |
| B01A | Antithrombotic agents | 14.2% |
| N06A | Antidepressants | 18.9% |

**Talking point:** The T2DM pharmacotherapy fingerprint is exactly what you'd expect from a real Medicare cohort — statins, ACE-I, beta-blockers are guideline-mandated for cardiovascular risk reduction in T2DM. Antidepressants reflect the high comorbid depression prevalence in Medicare elderly. Opioids (12.8%) reflect chronic pain burden. This panel is computed from OMOP `drug_exposure` records, ATC-mapped via RxNorm concept ancestors.

### 6. GWAS — Manhattan Plot (5 min)

**Navigate to:** FinnGen → Endpoint Browser → select an endpoint on PANCREAS → GWAS tab

> Pre-run: 7 succeeded step1 runs, 3 succeeded step2 runs on PANCREAS.

- Show the GWAS dispatch panel: endpoint selection, control cohort picker, covariate set
- Open a succeeded step2 run → Manhattan plot (PheWeb-lite view)
- Zoom into a regional view showing LD structure around a top hit
- Show the top variants table (sortable by p-value, beta, MAF)

**Talking point:** regenie handles the step1 null model (whole-genome regression for cryptic relatedness and population stratification) then step2 runs the per-variant association tests. The Manhattan and regional views are rendered directly in-app — no R/Python notebook required.

### 7. Cohort Workbench — Visual Builder (3 min)

**Navigate to:** FinnGen → Cohort Workbench

- Create a new workbench session
- Drag in the E4_DM2 and I9_HEARTFAIL endpoint cohorts from SYNPUF
- Apply a boolean intersection (A ∩ B) to build a "T2DM + Heart Failure" overlap cohort
- Preview counts live (hits Darkstar for a count query, returns in <5s)
- Materialize → creates a new cohort_definition and writes cohort rows to the source results schema

**Talking point:** The workbench compiles the boolean tree into a SQL CTE chain and executes it via the OMOP cohort entry/exit event model — same standard as the Cohort Wizard. The resulting cohort is a first-class Parthenon cohort that can be used in any downstream analysis (PatientLevelPrediction, CohortMethod, etc.).

### 8. CodeWAS (2 min)

**Navigate to:** FinnGen → Analyses → CodeWAS

- Select source: PANCREAS, select index cohort (e.g., All PDAC Patients)
- Submit → show the async run tracker
- Open a succeeded run → concept-level association table (standardized incidence ratio per OMOP concept_id)

> Succeeded runs exist on both PANCREAS and EUNOMIA.

**Talking point:** CodeWAS scans every OMOP concept (condition, drug, measurement, procedure) for enrichment in the index cohort vs. all subjects. It's a data-driven phenome-wide scan — useful for generating hypotheses about comorbidities and exposures before running a targeted CohortMethod study.

---

## Quick Warm-Up Commands

Run before a demo to ensure fresh results and warm caches:

```bash
# Verify the 5 featured SYNPUF endpoint cohorts are materialized (SQL — no artisan command)
psql "host=localhost port=5432 dbname=parthenon user=claude_dev" -c "
  SELECT params->>'endpoint_name' AS endpoint, status, started_at::date
  FROM finngen.runs
  WHERE source_key = 'SYNPUF' AND analysis_type = 'endpoint.generate'
  ORDER BY started_at;"

# Warm E4_DM2 endpoint profile on SYNPUF (hits cache if expression hash matches)
docker compose exec -T php php artisan finngen:warm-endpoint-profiles \
  --source=SYNPUF --endpoints=E4_DM2,I9_AF,I9_CHD,I9_HEARTFAIL,J10_ASTHMA

# Smoke test E4_DM2 × SYNPUF (full 3-panel validation, ~85s)
PARTHENON_E2E=1 docker compose exec -T -e PARTHENON_E2E=1 php \
  php artisan finngen:smoke-endpoint-profile --endpoint=E4_DM2 --source=SYNPUF --timeout=300

# Check Darkstar is healthy (port 8787)
curl -s http://localhost:8787/health | jq .status
```

---

## Known Demo Gaps

| Feature | Status | Notes |
|---------|--------|-------|
| GWAS on SYNPUF | Not available | SYNPUF has no VCF/BGEN files. GWAS demo requires PANCREAS. |
| PRS on SYNPUF | Not available | Same — genomic data only on PANCREAS. |
| Drug panel on PANCREAS | Empty by design | Post-diagnosis chemotherapy records only; no pre-index drug window. |
| Comorbidity matrix depth | 4 endpoints | Only 5 endpoints materialized on SYNPUF. Add more with `endpoint.generate` to expand the phi matrix. |
| timeCodeWAS | 1 succeeded run | On PANCREAS only. Needs a longer-running cohort for SYNPUF. |

---

## Adding More Endpoints to SYNPUF

To expand the comorbidity matrix, generate additional endpoint cohorts:

```bash
# Example: add I9_STROKE (ischemic stroke)
curl -s -X POST http://localhost:8082/api/v1/finngen/endpoints/I9_STROKE/generate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"source_key": "SYNPUF"}'
```

Or via artisan (dispatches the same Horizon job, no auth token needed):

```bash
# Get an API token first (one-time)
TOKEN=$(docker compose exec -T php php artisan tinker --execute \
  "echo app\Models\User::where('email','admin@acumenus.net')->first()->createToken('demo')->plainTextToken;")

# Then generate the endpoint
curl -s -X POST http://localhost:8082/api/v1/finngen/endpoints/I9_STROKE/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source_key": "SYNPUF"}' | jq .
```

After generation succeeds, the next endpoint profile compute on any SYNPUF endpoint will automatically include I9_STROKE in the phi matrix.

---

## Architecture Reference

```
UI (React)
  └── FinnGen Endpoint Browser / Workbench pages
        ↓  POST /api/v1/finngen/endpoints/{name}/profile
Backend (Laravel)
  └── EndpointBrowserController → dispatches Horizon job
        ↓  HTTP POST to Darkstar
Darkstar (R Plumber)
  └── /finngen/co2/endpoint-profile
        ├── finngen_endpoint_profile_execute()
        │     ├── Survival: survfit() → KM points → synpuf_co2_results.endpoint_profile_km_points
        │     ├── Comorbidity: phi matrix across endpoint_generations → endpoint_profile_comorbidities
        │     └── Drug classes: ATC-3 aggregation from drug_exposure (−90d pre-index) → endpoint_profile_drug_classes
        └── Summary → synpuf_co2_results.endpoint_profile_summary
Backend (poll)
  └── RunReconcilerJob → updates finngen.runs.status → frontend polls /api/v1/finngen/runs/{id}
```

Result tables per CDM source:
- `synpuf_co2_results.*` — SYNPUF endpoint profile results
- `pancreas_co2_results.*` — PANCREAS endpoint profile results
