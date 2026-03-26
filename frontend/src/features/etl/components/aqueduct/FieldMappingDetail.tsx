import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";

import { Sparkles, CheckCircle2 } from "lucide-react";

import { FieldRow } from "./FieldRow";
import { MappingTypeEditor } from "./MappingTypeEditor";
import { DraggableFieldWrapper } from "./DraggableFieldWrapper";
import { DroppableFieldWrapper } from "./DroppableFieldWrapper";
import { AiSuggestPanel } from "./AiSuggestPanel";
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
    etl_conventions?: string;
    fk_table?: string | null;
    fk_domain?: string | null;
  }>;
  onBack: () => void;
  onNavigate: (mappingId: number) => void;
  allMappingIds: number[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function inferMapping(
  sourceCol: string,
  cdmCol: string,
  sourceType?: string,
  cdmType?: string,
  fkDomain?: string | null,
): { mapping_type: EtlFieldMapping["mapping_type"]; logic: string | null } {
  const src = sourceCol.toLowerCase();
  const cdm = cdmCol.toLowerCase();

  // concept_id columns need vocabulary lookup
  if (cdm.endsWith("_concept_id")) {
    if (cdm.endsWith("_source_concept_id")) {
      return { mapping_type: "lookup", logic: "Map source value to source concept via SOURCE_TO_CONCEPT_MAP or set 0" };
    }
    if (cdm.endsWith("_type_concept_id")) {
      return { mapping_type: "lookup", logic: "Set to concept representing data provenance (e.g., 32817 = 'EHR')" };
    }
    const domain = fkDomain ?? cdm.replace("_concept_id", "");
    return { mapping_type: "lookup", logic: `Lookup source value in CONCEPT table where domain_id = '${domain}'` };
  }

  // Date extractions (birth_date -> year/month/day_of_birth)
  if ((src.includes("date") || src.includes("birth") || src.includes("dob")) &&
      (cdm === "year_of_birth")) {
    return { mapping_type: "transform", logic: `EXTRACT(YEAR FROM ${sourceCol})` };
  }
  if ((src.includes("date") || src.includes("birth") || src.includes("dob")) &&
      (cdm === "month_of_birth")) {
    return { mapping_type: "transform", logic: `EXTRACT(MONTH FROM ${sourceCol})` };
  }
  if ((src.includes("date") || src.includes("birth") || src.includes("dob")) &&
      (cdm === "day_of_birth")) {
    return { mapping_type: "transform", logic: `EXTRACT(DAY FROM ${sourceCol})` };
  }

  // Date type promotion/truncation
  if (sourceType === "date" && (cdmType === "datetime" || cdm.endsWith("_datetime"))) {
    return { mapping_type: "transform", logic: `CAST(${sourceCol} AS TIMESTAMP)` };
  }
  if ((sourceType === "datetime" || sourceType === "timestamp") && cdmType === "date") {
    return { mapping_type: "transform", logic: `CAST(${sourceCol} AS DATE)` };
  }

  // Type mismatch transforms
  if (sourceType && cdmType) {
    if (["string", "varchar", "text"].includes(sourceType) && cdmType === "integer") {
      return { mapping_type: "transform", logic: `CAST(${sourceCol} AS INTEGER)` };
    }
    if (sourceType === "integer" && ["varchar", "text"].includes(cdmType)) {
      return { mapping_type: "transform", logic: `CAST(${sourceCol} AS VARCHAR)` };
    }
  }

  // General date columns
  if (cdm.endsWith("_date") || cdm.endsWith("_datetime")) {
    return { mapping_type: "transform", logic: null };
  }

  // source_value columns
  if (cdm.endsWith("_source_value")) {
    return { mapping_type: "direct", logic: null };
  }

  return { mapping_type: "direct", logic: null };
}

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
  const [selectedMappingKey, setSelectedMappingKey] = useState<string | null>(null);
  const [draggedSourceCol, setDraggedSourceCol] = useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

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

  // -- Sorted columns --------------------------------------------------------
  const sortedSourceColumns = useMemo(() => {
    return [...sourceColumns].sort((a, b) => {
      const aMapped = mappedSourceCols.has(a.name);
      const bMapped = mappedSourceCols.has(b.name);
      if (aMapped !== bMapped) return aMapped ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [sourceColumns, mappedSourceCols]);

  const sortedCdmColumns = useMemo(() => {
    const tier = (col: { name: string; required: boolean }) => {
      const mapped = mappedTargetCols.has(col.name);
      const reviewed = reviewedTargetCols.has(col.name);
      if (!mapped && col.required) return 0;  // required + unmapped
      if (!mapped) return 1;                   // optional + unmapped
      if (!reviewed) return 2;                 // mapped + not reviewed
      return 3;                                // mapped + reviewed
    };
    return [...cdmColumns].sort((a, b) => {
      const ta = tier(a);
      const tb = tier(b);
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    });
  }, [cdmColumns, mappedTargetCols, reviewedTargetCols]);

  // -- Divider counts --------------------------------------------------------
  const unmappedSourceCount = useMemo(
    () => sourceColumns.filter((c) => !mappedSourceCols.has(c.name)).length,
    [sourceColumns, mappedSourceCols],
  );
  const mappedSourceCount = sourceColumns.length - unmappedSourceCount;

  const cdmGroupCounts = useMemo(() => {
    let reqUnmapped = 0;
    let optUnmapped = 0;
    let needsReview = 0;
    let reviewed = 0;
    for (const col of cdmColumns) {
      const mapped = mappedTargetCols.has(col.name);
      const rev = reviewedTargetCols.has(col.name);
      if (!mapped && col.required) reqUnmapped++;
      else if (!mapped) optUnmapped++;
      else if (!rev) needsReview++;
      else reviewed++;
    }
    return { reqUnmapped, optUnmapped, needsReview, reviewed };
  }, [cdmColumns, mappedTargetCols, reviewedTargetCols]);

  // -- Selected mapping for editor -------------------------------------------
  const selectedMapping = useMemo(() => {
    if (!selectedMappingKey) return null;
    return localFields.find(
      (f) =>
        f.source_column &&
        selectedMappingKey === `${f.source_column}->${f.target_column}`,
    ) ?? null;
  }, [selectedMappingKey, localFields]);

  // -- Click a mapped column to select/deselect its mapping ------------------
  const handleColumnClick = useCallback(
    (colName: string, side: "source" | "target") => {
      const mapping = localFields.find((f) =>
        side === "source" ? f.source_column === colName : f.target_column === colName,
      );
      if (mapping?.source_column) {
        const key = `${mapping.source_column}->${mapping.target_column}`;
        setSelectedMappingKey((prev) => (prev === key ? null : key));
      }
    },
    [localFields],
  );

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

  // -- Drag-and-drop handlers ------------------------------------------------
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggedSourceCol(event.active.data.current?.colName ?? null);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggedSourceCol(null);
      const sourceColName = event.active.data.current?.colName as string | undefined;
      const targetColName = event.over?.data.current?.colName as string | undefined;
      if (!sourceColName || !targetColName) return;

      // Prevent duplicate
      const exists = localFields.some(
        (f) => f.source_column === sourceColName && f.target_column === targetColName,
      );
      if (exists) return;

      // Find CDM column info and infer mapping
      const cdmCol = cdmColumns.find((c) => c.name === targetColName);
      const sourceCol = sourceColumns.find((c) => c.name === sourceColName);
      const inference = inferMapping(
        sourceColName,
        targetColName,
        sourceCol?.type,
        cdmCol?.type,
        cdmCol?.fk_domain,
      );

      const newMapping: EtlFieldMapping = {
        id: 0,
        etl_table_mapping_id: tableMapping.id,
        source_column: sourceColName,
        target_column: targetColName,
        mapping_type: inference.mapping_type,
        logic: inference.logic,
        is_required: cdmCol?.required ?? false,
        confidence: null,
        is_ai_suggested: false,
        is_reviewed: false,
      };

      const updated = [...localFields, newMapping];
      setLocalFields(updated);
      scheduleAutoSave(updated);

      // Auto-select the new mapping
      setSelectedMappingKey(`${sourceColName}->${targetColName}`);
      toast.success(`Mapped ${sourceColName} \u2192 ${targetColName}`);
    },
    [localFields, tableMapping.id, scheduleAutoSave, cdmColumns, sourceColumns],
  );

  // -- Remove mapping --------------------------------------------------------
  const handleRemoveMapping = useCallback(() => {
    if (!selectedMapping) return;
    const updated = localFields.filter(
      (f) =>
        !(f.source_column === selectedMapping.source_column &&
          f.target_column === selectedMapping.target_column),
    );
    setLocalFields(updated);
    setSelectedMappingKey(null);
    scheduleAutoSave(updated);
    toast.info(`Removed mapping for ${selectedMapping.target_column}`);
  }, [selectedMapping, localFields, scheduleAutoSave]);

  // -- AI suggestion accept handlers -----------------------------------------
  const handleAiAccept = useCallback(
    (targetColumn: string, sourceColumn: string, mappingType: string, confidence: number, logic: string | null) => {
      const cdmCol = cdmColumns.find((c) => c.name === targetColumn);
      const newMapping: EtlFieldMapping = {
        id: 0,
        etl_table_mapping_id: tableMapping.id,
        source_column: sourceColumn,
        target_column: targetColumn,
        mapping_type: mappingType as EtlFieldMapping["mapping_type"],
        logic: logic,
        is_required: cdmCol?.required ?? false,
        confidence,
        is_ai_suggested: true,
        is_reviewed: false,
      };
      const updated = [...localFields, newMapping];
      setLocalFields(updated);
      scheduleAutoSave(updated);
      toast.success(`Accepted: ${sourceColumn} \u2192 ${targetColumn}`);
    },
    [localFields, tableMapping.id, scheduleAutoSave, cdmColumns],
  );

  const handleAiAcceptAll = useCallback(
    (accepted: Array<{ targetColumn: string; sourceColumn: string; mappingType: string; confidence: number; logic: string | null }>) => {
      const newMappings = accepted.map((a) => {
        const cdmCol = cdmColumns.find((c) => c.name === a.targetColumn);
        return {
          id: 0,
          etl_table_mapping_id: tableMapping.id,
          source_column: a.sourceColumn,
          target_column: a.targetColumn,
          mapping_type: a.mappingType as EtlFieldMapping["mapping_type"],
          logic: a.logic,
          is_required: cdmCol?.required ?? false,
          confidence: a.confidence,
          is_ai_suggested: true,
          is_reviewed: false,
        };
      });
      const updated = [...localFields, ...newMappings];
      setLocalFields(updated);
      scheduleAutoSave(updated);
      toast.success(`Accepted ${accepted.length} AI suggestions`);
    },
    [localFields, tableMapping.id, scheduleAutoSave, cdmColumns],
  );

  // -- Computed states for empty/success banners -----------------------------
  const totalUnmappedCdm = cdmGroupCounts.reqUnmapped + cdmGroupCounts.optUnmapped;
  const allCdmMapped = totalUnmappedCdm === 0 && cdmColumns.length > 0;
  const reviewedCount = cdmGroupCounts.reviewed;
  const totalMappedCdm = cdmGroupCounts.needsReview + cdmGroupCounts.reviewed;

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A30]">
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAiPanelOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-[#C9A227]/10 text-[#C9A227] hover:bg-[#C9A227]/20 transition-colors font-medium"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Assist
          </button>
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

      {/* Status banner */}
      {allCdmMapped && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-950/30 border-b border-emerald-900/40">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-emerald-300">
            All CDM columns mapped — {reviewedCount} of {totalMappedCdm} reviewed
          </span>
        </div>
      )}

      {/* Two-column layout with drag-and-drop */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 min-h-0">
          {/* Left: Source columns */}
          <div className="w-1/2 border-r border-[#2A2A30] overflow-y-auto">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-gray-500 tracking-wide border-b border-[#2A2A30]">
              Source Columns ({sourceColumns.length})
            </div>
            {sortedSourceColumns.map((col, idx) => {
              const isMapped = mappedSourceCols.has(col.name);
              const showDivider =
                unmappedSourceCount > 0 &&
                mappedSourceCount > 0 &&
                idx === unmappedSourceCount;

              return (
                <div key={col.name}>
                  {showDivider && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1C1C20]">
                      <div className="flex-1 h-px bg-[#2A2A30]" />
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">
                        Mapped ({mappedSourceCount})
                      </span>
                      <div className="flex-1 h-px bg-[#2A2A30]" />
                    </div>
                  )}
                  <DraggableFieldWrapper
                    id={`src-${col.name}`}
                    data={{ colName: col.name, type: col.type }}
                  >
                    {({ isDragging, attributes, listeners, setNodeRef }) => (
                      <div
                        ref={setNodeRef}
                        {...attributes}
                        {...listeners}
                        onClick={() => handleColumnClick(col.name, "source")}
                        className={`cursor-grab ${
                          selectedMapping?.source_column === col.name
                            ? "ring-1 ring-[#C9A227] ring-inset"
                            : ""
                        }`}
                      >
                        <FieldRow
                          name={col.name}
                          type={col.type}
                          side="source"
                          isMapped={isMapped}
                          nullPct={col.nullPct}
                          distinctCount={col.distinctCount}
                          isDragSource
                          isDragging={isDragging}
                        />
                      </div>
                    )}
                  </DraggableFieldWrapper>
                </div>
              );
            })}
          </div>

          {/* Right: CDM target columns */}
          <div className="w-1/2 overflow-y-auto">
            <div className="px-3 py-2 text-xs font-semibold uppercase text-gray-500 tracking-wide border-b border-[#2A2A30]">
              CDM Columns ({cdmColumns.length})
            </div>
            {sortedCdmColumns.map((col, idx) => {
              const isMapped = mappedTargetCols.has(col.name);
              const isReviewed = reviewedTargetCols.has(col.name);
              const { reqUnmapped, optUnmapped, needsReview, reviewed } = cdmGroupCounts;

              // Divider positions based on cumulative group sizes
              const afterReqUnmapped = reqUnmapped;
              const afterOptUnmapped = reqUnmapped + optUnmapped;
              const afterNeedsReview = reqUnmapped + optUnmapped + needsReview;

              const dividerLabel =
                idx === afterReqUnmapped && reqUnmapped > 0 && optUnmapped > 0
                  ? `Optional Unmapped (${optUnmapped})`
                  : idx === afterOptUnmapped && (reqUnmapped + optUnmapped) > 0 && needsReview > 0
                    ? `Needs Review (${needsReview})`
                    : idx === afterNeedsReview && (reqUnmapped + optUnmapped + needsReview) > 0 && reviewed > 0
                      ? `Reviewed (${reviewed})`
                      : null;

              if (!isMapped) {
                return (
                  <div key={col.name}>
                    {dividerLabel && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1C1C20]">
                        <div className="flex-1 h-px bg-[#2A2A30]" />
                        <span className="text-[10px] uppercase tracking-wider text-gray-500">
                          {dividerLabel}
                        </span>
                        <div className="flex-1 h-px bg-[#2A2A30]" />
                      </div>
                    )}
                    <DroppableFieldWrapper
                      id={`tgt-${col.name}`}
                      data={{ colName: col.name }}
                    >
                      {({ isOver, setNodeRef }) => (
                        <div
                          ref={setNodeRef}
                          onClick={() => handleColumnClick(col.name, "target")}
                          className={`cursor-pointer ${
                            selectedMapping?.target_column === col.name
                              ? "ring-1 ring-[#C9A227] ring-inset"
                              : ""
                          }`}
                        >
                          <FieldRow
                            name={col.name}
                            type={col.type}
                            side="target"
                            isMapped={false}
                            isReviewed={false}
                            required={col.required}
                            isDropTarget
                            isDropHighlighted={isOver}
                            hint={col.required ? "Drag source or use AI Assist" : undefined}
                          />
                        </div>
                      )}
                    </DroppableFieldWrapper>
                  </div>
                );
              }

              // Mapped CDM columns stay as-is (not droppable)
              return (
                <div key={col.name}>
                  {dividerLabel && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1C1C20]">
                      <div className="flex-1 h-px bg-[#2A2A30]" />
                      <span className="text-[10px] uppercase tracking-wider text-gray-500">
                        {dividerLabel}
                      </span>
                      <div className="flex-1 h-px bg-[#2A2A30]" />
                    </div>
                  )}
                  <div
                    onClick={() => handleColumnClick(col.name, "target")}
                    className={`cursor-pointer ${
                      selectedMapping?.target_column === col.name
                        ? "ring-1 ring-[#C9A227] ring-inset"
                        : ""
                    }`}
                  >
                    <FieldRow
                      name={col.name}
                      type={col.type}
                      side="target"
                      isMapped
                      isReviewed={isReviewed}
                      required={col.required}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DragOverlay>
          {draggedSourceCol ? (
            <div className="w-[280px] opacity-80">
              <FieldRow
                name={draggedSourceCol}
                type={sourceColumns.find((c) => c.name === draggedSourceCol)?.type ?? ""}
                side="source"
                isMapped={false}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Mapping type editor (shown when mapping selected) */}
      {selectedMapping && (
        <div className="px-4 pb-4">
          <MappingTypeEditor
            mapping={selectedMapping}
            onChange={handleMappingChange}
            onRemove={handleRemoveMapping}
            cdmColumnInfo={cdmColumns.find((c) => c.name === selectedMapping.target_column)}
          />
        </div>
      )}

      {/* AI Suggest Panel */}
      <AiSuggestPanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        projectId={project.id}
        tableMappingId={tableMapping.id}
        sourceTable={tableMapping.source_table}
        targetTable={tableMapping.target_table}
        existingMappings={localFields}
        onAccept={handleAiAccept}
        onAcceptAll={handleAiAcceptAll}
      />
    </div>
  );
}
