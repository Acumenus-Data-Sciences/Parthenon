# Aqueduct Canvas UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maximize the Aqueduct canvas by collapsing redundant chrome into a single-row toolbar, adding fullscreen mode, converting the source mapping drill-down into a modal, and persisting viewport state per project in localStorage.

**Architecture:** Four independent changes to the ETL feature directory. The MappingToolbar is rewritten as a compact single-row bar with an expand button. AqueductCanvas gains fullscreen CSS overlay and localStorage viewport persistence. FieldMappingDetail is wrapped in a fixed-position modal overlay (matching CdmTableDetailModal). EtlToolsPage removes the project selector card and drill-down state management.

**Tech Stack:** React 19, TypeScript, ReactFlow (@xyflow/react), Tailwind utility classes, localStorage API

---

### Task 1: Viewport Persistence — sessionStorage → localStorage per project

**Files:**
- Modify: `frontend/src/features/etl/components/aqueduct/AqueductCanvas.tsx:33-60` (persistence functions)
- Modify: `frontend/src/features/etl/components/aqueduct/AqueductCanvas.tsx:531-544` (ReactFlow props)

- [ ] **Step 1: Update persistence functions to use localStorage with project ID**

Replace lines 33–60 in `AqueductCanvas.tsx`:

```typescript
// ---------------------------------------------------------------------------
// Persistent viewport & filter (localStorage, per-project)
// ---------------------------------------------------------------------------

const DEFAULT_ZOOM = 2.0;

function viewportKey(projectId: number): string {
  return `aqueduct_viewport_${projectId}`;
}

function filterKey(projectId: number): string {
  return `aqueduct_filter_${projectId}`;
}

function loadViewport(projectId: number): Viewport | null {
  try {
    const raw = localStorage.getItem(viewportKey(projectId));
    if (raw) return JSON.parse(raw) as Viewport;
  } catch { /* ignore */ }
  return null;
}

function saveViewport(projectId: number, vp: Viewport): void {
  localStorage.setItem(viewportKey(projectId), JSON.stringify(vp));
}

function loadFilter(projectId: number): "all" | "mapped" | "unmapped" {
  const raw = localStorage.getItem(filterKey(projectId));
  if (raw === "all" || raw === "mapped" || raw === "unmapped") return raw;
  return "all";
}

function saveFilter(projectId: number, f: string): void {
  localStorage.setItem(filterKey(projectId), f);
}
```

- [ ] **Step 2: Update AqueductCanvasInner to use project-scoped persistence**

In `AqueductCanvasInner`, update the `useState` for filter (line 153):

```typescript
const [filter, setFilterRaw] = useState<"all" | "mapped" | "unmapped">(() => loadFilter(project.id));
const setFilter = useCallback((f: "all" | "mapped" | "unmapped") => {
  setFilterRaw(f);
  saveFilter(project.id, f);
}, [project.id]);
```

- [ ] **Step 3: Replace fitView with defaultViewport or saved viewport**

Update the ReactFlow component props (around line 531). Replace `fitView` and `fitViewOptions` with conditional `defaultViewport`:

```typescript
const savedViewport = useMemo(() => loadViewport(project.id), [project.id]);

// In the ReactFlow component, replace:
//   fitView
//   fitViewOptions={{ maxZoom: 1.5, minZoom: 0.5, padding: 0.12 }}
// With:
//   defaultViewport={savedViewport ?? { x: 0, y: 0, zoom: DEFAULT_ZOOM }}
//   fitView={!savedViewport}
//   fitViewOptions={savedViewport ? undefined : { maxZoom: DEFAULT_ZOOM, minZoom: 0.5, padding: 0.12 }}
```

And update the `onMoveEnd` handler:

```typescript
onMoveEnd={(_event, viewport) => saveViewport(project.id, viewport)}
```

- [ ] **Step 4: Verify in Docker**

Run: `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit --pretty 2>&1"`
Expected: No output (clean)

- [ ] **Step 5: Build and test**

Run: `docker compose exec -T node sh -c "cd /app && npx vite build 2>&1" | tail -5`
Expected: Build succeeds. Verify in browser that canvas starts at zoom 2.0, and refreshing preserves the viewport.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/etl/components/aqueduct/AqueductCanvas.tsx
git commit -m "feat(aqueduct): persist viewport in localStorage per project, default zoom 2.0"
```

---

### Task 2: Rewrite MappingToolbar as Single Compact Row

**Files:**
- Modify: `frontend/src/features/etl/components/aqueduct/MappingToolbar.tsx` (full rewrite of layout)

- [ ] **Step 1: Add fullscreen props to the interface**

Add two new props to `MappingToolbarProps`:

```typescript
interface MappingToolbarProps {
  projectName: string;
  status: string;
  mappedTables: number;
  totalCdmTables: number;
  fieldCoveragePct: number;
  filter: "all" | "mapped" | "unmapped";
  onFilterChange: (f: "all" | "mapped" | "unmapped") => void;
  onBack: () => void;
  onSuggest: () => void;
  isSuggesting: boolean;
  onExport: (format: "markdown" | "sql" | "json") => void;
  isExporting: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}
```

- [ ] **Step 2: Rewrite the toolbar component as a single compact row**

Replace the entire `MappingToolbarComponent` function body (keep `STATUS_STYLES`, `FILTER_OPTIONS`, `EXPORT_OPTIONS` constants and the `memo` export):

```tsx
function MappingToolbarComponent({
  projectName,
  status,
  mappedTables,
  totalCdmTables,
  fieldCoveragePct,
  filter,
  onFilterChange,
  onBack,
  onSuggest,
  isSuggesting,
  onExport,
  isExporting,
  isFullscreen,
  onToggleFullscreen,
}: MappingToolbarProps) {
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const progressPct = totalCdmTables > 0 ? (mappedTables / totalCdmTables) * 100 : 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(event.target as HTMLElement)) {
        setExportOpen(false);
      }
    }
    if (exportOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [exportOpen]);

  return (
    <div className="bg-[#0E0E11] border-b border-[#2A2A30] px-4 py-2 flex items-center justify-between gap-3">
      {/* Left: back + project + status + progress */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="text-[#8A857D] hover:text-[#F0EDE8] transition-colors p-0.5 flex-shrink-0"
          aria-label="Go back"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <span className="text-[#F0EDE8] font-medium text-sm truncate max-w-[200px]">{projectName}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusStyle.bg} ${statusStyle.text}`}>
          {statusStyle.label}
        </span>
        <span className="text-[#323238] flex-shrink-0">│</span>
        <span className="text-[#8A857D] text-xs flex-shrink-0 whitespace-nowrap">
          {mappedTables}/{totalCdmTables}
        </span>
        <div className="w-20 h-[3px] bg-[#2A2A30] rounded-full overflow-hidden flex-shrink-0">
          <div
            className="h-full bg-[#2DD4BF] rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
        <span className="text-[#2DD4BF] text-xs flex-shrink-0">{fieldCoveragePct}%</span>
      </div>

      {/* Right: filters + actions + expand */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex rounded-md overflow-hidden border border-[#2A2A30]">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onFilterChange(opt.value)}
              className={`text-[10px] px-2.5 py-1 transition-colors ${
                filter === opt.value
                  ? "bg-[#2DD4BF]/20 text-[#2DD4BF] font-medium"
                  : "text-[#5A5650] hover:text-[#F0EDE8] hover:bg-[#1C1C20]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onSuggest}
          disabled={isSuggesting}
          className="text-[10px] px-2.5 py-1 border border-[#2A2A30] rounded-md transition-colors disabled:opacity-50 text-[#C9A227] hover:bg-amber-900/30"
        >
          {isSuggesting ? "Suggesting..." : "✨ AI"}
        </button>
        <div className="relative" ref={exportRef}>
          <button
            type="button"
            onClick={() => setExportOpen((prev) => !prev)}
            disabled={isExporting}
            className="text-[10px] px-2.5 py-1 border border-[#2A2A30] rounded-md transition-colors disabled:opacity-50 text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#1C1C20]"
          >
            {isExporting ? "..." : "Export ▾"}
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-[#1C1C20] border border-[#2A2A30] rounded-lg shadow-lg z-50 overflow-hidden">
              {EXPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.format}
                  type="button"
                  onClick={() => { setExportOpen(false); onExport(opt.format); }}
                  className="w-full text-left text-xs px-3 py-2 text-[#8A857D] hover:bg-[#2A2A30]/80 hover:text-[#F0EDE8] transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleFullscreen}
          className={`text-sm px-1.5 py-0.5 rounded transition-colors ${
            isFullscreen
              ? "text-[#F0EDE8] bg-[#2A2A30] border border-[#2DD4BF]"
              : "text-[#8A857D] border border-[#323238] hover:text-[#F0EDE8]"
          }`}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          ⛶
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit --pretty 2>&1"`
Expected: Errors about missing `isFullscreen`/`onToggleFullscreen` props at the call site (will be fixed in Task 3).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/etl/components/aqueduct/MappingToolbar.tsx
git commit -m "feat(aqueduct): rewrite MappingToolbar as single compact row with expand button"
```

---

### Task 3: Add Fullscreen Mode to AqueductCanvas

**Files:**
- Modify: `frontend/src/features/etl/components/aqueduct/AqueductCanvas.tsx:502-571` (component render, add fullscreen wrapper)

- [ ] **Step 1: Add fullscreen state and ESC listener**

In `AqueductCanvasInner`, after the existing state declarations (around line 160), add:

```typescript
const [isFullscreen, setIsFullscreen] = useState(false);

useEffect(() => {
  if (!isFullscreen) return;
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") setIsFullscreen(false);
  };
  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}, [isFullscreen]);
```

- [ ] **Step 2: Pass fullscreen props to MappingToolbar**

Update the MappingToolbar call site (around line 504) to include the new props:

```typescript
<MappingToolbar
  projectName={project.name}
  status={project.status}
  mappedTables={mappedTables}
  totalCdmTables={totalCdmTables}
  fieldCoveragePct={fieldCoveragePct}
  filter={filter}
  onFilterChange={setFilter}
  onBack={onBack}
  onSuggest={handleSuggest}
  isSuggesting={suggestMutation.isPending}
  onExport={handleExport}
  isExporting={isExporting}
  isFullscreen={isFullscreen}
  onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
/>
```

- [ ] **Step 3: Wrap the return JSX in a fullscreen-capable container**

Replace the outer `<div>` in the return statement (line 503) with a fullscreen-aware wrapper:

```tsx
return (
  <div
    className={cn(
      "flex flex-col",
      isFullscreen
        ? "fixed inset-0 z-50 bg-[#0E0E11]"
        : "h-[calc(100vh-200px)]",
    )}
  >
```

Add `import { cn } from "@/lib/utils";` to the imports at the top of the file if not already present.

- [ ] **Step 4: Verify TypeScript**

Run: `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit --pretty 2>&1"`
Expected: Clean (no output)

- [ ] **Step 5: Build and test**

Run: `docker compose exec -T node sh -c "cd /app && npx vite build 2>&1" | tail -5`
Expected: Build succeeds. Verify: click ⛶ → canvas fills viewport. ESC or click ⛶ again → back to normal.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/etl/components/aqueduct/AqueductCanvas.tsx
git commit -m "feat(aqueduct): add fullscreen mode with ESC key exit"
```

---

### Task 4: Convert FieldMappingDetail to Modal Overlay

**Files:**
- Modify: `frontend/src/features/etl/components/aqueduct/FieldMappingDetail.tsx:602-911` (wrap in modal overlay)
- Modify: `frontend/src/features/etl/components/aqueduct/AqueductCanvas.tsx:480-489` (source node click opens modal)
- Modify: `frontend/src/features/etl/pages/EtlToolsPage.tsx:30-220` (remove drill-down state, always show canvas)

- [ ] **Step 1: Wrap FieldMappingDetail render in a fixed modal overlay**

Replace the outer container in `FieldMappingDetail` (line 602–603):

```tsx
// Old:
//   <div className="flex flex-col h-[calc(100vh-200px)]">
// New:
return (
  <>
    <div className="fixed inset-0 z-40 bg-black/50" onClick={onBack} />
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl rounded-xl border border-[#232328] bg-[#151518] shadow-2xl max-h-[85vh] flex flex-col">
```

And close the new wrappers at the end of the component (replace the closing `</div>` at line 909):

```tsx
      </div>
    </div>
  </>
);
```

- [ ] **Step 2: Update the header bar to be modal-appropriate**

Replace the header bar (lines 604–649). Change the back button to a close (✕) button:

```tsx
{/* Modal header */}
<div className="flex items-center justify-between px-5 py-3 border-b border-[#2A2A30] bg-[#0E0E11] rounded-t-xl">
  <div className="flex items-center gap-2 text-sm">
    <span className="text-[#C9A227] font-medium">{tableMapping.source_table}</span>
    <span className="text-[#5A5650]">→</span>
    <span className="text-[#2DD4BF] font-medium">{tableMapping.target_table}</span>
    <span className="text-[#323238] ml-2">│</span>
    <span className="text-xs text-[#8A857D]">
      <span className={requiredUnmappedCount > 0 ? "text-red-400 font-medium" : "text-emerald-400"}>
        {mappedCount}/{totalCdm}
      </span>
      {" mapped"}
    </span>
  </div>

  <div className="flex items-center gap-3">
    <button
      onClick={() => setAiPanelOpen(true)}
      className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] rounded-md bg-[#C9A227]/10 text-[#C9A227] hover:bg-[#C9A227]/20 transition-colors font-medium"
    >
      <Sparkles className="w-3 h-3" />
      AI Assist
    </button>
    <div className="flex items-center gap-1 text-xs">
      <button onClick={navigatePrev} disabled={!hasPrev} className="text-[#8A857D] hover:text-[#F0EDE8] disabled:opacity-30 transition-colors px-1">
        ◀ Prev
      </button>
      <button onClick={navigateNext} disabled={!hasNext} className="text-[#8A857D] hover:text-[#F0EDE8] disabled:opacity-30 transition-colors px-1">
        Next ▶
      </button>
    </div>
    <button type="button" onClick={onBack} className="p-1 text-[#5A5650] hover:text-[#F0EDE8] transition-colors">
      <X size={18} />
    </button>
  </div>
</div>
```

- [ ] **Step 3: Verify TypeScript**

Run: `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit --pretty 2>&1"`
Expected: Clean

- [ ] **Step 4: Commit FieldMappingDetail modal conversion**

```bash
git add frontend/src/features/etl/components/aqueduct/FieldMappingDetail.tsx
git commit -m "feat(aqueduct): convert FieldMappingDetail to proportional modal overlay"
```

---

### Task 5: Update AqueductCanvas — Source Click Opens Modal Instead of Drill-Down

**Files:**
- Modify: `frontend/src/features/etl/components/aqueduct/AqueductCanvas.tsx:83-89` (props interface)
- Modify: `frontend/src/features/etl/components/aqueduct/AqueductCanvas.tsx:146-152` (destructured props)
- Modify: `frontend/src/features/etl/components/aqueduct/AqueductCanvas.tsx:480-489` (node click handler)
- Modify: `frontend/src/features/etl/components/aqueduct/AqueductCanvas.tsx:502-570` (render, add source modal state + FieldMappingDetail modal)

- [ ] **Step 1: Update AqueductCanvasProps — replace onDrillDown with source data props**

Replace the props interface (lines 83–89):

```typescript
interface AqueductCanvasProps {
  project: EtlProject;
  tableMappings: EtlTableMapping[];
  sourceFields: PersistedFieldProfile[];
  onBack: () => void;
}
```

Remove `onDrillDown` from the destructured props in `AqueductCanvasInner` (line 146–152):

```typescript
function AqueductCanvasInner({
  project,
  tableMappings,
  sourceFields,
  onBack,
}: AqueductCanvasProps) {
```

- [ ] **Step 2: Add source modal state and derive source/CDM column data**

After the existing state declarations in `AqueductCanvasInner`, add:

```typescript
const [sourceMappingId, setSourceMappingId] = useState<number | null>(null);

const sourceModalMapping = useMemo(
  () => sourceMappingId !== null ? tableMappings.find((m) => m.id === sourceMappingId) ?? null : null,
  [tableMappings, sourceMappingId],
);

const allMappingIds = useMemo(
  () => tableMappings.map((m) => m.id),
  [tableMappings],
);

const sourceModalColumns = useMemo(() => {
  if (!sourceModalMapping) return [];
  return sourceFields
    .filter((f) => f.table_name === sourceModalMapping.source_table)
    .map((f) => ({
      name: f.column_name,
      type: f.inferred_type,
      nullPct: f.null_percentage,
      distinctCount: f.distinct_count,
    }));
}, [sourceModalMapping, sourceFields]);

const sourceModalCdmColumns = useMemo(() => {
  if (!sourceModalMapping) return [];
  const cdmTable = CDM_ETL_TABLES.find((t) => t.name === sourceModalMapping.target_table);
  return (
    cdmTable?.columns.map((c) => ({
      name: c.name,
      type: c.type,
      required: c.required,
      description: c.description,
      etl_conventions: c.etl_conventions,
      fk_table: c.fk_table,
      fk_domain: c.fk_domain,
    })) ?? []
  );
}, [sourceModalMapping]);
```

- [ ] **Step 3: Update node click handler and edge onClick**

Replace `handleNodeClick` (lines 480–489):

```typescript
const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
  if (node.id.startsWith("cdm-")) {
    setDetailCdmTable(node.id.replace("cdm-", ""));
  } else if (node.id.startsWith("source-")) {
    const sourceTable = node.id.replace("source-", "");
    const mapping = tableMappings.find((m) => m.source_table === sourceTable);
    if (mapping) setSourceMappingId(mapping.id);
  }
}, [tableMappings]);
```

Also, in the edge `data.onClick` callbacks inside the `useMemo` that builds nodes and edges, replace all `() => onDrillDown(mapping.id)` with `() => setSourceMappingId(mapping.id)`.

- [ ] **Step 4: Add FieldMappingDetail modal to the render**

Add import at the top of the file:

```typescript
import { FieldMappingDetail } from "./FieldMappingDetail";
```

Before the closing `</div>` of the outer container (after the CDM table detail modal block, around line 569), add:

```tsx
{/* Source table mapping modal */}
{sourceModalMapping && (
  <FieldMappingDetail
    project={project}
    tableMapping={sourceModalMapping}
    sourceColumns={sourceModalColumns}
    cdmColumns={sourceModalCdmColumns}
    onBack={() => setSourceMappingId(null)}
    onNavigate={(id) => setSourceMappingId(id)}
    allMappingIds={allMappingIds}
  />
)}
```

- [ ] **Step 5: Update the CdmTableDetailModal's onDrillDown to use setSourceMappingId**

In the CdmTableDetailModal render (around line 559), change `onDrillDown={onDrillDown}` to:

```typescript
onDrillDown={(id) => { setDetailCdmTable(null); setSourceMappingId(id); }}
```

- [ ] **Step 6: Verify TypeScript**

Run: `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit --pretty 2>&1"`
Expected: Errors about `EtlToolsPage` still passing `onDrillDown` prop (fixed in Task 6)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/etl/components/aqueduct/AqueductCanvas.tsx
git commit -m "feat(aqueduct): source table click opens FieldMappingDetail modal over canvas"
```

---

### Task 6: Simplify EtlToolsPage — Remove Project Selector Card and Drill-Down State

**Files:**
- Modify: `frontend/src/features/etl/pages/EtlToolsPage.tsx` (remove selector card, remove drill-down, simplify AqueductContent)

- [ ] **Step 1: Simplify AqueductContent — remove drill-down props and rendering**

Replace the `AqueductContent` component (lines 30–220):

```tsx
function AqueductContent({
  ingestionProjectId,
}: {
  ingestionProjectId: number;
}) {
  const { data: projectsData, isLoading: loadingProjects } = useEtlProjects();
  const createProject = useCreateEtlProject();
  const [cdmVersion, setCdmVersion] = useState("5.4");

  const existingProject = useMemo(() => {
    if (!projectsData?.data) return null;
    return projectsData.data.find((p) => p.ingestion_project_id === ingestionProjectId) ?? null;
  }, [projectsData, ingestionProjectId]);

  const projectId = existingProject?.id ?? 0;
  const { data: projectDetail } = useEtlProject(projectId);
  const { data: tableMappings = [] } = useTableMappings(projectId);

  const [sourceFields, setSourceFields] = useState<PersistedFieldProfile[]>([]);
  const [fieldsLoaded, setFieldsLoaded] = useState(false);

  useMemo(() => {
    if (ingestionProjectId > 0 && !fieldsLoaded) {
      fetchIngestionProjectFields(ingestionProjectId)
        .then((fields) => {
          setSourceFields(fields);
          setFieldsLoaded(true);
        })
        .catch(() => {
          setFieldsLoaded(true);
        });
    }
  }, [ingestionProjectId, fieldsLoaded]);

  const handleCreateProject = useCallback(() => {
    createProject.mutate(
      {
        ingestion_project_id: ingestionProjectId,
        cdm_version: cdmVersion,
      },
      {
        onSuccess: (newProject) => {
          suggestMappings(newProject.id).catch(() => {});
        },
      },
    );
  }, [createProject, ingestionProjectId, cdmVersion]);

  if (loadingProjects) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#2DD4BF]" />
        <span className="ml-3 text-sm text-[#8A857D]">Loading ETL projects...</span>
      </div>
    );
  }

  if (!existingProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed border-[#2E2E35] bg-[#151518]">
        <div className="w-16 h-16 rounded-full bg-[#1C1C20] flex items-center justify-center mb-4">
          <GitMerge size={28} className="text-[#2DD4BF]" />
        </div>
        <h3 className="text-[#F0EDE8] font-semibold text-lg">
          Create ETL Mapping Project
        </h3>
        <p className="text-sm text-[#8A857D] mt-1 text-center max-w-md">
          Start mapping your source schema to the OMOP CDM. Select a source
          that has been profiled via the Source Profiler tab first.
        </p>
        <div className="mt-6 flex items-center gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#8A857D] uppercase tracking-wider">
              CDM Version
            </label>
            <select
              value={cdmVersion}
              onChange={(e) => setCdmVersion(e.target.value)}
              className="rounded-lg bg-[#1C1C20] border border-[#2E2E35] px-3 py-2 text-sm text-[#F0EDE8] focus:outline-none focus:border-[#2DD4BF]"
            >
              <option value="5.4">OMOP CDM v5.4</option>
              <option value="5.3">OMOP CDM v5.3</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleCreateProject}
            disabled={createProject.isPending}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-5 py-2.5 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] transition-colors disabled:opacity-50"
          >
            {createProject.isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus size={15} />
                Create Project
              </>
            )}
          </button>
        </div>
        {createProject.isError && (
          <p className="mt-3 text-xs text-[#E85A6B]">
            {(createProject.error as Error)?.message ?? "Failed to create project"}
          </p>
        )}
      </div>
    );
  }

  if (projectDetail) {
    return (
      <AqueductCanvas
        project={projectDetail.project}
        tableMappings={tableMappings}
        sourceFields={sourceFields}
        onBack={() => window.history.back()}
      />
    );
  }

  return null;
}
```

- [ ] **Step 2: Simplify the main EtlToolsPage — remove project selector card**

Replace `EtlToolsPage` (lines 226–313):

```tsx
export default function EtlToolsPage() {
  const [searchParams] = useSearchParams();
  const projectParam = searchParams.get("project");

  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(() =>
    projectParam ? Number(projectParam) : "",
  );

  useEffect(() => {
    if (projectParam && Number(projectParam) > 0) {
      setSelectedProjectId(Number(projectParam));
    }
  }, [projectParam]);

  const { data: projectsData } = useQuery({
    queryKey: ["ingestion-projects"],
    queryFn: fetchIngestionProjects,
  });

  const readyProjects = useMemo(() => {
    const all = projectsData?.data ?? [];
    return all.filter((p: IngestionProject) => p.status === "ready" || p.status === "mapping" || p.status === "completed");
  }, [projectsData]);

  const selectedProjectIdNum = Number(selectedProjectId) || 0;
  const hasJobs = readyProjects.some((p: IngestionProject) => p.id === selectedProjectIdNum);

  if (selectedProjectId && hasJobs) {
    return (
      <AqueductContent ingestionProjectId={selectedProjectIdNum} />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 rounded-lg border border-dashed border-[#2E2E35] bg-[#151518]">
      <div className="w-16 h-16 rounded-full bg-[#1C1C20] flex items-center justify-center mb-4">
        <GitMerge size={28} className="text-[#8A857D]" />
      </div>
      <h3 className="text-[#F0EDE8] font-semibold text-lg">
        Aqueduct ETL Mapping Designer
      </h3>
      <p className="text-sm text-[#8A857D] mt-1 text-center max-w-md">
        Navigate to an ingestion project and click &ldquo;Open in Aqueduct&rdquo; to start
        designing ETL mappings from your source schema to the OMOP CDM.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Clean up unused imports**

Remove these imports that are no longer needed:
- `Database` from lucide-react (was used by the project selector)
- `FieldMappingDetail` (moved to AqueductCanvas)
- `CDM_SCHEMA_V54` (was used for drilled-down CDM columns, now handled in AqueductCanvas)

Keep: `useState`, `useMemo`, `useCallback`, `useEffect`, `useQuery`, `useSearchParams`, `Loader2`, `GitMerge`, `Plus`, `fetchIngestionProjects`, `type IngestionProject`, `AqueductCanvas`, `useEtlProjects`, `useCreateEtlProject`, `useEtlProject`, `useTableMappings`, `fetchIngestionProjectFields`, `suggestMappings`, `type PersistedFieldProfile`.

- [ ] **Step 4: Verify TypeScript**

Run: `docker compose exec -T node sh -c "cd /app && npx tsc --noEmit --pretty 2>&1"`
Expected: Clean (no output)

- [ ] **Step 5: Build and deploy**

Run: `docker compose exec -T node sh -c "cd /app && npx vite build 2>&1" | tail -5`
Expected: Build succeeds.

- [ ] **Step 6: Full functional test**

Verify in browser:
1. Navigate to Data Ingestion → select a ready project → click "Open in Aqueduct"
2. Canvas appears immediately below the slim toolbar (no project selector card)
3. Default zoom is 2.0 on first visit
4. Pan/zoom, navigate away, come back → viewport is restored
5. Click ⛶ → fullscreen, ESC → back to normal
6. Click source table → modal opens over dimmed canvas
7. Click CDM table → modal opens (unchanged behavior)
8. Prev/Next in source modal navigates without closing
9. Close modal → canvas is visible with correct viewport

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/etl/pages/EtlToolsPage.tsx
git commit -m "feat(aqueduct): remove project selector card, simplify to canvas-first layout"
```
