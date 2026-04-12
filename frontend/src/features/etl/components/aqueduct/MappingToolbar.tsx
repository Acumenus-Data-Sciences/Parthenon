import { memo, useState, useRef, useEffect } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

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
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: "bg-surface-accent/50", text: "text-gray-300", label: "Draft" },
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
  isFullscreen,
  onToggleFullscreen,
}: MappingToolbarProps) {
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const progressPct = totalCdmTables > 0 ? (mappedTables / totalCdmTables) * 100 : 0;

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

  return (
    <div className="bg-[#0E0E11] border-b border-[#2A2A30] px-4 py-2 flex items-center justify-between gap-3">
      {/* Left: back + project + status + progress */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="text-[#8A857D] hover:text-[#F0EDE8] transition-colors p-0.5 flex-shrink-0"
          aria-label="Go back"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <span className="text-[#F0EDE8] font-medium text-base truncate max-w-[200px]">{projectName}</span>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 ${statusStyle.bg} ${statusStyle.text}`}>
          {statusStyle.label}
        </span>
        <span className="text-[#323238] flex-shrink-0">{"\u2502"}</span>
        <span className="text-[#8A857D] text-sm flex-shrink-0 whitespace-nowrap">
          {mappedTables}/{totalCdmTables}
        </span>
        <div className="w-24 h-1 bg-[#2A2A30] rounded-full overflow-hidden flex-shrink-0">
          <div
            className="h-full bg-[#2DD4BF] rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
        <span className="text-[#2DD4BF] text-sm font-medium flex-shrink-0">{fieldCoveragePct}%</span>
      </div>

      {/* Right: filters + actions + expand */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex rounded-md overflow-hidden border border-[#2A2A30]">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onFilterChange(opt.value)}
              className={`text-sm px-3 py-1.5 transition-colors ${
                filter === opt.value
                  ? "bg-[#2DD4BF]/20 text-[#2DD4BF] font-medium"
                  : "text-[#5A5650] hover:text-[#F0EDE8] hover:bg-[#1C1C20]"
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
          className="text-sm px-3 py-1.5 border border-[#2A2A30] rounded-md transition-colors disabled:opacity-50 text-[#C9A227] hover:bg-amber-900/30"
        >
          {isSuggesting ? "Suggesting..." : "\u2728 AI"}
        </button>
        <div className="relative" ref={exportRef}>
          <button
            type="button"
            onClick={() => setExportOpen((prev) => !prev)}
            disabled={isExporting}
            className="text-sm px-3 py-1.5 border border-[#2A2A30] rounded-md transition-colors disabled:opacity-50 text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#1C1C20]"
          >
            {isExporting ? "..." : "Export \u25BE"}
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-[#1C1C20] border border-[#2A2A30] rounded-lg shadow-lg z-50 overflow-hidden">
              {EXPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.format}
                  type="button"
                  onClick={() => { setExportOpen(false); onExport(opt.format); }}
                  className="w-full text-left text-xs px-3 py-2 text-[#8A857D] hover:bg-[#2A2A30]/80 hover:text-[#F0EDE8] transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleFullscreen}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors ${
            isFullscreen
              ? "text-[#F0EDE8] bg-[#2DD4BF]/20 border border-[#2DD4BF] hover:bg-[#2DD4BF]/30"
              : "text-[#C9A227] bg-[#232328] border border-[#2A2A30] hover:bg-[#232328]/80"
          }`}
          title={isFullscreen ? "Collapse" : "Expand"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          {isFullscreen ? "Collapse" : "Expand"}
        </button>
      </div>
    </div>
  );
}

export const MappingToolbar = memo(MappingToolbarComponent);
