import { memo, useCallback, type ChangeEvent } from "react";
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

function MappingTypeEditorComponent({ mapping, onChange }: MappingTypeEditorProps) {
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
    <div className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg p-4 mt-2">
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
            className="bg-[#0E0E11] border border-[#2a2a3e] rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-[#2DD4BF]"
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
            className="bg-[#0E0E11] border border-[#2a2a3e] rounded px-2 py-1 text-sm text-white font-mono resize-none focus:outline-none focus:border-[#2DD4BF] placeholder:text-gray-600"
          />
        </div>

        {/* Reviewed checkbox */}
        <div className="flex flex-col gap-1 pt-4">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mapping.is_reviewed}
              onChange={handleReviewedChange}
              className="rounded border-[#2a2a3e] bg-[#0E0E11] text-[#2DD4BF] focus:ring-[#2DD4BF]"
            />
            Reviewed
          </label>
        </div>
      </div>

      {/* Concept search for *_concept_id columns */}
      {showConceptSearch && (
        <ConceptSearchInline onSelect={handleConceptSelect} />
      )}
    </div>
  );
}

export const MappingTypeEditor = memo(MappingTypeEditorComponent);
