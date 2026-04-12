import { useState, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { useSaveMapping, useAskAbbyColumn } from "../../hooks/useGisImport";
import type { ColumnSuggestion, ColumnMapping, ColumnPurpose } from "../../types/gisImport";

const PURPOSE_OPTIONS: { value: ColumnPurpose; label: string }[] = [
  { value: "geography_code", label: "Geography Code" },
  { value: "geography_name", label: "Geography Name" },
  { value: "latitude", label: "Latitude" },
  { value: "longitude", label: "Longitude" },
  { value: "value", label: "Value (metric)" },
  { value: "metadata", label: "Metadata" },
  { value: "skip", label: "Skip" },
];

interface Props {
  importId: number;
  headers: string[];
  suggestions: ColumnSuggestion[];
  mapping: ColumnMapping;
  onComplete: (mapping: ColumnMapping) => void;
}

export function MappingStep({ importId, headers, suggestions, mapping: initialMapping, onComplete }: Props) {
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
    if (confidence >= 0.9) return <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] text-green-400">High</span>;
    if (confidence >= 0.5) return <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">Medium</span>;
    return <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400">Low</span>;
  };

  return (
    <div className="space-y-4">
      <div className="rounded border border-[#232328] bg-[#0E0E11]">
        <div className="border-b border-[#232328] px-4 py-2">
          <h3 className="text-sm font-medium text-[#E8E4DC]">Column Mapping</h3>
          <p className="text-xs text-[#5A5650]">Map each source column to its purpose</p>
        </div>

        <div className="divide-y divide-[#232328]">
          {headers.map((col) => {
            const suggestion = getSuggestion(col);
            const current = mapping[col];

            return (
              <div key={col} className="flex items-center gap-4 px-4 py-3">
                {/* Column name */}
                <div className="w-48 shrink-0">
                  <span className="font-mono text-sm text-[#E8E4DC]">{col}</span>
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
                  className="rounded border border-[#323238] bg-[#1C1C20] px-2 py-1 text-sm text-[#E8E4DC]"
                >
                  {PURPOSE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>

                {/* Reasoning */}
                {suggestion?.reasoning && (
                  <span className="text-xs text-[#5A5650] truncate max-w-[200px]" title={suggestion.reasoning}>
                    {suggestion.reasoning}
                  </span>
                )}

                {/* Ask Abby */}
                <button
                  onClick={() => handleAskAbby(col)}
                  className="ml-auto shrink-0 rounded border border-[#323238] p-1 text-[#5A5650] hover:text-[#C9A227]"
                  title="Ask Abby"
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
        <div className="rounded border border-[#C9A227]/30 bg-[#C9A227]/5 p-3">
          <p className="text-xs font-medium text-[#C9A227]">Abby on &quot;{askingColumn}&quot;:</p>
          {askMutation.isPending ? (
            <p className="mt-1 text-xs text-[#8A857D]">Thinking...</p>
          ) : abbyAnswer ? (
            <p className="mt-1 text-xs text-[#E8E4DC]">{abbyAnswer}</p>
          ) : null}
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="rounded bg-[#C9A227] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#C9A227]/90 disabled:opacity-50"
        >
          {saveMutation.isPending ? "Saving..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
