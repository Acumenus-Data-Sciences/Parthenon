import { useTranslation } from "react-i18next";
import { Loader2, AlertCircle, X } from "lucide-react";
import { useStagingPreview } from "../hooks/useIngestionProjects";

interface StagingPreviewProps {
  projectId: number;
  tableName: string;
  onClose?: () => void;
}

export function StagingPreview({ projectId, tableName, onClose }: StagingPreviewProps) {
  const { t } = useTranslation("app");
  const { data, isLoading, error } = useStagingPreview(projectId, tableName);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 bg-surface-raised rounded-b-lg">
        <Loader2 size={18} className="animate-spin text-text-muted" />
        <span className="ml-2 text-sm text-text-muted">
          {t("ingestion.stagingPreview.loading")}
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 bg-surface-raised rounded-b-lg">
        <AlertCircle size={16} className="text-critical" />
        <span className="text-sm text-critical">
          {t("ingestion.stagingPreview.loadFailed")}
        </span>
      </div>
    );
  }

  if (data.rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 bg-surface-raised rounded-b-lg">
        <span className="text-sm text-text-muted">
          {t("ingestion.stagingPreview.noRows")}
        </span>
      </div>
    );
  }

  const showing = Math.min(data.rows.length, 100);

  return (
    <div className="bg-surface-raised border border-border-default border-t-0 rounded-b-lg overflow-hidden">
      <div className="max-h-[400px] overflow-auto">
        <table className="text-xs border-collapse" style={{ minWidth: "100%" }}>
          <thead>
            <tr className="bg-surface-overlay sticky top-0 z-10">
              {data.columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted whitespace-nowrap border-b border-border-default"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={rowIdx % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay"}
              >
                {data.columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-1.5 text-text-secondary font-mono border-b border-border-subtle max-w-[200px] truncate"
                    title={row[col] ?? ""}
                  >
                    {row[col] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border-default bg-surface-overlay">
        <span className="text-[11px] text-text-muted">
          {t("ingestion.stagingPreview.showing", { count: showing })}{" "}
          {t("ingestion.stagingPreview.ofTotalRows", {
            count: (data.total ?? 0).toLocaleString(),
          })}
          {" · "}
          {t("ingestion.schemaMapping.columns", {
            count: data.columns.length,
          })}
          {" · "}
          {t("ingestion.stagingPreview.scrollHint")}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary transition-colors shrink-0"
          >
            <X size={12} />
            {t("ingestion.actions.close")}
          </button>
        )}
      </div>
    </div>
  );
}
