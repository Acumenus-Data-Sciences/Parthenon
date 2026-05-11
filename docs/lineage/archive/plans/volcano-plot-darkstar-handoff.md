# Volcano Plot via Darkstar — Agent Handoff

**Date:** 2026-03-20
**Status:** Ready for implementation
**Prerequisite:** Container rename complete — `parthenon-r` is now `parthenon-darkstar` (service name `darkstar` in docker-compose.yml)

---

## Context

The CodeWAS results page (`frontend/src/features/investigation/components/phenotype/CodeWASResults.tsx`) has a placeholder:

```tsx
{/* Volcano plot placeholder */}
<div className="rounded border border-zinc-700/30 bg-zinc-800/20 px-4 py-3 text-xs text-zinc-500">
  Interactive volcano plot coming in a future update.
</div>
```

Currently, the CO2 (CodeWAS) backend only returns `{label, count}` per signal — aggregate counts with no statistical significance data. A true volcano plot requires per-concept `{log_effect, -log10_p_value}`.

## What Darkstar Already Provides

The R runtime (Darkstar) is a plumber2 + mirai container running HADES packages. It **already computes per-outcome effect estimates** in `r-runtime/api/estimation.R`:

```r
list(
  outcome_id        = oid,
  outcome_name      = outcome_name,
  hazard_ratio      = round(hr, 4),           # Effect size (X-axis)
  ci_95_lower       = round(ci_lower, 4),
  ci_95_upper       = round(ci_upper, 4),
  p_value           = round(p_val, 6),         # Significance (Y-axis)
  log_hr            = round(log_rr, 4),
  se_log_hr         = round(se_log_rr, 4)
)
```

**Available HADES packages** (loaded at container startup):
- `CohortMethod v6.0.0` — hazard ratios + p-values per outcome
- `PatientLevelPrediction v6.5.1` — model coefficients + feature importance
- `EvidenceSynthesis` — pooled estimates for meta-analysis
- `Characterization` — covariate-level SMD

## How to Connect to Darkstar

From PHP/Laravel:
```php
$url = config('services.darkstar.url'); // http://darkstar:8787
$response = Http::timeout(7200)->post("{$url}/analysis/estimation/run", $payload);
```

Config is in `backend/config/services.php` under `darkstar`. Env var: `DARKSTAR_URL=http://darkstar:8787`.

Darkstar runs on the Docker network as hostname `darkstar`, port 8787. External access via `localhost:8787`.

## Recommended Implementation

### Option: Extend CodeWAS Signal Scan with Per-Concept Statistics

1. **New R endpoint** (`r-runtime/api/codewas.R` or extend existing):
   - Input: target cohort ID, source connection params, list of concept IDs (or scan all)
   - For each concept, run logistic regression or Fisher's exact test: `outcome ~ concept_presence`
   - Return: `[{concept_id, concept_name, odds_ratio, log_or, p_value, neg_log10_p, ci_lower, ci_upper}]`

2. **New PHP endpoint** (`CodeWASController` or extend `FinnGenWorkbenchService`):
   - `POST /sources/{source}/codewas/{cohortId}/volcano`
   - Dispatch to Darkstar, collect results, return to frontend

3. **Frontend D3 volcano plot** (new component, reuse patterns from `ForestPlotWrapper.tsx`):
   - X-axis: `log2(odds_ratio)` — effect size
   - Y-axis: `-log10(p_value)` — significance
   - Horizontal line at p=0.05 threshold
   - Color: crimson (#9B1B30) for significant protective, teal (#2DD4BF) for significant risk, gray for non-significant
   - Hover tooltip with concept name, OR, CI, p-value
   - Dark theme: #0E0E11 base, matching existing clinical aesthetic

### Data Shape for Frontend

```typescript
interface VolcanoPoint {
  concept_id: number;
  concept_name: string;
  odds_ratio: number;
  log2_or: number;          // X-axis
  p_value: number;
  neg_log10_p: number;      // Y-axis
  ci_lower: number;
  ci_upper: number;
  significant: boolean;     // p < 0.05
  direction: "risk" | "protective" | "neutral";
}
```

### Existing Infrastructure to Reuse

| Component | Location | Reusable Pattern |
|---|---|---|
| D3 forest plot | `frontend/src/features/investigation/components/phenotype/ForestPlotWrapper.tsx` | Log-scale axis, dark theme, tooltips |
| Signal bar chart | Same file/directory | Recharts integration pattern |
| CodeWAS results page | `frontend/src/features/investigation/components/phenotype/CodeWASResults.tsx` | Layout, placeholder location |
| FinnGen workbench | `backend/app/Services/FinnGen/FinnGenWorkbenchService.php` | CO2 signal scanning SQL |
| R estimation API | `r-runtime/api/estimation.R` | HADES CohortMethod integration |

### Key Constraints

- Darkstar has 3 mirai daemons — volcano computation can run concurrently with other analyses
- Timeout: 7200s (2h) configured in `services.darkstar.timeout`
- Memory: 32GB container limit, ~3GB per R worker with JVM
- The R process blocks during JDBC operations — use async job dispatch from PHP (like DQD pattern: dispatch job, poll progress)
- Results should be cached in a DB table or returned directly depending on expected scan size
