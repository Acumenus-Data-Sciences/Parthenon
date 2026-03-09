// ---------------------------------------------------------------------------
// ReportSection — Individual toggleable/reorderable section in the report
// ---------------------------------------------------------------------------

import { ChevronUp, ChevronDown, Eye, EyeOff } from "lucide-react";
import { MethodsSection } from "./MethodsSection";
import { ResultsSummarySection } from "./ResultsSummarySection";
import type { ReportSection as ReportSectionType } from "../types/publish";

interface ReportSectionProps {
  section: ReportSectionType;
  included: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

/**
 * A single report section with header, toggle (include/exclude),
 * up/down reorder buttons, and content preview.
 */
export function ReportSectionCard({
  section,
  included,
  isFirst,
  isLast,
  onToggle,
  onMoveUp,
  onMoveDown,
}: ReportSectionProps) {
  return (
    <div
      data-testid={`report-section-${section.id}`}
      className={`rounded-lg border transition-opacity ${
        included
          ? "border-[#232328] bg-[#151518]"
          : "border-[#232328]/50 bg-[#151518]/50 opacity-50"
      }`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#232328]">
        <div className="flex items-center gap-3">
          {/* Reorder buttons */}
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              className="p-0.5 rounded text-[#F0EDE8]/40 hover:text-[#F0EDE8] disabled:opacity-20 disabled:cursor-not-allowed"
              aria-label="Move up"
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              className="p-0.5 rounded text-[#F0EDE8]/40 hover:text-[#F0EDE8] disabled:opacity-20 disabled:cursor-not-allowed"
              aria-label="Move down"
            >
              <ChevronDown size={14} />
            </button>
          </div>

          {/* Title */}
          <div>
            <h3 className="text-sm font-semibold text-[#F0EDE8]">
              {section.title}
            </h3>
            <span className="text-xs text-[#F0EDE8]/40 capitalize">
              {section.type}
              {section.analysisType ? ` / ${section.analysisType}` : ""}
            </span>
          </div>
        </div>

        {/* Toggle */}
        <button
          type="button"
          onClick={onToggle}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            included
              ? "bg-[#2DD4BF]/15 text-[#2DD4BF] hover:bg-[#2DD4BF]/25"
              : "bg-[#E85A6B]/15 text-[#E85A6B] hover:bg-[#E85A6B]/25"
          }`}
          aria-label={included ? "Exclude section" : "Include section"}
        >
          {included ? <Eye size={12} /> : <EyeOff size={12} />}
          {included ? "Included" : "Excluded"}
        </button>
      </div>

      {/* Content */}
      {included && (
        <div className="px-4 py-3">
          {section.type === "methods" && <MethodsSection section={section} />}
          {section.type === "results" && (
            <ResultsSummarySection section={section} />
          )}
          {section.type === "diagnostics" && (
            <div className="text-sm text-[#F0EDE8]/50 italic">
              Diagnostics data will be rendered in the exported report.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
