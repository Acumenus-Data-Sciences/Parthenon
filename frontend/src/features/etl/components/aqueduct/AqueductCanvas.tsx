import { useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { SourceTableNode } from "./SourceTableNode";
import { CdmTableNode } from "./CdmTableNode";
import { MappingEdge } from "./MappingEdge";
import { MappingToolbar } from "./MappingToolbar";
import { CDM_SCHEMA_V54 } from "../../lib/cdm-schema-v54";
import { computeLayout, type LayoutNode, type LayoutEdge } from "../../lib/aqueduct-layout";
import { useCreateTableMapping, useSuggestMappings } from "../../hooks/useAqueductData";
import type { EtlProject, EtlTableMapping, PersistedFieldProfile } from "../../api";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_WIDTH = 200;
const NODE_HEIGHT = 60;

const nodeTypes = {
  sourceTable: SourceTableNode,
  cdmTable: CdmTableNode,
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

export function AqueductCanvas({
  project,
  tableMappings,
  sourceFields,
  onDrillDown,
  onBack,
}: AqueductCanvasProps) {
  const [filter, setFilter] = useState<"all" | "mapped" | "unmapped">("all");
  const [suggestBanner, setSuggestBanner] = useState<string | null>(null);
  const createMapping = useCreateTableMapping(project.id);
  const suggestMutation = useSuggestMappings(project.id);

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
  const totalCdmTables = CDM_SCHEMA_V54.length;
  const mappedTables = connectedCdm.size;
  const fieldCoveragePct = useMemo(() => {
    if (tableMappings.length === 0) return 0;
    let totalFields = 0;
    let mappedFields = 0;
    for (const mapping of tableMappings) {
      const cdmTable = CDM_SCHEMA_V54.find((t) => t.name === mapping.target_table);
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

    // Source nodes
    for (const st of sourceTables) {
      const nodeId = `source-${st.tableName}`;
      const isMapped = connectedSources.has(st.tableName);
      const dimmed = filter === "mapped" ? !isMapped : filter === "unmapped" ? isMapped : false;
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
    for (const cdmTable of CDM_SCHEMA_V54) {
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

    // Edges from table mappings
    for (const mapping of tableMappings) {
      const sourceId = `source-${mapping.source_table}`;
      const targetId = `cdm-${mapping.target_table}`;
      const cdmTable = CDM_SCHEMA_V54.find((t) => t.name === mapping.target_table);
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

    // Compute layout positions
    const positioned = computeLayout(layoutNodes, layoutEdges);
    for (const pos of positioned) {
      const node = nodes.find((n) => n.id === pos.id);
      if (node) {
        node.position = { x: pos.x, y: pos.y };
      }
    }

    return { initialNodes: nodes, initialEdges: edges };
  }, [sourceTables, tableMappings, connectedSources, connectedCdm, filter, onDrillDown]);

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
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Controls className="!bg-[#1a1a2e] !border-[#2a2a3e]" />
          <MiniMap className="!bg-[#1a1a2e]" />
          <Background variant={BackgroundVariant.Dots} color="#2a2a3e" gap={20} />
        </ReactFlow>
      </div>
    </div>
  );
}
