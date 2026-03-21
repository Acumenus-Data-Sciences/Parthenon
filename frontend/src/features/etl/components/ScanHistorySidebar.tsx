import { useState } from "react";
import { Clock, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  scoreToGrade,
  tableNullScore,
  type ScanHistoryEntry,
} from "../lib/profiler-utils";

export function ScanHistorySidebar({
  history,
  onSelect,
  onDelete,
  onClear,
  selectedId,
}: {
  history: ScanHistoryEntry[];
  onSelect: (entry: ScanHistoryEntry) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  selectedId: string | null;
}) {
  const [expanded, setExpanded] = useState(true);

  if (history.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-[#1C1C20] border-b border-[#232328] text-left"
      >
        <Clock size={14} className="text-[#8A857D]" />
        <span className="flex-1 text-sm font-medium text-[#F0EDE8]">
          Scan History
        </span>
        <span className="text-[11px] text-[#5A5650]">{history.length}</span>
        {expanded ? (
          <ChevronUp size={14} className="text-[#8A857D]" />
        ) : (
          <ChevronDown size={14} className="text-[#8A857D]" />
        )}
      </button>

      {expanded && (
        <div className="max-h-[400px] overflow-y-auto">
          {history.map((entry) => {
            const grade = scoreToGrade(
              entry.result.tables.length > 0
                ? entry.result.tables.reduce((s, t) => s + tableNullScore(t), 0) /
                    entry.result.tables.length
                : 0,
            );
            return (
              <div
                key={entry.id}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 border-b border-[#1C1C20] cursor-pointer hover:bg-[#1C1C20] transition-colors",
                  selectedId === entry.id && "bg-[#1C1C20] border-l-2 border-l-[#9B1B30]",
                )}
                onClick={() => onSelect(entry)}
              >
                <span
                  className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: grade.bg, color: grade.color }}
                >
                  {grade.letter}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#F0EDE8] truncate">
                    {entry.sourceName}
                  </p>
                  <p className="text-[10px] text-[#5A5650]">
                    {new Date(entry.scannedAt).toLocaleString()} -{" "}
                    {entry.tableCount} tables
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(entry.id);
                  }}
                  className="p-1 rounded hover:bg-[#2E2E35] text-[#5A5650] hover:text-[#E85A6B] transition-colors"
                  title="Delete scan"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
          <div className="px-4 py-2 border-t border-[#232328]">
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-[#5A5650] hover:text-[#E85A6B] transition-colors"
            >
              Clear all history
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
