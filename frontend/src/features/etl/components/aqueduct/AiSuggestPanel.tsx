import { useCallback, useEffect, useMemo, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import {
  Sparkles,
  Check,
  CheckCheck,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useSuggestFieldMappings } from "../../hooks/useAqueductData";
import type { EtlFieldMapping, FieldSuggestionGroup } from "../../api";

interface AiSuggestPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: number;
  tableMappingId: number;
  sourceTable: string;
  targetTable: string;
  existingMappings: EtlFieldMapping[];
  onAccept: (
    targetColumn: string,
    sourceColumn: string,
    mappingType: string,
    confidence: number,
    logic: string | null,
  ) => void;
  onAcceptAll: (
    accepted: Array<{
      targetColumn: string;
      sourceColumn: string;
      mappingType: string;
      confidence: number;
      logic: string | null;
    }>,
  ) => void;
}

function scoreColor(score: number): string {
  if (score >= 0.8) return "bg-emerald-500";
  if (score >= 0.6) return "bg-amber-500";
  return "bg-red-500";
}

function scoreTextColor(score: number): string {
  if (score >= 0.8) return "text-emerald-400";
  if (score >= 0.6) return "text-amber-400";
  return "text-red-400";
}

export function AiSuggestPanel({
  open,
  onClose,
  projectId,
  tableMappingId,
  sourceTable,
  targetTable,
  existingMappings,
  onAccept,
  onAcceptAll,
}: AiSuggestPanelProps) {
  const suggest = useSuggestFieldMappings(projectId, tableMappingId);
  const [acceptedCols, setAcceptedCols] = useState<Set<string>>(new Set());

  // Auto-fetch when opened
  useEffect(() => {
    if (open && !suggest.data && !suggest.isPending) {
      suggest.mutate();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset accepted set when drawer closes
  useEffect(() => {
    if (!open) {
      setAcceptedCols(new Set());
    }
  }, [open]);

  const handleRefresh = useCallback(() => {
    setAcceptedCols(new Set());
    suggest.mutate();
  }, [suggest]);

  // Filter out already-mapped and already-accepted columns
  const filteredGroups = useMemo<FieldSuggestionGroup[]>(() => {
    if (!suggest.data) return [];
    const mappedTargets = new Set(
      existingMappings
        .filter((m) => m.source_column)
        .map((m) => m.target_column),
    );
    return suggest.data.filter(
      (g) =>
        !mappedTargets.has(g.target_column) &&
        !acceptedCols.has(g.target_column),
    );
  }, [suggest.data, existingMappings, acceptedCols]);

  const handleAcceptOne = useCallback(
    (
      targetCol: string,
      sourceCol: string,
      mappingType: string,
      score: number,
      logic: string | null,
    ) => {
      onAccept(targetCol, sourceCol, mappingType, score, logic);
      setAcceptedCols((prev) => new Set([...prev, targetCol]));
    },
    [onAccept],
  );

  const handleAcceptAllTop = useCallback(() => {
    const accepted = filteredGroups
      .filter((g) => g.suggestions.length > 0)
      .map((g) => ({
        targetColumn: g.target_column,
        sourceColumn: g.suggestions[0].source_column,
        mappingType: g.suggestions[0].mapping_type,
        confidence: g.suggestions[0].score,
        logic: g.suggestions[0].logic,
      }));
    onAcceptAll(accepted);
    setAcceptedCols((prev) => {
      const next = new Set(prev);
      for (const a of accepted) next.add(a.targetColumn);
      return next;
    });
  }, [filteredGroups, onAcceptAll]);

  const suggestionsWithMatches = filteredGroups.filter(
    (g) => g.suggestions.length > 0,
  );

  const footer =
    filteredGroups.length > 0 ? (
      <div className="flex items-center justify-between w-full">
        <span className="text-xs text-gray-500">
          {suggestionsWithMatches.length} columns with suggestions
        </span>
        <button
          onClick={handleAcceptAllTop}
          className="flex items-center gap-1.5 px-4 py-2 text-sm rounded bg-success/10 text-success hover:bg-success/20 transition-colors font-medium"
        >
          <CheckCheck className="w-4 h-4" />
          Accept All Top Suggestions
        </button>
      </div>
    ) : undefined;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`AI Suggestions: ${sourceTable} → ${targetTable}`}
      size="lg"
      footer={footer}
    >
      <div className="flex flex-col h-full">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Sparkles className="w-4 h-4 text-accent" />
            <span>
              {filteredGroups.length} unmapped columns with suggestions
            </span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={suggest.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-surface-elevated hover:bg-surface-accent/80 text-gray-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${suggest.isPending ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {suggest.isPending && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <span className="text-sm">Analyzing column matches...</span>
            </div>
          )}

          {suggest.isError && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
              <span className="text-sm text-red-400 mb-2">
                Failed to generate suggestions
              </span>
              <button
                onClick={handleRefresh}
                className="px-3 py-1.5 text-xs rounded bg-surface-elevated hover:bg-surface-accent/80 text-gray-300"
              >
                Retry
              </button>
            </div>
          )}

          {suggest.data && filteredGroups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <CheckCheck className="w-8 h-8 text-emerald-400 mb-3" />
              <span className="text-sm">All CDM columns are mapped</span>
            </div>
          )}

          {filteredGroups.map((group) => (
            <SuggestionGroup
              key={group.target_column}
              group={group}
              onAccept={handleAcceptOne}
            />
          ))}
        </div>
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: a single CDM column with its ranked suggestions
// ---------------------------------------------------------------------------

function SuggestionGroup({
  group,
  onAccept,
}: {
  group: FieldSuggestionGroup;
  onAccept: (
    targetCol: string,
    sourceCol: string,
    mappingType: string,
    score: number,
    logic: string | null,
  ) => void;
}) {
  return (
    <div className="rounded-lg border border-border-default overflow-hidden">
      {/* CDM column header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-overlay">
        <span className="font-medium text-success text-sm">
          {group.target_column}
        </span>
        {group.is_required && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-400 font-medium">
            Required
          </span>
        )}
      </div>

      {/* Suggestions */}
      {group.suggestions.length === 0 ? (
        <div className="px-3 py-2 text-xs text-gray-500 italic">
          No matching source columns found
        </div>
      ) : (
        <div className="divide-y divide-border-default/40">
          {group.suggestions.map((s, i) => (
            <div
              key={s.source_column}
              className="px-3 py-2 hover:bg-surface-elevated/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Rank badge */}
                <span className="text-[10px] text-gray-600 w-4 text-center">
                  {i + 1}
                </span>

                {/* Source column name */}
                <span className="text-sm text-accent font-medium flex-1 min-w-0 truncate">
                  {s.source_column}
                </span>

                {/* Mapping type badge */}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
                  {s.mapping_type}
                </span>

                {/* Score bar */}
                <div className="flex items-center gap-1.5 w-24">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${scoreColor(s.score)}`}
                      style={{ width: `${Math.round(s.score * 100)}%` }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-mono ${scoreTextColor(s.score)}`}
                  >
                    {Math.round(s.score * 100)}%
                  </span>
                </div>

                {/* Accept button */}
                <button
                  onClick={() =>
                    onAccept(
                      group.target_column,
                      s.source_column,
                      s.mapping_type,
                      s.score,
                      s.logic,
                    )
                  }
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-success/10 text-success hover:bg-success/20 transition-colors"
                  title={`Map ${s.source_column} → ${group.target_column} as ${s.mapping_type}`}
                >
                  <Check className="w-3 h-3" />
                  Accept
                </button>
              </div>
              {s.logic && (
                <div className="ml-7 mt-1 text-[10px] text-gray-500 font-mono truncate" title={s.logic}>
                  {s.logic}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
