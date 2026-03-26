import { Loader2, AlertCircle } from "lucide-react";
import { useStagingPreview } from "../hooks/useIngestionProjects";

interface StagingPreviewProps {
  projectId: number;
  tableName: string;
}

export function StagingPreview({ projectId, tableName }: StagingPreviewProps) {
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
        <table className="w-full text-xs">
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
                    className="px-3 py-1.5 text-[#C5C0B8] font-mono whitespace-nowrap border-b border-[#1C1C20] max-w-[250px] truncate"
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
      <div className="px-3 py-2 border-t border-[#232328] bg-[#1C1C20]">
        <span className="text-[11px] text-[#8A857D]">
          Showing 1&ndash;{showing} of {data.total.toLocaleString()} total rows
        </span>
      </div>
    </div>
  );
}
