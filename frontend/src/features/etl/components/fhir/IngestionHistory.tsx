import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("app");
  const [expanded, setExpanded] = useState(true);

  if (history.length === 0) return null;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-surface-overlay border-b border-border-default text-left"
      >
        <Clock size={14} className="text-text-muted" />
        <span className="flex-1 text-sm font-medium text-text-primary">
          {t("ingestion.fhirIngestion.history")}
        </span>
        <span className="text-[11px] text-text-ghost">{history.length}</span>
        {expanded ? (
          <ChevronUp size={14} className="text-text-muted" />
        ) : (
          <ChevronDown size={14} className="text-text-muted" />
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
                  "flex items-center gap-3 px-4 py-2.5 border-b border-border-subtle cursor-pointer hover:bg-surface-overlay transition-colors",
                  selectedId === entry.id &&
                    "bg-surface-overlay border-l-2 border-l-primary",
                )}
              >
                {isSuccess ? (
                  <CheckCircle2 size={14} className="shrink-0 text-success" />
                ) : isPartial ? (
                  <AlertTriangle size={14} className="shrink-0 text-accent" />
                ) : (
                  <XCircle size={14} className="shrink-0 text-critical" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-text-primary truncate">
                      {t("ingestion.fhirIngestion.historyResourceRecords", {
                        resources: entry.resourceCount,
                        records: fmtNumber(entry.recordsCreated),
                      })}
                    </p>
                    {entry.errorCount > 0 && (
                      <span className="text-[10px] text-critical">
                        {t("ingestion.fhirIngestion.errorShort", {
                          count: entry.errorCount,
                        })}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-text-ghost">
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
                  className="p-1 rounded hover:bg-surface-accent text-text-ghost hover:text-critical transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
          <div className="px-4 py-2 border-t border-border-default">
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-text-ghost hover:text-critical transition-colors"
            >
              {t("ingestion.fhirIngestion.clearHistory")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
