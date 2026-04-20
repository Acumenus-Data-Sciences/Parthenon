import { useState, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSaveMapping, useAskAbbyColumn } from "../../hooks/useGisImport";
import type { ColumnSuggestion, ColumnMapping, ColumnPurpose } from "../../types/gisImport";

const PURPOSE_OPTIONS: { value: ColumnPurpose; labelKey: string }[] = [
  { value: "geography_code", labelKey: "geographyCode" },
  { value: "geography_name", labelKey: "geographyName" },
  { value: "latitude", labelKey: "latitude" },
  { value: "longitude", labelKey: "longitude" },
  { value: "value", labelKey: "valueMetric" },
  { value: "metadata", labelKey: "metadata" },
  { value: "skip", labelKey: "skip" },
];

interface Props {
  importId: number;
  headers: string[];
  suggestions: ColumnSuggestion[];
  mapping: ColumnMapping;
  onComplete: (mapping: ColumnMapping) => void;
}

export function MappingStep({ importId, headers, suggestions, mapping: initialMapping, onComplete }: Props) {
  const { t } = useTranslation("app");
  const [mapping, setMapping] = useState<ColumnMapping>(initialMapping);
  const [askingColumn, setAskingColumn] = useState<string | null>(null);
  const [abbyAnswer, setAbbyAnswer] = useState<string | null>(null);
  const saveMutation = useSaveMapping();
  const askMutation = useAskAbbyColumn();

  const getSuggestion = useCallback(
    (col: string) => suggestions.find((s) => s.column === col),
    [suggestions],
  );

  const handlePurposeChange = useCallback((col: string, purpose: ColumnPurpose) => {
    setMapping((prev) => ({
      ...prev,
      [col]: { ...prev[col], purpose },
    }));
  }, []);

  const handleSave = useCallback(async () => {
    await saveMutation.mutateAsync({ importId, mapping });
    onComplete(mapping);
  }, [saveMutation, importId, mapping, onComplete]);

  const handleAskAbby = useCallback(
    async (col: string) => {
      setAskingColumn(col);
      setAbbyAnswer(null);
      const result = await askMutation.mutateAsync({
        importId,
        column: col,
        question: `What is this column "${col}" likely used for in a GIS dataset?`,
      });
      setAbbyAnswer(result.answer);
    },
    [askMutation, importId],
  );

  const confidenceBadge = (confidence: number) => {
    if (confidence >= 0.9) {
      return (
        <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] text-green-400">
          {t("administration.gisImport.mapping.confidence.high")}
        </span>
      );
    }
    if (confidence >= 0.5) {
      return (
        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">
          {t("administration.gisImport.mapping.confidence.medium")}
        </span>
      );
    }
    return (
      <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">
        {t("administration.gisImport.mapping.confidence.low")}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded border border-border-default bg-surface-base">
        <div className="border-b border-border-default px-4 py-2">
          <h3 className="text-sm font-medium text-text-primary">
            {t("administration.gisImport.mapping.title")}
          </h3>
          <p className="text-xs text-text-ghost">
            {t("administration.gisImport.mapping.subtitle")}
          </p>
        </div>

        <div className="divide-y divide-border-default">
          {headers.map((col) => {
            const suggestion = getSuggestion(col);
            const current = mapping[col];

            return (
              <div key={col} className="flex items-center gap-4 px-4 py-3">
                {/* Column name */}
                <div className="w-48 shrink-0">
                  <span className="font-mono text-sm text-text-primary">{col}</span>
                  {suggestion && (
                    <div className="mt-0.5 flex items-center gap-1">
                      {confidenceBadge(suggestion.confidence)}
                    </div>
                  )}
                </div>

                {/* Purpose dropdown */}
                <select
                  value={current?.purpose ?? "skip"}
                  onChange={(e) => handlePurposeChange(col, e.target.value as ColumnPurpose)}
                  className="rounded border border-surface-highlight bg-surface-overlay px-2 py-1 text-sm text-text-primary"
                >
                  {PURPOSE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(`administration.gisImport.mapping.purposes.${opt.labelKey}`)}
                    </option>
                  ))}
                </select>

                {/* Reasoning */}
                {suggestion?.reasoning && (
                  <span className="text-xs text-text-ghost truncate max-w-[200px]" title={suggestion.reasoning}>
                    {suggestion.reasoning}
                  </span>
                )}

                {/* Ask Abby */}
                <button
                  onClick={() => handleAskAbby(col)}
                  className="ml-auto shrink-0 rounded border border-surface-highlight p-1 text-text-ghost hover:text-accent"
                  title={t("administration.gisImport.mapping.askAbby")}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Abby answer panel */}
      {askingColumn && (
        <div className="rounded border border-accent/30 bg-accent/5 p-3">
          <p className="text-xs font-medium text-accent">
            {t("administration.gisImport.mapping.abbyOnColumn", {
              column: askingColumn,
            })}
          </p>
          {askMutation.isPending ? (
            <p className="mt-1 text-xs text-text-muted">
              {t("administration.gisImport.mapping.thinking")}
            </p>
          ) : abbyAnswer ? (
            <p className="mt-1 text-xs text-text-primary">{abbyAnswer}</p>
          ) : null}
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-surface-base hover:bg-accent/90 disabled:opacity-50"
        >
          {saveMutation.isPending
            ? t("administration.gisImport.mapping.saving")
            : t("administration.gisImport.mapping.continue")}
        </button>
      </div>
    </div>
  );
}
