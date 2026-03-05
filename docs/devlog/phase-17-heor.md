# Phase 17 — Health Economics & Outcomes Research (HEOR)

**Version target:** 1.3.0
**Status:** §17.1 Complete
**Date:** 2026-03-05

---

## §17.1 — HEOR Economics Engine, Data Layer, and Frontend Module ✅

### What Was Built

#### Backend

**Migration** `2026_03_05_170001_create_heor_tables.php` — 5 tables:

| Table | Purpose |
|---|---|
| `heor_analyses` | Top-level economic analysis (CEA, CUA, BIA, ROI) |
| `heor_scenarios` | Alternative scenarios within an analysis (intervention, comparator, sensitivity) |
| `heor_cost_parameters` | Cost and utility inputs with probabilistic bounds and distributions |
| `heor_results` | Computed results per scenario (ICER, NMB, ROI, budget impact, tornado data) |
| `heor_value_contracts` | Value-based contract definitions with outcome-linked rebate tiers |

**Models:** HeorAnalysis, HeorScenario, HeorCostParameter, HeorResult, HeorValueContract

**`HeorEconomicsService`** (`app/Services/Heor/HeorEconomicsService.php`)

Implements standard health economic methods:
- **CEA / CUA**: ICER = ΔCost / ΔEffect; Net Monetary Benefit = WTP × ΔQALYs − ΔCost
- **Discounting**: Standard annuity factor PV = C × Σ(1/(1+r)^t) for user-specified rate and horizon
- **Time horizons**: 1 year, 5 years, 10 years, lifetime (30-year proxy)
- **Budget Impact Analysis**: Annual cost × cohort size × N years (1, 3, 5)
- **ROI**: (savings - investment) / investment × 100%; payback period in months
- **One-way sensitivity**: Tornado diagram data — vary each parameter ±20% (or PSA bounds), rank by ICER impact range, top 15 parameters
- **Value contract rebate**: Compute applicable rebate tier given observed outcome rate vs. baseline

**`HeorController`** — 26 endpoints:
- Stats overview
- Analyses CRUD (owner-scoped via `created_by` check)
- Scenarios CRUD (with `is_base_case` singleton enforcement)
- Parameters CRUD (with distribution support for PSA)
- POST run → triggers full economics computation
- GET results with tornado data
- Value contracts CRUD + rebate simulation

**API Routes** — Phase 17 group in `api.php`

#### Frontend

**Feature module** `frontend/src/features/heor/`:
- `types/index.ts` — Full TypeScript types (HeorAnalysis, HeorScenario, HeorCostParameter, HeorResult, HeorValueContract, RebateTier, TornadoEntry, RebateSimulation)
- `api/heorApi.ts` — Axios client for all 26 endpoints
- `hooks/useHeor.ts` — TanStack Query hooks (stats, analyses, results, contracts, mutations)
- `pages/HeorPage.tsx` — Main page: stats bar + 2-tab layout (Economic Analyses / Value Contracts)
- `pages/HeorAnalysisPage.tsx` — Analysis detail: scenario + parameter management panels, Run button, Results cards with ICER/NMB/ROI/budget impact/tornado

**HeorPage:**
- New Analysis form: name, analysis type (CEA/CBA/CUA/BIA/ROI), description
- Analysis list: type badge, status badge, link to detail, delete
- Value Contracts tab: new contract form (name, drug, outcome metric, list price), rebate tier display, delete

**HeorAnalysisPage:**
- Analysis metadata header (type, perspective, horizon, discount rate)
- Scenarios panel: add/delete, base case badge
- Parameters panel: add form with name, type, value, unit, lower bound; inline delete
- Run button → POSTs to `/heor/analyses/{id}/run` → invalidates results
- Results grid: one card per scenario with ICER, NMB, ROI, payback, budget impact Y1/Y3/Y5, mini tornado chart (top 5 parameters)

**Sidebar:** Added `TrendingUp` icon, `/heor` nav item

**Router:** `/heor` + `/heor/:id` lazy routes

### Architecture Decisions

- **Owner-scoped analyses**: All HEOR analyses filtered by `created_by = Auth::id()`. No shared analyses initially — future version will add collaboration.
- **WTP threshold hardcoded**: US WTP = $50,000/QALY (standard). Future: configurable per analysis.
- **Cohort size from generations table**: If target cohort has run generations, use the most recent `person_count`. Falls back to 1,000 for planning scenarios without a generated cohort.
- **Tornado top 15**: Limited to 15 most impactful parameters to keep payload manageable. Full PSA (Monte Carlo) is a future enhancement.
- **Value contracts**: Outcomes-based rebate tiers follow ICER Innovation Exchange framework. Net price floor supported but not enforced by engine (informational).

### HEOR Methodology References

- Drummond et al., *Methods for the Economic Evaluation of Health Care Programmes* (4th ed., 2015)
- ISPOR Good Practices for Outcomes Research Task Force guidelines
- ICER Evidence Rating Framework v3.0 (2023)
- WHO-CHOICE cost-effectiveness thresholds ($100-300/DALY in LMICs)
- PCORI Methodology Standards for Economic Analysis

### Pending

- §17.2: Probabilistic sensitivity analysis (Monte Carlo with configurable distributions: normal, gamma, beta)
- §17.3: CEAC (Cost-Effectiveness Acceptability Curve) visualization
- §17.4: Value contract outcome tracking — wire to OMOP cohort generations for automated outcome measurement
- §17.5: Budget impact model with population growth and market penetration curves
