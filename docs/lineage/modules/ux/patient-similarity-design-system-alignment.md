# Patient Similarity Design System Alignment

**Date:** 2026-04-11
**Scope:** `frontend/src/features/patient-similarity/` (14 files, 11 commits)

## Problem

The Patient Similarity feature had accumulated significant UI drift from Parthenon's design system. It was built during a rapid prototyping phase and never reconciled with the established patterns used by Cohort Definitions, Analyses, Data Quality, and other modules. The drift manifested as inconsistent colors, layouts, typography, focus states, and component patterns that made the page feel like a different application.

## Design System Drift Audit Methodology

Before making changes, we performed a systematic comparison between the Patient Similarity feature and the gold-standard pages (Cohort Definitions, Analyses). This produced 13 categorized drift issues across 4 severity tiers. The audit method is reusable for any page:

### Step 1: Identify the Reference Pages

Pick 2-3 pages that best represent the design system. In Parthenon, the gold standards are:
- `CohortDefinitionsPage.tsx` — list page pattern (header, stats, search, table)
- `CohortDefinitionDetailPage.tsx` — detail page pattern (breadcrumb, tabs, panels)
- `CharacterizationDetailPage.tsx` — analytical page pattern (metrics, charts, pipeline)

### Step 2: Audit Categories

Check each page under review against these 10 categories:

| # | Category | What to Check | Design System Source |
|---|----------|--------------|---------------------|
| 1 | **Page header** | `page-title` + `page-subtitle` classes, title/subtitle + right-side actions | `layout.css:148-159` |
| 2 | **Page layout** | `space-y-6` vertical flow, no custom sidebar/flex layouts | `layout.css:126-132` (.content-main) |
| 3 | **Card/panel containers** | `.panel` class (gradient, shimmer, gold hover) or explicit `rounded-xl border border-[#2A2A30] bg-[#151518]` | `panels.css` |
| 4 | **Nested cards** | `.panel-inset` or `border-[#2A2A30] bg-[#0E0E11]` for cards inside panels | `panels.css` |
| 5 | **Tables** | `thead bg-[#1C1C20]`, sticky header, `text-[11px] tracking-[0.5px]` headers, `border-[#2A2A30]` | `tables.css` |
| 6 | **Buttons** | `.btn .btn-primary` (teal), `.btn .btn-secondary` (bordered), proper sizing | `buttons.css` |
| 7 | **Form inputs** | `.form-input` / `.form-select` classes, **gold focus ring** (`focus:border-[#C9A227] focus:ring-[#C9A227]/15`) | `forms.css` |
| 8 | **Tabs/toggles** | Teal underline indicator for tabs, gold accent for filter chips | `tabs.css`, `filter-chips.css` |
| 9 | **Breadcrumbs** | `text-sm text-[#8A857D] hover:text-[#F0EDE8] mb-3` with ArrowLeft icon | common pattern |
| 10 | **Empty/loading states** | `.empty-state` / `.empty-message` classes, Loader2 with `text-[#8A857D]` | `empty-states.css` |

### Step 3: Color Palette Cross-Check

The most common drift is using off-palette hex colors. The design system palette is:

```
Surfaces:  #0E0E11 (base), #151518 (raised), #1C1C20 (overlay), #232328 (elevated)
Borders:   #2A2A30 (default), #323238 (subtle)
Text:      #F0EDE8 (primary), #C5C0B8 (secondary), #8A857D (muted), #5A5650 (ghost)
Accents:   #9B1B30 (crimson), #2DD4BF (teal), #C9A227 (gold), #E85A6B (error)
```

Red flags — these colors appear in drift but are NOT in the design system:
- `#333`, `#444`, `#555`, `#777`, `#888`, `#ddd` (generic grays)
- `#1A1815`, `#2A2520` (warm-tinted off-palette)
- `#131316` (too dark, use `#0E0E11` instead)
- `#101014` (too dark, use `#0E0E11` instead)

Quick grep to find off-palette colors in a feature:
```bash
grep -rn '#[0-9a-fA-F]\{3,6\}' frontend/src/features/<feature>/ \
  | grep -vE '#(0E0E11|151518|1C1C20|232328|2A2A30|323238|F0EDE8|C5C0B8|8A857D|5A5650|9B1B30|2DD4BF|C9A227|E85A6B|B22040|26B8A5|A68B1F|60A5FA|E5A84B|7C6CDB|A7F3D0)' \
  | grep -v node_modules
```

## Changes Made (Patient Similarity)

### 1. Deleted Dead Code (Task 1)

`PatientSimilarityPage.tsx` (718 lines) was the original search-centric page, but the router had been updated to point to `PatientSimilarityWorkspace.tsx`. The old file was completely unreachable — no imports, no routes. Deleted it.

**Lesson:** When a feature has two competing page files, check the router (`frontend/src/app/router.tsx`) to determine which is canonical. Delete the dead one — don't let it accumulate.

### 2. PipelineStep Design System Alignment (Task 2)

The `PipelineStep` component used raw hex colors entirely outside the palette: `#333`, `#444`, `#555`, `#777`, `#888`, `#ddd`. Also used unicode triangles (`▸`, `▾`) instead of lucide-react chevrons.

| Before | After |
|--------|-------|
| `border-[#333]` | `border-[#2A2A30]` |
| `bg-[#131316]` | `bg-[#151518]` |
| `text-[#555]` | `text-[#5A5650]` |
| `text-[#777]` | `text-[#8A857D]` |
| `text-[#ddd]` | `text-[#F0EDE8]` |
| `text-[#888]` | `text-[#8A857D]` |
| Unicode `▸` / `▾` | `<ChevronRight>` / `<ChevronDown>` |
| Text checkmark `✓` | `<CheckCircle2>` icon |
| Text X `✕` | `<XCircle>` icon |

**Lesson:** Always use lucide-react icons, never unicode symbols. The icons render consistently and can be styled with Tailwind.

### 3. CohortSelectorBar Color Fix (Task 4)

The toolbar used warm-tinted grays (`#1A1815`, `#2A2520`) that don't exist in the design system. These likely came from a different prototype palette.

| Before | After |
|--------|-------|
| `bg-[#1A1815]` | `bg-[#151518]` or `bg-[#1C1C20]` |
| `border-[#2A2520]` | `border-[#2A2A30]` |
| `focus:ring-*/50` | `focus:ring-*/15` |

**Lesson:** The design system surfaces are cool-toned grays (`#0E0E11` → `#151518` → `#1C1C20`). Warm grays are always drift.

### 4. Standard Page Layout (Task 5)

The Workspace page used `flex h-full flex-col overflow-hidden bg-[#0E0E11]` which bypassed the standard `.content-main` wrapper. This meant no max-width constraint, no centering, and inconsistent padding.

| Before | After |
|--------|-------|
| `flex h-full flex-col overflow-hidden` | `space-y-6` |
| No page header | `page-title` + `page-subtitle` |
| SimilarityModeToggle inline with title | In header action area (right-aligned) |
| `flex-1 overflow-y-auto` scroll wrapper | Natural page scroll |

**Lesson:** Unless a page truly needs full-bleed layout (like Commons), use `space-y-6` and let `.content-main` handle width/padding. Full-bleed pages must use the `.layout-full-bleed` class explicitly.

### 5. Table Alignment (Task 6)

| Before | After |
|--------|-------|
| `thead bg-[#151518]` | `bg-[#1C1C20]` |
| No sticky header | `sticky top-0 z-20` |
| `text-[10px] tracking-wider` | `text-[11px] tracking-[0.5px]` |
| `border-[#232328]` | `border-[#2A2A30]` |
| Detail cards `bg-[#151518]` | `bg-[#0E0E11]` (inset pattern) |

**Lesson:** Tables MUST have `thead` with `bg-[#1C1C20]` (overlay surface), not `bg-[#151518]` (raised surface). The distinction matters visually — headers need to be darker than the card they sit in.

### 6. Diagnostics Accordion (Task 7)

The `SearchDiagnosticsPanel` showed 5 technical diagnostic cards (candidate pool, query contract, provenance, source readiness, dimension weights) permanently. This is developer-grade telemetry that clutters the UI.

**Fix:** Wrapped in a collapsible disclosure, collapsed by default. Power users can expand it; default view stays clean.

**Lesson:** Technical metadata (cache IDs, query hashes, vector versions, candidate counts) belongs behind a disclosure. Show the 1-2 most important metrics inline; put the rest behind "Show details."

### 7. Focus State Standardization (Task 8)

All form inputs in the feature used teal focus rings (`focus:border-[#2DD4BF]`). The design system uses gold (`focus:border-[#C9A227]`).

**Find-and-replace pattern:**
```
# Find
focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40
# Replace
focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/15
```

Also check the `focus:outline-none` prefix variant.

**Lesson:** Teal is for active/selected states and primary action buttons. Gold is for focus rings, hover borders, and accent highlights. This is the single most commonly confused color pair.

### 8. Breadcrumb Pattern (Task 9)

The comparison sub-page had a small `text-xs text-[#5A5650]` "Back to results" link. The standard is `text-sm text-[#8A857D] hover:text-[#F0EDE8]` with `mb-3`.

**Lesson:** Breadcrumbs always use the parent section name (not "Back to..."), `text-sm` size, muted-to-primary hover transition.

### 9. Mode Toggle (Task 10)

The SimilarityModeToggle used `border-r` dividers and teal active state. Replaced with pill-shaped (`rounded-full`) buttons with gold active state, matching the filter chip pattern.

**Lesson:** Segmented controls in the app use pill shapes with gold accent, not bordered rectangles with teal.

## Drift Reconciliation Checklist (Reusable)

When reconciling any page with the design system, run through this checklist:

```markdown
## [Feature Name] Design System Audit

### Colors
- [ ] No hex values outside the design system palette (run grep check above)
- [ ] Focus states use gold (#C9A227), not teal
- [ ] Borders use #2A2A30 (not #232328, #333, etc.)
- [ ] Card backgrounds: outer #151518, inner/inset #0E0E11

### Layout
- [ ] Root element uses `space-y-6` (not custom flex layout)
- [ ] Page header uses `page-title` + `page-subtitle` classes
- [ ] Action buttons right-aligned in header
- [ ] No permanent sidebars (use drawers or inline sections)

### Components
- [ ] Tables: thead bg #1C1C20, sticky, text-[11px] headers
- [ ] Buttons: .btn .btn-primary (teal) or .btn .btn-secondary (bordered)
- [ ] Form inputs: gold focus rings, proper placeholder colors
- [ ] Icons: lucide-react only, no unicode symbols
- [ ] Breadcrumbs on sub-pages: text-sm, muted, parent section name

### Information Architecture
- [ ] Technical diagnostics behind accordion (collapsed by default)
- [ ] Empty states centered with muted message text
- [ ] Loading: Loader2 with text-[#8A857D]

### Cleanup
- [ ] No dead/unreachable page files
- [ ] No competing implementations of same feature
- [ ] tsc --noEmit passes
- [ ] vite build passes
- [ ] ESLint clean
```

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `pages/PatientSimilarityPage.tsx` | Deleted | -718 |
| `pages/PatientSimilarityWorkspace.tsx` | Rewritten (layout) | ~30 |
| `pages/PatientComparisonPage.tsx` | Modified (header) | ~15 |
| `components/PipelineStep.tsx` | Rewritten | ~115 |
| `components/AnalysisPipeline.tsx` | Modified | 1 |
| `components/CohortSelectorBar.tsx` | Modified (colors) | ~20 |
| `components/SimilarPatientTable.tsx` | Modified | ~25 |
| `components/SearchDiagnosticsPanel.tsx` | Rewritten (accordion) | ~60 |
| `components/SimilaritySearchForm.tsx` | Modified (focus) | ~10 |
| `components/CohortSeedForm.tsx` | Modified (focus) | ~10 |
| `components/CohortCompareForm.tsx` | Modified (focus) | ~6 |
| `components/CohortExportDialog.tsx` | Modified (focus) | 2 |
| `components/SimilarityModeToggle.tsx` | Rewritten | ~45 |

## Testing

- 23/23 unit tests pass (8 test files)
- TypeScript strict mode: 0 errors
- Vite production build: succeeds
- ESLint: clean
- Visual inspection via Playwright: both `/patient-similarity` and `/patient-similarity/compare` render correctly
- Deployed to production and smoke-tested
