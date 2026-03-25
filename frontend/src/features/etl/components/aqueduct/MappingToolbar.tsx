import { memo } from "react";

interface MappingToolbarProps {
  projectName: string;
  status: string;
  mappedTables: number;
  totalCdmTables: number;
  fieldCoveragePct: number;
  filter: "all" | "mapped" | "unmapped";
  onFilterChange: (f: "all" | "mapped" | "unmapped") => void;
  onBack: () => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-gray-700/50", text: "text-gray-300", label: "Draft" },
  in_review: { bg: "bg-amber-900/50", text: "text-amber-300", label: "In Review" },
  approved: { bg: "bg-green-900/50", text: "text-green-300", label: "Approved" },
  archived: { bg: "bg-red-900/50", text: "text-red-300", label: "Archived" },
};

const FILTER_OPTIONS: Array<{ value: "all" | "mapped" | "unmapped"; label: string }> = [
  { value: "all", label: "All" },
  { value: "mapped", label: "Mapped" },
  { value: "unmapped", label: "Unmapped" },
];

function MappingToolbarComponent({
  projectName,
  status,
  mappedTables,
  totalCdmTables,
  fieldCoveragePct,
  filter,
  onFilterChange,
  onBack,
}: MappingToolbarProps) {
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  const progressPct = totalCdmTables > 0 ? (mappedTables / totalCdmTables) * 100 : 0;

  return (
    <div className="bg-[#0E0E11] border-b border-[#2a2a3e] px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Back + project name + status */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-colors p-1 -ml-1"
            aria-label="Go back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-white font-semibold text-sm truncate max-w-[240px]">
            {projectName}
          </h1>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusStyle.bg} ${statusStyle.text}`}
          >
            {statusStyle.label}
          </span>
        </div>

        {/* Center: Progress */}
        <div className="flex flex-col items-center gap-1 min-w-[280px]">
          <span className="text-xs text-gray-400">
            {mappedTables} of {totalCdmTables} CDM tables mapped &bull; {fieldCoveragePct}% field coverage
          </span>
          <div className="w-full h-1 bg-[#2a2a3e] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2DD4BF] rounded-full transition-all duration-300"
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Right: Filter toggle + placeholder buttons */}
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-[#2a2a3e]">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onFilterChange(opt.value)}
                className={`text-xs px-3 py-1.5 transition-colors ${
                  filter === opt.value
                    ? "bg-[#2DD4BF]/20 text-[#2DD4BF] font-medium"
                    : "text-gray-400 hover:text-white hover:bg-[#1a1a2e]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled
            className="text-xs px-3 py-1.5 text-gray-600 border border-[#2a2a3e] rounded-lg cursor-not-allowed"
            title="AI Suggest (Phase 2)"
          >
            AI Suggest
          </button>
          <button
            type="button"
            disabled
            className="text-xs px-3 py-1.5 text-gray-600 border border-[#2a2a3e] rounded-lg cursor-not-allowed"
            title="Export (Phase 3)"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

export const MappingToolbar = memo(MappingToolbarComponent);
