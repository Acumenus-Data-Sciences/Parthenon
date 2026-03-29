# Cohort Builder — Risk Score Criteria Integration

**Date:** 2026-03-29
**Status:** Approved
**Depends on:** Risk Scores v2 (all phases complete)

## Summary

Add a "Risk Score" criterion type to the cohort expression engine, allowing researchers to compose risk score conditions (e.g., "Charlson CCI >= 5") alongside standard OHDSI domain criteria in cohort definitions. Queries pre-computed results from `app.risk_score_patient_results`, resolving the latest completed execution for a given analysis.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data source | Pre-computed lookup | Fast indexed query, maintains separation between scoring and cohort definition |
| Execution binding | Latest completed | Researchers want freshest results; pinned execution available via inline "Create Cohort" |
| Expression location | Top-level `RiskScoreCriteria` array | Mirrors GenomicCriteria/ImagingCriteria pattern; avoids forcing temporal semantics on scores |

## Expression Schema

New top-level key in `expression_json`:

```json
{
  "RiskScoreCriteria": [
    {
      "id": 0,
      "label": "Charlson CCI ≥ 5",
      "analysisId": 2,
      "scoreId": "RS005",
      "scoreName": "Charlson Comorbidity Index (CCI)",
      "operator": "gte",
      "value": 5,
      "tier": null,
      "exclude": false
    },
    {
      "id": 1,
      "label": "Framingham — High Risk",
      "analysisId": 2,
      "scoreId": "RS001",
      "scoreName": "Framingham Risk Score",
      "operator": null,
      "value": null,
      "tier": "high",
      "exclude": false
    }
  ]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | number | Yes | Auto-incrementing index within the array |
| `label` | string | Yes | Human-readable label (auto-generated from score + operator/tier) |
| `analysisId` | number | Yes | ID of the `RiskScoreAnalysis` whose results to query |
| `scoreId` | string | Yes | Score identifier (e.g., "RS005") |
| `scoreName` | string | Yes | Display name (stored for readability) |
| `operator` | string | null | No | One of: `gt`, `gte`, `lt`, `lte`, `eq`. Null when filtering by tier. |
| `value` | number | null | No | Numeric threshold. Required when `operator` is set. |
| `tier` | string | null | No | Tier name: `low`, `intermediate`, `high`, `very_high`. Null when filtering by value. |
| `exclude` | boolean | Yes | If true, EXCLUDE patients matching this criterion |

**Validation:** Each entry must have either (`operator` AND `value`) or `tier` set (not both, not neither).

## Backend — SQL Compilation

### RiskScoreCriteriaBuilder

New builder at `backend/app/Services/Cohort/Builders/RiskScoreCriteriaBuilder.php`.

For each `RiskScoreCriteria` entry, generates a CTE that resolves the latest completed execution and filters patients:

```sql
-- Score value filter (CCI >= 5)
risk_score_filter_0 AS (
    SELECT DISTINCT rspr.person_id
    FROM risk_score_patient_results rspr
    INNER JOIN analysis_executions ae
        ON ae.id = rspr.execution_id
        AND ae.analysis_type = 'App\Models\App\RiskScoreAnalysis'
        AND ae.analysis_id = :analysisId
        AND ae.status = 'completed'
    WHERE rspr.score_id = :scoreId
      AND rspr.score_value >= :value
      AND ae.id = (
          SELECT MAX(ae2.id)
          FROM analysis_executions ae2
          WHERE ae2.analysis_type = 'App\Models\App\RiskScoreAnalysis'
            AND ae2.analysis_id = :analysisId
            AND ae2.status = 'completed'
      )
)

-- Tier filter (Framingham high)
risk_score_filter_1 AS (
    SELECT DISTINCT rspr.person_id
    FROM risk_score_patient_results rspr
    INNER JOIN analysis_executions ae
        ON ae.id = rspr.execution_id
        AND ae.analysis_type = 'App\Models\App\RiskScoreAnalysis'
        AND ae.analysis_id = :analysisId
        AND ae.status = 'completed'
    WHERE rspr.score_id = :scoreId
      AND rspr.risk_tier = :tier
      AND ae.id = (
          SELECT MAX(ae2.id)
          FROM analysis_executions ae2
          WHERE ae2.analysis_type = 'App\Models\App\RiskScoreAnalysis'
            AND ae2.analysis_id = :analysisId
            AND ae2.status = 'completed'
      )
)
```

### SQL Compiler Integration

In `CohortSqlCompiler.php`, after inclusion criteria CTEs and before the final cohort CTE:

1. Call `RiskScoreCriteriaBuilder::build($expression['RiskScoreCriteria'])` to generate risk score CTEs
2. Append CTEs to the CTE chain
3. In the `final_cohort` CTE, add person_id filter clauses:
   - `exclude: false` → `AND ie.person_id IN (SELECT person_id FROM risk_score_filter_N)`
   - `exclude: true` → `AND ie.person_id NOT IN (SELECT person_id FROM risk_score_filter_N)`

### Expression Schema Validation

In `CohortExpressionSchema.php`, add validation for `RiskScoreCriteria`:
- Must be an array (or absent/empty)
- Each entry: `analysisId` required integer, `scoreId` required string
- Must have either (`operator` in `[gt,gte,lt,lte,eq]` AND `value` numeric) OR (`tier` string)
- `exclude` defaults to false
- `label` and `scoreName` are strings (informational, not validated strictly)

### Operator Mapping

| Operator | SQL |
|----------|-----|
| `gt` | `score_value > :value` |
| `gte` | `score_value >= :value` |
| `lt` | `score_value < :value` |
| `lte` | `score_value <= :value` |
| `eq` | `score_value = :value` |

## Frontend — Builder UI

### New Domain Button

In `DomainCriteriaSelector.tsx`, add "Risk Score" to the domain options array:
- Icon: `Activity` (from lucide-react)
- Color: `#9B1B30` (crimson)
- Label: "Risk Score"

This button opens the `RiskScoreCriterionEditor` configuration panel.

### RiskScoreCriterionEditor Component

**File:** `frontend/src/features/cohort-definitions/components/RiskScoreCriterionEditor.tsx`

Configuration panel with:

1. **Analysis selector** — dropdown of risk score analyses for the active source
   - Uses `useAllRiskScoreAnalyses()` hook
   - Each option: analysis name + score count
   - On selection: populates score dropdown

2. **Score selector** — dropdown of scores within the selected analysis
   - Populated from `analysis.design_json.scoreIds`
   - Uses `useRiskScoreCatalogue()` for display names

3. **Filter mode** — radio toggle: "By Score Value" | "By Tier"
   - **By Score Value:**
     - Operator dropdown: >= (gte), > (gt), <= (lte), < (lt), = (eq)
     - Numeric input for threshold value
   - **By Tier:**
     - Tier dropdown: Low, Intermediate, High, Very High

4. **Exclude toggle** — checkbox "Exclude matching patients"

5. **Label** — auto-generated, read-only: `"{scoreName} {operator} {value}"` or `"{scoreName} — {Tier} Risk"`

6. **Add button** — validates inputs, calls store's `addRiskScoreCriterion()`

### RiskScoreCriteriaSection Component

**File:** `frontend/src/features/cohort-definitions/components/RiskScoreCriteriaSection.tsx`

Renders in the expression editor below Genomic/Imaging sections:

- Section header: "Risk Score Criteria" with Activity icon
- List of existing criteria as cards (same visual pattern as genomic/imaging cards):
  - Label (bold)
  - Analysis name (muted)
  - Operator/value or tier badge
  - Exclude badge (red, if true)
  - Remove button (X icon)
- "Add Risk Score Criterion" button → expands the RiskScoreCriterionEditor inline

### Zustand Store Extension

In `cohortExpressionStore.ts`, add:

```typescript
addRiskScoreCriterion: (criterion: RiskScoreCriterion) => void
removeRiskScoreCriterion: (index: number) => void
updateRiskScoreCriterion: (index: number, criterion: RiskScoreCriterion) => void
```

These update `expression.RiskScoreCriteria` immutably.

### TypeScript Type

In `cohortExpression.ts`, add:

```typescript
export interface RiskScoreCriterion {
  id: number;
  label: string;
  analysisId: number;
  scoreId: string;
  scoreName: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | null;
  value: number | null;
  tier: string | null;
  exclude: boolean;
}
```

Add `RiskScoreCriteria?: RiskScoreCriterion[]` to the `CohortExpression` interface.

## Files Changed

### Backend

| File | Change |
|------|--------|
| `backend/app/Services/Cohort/Schema/CohortExpressionSchema.php` | Validate `RiskScoreCriteria` array entries |
| `backend/app/Services/Cohort/Builders/RiskScoreCriteriaBuilder.php` | **NEW** — CTE generation for risk score filters |
| `backend/app/Services/Cohort/CohortSqlCompiler.php` | Add risk score CTE step + person_id filter in final_cohort |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/features/cohort-definitions/types/cohortExpression.ts` | Add `RiskScoreCriterion` interface, extend `CohortExpression` |
| `frontend/src/features/cohort-definitions/stores/cohortExpressionStore.ts` | Add risk score CRUD methods |
| `frontend/src/features/cohort-definitions/components/DomainCriteriaSelector.tsx` | Add "Risk Score" domain button |
| `frontend/src/features/cohort-definitions/components/RiskScoreCriterionEditor.tsx` | **NEW** — configuration panel |
| `frontend/src/features/cohort-definitions/components/RiskScoreCriteriaSection.tsx` | **NEW** — criteria list + add UI |
| `frontend/src/features/cohort-definitions/components/CohortExpressionEditor.tsx` | Add `<RiskScoreCriteriaSection />` |

### No Changes Needed

- No migrations (JSONB column absorbs new keys)
- No new API endpoints
- No route changes
- No model changes

## Out of Scope

- "Between" operator (bt) — use two criteria (>= X and <= Y) instead
- Multi-tier selection in single criterion — use multiple criteria
- Cross-analysis score comparison
- Score distribution preview in the builder
- Auto-running risk score analysis if none exists
