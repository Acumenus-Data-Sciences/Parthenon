# Ares v2 Phase A — Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement ~20 low-effort, high-impact enhancements across all 10 Ares panels. These are the "quick wins" — sparklines, freshness badges, zone shading, continuous scoring, diversity indices, PPPY metrics, annotation tags, and interactive highlights that transform each panel from basic display to active analytical tool.

**Architecture:** No new database tables. 1 migration (add `tag` column to `chart_annotations`). Backend changes extend existing services with new computed fields (sparkline data, freshness, domain counts, person counts, diversity index, PPPY, impact scores, confidence intervals). Frontend changes are primarily within existing view components — new columns, shading, toggles, and inline edit forms. No new API endpoints; all changes extend existing endpoint responses.

**Tech Stack:** Laravel 11 / PHP 8.4 / PostgreSQL 17 / React 19 / TypeScript / TanStack Query / Recharts / Tailwind 4

**Spec:** `docs/superpowers/specs/2026-03-24-ares-v2-design.md` (Section 6, Phase A)

---

## File Map

### Backend — New Files

```
backend/
├── database/migrations/
│   └── 2026_03_25_100001_add_tag_to_chart_annotations.php
└── tests/
    ├── Unit/Services/Ares/
    │   ├── DiversityServiceIndexTest.php
    │   ├── FeasibilityScoringTest.php
    │   ├── CostPppyTest.php
    │   └── UnmappedCodePriorityTest.php
    └── Feature/Api/
        ├── NetworkOverviewEnhancedTest.php
        ├── AnnotationTagsTest.php
        └── ReleaseEditTest.php
```

### Backend — Modified Files

```
backend/
├── app/
│   ├── Services/Ares/
│   │   ├── DqHistoryService.php                # Add sparkline data to network summary, per-source freshness
│   │   ├── CoverageService.php                 # Add density_per_person, domain summary row, source summary column
│   │   ├── DiversityService.php                # Add Simpson's Diversity Index computation
│   │   ├── FeasibilityService.php              # Replace binary pass/fail with 0-100 continuous scores
│   │   ├── CostService.php                     # Add PPPY computation to getSummary()
│   │   ├── UnmappedCodeService.php             # Add impact_score computation and sort
│   │   ├── AnnotationService.php               # Add tag filter, full-text search support
│   │   └── NetworkComparisonService.php        # Add confidence intervals (Wilson score) to compare results
│   ├── Http/Controllers/Api/V1/
│   │   ├── NetworkAresController.php           # Pass enhanced overview data through
│   │   └── AresController.php                  # Annotation tag/search query params
│   └── Models/App/
│       └── ChartAnnotation.php                 # Add 'tag' to $fillable
├── routes/api.php                               # No new routes (all changes extend existing endpoints)
```

### Frontend — New Files

```
frontend/src/features/data-explorer/
├── components/ares/
│   ├── shared/
│   │   └── Sparkline.tsx                        # Reusable inline sparkline (6-point, 60x20px)
│   ├── network-overview/
│   │   └── FreshnessCell.tsx                    # Freshness badge component (days + STALE)
│   └── releases/
│       └── ReleaseEditForm.tsx                  # Inline edit form for release metadata
```

### Frontend — Modified Files

```
frontend/src/features/data-explorer/
├── types/
│   └── ares.ts                                  # Extend types: sparkline arrays, freshness, scores, tags, PPPY, CI
├── api/
│   └── networkAresApi.ts                        # No API changes (data shape comes from backend)
├── hooks/
│   └── useNetworkData.ts                        # No hook changes (same endpoints)
├── components/ares/
│   ├── network-overview/
│   │   └── NetworkOverviewView.tsx              # Sparklines, freshness, domain count, person count, row click, aggregate row
│   ├── concept-comparison/
│   │   └── ComparisonChart.tsx                  # Error bars on rate_per_1000 bars
│   ├── dq-history/
│   │   └── DqTrendChart.tsx                     # Green/amber/red zone shading via ReferenceArea
│   ├── coverage/
│   │   └── CoverageMatrixView.tsx               # Obs period highlight, hover highlighting, view mode toggle, summary row/col
│   ├── feasibility/
│   │   └── FeasibilityView.tsx                  # Percentage scores, color gradients, composite score
│   ├── diversity/
│   │   └── DiversityView.tsx                    # Simpson's index cards at top
│   ├── releases/
│   │   └── ReleasesView.tsx                     # Edit button + inline edit form
│   ├── unmapped-codes/
│   │   └── UnmappedCodesView.tsx                # Impact score column, sort by priority
│   ├── annotations/
│   │   └── AnnotationsView.tsx                  # Tag badges, tag filter, full-text search
│   └── cost/
│       └── CostView.tsx                         # PPPY card alongside totals
```

---

## Task 1: Backend Foundation — Migration + Type Extensions

Extend the data model with the annotation tag column, and update types across all services that will return enhanced data.

**Files:**
- Create: `backend/database/migrations/2026_03_25_100001_add_tag_to_chart_annotations.php`
- Modify: `backend/app/Models/App/ChartAnnotation.php`
- Modify: `frontend/src/features/data-explorer/types/ares.ts`

### Steps

- [ ] **1.1** Create migration to add `tag` column to `chart_annotations` table.

```php
// backend/database/migrations/2026_03_25_100001_add_tag_to_chart_annotations.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chart_annotations', function (Blueprint $table) {
            $table->string('tag', 30)->nullable()->after('annotation_text');
        });
    }

    public function down(): void
    {
        Schema::table('chart_annotations', function (Blueprint $table) {
            $table->dropColumn('tag');
        });
    }
};
```

- [ ] **1.2** Add `'tag'` to ChartAnnotation model `$fillable` array.

```php
// backend/app/Models/App/ChartAnnotation.php — add 'tag' to $fillable
protected $fillable = [
    'source_id',
    'chart_type',
    'chart_context',
    'x_value',
    'y_value',
    'annotation_text',
    'tag',
    'created_by',
];
```

- [ ] **1.3** Update `StoreAnnotationRequest` to accept optional `tag` field.

Add to `backend/app/Http/Requests/Api/StoreAnnotationRequest.php` rules:

```php
'tag' => ['nullable', 'string', 'in:data_event,research_note,action_item,system'],
```

- [ ] **1.4** Extend frontend TypeScript types in `ares.ts` for all Phase A enhancements.

Add/modify the following types:

```typescript
// Extend ChartAnnotation
export interface ChartAnnotation {
  // ... existing fields ...
  tag: 'data_event' | 'research_note' | 'action_item' | 'system' | null;
}

// Extend NetworkDqSource with sparkline, freshness, domain count, person count
export interface NetworkDqSource {
  source_id: number;
  source_name: string;
  pass_rate: number;
  trend: "up" | "down" | "stable" | null;
  release_name: string | null;
  sparkline: number[];              // Last 6 DQ scores
  days_since_refresh: number | null; // Days since last release
  domain_count: number;             // X of 12 domains with data
  person_count: number;             // Total persons in source
}

// Extend NetworkOverview with network total
export interface NetworkOverview {
  source_count: number;
  avg_dq_score: number | null;
  total_unmapped_codes: number;
  sources_needing_attention: number;
  dq_summary: NetworkDqSource[];
  network_person_count: number;      // Aggregate across all sources
  network_record_count: number;      // Aggregate across all sources
}

// Extend ConceptComparison with confidence interval
export interface ConceptComparison {
  source_id: number;
  source_name: string;
  count: number;
  rate_per_1000: number;
  person_count: number;
  ci_lower: number;                  // Wilson score lower bound
  ci_upper: number;                  // Wilson score upper bound
}

// Extend CoverageCell with density_per_person (already exists) + mode support
export interface CoverageCell {
  record_count: number;
  has_data: boolean;
  density_per_person: number;
}

// Coverage summary types
export interface CoverageMatrix {
  sources: Array<{ id: number; name: string; domain_count: number }>;
  domains: string[];
  matrix: Array<Record<string, CoverageCell>>;
  domain_totals: Record<string, number>;      // Network total per domain
  source_completeness: Record<number, number>; // Domain count per source (X/12)
}

// Extend FeasibilityResult with continuous scores
export interface FeasibilityResult {
  id: number;
  assessment_id: number;
  source_id: number;
  source_name: string;
  domain_pass: boolean;
  concept_pass: boolean;
  visit_pass: boolean;
  date_pass: boolean;
  patient_pass: boolean;
  overall_pass: boolean;
  domain_score: number;    // 0-100
  concept_score: number;   // 0-100
  visit_score: number;     // 0-100
  date_score: number;      // 0-100
  patient_score: number;   // 0-100
  composite_score: number; // 0-100 weighted average
  details: Record<string, unknown>;
}

// Extend DiversitySource with Simpson's index
export interface DiversitySource {
  source_id: number;
  source_name: string;
  person_count: number;
  gender: Record<string, number>;
  race: Record<string, number>;
  ethnicity: Record<string, number>;
  simpson_index: number;     // 0-1, higher = more diverse
  diversity_rating: 'low' | 'moderate' | 'high' | 'very_high';
}

// Extend CostSummary with PPPY
export interface CostSummary {
  has_cost_data: boolean;
  domains: CostDomain[];
  total_cost: number;
  person_count: number;
  avg_observation_years: number;
  pppy: number;              // Per-patient-per-year
}

// Extend UnmappedCode with impact score
export interface UnmappedCode {
  id: number;
  source_id: number;
  release_id: number;
  source_code: string;
  source_vocabulary_id: string;
  cdm_table: string;
  cdm_field: string;
  record_count: number;
  impact_score: number;      // record_count * domain_weight
  created_at: string;
}

// Annotation filter params
export interface AnnotationFilters {
  tag?: string;
  search?: string;
  source_id?: number;
}
```

- [ ] **1.5** Run migration.

```bash
cd /home/smudoshi/Github/Parthenon/backend && php artisan migrate
```

**Test command:** `cd /home/smudoshi/Github/Parthenon/backend && php artisan migrate:status | grep chart_annotations`

**Commit:** `feat(ares-v2): add tag column to chart_annotations and extend TypeScript types for Phase A`

---

## Task 2: Network Overview Enhancements (Panel 1)

Add sparklines, freshness monitor, domain count, person count, row click navigation, and network aggregate row.

**Files:**
- Modify: `backend/app/Services/Ares/DqHistoryService.php`
- Modify: `backend/app/Http/Controllers/Api/V1/NetworkAresController.php`
- Create: `frontend/src/features/data-explorer/components/ares/shared/Sparkline.tsx`
- Create: `frontend/src/features/data-explorer/components/ares/network-overview/FreshnessCell.tsx`
- Modify: `frontend/src/features/data-explorer/components/ares/network-overview/NetworkOverviewView.tsx`

### Steps

- [ ] **2.1** Extend `DqHistoryService::getNetworkDqSummary()` to return sparkline data, freshness days, domain count, and person count per source.

In `DqHistoryService`, modify the network summary method to query the last 6 DQ scores per source (from `dqd_deltas` or `dqd_results` grouped by release), compute days since latest release, count distinct domains from Achilles results, and include person count from analysis_id=1.

```php
// In DqHistoryService::getNetworkDqSummary(), extend each source entry:
// After computing pass_rate and trend, add:

// Sparkline: last 6 DQ pass rates for this source
$sparkline = SourceRelease::where('source_id', $source->id)
    ->orderByDesc('created_at')
    ->limit(6)
    ->get()
    ->reverse()
    ->values()
    ->map(function ($release) use ($source) {
        $total = DqdResult::where('source_id', $source->id)
            ->where('release_id', $release->id)
            ->count();
        $passed = DqdResult::where('source_id', $source->id)
            ->where('release_id', $release->id)
            ->where('passed', true)
            ->count();
        return $total > 0 ? round(($passed / $total) * 100, 1) : 0;
    })
    ->toArray();

// Freshness: days since latest release
$latestRelease = SourceRelease::where('source_id', $source->id)
    ->orderByDesc('created_at')
    ->first();
$daysSinceRefresh = $latestRelease
    ? (int) now()->diffInDays($latestRelease->created_at)
    : null;

// Domain count: count distinct domains with data from Achilles results
// Use analysis IDs: 400(condition), 600(procedure), 700(drug), 800(observation),
// 200(visit), 1800(measurement), 2100(device), etc.
$domainAnalysisIds = [400, 600, 700, 800, 200, 1800, 2100, 900, 1000, 1100, 1300, 1500];
$domainCount = AchillesResult::on($connection)
    ->whereIn('analysis_id', $domainAnalysisIds)
    ->where('count_value', '>', 0)
    ->distinct('analysis_id')
    ->count('analysis_id');

// Person count from analysis_id = 1
$personCount = (int) (AchillesResult::on($connection)
    ->where('analysis_id', 1)
    ->value('count_value') ?? 0);

// Add to result array:
$result['sparkline'] = $sparkline;
$result['days_since_refresh'] = $daysSinceRefresh;
$result['domain_count'] = $domainCount;
$result['person_count'] = $personCount;
```

- [ ] **2.2** Extend `NetworkAresController::overview()` to include network totals.

```php
// In NetworkAresController::overview(), after computing dq_summary:
$networkPersonCount = array_sum(array_column($dqSummary, 'person_count'));
$networkRecordCount = 0; // Sum from latest releases
foreach ($dqSummary as $s) {
    $latestRelease = SourceRelease::where('source_id', $s['source_id'])
        ->orderByDesc('created_at')
        ->first();
    $networkRecordCount += $latestRelease?->record_count ?? 0;
}

// Add to response:
'network_person_count' => $networkPersonCount,
'network_record_count' => $networkRecordCount,
```

- [ ] **2.3** Create reusable `Sparkline` component.

```tsx
// frontend/src/features/data-explorer/components/ares/shared/Sparkline.tsx
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export default function Sparkline({
  data,
  width = 60,
  height = 20,
  color = "#2DD4BF",
}: SparklineProps) {
  if (data.length < 2) return <span className="text-[#555]">--</span>;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Endpoint dot */}
      {data.length > 0 && (
        <circle
          cx={(data.length - 1) / (data.length - 1) * width}
          cy={height - ((data[data.length - 1] - min) / range) * height}
          r={2}
          fill={color}
        />
      )}
    </svg>
  );
}
```

- [ ] **2.4** Create `FreshnessCell` component with STALE badge.

```tsx
// frontend/src/features/data-explorer/components/ares/network-overview/FreshnessCell.tsx
interface FreshnessCellProps {
  daysSinceRefresh: number | null;
}

export default function FreshnessCell({ daysSinceRefresh }: FreshnessCellProps) {
  if (daysSinceRefresh === null) {
    return <span className="text-[#555]">--</span>;
  }

  const isStale = daysSinceRefresh > 30;
  const isWarning = daysSinceRefresh > 14;

  return (
    <div className="flex items-center gap-1.5">
      <span className={
        isStale ? "text-[#e85d75]" :
        isWarning ? "text-[#C9A227]" :
        "text-[#888]"
      }>
        {daysSinceRefresh}d
      </span>
      {isStale && (
        <span className="rounded bg-[#9B1B30]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#e85d75]">
          STALE
        </span>
      )}
    </div>
  );
}
```

- [ ] **2.5** Rewrite `NetworkOverviewView.tsx` with all 5 enhancements.

Replace `TrendIndicator` with `Sparkline`. Add columns for Freshness, Domain Coverage (mini progress ring via SVG), Person Count. Add row click handler using `useNavigate()` to navigate to `/data-explorer/${sourceId}`. Add aggregate row at table bottom.

```tsx
// Key changes to NetworkOverviewView.tsx:

// 1. Import new components
import { useNavigate } from "react-router-dom";
import Sparkline from "../shared/Sparkline";
import FreshnessCell from "./FreshnessCell";

// 2. Add navigate hook
const navigate = useNavigate();

// 3. Replace TrendIndicator column header/cells with Sparkline
<th>DQ Trend</th>
// Cell:
<td><Sparkline data={source.sparkline} /></td>

// 4. Add Freshness column
<th>Freshness</th>
// Cell:
<td><FreshnessCell daysSinceRefresh={source.days_since_refresh} /></td>

// 5. Add Domain Coverage column with mini progress ring (inline SVG)
<th>Domains</th>
// Cell: render a small 20x20 SVG circle arc showing X/12
<td>
  <div className="flex items-center gap-1">
    <svg width={20} height={20} viewBox="0 0 20 20">
      <circle cx={10} cy={10} r={8} fill="none" stroke="#252530" strokeWidth={2} />
      <circle
        cx={10} cy={10} r={8} fill="none"
        stroke="#2DD4BF"
        strokeWidth={2}
        strokeDasharray={`${(source.domain_count / 12) * 50.27} 50.27`}
        strokeLinecap="round"
        transform="rotate(-90 10 10)"
      />
    </svg>
    <span className="text-xs text-[#888]">{source.domain_count}/12</span>
  </div>
</td>

// 6. Add Person Count column
<th>Persons</th>
// Cell:
<td className="text-xs text-[#ccc]">{source.person_count.toLocaleString()}</td>

// 7. Row click handler
<tr
  key={source.source_id}
  onClick={() => navigate(`/data-explorer/${source.source_id}`)}
  className="cursor-pointer border-b border-[#1a1a22] hover:bg-[#151518]"
>

// 8. Aggregate row at bottom
<tr className="border-t-2 border-[#333] bg-[#1a1a22] font-medium">
  <td className="px-4 py-2 text-[#C9A227]">Network Total</td>
  <td className="px-4 py-2 text-center">
    <span className="text-xs text-[#C9A227]">
      {overview.avg_dq_score !== null ? `${overview.avg_dq_score.toFixed(1)}%` : "--"} avg
    </span>
  </td>
  <td />  {/* sparkline N/A for aggregate */}
  <td />  {/* freshness N/A */}
  <td />  {/* domains N/A */}
  <td className="px-4 py-2 text-xs text-[#C9A227]">
    {overview.network_person_count?.toLocaleString() ?? "--"}
  </td>
  <td />  {/* release N/A */}
</tr>
```

- [ ] **2.6** Add a 5th summary stat box for Network Person Count.

Update the summary stats grid from `grid-cols-4` to `grid-cols-5` and add:

```tsx
<div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
  <p className="text-2xl font-semibold text-[#2DD4BF]">
    {overview.network_person_count?.toLocaleString() ?? "--"}
  </p>
  <p className="text-[11px] text-[#666]">Total Persons</p>
</div>
```

**Test commands:**
```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Feature/Api/NetworkOverviewEnhancedTest.php
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/data-explorer/components/ares/shared/Sparkline.test.tsx
```

**Commit:** `feat(ares-v2): add sparklines, freshness monitor, domain count, person count, row click, and aggregate row to Network Overview`

---

## Task 3: Confidence Intervals on Concept Comparison (Panel 2)

Add Wilson score confidence intervals to rate_per_1000 bars.

**Files:**
- Modify: `backend/app/Services/Ares/NetworkComparisonService.php`
- Modify: `frontend/src/features/data-explorer/components/ares/concept-comparison/ComparisonChart.tsx`

### Steps

- [ ] **3.1** Add Wilson score interval computation to `NetworkComparisonService::getConceptDataForSource()`.

After computing `rate_per_1000`, compute Wilson score 95% confidence interval bounds:

```php
// Wilson score interval for binomial proportion
// p = count / person_count, n = person_count, z = 1.96 (95% CI)
$n = $personCount;
$p = $n > 0 ? $count / $n : 0;
$z = 1.96;

if ($n > 0 && $p > 0) {
    $denominator = 1 + ($z * $z / $n);
    $center = ($p + ($z * $z) / (2 * $n)) / $denominator;
    $spread = ($z / $denominator) * sqrt(($p * (1 - $p) / $n) + ($z * $z / (4 * $n * $n)));
    $ciLower = max(0, ($center - $spread) * 1000);
    $ciUpper = ($center + $spread) * 1000;
} else {
    $ciLower = 0.0;
    $ciUpper = 0.0;
}

// Add to returned array:
'ci_lower' => round($ciLower, 2),
'ci_upper' => round($ciUpper, 2),
```

- [ ] **3.2** Add error bars to `ComparisonChart` using Recharts `ErrorBar`.

```tsx
// In ComparisonChart.tsx:
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ErrorBar } from "recharts";

// Update chartData to include CI bounds when metric is rate_per_1000:
const chartData = data.map((d) => ({
  source: d.source_name,
  value: metric === "count" ? d.count : d.rate_per_1000,
  errorLow: metric === "rate_per_1000" ? d.rate_per_1000 - (d.ci_lower ?? d.rate_per_1000) : 0,
  errorHigh: metric === "rate_per_1000" ? (d.ci_upper ?? d.rate_per_1000) - d.rate_per_1000 : 0,
}));

// Add ErrorBar inside <Bar>:
<Bar dataKey="value" fill="#C9A227" radius={[4, 4, 0, 0]}>
  {metric === "rate_per_1000" && (
    <ErrorBar
      dataKey="errorHigh"
      direction="y"
      width={4}
      stroke="#888"
      strokeWidth={1}
    />
  )}
</Bar>
```

Note: Recharts `ErrorBar` uses a single `dataKey` for symmetric error. For asymmetric, we need to use the custom error bar approach. The data should include `error: [errorLow, errorHigh]` as a tuple:

```tsx
const chartData = data.map((d) => ({
  source: d.source_name,
  value: metric === "count" ? d.count : d.rate_per_1000,
  error: metric === "rate_per_1000"
    ? [d.rate_per_1000 - (d.ci_lower ?? d.rate_per_1000), (d.ci_upper ?? d.rate_per_1000) - d.rate_per_1000]
    : [0, 0],
}));

// Inside <Bar>:
<ErrorBar dataKey="error" width={4} stroke="#888" strokeWidth={1} />
```

**Test command:** `cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/data-explorer/components/ares/concept-comparison/ComparisonChart.test.tsx`

**Commit:** `feat(ares-v2): add Wilson score confidence intervals to concept comparison bars`

---

## Task 4: DQ History Zone Shading (Panel 3)

Add green/amber/red background zones to DQ trend chart.

**Files:**
- Modify: `frontend/src/features/data-explorer/components/ares/dq-history/DqTrendChart.tsx`

### Steps

- [ ] **4.1** Add `ReferenceArea` zones to `DqTrendChart`.

Import `ReferenceArea` (already imported as `ReferenceLine`) and add three zones:

```tsx
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceArea,
} from "recharts";

// Inside <LineChart>, before the <Line>, add zone shading:

{/* Good zone: >90% — green */}
<ReferenceArea
  y1={90}
  y2={100}
  fill="#2DD4BF"
  fillOpacity={0.05}
  ifOverflow="extendDomain"
/>

{/* Warning zone: 80-90% — amber */}
<ReferenceArea
  y1={80}
  y2={90}
  fill="#C9A227"
  fillOpacity={0.05}
  ifOverflow="extendDomain"
/>

{/* Danger zone: <80% — red */}
<ReferenceArea
  y1={0}
  y2={80}
  fill="#9B1B30"
  fillOpacity={0.05}
  ifOverflow="extendDomain"
/>
```

- [ ] **4.2** Update the helper text to mention zone shading.

```tsx
<p className="mt-1 text-center text-[10px] text-[#555]">
  Click a release point to view delta details. Green &gt;90%, amber 80-90%, red &lt;80%.
</p>
```

**Test command:** `cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/data-explorer/components/ares/dq-history/DqTrendChart.test.tsx`

**Commit:** `feat(ares-v2): add green/amber/red zone shading to DQ trend chart`

---

## Task 5: Coverage Matrix Enhancements (Panel 4)

Add observation period highlight, interactive row/column highlighting, view mode toggle, and domain summary row + source summary column.

**Files:**
- Modify: `backend/app/Services/Ares/CoverageService.php`
- Modify: `frontend/src/features/data-explorer/components/ares/coverage/CoverageMatrixView.tsx`

### Steps

- [ ] **5.1** Extend `CoverageService::getMatrix()` to return domain totals and source completeness.

```php
// After building the matrix, compute:

// Domain totals: sum record_count across all sources per domain
$domainTotals = [];
foreach ($allDomains as $domain) {
    $total = 0;
    foreach ($matrix as $row) {
        $total += $row[$domain]['record_count'] ?? 0;
    }
    $domainTotals[$domain] = $total;
}

// Source completeness: count domains with data per source
$sourceCompleteness = [];
foreach ($sources as $idx => $source) {
    $count = 0;
    foreach ($allDomains as $domain) {
        if (($matrix[$idx][$domain]['has_data'] ?? false)) {
            $count++;
        }
    }
    $sourceCompleteness[$source->id] = $count;
}

// Add to return array:
'domain_totals' => $domainTotals,
'source_completeness' => $sourceCompleteness,
```

- [ ] **5.2** Add view mode toggle state to `CoverageMatrixView`.

```tsx
// Add state for view mode and hover tracking:
const [viewMode, setViewMode] = useState<"records" | "per_person" | "date_range">("records");
const [hoveredRow, setHoveredRow] = useState<number | null>(null);
const [hoveredCol, setHoveredCol] = useState<string | null>(null);
```

- [ ] **5.3** Add view mode toggle buttons above the matrix.

```tsx
<div className="mb-3 flex items-center gap-2">
  <span className="text-xs text-[#666]">View:</span>
  {(["records", "per_person", "date_range"] as const).map((mode) => (
    <button
      key={mode}
      type="button"
      onClick={() => setViewMode(mode)}
      className={`rounded px-2 py-1 text-xs transition-colors ${
        viewMode === mode
          ? "bg-[#C9A227]/20 text-[#C9A227]"
          : "text-[#888] hover:text-white"
      }`}
    >
      {mode === "records" ? "Records" : mode === "per_person" ? "Per Person" : "Date Range"}
    </button>
  ))}
</div>
```

- [ ] **5.4** Style observation_period column with accent border.

```tsx
// In column headers and cells, check if domain === "observation_period":
const isObsPeriod = domain === "observation_period";

// Header:
<th
  key={domain}
  className={`px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888] ${
    isObsPeriod ? "border-x-2 border-[#C9A227]/30 bg-[#C9A227]/5" : ""
  }`}
>

// Cell:
<td
  key={domain}
  className={`px-2 py-1.5 text-center ${
    isObsPeriod ? "border-x-2 border-[#C9A227]/30 bg-[#C9A227]/5" : ""
  }`}
>
```

- [ ] **5.5** Add interactive row/column highlighting on hover.

```tsx
// On each data row:
<tr
  key={source.id}
  onMouseEnter={() => setHoveredRow(rowIdx)}
  onMouseLeave={() => setHoveredRow(null)}
  className={`border-t border-[#1a1a22] ${
    hoveredRow === rowIdx ? "bg-[#1a1a22]" : ""
  }`}
>

// On each data cell:
<td
  onMouseEnter={() => setHoveredCol(domain)}
  onMouseLeave={() => setHoveredCol(null)}
  className={`... ${hoveredCol === domain ? "bg-[#1a1a22]" : ""}`}
>
```

- [ ] **5.6** Add cell value display based on view mode.

```tsx
// Replace the cell content to switch based on viewMode:
{viewMode === "records" && (cell.has_data ? cell.record_count.toLocaleString() : "---")}
{viewMode === "per_person" && (cell.has_data ? cell.density_per_person.toFixed(1) : "---")}
{viewMode === "date_range" && (cell.has_data ? "Yes" : "---")}
```

- [ ] **5.7** Add domain summary row (bottom) and source summary column (right).

```tsx
{/* Domain summary row at bottom */}
<tr className="border-t-2 border-[#333] bg-[#1a1a22]">
  <td className="sticky left-0 bg-[#1a1a22] px-3 py-2 text-xs font-medium text-[#C9A227]">
    Network Total
  </td>
  {matrix.domains.map((domain) => (
    <td key={domain} className="px-2 py-1.5 text-center">
      <span className="text-xs font-mono text-[#C9A227]">
        {(matrix.domain_totals?.[domain] ?? 0).toLocaleString()}
      </span>
    </td>
  ))}
  {/* Source summary column header in the aggregate row */}
  <td className="px-2 py-1.5 text-center text-xs font-mono text-[#C9A227]">--</td>
</tr>

{/* Source summary column (rightmost) — add to headers and each row */}
// Header:
<th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">
  Domains
</th>

// Each row cell:
<td className="px-2 py-1.5 text-center">
  <span className="text-xs text-[#888]">
    {matrix.source_completeness?.[source.id] ?? 0}/12
  </span>
</td>
```

**Test command:** `cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/data-explorer/components/ares/coverage/CoverageMatrixView.test.tsx`

**Commit:** `feat(ares-v2): add observation period highlight, hover highlighting, view mode toggle, and summary row/column to Coverage Matrix`

---

## Task 6: Continuous Feasibility Scoring (Panel 5)

Replace binary PASS/FAIL with percentage scores per criterion and a weighted composite score.

**Files:**
- Modify: `backend/app/Services/Ares/FeasibilityService.php`
- Modify: `frontend/src/features/data-explorer/components/ares/feasibility/FeasibilityView.tsx`

### Steps

- [ ] **6.1** Modify `FeasibilityService::evaluateSource()` to return continuous 0-100 scores alongside boolean pass/fail.

```php
// Domain score: (available_domains / required_domains) * 100
$domainScore = count($requiredDomains) > 0
    ? round((count(array_filter($domainDetails, fn($d) => $d['available'] ?? false)) / count($requiredDomains)) * 100)
    : 100;

// Concept score: (found_concepts / required_concepts) * 100
$conceptScore = count($requiredConcepts) > 0
    ? round((count(array_filter($conceptDetails, fn($d) => $d['present'] ?? false)) / count($requiredConcepts)) * 100)
    : 100;

// Visit score: (found_visits / required_visits) * 100
$visitScore = count($requiredVisits) > 0
    ? round((count(array_filter($visitDetails, fn($d) => $d['present'] ?? false)) / count($requiredVisits)) * 100)
    : 100;

// Date score: 100 if date range available, 0 otherwise (simplified)
$dateScore = ! empty($criteria['date_range'])
    ? ($personCount > 0 ? 100 : 0)
    : 100;

// Patient score: min(100, (actual / required) * 100)
$patientScore = $minPatients > 0
    ? min(100, round(($personCount / $minPatients) * 100))
    : 100;

// Composite: weighted average (domain=20%, concept=30%, visit=15%, date=15%, patient=20%)
$compositeScore = round(
    ($domainScore * 0.20) +
    ($conceptScore * 0.30) +
    ($visitScore * 0.15) +
    ($dateScore * 0.15) +
    ($patientScore * 0.20)
);

// Add to return array:
'domain_score' => $domainScore,
'concept_score' => $conceptScore,
'visit_score' => $visitScore,
'date_score' => $dateScore,
'patient_score' => $patientScore,
'composite_score' => $compositeScore,
```

- [ ] **6.2** Store scores in `feasibility_assessment_results` table.

Add score columns to the insert. If columns don't exist, add a migration step first:

```php
// In the foreach loop insert:
'domain_score' => $result['domain_score'],
'concept_score' => $result['concept_score'],
'visit_score' => $result['visit_score'],
'date_score' => $result['date_score'],
'patient_score' => $result['patient_score'],
'composite_score' => $result['composite_score'],
```

Note: If the `feasibility_assessment_results` table doesn't have score columns, add a migration:

```php
Schema::table('feasibility_assessment_results', function (Blueprint $table) {
    $table->unsignedTinyInteger('domain_score')->default(0)->after('overall_pass');
    $table->unsignedTinyInteger('concept_score')->default(0)->after('domain_score');
    $table->unsignedTinyInteger('visit_score')->default(0)->after('concept_score');
    $table->unsignedTinyInteger('date_score')->default(0)->after('visit_score');
    $table->unsignedTinyInteger('patient_score')->default(0)->after('date_score');
    $table->unsignedTinyInteger('composite_score')->default(0)->after('patient_score');
});
```

- [ ] **6.3** Replace `PassBadge` with `ScoreBadge` in `FeasibilityView.tsx`.

```tsx
function ScoreBadge({ score, pass }: { score: number; pass: boolean }) {
  const color = score >= 90
    ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
    : score >= 70
      ? "bg-[#C9A227]/20 text-[#C9A227]"
      : score >= 50
        ? "bg-[#F59E0B]/20 text-[#F59E0B]"
        : "bg-[#9B1B30]/20 text-[#e85d75]";

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${color}`}>
      {score}%
    </span>
  );
}
```

- [ ] **6.4** Update the results table to show scores instead of PASS/FAIL, and add Composite Score column.

```tsx
// Replace PassBadge usages with ScoreBadge:
<td className="px-3 py-2 text-center">
  <ScoreBadge score={r.domain_score ?? (r.domain_pass ? 100 : 0)} pass={r.domain_pass} />
</td>
// ... same pattern for concept, visit, date, patient

// Add Composite Score column:
<th>Score</th>
// Cell:
<td className="px-3 py-2 text-center">
  <span
    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
      (r.composite_score ?? 0) >= 80
        ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
        : (r.composite_score ?? 0) >= 60
          ? "bg-[#C9A227]/20 text-[#C9A227]"
          : "bg-[#9B1B30]/20 text-[#e85d75]"
    }`}
  >
    {r.composite_score ?? 0}%
  </span>
</td>
```

- [ ] **6.5** Update Overall column to show ELIGIBLE/INELIGIBLE with composite score.

```tsx
<td className="px-3 py-2 text-center">
  <div className="flex flex-col items-center gap-0.5">
    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
      r.overall_pass
        ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
        : "bg-[#9B1B30]/20 text-[#e85d75]"
    }`}>
      {r.overall_pass ? "ELIGIBLE" : "INELIGIBLE"}
    </span>
    <span className="text-[10px] text-[#666]">{r.composite_score ?? 0}% score</span>
  </div>
</td>
```

**Test command:** `cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Unit/Services/Ares/FeasibilityScoringTest.php`

**Commit:** `feat(ares-v2): replace binary PASS/FAIL with continuous 0-100 feasibility scoring`

---

## Task 7: Simpson's Diversity Index (Panel 6)

Add a single 0-1 diversity index per source with rating cards at the top of the view.

**Files:**
- Modify: `backend/app/Services/Ares/DiversityService.php`
- Modify: `frontend/src/features/data-explorer/components/ares/diversity/DiversityView.tsx`

### Steps

- [ ] **7.1** Add Simpson's Diversity Index computation to `DiversityService::getSourceDemographics()`.

```php
// After computing gender, race, ethnicity proportions, compute Simpson's Index:
// Simpson's = 1 - sum(p_i^2) where p_i is proportion for each group
// Average across race, ethnicity, gender for a combined index

$simpsonIndex = $this->computeSimpsonIndex($race, $ethnicity, $gender);
$diversityRating = match(true) {
    $simpsonIndex >= 0.8 => 'very_high',
    $simpsonIndex >= 0.6 => 'high',
    $simpsonIndex >= 0.4 => 'moderate',
    default => 'low',
};

// Add to return array:
'simpson_index' => $simpsonIndex,
'diversity_rating' => $diversityRating,
```

Add helper method:

```php
/**
 * Compute Simpson's Diversity Index averaged across demographic dimensions.
 * Simpson's = 1 - sum(p_i^2) where p_i is proportion (0-1) for each group.
 *
 * @param array<string, float> $race       Percentages (0-100)
 * @param array<string, float> $ethnicity  Percentages (0-100)
 * @param array<string, float> $gender     Percentages (0-100)
 */
private function computeSimpsonIndex(array $race, array $ethnicity, array $gender): float
{
    $indices = [];

    foreach ([$race, $ethnicity, $gender] as $dimension) {
        if (empty($dimension)) {
            continue;
        }
        $sumSquares = 0;
        foreach ($dimension as $pct) {
            $p = $pct / 100;
            $sumSquares += $p * $p;
        }
        $indices[] = 1 - $sumSquares;
    }

    if (empty($indices)) {
        return 0.0;
    }

    return round(array_sum($indices) / count($indices), 3);
}
```

- [ ] **7.2** Add diversity index rating cards to `DiversityView.tsx`.

```tsx
// Before the source cards, add a row of index cards:
<div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
  {diversity.map((source: DiversitySource) => {
    const ratingColors = {
      very_high: "border-[#2DD4BF] bg-[#2DD4BF]/10 text-[#2DD4BF]",
      high: "border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]",
      moderate: "border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]",
      low: "border-[#9B1B30] bg-[#9B1B30]/10 text-[#e85d75]",
    };
    const rating = source.diversity_rating ?? "low";
    return (
      <div
        key={source.source_id}
        className={`rounded-lg border p-3 text-center ${ratingColors[rating]}`}
      >
        <p className="text-xl font-bold">{(source.simpson_index ?? 0).toFixed(2)}</p>
        <p className="text-[10px] uppercase tracking-wider">{source.source_name}</p>
        <p className="mt-0.5 text-[9px] capitalize opacity-70">{rating.replace("_", " ")}</p>
      </div>
    );
  })}
</div>
```

**Test command:** `cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Unit/Services/Ares/DiversityServiceIndexTest.php`

**Commit:** `feat(ares-v2): add Simpson's Diversity Index cards to Diversity panel`

---

## Task 8: Release Metadata Editing (Panel 7)

Add inline edit form for release name, versions, and notes.

**Files:**
- Create: `frontend/src/features/data-explorer/components/ares/releases/ReleaseEditForm.tsx`
- Modify: `frontend/src/features/data-explorer/components/ares/releases/ReleasesView.tsx`

### Steps

- [ ] **8.1** Create `ReleaseEditForm` component.

```tsx
// frontend/src/features/data-explorer/components/ares/releases/ReleaseEditForm.tsx
import { useState } from "react";
import type { SourceRelease, UpdateReleasePayload } from "../../../types/ares";

interface ReleaseEditFormProps {
  release: SourceRelease;
  isLoading: boolean;
  onSave: (payload: UpdateReleasePayload) => void;
  onCancel: () => void;
}

export default function ReleaseEditForm({ release, isLoading, onSave, onCancel }: ReleaseEditFormProps) {
  const [formData, setFormData] = useState<UpdateReleasePayload>({
    release_name: release.release_name,
    cdm_version: release.cdm_version ?? "",
    vocabulary_version: release.vocabulary_version ?? "",
    etl_version: release.etl_version ?? "",
    notes: release.notes ?? "",
  });

  return (
    <div className="mt-3 space-y-2 border-t border-[#252530] pt-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          type="text"
          value={formData.release_name}
          onChange={(e) => setFormData({ ...formData, release_name: e.target.value })}
          placeholder="Release name"
          className="rounded-lg border border-[#252530] bg-[#0E0E11] px-3 py-1.5 text-sm text-[#F0EDE8] placeholder-[#8A857D] focus:border-[#C9A227] focus:outline-none"
        />
        <input
          type="text"
          value={formData.cdm_version ?? ""}
          onChange={(e) => setFormData({ ...formData, cdm_version: e.target.value || undefined })}
          placeholder="CDM version"
          className="rounded-lg border border-[#252530] bg-[#0E0E11] px-3 py-1.5 text-sm text-[#F0EDE8] placeholder-[#8A857D] focus:border-[#C9A227] focus:outline-none"
        />
        <input
          type="text"
          value={formData.vocabulary_version ?? ""}
          onChange={(e) => setFormData({ ...formData, vocabulary_version: e.target.value || undefined })}
          placeholder="Vocabulary version"
          className="rounded-lg border border-[#252530] bg-[#0E0E11] px-3 py-1.5 text-sm text-[#F0EDE8] placeholder-[#8A857D] focus:border-[#C9A227] focus:outline-none"
        />
        <input
          type="text"
          value={formData.etl_version ?? ""}
          onChange={(e) => setFormData({ ...formData, etl_version: e.target.value || undefined })}
          placeholder="ETL version"
          className="rounded-lg border border-[#252530] bg-[#0E0E11] px-3 py-1.5 text-sm text-[#F0EDE8] placeholder-[#8A857D] focus:border-[#C9A227] focus:outline-none"
        />
      </div>
      <textarea
        value={formData.notes ?? ""}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value || undefined })}
        placeholder="Release notes..."
        rows={2}
        className="w-full rounded-lg border border-[#252530] bg-[#0E0E11] px-3 py-1.5 text-sm text-[#F0EDE8] placeholder-[#8A857D] focus:border-[#C9A227] focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onSave(formData)}
          disabled={isLoading || !formData.release_name?.trim()}
          className="rounded-lg bg-[#C9A227] px-3 py-1.5 text-sm font-medium text-[#0E0E11] hover:bg-[#e0b82e] disabled:opacity-50 transition-colors"
        >
          {isLoading ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[#252530] px-3 py-1.5 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **8.2** Add edit functionality to `ReleasesView.tsx`.

```tsx
// Add state and imports:
import { Pencil } from "lucide-react";
import { useUpdateRelease } from "../../../hooks/useReleaseData";
import ReleaseEditForm from "./ReleaseEditForm";

const [editingId, setEditingId] = useState<number | null>(null);
const updateMutation = useUpdateRelease(selectedSourceId ?? 0);

// In each release card, add an edit button alongside the delete button:
<div className="flex items-center gap-1">
  <button
    type="button"
    onClick={() => setEditingId(editingId === release.id ? null : release.id)}
    className="text-[#8A857D] hover:text-[#C9A227] transition-colors p-1"
  >
    <Pencil size={14} />
  </button>
  <button
    type="button"
    onClick={() => handleDelete(release.id)}
    disabled={deleteMutation.isPending}
    className="text-[#8A857D] hover:text-[#9B1B30] transition-colors p-1"
  >
    <Trash2 size={14} />
  </button>
</div>

// After the release card content, conditionally render the edit form:
{editingId === release.id && (
  <ReleaseEditForm
    release={release}
    isLoading={updateMutation.isPending}
    onSave={(payload) => {
      updateMutation.mutate(
        { releaseId: release.id, payload },
        { onSuccess: () => setEditingId(null) },
      );
    }}
    onCancel={() => setEditingId(null)}
  />
)}
```

**Test command:** `cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/data-explorer/components/ares/releases/ReleaseEditForm.test.tsx`

**Commit:** `feat(ares-v2): add inline edit form for release metadata`

---

## Task 9: Impact-Weighted Priority Score for Unmapped Codes (Panel 8)

Add impact score computation and default sort by priority.

**Files:**
- Modify: `backend/app/Services/Ares/UnmappedCodeService.php`
- Modify: `frontend/src/features/data-explorer/components/ares/unmapped-codes/UnmappedCodesView.tsx`

### Steps

- [ ] **9.1** Add impact score computation to `UnmappedCodeService::getDetails()`.

```php
// Domain weight map:
private const DOMAIN_WEIGHTS = [
    'condition_occurrence' => 1.0,
    'drug_exposure' => 0.9,
    'procedure_occurrence' => 0.8,
    'measurement' => 0.7,
    'observation' => 0.5,
    'visit_occurrence' => 0.3,
    'device_exposure' => 0.6,
];

// In getDetails(), add impact_score as a computed column:
$query = UnmappedSourceCode::where('source_id', $source->id)
    ->where('release_id', $release->id)
    ->selectRaw('*, (record_count * CASE cdm_table
        WHEN \'condition_occurrence\' THEN 1.0
        WHEN \'drug_exposure\' THEN 0.9
        WHEN \'procedure_occurrence\' THEN 0.8
        WHEN \'measurement\' THEN 0.7
        WHEN \'observation\' THEN 0.5
        WHEN \'visit_occurrence\' THEN 0.3
        WHEN \'device_exposure\' THEN 0.6
        ELSE 0.5
    END) as impact_score');

// Change default sort from record_count to impact_score:
return $query->orderByDesc('impact_score')
    ->paginate($perPage, ['*'], 'page', $page);
```

- [ ] **9.2** Add Impact Score column and priority badges to `UnmappedCodesView.tsx`.

```tsx
// Add Impact Score column header:
<th className="px-3 py-2 text-right text-[11px] font-medium uppercase text-[#888]">
  Impact
</th>

// In each row, add impact score cell with priority badge:
<td className="px-3 py-2 text-right">
  <div className="flex items-center justify-end gap-1.5">
    {idx < 3 && (
      <span className="rounded-full bg-[#9B1B30]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#e85d75]">
        #{idx + 1}
      </span>
    )}
    <span className="text-xs font-mono text-[#ccc]">
      {(code.impact_score ?? code.record_count).toLocaleString()}
    </span>
  </div>
</td>
```

Where `idx` is the index from `.map((code, idx) => ...)`.

- [ ] **9.3** Add header note about impact-weighted sorting.

```tsx
// Below the filters row:
<p className="mb-2 text-[10px] text-[#555]">
  Sorted by impact score (record count x domain weight). Condition codes weighted highest.
</p>
```

**Test command:** `cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Unit/Services/Ares/UnmappedCodePriorityTest.php`

**Commit:** `feat(ares-v2): add impact-weighted priority scoring to unmapped codes`

---

## Task 10: Annotation Tags + Full-Text Search (Panel 9)

Add tag column with color-coded badges, tag filter bar, and search input.

**Files:**
- Modify: `backend/app/Services/Ares/AnnotationService.php`
- Modify: `backend/app/Http/Controllers/Api/V1/AresController.php`
- Modify: `frontend/src/features/data-explorer/components/ares/annotations/AnnotationsView.tsx`

### Steps

- [ ] **10.1** Extend `AnnotationService::allForSource()` to support tag filtering and text search.

```php
/**
 * Get all annotations for a source with optional tag and search filters.
 *
 * @return Collection<int, ChartAnnotation>
 */
public function allForSource(int $sourceId, ?string $tag = null, ?string $search = null): Collection
{
    return ChartAnnotation::query()
        ->with('creator')
        ->where('source_id', $sourceId)
        ->when($tag, fn ($q) => $q->where('tag', $tag))
        ->when($search, fn ($q) => $q->where('annotation_text', 'ilike', '%' . $search . '%'))
        ->orderByDesc('created_at')
        ->get();
}
```

- [ ] **10.2** Extend `AnnotationService::allForNetwork()` with same filters.

```php
public function allForNetwork(?string $tag = null, ?string $search = null): Collection
{
    return ChartAnnotation::query()
        ->with(['creator', 'source'])
        ->when($tag, fn ($q) => $q->where('tag', $tag))
        ->when($search, fn ($q) => $q->where('annotation_text', 'ilike', '%' . $search . '%'))
        ->orderByDesc('created_at')
        ->get();
}
```

- [ ] **10.3** Update `AresController::annotations()` to pass tag and search query params.

```php
public function annotations(Request $request, Source $source): JsonResponse
{
    $chartType = $request->query('chart_type');
    $tag = $request->query('tag');
    $search = $request->query('search');

    if (is_string($chartType) && $chartType !== '') {
        $annotations = $this->annotationService->forChart($chartType, $source->id);
    } else {
        $annotations = $this->annotationService->allForSource(
            $source->id,
            is_string($tag) ? $tag : null,
            is_string($search) ? $search : null,
        );
    }

    return response()->json(['data' => $annotations]);
}
```

- [ ] **10.4** Update `NetworkAresController::annotations()` to pass filters.

```php
public function annotations(Request $request): JsonResponse
{
    $tag = $request->query('tag');
    $search = $request->query('search');

    return response()->json([
        'data' => $this->annotationService->allForNetwork(
            is_string($tag) ? $tag : null,
            is_string($search) ? $search : null,
        ),
    ]);
}
```

- [ ] **10.5** Update frontend `fetchAnnotations` API function to pass tag and search params.

```typescript
// In annotationApi.ts:
export async function fetchAnnotations(
  sourceId: number,
  chartType?: string,
  tag?: string,
  search?: string,
): Promise<ChartAnnotation[]> {
  const params: Record<string, string> = {};
  if (chartType) params.chart_type = chartType;
  if (tag) params.tag = tag;
  if (search) params.search = search;
  const { data } = await apiClient.get(BASE(sourceId), { params });
  return unwrap<ChartAnnotation[]>(data);
}
```

- [ ] **10.6** Update `useAnnotations` hook to accept tag and search params.

```typescript
export function useAnnotations(sourceId: number | null, chartType?: string, tag?: string, search?: string) {
  return useQuery({
    queryKey: ["ares", "annotations", sourceId, chartType, tag, search],
    queryFn: () => fetchAnnotations(sourceId!, chartType, tag, search),
    enabled: sourceId != null && sourceId > 0,
  });
}
```

- [ ] **10.7** Rewrite `AnnotationsView.tsx` with tag filter bar, search input, and tag badges.

```tsx
// Add state:
const [tagFilter, setTagFilter] = useState<string | undefined>(undefined);
const [searchQuery, setSearchQuery] = useState("");
const [debouncedSearch, setDebouncedSearch] = useState("");

// Debounce search (simple setTimeout approach):
useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
  return () => clearTimeout(timer);
}, [searchQuery]);

// Pass filters to hook:
const { data: annotations, isLoading } = useAnnotations(
  selectedSourceId,
  undefined,
  tagFilter,
  debouncedSearch || undefined,
);

// Tag filter bar:
const TAG_OPTIONS = [
  { value: undefined, label: "All" },
  { value: "data_event", label: "Data Event", color: "#2DD4BF" },
  { value: "research_note", label: "Research Note", color: "#C9A227" },
  { value: "action_item", label: "Action Item", color: "#9B1B30" },
  { value: "system", label: "System", color: "#6366F1" },
] as const;

// Render tag filter pills + search input after source selector:
<div className="flex flex-wrap items-center gap-2">
  {TAG_OPTIONS.map((opt) => (
    <button
      key={opt.label}
      type="button"
      onClick={() => setTagFilter(opt.value)}
      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
        tagFilter === opt.value
          ? "border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]"
          : "border-[#333] text-[#888] hover:border-[#555]"
      }`}
    >
      {opt.value && (
        <span
          className="mr-1 inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: opt.color }}
        />
      )}
      {opt.label}
    </button>
  ))}
</div>

<input
  type="text"
  placeholder="Search annotations..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  className="rounded-lg border border-[#252530] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] placeholder-[#8A857D] focus:border-[#C9A227] focus:outline-none"
/>

// In each annotation card, add tag badge:
{ann.tag && (
  <span
    className="rounded-full px-2 py-0.5 text-xs font-medium"
    style={{
      backgroundColor: {
        data_event: "#2DD4BF20",
        research_note: "#C9A22720",
        action_item: "#9B1B3020",
        system: "#6366F120",
      }[ann.tag],
      color: {
        data_event: "#2DD4BF",
        research_note: "#C9A227",
        action_item: "#e85d75",
        system: "#818CF8",
      }[ann.tag],
    }}
  >
    {ann.tag.replace("_", " ")}
  </span>
)}
```

**Test commands:**
```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Feature/Api/AnnotationTagsTest.php
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/data-explorer/components/ares/annotations/AnnotationsView.test.tsx
```

**Commit:** `feat(ares-v2): add annotation tags with color-coded badges, tag filter, and full-text search`

---

## Task 11: PPPY Metric for Cost Panel (Panel 10)

Add per-patient-per-year metric alongside cost totals.

**Files:**
- Modify: `backend/app/Services/Ares/CostService.php`
- Modify: `frontend/src/features/data-explorer/components/ares/cost/CostView.tsx`

### Steps

- [ ] **11.1** Extend `CostService::getSummary()` to compute PPPY.

```php
// After computing domains array, compute total_cost, person_count, and PPPY:

$totalCost = array_sum(array_column($domains, 'total_cost'));

// Get person count from Achilles analysis 1
$personResult = DB::connection($connection)
    ->table('achilles_results')
    ->where('analysis_id', 1)
    ->value('count_value');
$personCount = (int) ($personResult ?? 0);

// Get average observation years from Achilles analysis 108 (observation period length distribution)
// or compute from observation_period table
$avgObsYears = 1.0; // default
try {
    $avgObsDays = DB::connection($connection)
        ->table('observation_period')
        ->selectRaw('AVG(observation_period_end_date - observation_period_start_date) as avg_days')
        ->value('avg_days');
    if ($avgObsDays && (float) $avgObsDays > 0) {
        $avgObsYears = max(0.1, round((float) $avgObsDays / 365.25, 2));
    }
} catch (\Throwable) {
    // Fall back to 1 year if obs_period not accessible
}

$pppy = ($personCount > 0 && $avgObsYears > 0)
    ? round($totalCost / $personCount / $avgObsYears, 2)
    : 0;

return [
    'has_cost_data' => true,
    'domains' => $domains,
    'total_cost' => round($totalCost, 2),
    'person_count' => $personCount,
    'avg_observation_years' => $avgObsYears,
    'pppy' => $pppy,
];
```

- [ ] **11.2** Add PPPY card to `CostView.tsx` alongside existing summary.

After the summary stats grid, add a PPPY card row:

```tsx
{/* PPPY + Total Cost summary cards */}
{summary.total_cost !== undefined && (
  <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
    <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
      <p className="text-xl font-semibold text-[#2DD4BF]">{formatCurrency(summary.total_cost)}</p>
      <p className="text-[10px] text-[#666]">Total Cost</p>
    </div>
    <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
      <p className="text-xl font-semibold text-[#C9A227]">{formatCurrency(summary.pppy ?? 0)}</p>
      <p className="text-[10px] text-[#666]">Per-Patient-Per-Year</p>
    </div>
    <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
      <p className="text-xl font-semibold text-white">{(summary.person_count ?? 0).toLocaleString()}</p>
      <p className="text-[10px] text-[#666]">Persons</p>
    </div>
    <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
      <p className="text-xl font-semibold text-white">{(summary.avg_observation_years ?? 0).toFixed(1)} yr</p>
      <p className="text-[10px] text-[#666]">Avg Observation</p>
    </div>
  </div>
)}
```

**Test command:** `cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Unit/Services/Ares/CostPppyTest.php`

**Commit:** `feat(ares-v2): add PPPY (per-patient-per-year) metric to Cost panel`

---

## Task 12: Tests + Final Verification

Write backend tests for all new computations and verify the full stack.

**Files:**
- Create: `backend/tests/Unit/Services/Ares/DiversityServiceIndexTest.php`
- Create: `backend/tests/Unit/Services/Ares/FeasibilityScoringTest.php`
- Create: `backend/tests/Unit/Services/Ares/CostPppyTest.php`
- Create: `backend/tests/Unit/Services/Ares/UnmappedCodePriorityTest.php`
- Create: `backend/tests/Feature/Api/NetworkOverviewEnhancedTest.php`
- Create: `backend/tests/Feature/Api/AnnotationTagsTest.php`
- Create: `backend/tests/Feature/Api/ReleaseEditTest.php`

### Steps

- [ ] **12.1** Write `DiversityServiceIndexTest` — test Simpson's index computation.

```php
it('computes Simpson index correctly for uniform distribution', function () {
    // 4 groups at 25% each: Simpson = 1 - 4*(0.25^2) = 1 - 0.25 = 0.75
    $service = new \ReflectionClass(\App\Services\Ares\DiversityService::class);
    $method = $service->getMethod('computeSimpsonIndex');
    $method->setAccessible(true);

    $instance = app(\App\Services\Ares\DiversityService::class);
    $result = $method->invoke($instance,
        ['A' => 25, 'B' => 25, 'C' => 25, 'D' => 25],  // race
        ['H' => 50, 'NH' => 50],  // ethnicity
        ['M' => 50, 'F' => 50],  // gender
    );

    expect($result)->toBeGreaterThan(0.5);
    expect($result)->toBeLessThanOrEqual(1.0);
});

it('returns 0 for empty demographics', function () {
    $service = new \ReflectionClass(\App\Services\Ares\DiversityService::class);
    $method = $service->getMethod('computeSimpsonIndex');
    $method->setAccessible(true);

    $instance = app(\App\Services\Ares\DiversityService::class);
    $result = $method->invoke($instance, [], [], []);

    expect($result)->toBe(0.0);
});
```

- [ ] **12.2** Write `FeasibilityScoringTest` — test continuous score computation.

```php
it('returns 100% domain score when all required domains present', function () {
    // Test that domain_score = 100 when all required domains have data
    // (Integration test with mocked AchillesResult data)
});

it('returns partial domain score when some domains missing', function () {
    // 2 of 3 required domains present → 67%
});

it('computes weighted composite score correctly', function () {
    // domain=80, concept=100, visit=100, date=100, patient=50
    // composite = 80*0.20 + 100*0.30 + 100*0.15 + 100*0.15 + 50*0.20 = 16+30+15+15+10 = 86
});
```

- [ ] **12.3** Write `CostPppyTest` — test PPPY math.

```php
it('computes PPPY correctly', function () {
    // total_cost=1,000,000, person_count=1000, avg_obs_years=2.5
    // PPPY = 1000000 / 1000 / 2.5 = 400
});
```

- [ ] **12.4** Write `UnmappedCodePriorityTest` — test impact score computation.

```php
it('sorts unmapped codes by impact score descending', function () {
    // condition_occurrence with 100 records → score 100
    // observation with 200 records → score 100
    // condition should rank higher (100*1.0 vs 200*0.5)
});
```

- [ ] **12.5** Write `AnnotationTagsTest` — test tag filtering and search.

```php
it('filters annotations by tag', function () {
    // Create annotations with different tags, request with ?tag=data_event
    // Assert only matching annotations returned
});

it('searches annotations by text', function () {
    // Create annotations, request with ?search=vocab
    // Assert text-matched annotations returned
});
```

- [ ] **12.6** Write `ReleaseEditTest` — verify PUT endpoint works.

```php
it('updates release metadata via PUT', function () {
    // Create a release, PUT with new name/notes
    // Assert updated values returned
});
```

- [ ] **12.7** Write `NetworkOverviewEnhancedTest` — verify extended overview response.

```php
it('returns sparkline, freshness, domain_count, person_count per source', function () {
    // Hit GET /network/ares/overview
    // Assert each dq_summary entry has sparkline (array), days_since_refresh, domain_count, person_count
});
```

- [ ] **12.8** Run full test suite and fix any failures.

```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pest tests/Unit/Services/Ares/ tests/Feature/Api/
cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit
cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run
```

- [ ] **12.9** Run linting and static analysis.

```bash
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/pint --test
cd /home/smudoshi/Github/Parthenon/backend && vendor/bin/phpstan analyse
cd /home/smudoshi/Github/Parthenon/frontend && npx eslint .
```

**Commit:** `test(ares-v2): add Phase A tests for diversity index, feasibility scoring, PPPY, impact priority, tags, and release edit`

---

## Summary

| Task | Panel | Enhancements | Effort |
|------|-------|-------------|--------|
| 1 | Foundation | Migration (tag column) + TypeScript types | 15 min |
| 2 | Network Overview | Sparklines, freshness, domains, persons, row click, aggregate | 45 min |
| 3 | Concept Comparison | Wilson score confidence intervals | 20 min |
| 4 | DQ History | Green/amber/red zone shading | 10 min |
| 5 | Coverage Matrix | Obs period highlight, hover, view toggle, summary row/col | 40 min |
| 6 | Feasibility | Continuous 0-100 scoring + composite | 30 min |
| 7 | Diversity | Simpson's Diversity Index cards | 25 min |
| 8 | Releases | Inline edit form | 20 min |
| 9 | Unmapped Codes | Impact-weighted priority scoring | 20 min |
| 10 | Annotations | Tags + tag filter + full-text search | 35 min |
| 11 | Cost | PPPY metric | 20 min |
| 12 | Tests | Backend + frontend tests, lint, verify | 30 min |
| **Total** | | **~20 enhancements across 10 panels** | **~5 hours** |
