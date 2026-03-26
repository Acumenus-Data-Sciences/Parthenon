import { useMemo, useState, useCallback, useEffect } from "react";
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
import { CDM_SCHEMA_V54 } from "../../lib/cdm-schema-v54";

// Vocabulary tables are reference data, not ETL targets — exclude from mapping canvas
const CDM_ETL_TABLES = CDM_SCHEMA_V54.filter((t) => t.domain !== "Vocabulary");
import { computeLayout, type LayoutNode, type LayoutEdge } from "../../lib/aqueduct-layout";
import { useCreateTableMapping, useSuggestMappings } from "../../hooks/useAqueductData";
import type { EtlProject, EtlTableMapping, PersistedFieldProfile } from "../../api";
import { downloadExport } from "../../api";

// ---------------------------------------------------------------------------
// Session persistence keys
// ---------------------------------------------------------------------------

const VIEWPORT_KEY = "aqueduct_viewport";
const FILTER_KEY = "aqueduct_filter";

function loadViewport(): Viewport | null {
  try {
    const raw = sessionStorage.getItem(VIEWPORT_KEY);
    if (raw) return JSON.parse(raw) as Viewport;
  } catch { /* ignore */ }
  return null;
}

function saveViewport(vp: Viewport): void {
  sessionStorage.setItem(VIEWPORT_KEY, JSON.stringify(vp));
}

function loadFilter(): "all" | "mapped" | "unmapped" {
  const raw = sessionStorage.getItem(FILTER_KEY);
  if (raw === "all" || raw === "mapped" || raw === "unmapped") return raw;
  return "mapped";
}

function saveFilter(f: string): void {
  sessionStorage.setItem(FILTER_KEY, f);
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
  onDrillDown: (mappingId: number) => void;
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
  return (
    <ReactFlowProvider>
      <AqueductCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function AqueductCanvasInner({
  project,
  tableMappings,
  sourceFields,
  onDrillDown,
  onBack,
}: AqueductCanvasProps) {
  const [filter, setFilterRaw] = useState<"all" | "mapped" | "unmapped">(loadFilter);
  const setFilter = useCallback((f: "all" | "mapped" | "unmapped") => {
    setFilterRaw(f);
    saveFilter(f);
  }, []);
  const [suggestBanner, setSuggestBanner] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [detailCdmTable, setDetailCdmTable] = useState<string | null>(null);
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
      data: { label: `Source Tables (${sourceTables.length})` },
      position: { x: 0, y: 0 },
      selectable: false,
      draggable: false,
      connectable: false,
      style: {
        background: "transparent",
        border: "none",
        color: "#C9A227",
        fontSize: "13px",
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
      data: { label: `OMOP CDM v5.4 Tables (${CDM_ETL_TABLES.length})` },
      position: { x: 0, y: 0 },
      selectable: false,
      draggable: false,
      connectable: false,
      style: {
        background: "transparent",
        border: "none",
        color: "#2DD4BF",
        fontSize: "13px",
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
              onClick: () => onDrillDown(mapping.id),
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
            onClick: () => onDrillDown(mapping.id),
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
            onClick: () => onDrillDown(mapping.id),
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
  }, [sourceTables, tableMappings, connectedSources, connectedCdm, filter, onDrillDown]);

  // -- React Flow state -------------------------------------------------------
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when data changes (e.g., sourceFields load async, mappings created)
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

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
      // Find mapping for this source table and drill down
      const sourceTable = node.id.replace("source-", "");
      const mapping = tableMappings.find((m) => m.source_table === sourceTable);
      if (mapping) onDrillDown(mapping.id);
    }
  }, [tableMappings, onDrillDown]);

  const handleSuggest = useCallback(() => {
    suggestMutation.mutate(undefined, {
      onSuccess: (result) => {
        setSuggestBanner(
          `Suggested ${result.table_mappings} table mapping${result.table_mappings !== 1 ? "s" : ""} and ${result.field_mappings} field mapping${result.field_mappings !== 1 ? "s" : ""}`,
        );
        setTimeout(() => setSuggestBanner(null), 5000);
      },
    });
  }, [suggestMutation]);

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
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
      />
      {suggestBanner && (
        <div className="bg-amber-900/30 border-b border-amber-800/50 px-6 py-2 text-sm text-amber-300 flex items-center justify-between">
          <span>{suggestBanner}</span>
          <button
            type="button"
            onClick={() => setSuggestBanner(null)}
            className="text-amber-400 hover:text-amber-200 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}
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
          onMoveEnd={(_event, viewport) => saveViewport(viewport)}
          defaultViewport={loadViewport() ?? { x: 0, y: 0, zoom: 1.5 }}
          fitView={!loadViewport()}
          fitViewOptions={{ maxZoom: 1.5, padding: 0.15 }}
          minZoom={0.3}
          maxZoom={3}
          proOptions={{ hideAttribution: true }}
        >
          <Controls className="!bg-[#1a1a2e] !border-[#2a2a3e]" />
          <MiniMap className="!bg-[#1a1a2e]" />
          <Background variant={BackgroundVariant.Dots} color="#2a2a3e" gap={20} />
        </ReactFlow>
      </div>

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
            onDrillDown={onDrillDown}
          />
        );
      })()}
    </div>
  );
}
