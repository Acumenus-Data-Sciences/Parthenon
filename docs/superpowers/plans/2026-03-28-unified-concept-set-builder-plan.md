# Unified Concept Set Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify concept set building into a cohesive split-pane Builder page with embedded vocabulary search, and upgrade the Vocabulary Browser's "Add to Set" modal with set creation, previews, and context carry-over.

**Architecture:** Two entry points (Builder page and Vocabulary Browser) converge on shared search components via a `mode` prop. The Builder page becomes a 40/60 split-pane. The modal gets creation, preview, and navigation capabilities. One small backend change adds `recent_items` to the concept set list endpoint.

**Tech Stack:** React 19, TypeScript strict, TanStack Query, Tailwind 4, Laravel 11/PHP 8.4

**Spec:** `docs/superpowers/specs/2026-03-28-unified-concept-set-builder-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/features/concept-sets/components/ConceptSetBuilderLayout.tsx` | Split-pane container (40% search / 60% set contents), independent scroll |
| `frontend/src/features/concept-sets/components/ConceptSetItemDetailExpander.tsx` | Inline expandable concept detail (Info/Hierarchy/Relationships/Maps tabs) for set item rows |

### Modified Files

| File | Change Summary |
|------|---------------|
| `frontend/src/features/vocabulary/components/VocabularySearchPanel.tsx` | Add `mode`, `conceptSetItemIds`, `onAddToSet`, `initialQuery`, `initialFilters` props; conditional action rendering per result |
| `frontend/src/features/vocabulary/components/SemanticSearchPanel.tsx` | Same mode prop treatment; move inline "Add to Set" button to use shared prop pattern |
| `frontend/src/features/vocabulary/pages/VocabularyPage.tsx` | Pass `mode="browse"` to search panels (preserves current behavior) |
| `frontend/src/features/vocabulary/components/AddToConceptSetModal.tsx` | Full rewrite: "Create New" button, set previews with item counts + concept chips, context carry-over, `include_descendants: true` default |
| `frontend/src/features/concept-sets/pages/ConceptSetDetailPage.tsx` | Rewrite to split-pane layout using `ConceptSetBuilderLayout`, read URL params for context carry-over, pass `mode="build"` to search panels |
| `frontend/src/features/concept-sets/components/ConceptSetEditor.tsx` | Remove built-in search panel; becomes right-panel-only; add click-to-expand on item rows using `ConceptSetItemDetailExpander` |
| `frontend/src/features/concept-sets/types/conceptSet.ts` | Add `recent_items` field to `ConceptSet` interface |
| `backend/app/Http/Controllers/Api/V1/ConceptSetController.php` | Add `recent_items` (3 most recent concept names) to `index()` response |

---

## Task 1: Backend — Add `recent_items` to Concept Set Index

Start with the backend since the enhanced modal depends on this data.

**Files:**
- Modify: `backend/app/Http/Controllers/Api/V1/ConceptSetController.php` (index method, ~line 40-70)
- Modify: `frontend/src/features/concept-sets/types/conceptSet.ts` (line 1-14, ConceptSet interface)

- [ ] **Step 1: Add `recent_items` to the PHP `index()` method**

Open `backend/app/Http/Controllers/Api/V1/ConceptSetController.php`. Find the `index()` method. After the paginate call, add enrichment:

```php
// After: $conceptSets = ConceptSet::query()...->paginate($request->integer('limit', 20));
// Add this block before the return:

$conceptSets->getCollection()->each(function ($set) {
    $recentIds = $set->items()->latest()->limit(3)->pluck('concept_id');
    if ($recentIds->isNotEmpty()) {
        $set->recent_items = \Illuminate\Support\Facades\DB::connection('omop')
            ->table('concept')
            ->whereIn('concept_id', $recentIds)
            ->pluck('concept_name', 'concept_id')
            ->toArray();
    } else {
        $set->recent_items = [];
    }
});
```

- [ ] **Step 2: Run Pint**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint app/Http/Controllers/Api/V1/ConceptSetController.php"
```

Expected: PASS

- [ ] **Step 3: Test the endpoint**

```bash
TOKEN=$(curl -s -X POST http://localhost:8082/api/v1/auth/login \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"email":"admin@acumenus.net","password":"superuser"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")

curl -s http://localhost:8082/api/v1/concept-sets?limit=2 \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -30
```

Expected: Each concept set object now includes a `recent_items` field (object with concept_id → name mapping, or empty object).

- [ ] **Step 4: Add `recent_items` to the TypeScript type**

Open `frontend/src/features/concept-sets/types/conceptSet.ts`. Add `recent_items` to the `ConceptSet` interface:

```typescript
// In the ConceptSet interface, after items_count:
  recent_items?: Record<number, string>;
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/Http/Controllers/Api/V1/ConceptSetController.php \
        frontend/src/features/concept-sets/types/conceptSet.ts
git commit -m "feat(concept-sets): add recent_items to concept set index response"
```

---

## Task 2: Refactor VocabularySearchPanel for Mode Prop

This is the most critical refactor — it makes the keyword search panel work in both the Vocabulary Browser and the Concept Set Builder.

**Files:**
- Modify: `frontend/src/features/vocabulary/components/VocabularySearchPanel.tsx`
- Modify: `frontend/src/features/vocabulary/pages/VocabularyPage.tsx`

- [ ] **Step 1: Extend the props interface**

Open `frontend/src/features/vocabulary/components/VocabularySearchPanel.tsx`. Replace the props interface (lines 12-15) with:

```typescript
interface VocabularySearchPanelProps {
  mode?: 'browse' | 'build';
  selectedConceptId?: number | null;
  onSelectConcept?: (id: number) => void;

  // Build mode: concept set integration
  conceptSetItemIds?: Set<number>;
  onAddToSet?: (conceptId: number) => void;

  // Context carry-over: pre-fill search from URL params
  initialQuery?: string;
  initialFilters?: {
    domain?: string;
    vocabulary?: string;
    standard?: boolean;
  };
}
```

- [ ] **Step 2: Update state initialization to use initial values**

Find the state initialization block (around lines 29-38). Update the search query and filter defaults to use `initialQuery` and `initialFilters`:

```typescript
// Replace the existing state declarations:
const [query, setQuery] = useState(initialQuery ?? '');
// For domain/vocabulary/standard filters, find where they're initialized and add:
// e.g., if domain filter state is:
//   const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
// Change to:
//   const [selectedDomain, setSelectedDomain] = useState<string | null>(initialFilters?.domain ?? null);
// Same pattern for vocabulary and standard filters.
```

The exact state variable names will vary — find each filter's `useState` call and add the `initialFilters?.xxx ?? defaultValue` pattern. Default `mode` to `'browse'`:

```typescript
const resolvedMode = mode ?? 'browse';
```

- [ ] **Step 3: Add conditional action rendering in result items**

Find the result rendering section (around lines 450-503). Each result item currently has an `onClick` that calls `onSelectConcept`. Add mode-conditional rendering:

After the existing result content (concept ID, name, badges), add a conditional action area:

```tsx
{/* Action area — mode-dependent */}
{resolvedMode === 'build' ? (
  conceptSetItemIds?.has(result.concept_id) ? (
    <span className="shrink-0 rounded bg-teal-500/10 px-2 py-0.5 text-xs text-teal-400">
      In set
    </span>
  ) : (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAddToSet?.(result.concept_id);
      }}
      className="shrink-0 flex h-6 w-6 items-center justify-center rounded bg-teal-400 text-[#0E0E11] text-sm font-bold hover:bg-teal-300 transition-colors"
    >
      +
    </button>
  )
) : null}
```

Also update the row click handler: in `build` mode, clicking a result should be a no-op (or optional preview), not fire `onSelectConcept`:

```tsx
onClick={() => {
  if (resolvedMode === 'browse') {
    onSelectConcept?.(result.concept_id);
  }
}}
```

Update the "selected" left-border styling to also apply to "In set" items in build mode:

```tsx
className={`... ${
  resolvedMode === 'browse' && selectedConceptId === result.concept_id
    ? 'border-l-2 border-l-teal-400 bg-[#0E0E11]'
    : resolvedMode === 'build' && conceptSetItemIds?.has(result.concept_id)
      ? 'border-l-2 border-l-teal-400 bg-teal-400/5'
      : ''
}`}
```

- [ ] **Step 4: Update VocabularyPage to pass `mode="browse"`**

Open `frontend/src/features/vocabulary/pages/VocabularyPage.tsx`. Find where `VocabularySearchPanel` is rendered and add the mode prop:

```tsx
<VocabularySearchPanel
  mode="browse"
  selectedConceptId={selectedConceptId}
  onSelectConcept={handleSelectConcept}
/>
```

This preserves the existing behavior — browse mode is the default anyway, but making it explicit documents intent.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit" 2>&1 | head -20
```

Expected: No new errors. The mode prop is optional with a default, so existing call sites don't break.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/vocabulary/components/VocabularySearchPanel.tsx \
        frontend/src/features/vocabulary/pages/VocabularyPage.tsx
git commit -m "refactor(vocabulary): add mode prop to VocabularySearchPanel for build/browse"
```

---

## Task 3: Refactor SemanticSearchPanel for Mode Prop

Same treatment as Task 2, but for the Hecate semantic search panel.

**Files:**
- Modify: `frontend/src/features/vocabulary/components/SemanticSearchPanel.tsx`
- Modify: `frontend/src/features/vocabulary/pages/VocabularyPage.tsx`

- [ ] **Step 1: Extend the props interface**

Open `frontend/src/features/vocabulary/components/SemanticSearchPanel.tsx`. Replace the props interface (lines 204-206) with:

```typescript
interface SemanticSearchPanelProps {
  mode?: 'browse' | 'build';
  onSelectConcept?: (id: number) => void;

  // Build mode: concept set integration
  conceptSetItemIds?: Set<number>;
  onAddToSet?: (conceptId: number) => void;

  // Context carry-over
  initialQuery?: string;
  initialFilters?: {
    domain?: string;
    vocabulary?: string;
    standard?: boolean;
  };
}
```

- [ ] **Step 2: Update state initialization with initial values**

Same pattern as Task 2 Step 2 — find the query and filter `useState` calls and add `initialQuery` / `initialFilters` defaults.

```typescript
const resolvedMode = mode ?? 'browse';
```

- [ ] **Step 3: Update the ResultRow sub-component**

Find the `ResultRow` sub-component (around lines 138-198). Currently it has an inline "Add to Set" button (lines 167-177). Replace it with mode-conditional rendering:

```tsx
{/* Action area — replaces the old inline "Add to Set" button */}
{resolvedMode === 'build' ? (
  conceptSetItemIds?.has(result.concept_id) ? (
    <span className="shrink-0 rounded bg-teal-500/10 px-2 py-0.5 text-xs text-teal-400">
      In set
    </span>
  ) : (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAddToSet?.(result.concept_id);
      }}
      className="shrink-0 flex h-6 w-6 items-center justify-center rounded bg-teal-400 text-[#0E0E11] text-sm font-bold hover:bg-teal-300 transition-colors"
    >
      +
    </button>
  )
) : (
  /* Browse mode: keep the original "Add to Set" button that opens the modal */
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onBrowseAddToSet?.(result.concept_id, result.concept_name);
    }}
    className="..."
  >
    Add to Set
  </button>
)}
```

You'll need to thread `resolvedMode`, `conceptSetItemIds`, `onAddToSet`, and the existing modal handler through to `ResultRow`. The cleanest way is to pass them as props to `ResultRow` since it's a sub-component in the same file.

- [ ] **Step 4: Update VocabularyPage to pass mode="browse"**

In `VocabularyPage.tsx`, find where `SemanticSearchPanel` is rendered and add:

```tsx
<SemanticSearchPanel
  mode="browse"
  onSelectConcept={handleSelectConcept}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit" 2>&1 | head -20
```

Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/vocabulary/components/SemanticSearchPanel.tsx \
        frontend/src/features/vocabulary/pages/VocabularyPage.tsx
git commit -m "refactor(vocabulary): add mode prop to SemanticSearchPanel for build/browse"
```

---

## Task 4: Create ConceptSetBuilderLayout Component

The split-pane container for the Builder page.

**Files:**
- Create: `frontend/src/features/concept-sets/components/ConceptSetBuilderLayout.tsx`

- [ ] **Step 1: Create the split-pane layout component**

```tsx
import { type ReactNode } from 'react';

interface ConceptSetBuilderLayoutProps {
  searchPanel: ReactNode;
  contentsPanel: ReactNode;
}

export function ConceptSetBuilderLayout({
  searchPanel,
  contentsPanel,
}: ConceptSetBuilderLayoutProps) {
  return (
    <div className="flex h-[calc(100vh-12rem)] min-h-0">
      {/* Left: Vocabulary Search (40%) */}
      <div className="w-2/5 overflow-y-auto border-r border-white/10 p-4">
        {searchPanel}
      </div>

      {/* Right: Set Contents (60%) */}
      <div className="w-3/5 overflow-y-auto p-4">
        {contentsPanel}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit" 2>&1 | head -20
```

Expected: No errors (component is not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/concept-sets/components/ConceptSetBuilderLayout.tsx
git commit -m "feat(concept-sets): add ConceptSetBuilderLayout split-pane component"
```

---

## Task 5: Create ConceptSetItemDetailExpander Component

The inline expandable detail for concept set item rows.

**Files:**
- Create: `frontend/src/features/concept-sets/components/ConceptSetItemDetailExpander.tsx`

- [ ] **Step 1: Create the expander component**

This component renders when a user clicks a row in the set contents table. It shows tabbed concept detail (Info, Hierarchy, Relationships, Maps From) using the same hooks as `ConceptDetailPanel`.

```tsx
import { useState } from 'react';
import {
  useConcept,
  useConceptAncestors,
  useConceptRelationships,
  useConceptMapsFrom,
} from '@/features/vocabulary/hooks/useVocabularySearch';
import { Loader2 } from 'lucide-react';

type DetailTab = 'info' | 'hierarchy' | 'relationships' | 'maps-from';

interface ConceptSetItemDetailExpanderProps {
  conceptId: number;
}

export function ConceptSetItemDetailExpander({
  conceptId,
}: ConceptSetItemDetailExpanderProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('info');
  const [relationshipsPage, setRelationshipsPage] = useState(1);

  const { data: concept, isLoading: isLoadingConcept } = useConcept(conceptId);
  const { data: ancestors, isLoading: isLoadingAncestors } = useConceptAncestors(
    activeTab === 'hierarchy' ? conceptId : null,
  );
  const { data: relationships, isLoading: isLoadingRels } = useConceptRelationships(
    activeTab === 'relationships' ? conceptId : null,
    relationshipsPage,
  );
  const { data: mapsFrom, isLoading: isLoadingMaps } = useConceptMapsFrom(
    activeTab === 'maps-from' ? conceptId : null,
  );

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'hierarchy', label: 'Hierarchy' },
    { key: 'relationships', label: 'Relationships' },
    { key: 'maps-from', label: 'Maps From' },
  ];

  if (isLoadingConcept) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 size={16} className="animate-spin text-teal-400" />
      </div>
    );
  }

  if (!concept) {
    return (
      <div className="p-4 text-sm text-gray-500">Concept not found</div>
    );
  }

  return (
    <div className="border-t border-teal-400/20 bg-[#0E0E11] px-4 py-3">
      {/* Tab bar */}
      <div className="mb-3 flex gap-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`text-xs transition-colors ${
              activeTab === tab.key
                ? 'border-b border-teal-400 pb-1 text-teal-400'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-gray-500">Full Name</div>
            <div className="text-gray-200">{concept.concept_name}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Vocabulary</div>
            <div className="text-gray-200">
              {concept.vocabulary_id} &middot; {concept.concept_code}
              {concept.standard_concept === 'S' && (
                <span className="ml-1 rounded bg-teal-400/20 px-1 text-xs text-teal-400">
                  Standard
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Concept Class</div>
            <div className="text-gray-200">{concept.concept_class_id}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Domain</div>
            <div className="text-gray-200">{concept.domain_id}</div>
          </div>
          {concept.synonyms && concept.synonyms.length > 0 && (
            <div className="col-span-2">
              <div className="text-xs text-gray-500">Synonyms</div>
              <div className="text-sm text-gray-400">
                {concept.synonyms.join(' · ')}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'hierarchy' && (
        <div className="text-sm">
          {isLoadingAncestors ? (
            <Loader2 size={14} className="animate-spin text-teal-400" />
          ) : ancestors && ancestors.length > 0 ? (
            <div className="rounded bg-[#1a1a20] p-3 text-xs">
              {ancestors.map((ancestor: { concept_id: number; concept_name: string; min_levels_of_separation: number }, i: number) => (
                <div key={ancestor.concept_id} style={{ paddingLeft: `${i * 12}px` }}>
                  <span className="text-gray-500">&rarr;</span>{' '}
                  <span className={ancestor.concept_id === conceptId ? 'font-semibold text-white' : 'text-gray-300'}>
                    {ancestor.concept_name}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">No ancestor data available</div>
          )}
        </div>
      )}

      {activeTab === 'relationships' && (
        <div className="text-sm">
          {isLoadingRels ? (
            <Loader2 size={14} className="animate-spin text-teal-400" />
          ) : relationships?.data && relationships.data.length > 0 ? (
            <div className="space-y-1">
              {relationships.data.map((rel: { concept_id_2: number; concept_name_2: string; relationship_id: string }) => (
                <div
                  key={`${rel.concept_id_2}-${rel.relationship_id}`}
                  className="flex items-center gap-2 rounded bg-[#1a1a20] px-2 py-1 text-xs"
                >
                  <span className="text-gray-500">{rel.relationship_id}</span>
                  <span className="text-gray-300">{rel.concept_name_2}</span>
                </div>
              ))}
              {relationships.last_page > 1 && (
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={relationshipsPage <= 1}
                    onClick={() => setRelationshipsPage((p) => p - 1)}
                    className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-gray-600">
                    {relationshipsPage} / {relationships.last_page}
                  </span>
                  <button
                    type="button"
                    disabled={relationshipsPage >= relationships.last_page}
                    onClick={() => setRelationshipsPage((p) => p + 1)}
                    className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-30"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500">No relationships found</div>
          )}
        </div>
      )}

      {activeTab === 'maps-from' && (
        <div className="text-sm">
          {isLoadingMaps ? (
            <Loader2 size={14} className="animate-spin text-teal-400" />
          ) : mapsFrom && mapsFrom.length > 0 ? (
            <div className="space-y-1">
              {mapsFrom.map((mapping: { concept_id: number; concept_name: string; vocabulary_id: string; concept_code: string }) => (
                <div
                  key={mapping.concept_id}
                  className="flex items-center gap-2 rounded bg-[#1a1a20] px-2 py-1 text-xs"
                >
                  <span className="font-mono text-[#C9A227]">{mapping.concept_code}</span>
                  <span className="text-gray-300">{mapping.concept_name}</span>
                  <span className="text-gray-600">{mapping.vocabulary_id}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500">No source mappings found</div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit" 2>&1 | head -20
```

Expected: No errors. Check the hook return types match what's used — the exact shape of `concept`, `ancestors`, `relationships`, `mapsFrom` depends on the API response. Read the actual hook implementations in `useVocabularySearch.ts` and adjust the inline types if `tsc` flags mismatches.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/concept-sets/components/ConceptSetItemDetailExpander.tsx
git commit -m "feat(concept-sets): add ConceptSetItemDetailExpander for inline concept detail"
```

---

## Task 6: Rewrite ConceptSetEditor as Right Panel

Strip the built-in search from `ConceptSetEditor` and add click-to-expand detail on item rows.

**Files:**
- Modify: `frontend/src/features/concept-sets/components/ConceptSetEditor.tsx`

- [ ] **Step 1: Remove the "Add Concept" search panel**

Open `ConceptSetEditor.tsx`. The "Add Concept Panel" section (around lines 262-371) contains a search input and results list. **Delete this entire section.** The search is now in the left panel of the split-pane — the editor no longer needs its own search.

Also remove the related state variables and hooks that only served the built-in search:
- Remove `searchQuery` state and its `useState`
- Remove `useVocabularySearch` import and usage (if it was only used for the built-in search)
- Remove the `debouncedSearchQuery` if present
- Keep all mutation hooks (`useAddConceptSetItem`, `useUpdateConceptSetItem`, `useRemoveConceptSetItem`, `useBulkUpdateConceptSetItems`)

- [ ] **Step 2: Add expanded row state and detail expander**

Add state for tracking which row is expanded:

```typescript
const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
```

Add the import:

```typescript
import { ConceptSetItemDetailExpander } from './ConceptSetItemDetailExpander';
```

- [ ] **Step 3: Add click-to-expand on item rows**

Find the items table body section (around lines 438-454). Each row currently renders via `ConceptSetItemRow`. Wrap each row with a click handler and conditionally render the expander:

```tsx
{conceptSet.items.map((item) => (
  <div key={item.id}>
    <div
      className={`cursor-pointer ${
        expandedItemId === item.id ? 'rounded-t border border-teal-400/30 bg-teal-400/5' : ''
      }`}
      onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
    >
      <ConceptSetItemRow
        item={item}
        isSelected={selectedItems.has(item.id)}
        onToggleSelect={() => toggleSelectItem(item.id)}
        onUpdate={(payload) => updateItem.mutate({ setId: conceptSet.id, itemId: item.id, payload })}
        onRemove={() => removeItem.mutate({ setId: conceptSet.id, itemId: item.id })}
        onSelectForPhoebe={/* existing handler */}
      />
    </div>
    {expandedItemId === item.id && (
      <div className="rounded-b border border-t-0 border-teal-400/30">
        <ConceptSetItemDetailExpander conceptId={item.concept_id} />
      </div>
    )}
  </div>
))}
```

The expand indicator (▾/▴) should be added to the concept name column. In the `ConceptSetItemRow` component or in the wrapping div, add:

```tsx
<span className="ml-1 text-xs text-teal-400">
  {expandedItemId === item.id ? '▴' : '▾'}
</span>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit" 2>&1 | head -20
```

Expected: No errors. If `ConceptSetItemRow` props changed, adjust accordingly.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/concept-sets/components/ConceptSetEditor.tsx
git commit -m "refactor(concept-sets): strip built-in search from editor, add row detail expansion"
```

---

## Task 7: Rewrite ConceptSetDetailPage as Split-Pane

The biggest task — replace the single-column layout with the split-pane Builder.

**Files:**
- Modify: `frontend/src/features/concept-sets/pages/ConceptSetDetailPage.tsx`

- [ ] **Step 1: Add imports for new components and hooks**

Add to the imports section:

```typescript
import { useSearchParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import { ConceptSetBuilderLayout } from '../components/ConceptSetBuilderLayout';
import { VocabularySearchPanel } from '@/features/vocabulary/components/VocabularySearchPanel';
import { SemanticSearchPanel } from '@/features/vocabulary/components/SemanticSearchPanel';
```

- [ ] **Step 2: Read URL params for context carry-over**

Inside the component function, after the existing hooks, add:

```typescript
const [searchParams] = useSearchParams();
const [searchTab, setSearchTab] = useState<'keyword' | 'semantic'>('keyword');

const initialQuery = searchParams.get('q') ?? undefined;
const initialFilters = useMemo(() => ({
  domain: searchParams.get('domain') ?? undefined,
  vocabulary: searchParams.get('vocabulary') ?? undefined,
  standard: searchParams.get('standard') === 'true' ? true : undefined,
}), [searchParams]);
```

- [ ] **Step 3: Derive conceptSetItemIds**

After the `useConceptSet` hook, derive the set of concept IDs:

```typescript
const conceptSetItemIds = useMemo(
  () => new Set(conceptSet?.items?.map((item) => item.concept_id) ?? []),
  [conceptSet?.items],
);
```

- [ ] **Step 4: Add the onAddToSet handler**

```typescript
const addItem = useAddConceptSetItem();

const handleAddToSet = (conceptId: number) => {
  if (!conceptSet) return;
  addItem.mutate({
    setId: conceptSet.id,
    payload: {
      concept_id: conceptId,
      include_descendants: true,
      include_mapped: false,
      is_excluded: false,
    },
  });
};
```

- [ ] **Step 5: Rewrite the JSX body**

Keep the header section (back button, editable name/description, action buttons — lines ~151-330). Replace everything below it with:

```tsx
<ConceptSetBuilderLayout
  searchPanel={
    <div>
      {/* Search tab switcher */}
      <div className="mb-3 flex gap-1">
        <button
          type="button"
          onClick={() => setSearchTab('keyword')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            searchTab === 'keyword'
              ? 'bg-teal-400/15 text-teal-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Keyword
        </button>
        <button
          type="button"
          onClick={() => setSearchTab('semantic')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            searchTab === 'semantic'
              ? 'bg-teal-400/15 text-teal-400'
              : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          Semantic
        </button>
      </div>

      {searchTab === 'keyword' ? (
        <VocabularySearchPanel
          mode="build"
          conceptSetItemIds={conceptSetItemIds}
          onAddToSet={handleAddToSet}
          initialQuery={initialQuery}
          initialFilters={initialFilters}
        />
      ) : (
        <SemanticSearchPanel
          mode="build"
          conceptSetItemIds={conceptSetItemIds}
          onAddToSet={handleAddToSet}
          initialQuery={initialQuery}
          initialFilters={initialFilters}
        />
      )}
    </div>
  }
  contentsPanel={
    <div>
      <ConceptSetEditor conceptSet={conceptSet} />

      {conceptSet.items.length > 0 && (
        <PhoebeRecommendationsPanel
          conceptIds={conceptSet.items.map((i) => i.concept_id)}
          existingConceptIds={conceptSetItemIds}
          onAdd={handleAddToSet}
        />
      )}
    </div>
  }
/>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit" 2>&1 | head -20
```

Expected: No errors. If `PhoebeRecommendationsPanel` props don't match exactly, check its interface and adjust.

- [ ] **Step 7: Verify Vite build**

```bash
docker compose exec node sh -c "cd /app && npx vite build" 2>&1 | tail -10
```

Expected: Build succeeds. Vite is stricter than tsc — this catches additional issues.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/concept-sets/pages/ConceptSetDetailPage.tsx
git commit -m "feat(concept-sets): rewrite detail page as split-pane builder with vocab search"
```

---

## Task 8: Rewrite AddToConceptSetModal

Full rewrite of the modal with "Create New", previews, and context carry-over.

**Files:**
- Modify: `frontend/src/features/vocabulary/components/AddToConceptSetModal.tsx`

- [ ] **Step 1: Rewrite the modal component**

Replace the entire file with:

```tsx
import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Loader2, X } from 'lucide-react';
import { useConceptSets, useAddConceptSetItem, useCreateConceptSet } from '@/features/concept-sets/hooks/useConceptSets';
import type { ConceptSet } from '@/features/concept-sets/types/conceptSet';

interface AddToConceptSetModalProps {
  open: boolean;
  onClose: () => void;
  conceptId: number;
  conceptName: string;
  searchContext?: {
    query?: string;
    domain?: string;
    vocabulary?: string;
    standard?: string;
  };
}

export function AddToConceptSetModal({
  open,
  onClose,
  conceptId,
  conceptName,
  searchContext,
}: AddToConceptSetModalProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newSetName, setNewSetName] = useState('');

  const { data: conceptSetsData } = useConceptSets({ limit: 100 });
  const addItem = useAddConceptSetItem();
  const createSet = useCreateConceptSet();

  const conceptSets = conceptSetsData?.data ?? [];

  const filtered = useMemo(() => {
    if (!filter) return conceptSets;
    const lower = filter.toLowerCase();
    return conceptSets.filter(
      (cs: ConceptSet) =>
        cs.name.toLowerCase().includes(lower) ||
        (cs.description?.toLowerCase().includes(lower) ?? false),
    );
  }, [conceptSets, filter]);

  const buildContextParams = () => {
    const params = new URLSearchParams();
    if (searchContext?.query) params.set('q', searchContext.query);
    if (searchContext?.domain) params.set('domain', searchContext.domain);
    if (searchContext?.vocabulary) params.set('vocabulary', searchContext.vocabulary);
    if (searchContext?.standard) params.set('standard', searchContext.standard);
    return params.toString();
  };

  const handleAddToExisting = (setId: number, setName: string) => {
    addItem.mutate(
      {
        setId,
        payload: {
          concept_id: conceptId,
          include_descendants: true,
          include_mapped: false,
          is_excluded: false,
        },
      },
      {
        onSuccess: () => {
          onClose();
          // Toast is handled by the mutation hook's onSuccess
        },
      },
    );
  };

  const handleCreateNew = () => {
    const name = newSetName.trim() || conceptName;
    createSet.mutate(
      { name },
      {
        onSuccess: (newSet) => {
          addItem.mutate(
            {
              setId: newSet.id,
              payload: {
                concept_id: conceptId,
                include_descendants: true,
                include_mapped: false,
                is_excluded: false,
              },
            },
            {
              onSuccess: () => {
                onClose();
                const ctx = buildContextParams();
                navigate(`/concept-sets/${newSet.id}${ctx ? `?${ctx}` : ''}`);
              },
            },
          );
        },
      },
    );
  };

  const handleOpenBuilder = () => {
    onClose();
    const ctx = buildContextParams();
    navigate(`/concept-sets${ctx ? `?${ctx}` : ''}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#16161b] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-white">Add to Concept Set</div>
            <div className="mt-0.5 text-xs text-gray-500">
              <span className="font-mono text-[#C9A227]">{conceptId}</span>
              {' · '}
              {conceptName}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={18} />
          </button>
        </div>

        {/* Create New */}
        <div className="border-b border-white/10 px-5 py-3">
          {isCreating ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
                placeholder={conceptName}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateNew();
                  if (e.key === 'Escape') setIsCreating(false);
                }}
                className="flex-1 rounded-lg border border-white/10 bg-[#1a1a20] px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-teal-400/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCreateNew}
                disabled={createSet.isPending || addItem.isPending}
                className="rounded-lg bg-teal-400 px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-teal-300 disabled:opacity-50"
              >
                {createSet.isPending || addItem.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  'Create'
                )}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsCreating(true);
                setNewSetName('');
              }}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed border-teal-400/30 bg-teal-400/5 px-4 py-3 text-left transition-colors hover:border-teal-400/50 hover:bg-teal-400/10"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-400 text-[#0E0E11]">
                <Plus size={16} />
              </div>
              <div>
                <div className="text-sm font-medium text-teal-400">Create New Concept Set</div>
                <div className="text-xs text-gray-500">Add concept and open in Builder</div>
              </div>
            </button>
          )}
        </div>

        {/* Search filter */}
        <div className="px-5 pt-3 pb-1">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search existing sets..."
              className="w-full rounded-lg border border-white/10 bg-[#1a1a20] py-2 pl-9 pr-3 text-sm text-white placeholder-gray-600 focus:border-white/20 focus:outline-none"
            />
          </div>
        </div>

        {/* Set list */}
        <div className="max-h-72 overflow-y-auto px-5 py-2">
          {filtered.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500">
              {filter ? 'No sets match your search' : 'No concept sets yet'}
            </div>
          ) : (
            filtered.map((cs: ConceptSet) => (
              <button
                key={cs.id}
                type="button"
                onClick={() => handleAddToExisting(cs.id, cs.name)}
                disabled={addItem.isPending}
                className="mb-1.5 w-full rounded-lg border border-transparent bg-[#1a1a20] px-3 py-2.5 text-left transition-colors hover:border-white/10 hover:bg-[#1e1e24] disabled:opacity-50"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">{cs.name}</div>
                    {cs.description && (
                      <div className="mt-0.5 truncate text-xs text-gray-500">{cs.description}</div>
                    )}
                  </div>
                  <span className="ml-2 shrink-0 rounded bg-[#0E0E11] px-2 py-0.5 text-xs text-gray-500">
                    {cs.items_count ?? cs.items?.length ?? 0} items
                  </span>
                </div>
                {cs.recent_items && Object.keys(cs.recent_items).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {Object.values(cs.recent_items).slice(0, 3).map((name, i) => (
                      <span
                        key={i}
                        className="rounded bg-[#0E0E11] px-1.5 py-0.5 text-[10px] text-gray-500"
                      >
                        {name}
                      </span>
                    ))}
                    {(cs.items_count ?? 0) > 3 && (
                      <span className="rounded bg-[#0E0E11] px-1.5 py-0.5 text-[10px] text-gray-500">
                        +{(cs.items_count ?? 0) - 3} more
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-5 py-2.5 text-center text-xs text-gray-500">
          Adds with{' '}
          <span className="text-teal-400">Include Descendants</span>
          {' · '}
          <button
            type="button"
            onClick={handleOpenBuilder}
            className="text-[#C9A227] hover:text-[#d4b032]"
          >
            Open Builder with current search →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update callers to pass `searchContext`**

In `ConceptDetailPanel.tsx` (around lines 511-517), update the modal usage to pass search context:

The search query lives in `VocabularyPage` state, but `ConceptDetailPanel` doesn't have direct access to it. The simplest approach: read the current URL to reconstruct context. Add to `ConceptDetailPanel`:

```typescript
// At the top of the component, extract current search context from the URL
const currentUrl = new URL(window.location.href);
const searchContext = {
  query: currentUrl.searchParams.get('q') ?? undefined,
  domain: currentUrl.searchParams.get('domain') ?? undefined,
  vocabulary: currentUrl.searchParams.get('vocabulary') ?? undefined,
  standard: currentUrl.searchParams.get('standard') ?? undefined,
};
```

Then pass it to the modal:

```tsx
<AddToConceptSetModal
  open={showAddToSet}
  onClose={() => setShowAddToSet(false)}
  conceptId={concept.concept_id}
  conceptName={concept.concept_name}
  searchContext={searchContext}
/>
```

**Note:** The Vocabulary Browser currently doesn't persist search state to URL params. If the URL has no `?q=` params, context carry-over will be empty — this is acceptable for v1. A follow-up can add URL sync to `VocabularyPage` for full round-trip context.

In `SemanticSearchPanel.tsx` (around lines 625-636), update similarly.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit" 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 4: Verify Vite build**

```bash
docker compose exec node sh -c "cd /app && npx vite build" 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/vocabulary/components/AddToConceptSetModal.tsx \
        frontend/src/features/vocabulary/components/ConceptDetailPanel.tsx \
        frontend/src/features/vocabulary/components/SemanticSearchPanel.tsx
git commit -m "feat(concept-sets): rewrite AddToConceptSetModal with create new, previews, context carry-over"
```

---

## Task 9: Integration Testing and Polish

Manual verification that both entry points work end-to-end.

**Files:** No new files — this is testing and fixes.

- [ ] **Step 1: Test Entry Point A — Set-First flow**

1. Navigate to `/concept-sets`
2. Click "New Concept Set" — should create and navigate to split-pane builder
3. Left panel: search "diabetes mellitus" in keyword tab
4. Verify domain/vocabulary/standard filters work
5. Click `+` on a result — verify it appears in right panel with `Include Descendants` on
6. Verify "In set" badge appears on that result in left panel
7. Switch to Semantic tab — verify search works and `+` / "In set" behave correctly
8. In right panel: click a row — verify detail expander opens with Info tab
9. Switch to Hierarchy/Relationships/Maps tabs — verify data loads
10. Click row again — verify it collapses
11. Test Phoebe recommendations still appear at bottom

- [ ] **Step 2: Test Entry Point B — Search-First flow**

1. Navigate to `/vocabulary`
2. Search "hypertension"
3. Click a concept to open detail panel
4. Click "Add to Set" button
5. Verify modal shows "Create New Concept Set" button at top
6. Verify existing sets show item counts and concept name chips
7. Click "Create New Concept Set" — verify inline name input appears
8. Type a name and press Enter — verify it creates the set, adds the concept, and navigates to Builder
9. Verify the Builder's search panel has the search context pre-filled

- [ ] **Step 3: Test context carry-over**

1. In Vocabulary Browser, search "metformin" with Domain filter "Drug"
2. Click "Add to Set" on a concept
3. Add to existing set — verify toast appears with "Open in Builder" link
4. (Test the modal footer "Open Builder with current search →" link separately)
5. Verify Builder opens with "metformin" in search and "Drug" domain filter active

- [ ] **Step 4: Fix any TypeScript or visual issues found during testing**

Run full checks:

```bash
docker compose exec node sh -c "cd /app && npx tsc --noEmit" 2>&1
docker compose exec node sh -c "cd /app && npx vite build" 2>&1 | tail -10
```

Fix any issues found.

- [ ] **Step 5: Deploy to production**

```bash
./deploy.sh --frontend
```

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(concept-sets): integration fixes for unified builder"
```
