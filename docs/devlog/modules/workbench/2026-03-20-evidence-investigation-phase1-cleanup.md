# Evidence Investigation Workbench — Phase 1 Cleanup Sprint

**Date:** 2026-03-20
**Commit range:** `675dee7` through `e318912`
**Status:** Complete — deployed to production
**Related devlogs:** `2026-03-20-evidence-investigation-phase1a.md`, `2026-03-20-evidence-investigation-phase1b.md`
**Handoff doc:** `docs/devlog/plans/volcano-plot-darkstar-handoff.md`

---

## Background

After completing Phase 1a (CohortBuilder scaffold), Phase 1b-i (ConceptExplorer + CodeWAS), and Phase 1b-ii (ValidationChecklist stubs + attrition funnel), a comprehensive audit against the design spec exposed a cluster of gaps. Some were UI polish items; others were missing plumbing that will be load-bearing for Phases 3 and 4. This sprint closed all gaps that do not require new Darkstar R endpoints.

Gaps deferred to the Darkstar handoff doc:
- Volcano plot (D3 rendering + PHP controller + R endpoint)
- TimeCodeWAS temporal heatmap (R endpoint required)

---

## What Was Built

### Task 1 — Database Migrations

Two new migrations required by downstream phases.

**`evidence_pins` table extension** (`backend/database/migrations/`):
- Added `concept_ids integer[]` and `gene_symbols varchar[]` columns using raw SQL (`ALTER TABLE ... ADD COLUMN`) to preserve PostgreSQL native array types. Laravel schema builder does not support array column types natively.
- These columns feed the Phase 3 cross-domain linking engine, which joins pinned evidence entries to concept sets and genomic markers.

**`investigation_versions` table** (new):
- Columns: `id`, `investigation_id` (FK), `version_number`, `snapshot jsonb`, timestamps.
- Unique constraint on `(investigation_id, version_number)`.
- Required by Phase 4 versioning and snapshot diffing.

**Model and request updates:**
- `backend/app/Models/App/EvidencePin.php` — `$fillable` and `$casts` updated for new array columns.
- `backend/app/Http/Requests/StorePinRequest.php` — validation rules added: `concept_ids` as nullable array of integers, `gene_symbols` as nullable array of strings.

---

### Task 2 — ConceptExplorer: Inline Patient Counts + Standard Concept Toggle

**Files:** `frontend/src/features/workbench/components/ConceptCountBadge.tsx`, `frontend/src/features/workbench/hooks/useConceptCount.ts`, `frontend/src/features/workbench/components/ConceptExplorer.tsx`

**Inline patient counts:**
- `ConceptCountBadge` renders per visible search result row. Calls `useConceptCount(conceptId)` which hits the existing `/api/v1/concepts/{id}/count` endpoint.
- TanStack Query hook uses `staleTime: 60_000`. Backend caches counts in Redis with a 1-hour TTL.
- Displays a teal-colored "N pts" badge inline with the concept name. Shows a spinner while loading, nothing on error (count availability varies by source).

**Standard concept toggle:**
- Checkbox in the ConceptExplorer search bar, defaulting to checked (on).
- Filters the current result set client-side: `results.filter(c => !showStandardOnly || c.standard_concept === 'S')`.
- No additional API call — filtering is applied to already-fetched results.

---

### Task 3 — Schema Density Heatmap

**File:** `frontend/src/features/workbench/components/SchemaDensityHeatmap.tsx`

Recharts `BarChart` with `layout="vertical"` showing concept count per OMOP domain, derived from the entries in the active concept set. Helps researchers see at a glance whether their concept set is domain-balanced or skewed toward a single domain.

Domain color mapping:
- Condition → `#9B1B30` (crimson)
- Drug → `#2DD4BF` (teal)
- Measurement → `#C9A227` (gold)
- Procedure → `#60a5fa` (blue-400)
- Observation → `#a78bfa` (purple-400)
- Device → `#a1a1aa` (zinc-400)

Exports `buildDomainCounts(entries: ConceptSetEntry[])` as a named helper for reuse in Phase 3. Placed below `ConceptSetBuilder` in the Explore tab.

---

### Task 4 — Atlas JSON Import + File Upload Wiring

**File:** `frontend/src/features/workbench/components/AtlasImport.tsx`

The Atlas JSON textarea was previously a display-only stub with no parse logic.

**Atlas JSON "Parse & Import":**
- `JSON.parse` with try/catch; user-visible error on malformed JSON.
- Shape validation checks for at least one of: `ConceptSets`, `PrimaryCriteria`, or `expression` keys. Rejects unrecognized JSON with a clear message.
- On success: displays a summary (concept set count, criteria count) and calls `onStateChange` to propagate the parsed expression into the cohort builder state.

**File upload wiring:**
- `<input type="file" accept=".json,.csv">` with `onChange` handler.
- JSON files: parsed with the same logic as the Atlas paste path.
- CSV files: row count computed (`content.split('\n').length - 1`), file name + size + row count displayed as confirmation.
- File name, size (KB), and parse result rendered in a summary card below the input.

---

### Task 5 — Phenotype Library Search

**Files:** `frontend/src/features/workbench/components/PhenotypeLibrarySearch.tsx`, `frontend/src/features/workbench/components/CohortBuilder.tsx`

The Phenotype Library option in CohortBuilder was a disabled placeholder (`coming soon`).

**`PhenotypeLibrarySearch` component:**
- Text input with 500ms debounce calls `searchPhenotypes(query)` from the StudyAgent API client.
- Results rendered as cards: phenotype name, description excerpt, tag chips.
- "Select" button on each card calls `onStateChange({ cohort_definition: expression })` to load the phenotype's OHDSI expression into the cohort builder.

**CohortBuilder integration:**
- Phenotype Library option enabled (disabled flag removed).
- `PhenotypeLibrarySearch` rendered when cohort source is `phenotype_library`.

---

### Task 6 — Validation Checklist

**File:** `frontend/src/features/workbench/components/ValidationChecklist.tsx`

Five automated QC checks run against current investigation state:

| Check | Pass condition |
|---|---|
| Concept sets defined | At least one concept set with ≥1 entry |
| Cohort selected | `cohort_definition` is non-null |
| Primary cohort designated | A primary cohort is marked |
| No empty concept sets | All concept sets have ≥1 entry |
| CodeWAS executed | `codewas_results` array is non-empty |

Each row: `CheckCircle2` (teal) on pass, `AlertCircle` (amber) on fail, label, and detail text explaining the failure or confirming the pass condition. A summary progress bar at the top shows N/5 checks passing.

Added to the Validate tab below `CodeWASRunner`.

---

### Task 7 — Cohort Overlap Matrix

**File:** `frontend/src/features/workbench/components/CohortOverlapMatrix.tsx`

N×N CSS grid with cohort name headers on both axes. Diagonal cells are crimson-tinted and labeled "100%" (self-overlap). Off-diagonal cells display "—" with a tooltip note: "Run operations to compute overlap." Empty state renders when fewer than 2 cohorts are present.

The matrix is a visual placeholder for Phase 4, where overlap will be computed server-side via the HADES `CohortMethod` package and populated via the overlap matrix API.

Added to the Validate tab below `ValidationChecklist`.

---

### Task 8 — VolcanoPoint Type (Preparatory)

**File:** `frontend/src/features/workbench/types.ts`

`VolcanoPoint` interface added:

```typescript
export interface VolcanoPoint {
  concept_id: number;
  concept_name: string;
  odds_ratio: number;
  log2_or: number;
  p_value: number;
  neg_log10_p: number;
  ci_lower: number;
  ci_upper: number;
  significant: boolean;
  direction: 'positive' | 'negative' | 'neutral';
}
```

This type is consumed by the volcano plot component (tracked in the Darkstar handoff doc). Adding the type now allows the frontend scaffolding to proceed before the R endpoint is ready.

---

## Remaining Gaps

These were identified in the audit but require new Darkstar R endpoints and are tracked separately:

| Gap | Tracking doc |
|---|---|
| Volcano plot (D3 + PHP controller + R endpoint) | `docs/devlog/plans/volcano-plot-darkstar-handoff.md` |
| TimeCodeWAS temporal heatmap | same handoff doc |
| Matching panel + love plot | Phase 4 scope |
| Live attrition funnel (real-time criteria updates) | Backlog — post-execution funnel is functional |
| Drag-to-combine Venn diagram | Backlog — radio button selection works |

---

## Verification

- TypeScript: zero errors (`npx tsc --noEmit`)
- Backend tests: 15/15 passing
- PHPStan: no errors on modified files
- Deployed to production (`./deploy.sh`)

---

## Key Files Changed

**Backend:**
- `backend/database/migrations/*_add_concept_ids_gene_symbols_to_evidence_pins.php`
- `backend/database/migrations/*_create_investigation_versions_table.php`
- `backend/app/Models/App/EvidencePin.php`
- `backend/app/Http/Requests/StorePinRequest.php`

**Frontend:**
- `frontend/src/features/workbench/components/ConceptCountBadge.tsx`
- `frontend/src/features/workbench/hooks/useConceptCount.ts`
- `frontend/src/features/workbench/components/ConceptExplorer.tsx`
- `frontend/src/features/workbench/components/SchemaDensityHeatmap.tsx`
- `frontend/src/features/workbench/components/AtlasImport.tsx`
- `frontend/src/features/workbench/components/PhenotypeLibrarySearch.tsx`
- `frontend/src/features/workbench/components/CohortBuilder.tsx`
- `frontend/src/features/workbench/components/ValidationChecklist.tsx`
- `frontend/src/features/workbench/components/CohortOverlapMatrix.tsx`
- `frontend/src/features/workbench/types.ts`
