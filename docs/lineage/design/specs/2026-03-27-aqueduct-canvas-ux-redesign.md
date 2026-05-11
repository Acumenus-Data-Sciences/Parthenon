# Aqueduct Canvas UX Redesign

**Date:** 2026-03-27
**Status:** Approved
**Scope:** Frontend only — `frontend/src/features/etl/`

## Problem

The Aqueduct ETL mapping canvas is buried under redundant UI layers (project selector card + mapping toolbar) that waste vertical space. Source table mapping replaces the canvas entirely with a full-page view, losing spatial context. There is no fullscreen mode for focused work. The viewport resets on navigation (sessionStorage only), and the default zoom (fitView maxZoom 1.5) is too zoomed out.

## Design Decisions

1. **Single-row slim toolbar** (~36px) replacing both project selector card and mapping toolbar
2. **Fullscreen expand** via button — CSS fixed overlay, ESC to exit
3. **Source table mapping as proportional modal** — matching CdmTableDetailModal style
4. **Viewport persistence in localStorage** per project, default zoom 2.0

---

## 1. Single-Row Slim Toolbar

**Replaces:** Project selector card (`EtlToolsPage` top section) + `MappingToolbar` component.

**Layout (left → right):**
- Back arrow (← returns to Ingestion tab project detail view)
- Project name (text, not dropdown)
- Status badge (Ready/Draft/etc.)
- Separator (│)
- Table count ("8/14 tables")
- Progress bar (80px inline, teal fill)
- Coverage percentage ("62%")
- *Right side:* Filter toggle group (All | Mapped | Unmapped), AI Suggest button, Export dropdown, Expand (⛶) button

**Key changes:**
- Project selector card is eliminated entirely. Project context comes from the URL parameter (`?project=N`) set by the "Open in Aqueduct" button on the Ingestion tab.
- No project dropdown — switching projects requires navigating back to the Ingestion tab.
- Back arrow navigates to `/ingestion?tab=upload`. The Ingestion tab's lifted `activeProjectId` state means the user returns to the project detail view they came from.
- Total height: ~36px with 8px vertical padding.

**Files affected:**
- `EtlToolsPage.tsx` — Remove project selector card UI, keep project loading from URL param
- `MappingToolbar.tsx` — Rewrite as single compact row, add expand button

## 2. Fullscreen Expand

**Trigger:** ⛶ button in the toolbar (right side). Also exits via ESC key or clicking the button again.

**Implementation:**
- CSS `position: fixed; inset: 0; z-index: 50` on the Aqueduct container
- Hides app shell (sidebar, top nav) by overlaying the entire viewport
- The slim toolbar remains visible at the top of the fullscreen view (same layout, same controls)
- All modals (source mapping, CDM detail) work identically in fullscreen — they already use portals/fixed positioning
- State: `isFullscreen` boolean managed in `AqueductCanvas` or lifted to `EtlToolsPage`
- ESC keydown listener when fullscreen is active

**Files affected:**
- `AqueductCanvas.tsx` — Add fullscreen wrapper, ESC listener
- `MappingToolbar.tsx` — Pass `isFullscreen` + `onToggleFullscreen` props, style ⛶ button differently when active

## 3. Source Table Mapping — Modal Overlay

**Replaces:** The current full-page navigation to `FieldMappingDetail` (which swaps the entire canvas view for a field list).

**New behavior:** Clicking a source table node opens a proportional modal overlay on top of the dimmed canvas, matching the existing `CdmTableDetailModal` pattern.

**Modal layout:**
- **Header:** Source table name → CDM table name, mapping progress (X/Y mapped, Z%), AI Assist button, Prev/Next navigation, close (✕) button
- **Body:** Scrollable table of CDM columns with: column name, source column assignment, mapping type, status indicator, reviewed checkbox
- **Expandable rows:** Click a row to expand inline editor (type selector, logic textarea, concept search for `_concept_id` columns, CDM documentation toggle)
- **Auto-save:** Existing 500ms debounce behavior preserved
- **Backdrop:** Semi-transparent dark overlay behind the modal, click to close

**Sizing:** `max-w-5xl w-[90%] max-h-[85vh]` centered, scrollable body. Matches CdmTableDetailModal proportions.

**Navigation:** Prev/Next buttons in the modal header iterate through table mappings without closing the modal.

**Files affected:**
- `FieldMappingDetail.tsx` — Refactor from full-page component to modal component. Wrap in fixed overlay with backdrop. Keep all existing field editing logic.
- `AqueductCanvas.tsx` — Replace `onDrillDown` callback with `onOpenSourceModal` that opens the modal overlay instead of navigating away
- `EtlToolsPage.tsx` — Remove `drilledDownMappingId` state and conditional rendering. The canvas is always visible; modals overlay it.

## 4. Viewport Persistence

**Current:** `sessionStorage` with key `aqueduct_viewport`. Lost on tab close. `fitView` on mount with `maxZoom: 1.5`.

**New:**
- **Storage:** `localStorage` keyed by `aqueduct_viewport_${projectId}`
- **Default zoom:** 2.0 centered on first visit (no saved state)
- **Saved state:** `{ x, y, zoom }` written on every viewport change (debounced ~200ms)
- **Restore:** On mount, check localStorage for saved viewport. If found, use `setViewport()`. If not, set zoom to 2.0 centered.
- **Filter state:** Also moves to `localStorage` with key `aqueduct_filter_${projectId}`

**Migration:** The old `sessionStorage` keys (`aqueduct_viewport`, `aqueduct_filter`) can be ignored — they'll expire naturally.

**Files affected:**
- `AqueductCanvas.tsx` — Change `sessionStorage` → `localStorage`, update keys to include project ID, change default zoom from fitView to 2.0

---

## Out of Scope

- Backend changes (no API modifications)
- Aqueduct layout algorithm changes (node positioning stays the same)
- AI suggest panel redesign
- Export functionality changes
- Mobile/responsive considerations (Aqueduct is a desktop tool)
