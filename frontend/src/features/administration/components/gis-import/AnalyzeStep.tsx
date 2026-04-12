import { useEffect } from "react";
import { Brain, Loader2 } from "lucide-react";
import { useAnalyzeImport } from "../../hooks/useGisImport";
import type { ColumnSuggestion } from "../../types/gisImport";

interface Props {
  importId: number;
  onComplete: (suggestions: ColumnSuggestion[]) => void;
}

export function AnalyzeStep({ importId, onComplete }: Props) {
  const analyze = useAnalyzeImport();

  useEffect(() => {
    if (!analyze.data && !analyze.isPending && !analyze.isError) {
      analyze.mutate(importId, {
        onSuccess: (data) => {
          onComplete(data.suggestions || []);
        },
      });
    }
  }, [importId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (analyze.isError) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        <p>Abby encountered an issue analyzing this file.</p>
        <p className="mt-1 text-xs">{analyze.error instanceof Error ? analyze.error.message : "Unknown error"}</p>
        <button
          onClick={() => analyze.mutate(importId, { onSuccess: (d) => onComplete(d.suggestions || []) })}
          className="mt-2 rounded bg-surface-elevated px-3 py-1 text-xs text-text-primary hover:bg-surface-highlight"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
        {analyze.isPending ? (
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        ) : (
          <Brain className="h-8 w-8 text-accent" />
        )}
      </div>
      <p className="text-sm text-text-primary">Abby is analyzing your data...</p>
      <p className="mt-1 text-xs text-text-ghost">Detecting column types, geography codes, and value semantics</p>
    </div>
  );
}
