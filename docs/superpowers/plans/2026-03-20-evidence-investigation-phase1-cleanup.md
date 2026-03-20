# Evidence Investigation Phase 1 Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all Phase 1 gaps identified in the audit: inline patient counts in search results, standard concept toggle, schema density heatmap, Atlas JSON import wiring, file upload wiring, Phenotype Library search, validation checklist, cohort overlap matrix, `evidence_pins` array columns for Phase 3, and `investigation_versions` table for Phase 4.

**Architecture:** Mostly frontend polish and small backend additions. The volcano plot and TimeCodeWAS are excluded — those require new Darkstar R endpoints (tracked in `docs/devlog/plans/volcano-plot-darkstar-handoff.md`). The matching panel + love plot is deferred to Phase 4. This plan focuses on items that can be completed with existing backend infrastructure.

**Tech Stack:** React 19, TypeScript, D3 v7, Recharts v3, Laravel migrations, TanStack Query

**Spec:** `docs/superpowers/specs/2026-03-20-finngen-evidence-investigation-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/features/investigation/components/phenotype/SchemaDensityHeatmap.tsx` | Recharts heatmap showing OMOP domain data coverage |
| `frontend/src/features/investigation/components/phenotype/ValidationChecklist.tsx` | Automated QC checks on cohort state |
| `frontend/src/features/investigation/components/phenotype/CohortOverlapMatrix.tsx` | Grid visualization of cohort pairwise overlap |
| `frontend/src/features/investigation/components/phenotype/PhenotypeLibrarySearch.tsx` | StudyAgent phenotype search integration |
| `backend/database/migrations/2026_03_20_100001_add_array_columns_to_evidence_pins.php` | Add concept_ids + gene_symbols columns |
| `backend/database/migrations/2026_03_20_100002_create_investigation_versions_table.php` | Investigation versioning table |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/src/features/investigation/components/phenotype/ConceptExplorer.tsx` | Add inline patient counts on search results, standard concept toggle |
| `frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx` | Wire Atlas JSON parsing, file upload handler, enable Phenotype Library |
| `frontend/src/features/investigation/components/PhenotypePanel.tsx` | Add SchemaDensityHeatmap to Explore tab, ValidationChecklist + CohortOverlapMatrix to Validate tab |
| `frontend/src/features/investigation/types.ts` | Add VolcanoPoint type (for future use) |
| `backend/app/Models/App/EvidencePin.php` | Add concept_ids and gene_symbols to fillable/casts |

---

## Task Breakdown

### Task 1: Database migrations — evidence_pins arrays + investigation_versions

**Files:**
- Create: `backend/database/migrations/2026_03_20_100001_add_array_columns_to_evidence_pins.php`
- Create: `backend/database/migrations/2026_03_20_100002_create_investigation_versions_table.php`
- Modify: `backend/app/Models/App/EvidencePin.php`

- [ ] **Step 1: Create evidence_pins array columns migration**

```bash
cd backend && php artisan make:migration add_array_columns_to_evidence_pins
```

Migration content — use raw SQL for PostgreSQL array columns (Laravel Blueprint doesn't natively support `integer[]`):

```php
public function up(): void
{
    DB::statement('ALTER TABLE evidence_pins ADD COLUMN concept_ids integer[] DEFAULT \'{}\'');
    DB::statement('ALTER TABLE evidence_pins ADD COLUMN gene_symbols varchar[] DEFAULT \'{}\'');
}

public function down(): void
{
    Schema::table('evidence_pins', function (Blueprint $table) {
        $table->dropColumn(['concept_ids', 'gene_symbols']);
    });
}
```

- [ ] **Step 2: Create investigation_versions migration**

```bash
cd backend && php artisan make:migration create_investigation_versions_table
```

```php
public function up(): void
{
    Schema::create('investigation_versions', function (Blueprint $table) {
        $table->id();
        $table->foreignId('investigation_id')->constrained('investigations')->cascadeOnDelete();
        $table->integer('version_number');
        $table->jsonb('snapshot');
        $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
        $table->timestamps();

        $table->unique(['investigation_id', 'version_number']);
        $table->index('investigation_id');
    });
}

public function down(): void
{
    Schema::dropIfExists('investigation_versions');
}
```

- [ ] **Step 3: Update EvidencePin model**

In `backend/app/Models/App/EvidencePin.php`, add to `$fillable`:
```php
'concept_ids',
'gene_symbols',
```

Add to `$casts`:
```php
'concept_ids' => 'array',
'gene_symbols' => 'array',
```

- [ ] **Step 4: Update StorePinRequest validation**

In `backend/app/Http/Requests/Investigation/StorePinRequest.php`, add to rules:
```php
'concept_ids' => ['sometimes', 'array'],
'concept_ids.*' => ['integer'],
'gene_symbols' => ['sometimes', 'array'],
'gene_symbols.*' => ['string'],
```

- [ ] **Step 5: Verify PHPStan + Pint**

Run: `cd backend && vendor/bin/phpstan analyse app/Models/App/EvidencePin.php app/Http/Requests/Investigation/StorePinRequest.php && vendor/bin/pint --test`

- [ ] **Step 6: Commit**

```bash
git add backend/database/migrations/ backend/app/Models/App/EvidencePin.php backend/app/Http/Requests/Investigation/StorePinRequest.php
git commit -m "feat(investigation): add evidence_pins array columns and investigation_versions table"
```

---

### Task 2: Inline patient counts + standard concept toggle in ConceptExplorer

**Files:**
- Modify: `frontend/src/features/investigation/components/phenotype/ConceptExplorer.tsx`

- [ ] **Step 1: Read ConceptExplorer.tsx fully**

Understand the current search result rendering and how concepts are displayed.

- [ ] **Step 2: Add standard concept toggle**

Add a toggle/checkbox next to the domain filter:
```typescript
<label className="flex items-center gap-1.5 text-xs text-zinc-400">
  <input
    type="checkbox"
    checked={standardOnly}
    onChange={(e) => setStandardOnly(e.target.checked)}
    className="rounded border-zinc-600 bg-zinc-800"
  />
  Standard only
</label>
```

State: `const [standardOnly, setStandardOnly] = useState(true);`

Pass `standardOnly` to `useConceptSearch` — update the hook call to filter results client-side: `results.filter(c => !standardOnly || c.standard_concept === "S")`. (The backend search already returns `standard_concept` field.)

- [ ] **Step 3: Add inline patient counts on search result cards**

For each concept card in the search results, show a patient count badge. Use `useConceptCount` but only for **visible** results (not all search results at once — that would be N API calls).

Approach: lazy-load counts only for the first 10 visible results. Create a small `ConceptCountBadge` inline component that calls `useConceptCount(conceptId)` and renders a small teal badge with "N pts" text. The hook already has `staleTime: 60_000` and the backend caches in Redis (1hr TTL).

```typescript
function ConceptCountBadge({ conceptId }: { conceptId: number }) {
  const { data, isLoading } = useConceptCount(conceptId);
  if (isLoading) return <span className="text-[10px] text-zinc-600">...</span>;
  if (!data) return null;
  return (
    <span className="rounded bg-teal-900/30 px-1.5 py-0.5 text-[10px] text-teal-400">
      {data.patient_count.toLocaleString()} pts
    </span>
  );
}
```

Add this badge to each search result card, next to the domain badge.

- [ ] **Step 4: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/investigation/components/phenotype/ConceptExplorer.tsx
git commit -m "feat(investigation): add inline patient counts and standard concept filter to ConceptExplorer"
```

---

### Task 3: Schema Density Heatmap

**Files:**
- Create: `frontend/src/features/investigation/components/phenotype/SchemaDensityHeatmap.tsx`
- Modify: `frontend/src/features/investigation/components/PhenotypePanel.tsx`

- [ ] **Step 1: Create SchemaDensityHeatmap**

Create `frontend/src/features/investigation/components/phenotype/SchemaDensityHeatmap.tsx`:

A Recharts-based heatmap showing which OMOP domains have data and their relative coverage.

Props:
```typescript
interface SchemaDensityHeatmapProps {
  sourceId: number | null;
}
```

Implementation:
- Query the concept explorer search with empty/broad term per domain to get approximate counts, OR use a dedicated backend call. Simplest approach: call `searchConcepts("*", domain, 1)` for each of the 6 domains and use the result count as a density proxy. Or better: add a `GET /concept-explorer/domain-counts` backend endpoint.

Actually, the simplest approach that works NOW without backend changes: use the existing `useConceptSearch` with a common term per domain. But that's hacky.

Better approach: Create a simple static visualization using the concept set builder's existing patient counts. Show the domains the user has added concepts from as colored bars.

Simplest viable approach for cleanup: Show a horizontal bar chart of the 6 OMOP domains with bars representing the number of concepts the user has in their concept sets from each domain. This uses only data already available (concept sets from the investigation's phenotype state).

```typescript
// Count concepts per domain from the investigation's concept sets
const domainCounts = useMemo(() => {
  const counts: Record<string, number> = {};
  // Derive from conceptSets entries
  return counts;
}, [conceptSets]);
```

Use Recharts `BarChart layout="vertical"` with domain names on Y axis, counts on X. Color bars by domain (Condition=crimson, Drug=teal, Measurement=gold, etc.).

If no concepts are added yet, show an empty state: "Add concepts in the Explorer to see domain coverage."

- [ ] **Step 2: Add to PhenotypePanel Explore tab**

In `PhenotypePanel.tsx`, below the ConceptExplorer + ConceptSetBuilder split, add the `SchemaDensityHeatmap` component. Pass the concept sets data.

- [ ] **Step 3: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/investigation/components/phenotype/SchemaDensityHeatmap.tsx frontend/src/features/investigation/components/PhenotypePanel.tsx
git commit -m "feat(investigation): add schema density heatmap to Explore tab"
```

---

### Task 4: Wire Atlas JSON import and file upload in CohortBuilder

**Files:**
- Modify: `frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx`

- [ ] **Step 1: Read CohortBuilder.tsx fully**

Understand current import mode rendering, `atlasJson` state, file drop zone.

- [ ] **Step 2: Wire Atlas JSON parsing**

When the user pastes Atlas cohort definition JSON and clicks a "Parse" button:
1. Try `JSON.parse(atlasJson)` — show error if invalid JSON
2. Validate it has the expected shape (look for `ConceptSets` or `PrimaryCriteria` keys)
3. Extract concept set IDs and names from the parsed JSON
4. Display a summary: "Found N concept sets, N inclusion criteria"
5. Call `onStateChange({ cohort_definition: parsed })` to persist to investigation state

Add a "Parse & Import" button below the textarea. Show validation errors inline (crimson text).

- [ ] **Step 3: Wire file upload handler**

For the file `<input type="file">`:
1. Add an `onChange` handler that reads the file via `FileReader`
2. For `.json` files: parse as JSON, treat same as Atlas JSON paste
3. For `.csv` files: parse as CSV, extract patient IDs (first column), show count
4. Display file name, size, and row count after parsing
5. Call `onStateChange` with the parsed data

```typescript
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  // ... parse based on extension
};
```

- [ ] **Step 4: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx
git commit -m "feat(investigation): wire Atlas JSON parsing and file upload in CohortBuilder"
```

---

### Task 5: Phenotype Library search integration

**Files:**
- Create: `frontend/src/features/investigation/components/phenotype/PhenotypeLibrarySearch.tsx`
- Modify: `frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx`

- [ ] **Step 1: Create PhenotypeLibrarySearch**

Create `frontend/src/features/investigation/components/phenotype/PhenotypeLibrarySearch.tsx`:

Uses the existing StudyAgent `searchPhenotypes` API to search the OHDSI Phenotype Library (1,100+ validated phenotypes).

Props:
```typescript
interface PhenotypeLibrarySearchProps {
  onSelectPhenotype: (phenotype: { id: string; name: string; description: string; expression: Record<string, unknown> }) => void;
}
```

Implementation:
- Search input with debounce
- Calls `searchPhenotypes(query)` from `@/features/study-agent/api`
- Renders results as cards: phenotype name, description, "Select" button
- Selecting a phenotype calls `onSelectPhenotype` with the definition

Import `searchPhenotypes` from `@/features/study-agent/api` (already exists).

- [ ] **Step 2: Enable Phenotype Library in CohortBuilder**

In `CohortBuilder.tsx`:
1. Remove `disabled` from the Phenotype Library option
2. Render `<PhenotypeLibrarySearch onSelectPhenotype={handlePhenotypeSelect} />` when `importMode === "phenotype_library"`
3. `handlePhenotypeSelect` calls `onStateChange({ cohort_definition: phenotype.expression })`

- [ ] **Step 3: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/investigation/components/phenotype/PhenotypeLibrarySearch.tsx frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx
git commit -m "feat(investigation): add Phenotype Library search via StudyAgent"
```

---

### Task 6: Validation Checklist

**Files:**
- Create: `frontend/src/features/investigation/components/phenotype/ValidationChecklist.tsx`
- Modify: `frontend/src/features/investigation/components/PhenotypePanel.tsx`

- [ ] **Step 1: Create ValidationChecklist**

Create `frontend/src/features/investigation/components/phenotype/ValidationChecklist.tsx`:

Automated QC checks on the investigation's phenotype state.

Props:
```typescript
interface ValidationChecklistProps {
  investigation: Investigation;
}
```

Runs these checks on the investigation's phenotype state and displays results as a checklist:

```typescript
const checks = [
  {
    label: "At least one concept set defined",
    pass: state.concept_sets.length > 0,
    detail: state.concept_sets.length === 0 ? "Add concepts in the Explore tab" : `${state.concept_sets.length} concept sets`,
  },
  {
    label: "At least one cohort selected",
    pass: state.selected_cohort_ids.length > 0,
    detail: state.selected_cohort_ids.length === 0 ? "Select cohorts in the Build tab" : `${state.selected_cohort_ids.length} cohorts`,
  },
  {
    label: "Primary cohort designated",
    pass: state.primary_cohort_id !== null,
    detail: state.primary_cohort_id === null ? "Set a primary cohort for analyses" : `Cohort #${state.primary_cohort_id}`,
  },
  {
    label: "No empty concept sets",
    pass: state.concept_sets.every(cs => cs.concepts.length > 0),
    detail: (() => {
      const empty = state.concept_sets.filter(cs => cs.concepts.length === 0);
      return empty.length > 0 ? `${empty.map(cs => cs.name).join(", ")} have no concepts` : "All sets populated";
    })(),
  },
  {
    label: "CodeWAS validation run",
    pass: state.last_codewas_run_id !== null,
    detail: state.last_codewas_run_id === null ? "Run CodeWAS to validate phenotype" : `Run #${state.last_codewas_run_id}`,
  },
];
```

Each check renders as: icon (teal checkmark or amber warning), label, detail text. Summary at top: "N/5 checks passed".

- [ ] **Step 2: Add to PhenotypePanel Validate tab**

In `PhenotypePanel.tsx`, add `<ValidationChecklist investigation={investigation} />` below the `CodeWASRunner` in the validate tab content.

- [ ] **Step 3: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/investigation/components/phenotype/ValidationChecklist.tsx frontend/src/features/investigation/components/PhenotypePanel.tsx
git commit -m "feat(investigation): add automated ValidationChecklist for phenotype QC"
```

---

### Task 7: Cohort Overlap Matrix

**Files:**
- Create: `frontend/src/features/investigation/components/phenotype/CohortOverlapMatrix.tsx`
- Modify: `frontend/src/features/investigation/components/PhenotypePanel.tsx`

- [ ] **Step 1: Create CohortOverlapMatrix**

Create `frontend/src/features/investigation/components/phenotype/CohortOverlapMatrix.tsx`:

A grid visualization showing pairwise overlap between selected cohorts.

Props:
```typescript
interface CohortOverlapMatrixProps {
  cohorts: Array<{ id: number; name: string; count: number }>;
}
```

Implementation:
- If fewer than 2 cohorts: show empty state "Select 2+ cohorts to see overlap"
- Renders an N×N grid where each cell shows estimated overlap
- Since we don't have a real overlap API, use a **visual placeholder pattern**: show cohort sizes on the diagonal (self-overlap = 100%), and "—" for off-diagonal cells with a note: "Run cohort operations to compute actual overlap"
- Alternatively, if the `useCohortOverlap` hook exists in the cohort-definitions feature, use it. Search for it.
- Grid: each cell colored by overlap percentage (teal intensity for high overlap, zinc for unknown)
- Diagonal cells: crimson intensity proportional to cohort size
- Row/column headers: truncated cohort names

Dark theme: zinc-900 cells, teal/crimson fills, zinc-300 text.

- [ ] **Step 2: Add to PhenotypePanel Validate tab**

In `PhenotypePanel.tsx`, add `<CohortOverlapMatrix cohorts={selectedCohorts} />` to the validate tab, below ValidationChecklist. Pass the resolved cohorts (with names and counts).

- [ ] **Step 3: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/investigation/components/phenotype/CohortOverlapMatrix.tsx frontend/src/features/investigation/components/PhenotypePanel.tsx
git commit -m "feat(investigation): add CohortOverlapMatrix to Validate tab"
```

---

### Task 8: Add VolcanoPoint type for future use

**Files:**
- Modify: `frontend/src/features/investigation/types.ts`

- [ ] **Step 1: Add VolcanoPoint interface**

From the handoff doc, add to `types.ts`:

```typescript
/** Volcano plot data point — populated by Darkstar CodeWAS endpoint (future) */
export interface VolcanoPoint {
  concept_id: number;
  concept_name: string;
  odds_ratio: number;
  log2_or: number;          // X-axis
  p_value: number;
  neg_log10_p: number;      // Y-axis
  ci_lower: number;
  ci_upper: number;
  significant: boolean;     // p < 0.05
  direction: "risk" | "protective" | "neutral";
}
```

This is preparatory — the volcano plot component and Darkstar endpoint are tracked separately.

- [ ] **Step 2: Verify TypeScript**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/investigation/types.ts
git commit -m "feat(investigation): add VolcanoPoint type for future Darkstar CodeWAS integration"
```

---

### Task 9: Full verification

- [ ] **Step 1: Run frontend TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run frontend ESLint**

Run: `cd frontend && npx eslint src/features/investigation/`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 3: Run backend PHPStan**

Run: `cd backend && vendor/bin/phpstan analyse app/Models/App/EvidencePin.php app/Http/Requests/Investigation/StorePinRequest.php`
Expected: No errors

- [ ] **Step 4: Run backend tests**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/V1/InvestigationCrudTest.php tests/Feature/Api/V1/EvidencePinTest.php`
Expected: 15/15 passing

- [ ] **Step 5: Final commit if any lint fixes needed**

```bash
git add -A
git commit -m "chore: lint fixes after Phase 1 cleanup"
```

---

## What This Plan Does NOT Cover (Tracked Separately)

| Item | Reason | Tracking |
|------|--------|----------|
| Volcano plot (D3 + R endpoint + PHP controller) | Requires new Darkstar R code | `docs/devlog/plans/volcano-plot-darkstar-handoff.md` |
| TimeCodeWAS temporal heatmap | Requires new Darkstar R endpoint | Future plan |
| Matching panel + love plot | Phase 4 scope — needs D3 love plot + matching config UI | Phase 4 |
| Live attrition funnel (updates as criteria added) | Low priority UX enhancement — current post-execution rendering is functional | Backlog |
| Drag-to-combine Venn diagram | Low priority UX enhancement — radio button selection works | Backlog |
