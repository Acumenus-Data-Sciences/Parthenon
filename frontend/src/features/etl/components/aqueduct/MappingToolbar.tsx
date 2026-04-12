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
  draft: { bg: "bg-surface-accent/50", text: "text-text-secondary", label: "Draft" },
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
    <div className="bg-surface-base border-b border-border-default px-4 py-2 flex items-center justify-between gap-3">
      {/* Left: back + project + status + progress */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="text-text-muted hover:text-text-primary transition-colors p-0.5 flex-shrink-0"
          aria-label="Go back"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <span className="text-text-primary font-medium text-base truncate max-w-[200px]">{projectName}</span>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 ${statusStyle.bg} ${statusStyle.text}`}>
          {statusStyle.label}
        </span>
        <span className="text-text-ghost flex-shrink-0">{"\u2502"}</span>
        <span className="text-text-muted text-sm flex-shrink-0 whitespace-nowrap">
          {mappedTables}/{totalCdmTables}
        </span>
        <div className="w-24 h-1 bg-surface-accent rounded-full overflow-hidden flex-shrink-0">
          <div
            className="h-full bg-success rounded-full transition-all duration-300"
            style={{ width: `${Math.min(progressPct, 100)}%` }}
          />
        </div>
        <span className="text-success text-sm font-medium flex-shrink-0">{fieldCoveragePct}%</span>
      </div>

      {/* Right: filters + actions + expand */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex rounded-md overflow-hidden border border-border-default">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onFilterChange(opt.value)}
              className={`text-sm px-3 py-1.5 transition-colors ${
                filter === opt.value
                  ? "bg-success/20 text-success font-medium"
                  : "text-text-ghost hover:text-text-primary hover:bg-surface-overlay"
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
          className="text-sm px-3 py-1.5 border border-border-default rounded-md transition-colors disabled:opacity-50 text-accent hover:bg-amber-900/30"
        >
          {isSuggesting ? "Suggesting..." : "\u2728 AI"}
        </button>
        <div className="relative" ref={exportRef}>
          <button
            type="button"
            onClick={() => setExportOpen((prev) => !prev)}
            disabled={isExporting}
            className="text-sm px-3 py-1.5 border border-border-default rounded-md transition-colors disabled:opacity-50 text-text-muted hover:text-text-primary hover:bg-surface-overlay"
          >
            {isExporting ? "..." : "Export \u25BE"}
          </button>
          {exportOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-surface-overlay border border-border-default rounded-lg shadow-lg z-50 overflow-hidden">
              {EXPORT_OPTIONS.map((opt) => (
                <button
                  key={opt.format}
                  type="button"
                  onClick={() => { setExportOpen(false); onExport(opt.format); }}
                  className="w-full text-left text-xs px-3 py-2 text-text-muted hover:bg-surface-accent/80 hover:text-text-primary transition-colors"
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
              ? "text-text-primary bg-success/20 border border-success hover:bg-success/30"
              : "text-accent bg-surface-elevated border border-border-default hover:bg-surface-elevated/80"
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
