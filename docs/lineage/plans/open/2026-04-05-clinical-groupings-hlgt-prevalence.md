# Clinical Groupings: HLGT Sub-Groupings, Prevalence Overlay & Domain Counts Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix misleading domain root counts, add data prevalence badges to clinical grouping cards with per-source filtering, and build the AI-assisted pipeline for HLGT sub-groupings.

**Architecture:** Three independent workstreams touching the same surface area (VocabularyController, HierarchyBrowserPanel, vocabulary types). Task 1 fixes the domain counts bug. Tasks 2-4 add the prevalence overlay (backend endpoint + Redis cache + frontend source selector + card badges). Tasks 5-8 build the HLGT pipeline (AI script + JSON fixtures + seeder extension + backend API + frontend sub-grouping navigation).

**Tech Stack:** Laravel 11 (PHP 8.4), React 19 + TypeScript + TanStack Query, Python 3.12 + Ollama (II-Medical-8B), PostgreSQL 17, Redis 7

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `backend/app/Http/Controllers/Api/V1/VocabularyController.php` | `tree()`: add descendant_count for root queries. `groupings()`: add `include_children` param. New `groupingPrevalence()` method. |
| Modify | `backend/routes/api.php` | Add route for groupings/prevalence endpoint |
| Modify | `backend/database/seeders/ClinicalGroupingSeeder.php` | Second pass: read HLGT fixture JSONs, insert with parent_grouping_id |
| Modify | `frontend/src/features/vocabulary/types/vocabulary.ts` | Add `descendant_count` to ConceptTreeNode, `children` to ClinicalGrouping, new `GroupingPrevalence` type |
| Modify | `frontend/src/features/vocabulary/api/vocabularyApi.ts` | Add `fetchGroupingPrevalence()`, update `fetchClinicalGroupings()` with include_children param |
| Modify | `frontend/src/features/vocabulary/hooks/useClinicalGroupings.ts` | Pass include_children param |
| Modify | `frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx` | Fix root counts display, add source selector, prevalence badges, sub-grouping navigation |
| Create | `frontend/src/features/vocabulary/hooks/useGroupingPrevalence.ts` | TanStack Query hook for prevalence endpoint |
| Create | `scripts/generate_hlgt_subgroupings.py` | AI curation script: query SNOMED, prompt II-Medical-8B, output JSON fixtures |
| Create | `backend/database/fixtures/groupings/` | Directory for HLGT fixture JSON files (one per parent grouping) |

---

### Task 1: Fix Domain Root Counts (Backend + Frontend)

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/VocabularyController.php:481-509`
- Modify: `frontend/src/features/vocabulary/types/vocabulary.ts:129-137`
- Modify: `frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx:313-344`

- [ ] **Step 1: Add descendant_count to backend tree() endpoint**

In `backend/app/Http/Controllers/Api/V1/VocabularyController.php`, modify the `tree()` method. When `parentId === 0`, add a `descendant_count` subquery:

```php
public function tree(Request $request): JsonResponse
{
    $parentId = (int) $request->query('parent_concept_id', '0');
    $domainId = $request->query('domain_id');

    $query = DB::connection('vocab')
        ->table('concept_tree AS ct')
        ->select([
            'ct.child_concept_id AS concept_id',
            'ct.child_name AS concept_name',
            'ct.domain_id',
            'ct.vocabulary_id',
            'ct.concept_class_id',
            'ct.child_depth AS depth',
        ])
        ->selectRaw('(SELECT COUNT(*) FROM vocab.concept_tree ct2 WHERE ct2.parent_concept_id = ct.child_concept_id AND ct2.domain_id = ct.domain_id) AS child_count')
        ->where('ct.parent_concept_id', $parentId);

    // For root-level queries, add total descendant count per domain
    if ($parentId === 0) {
        $query->selectRaw('(SELECT COUNT(DISTINCT ct3.child_concept_id) FROM vocab.concept_tree ct3 WHERE ct3.domain_id = ct.domain_id AND ct3.parent_concept_id != 0) AS descendant_count');
    }

    if ($domainId) {
        $query->where('ct.domain_id', $domainId);
    }

    $results = $query->orderBy('ct.child_name')->limit(500)->get();

    return response()->json([
        'data' => $results,
        'parent_concept_id' => $parentId,
    ]);
}
```

- [ ] **Step 2: Add descendant_count to ConceptTreeNode type**

In `frontend/src/features/vocabulary/types/vocabulary.ts`, update the interface:

```typescript
export interface ConceptTreeNode {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  concept_class_id: string;
  child_count: number;
  depth: number;
  descendant_count?: number;
}
```

- [ ] **Step 3: Update root domain cards to show descendant_count**

In `frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx`, find the root-level domain card rendering (the `isRootLevel` block around line 313). Change the count display:

Replace:
```tsx
<span className="text-[10px] text-[#5A5650]">
  {node.child_count.toLocaleString()} categories
</span>
```

With:
```tsx
<span className="text-[10px] text-[#5A5650]">
  {(node.descendant_count ?? node.child_count).toLocaleString()} concepts
</span>
```

- [ ] **Step 4: Verify the fix**

Run TypeScript check and test in browser:

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

Then open the Browse Hierarchy tab and confirm:
- Condition shows ~106,444 concepts (not "2 categories")
- Procedure shows ~48,430 concepts (not "1")
- Other domains show their descendant counts
- Drilling into a domain still works correctly

- [ ] **Step 5: Run Pint and commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
git add backend/app/Http/Controllers/Api/V1/VocabularyController.php frontend/src/features/vocabulary/types/vocabulary.ts frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx
git commit -m "fix(vocabulary): show total concept count instead of direct children on domain root cards"
```

---

### Task 2: Prevalence Overlay — Backend Endpoint

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/VocabularyController.php:517-563`
- Modify: `backend/routes/api.php:540`

- [ ] **Step 1: Add the route**

In `backend/routes/api.php`, add the prevalence route right after the existing groupings route (line 540):

```php
Route::get('/vocabulary/groupings', [VocabularyController::class, 'groupings']);
Route::get('/vocabulary/groupings/prevalence', [VocabularyController::class, 'groupingPrevalence']);
```

**Important:** The prevalence route MUST come before the tree route and after the groupings route. Since Laravel matches top-down, placing it right after `/vocabulary/groupings` is correct.

- [ ] **Step 2: Add the groupingPrevalence method**

In `backend/app/Http/Controllers/Api/V1/VocabularyController.php`, add the following use statements at the top if not already present:

```php
use App\Enums\DaimonType;
use App\Models\App\Source;
use Illuminate\Support\Facades\Cache;
```

Then add the method after the `groupings()` method:

```php
/**
 * GET /v1/vocabulary/groupings/prevalence
 *
 * Return person_count and record_count per clinical grouping, aggregated
 * across all CDM sources or filtered to a single source.
 */
public function groupingPrevalence(Request $request): JsonResponse
{
    $domainId = $request->query('domain_id');
    $sourceId = $request->query('source_id');

    if (! $domainId) {
        return response()->json(['error' => 'domain_id is required'], 422);
    }

    $cacheKey = "grouping_prevalence:{$domainId}:{$sourceId ?? 'all'}";

    $data = Cache::remember($cacheKey, now()->addHours(24), function () use ($domainId, $sourceId) {
        // Get all groupings for this domain
        $groupings = ClinicalGrouping::query()
            ->whereNull('parent_grouping_id')
            ->where('domain_id', $domainId)
            ->get();

        // Determine which Achilles analysis IDs to use
        $domainKey = strtolower($domainId);
        $personAnalysisId = match ($domainKey) {
            'condition' => 400,
            'procedure' => 600,
            'drug' => 700,
            'measurement' => 1800,
            'observation' => 800,
            default => null,
        };
        $recordAnalysisId = match ($domainKey) {
            'condition' => 401,
            'procedure' => 601,
            'drug' => 701,
            'measurement' => 1801,
            'observation' => 801,
            default => null,
        };

        if ($personAnalysisId === null) {
            return [];
        }

        // Discover results schemas from sources + daimons
        $sourcesQuery = Source::with('daimons');
        if ($sourceId) {
            $sourcesQuery->where('id', $sourceId);
        }
        $sources = $sourcesQuery->get();

        $resultsSchemas = [];
        foreach ($sources as $source) {
            $schema = $source->getTableQualifier(DaimonType::Results);
            if ($schema) {
                $resultsSchemas[] = $schema;
            }
        }

        if (empty($resultsSchemas)) {
            return [];
        }

        // Collect all anchor concept IDs across all groupings
        $allAnchorIds = $groupings->flatMap(fn ($g) => $g->anchor_concept_ids)->unique()->values()->all();

        if (empty($allAnchorIds)) {
            return [];
        }

        // Get all descendant concept IDs for all anchors in one query
        $anchorPlaceholders = implode(',', array_fill(0, count($allAnchorIds), '?'));
        $descendantRows = DB::connection('vocab')->select("
            SELECT ca.ancestor_concept_id, ca.descendant_concept_id
            FROM vocab.concept_ancestor ca
            WHERE ca.ancestor_concept_id IN ({$anchorPlaceholders})
        ", $allAnchorIds);

        // Build a map: anchor_concept_id => [descendant_concept_ids]
        $descendantMap = [];
        foreach ($descendantRows as $row) {
            $descendantMap[$row->ancestor_concept_id][] = $row->descendant_concept_id;
        }

        // For each grouping, collect all descendant concept IDs from all its anchors
        $groupingDescendants = [];
        foreach ($groupings as $grouping) {
            $allDescendants = [];
            foreach ($grouping->anchor_concept_ids as $anchorId) {
                $allDescendants = array_merge($allDescendants, $descendantMap[$anchorId] ?? [$anchorId]);
            }
            $groupingDescendants[$grouping->id] = array_unique($allDescendants);
        }

        // Query Achilles results across all results schemas
        $personCounts = [];
        $recordCounts = [];

        foreach ($resultsSchemas as $schema) {
            // Person counts (analysis 400/600/etc.)
            $personRows = DB::connection('pgsql')->select("
                SELECT CAST(ar.stratum_1 AS INTEGER) AS concept_id, ar.count_value
                FROM {$schema}.achilles_results ar
                WHERE ar.analysis_id = ?
                  AND ar.stratum_1 IS NOT NULL
                  AND ar.stratum_1 != ''
            ", [$personAnalysisId]);

            foreach ($personRows as $row) {
                $cid = (int) $row->concept_id;
                $personCounts[$cid] = ($personCounts[$cid] ?? 0) + (int) $row->count_value;
            }

            // Record counts (analysis 401/601/etc.)
            $recordRows = DB::connection('pgsql')->select("
                SELECT CAST(ar.stratum_1 AS INTEGER) AS concept_id, ar.count_value
                FROM {$schema}.achilles_results ar
                WHERE ar.analysis_id = ?
                  AND ar.stratum_1 IS NOT NULL
                  AND ar.stratum_1 != ''
            ", [$recordAnalysisId]);

            foreach ($recordRows as $row) {
                $cid = (int) $row->concept_id;
                $recordCounts[$cid] = ($recordCounts[$cid] ?? 0) + (int) $row->count_value;
            }
        }

        // Aggregate per grouping
        $result = [];
        foreach ($groupings as $grouping) {
            $descendants = $groupingDescendants[$grouping->id] ?? [];
            $personTotal = 0;
            $recordTotal = 0;

            foreach ($descendants as $cid) {
                $personTotal += $personCounts[$cid] ?? 0;
                $recordTotal += $recordCounts[$cid] ?? 0;
            }

            $result[] = [
                'grouping_id' => $grouping->id,
                'person_count' => $personTotal,
                'record_count' => $recordTotal,
            ];
        }

        return $result;
    });

    return response()->json([
        'data' => $data,
        'source' => $sourceId ? (int) $sourceId : 'all',
    ]);
}
```

- [ ] **Step 3: Run Pint and verify**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

Test the endpoint manually:

```bash
curl -s -H "Authorization: Bearer $(curl -s http://localhost:8082/api/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@acumenus.net","password":"YOUR_PASSWORD"}' | jq -r .token)" \
  'http://localhost:8082/api/v1/vocabulary/groupings/prevalence?domain_id=Condition' | jq '.data[:3]'
```

Expected: Array of objects with `grouping_id`, `person_count > 0`, `record_count > 0`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/VocabularyController.php backend/routes/api.php
git commit -m "feat(vocabulary): add grouping prevalence endpoint with cross-source aggregation and Redis caching"
```

---

### Task 3: Prevalence Overlay — Frontend Types, API, Hook

**Files:**
- Modify: `frontend/src/features/vocabulary/types/vocabulary.ts:147-158`
- Modify: `frontend/src/features/vocabulary/api/vocabularyApi.ts:156-163`
- Create: `frontend/src/features/vocabulary/hooks/useGroupingPrevalence.ts`

- [ ] **Step 1: Add prevalence types**

In `frontend/src/features/vocabulary/types/vocabulary.ts`, add after the `ClinicalGrouping` interface:

```typescript
export interface GroupingPrevalence {
  grouping_id: number;
  person_count: number;
  record_count: number;
}
```

- [ ] **Step 2: Add fetchGroupingPrevalence API function**

In `frontend/src/features/vocabulary/api/vocabularyApi.ts`, add the import for `GroupingPrevalence` to the existing type import block:

```typescript
import type {
  Concept,
  ConceptSearchParams,
  ConceptSearchResult,
  ConceptRelationship,
  PaginatedRelationships,
  ConceptHierarchyNode,
  DomainInfo,
  VocabularyInfo,
  SemanticSearchResult,
  ConceptComparisonEntry,
  MapsFromResult,
  SuggestResult,
  ConceptTreeNode,
  ClinicalGrouping,
  GroupingPrevalence,
} from "../types/vocabulary";
```

Then add the function after `fetchClinicalGroupings`:

```typescript
export async function fetchGroupingPrevalence(
  domainId: string,
  sourceId?: number | null,
): Promise<GroupingPrevalence[]> {
  const params: Record<string, unknown> = { domain_id: domainId };
  if (sourceId) {
    params.source_id = sourceId;
  }
  const { data } = await apiClient.get(`${BASE}/groupings/prevalence`, { params });
  return data.data ?? [];
}
```

- [ ] **Step 3: Create useGroupingPrevalence hook**

Create `frontend/src/features/vocabulary/hooks/useGroupingPrevalence.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchGroupingPrevalence } from "../api/vocabularyApi";

export function useGroupingPrevalence(domainId: string | null, sourceId?: number | null) {
  return useQuery({
    queryKey: ["vocabulary", "groupings", "prevalence", domainId, sourceId],
    queryFn: () => fetchGroupingPrevalence(domainId!, sourceId),
    enabled: !!domainId,
    staleTime: 1000 * 60 * 60, // 1 hour — data changes infrequently
  });
}
```

- [ ] **Step 4: TypeScript check**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/vocabulary/types/vocabulary.ts frontend/src/features/vocabulary/api/vocabularyApi.ts frontend/src/features/vocabulary/hooks/useGroupingPrevalence.ts
git commit -m "feat(vocabulary): add prevalence types, API function and TanStack Query hook"
```

---

### Task 4: Prevalence Overlay — Frontend UI (Source Selector + Card Badges)

**Files:**
- Modify: `frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx`

- [ ] **Step 1: Add imports and state**

In `HierarchyBrowserPanel.tsx`, add these imports at the top:

```typescript
import { useState, useMemo, useCallback } from "react";
import { ChevronRight, FolderTree, Loader2, Search, Info, X, LayoutGrid, List, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConceptTree } from "../hooks/useConceptTree";
import { useClinicalGroupings } from "../hooks/useClinicalGroupings";
import { useGroupingPrevalence } from "../hooks/useGroupingPrevalence";
import { useSources } from "@/features/data-sources/hooks/useSources";
import type { ConceptTreeNode, ClinicalGrouping, AnchorDetail, GroupingPrevalence } from "../types/vocabulary";
```

Add source selector state inside the component function, after the existing state declarations:

```typescript
const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
```

Add the hooks after existing hooks:

```typescript
const { data: prevalenceData, isLoading: prevalenceLoading } = useGroupingPrevalence(activeDomain, selectedSourceId);
const { data: sources } = useSources();
```

Add a helper to build a prevalence lookup map, after the hooks:

```typescript
const prevalenceMap = useMemo(() => {
  const map = new Map<number, GroupingPrevalence>();
  if (prevalenceData) {
    for (const p of prevalenceData) {
      map.set(p.grouping_id, p);
    }
  }
  return map;
}, [prevalenceData]);
```

- [ ] **Step 2: Add source selector UI**

In the groupings toggle section (the `isDomainLevel && SNOMED_DOMAINS.has(...)` block around line 216), add a source selector. Replace the entire block:

```tsx
{isDomainLevel && SNOMED_DOMAINS.has(activeDomain ?? "") && (
  <div className="flex items-center justify-between px-4 py-2 border-b border-[#232328] bg-[#0E0E11]/80 shrink-0">
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-[#5A5650]">
        {shouldShowGroupings
          ? `${groupings?.length ?? 0} clinical groupings`
          : `${sortedAndFilteredNodes.length} concepts`}
      </span>
      {shouldShowGroupings && sources && sources.length > 0 && (
        <div className="relative">
          <select
            value={selectedSourceId ?? ""}
            onChange={(e) => setSelectedSourceId(e.target.value ? Number(e.target.value) : null)}
            className="appearance-none rounded border border-[#232328] bg-[#1A1A1E] px-2 py-0.5 pr-5 text-[10px] text-[#8A857D] focus:border-[#C9A227]/50 focus:outline-none cursor-pointer"
          >
            <option value="">All Sources</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>{s.source_name}</option>
            ))}
          </select>
          <ChevronDown size={8} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#5A5650] pointer-events-none" />
        </div>
      )}
    </div>
    <button
      type="button"
      onClick={() => setShowGroupings((prev) => !prev)}
      className="flex items-center gap-1 text-[10px] text-[#C9A227] hover:text-[#E5C84B] transition-colors"
    >
      {shouldShowGroupings ? (
        <>
          <List size={10} />
          Show all concepts
        </>
      ) : (
        <>
          <LayoutGrid size={10} />
          Show groupings
        </>
      )}
    </button>
  </div>
)}
```

- [ ] **Step 3: Reset source selection on domain change**

In the `handleBreadcrumbClick` callback, when navigating to root (index === -1), add the reset:

```typescript
if (index === -1) {
  setBreadcrumbs([]);
  setParentId(0);
  setActiveDomain(null);
  setShowGroupings(true);
  setGroupingAnchors(null);
  setSelectedSourceId(null);
}
```

- [ ] **Step 4: Pass prevalenceMap and prevalenceLoading to GroupingsGrid**

Update the `GroupingsGrid` invocation to pass the prevalence data:

```tsx
<GroupingsGrid
  groupings={groupings}
  onGroupingClick={handleGroupingClick}
  prevalenceMap={prevalenceMap}
  prevalenceLoading={prevalenceLoading}
/>
```

- [ ] **Step 5: Update GroupingsGrid to show prevalence badges**

Add a number formatter helper above the `GroupingsGrid` component:

```typescript
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}
```

Update the `GroupingsGrid` function signature and add prevalence badges to each card:

```tsx
function GroupingsGrid({
  groupings,
  onGroupingClick,
  prevalenceMap,
  prevalenceLoading,
}: {
  groupings: ClinicalGrouping[];
  onGroupingClick: (g: ClinicalGrouping) => void;
  prevalenceMap?: Map<number, GroupingPrevalence>;
  prevalenceLoading?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 p-1">
      {groupings.map((g) => {
        const accentColor = g.color ?? DOMAIN_COLORS[g.domain_id] ?? "#8A857D";
        const prev = prevalenceMap?.get(g.id);
        return (
          <button
            key={g.id}
            type="button"
            onClick={() => onGroupingClick(g)}
            className="flex flex-col items-start rounded-lg border border-[#232328] bg-[#1A1A1E] text-left transition-all hover:bg-[#232328] hover:border-[#323238] group overflow-hidden"
          >
            <div className="flex w-full">
              {/* Left accent bar */}
              <div
                className="w-[3px] shrink-0 rounded-l-lg"
                style={{ backgroundColor: accentColor }}
              />
              <div className="flex flex-col gap-1 p-3 min-w-0 flex-1">
                <span className="text-xs font-medium text-[#F0EDE8] truncate">
                  {g.name}
                </span>
                {g.description && (
                  <span className="text-[10px] text-[#8A857D] line-clamp-2 leading-tight">
                    {g.description}
                  </span>
                )}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-[#5A5650]">
                    {g.anchors.length > 1
                      ? `${g.anchors.length} subcategories`
                      : g.anchors[0]?.concept_name ?? "1 anchor"}
                  </span>
                  <ChevronRight
                    size={10}
                    className="text-[#5A5650] group-hover:text-[#8A857D] transition-colors"
                  />
                </div>
                {/* Prevalence badges */}
                {prevalenceLoading ? (
                  <div className="flex gap-2 mt-1">
                    <span className="h-3 w-16 rounded bg-[#232328] animate-pulse" />
                    <span className="h-3 w-16 rounded bg-[#232328] animate-pulse" />
                  </div>
                ) : prev && (prev.person_count > 0 || prev.record_count > 0) ? (
                  <div className="flex gap-2 mt-1">
                    {prev.person_count > 0 && (
                      <span className="text-[9px] text-[#5A5650]">
                        {formatCount(prev.person_count)} persons
                      </span>
                    )}
                    {prev.record_count > 0 && (
                      <span className="text-[9px] text-[#5A5650]">
                        {formatCount(prev.record_count)} records
                      </span>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: TypeScript check and verify**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

Open the Browse Hierarchy tab, drill into Condition, and verify:
- Source selector appears next to groupings count
- Grouping cards show person/record counts after loading
- Changing source dropdown updates the counts
- Shimmer placeholders show while loading

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx
git commit -m "feat(vocabulary): add source selector and prevalence badges to clinical grouping cards"
```

---

### Task 5: HLGT Sub-Groupings — AI Curation Script

**Files:**
- Create: `scripts/generate_hlgt_subgroupings.py`

- [ ] **Step 1: Create the script**

Create `scripts/generate_hlgt_subgroupings.py`:

```python
#!/usr/bin/env python3
"""Generate HLGT-level sub-groupings for clinical groupings using II-Medical-8B.

For each Condition-domain parent grouping, queries SNOMED hierarchy for immediate
children of anchor concepts, then uses the medical LLM to cluster them into
clinically meaningful sub-categories. Outputs one JSON fixture file per parent
grouping in backend/database/fixtures/groupings/.

Usage:
    python scripts/generate_hlgt_subgroupings.py [--dry-run] [--grouping NAME]

Requires:
    - PostgreSQL access (uses ~/.pgpass or PGPASSWORD)
    - Ollama running with II-Medical-8B model
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

import psycopg2
import requests

# ── Configuration ──────────────────────────────────────────────────────────────

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "5432"))
DB_NAME = os.getenv("DB_NAME", "parthenon")
DB_USER = os.getenv("DB_USER", "claude_dev")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL_NAME = os.getenv("MODEL_NAME", "ii-medical:8b-q8_0")

FIXTURES_DIR = Path(__file__).parent.parent / "backend" / "database" / "fixtures" / "groupings"

# ── Database ───────────────────────────────────────────────────────────────────


def get_db_connection() -> psycopg2.extensions.connection:
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER
    )


def fetch_parent_groupings(conn: psycopg2.extensions.connection, grouping_name: str | None = None) -> list[dict[str, Any]]:
    """Fetch Condition-domain parent groupings from app.clinical_groupings."""
    sql = """
        SELECT id, name, description, anchor_concept_ids
        FROM app.clinical_groupings
        WHERE domain_id = 'Condition'
          AND parent_grouping_id IS NULL
    """
    params: list[Any] = []
    if grouping_name:
        sql += " AND name = %s"
        params.append(grouping_name)
    sql += " ORDER BY sort_order"

    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    result = []
    for row in rows:
        anchor_ids_raw = row[3]
        if isinstance(anchor_ids_raw, str):
            anchor_ids = [int(x) for x in anchor_ids_raw.strip("{}").split(",") if x]
        elif isinstance(anchor_ids_raw, list):
            anchor_ids = [int(x) for x in anchor_ids_raw]
        else:
            anchor_ids = []

        result.append({
            "id": row[0],
            "name": row[1],
            "description": row[2],
            "anchor_concept_ids": anchor_ids,
        })
    return result


def fetch_anchor_children(conn: psycopg2.extensions.connection, anchor_ids: list[int]) -> list[dict[str, Any]]:
    """Fetch immediate SNOMED children of the given anchor concepts from concept_ancestor."""
    if not anchor_ids:
        return []

    placeholders = ",".join(["%s"] * len(anchor_ids))
    sql = f"""
        SELECT DISTINCT c.concept_id, c.concept_name, c.concept_class_id
        FROM vocab.concept_ancestor ca
        JOIN vocab.concept c ON c.concept_id = ca.descendant_concept_id
        WHERE ca.ancestor_concept_id IN ({placeholders})
          AND ca.min_levels_of_separation = 1
          AND c.standard_concept = 'S'
          AND c.invalid_reason IS NULL
          AND c.vocabulary_id = 'SNOMED'
        ORDER BY c.concept_name
    """

    with conn.cursor() as cur:
        cur.execute(sql, anchor_ids)
        return [
            {"concept_id": r[0], "concept_name": r[1], "concept_class_id": r[2]}
            for r in cur.fetchall()
        ]


def verify_concept_ids(conn: psycopg2.extensions.connection, concept_ids: list[int]) -> list[int]:
    """Return only concept_ids that exist in vocab.concept."""
    if not concept_ids:
        return []
    placeholders = ",".join(["%s"] * len(concept_ids))
    sql = f"SELECT concept_id FROM vocab.concept WHERE concept_id IN ({placeholders})"
    with conn.cursor() as cur:
        cur.execute(sql, concept_ids)
        return [r[0] for r in cur.fetchall()]


# ── LLM ────────────────────────────────────────────────────────────────────────


def query_llm(prompt: str) -> str:
    """Send a prompt to II-Medical-8B via Ollama and return the response."""
    resp = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 4096},
        },
        timeout=300,
    )
    resp.raise_for_status()
    return resp.json()["response"]


def build_prompt(grouping_name: str, children: list[dict[str, Any]]) -> str:
    """Build the LLM prompt for grouping children into HLGT-level sub-categories."""
    child_list = "\n".join(
        f"  - {c['concept_name']} (concept_id: {c['concept_id']}, class: {c['concept_class_id']})"
        for c in children
    )

    return f"""You are a clinical informatics specialist. Given the following SNOMED CT concepts that are immediate children of the "{grouping_name}" clinical grouping, organize them into clinically meaningful sub-categories analogous to MedDRA High Level Group Terms (HLGTs).

Each sub-category should:
1. Have a clear, concise clinical name (2-5 words)
2. Have a one-sentence description
3. Contain the concept_ids of its member concepts
4. Be clinically meaningful to a researcher browsing conditions

SNOMED concepts under "{grouping_name}":
{child_list}

Return ONLY a JSON array of sub-categories. No markdown, no explanation. Example format:
[
  {{
    "name": "Coronary artery disorders",
    "description": "Ischemic heart disease, coronary atherosclerosis, and acute coronary syndromes",
    "anchor_concept_ids": [312327, 4185932]
  }}
]

Important rules:
- Every concept_id in the input MUST appear in exactly one sub-category
- Do NOT invent concept_ids that are not in the input list
- Aim for 5-20 sub-categories (depending on how many concepts there are)
- Group by clinical similarity, not alphabetically
- If a concept doesn't fit any group, create an "Other {grouping_name} disorders" catch-all

JSON array:"""


def parse_llm_response(response: str) -> list[dict[str, Any]]:
    """Extract JSON array from LLM response, handling common formatting issues."""
    # Try to find a JSON array in the response
    response = response.strip()

    # Remove markdown code fences if present
    response = re.sub(r"^```(?:json)?\s*", "", response)
    response = re.sub(r"\s*```$", "", response)

    try:
        parsed = json.loads(response)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    # Try to find array within the response
    match = re.search(r"\[.*\]", response, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    print(f"  WARNING: Could not parse LLM response as JSON", file=sys.stderr)
    return []


# ── Main ─────��─────────────────────────────────────────────────────────────────


def process_grouping(
    conn: psycopg2.extensions.connection,
    grouping: dict[str, Any],
    dry_run: bool = False,
) -> dict[str, Any] | None:
    """Process a single parent grouping: fetch children, query LLM, validate, output."""
    name = grouping["name"]
    anchor_ids = grouping["anchor_concept_ids"]

    print(f"\n{'='*60}")
    print(f"Processing: {name}")
    print(f"  Anchors: {anchor_ids}")

    children = fetch_anchor_children(conn, anchor_ids)
    print(f"  Found {len(children)} immediate children")

    if len(children) < 3:
        print(f"  SKIP: Too few children for sub-grouping")
        return None

    if dry_run:
        print(f"  DRY RUN: Would query LLM with {len(children)} concepts")
        return None

    prompt = build_prompt(name, children)
    print(f"  Querying {MODEL_NAME}...")

    raw_response = query_llm(prompt)
    sub_groupings = parse_llm_response(raw_response)

    if not sub_groupings:
        print(f"  ERROR: No valid sub-groupings returned")
        return None

    print(f"  LLM returned {len(sub_groupings)} sub-groupings")

    # Validate concept IDs
    all_returned_ids: set[int] = set()
    for sg in sub_groupings:
        ids = sg.get("anchor_concept_ids", [])
        valid_ids = verify_concept_ids(conn, ids)
        invalid = set(ids) - set(valid_ids)
        if invalid:
            print(f"  WARNING: Removing invalid concept_ids from '{sg['name']}': {invalid}")
        sg["anchor_concept_ids"] = valid_ids
        all_returned_ids.update(valid_ids)

    # Check for missing children
    input_ids = {c["concept_id"] for c in children}
    missing = input_ids - all_returned_ids
    if missing:
        print(f"  WARNING: {len(missing)} input concepts not assigned to any sub-grouping")

    # Remove empty sub-groupings
    sub_groupings = [sg for sg in sub_groupings if sg.get("anchor_concept_ids")]

    # Assign colors (rotate through a palette)
    palette = [
        "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6",
        "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
        "#0EA5E9", "#D946EF", "#22D3EE", "#A855F7", "#FBBF24",
    ]
    for i, sg in enumerate(sub_groupings):
        sg["icon"] = "folder"
        sg["color"] = palette[i % len(palette)]

    fixture = {
        "parent_grouping": name,
        "domain_id": "Condition",
        "sub_groupings": sub_groupings,
    }

    print(f"  Final: {len(sub_groupings)} validated sub-groupings")
    return fixture


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate HLGT sub-groupings via medical LLM")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without querying LLM")
    parser.add_argument("--grouping", type=str, help="Process only this named grouping")
    args = parser.parse_args()

    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    conn = get_db_connection()
    try:
        groupings = fetch_parent_groupings(conn, args.grouping)
        print(f"Found {len(groupings)} parent groupings to process")

        results: list[dict[str, Any]] = []
        for grouping in groupings:
            fixture = process_grouping(conn, grouping, dry_run=args.dry_run)
            if fixture:
                results.append(fixture)

                # Write fixture file
                slug = re.sub(r"[^a-z0-9]+", "_", grouping["name"].lower()).strip("_")
                filepath = FIXTURES_DIR / f"{slug}_hlgt.json"
                with open(filepath, "w") as f:
                    json.dump(fixture, f, indent=2)
                print(f"  Written: {filepath}")

        print(f"\n{'='*60}")
        print(f"Done. Generated {len(results)} fixture files in {FIXTURES_DIR}")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Make executable and test dry-run**

```bash
chmod +x scripts/generate_hlgt_subgroupings.py
python3 scripts/generate_hlgt_subgroupings.py --dry-run
```

Expected: Lists all 27 Condition groupings with anchor IDs and child counts, without querying the LLM.

- [ ] **Step 3: Test with a single grouping**

```bash
python3 scripts/generate_hlgt_subgroupings.py --grouping "Cardiovascular"
```

Expected: Queries II-Medical-8B, generates `backend/database/fixtures/groupings/cardiovascular_hlgt.json` with ~10-15 sub-groupings.

- [ ] **Step 4: Review the output and commit**

Inspect the generated JSON file for clinical accuracy. Then:

```bash
git add scripts/generate_hlgt_subgroupings.py
git commit -m "feat(vocabulary): add AI-assisted HLGT sub-grouping generation script"
```

- [ ] **Step 5: Run for all groupings**

```bash
python3 scripts/generate_hlgt_subgroupings.py
```

This will take ~15-30 minutes depending on LLM speed. Review all generated JSON files in `backend/database/fixtures/groupings/`. Make manual corrections as needed.

- [ ] **Step 6: Commit fixture files**

```bash
git add backend/database/fixtures/groupings/
git commit -m "feat(vocabulary): add HLGT sub-grouping fixtures for all Condition groupings"
```

---

### Task 6: HLGT Sub-Groupings — Seeder Extension

**Files:**
- Modify: `backend/database/seeders/ClinicalGroupingSeeder.php`

- [ ] **Step 1: Add second pass to the seeder**

In `backend/database/seeders/ClinicalGroupingSeeder.php`, add the HLGT fixture loading after the existing upsert. Replace the `run()` method:

```php
public function run(): void
{
    $groupings = $this->getGroupingDefinitions();

    $rows = [];
    $sortOrder = 0;

    foreach ($groupings as $grouping) {
        $sortOrder++;
        $resolvedIds = $this->resolveAnchorIds($grouping['anchors']);

        if (empty($resolvedIds)) {
            Log::warning("ClinicalGroupingSeeder: skipping '{$grouping['name']}' — no valid anchor concepts found");

            continue;
        }

        $rows[] = [
            'name' => $grouping['name'],
            'description' => $grouping['description'],
            'domain_id' => $grouping['domain_id'],
            'anchor_concept_ids' => '{'.implode(',', $resolvedIds).'}',
            'sort_order' => $sortOrder,
            'icon' => $grouping['icon'] ?? null,
            'color' => $grouping['color'] ?? null,
            'parent_grouping_id' => null,
        ];
    }

    // Upsert by name + domain_id for idempotency
    DB::table('clinical_groupings')->upsert(
        $rows,
        ['name', 'domain_id'],
        ['description', 'anchor_concept_ids', 'sort_order', 'icon', 'color']
    );

    $this->command->info('Seeded '.count($rows).' clinical groupings');

    // Second pass: HLGT sub-groupings from fixture files
    $this->seedHlgtFixtures();
}

/**
 * Load HLGT sub-grouping fixture files and insert as child groupings.
 */
private function seedHlgtFixtures(): void
{
    $fixturesDir = database_path('fixtures/groupings');

    if (! is_dir($fixturesDir)) {
        $this->command->info('No HLGT fixtures directory found — skipping sub-groupings');

        return;
    }

    $files = glob($fixturesDir.'/*_hlgt.json');
    $totalInserted = 0;

    foreach ($files as $file) {
        $data = json_decode(file_get_contents($file), true);

        if (! $data || empty($data['sub_groupings'])) {
            continue;
        }

        // Look up the parent grouping by name + domain_id
        $parent = DB::table('clinical_groupings')
            ->where('name', $data['parent_grouping'])
            ->where('domain_id', $data['domain_id'])
            ->whereNull('parent_grouping_id')
            ->first();

        if (! $parent) {
            Log::warning("ClinicalGroupingSeeder: parent '{$data['parent_grouping']}' not found — skipping HLGT file ".basename($file));

            continue;
        }

        $childSortOrder = 0;
        $childRows = [];

        foreach ($data['sub_groupings'] as $sg) {
            $childSortOrder++;

            // Verify anchor concept IDs exist
            $validIds = [];
            foreach ($sg['anchor_concept_ids'] ?? [] as $id) {
                $exists = DB::connection('omop')->selectOne(
                    'SELECT concept_id FROM vocab.concept WHERE concept_id = ?',
                    [$id]
                );
                if ($exists) {
                    $validIds[] = $id;
                }
            }

            if (empty($validIds)) {
                Log::warning("ClinicalGroupingSeeder: skipping HLGT '{$sg['name']}' under '{$data['parent_grouping']}' — no valid anchors");

                continue;
            }

            $childRows[] = [
                'name' => $sg['name'],
                'description' => $sg['description'] ?? null,
                'domain_id' => $data['domain_id'],
                'anchor_concept_ids' => '{'.implode(',', $validIds).'}',
                'sort_order' => $childSortOrder,
                'icon' => $sg['icon'] ?? null,
                'color' => $sg['color'] ?? null,
                'parent_grouping_id' => $parent->id,
            ];
        }

        if (! empty($childRows)) {
            // Delete existing children for this parent before re-inserting
            // (simpler than upsert with parent_grouping_id since names may change)
            DB::table('clinical_groupings')
                ->where('parent_grouping_id', $parent->id)
                ->delete();

            DB::table('clinical_groupings')->insert($childRows);
            $totalInserted += count($childRows);
        }
    }

    $this->command->info("Seeded {$totalInserted} HLGT sub-groupings from fixtures");
}
```

- [ ] **Step 2: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

- [ ] **Step 3: Test the seeder**

```bash
docker compose exec php php artisan db:seed --class=ClinicalGroupingSeeder
```

Verify the sub-groupings were inserted:

```bash
psql -h localhost -U claude_dev -d parthenon -c "
SELECT cg.name, p.name AS parent_name, array_length(cg.anchor_concept_ids, 1) AS anchor_count
FROM app.clinical_groupings cg
LEFT JOIN app.clinical_groupings p ON p.id = cg.parent_grouping_id
WHERE cg.parent_grouping_id IS NOT NULL
ORDER BY p.name, cg.sort_order
LIMIT 20;
"
```

- [ ] **Step 4: Commit**

```bash
git add backend/database/seeders/ClinicalGroupingSeeder.php
git commit -m "feat(vocabulary): extend seeder to load HLGT sub-groupings from fixture files"
```

---

### Task 7: HLGT Sub-Groupings — Backend API (include_children)

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/VocabularyController.php:517-563`

- [ ] **Step 1: Add include_children parameter to groupings endpoint**

In `VocabularyController.php`, update the `groupings()` method:

```php
public function groupings(Request $request): JsonResponse
{
    $domainId = $request->query('domain_id');
    $includeChildren = filter_var($request->query('include_children', 'false'), FILTER_VALIDATE_BOOLEAN);

    $query = ClinicalGrouping::query()
        ->whereNull('parent_grouping_id')
        ->orderBy('sort_order');

    if ($includeChildren) {
        $query->with(['children' => fn ($q) => $q->orderBy('sort_order')]);
    }

    if ($domainId) {
        $query->where('domain_id', $domainId);
    }

    $groupings = $query->get();

    // Resolve anchor concept names for all groupings (parent + children)
    $allAnchorIds = $groupings->flatMap(fn ($g) => $g->anchor_concept_ids ?? [])->unique();

    if ($includeChildren) {
        $childAnchorIds = $groupings->flatMap(fn ($g) => $g->children->flatMap(fn ($c) => $c->anchor_concept_ids ?? []))->unique();
        $allAnchorIds = $allAnchorIds->merge($childAnchorIds)->unique();
    }

    $allAnchorIds = $allAnchorIds->values()->all();

    if (! empty($allAnchorIds)) {
        $placeholders = implode(',', array_fill(0, count($allAnchorIds), '?'));
        $anchorDetails = collect(DB::connection('vocab')->select("
            SELECT c.concept_id, c.concept_name, c.domain_id, c.vocabulary_id, c.concept_class_id
            FROM vocab.concept c
            WHERE c.concept_id IN ({$placeholders})
        ", $allAnchorIds))->keyBy('concept_id');
    } else {
        $anchorDetails = collect();
    }

    $enrichGrouping = function ($g) use ($anchorDetails) {
        $arr = $g->toArray();
        $arr['anchors'] = collect($g->anchor_concept_ids ?? [])->map(function ($id) use ($anchorDetails) {
            $detail = $anchorDetails->get($id);

            return $detail ? [
                'concept_id' => $detail->concept_id,
                'concept_name' => $detail->concept_name,
                'domain_id' => $detail->domain_id,
                'vocabulary_id' => $detail->vocabulary_id,
                'concept_class_id' => $detail->concept_class_id,
            ] : null;
        })->filter()->values()->all();

        return $arr;
    };

    $data = $groupings->map(function ($g) use ($enrichGrouping, $includeChildren) {
        $arr = $enrichGrouping($g);

        if ($includeChildren && $g->relationLoaded('children')) {
            $arr['children'] = $g->children->map($enrichGrouping)->values()->all();
        }

        return $arr;
    });

    return response()->json(['data' => $data]);
}
```

- [ ] **Step 2: Run Pint and verify**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
```

Test the endpoint:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8082/api/v1/vocabulary/groupings?domain_id=Condition&include_children=true' | jq '.data[0] | {name, children: [.children[]?.name]}'
```

Expected: Cardiovascular grouping with children array containing sub-grouping names.

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/VocabularyController.php
git commit -m "feat(vocabulary): add include_children parameter to groupings endpoint for HLGT hierarchy"
```

---

### Task 8: HLGT Sub-Groupings — Frontend Navigation

**Files:**
- Modify: `frontend/src/features/vocabulary/types/vocabulary.ts:147-158`
- Modify: `frontend/src/features/vocabulary/api/vocabularyApi.ts:156-163`
- Modify: `frontend/src/features/vocabulary/hooks/useClinicalGroupings.ts`
- Modify: `frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx`

- [ ] **Step 1: Add children to ClinicalGrouping type**

In `frontend/src/features/vocabulary/types/vocabulary.ts`, update the ClinicalGrouping interface:

```typescript
export interface ClinicalGrouping {
  id: number;
  name: string;
  description: string | null;
  domain_id: string;
  anchor_concept_ids: number[];
  anchors: AnchorDetail[];
  sort_order: number;
  icon: string | null;
  color: string | null;
  parent_grouping_id: number | null;
  children?: ClinicalGrouping[];
}
```

- [ ] **Step 2: Update fetchClinicalGroupings to pass include_children**

In `frontend/src/features/vocabulary/api/vocabularyApi.ts`:

```typescript
export async function fetchClinicalGroupings(
  domainId: string,
  includeChildren: boolean = false,
): Promise<ClinicalGrouping[]> {
  const params: Record<string, unknown> = { domain_id: domainId };
  if (includeChildren) {
    params.include_children = true;
  }
  const { data } = await apiClient.get(`${BASE}/groupings`, { params });
  return data.data ?? [];
}
```

- [ ] **Step 3: Update useClinicalGroupings hook**

In `frontend/src/features/vocabulary/hooks/useClinicalGroupings.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { fetchClinicalGroupings } from "../api/vocabularyApi";

export function useClinicalGroupings(domainId: string | null, includeChildren: boolean = false) {
  return useQuery({
    queryKey: ["vocabulary", "groupings", domainId, includeChildren],
    queryFn: () => fetchClinicalGroupings(domainId!, includeChildren),
    enabled: !!domainId,
  });
}
```

- [ ] **Step 4: Update HierarchyBrowserPanel for sub-grouping navigation**

In `HierarchyBrowserPanel.tsx`, update the useClinicalGroupings call to request children:

```typescript
const { data: groupings, isLoading: groupingsLoading } = useClinicalGroupings(activeDomain, true);
```

Add state for tracking when we're viewing sub-groupings of a parent:

```typescript
const [activeParentGrouping, setActiveParentGrouping] = useState<ClinicalGrouping | null>(null);
```

Update `handleGroupingClick` to handle groupings with children:

```typescript
const handleGroupingClick = useCallback((grouping: ClinicalGrouping) => {
  if (grouping.anchor_concept_ids.length === 0 && (!grouping.children || grouping.children.length === 0)) return;

  // If this grouping has HLGT children, show them as a sub-level
  if (grouping.children && grouping.children.length > 0) {
    setBreadcrumbs((prev) => [
      ...prev,
      { concept_id: -100 - grouping.id, concept_name: grouping.name },
    ]);
    setActiveParentGrouping(grouping);
    setShowGroupings(false);
    setFilterText("");
    return;
  }

  if (grouping.anchors.length > 1) {
    // Multi-anchor: show anchor concepts as a navigable sub-level
    setBreadcrumbs((prev) => [
      ...prev,
      { concept_id: -100 - grouping.id, concept_name: grouping.name },
    ]);
    setGroupingAnchors({ groupingName: grouping.name, anchors: grouping.anchors });
    setShowGroupings(false);
    setFilterText("");
  } else {
    // Single anchor: drill directly into its children
    const anchorId = grouping.anchor_concept_ids[0];
    setBreadcrumbs((prev) => [
      ...prev,
      { concept_id: anchorId, concept_name: grouping.name },
    ]);
    setParentId(anchorId);
    setShowGroupings(false);
    setGroupingAnchors(null);
    setFilterText("");
  }
}, []);
```

Reset `activeParentGrouping` in breadcrumb navigation:

In `handleBreadcrumbClick`, add `setActiveParentGrouping(null)` in the root reset block (index === -1) and in the domain-root restore block (index === 0):

```typescript
const handleBreadcrumbClick = useCallback((index: number) => {
  if (index === -1) {
    setBreadcrumbs([]);
    setParentId(0);
    setActiveDomain(null);
    setShowGroupings(true);
    setGroupingAnchors(null);
    setActiveParentGrouping(null);
    setSelectedSourceId(null);
  } else {
    const entry = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setParentId(entry.concept_id);
    setGroupingAnchors(null);
    setActiveParentGrouping(null);

    // If navigating back to domain root (index 0), restore groupings
    if (index === 0 && entry.concept_id < 0) {
      setShowGroupings(true);
    }
  }
  setFilterText("");
}, [breadcrumbs]);
```

In the content rendering section, add a condition for `activeParentGrouping` between the groupings grid and the anchors list. Find the render block that starts with `shouldShowGroupings && groupings && groupings.length > 0` and add the sub-grouping case after it:

```tsx
) : shouldShowGroupings && groupings && groupings.length > 0 ? (
  /* Clinical grouping cards */
  <GroupingsGrid
    groupings={groupings}
    onGroupingClick={handleGroupingClick}
    prevalenceMap={prevalenceMap}
    prevalenceLoading={prevalenceLoading}
  />
) : activeParentGrouping && activeParentGrouping.children && activeParentGrouping.children.length > 0 ? (
  /* HLGT sub-grouping cards */
  <div className="space-y-2 p-1">
    <p className="px-2 py-1 text-[10px] text-[#5A5650]">
      {activeParentGrouping.name} — {activeParentGrouping.children.length} sub-categories
    </p>
    <GroupingsGrid
      groupings={activeParentGrouping.children}
      onGroupingClick={handleGroupingClick}
      prevalenceMap={prevalenceMap}
      prevalenceLoading={prevalenceLoading}
    />
  </div>
) : groupingAnchors !== null ? (
```

- [ ] **Step 5: TypeScript check**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 6: Verify in browser**

Open Browse Hierarchy > Condition:
- Grouping cards appear as before
- Click "Cardiovascular" → shows HLGT sub-grouping cards (e.g., "Coronary artery disorders", "Heart failure syndromes")
- Breadcrumb shows: All Domains > Condition > Cardiovascular
- Click a sub-grouping → shows its anchors or drills into concepts
- Breadcrumb shows: All Domains > Condition > Cardiovascular > Coronary artery disorders
- Navigate back via breadcrumbs works correctly at every level

- [ ] **Step 7: Run Pint and commit**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"
git add frontend/src/features/vocabulary/types/vocabulary.ts frontend/src/features/vocabulary/api/vocabularyApi.ts frontend/src/features/vocabulary/hooks/useClinicalGroupings.ts frontend/src/features/vocabulary/components/HierarchyBrowserPanel.tsx
git commit -m "feat(vocabulary): add HLGT sub-grouping navigation in hierarchy browser"
```

---

### Task 9: Frontend Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript check**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit"
```

- [ ] **Step 2: Run Vite production build**

```bash
docker compose exec node sh -c "cd /app && npx vite build"
```

Both must pass. Fix any errors before proceeding.

- [ ] **Step 3: Deploy to production**

```bash
./deploy.sh --frontend
```

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(vocabulary): resolve build errors from clinical groupings enhancements"
```
