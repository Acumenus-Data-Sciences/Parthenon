import { useState } from "react";
import {
  Clock,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNumber } from "../../lib/fhir-utils";
import type { HistoryEntry } from "../../lib/fhir-utils";

export function IngestionHistory({
  history,
  onSelect,
  onDelete,
  onClear,
  selectedId,
}: {
  history: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
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
          Ingestion History
        </span>
        <span className="text-[11px] text-[#5A5650]">{history.length}</span>
        {expanded ? (
          <ChevronUp size={14} className="text-[#8A857D]" />
        ) : (
          <ChevronDown size={14} className="text-[#8A857D]" />
        )}
      </button>

      {expanded && (
        <div className="max-h-[420px] overflow-y-auto">
          {history.map((entry) => {
            const isSuccess =
              entry.status === "ok" || entry.status === "success";
            const isPartial = entry.status === "partial";

            return (
              <div
                key={entry.id}
                onClick={() => onSelect(entry)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 border-b border-[#1C1C20] cursor-pointer hover:bg-[#1C1C20] transition-colors",
                  selectedId === entry.id &&
                    "bg-[#1C1C20] border-l-2 border-l-[#9B1B30]",
                )}
              >
                {isSuccess ? (
                  <CheckCircle2 size={14} className="shrink-0 text-[#2DD4BF]" />
                ) : isPartial ? (
                  <AlertTriangle size={14} className="shrink-0 text-[#C9A227]" />
                ) : (
                  <XCircle size={14} className="shrink-0 text-[#E85A6B]" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-[#F0EDE8] truncate">
                      {entry.resourceCount} resources \u2192{" "}
                      {fmtNumber(entry.recordsCreated)} records
                    </p>
                    {entry.errorCount > 0 && (
                      <span className="text-[10px] text-[#E85A6B]">
                        {entry.errorCount} err
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#5A5650]">
                    {new Date(entry.timestamp).toLocaleString()}
                    {entry.fileName && ` \u2014 ${entry.fileName}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(entry.id);
                  }}
                  className="p-1 rounded hover:bg-[#2E2E35] text-[#5A5650] hover:text-[#E85A6B] transition-colors"
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
