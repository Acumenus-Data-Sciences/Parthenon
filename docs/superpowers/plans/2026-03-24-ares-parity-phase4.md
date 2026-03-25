# Ares Parity — Phase 4: Cost + Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Ares feature set with cost table visualization, retrofit annotation markers into existing Data Explorer tabs, add loading skeletons and responsive layout to the hub, run final integration tests, regenerate OpenAPI spec, and deploy.

**Architecture:** New `CostService` querying the OMOP `cost` table (with empty-state handling for non-claims datasets). Cost endpoints on `AresController` (source-scoped) and `NetworkAresController` (network-scoped). `CostView` frontend component with domain aggregates and time series. `AnnotationMarker` retrofitted into existing Overview, Domain, and Temporal tabs. Hub cards get loading skeletons and responsive stacking on mobile.

**Tech Stack:** Laravel 11 / PHP 8.4 / PostgreSQL 17 / React 19 / TypeScript / TanStack Query / Recharts / Tailwind 4

**Spec:** `docs/superpowers/specs/2026-03-24-ares-parity-design.md`

**Depends on:** Phase 2 plan at `docs/superpowers/plans/2026-03-24-ares-parity-phase2.md` and Phase 3 plan at `docs/superpowers/plans/2026-03-24-ares-parity-phase3.md`

---

## File Map

### Backend — New Files

```
backend/
├── app/
│   └── Services/Ares/
│       └── CostService.php                     # New service
├── tests/
│   ├── Unit/Services/Ares/
│   │   └── CostServiceTest.php                 # New test
│   └── Feature/Api/
│       └── AresCostControllerTest.php          # New test
```

### Backend — Modified Files

```
backend/
├── app/Http/Controllers/Api/V1/
│   ├── AresController.php                      # Add cost endpoints (source-scoped)
│   └── NetworkAresController.php               # Add cost endpoint (network-scoped)
├── routes/api.php                              # Add cost routes
```

### Frontend — New Files

```
frontend/src/features/data-explorer/
├── components/ares/
│   ├── cost/
│   │   └── CostView.tsx                        # Domain aggregates + time series
│   └── HubCardSkeleton.tsx                     # Loading skeleton for hub cards
├── hooks/
│   └── useCostData.ts                          # Cost query hooks
├── api/
│   └── costApi.ts                              # Cost API functions
```

### Frontend — Modified Files

```
frontend/src/features/data-explorer/
├── components/ares/
│   ├── AresHub.tsx                             # Add loading skeletons + responsive tweaks
│   └── HubCard.tsx                             # Add animation/transition polish
├── pages/
│   ├── AresTab.tsx                             # Add CostView routing
│   └── DataExplorerPage.tsx                    # Retrofit AnnotationMarker into existing tabs
└── types/
    └── ares.ts                                 # Add cost types
```

---

## Task 1: CostService

**Files:**
- Create: `backend/app/Services/Ares/CostService.php`
- Create: `backend/tests/Unit/Services/Ares/CostServiceTest.php`

- [ ] **Step 1: Write failing tests**

```php
<?php

namespace Tests\Unit\Services\Ares;

use App\Models\App\Source;
use App\Services\Ares\CostService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CostServiceTest extends TestCase
{
    use RefreshDatabase;

    private CostService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(CostService::class);
    }

    public function test_has_cost_data_returns_boolean(): void
    {
        $source = Source::factory()->create();

        $result = $this->service->hasCostData($source);

        $this->assertIsBool($result);
    }

    public function test_get_summary_returns_expected_structure(): void
    {
        $source = Source::factory()->create();

        $summary = $this->service->getSummary($source);

        $this->assertArrayHasKey('has_cost_data', $summary);
        $this->assertArrayHasKey('domains', $summary);
        $this->assertIsBool($summary['has_cost_data']);
        $this->assertIsArray($summary['domains']);
    }

    public function test_get_trends_returns_monthly_data(): void
    {
        $source = Source::factory()->create();

        $trends = $this->service->getTrends($source);

        $this->assertArrayHasKey('has_cost_data', $trends);
        $this->assertArrayHasKey('months', $trends);
        $this->assertIsArray($trends['months']);
    }

    public function test_get_domain_detail_returns_top_concepts(): void
    {
        $source = Source::factory()->create();

        $detail = $this->service->getDomainDetail($source, 'drug_exposure');

        $this->assertArrayHasKey('has_cost_data', $detail);
        $this->assertArrayHasKey('concepts', $detail);
    }

    public function test_get_network_cost_aggregates_across_sources(): void
    {
        Source::factory()->count(2)->create();

        $result = $this->service->getNetworkCost();

        $this->assertArrayHasKey('sources', $result);
        $this->assertIsArray($result['sources']);
    }

    public function test_get_summary_handles_missing_cost_table_gracefully(): void
    {
        $source = Source::factory()->create();

        // Should not throw even if cost table doesn't exist or is empty
        $summary = $this->service->getSummary($source);

        $this->assertFalse($summary['has_cost_data']);
        $this->assertEmpty($summary['domains']);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/CostServiceTest.php`
Expected: FAIL — CostService class not found

- [ ] **Step 3: Implement CostService**

```php
<?php

namespace App\Services\Ares;

use App\Enums\DaimonType;
use App\Models\App\Source;
use App\Services\Database\DynamicConnectionFactory;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CostService
{
    /**
     * Domain tables that can have associated cost records.
     */
    private const COST_DOMAINS = [
        'drug_exposure',
        'procedure_occurrence',
        'visit_occurrence',
        'device_exposure',
        'condition_occurrence',
        'measurement',
        'observation',
    ];

    public function __construct(
        private readonly DynamicConnectionFactory $connectionFactory,
    ) {}

    /**
     * Check if a source has any cost data.
     */
    public function hasCostData(Source $source): bool
    {
        try {
            $connection = $this->getOmopConnection($source);

            $count = DB::connection($connection)
                ->table('cost')
                ->limit(1)
                ->count();

            return $count > 0;
        } catch (\Throwable $e) {
            Log::debug("CostService: cost table check failed for source {$source->source_name}: {$e->getMessage()}");
            return false;
        }
    }

    /**
     * Get cost aggregates by domain for a source.
     *
     * @return array{has_cost_data: bool, domains: array<int, array{domain: string, total_cost: float, record_count: int, avg_cost: float}>}
     */
    public function getSummary(Source $source): array
    {
        if (! $this->hasCostData($source)) {
            return ['has_cost_data' => false, 'domains' => []];
        }

        try {
            $connection = $this->getOmopConnection($source);

            $results = DB::connection($connection)
                ->table('cost')
                ->selectRaw("
                    cost_domain_id as domain,
                    SUM(total_charge) as total_cost,
                    COUNT(*) as record_count,
                    AVG(total_charge) as avg_cost
                ")
                ->whereNotNull('cost_domain_id')
                ->groupBy('cost_domain_id')
                ->orderByDesc(DB::raw('SUM(total_charge)'))
                ->get();

            $domains = $results->map(fn ($row) => [
                'domain' => $row->domain,
                'total_cost' => round((float) $row->total_cost, 2),
                'record_count' => (int) $row->record_count,
                'avg_cost' => round((float) $row->avg_cost, 2),
            ])->toArray();

            return ['has_cost_data' => true, 'domains' => $domains];
        } catch (\Throwable $e) {
            Log::warning("CostService: getSummary failed for source {$source->source_name}: {$e->getMessage()}");
            return ['has_cost_data' => false, 'domains' => []];
        }
    }

    /**
     * Get monthly cost totals for a source.
     *
     * @return array{has_cost_data: bool, months: array<int, array{month: string, total_cost: float, record_count: int}>}
     */
    public function getTrends(Source $source): array
    {
        if (! $this->hasCostData($source)) {
            return ['has_cost_data' => false, 'months' => []];
        }

        try {
            $connection = $this->getOmopConnection($source);

            $results = DB::connection($connection)
                ->table('cost')
                ->selectRaw("
                    TO_CHAR(cost_event_date, 'YYYY-MM') as month,
                    SUM(total_charge) as total_cost,
                    COUNT(*) as record_count
                ")
                ->whereNotNull('cost_event_date')
                ->groupByRaw("TO_CHAR(cost_event_date, 'YYYY-MM')")
                ->orderBy(DB::raw("TO_CHAR(cost_event_date, 'YYYY-MM')"))
                ->get();

            $months = $results->map(fn ($row) => [
                'month' => $row->month,
                'total_cost' => round((float) $row->total_cost, 2),
                'record_count' => (int) $row->record_count,
            ])->toArray();

            return ['has_cost_data' => true, 'months' => $months];
        } catch (\Throwable $e) {
            Log::warning("CostService: getTrends failed for source {$source->source_name}: {$e->getMessage()}");
            return ['has_cost_data' => false, 'months' => []];
        }
    }

    /**
     * Get top cost concepts within a domain for a source.
     *
     * @return array{has_cost_data: bool, concepts: array<int, array{concept_id: int, concept_name: string, total_cost: float, record_count: int}>}
     */
    public function getDomainDetail(Source $source, string $domain): array
    {
        if (! $this->hasCostData($source)) {
            return ['has_cost_data' => false, 'concepts' => []];
        }

        try {
            $connection = $this->getOmopConnection($source);

            $results = DB::connection($connection)
                ->table('cost as c')
                ->join('concept as co', 'c.cost_concept_id', '=', 'co.concept_id')
                ->selectRaw("
                    c.cost_concept_id as concept_id,
                    co.concept_name,
                    SUM(c.total_charge) as total_cost,
                    COUNT(*) as record_count
                ")
                ->where('c.cost_domain_id', $domain)
                ->groupBy('c.cost_concept_id', 'co.concept_name')
                ->orderByDesc(DB::raw('SUM(c.total_charge)'))
                ->limit(50)
                ->get();

            $concepts = $results->map(fn ($row) => [
                'concept_id' => (int) $row->concept_id,
                'concept_name' => $row->concept_name,
                'total_cost' => round((float) $row->total_cost, 2),
                'record_count' => (int) $row->record_count,
            ])->toArray();

            return ['has_cost_data' => true, 'concepts' => $concepts];
        } catch (\Throwable $e) {
            Log::warning("CostService: getDomainDetail failed for source {$source->source_name}: {$e->getMessage()}");
            return ['has_cost_data' => false, 'concepts' => []];
        }
    }

    /**
     * Get aggregated cost data across all sources.
     *
     * @return array{sources: array<int, array{source_id: int, source_name: string, has_cost_data: bool, total_cost: float, record_count: int}>}
     */
    public function getNetworkCost(): array
    {
        return Cache::remember('ares:network:cost', 600, function () {
            $sources = Source::whereHas('daimons')->get();
            $results = [];

            foreach ($sources as $source) {
                $summary = $this->getSummary($source);
                $totalCost = array_sum(array_column($summary['domains'], 'total_cost'));
                $totalRecords = array_sum(array_column($summary['domains'], 'record_count'));

                $results[] = [
                    'source_id' => $source->id,
                    'source_name' => $source->source_name,
                    'has_cost_data' => $summary['has_cost_data'],
                    'total_cost' => round($totalCost, 2),
                    'record_count' => $totalRecords,
                ];
            }

            return ['sources' => $results];
        });
    }

    /**
     * Get the OMOP connection name for a source, setting search_path as needed.
     */
    private function getOmopConnection(Source $source): string
    {
        if (! empty($source->db_host)) {
            $daimon = $source->daimons()->where('daimon_type', DaimonType::Cdm->value)->first();
            $schema = $daimon?->table_qualifier ?? 'omop';
            return $this->connectionFactory->connectionForSchema($source, $schema);
        }

        return 'omop';
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/CostServiceTest.php`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Ares/CostService.php backend/tests/Unit/Services/Ares/CostServiceTest.php
git commit -m "feat(ares): implement CostService with domain aggregation, trends, and empty-state handling"
```

---

## Task 2: Cost API Endpoints

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/AresController.php`
- Modify: `backend/app/Http/Controllers/Api/V1/NetworkAresController.php`
- Modify: `backend/routes/api.php`
- Create: `backend/tests/Feature/Api/AresCostControllerTest.php`

- [ ] **Step 1: Write failing integration tests**

```php
<?php

namespace Tests\Feature\Api;

use App\Models\App\Source;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AresCostControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Source $source;
    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->user->assignRole('researcher');
        $this->source = Source::factory()->create();
        $this->token = $this->user->createToken('test')->plainTextToken;
    }

    public function test_cost_summary_requires_auth(): void
    {
        $this->getJson("/api/v1/sources/{$this->source->id}/ares/cost/summary")
            ->assertStatus(401);
    }

    public function test_cost_summary_returns_data(): void
    {
        $this->withToken($this->token)
            ->getJson("/api/v1/sources/{$this->source->id}/ares/cost/summary")
            ->assertOk()
            ->assertJsonStructure(['data' => ['has_cost_data', 'domains']]);
    }

    public function test_cost_trends_returns_monthly_data(): void
    {
        $this->withToken($this->token)
            ->getJson("/api/v1/sources/{$this->source->id}/ares/cost/trends")
            ->assertOk()
            ->assertJsonStructure(['data' => ['has_cost_data', 'months']]);
    }

    public function test_cost_domain_detail_returns_concepts(): void
    {
        $this->withToken($this->token)
            ->getJson("/api/v1/sources/{$this->source->id}/ares/cost/domains/drug_exposure")
            ->assertOk()
            ->assertJsonStructure(['data' => ['has_cost_data', 'concepts']]);
    }

    public function test_network_cost_returns_aggregated_data(): void
    {
        $this->withToken($this->token)
            ->getJson('/api/v1/network/ares/cost')
            ->assertOk()
            ->assertJsonStructure(['data' => ['sources']]);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/AresCostControllerTest.php`
Expected: FAIL — routes not defined

- [ ] **Step 3: Add cost methods to AresController**

Add the following to `backend/app/Http/Controllers/Api/V1/AresController.php`:

```php
use App\Services\Ares\CostService;

// Update constructor to include CostService:
public function __construct(
    private readonly ReleaseService $releaseService,
    private readonly AnnotationService $annotationService,
    private readonly DqHistoryService $dqHistoryService,
    private readonly UnmappedCodeService $unmappedCodeService,
    private readonly CostService $costService,
) {}

// --- Cost ---

public function costSummary(Source $source): JsonResponse
{
    return response()->json([
        'data' => $this->costService->getSummary($source),
    ]);
}

public function costTrends(Source $source): JsonResponse
{
    return response()->json([
        'data' => $this->costService->getTrends($source),
    ]);
}

public function costDomainDetail(Source $source, string $domain): JsonResponse
{
    return response()->json([
        'data' => $this->costService->getDomainDetail($source, $domain),
    ]);
}
```

- [ ] **Step 4: Add cost method to NetworkAresController**

Add to `backend/app/Http/Controllers/Api/V1/NetworkAresController.php`:

```php
use App\Services\Ares\CostService;

// Update constructor to include CostService:
public function __construct(
    private readonly NetworkComparisonService $comparisonService,
    private readonly CoverageService $coverageService,
    private readonly DiversityService $diversityService,
    private readonly FeasibilityService $feasibilityService,
    private readonly DqHistoryService $dqHistoryService,
    private readonly AnnotationService $annotationService,
    private readonly UnmappedCodeService $unmappedCodeService,
    private readonly CostService $costService,
) {}

// --- Network Cost ---

public function networkCost(): JsonResponse
{
    return response()->json([
        'data' => $this->costService->getNetworkCost(),
    ]);
}
```

- [ ] **Step 5: Add cost routes to api.php**

Add inside the existing `sources/{source}/ares` route group:

```php
// Cost
Route::get('/cost/summary', [AresController::class, 'costSummary'])->middleware('permission:analyses.view');
Route::get('/cost/trends', [AresController::class, 'costTrends'])->middleware('permission:analyses.view');
Route::get('/cost/domains/{domain}', [AresController::class, 'costDomainDetail'])->middleware('permission:analyses.view');
```

Add inside the existing `network/ares` route group:

```php
// Network Cost
Route::get('/cost', [NetworkAresController::class, 'networkCost'])->middleware('permission:analyses.view');
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/AresCostControllerTest.php`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/AresController.php backend/app/Http/Controllers/Api/V1/NetworkAresController.php backend/routes/api.php backend/tests/Feature/Api/AresCostControllerTest.php
git commit -m "feat(ares): add cost API endpoints for source-scoped and network-scoped queries"
```

---

## Task 3: Frontend Cost Types + API + Hooks

**Files:**
- Modify: `frontend/src/features/data-explorer/types/ares.ts`
- Create: `frontend/src/features/data-explorer/api/costApi.ts`
- Create: `frontend/src/features/data-explorer/hooks/useCostData.ts`

- [ ] **Step 1: Add cost types**

Add the following to the end of `frontend/src/features/data-explorer/types/ares.ts`:

```typescript
// Cost types
export interface CostDomain {
  domain: string;
  total_cost: number;
  record_count: number;
  avg_cost: number;
}

export interface CostSummary {
  has_cost_data: boolean;
  domains: CostDomain[];
}

export interface CostMonth {
  month: string;
  total_cost: number;
  record_count: number;
}

export interface CostTrends {
  has_cost_data: boolean;
  months: CostMonth[];
}

export interface CostConcept {
  concept_id: number;
  concept_name: string;
  total_cost: number;
  record_count: number;
}

export interface CostDomainDetail {
  has_cost_data: boolean;
  concepts: CostConcept[];
}

export interface NetworkCostSource {
  source_id: number;
  source_name: string;
  has_cost_data: boolean;
  total_cost: number;
  record_count: number;
}

export interface NetworkCost {
  sources: NetworkCostSource[];
}
```

- [ ] **Step 2: Create costApi.ts**

```typescript
// frontend/src/features/data-explorer/api/costApi.ts
import apiClient from "@/lib/apiClient";
import type {
  CostSummary,
  CostTrends,
  CostDomainDetail,
  NetworkCost,
} from "../types/ares";

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

export async function fetchCostSummary(sourceId: number): Promise<CostSummary> {
  return unwrap(await apiClient.get(`/sources/${sourceId}/ares/cost/summary`));
}

export async function fetchCostTrends(sourceId: number): Promise<CostTrends> {
  return unwrap(await apiClient.get(`/sources/${sourceId}/ares/cost/trends`));
}

export async function fetchCostDomainDetail(
  sourceId: number,
  domain: string,
): Promise<CostDomainDetail> {
  return unwrap(await apiClient.get(`/sources/${sourceId}/ares/cost/domains/${domain}`));
}

export async function fetchNetworkCost(): Promise<NetworkCost> {
  return unwrap(await apiClient.get("/network/ares/cost"));
}
```

- [ ] **Step 3: Create useCostData.ts**

```typescript
// frontend/src/features/data-explorer/hooks/useCostData.ts
import { useQuery } from "@tanstack/react-query";
import {
  fetchCostSummary,
  fetchCostTrends,
  fetchCostDomainDetail,
  fetchNetworkCost,
} from "../api/costApi";

export function useCostSummary(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "cost", "summary", sourceId],
    queryFn: () => fetchCostSummary(sourceId!),
    enabled: !!sourceId,
  });
}

export function useCostTrends(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "cost", "trends", sourceId],
    queryFn: () => fetchCostTrends(sourceId!),
    enabled: !!sourceId,
  });
}

export function useCostDomainDetail(sourceId: number | null, domain: string | null) {
  return useQuery({
    queryKey: ["ares", "cost", "domain", sourceId, domain],
    queryFn: () => fetchCostDomainDetail(sourceId!, domain!),
    enabled: !!sourceId && !!domain,
  });
}

export function useNetworkCost() {
  return useQuery({
    queryKey: ["ares", "network", "cost"],
    queryFn: fetchNetworkCost,
    staleTime: 10 * 60 * 1000,
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/data-explorer/types/ares.ts frontend/src/features/data-explorer/api/costApi.ts frontend/src/features/data-explorer/hooks/useCostData.ts
git commit -m "feat(ares): add cost TypeScript types, API functions, and TanStack Query hooks"
```

---

## Task 4: CostView Frontend Component

**Files:**
- Create: `frontend/src/features/data-explorer/components/ares/cost/CostView.tsx`
- Modify: `frontend/src/features/data-explorer/pages/AresTab.tsx`

- [ ] **Step 1: Implement CostView**

```typescript
// frontend/src/features/data-explorer/components/ares/cost/CostView.tsx
import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useCostSummary, useCostTrends } from "../../../hooks/useCostData";
import type { CostDomain } from "../../../types/ares";

interface CostViewProps {
  sourceId: number | null;
  sources: Array<{ id: number; source_name: string }>;
  onSourceChange: (id: number) => void;
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-[#252530] bg-[#151518] p-8 text-center">
      <div className="mb-3 text-4xl text-[#333]">$</div>
      <h3 className="mb-2 text-sm font-medium text-white">No Cost Data Available</h3>
      <p className="text-xs text-[#666]">
        Cost data requires claims-based datasets (e.g., MarketScan, Optum, PharMetrics).
        EHR-derived datasets like SynPUF, MIMIC-IV, and most academic medical center data
        typically do not populate the OMOP cost table.
      </p>
    </div>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export default function CostView({ sourceId, sources, onSourceChange }: CostViewProps) {
  const { data: summary, isLoading: summaryLoading } = useCostSummary(sourceId);
  const { data: trends, isLoading: trendsLoading } = useCostTrends(sourceId);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-medium text-white">Cost Analysis</h2>

      {/* Source selector */}
      <div className="mb-4 flex items-center gap-4">
        <label className="text-sm text-[#888]">Source:</label>
        <select
          value={sourceId ?? ""}
          onChange={(e) => {
            onSourceChange(Number(e.target.value));
            setSelectedDomain(null);
          }}
          className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-sm text-white"
        >
          <option value="">Select source...</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>{s.source_name}</option>
          ))}
        </select>
      </div>

      {!sourceId && (
        <p className="py-10 text-center text-[#555]">Select a source to view cost data.</p>
      )}

      {sourceId && (summaryLoading || trendsLoading) && (
        <p className="text-[#555]">Loading cost data...</p>
      )}

      {sourceId && summary && !summary.has_cost_data && <EmptyState />}

      {sourceId && summary && summary.has_cost_data && (
        <>
          {/* Cost by domain bar chart */}
          <div className="mb-6 rounded-lg border border-[#252530] bg-[#151518] p-4">
            <h3 className="mb-3 text-sm font-medium text-white">Cost by Domain</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.domains}
                  margin={{ top: 5, right: 20, bottom: 30, left: 20 }}
                  onClick={(e) => {
                    if (e?.activePayload?.[0]?.payload) {
                      setSelectedDomain(e.activePayload[0].payload.domain);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
                  <XAxis
                    dataKey="domain"
                    tick={{ fill: "#888", fontSize: 10 }}
                    axisLine={{ stroke: "#333" }}
                    angle={-30}
                    textAnchor="end"
                    tickFormatter={(v: string) => v.replace(/_/g, " ")}
                  />
                  <YAxis
                    tick={{ fill: "#888", fontSize: 11 }}
                    axisLine={{ stroke: "#333" }}
                    tickFormatter={(v) => formatCurrency(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a22",
                      border: "1px solid #333",
                      borderRadius: "8px",
                      color: "#ccc",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [formatCurrency(value), "Total Cost"]}
                    labelFormatter={(label: string) => label.replace(/_/g, " ")}
                  />
                  <Bar dataKey="total_cost" fill="#C9A227" radius={[4, 4, 0, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Domain summary table */}
            <div className="mt-3 overflow-hidden rounded border border-[#252530]">
              <table className="w-full text-xs">
                <thead className="bg-[#1a1a22]">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-[#888]">Domain</th>
                    <th className="px-3 py-1.5 text-right text-[#888]">Total Cost</th>
                    <th className="px-3 py-1.5 text-right text-[#888]">Records</th>
                    <th className="px-3 py-1.5 text-right text-[#888]">Avg Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.domains.map((d: CostDomain) => (
                    <tr key={d.domain} className="border-t border-[#1a1a22] hover:bg-[#1a1a22]">
                      <td className="px-3 py-1.5 text-[#ccc]">{d.domain.replace(/_/g, " ")}</td>
                      <td className="px-3 py-1.5 text-right text-[#ccc]">{formatCurrency(d.total_cost)}</td>
                      <td className="px-3 py-1.5 text-right text-[#888]">{d.record_count.toLocaleString()}</td>
                      <td className="px-3 py-1.5 text-right text-[#888]">{formatCurrency(d.avg_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Monthly cost trends line chart */}
          {trends && trends.has_cost_data && trends.months.length > 0 && (
            <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
              <h3 className="mb-3 text-sm font-medium text-white">Monthly Cost Trends</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends.months}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "#888", fontSize: 10 }}
                      axisLine={{ stroke: "#333" }}
                    />
                    <YAxis
                      tick={{ fill: "#888", fontSize: 11 }}
                      axisLine={{ stroke: "#333" }}
                      tickFormatter={(v) => formatCurrency(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1a22",
                        border: "1px solid #333",
                        borderRadius: "8px",
                        color: "#ccc",
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [formatCurrency(value), "Total Cost"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_cost"
                      stroke="#2DD4BF"
                      strokeWidth={2}
                      dot={{ fill: "#2DD4BF", r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire CostView into AresTab**

Update `frontend/src/features/data-explorer/pages/AresTab.tsx`:

Add import:
```typescript
import CostView from "../components/ares/cost/CostView";
```

Add to the drill-in render block:
```typescript
{activeSection === "cost" && (
  <CostView
    sourceId={selectedSourceId}
    sources={sources}
    onSourceChange={setSelectedSourceId}
  />
)}
```

- [ ] **Step 3: Verify the view renders**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/data-explorer/components/ares/cost/CostView.tsx frontend/src/features/data-explorer/pages/AresTab.tsx
git commit -m "feat(ares): add CostView drill-in with domain bar chart, monthly trends, and empty-state handling"
```

---

## Task 5: Retrofit AnnotationMarker into Existing Tabs

**Files:**
- Modify: Existing chart components in Overview, Domain, and Temporal tabs

- [ ] **Step 1: Identify chart components that need annotation markers**

Check the existing Data Explorer tab components to find Recharts charts that should support annotations. The `AnnotationMarker` component (built in Phase 1) accepts `sourceId`, `chartType`, and `xValues` props and renders overlay markers.

Key integration points (files to modify):
- Overview tab temporal charts (record counts over time)
- Domain tab concept charts
- Temporal tab time-series charts

- [ ] **Step 2: Add AnnotationMarker to temporal charts**

For each chart component that renders a Recharts chart with time-based x-axis, wrap the chart in a `relative` container and add the `AnnotationMarker` as a sibling:

```typescript
import AnnotationMarker from "../ares/annotations/AnnotationMarker";

// In the chart render:
<div className="relative">
  <ResponsiveContainer>
    {/* existing chart */}
  </ResponsiveContainer>
  <AnnotationMarker
    sourceId={sourceId}
    chartType="temporal_trend"  // or "domain_trend", "overview_timeline"
    xValues={chartData.map(d => d.xLabel)}
  />
</div>
```

This is a non-breaking addition — if no annotations exist for the chart, the component renders nothing.

- [ ] **Step 3: Verify annotations appear when created**

1. Open browser -> any chart in Overview/Domain/Temporal tab
2. Existing charts should render unchanged if no annotations exist
3. Create an annotation via Ares -> Annotations view
4. Navigate to the relevant chart -> annotation marker should appear

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/data-explorer/
git commit -m "feat(ares): retrofit AnnotationMarker into existing Overview, Domain, and Temporal tab charts"
```

---

## Task 6: Hub Card Loading Skeletons + Animations

**Files:**
- Create: `frontend/src/features/data-explorer/components/ares/HubCardSkeleton.tsx`
- Modify: `frontend/src/features/data-explorer/components/ares/HubCard.tsx`
- Modify: `frontend/src/features/data-explorer/components/ares/AresHub.tsx`

- [ ] **Step 1: Create HubCardSkeleton**

```typescript
// frontend/src/features/data-explorer/components/ares/HubCardSkeleton.tsx

export default function HubCardSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-[#252530] bg-[#151518] p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-[#252530]" />
        <div className="h-3 w-24 rounded bg-[#252530]" />
      </div>
      <div className="space-y-2">
        <div className="h-8 w-16 rounded bg-[#252530]" />
        <div className="h-3 w-32 rounded bg-[#252530]" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add hover animation to HubCard**

Update `frontend/src/features/data-explorer/components/ares/HubCard.tsx` to add smooth transitions:

```typescript
// frontend/src/features/data-explorer/components/ares/HubCard.tsx
import type { ReactNode } from "react";
import type { AresSection } from "../../types/ares";

interface HubCardProps {
  section: AresSection;
  title: string;
  accentColor: string;
  children: ReactNode;
  onClick: (section: AresSection) => void;
  isLoading?: boolean;
}

export default function HubCard({ section, title, accentColor, children, onClick, isLoading }: HubCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(section)}
      disabled={isLoading}
      className="w-full text-left rounded-lg border border-[#252530] bg-[#151518] p-4
                 transition-all duration-200 hover:border-current hover:shadow-lg hover:shadow-current/5
                 focus:outline-none focus:ring-1 focus:ring-current
                 active:scale-[0.98] disabled:opacity-60"
      style={{ color: accentColor }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="h-2 w-2 rounded-full transition-transform duration-200 group-hover:scale-125"
          style={{ backgroundColor: accentColor }}
        />
        <span className="text-[11px] uppercase tracking-wider">{title}</span>
      </div>
      <div className="text-[#ccc]">{children}</div>
    </button>
  );
}
```

- [ ] **Step 3: Add loading state to AresHub**

Update `frontend/src/features/data-explorer/components/ares/AresHub.tsx`:

Add import:
```typescript
import HubCardSkeleton from "./HubCardSkeleton";
```

When `isLoading` is true from the KPI hook, render skeleton cards for the first row:

```typescript
{isLoading && (
  <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
    <HubCardSkeleton />
    <HubCardSkeleton />
    <HubCardSkeleton />
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/data-explorer/components/ares/HubCardSkeleton.tsx frontend/src/features/data-explorer/components/ares/HubCard.tsx frontend/src/features/data-explorer/components/ares/AresHub.tsx
git commit -m "feat(ares): add hub card loading skeletons and hover animations"
```

---

## Task 7: Responsive Layout

**Files:**
- Modify: `frontend/src/features/data-explorer/components/ares/AresHub.tsx`
- Modify: `frontend/src/features/data-explorer/components/ares/AresBreadcrumb.tsx`
- Modify: `frontend/src/features/data-explorer/components/ares/AresHealthBanner.tsx`

- [ ] **Step 1: Make hub cards stack on mobile**

The hub already uses `grid-cols-1 md:grid-cols-3` which handles basic stacking. Verify and adjust the following:

In `AresHealthBanner.tsx`, make the stats wrap on small screens:

```typescript
// Change the stats container from flex to flex-wrap:
<div className="flex flex-wrap gap-4 sm:gap-6">
```

In `AresBreadcrumb.tsx`, ensure it works on small screens:

```typescript
// The breadcrumb is already simple enough — just verify the padding:
<div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#252530]
               bg-[#0E0E11] px-3 py-2 text-sm sm:px-4">
```

In `AresHub.tsx`, ensure Row 4 (cost card) is full-width on all screens (already is with `grid-cols-1`).

- [ ] **Step 2: Verify responsive behavior**

Open browser -> resize to mobile width -> Ares tab -> cards should stack vertically, banner stats should wrap

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/data-explorer/components/ares/AresHub.tsx frontend/src/features/data-explorer/components/ares/AresBreadcrumb.tsx frontend/src/features/data-explorer/components/ares/AresHealthBanner.tsx
git commit -m "feat(ares): add responsive layout for mobile — cards stack, banner wraps, breadcrumb adjusts"
```

---

## Task 8: Final Integration Tests

**Files:** None (verification only)

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/ tests/Feature/Api/AresControllerTest.php tests/Feature/Api/AresDqHistoryControllerTest.php tests/Feature/Api/NetworkAresControllerTest.php tests/Feature/Api/AresCostControllerTest.php`
Expected: All tests PASS

- [ ] **Step 2: Run frontend TypeScript check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: No TypeScript errors

- [ ] **Step 3: Run ESLint**

Run: `docker compose exec node sh -c "cd /app && npx eslint src/features/data-explorer/"`
Expected: No errors (warnings acceptable)

- [ ] **Step 4: Run PHPStan**

Run: `cd backend && vendor/bin/phpstan analyse app/Services/Ares/ app/Http/Controllers/Api/V1/AresController.php app/Http/Controllers/Api/V1/NetworkAresController.php`
Expected: No errors at level 8

- [ ] **Step 5: Verify full flow end-to-end**

1. Ares tab -> hub with 10 cards, live KPIs in banner
2. Network Overview -> source health table with DQ scores
3. Concept Comparison -> search concept -> bar chart
4. DQ History -> select source -> trend chart -> click release -> delta table
5. Coverage Matrix -> heatmap renders
6. Feasibility -> create assessment -> scorecard
7. Diversity -> stacked bars per source
8. Releases -> source selector -> release timeline
9. Unmapped Codes -> select source -> paginated table
10. Cost -> select source -> cost data or empty state
11. Annotations -> browse all annotations

- [ ] **Step 6: Commit**

```bash
git commit --allow-empty -m "test(ares): verify all Phase 4 integration tests pass across all Ares endpoints"
```

---

## Task 9: OpenAPI Regeneration + Deploy

**Files:** None (deployment only)

- [ ] **Step 1: Regenerate OpenAPI spec**

Run: `./deploy.sh --openapi`
Expected: `frontend/src/types/api.generated.ts` updated with new Ares endpoints

- [ ] **Step 2: Build frontend**

Run: `./deploy.sh --frontend`
Expected: Production build completes without errors

- [ ] **Step 3: Deploy everything**

Run: `./deploy.sh`
Expected: Full deployment succeeds — PHP caches cleared, migrations run, frontend built

- [ ] **Step 4: Verify production**

Open https://parthenon.acumenus.net -> Data Explorer -> Ares tab -> verify hub loads with live data

- [ ] **Step 5: Final commit**

```bash
git commit --allow-empty -m "feat(ares): complete Phase 4 — cost analysis, annotation retrofit, polish, deployment"
```

- [ ] **Step 6: Tag release**

```bash
git tag -a v1.ares-parity -m "Ares Parity+ complete — 10 network intelligence views, 8 services, 15+ endpoints"
```
