import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  Search,
  BookOpen,
  Check,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { AiSuggestPanel } from "./AiSuggestPanel";
import { ConceptSearchInline } from "./ConceptSearchInline";
import { useFieldMappings, useBulkUpsertFields, useDeleteTableMapping } from "../../hooks/useAqueductData";
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

const MAPPING_TYPES = [
  "direct",
  "transform",
  "lookup",
  "constant",
  "concat",
  "expression",
] as const;

function inferMapping(
  sourceCol: string,
  cdmCol: string,
  sourceType?: string,
  cdmType?: string,
  fkDomain?: string | null,
): { mapping_type: EtlFieldMapping["mapping_type"]; logic: string | null } {
  const src = sourceCol.toLowerCase();
  const cdm = cdmCol.toLowerCase();

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

  if ((src.includes("date") || src.includes("birth") || src.includes("dob")) && cdm === "year_of_birth") {
    return { mapping_type: "transform", logic: `EXTRACT(YEAR FROM ${sourceCol})` };
  }
  if ((src.includes("date") || src.includes("birth") || src.includes("dob")) && cdm === "month_of_birth") {
    return { mapping_type: "transform", logic: `EXTRACT(MONTH FROM ${sourceCol})` };
  }
  if ((src.includes("date") || src.includes("birth") || src.includes("dob")) && cdm === "day_of_birth") {
    return { mapping_type: "transform", logic: `EXTRACT(DAY FROM ${sourceCol})` };
  }

  if (sourceType === "date" && (cdmType === "datetime" || cdm.endsWith("_datetime"))) {
    return { mapping_type: "transform", logic: `CAST(${sourceCol} AS TIMESTAMP)` };
  }
  if ((sourceType === "datetime" || sourceType === "timestamp") && cdmType === "date") {
    return { mapping_type: "transform", logic: `CAST(${sourceCol} AS DATE)` };
  }

  if (sourceType && cdmType) {
    if (["string", "varchar", "text"].includes(sourceType) && cdmType === "integer") {
      return { mapping_type: "transform", logic: `CAST(${sourceCol} AS INTEGER)` };
    }
    if (sourceType === "integer" && ["varchar", "text"].includes(cdmType)) {
      return { mapping_type: "transform", logic: `CAST(${sourceCol} AS VARCHAR)` };
    }
  }

  if (cdm.endsWith("_date") || cdm.endsWith("_datetime")) {
    return { mapping_type: "transform", logic: null };
  }
  if (cdm.endsWith("_source_value")) {
    return { mapping_type: "direct", logic: null };
  }

  return { mapping_type: "direct", logic: null };
}

const TYPE_BADGE_STYLES: Record<string, string> = {
  direct: "bg-surface-raised text-gray-400",
  transform: "bg-sky-950 text-sky-400",
  lookup: "bg-amber-950 text-amber-400",
  constant: "bg-purple-950 text-purple-400",
  concat: "bg-cyan-950 text-cyan-400",
  expression: "bg-pink-950 text-pink-400",
};

// ---------------------------------------------------------------------------
// SourceColumnSelect — searchable dropdown for picking a source column
// ---------------------------------------------------------------------------

interface SourceColumnSelectProps {
  sourceColumns: FieldMappingDetailProps["sourceColumns"];
  selected: string | null;
  mappedSourceCols: Set<string>;
  onSelect: (sourceCol: string) => void;
  onClear: () => void;
}

function SourceColumnSelect({
  sourceColumns,
  selected,
  mappedSourceCols,
  onSelect,
  onClear,
}: SourceColumnSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query) return sourceColumns;
    const q = query.toLowerCase();
    return sourceColumns.filter((c) => c.name.toLowerCase().includes(q));
  }, [sourceColumns, query]);

  if (selected) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#C9A227]/10 text-[#C9A227] text-sm font-medium hover:bg-[#C9A227]/20 transition-colors max-w-[200px]"
        >
          <span className="truncate">{selected}</span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onClear(); }}
          className="p-0.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
          title="Remove mapping"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        {isOpen && (
          <SourceDropdown
            containerRef={containerRef}
            inputRef={inputRef}
            query={query}
            setQuery={setQuery}
            filtered={filtered}
            mappedSourceCols={mappedSourceCols}
            onSelect={(col) => { onSelect(col); setIsOpen(false); setQuery(""); }}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dashed border-[#2A2A30] text-sm text-gray-500 hover:border-[#C9A227]/50 hover:text-gray-400 transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Select source...</span>
      </button>
      {isOpen && (
        <SourceDropdown
          containerRef={containerRef}
          inputRef={inputRef}
          query={query}
          setQuery={setQuery}
          filtered={filtered}
          mappedSourceCols={mappedSourceCols}
          onSelect={(col) => { onSelect(col); setIsOpen(false); setQuery(""); }}
        />
      )}
    </div>
  );
}

function SourceDropdown({
  containerRef,
  inputRef,
  query,
  setQuery,
  filtered,
  mappedSourceCols,
  onSelect,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  query: string;
  setQuery: (q: string) => void;
  filtered: FieldMappingDetailProps["sourceColumns"];
  mappedSourceCols: Set<string>;
  onSelect: (col: string) => void;
}) {
  return (
    <div
      ref={containerRef}
      className="absolute left-0 top-full mt-1 z-50 w-[300px] bg-[#151518] border border-[#2A2A30] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.70)] overflow-hidden"
    >
      <div className="p-2 border-b border-[#2A2A30]">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-[#0E0E11] border border-[#2A2A30]">
          <Search className="w-3.5 h-3.5 text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search source columns..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-gray-600 focus:outline-none"
          />
        </div>
      </div>
      <div className="max-h-[240px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs text-gray-500 text-center">No matching columns</div>
        ) : (
          filtered.map((col) => {
            const isMappedElsewhere = mappedSourceCols.has(col.name);
            return (
              <button
                key={col.name}
                type="button"
                onClick={() => onSelect(col.name)}
                className="w-full text-left px-3 py-2 hover:bg-[#232328] transition-colors flex items-center gap-2 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium truncate">{col.name}</span>
                    <span className="text-[10px] px-1 py-0.5 rounded bg-surface-raised text-gray-500">{col.type}</span>
                    {isMappedElsewhere && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#2DD4BF]/10 text-[#2DD4BF]/60">mapped</span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-0.5">
                    null: {col.nullPct}% &bull; {col.distinctCount} distinct
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
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
  const deleteMutation = useDeleteTableMapping(project.id);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // -- Local field mapping state ---------------------------------------------
  const [localFields, setLocalFields] = useState<EtlFieldMapping[]>([]);
  const [expandedCol, setExpandedCol] = useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [showDocs, setShowDocs] = useState<string | null>(null);

  // Sync remote -> local on first load / after refetch
  useEffect(() => {
    if (remoteFields) setLocalFields(remoteFields);
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
                toast.warning("Mapping was modified elsewhere, refreshing...");
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

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

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

  // -- Lookup maps -----------------------------------------------------------
  const mappingByCdm = useMemo(() => {
    const m = new Map<string, EtlFieldMapping>();
    for (const f of localFields) {
      if (f.source_column) m.set(f.target_column, f);
    }
    return m;
  }, [localFields]);

  const mappedSourceCols = useMemo(
    () => new Set(localFields.filter((f) => f.source_column).map((f) => f.source_column!)),
    [localFields],
  );

  // -- Progress stats --------------------------------------------------------
  const totalCdm = cdmColumns.length;
  const mappedCount = mappingByCdm.size;
  const reviewedCount = useMemo(
    () => localFields.filter((f) => f.source_column && f.is_reviewed).length,
    [localFields],
  );
  const requiredUnmappedCount = useMemo(
    () => cdmColumns.filter((c) => c.required && !mappingByCdm.has(c.name)).length,
    [cdmColumns, mappingByCdm],
  );

  // -- Sorted CDM columns ----------------------------------------------------
  const sortedCdmColumns = useMemo(() => {
    const tier = (col: { name: string; required: boolean }) => {
      const mapping = mappingByCdm.get(col.name);
      if (!mapping && col.required) return 0; // required + unmapped
      if (!mapping) return 1;                  // optional + unmapped
      if (!mapping.is_reviewed) return 2;      // mapped + not reviewed
      return 3;                                 // mapped + reviewed
    };
    return [...cdmColumns].sort((a, b) => {
      const ta = tier(a);
      const tb = tier(b);
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    });
  }, [cdmColumns, mappingByCdm]);

  // -- Section divider positions ---------------------------------------------
  const sectionBreaks = useMemo(() => {
    const breaks: Array<{ index: number; label: string; count: number }> = [];
    let lastTier = -1;
    const tierLabels = ["Required Unmapped", "Optional Unmapped", "Needs Review", "Reviewed"];
    const tierCounts = [0, 0, 0, 0];

    for (const col of sortedCdmColumns) {
      const mapping = mappingByCdm.get(col.name);
      const t = !mapping && col.required ? 0 : !mapping ? 1 : !mapping.is_reviewed ? 2 : 3;
      tierCounts[t]++;
    }

    let idx = 0;
    for (const col of sortedCdmColumns) {
      const mapping = mappingByCdm.get(col.name);
      const t = !mapping && col.required ? 0 : !mapping ? 1 : !mapping.is_reviewed ? 2 : 3;
      if (t !== lastTier && tierCounts[t] > 0) {
        breaks.push({ index: idx, label: tierLabels[t], count: tierCounts[t] });
        lastTier = t;
      }
      idx++;
    }
    return breaks;
  }, [sortedCdmColumns, mappingByCdm]);

  // -- Handlers: source select / clear / update ------------------------------
  const handleSourceSelect = useCallback(
    (cdmColName: string, sourceColName: string) => {
      const cdmCol = cdmColumns.find((c) => c.name === cdmColName);
      const sourceCol = sourceColumns.find((c) => c.name === sourceColName);
      const inference = inferMapping(
        sourceColName, cdmColName, sourceCol?.type, cdmCol?.type, cdmCol?.fk_domain,
      );

      const existing = localFields.find((f) => f.target_column === cdmColName);
      let updated: EtlFieldMapping[];
      if (existing) {
        updated = localFields.map((f) =>
          f.target_column === cdmColName
            ? { ...f, source_column: sourceColName, mapping_type: inference.mapping_type, logic: inference.logic, is_reviewed: false }
            : f,
        );
      } else {
        updated = [
          ...localFields,
          {
            id: 0,
            etl_table_mapping_id: tableMapping.id,
            source_column: sourceColName,
            target_column: cdmColName,
            mapping_type: inference.mapping_type,
            logic: inference.logic,
            is_required: cdmCol?.required ?? false,
            confidence: null,
            is_ai_suggested: false,
            is_reviewed: false,
          },
        ];
      }
      setLocalFields(updated);
      scheduleAutoSave(updated);
      setExpandedCol(cdmColName);
      toast.success(`Mapped ${sourceColName} \u2192 ${cdmColName}`);
    },
    [localFields, cdmColumns, sourceColumns, tableMapping.id, scheduleAutoSave],
  );

  const handleSourceClear = useCallback(
    (cdmColName: string) => {
      const updated = localFields.filter((f) => f.target_column !== cdmColName);
      setLocalFields(updated);
      scheduleAutoSave(updated);
      setExpandedCol(null);
      toast.info(`Removed mapping for ${cdmColName}`);
    },
    [localFields, scheduleAutoSave],
  );

  const handleMappingChange = useCallback(
    (cdmColName: string, updates: { mapping_type?: string; logic?: string; is_reviewed?: boolean }) => {
      const updated = localFields.map((f) => {
        if (f.target_column !== cdmColName) return f;
        return {
          ...f,
          ...(updates.mapping_type !== undefined && { mapping_type: updates.mapping_type as EtlFieldMapping["mapping_type"] }),
          ...(updates.logic !== undefined && { logic: updates.logic }),
          ...(updates.is_reviewed !== undefined && { is_reviewed: updates.is_reviewed }),
        };
      });
      setLocalFields(updated);
      scheduleAutoSave(updated);
    },
    [localFields, scheduleAutoSave],
  );

  const handleConceptSelect = useCallback(
    (cdmColName: string, conceptId: number, conceptName: string) => {
      handleMappingChange(cdmColName, { logic: `${conceptId} (${conceptName})` });
    },
    [handleMappingChange],
  );

  // -- AI suggestion accept handlers -----------------------------------------
  const handleAiAccept = useCallback(
    (targetColumn: string, sourceColumn: string, mappingType: string, confidence: number, logic: string | null) => {
      const cdmCol = cdmColumns.find((c) => c.name === targetColumn);
      const existing = localFields.find((f) => f.target_column === targetColumn);
      let updated: EtlFieldMapping[];
      if (existing) {
        updated = localFields.map((f) =>
          f.target_column === targetColumn
            ? { ...f, source_column: sourceColumn, mapping_type: mappingType as EtlFieldMapping["mapping_type"], logic, confidence, is_ai_suggested: true, is_reviewed: false }
            : f,
        );
      } else {
        updated = [
          ...localFields,
          {
            id: 0,
            etl_table_mapping_id: tableMapping.id,
            source_column: sourceColumn,
            target_column: targetColumn,
            mapping_type: mappingType as EtlFieldMapping["mapping_type"],
            logic,
            is_required: cdmCol?.required ?? false,
            confidence,
            is_ai_suggested: true,
            is_reviewed: false,
          },
        ];
      }
      setLocalFields(updated);
      scheduleAutoSave(updated);
    },
    [localFields, tableMapping.id, scheduleAutoSave, cdmColumns],
  );

  const handleAiAcceptAll = useCallback(
    (accepted: Array<{ targetColumn: string; sourceColumn: string; mappingType: string; confidence: number; logic: string | null }>) => {
      let updated = [...localFields];
      for (const a of accepted) {
        const cdmCol = cdmColumns.find((c) => c.name === a.targetColumn);
        const existingIdx = updated.findIndex((f) => f.target_column === a.targetColumn);
        if (existingIdx >= 0) {
          updated = updated.map((f, i) =>
            i === existingIdx
              ? { ...f, source_column: a.sourceColumn, mapping_type: a.mappingType as EtlFieldMapping["mapping_type"], logic: a.logic, confidence: a.confidence, is_ai_suggested: true, is_reviewed: false }
              : f,
          );
        } else {
          updated.push({
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
          });
        }
      }
      setLocalFields(updated);
      scheduleAutoSave(updated);
      toast.success(`Accepted ${accepted.length} AI suggestions`);
    },
    [localFields, tableMapping.id, scheduleAutoSave, cdmColumns],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onBack} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="w-full max-w-5xl rounded-xl border border-[#232328] bg-[#151518] shadow-2xl max-h-[85vh] flex flex-col">
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
          <span className="text-[#232328]">│</span>
          {confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-red-400">Delete this mapping?</span>
              <button
                type="button"
                onClick={() => {
                  deleteMutation.mutate(tableMapping.id, {
                    onSuccess: () => {
                      toast.success(`Deleted mapping ${tableMapping.source_table} → ${tableMapping.target_table}`);
                      onBack();
                    },
                    onError: () => toast.error("Failed to delete mapping"),
                  });
                }}
                disabled={deleteMutation.isPending}
                className="px-2 py-0.5 text-xs rounded bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? "..." : "Yes"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-0.5 text-xs rounded border border-[#2A2A30] text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="p-1 text-[#5A5650] hover:text-red-400 transition-colors"
              title="Delete this table mapping"
            >
              <Trash2 size={16} />
            </button>
          )}
          <button type="button" onClick={onBack} className="p-1 text-[#5A5650] hover:text-[#F0EDE8] transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* All-mapped success banner */}
      {mappedCount === totalCdm && totalCdm > 0 && (
        <div className="flex items-center gap-2 px-5 py-2 bg-emerald-950/30 border-b border-emerald-900/40">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-emerald-300">
            All CDM columns mapped &mdash; {reviewedCount} of {mappedCount} reviewed
          </span>
        </div>
      )}

      {/* Column header */}
      <div className="flex items-center px-5 py-2 border-b border-[#2A2A30] bg-[#0E0E11] text-[10px] uppercase tracking-wider text-gray-500 font-semibold sticky top-0 z-10">
        <div className="w-[220px]">CDM Column</div>
        <div className="w-[240px]">Source Column</div>
        <div className="w-[80px]">Type</div>
        <div className="flex-1">Logic</div>
        <div className="w-[80px] text-center">Status</div>
      </div>

      {/* Table rows */}
      <div className="flex-1 overflow-y-auto">
        {sortedCdmColumns.map((col, idx) => {
          const mapping = mappingByCdm.get(col.name);
          const isExpanded = expandedCol === col.name;
          const sectionBreak = sectionBreaks.find((b) => b.index === idx);
          const showConceptSearch =
            mapping &&
            (mapping.mapping_type === "lookup" || mapping.mapping_type === "constant") &&
            col.name.endsWith("_concept_id");
          const hasDocs = !!(col.description || col.etl_conventions);
          const isDocsOpen = showDocs === col.name;
          const confidencePct = mapping?.confidence !== null && mapping?.confidence !== undefined
            ? Math.round(mapping.confidence * 100)
            : null;

          return (
            <div key={col.name}>
              {/* Section divider */}
              {sectionBreak && (
                <div className="flex items-center gap-2 px-5 py-1.5 bg-[#1C1C20]">
                  <div className="flex-1 h-px bg-[#2A2A30]" />
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
                    {sectionBreak.label} ({sectionBreak.count})
                  </span>
                  <div className="flex-1 h-px bg-[#2A2A30]" />
                </div>
              )}

              {/* Row */}
              <div
                onClick={() => mapping && setExpandedCol(isExpanded ? null : col.name)}
                className={cn(
                  "flex items-center px-5 py-2 border-b transition-colors",
                  mapping ? "cursor-pointer" : "",
                  isExpanded
                    ? "bg-[#1C1C20] border-[#2A2A30]"
                    : "border-[#2A2A30]/40 hover:bg-[#1C1C20]/40",
                  !mapping && col.required && "bg-red-950/10",
                )}
              >
                {/* CDM Column */}
                <div className="w-[220px] flex items-center gap-2 min-w-0">
                  <span className={cn(
                    "text-sm font-medium truncate",
                    mapping ? "text-[#2DD4BF]" : "text-gray-300",
                  )}>
                    {col.name}
                  </span>
                  {col.required && !mapping && (
                    <span className="text-red-400 text-xs flex-shrink-0">*</span>
                  )}
                  <span className="text-[10px] px-1 py-0.5 rounded bg-surface-raised text-gray-500 flex-shrink-0">
                    {col.type}
                  </span>
                </div>

                {/* Source Column */}
                <div className="w-[240px] relative">
                  <SourceColumnSelect
                    sourceColumns={sourceColumns}
                    selected={mapping?.source_column ?? null}
                    mappedSourceCols={mappedSourceCols}
                    onSelect={(src) => handleSourceSelect(col.name, src)}
                    onClear={() => handleSourceClear(col.name)}
                  />
                </div>

                {/* Type badge */}
                <div className="w-[80px]">
                  {mapping && (
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-medium",
                      TYPE_BADGE_STYLES[mapping.mapping_type] ?? TYPE_BADGE_STYLES.direct,
                    )}>
                      {mapping.mapping_type}
                    </span>
                  )}
                </div>

                {/* Logic preview */}
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  {mapping?.logic && (
                    <span className="text-xs text-gray-500 font-mono truncate">
                      {mapping.logic}
                    </span>
                  )}
                  {mapping?.is_ai_suggested && confidencePct !== null && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-900/40 text-amber-400 border border-amber-800/50 flex-shrink-0">
                      AI {confidencePct}%
                    </span>
                  )}
                </div>

                {/* Status */}
                <div className="w-[80px] flex justify-center">
                  {mapping ? (
                    mapping.is_reviewed ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" title="Needs review" />
                    )
                  ) : (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2A2A30]" title="Unmapped" />
                  )}
                </div>
              </div>

              {/* Expanded editor */}
              {isExpanded && mapping && (
                <div className="bg-[#151518] border-b border-[#2A2A30] px-5 py-4">
                  <div className="max-w-[800px]">
                    {/* Type + Logic row */}
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase text-gray-500 tracking-wide">Type</label>
                        <select
                          value={mapping.mapping_type}
                          onChange={(e) => handleMappingChange(col.name, { mapping_type: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-[#0E0E11] border border-[#2A2A30] rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#2DD4BF]"
                        >
                          {MAPPING_TYPES.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[10px] uppercase text-gray-500 tracking-wide">Logic / Expression</label>
                        <textarea
                          rows={2}
                          value={mapping.logic ?? ""}
                          onChange={(e) => handleMappingChange(col.name, { logic: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="Transformation logic or SQL expression"
                          className="bg-[#0E0E11] border border-[#2A2A30] rounded-md px-2 py-1.5 text-sm text-white font-mono resize-none focus:outline-none focus:border-[#2DD4BF] placeholder:text-gray-600"
                        />
                      </div>

                      <div className="flex flex-col gap-2 pt-5">
                        <label
                          className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={mapping.is_reviewed}
                            onChange={(e) => handleMappingChange(col.name, { is_reviewed: e.target.checked })}
                            className="rounded border-[#2A2A30] bg-[#0E0E11] text-[#2DD4BF] focus:ring-[#2DD4BF]"
                          />
                          Reviewed
                        </label>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSourceClear(col.name); }}
                          className="text-[11px] text-red-400 hover:text-red-300 transition-colors text-left"
                        >
                          Remove mapping
                        </button>
                      </div>
                    </div>

                    {/* Concept search for *_concept_id columns */}
                    {showConceptSearch && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <ConceptSearchInline
                          onSelect={(id, name) => handleConceptSelect(col.name, id, name)}
                        />
                      </div>
                    )}

                    {/* CDM Documentation */}
                    {hasDocs && (
                      <div className="mt-3 border-t border-[#2A2A30] pt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDocs(isDocsOpen ? null : col.name);
                          }}
                          className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-300 transition-colors"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          CDM Documentation
                          {isDocsOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {isDocsOpen && (
                          <div className="mt-2 space-y-2 text-xs text-gray-400">
                            {col.description && (
                              <div>
                                <span className="text-[10px] uppercase tracking-wide text-gray-500 block mb-0.5">User Guide</span>
                                <p className="text-gray-300 leading-relaxed">{col.description}</p>
                              </div>
                            )}
                            {col.etl_conventions && (
                              <div>
                                <span className="text-[10px] uppercase tracking-wide text-gray-500 block mb-0.5">ETL Conventions</span>
                                <p className="text-[#C9A227]/80 leading-relaxed">{col.etl_conventions}</p>
                              </div>
                            )}
                            {(col.fk_table || col.fk_domain) && (
                              <div className="flex gap-4">
                                {col.fk_table && (
                                  <span>
                                    <span className="text-[10px] uppercase tracking-wide text-gray-500">FK Table: </span>
                                    <span className="text-[#2DD4BF]">{col.fk_table}</span>
                                  </span>
                                )}
                                {col.fk_domain && (
                                  <span>
                                    <span className="text-[10px] uppercase tracking-wide text-gray-500">FK Domain: </span>
                                    <span className="text-[#2DD4BF]">{col.fk_domain}</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
      </div>
    </>
  );
}
