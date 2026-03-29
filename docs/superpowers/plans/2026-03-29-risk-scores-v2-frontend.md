# Risk Scores v2 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Risk Scores frontend from a static catalogue into a Studies-mirror analysis hub with cohort-scoped execution, recommendation-driven score selection, patient-level results, and inline cohort creation from risk tiers.

**Architecture:** Three pages — Hub (analyses list mirroring StudiesPage), Create (2-step wizard), Detail (5-tab view). The 20-score catalogue moves into the creation wizard as recommendation cards. v2 API used throughout with v1 fallback for unmigrated scores. New backend endpoints for index/stats/update/destroy/create-cohort.

**Tech Stack:** React 19, TypeScript strict, TanStack Query, Zustand, Tailwind 4, Recharts, Lucide icons. Laravel 11 backend with existing v2 services.

**Spec:** `docs/superpowers/specs/2026-03-29-risk-scores-v2-frontend-design.md`

---

## File Structure

### Files to Create (Frontend)

| File | Responsibility |
|------|---------------|
| `frontend/src/features/risk-scores/pages/RiskScoreHubPage.tsx` | Hub page — stats bar, drilldown, filters, table/card toggle, search |
| `frontend/src/features/risk-scores/pages/RiskScoreCreatePage.tsx` | 2-step wizard — cohort selector, recommendation cards, review |
| `frontend/src/features/risk-scores/components/RiskScoreAnalysisList.tsx` | Sortable table with pagination (mirrors StudyList) |
| `frontend/src/features/risk-scores/components/RiskScoreAnalysisCard.tsx` | Card view component (mirrors StudyCard) |
| `frontend/src/features/risk-scores/components/ScoreRecommendationCard.tsx` | 3-tier recommendation cards for wizard + detail |
| `frontend/src/features/risk-scores/components/CohortProfilePanel.tsx` | Cohort demographics, conditions, measurements |
| `frontend/src/features/risk-scores/components/PatientResultsTable.tsx` | TanStack table with filters and bulk actions |
| `frontend/src/features/risk-scores/components/CreateCohortModal.tsx` | Modal for inline cohort creation from tier/filter |
| `frontend/src/features/risk-scores/components/OverviewTab.tsx` | Smart overview with results summary or run CTA |
| `frontend/src/features/risk-scores/components/ResultsTab.tsx` | Per-score tier breakdown cards |
| `frontend/src/features/risk-scores/components/PatientsTab.tsx` | Patient-level table wrapper with filters |
| `frontend/src/features/risk-scores/components/RecommendationsTab.tsx` | Read-only recommendation audit view |
| `frontend/src/features/risk-scores/components/ConfigurationTab.tsx` | Design JSON + execution history |

### Files to Modify (Frontend)

| File | Change |
|------|--------|
| `frontend/src/features/risk-scores/types/riskScore.ts` | Add v2 interfaces (RiskScoreAnalysis, PatientResult, Recommendation, etc.) |
| `frontend/src/features/risk-scores/api/riskScoreApi.ts` | Add v2 API functions (listAnalyses, getAnalysis, createAnalysis, etc.) |
| `frontend/src/features/risk-scores/hooks/useRiskScores.ts` | Add v2 hooks (useRiskScoreAnalyses, useCreateAnalysis, etc.) |
| `frontend/src/app/router.tsx` | Update routes: hub, create, detail by ID |
| `frontend/src/components/layout/Sidebar.tsx` | Update label to "Risk Scores" (already correct) |

### Files to Modify (Backend)

| File | Change |
|------|--------|
| `backend/app/Http/Controllers/Api/V1/RiskScoreAnalysisController.php` | Add index, stats, update, destroy, createCohort methods |
| `backend/routes/api.php` | Add new routes for index, stats, update, destroy, create-cohort |

### Files to Remove (Frontend)

| File | Replacement |
|------|-------------|
| `frontend/src/features/risk-scores/pages/RiskScoreCataloguePage.tsx` | `RiskScoreHubPage.tsx` |
| `frontend/src/features/risk-scores/components/RiskScoreCard.tsx` | `RiskScoreAnalysisCard.tsx` + `ScoreRecommendationCard.tsx` |

---

## Task 1: Backend — New API Endpoints

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/RiskScoreAnalysisController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Add index method to controller**

Add after the existing `show` method in `RiskScoreAnalysisController.php`:

```php
/**
 * List risk score analyses with pagination, search, filters, and facets.
 */
public function index(Request $request): JsonResponse
{
    $query = RiskScoreAnalysis::with(['author'])
        ->withCount('executions');

    // Search
    if ($request->filled('search')) {
        $search = $request->query('search');
        $query->where(function ($q) use ($search) {
            $q->where('name', 'ilike', "%{$search}%")
              ->orWhere('description', 'ilike', "%{$search}%");
        });
    }

    // Filter by status (derived from latest execution)
    if ($request->filled('status')) {
        $status = $request->query('status');
        if ($status === 'draft') {
            $query->whereDoesntHave('executions');
        } else {
            $query->whereHas('executions', function ($q) use ($status) {
                $q->where('status', $status)
                  ->whereRaw('id = (SELECT MAX(id) FROM analysis_executions WHERE analysis_type = ? AND analysis_id = risk_score_analyses.id)', [RiskScoreAnalysis::class]);
            });
        }
    }

    // Filter by category (scores in design_json)
    if ($request->filled('category')) {
        $category = $request->query('category');
        $scoreIds = collect($this->executor->getScoresByCategory($category))
            ->pluck('score_id')
            ->toArray();
        if ($scoreIds) {
            $query->where(function ($q) use ($scoreIds) {
                foreach ($scoreIds as $sid) {
                    $q->orWhereJsonContains('design_json->scoreIds', $sid);
                }
            });
        }
    }

    $perPage = (int) $request->query('per_page', '20');
    $results = $query->orderByDesc('updated_at')->paginate($perPage);

    // Compute facets
    $allAnalyses = RiskScoreAnalysis::withCount('executions')->get();
    $statusFacets = [];
    foreach ($allAnalyses as $a) {
        $latestExec = $a->executions()->latest()->first();
        $s = $latestExec ? $latestExec->status->value : 'draft';
        $statusFacets[$s] = ($statusFacets[$s] ?? 0) + 1;
    }

    return response()->json([
        'data' => $results->items(),
        'total' => $results->total(),
        'current_page' => $results->currentPage(),
        'last_page' => $results->lastPage(),
        'per_page' => $results->perPage(),
        'facets' => [
            'status' => $statusFacets,
        ],
    ]);
}
```

- [ ] **Step 2: Add stats method**

```php
/**
 * Aggregate stats for the hub stats bar.
 */
public function stats(): JsonResponse
{
    $total = RiskScoreAnalysis::count();

    $running = AnalysisExecution::where('analysis_type', RiskScoreAnalysis::class)
        ->whereIn('status', [ExecutionStatus::Pending, ExecutionStatus::Running])
        ->count();

    $completed = RiskScoreAnalysis::whereHas('executions', function ($q) {
        $q->where('status', ExecutionStatus::Completed);
    })->count();

    $patientsScored = RiskScorePatientResult::on('results')->distinct('person_id')->count('person_id');

    $scoresAvailable = 20;

    return response()->json([
        'total' => $total,
        'running' => $running,
        'completed' => $completed,
        'patients_scored' => $patientsScored,
        'scores_available' => $scoresAvailable,
    ]);
}
```

- [ ] **Step 3: Add update and destroy methods**

```php
/**
 * Update a risk score analysis name/description.
 */
public function update(Request $request, RiskScoreAnalysis $analysis): JsonResponse
{
    $validated = $request->validate([
        'name' => 'sometimes|required|string|max:255',
        'description' => 'nullable|string',
    ]);

    $analysis->update($validated);

    return response()->json([
        'data' => $analysis->fresh(['author', 'executions.source']),
    ]);
}

/**
 * Soft-delete a risk score analysis.
 */
public function destroy(RiskScoreAnalysis $analysis): JsonResponse
{
    $analysis->delete();

    return response()->json([
        'message' => 'Analysis deleted.',
    ]);
}
```

- [ ] **Step 4: Add createCohort method**

```php
/**
 * Create a cohort definition from a risk score tier or patient filter.
 */
public function createCohort(RiskScoreAnalysis $analysis, Request $request): JsonResponse
{
    $validated = $request->validate([
        'name' => 'required|string|max:255',
        'description' => 'nullable|string',
        'execution_id' => 'required|integer',
        'score_id' => 'required|string',
        'risk_tier' => 'nullable|string',
        'person_ids' => 'nullable|array',
        'person_ids.*' => 'integer',
    ]);

    $execution = AnalysisExecution::findOrFail($validated['execution_id']);

    // Get person IDs from tier or explicit list
    if (!empty($validated['person_ids'])) {
        $personIds = $validated['person_ids'];
    } else {
        $query = RiskScorePatientResult::on('results')
            ->where('execution_id', $execution->id)
            ->where('score_id', $validated['score_id']);

        if (!empty($validated['risk_tier'])) {
            $query->where('risk_tier', $validated['risk_tier']);
        }

        $personIds = $query->pluck('person_id')->toArray();
    }

    if (empty($personIds)) {
        return response()->json(['error' => 'No patients match the criteria.'], 422);
    }

    // Create cohort definition
    $cohortDef = \App\Models\App\CohortDefinition::create([
        'name' => $validated['name'],
        'description' => $validated['description'] ?? null,
        'expression_type' => 'risk_score_derived',
        'created_by' => $request->user()->id,
        'metadata' => [
            'derivation' => [
                'analysis_id' => $analysis->id,
                'execution_id' => $execution->id,
                'score_id' => $validated['score_id'],
                'risk_tier' => $validated['risk_tier'] ?? null,
            ],
        ],
    ]);

    // Insert into results.cohort
    $sourceId = $execution->source_id;
    $connection = \App\Models\App\Source::findOrFail($sourceId);
    $resultsSchema = $connection->getResultsSchema();

    $chunks = array_chunk($personIds, 500);
    foreach ($chunks as $chunk) {
        $rows = array_map(fn ($pid) => [
            'cohort_definition_id' => $cohortDef->id,
            'subject_id' => $pid,
            'cohort_start_date' => now()->toDateString(),
            'cohort_end_date' => now()->toDateString(),
        ], $chunk);

        \Illuminate\Support\Facades\DB::connection('results')
            ->table("{$resultsSchema}.cohort")
            ->insert($rows);
    }

    return response()->json([
        'data' => $cohortDef,
        'patient_count' => count($personIds),
    ], 201);
}
```

- [ ] **Step 5: Register new routes**

In `backend/routes/api.php`, find the existing risk-score-analyses route group (around line 465) and replace it with:

```php
// Risk Score Analysis v2
Route::middleware('permission:analyses.view')->group(function () {
    Route::get('risk-score-analyses', [RiskScoreAnalysisController::class, 'index']);
    Route::get('risk-score-analyses/stats', [RiskScoreAnalysisController::class, 'stats']);
    Route::get('risk-score-analyses/{analysis}', [RiskScoreAnalysisController::class, 'show']);
    Route::get('risk-score-analyses/{analysis}/executions/{execution}', [RiskScoreAnalysisController::class, 'executionDetail']);
    Route::get('risk-score-analyses/{analysis}/executions/{execution}/patients', [RiskScoreAnalysisController::class, 'patients']);
});
Route::middleware('permission:analyses.create')->group(function () {
    Route::post('risk-score-analyses', [RiskScoreAnalysisController::class, 'store']);
    Route::put('risk-score-analyses/{analysis}', [RiskScoreAnalysisController::class, 'update']);
    Route::delete('risk-score-analyses/{analysis}', [RiskScoreAnalysisController::class, 'destroy']);
    Route::post('risk-score-analyses/{analysis}/execute', [RiskScoreAnalysisController::class, 'execute']);
    Route::post('risk-score-analyses/{analysis}/create-cohort', [RiskScoreAnalysisController::class, 'createCohort']);
});
```

- [ ] **Step 6: Add getScoresByCategory to executor**

In `backend/app/Services/PopulationRisk/RiskScoreExecutionService.php`, add this public method:

```php
/**
 * Get all registered v2 scores filtered by category.
 *
 * @return array<array{score_id: string, score_name: string, category: string}>
 */
public function getScoresByCategory(string $category): array
{
    return collect($this->v2Scores)
        ->filter(fn ($score) => $score->category() === $category)
        ->map(fn ($score) => [
            'score_id' => $score->scoreId(),
            'score_name' => $score->scoreName(),
            'category' => $score->category(),
        ])
        ->values()
        ->toArray();
}
```

- [ ] **Step 7: Run Pint**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`

- [ ] **Step 8: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/RiskScoreAnalysisController.php \
       backend/routes/api.php \
       backend/app/Services/PopulationRisk/RiskScoreExecutionService.php
git commit -m "feat(risk-scores): add v2 API endpoints for index, stats, update, destroy, create-cohort"
```

---

## Task 2: Frontend — v2 Type Definitions

**Files:**
- Modify: `frontend/src/features/risk-scores/types/riskScore.ts`

- [ ] **Step 1: Add v2 interfaces**

Append to the end of `frontend/src/features/risk-scores/types/riskScore.ts`:

```typescript
// ── v2 Analysis Types ────────────────────────────────────────────

export interface RiskScoreAnalysis {
  id: number;
  name: string;
  description: string | null;
  design_json: RiskScoreDesignJson;
  author_id: number;
  author?: { id: number; name: string; email: string };
  executions_count?: number;
  executions?: AnalysisExecution[];
  created_at: string;
  updated_at: string;
}

export interface RiskScoreDesignJson {
  targetCohortIds: number[];
  comparatorCohortIds?: number[];
  scoreIds: string[];
  minCompleteness?: number;
  storePatientLevel?: boolean;
}

export interface RiskScoreAnalysisCreatePayload {
  name: string;
  description?: string;
  design_json: RiskScoreDesignJson;
}

export type RiskScoreAnalysisUpdatePayload = Pick<RiskScoreAnalysisCreatePayload, 'name' | 'description'>;

export interface AnalysisExecution {
  id: number;
  analysis_type: string;
  analysis_id: number;
  source_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result_json: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  source?: { id: number; source_name: string };
}

export interface RiskScoreRunStep {
  id: number;
  execution_id: number;
  score_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  elapsed_ms: number | null;
  patient_count: number | null;
  error_message: string | null;
}

export interface RiskScorePatientResult {
  id: number;
  execution_id: number;
  source_id: number;
  cohort_definition_id: number;
  person_id: number;
  score_id: string;
  score_value: number | null;
  risk_tier: string;
  confidence: number;
  completeness: number;
  missing_components: Record<string, unknown> | null;
  created_at: string;
}

export interface ScoreRecommendation {
  score_id: string;
  score_name: string;
  category: string;
  description: string;
  applicable: boolean;
  reason: string;
  expected_completeness: number | null;
}

export interface CohortProfile {
  id: number;
  name: string;
  person_count: number;
}

export interface RecommendationResponse {
  data: {
    cohort: CohortProfile;
    profile: {
      patient_count: number;
      min_age: number;
      max_age: number;
      female_pct: number;
      top_conditions: Array<{ concept_id: number; name: string; prevalence: number }>;
      measurement_coverage: Record<string, number>;
    };
    recommendations: ScoreRecommendation[];
  };
}

export interface PopulationSummary {
  score_id: string;
  risk_tier: string;
  patient_count: number;
  mean_score: number | null;
  p25_score: number | null;
  median_score: number | null;
  p75_score: number | null;
  mean_confidence: number | null;
  mean_completeness: number | null;
}

export interface ExecutionDetailResponse {
  execution: AnalysisExecution;
  steps: RiskScoreRunStep[];
  population_summaries: PopulationSummary[];
}

export interface RiskScoreAnalysisStats {
  total: number;
  running: number;
  completed: number;
  patients_scored: number;
  scores_available: number;
}

export interface CreateCohortPayload {
  name: string;
  description?: string;
  execution_id: number;
  score_id: string;
  risk_tier?: string;
  person_ids?: number[];
}

export interface CreateCohortResponse {
  data: { id: number; name: string };
  patient_count: number;
}

export const STATUS_COLORS: Record<string, string> = {
  draft: "#8A857D",
  pending: "#C9A227",
  running: "#F59E0B",
  completed: "#2DD4BF",
  failed: "#E85A6B",
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/risk-scores/types/riskScore.ts
git commit -m "feat(risk-scores): add v2 TypeScript interfaces for analyses, recommendations, patient results"
```

---

## Task 3: Frontend — v2 API Layer

**Files:**
- Modify: `frontend/src/features/risk-scores/api/riskScoreApi.ts`

- [ ] **Step 1: Add v2 API functions**

Append to the end of `frontend/src/features/risk-scores/api/riskScoreApi.ts`:

```typescript
import type {
  RiskScoreAnalysis,
  RiskScoreAnalysisCreatePayload,
  RiskScoreAnalysisUpdatePayload,
  RiskScoreAnalysisStats,
  RecommendationResponse,
  ExecutionDetailResponse,
  RiskScorePatientResult,
  CreateCohortPayload,
  CreateCohortResponse,
} from "../types/riskScore";

// ── v2 Analysis API ──────────────────────────────────────────────

export async function listAnalyses(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  category?: string;
}): Promise<{
  data: RiskScoreAnalysis[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  facets?: Record<string, Record<string, number>>;
}> {
  const { data } = await apiClient.get("/risk-score-analyses", { params });
  return data;
}

export async function getAnalysisStats(): Promise<RiskScoreAnalysisStats> {
  const { data } = await apiClient.get<RiskScoreAnalysisStats>(
    "/risk-score-analyses/stats",
  );
  return data;
}

export async function getAnalysis(id: number | string): Promise<RiskScoreAnalysis> {
  const { data } = await apiClient.get(`/risk-score-analyses/${id}`);
  return data.data ?? data;
}

export async function createAnalysis(
  payload: RiskScoreAnalysisCreatePayload,
): Promise<RiskScoreAnalysis> {
  const { data } = await apiClient.post("/risk-score-analyses", payload);
  return data.data ?? data;
}

export async function updateAnalysis(
  id: number | string,
  payload: RiskScoreAnalysisUpdatePayload,
): Promise<RiskScoreAnalysis> {
  const { data } = await apiClient.put(`/risk-score-analyses/${id}`, payload);
  return data.data ?? data;
}

export async function deleteAnalysis(id: number | string): Promise<void> {
  await apiClient.delete(`/risk-score-analyses/${id}`);
}

export async function recommendScores(
  sourceId: number,
  cohortDefinitionId: number,
): Promise<RecommendationResponse["data"]> {
  const { data } = await apiClient.post<RecommendationResponse>(
    `/sources/${sourceId}/risk-scores/recommend`,
    { cohort_definition_id: cohortDefinitionId },
  );
  return data.data ?? data;
}

export async function executeAnalysis(
  analysisId: number | string,
  sourceId: number,
): Promise<{ execution_id: number; status: string; steps: unknown[] }> {
  const { data } = await apiClient.post(
    `/risk-score-analyses/${analysisId}/execute`,
    { source_id: sourceId },
  );
  return data;
}

export async function getExecutionDetail(
  analysisId: number | string,
  executionId: number | string,
): Promise<ExecutionDetailResponse> {
  const { data } = await apiClient.get(
    `/risk-score-analyses/${analysisId}/executions/${executionId}`,
  );
  return data;
}

export async function getExecutionPatients(
  analysisId: number | string,
  executionId: number | string,
  params?: {
    page?: number;
    per_page?: number;
    score_id?: string;
    risk_tier?: string;
  },
): Promise<{
  data: RiskScorePatientResult[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
}> {
  const { data } = await apiClient.get(
    `/risk-score-analyses/${analysisId}/executions/${executionId}/patients`,
    { params },
  );
  return data;
}

export async function createCohortFromTier(
  analysisId: number | string,
  payload: CreateCohortPayload,
): Promise<CreateCohortResponse> {
  const { data } = await apiClient.post(
    `/risk-score-analyses/${analysisId}/create-cohort`,
    payload,
  );
  return data;
}
```

Also update the import block at the top of the file to include the new types. The existing imports stay — add the new ones to the import statement.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/risk-scores/api/riskScoreApi.ts
git commit -m "feat(risk-scores): add v2 API layer for analyses, recommendations, execution, cohort creation"
```

---

## Task 4: Frontend — v2 TanStack Query Hooks

**Files:**
- Modify: `frontend/src/features/risk-scores/hooks/useRiskScores.ts`

- [ ] **Step 1: Add v2 hooks**

Append to the end of `frontend/src/features/risk-scores/hooks/useRiskScores.ts`, after the existing hooks. Also add the new imports at the top:

```typescript
import {
  listAnalyses,
  getAnalysisStats,
  getAnalysis,
  createAnalysis,
  updateAnalysis,
  deleteAnalysis,
  recommendScores,
  executeAnalysis,
  getExecutionDetail,
  getExecutionPatients,
  createCohortFromTier,
} from "../api/riskScoreApi";
import type {
  RiskScoreAnalysisCreatePayload,
  RiskScoreAnalysisUpdatePayload,
  CreateCohortPayload,
} from "../types/riskScore";

// ── v2 Analysis Hooks ────────────────────────────────────────────

export const ANALYSIS_KEYS = {
  all: ["risk-score-analyses"] as const,
  list: (params: Record<string, unknown>) =>
    ["risk-score-analyses", params] as const,
  stats: ["risk-score-analyses", "stats"] as const,
  detail: (id: number | string) =>
    ["risk-score-analyses", id] as const,
  execution: (analysisId: number | string, executionId: number | string) =>
    ["risk-score-analyses", analysisId, "executions", executionId] as const,
  patients: (analysisId: number | string, executionId: number | string, params: Record<string, unknown>) =>
    ["risk-score-analyses", analysisId, "executions", executionId, "patients", params] as const,
  recommend: (sourceId: number, cohortId: number) =>
    ["risk-score-analyses", "recommend", sourceId, cohortId] as const,
};

export function useRiskScoreAnalyses(
  page?: number,
  search?: string,
  filters?: { status?: string; category?: string },
) {
  return useQuery({
    queryKey: ANALYSIS_KEYS.list({ page, search, ...filters }),
    queryFn: () =>
      listAnalyses({
        page: page ?? 1,
        search: search || undefined,
        status: filters?.status ?? undefined,
        category: filters?.category ?? undefined,
      }),
    staleTime: 30_000,
  });
}

export function useRiskScoreAnalysisStats() {
  return useQuery({
    queryKey: ANALYSIS_KEYS.stats,
    queryFn: getAnalysisStats,
    staleTime: 30_000,
  });
}

export function useRiskScoreAnalysis(id: number | string | null) {
  return useQuery({
    queryKey: ANALYSIS_KEYS.detail(id ?? 0),
    queryFn: () => getAnalysis(id!),
    enabled: id != null && id !== "" && id !== 0,
  });
}

export function useRecommendScores(sourceId: number, cohortDefinitionId: number) {
  return useQuery({
    queryKey: ANALYSIS_KEYS.recommend(sourceId, cohortDefinitionId),
    queryFn: () => recommendScores(sourceId, cohortDefinitionId),
    enabled: sourceId > 0 && cohortDefinitionId > 0,
    staleTime: 60_000,
  });
}

export function useExecutionDetail(
  analysisId: number | string | null,
  executionId: number | string | null,
) {
  return useQuery({
    queryKey: ANALYSIS_KEYS.execution(analysisId ?? 0, executionId ?? 0),
    queryFn: () => getExecutionDetail(analysisId!, executionId!),
    enabled: analysisId != null && executionId != null,
  });
}

export function useExecutionPatients(
  analysisId: number | string | null,
  executionId: number | string | null,
  params?: { page?: number; per_page?: number; score_id?: string; risk_tier?: string },
) {
  return useQuery({
    queryKey: ANALYSIS_KEYS.patients(analysisId ?? 0, executionId ?? 0, params ?? {}),
    queryFn: () => getExecutionPatients(analysisId!, executionId!, params),
    enabled: analysisId != null && executionId != null,
  });
}

export function useCreateRiskScoreAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RiskScoreAnalysisCreatePayload) => createAnalysis(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ANALYSIS_KEYS.all });
    },
  });
}

export function useUpdateRiskScoreAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: RiskScoreAnalysisUpdatePayload }) =>
      updateAnalysis(id, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ANALYSIS_KEYS.all });
      qc.invalidateQueries({ queryKey: ANALYSIS_KEYS.detail(variables.id) });
    },
  });
}

export function useDeleteRiskScoreAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteAnalysis(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ANALYSIS_KEYS.all });
    },
  });
}

export function useExecuteRiskScoreAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ analysisId, sourceId }: { analysisId: number | string; sourceId: number }) =>
      executeAnalysis(analysisId, sourceId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ANALYSIS_KEYS.detail(variables.analysisId) });
      qc.invalidateQueries({ queryKey: ANALYSIS_KEYS.stats });
    },
  });
}

export function useCreateCohortFromTier() {
  return useMutation({
    mutationFn: ({ analysisId, payload }: { analysisId: number | string; payload: CreateCohortPayload }) =>
      createCohortFromTier(analysisId, payload),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/risk-scores/hooks/useRiskScores.ts
git commit -m "feat(risk-scores): add v2 TanStack Query hooks for analyses, recommendations, execution"
```

---

## Task 5: Frontend — Hub Page (RiskScoreHubPage)

**Files:**
- Create: `frontend/src/features/risk-scores/pages/RiskScoreHubPage.tsx`

- [ ] **Step 1: Create hub page**

This mirrors `StudiesPage.tsx` exactly — stats bar, drilldown, filter chips, table/card toggle, search. Due to length, this is implemented as a full page component. The file follows the Studies page structure:

1. State: page, searchInput, debouncedSearch, filterStatus, filterCategory, viewMode (localStorage), showDropdown, drilldownStatus
2. Hooks: `useRiskScoreAnalyses(page, search, filters)`, `useRiskScoreAnalysisStats()`, `useRiskScoreAnalyses(1, '', {})` for all analyses dropdown
3. Debounce search input with 300ms timer
4. Stats bar: 5 metric cards (Total, Running, Completed, Scores Available, Patients Scored)
5. Drilldown panel: click stat → filter list
6. Filter chips: Status (Draft, Running, Completed, Failed), Category (Cardiovascular, Hepatic, etc.)
7. View toggle: table (RiskScoreAnalysisList) or card (grid of RiskScoreAnalysisCard)
8. Empty state with Activity icon

The component imports and uses `RiskScoreAnalysisList` and `RiskScoreAnalysisCard` (Tasks 6 & 7).

Create the file at `frontend/src/features/risk-scores/pages/RiskScoreHubPage.tsx`. Structure it identically to `StudiesPage.tsx` (lines 1-555) but with these substitutions:

| StudiesPage | RiskScoreHubPage |
|---|---|
| `useStudies(page, search, filters)` | `useRiskScoreAnalyses(page, search, filters)` |
| `useStudyStats()` | `useRiskScoreAnalysisStats()` |
| `useAllStudies()` | `useRiskScoreAnalyses(1, '', {})` (for dropdown) |
| Title: "Studies" | Title: "Risk Score Analyses" |
| Subtitle | "Stratify patient populations by validated clinical risk scores" |
| Status options | `draft, running, completed, failed` |
| Type filter | Category filter: `Cardiovascular, Comorbidity Burden, Hepatic, Pulmonary, Metabolic, Musculoskeletal` |
| Priority filter | Remove (not applicable) |
| Stats: Total, Active, Pre-Study, In Progress, Post-Study | Total, Running, Completed, Scores Available, Patients Scored |
| `navigate("/studies/create")` | `navigate("/risk-scores/create")` |
| `navigate(\`/studies/${slug}\`)` | `navigate(\`/risk-scores/${id}\`)` |
| `StudyList` | `RiskScoreAnalysisList` |
| `StudyCard` | `RiskScoreAnalysisCard` |

Icons: `Briefcase` → `Activity`, `FlaskConical` → `Loader2` (running), `Shield` → `CheckCircle2` (completed), `Activity` → `BarChart3` (scores), `Loader2` → `Users` (patients).

- [ ] **Step 2: Verify TypeScript**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit" 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/risk-scores/pages/RiskScoreHubPage.tsx
git commit -m "feat(risk-scores): add Studies-mirror hub page with stats, drilldown, search, filters"
```

---

## Task 6: Frontend — Analysis List Table Component

**Files:**
- Create: `frontend/src/features/risk-scores/components/RiskScoreAnalysisList.tsx`

- [ ] **Step 1: Create table component**

Mirror `StudyList.tsx` structure. Props interface:

```typescript
import type { RiskScoreAnalysis } from "../types/riskScore";

interface RiskScoreAnalysisListProps {
  analyses: RiskScoreAnalysis[];
  onSelect: (id: number) => void;
  isLoading?: boolean;
  error?: Error | null;
  page?: number;
  totalPages?: number;
  total?: number;
  perPage?: number;
  onPageChange?: (page: number) => void;
  searchActive?: boolean;
}
```

Sortable columns: Name, Cohort (from design_json.targetCohortIds), Scores (count of design_json.scoreIds), Status (from latest execution or "draft"), Last Run, Author.

Sort keys: `"name" | "status" | "created_at"`. Status derived from `analysis.executions?.[0]?.status ?? "draft"`.

Utility functions:
- `formatDate(iso: string)` — same as StudyList
- `getLatestStatus(analysis)` — returns status string from latest execution or "draft"

Color map: `STATUS_COLORS` imported from types.

Follow the exact same table markup pattern as StudyList: sortable headers with chevron icons, striped rows, hover states, pagination footer.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/risk-scores/components/RiskScoreAnalysisList.tsx
git commit -m "feat(risk-scores): add sortable analysis list table component"
```

---

## Task 7: Frontend — Analysis Card Component

**Files:**
- Create: `frontend/src/features/risk-scores/components/RiskScoreAnalysisCard.tsx`

- [ ] **Step 1: Create card component**

Mirror `StudyCard.tsx` structure. Props:

```typescript
import type { RiskScoreAnalysis } from "../types/riskScore";

interface RiskScoreAnalysisCardProps {
  analysis: RiskScoreAnalysis;
  onClick: () => void;
}
```

Card contents:
- Name (line-clamped to 2 lines)
- Description (line-clamped to 2 lines, muted)
- Score count badge (e.g., "5 scores") with category color dots
- Cohort badge (from design_json.targetCohortIds — show count)
- Status badge (colored, derived from latest execution)
- Footer: author name + formatted created_at date

Follow StudyCard's exact button/card wrapper pattern with hover states.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/risk-scores/components/RiskScoreAnalysisCard.tsx
git commit -m "feat(risk-scores): add analysis card component for grid view"
```

---

## Task 8: Frontend — Score Recommendation Card

**Files:**
- Create: `frontend/src/features/risk-scores/components/ScoreRecommendationCard.tsx`

- [ ] **Step 1: Create recommendation card**

```typescript
import type { ScoreRecommendation } from "../types/riskScore";
import { TIER_COLORS, CATEGORY_ORDER } from "../types/riskScore";

interface ScoreRecommendationCardProps {
  recommendation: ScoreRecommendation;
  selected: boolean;
  onToggle: (scoreId: string) => void;
  readOnly?: boolean;
}
```

Three visual tiers based on `recommendation.applicable` and relevance:
- **Recommended** (`applicable === true`): border `#2DD4BF40`, bg `#2DD4BF05`
- **Available** (`applicable === true` but low completeness): border `#F59E0B40`, bg `#F59E0B05`
- **Not Applicable** (`applicable === false`): border `#323238`, bg `#151518`, opacity 0.6, no checkbox

Card contents:
- Checkbox (if not readOnly and applicable)
- Score name + category badge (small, uppercase)
- Reason text (from `recommendation.reason`)
- Expected completeness bar (horizontal, filled to percentage)
- Checkmark overlay when `readOnly && selected`

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/risk-scores/components/ScoreRecommendationCard.tsx
git commit -m "feat(risk-scores): add 3-tier score recommendation card for wizard and detail"
```

---

## Task 9: Frontend — Cohort Profile Panel

**Files:**
- Create: `frontend/src/features/risk-scores/components/CohortProfilePanel.tsx`

- [ ] **Step 1: Create cohort profile panel**

```typescript
interface CohortProfilePanelProps {
  profile: {
    patient_count: number;
    min_age: number;
    max_age: number;
    female_pct: number;
    top_conditions: Array<{ concept_id: number; name: string; prevalence: number }>;
    measurement_coverage: Record<string, number>;
  };
  compact?: boolean;
}
```

Full version (wizard): patient count, age range bar, gender split bar, top 5 conditions with prevalence bars, measurement coverage indicators.

Compact version (detail sidebar): patient count, age range text, gender split text, top 3 conditions with percentages.

Use Parthenon dark theme colors. Prevalence bars: horizontal div with teal fill.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/risk-scores/components/CohortProfilePanel.tsx
git commit -m "feat(risk-scores): add cohort profile panel for demographics and conditions"
```

---

## Task 10: Frontend — Create Cohort Modal

**Files:**
- Create: `frontend/src/features/risk-scores/components/CreateCohortModal.tsx`

- [ ] **Step 1: Create modal**

```typescript
import { useCreateCohortFromTier } from "../hooks/useRiskScores";
import type { CreateCohortPayload } from "../types/riskScore";

interface CreateCohortModalProps {
  analysisId: number;
  executionId: number;
  scoreId: string;
  scoreName: string;
  cohortName: string;
  riskTier?: string;
  patientCount: number;
  personIds?: number[];
  onClose: () => void;
  onCreated: (cohortId: number, name: string) => void;
}
```

Modal contents:
- Name input: auto-generated `"{scoreName} — {riskTier} Risk — {cohortName}"`, editable
- Description textarea: auto-generated, editable
- Patient count: read-only display
- Derivation info: collapsible section showing analysisId, executionId, scoreId, tier
- "Create Cohort" button (teal) + "Cancel" button

Uses `useCreateCohortFromTier` mutation. On success: calls `onCreated` callback, shows toast via window alert (or integrate with existing toast system if available).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/risk-scores/components/CreateCohortModal.tsx
git commit -m "feat(risk-scores): add modal for inline cohort creation from risk tier"
```

---

## Task 11: Frontend — Creation Wizard Page

**Files:**
- Create: `frontend/src/features/risk-scores/pages/RiskScoreCreatePage.tsx`

- [ ] **Step 1: Create wizard page**

2-step wizard mirroring `StudyCreatePage.tsx` pattern.

```typescript
const STEPS = [
  { key: "configure", label: "Configure", icon: Settings },
  { key: "review", label: "Review & Run", icon: ClipboardCheck },
] as const;
```

State:
```typescript
const [step, setStep] = useState(0);
// Basics
const [name, setName] = useState("");
const [description, setDescription] = useState("");
const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null);
// Score selection
const [selectedScoreIds, setSelectedScoreIds] = useState<string[]>([]);
// Execution
const [showRunModal, setShowRunModal] = useState(false);
const [createdAnalysisId, setCreatedAnalysisId] = useState<number | null>(null);
```

Step 1 (Configure):
- Name input
- Description textarea
- Cohort dropdown (uses existing cohort definitions list — `apiClient.get('/cohort-definitions')` or use an existing hook)
- On cohort selection: fires `useRecommendScores(sourceId, cohortId)` → shows loading skeleton → shows CohortProfilePanel + ScoreRecommendationCard grid
- "Select All Recommended" / "Select All Available" shortcut buttons
- Individual checkboxes via ScoreRecommendationCard

Step 2 (Review & Run):
- Summary panels: name, description, cohort, selected scores with category badges
- "Create as Draft" button → createAnalysis → navigate to hub
- "Create & Run" button → createAnalysis → executeAnalysis → show RiskScoreRunModal

Validation: `canNext = step === 0 ? (name.trim() && selectedCohortId && selectedScoreIds.length > 0) : true`

Auto-generate name on cohort selection if name is empty.

- [ ] **Step 2: Verify TypeScript**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit" 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/risk-scores/pages/RiskScoreCreatePage.tsx
git commit -m "feat(risk-scores): add 2-step creation wizard with cohort selector and recommendations"
```

---

## Task 12: Frontend — Detail Page Shell + Tabs

**Files:**
- Create (rewrite): `frontend/src/features/risk-scores/pages/RiskScoreDetailPage.tsx`

- [ ] **Step 1: Rewrite detail page**

Mirror `StudyDetailPage.tsx` structure. Replace the existing file entirely.

```typescript
type TabKey = "overview" | "results" | "patients" | "recommendations" | "configuration";

const TABS: { key: TabKey; label: string; icon: typeof Settings }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "results", label: "Results", icon: BarChart3 },
  { key: "patients", label: "Patients", icon: Users },
  { key: "recommendations", label: "Recommendations", icon: Sparkles },
  { key: "configuration", label: "Configuration", icon: Settings },
];
```

Header: back button, editable title (inline edit pattern from StudyDetailPage), status badge, cohort badge, action buttons (Re-run, Duplicate, Delete).

Hooks:
```typescript
const { id } = useParams<{ id: string }>();
const { data: analysis, isLoading } = useRiskScoreAnalysis(id ? Number(id) : null);
const updateMutation = useUpdateRiskScoreAnalysis();
const deleteMutation = useDeleteRiskScoreAnalysis();
const executeMutation = useExecuteRiskScoreAnalysis();
```

Tab content renders the tab components (OverviewTab, ResultsTab, PatientsTab, RecommendationsTab, ConfigurationTab) from Tasks 13-17.

Tab badges: Results shows score count, Patients shows patient count.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/risk-scores/pages/RiskScoreDetailPage.tsx
git commit -m "feat(risk-scores): rewrite detail page with 5-tab Studies-mirror layout"
```

---

## Task 13: Frontend — Overview Tab

**Files:**
- Create: `frontend/src/features/risk-scores/components/OverviewTab.tsx`

- [ ] **Step 1: Create overview tab**

```typescript
import type { RiskScoreAnalysis, ExecutionDetailResponse } from "../types/riskScore";

interface OverviewTabProps {
  analysis: RiskScoreAnalysis;
  latestExecution: ExecutionDetailResponse | null;
  onRunClick: () => void;
  onTabChange: (tab: string) => void;
}
```

2-column layout (2/3 + 1/3):

Left column:
- About section: description, author, created/updated dates
- Smart Results Summary:
  - If `latestExecution` exists and completed: 4 stat cards (Scores Computed, Patients Scored, Avg Completeness, Avg Confidence) + per-score mini cards (score name + mini stacked bar from `population_summaries`). Each mini card clickable → `onTabChange("results")`.
  - If no execution: "This analysis hasn't been executed yet." + "Run Analysis" CTA button calling `onRunClick`.
  - If running: "Execution in progress..." with spinner.
- Execution timeline: list past executions from `analysis.executions`

Right column:
- Cohort Profile (compact version of CohortProfilePanel — just show cohort IDs for now, full profile requires a separate API call)
- Selected Scores: list from `analysis.design_json.scoreIds` with category badges
- Author: name, email

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/risk-scores/components/OverviewTab.tsx
git commit -m "feat(risk-scores): add smart overview tab with results summary and run CTA"
```

---

## Task 14: Frontend — Results Tab

**Files:**
- Create: `frontend/src/features/risk-scores/components/ResultsTab.tsx`

- [ ] **Step 1: Create results tab**

```typescript
import type { PopulationSummary } from "../types/riskScore";
import { TierBreakdownChart } from "./TierBreakdownChart";

interface ResultsTabProps {
  analysisId: number;
  executionId: number | null;
  summaries: PopulationSummary[];
  scoreNames: Record<string, string>;
  onCreateCohort: (scoreId: string, tier: string, patientCount: number) => void;
}
```

Score filter: horizontal pill buttons for each score (default "All"). Active pill highlighted in teal.

Per-score cards (grouped from summaries by score_id):
- Score name + category badge
- Reuse `TierBreakdownChart` component for the stacked bar
- Tier table: Tier | Count | % | Mean Score | Confidence | "Create Cohort" button (teal icon)
- Completeness summary from mean_completeness

Cards are collapsible (default expanded).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/risk-scores/components/ResultsTab.tsx
git commit -m "feat(risk-scores): add results tab with per-score tier breakdowns and cohort creation"
```

---

## Task 15: Frontend — Patients Tab

**Files:**
- Create: `frontend/src/features/risk-scores/components/PatientsTab.tsx`

- [ ] **Step 1: Create patients tab**

```typescript
interface PatientsTabProps {
  analysisId: number;
  executionId: number | null;
  scoreIds: string[];
  onCreateCohort: (scoreId: string, tier: string | undefined, personIds: number[]) => void;
}
```

Uses `useExecutionPatients` hook with pagination + filters.

Filter toolbar:
- Score dropdown (from scoreIds prop)
- Tier multi-select chips (low, intermediate, high, very_high)
- Completeness threshold (not implemented in v1 — skip for now)

Table columns: Person ID (monospace, clickable → `/profiles?person={id}`), Score ID, Score Value, Risk Tier (colored badge), Confidence (%), Completeness (%), Missing Components.

Bulk action toolbar (appears when filters active):
- "Create Cohort from Filter" button
- Patient count display

Pagination: server-side, 50 per page.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/risk-scores/components/PatientsTab.tsx
git commit -m "feat(risk-scores): add patient-level results tab with filters and bulk cohort creation"
```

---

## Task 16: Frontend — Recommendations Tab

**Files:**
- Create: `frontend/src/features/risk-scores/components/RecommendationsTab.tsx`

- [ ] **Step 1: Create recommendations tab**

```typescript
import type { RiskScoreAnalysis } from "../types/riskScore";

interface RecommendationsTabProps {
  analysis: RiskScoreAnalysis;
  sourceId: number;
}
```

Uses `useRecommendScores(sourceId, analysis.design_json.targetCohortIds[0])` to re-fetch recommendations.

Shows:
- CohortProfilePanel (full version) with the cohort profile data
- ScoreRecommendationCard grid in 3 tiers (Recommended / Available / Not Applicable)
- Cards are read-only (`readOnly={true}`)
- Cards that match `analysis.design_json.scoreIds` show checkmark overlay (`selected={true}`)

If recommendation API fails or source not set: show "Select a source to view recommendations" banner.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/risk-scores/components/RecommendationsTab.tsx
git commit -m "feat(risk-scores): add read-only recommendations tab for audit trail"
```

---

## Task 17: Frontend — Configuration Tab

**Files:**
- Create: `frontend/src/features/risk-scores/components/ConfigurationTab.tsx`

- [ ] **Step 1: Create configuration tab**

```typescript
import type { RiskScoreAnalysis } from "../types/riskScore";

interface ConfigurationTabProps {
  analysis: RiskScoreAnalysis;
  onReRun: () => void;
}
```

Two sections:

**Design** panel:
- Target Cohort IDs: listed with badges
- Selected Score IDs: listed with category badges and score names (from catalogue)
- Parameters: minCompleteness, storePatientLevel flags

**Execution History** table:
- Columns: # (execution count), Status (badge), Started, Duration, Scores, Patients, Actions ("View Results" link)
- Data from `analysis.executions` (loaded via show endpoint)

**Re-run** button at bottom: calls `onReRun` prop.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/risk-scores/components/ConfigurationTab.tsx
git commit -m "feat(risk-scores): add configuration tab with design view and execution history"
```

---

## Task 18: Frontend — Router + Cleanup

**Files:**
- Modify: `frontend/src/app/router.tsx`
- Remove: `frontend/src/features/risk-scores/pages/RiskScoreCataloguePage.tsx`
- Remove: `frontend/src/features/risk-scores/components/RiskScoreCard.tsx`

- [ ] **Step 1: Update router**

Find the risk-scores route block (around line 404-423) and replace with:

```typescript
      // ── Risk Scores ─────────────────────────────────────────────
      {
        path: "risk-scores",
        children: [
          {
            index: true,
            lazy: () =>
              import(
                "@/features/risk-scores/pages/RiskScoreHubPage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: "create",
            lazy: () =>
              import(
                "@/features/risk-scores/pages/RiskScoreCreatePage"
              ).then((m) => ({ Component: m.default })),
          },
          {
            path: ":id",
            lazy: () =>
              import(
                "@/features/risk-scores/pages/RiskScoreDetailPage"
              ).then((m) => ({ Component: m.default })),
          },
        ],
      },
```

- [ ] **Step 2: Delete old files**

```bash
rm frontend/src/features/risk-scores/pages/RiskScoreCataloguePage.tsx
rm frontend/src/features/risk-scores/components/RiskScoreCard.tsx
```

- [ ] **Step 3: Verify no broken imports**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit" 2>&1 | head -50`

If there are imports of `RiskScoreCataloguePage` or `RiskScoreCard` elsewhere, update them.

- [ ] **Step 4: Verify build**

Run: `docker compose exec node sh -c "cd /app && npx vite build" 2>&1 | tail -20`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/router.tsx
git add -u frontend/src/features/risk-scores/  # stages deletions
git commit -m "feat(risk-scores): update routes for v2 hub/create/detail, remove v1 catalogue"
```

---

## Task 19: Run Pint + Full CI Preflight

- [ ] **Step 1: Run Pint on all modified PHP files**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 2: Run TypeScript check**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 3: Run Vite build**

```bash
docker compose exec node sh -c "cd /app && npx vite build"
```

- [ ] **Step 4: Fix any errors and re-run checks**

Address TypeScript errors first (strict mode catches), then Vite build errors (stricter). Common issues:
- Missing type imports → add to import statements
- `as never` casts needed for Recharts Tooltip formatter
- Unused variables → remove them

- [ ] **Step 5: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix(risk-scores): resolve TypeScript and build errors from v2 frontend"
```
