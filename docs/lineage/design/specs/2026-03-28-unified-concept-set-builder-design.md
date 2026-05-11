# Unified Concept Set Builder — Design Specification

**Date:** 2026-03-28
**Status:** Approved
**Author:** Dr. Sanjay Udoshi + Claude

## Problem

Concept set building in Parthenon is disjointed. Two workflows exist independently:

1. **Set-First (Builder Page):** `ConceptSetDetailPage` has a basic name/code search for adding concepts, but lacks the full vocabulary search capabilities (domain/vocabulary filters, semantic search, hierarchy browsing) available in the Vocabulary Browser.

2. **Search-First (Vocabulary Browser):** The Vocabulary Browser has rich search (Solr keyword + Hecate semantic, faceted filtering, concept detail with hierarchy/relationships) but the "Add to Concept Set" modal only lists existing sets — no option to create a new set, no preview of set contents, and no way to continue building in the Builder without losing search context.

Researchers must context-switch between two disconnected features to build a concept set properly.

## Solution

Unify both workflows into a cohesive system with two first-class entry points that converge on the same experience:

- **Builder Page** becomes a split-pane workspace with full vocabulary search embedded
- **Vocabulary Browser** gets an enhanced modal with set creation and context carry-over to the Builder

## Architecture Overview

### Entry Point A — Set-First (Builder Page)

`/concept-sets/:id` becomes a 40/60 split-pane:

- **Left (40%):** Full vocabulary search — reuses existing `VocabularySearchPanel` and `SemanticSearchPanel` components with a new `mode="build"` prop. Shows `+` buttons and "In set" badges instead of navigating to a detail panel.
- **Right (60%):** Set contents table with inline expandable concept detail. Click any row to expand Info/Hierarchy/Relationships/Maps tabs. Phoebe AI recommendations at the bottom.

### Entry Point B — Search-First (Vocabulary Browser)

`/vocabulary` keeps its current split-pane layout. The "Add to Concept Set" modal (`AddToConceptSetModal`) is upgraded:

- "Create New Concept Set" button at top — creates set, adds concept, navigates to Builder with search context
- Set list shows previews (item count + recent concept name chips)
- Clicking existing set adds concept, shows toast with "Open in Builder" link
- Context carry-over via URL params preserves search state across navigation

### Shared Infrastructure

- Search components accept a `mode` prop (`"browse"` | `"build"`) to control action rendering
- Adding a concept defaults to `include_descendants: true`, `include_mapped: false`, `is_excluded: false`
- Both paths use the same API endpoints and React Query hooks
- No new Zustand stores — React Query manages server state, page component orchestrates via props

## Builder Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back    "Type 2 Diabetes Mellitus" [edit]   [Dup] [Export] [Pub/Priv] [Del]  │
├──────────────────────────┬──────────────────────────────────────┤
│  VOCABULARY SEARCH (40%) │  SET CONTENTS (60%)                  │
│                          │                                      │
│  [Keyword] [Semantic]    │  12 concepts · 847 resolved          │
│  ┌─────────────────────┐ │  [Resolve] [Export] [Bulk ▾]         │
│  │ Search concepts...  │ │                                      │
│  └─────────────────────┘ │  ID    Name       Desc Map Excl  ×   │
│  [Condition ×] [+Domain] │  ─────────────────────────────────── │
│  [+Vocabulary] [☑ Std]   │  44054006  Type 2 DM    ✓  —  —  ×  │
│                          │  201826   T2DM renal ▾  ✓  ✓  —  ×  │
│  42 of 1,247 · Solr      │  ┌─ Detail ─────────────────────┐   │
│  ─────────────────────── │  │ [Info] Hierarchy Rels Maps    │   │
│  44054006 Type 2 DM [set]│  │ Full Name: Type 2 DM w/...   │   │
│  201826   T2DM renal [+] │  │ Vocab: SNOMED · Standard     │   │
│  443238   Diab neurop[+] │  │ Synonyms: T2DM w/ nephro...  │   │
│  4196141  T2DM ophth [+] │  └──────────────────────────────┘   │
│  40484648 T2DM no cmp[set]│  443238   Diab neuropathy —  —  ✓  ×│
│                          │                                      │
│                          │  ★ Phoebe Recommendations            │
│                          │  4058243 Insulin-dep DM  94%  [+]   │
│                          │  4063043 Diab retinopathy 87% [+]   │
└──────────────────────────┴──────────────────────────────────────┘
```

### Left Panel (Vocabulary Search)

- Keyword and Semantic search tabs (same as Vocabulary Browser)
- Domain, Vocabulary, Concept Class filters
- Standard Concepts toggle
- Autocomplete suggestions
- Infinite scroll results
- Each result shows: concept ID (gold monospace), name, domain/vocabulary/class badges, standard indicator
- `+` button on each result — adds to set with `include_descendants: true`
- "In set" badge on concepts already in the set (replaces `+` button)
- Both panels scroll independently

### Right Panel (Set Contents + Drilldown)

- Header: concept count, resolved count, action buttons (Resolve, Export, Bulk dropdown)
- Items table with columns: ID, Concept Name, Domain, Descendants, Mapped, Excluded, Remove
- **Click any row to expand inline detail** with tabbed content:
  - **Info:** Full name, vocabulary, concept class, domain, synonyms
  - **Hierarchy:** Ancestor tree (reuses data from `useConceptAncestors`)
  - **Relationships:** Related concepts with pagination (reuses `useConceptRelationships`)
  - **Maps From:** Source codes mapping to this concept (reuses `useConceptMapsFrom`)
- Bulk operations on selected rows (checkbox select): toggle Descendants, Mapped, Excluded
- Phoebe AI recommendations section at the bottom (existing `PhoebeRecommendationsPanel`, unchanged)

## Enhanced "Add to Set" Modal

Replaces the current `AddToConceptSetModal` in the Vocabulary Browser.

### Layout

```
┌─────────────────────────────────────────┐
│  Add to Concept Set                   × │
│  44054006 · Type 2 diabetes mellitus    │
├─────────────────────────────────────────┤
│  ┌─ + Create New Concept Set ─────────┐ │
│  │     Add concept and open in Builder │ │
│  └────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐│
│  │ 🔍 Search existing sets...          ││
│  └─────────────────────────────────────┘│
│                                         │
│  ┌ Endocrine Disorders ──── 28 items ─┐ │
│  │ Hypothyroidism · Hyperthyroidism · +25│
│  └────────────────────────────────────┘ │
│  ┌ Diabetes Mellitus Cohort ─ 12 items┐ │
│  │ Type 1 DM · Gestational DM · +9    │ │
│  └────────────────────────────────────┘ │
│  ┌ Cardiovascular Risk ──── 45 items ─┐ │
│  │ Hypertension · Hyperlipidemia · +42│  │
│  └────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│  Adds with Include Descendants ·        │
│  Open Builder with current search →     │
└─────────────────────────────────────────┘
```

### Behaviors

**"Create New Concept Set" button:**
1. Reveals inline name input (pre-filled with concept name as suggestion)
2. On submit: `POST /concept-sets` → `POST /concept-sets/:id/items` with `include_descendants: true`
3. Navigates to `/concept-sets/:newId?q={query}&domain={domain}&vocabulary={vocab}&standard={std}`
4. Builder opens with search context pre-filled

**Click existing set:**
1. `POST /concept-sets/:setId/items` with `include_descendants: true`
2. Toast: "Added to {name}" with "Open in Builder" link
3. Modal closes, user stays in Vocabulary Browser
4. Can continue browsing and adding more concepts

**Set list previews:**
- Each set shows: name, description (truncated), item count, up to 3 recent concept names as chips
- Client-side search filter over set names and descriptions

**Footer:**
- Shows default: "Adds with Include Descendants"
- "Open Builder with current search →" link: navigates to Builder with context params (without pre-selecting a concept)

## Component Refactoring

### Search Panel Shared Interface

```typescript
interface SearchPanelProps {
  mode: 'browse' | 'build';

  // Browse mode: click navigates to concept detail
  onSelect?: (conceptId: number) => void;
  selectedConceptId?: number;

  // Build mode: show +/In-set buttons
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

### Mode Behavior Matrix

| Behavior | `browse` (Vocabulary Browser) | `build` (CS Builder) |
|----------|-------------------------------|----------------------|
| Click result | Selects, fires `onSelect` | No-op or preview |
| Action button | None (existing "Add to Set" in detail panel) | `+` button, fires `onAddToSet` |
| Already-in-set indicator | Not shown | "In set" badge, `+` hidden |
| Result styling | Left border teal on selected | Left border teal on "In set" items |

### Files Modified

| File | Change |
|------|--------|
| `VocabularySearchPanel.tsx` | Add `mode` prop, conditional action rendering per result |
| `SemanticSearchPanel.tsx` | Same treatment as VocabularySearchPanel |
| `VocabularyPage.tsx` | Pass `mode="browse"` (no behavior change) |
| `ConceptSetDetailPage.tsx` | Full rewrite to split-pane layout, pass `mode="build"` |
| `ConceptSetEditor.tsx` | Becomes right panel, gains inline detail expansion |
| `AddToConceptSetModal.tsx` | Full rewrite with create new, previews, context carry-over |

### New Components

| Component | Purpose |
|-----------|---------|
| `ConceptSetBuilderLayout` | Split-pane container (40/60) with independent scroll |
| `ConceptSetItemDetailExpander` | Inline expandable detail for set items (Info/Hierarchy/Relationships/Maps tabs) |

## Data Flow

### Builder Page State

```
ConceptSetDetailPage (route: /concept-sets/:id)
├── reads URL params: ?q, ?domain, ?vocabulary, ?standard
├── useConceptSet(id) → set data + items
├── derives: conceptSetItemIds = Set<number> from items
│
├── Left Panel
│   ├── VocabularySearchPanel(mode="build", conceptSetItemIds, onAddToSet, initialQuery, initialFilters)
│   └── SemanticSearchPanel(mode="build", conceptSetItemIds, onAddToSet, initialQuery, initialFilters)
│
└── Right Panel
    ├── ConceptSetEditor (modified)
    │   ├── click row → expand ConceptSetItemDetailExpander
    │   └── ConceptSetItemDetailExpander(conceptId)
    │       └── useConcept(id), useConceptAncestors(id), useConceptRelationships(id)
    └── PhoebeRecommendationsPanel (unchanged)
```

### Add Concept Flow

1. User clicks `+` on search result in left panel
2. `onAddToSet(conceptId)` fires
3. Calls `addConceptSetItem({ concept_id, include_descendants: true })`
4. React Query invalidates `["concept-sets", id]` — right panel re-renders with new item
5. `conceptSetItemIds` set updates — left panel re-renders, "In set" badge appears on that result

### Context Carry-Over Flow

1. User in Vocabulary Browser clicks "Open in Builder" (from modal or toast)
2. Navigation: `/concept-sets/:id?q=diabetes&domain=Condition&vocabulary=SNOMED&standard=true`
3. Builder page reads params via `useSearchParams()` on mount
4. Passes as `initialQuery` / `initialFilters` to search panel
5. Search panel uses these as default values for internal state (one-time init, not controlled)

## Backend Changes

One change to `ConceptSetController::index()`:

Add a `recent_items` field to each concept set in the list response. This provides the 3 most recent concept names for the modal preview chips.

```php
// In index() method, after loading concept sets:
// Join against vocab.concept to return names directly — avoids a second round-trip
$conceptSets->each(function ($set) {
    $recentIds = $set->items()->latest()->limit(3)->pluck('concept_id');
    $set->recent_items = DB::connection('omop')
        ->table('concept')
        ->whereIn('concept_id', $recentIds)
        ->pluck('concept_name', 'concept_id')
        ->toArray();
});
```

Returns `{ concept_id: concept_name }` map directly — no second round-trip from the frontend.

No new API endpoints. No new migrations. No new models.

## Scope

### In Scope

- Builder page split-pane layout with embedded vocabulary search
- Search component refactoring (mode prop)
- Enhanced "Add to Set" modal with create new, previews, context carry-over
- Default `include_descendants: true` on concept add
- Inline expandable concept detail on set contents rows
- Backend: `recent_items` field on concept sets index response

### Out of Scope

- Concept set composition/nesting (union/intersection of sets)
- Versioning or undo/redo
- Patient count preview
- Concept set validation rules or warnings
- Drag-and-drop reordering
- Bulk add from search results (multi-select + add all)
- Changes to the Concept Sets list page
- Changes to Phoebe recommendation logic
- New backend API endpoints beyond `recent_items`

## Performance Considerations

The vocabulary search can return thousands of results. In the Builder, every search result is cross-referenced against the set's item IDs to show "In set" badges. With a `Set<number>` lookup this is O(1) per result — fine even with concept sets containing hundreds of items.

The inline detail expander fetches concept data on demand (when expanded), not on page load. Each expansion triggers `useConcept`, `useConceptAncestors`, and `useConceptRelationships` — all cached by React Query so re-expanding is instant.

Both panels scroll independently to prevent the search panel from jumping when set contents change.
