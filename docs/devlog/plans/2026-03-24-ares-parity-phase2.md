# Ares Parity — Phase 2: Quality Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build DQ history tracking with delta computation, unmapped source code analysis, and domain continuity visualization — the quality monitoring layer of Ares.

**Architecture:** Replace DqHistoryService stub from Phase 1 with full delta computation against `dqd_deltas` table. New `UnmappedCodeService` populates `unmapped_source_codes` during Achilles runs. New endpoints on `AresController` for DQ history, unmapped codes, and domain continuity. Frontend drill-in views with trend charts, delta tables, and filterable paginated tables. Hub cards wired to live API data.

**Tech Stack:** Laravel 11 / PHP 8.4 / PostgreSQL 17 / React 19 / TypeScript / TanStack Query / Recharts / Tailwind 4

**Spec:** `docs/superpowers/specs/2026-03-24-ares-parity-design.md`

**Depends on:** Phase 1 plan at `docs/superpowers/plans/2026-03-24-ares-parity-phase1.md`

---

## File Map

### Backend — New Files

```
backend/
├── app/
│   └── Services/Ares/
│       └── UnmappedCodeService.php             # New service
├── tests/
│   ├── Unit/Services/Ares/
│   │   ├── DqHistoryServiceTest.php            # New test
│   │   └── UnmappedCodeServiceTest.php         # New test
│   └── Feature/Api/
│       └── AresDqHistoryControllerTest.php     # New test
```

### Backend — Modified Files

```
backend/
├── app/
│   ├── Services/Ares/
│   │   └── DqHistoryService.php                # Replace stub with full implementation
│   ├── Http/Controllers/Api/V1/
│   │   └── AresController.php                  # Add DQ history, unmapped codes, domain continuity endpoints
│   └── Jobs/Achilles/
│       └── RunAchillesJob.php                  # Add unmapped code collection step
├── routes/api.php                              # Add new Ares endpoints
```

### Frontend — New Files

```
frontend/src/features/data-explorer/
├── components/ares/
│   ├── dq-history/
│   │   ├── DqHistoryView.tsx                   # Source selector + trend chart + delta table
│   │   ├── DqTrendChart.tsx                    # Line chart: DQ pass rate over releases
│   │   └── DqDeltaTable.tsx                    # Delta badges: NEW/RESOLVED/STABLE/EXISTING
│   └── unmapped-codes/
│       └── UnmappedCodesView.tsx               # Filterable paginated table
├── hooks/
│   ├── useAresHub.ts                           # Hub overview KPI hooks (live data)
│   └── useDqHistoryData.ts                     # DQ trends + deltas hooks
├── api/
│   └── dqHistoryApi.ts                         # DQ history + unmapped codes API functions
```

### Frontend — Modified Files

```
frontend/src/features/data-explorer/
├── components/ares/
│   └── AresHub.tsx                             # Wire hub cards to live data
├── pages/
│   └── AresTab.tsx                             # Add DqHistoryView + UnmappedCodesView routing
└── types/
    └── ares.ts                                 # Add DQ history + unmapped codes types
```

---

## Task 1: DqHistoryService (Replace Stub)

**Files:**
- Modify: `backend/app/Services/Ares/DqHistoryService.php` (replace Phase 1 stub)
- Create: `backend/tests/Unit/Services/Ares/DqHistoryServiceTest.php`

- [ ] **Step 1: Write failing tests**

```php
<?php

namespace Tests\Unit\Services\Ares;

use App\Models\App\DqdResult;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Services\Ares\DqHistoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DqHistoryServiceTest extends TestCase
{
    use RefreshDatabase;

    private DqHistoryService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(DqHistoryService::class);
    }

    public function test_compute_deltas_first_release_all_new(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create([
            'source_id' => $source->id,
            'release_type' => 'snapshot',
        ]);

        // Create DQD results linked to this release
        DqdResult::factory()->create([
            'source_id' => $source->id,
            'release_id' => $release->id,
            'check_id' => 'check_001',
            'passed' => false,
        ]);
        DqdResult::factory()->create([
            'source_id' => $source->id,
            'release_id' => $release->id,
            'check_id' => 'check_002',
            'passed' => true,
        ]);

        $this->service->computeDeltas($release);

        // First release: failed checks are NEW, passed checks are STABLE
        $this->assertDatabaseHas('dqd_deltas', [
            'current_release_id' => $release->id,
            'check_id' => 'check_001',
            'delta_status' => 'new',
            'current_passed' => false,
        ]);
        $this->assertDatabaseHas('dqd_deltas', [
            'current_release_id' => $release->id,
            'check_id' => 'check_002',
            'delta_status' => 'stable',
            'current_passed' => true,
        ]);
    }

    public function test_compute_deltas_with_previous_release(): void
    {
        $source = Source::factory()->create();

        $prev = SourceRelease::factory()->create([
            'source_id' => $source->id,
            'created_at' => now()->subDay(),
        ]);
        $current = SourceRelease::factory()->create([
            'source_id' => $source->id,
            'created_at' => now(),
        ]);

        // Previous release: check_001 failed, check_002 passed, check_003 failed
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $prev->id, 'check_id' => 'check_001', 'passed' => false]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $prev->id, 'check_id' => 'check_002', 'passed' => true]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $prev->id, 'check_id' => 'check_003', 'passed' => false]);

        // Current release: check_001 still fails (existing), check_002 now fails (new), check_003 now passes (resolved)
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $current->id, 'check_id' => 'check_001', 'passed' => false]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $current->id, 'check_id' => 'check_002', 'passed' => false]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $current->id, 'check_id' => 'check_003', 'passed' => true]);

        $this->service->computeDeltas($current);

        $this->assertDatabaseHas('dqd_deltas', [
            'current_release_id' => $current->id,
            'check_id' => 'check_001',
            'delta_status' => 'existing',
        ]);
        $this->assertDatabaseHas('dqd_deltas', [
            'current_release_id' => $current->id,
            'check_id' => 'check_002',
            'delta_status' => 'new',
        ]);
        $this->assertDatabaseHas('dqd_deltas', [
            'current_release_id' => $current->id,
            'check_id' => 'check_003',
            'delta_status' => 'resolved',
        ]);
    }

    public function test_get_trends_returns_pass_rates_per_release(): void
    {
        $source = Source::factory()->create();

        $r1 = SourceRelease::factory()->create(['source_id' => $source->id, 'created_at' => now()->subDays(2)]);
        $r2 = SourceRelease::factory()->create(['source_id' => $source->id, 'created_at' => now()]);

        // Release 1: 3 passed, 1 failed = 75%
        DqdResult::factory()->count(3)->create(['source_id' => $source->id, 'release_id' => $r1->id, 'passed' => true]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $r1->id, 'passed' => false]);

        // Release 2: 4 passed, 1 failed = 80%
        DqdResult::factory()->count(4)->create(['source_id' => $source->id, 'release_id' => $r2->id, 'passed' => true]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $r2->id, 'passed' => false]);

        $trends = $this->service->getTrends($source);

        $this->assertCount(2, $trends);
        $this->assertEquals(75.0, $trends[0]['pass_rate']);
        $this->assertEquals(80.0, $trends[1]['pass_rate']);
    }

    public function test_get_category_trends_groups_by_category(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create(['source_id' => $source->id]);

        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $release->id, 'category' => 'Completeness', 'passed' => true]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $release->id, 'category' => 'Completeness', 'passed' => false]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $release->id, 'category' => 'Conformance', 'passed' => true]);

        $trends = $this->service->getCategoryTrends($source);

        $this->assertArrayHasKey('Completeness', $trends[0]['categories']);
        $this->assertArrayHasKey('Conformance', $trends[0]['categories']);
        $this->assertEquals(50.0, $trends[0]['categories']['Completeness']);
        $this->assertEquals(100.0, $trends[0]['categories']['Conformance']);
    }

    public function test_get_domain_trends_groups_by_cdm_table(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create(['source_id' => $source->id]);

        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $release->id, 'cdm_table' => 'person', 'passed' => true]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $release->id, 'cdm_table' => 'person', 'passed' => false]);
        DqdResult::factory()->create(['source_id' => $source->id, 'release_id' => $release->id, 'cdm_table' => 'condition_occurrence', 'passed' => true]);

        $trends = $this->service->getDomainTrends($source);

        $this->assertArrayHasKey('person', $trends[0]['domains']);
        $this->assertEquals(50.0, $trends[0]['domains']['person']);
        $this->assertEquals(100.0, $trends[0]['domains']['condition_occurrence']);
    }

    public function test_get_network_dq_summary_returns_per_source_scores(): void
    {
        $source1 = Source::factory()->create(['source_name' => 'Source A']);
        $source2 = Source::factory()->create(['source_name' => 'Source B']);

        $r1 = SourceRelease::factory()->create(['source_id' => $source1->id]);
        $r2 = SourceRelease::factory()->create(['source_id' => $source2->id]);

        DqdResult::factory()->count(9)->create(['source_id' => $source1->id, 'release_id' => $r1->id, 'passed' => true]);
        DqdResult::factory()->create(['source_id' => $source1->id, 'release_id' => $r1->id, 'passed' => false]);
        DqdResult::factory()->count(8)->create(['source_id' => $source2->id, 'release_id' => $r2->id, 'passed' => true]);
        DqdResult::factory()->count(2)->create(['source_id' => $source2->id, 'release_id' => $r2->id, 'passed' => false]);

        $summary = $this->service->getNetworkDqSummary();

        $this->assertCount(2, $summary);
        // Source A: 90%, Source B: 80%
        $sourceA = collect($summary)->firstWhere('source_name', 'Source A');
        $this->assertEquals(90.0, $sourceA['pass_rate']);
    }

    public function test_compute_deltas_is_idempotent(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create(['source_id' => $source->id]);

        DqdResult::factory()->create([
            'source_id' => $source->id,
            'release_id' => $release->id,
            'check_id' => 'check_001',
            'passed' => false,
        ]);

        $this->service->computeDeltas($release);
        $this->service->computeDeltas($release);

        // Should not duplicate — only 1 delta row per check per release
        $this->assertEquals(1, DB::table('dqd_deltas')
            ->where('current_release_id', $release->id)
            ->where('check_id', 'check_001')
            ->count());
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/DqHistoryServiceTest.php`
Expected: FAIL — DqHistoryService methods not implemented (stub only has computeDeltas logging)

- [ ] **Step 3: Implement DqHistoryService (replace stub)**

Replace the entire contents of `backend/app/Services/Ares/DqHistoryService.php`:

```php
<?php

namespace App\Services\Ares;

use App\Models\App\DqdResult;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class DqHistoryService
{
    /**
     * Compute delta status for each DQD check in the given release
     * compared to the previous release for the same source.
     *
     * Delta logic:
     *   new      = failed in current, not present in previous (or first release)
     *   resolved = passed in current, failed in previous
     *   existing = failed in both current and previous
     *   stable   = passed in both current and previous
     */
    public function computeDeltas(SourceRelease $release): void
    {
        // Delete any existing deltas for idempotency
        DB::table('dqd_deltas')
            ->where('current_release_id', $release->id)
            ->delete();

        $previousRelease = SourceRelease::where('source_id', $release->source_id)
            ->where('id', '!=', $release->id)
            ->where('created_at', '<', $release->created_at)
            ->orderByDesc('created_at')
            ->first();

        $currentResults = DqdResult::where('source_id', $release->source_id)
            ->where('release_id', $release->id)
            ->get()
            ->keyBy('check_id');

        $previousResults = $previousRelease
            ? DqdResult::where('source_id', $release->source_id)
                ->where('release_id', $previousRelease->id)
                ->get()
                ->keyBy('check_id')
            : collect();

        $deltas = [];
        $now = now();

        foreach ($currentResults as $checkId => $current) {
            $previous = $previousResults->get($checkId);

            if (! $previousRelease || ! $previous) {
                // First release or check not in previous
                $deltaStatus = $current->passed ? 'stable' : 'new';
                $previousPassed = null;
            } elseif ($current->passed && $previous->passed) {
                $deltaStatus = 'stable';
                $previousPassed = true;
            } elseif (! $current->passed && ! $previous->passed) {
                $deltaStatus = 'existing';
                $previousPassed = false;
            } elseif ($current->passed && ! $previous->passed) {
                $deltaStatus = 'resolved';
                $previousPassed = false;
            } else {
                // Failed in current, passed in previous
                $deltaStatus = 'new';
                $previousPassed = true;
            }

            $deltas[] = [
                'source_id' => $release->source_id,
                'current_release_id' => $release->id,
                'previous_release_id' => $previousRelease?->id,
                'check_id' => $checkId,
                'delta_status' => $deltaStatus,
                'current_passed' => $current->passed,
                'previous_passed' => $previousPassed,
                'created_at' => $now,
            ];
        }

        if (! empty($deltas)) {
            DB::table('dqd_deltas')->insert($deltas);
        }

        Log::info("DqHistoryService: computed {$release->id} deltas — " . count($deltas) . ' checks processed.');
    }

    /**
     * Get overall DQ pass rate per release for a source.
     *
     * @return array<int, array{release_id: int, release_name: string, created_at: string, pass_rate: float, total: int, passed: int}>
     */
    public function getTrends(Source $source): array
    {
        $releases = SourceRelease::where('source_id', $source->id)
            ->orderBy('created_at')
            ->get();

        $trends = [];

        foreach ($releases as $release) {
            $stats = DqdResult::where('source_id', $source->id)
                ->where('release_id', $release->id)
                ->selectRaw('COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
                ->first();

            $total = (int) $stats->total;
            $passed = (int) $stats->passed_count;

            $trends[] = [
                'release_id' => $release->id,
                'release_name' => $release->release_name,
                'created_at' => $release->created_at->toIso8601String(),
                'pass_rate' => $total > 0 ? round(($passed / $total) * 100, 1) : 0.0,
                'total' => $total,
                'passed' => $passed,
            ];
        }

        return $trends;
    }

    /**
     * Get DQ pass rate by category per release for a source.
     *
     * @return array<int, array{release_id: int, release_name: string, created_at: string, categories: array<string, float>}>
     */
    public function getCategoryTrends(Source $source): array
    {
        $releases = SourceRelease::where('source_id', $source->id)
            ->orderBy('created_at')
            ->get();

        $trends = [];

        foreach ($releases as $release) {
            $categoryStats = DqdResult::where('source_id', $source->id)
                ->where('release_id', $release->id)
                ->whereNotNull('category')
                ->selectRaw('category, COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
                ->groupBy('category')
                ->get();

            $categories = [];
            foreach ($categoryStats as $stat) {
                $total = (int) $stat->total;
                $categories[$stat->category] = $total > 0
                    ? round(((int) $stat->passed_count / $total) * 100, 1)
                    : 0.0;
            }

            $trends[] = [
                'release_id' => $release->id,
                'release_name' => $release->release_name,
                'created_at' => $release->created_at->toIso8601String(),
                'categories' => $categories,
            ];
        }

        return $trends;
    }

    /**
     * Get DQ pass rate by CDM table per release for a source.
     *
     * @return array<int, array{release_id: int, release_name: string, created_at: string, domains: array<string, float>}>
     */
    public function getDomainTrends(Source $source): array
    {
        $releases = SourceRelease::where('source_id', $source->id)
            ->orderBy('created_at')
            ->get();

        $trends = [];

        foreach ($releases as $release) {
            $domainStats = DqdResult::where('source_id', $source->id)
                ->where('release_id', $release->id)
                ->whereNotNull('cdm_table')
                ->selectRaw('cdm_table, COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
                ->groupBy('cdm_table')
                ->get();

            $domains = [];
            foreach ($domainStats as $stat) {
                $total = (int) $stat->total;
                $domains[$stat->cdm_table] = $total > 0
                    ? round(((int) $stat->passed_count / $total) * 100, 1)
                    : 0.0;
            }

            $trends[] = [
                'release_id' => $release->id,
                'release_name' => $release->release_name,
                'created_at' => $release->created_at->toIso8601String(),
                'domains' => $domains,
            ];
        }

        return $trends;
    }

    /**
     * Get deltas for a specific release.
     *
     * @return Collection<int, object>
     */
    public function getDeltas(int $releaseId): Collection
    {
        return DB::table('dqd_deltas')
            ->where('current_release_id', $releaseId)
            ->orderByRaw("CASE delta_status WHEN 'new' THEN 1 WHEN 'existing' THEN 2 WHEN 'resolved' THEN 3 ELSE 4 END")
            ->get();
    }

    /**
     * Get the latest DQ pass rate per source across the network.
     *
     * @return array<int, array{source_id: int, source_name: string, pass_rate: float, trend: string|null, release_name: string|null}>
     */
    public function getNetworkDqSummary(): array
    {
        $sources = Source::whereHas('daimons')->get();
        $summary = [];

        foreach ($sources as $source) {
            $latestRelease = SourceRelease::where('source_id', $source->id)
                ->orderByDesc('created_at')
                ->first();

            if (! $latestRelease) {
                $summary[] = [
                    'source_id' => $source->id,
                    'source_name' => $source->source_name,
                    'pass_rate' => 0.0,
                    'trend' => null,
                    'release_name' => null,
                ];
                continue;
            }

            $stats = DqdResult::where('source_id', $source->id)
                ->where('release_id', $latestRelease->id)
                ->selectRaw('COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
                ->first();

            $total = (int) $stats->total;
            $currentRate = $total > 0 ? round(((int) $stats->passed_count / $total) * 100, 1) : 0.0;

            // Compute trend vs previous release
            $previousRelease = SourceRelease::where('source_id', $source->id)
                ->where('id', '!=', $latestRelease->id)
                ->where('created_at', '<', $latestRelease->created_at)
                ->orderByDesc('created_at')
                ->first();

            $trend = null;
            if ($previousRelease) {
                $prevStats = DqdResult::where('source_id', $source->id)
                    ->where('release_id', $previousRelease->id)
                    ->selectRaw('COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
                    ->first();

                $prevTotal = (int) $prevStats->total;
                $prevRate = $prevTotal > 0 ? round(((int) $prevStats->passed_count / $prevTotal) * 100, 1) : 0.0;

                if ($currentRate > $prevRate) {
                    $trend = 'up';
                } elseif ($currentRate < $prevRate) {
                    $trend = 'down';
                } else {
                    $trend = 'stable';
                }
            }

            $summary[] = [
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'pass_rate' => $currentRate,
                'trend' => $trend,
                'release_name' => $latestRelease->release_name,
            ];
        }

        return $summary;
    }

    /**
     * Get records per domain across releases for domain continuity.
     *
     * @return array<int, array{release_id: int, release_name: string, created_at: string, domains: array<string, int>}>
     */
    public function getDomainContinuity(Source $source): array
    {
        $releases = SourceRelease::where('source_id', $source->id)
            ->orderBy('created_at')
            ->get();

        $continuity = [];

        foreach ($releases as $release) {
            $domainCounts = DqdResult::where('source_id', $source->id)
                ->where('release_id', $release->id)
                ->whereNotNull('cdm_table')
                ->selectRaw('cdm_table, SUM(total_rows) as record_count')
                ->groupBy('cdm_table')
                ->pluck('record_count', 'cdm_table')
                ->map(fn ($v) => (int) $v)
                ->toArray();

            $continuity[] = [
                'release_id' => $release->id,
                'release_name' => $release->release_name,
                'created_at' => $release->created_at->toIso8601String(),
                'domains' => $domainCounts,
            ];
        }

        return $continuity;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/DqHistoryServiceTest.php`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Ares/DqHistoryService.php backend/tests/Unit/Services/Ares/DqHistoryServiceTest.php
git commit -m "feat(ares): implement DqHistoryService with delta computation and trend aggregation"
```

---

## Task 2: UnmappedCodeService

**Files:**
- Create: `backend/app/Services/Ares/UnmappedCodeService.php`
- Create: `backend/tests/Unit/Services/Ares/UnmappedCodeServiceTest.php`

- [ ] **Step 1: Write failing tests**

```php
<?php

namespace Tests\Unit\Services\Ares;

use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\App\UnmappedSourceCode;
use App\Services\Ares\UnmappedCodeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UnmappedCodeServiceTest extends TestCase
{
    use RefreshDatabase;

    private UnmappedCodeService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(UnmappedCodeService::class);
    }

    public function test_get_summary_groups_by_table_and_field(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create(['source_id' => $source->id]);

        UnmappedSourceCode::create([
            'source_id' => $source->id,
            'release_id' => $release->id,
            'source_code' => 'ICD10-Z99',
            'source_vocabulary_id' => 'ICD10CM',
            'cdm_table' => 'condition_occurrence',
            'cdm_field' => 'condition_source_value',
            'record_count' => 150,
            'created_at' => now(),
        ]);
        UnmappedSourceCode::create([
            'source_id' => $source->id,
            'release_id' => $release->id,
            'source_code' => 'NDC-123',
            'source_vocabulary_id' => 'NDC',
            'cdm_table' => 'drug_exposure',
            'cdm_field' => 'drug_source_value',
            'record_count' => 75,
            'created_at' => now(),
        ]);

        $summary = $this->service->getSummary($source, $release);

        $this->assertCount(2, $summary);
        $condition = collect($summary)->firstWhere('cdm_table', 'condition_occurrence');
        $this->assertEquals(150, $condition->total_records);
        $this->assertEquals(1, $condition->code_count);
    }

    public function test_get_details_returns_paginated_results(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create(['source_id' => $source->id]);

        for ($i = 0; $i < 25; $i++) {
            UnmappedSourceCode::create([
                'source_id' => $source->id,
                'release_id' => $release->id,
                'source_code' => "CODE-{$i}",
                'source_vocabulary_id' => 'ICD10CM',
                'cdm_table' => 'condition_occurrence',
                'cdm_field' => 'condition_source_value',
                'record_count' => 100 - $i,
                'created_at' => now(),
            ]);
        }

        $page1 = $this->service->getDetails($source, $release, [], 1, 10);

        $this->assertEquals(25, $page1->total());
        $this->assertCount(10, $page1->items());
    }

    public function test_get_details_filters_by_table(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create(['source_id' => $source->id]);

        UnmappedSourceCode::create([
            'source_id' => $source->id,
            'release_id' => $release->id,
            'source_code' => 'A1',
            'source_vocabulary_id' => 'ICD10CM',
            'cdm_table' => 'condition_occurrence',
            'cdm_field' => 'condition_source_value',
            'record_count' => 50,
            'created_at' => now(),
        ]);
        UnmappedSourceCode::create([
            'source_id' => $source->id,
            'release_id' => $release->id,
            'source_code' => 'B1',
            'source_vocabulary_id' => 'NDC',
            'cdm_table' => 'drug_exposure',
            'cdm_field' => 'drug_source_value',
            'record_count' => 30,
            'created_at' => now(),
        ]);

        $filtered = $this->service->getDetails($source, $release, ['table' => 'condition_occurrence']);

        $this->assertEquals(1, $filtered->total());
    }

    public function test_get_network_summary_aggregates_across_sources(): void
    {
        $source1 = Source::factory()->create();
        $source2 = Source::factory()->create();
        $r1 = SourceRelease::factory()->create(['source_id' => $source1->id]);
        $r2 = SourceRelease::factory()->create(['source_id' => $source2->id]);

        UnmappedSourceCode::create([
            'source_id' => $source1->id, 'release_id' => $r1->id,
            'source_code' => 'A1', 'source_vocabulary_id' => 'ICD10CM',
            'cdm_table' => 'condition_occurrence', 'cdm_field' => 'condition_source_value',
            'record_count' => 100, 'created_at' => now(),
        ]);
        UnmappedSourceCode::create([
            'source_id' => $source2->id, 'release_id' => $r2->id,
            'source_code' => 'B1', 'source_vocabulary_id' => 'ICD10CM',
            'cdm_table' => 'condition_occurrence', 'cdm_field' => 'condition_source_value',
            'record_count' => 200, 'created_at' => now(),
        ]);

        $summary = $this->service->getNetworkSummary();

        $condition = collect($summary)->firstWhere('cdm_table', 'condition_occurrence');
        $this->assertEquals(300, $condition->total_records);
        $this->assertEquals(2, $condition->code_count);
    }

    public function test_get_total_unmapped_count(): void
    {
        $source = Source::factory()->create();
        $release = SourceRelease::factory()->create(['source_id' => $source->id]);

        UnmappedSourceCode::create([
            'source_id' => $source->id, 'release_id' => $release->id,
            'source_code' => 'X1', 'source_vocabulary_id' => 'ICD10CM',
            'cdm_table' => 'condition_occurrence', 'cdm_field' => 'condition_source_value',
            'record_count' => 10, 'created_at' => now(),
        ]);
        UnmappedSourceCode::create([
            'source_id' => $source->id, 'release_id' => $release->id,
            'source_code' => 'X2', 'source_vocabulary_id' => 'NDC',
            'cdm_table' => 'drug_exposure', 'cdm_field' => 'drug_source_value',
            'record_count' => 20, 'created_at' => now(),
        ]);

        $count = $this->service->getTotalUnmappedCount();

        $this->assertEquals(2, $count);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/UnmappedCodeServiceTest.php`
Expected: FAIL — UnmappedCodeService class not found

- [ ] **Step 3: Implement UnmappedCodeService**

```php
<?php

namespace App\Services\Ares;

use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\App\UnmappedSourceCode;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class UnmappedCodeService
{
    /**
     * Get summary of unmapped codes grouped by CDM table/field for a specific release.
     *
     * @return Collection<int, object>
     */
    public function getSummary(Source $source, SourceRelease $release): Collection
    {
        return UnmappedSourceCode::where('source_id', $source->id)
            ->where('release_id', $release->id)
            ->selectRaw('cdm_table, cdm_field, COUNT(*) as code_count, SUM(record_count) as total_records')
            ->groupBy('cdm_table', 'cdm_field')
            ->orderByDesc('total_records')
            ->get();
    }

    /**
     * Get paginated details of unmapped codes with optional filters.
     *
     * @param array{table?: string, field?: string, search?: string} $filters
     */
    public function getDetails(
        Source $source,
        SourceRelease $release,
        array $filters = [],
        int $page = 1,
        int $perPage = 20,
    ): LengthAwarePaginator {
        $query = UnmappedSourceCode::where('source_id', $source->id)
            ->where('release_id', $release->id);

        if (! empty($filters['table'])) {
            $query->where('cdm_table', $filters['table']);
        }

        if (! empty($filters['field'])) {
            $query->where('cdm_field', $filters['field']);
        }

        if (! empty($filters['search'])) {
            $query->where('source_code', 'ilike', '%' . $filters['search'] . '%');
        }

        return $query->orderByDesc('record_count')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * Get aggregated unmapped code summary across all sources (latest release per source).
     *
     * @return Collection<int, object>
     */
    public function getNetworkSummary(): Collection
    {
        // Get latest release ID per source
        $latestReleases = DB::table('source_releases as sr')
            ->select('sr.id')
            ->whereRaw('sr.created_at = (
                SELECT MAX(sr2.created_at)
                FROM source_releases sr2
                WHERE sr2.source_id = sr.source_id
            )')
            ->pluck('id');

        if ($latestReleases->isEmpty()) {
            return collect();
        }

        return UnmappedSourceCode::whereIn('release_id', $latestReleases)
            ->selectRaw('cdm_table, cdm_field, COUNT(*) as code_count, SUM(record_count) as total_records')
            ->groupBy('cdm_table', 'cdm_field')
            ->orderByDesc('total_records')
            ->get();
    }

    /**
     * Get total count of unique unmapped source codes across all sources (latest releases).
     */
    public function getTotalUnmappedCount(): int
    {
        $latestReleases = DB::table('source_releases as sr')
            ->select('sr.id')
            ->whereRaw('sr.created_at = (
                SELECT MAX(sr2.created_at)
                FROM source_releases sr2
                WHERE sr2.source_id = sr.source_id
            )')
            ->pluck('id');

        if ($latestReleases->isEmpty()) {
            return 0;
        }

        return UnmappedSourceCode::whereIn('release_id', $latestReleases)->count();
    }

    /**
     * Collect unmapped source codes from source_to_concept_map during Achilles runs.
     * Called as an additional step after standard Achilles analyses complete.
     */
    public function collectUnmappedCodes(Source $source, SourceRelease $release): int
    {
        // Delete existing unmapped codes for this release (idempotent)
        UnmappedSourceCode::where('source_id', $source->id)
            ->where('release_id', $release->id)
            ->delete();

        // Query source_to_concept_map for unmapped codes (target_concept_id = 0 or NULL)
        $unmapped = DB::connection('omop')
            ->table('source_to_concept_map')
            ->select([
                'source_code',
                'source_vocabulary_id',
                DB::raw("'condition_occurrence' as cdm_table"),
                DB::raw("'condition_source_value' as cdm_field"),
                DB::raw('1 as record_count'),
            ])
            ->where(function ($q) {
                $q->where('target_concept_id', 0)
                    ->orWhereNull('target_concept_id');
            })
            ->get();

        $rows = [];
        $now = now();

        foreach ($unmapped as $row) {
            $rows[] = [
                'source_id' => $source->id,
                'release_id' => $release->id,
                'source_code' => $row->source_code,
                'source_vocabulary_id' => $row->source_vocabulary_id,
                'cdm_table' => $row->cdm_table,
                'cdm_field' => $row->cdm_field,
                'record_count' => $row->record_count,
                'created_at' => $now,
            ];
        }

        if (! empty($rows)) {
            // Batch insert in chunks
            foreach (array_chunk($rows, 500) as $chunk) {
                DB::table('unmapped_source_codes')->insert($chunk);
            }
        }

        return count($rows);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/UnmappedCodeServiceTest.php`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/Ares/UnmappedCodeService.php backend/tests/Unit/Services/Ares/UnmappedCodeServiceTest.php
git commit -m "feat(ares): implement UnmappedCodeService with summary, details, and network aggregation"
```

---

## Task 3: DQ History + Unmapped Codes API Endpoints

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/AresController.php`
- Modify: `backend/routes/api.php`
- Create: `backend/tests/Feature/Api/AresDqHistoryControllerTest.php`

- [ ] **Step 1: Write failing integration tests**

```php
<?php

namespace Tests\Feature\Api;

use App\Models\App\DqdResult;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\App\UnmappedSourceCode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AresDqHistoryControllerTest extends TestCase
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

    public function test_dq_history_requires_auth(): void
    {
        $this->getJson("/api/v1/sources/{$this->source->id}/ares/dq-history")
            ->assertStatus(401);
    }

    public function test_dq_history_returns_trend_data(): void
    {
        $release = SourceRelease::factory()->create(['source_id' => $this->source->id]);
        DqdResult::factory()->count(3)->create([
            'source_id' => $this->source->id,
            'release_id' => $release->id,
            'passed' => true,
        ]);
        DqdResult::factory()->create([
            'source_id' => $this->source->id,
            'release_id' => $release->id,
            'passed' => false,
        ]);

        $this->withToken($this->token)
            ->getJson("/api/v1/sources/{$this->source->id}/ares/dq-history")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.pass_rate', 75.0);
    }

    public function test_dq_history_deltas_returns_delta_report(): void
    {
        $release = SourceRelease::factory()->create(['source_id' => $this->source->id]);
        DqdResult::factory()->create([
            'source_id' => $this->source->id,
            'release_id' => $release->id,
            'check_id' => 'check_001',
            'passed' => false,
        ]);

        // Compute deltas first
        app(\App\Services\Ares\DqHistoryService::class)->computeDeltas($release);

        $this->withToken($this->token)
            ->getJson("/api/v1/sources/{$this->source->id}/ares/dq-history/deltas?release_id={$release->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_dq_history_category_trends(): void
    {
        $release = SourceRelease::factory()->create(['source_id' => $this->source->id]);
        DqdResult::factory()->create([
            'source_id' => $this->source->id,
            'release_id' => $release->id,
            'category' => 'Completeness',
            'passed' => true,
        ]);

        $this->withToken($this->token)
            ->getJson("/api/v1/sources/{$this->source->id}/ares/dq-history/category-trends")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_dq_history_domain_trends(): void
    {
        $release = SourceRelease::factory()->create(['source_id' => $this->source->id]);
        DqdResult::factory()->create([
            'source_id' => $this->source->id,
            'release_id' => $release->id,
            'cdm_table' => 'person',
            'passed' => true,
        ]);

        $this->withToken($this->token)
            ->getJson("/api/v1/sources/{$this->source->id}/ares/dq-history/domain-trends")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_unmapped_codes_summary(): void
    {
        $release = SourceRelease::factory()->create(['source_id' => $this->source->id]);
        UnmappedSourceCode::create([
            'source_id' => $this->source->id,
            'release_id' => $release->id,
            'source_code' => 'ICD-Z99',
            'source_vocabulary_id' => 'ICD10CM',
            'cdm_table' => 'condition_occurrence',
            'cdm_field' => 'condition_source_value',
            'record_count' => 50,
            'created_at' => now(),
        ]);

        $this->withToken($this->token)
            ->getJson("/api/v1/sources/{$this->source->id}/ares/unmapped-codes/summary?release_id={$release->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_unmapped_codes_paginated(): void
    {
        $release = SourceRelease::factory()->create(['source_id' => $this->source->id]);
        for ($i = 0; $i < 15; $i++) {
            UnmappedSourceCode::create([
                'source_id' => $this->source->id,
                'release_id' => $release->id,
                'source_code' => "CODE-{$i}",
                'source_vocabulary_id' => 'ICD10CM',
                'cdm_table' => 'condition_occurrence',
                'cdm_field' => 'condition_source_value',
                'record_count' => 100 - $i,
                'created_at' => now(),
            ]);
        }

        $this->withToken($this->token)
            ->getJson("/api/v1/sources/{$this->source->id}/ares/unmapped-codes?release_id={$release->id}&page=1&per_page=10")
            ->assertOk()
            ->assertJsonPath('meta.total', 15)
            ->assertJsonCount(10, 'data');
    }

    public function test_domain_continuity(): void
    {
        $release = SourceRelease::factory()->create(['source_id' => $this->source->id]);
        DqdResult::factory()->create([
            'source_id' => $this->source->id,
            'release_id' => $release->id,
            'cdm_table' => 'person',
            'total_rows' => 1000,
            'passed' => true,
        ]);

        $this->withToken($this->token)
            ->getJson("/api/v1/sources/{$this->source->id}/ares/domain-continuity")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/AresDqHistoryControllerTest.php`
Expected: FAIL — routes not defined

- [ ] **Step 3: Add DQ history and unmapped codes methods to AresController**

Add the following methods to `backend/app/Http/Controllers/Api/V1/AresController.php`:

```php
use App\Services\Ares\DqHistoryService;
use App\Services\Ares\UnmappedCodeService;

// Add to constructor:
public function __construct(
    private readonly ReleaseService $releaseService,
    private readonly AnnotationService $annotationService,
    private readonly DqHistoryService $dqHistoryService,
    private readonly UnmappedCodeService $unmappedCodeService,
) {}

// --- DQ History ---

public function dqHistory(Source $source): JsonResponse
{
    return response()->json([
        'data' => $this->dqHistoryService->getTrends($source),
    ]);
}

public function dqHistoryDeltas(Source $source): JsonResponse
{
    $releaseId = (int) request()->query('release_id');

    if (! $releaseId) {
        return response()->json(['error' => 'release_id is required'], 422);
    }

    return response()->json([
        'data' => $this->dqHistoryService->getDeltas($releaseId),
    ]);
}

public function dqHistoryCategoryTrends(Source $source): JsonResponse
{
    return response()->json([
        'data' => $this->dqHistoryService->getCategoryTrends($source),
    ]);
}

public function dqHistoryDomainTrends(Source $source): JsonResponse
{
    return response()->json([
        'data' => $this->dqHistoryService->getDomainTrends($source),
    ]);
}

// --- Unmapped Codes ---

public function unmappedCodesSummary(Source $source): JsonResponse
{
    $releaseId = (int) request()->query('release_id');
    $release = SourceRelease::findOrFail($releaseId);

    return response()->json([
        'data' => $this->unmappedCodeService->getSummary($source, $release),
    ]);
}

public function unmappedCodes(Source $source): JsonResponse
{
    $releaseId = (int) request()->query('release_id');
    $release = SourceRelease::findOrFail($releaseId);

    $filters = [
        'table' => request()->query('table'),
        'field' => request()->query('field'),
        'search' => request()->query('search'),
    ];

    $page = (int) request()->query('page', 1);
    $perPage = min((int) request()->query('per_page', 20), 100);

    $paginated = $this->unmappedCodeService->getDetails($source, $release, $filters, $page, $perPage);

    return response()->json([
        'data' => $paginated->items(),
        'meta' => [
            'total' => $paginated->total(),
            'page' => $paginated->currentPage(),
            'per_page' => $paginated->perPage(),
            'last_page' => $paginated->lastPage(),
        ],
    ]);
}

// --- Domain Continuity ---

public function domainContinuity(Source $source): JsonResponse
{
    return response()->json([
        'data' => $this->dqHistoryService->getDomainContinuity($source),
    ]);
}
```

- [ ] **Step 4: Add routes to api.php**

Add inside the existing `sources/{source}/ares` route group in `backend/routes/api.php`:

```php
// DQ History
Route::get('/dq-history', [AresController::class, 'dqHistory'])->middleware('permission:analyses.view');
Route::get('/dq-history/deltas', [AresController::class, 'dqHistoryDeltas'])->middleware('permission:analyses.view');
Route::get('/dq-history/category-trends', [AresController::class, 'dqHistoryCategoryTrends'])->middleware('permission:analyses.view');
Route::get('/dq-history/domain-trends', [AresController::class, 'dqHistoryDomainTrends'])->middleware('permission:analyses.view');

// Unmapped Codes
Route::get('/unmapped-codes', [AresController::class, 'unmappedCodes'])->middleware('permission:analyses.view');
Route::get('/unmapped-codes/summary', [AresController::class, 'unmappedCodesSummary'])->middleware('permission:analyses.view');

// Domain Continuity
Route::get('/domain-continuity', [AresController::class, 'domainContinuity'])->middleware('permission:analyses.view');
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/AresDqHistoryControllerTest.php`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/AresController.php backend/routes/api.php backend/tests/Feature/Api/AresDqHistoryControllerTest.php
git commit -m "feat(ares): add DQ history, unmapped codes, and domain continuity API endpoints"
```

---

## Task 4: Integrate Unmapped Code Collection into Achilles Runs

**Files:**
- Modify: `backend/app/Jobs/Achilles/RunAchillesJob.php`

- [ ] **Step 1: Add unmapped code collection after Achilles analyses complete**

In `backend/app/Jobs/Achilles/RunAchillesJob.php`, after the existing `AchillesRunCompleted::dispatch(...)` line (added in Phase 1), add the unmapped code collection step:

```php
use App\Services\Ares\UnmappedCodeService;
use App\Models\App\SourceRelease;

// Inside handle(), after AchillesRunCompleted dispatch:

// Collect unmapped source codes if a release is linked
$latestRelease = SourceRelease::where('source_id', $this->source->id)
    ->latest('created_at')
    ->first();

if ($latestRelease) {
    try {
        $unmappedService = app(UnmappedCodeService::class);
        $count = $unmappedService->collectUnmappedCodes($this->source, $latestRelease);
        Log::info("Achilles: collected {$count} unmapped source codes for release {$latestRelease->id}");
    } catch (\Throwable $e) {
        Log::warning("Achilles: failed to collect unmapped codes — {$e->getMessage()}");
        // Non-fatal: don't fail the Achilles run for unmapped code collection
    }
}
```

- [ ] **Step 2: Verify the job still runs correctly**

Run: `docker compose exec php php artisan queue:work --once` (or trigger an Achilles run via UI)
Expected: Achilles run completes, unmapped codes collected (or gracefully skipped if source_to_concept_map is empty)

- [ ] **Step 3: Commit**

```bash
git add backend/app/Jobs/Achilles/RunAchillesJob.php
git commit -m "feat(ares): collect unmapped source codes as post-Achilles analysis step"
```

---

## Task 5: Frontend Types for DQ History + Unmapped Codes

**Files:**
- Modify: `frontend/src/features/data-explorer/types/ares.ts`

- [ ] **Step 1: Add DQ history and unmapped codes types**

Add the following to the end of `frontend/src/features/data-explorer/types/ares.ts`:

```typescript
// DQ History types
export interface DqTrendPoint {
  release_id: number;
  release_name: string;
  created_at: string;
  pass_rate: number;
  total: number;
  passed: number;
}

export interface DqCategoryTrendPoint {
  release_id: number;
  release_name: string;
  created_at: string;
  categories: Record<string, number>;
}

export interface DqDomainTrendPoint {
  release_id: number;
  release_name: string;
  created_at: string;
  domains: Record<string, number>;
}

export interface DqDelta {
  id: number;
  source_id: number;
  current_release_id: number;
  previous_release_id: number | null;
  check_id: string;
  delta_status: "new" | "existing" | "resolved" | "stable";
  current_passed: boolean;
  previous_passed: boolean | null;
  created_at: string;
}

// Unmapped codes types
export interface UnmappedCodeSummary {
  cdm_table: string;
  cdm_field: string;
  code_count: number;
  total_records: number;
}

export interface UnmappedCode {
  id: number;
  source_id: number;
  release_id: number;
  source_code: string;
  source_vocabulary_id: string;
  cdm_table: string;
  cdm_field: string;
  record_count: number;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    per_page: number;
    last_page: number;
  };
}

// Domain continuity types
export interface DomainContinuityPoint {
  release_id: number;
  release_name: string;
  created_at: string;
  domains: Record<string, number>;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/data-explorer/types/ares.ts
git commit -m "feat(ares): add TypeScript types for DQ history, unmapped codes, and domain continuity"
```

---

## Task 6: DQ History + Unmapped Codes API Functions

**Files:**
- Create: `frontend/src/features/data-explorer/api/dqHistoryApi.ts`

- [ ] **Step 1: Create dqHistoryApi.ts**

```typescript
// frontend/src/features/data-explorer/api/dqHistoryApi.ts
import apiClient from "@/lib/apiClient";
import type {
  DqTrendPoint,
  DqCategoryTrendPoint,
  DqDomainTrendPoint,
  DqDelta,
  UnmappedCodeSummary,
  UnmappedCode,
  PaginatedResponse,
  DomainContinuityPoint,
} from "../types/ares";

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

// DQ History
export async function fetchDqHistory(sourceId: number): Promise<DqTrendPoint[]> {
  return unwrap(await apiClient.get(`/sources/${sourceId}/ares/dq-history`));
}

export async function fetchDqDeltas(sourceId: number, releaseId: number): Promise<DqDelta[]> {
  return unwrap(
    await apiClient.get(`/sources/${sourceId}/ares/dq-history/deltas`, {
      params: { release_id: releaseId },
    }),
  );
}

export async function fetchDqCategoryTrends(sourceId: number): Promise<DqCategoryTrendPoint[]> {
  return unwrap(await apiClient.get(`/sources/${sourceId}/ares/dq-history/category-trends`));
}

export async function fetchDqDomainTrends(sourceId: number): Promise<DqDomainTrendPoint[]> {
  return unwrap(await apiClient.get(`/sources/${sourceId}/ares/dq-history/domain-trends`));
}

// Unmapped Codes
export async function fetchUnmappedCodesSummary(
  sourceId: number,
  releaseId: number,
): Promise<UnmappedCodeSummary[]> {
  return unwrap(
    await apiClient.get(`/sources/${sourceId}/ares/unmapped-codes/summary`, {
      params: { release_id: releaseId },
    }),
  );
}

export async function fetchUnmappedCodes(
  sourceId: number,
  releaseId: number,
  filters: { table?: string; field?: string; search?: string; page?: number; per_page?: number } = {},
): Promise<PaginatedResponse<UnmappedCode>> {
  const res = await apiClient.get(`/sources/${sourceId}/ares/unmapped-codes`, {
    params: { release_id: releaseId, ...filters },
  });
  return res.data as PaginatedResponse<UnmappedCode>;
}

// Domain Continuity
export async function fetchDomainContinuity(sourceId: number): Promise<DomainContinuityPoint[]> {
  return unwrap(await apiClient.get(`/sources/${sourceId}/ares/domain-continuity`));
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/data-explorer/api/dqHistoryApi.ts
git commit -m "feat(ares): add DQ history, unmapped codes, and domain continuity API functions"
```

---

## Task 7: TanStack Query Hooks

**Files:**
- Create: `frontend/src/features/data-explorer/hooks/useDqHistoryData.ts`
- Create: `frontend/src/features/data-explorer/hooks/useAresHub.ts`

- [ ] **Step 1: Create useDqHistoryData.ts**

```typescript
// frontend/src/features/data-explorer/hooks/useDqHistoryData.ts
import { useQuery } from "@tanstack/react-query";
import {
  fetchDqHistory,
  fetchDqDeltas,
  fetchDqCategoryTrends,
  fetchDqDomainTrends,
  fetchUnmappedCodesSummary,
  fetchUnmappedCodes,
  fetchDomainContinuity,
} from "../api/dqHistoryApi";

export function useDqHistory(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "dq-history", sourceId],
    queryFn: () => fetchDqHistory(sourceId!),
    enabled: !!sourceId,
  });
}

export function useDqDeltas(sourceId: number | null, releaseId: number | null) {
  return useQuery({
    queryKey: ["ares", "dq-deltas", sourceId, releaseId],
    queryFn: () => fetchDqDeltas(sourceId!, releaseId!),
    enabled: !!sourceId && !!releaseId,
  });
}

export function useDqCategoryTrends(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "dq-category-trends", sourceId],
    queryFn: () => fetchDqCategoryTrends(sourceId!),
    enabled: !!sourceId,
  });
}

export function useDqDomainTrends(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "dq-domain-trends", sourceId],
    queryFn: () => fetchDqDomainTrends(sourceId!),
    enabled: !!sourceId,
  });
}

export function useUnmappedCodesSummary(sourceId: number | null, releaseId: number | null) {
  return useQuery({
    queryKey: ["ares", "unmapped-summary", sourceId, releaseId],
    queryFn: () => fetchUnmappedCodesSummary(sourceId!, releaseId!),
    enabled: !!sourceId && !!releaseId,
  });
}

export function useUnmappedCodes(
  sourceId: number | null,
  releaseId: number | null,
  filters: { table?: string; field?: string; search?: string; page?: number; per_page?: number } = {},
) {
  return useQuery({
    queryKey: ["ares", "unmapped-codes", sourceId, releaseId, filters],
    queryFn: () => fetchUnmappedCodes(sourceId!, releaseId!, filters),
    enabled: !!sourceId && !!releaseId,
  });
}

export function useDomainContinuity(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "domain-continuity", sourceId],
    queryFn: () => fetchDomainContinuity(sourceId!),
    enabled: !!sourceId,
  });
}
```

- [ ] **Step 2: Create useAresHub.ts**

```typescript
// frontend/src/features/data-explorer/hooks/useAresHub.ts
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/apiClient";
import type { AresHubKpis } from "../types/ares";

function unwrap<T>(res: { data: { data: T } }): T {
  return res.data.data;
}

export function useAresHubKpis() {
  return useQuery({
    queryKey: ["ares", "hub", "kpis"],
    queryFn: async (): Promise<AresHubKpis> => {
      // Aggregate KPIs from multiple endpoints
      const [dqSummaryRes, annotationsRes] = await Promise.all([
        apiClient.get("/network/ares/dq-summary").catch(() => ({ data: { data: [] } })),
        apiClient.get("/network/ares/annotations").catch(() => ({ data: { data: [] } })),
      ]);

      const dqSummary = dqSummaryRes.data?.data ?? [];
      const annotations = annotationsRes.data?.data ?? [];

      const sourceCount = dqSummary.length;
      const passRates = dqSummary
        .map((s: { pass_rate: number }) => s.pass_rate)
        .filter((r: number) => r > 0);
      const avgDqScore =
        passRates.length > 0
          ? passRates.reduce((a: number, b: number) => a + b, 0) / passRates.length
          : null;

      return {
        source_count: sourceCount,
        avg_dq_score: avgDqScore,
        total_unmapped_codes: 0, // Populated when network unmapped endpoint available
        annotation_count: annotations.length,
        latest_releases: [],
        sources_needing_attention: dqSummary.filter(
          (s: { pass_rate: number }) => s.pass_rate < 80,
        ).length,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/data-explorer/hooks/useDqHistoryData.ts frontend/src/features/data-explorer/hooks/useAresHub.ts
git commit -m "feat(ares): add TanStack Query hooks for DQ history, unmapped codes, and hub KPIs"
```

---

## Task 8: DqTrendChart Component

**Files:**
- Create: `frontend/src/features/data-explorer/components/ares/dq-history/DqTrendChart.tsx`

- [ ] **Step 1: Implement DqTrendChart**

```typescript
// frontend/src/features/data-explorer/components/ares/dq-history/DqTrendChart.tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { DqTrendPoint } from "../../../types/ares";

interface DqTrendChartProps {
  data: DqTrendPoint[];
  onReleaseClick?: (releaseId: number) => void;
}

export default function DqTrendChart({ data, onReleaseClick }: DqTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-[#555]">
        No DQ history data available. Run DQD on at least two releases to see trends.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: d.release_name,
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          onClick={(e) => {
            if (e?.activePayload?.[0]?.payload && onReleaseClick) {
              onReleaseClick(e.activePayload[0].payload.release_id);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#888", fontSize: 11 }}
            axisLine={{ stroke: "#333" }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#888", fontSize: 11 }}
            axisLine={{ stroke: "#333" }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a22",
              border: "1px solid #333",
              borderRadius: "8px",
              color: "#ccc",
              fontSize: 12,
            }}
            formatter={(value: number) => [`${value.toFixed(1)}%`, "Pass Rate"]}
          />
          <ReferenceLine y={80} stroke="#C9A227" strokeDasharray="5 5" label="" />
          <Line
            type="monotone"
            dataKey="pass_rate"
            stroke="#2DD4BF"
            strokeWidth={2}
            dot={{ fill: "#2DD4BF", r: 5, cursor: "pointer" }}
            activeDot={{ r: 7, fill: "#2DD4BF" }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-[10px] text-[#555]">
        Click a release point to view delta details. Dashed line = 80% quality threshold.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/data-explorer/components/ares/dq-history/DqTrendChart.tsx
git commit -m "feat(ares): add DqTrendChart with interactive release points and quality threshold"
```

---

## Task 9: DqDeltaTable Component

**Files:**
- Create: `frontend/src/features/data-explorer/components/ares/dq-history/DqDeltaTable.tsx`

- [ ] **Step 1: Implement DqDeltaTable**

```typescript
// frontend/src/features/data-explorer/components/ares/dq-history/DqDeltaTable.tsx
import type { DqDelta } from "../../../types/ares";

interface DqDeltaTableProps {
  deltas: DqDelta[];
  releaseName: string;
}

const STATUS_CONFIG: Record<
  DqDelta["delta_status"],
  { label: string; bg: string; text: string }
> = {
  new: { label: "NEW", bg: "bg-[#9B1B30]/20", text: "text-[#e85d75]" },
  existing: { label: "EXISTING", bg: "bg-[#C9A227]/20", text: "text-[#C9A227]" },
  resolved: { label: "RESOLVED", bg: "bg-[#2DD4BF]/20", text: "text-[#2DD4BF]" },
  stable: { label: "STABLE", bg: "bg-[#333]/30", text: "text-[#888]" },
};

export default function DqDeltaTable({ deltas, releaseName }: DqDeltaTableProps) {
  if (deltas.length === 0) {
    return (
      <div className="py-8 text-center text-[#555]">
        No delta data available for this release.
      </div>
    );
  }

  const grouped = {
    new: deltas.filter((d) => d.delta_status === "new"),
    existing: deltas.filter((d) => d.delta_status === "existing"),
    resolved: deltas.filter((d) => d.delta_status === "resolved"),
    stable: deltas.filter((d) => d.delta_status === "stable"),
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Delta Report: {releaseName}</h3>
        <div className="flex gap-3 text-[11px]">
          <span className="text-[#e85d75]">{grouped.new.length} new</span>
          <span className="text-[#C9A227]">{grouped.existing.length} existing</span>
          <span className="text-[#2DD4BF]">{grouped.resolved.length} resolved</span>
          <span className="text-[#888]">{grouped.stable.length} stable</span>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-lg border border-[#252530]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[#1a1a22]">
            <tr className="border-b border-[#252530]">
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Status</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Check ID</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Current</th>
              <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Previous</th>
            </tr>
          </thead>
          <tbody>
            {deltas.map((delta) => {
              const config = STATUS_CONFIG[delta.delta_status];
              return (
                <tr key={delta.id} className="border-b border-[#1a1a22] hover:bg-[#151518]">
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${config.bg} ${config.text}`}>
                      {config.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[#ccc]">{delta.check_id}</td>
                  <td className="px-3 py-2">
                    <span className={delta.current_passed ? "text-[#2DD4BF]" : "text-[#e85d75]"}>
                      {delta.current_passed ? "PASS" : "FAIL"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {delta.previous_passed === null ? (
                      <span className="text-[#555]">N/A</span>
                    ) : (
                      <span className={delta.previous_passed ? "text-[#2DD4BF]" : "text-[#e85d75]"}>
                        {delta.previous_passed ? "PASS" : "FAIL"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/data-explorer/components/ares/dq-history/DqDeltaTable.tsx
git commit -m "feat(ares): add DqDeltaTable with color-coded NEW/RESOLVED/STABLE/EXISTING badges"
```

---

## Task 10: DqHistoryView Drill-In

**Files:**
- Create: `frontend/src/features/data-explorer/components/ares/dq-history/DqHistoryView.tsx`
- Modify: `frontend/src/features/data-explorer/pages/AresTab.tsx`

- [ ] **Step 1: Implement DqHistoryView**

```typescript
// frontend/src/features/data-explorer/components/ares/dq-history/DqHistoryView.tsx
import { useState } from "react";
import { useDqHistory, useDqDeltas } from "../../../hooks/useDqHistoryData";
import DqTrendChart from "./DqTrendChart";
import DqDeltaTable from "./DqDeltaTable";
import type { DqTrendPoint } from "../../../types/ares";

interface DqHistoryViewProps {
  sourceId: number | null;
  sources: Array<{ id: number; source_name: string }>;
  onSourceChange: (id: number) => void;
}

export default function DqHistoryView({ sourceId, sources, onSourceChange }: DqHistoryViewProps) {
  const [selectedReleaseId, setSelectedReleaseId] = useState<number | null>(null);
  const { data: trends, isLoading: trendsLoading } = useDqHistory(sourceId);
  const { data: deltas, isLoading: deltasLoading } = useDqDeltas(sourceId, selectedReleaseId);

  const selectedRelease = trends?.find((t: DqTrendPoint) => t.release_id === selectedReleaseId);

  return (
    <div className="p-4">
      {/* Source selector */}
      <div className="mb-4 flex items-center gap-4">
        <label className="text-sm text-[#888]">Source:</label>
        <select
          value={sourceId ?? ""}
          onChange={(e) => {
            onSourceChange(Number(e.target.value));
            setSelectedReleaseId(null);
          }}
          className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-sm text-white"
        >
          <option value="">Select source...</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.source_name}
            </option>
          ))}
        </select>
      </div>

      {!sourceId && (
        <p className="py-10 text-center text-[#555]">Select a source to view DQ history.</p>
      )}

      {sourceId && trendsLoading && <p className="text-[#555]">Loading DQ history...</p>}

      {sourceId && !trendsLoading && trends && (
        <>
          {/* Trend chart */}
          <div className="mb-6 rounded-lg border border-[#252530] bg-[#151518] p-4">
            <h3 className="mb-3 text-sm font-medium text-white">DQ Pass Rate Over Releases</h3>
            <DqTrendChart
              data={trends}
              onReleaseClick={(releaseId) => setSelectedReleaseId(releaseId)}
            />
          </div>

          {/* Delta table — shows when a release is clicked */}
          {selectedReleaseId && (
            <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
              {deltasLoading ? (
                <p className="text-[#555]">Loading deltas...</p>
              ) : (
                <DqDeltaTable
                  deltas={deltas ?? []}
                  releaseName={selectedRelease?.release_name ?? ""}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire DqHistoryView into AresTab**

Update `frontend/src/features/data-explorer/pages/AresTab.tsx`:

Add import:
```typescript
import DqHistoryView from "../components/ares/dq-history/DqHistoryView";
```

In the render section where `activeSection !== "hub"` is handled, add:
```typescript
{activeSection === "dq-history" && (
  <DqHistoryView
    sourceId={selectedSourceId}
    sources={sources}
    onSourceChange={setSelectedSourceId}
  />
)}
```

Also add source state management to AresTab if not already present:
```typescript
const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
```

- [ ] **Step 3: Verify the view renders**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: No TypeScript errors

Open browser -> Ares tab -> click DQ History card -> should show source selector and trend chart

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/data-explorer/components/ares/dq-history/DqHistoryView.tsx frontend/src/features/data-explorer/pages/AresTab.tsx
git commit -m "feat(ares): add DqHistoryView drill-in with interactive trend chart and delta table"
```

---

## Task 11: UnmappedCodesView Drill-In

**Files:**
- Create: `frontend/src/features/data-explorer/components/ares/unmapped-codes/UnmappedCodesView.tsx`
- Modify: `frontend/src/features/data-explorer/pages/AresTab.tsx`

- [ ] **Step 1: Implement UnmappedCodesView**

```typescript
// frontend/src/features/data-explorer/components/ares/unmapped-codes/UnmappedCodesView.tsx
import { useState } from "react";
import { useUnmappedCodes, useUnmappedCodesSummary } from "../../../hooks/useDqHistoryData";
import { useReleases } from "../../../hooks/useReleaseData";
import type { SourceRelease, UnmappedCode } from "../../../types/ares";

interface UnmappedCodesViewProps {
  sourceId: number | null;
  sources: Array<{ id: number; source_name: string }>;
  onSourceChange: (id: number) => void;
}

export default function UnmappedCodesView({ sourceId, sources, onSourceChange }: UnmappedCodesViewProps) {
  const [releaseId, setReleaseId] = useState<number | null>(null);
  const [tableFilter, setTableFilter] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [page, setPage] = useState(1);

  const { data: releases } = useReleases(sourceId);
  const { data: summary } = useUnmappedCodesSummary(sourceId, releaseId);
  const { data: codesData, isLoading } = useUnmappedCodes(sourceId, releaseId, {
    table: tableFilter || undefined,
    search: searchFilter || undefined,
    page,
    per_page: 20,
  });

  // Auto-select latest release
  const latestRelease = releases?.[0];
  const activeReleaseId = releaseId ?? latestRelease?.id ?? null;

  // Extract unique tables from summary for filter dropdown
  const availableTables = summary?.map((s) => s.cdm_table) ?? [];

  return (
    <div className="p-4">
      {/* Filters row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[#888]">Source:</label>
          <select
            value={sourceId ?? ""}
            onChange={(e) => {
              onSourceChange(Number(e.target.value));
              setReleaseId(null);
              setPage(1);
            }}
            className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-sm text-white"
          >
            <option value="">Select source...</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.source_name}</option>
            ))}
          </select>
        </div>

        {sourceId && releases && releases.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#888]">Release:</label>
            <select
              value={activeReleaseId ?? ""}
              onChange={(e) => {
                setReleaseId(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-sm text-white"
            >
              {releases.map((r: SourceRelease) => (
                <option key={r.id} value={r.id}>{r.release_name}</option>
              ))}
            </select>
          </div>
        )}

        {availableTables.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#888]">Table:</label>
            <select
              value={tableFilter}
              onChange={(e) => {
                setTableFilter(e.target.value);
                setPage(1);
              }}
              className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-sm text-white"
            >
              <option value="">All tables</option>
              {availableTables.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}

        <input
          type="text"
          placeholder="Search source codes..."
          value={searchFilter}
          onChange={(e) => {
            setSearchFilter(e.target.value);
            setPage(1);
          }}
          className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-sm text-white
                     placeholder-[#555] focus:border-[#2DD4BF] focus:outline-none"
        />
      </div>

      {/* Summary badges */}
      {summary && summary.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {summary.map((s) => (
            <button
              key={`${s.cdm_table}-${s.cdm_field}`}
              type="button"
              onClick={() => {
                setTableFilter(s.cdm_table);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                tableFilter === s.cdm_table
                  ? "border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]"
                  : "border-[#333] text-[#888] hover:border-[#555]"
              }`}
            >
              {s.cdm_table} ({s.code_count} codes, {Number(s.total_records).toLocaleString()} records)
            </button>
          ))}
        </div>
      )}

      {/* Data table */}
      {!sourceId && (
        <p className="py-10 text-center text-[#555]">Select a source to view unmapped codes.</p>
      )}

      {isLoading && <p className="text-[#555]">Loading unmapped codes...</p>}

      {codesData && codesData.data.length === 0 && (
        <p className="py-10 text-center text-[#555]">
          No unmapped source codes found. All codes are mapped to standard OMOP concepts.
        </p>
      )}

      {codesData && codesData.data.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border border-[#252530]">
            <table className="w-full text-sm">
              <thead className="bg-[#1a1a22]">
                <tr className="border-b border-[#252530]">
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Source Code</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Vocabulary</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">CDM Table</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">CDM Field</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium uppercase text-[#888]">Records</th>
                </tr>
              </thead>
              <tbody>
                {codesData.data.map((code: UnmappedCode) => (
                  <tr key={code.id} className="border-b border-[#1a1a22] hover:bg-[#151518]">
                    <td className="px-3 py-2 font-mono text-xs text-[#ccc]">{code.source_code}</td>
                    <td className="px-3 py-2 text-xs text-[#888]">{code.source_vocabulary_id}</td>
                    <td className="px-3 py-2 text-xs text-[#888]">{code.cdm_table}</td>
                    <td className="px-3 py-2 text-xs text-[#888]">{code.cdm_field}</td>
                    <td className="px-3 py-2 text-right text-xs text-[#ccc]">
                      {code.record_count.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-3 flex items-center justify-between text-xs text-[#888]">
            <span>
              Showing {(codesData.meta.page - 1) * codesData.meta.per_page + 1}–
              {Math.min(codesData.meta.page * codesData.meta.per_page, codesData.meta.total)} of{" "}
              {codesData.meta.total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-[#333] px-3 py-1 disabled:opacity-30"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(codesData.meta.last_page, p + 1))}
                disabled={page >= codesData.meta.last_page}
                className="rounded border border-[#333] px-3 py-1 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire UnmappedCodesView into AresTab**

Update `frontend/src/features/data-explorer/pages/AresTab.tsx`:

Add import:
```typescript
import UnmappedCodesView from "../components/ares/unmapped-codes/UnmappedCodesView";
```

Add to the drill-in render block:
```typescript
{activeSection === "unmapped-codes" && (
  <UnmappedCodesView
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
git add frontend/src/features/data-explorer/components/ares/unmapped-codes/UnmappedCodesView.tsx frontend/src/features/data-explorer/pages/AresTab.tsx
git commit -m "feat(ares): add UnmappedCodesView drill-in with filters, summary badges, and pagination"
```

---

## Task 12: Wire Hub Cards to Live Data

**Files:**
- Modify: `frontend/src/features/data-explorer/components/ares/AresHub.tsx`

- [ ] **Step 1: Update AresHub to use live KPI data**

Replace the placeholder KPIs in `frontend/src/features/data-explorer/components/ares/AresHub.tsx` with data from `useAresHubKpis`:

```typescript
// frontend/src/features/data-explorer/components/ares/AresHub.tsx
import type { AresSection } from "../../types/ares";
import { useAresHubKpis } from "../../hooks/useAresHub";
import AresHealthBanner from "./AresHealthBanner";
import HubCard from "./HubCard";

interface AresHubProps {
  onNavigate: (section: AresSection) => void;
}

export default function AresHub({ onNavigate }: AresHubProps) {
  const { data: kpis, isLoading } = useAresHubKpis();

  return (
    <div>
      <AresHealthBanner
        sourceCount={kpis?.source_count ?? 0}
        avgDqScore={kpis?.avg_dq_score ?? null}
        unmappedCodes={kpis?.total_unmapped_codes ?? 0}
        annotationCount={kpis?.annotation_count ?? 0}
      />

      {/* Row 1: Primary */}
      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <HubCard section="network-overview" title="Network Overview" accentColor="#2DD4BF" onClick={onNavigate}>
          <p className="text-2xl font-semibold text-white">{kpis?.source_count ?? "—"}</p>
          <p className="text-sm text-[#888]">
            {kpis?.sources_needing_attention
              ? `${kpis.sources_needing_attention} source${kpis.sources_needing_attention !== 1 ? "s" : ""} below 80% DQ`
              : "Source health, DQ scores, trend indicators"}
          </p>
        </HubCard>
        <HubCard section="concept-comparison" title="Concept Comparison" accentColor="#C9A227" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Compare concept prevalence across sources</p>
        </HubCard>
        <HubCard section="dq-history" title="DQ History" accentColor="#2DD4BF" onClick={onNavigate}>
          <p className="text-2xl font-semibold text-white">
            {kpis?.avg_dq_score !== null && kpis?.avg_dq_score !== undefined
              ? `${kpis.avg_dq_score.toFixed(1)}%`
              : "—"}
          </p>
          <p className="text-sm text-[#888]">Avg network DQ score over releases</p>
        </HubCard>
      </div>

      {/* Row 2: Secondary */}
      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <HubCard section="coverage" title="Coverage Matrix" accentColor="#9B1B30" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Domain x source availability</p>
        </HubCard>
        <HubCard section="feasibility" title="Feasibility" accentColor="#C9A227" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Can your network support a study?</p>
        </HubCard>
        <HubCard section="diversity" title="Diversity" accentColor="#2DD4BF" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Demographic parity across sources</p>
        </HubCard>
      </div>

      {/* Row 3: Tertiary */}
      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <HubCard section="releases" title="Releases" accentColor="#C9A227" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Version history per source</p>
        </HubCard>
        <HubCard section="unmapped-codes" title="Unmapped Codes" accentColor="#9B1B30" onClick={onNavigate}>
          <p className="text-2xl font-semibold text-white">
            {kpis?.total_unmapped_codes !== undefined
              ? kpis.total_unmapped_codes.toLocaleString()
              : "—"}
          </p>
          <p className="text-sm text-[#888]">Source codes without standard mappings</p>
        </HubCard>
        <HubCard section="annotations" title="Annotations" accentColor="#2DD4BF" onClick={onNavigate}>
          <p className="text-2xl font-semibold text-white">{kpis?.annotation_count ?? "—"}</p>
          <p className="text-sm text-[#888]">Chart notes across all sources</p>
        </HubCard>
      </div>

      {/* Row 4: Bottom */}
      <div className="grid grid-cols-1 gap-3">
        <HubCard section="cost" title="Cost Analysis" accentColor="#C9A227" onClick={onNavigate}>
          <p className="text-sm text-[#888]">Cost data by domain and over time</p>
        </HubCard>
      </div>

      {isLoading && (
        <p className="mt-2 text-center text-[10px] text-[#555]">Loading network health data...</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the hub renders with live data**

Open browser -> Ares tab -> hub should show live KPIs (or placeholder values if APIs not yet responding)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/data-explorer/components/ares/AresHub.tsx
git commit -m "feat(ares): wire hub cards to live network KPI data via useAresHubKpis hook"
```

---

## Task 13: Phase 2 Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full backend test suite**

Run: `cd backend && vendor/bin/pest tests/Unit/Services/Ares/ tests/Feature/Api/AresDqHistoryControllerTest.php tests/Feature/Api/AresControllerTest.php`
Expected: All tests PASS

- [ ] **Step 2: Run frontend TypeScript check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: No errors

- [ ] **Step 3: Verify DQ history flow end-to-end**

1. Open browser -> Ares tab -> DQ History card
2. Select a source with releases
3. Trend chart should show pass rate over time
4. Click a release point -> delta table should appear below
5. Navigate to Unmapped Codes -> select source -> codes should display

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "feat(ares): complete Phase 2 — DQ history, unmapped codes, domain continuity, live hub"
```

- [ ] **Step 5: Deploy**

Run: `./deploy.sh`
Verify: DQ History and Unmapped Codes drill-in views functional in production
