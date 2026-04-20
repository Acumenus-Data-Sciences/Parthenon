import { useEffect } from "react";
import { Brain, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAnalyzeImport } from "../../hooks/useGisImport";
import type { ColumnSuggestion } from "../../types/gisImport";

interface Props {
  importId: number;
  onComplete: (suggestions: ColumnSuggestion[]) => void;
}

export function AnalyzeStep({ importId, onComplete }: Props) {
  const { t } = useTranslation("app");
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
        <p>{t("administration.gisImport.analyze.analysisFailed")}</p>
        <p className="mt-1 text-xs">{analyze.error instanceof Error ? analyze.error.message : t("administration.gisImport.analyze.unknownError")}</p>
        <button
          onClick={() => analyze.mutate(importId, { onSuccess: (d) => onComplete(d.suggestions || []) })}
          className="mt-2 rounded bg-surface-elevated px-3 py-1 text-xs text-text-primary hover:bg-surface-highlight"
        >
          {t("administration.gisImport.analyze.retry")}
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
      <p className="text-sm text-text-primary">{t("administration.gisImport.analyze.analyzing")}</p>
      <p className="mt-1 text-xs text-text-ghost">{t("administration.gisImport.analyze.detecting")}</p>
    </div>
  );
}
