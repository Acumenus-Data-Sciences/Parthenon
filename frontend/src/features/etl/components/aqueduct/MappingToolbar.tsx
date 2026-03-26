import { memo, useState, useRef, useEffect } from "react";

interface MappingToolbarProps {
  projectName: string;
  status: string;
  mappedTables: number;
  totalCdmTables: number;
  fieldCoveragePct: number;
  filter: "all" | "mapped" | "unmapped";
  onFilterChange: (f: "all" | "mapped" | "unmapped") => void;
  onBack: () => void;
  onSuggest: () => void;
  isSuggesting: boolean;
  onExport: (format: "markdown" | "sql" | "json") => void;
  isExporting: boolean;
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

const EXPORT_OPTIONS: Array<{ format: "markdown" | "sql" | "json"; label: string }> = [
  { format: "markdown", label: "Markdown Spec (.md)" },
  { format: "sql", label: "SQL Files (.zip)" },
  { format: "json", label: "Project JSON (.json)" },
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
  onSuggest,
  isSuggesting,
  onExport,
  isExporting,
}: MappingToolbarProps) {
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(event.target as HTMLElement)) {
        setExportOpen(false);
      }
    }
    if (exportOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [exportOpen]);
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
            onClick={onSuggest}
            disabled={isSuggesting}
            className="text-xs px-3 py-1.5 border border-[#2a2a3e] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-amber-400 hover:bg-amber-900/30 hover:border-amber-800/50"
            title="AI Suggest mappings"
          >
            {isSuggesting ? (
              <span className="inline-flex items-center gap-1.5">
                <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Suggesting...
              </span>
            ) : (
              "AI Suggest"
            )}
          </button>
          <div className="relative" ref={exportRef}>
            <button
              type="button"
              onClick={() => setExportOpen((prev) => !prev)}
              disabled={isExporting}
              className="text-xs px-3 py-1.5 border border-[#2a2a3e] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 hover:text-white hover:bg-[#1a1a2e]"
              title="Export ETL specification"
            >
              {isExporting ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Exporting...
                </span>
              ) : (
                "Export \u25BE"
              )}
            </button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg shadow-lg z-50 overflow-hidden">
                {EXPORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.format}
                    type="button"
                    onClick={() => {
                      setExportOpen(false);
                      onExport(opt.format);
                    }}
                    className="w-full text-left text-xs px-4 py-2 text-gray-300 hover:bg-[#2a2a3e] hover:text-white transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const MappingToolbar = memo(MappingToolbarComponent);
