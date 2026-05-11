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

---

## §17.6 — HEOR UX Alignment (Post-ship polish, March 5, 2026)

**What was built:**

Both HEOR frontend files comprehensively revised to match the Parthenon design system.

### Problem severity
Both `HeorPage.tsx` and `HeorAnalysisPage.tsx` used the identical legacy CSS framework as the Imaging pages — abstract class names that produced no styles in production: `page-container`, `card`, `btn btn-primary`, `btn btn-secondary`, `btn btn-danger btn-sm`, `badge badge-sm badge-neutral/success/danger/warning`, `tabs`, `tab`, `tab-active`, `text-muted`, `bg-surface`, `text-accent`, `bg-accent`, `border-subtle`, `alert alert-success`, `page-title`, `page-subtitle`. Additionally `border-subtle` is not defined anywhere in Tailwind. The HEOR pages were rendering as completely unstyled HTML.

### Files revised (2)

**HeorPage.tsx** — complete rewrite
- Removed `page-container` → `space-y-6`; header → standard h1/subtitle with icon-in-circle (amber `#F59E0B` domain accent — fitting for economics/financial data)
- `StatsBar`: CohortStatsBar-style tiles; IBM Plex Mono numbers; amber/teal/violet/blue per metric
- `NewAnalysisForm`: all `input`/`btn` classes replaced with design system tokens; Cancel → text link; Create → teal primary
- `AnalysesTab`: standard layout; analysis type + status badges using design system; Open → secondary button; delete → icon Trash2 with danger hover
- `ContractsTab`: same form/badge/button treatment; rebate tier chips use `bg-[#0E0E11] border-[#232328]`; contract status: teal active, red expired, neutral draft
- Tab bar: `border-[#2DD4BF]` active state

**HeorAnalysisPage.tsx** — complete rewrite
- Removed `page-container` wrapper; back nav → ArrowLeft with `text-[#8A857D] hover:text-[#F0EDE8]`
- Loading/not-found states: teal spinner, no rogue wrappers
- "Run Analysis" → teal primary button with Loader2 spinner
- Run success banner: teal `bg-[#2DD4BF]/10 border-[#2DD4BF]/30`
- Scenarios section: standard card rows; Base Case badge teal; scenario type badge neutral; delete icon button
- Cost Parameters section: inline parameter list in scrollable `divide-y divide-[#1E1E23]` container; parameter values in amber IBM Plex Mono
- `ResultCard`: full redesign — proper card bg/border, `text-[#5A5650]` labels, `text-[#F0EDE8]` values; budget impact year tiles use `bg-[#0E0E11]` with amber IBM Plex Mono numbers; tornado sensitivity bars use `#2DD4BF`
- Alert (analysis completed, no results): `bg-amber-400/10 border-amber-400/30 text-amber-400`
- `border-subtle` → `border-[#1E1E23]` (design system row divider)

### Domain accent color (HEOR)
- **Amber (`#F59E0B`)** — domain icon, section h2 icons, parameter value numbers, budget impact IBM Plex Mono — evokes financial/economic data

### Gotchas
- `border-subtle` is not a defined Tailwind class anywhere in the project — replaced with `border-[#1E1E23]`
- `bg-surface`, `text-accent`, `bg-accent` are also undefined — replaced throughout with explicit tokens
