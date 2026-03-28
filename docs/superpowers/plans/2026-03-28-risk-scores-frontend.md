# Population Risk Scores Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the frontend for the existing Population Risk Score engine — catalogue page with source-aware score cards, eligibility pre-flight, run modal with progress, and detail pages with distributions and patient tiers.

**Architecture:** New `risk-scores` feature module following Parthenon patterns (TanStack Query hooks, Zustand if needed, Recharts for visualizations). Two pages: catalogue grid (`/risk-scores`) and detail view (`/risk-scores/:scoreId`). Run modal replicates `AchillesRunModal.tsx` UX. Two new backend endpoints (eligibility + per-score patient list). Existing 4 endpoints unchanged.

**Tech Stack:** React 19, TypeScript strict, TanStack Query, Recharts, Lucide icons, Tailwind 4

**Spec:** `docs/superpowers/specs/2026-03-28-risk-scores-frontend-design.md`

---

## File Structure

### Frontend (Create)

| File | Responsibility |
|------|----------------|
| `frontend/src/features/risk-scores/types/riskScore.ts` | TypeScript interfaces for all API responses |
| `frontend/src/features/risk-scores/api/riskScoreApi.ts` | Fetch functions for all endpoints |
| `frontend/src/features/risk-scores/hooks/useRiskScores.ts` | TanStack Query hooks |
| `frontend/src/features/risk-scores/pages/RiskScoreCataloguePage.tsx` | Card grid with categories |
| `frontend/src/features/risk-scores/pages/RiskScoreDetailPage.tsx` | Distribution + tiers + patient list |
| `frontend/src/features/risk-scores/components/RiskScoreCard.tsx` | Individual score card (3 states) |
| `frontend/src/features/risk-scores/components/RiskScoreRunModal.tsx` | Achilles-pattern progress modal |
| `frontend/src/features/risk-scores/components/TierBreakdownChart.tsx` | Stacked bar + tier table |
| `frontend/src/features/risk-scores/components/ScoreDistributionChart.tsx` | Histogram with percentile lines |

### Frontend (Modify)

| File | Change |
|------|--------|
| `frontend/src/components/layout/Sidebar.tsx` | Add Risk Scores nav item under Evidence |
| `frontend/src/app/router.tsx` | Add `/risk-scores` and `/risk-scores/:scoreId` routes |

### Backend (Create/Modify)

| File | Change |
|------|--------|
| `backend/app/Http/Controllers/Api/V1/PopulationRiskScoreController.php` | Add `eligibility()` and `patients()` methods |
| `backend/routes/api.php` | Add eligibility and patients routes |

---

## Existing Backend API Reference

### GET `/api/v1/risk-scores/catalogue`
Returns: `{ scores: [{ score_id, score_name, category, description, eligible_population, required_components, risk_tiers, required_tables }] }`

### GET `/api/v1/sources/{source}/risk-scores`
Returns: `{ source_id, last_run, scores_computed, summary: [...], by_category: { "Comorbidity Burden": [...] } }`

### POST `/api/v1/sources/{source}/risk-scores/run`
Returns (synchronous, ~10-30s): `{ source_id, completed, failed, scores: [{ score_id, score_name, status, tiers, elapsed_ms, error? }] }`

### GET `/api/v1/sources/{source}/risk-scores/{scoreId}`
Returns: `{ score_id, score_name, category, description, eligible_population, required_components, risk_tiers_defined, total_eligible, total_computable, completeness_rate, mean_confidence, mean_completeness, last_run, tiers: [{ risk_tier, patient_count, tier_fraction, mean_score, p25_score, median_score, p75_score, mean_confidence, mean_completeness, missing_components }] }`

---

## Task 1: TypeScript Types

**Files:**
- Create: `frontend/src/features/risk-scores/types/riskScore.ts`

- [ ] **Step 1: Create the types file**

```typescript
// ── Catalogue types ─────────────────────────────────────────────

export interface RiskScoreModel {
  score_id: string;
  score_name: string;
  category: string;
  description: string;
  eligible_population: string;
  required_components: string[];
  risk_tiers: Record<string, [number | null, number | null]>;
  required_tables: string[];
}

export interface RiskScoreCatalogue {
  scores: RiskScoreModel[];
}

// ── Eligibility types ───────────────────────────────────────────

export interface ScoreEligibility {
  eligible: boolean;
  patient_count: number;
  missing: string[];
}

export type EligibilityMap = Record<string, ScoreEligibility>;

// ── Results types ───────────────────────────────────────────────

export interface RiskScoreTier {
  risk_tier: string;
  patient_count: number;
  tier_fraction: number | null;
  mean_score: number | null;
  p25_score: number | null;
  median_score: number | null;
  p75_score: number | null;
  mean_confidence: number | null;
  mean_completeness: number | null;
  missing_components: Record<string, number>;
}

export interface RiskScoreSummary {
  score_id: string;
  score_name: string;
  category: string;
  total_patients: number;
  avg_confidence: number | null;
  avg_completeness: number | null;
  last_run: string | null;
}

export interface RiskScoreSourceResults {
  source_id: number;
  last_run: string | null;
  scores_computed: number;
  summary: RiskScoreSummary[];
  by_category: Record<string, Array<{
    score_id: string;
    score_name: string;
    category: string;
    total_eligible: number;
    computable_count: number;
    uncomputable_count: number;
    mean_confidence: number;
    mean_completeness: number;
    tiers: RiskScoreTier[];
  }>>;
}

export interface RiskScoreDetail {
  score_id: string;
  score_name: string;
  category: string;
  description: string;
  eligible_population: string;
  required_components: string[];
  risk_tiers_defined: Record<string, [number | null, number | null]>;
  total_eligible: number;
  total_computable: number;
  completeness_rate: number | null;
  mean_confidence: number;
  mean_completeness: number;
  last_run: string | null;
  tiers: RiskScoreTier[];
}

// ── Run types ───────────────────────────────────────────────────

export interface RunScoreResult {
  score_id: string;
  score_name: string;
  status: "completed" | "failed";
  tiers?: number;
  elapsed_ms?: number;
  error?: string;
}

export interface RunOutcome {
  source_id: number;
  completed: number;
  failed: number;
  scores: RunScoreResult[];
}

// ── Patient list types ──────────────────────────────────────────

export interface RiskScorePatient {
  person_id: number;
  score_value: number | null;
  risk_tier: string;
  confidence: number;
  completeness: number;
  missing_components: string[];
}

export interface RiskScorePatientList {
  data: RiskScorePatient[];
  total: number;
  page: number;
  per_page: number;
}

// ── Category grouping ───────────────────────────────────────────

export const CATEGORY_ORDER = [
  "Cardiovascular",
  "Comorbidity Burden",
  "Hepatic",
  "Pulmonary",
  "Metabolic",
  "Musculoskeletal",
] as const;

export const TIER_COLORS: Record<string, string> = {
  low: "#2DD4BF",
  intermediate: "#C9A227",
  high: "#F59E0B",
  very_high: "#9B1B30",
  uncomputable: "#5A5650",
};

export const TIER_ORDER = ["low", "intermediate", "high", "very_high", "uncomputable"] as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | tail -5`
Expected: No new errors from the types file.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/risk-scores/types/riskScore.ts
git commit -m "feat(risk-scores): add TypeScript types for risk score API"
```

---

## Task 2: API Layer and Hooks

**Files:**
- Create: `frontend/src/features/risk-scores/api/riskScoreApi.ts`
- Create: `frontend/src/features/risk-scores/hooks/useRiskScores.ts`

- [ ] **Step 1: Create the API fetch functions**

```typescript
import { apiClient } from "@/lib/api";
import type {
  RiskScoreCatalogue,
  EligibilityMap,
  RiskScoreSourceResults,
  RiskScoreDetail,
  RunOutcome,
} from "../types/riskScore";

export async function fetchCatalogue(): Promise<RiskScoreCatalogue> {
  const { data } = await apiClient.get<RiskScoreCatalogue>("/risk-scores/catalogue");
  return data;
}

export async function fetchEligibility(sourceId: number): Promise<EligibilityMap> {
  const { data } = await apiClient.get<EligibilityMap>(
    `/sources/${sourceId}/risk-scores/eligibility`,
  );
  return data;
}

export async function fetchSourceResults(sourceId: number): Promise<RiskScoreSourceResults> {
  const { data } = await apiClient.get<RiskScoreSourceResults>(
    `/sources/${sourceId}/risk-scores`,
  );
  return data;
}

export async function fetchScoreDetail(
  sourceId: number,
  scoreId: string,
): Promise<RiskScoreDetail> {
  const { data } = await apiClient.get<RiskScoreDetail>(
    `/sources/${sourceId}/risk-scores/${scoreId}`,
  );
  return data;
}

export async function runRiskScores(
  sourceId: number,
  scoreIds?: string[],
): Promise<RunOutcome> {
  const { data } = await apiClient.post<RunOutcome>(
    `/sources/${sourceId}/risk-scores/run`,
    scoreIds ? { score_ids: scoreIds } : {},
  );
  return data;
}
```

- [ ] **Step 2: Create TanStack Query hooks**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCatalogue,
  fetchEligibility,
  fetchSourceResults,
  fetchScoreDetail,
  runRiskScores,
} from "../api/riskScoreApi";

export function useRiskScoreCatalogue() {
  return useQuery({
    queryKey: ["risk-scores", "catalogue"],
    queryFn: fetchCatalogue,
    staleTime: 1000 * 60 * 60, // catalogue is static, cache 1 hour
  });
}

export function useRiskScoreEligibility(sourceId: number | null) {
  return useQuery({
    queryKey: ["risk-scores", "eligibility", sourceId],
    queryFn: () => fetchEligibility(sourceId!),
    enabled: sourceId != null && sourceId > 0,
    staleTime: 1000 * 60 * 5,
  });
}

export function useRiskScoreResults(sourceId: number | null) {
  return useQuery({
    queryKey: ["risk-scores", "results", sourceId],
    queryFn: () => fetchSourceResults(sourceId!),
    enabled: sourceId != null && sourceId > 0,
  });
}

export function useRiskScoreDetail(sourceId: number | null, scoreId: string | null) {
  return useQuery({
    queryKey: ["risk-scores", "detail", sourceId, scoreId],
    queryFn: () => fetchScoreDetail(sourceId!, scoreId!),
    enabled: sourceId != null && sourceId > 0 && scoreId != null,
  });
}

export function useRunRiskScores(sourceId: number) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (scoreIds?: string[]) => runRiskScores(sourceId, scoreIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["risk-scores", "results", sourceId] });
      qc.invalidateQueries({ queryKey: ["risk-scores", "detail", sourceId] });
      qc.invalidateQueries({ queryKey: ["risk-scores", "eligibility", sourceId] });
    },
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/risk-scores/api/riskScoreApi.ts frontend/src/features/risk-scores/hooks/useRiskScores.ts
git commit -m "feat(risk-scores): add API layer and TanStack Query hooks"
```

---

## Task 3: Backend — Eligibility Endpoint

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/PopulationRiskScoreController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Add the eligibility method to the controller**

Add after the existing `catalogue()` method:

```php
/**
 * GET /api/v1/sources/{source}/risk-scores/eligibility
 *
 * Pre-flight check: which scores can run on this source's CDM data?
 */
public function eligibility(Source $source): JsonResponse
{
    $connection = $source->source_connection ?? 'omop';
    $cdmSchema = $source->getTableQualifier(\App\Enums\DaimonType::CDM);

    if (! $cdmSchema) {
        return response()->json(['error' => 'Source has no CDM daimon configured.'], 422);
    }

    $result = [];

    foreach ($this->registry->all() as $score) {
        $requiredTables = $score->requiredTables();
        $missing = [];
        $patientCount = 0;

        foreach ($requiredTables as $table) {
            try {
                $count = DB::connection($connection)
                    ->selectOne("SELECT COUNT(*) AS cnt FROM {$cdmSchema}.{$table}");
                if ((int) ($count->cnt ?? 0) === 0) {
                    $missing[] = "{$table} (empty)";
                }
            } catch (\Throwable $e) {
                $missing[] = "{$table} (not found)";
            }
        }

        // Get person count if eligible
        if (empty($missing)) {
            try {
                $row = DB::connection($connection)
                    ->selectOne("SELECT COUNT(*) AS cnt FROM {$cdmSchema}.person");
                $patientCount = (int) ($row->cnt ?? 0);
            } catch (\Throwable) {
                // ignore
            }
        }

        $result[$score->scoreId()] = [
            'eligible' => empty($missing),
            'patient_count' => $patientCount,
            'missing' => $missing,
        ];
    }

    return response()->json($result);
}
```

- [ ] **Step 2: Add the route**

In `backend/routes/api.php`, inside the existing `risk-scores` prefix group (around line 407), add:

```php
Route::get('/eligibility', [PopulationRiskScoreController::class, 'eligibility']);
```

This goes inside the `sources/{source}/risk-scores` prefix group, so the full path is `/api/v1/sources/{source}/risk-scores/eligibility`.

- [ ] **Step 3: Add the DB import to the controller**

Add at the top of `PopulationRiskScoreController.php` if not already present:

```php
use Illuminate\Support\Facades\DB;
```

- [ ] **Step 4: Run Pint and verify**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Http/Controllers/Api/V1/PopulationRiskScoreController.php"
```

Test the endpoint:
```bash
TOKEN=$(curl -s -X POST http://localhost:8082/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acumenus.net","password":"superuser"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

curl -s "http://localhost:8082/api/v1/sources/58/risk-scores/eligibility" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20
```

Expected: JSON object with RS001-RS020, each showing eligible/ineligible with patient_count.

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/PopulationRiskScoreController.php backend/routes/api.php
git commit -m "feat(risk-scores): add eligibility pre-flight endpoint"
```

---

## Task 4: Risk Score Card Component

**Files:**
- Create: `frontend/src/features/risk-scores/components/RiskScoreCard.tsx`

- [ ] **Step 1: Create the score card component**

```tsx
import { Activity, Play, RefreshCw, AlertTriangle, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { RiskScoreModel, ScoreEligibility, RiskScoreTier } from "../types/riskScore";
import { TIER_COLORS, TIER_ORDER } from "../types/riskScore";

interface RiskScoreCardProps {
  model: RiskScoreModel;
  eligibility: ScoreEligibility | null;
  tiers: RiskScoreTier[] | null;
  lastRun: string | null;
  sourceId: number | null;
  onRun: (scoreId: string) => void;
  isRunning: boolean;
}

function TierBar({ tiers }: { tiers: RiskScoreTier[] }) {
  const total = tiers.reduce((s, t) => s + t.patient_count, 0);
  if (total === 0) return null;

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-[#1A1A1F]">
      {TIER_ORDER.map((tierName) => {
        const tier = tiers.find((t) => t.risk_tier === tierName);
        if (!tier || tier.patient_count === 0) return null;
        const pct = (tier.patient_count / total) * 100;
        return (
          <div
            key={tierName}
            className="h-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: TIER_COLORS[tierName] ?? "#5A5650" }}
            title={`${tierName}: ${tier.patient_count} (${pct.toFixed(0)}%)`}
          />
        );
      })}
    </div>
  );
}

export function RiskScoreCard({
  model,
  eligibility,
  tiers,
  lastRun,
  sourceId,
  onRun,
  isRunning,
}: RiskScoreCardProps) {
  const hasResults = tiers != null && tiers.length > 0;
  const isEligible = eligibility?.eligible ?? false;
  const noSource = sourceId == null;

  return (
    <div className={cn(
      "rounded-xl border border-[#2A2A2F] bg-[#141418] p-4 transition-all",
      hasResults && "border-[#2DD4BF]/20",
      !isEligible && !hasResults && !noSource && "opacity-60",
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[#C9A227] shrink-0" />
            <h3 className="text-sm font-semibold text-[#F0EDE8] leading-tight">{model.score_name}</h3>
          </div>
          <span className="mt-1 inline-block rounded-full bg-[#1A1A1F] px-2 py-0.5 text-[10px] text-[#8A857D]">
            {model.category}
          </span>
        </div>

        {/* Action button */}
        {noSource ? (
          <span className="text-[10px] text-[#5A5650]">Select source</span>
        ) : hasResults ? (
          <div className="flex items-center gap-1">
            <Link
              to={`/risk-scores/${model.score_id}`}
              className="rounded-lg bg-[#2DD4BF]/10 px-2.5 py-1 text-xs text-[#2DD4BF] hover:bg-[#2DD4BF]/20 transition-colors"
            >
              <BarChart3 size={12} className="inline mr-1" />
              Details
            </Link>
            <button
              onClick={() => onRun(model.score_id)}
              disabled={isRunning}
              className="rounded-lg p-1.5 text-[#8A857D] hover:bg-[#1A1A1F] hover:text-[#C9A227] transition-colors disabled:opacity-50"
              title="Re-run"
            >
              <RefreshCw size={12} className={isRunning ? "animate-spin" : ""} />
            </button>
          </div>
        ) : isEligible ? (
          <button
            onClick={() => onRun(model.score_id)}
            disabled={isRunning}
            className="rounded-lg bg-[#9B1B30] px-3 py-1 text-xs text-white hover:bg-[#B82040] transition-colors disabled:opacity-50"
          >
            {isRunning ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <>
                <Play size={10} className="inline mr-1" />
                Run
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-[#5A5650]">
            <AlertTriangle size={10} />
            <span>Insufficient data</span>
          </div>
        )}
      </div>

      {/* Description */}
      <p className="mt-2 text-xs text-[#8A857D] line-clamp-2">{model.description}</p>

      {/* Results summary */}
      {hasResults && tiers && (
        <div className="mt-3 space-y-2">
          <TierBar tiers={tiers} />
          <div className="flex items-center justify-between text-[10px] text-[#8A857D]">
            <span>{tiers.reduce((s, t) => s + t.patient_count, 0).toLocaleString()} patients</span>
            {lastRun && (
              <span>{new Date(lastRun).toLocaleDateString()}</span>
            )}
          </div>
        </div>
      )}

      {/* Ineligible details */}
      {!isEligible && !hasResults && !noSource && eligibility?.missing && (
        <div className="mt-2 text-[10px] text-[#5A5650]">
          Missing: {eligibility.missing.join(", ")}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/risk-scores/components/RiskScoreCard.tsx
git commit -m "feat(risk-scores): add RiskScoreCard component with 3-state display"
```

---

## Task 5: Run Modal Component

**Files:**
- Create: `frontend/src/features/risk-scores/components/RiskScoreRunModal.tsx`

- [ ] **Step 1: Create the run modal (Achilles pattern)**

This component receives the run outcome (synchronous response from POST /run) and displays results in the Achilles modal format. Since the backend runs synchronously, the modal shows a loading state during the request, then the full results.

```tsx
import { useState, useEffect } from "react";
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  SkipForward,
  Activity,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RunOutcome, RunScoreResult, EligibilityMap } from "../types/riskScore";
import { CATEGORY_ORDER } from "../types/riskScore";

interface RiskScoreRunModalProps {
  isRunning: boolean;
  outcome: RunOutcome | null;
  eligibility: EligibilityMap | null;
  onClose: () => void;
  startedAt: Date | null;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toFixed(0)}s`;
}

function LiveTimer({ startedAt }: { startedAt: Date }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((Date.now() - startedAt.getTime()) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C9A227] tabular-nums">
      {formatDuration(elapsed)}
    </span>
  );
}

function ScoreRow({ result }: { result: RunScoreResult }) {
  const [showError, setShowError] = useState(false);

  return (
    <div className="space-y-0">
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-3 rounded-md text-sm",
          result.status === "failed" && "bg-[#E85A6B]/5 cursor-pointer",
        )}
        onClick={() => result.status === "failed" && setShowError(!showError)}
      >
        {result.status === "completed" && <CheckCircle2 size={13} className="text-[#2DD4BF] shrink-0" />}
        {result.status === "failed" && <AlertCircle size={13} className="text-[#E85A6B] shrink-0" />}

        <span className={cn(
          "flex-1 truncate",
          result.status === "completed" && "text-[#C5C0B8]",
          result.status === "failed" && "text-[#E85A6B]",
        )}>
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D] mr-1.5">
            {result.score_id}
          </span>
          {result.score_name}
        </span>

        {result.status === "completed" && result.elapsed_ms != null && (
          <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#2DD4BF] tabular-nums">
            {(result.elapsed_ms / 1000).toFixed(1)}s
          </span>
        )}

        {result.status === "completed" && result.tiers != null && (
          <span className="text-xs text-[#8A857D]">{result.tiers} tiers</span>
        )}
      </div>

      {showError && result.error && (
        <div className="mx-3 mb-1 rounded-md bg-[#E85A6B]/5 border border-[#E85A6B]/20 p-2">
          <p className="text-xs font-['IBM_Plex_Mono',monospace] text-[#E85A6B]/80 break-all whitespace-pre-wrap">
            {result.error}
          </p>
        </div>
      )}
    </div>
  );
}

function SkippedRow({ scoreId, reason }: { scoreId: string; reason: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-3 text-sm">
      <SkipForward size={13} className="text-[#5A5650] shrink-0" />
      <span className="flex-1 truncate text-[#5A5650]">
        <span className="font-['IBM_Plex_Mono',monospace] text-xs mr-1.5">{scoreId}</span>
        {reason}
      </span>
      <span className="text-[10px] text-[#5A5650]">ineligible</span>
    </div>
  );
}

export function RiskScoreRunModal({
  isRunning,
  outcome,
  eligibility,
  onClose,
  startedAt,
}: RiskScoreRunModalProps) {
  const completed = outcome?.completed ?? 0;
  const failed = outcome?.failed ?? 0;
  const total = outcome?.scores.length ?? 0;
  const skipped = eligibility
    ? Object.values(eligibility).filter((e) => !e.eligible).length
    : 0;
  const pct = total > 0 ? ((completed + failed) / total) * 100 : 0;
  const isDone = !isRunning && outcome != null;
  const hasFailures = failed > 0;

  // Group results by category (from the catalogue, mapped via score_id prefix)
  const categoryMap: Record<string, string> = {};
  if (eligibility) {
    // We don't have category in eligibility, so we just show flat list
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-[#2A2A2F] bg-[#141418] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2A2A2F] px-6 py-4">
          <div className="flex items-center gap-3">
            {isRunning ? (
              <Activity size={20} className="animate-pulse text-[#C9A227]" />
            ) : (
              <Zap size={20} className={hasFailures ? "text-[#F59E0B]" : "text-[#2DD4BF]"} />
            )}
            <div>
              <h2 className="text-lg font-semibold text-[#F0EDE8]">Population Risk Scores</h2>
              <p className="text-xs text-[#8A857D]">
                {isRunning && startedAt ? (
                  <>Running — <LiveTimer startedAt={startedAt} /></>
                ) : isDone ? (
                  `${completed} completed, ${failed} failed, ${skipped} skipped`
                ) : (
                  "Preparing..."
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#8A857D] hover:bg-[#1A1A1F] hover:text-[#F0EDE8]">
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-3 border-b border-[#2A2A2F]">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold font-['IBM_Plex_Mono',monospace] text-[#C9A227] tabular-nums">
              {isRunning ? "..." : `${pct.toFixed(0)}%`}
            </span>
            <div className="flex-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#1A1A1F]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${isDone ? 100 : 0}%`,
                    background: hasFailures
                      ? "linear-gradient(90deg, #C9A227, #E85A6B)"
                      : "linear-gradient(90deg, #C9A227, #2DD4BF)",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Stats badges */}
          {isDone && (
            <div className="mt-2 flex gap-2 text-xs">
              <span className="rounded-full bg-[#2DD4BF]/10 px-2 py-0.5 text-[#2DD4BF]">
                {completed} passed
              </span>
              {failed > 0 && (
                <span className="rounded-full bg-[#E85A6B]/10 px-2 py-0.5 text-[#E85A6B]">
                  {failed} failed
                </span>
              )}
              {skipped > 0 && (
                <span className="rounded-full bg-[#5A5650]/20 px-2 py-0.5 text-[#5A5650]">
                  {skipped} skipped
                </span>
              )}
            </div>
          )}
        </div>

        {/* Scores list */}
        <div className="max-h-[50vh] overflow-y-auto px-2 py-2">
          {isRunning && !outcome && (
            <div className="flex items-center justify-center gap-2 py-12 text-[#C9A227]">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Computing risk scores...</span>
            </div>
          )}

          {outcome?.scores.map((result) => (
            <ScoreRow key={result.score_id} result={result} />
          ))}

          {/* Show skipped scores below */}
          {isDone && eligibility && (
            <>
              {Object.entries(eligibility)
                .filter(([, e]) => !e.eligible)
                .map(([id, e]) => (
                  <SkippedRow
                    key={id}
                    scoreId={id}
                    reason={e.missing.join(", ")}
                  />
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/risk-scores/components/RiskScoreRunModal.tsx
git commit -m "feat(risk-scores): add Achilles-pattern run modal with progress display"
```

---

## Task 6: Catalogue Page

**Files:**
- Create: `frontend/src/features/risk-scores/pages/RiskScoreCataloguePage.tsx`

- [ ] **Step 1: Create the catalogue page**

```tsx
import { useState, useMemo, Suspense, lazy } from "react";
import { Activity, Play, Loader2 } from "lucide-react";
import { useSourceStore } from "@/stores/sourceStore";
import {
  useRiskScoreCatalogue,
  useRiskScoreEligibility,
  useRiskScoreResults,
  useRunRiskScores,
} from "../hooks/useRiskScores";
import { RiskScoreCard } from "../components/RiskScoreCard";
import { CATEGORY_ORDER } from "../types/riskScore";
import type { RiskScoreTier } from "../types/riskScore";

const RiskScoreRunModal = lazy(() =>
  import("../components/RiskScoreRunModal").then((m) => ({ default: m.RiskScoreRunModal })),
);

export default function RiskScoreCataloguePage() {
  const { selectedSourceId } = useSourceStore();
  const sourceId = selectedSourceId ?? null;

  const { data: catalogue } = useRiskScoreCatalogue();
  const { data: eligibility } = useRiskScoreEligibility(sourceId);
  const { data: results } = useRiskScoreResults(sourceId);

  const runMutation = useRunRiskScores(sourceId ?? 0);
  const [showModal, setShowModal] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<Date | null>(null);

  // Group models by category
  const grouped = useMemo(() => {
    if (!catalogue?.scores) return {};
    const groups: Record<string, typeof catalogue.scores> = {};
    for (const score of catalogue.scores) {
      const cat = score.category;
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(score);
    }
    return groups;
  }, [catalogue]);

  // Build a lookup: scoreId → tiers from results
  const tiersByScore = useMemo(() => {
    if (!results?.by_category) return {};
    const map: Record<string, { tiers: RiskScoreTier[]; lastRun: string | null }> = {};
    for (const scores of Object.values(results.by_category)) {
      for (const s of scores) {
        map[s.score_id] = {
          tiers: s.tiers as RiskScoreTier[],
          lastRun: results.last_run,
        };
      }
    }
    return map;
  }, [results]);

  const handleRunAll = () => {
    setRunStartedAt(new Date());
    setShowModal(true);
    runMutation.mutate(undefined);
  };

  const handleRunSingle = (scoreId: string) => {
    setRunStartedAt(new Date());
    setShowModal(true);
    runMutation.mutate([scoreId]);
  };

  const eligibleCount = eligibility
    ? Object.values(eligibility).filter((e) => e.eligible).length
    : 0;

  // Sort categories by defined order
  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a as (typeof CATEGORY_ORDER)[number]);
    const bi = CATEGORY_ORDER.indexOf(b as (typeof CATEGORY_ORDER)[number]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#F0EDE8]">Population Risk Scores</h1>
          <p className="text-sm text-[#8A857D]">
            {catalogue?.scores.length ?? 0} clinical risk models
            {sourceId && eligibility && ` — ${eligibleCount} eligible for selected source`}
          </p>
        </div>

        {sourceId && eligibleCount > 0 && (
          <button
            onClick={handleRunAll}
            disabled={runMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-[#9B1B30] px-4 py-2 text-sm text-white hover:bg-[#B82040] transition-colors disabled:opacity-50"
          >
            {runMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Run All Eligible ({eligibleCount})
          </button>
        )}
      </div>

      {!sourceId && (
        <div className="rounded-xl border border-[#C9A227]/20 bg-[#C9A227]/5 p-4 text-sm text-[#C9A227]">
          <Activity size={14} className="inline mr-2" />
          Select a data source from the top bar to run risk score analyses.
        </div>
      )}

      {/* Category sections */}
      {sortedCategories.map((category) => (
        <div key={category}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8A857D]">
            {category}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {grouped[category].map((model) => {
              const scoreResult = tiersByScore[model.score_id];
              return (
                <RiskScoreCard
                  key={model.score_id}
                  model={model}
                  eligibility={eligibility?.[model.score_id] ?? null}
                  tiers={scoreResult?.tiers ?? null}
                  lastRun={scoreResult?.lastRun ?? null}
                  sourceId={sourceId}
                  onRun={handleRunSingle}
                  isRunning={runMutation.isPending}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Run modal */}
      {showModal && (
        <Suspense fallback={null}>
          <RiskScoreRunModal
            isRunning={runMutation.isPending}
            outcome={runMutation.data ?? null}
            eligibility={eligibility ?? null}
            onClose={() => setShowModal(false)}
            startedAt={runStartedAt}
          />
        </Suspense>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/risk-scores/pages/RiskScoreCataloguePage.tsx
git commit -m "feat(risk-scores): add catalogue page with category-grouped score cards"
```

---

## Task 7: Detail Page with Charts

**Files:**
- Create: `frontend/src/features/risk-scores/components/TierBreakdownChart.tsx`
- Create: `frontend/src/features/risk-scores/components/ScoreDistributionChart.tsx`
- Create: `frontend/src/features/risk-scores/pages/RiskScoreDetailPage.tsx`

- [ ] **Step 1: Create the tier breakdown chart**

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { RiskScoreTier } from "../types/riskScore";
import { TIER_COLORS, TIER_ORDER } from "../types/riskScore";

interface TierBreakdownChartProps {
  tiers: RiskScoreTier[];
  onTierClick?: (tier: string) => void;
  activeTier?: string | null;
}

export function TierBreakdownChart({ tiers, onTierClick, activeTier }: TierBreakdownChartProps) {
  const total = tiers.reduce((s, t) => s + t.patient_count, 0);

  const chartData = TIER_ORDER
    .map((tierName) => {
      const tier = tiers.find((t) => t.risk_tier === tierName);
      if (!tier || tier.patient_count === 0) return null;
      return {
        name: tierName.replace("_", " "),
        count: tier.patient_count,
        pct: total > 0 ? ((tier.patient_count / total) * 100) : 0,
        mean: tier.mean_score,
        color: TIER_COLORS[tierName] ?? "#5A5650",
        tier: tierName,
      };
    })
    .filter(Boolean) as Array<{
      name: string; count: number; pct: number; mean: number | null; color: string; tier: string;
    }>;

  return (
    <div className="space-y-4">
      {/* Stacked horizontal bar */}
      <div className="flex h-6 w-full overflow-hidden rounded-lg bg-[#1A1A1F]">
        {chartData.map((d) => (
          <div
            key={d.tier}
            className="h-full cursor-pointer transition-opacity hover:opacity-80"
            style={{
              width: `${d.pct}%`,
              backgroundColor: d.color,
              opacity: activeTier && activeTier !== d.tier ? 0.4 : 1,
            }}
            onClick={() => onTierClick?.(d.tier)}
            title={`${d.name}: ${d.count} (${d.pct.toFixed(1)}%)`}
          />
        ))}
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData}>
          <XAxis dataKey="name" tick={{ fill: "#8A857D", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#8A857D", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1A1A1F", border: "1px solid #2A2A2F", borderRadius: 8 }}
            labelStyle={{ color: "#F0EDE8" }}
            formatter={((value: number) => [`${value} patients`, "Count"]) as never}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d) => onTierClick?.(d.tier)}>
            {chartData.map((d) => (
              <Cell
                key={d.tier}
                fill={d.color}
                opacity={activeTier && activeTier !== d.tier ? 0.4 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Tier table */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2A2A2F] text-left text-xs text-[#8A857D]">
            <th className="py-2">Tier</th>
            <th className="py-2 text-right">Count</th>
            <th className="py-2 text-right">%</th>
            <th className="py-2 text-right">Mean Score</th>
          </tr>
        </thead>
        <tbody>
          {chartData.map((d) => (
            <tr
              key={d.tier}
              className="border-b border-[#1A1A1F] cursor-pointer hover:bg-[#1A1A1F] transition-colors"
              style={{ opacity: activeTier && activeTier !== d.tier ? 0.4 : 1 }}
              onClick={() => onTierClick?.(d.tier)}
            >
              <td className="py-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full mr-2" style={{ backgroundColor: d.color }} />
                <span className="capitalize text-[#F0EDE8]">{d.name}</span>
              </td>
              <td className="py-2 text-right font-['IBM_Plex_Mono',monospace] text-[#C5C0B8]">
                {d.count.toLocaleString()}
              </td>
              <td className="py-2 text-right font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                {d.pct.toFixed(1)}%
              </td>
              <td className="py-2 text-right font-['IBM_Plex_Mono',monospace] text-[#C5C0B8]">
                {d.mean != null ? d.mean.toFixed(1) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Create the detail page**

```tsx
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Loader2, Activity } from "lucide-react";
import { useSourceStore } from "@/stores/sourceStore";
import { useRiskScoreDetail, useRunRiskScores } from "../hooks/useRiskScores";
import { TierBreakdownChart } from "../components/TierBreakdownChart";

export default function RiskScoreDetailPage() {
  const { scoreId } = useParams<{ scoreId: string }>();
  const { selectedSourceId } = useSourceStore();
  const sourceId = selectedSourceId ?? null;

  const { data: detail, isLoading } = useRiskScoreDetail(sourceId, scoreId ?? null);
  const runMutation = useRunRiskScores(sourceId ?? 0);
  const [activeTier, setActiveTier] = useState<string | null>(null);

  const handleRerun = () => {
    if (scoreId) {
      runMutation.mutate([scoreId]);
    }
  };

  if (!sourceId) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-[#C9A227]/20 bg-[#C9A227]/5 p-4 text-sm text-[#C9A227]">
          <Activity size={14} className="inline mr-2" />
          Select a data source to view risk score details.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={24} className="animate-spin text-[#C9A227]" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6">
        <Link to="/risk-scores" className="flex items-center gap-1 text-sm text-[#8A857D] hover:text-[#F0EDE8] mb-4">
          <ArrowLeft size={14} /> Back to catalogue
        </Link>
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-8 text-center">
          <p className="text-[#8A857D]">No results for {scoreId}. Run the score first from the catalogue.</p>
          <Link to="/risk-scores" className="mt-2 inline-block text-sm text-[#C9A227] hover:underline">
            Go to catalogue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div>
        <Link to="/risk-scores" className="flex items-center gap-1 text-sm text-[#8A857D] hover:text-[#F0EDE8] mb-2">
          <ArrowLeft size={14} /> Back to catalogue
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#F0EDE8]">{detail.score_name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full bg-[#1A1A1F] px-2 py-0.5 text-xs text-[#8A857D]">
                {detail.category}
              </span>
              {detail.last_run && (
                <span className="text-xs text-[#5A5650]">
                  Last run: {new Date(detail.last_run).toLocaleString()}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-[#8A857D] max-w-2xl">{detail.description}</p>
          </div>
          <button
            onClick={handleRerun}
            disabled={runMutation.isPending}
            className="flex items-center gap-2 rounded-lg border border-[#2A2A2F] px-3 py-1.5 text-sm text-[#C9A227] hover:bg-[#1A1A1F] disabled:opacity-50"
          >
            <RefreshCw size={14} className={runMutation.isPending ? "animate-spin" : ""} />
            Re-run
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Eligible", value: detail.total_eligible.toLocaleString() },
          { label: "Computable", value: detail.total_computable.toLocaleString() },
          { label: "Completeness", value: detail.completeness_rate != null ? `${(detail.completeness_rate * 100).toFixed(1)}%` : "—" },
          { label: "Confidence", value: `${(detail.mean_confidence * 100).toFixed(1)}%` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-4">
            <p className="text-xs text-[#8A857D]">{stat.label}</p>
            <p className="mt-1 text-xl font-bold font-['IBM_Plex_Mono',monospace] text-[#F0EDE8]">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tier breakdown */}
      <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
        <h2 className="text-lg font-semibold text-[#F0EDE8] mb-4">Risk Tier Distribution</h2>
        <TierBreakdownChart
          tiers={detail.tiers}
          onTierClick={(tier) => setActiveTier(activeTier === tier ? null : tier)}
          activeTier={activeTier}
        />
      </div>

      {/* Required components */}
      {detail.required_components.length > 0 && (
        <div className="rounded-xl border border-[#2A2A2F] bg-[#141418] p-6">
          <h2 className="text-lg font-semibold text-[#F0EDE8] mb-3">Required Components</h2>
          <div className="flex flex-wrap gap-2">
            {detail.required_components.map((comp) => (
              <span key={comp} className="rounded-full bg-[#1A1A1F] px-3 py-1 text-xs text-[#C5C0B8]">
                {comp}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#5A5650]">
            Eligible population: {detail.eligible_population}
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
git add \
  frontend/src/features/risk-scores/components/TierBreakdownChart.tsx \
  frontend/src/features/risk-scores/pages/RiskScoreDetailPage.tsx
git commit -m "feat(risk-scores): add detail page with tier breakdown charts"
```

---

## Task 8: Navigation and Routing

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/app/router.tsx`

- [ ] **Step 1: Add Risk Scores to sidebar navigation**

In `Sidebar.tsx`, find the Evidence group (the one containing `/profiles`, `/genomics`, `/imaging`, `/heor`, `/gis`). Add the Risk Scores entry after Patient Profiles:

```typescript
{ path: "/risk-scores", label: "Risk Scores", icon: Activity },
```

Import `Activity` from `lucide-react` if not already imported (it likely is — used by the Tools group).

- [ ] **Step 2: Add routes to router.tsx**

In `router.tsx`, add inside the protected layout children (find the area with other feature routes like `heor`, `genomics`, etc.):

```typescript
{
  path: "risk-scores",
  children: [
    {
      index: true,
      lazy: () =>
        import("@/features/risk-scores/pages/RiskScoreCataloguePage").then(
          (m) => ({ Component: m.default }),
        ),
    },
    {
      path: ":scoreId",
      lazy: () =>
        import("@/features/risk-scores/pages/RiskScoreDetailPage").then(
          (m) => ({ Component: m.default }),
        ),
    },
  ],
},
```

- [ ] **Step 3: Verify TypeScript and build**

Run both:
```bash
cd frontend && npx tsc --noEmit 2>&1 | tail -5
cd frontend && npx vite build 2>&1 | tail -10
```

Both must pass — `vite build` is stricter than `tsc`.

- [ ] **Step 4: Test in browser**

Navigate to http://localhost:5175/risk-scores — should show the catalogue page with 20 score cards grouped by category.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx frontend/src/app/router.tsx
git commit -m "feat(risk-scores): add sidebar navigation and routes"
```

---

## Task 9: Run Risk Scores on Pancreas Corpus and Verify

**Files:** None (verification only)

- [ ] **Step 1: Test the eligibility endpoint**

```bash
TOKEN=$(curl -s -X POST http://localhost:8082/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acumenus.net","password":"superuser"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

curl -s "http://localhost:8082/api/v1/sources/58/risk-scores/eligibility" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for k, v in sorted(data.items()):
    status = 'ELIGIBLE' if v['eligible'] else 'INELIGIBLE: ' + ', '.join(v['missing'])
    print(f'  {k}: {status}')
"
```

- [ ] **Step 2: Run all risk scores via API**

```bash
curl -s -X POST "http://localhost:8082/api/v1/sources/58/risk-scores/run" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Completed: {data[\"completed\"]}, Failed: {data[\"failed\"]}')
for s in data['scores']:
    status = f'{s[\"status\"]} ({s.get(\"elapsed_ms\", 0)}ms, {s.get(\"tiers\", 0)} tiers)' if s['status'] == 'completed' else f'FAILED: {s.get(\"error\", \"\")[:80]}'
    print(f'  {s[\"score_id\"]} {s[\"score_name\"]}: {status}')
"
```

- [ ] **Step 3: Verify results in database**

```bash
psql -h localhost -U claude_dev -d parthenon -c "
SELECT score_id, score_name, risk_tier, patient_count, mean_score
FROM app.population_risk_score_results
WHERE source_id = 58
ORDER BY score_id, risk_tier
LIMIT 30;"
```

- [ ] **Step 4: Test detail endpoint**

```bash
curl -s "http://localhost:8082/api/v1/sources/58/risk-scores/RS005" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -30
```

- [ ] **Step 5: Verify UI in browser**

1. Navigate to http://localhost:5175/risk-scores
2. Select PANCREAS source
3. Cards should show eligibility status
4. Click "Run All Eligible" — modal shows progress
5. After completion, cards update with tier bars
6. Click "Details" on Charlson — detail page shows distribution

- [ ] **Step 6: Deploy frontend**

```bash
./deploy.sh --frontend
```

- [ ] **Step 7: Final commit and push**

```bash
git add -A
git commit -m "feat(risk-scores): complete population risk scores frontend with catalogue, run modal, and detail views"
git push
```
