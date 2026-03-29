# Cohort Builder — Risk Score Criteria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Risk Score" criterion type to the cohort expression engine so researchers can filter cohorts by pre-computed risk score values or tiers.

**Architecture:** New top-level `RiskScoreCriteria` array in `expression_json` (mirroring GenomicCriteria/ImagingCriteria). A new `RiskScoreCriteriaBuilder` generates CTEs that JOIN `risk_score_patient_results` at the latest completed execution. Frontend adds a configuration panel and criteria section to the expression editor.

**Tech Stack:** Laravel 11 / PHP 8.4 (backend SQL compiler), React 19 / TypeScript / Zustand (frontend builder)

**Spec:** `docs/superpowers/specs/2026-03-29-cohort-risk-score-criteria-design.md`

---

## File Structure

### Files to Create

| File | Responsibility |
|------|---------------|
| `backend/app/Services/Cohort/Builders/RiskScoreCriteriaBuilder.php` | Generate CTEs for risk score patient filtering |
| `frontend/src/features/cohort-definitions/components/RiskScoreCriterionEditor.tsx` | Configuration panel: analysis + score + operator/tier selection |
| `frontend/src/features/cohort-definitions/components/RiskScoreCriteriaSection.tsx` | Criteria list + add button, renders in expression editor |

### Files to Modify

| File | Change |
|------|--------|
| `backend/app/Services/Cohort/Schema/CohortExpressionSchema.php` | Validate `RiskScoreCriteria` entries |
| `backend/app/Services/Cohort/CohortSqlCompiler.php` | Inject risk score CTEs + person_id filters into final_cohort |
| `frontend/src/features/cohort-definitions/types/cohortExpression.ts` | Add `RiskScoreCriterion` interface, extend `CohortExpression` |
| `frontend/src/features/cohort-definitions/stores/cohortExpressionStore.ts` | Add risk score CRUD methods |
| `frontend/src/features/cohort-definitions/components/CohortExpressionEditor.tsx` | Add `<RiskScoreCriteriaSection />` section |

---

## Task 1: Backend — RiskScoreCriteriaBuilder

**Files:**
- Create: `backend/app/Services/Cohort/Builders/RiskScoreCriteriaBuilder.php`

- [ ] **Step 1: Create the builder class**

```php
<?php

namespace App\Services\Cohort\Builders;

use App\Models\App\RiskScoreAnalysis;

/**
 * Generates CTEs that filter patients by pre-computed risk score results.
 *
 * Each RiskScoreCriteria entry becomes a CTE that resolves the latest
 * completed execution for the given analysis and filters person_ids
 * by score value or tier.
 */
class RiskScoreCriteriaBuilder
{
    private const OPERATORS = [
        'gt' => '>',
        'gte' => '>=',
        'lt' => '<',
        'lte' => '<=',
        'eq' => '=',
    ];

    /**
     * Build CTEs for risk score criteria.
     *
     * @param  array<int, array<string, mixed>>  $criteria  The RiskScoreCriteria array
     * @return array{ctes: list<string>, filters: list<array{index: int, exclude: bool}>}
     */
    public function build(array $criteria): array
    {
        $ctes = [];
        $filters = [];

        foreach ($criteria as $index => $criterion) {
            $analysisId = (int) $criterion['analysisId'];
            $scoreId = $this->escape($criterion['scoreId']);
            $exclude = (bool) ($criterion['exclude'] ?? false);

            $analysisType = $this->escape(RiskScoreAnalysis::class);

            // Subquery to find the latest completed execution for this analysis
            $latestExecSubquery = <<<SQL
                SELECT MAX(ae2.id)
                FROM analysis_executions ae2
                WHERE ae2.analysis_type = '{$analysisType}'
                  AND ae2.analysis_id = {$analysisId}
                  AND ae2.status = 'completed'
            SQL;

            // Build the WHERE clause based on operator+value or tier
            $filterClause = $this->buildFilterClause($criterion);

            $cteName = "risk_score_filter_{$index}";

            $ctes[] = <<<SQL
{$cteName} AS (
    SELECT DISTINCT rspr.person_id
    FROM risk_score_patient_results rspr
    INNER JOIN analysis_executions ae
        ON ae.id = rspr.execution_id
        AND ae.analysis_type = '{$analysisType}'
        AND ae.analysis_id = {$analysisId}
        AND ae.status = 'completed'
    WHERE rspr.score_id = '{$scoreId}'
      AND {$filterClause}
      AND ae.id = ({$latestExecSubquery})
)
SQL;

            $filters[] = ['index' => $index, 'exclude' => $exclude];
        }

        return ['ctes' => $ctes, 'filters' => $filters];
    }

    /**
     * Build the WHERE filter clause for a single criterion.
     */
    private function buildFilterClause(array $criterion): string
    {
        // Tier-based filter
        if (! empty($criterion['tier'])) {
            $tier = $this->escape($criterion['tier']);

            return "rspr.risk_tier = '{$tier}'";
        }

        // Value-based filter
        $operator = $criterion['operator'] ?? 'gte';
        $value = (float) ($criterion['value'] ?? 0);
        $sqlOp = self::OPERATORS[$operator] ?? '>=';

        return "rspr.score_value {$sqlOp} {$value}";
    }

    /**
     * Escape a string value for safe SQL interpolation.
     * Uses simple single-quote escaping (no user input — values come from validated expression_json).
     */
    private function escape(string $value): string
    {
        return str_replace("'", "''", $value);
    }
}
```

- [ ] **Step 2: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Services/Cohort/Builders/RiskScoreCriteriaBuilder.php"
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Services/Cohort/Builders/RiskScoreCriteriaBuilder.php
git commit -m "feat(cohort): add RiskScoreCriteriaBuilder for risk score patient filtering CTEs"
```

---

## Task 2: Backend — Schema Validation + Compiler Integration

**Files:**
- Modify: `backend/app/Services/Cohort/Schema/CohortExpressionSchema.php`
- Modify: `backend/app/Services/Cohort/CohortSqlCompiler.php`

- [ ] **Step 1: Add RiskScoreCriteria validation to schema**

In `CohortExpressionSchema.php`, after the CollapseSettings normalization (line 112) and before the `return $expression;` (line 114), add:

```php
        // Normalize RiskScoreCriteria (optional)
        if (! isset($expression['RiskScoreCriteria'])) {
            $expression['RiskScoreCriteria'] = [];
        } else {
            $this->validateRiskScoreCriteria($expression['RiskScoreCriteria']);
        }
```

Then add the validation method after the existing `normalizeGroup()` method (after line 167):

```php
    /**
     * Validate RiskScoreCriteria entries.
     *
     * @param  array<int, mixed>  $criteria
     *
     * @throws InvalidArgumentException
     */
    private function validateRiskScoreCriteria(array $criteria): void
    {
        foreach ($criteria as $index => $criterion) {
            if (! is_array($criterion)) {
                throw new InvalidArgumentException("RiskScoreCriteria[{$index}] must be an object.");
            }

            if (! isset($criterion['analysisId']) || ! is_int($criterion['analysisId'])) {
                throw new InvalidArgumentException("RiskScoreCriteria[{$index}].analysisId is required and must be an integer.");
            }

            if (! isset($criterion['scoreId']) || ! is_string($criterion['scoreId'])) {
                throw new InvalidArgumentException("RiskScoreCriteria[{$index}].scoreId is required and must be a string.");
            }

            $hasOperator = isset($criterion['operator']) && isset($criterion['value']);
            $hasTier = isset($criterion['tier']) && $criterion['tier'] !== null;

            if (! $hasOperator && ! $hasTier) {
                throw new InvalidArgumentException("RiskScoreCriteria[{$index}] must specify either (operator + value) or tier.");
            }

            if ($hasOperator && ! in_array($criterion['operator'], ['gt', 'gte', 'lt', 'lte', 'eq'], true)) {
                throw new InvalidArgumentException("RiskScoreCriteria[{$index}].operator must be one of: gt, gte, lt, lte, eq.");
            }
        }
    }
```

- [ ] **Step 2: Inject RiskScoreCriteriaBuilder into CohortSqlCompiler**

In `CohortSqlCompiler.php`, add the import at the top:

```php
use App\Services\Cohort\Builders\RiskScoreCriteriaBuilder;
```

Update the constructor to inject the new builder:

```php
    public function __construct(
        private readonly SqlRendererService $sqlRenderer,
        private readonly CohortExpressionSchema $schema,
        private readonly ConceptSetSqlBuilder $conceptSetBuilder,
        private readonly PrimaryCriteriaBuilder $primaryBuilder,
        private readonly InclusionCriteriaBuilder $inclusionBuilder,
        private readonly CensoringBuilder $censoringBuilder,
        private readonly EndStrategyBuilder $endStrategyBuilder,
        private readonly RiskScoreCriteriaBuilder $riskScoreBuilder,
    ) {}
```

- [ ] **Step 3: Add risk score CTEs to compile() method**

In the `compile()` method, after the censoring CTEs block (after line 83: `$allCtes = array_merge($allCtes, $censorResult['ctes']);`) and before the end date expression build (line 86), add:

```php
        // Risk score criteria CTEs
        $riskScoreResult = $this->riskScoreBuilder->build(
            $expression['RiskScoreCriteria'] ?? []
        );
        $allCtes = array_merge($allCtes, $riskScoreResult['ctes']);
```

Then modify the `final_cohort` CTE to include risk score person_id filters. In both the `First` and `All` branches of the ExpressionLimit logic, add risk score WHERE clauses to the final_cohort CTE.

Replace the `First` branch (lines 108-119) with:

```php
        if ($expressionLimit['Type'] === 'First') {
            $riskScoreWhere = $this->buildRiskScoreWhereClauses($riskScoreResult['filters']);
            $finalSelectCte = <<<SQL
final_cohort AS (
    SELECT
        ie.person_id,
        ie.start_date,
        {$finalEndDateExpr} AS end_date,
        ROW_NUMBER() OVER (PARTITION BY ie.person_id ORDER BY ie.start_date) AS rn
    FROM {$fromClause}{$censorJoin}
    WHERE ie.start_date <= {$endDateExpr}{$riskScoreWhere}
)
SQL;
            $allCtes[] = $finalSelectCte;
            $finalSelect = "SELECT {$cohortDefinitionId} AS cohort_definition_id, person_id AS subject_id, start_date AS cohort_start_date, end_date AS cohort_end_date\nFROM final_cohort\nWHERE rn = 1";
```

Replace the `All` branch (lines 121-135) with:

```php
        } else {
            $riskScoreWhere = $this->buildRiskScoreWhereClauses($riskScoreResult['filters']);
            $finalSelectCte = <<<SQL
final_cohort AS (
    SELECT
        ie.person_id,
        ie.start_date,
        {$finalEndDateExpr} AS end_date
    FROM {$fromClause}{$censorJoin}
    WHERE ie.start_date <= {$endDateExpr}{$riskScoreWhere}
)
SQL;
            $allCtes[] = $finalSelectCte;
            $finalSelect = "SELECT {$cohortDefinitionId} AS cohort_definition_id, person_id AS subject_id, start_date AS cohort_start_date, end_date AS cohort_end_date\nFROM final_cohort";
        }
```

Add the helper method to the class:

```php
    /**
     * Build WHERE clause fragments for risk score filters.
     *
     * @param  list<array{index: int, exclude: bool}>  $filters
     */
    private function buildRiskScoreWhereClauses(array $filters): string
    {
        if (empty($filters)) {
            return '';
        }

        $clauses = [];
        foreach ($filters as $filter) {
            $cteName = "risk_score_filter_{$filter['index']}";
            if ($filter['exclude']) {
                $clauses[] = "ie.person_id NOT IN (SELECT person_id FROM {$cteName})";
            } else {
                $clauses[] = "ie.person_id IN (SELECT person_id FROM {$cteName})";
            }
        }

        return "\n      AND " . implode("\n      AND ", $clauses);
    }
```

- [ ] **Step 4: Add risk score CTEs to preview() method**

Same changes as compile() — add risk score CTE building after censoring, and modify the final_cohort CTE with the same risk score WHERE clauses. In `preview()`, after line 212 (`$allCtes = array_merge($allCtes, $censorResult['ctes']);`), add:

```php
        // Risk score criteria CTEs
        $riskScoreResult = $this->riskScoreBuilder->build(
            $expression['RiskScoreCriteria'] ?? []
        );
        $allCtes = array_merge($allCtes, $riskScoreResult['ctes']);
```

Then add `$riskScoreWhere` to both `First` and `All` branches in the preview method (same pattern as compile).

- [ ] **Step 5: Run Pint + PHPStan**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse app/Services/Cohort/"
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/Services/Cohort/Schema/CohortExpressionSchema.php \
       backend/app/Services/Cohort/CohortSqlCompiler.php
git commit -m "feat(cohort): integrate risk score criteria into expression validation and SQL compilation"
```

---

## Task 3: Frontend — TypeScript Types + Zustand Store

**Files:**
- Modify: `frontend/src/features/cohort-definitions/types/cohortExpression.ts`
- Modify: `frontend/src/features/cohort-definitions/stores/cohortExpressionStore.ts`

- [ ] **Step 1: Add RiskScoreCriterion interface**

In `cohortExpression.ts`, after the `ImagingCriterion` interface (around line 170) and before the `CohortExpression` interface, add:

```typescript
// ---------------------------------------------------------------------------
// Phase 3 — Risk Score Criteria
// ---------------------------------------------------------------------------

export interface RiskScoreCriterion {
  id: number;
  label: string;
  analysisId: number;
  scoreId: string;
  scoreName: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | null;
  value: number | null;
  tier: string | null;
  exclude: boolean;
}
```

- [ ] **Step 2: Extend CohortExpression interface**

In the `CohortExpression` interface, after `ImagingCriteria?: ImagingCriterion[];` (line 194), add:

```typescript
  // Phase 3 extension
  RiskScoreCriteria?: RiskScoreCriterion[];
```

- [ ] **Step 3: Add store methods**

In `cohortExpressionStore.ts`, find the `loadExpression` function where `GenomicCriteria` and `ImagingCriteria` are normalized (around line 73-74). Add:

```typescript
    RiskScoreCriteria: input.RiskScoreCriteria ?? [],
```

Then find the `addImagingCriterion` and `removeImagingCriterion` methods (around lines 336-352). After `removeImagingCriterion`, add:

```typescript
    addRiskScoreCriterion: (criterion) =>
      set((s) => ({
        isDirty: true,
        expression: {
          ...s.expression,
          RiskScoreCriteria: [...(s.expression.RiskScoreCriteria ?? []), criterion],
        },
      })),

    removeRiskScoreCriterion: (index) =>
      set((s) => ({
        isDirty: true,
        expression: {
          ...s.expression,
          RiskScoreCriteria: (s.expression.RiskScoreCriteria ?? []).filter((_, i) => i !== index),
        },
      })),
```

Also add the type import for `RiskScoreCriterion` at the top of the store file where `GenomicCriterion` and `ImagingCriterion` are imported.

- [ ] **Step 4: Verify TypeScript**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit" 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/cohort-definitions/types/cohortExpression.ts \
       frontend/src/features/cohort-definitions/stores/cohortExpressionStore.ts
git commit -m "feat(cohort): add RiskScoreCriterion type and Zustand store methods"
```

---

## Task 4: Frontend — RiskScoreCriterionEditor Component

**Files:**
- Create: `frontend/src/features/cohort-definitions/components/RiskScoreCriterionEditor.tsx`

- [ ] **Step 1: Create the editor component**

```typescript
import { useState } from "react";
import { Activity, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSourceStore } from "@/stores/sourceStore";
import {
  useAllRiskScoreAnalyses,
  useRiskScoreCatalogue,
} from "@/features/risk-scores/hooks/useRiskScores";
import type { RiskScoreCriterion } from "../types/cohortExpression";

const OPERATORS = [
  { value: "gte", label: "≥", sqlLabel: "greater than or equal to" },
  { value: "gt", label: ">", sqlLabel: "greater than" },
  { value: "lte", label: "≤", sqlLabel: "less than or equal to" },
  { value: "lt", label: "<", sqlLabel: "less than" },
  { value: "eq", label: "=", sqlLabel: "equal to" },
] as const;

const TIERS = [
  { value: "low", label: "Low" },
  { value: "intermediate", label: "Intermediate" },
  { value: "high", label: "High" },
  { value: "very_high", label: "Very High" },
] as const;

interface RiskScoreCriterionEditorProps {
  onAdd: (criterion: RiskScoreCriterion) => void;
  onCancel: () => void;
  nextId: number;
}

export function RiskScoreCriterionEditor({
  onAdd,
  onCancel,
  nextId,
}: RiskScoreCriterionEditorProps) {
  const { activeSourceId, defaultSourceId } = useSourceStore();
  const sourceId = activeSourceId ?? defaultSourceId ?? 0;

  const { data: allAnalyses, isLoading: loadingAnalyses } =
    useAllRiskScoreAnalyses();
  const { data: catalogue } = useRiskScoreCatalogue();

  const [selectedAnalysisId, setSelectedAnalysisId] = useState<number | null>(
    null,
  );
  const [selectedScoreId, setSelectedScoreId] = useState<string>("");
  const [filterMode, setFilterMode] = useState<"value" | "tier">("value");
  const [operator, setOperator] = useState<string>("gte");
  const [value, setValue] = useState<string>("");
  const [tier, setTier] = useState<string>("");
  const [exclude, setExclude] = useState(false);

  const selectedAnalysis = allAnalyses?.data?.find(
    (a) => a.id === selectedAnalysisId,
  );
  const scoreIds = selectedAnalysis?.design_json?.scoreIds ?? [];
  const scoreNameMap: Record<string, string> = {};
  for (const s of catalogue?.scores ?? []) {
    scoreNameMap[s.score_id] = s.score_name;
  }

  const scoreName = scoreNameMap[selectedScoreId] ?? selectedScoreId;

  const canAdd =
    selectedAnalysisId !== null &&
    selectedScoreId !== "" &&
    ((filterMode === "value" && value.trim() !== "") ||
      (filterMode === "tier" && tier !== ""));

  const handleAdd = () => {
    if (!canAdd || selectedAnalysisId === null) return;

    const label =
      filterMode === "value"
        ? `${scoreName} ${OPERATORS.find((o) => o.value === operator)?.label ?? operator} ${value}`
        : `${scoreName} — ${TIERS.find((t) => t.value === tier)?.label ?? tier} Risk`;

    onAdd({
      id: nextId,
      label: exclude ? `NOT: ${label}` : label,
      analysisId: selectedAnalysisId,
      scoreId: selectedScoreId,
      scoreName,
      operator: filterMode === "value" ? (operator as RiskScoreCriterion["operator"]) : null,
      value: filterMode === "value" ? parseFloat(value) : null,
      tier: filterMode === "tier" ? tier : null,
      exclude,
    });
  };

  return (
    <div className="space-y-4 rounded-lg border border-[#9B1B30]/30 bg-[#9B1B30]/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-[#E85A6B]">
        <Activity size={14} />
        Add Risk Score Criterion
      </div>

      {/* Analysis selector */}
      <div>
        <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1">
          Risk Score Analysis
        </label>
        {loadingAnalyses ? (
          <Loader2 size={14} className="animate-spin text-[#8A857D]" />
        ) : (
          <select
            value={selectedAnalysisId ?? ""}
            onChange={(e) => {
              setSelectedAnalysisId(
                e.target.value ? Number(e.target.value) : null,
              );
              setSelectedScoreId("");
            }}
            className="form-input w-full text-sm"
          >
            <option value="">Select analysis...</option>
            {(allAnalyses?.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.design_json.scoreIds.length} scores)
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Score selector */}
      {selectedAnalysisId && scoreIds.length > 0 && (
        <div>
          <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1">
            Score
          </label>
          <select
            value={selectedScoreId}
            onChange={(e) => setSelectedScoreId(e.target.value)}
            className="form-input w-full text-sm"
          >
            <option value="">Select score...</option>
            {scoreIds.map((id) => (
              <option key={id} value={id}>
                {scoreNameMap[id] ?? id}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Filter mode */}
      {selectedScoreId && (
        <>
          <div>
            <label className="block text-[10px] text-[#5A5650] uppercase tracking-wider mb-1">
              Filter By
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterMode("value")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                  filterMode === "value"
                    ? "bg-[#9B1B30]/20 border-[#9B1B30]/40 text-[#E85A6B]"
                    : "border-[#232328] text-[#8A857D] hover:text-[#C5C0B8]",
                )}
              >
                Score Value
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("tier")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                  filterMode === "tier"
                    ? "bg-[#9B1B30]/20 border-[#9B1B30]/40 text-[#E85A6B]"
                    : "border-[#232328] text-[#8A857D] hover:text-[#C5C0B8]",
                )}
              >
                Risk Tier
              </button>
            </div>
          </div>

          {filterMode === "value" ? (
            <div className="flex items-center gap-2">
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="form-input text-sm w-20"
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Threshold"
                className="form-input text-sm flex-1"
                step="0.1"
              />
            </div>
          ) : (
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="form-input w-full text-sm"
            >
              <option value="">Select tier...</option>
              {TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          )}

          {/* Exclude toggle */}
          <label className="flex items-center gap-2 text-xs text-[#8A857D]">
            <input
              type="checkbox"
              checked={exclude}
              onChange={(e) => setExclude(e.target.checked)}
              className="rounded border-[#323238]"
            />
            Exclude patients matching this criterion
          </label>
        </>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-[#232328]">
        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          className="flex items-center gap-1.5 rounded-md bg-[#9B1B30] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#B42240] disabled:opacity-40 transition-colors"
        >
          <CheckCircle2 size={12} />
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-xs text-[#8A857D] hover:text-[#C5C0B8] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/cohort-definitions/components/RiskScoreCriterionEditor.tsx
git commit -m "feat(cohort): add RiskScoreCriterionEditor configuration panel"
```

---

## Task 5: Frontend — RiskScoreCriteriaSection + Editor Integration

**Files:**
- Create: `frontend/src/features/cohort-definitions/components/RiskScoreCriteriaSection.tsx`
- Modify: `frontend/src/features/cohort-definitions/components/CohortExpressionEditor.tsx`

- [ ] **Step 1: Create the criteria section**

```typescript
import { useState } from "react";
import { Activity, X, Plus } from "lucide-react";
import { useCohortExpressionStore } from "../stores/cohortExpressionStore";
import { RiskScoreCriterionEditor } from "./RiskScoreCriterionEditor";

export function RiskScoreCriteriaSection() {
  const { expression, addRiskScoreCriterion, removeRiskScoreCriterion } =
    useCohortExpressionStore();
  const [showAdd, setShowAdd] = useState(false);

  const criteria = expression.RiskScoreCriteria ?? [];
  const nextId = criteria.length > 0 ? Math.max(...criteria.map((c) => c.id)) + 1 : 0;

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#5A5650]">
        Filter cohort by pre-computed risk score values or tiers from Risk Score
        Analyses.
      </p>

      {criteria.map((criterion, i) => (
        <div
          key={criterion.id}
          className="flex items-center justify-between rounded-lg border border-[#9B1B30]/30 bg-[#9B1B30]/10 px-3 py-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Activity size={12} className="text-[#E85A6B] shrink-0" />
            <span className="text-xs text-[#F0EDE8] truncate">
              {criterion.label}
            </span>
            <span className="text-[10px] text-[#8A857D] shrink-0">
              {criterion.scoreName}
            </span>
            {criterion.exclude && (
              <span className="text-[10px] text-red-400 shrink-0">
                EXCLUDE
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => removeRiskScoreCriterion(i)}
            className="text-gray-600 hover:text-red-400 shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      {showAdd ? (
        <RiskScoreCriterionEditor
          nextId={nextId}
          onAdd={(criterion) => {
            addRiskScoreCriterion(criterion);
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg border border-dashed border-[#9B1B30]/40 px-3 py-2 text-xs text-[#E85A6B] hover:border-[#9B1B30] hover:text-[#E85A6B]/80 transition-colors"
        >
          <Plus size={12} />
          Add Risk Score Criterion
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add section to CohortExpressionEditor**

In `CohortExpressionEditor.tsx`:

Add the import at the top (near the GenomicCriteriaPanel and ImagingCriteriaPanel imports):

```typescript
import { RiskScoreCriteriaSection } from "./RiskScoreCriteriaSection";
```

Add the state variable (near `showAddGenomic` and `showAddImaging` around line 108-109):

```typescript
  const riskScoreCount = expression.RiskScoreCriteria?.length ?? 0;
```

After the Imaging Criteria `</CollapsibleSection>` block (around line 440), add a new section:

```typescript
      {/* 9. Risk Score Criteria (Phase 3) */}
      <CollapsibleSection
        title="Risk Score Criteria"
        icon={Activity}
        iconColor="#9B1B30"
        badge={riskScoreCount > 0 ? riskScoreCount : undefined}
      >
        <div className="space-y-3">
          <RiskScoreCriteriaSection />
        </div>
      </CollapsibleSection>
```

Also add the `Activity` icon to the lucide-react imports at the top of the file if not already present.

- [ ] **Step 3: Verify TypeScript + Build**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
docker compose exec node sh -c "cd /app && npx vite build" 2>&1 | grep "✓ built"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/cohort-definitions/components/RiskScoreCriteriaSection.tsx \
       frontend/src/features/cohort-definitions/components/CohortExpressionEditor.tsx
git commit -m "feat(cohort): add Risk Score Criteria section to cohort expression editor"
```

---

## Task 6: CI Preflight

- [ ] **Step 1: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 2: Run PHPStan**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/phpstan analyse app/Services/Cohort/"
```

- [ ] **Step 3: Run TypeScript + Build**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
docker compose exec node sh -c "cd /app && npx vite build"
```

- [ ] **Step 4: Fix any errors and commit**

```bash
git add -A
git commit -m "fix(cohort): resolve lint and build errors from risk score criteria integration"
```
