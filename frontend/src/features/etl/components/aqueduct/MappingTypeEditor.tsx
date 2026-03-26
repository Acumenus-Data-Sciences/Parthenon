import { memo, useCallback, useState, type ChangeEvent } from "react";
import { BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { ConceptSearchInline } from "./ConceptSearchInline";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MappingTypeEditorProps {
  mapping: {
    source_column: string | null;
    target_column: string;
    mapping_type: string;
    logic: string | null;
    is_reviewed: boolean;
    is_ai_suggested: boolean;
    confidence: number | null;
  };
  onChange: (updates: {
    mapping_type?: string;
    logic?: string;
    is_reviewed?: boolean;
  }) => void;
  onRemove?: () => void;
  cdmColumnInfo?: {
    description?: string;
    etl_conventions?: string;
    fk_table?: string | null;
    fk_domain?: string | null;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAPPING_TYPES = [
  "direct",
  "transform",
  "lookup",
  "constant",
  "concat",
  "expression",
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function MappingTypeEditorComponent({ mapping, onChange, onRemove, cdmColumnInfo }: MappingTypeEditorProps) {
  const [showDocs, setShowDocs] = useState(false);
  const hasDocs = !!(cdmColumnInfo?.description || cdmColumnInfo?.etl_conventions);
  const handleTypeChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      onChange({ mapping_type: e.target.value });
    },
    [onChange],
  );

  const handleLogicChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange({ logic: e.target.value });
    },
    [onChange],
  );

  const handleReviewedChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange({ is_reviewed: e.target.checked });
    },
    [onChange],
  );

  const handleConceptSelect = useCallback(
    (conceptId: number, conceptName: string) => {
      onChange({ logic: `${conceptId} (${conceptName})` });
    },
    [onChange],
  );

  const showConceptSearch =
    (mapping.mapping_type === "lookup" || mapping.mapping_type === "constant") &&
    mapping.target_column.endsWith("_concept_id");

  const confidencePct =
    mapping.confidence !== null ? Math.round(mapping.confidence * 100) : null;

  return (
    <div className="bg-[#151518] border border-[#2A2A30] rounded-xl p-5 mt-2 shadow-[0_2px_4px_rgba(0,0,0,0.50)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-300">
          <span className="text-[#C9A227]">{mapping.source_column ?? "(constant)"}</span>
          <span className="text-gray-600 mx-2">&rarr;</span>
          <span className="text-[#2DD4BF]">{mapping.target_column}</span>
        </div>
        {mapping.is_ai_suggested && confidencePct !== null && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400 border border-amber-800/50">
            AI suggested ({confidencePct}%)
          </span>
        )}
      </div>

      {/* Controls row */}
      <div className="flex items-start gap-4">
        {/* Mapping type select */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase text-gray-500 tracking-wide">
            Type
          </label>
          <select
            value={mapping.mapping_type}
            onChange={handleTypeChange}
            className="bg-[#0E0E11] border border-[#2A2A30] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#2DD4BF]"
          >
            {MAPPING_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Logic textarea */}
        <div className="flex-1 flex flex-col gap-1">
          <label className="text-[10px] uppercase text-gray-500 tracking-wide">
            Logic
          </label>
          <textarea
            rows={2}
            value={mapping.logic ?? ""}
            onChange={handleLogicChange}
            placeholder="Transformation logic or SQL expression"
            className="bg-[#0E0E11] border border-[#2A2A30] rounded px-2 py-1 text-sm text-white font-mono resize-none focus:outline-none focus:border-[#2DD4BF] placeholder:text-gray-600"
          />
        </div>

        {/* Reviewed checkbox + Remove */}
        <div className="flex flex-col gap-2 pt-4">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mapping.is_reviewed}
              onChange={handleReviewedChange}
              className="rounded border-[#2A2A30] bg-[#0E0E11] text-[#2DD4BF] focus:ring-[#2DD4BF]"
            />
            Reviewed
          </label>
          {onRemove && (
            <button
              onClick={onRemove}
              className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
            >
              Remove mapping
            </button>
          )}
        </div>
      </div>

      {/* Concept search for *_concept_id columns */}
      {showConceptSearch && (
        <ConceptSearchInline onSelect={handleConceptSelect} />
      )}

      {/* CDM Documentation */}
      {hasDocs && (
        <div className="mt-3 border-t border-[#2A2A30] pt-3">
          <button
            onClick={() => setShowDocs((v) => !v)}
            className="flex items-center gap-1.5 text-[11px] text-gray-400 hover:text-gray-300 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            CDM Documentation
            {showDocs ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showDocs && (
            <div className="mt-2 space-y-2 text-xs text-gray-400">
              {cdmColumnInfo?.description && (
                <div>
                  <span className="text-[10px] uppercase tracking-wide text-gray-500 block mb-0.5">User Guide</span>
                  <p className="text-gray-300 leading-relaxed">{cdmColumnInfo.description}</p>
                </div>
              )}
              {cdmColumnInfo?.etl_conventions && (
                <div>
                  <span className="text-[10px] uppercase tracking-wide text-gray-500 block mb-0.5">ETL Conventions</span>
                  <p className="text-[#C9A227]/80 leading-relaxed">{cdmColumnInfo.etl_conventions}</p>
                </div>
              )}
              {(cdmColumnInfo?.fk_table || cdmColumnInfo?.fk_domain) && (
                <div className="flex gap-4">
                  {cdmColumnInfo.fk_table && (
                    <span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-500">FK Table: </span>
                      <span className="text-[#2DD4BF]">{cdmColumnInfo.fk_table}</span>
                    </span>
                  )}
                  {cdmColumnInfo.fk_domain && (
                    <span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-500">FK Domain: </span>
                      <span className="text-[#2DD4BF]">{cdmColumnInfo.fk_domain}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const MappingTypeEditor = memo(MappingTypeEditorComponent);
