import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, ChevronDown, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useSourceStore } from "@/stores/sourceStore";

interface SourceSelectorProps {
  value: number | null;
  onChange: (sourceId: number) => void;
}

export function SourceSelector({ value, onChange }: SourceSelectorProps) {
  const { data: sources, isLoading } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const defaultSourceId = useSourceStore((s) => s.defaultSourceId);

  // Auto-select user's default source when no value is set and sources load
  useEffect(() => {
    if (value || !sources?.length) return;
    const target = defaultSourceId
      ? sources.find((s) => s.id === defaultSourceId)
      : sources[0];
    if (target) onChange(target.id);
  }, [value, sources, defaultSourceId, onChange]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2">
        <Loader2 size={14} className="animate-spin text-text-muted" />
        <span className="text-sm text-text-muted">Loading sources...</span>
      </div>
    );
  }

  const selectedSource = sources?.find((s) => s.id === value);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {selectedSource && selectedSource.id === defaultSourceId ? (
          <Star size={14} className="text-accent fill-accent" />
        ) : (
          <Database size={14} className="text-text-muted" />
        )}
        <select
          value={value ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "appearance-none rounded-lg border border-border-default bg-surface-raised pl-3 pr-8 py-2 text-sm",
            "text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30",
            "cursor-pointer min-w-[200px]",
          )}
        >
          <option value="" disabled>
            Select a data source
          </option>
          {sources?.map((source) => (
            <option key={source.id} value={source.id}>
              {source.id === defaultSourceId ? "\u2605 " : ""}{source.source_name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-muted"
        />
      </div>
    </div>
  );
}
