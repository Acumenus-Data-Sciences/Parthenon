import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, ChevronDown, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";

interface SourceSelectorProps {
  value: number | null;
  onChange: (sourceId: number) => void;
}

export function SourceSelector({ value, onChange }: SourceSelectorProps) {
  const { data: sources, isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  // Auto-select default source when no value is set and sources load
  useEffect(() => {
    if (value || !sources?.length) return;
    const defaultSource = sources.find((s) => s.is_default);
    if (defaultSource) {
      onChange(defaultSource.id);
    }
  }, [value, sources, onChange]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#232328] bg-[#151518] px-4 py-2">
        <Loader2 size={14} className="animate-spin text-[#8A857D]" />
        <span className="text-sm text-[#8A857D]">Loading sources...</span>
      </div>
    );
  }

  const selectedSource = sources?.find((s) => s.id === value);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {selectedSource?.is_default ? (
          <Star size={14} className="text-[#C9A227] fill-[#C9A227]" />
        ) : (
          <Database size={14} className="text-[#8A857D]" />
        )}
        <select
          value={value ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "appearance-none rounded-lg border border-[#232328] bg-[#151518] pl-3 pr-8 py-2 text-sm",
            "text-[#F0EDE8] focus:border-[#C9A227] focus:outline-none focus:ring-1 focus:ring-[#C9A227]/30",
            "cursor-pointer min-w-[200px]",
          )}
        >
          <option value="" disabled>
            Select a data source
          </option>
          {sources?.map((source) => (
            <option key={source.id} value={source.id}>
              {source.is_default ? "\u2605 " : ""}{source.source_name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#8A857D]"
        />
      </div>
    </div>
  );
}
