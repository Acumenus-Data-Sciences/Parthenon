import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Database,
  ChevronDown,
  Code,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { usePreviewSql } from "../hooks/useCohortGeneration";

interface CohortSqlPreviewProps {
  definitionId: number | null;
}

export function CohortSqlPreview({ definitionId }: CohortSqlPreviewProps) {
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const {
    data: sqlResult,
    isLoading: loadingSql,
    refetch,
    error,
  } = usePreviewSql(definitionId, sourceId);

  const handleCopy = async () => {
    if (!sqlResult?.sql) return;
    await navigator.clipboard.writeText(sqlResult.sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1C1C20]">
        <div className="flex items-center gap-2">
          <Code size={14} className="text-[#C9A227]" />
          <h4 className="text-sm font-semibold text-[#F0EDE8]">
            SQL Preview
          </h4>
        </div>

        <div className="flex items-center gap-2">
          {/* Source selector */}
          <div className="relative">
            <Database
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A5650]"
            />
            <select
              value={sourceId ?? ""}
              onChange={(e) => setSourceId(Number(e.target.value) || null)}
              disabled={loadingSources}
              className={cn(
                "appearance-none rounded-lg border border-[#232328] bg-[#0E0E11] pl-7 pr-7 py-1.5 text-xs",
                "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
                "cursor-pointer min-w-[160px]",
              )}
            >
              <option value="">Select source</option>
              {sources?.map((src) => (
                <option key={src.id} value={src.id}>
                  {src.source_name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5650]"
            />
          </div>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={!sourceId || loadingSql}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors disabled:opacity-40"
            title="Refresh SQL"
          >
            <RefreshCw
              size={12}
              className={loadingSql ? "animate-spin" : ""}
            />
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!sqlResult?.sql}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-[#8A857D] hover:text-[#F0EDE8] hover:bg-[#232328] transition-colors disabled:opacity-40"
            title="Copy SQL"
          >
            {copied ? (
              <Check size={12} className="text-[#2DD4BF]" />
            ) : (
              <Copy size={12} />
            )}
          </button>
        </div>
      </div>

      {/* SQL content */}
      <div className="max-h-80 overflow-auto">
        {!sourceId ? (
          <div className="flex items-center justify-center py-12 text-xs text-[#5A5650]">
            Select a data source to preview SQL
          </div>
        ) : loadingSql ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={18} className="animate-spin text-[#8A857D]" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-xs text-[#E85A6B]">
            Failed to generate SQL preview
          </div>
        ) : sqlResult?.sql ? (
          <pre className="p-4 text-xs leading-relaxed text-[#C5C0B8] font-['IBM_Plex_Mono',monospace] whitespace-pre-wrap break-words">
            {sqlResult.sql}
          </pre>
        ) : (
          <div className="flex items-center justify-center py-12 text-xs text-[#5A5650]">
            No SQL generated. Ensure the cohort definition is saved first.
          </div>
        )}
      </div>
    </div>
  );
}
