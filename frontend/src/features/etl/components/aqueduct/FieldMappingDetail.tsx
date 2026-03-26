import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type OnSelectionChangeFunc,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { FieldRow, type FieldRowProps } from "./FieldRow";
import { MappingTypeEditor } from "./MappingTypeEditor";
import { useFieldMappings, useBulkUpsertFields } from "../../hooks/useAqueductData";
import type { EtlProject, EtlTableMapping, EtlFieldMapping } from "../../api";
import { toast } from "@/components/ui/Toast";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FieldMappingDetailProps {
  project: EtlProject;
  tableMapping: EtlTableMapping;
  sourceColumns: Array<{
    name: string;
    type: string;
    nullPct: number;
    distinctCount: number;
  }>;
  cdmColumns: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  onBack: () => void;
  onNavigate: (mappingId: number) => void;
  allMappingIds: number[];
}

// ---------------------------------------------------------------------------
// Field-row node wrapper (renders FieldRow inside a React Flow node)
// ---------------------------------------------------------------------------

function SourceFieldNode({ data }: { data: FieldRowProps }) {
  return <FieldRow {...data} />;
}

function TargetFieldNode({ data }: { data: FieldRowProps }) {
  return <FieldRow {...data} />;
}

const nodeTypes = {
  sourceField: SourceFieldNode,
  targetField: TargetFieldNode,
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROW_HEIGHT = 38;
const SOURCE_X = 0;
const SOURCE_WIDTH = 260;
const TARGET_X = 520;
const TARGET_WIDTH = 260;
const TOP_OFFSET = 10;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FieldMappingDetail({
  project,
  tableMapping,
  sourceColumns,
  cdmColumns,
  onBack,
  onNavigate,
  allMappingIds,
}: FieldMappingDetailProps) {
  // -- Remote data -----------------------------------------------------------
  const { data: remoteFields } = useFieldMappings(project.id, tableMapping.id);
  const bulkUpsert = useBulkUpsertFields(project.id, tableMapping.id);

  // -- Local field mapping state ---------------------------------------------
  const [localFields, setLocalFields] = useState<EtlFieldMapping[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Sync remote -> local on first load / after refetch
  useEffect(() => {
    if (remoteFields) {
      setLocalFields(remoteFields);
    }
  }, [remoteFields]);

  // -- Debounced auto-save ---------------------------------------------------
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleAutoSave = useCallback(
    (fields: EtlFieldMapping[]) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const payload = fields.map((f) => ({
          id: f.id,
          target_column: f.target_column,
          source_column: f.source_column,
          mapping_type: f.mapping_type,
          logic: f.logic,
          is_reviewed: f.is_reviewed,
          is_ai_suggested: f.is_ai_suggested,
          confidence: f.confidence,
          is_required: f.is_required,
        }));
        bulkUpsert.mutate(
          { fields: payload, updatedAt: tableMapping.updated_at },
          {
            onError: (err: unknown) => {
              const status =
                err instanceof Error && "response" in err
                  ? (err as { response?: { status?: number } }).response?.status
                  : undefined;
              if (status === 409) {
                toast.warning(
                  "Mapping was modified elsewhere, refreshing...",
                );
              } else {
                toast.error("Failed to save field mappings");
              }
            },
          },
        );
      }, 500);
    },
    [bulkUpsert, tableMapping.updated_at],
  );

  // -- Prev / Next navigation ------------------------------------------------
  const currentIdx = allMappingIds.indexOf(tableMapping.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx < allMappingIds.length - 1;

  const navigatePrev = useCallback(() => {
    if (hasPrev) onNavigate(allMappingIds[currentIdx - 1]);
  }, [hasPrev, onNavigate, allMappingIds, currentIdx]);

  const navigateNext = useCallback(() => {
    if (hasNext) onNavigate(allMappingIds[currentIdx + 1]);
  }, [hasNext, onNavigate, allMappingIds, currentIdx]);

  // -- Mapped column sets for indicators -------------------------------------
  const mappedSourceCols = useMemo(
    () => new Set(localFields.filter((f) => f.source_column).map((f) => f.source_column!)),
    [localFields],
  );
  const mappedTargetCols = useMemo(
    () => new Set(localFields.map((f) => f.target_column)),
    [localFields],
  );
  const reviewedTargetCols = useMemo(
    () => new Set(localFields.filter((f) => f.is_reviewed).map((f) => f.target_column)),
    [localFields],
  );

  // -- Build React Flow nodes & edges ----------------------------------------
  const { flowNodes, flowEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Source field nodes
    sourceColumns.forEach((col, idx) => {
      nodes.push({
        id: `src-${col.name}`,
        type: "sourceField",
        position: { x: SOURCE_X, y: TOP_OFFSET + idx * ROW_HEIGHT },
        data: {
          name: col.name,
          type: col.type,
          side: "source" as const,
          isMapped: mappedSourceCols.has(col.name),
          nullPct: col.nullPct,
          distinctCount: col.distinctCount,
        } satisfies FieldRowProps,
        style: { width: SOURCE_WIDTH },
        draggable: false,
      });
    });

    // Target (CDM) field nodes
    cdmColumns.forEach((col, idx) => {
      nodes.push({
        id: `tgt-${col.name}`,
        type: "targetField",
        position: { x: TARGET_X, y: TOP_OFFSET + idx * ROW_HEIGHT },
        data: {
          name: col.name,
          type: col.type,
          side: "target" as const,
          isMapped: mappedTargetCols.has(col.name),
          isReviewed: reviewedTargetCols.has(col.name),
          required: col.required,
        } satisfies FieldRowProps,
        style: { width: TARGET_WIDTH },
        draggable: false,
      });
    });

    // Edges from local field mappings
    for (const fm of localFields) {
      if (!fm.source_column) continue;
      edges.push({
        id: `fm-${fm.source_column}-${fm.target_column}`,
        source: `src-${fm.source_column}`,
        target: `tgt-${fm.target_column}`,
        sourceHandle: fm.source_column,
        targetHandle: fm.target_column,
        style: {
          stroke: fm.is_reviewed ? "#2DD4BF" : "#F59E0B",
          strokeWidth: 2,
        },
      });
    }

    return { flowNodes: nodes, flowEdges: edges };
  }, [
    sourceColumns,
    cdmColumns,
    localFields,
    mappedSourceCols,
    mappedTargetCols,
    reviewedTargetCols,
  ]);

  const [nodes, , onNodesChange] = useNodesState(flowNodes);
  const [edges, , onEdgesChange] = useEdgesState(flowEdges);

  // -- Handle new connections (drag source -> target) ------------------------
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const sourceCol = connection.source.replace(/^src-/, "");
      const targetCol = connection.target.replace(/^tgt-/, "");

      // Prevent duplicate
      const exists = localFields.some(
        (f) => f.source_column === sourceCol && f.target_column === targetCol,
      );
      if (exists) return;

      const newField: EtlFieldMapping = {
        id: 0, // server will assign
        etl_table_mapping_id: tableMapping.id,
        source_column: sourceCol,
        target_column: targetCol,
        mapping_type: "direct",
        logic: null,
        is_required: false,
        confidence: null,
        is_ai_suggested: false,
        is_reviewed: false,
      };

      const updated = [...localFields, newField];
      setLocalFields(updated);
      scheduleAutoSave(updated);
    },
    [localFields, tableMapping.id, scheduleAutoSave],
  );

  // -- Edge selection --------------------------------------------------------
  const handleSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ edges: edgeChanges }) => {
      const selected = edgeChanges.find((e) => e.selected);
      setSelectedEdgeId(selected ? selected.id : null);
    },
    [],
  );

  // -- Selected mapping for editor -------------------------------------------
  const selectedMapping = useMemo(() => {
    if (!selectedEdgeId) return null;
    // Edge IDs are `fm-{source}-{target}` — use localFields to find the match
    return localFields.find(
      (f) =>
        f.source_column &&
        selectedEdgeId === `fm-${f.source_column}-${f.target_column}`,
    ) ?? null;
  }, [selectedEdgeId, localFields]);

  // -- Mapping type editor onChange ------------------------------------------
  const handleMappingChange = useCallback(
    (updates: { mapping_type?: string; logic?: string; is_reviewed?: boolean }) => {
      if (!selectedMapping) return;
      const updated = localFields.map((f) => {
        if (
          f.source_column === selectedMapping.source_column &&
          f.target_column === selectedMapping.target_column
        ) {
          return {
            ...f,
            ...(updates.mapping_type !== undefined && {
              mapping_type: updates.mapping_type as EtlFieldMapping["mapping_type"],
            }),
            ...(updates.logic !== undefined && { logic: updates.logic }),
            ...(updates.is_reviewed !== undefined && {
              is_reviewed: updates.is_reviewed,
            }),
          };
        }
        return f;
      });
      setLocalFields(updated);
      scheduleAutoSave(updated);
    },
    [selectedMapping, localFields, scheduleAutoSave],
  );

  // -- Cleanup debounce on unmount -------------------------------------------
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      {/* Breadcrumb + navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a3e]">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-colors"
          >
            &larr; Overview
          </button>
          <span className="text-gray-600">/</span>
          <span className="text-[#C9A227]">{tableMapping.source_table}</span>
          <span className="text-gray-600">&rarr;</span>
          <span className="text-[#2DD4BF]">{tableMapping.target_table}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={navigatePrev}
            disabled={!hasPrev}
            className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors text-sm"
          >
            &larr; Prev
          </button>
          <button
            onClick={navigateNext}
            disabled={!hasNext}
            className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors text-sm"
          >
            Next &rarr;
          </button>
        </div>
      </div>

      {/* Three-column layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Source columns */}
        <div className="w-[35%] border-r border-[#2a2a3e] overflow-y-auto">
          <div className="px-3 py-2 text-xs font-semibold uppercase text-gray-500 tracking-wide border-b border-[#2a2a3e]">
            Source Columns ({sourceColumns.length})
          </div>
          {sourceColumns.map((col) => (
            <FieldRow
              key={col.name}
              name={col.name}
              type={col.type}
              side="source"
              isMapped={mappedSourceCols.has(col.name)}
              nullPct={col.nullPct}
              distinctCount={col.distinctCount}
            />
          ))}
        </div>

        {/* Center: Mini React Flow canvas */}
        <div className="w-[30%] relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={handleConnect}
            onSelectionChange={handleSelectionChange}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={{
              type: "default",
              style: { strokeWidth: 2 },
            }}
            fitView
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable
            edgesReconnectable={false}
          >
            <Background
              variant={BackgroundVariant.Dots}
              color="#2a2a3e"
              gap={16}
            />
          </ReactFlow>
        </div>

        {/* Right: CDM target columns */}
        <div className="w-[35%] border-l border-[#2a2a3e] overflow-y-auto">
          <div className="px-3 py-2 text-xs font-semibold uppercase text-gray-500 tracking-wide border-b border-[#2a2a3e]">
            CDM Columns ({cdmColumns.length})
          </div>
          {cdmColumns.map((col) => (
            <FieldRow
              key={col.name}
              name={col.name}
              type={col.type}
              side="target"
              isMapped={mappedTargetCols.has(col.name)}
              isReviewed={reviewedTargetCols.has(col.name)}
              required={col.required}
            />
          ))}
        </div>
      </div>

      {/* Mapping type editor (shown when edge selected) */}
      {selectedMapping && (
        <div className="px-4 pb-4">
          <MappingTypeEditor
            mapping={selectedMapping}
            onChange={handleMappingChange}
          />
        </div>
      )}
    </div>
  );
}
