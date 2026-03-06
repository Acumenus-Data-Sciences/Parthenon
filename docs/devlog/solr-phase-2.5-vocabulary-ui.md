# Solr Integration — Phase 2.5 + Phase 3: Vocabulary UI & Cohort/Study Discovery

**Date:** 2026-03-06
**Scope:** Autocomplete dropdown, concept class filter, Solr highlights, expanded facet chips

## What Was Built

### Autocomplete Dropdown
- `useConceptSuggest` hook (already existed) now powers a floating dropdown below the search input
- Shows up to 8 suggestions from Solr's `/vocabulary/suggest` endpoint as user types (2+ chars)
- Full keyboard navigation: Arrow Up/Down to move, Enter to select, Escape to dismiss
- Click-outside detection to close dropdown
- Selecting a suggestion populates the search input and triggers full search

### Concept Class Filter
- New `<select>` dropdown in the filter panel for concept class filtering
- Populated dynamically from `facets.concept_class_id` returned by Solr
- Sorted by count descending so most relevant classes appear first
- Flows through `concept_class` parameter to `useVocabularySearch` hook → API → Solr `fq`

### Highlighted Search Results
- `HighlightedText` component renders Solr `<mark>` tags in concept names
- HTML sanitization: strips all tags except `<mark>` and `</mark>` before `dangerouslySetInnerHTML`
- Styled with gold highlight background (`[&_mark]:bg-[#C9A227]/30`) matching the design theme
- Falls back to plain concept name when no highlights available (PostgreSQL fallback path)

### Expanded Facet Chips
- Quick-filter chips now show three facet categories when filter panel is collapsed:
  - **Domain** chips (blue, `#60A5FA`) — top 4 domains by count
  - **Vocabulary** chips (gold, `#C9A227`) — top 3 vocabularies by count
  - **Concept class** chips (gray, `#8A857D`) — top 3 classes by count
- Chips are toggleable: click to activate, click again to deactivate
- Active filter count badge updated to include concept class filter

### Data Pipeline (already in place from prior work)
- `highlights` field in `ConceptSearchResult` type
- `highlights` passed through from `vocabularyApi.ts` → `useVocabularySearch` hook → component
- `concept_class` filter in hook queryKey and queryFn params

## Verification
- TypeScript compiles clean (`npx tsc --noEmit`)
- Frontend production build succeeds (`npx vite build` in Docker)
- All three enhancements work together: type query → see autocomplete suggestions → select one → results show with highlighted matches and facet chips

## Files Modified
- `frontend/src/features/vocabulary/components/VocabularySearchPanel.tsx` — complete rewrite with autocomplete, concept class filter, highlights, expanded chips

## Files Previously Modified (supporting pipeline)
- `frontend/src/features/vocabulary/types/vocabulary.ts` — added `highlights` to `ConceptSearchResult`
- `frontend/src/features/vocabulary/api/vocabularyApi.ts` — pipe `highlights` from API response
- `frontend/src/features/vocabulary/hooks/useVocabularySearch.ts` — expose `highlights`, add `concept_class` to filters

---

## Phase 3: Cohort & Study Discovery — Controller Integration

### Backend: Solr-First Search with PostgreSQL Fallback

Updated `CohortDefinitionController::index` and `StudyController::index` to use the existing `CohortSearchService` for search queries.

**Pattern:** When a `search` parameter is present and Solr is available:
1. Query Solr `cohorts` core with `type` filter (cohort or study)
2. Get matching IDs in Solr relevance order
3. Hydrate full Eloquent models from PostgreSQL using `whereIn('id', $solrIds)`
4. Preserve Solr relevance order (not PG order)
5. Append computed attributes (latest_generation for cohorts, progress for studies)
6. Return response with `facets` and `engine: "solr"` fields

**Fallback:** If Solr is unavailable (circuit breaker open, service down, `SOLR_ENABLED=false`), falls through to the existing PostgreSQL ILIKE queries unchanged. Response includes `engine: "postgresql"`.

**Key design decisions:**
- Solr only used for *search* (not listing without search) — browsing stays on PG with ordering
- Hydration from PG preserves all relationships, computed attributes, and permission scoping
- `CohortSearchService` already handles `type` filter via `fq=type:"cohort"` or `fq=type:"study"`
- Facets (status, tags, author_name, study_type, phase, priority) returned when Solr is active

### Frontend Compatibility
- The response shape is identical (`data`, `total`, `current_page`, `per_page`, `last_page`)
- Extra fields (`facets`, `engine`) are ignored by `toLaravelPaginated()` — no breakage
- Future enhancement: display facet counts alongside existing filter chips in StudiesPage/CohortDefinitionsPage

### Verification
- `CohortSearchService::search('diabetes', ['type' => 'cohort'])` → 1 cohort, 7 facet fields
- `CohortSearchService::search('diabetes', ['type' => 'study'])` → 4 studies, correct relevance order
- Routes compile (`artisan route:list`)
- TypeScript compiles clean
- Frontend production build succeeds

### Files Modified
- `backend/app/Http/Controllers/Api/V1/CohortDefinitionController.php` — inject CohortSearchService, Solr-first search in index()
- `backend/app/Http/Controllers/Api/V1/StudyController.php` — inject CohortSearchService, Solr-first search in index()

---

## Phase 3 Completion: Frontend Faceted Filters + Global Search

### Facet Counts on Filter Chips

Updated both listing pages to display Solr facet counts alongside existing filter chips when Solr is the active search engine.

**Cohort Definitions Page:**
- `cohortApi.ts` — `getCohortDefinitions()` now returns `facets` and `engine` from API response
- `CohortDefinitionsPage.tsx` — tag chips show counts in parentheses (e.g., "diabetes (2)"); new Status and Author chip rows when facets available
- `CohortDefinitionList.tsx` — teal "Solr" pill badge next to pagination when `engine === "solr"`

**Studies Page:**
- `studyApi.ts` — `listStudies()` return type includes `facets` and `engine`
- `StudiesPage.tsx` — status/type/priority chips show facet counts; teal "Solr" pill next to search bar

All facet UI is conditional — renders nothing when facets are absent (PG fallback). Backward compatible.

### Global Search (Cmd+K / Ctrl+K)

Already complete from prior work:
- `CommandPalette.tsx` — command-palette style search with debounced Solr queries
- `GlobalSearchController.php` + `GlobalSearchService.php` — fans out to vocabulary, cohorts, and studies cores in parallel via `Http::pool()`
- Navigation commands + live search results grouped by type (concepts, cohorts, studies)
- Full keyboard navigation (ArrowUp/Down, Enter, Escape)

### Phase 3 Completion Status

| Item | Status |
|------|--------|
| 3.1 Solr Schema — `cohorts` core | Complete |
| 3.2 Indexing (command + observers + job) | Complete |
| 3.3 CohortSearchService | Complete |
| 3.4 Controller integration | Complete |
| 3.4 Frontend faceted filters | Complete |
| 3.4 Global search (Cmd+K) | Complete |

### Verification
- TypeScript compiles clean
- Production build succeeds
- Facet counts display when Solr active, hidden gracefully on PG fallback
