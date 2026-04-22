import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Node,
  type Edge,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { SourceTableNode } from "./SourceTableNode";
import { CdmTableNode } from "./CdmTableNode";
import { StemTableNode } from "./StemTableNode";
import { MappingEdge } from "./MappingEdge";
import { MappingToolbar } from "./MappingToolbar";
import CdmTableDetailModal from "./CdmTableDetailModal";
import { FieldMappingDetail } from "./FieldMappingDetail";
import { CDM_SCHEMA_V54 } from "../../lib/cdm-schema-v54";

// Vocabulary tables are reference data, not ETL targets — exclude from mapping canvas
const CDM_ETL_TABLES = CDM_SCHEMA_V54.filter((t) => t.domain !== "Vocabulary");
import { computeLayout, type LayoutNode, type LayoutEdge } from "../../lib/aqueduct-layout";
import { useCreateTableMapping, useSuggestMappings } from "../../hooks/useAqueductData";
import type { EtlProject, EtlTableMapping, PersistedFieldProfile } from "../../api";
import { downloadExport } from "../../api";

// ---------------------------------------------------------------------------
// Persistent viewport & filter (localStorage, per-project)
// ---------------------------------------------------------------------------

const DEFAULT_ZOOM = 0.85;

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;

const nodeTypes = {
  sourceTable: SourceTableNode,
  cdmTable: CdmTableNode,
  stemTable: StemTableNode,
};

const edgeTypes = {
  mappingEdge: MappingEdge,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AqueductCanvasProps {
  project: EtlProject;
  tableMappings: EtlTableMapping[];
  sourceFields: PersistedFieldProfile[];
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SourceTableInfo {
  tableName: string;
  columnCount: number;
  rowCount: number;
}

function buildSourceTables(fields: PersistedFieldProfile[]): SourceTableInfo[] {
  const grouped = new Map<string, { cols: Set<string>; rowCount: number }>();
  for (const f of fields) {
    const existing = grouped.get(f.table_name);
    if (existing) {
      existing.cols.add(f.column_name);
      if (f.row_count > existing.rowCount) {
        existing.rowCount = f.row_count;
      }
    } else {
      grouped.set(f.table_name, {
        cols: new Set([f.column_name]),
        rowCount: f.row_count,
      });
    }
  }
  return Array.from(grouped.entries()).map(([tableName, info]) => ({
    tableName,
    columnCount: info.cols.size,
    rowCount: info.rowCount,
  }));
}

function extractSourceFromNodeId(nodeId: string): string {
  return nodeId.replace(/^source-/, "");
}

function extractCdmFromNodeId(nodeId: string): string {
  return nodeId.replace(/^cdm-/, "");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AqueductCanvas(props: AqueductCanvasProps) {
  // Key forces remount when source data or mappings change
  const key = `${props.sourceFields.length}-${props.tableMappings.length}`;
  return (
    <ReactFlowProvider key={key}>
      <AqueductCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function AqueductCanvasInner({
  project,
  tableMappings,
  sourceFields,
  onBack,
}: AqueductCanvasProps) {
  const { t } = useTranslation("app");
  const [filter, setFilterRaw] = useState<"all" | "mapped" | "unmapped">(() => loadFilter(project.id));
  const setFilter = useCallback((f: "all" | "mapped" | "unmapped") => {
    setFilterRaw(f);
    saveFilter(project.id, f);
  }, [project.id]);
  const [suggestBanner, setSuggestBanner] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [detailCdmTable, setDetailCdmTable] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { fitView } = useReactFlow();

  // Re-center canvas when toggling fullscreen (container size changes)
  useEffect(() => {
    // Small delay to let the portal/container resize before fitting
    const timer = setTimeout(() => fitView({ padding: 0.08, duration: 300 }), 100);
    return () => clearTimeout(timer);
  }, [isFullscreen, fitView]);

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

  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only exit fullscreen if no modal is open (modals have their own close UX)
      if (e.key === "Escape" && !sourceMappingId && !detailCdmTable) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, sourceMappingId, detailCdmTable]);

  const createMapping = useCreateTableMapping(project.id);
  const suggestMutation = useSuggestMappings(project.id);

  const handleExport = useCallback(async (format: "markdown" | "sql" | "json") => {
    setIsExporting(true);
    try {
      await downloadExport(project.id, format);
    } finally {
      setIsExporting(false);
    }
  }, [project.id]);

  // -- Derive connected sets --------------------------------------------------
  const connectedSources = useMemo(
    () => new Set(tableMappings.map((m) => m.source_table)),
    [tableMappings],
  );
  const connectedCdm = useMemo(
    () => new Set(tableMappings.map((m) => m.target_table)),
    [tableMappings],
  );

  // -- Build source tables from field profiles --------------------------------
  const sourceTables = useMemo(() => buildSourceTables(sourceFields), [sourceFields]);

  // -- Compute progress -------------------------------------------------------
  const totalCdmTables = CDM_ETL_TABLES.length;
  const mappedTables = connectedCdm.size;
  const fieldCoveragePct = useMemo(() => {
    if (tableMappings.length === 0) return 0;
    let totalFields = 0;
    let mappedFields = 0;
    for (const mapping of tableMappings) {
      const cdmTable = CDM_ETL_TABLES.find((t) => t.name === mapping.target_table);
      if (cdmTable) {
        totalFields += cdmTable.columns.length;
        mappedFields += mapping.field_mappings_count ?? 0;
      }
    }
    return totalFields > 0 ? Math.round((mappedFields / totalFields) * 100) : 0;
  }, [tableMappings]);

  // -- Build nodes & edges before layout --------------------------------------
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const layoutNodes: LayoutNode[] = [];
    const layoutEdges: LayoutEdge[] = [];

    // Column header labels (positioned after layout computation)
    nodes.push({
      id: "header-source",
      type: "default",
      data: {
        label: t("etl.aqueduct.canvas.sourceHeader", { count: sourceTables.length }),
      },
      position: { x: 0, y: 0 },
      selectable: false,
      draggable: false,
      connectable: false,
      style: {
        background: "transparent",
        border: "none",
        color: "var(--accent)",
        fontSize: "15px",
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
        width: NODE_WIDTH,
        pointerEvents: "none" as const,
      },
    });
    nodes.push({
      id: "header-cdm",
      type: "default",
      data: {
        label: t("etl.aqueduct.canvas.cdmHeader", { count: CDM_ETL_TABLES.length }),
      },
      position: { x: 0, y: 0 },
      selectable: false,
      draggable: false,
      connectable: false,
      style: {
        background: "transparent",
        border: "none",
        color: "var(--success)",
        fontSize: "15px",
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.05em",
        width: NODE_WIDTH,
        pointerEvents: "none" as const,
      },
    });

    // Source nodes
    for (const st of sourceTables) {
      const nodeId = `source-${st.tableName}`;
      const isMapped = connectedSources.has(st.tableName);
      const hidden = filter === "mapped" ? !isMapped : filter === "unmapped" ? isMapped : false;

      nodes.push({
        id: nodeId,
        type: "sourceTable",
        data: {
          tableName: st.tableName,
          columnCount: st.columnCount,
          rowCount: st.rowCount,
          dimmed: filter === "all" && !isMapped,
        },
        position: { x: 0, y: 0 },
        hidden,
      });
      layoutNodes.push({ id: nodeId, width: NODE_WIDTH, height: NODE_HEIGHT, group: "source" });
    }

    // CDM nodes
    for (const cdmTable of CDM_ETL_TABLES) {
      const nodeId = `cdm-${cdmTable.name}`;
      const isMapped = connectedCdm.has(cdmTable.name);
      const hidden = filter === "mapped" ? !isMapped : filter === "unmapped" ? isMapped : false;

      const requiredCount = cdmTable.columns.filter((c) => c.required).length;
      // Count mapped required fields across all mappings targeting this table
      let mappedRequiredCount = 0;
      for (const mapping of tableMappings) {
        if (mapping.target_table === cdmTable.name && mapping.field_mappings) {
          const requiredColNames = new Set(
            cdmTable.columns.filter((c) => c.required).map((c) => c.name),
          );
          for (const fm of mapping.field_mappings) {
            if (requiredColNames.has(fm.target_column)) {
              mappedRequiredCount++;
            }
          }
        }
      }

      nodes.push({
        id: nodeId,
        type: "cdmTable",
        data: {
          tableName: cdmTable.name,
          domain: cdmTable.domain,
          requiredCount,
          mappedRequiredCount,
          dimmed: filter === "all" && !isMapped,
        },
        position: { x: 0, y: 0 },
        hidden,
      });
      layoutNodes.push({ id: nodeId, width: NODE_WIDTH, height: NODE_HEIGHT, group: "cdm" });
    }

    // Stem table nodes — group stem mappings by source_table
    const stemMappings = tableMappings.filter((m) => m.is_stem);
    const stemBySource = new Map<string, EtlTableMapping[]>();
    for (const m of stemMappings) {
      const existing = stemBySource.get(m.source_table) ?? [];
      existing.push(m);
      stemBySource.set(m.source_table, existing);
    }

    for (const [sourceTable, mappings] of stemBySource) {
      const stemNodeId = `stem-${sourceTable}`;
      const routingRules = mappings.length;
      // Count unique target columns across all stem mappings from this source
      const allFieldMappings = mappings.flatMap((m) => m.field_mappings ?? []);
      const uniqueColumns = new Set(allFieldMappings.map((fm) => fm.target_column));

      nodes.push({
        id: stemNodeId,
        type: "stemTable",
        data: {
          tableName: `stem_${sourceTable}`,
          columnCount: uniqueColumns.size,
          routingRules,
        },
        position: { x: 0, y: 0 },
      });
      layoutNodes.push({ id: stemNodeId, width: NODE_WIDTH, height: NODE_HEIGHT, group: "stem" });
    }

    // Edges from table mappings
    for (const mapping of tableMappings) {
      const sourceId = `source-${mapping.source_table}`;
      const targetId = `cdm-${mapping.target_table}`;
      const cdmTable = CDM_ETL_TABLES.find((t) => t.name === mapping.target_table);
      const totalFields = cdmTable ? cdmTable.columns.length : 0;
      const mappedFields = mapping.field_mappings_count ?? 0;

      // Determine if there are unmapped required fields
      const requiredCols = cdmTable
        ? cdmTable.columns.filter((c) => c.required).map((c) => c.name)
        : [];
      const mappedCols = new Set(
        (mapping.field_mappings ?? []).map((fm) => fm.target_column),
      );
      const hasUnmappedRequired = requiredCols.some((col) => !mappedCols.has(col));
      const isComplete = mapping.is_completed;

      const hidden = filter === "unmapped";

      if (mapping.is_stem) {
        // Stem mappings: source -> stem -> CDM
        const stemNodeId = `stem-${mapping.source_table}`;

        // Source to stem edge
        const sourceToStemId = `edge-s2stem-${mapping.id}`;
        if (!edges.some((e) => e.source === sourceId && e.target === stemNodeId)) {
          edges.push({
            id: sourceToStemId,
            source: sourceId,
            target: stemNodeId,
            type: "mappingEdge",
            data: {
              mappedFields,
              totalFields,
              hasUnmappedRequired: false,
              isComplete: false,
              isAiSuggested: false,
              isReviewed: true,
              onClick: () => setSourceMappingId(mapping.id),
            },
            hidden,
          });
          layoutEdges.push({ source: sourceId, target: stemNodeId });
        }

        // Stem to CDM edge
        edges.push({
          id: `edge-stem2cdm-${mapping.id}`,
          source: stemNodeId,
          target: targetId,
          type: "mappingEdge",
          data: {
            mappedFields,
            totalFields,
            hasUnmappedRequired,
            isComplete,
            isAiSuggested: false,
            isReviewed: true,
            onClick: () => setSourceMappingId(mapping.id),
          },
          hidden,
        });
        layoutEdges.push({ source: stemNodeId, target: targetId });
      } else {
        // Regular direct mapping
        edges.push({
          id: `edge-${mapping.id}`,
          source: sourceId,
          target: targetId,
          type: "mappingEdge",
          data: {
            mappedFields,
            totalFields,
            hasUnmappedRequired,
            isComplete,
            isAiSuggested: false,
            isReviewed: true,
            onClick: () => setSourceMappingId(mapping.id),
          },
          hidden,
        });
        layoutEdges.push({ source: sourceId, target: targetId });
      }
    }

    // Compute layout positions
    const positioned = computeLayout(layoutNodes, layoutEdges);
    for (const pos of positioned) {
      const node = nodes.find((n) => n.id === pos.id);
      if (node) {
        node.position = { x: pos.x, y: pos.y };
      }
    }

    // Position column headers above their respective columns
    const firstSource = positioned.find((p) => p.id.startsWith("source-"));
    const firstCdm = positioned.find((p) => p.id.startsWith("cdm-"));
    const headerSource = nodes.find((n) => n.id === "header-source");
    const headerCdm = nodes.find((n) => n.id === "header-cdm");
    if (headerSource && firstSource) {
      headerSource.position = { x: firstSource.x, y: firstSource.y - 36 };
    }
    if (headerCdm && firstCdm) {
      headerCdm.position = { x: firstCdm.x, y: firstCdm.y - 36 };
    }

    return { initialNodes: nodes, initialEdges: edges };
  }, [sourceTables, tableMappings, connectedSources, connectedCdm, filter, t]);

  // -- React Flow state -------------------------------------------------------
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // -- onConnect: create a new table mapping ----------------------------------
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const sourceTable = extractSourceFromNodeId(connection.source);
      const targetTable = extractCdmFromNodeId(connection.target);

      // Prevent duplicate mappings
      const exists = tableMappings.some(
        (m) => m.source_table === sourceTable && m.target_table === targetTable,
      );
      if (exists) return;

      createMapping.mutate({
        source_table: sourceTable,
        target_table: targetTable,
      });
    },
    [tableMappings, createMapping],
  );

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.id.startsWith("cdm-")) {
      setDetailCdmTable(node.id.replace("cdm-", ""));
    } else if (node.id.startsWith("source-")) {
      const sourceTable = node.id.replace("source-", "");
      const mapping = tableMappings.find((m) => m.source_table === sourceTable);
      if (mapping) setSourceMappingId(mapping.id);
    }
  }, [tableMappings]);

  const handleSuggest = useCallback(() => {
    suggestMutation.mutate(undefined, {
      onSuccess: (result) => {
        setSuggestBanner(
          t("etl.aqueduct.canvas.suggestBanner", {
            tableMappings: result.table_mappings,
            fieldMappings: result.field_mappings,
          }),
        );
        setTimeout(() => setSuggestBanner(null), 5000);
      },
    });
  }, [suggestMutation, t]);

  const savedViewport = useMemo(() => loadViewport(project.id), [project.id]);
  const containerRef = useRef<HTMLDivElement>(null);

  const toolbar = (
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
  );

  const banner = suggestBanner ? (
    <div className="bg-amber-900/30 border-b border-amber-800/50 px-6 py-2 text-sm text-amber-300 flex items-center justify-between">
      <span>{suggestBanner}</span>
      <button
        type="button"
        onClick={() => setSuggestBanner(null)}
        className="text-amber-400 hover:text-amber-200 ml-4"
      >
        {t("etl.aqueduct.canvas.dismiss")}
      </button>
    </div>
  ) : null;

  const canvas = (
    <div className="flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onMoveEnd={(_event, viewport) => saveViewport(project.id, viewport)}
        defaultViewport={savedViewport ?? { x: 0, y: 0, zoom: DEFAULT_ZOOM }}
        fitView={!savedViewport}
        fitViewOptions={savedViewport ? undefined : { maxZoom: DEFAULT_ZOOM, minZoom: 0.3, padding: 0.08 }}
        minZoom={0.15}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Controls className="!bg-surface-overlay !border-border-default" />
        <MiniMap className="!bg-surface-overlay" />
        <Background variant={BackgroundVariant.Dots} color="var(--surface-accent)" gap={20} />
      </ReactFlow>
    </div>
  );

  const modals = (
    <>
      {/* CDM table detail modal */}
      {detailCdmTable && (() => {
        const cdmDef = CDM_ETL_TABLES.find((t) => t.name === detailCdmTable);
        if (!cdmDef) return null;
        const relatedMappings = tableMappings.filter((m) => m.target_table === detailCdmTable);
        return (
          <CdmTableDetailModal
            isOpen
            onClose={() => setDetailCdmTable(null)}
            tableName={cdmDef.name}
            domain={cdmDef.domain}
            columns={cdmDef.columns}
            mappings={relatedMappings}
            onDrillDown={(id) => { setDetailCdmTable(null); setSourceMappingId(id); }}
          />
        );
      })()}

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
    </>
  );

  // Expanded mode: portal to document.body, covering everything
  if (isFullscreen) {
    return createPortal(
      <div className="fixed inset-0 flex flex-col bg-surface-base" style={{ zIndex: 200 }}>
        {toolbar}
        {banner}
        {canvas}
        {modals}
      </div>,
      document.body,
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-[calc(100vh-200px)]">
      {toolbar}
      {banner}
      {canvas}
      {modals}
    </div>
  );
}
