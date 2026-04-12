import { Loader2, AlertCircle, X } from "lucide-react";
import { useStagingPreview } from "../hooks/useIngestionProjects";

interface StagingPreviewProps {
  projectId: number;
  tableName: string;
  onClose?: () => void;
}

export function StagingPreview({ projectId, tableName, onClose }: StagingPreviewProps) {
  const { data, isLoading, error } = useStagingPreview(projectId, tableName);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 bg-[#151518] rounded-b-lg">
        <Loader2 size={18} className="animate-spin text-[#8A857D]" />
        <span className="ml-2 text-sm text-[#8A857D]">Loading preview...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 bg-[#151518] rounded-b-lg">
        <AlertCircle size={16} className="text-[#E85A6B]" />
        <span className="text-sm text-[#E85A6B]">Failed to load preview</span>
      </div>
    );
  }

  if (data.rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 bg-[#151518] rounded-b-lg">
        <span className="text-sm text-[#8A857D]">No rows in staging table</span>
      </div>
    );
  }

  const showing = Math.min(data.rows.length, 100);

  return (
    <div className="bg-[#151518] border border-[#232328] border-t-0 rounded-b-lg overflow-hidden">
      <div className="max-h-[400px] overflow-auto">
        <table className="text-xs border-collapse" style={{ minWidth: "100%" }}>
          <thead>
            <tr className="bg-[#1C1C20] sticky top-0 z-10">
              {data.columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#8A857D] whitespace-nowrap border-b border-[#232328]"
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
                className={rowIdx % 2 === 0 ? "bg-[#151518]" : "bg-[#1A1A1E]"}
              >
                {data.columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-1.5 text-[#C5C0B8] font-mono border-b border-[#1C1C20] max-w-[200px] truncate"
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
      <div className="flex items-center justify-between px-3 py-2 border-t border-[#232328] bg-[#1C1C20]">
        <span className="text-[11px] text-[#8A857D]">
          Showing 1&ndash;{showing} of {(data.total ?? 0).toLocaleString()} total rows
          {" · "}{data.columns.length} columns
          {" · "}scroll horizontally to see all
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 text-[11px] text-[#8A857D] hover:text-[#F0EDE8] transition-colors shrink-0"
          >
            <X size={12} />
            Close
          </button>
        )}
      </div>
    </div>
  );
}
