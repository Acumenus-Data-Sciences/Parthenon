# Ares v2 Phase B — Core Transformations Implementation Plan

**Date:** 2026-03-24
**Spec:** `docs/superpowers/specs/2026-03-24-ares-v2-design.md` (Section 6, Phase B)
**Depends on:** Ares v1 Parity (complete) + Phase A Quick Wins (complete)
**Scope:** ~25 medium-effort enhancements across all 10 Ares panels
**Effort:** ~5-7 days full implementation

---

## File Map

### New Backend Files

```
backend/database/migrations/
  YYYY_MM_DD_000001_create_dq_sla_targets_table.php
  YYYY_MM_DD_000002_create_feasibility_templates_table.php
  YYYY_MM_DD_000003_create_accepted_mappings_table.php
  YYYY_MM_DD_000004_create_unmapped_code_reviews_table.php
  YYYY_MM_DD_000005_add_parent_id_to_chart_annotations.php
  YYYY_MM_DD_000006_add_etl_metadata_to_source_releases.php
  YYYY_MM_DD_000007_add_source_type_to_sources.php
  YYYY_MM_DD_000008_add_patient_count_to_unmapped_source_codes.php

backend/app/Services/Ares/
  AutoAnnotationService.php        — Event-driven system annotation creation
  ReleaseDiffService.php           — Computes diff between consecutive releases

backend/app/Models/App/
  DqSlaTarget.php
  FeasibilityTemplate.php
  AcceptedMapping.php
  UnmappedCodeReview.php

backend/app/Listeners/
  CreateAutoAnnotation.php         — Listener for auto-annotation on events

backend/app/Http/Requests/Api/
  StoreDqSlaRequest.php
  MapUnmappedCodeRequest.php
  StoreUnmappedCodeReviewRequest.php
```

### Modified Backend Files

```
backend/app/Http/Controllers/Api/V1/AresController.php
  + dqHistoryHeatmap(), dqHistoryExport()
  + unmappedCodesPareto(), unmappedCodeSuggestions(), mapUnmappedCode()
  + unmappedCodesExport()
  + costDistribution(), costCareSetting()
  + releaseDiff()
  + annotationTimeline()

backend/app/Http/Controllers/Api/V1/NetworkAresController.php
  + alerts()
  + compareMulti(), compareFunnel()
  + dqOverlay()
  + coverageExtended()
  + feasibilityImpact(), feasibilityTemplates()
  + diversityBenchmarks(), diversityAgePyramid(), diversityDapCheck(), diversityPooled()
  + releasesTimeline(), releasesCalendar()
  + costCompare()

backend/app/Services/Ares/DqHistoryService.php
  + getCategoryHeatmap(), getCheckSparklines(), getNetworkDqOverlay()

backend/app/Services/Ares/NetworkComparisonService.php
  + compareMultiConcepts(), computeAttritionFunnel()

backend/app/Services/Ares/CoverageService.php
  + getExtendedMatrix() — adds temporal extent, expected vs actual

backend/app/Services/Ares/FeasibilityService.php
  + assessContinuous(), getCriteriaImpact()

backend/app/Services/Ares/DiversityService.php
  + getAgePyramid(), getDapGapAnalysis(), getPooledDemographics()

backend/app/Services/Ares/ReleaseService.php
  + (delegates to ReleaseDiffService)

backend/app/Services/Ares/UnmappedCodeService.php
  + getParetoData(), getVocabularyTreemap(), exportUsagi()

backend/app/Services/Ares/CostService.php
  + getDistribution(), getCareSettingBreakdown(), getNetworkCompare()

backend/app/Services/Ares/AnnotationService.php
  + timeline(), searchAnnotations()

backend/app/Models/App/ChartAnnotation.php
  + tag, parent_id to $fillable; parent() and replies() relationships

backend/app/Models/App/SourceRelease.php
  + etl_metadata to $fillable and casts

backend/app/Models/App/Source.php
  + source_type to $fillable

backend/app/Models/App/UnmappedSourceCode.php
  + patient_count to $fillable

backend/app/Providers/AppServiceProvider.php
  + Register CreateAutoAnnotation listeners

backend/routes/api.php
  + All new routes
```

### New Frontend Files

```
frontend/src/features/data-explorer/components/ares/
  network-overview/AlertBanner.tsx
  concept-comparison/AttritionFunnel.tsx
  concept-comparison/MultiConceptSelector.tsx
  dq-history/DqCategoryHeatmap.tsx
  dq-history/CheckSparklines.tsx
  coverage/TemporalCoverageBar.tsx
  feasibility/CriteriaImpactChart.tsx
  feasibility/ConsortDiagram.tsx
  feasibility/TemplateSelector.tsx
  diversity/AgePyramid.tsx
  diversity/DapGapMatrix.tsx
  diversity/BenchmarkOverlay.tsx
  releases/ReleaseDiffPanel.tsx
  releases/SwimLaneTimeline.tsx
  releases/ReleaseCalendar.tsx
  unmapped-codes/ParetoChart.tsx
  unmapped-codes/MappingProgressTracker.tsx
  unmapped-codes/VocabularyTreemap.tsx
  annotations/AnnotationTimeline.tsx
  annotations/CreateFromChartPopover.tsx
  cost/CostBoxPlot.tsx
  cost/CareSettingBreakdown.tsx
  cost/CostTypeFilter.tsx
```

### Modified Frontend Files

```
frontend/src/features/data-explorer/types/ares.ts
  + All new type interfaces

frontend/src/features/data-explorer/hooks/useNetworkData.ts
  + useAlerts(), useMultiConceptComparison(), useAttritionFunnel()
  + useDqOverlay(), useCoverageExtended()
  + useFeasibilityImpact(), useFeasibilityTemplates()
  + useDiversityBenchmarks(), useAgePyramid(), useDapCheck(), usePooledDemographics()
  + useReleasesTimeline(), useReleasesCalendar()
  + useNetworkCostCompare()

frontend/src/features/data-explorer/hooks/useDqHistoryData.ts
  + useCategoryHeatmap(), useCheckSparklines()

frontend/src/features/data-explorer/hooks/useReleaseData.ts
  + useReleaseDiff()

frontend/src/features/data-explorer/hooks/useCostData.ts
  + useCostDistribution(), useCareSettingBreakdown()

frontend/src/features/data-explorer/api/networkAresApi.ts
  + All new API functions

frontend/src/features/data-explorer/api/aresApi.ts
  + All new source-scoped API functions

frontend/src/features/data-explorer/components/ares/
  network-overview/NetworkOverviewView.tsx  — integrate AlertBanner
  concept-comparison/ConceptComparisonView.tsx — multi-concept + funnel toggle
  concept-comparison/ComparisonChart.tsx — grouped bars support
  dq-history/DqHistoryView.tsx — heatmap tab, overlay toggle, sparklines in delta table
  coverage/CoverageMatrixView.tsx — temporal bars, expected vs actual row
  feasibility/FeasibilityView.tsx — continuous scores, impact chart, CONSORT toggle
  feasibility/FeasibilityForm.tsx — template selector, observation time criterion
  diversity/DiversityView.tsx — benchmark overlay, pyramid tab, DAP check, pooled
  releases/ReleasesView.tsx — diff panel, edit mode, swimlane/calendar toggles
  unmapped-codes/UnmappedCodesView.tsx — pareto, progress, treemap, export, release diff
  annotations/AnnotationsView.tsx — timeline view, tags, search, create-from-chart
  cost/CostView.tsx — box plots, cost type filter, care setting, outlier detection
```

---

## Task 1: Network Overview — Auto-Generated Alerts

**Panel 1, Enhancement #7.** Monte Carlo-style anomaly detection banner at top of Network Overview.

### Files

| Layer | File | Action |
|-------|------|--------|
| Migration | `create_dq_sla_targets_table.php` | Create |
| Service | `backend/app/Services/Ares/AutoAnnotationService.php` | Create |
| Listener | `backend/app/Listeners/CreateAutoAnnotation.php` | Create |
| Controller | `backend/app/Http/Controllers/Api/V1/NetworkAresController.php` | Modify |
| Service | `backend/app/Services/Ares/DqHistoryService.php` | Modify |
| Provider | `backend/app/Providers/AppServiceProvider.php` | Modify |
| Routes | `backend/routes/api.php` | Modify |
| Frontend | `AlertBanner.tsx` | Create |
| Frontend | `NetworkOverviewView.tsx` | Modify |
| Frontend | `useNetworkData.ts` | Modify |
| Frontend | `networkAresApi.ts` | Modify |
| Types | `ares.ts` | Modify |

### Steps

- [ ] Create migration for `app.dq_sla_targets` (source_id, category, min_pass_rate, created_at, updated_at)
- [ ] Create `DqSlaTarget` model with `$fillable = ['source_id', 'category', 'min_pass_rate']`
- [ ] Create `AutoAnnotationService` with alert computation logic
- [ ] Create `CreateAutoAnnotation` listener responding to `ReleaseCreated`, `DqdRunCompleted`
- [ ] Register listeners in `AppServiceProvider` alongside existing Ares listeners
- [ ] Add `getAlerts()` method to `DqHistoryService` — computes DQ delta alerts, freshness alerts, unmapped code spike alerts
- [ ] Add `alerts()` controller method to `NetworkAresController`
- [ ] Add route `GET /network/ares/alerts` with `permission:analyses.view`
- [ ] Add `AresAlert` TypeScript interface to `ares.ts`
- [ ] Add `fetchAlerts()` to `networkAresApi.ts`
- [ ] Add `useAlerts()` hook to `useNetworkData.ts`
- [ ] Create `AlertBanner.tsx` component — amber/red severity banners
- [ ] Integrate `AlertBanner` at top of `NetworkOverviewView.tsx`
- [ ] Write backend test for alert computation

### Code: AutoAnnotationService

```php
<?php

declare(strict_types=1);

namespace App\Services\Ares;

use App\Models\App\ChartAnnotation;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\App\UnmappedSourceCode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AutoAnnotationService
{
    private const DQ_DROP_THRESHOLD = 5.0; // percent
    private const UNMAPPED_SPIKE_THRESHOLD = 50; // new codes
    private const FRESHNESS_WARNING_DAYS = 14;
    private const FRESHNESS_CRITICAL_DAYS = 30;

    /**
     * Generate all active alerts across the network.
     *
     * @return array<int, array{severity: string, source_id: int, source_name: string, type: string, message: string, value: float|int}>
     */
    public function getAlerts(): array
    {
        $sources = Source::whereHas('daimons')->get();
        $alerts = [];

        foreach ($sources as $source) {
            $alerts = [...$alerts, ...$this->getDqAlerts($source)];
            $alerts = [...$alerts, ...$this->getFreshnessAlerts($source)];
            $alerts = [...$alerts, ...$this->getUnmappedAlerts($source)];
        }

        // Sort by severity: critical first, then warning
        usort($alerts, fn (array $a, array $b) => ($a['severity'] === 'critical' ? 0 : 1) <=> ($b['severity'] === 'critical' ? 0 : 1));

        return $alerts;
    }

    /**
     * Create a system annotation automatically (called from event listeners).
     */
    public function createSystemAnnotation(
        int $sourceId,
        string $chartType,
        string $xValue,
        string $text,
        string $tag = 'system',
    ): ChartAnnotation {
        return ChartAnnotation::create([
            'source_id' => $sourceId,
            'chart_type' => $chartType,
            'chart_context' => (object) [],
            'x_value' => $xValue,
            'annotation_text' => $text,
            'created_by' => 1, // System user (admin)
            'tag' => $tag,
        ]);
    }

    /**
     * @return array<int, array{severity: string, source_id: int, source_name: string, type: string, message: string, value: float}>
     */
    private function getDqAlerts(Source $source): array
    {
        $alerts = [];
        $releases = SourceRelease::where('source_id', $source->id)
            ->orderByDesc('created_at')
            ->limit(2)
            ->get();

        if ($releases->count() < 2) {
            return [];
        }

        $current = $releases->first();
        $previous = $releases->last();

        $currentRate = $this->getPassRate($source->id, $current->id);
        $previousRate = $this->getPassRate($source->id, $previous->id);

        $delta = $previousRate - $currentRate;

        if ($delta > self::DQ_DROP_THRESHOLD) {
            $alerts[] = [
                'severity' => $delta > 10 ? 'critical' : 'warning',
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'type' => 'dq_drop',
                'message' => "{$source->source_name} DQ dropped {$delta}% ({$previousRate}% -> {$currentRate}%)",
                'value' => round($delta, 1),
            ];
        }

        return $alerts;
    }

    /**
     * @return array<int, array{severity: string, source_id: int, source_name: string, type: string, message: string, value: int}>
     */
    private function getFreshnessAlerts(Source $source): array
    {
        $latest = SourceRelease::where('source_id', $source->id)
            ->orderByDesc('created_at')
            ->first();

        if (! $latest) {
            return [];
        }

        $daysSince = (int) $latest->created_at->diffInDays(now());

        if ($daysSince >= self::FRESHNESS_CRITICAL_DAYS) {
            return [[
                'severity' => 'critical',
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'type' => 'stale_data',
                'message' => "{$source->source_name} has not been refreshed in {$daysSince} days",
                'value' => $daysSince,
            ]];
        }

        if ($daysSince >= self::FRESHNESS_WARNING_DAYS) {
            return [[
                'severity' => 'warning',
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'type' => 'stale_data',
                'message' => "{$source->source_name} last refreshed {$daysSince} days ago",
                'value' => $daysSince,
            ]];
        }

        return [];
    }

    /**
     * @return array<int, array{severity: string, source_id: int, source_name: string, type: string, message: string, value: int}>
     */
    private function getUnmappedAlerts(Source $source): array
    {
        $releases = SourceRelease::where('source_id', $source->id)
            ->orderByDesc('created_at')
            ->limit(2)
            ->get();

        if ($releases->count() < 2) {
            return [];
        }

        $currentCount = UnmappedSourceCode::where('source_id', $source->id)
            ->where('release_id', $releases->first()->id)
            ->count();

        $previousCount = UnmappedSourceCode::where('source_id', $source->id)
            ->where('release_id', $releases->last()->id)
            ->count();

        $newCodes = $currentCount - $previousCount;

        if ($newCodes >= self::UNMAPPED_SPIKE_THRESHOLD) {
            return [[
                'severity' => $newCodes > 200 ? 'critical' : 'warning',
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'type' => 'unmapped_spike',
                'message' => "{$source->source_name} has {$newCodes} new unmapped codes",
                'value' => $newCodes,
            ]];
        }

        return [];
    }

    private function getPassRate(int $sourceId, int $releaseId): float
    {
        $stats = DB::table('dqd_results')
            ->where('source_id', $sourceId)
            ->where('release_id', $releaseId)
            ->selectRaw('COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
            ->first();

        $total = (int) ($stats->total ?? 0);
        $passed = (int) ($stats->passed_count ?? 0);

        return $total > 0 ? round(($passed / $total) * 100, 1) : 0.0;
    }
}
```

### Code: CreateAutoAnnotation Listener

```php
<?php

declare(strict_types=1);

namespace App\Listeners;

use App\Events\DqdRunCompleted;
use App\Events\ReleaseCreated;
use App\Services\Ares\AutoAnnotationService;
use Illuminate\Support\Facades\Log;

class CreateAutoAnnotation
{
    public function __construct(
        private readonly AutoAnnotationService $autoAnnotationService,
    ) {}

    /**
     * Handle both ReleaseCreated and DqdRunCompleted events.
     */
    public function handle(ReleaseCreated|DqdRunCompleted $event): void
    {
        try {
            if ($event instanceof ReleaseCreated) {
                $this->handleRelease($event);
            }

            if ($event instanceof DqdRunCompleted) {
                $this->handleDqd($event);
            }
        } catch (\Throwable $e) {
            Log::warning("CreateAutoAnnotation: failed — {$e->getMessage()}");
        }
    }

    private function handleRelease(ReleaseCreated $event): void
    {
        $release = $event->release;

        $this->autoAnnotationService->createSystemAnnotation(
            sourceId: $release->source_id,
            chartType: 'dq_history',
            xValue: $release->created_at->toDateString(),
            text: "Release created: {$release->release_name}",
            tag: 'data_event',
        );
    }

    private function handleDqd(DqdRunCompleted $event): void
    {
        $release = $event->release;

        if (! $release) {
            return;
        }

        $this->autoAnnotationService->createSystemAnnotation(
            sourceId: $release->source_id,
            chartType: 'dq_history',
            xValue: $release->created_at->toDateString(),
            text: "DQD run completed for release {$release->release_name}",
            tag: 'system',
        );
    }
}
```

### Code: AlertBanner.tsx

```tsx
import { AlertTriangle, XCircle, Info } from "lucide-react";

interface AresAlert {
  severity: "critical" | "warning" | "info";
  source_id: number;
  source_name: string;
  type: string;
  message: string;
  value: number;
}

interface AlertBannerProps {
  alerts: AresAlert[];
}

const SEVERITY_STYLES = {
  critical: {
    border: "border-[#9B1B30]",
    bg: "bg-[#9B1B30]/10",
    icon: XCircle,
    iconColor: "text-[#e85d75]",
  },
  warning: {
    border: "border-[#C9A227]",
    bg: "bg-[#C9A227]/10",
    icon: AlertTriangle,
    iconColor: "text-[#C9A227]",
  },
  info: {
    border: "border-[#2DD4BF]",
    bg: "bg-[#2DD4BF]/10",
    icon: Info,
    iconColor: "text-[#2DD4BF]",
  },
};

export default function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {alerts.slice(0, 5).map((alert, i) => {
        const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info;
        const Icon = style.icon;
        return (
          <div
            key={`${alert.type}-${alert.source_id}-${i}`}
            className={`flex items-center gap-3 rounded-lg border ${style.border} ${style.bg} px-4 py-2`}
          >
            <Icon size={16} className={style.iconColor} />
            <span className="text-sm text-[#ccc]">{alert.message}</span>
          </div>
        );
      })}
    </div>
  );
}
```

### Test Commands

```bash
cd backend && vendor/bin/pest --filter=AutoAnnotation
cd frontend && npx vitest run --filter=AlertBanner
```

### Commit

```
feat(ares): add auto-generated network alerts and system annotations

Panel 1 Phase B — Monte Carlo-style anomaly detection.
AlertBanner component, AutoAnnotationService, CreateAutoAnnotation listener.
Surfaces DQ drops, stale data, and unmapped code spikes.
```

---

## Task 2: Concept Comparison — Multi-Concept + Attrition Funnel

**Panel 2, Enhancements #1 and #2.** Chip-based multi-concept selector with grouped bars and attrition funnel toggle.

### Files

| Layer | File | Action |
|-------|------|--------|
| Controller | `NetworkAresController.php` | Modify |
| Service | `NetworkComparisonService.php` | Modify |
| Routes | `api.php` | Modify |
| Frontend | `MultiConceptSelector.tsx` | Create |
| Frontend | `AttritionFunnel.tsx` | Create |
| Frontend | `ComparisonChart.tsx` | Modify |
| Frontend | `ConceptComparisonView.tsx` | Modify |
| Hooks | `useNetworkData.ts` | Modify |
| API | `networkAresApi.ts` | Modify |
| Types | `ares.ts` | Modify |

### Steps

- [ ] Add `compareMultiConcepts(array $conceptIds)` to `NetworkComparisonService` — returns grouped data: `{concepts: [{concept_id, concept_name, sources: [{source_id, source_name, count, rate_per_1000}]}]}`
- [ ] Add `computeAttritionFunnel(array $conceptIds)` to `NetworkComparisonService` — for each source, sequentially intersect persons with each concept, return shrinking counts
- [ ] Add `compareMulti()` and `compareFunnel()` methods to `NetworkAresController`
- [ ] Add routes:
  - `GET /network/ares/compare/multi?concept_ids=1,2,3` with `permission:analyses.view`
  - `GET /network/ares/compare/funnel?concept_ids=1,2,3` with `permission:analyses.view`
- [ ] Add `MultiConceptComparison`, `AttritionFunnelData` TypeScript interfaces
- [ ] Add API functions `fetchMultiComparison()`, `fetchAttritionFunnel()`
- [ ] Add hooks `useMultiConceptComparison()`, `useAttritionFunnel()`
- [ ] Create `MultiConceptSelector.tsx` — chip-based input with autocomplete, max 5 concepts
- [ ] Modify `ComparisonChart.tsx` — support grouped bars (one color per concept using `CONCEPT_COLORS` array)
- [ ] Create `AttritionFunnel.tsx` — horizontal shrinking bars showing population reduction per criterion
- [ ] Modify `ConceptComparisonView.tsx` — integrate multi-selector and funnel view toggle
- [ ] Write backend tests for multi-concept comparison and funnel

### Code: AttritionFunnel.tsx

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface FunnelStep {
  concept_name: string;
  remaining_patients: number;
  percentage: number;
}

interface AttritionFunnelProps {
  data: Array<{
    source_id: number;
    source_name: string;
    steps: FunnelStep[];
  }>;
}

const FUNNEL_COLORS = ["#2DD4BF", "#C9A227", "#e85d75", "#7c8aed", "#59c990"];

export default function AttritionFunnel({ data }: AttritionFunnelProps) {
  if (data.length === 0) return null;

  return (
    <div className="space-y-4">
      {data.map((source) => (
        <div key={source.source_id} className="rounded-lg border border-[#252530] bg-[#151518] p-4">
          <h4 className="mb-3 text-sm font-medium text-white">{source.source_name}</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={source.steps}
                layout="vertical"
                margin={{ top: 5, right: 40, bottom: 5, left: 120 }}
              >
                <XAxis type="number" tick={{ fill: "#888", fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="concept_name"
                  tick={{ fill: "#888", fontSize: 11 }}
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a22",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    color: "#ccc",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [
                    `${value.toLocaleString()} patients`,
                    "Remaining",
                  ]}
                />
                <Bar dataKey="remaining_patients" radius={[0, 4, 4, 0]}>
                  {source.steps.map((_entry, index) => (
                    <Cell key={index} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Code: NetworkComparisonService additions

```php
/**
 * Compute attrition funnel across sources for stacked concept criteria.
 *
 * @param  array<int>  $conceptIds
 * @return array<int, array{source_id: int, source_name: string, steps: array<int, array{concept_name: string, remaining_patients: int, percentage: float}>}>
 */
public function computeAttritionFunnel(array $conceptIds): array
{
    $sources = Source::whereHas('daimons')->get();
    $conceptNames = $this->resolveConceptNames($conceptIds);
    $results = [];

    foreach ($sources as $source) {
        try {
            $steps = $this->computeFunnelForSource($source, $conceptIds, $conceptNames);
            $results[] = [
                'source_id' => $source->id,
                'source_name' => $source->source_name,
                'steps' => $steps,
            ];
        } catch (\Throwable $e) {
            Log::warning("AttritionFunnel: failed for {$source->source_name}: {$e->getMessage()}");
        }
    }

    return $results;
}

/**
 * @param  array<int>  $conceptIds
 * @param  array<int, string>  $conceptNames
 * @return array<int, array{concept_name: string, remaining_patients: int, percentage: float}>
 */
private function computeFunnelForSource(Source $source, array $conceptIds, array $conceptNames): array
{
    $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
    $schema = $daimon?->table_qualifier ?? 'results';

    $connection = 'results';
    if (! empty($source->db_host)) {
        $connection = $this->connectionFactory->connectionForSchema($source, $schema);
    } else {
        DB::connection('results')->statement("SET search_path TO \"{$schema}\", public");
    }

    // Get total person count as baseline
    $personResult = AchillesResult::on($connection)->where('analysis_id', 1)->first();
    $totalPersons = (int) ($personResult?->count_value ?? 0);

    $steps = [];
    $remaining = $totalPersons;

    // "All patients" baseline
    $steps[] = [
        'concept_name' => 'All patients',
        'remaining_patients' => $totalPersons,
        'percentage' => 100.0,
    ];

    foreach ($conceptIds as $conceptId) {
        $analysisIds = array_values(self::DOMAIN_PREVALENCE_MAP);
        $result = AchillesResult::on($connection)
            ->whereIn('analysis_id', $analysisIds)
            ->where('stratum_1', (string) $conceptId)
            ->selectRaw('SUM(CAST(count_value AS bigint)) as total_count')
            ->first();

        $conceptCount = (int) ($result?->total_count ?? 0);
        // Simulate attrition — remaining is min of current remaining and concept count
        $remaining = min($remaining, $conceptCount);

        $steps[] = [
            'concept_name' => $conceptNames[$conceptId] ?? "Concept {$conceptId}",
            'remaining_patients' => $remaining,
            'percentage' => $totalPersons > 0 ? round(($remaining / $totalPersons) * 100, 1) : 0.0,
        ];
    }

    return $steps;
}

/**
 * @param  array<int>  $conceptIds
 * @return array<int, string>
 */
private function resolveConceptNames(array $conceptIds): array
{
    return DB::connection('omop')
        ->table('concept')
        ->whereIn('concept_id', $conceptIds)
        ->pluck('concept_name', 'concept_id')
        ->toArray();
}
```

### Test Commands

```bash
cd backend && vendor/bin/pest --filter=NetworkComparison
cd frontend && npx vitest run --filter=AttritionFunnel
```

### Commit

```
feat(ares): add multi-concept comparison and attrition funnel

Panel 2 Phase B — chip-based multi-concept selector with grouped bars,
attrition funnel showing population shrinkage per criterion.
```

---

## Task 3: DQ History — Heatmap, Cross-Source Overlay, Check Sparklines

**Panel 3, Enhancements #1, #2, #3.** Category x Release heatmap, cross-source DQ overlay, and check-level history sparklines.

### Files

| Layer | File | Action |
|-------|------|--------|
| Service | `DqHistoryService.php` | Modify |
| Controller | `AresController.php` | Modify |
| Controller | `NetworkAresController.php` | Modify |
| Routes | `api.php` | Modify |
| Frontend | `DqCategoryHeatmap.tsx` | Create |
| Frontend | `CheckSparklines.tsx` | Create |
| Frontend | `DqHistoryView.tsx` | Modify |
| Frontend | `DqTrendChart.tsx` | Modify |
| Hooks | `useDqHistoryData.ts` | Modify |
| Hooks | `useNetworkData.ts` | Modify |

### Steps

- [ ] Add `getCategoryHeatmap(Source $source)` to `DqHistoryService` — returns `{releases: [{id, name, date}], categories: string[], cells: [{release_id, category, pass_rate}]}`
- [ ] Add `getCheckSparklines(int $releaseId)` to `DqHistoryService` — extends delta data with per-check historical pass/fail across last 6 releases
- [ ] Add `getNetworkDqOverlay()` to `DqHistoryService` — all sources' DQ trends on same timeline
- [ ] Add controller methods: `dqHistoryHeatmap()` in `AresController`, `dqOverlay()` in `NetworkAresController`
- [ ] Add routes:
  - `GET /sources/{source}/ares/dq-history/heatmap` with `permission:analyses.view`
  - `GET /network/ares/dq-overlay` with `permission:analyses.view`
- [ ] Add `DqHeatmapData`, `DqCheckSparkline` TypeScript interfaces
- [ ] Add API functions and hooks
- [ ] Create `DqCategoryHeatmap.tsx` — custom SVG/CSS grid, cells colored by pass rate, click to drill
- [ ] Create `CheckSparklines.tsx` — mini 6-point sparklines in delta table rows
- [ ] Modify `DqHistoryView.tsx` — add heatmap tab and overlay toggle
- [ ] Modify `DqTrendChart.tsx` — support multiple overlaid source lines
- [ ] Write tests

### Code: DqHistoryService#getCategoryHeatmap

```php
/**
 * Get category x release heatmap data for a source.
 *
 * @return array{releases: array<int, array{id: int, name: string, date: string}>, categories: string[], cells: array<int, array{release_id: int, category: string, pass_rate: float}>}
 */
public function getCategoryHeatmap(Source $source): array
{
    $releases = SourceRelease::where('source_id', $source->id)
        ->orderBy('created_at')
        ->get();

    $releaseList = $releases->map(fn (SourceRelease $r) => [
        'id' => $r->id,
        'name' => $r->release_name,
        'date' => $r->created_at->toDateString(),
    ])->toArray();

    $allCategories = [];
    $cells = [];

    foreach ($releases as $release) {
        $categoryStats = DqdResult::where('source_id', $source->id)
            ->where('release_id', $release->id)
            ->whereNotNull('category')
            ->selectRaw('category, COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
            ->groupBy('category')
            ->get();

        foreach ($categoryStats as $stat) {
            $allCategories[$stat->category] = true;
            $total = (int) $stat->total;
            $cells[] = [
                'release_id' => $release->id,
                'category' => $stat->category,
                'pass_rate' => $total > 0 ? round(((int) $stat->passed_count / $total) * 100, 1) : 0.0,
            ];
        }
    }

    return [
        'releases' => array_values($releaseList),
        'categories' => array_keys($allCategories),
        'cells' => $cells,
    ];
}

/**
 * Get DQ trend data for all sources overlaid on same timeline.
 *
 * @return array<int, array{source_id: int, source_name: string, trends: array<int, array{release_name: string, created_at: string, pass_rate: float}>}>
 */
public function getNetworkDqOverlay(): array
{
    $sources = Source::whereHas('daimons')->get();
    $result = [];

    foreach ($sources as $source) {
        $trends = $this->getTrends($source);
        $result[] = [
            'source_id' => $source->id,
            'source_name' => $source->source_name,
            'trends' => array_map(fn (array $t) => [
                'release_name' => $t['release_name'],
                'created_at' => $t['created_at'],
                'pass_rate' => $t['pass_rate'],
            ], $trends),
        ];
    }

    return $result;
}
```

### Code: DqCategoryHeatmap.tsx

```tsx
interface HeatmapCell {
  release_id: number;
  category: string;
  pass_rate: number;
}

interface DqCategoryHeatmapProps {
  releases: Array<{ id: number; name: string; date: string }>;
  categories: string[];
  cells: HeatmapCell[];
  onCellClick?: (releaseId: number, category: string) => void;
}

function getCellColor(rate: number): string {
  if (rate >= 95) return "bg-[#2DD4BF]/40";
  if (rate >= 90) return "bg-[#2DD4BF]/20";
  if (rate >= 80) return "bg-[#C9A227]/30";
  if (rate >= 70) return "bg-[#C9A227]/15";
  return "bg-[#9B1B30]/30";
}

export default function DqCategoryHeatmap({
  releases,
  categories,
  cells,
  onCellClick,
}: DqCategoryHeatmapProps) {
  const cellMap = new Map<string, number>();
  for (const cell of cells) {
    cellMap.set(`${cell.release_id}-${cell.category}`, cell.pass_rate);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-[#151518] px-3 py-2 text-left text-[11px] text-[#888]">
              Category
            </th>
            {releases.map((r) => (
              <th key={r.id} className="px-2 py-2 text-center text-[10px] text-[#666]">
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat} className="border-t border-[#1a1a22]">
              <td className="sticky left-0 bg-[#151518] px-3 py-1.5 text-[#ccc]">{cat}</td>
              {releases.map((r) => {
                const rate = cellMap.get(`${r.id}-${cat}`);
                return (
                  <td key={r.id} className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => onCellClick?.(r.id, cat)}
                      className={`block w-full rounded px-2 py-1.5 text-center text-[10px] font-mono transition-colors hover:ring-1 hover:ring-[#C9A227]/50 ${
                        rate !== undefined ? getCellColor(rate) : "bg-[#1a1a22]"
                      } text-[#ccc]`}
                    >
                      {rate !== undefined ? `${rate}%` : "--"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Commit

```
feat(ares): add DQ category heatmap, cross-source overlay, check sparklines

Panel 3 Phase B — heatmap grid for category x release drill-down,
multi-source DQ overlay on same timeline, per-check sparklines in delta table.
```

---

## Task 4: Coverage Matrix — Temporal Coverage + Expected vs Actual

**Panel 4, Enhancements #1 and #5.** Temporal coverage bars in cells and expected vs actual completeness.

### Files

| Layer | File | Action |
|-------|------|--------|
| Migration | `add_source_type_to_sources.php` | Create |
| Service | `CoverageService.php` | Modify |
| Controller | `NetworkAresController.php` | Modify |
| Model | `Source.php` | Modify |
| Routes | `api.php` | Modify |
| Frontend | `TemporalCoverageBar.tsx` | Create |
| Frontend | `CoverageMatrixView.tsx` | Modify |
| Types | `ares.ts` | Modify |

### Steps

- [ ] Create migration adding `source_type` varchar(20) nullable to `sources`
- [ ] Add `source_type` to `Source::$fillable`
- [ ] Add `getExtendedMatrix()` to `CoverageService` — each cell now returns `{record_count, density_per_person, has_data, earliest_date, latest_date}`
- [ ] Add expected completeness benchmarks per source type (claims/ehr/registry) as a config constant in `CoverageService`
- [ ] Add `coverageExtended()` method to `NetworkAresController`
- [ ] Add route `GET /network/ares/coverage/extended` with `permission:analyses.view`
- [ ] Add `ExtendedCoverageCell` TypeScript interface with temporal extent fields
- [ ] Create `TemporalCoverageBar.tsx` — mini horizontal date range bar with start/end labels
- [ ] Modify `CoverageMatrixView.tsx` — show temporal bars in cells, add "Expected vs Actual" comparison row
- [ ] Write tests

### Code: CoverageService#getExtendedMatrix (key addition)

```php
/**
 * Expected domain coverage by source type.
 * true = expected to have data, false = typically missing.
 *
 * @var array<string, array<string, bool>>
 */
private const EXPECTED_COVERAGE = [
    'claims' => [
        'person' => true, 'condition_occurrence' => true, 'drug_exposure' => true,
        'procedure_occurrence' => true, 'measurement' => false, 'observation' => false,
        'visit_occurrence' => true, 'death' => true,
    ],
    'ehr' => [
        'person' => true, 'condition_occurrence' => true, 'drug_exposure' => true,
        'procedure_occurrence' => true, 'measurement' => true, 'observation' => true,
        'visit_occurrence' => true, 'death' => true,
    ],
    'registry' => [
        'person' => true, 'condition_occurrence' => true, 'drug_exposure' => false,
        'procedure_occurrence' => false, 'measurement' => true, 'observation' => true,
        'visit_occurrence' => false, 'death' => true,
    ],
];

/**
 * Extended matrix with temporal extent per cell.
 *
 * @return array{sources: array, domains: string[], matrix: array, expected: array<string, array<string, bool>>}
 */
public function getExtendedMatrix(): array
{
    $base = $this->getMatrix();

    // Query observation_period for temporal extent per source
    $sources = Source::whereHas('daimons')->get();

    foreach ($sources as $index => $source) {
        $temporal = $this->getTemporalExtent($source);

        foreach ($base['domains'] as $domain) {
            $base['matrix'][$index][$domain]['earliest_date'] = $temporal['earliest'] ?? null;
            $base['matrix'][$index][$domain]['latest_date'] = $temporal['latest'] ?? null;
        }
    }

    $base['expected'] = self::EXPECTED_COVERAGE;

    return $base;
}
```

### Commit

```
feat(ares): add temporal coverage bars and expected vs actual completeness

Panel 4 Phase B — date range bars in coverage matrix cells showing
earliest-to-latest observation, expected completeness benchmarks by source type.
```

---

## Task 5: Feasibility — Impact Analysis, Drill-Down, CONSORT, Templates

**Panel 5, Enhancements #2, #3, #4, #5, #6.** Criteria waterfall, failure drill-down, median observation time, CONSORT diagram, study type templates.

### Files

| Layer | File | Action |
|-------|------|--------|
| Migration | `create_feasibility_templates_table.php` | Create |
| Model | `FeasibilityTemplate.php` | Create |
| Service | `FeasibilityService.php` | Modify |
| Controller | `NetworkAresController.php` | Modify |
| Routes | `api.php` | Modify |
| Frontend | `CriteriaImpactChart.tsx` | Create |
| Frontend | `ConsortDiagram.tsx` | Create |
| Frontend | `TemplateSelector.tsx` | Create |
| Frontend | `FeasibilityView.tsx` | Modify |
| Frontend | `FeasibilityForm.tsx` | Modify |
| Types | `ares.ts` | Modify |

### Steps

- [ ] Create migration for `app.feasibility_templates` (id, name, study_type, criteria jsonb, created_at, updated_at)
- [ ] Create `FeasibilityTemplate` model with `$fillable = ['name', 'study_type', 'criteria']`
- [ ] Modify `FeasibilityService::assess()` to return continuous 0-100 scores per criterion instead of boolean
- [ ] Add `getCriteriaImpact(int $assessmentId)` — run assessment removing one criterion at a time, return impact ranking (waterfall data)
- [ ] Add `median_observation_months` support to criteria and evaluation logic
- [ ] Add `feasibilityImpact()` and `feasibilityTemplates()` methods to `NetworkAresController`
- [ ] Add routes:
  - `GET /network/ares/feasibility/{id}/impact` with `permission:analyses.view`
  - `GET /network/ares/feasibility/templates` with `permission:analyses.view`
  - `POST /network/ares/feasibility/templates` with `permission:analyses.create`
- [ ] Seed default templates (retrospective cohort, case-control, claims CER, oncology basket, pharmacovigilance)
- [ ] Add TypeScript interfaces: `FeasibilityImpact`, `FeasibilityTemplateType`, `ConsortNode`
- [ ] Create `CriteriaImpactChart.tsx` — waterfall bars showing which criterion eliminates most sources
- [ ] Create `ConsortDiagram.tsx` — CONSORT-style flow from total sources through each criterion gate
- [ ] Create `TemplateSelector.tsx` — dropdown of study type templates that pre-fill criteria
- [ ] Modify `FeasibilityView.tsx` — show continuous scores (0-100) with color gradients, add impact/CONSORT toggle
- [ ] Modify `FeasibilityForm.tsx` — add template dropdown, median observation time input
- [ ] Write tests

### Code: FeasibilityService continuous scoring (key change)

```php
/**
 * Compute a continuous 0-100 score for each criterion.
 *
 * @return array{domain_score: float, concept_score: float, visit_score: float, date_score: float, patient_score: float, composite_score: float, details: array}
 */
private function evaluateSourceContinuous(Source $source, array $criteria): array
{
    // ... (connection setup same as existing evaluateSource) ...

    // Domain score: (found / required) * 100
    $requiredDomains = $criteria['required_domains'] ?? [];
    $foundDomains = 0;
    foreach ($requiredDomains as $domain) {
        $analysisId = self::DOMAIN_COUNT_MAP[$domain] ?? null;
        if ($analysisId) {
            $count = AchillesResult::on($connection)->where('analysis_id', $analysisId)->sum('count_value');
            if ((int) $count > 0) {
                $foundDomains++;
            }
        }
    }
    $domainScore = count($requiredDomains) > 0
        ? round(($foundDomains / count($requiredDomains)) * 100, 1)
        : 100.0;

    // Concept score: (found / required) * 100
    $requiredConcepts = $criteria['required_concepts'] ?? [];
    $foundConcepts = 0;
    foreach ($requiredConcepts as $conceptId) {
        if (AchillesResult::on($connection)->where('stratum_1', (string) $conceptId)->exists()) {
            $foundConcepts++;
        }
    }
    $conceptScore = count($requiredConcepts) > 0
        ? round(($foundConcepts / count($requiredConcepts)) * 100, 1)
        : 100.0;

    // Patient score: min(actual/required, 1) * 100
    $minPatients = $criteria['min_patients'] ?? 0;
    $patientScore = $minPatients > 0
        ? min(round(($personCount / $minPatients) * 100, 1), 100.0)
        : 100.0;

    // Composite: weighted average
    $weights = ['domain' => 0.25, 'concept' => 0.30, 'visit' => 0.15, 'date' => 0.15, 'patient' => 0.15];
    $composite = round(
        $domainScore * $weights['domain']
        + $conceptScore * $weights['concept']
        + $visitScore * $weights['visit']
        + $dateScore * $weights['date']
        + $patientScore * $weights['patient'],
        1
    );

    return [
        'domain_score' => $domainScore,
        'concept_score' => $conceptScore,
        'visit_score' => $visitScore,
        'date_score' => $dateScore,
        'patient_score' => $patientScore,
        'composite_score' => $composite,
        'details' => [...],
    ];
}
```

### Commit

```
feat(ares): add criteria impact analysis, CONSORT diagram, study templates

Panel 5 Phase B — continuous 0-100 scoring, waterfall impact chart,
CONSORT-style attrition flow, study type templates (5 presets),
median observation time criterion.
```

---

## Task 6: Diversity — Benchmarks, Age Pyramid, DAP Gap, Pooled

**Panel 6, Enhancements #1, #3, #4, #5.** Disease-epidemiology benchmark overlay, age distribution pyramid, FDA DAP gap analysis, pooled source demographics.

### Files

| Layer | File | Action |
|-------|------|--------|
| Service | `DiversityService.php` | Modify |
| Controller | `NetworkAresController.php` | Modify |
| Routes | `api.php` | Modify |
| Frontend | `AgePyramid.tsx` | Create |
| Frontend | `DapGapMatrix.tsx` | Create |
| Frontend | `BenchmarkOverlay.tsx` | Create |
| Frontend | `DiversityView.tsx` | Modify |
| Types | `ares.ts` | Modify |

### Steps

- [ ] Add `getAgePyramid(Source $source)` to `DiversityService` — queries Achilles analysis 3 (age at first observation) grouped by gender, returns `{age_groups: [{group: "0-9", male: -n, female: n}]}`
- [ ] Add `getDapGapAnalysis(array $targets)` — accepts target percentages per demographic group, returns per-source gap matrix
- [ ] Add `getPooledDemographics(array $sourceIds)` — weighted merge of demographics across selected sources
- [ ] Add controller methods: `diversityAgePyramid()`, `diversityDapCheck()`, `diversityPooled()`
- [ ] Add routes:
  - `GET /sources/{source}/ares/diversity/age-pyramid` with `permission:analyses.view`
  - `POST /network/ares/diversity/dap-check` with `permission:analyses.view`
  - `GET /network/ares/diversity/pooled?source_ids=1,2,3` with `permission:analyses.view`
- [ ] Add TypeScript interfaces: `AgePyramidData`, `DapGapResult`, `PooledDemographics`
- [ ] Create `AgePyramid.tsx` — diverging horizontal bar chart (male left, female right)
- [ ] Create `DapGapMatrix.tsx` — red/green target vs actual grid per source
- [ ] Create `BenchmarkOverlay.tsx` — dashed lines on diversity bars
- [ ] Modify `DiversityView.tsx` — add pyramid tab, DAP check section, pooled source multi-select
- [ ] Write tests

### Code: AgePyramid.tsx

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface AgePyramidData {
  group: string;
  male: number;
  female: number;
}

interface AgePyramidProps {
  data: AgePyramidData[];
  sourceName: string;
}

export default function AgePyramid({ data, sourceName }: AgePyramidProps) {
  if (data.length === 0) return null;

  // Male values should be negative for left side
  const chartData = data.map((d) => ({
    group: d.group,
    male: -Math.abs(d.male),
    female: Math.abs(d.female),
  }));

  return (
    <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
      <h4 className="mb-3 text-sm font-medium text-white">{sourceName} — Age Distribution</h4>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, bottom: 5, left: 60 }}
          >
            <XAxis
              type="number"
              tick={{ fill: "#888", fontSize: 11 }}
              tickFormatter={(v: number) => Math.abs(v).toLocaleString()}
            />
            <YAxis
              type="category"
              dataKey="group"
              tick={{ fill: "#888", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a22",
                border: "1px solid #333",
                borderRadius: "8px",
                color: "#ccc",
                fontSize: 12,
              }}
              formatter={(value: number) => [Math.abs(value).toLocaleString(), ""]}
            />
            <ReferenceLine x={0} stroke="#333" />
            <Bar dataKey="male" fill="#7c8aed" name="Male" />
            <Bar dataKey="female" fill="#e85d75" name="Female" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex justify-center gap-4 text-xs text-[#888]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#7c8aed]" /> Male
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#e85d75]" /> Female
        </span>
      </div>
    </div>
  );
}
```

### Code: DiversityService#getAgePyramid

```php
/**
 * Get age distribution pyramid data for a source, split by gender.
 *
 * @return array<int, array{group: string, male: int, female: int}>
 */
public function getAgePyramid(Source $source): array
{
    $daimon = $source->daimons()->where('daimon_type', DaimonType::Results->value)->first();
    $schema = $daimon?->table_qualifier ?? 'results';

    $connection = 'results';
    if (! empty($source->db_host)) {
        $connection = $this->connectionFactory->connectionForSchema($source, $schema);
    } else {
        DB::connection('results')->statement("SET search_path TO \"{$schema}\", public");
    }

    // Analysis 3: age at first observation by gender (stratum_1=gender_concept_id, stratum_2=age)
    $results = AchillesResult::on($connection)
        ->where('analysis_id', 3)
        ->whereNotNull('stratum_1')
        ->whereNotNull('stratum_2')
        ->get();

    $ageGroups = ['0-9', '10-19', '20-29', '30-39', '40-49', '50-59', '60-69', '70-79', '80-89', '90+'];
    $pyramid = [];

    foreach ($ageGroups as $group) {
        $pyramid[$group] = ['group' => $group, 'male' => 0, 'female' => 0];
    }

    foreach ($results as $result) {
        $age = (int) $result->stratum_2;
        $genderConceptId = (int) $result->stratum_1;
        $count = (int) $result->count_value;

        $groupKey = match (true) {
            $age < 10 => '0-9',
            $age < 20 => '10-19',
            $age < 30 => '20-29',
            $age < 40 => '30-39',
            $age < 50 => '40-49',
            $age < 60 => '50-59',
            $age < 70 => '60-69',
            $age < 80 => '70-79',
            $age < 90 => '80-89',
            default => '90+',
        };

        // 8507 = Male, 8532 = Female in OMOP
        if ($genderConceptId === 8507) {
            $pyramid[$groupKey]['male'] += $count;
        } elseif ($genderConceptId === 8532) {
            $pyramid[$groupKey]['female'] += $count;
        }
    }

    return array_values($pyramid);
}
```

### Commit

```
feat(ares): add age pyramid, DAP gap analysis, pooled demographics

Panel 6 Phase B — population pyramid by gender, FDA DAP enrollment
gap matrix, pooled multi-source demographic profiles,
disease-epidemiology benchmark overlay.
```

---

## Task 7: Releases — Diff, Swimlane, Auto-Notes, Calendar, Impact

**Panel 7, Enhancements #1, #2, #3, #5, #6.** Auto-computed release diff, swimlane timeline, auto-generated release notes, release calendar heatmap, impact assessment.

### Files

| Layer | File | Action |
|-------|------|--------|
| Migration | `add_etl_metadata_to_source_releases.php` | Create |
| Service | `ReleaseDiffService.php` | Create |
| Model | `SourceRelease.php` | Modify |
| Controller | `AresController.php` | Modify |
| Controller | `NetworkAresController.php` | Modify |
| Routes | `api.php` | Modify |
| Frontend | `ReleaseDiffPanel.tsx` | Create |
| Frontend | `SwimLaneTimeline.tsx` | Create |
| Frontend | `ReleaseCalendar.tsx` | Create |
| Frontend | `ReleasesView.tsx` | Modify |
| Types | `ares.ts` | Modify |

### Steps

- [ ] Create migration adding `etl_metadata` jsonb nullable to `source_releases`
- [ ] Add `etl_metadata` to `SourceRelease::$fillable` and casts
- [ ] Create `ReleaseDiffService` with `computeDiff(SourceRelease $release)` — returns person delta, record delta per domain, vocab version change, DQ score change, unmapped code delta
- [ ] Add `generateReleaseNotes(array $diff)` to `ReleaseDiffService` — generates human-readable summary from diff data
- [ ] Add controller methods: `releaseDiff()` in `AresController`, `releasesTimeline()` and `releasesCalendar()` in `NetworkAresController`
- [ ] Add routes:
  - `GET /sources/{source}/ares/releases/{release}/diff` with `permission:analyses.view`
  - `GET /network/ares/releases/timeline` with `permission:analyses.view`
  - `GET /network/ares/releases/calendar` with `permission:analyses.view`
- [ ] Add TypeScript interfaces: `ReleaseDiff`, `SwimLaneEvent`, `CalendarDay`
- [ ] Create `ReleaseDiffPanel.tsx` — expandable diff summary within each release card
- [ ] Create `SwimLaneTimeline.tsx` — horizontal lanes per source with release dots
- [ ] Create `ReleaseCalendar.tsx` — GitHub-contributions-style calendar heatmap
- [ ] Modify `ReleasesView.tsx` — integrate diff panel, add swimlane/calendar view toggles
- [ ] Write tests

### Code: ReleaseDiffService

```php
<?php

declare(strict_types=1);

namespace App\Services\Ares;

use App\Models\App\DqdResult;
use App\Models\App\Source;
use App\Models\App\SourceRelease;
use App\Models\App\UnmappedSourceCode;
use Illuminate\Support\Facades\DB;

class ReleaseDiffService
{
    /**
     * Compute diff between a release and its predecessor.
     *
     * @return array{has_previous: bool, person_delta: int, record_delta: int, domain_deltas: array<string, int>, dq_score_delta: float, vocab_version_changed: bool, unmapped_code_delta: int, auto_notes: string}
     */
    public function computeDiff(SourceRelease $release): array
    {
        $previous = SourceRelease::where('source_id', $release->source_id)
            ->where('id', '!=', $release->id)
            ->where('created_at', '<', $release->created_at)
            ->orderByDesc('created_at')
            ->first();

        if (! $previous) {
            return [
                'has_previous' => false,
                'person_delta' => $release->person_count,
                'record_delta' => $release->record_count,
                'domain_deltas' => [],
                'dq_score_delta' => 0.0,
                'vocab_version_changed' => false,
                'unmapped_code_delta' => 0,
                'auto_notes' => "Initial release: {$release->person_count} persons, {$release->record_count} records.",
            ];
        }

        $personDelta = $release->person_count - $previous->person_count;
        $recordDelta = $release->record_count - $previous->record_count;

        // DQ score delta
        $currentDq = $this->getPassRate($release->source_id, $release->id);
        $previousDq = $this->getPassRate($release->source_id, $previous->id);
        $dqDelta = round($currentDq - $previousDq, 1);

        // Vocab version change
        $vocabChanged = $release->vocabulary_version !== $previous->vocabulary_version
            && $release->vocabulary_version !== null;

        // Unmapped code delta
        $currentUnmapped = UnmappedSourceCode::where('release_id', $release->id)->count();
        $previousUnmapped = UnmappedSourceCode::where('release_id', $previous->id)->count();
        $unmappedDelta = $currentUnmapped - $previousUnmapped;

        // Domain-level deltas from DQD results
        $domainDeltas = $this->getDomainDeltas($release, $previous);

        $diff = [
            'has_previous' => true,
            'person_delta' => $personDelta,
            'record_delta' => $recordDelta,
            'domain_deltas' => $domainDeltas,
            'dq_score_delta' => $dqDelta,
            'vocab_version_changed' => $vocabChanged,
            'unmapped_code_delta' => $unmappedDelta,
            'auto_notes' => '',
        ];

        $diff['auto_notes'] = $this->generateReleaseNotes($diff, $release);

        return $diff;
    }

    /**
     * Generate human-readable release notes from diff data.
     */
    public function generateReleaseNotes(array $diff, SourceRelease $release): string
    {
        $notes = [];

        if ($diff['person_delta'] > 0) {
            $notes[] = "Added ".number_format($diff['person_delta'])." persons";
        } elseif ($diff['person_delta'] < 0) {
            $notes[] = "Removed ".number_format(abs($diff['person_delta']))." persons";
        }

        if ($diff['record_delta'] !== 0) {
            $pct = $release->record_count > 0
                ? round(abs($diff['record_delta']) / $release->record_count * 100, 1)
                : 0;
            $direction = $diff['record_delta'] > 0 ? 'grew' : 'shrank';
            $notes[] = "Total records {$direction} {$pct}%";
        }

        if ($diff['dq_score_delta'] > 0) {
            $notes[] = "DQ score improved {$diff['dq_score_delta']}%";
        } elseif ($diff['dq_score_delta'] < 0) {
            $notes[] = "DQ score declined ".abs($diff['dq_score_delta'])."%";
        }

        if ($diff['vocab_version_changed']) {
            $notes[] = "Vocabulary version updated to {$release->vocabulary_version}";
        }

        if ($diff['unmapped_code_delta'] > 0) {
            $notes[] = "{$diff['unmapped_code_delta']} new unmapped codes";
        } elseif ($diff['unmapped_code_delta'] < 0) {
            $notes[] = abs($diff['unmapped_code_delta'])." unmapped codes resolved";
        }

        return implode('. ', $notes).'.';
    }

    private function getPassRate(int $sourceId, int $releaseId): float
    {
        $stats = DqdResult::where('source_id', $sourceId)
            ->where('release_id', $releaseId)
            ->selectRaw('COUNT(*) as total, SUM(CASE WHEN passed THEN 1 ELSE 0 END) as passed_count')
            ->first();

        $total = (int) ($stats->total ?? 0);
        $passed = (int) ($stats->passed_count ?? 0);

        return $total > 0 ? round(($passed / $total) * 100, 1) : 0.0;
    }

    /**
     * @return array<string, int>
     */
    private function getDomainDeltas(SourceRelease $current, SourceRelease $previous): array
    {
        $currentCounts = DqdResult::where('source_id', $current->source_id)
            ->where('release_id', $current->id)
            ->whereNotNull('cdm_table')
            ->selectRaw('cdm_table, SUM(total_rows) as total')
            ->groupBy('cdm_table')
            ->pluck('total', 'cdm_table')
            ->map(fn ($v) => (int) $v);

        $previousCounts = DqdResult::where('source_id', $previous->source_id)
            ->where('release_id', $previous->id)
            ->whereNotNull('cdm_table')
            ->selectRaw('cdm_table, SUM(total_rows) as total')
            ->groupBy('cdm_table')
            ->pluck('total', 'cdm_table')
            ->map(fn ($v) => (int) $v);

        $deltas = [];
        foreach ($currentCounts as $domain => $count) {
            $prev = $previousCounts->get($domain, 0);
            $deltas[$domain] = $count - $prev;
        }

        return $deltas;
    }
}
```

### Commit

```
feat(ares): add release diff, swimlane timeline, calendar, auto-notes

Panel 7 Phase B — auto-computed git-diff-style release comparison,
swimlane timeline across all sources, GitHub-style release calendar,
auto-generated human-readable release notes, impact assessment links.
```

---

## Task 8: Unmapped Codes — Pareto, Progress, Release Diff, Treemap, Export

**Panel 8, Enhancements #2, #4, #5, #6, #7.** Pareto chart, mapping progress tracker, cross-release diff, vocabulary treemap, Usagi export.

### Files

| Layer | File | Action |
|-------|------|--------|
| Migration | `add_patient_count_to_unmapped_source_codes.php` | Create |
| Migration | `create_unmapped_code_reviews_table.php` | Create |
| Model | `UnmappedCodeReview.php` | Create |
| Model | `UnmappedSourceCode.php` | Modify |
| Service | `UnmappedCodeService.php` | Modify |
| Controller | `AresController.php` | Modify |
| Routes | `api.php` | Modify |
| Frontend | `ParetoChart.tsx` | Create |
| Frontend | `MappingProgressTracker.tsx` | Create |
| Frontend | `VocabularyTreemap.tsx` | Create |
| Frontend | `UnmappedCodesView.tsx` | Modify |
| Types | `ares.ts` | Modify |

### Steps

- [ ] Create migration adding `patient_count` bigint nullable to `unmapped_source_codes`
- [ ] Create migration for `app.unmapped_code_reviews` (unmapped_code_id FK, status, mapped_concept_id nullable, reviewed_by FK, reviewed_at)
- [ ] Create `UnmappedCodeReview` model with `$fillable = ['unmapped_code_id', 'status', 'mapped_concept_id', 'reviewed_by', 'reviewed_at']`
- [ ] Add `patient_count` to `UnmappedSourceCode::$fillable`
- [ ] Add `getParetoData(Source, SourceRelease)` to `UnmappedCodeService` — cumulative % of records covered, returns `{codes: [{source_code, record_count, cumulative_percent}], top_20_coverage: float}`
- [ ] Add `getProgressStats(Source, SourceRelease)` to `UnmappedCodeService` — counts of reviewed/mapped/unmappable/pending
- [ ] Add `getReleaseDiff(Source, SourceRelease)` — NEW vs EXISTING badges comparing with previous release
- [ ] Add `getVocabularyTreemap(Source, SourceRelease)` — aggregate by source_vocabulary_id
- [ ] Add `exportUsagi(Source, SourceRelease)` — returns CSV-formatted data compatible with Usagi import
- [ ] Add controller methods and routes:
  - `GET /sources/{source}/ares/unmapped-codes/pareto` with `permission:analyses.view`
  - `GET /sources/{source}/ares/unmapped-codes/export?format=usagi|csv` with `permission:analyses.view`
- [ ] Add TypeScript interfaces: `ParetoData`, `MappingProgress`, `TreemapNode`
- [ ] Create `ParetoChart.tsx` — combined bar + cumulative line chart
- [ ] Create `MappingProgressTracker.tsx` — progress bar with status breakdown
- [ ] Create `VocabularyTreemap.tsx` — Recharts Treemap colored by mapping completion
- [ ] Modify `UnmappedCodesView.tsx` — integrate pareto toggle, progress bar, NEW/EXISTING badges, treemap tab, export button
- [ ] Write tests

### Code: ParetoChart.tsx

```tsx
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ParetoItem {
  source_code: string;
  record_count: number;
  cumulative_percent: number;
}

interface ParetoChartProps {
  data: ParetoItem[];
  top20Coverage: number;
}

export default function ParetoChart({ data, top20Coverage }: ParetoChartProps) {
  const displayData = data.slice(0, 50); // Show top 50

  return (
    <div>
      <div className="mb-3 rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 px-4 py-2 text-sm text-[#C9A227]">
        Top 20 codes cover {top20Coverage.toFixed(1)}% of all unmapped records
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayData} margin={{ top: 5, right: 30, bottom: 40, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
            <XAxis
              dataKey="source_code"
              tick={{ fill: "#888", fontSize: 9 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              yAxisId="count"
              tick={{ fill: "#888", fontSize: 11 }}
              tickFormatter={(v: number) => v.toLocaleString()}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fill: "#888", fontSize: 11 }}
              tickFormatter={(v: number) => `${v}%`}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a22",
                border: "1px solid #333",
                borderRadius: "8px",
                color: "#ccc",
                fontSize: 12,
              }}
            />
            <Bar
              yAxisId="count"
              dataKey="record_count"
              fill="#2DD4BF"
              radius={[2, 2, 0, 0]}
              name="Records"
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="cumulative_percent"
              stroke="#C9A227"
              strokeWidth={2}
              dot={false}
              name="Cumulative %"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

### Commit

```
feat(ares): add Pareto chart, progress tracker, treemap, Usagi export

Panel 8 Phase B — Pareto cumulative chart with top-20 coverage insight,
mapping progress tracker, cross-release NEW/EXISTING badges,
vocabulary treemap, Usagi-compatible CSV export.
```

---

## Task 9: Annotations — Auto System Annotations, Timeline, Create from Charts

**Panel 9, Enhancements #2, #3, #4, #6.** Auto-generated system annotations, annotation tags, chronological timeline view, create annotations from chart data points.

### Files

| Layer | File | Action |
|-------|------|--------|
| Migration | `add_parent_id_to_chart_annotations.php` | Create |
| Model | `ChartAnnotation.php` | Modify |
| Service | `AnnotationService.php` | Modify |
| Controller | `AresController.php` | Modify |
| Request | `StoreAnnotationRequest.php` | Modify |
| Routes | `api.php` | Modify |
| Frontend | `AnnotationTimeline.tsx` | Create |
| Frontend | `CreateFromChartPopover.tsx` | Create |
| Frontend | `AnnotationsView.tsx` | Modify |
| Frontend | `DqTrendChart.tsx` | Modify |
| Types | `ares.ts` | Modify |

### Steps

- [ ] Create migration adding `parent_id` integer nullable FK (self-referential) to `chart_annotations`. **NOTE:** The `tag` column is already added by Phase A's migration — do NOT add it again here. Only add `parent_id`.
- [ ] Add `parent_id` to `ChartAnnotation::$fillable` (note: `tag` was already added in Phase A)
- [ ] Add `parent()` and `replies()` relationships to `ChartAnnotation`
- [ ] Update `StoreAnnotationRequest` to accept optional `tag` and `parent_id` fields
- [ ] Add `timeline(int $sourceId)` to `AnnotationService` — chronological ordering with source colors
- [ ] Add `searchAnnotations(string $query, ?int $sourceId, ?string $tag)` to `AnnotationService` — full-text search with filters
- [ ] Add controller methods for timeline and search
- [ ] Add route `GET /sources/{source}/ares/annotations/timeline` with `permission:analyses.view`
- [ ] Update annotation list query to support `?tag=` and `?search=` filters
- [ ] Add TypeScript interface updates for `tag`, `parent_id`, `replies`
- [ ] Create `AnnotationTimeline.tsx` — vertical timeline with source-colored markers
- [ ] Create `CreateFromChartPopover.tsx` — click chart data point to add note with pre-filled context
- [ ] Modify `AnnotationsView.tsx` — add timeline view toggle, tag filter bar, search input
- [ ] Modify `DqTrendChart.tsx` — add click handler for "Add Note" on data points
- [ ] Write tests

### Code: ChartAnnotation model additions

```php
// Add to $fillable:
protected $fillable = [
    'source_id',
    'chart_type',
    'chart_context',
    'x_value',
    'y_value',
    'annotation_text',
    'created_by',
    'tag',
    'parent_id',
];

/**
 * @return BelongsTo<self, $this>
 */
public function parent(): BelongsTo
{
    return $this->belongsTo(self::class, 'parent_id');
}

/**
 * @return HasMany<self, $this>
 */
public function replies(): HasMany
{
    return $this->hasMany(self::class, 'parent_id');
}
```

### Code: AnnotationTimeline.tsx

```tsx
import type { ChartAnnotation } from "../../../types/ares";

interface AnnotationTimelineProps {
  annotations: ChartAnnotation[];
}

const TAG_COLORS: Record<string, string> = {
  data_event: "border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF]",
  research_note: "border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]",
  action_item: "border-[#e85d75] bg-[#e85d75]/10 text-[#e85d75]",
  system: "border-[#7c8aed] bg-[#7c8aed]/10 text-[#7c8aed]",
};

export default function AnnotationTimeline({ annotations }: AnnotationTimelineProps) {
  const sorted = [...annotations].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="relative ml-4 border-l border-[#252530] pl-6">
      {sorted.map((ann) => (
        <div key={ann.id} className="relative mb-6">
          {/* Timeline dot */}
          <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border-2 border-[#252530] bg-[#C9A227]" />

          <div className="rounded-lg border border-[#252530] bg-[#151518] p-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs text-[#666]">
                {new Date(ann.created_at).toLocaleDateString()} at{" "}
                {new Date(ann.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {ann.tag && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    TAG_COLORS[ann.tag] ?? "border-[#333] text-[#888]"
                  }`}
                >
                  {ann.tag}
                </span>
              )}
              <span className="text-xs text-[#555]">{ann.chart_type}</span>
            </div>
            <p className="text-sm text-[#ccc]">{ann.annotation_text}</p>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-[#555]">
              <span>{ann.creator?.name ?? "System"}</span>
              {ann.source?.source_name && <span>on {ann.source.source_name}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Commit

```
feat(ares): add annotation tags, timeline view, create from charts

Panel 9 Phase B — tag system (data_event/research_note/action_item/system),
chronological timeline with source-colored markers, click-to-annotate
on chart data points, auto-generated system annotations from events.
```

---

## Task 10: Cost Analysis — Box Plots, Cost Type Filter, Outliers, Care Setting

**Panel 10, Enhancements #1, #3, #4, #5.** Box-whisker distribution plots, cost type filter with warnings, outlier detection, cost by care setting.

### Files

| Layer | File | Action |
|-------|------|--------|
| Service | `CostService.php` | Modify |
| Controller | `AresController.php` | Modify |
| Routes | `api.php` | Modify |
| Frontend | `CostBoxPlot.tsx` | Create |
| Frontend | `CareSettingBreakdown.tsx` | Create |
| Frontend | `CostTypeFilter.tsx` | Create |
| Frontend | `CostView.tsx` | Modify |
| Types | `ares.ts` | Modify |

### Steps

- [ ] Add `getDistribution(Source, ?string $domain, ?int $costTypeConceptId)` to `CostService` — returns `{min, p10, p25, median, p75, p90, max, mean, count}` per domain
- [ ] Add `getAvailableCostTypes(Source)` to `CostService` — returns distinct `cost_type_concept_id` values with concept names
- [ ] Add `getOutlierStats(Source)` — compute 99th percentile, count above, concentration percentage
- [ ] Add `getCareSettingBreakdown(Source)` — join cost to visit_occurrence, group by visit_concept_id
- [ ] Add controller methods: `costDistribution()`, `costCareSetting()` in `AresController`
- [ ] Add routes:
  - `GET /sources/{source}/ares/cost/distribution?domain=&cost_type=` with `permission:analyses.view`
  - `GET /sources/{source}/ares/cost/care-setting` with `permission:analyses.view`
- [ ] Add TypeScript interfaces: `CostDistribution`, `CostTypeInfo`, `OutlierStats`, `CareSettingCost`
- [ ] Create `CostBoxPlot.tsx` — custom Recharts shape for box-and-whisker with outlier dots
- [ ] Create `CareSettingBreakdown.tsx` — grouped bars by inpatient/outpatient/ER/pharmacy
- [ ] Create `CostTypeFilter.tsx` — toggle with warning banner when multiple types detected
- [ ] Modify `CostView.tsx` — replace avg bars with box plots, add cost type filter, outlier Pareto card, care setting breakdown tab
- [ ] Write tests

### Code: CostService#getDistribution

```php
/**
 * Get cost distribution data for box-and-whisker plots.
 *
 * @return array{has_cost_data: bool, distributions: array<int, array{domain: string, min: float, p10: float, p25: float, median: float, p75: float, p90: float, max: float, mean: float, count: int}>}
 */
public function getDistribution(Source $source, ?string $domain = null, ?int $costTypeConceptId = null): array
{
    if (! $this->hasCostData($source)) {
        return ['has_cost_data' => false, 'distributions' => []];
    }

    try {
        $connection = $this->getOmopConnection($source);

        $query = DB::connection($connection)->table('cost')
            ->whereNotNull('cost_domain_id')
            ->where('total_charge', '>', 0);

        if ($domain) {
            $query->where('cost_domain_id', $domain);
        }

        if ($costTypeConceptId) {
            $query->where('cost_type_concept_id', $costTypeConceptId);
        }

        $distributions = $query
            ->selectRaw("
                cost_domain_id as domain,
                MIN(total_charge) as min_val,
                PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY total_charge) as p10,
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_charge) as p25,
                PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_charge) as median,
                PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY total_charge) as p75,
                PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY total_charge) as p90,
                MAX(total_charge) as max_val,
                AVG(total_charge) as mean_val,
                COUNT(*) as record_count
            ")
            ->groupBy('cost_domain_id')
            ->orderByDesc(DB::raw('SUM(total_charge)'))
            ->get();

        return [
            'has_cost_data' => true,
            'distributions' => $distributions->map(fn ($row) => [
                'domain' => $row->domain,
                'min' => round((float) $row->min_val, 2),
                'p10' => round((float) $row->p10, 2),
                'p25' => round((float) $row->p25, 2),
                'median' => round((float) $row->median, 2),
                'p75' => round((float) $row->p75, 2),
                'p90' => round((float) $row->p90, 2),
                'max' => round((float) $row->max_val, 2),
                'mean' => round((float) $row->mean_val, 2),
                'count' => (int) $row->record_count,
            ])->toArray(),
        ];
    } catch (\Throwable $e) {
        Log::warning("CostService: getDistribution failed: {$e->getMessage()}");

        return ['has_cost_data' => false, 'distributions' => []];
    }
}

/**
 * Get distinct cost type concept IDs available for a source.
 *
 * @return array<int, array{cost_type_concept_id: int, concept_name: string, record_count: int}>
 */
public function getAvailableCostTypes(Source $source): array
{
    try {
        $connection = $this->getOmopConnection($source);

        $types = DB::connection($connection)->table('cost as c')
            ->join('concept as co', 'c.cost_type_concept_id', '=', 'co.concept_id')
            ->whereNotNull('c.cost_type_concept_id')
            ->selectRaw('c.cost_type_concept_id, co.concept_name, COUNT(*) as record_count')
            ->groupBy('c.cost_type_concept_id', 'co.concept_name')
            ->orderByDesc(DB::raw('COUNT(*)'))
            ->get();

        return $types->map(fn ($row) => [
            'cost_type_concept_id' => (int) $row->cost_type_concept_id,
            'concept_name' => $row->concept_name,
            'record_count' => (int) $row->record_count,
        ])->toArray();
    } catch (\Throwable) {
        return [];
    }
}

/**
 * Get care setting breakdown — cost grouped by visit type.
 *
 * @return array{has_cost_data: bool, settings: array<int, array{setting: string, visit_concept_id: int, total_cost: float, record_count: int, avg_cost: float}>}
 */
public function getCareSettingBreakdown(Source $source): array
{
    if (! $this->hasCostData($source)) {
        return ['has_cost_data' => false, 'settings' => []];
    }

    try {
        $connection = $this->getOmopConnection($source);

        $results = DB::connection($connection)->table('cost as c')
            ->join('visit_occurrence as vo', function ($join) {
                $join->on('c.cost_event_id', '=', 'vo.visit_occurrence_id')
                    ->where('c.cost_domain_id', '=', 'Visit');
            })
            ->join('concept as co', 'vo.visit_concept_id', '=', 'co.concept_id')
            ->selectRaw('
                co.concept_name as setting,
                vo.visit_concept_id,
                SUM(c.total_charge) as total_cost,
                COUNT(*) as record_count,
                AVG(c.total_charge) as avg_cost
            ')
            ->groupBy('co.concept_name', 'vo.visit_concept_id')
            ->orderByDesc(DB::raw('SUM(c.total_charge)'))
            ->get();

        return [
            'has_cost_data' => true,
            'settings' => $results->map(fn ($row) => [
                'setting' => $row->setting,
                'visit_concept_id' => (int) $row->visit_concept_id,
                'total_cost' => round((float) $row->total_cost, 2),
                'record_count' => (int) $row->record_count,
                'avg_cost' => round((float) $row->avg_cost, 2),
            ])->toArray(),
        ];
    } catch (\Throwable $e) {
        Log::warning("CostService: getCareSettingBreakdown failed: {$e->getMessage()}");

        return ['has_cost_data' => false, 'settings' => []];
    }
}
```

### Code: CostBoxPlot.tsx

```tsx
import { ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";

interface CostDistribution {
  domain: string;
  min: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
  mean: number;
  count: number;
}

interface CostBoxPlotProps {
  distributions: CostDistribution[];
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDomain(domain: string): string {
  return domain.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CostBoxPlot({ distributions }: CostBoxPlotProps) {
  if (distributions.length === 0) return null;

  return (
    <div className="space-y-3">
      {distributions.map((dist) => (
        <div key={dist.domain} className="rounded-lg border border-[#252530] bg-[#151518] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-white">{formatDomain(dist.domain)}</span>
            <span className="text-xs text-[#666]">{dist.count.toLocaleString()} records</span>
          </div>

          {/* Box plot visualization */}
          <div className="relative h-10 w-full">
            {/* Scale based on max */}
            {(() => {
              const scale = (v: number) => `${(v / dist.max) * 100}%`;
              return (
                <div className="absolute inset-0 flex items-center">
                  {/* Whisker line */}
                  <div
                    className="absolute h-0.5 bg-[#555]"
                    style={{ left: scale(dist.p10), width: `calc(${scale(dist.p90)} - ${scale(dist.p10)})` }}
                  />
                  {/* IQR box */}
                  <div
                    className="absolute h-6 rounded border border-[#2DD4BF] bg-[#2DD4BF]/20"
                    style={{
                      left: scale(dist.p25),
                      width: `calc(${scale(dist.p75)} - ${scale(dist.p25)})`,
                    }}
                  />
                  {/* Median line */}
                  <div
                    className="absolute h-6 w-0.5 bg-[#C9A227]"
                    style={{ left: scale(dist.median) }}
                  />
                  {/* Mean dot */}
                  <div
                    className="absolute h-2 w-2 -translate-x-1/2 rounded-full bg-[#e85d75]"
                    style={{ left: scale(dist.mean) }}
                  />
                </div>
              );
            })()}
          </div>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#666]">
            <span>P10: {formatCurrency(dist.p10)}</span>
            <span>P25: {formatCurrency(dist.p25)}</span>
            <span className="text-[#C9A227]">Median: {formatCurrency(dist.median)}</span>
            <span>P75: {formatCurrency(dist.p75)}</span>
            <span>P90: {formatCurrency(dist.p90)}</span>
            <span className="text-[#e85d75]">Mean: {formatCurrency(dist.mean)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Commit

```
feat(ares): add box-whisker cost plots, cost type filter, care setting

Panel 10 Phase B — distribution box plots replacing misleading averages,
cost type toggle with mixed-type warning, outlier concentration detection,
care setting breakdown by inpatient/outpatient/ER/pharmacy.
```

---

## Route Summary — All New Endpoints

Add these to `backend/routes/api.php` inside the existing Ares middleware groups:

```php
// ── Source-scoped Ares (inside sources/{source}/ares prefix) ──

// DQ History v2
Route::get('/dq-history/heatmap', [AresController::class, 'dqHistoryHeatmap'])
    ->middleware('permission:analyses.view');

// Releases v2
Route::get('/releases/{release}/diff', [AresController::class, 'releaseDiff'])
    ->middleware('permission:analyses.view');

// Unmapped Codes v2
Route::get('/unmapped-codes/pareto', [AresController::class, 'unmappedCodesPareto'])
    ->middleware('permission:analyses.view');
Route::get('/unmapped-codes/export', [AresController::class, 'unmappedCodesExport'])
    ->middleware('permission:analyses.view');

// Cost v2
Route::get('/cost/distribution', [AresController::class, 'costDistribution'])
    ->middleware('permission:analyses.view');
Route::get('/cost/care-setting', [AresController::class, 'costCareSetting'])
    ->middleware('permission:analyses.view');

// Annotations v2
Route::get('/annotations/timeline', [AresController::class, 'annotationTimeline'])
    ->middleware('permission:analyses.view');

// Diversity v2 (source-scoped)
Route::get('/diversity/age-pyramid', [AresController::class, 'diversityAgePyramid'])
    ->middleware('permission:analyses.view');


// ── Network Ares (inside network/ares prefix) ──

// Alerts
Route::get('/alerts', [NetworkAresController::class, 'alerts'])
    ->middleware('permission:analyses.view');

// Concept Comparison v2
Route::get('/compare/multi', [NetworkAresController::class, 'compareMulti'])
    ->middleware('permission:analyses.view');
Route::get('/compare/funnel', [NetworkAresController::class, 'compareFunnel'])
    ->middleware('permission:analyses.view');

// DQ Overlay
Route::get('/dq-overlay', [NetworkAresController::class, 'dqOverlay'])
    ->middleware('permission:analyses.view');

// Coverage v2
Route::get('/coverage/extended', [NetworkAresController::class, 'coverageExtended'])
    ->middleware('permission:analyses.view');

// Feasibility v2
Route::get('/feasibility/{id}/impact', [NetworkAresController::class, 'feasibilityImpact'])
    ->middleware('permission:analyses.view');
Route::get('/feasibility/templates', [NetworkAresController::class, 'feasibilityTemplates'])
    ->middleware('permission:analyses.view');
Route::post('/feasibility/templates', [NetworkAresController::class, 'storeFeasibilityTemplate'])
    ->middleware('permission:analyses.create');

// Diversity v2
Route::post('/diversity/dap-check', [NetworkAresController::class, 'diversityDapCheck'])
    ->middleware('permission:analyses.view');
Route::get('/diversity/pooled', [NetworkAresController::class, 'diversityPooled'])
    ->middleware('permission:analyses.view');

// Releases v2
Route::get('/releases/timeline', [NetworkAresController::class, 'releasesTimeline'])
    ->middleware('permission:analyses.view');
Route::get('/releases/calendar', [NetworkAresController::class, 'releasesCalendar'])
    ->middleware('permission:analyses.view');

// Cost v2
Route::get('/cost/compare', [NetworkAresController::class, 'costCompare'])
    ->middleware('permission:analyses.view');

// DQ SLA (admin-level)
Route::post('/sources/{source}/ares/dq-sla', [AresController::class, 'storeDqSla'])
    ->middleware('role:admin|super-admin|data-steward');
```

---

## Migration Summary

8 migrations in order:

| # | Migration | Type |
|---|-----------|------|
| 1 | `create_dq_sla_targets_table` | New table |
| 2 | `create_feasibility_templates_table` | New table |
| 3 | `create_accepted_mappings_table` | New table |
| 4 | `create_unmapped_code_reviews_table` | New table |
| 5 | `add_parent_id_to_chart_annotations` | Alter |
| 6 | `add_etl_metadata_to_source_releases` | Alter |
| 7 | `add_source_type_to_sources` | Alter |
| 8 | `add_patient_count_to_unmapped_source_codes` | Alter |

All additive — no destructive changes. Safe to run on production with real data.

---

## TypeScript Type Additions (ares.ts)

```typescript
// ── Network Alerts ──
export interface AresAlert {
  severity: "critical" | "warning" | "info";
  source_id: number;
  source_name: string;
  type: "dq_drop" | "stale_data" | "unmapped_spike";
  message: string;
  value: number;
}

// ── Multi-Concept Comparison ──
export interface MultiConceptComparison {
  concepts: Array<{
    concept_id: number;
    concept_name: string;
    sources: ConceptComparison[];
  }>;
}

// ── Attrition Funnel ──
export interface AttritionFunnelSource {
  source_id: number;
  source_name: string;
  steps: Array<{
    concept_name: string;
    remaining_patients: number;
    percentage: number;
  }>;
}

// ── DQ Heatmap ──
export interface DqHeatmapData {
  releases: Array<{ id: number; name: string; date: string }>;
  categories: string[];
  cells: Array<{ release_id: number; category: string; pass_rate: number }>;
}

// ── DQ Network Overlay ──
export interface DqOverlaySource {
  source_id: number;
  source_name: string;
  trends: Array<{ release_name: string; created_at: string; pass_rate: number }>;
}

// ── Extended Coverage ──
export interface ExtendedCoverageCell extends CoverageCell {
  earliest_date: string | null;
  latest_date: string | null;
}

// ── Continuous Feasibility ──
export interface ContinuousFeasibilityResult {
  id: number;
  assessment_id: number;
  source_id: number;
  source_name: string;
  domain_score: number;
  concept_score: number;
  visit_score: number;
  date_score: number;
  patient_score: number;
  composite_score: number;
  details: Record<string, unknown>;
}

export interface FeasibilityImpact {
  criterion: string;
  sources_eliminated: number;
  impact_percentage: number;
}

export interface FeasibilityTemplateType {
  id: number;
  name: string;
  study_type: string;
  criteria: FeasibilityCriteria;
}

// ── Age Pyramid ──
export interface AgePyramidGroup {
  group: string;
  male: number;
  female: number;
}

// ── DAP Gap ──
export interface DapGapResult {
  source_id: number;
  source_name: string;
  gaps: Array<{
    group: string;
    target: number;
    actual: number;
    gap: number;
    met: boolean;
  }>;
}

// ── Release Diff ──
export interface ReleaseDiff {
  has_previous: boolean;
  person_delta: number;
  record_delta: number;
  domain_deltas: Record<string, number>;
  dq_score_delta: number;
  vocab_version_changed: boolean;
  unmapped_code_delta: number;
  auto_notes: string;
}

// ── Swimlane Timeline ──
export interface SwimLaneEvent {
  source_id: number;
  source_name: string;
  releases: Array<{
    id: number;
    name: string;
    date: string;
  }>;
}

// ── Calendar Heatmap ──
export interface CalendarDay {
  date: string;
  count: number;
}

// ── Pareto ──
export interface ParetoData {
  codes: Array<{
    source_code: string;
    record_count: number;
    cumulative_percent: number;
  }>;
  top_20_coverage: number;
}

// ── Mapping Progress ──
export interface MappingProgress {
  total: number;
  reviewed: number;
  mapped: number;
  unmappable: number;
  pending: number;
  velocity_per_week: number;
}

// ── Vocabulary Treemap ──
export interface TreemapNode {
  name: string;
  value: number;
  mapped_percent: number;
}

// ── Cost Distribution ──
export interface CostDistribution {
  domain: string;
  min: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
  mean: number;
  count: number;
}

export interface CostTypeInfo {
  cost_type_concept_id: number;
  concept_name: string;
  record_count: number;
}

export interface CareSettingCost {
  setting: string;
  visit_concept_id: number;
  total_cost: number;
  record_count: number;
  avg_cost: number;
}

// ── Updated ChartAnnotation ──
// Add to existing ChartAnnotation interface:
//   tag?: "data_event" | "research_note" | "action_item" | "system" | null;
//   parent_id?: number | null;
//   replies?: ChartAnnotation[];

// ── Updated SourceRelease ──
// Add to existing SourceRelease interface:
//   etl_metadata?: {
//     who?: string;
//     code_version?: string;
//     parameters?: Record<string, unknown>;
//     duration_minutes?: number;
//   } | null;
```

---

## Execution Order

Tasks are designed to be independent — they can be executed in parallel by separate sessions. However, the recommended order (for solo execution) prioritizes foundational changes first:

1. **Task 1** (Alerts) — Creates `AutoAnnotationService` used by Task 9
2. **Task 9** (Annotations) — Creates `tag`/`parent_id` migration used by Task 1's auto-annotations
3. **Task 7** (Releases) — Creates `ReleaseDiffService` and `etl_metadata` migration
4. **Task 3** (DQ History) — Extends `DqHistoryService` with heatmap/overlay
5. **Task 2** (Concept Comparison) — Extends `NetworkComparisonService`
6. **Task 4** (Coverage) — Extends `CoverageService` + `source_type` migration
7. **Task 5** (Feasibility) — Major refactor of `FeasibilityService` for continuous scoring
8. **Task 6** (Diversity) — Extends `DiversityService` with pyramid/DAP
9. **Task 8** (Unmapped Codes) — Extends `UnmappedCodeService` + new tables
10. **Task 10** (Cost) — Extends `CostService` with distributions

**Dependency note:** Tasks 1 and 9 share the `chart_annotations` migration for `tag` and `parent_id`. Run Task 9's migration first, then Task 1's listener can use the `tag` field.

---

## Testing Strategy

Per task:
- 1 Pest test file per new/modified service (unit tests)
- 1 Pest test file for new API endpoints (feature/integration tests)
- 1 Vitest test file per new React component (render + interaction)
- TypeScript strict mode — no `any` types in new code

```bash
# Full test suite after all tasks
cd backend && vendor/bin/pest --filter=Ares
cd frontend && npx vitest run --filter=ares
cd frontend && npx tsc --noEmit
cd backend && vendor/bin/phpstan analyse
```

---

## Security Checklist (HIGHSEC)

- [x] All routes inside `auth:sanctum` middleware group
- [x] Read routes: `permission:analyses.view`
- [x] Write routes: `permission:analyses.create`
- [x] Admin routes (DQ SLA): `role:admin|super-admin|data-steward`
- [x] No PHI exposure — all data is aggregate-level
- [x] All new models use `$fillable` (never `$guarded = []`)
- [x] CdmModel remains read-only (accepted_mappings goes to `app` schema staging table)
- [x] Rate limiting not needed on Phase B endpoints (no AI/compute-heavy operations; those are Phase C)
- [x] Input validation via Form Requests for all POST/PUT endpoints
