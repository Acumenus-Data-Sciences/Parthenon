import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import {
  useUnmappedCodes,
  useUnmappedCodesSummary,
  useUnmappedCodesPareto,
  useUnmappedCodesProgress,
  useUnmappedCodesTreemap,
} from "../../../hooks/useDqHistoryData";
import { useReleases } from "../../../hooks/useReleaseData";
import { fetchUnmappedCodesExport } from "../../../api/dqHistoryApi";
import type { SourceRelease, UnmappedCode } from "../../../types/ares";
import ParetoChart from "./ParetoChart";
import MappingProgressTracker from "./MappingProgressTracker";
import VocabularyBarChart from "./VocabularyBarChart";
import MappingSuggestionPanel from "./MappingSuggestionPanel";

type ViewMode = "table" | "pareto" | "vocabulary";

export default function UnmappedCodesView() {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [releaseId, setReleaseId] = useState<number | null>(null);
  const [tableFilter, setTableFilter] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [exporting, setExporting] = useState(false);

  const { data: sources } = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
  const { data: releases } = useReleases(selectedSourceId);

  // Auto-select latest release
  const latestRelease = releases?.[0];
  const activeReleaseId = releaseId ?? latestRelease?.id ?? null;

  const { data: summary } = useUnmappedCodesSummary(selectedSourceId, activeReleaseId);
  const { data: codesData, isLoading } = useUnmappedCodes(selectedSourceId, activeReleaseId, {
    table: tableFilter || undefined,
    search: searchFilter || undefined,
    page,
    per_page: 20,
  });

  // Phase B data
  const { data: paretoData } = useUnmappedCodesPareto(selectedSourceId, activeReleaseId);
  const { data: progressData } = useUnmappedCodesProgress(selectedSourceId, activeReleaseId);
  const { data: treemapData } = useUnmappedCodesTreemap(selectedSourceId, activeReleaseId);

  // Extract unique tables from summary for filter dropdown
  const availableTables = summary?.map((s) => s.cdm_table) ?? [];

  const handleExport = async (format: "usagi" | "csv") => {
    if (!selectedSourceId || !activeReleaseId) return;
    setExporting(true);
    try {
      const result = await fetchUnmappedCodesExport(selectedSourceId, activeReleaseId, format);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exportData = result as any;
      if (format === "usagi" && exportData?.content) {
        const blob = new Blob([exportData.content], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = exportData.filename ?? "unmapped_codes.csv";
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4">
      {/* Filters row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-text-muted">Source:</label>
          <select
            value={selectedSourceId ?? ""}
            onChange={(e) => {
              setSelectedSourceId(Number(e.target.value) || null);
              setReleaseId(null);
              setPage(1);
            }}
            className="rounded border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-text-primary"
          >
            <option value="">Select source...</option>
            {sources?.map((s) => (
              <option key={s.id} value={s.id}>{s.source_name}</option>
            ))}
          </select>
        </div>

        {selectedSourceId && releases && releases.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-text-muted">Release:</label>
            <select
              value={activeReleaseId ?? ""}
              onChange={(e) => {
                setReleaseId(Number(e.target.value) || null);
                setPage(1);
              }}
              className="rounded border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-text-primary"
            >
              {releases.map((r: SourceRelease) => (
                <option key={r.id} value={r.id}>{r.release_name}</option>
              ))}
            </select>
          </div>
        )}

        {/* View mode toggle */}
        {selectedSourceId && activeReleaseId && (
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-base p-0.5">
            {(["table", "pareto", "vocabulary"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded-md px-3 py-1 text-xs transition-colors ${
                  viewMode === mode
                    ? "bg-surface-accent text-text-primary"
                    : "text-text-ghost hover:text-text-primary"
                }`}
              >
                {mode === "table" ? "Table" : mode === "pareto" ? "Pareto" : "Vocabulary"}
              </button>
            ))}
          </div>
        )}

        {/* Export button */}
        {selectedSourceId && activeReleaseId && (
          <button
            type="button"
            onClick={() => handleExport("usagi")}
            disabled={exporting}
            className="rounded border border-border-default px-3 py-1.5 text-xs text-text-muted hover:border-surface-highlight hover:text-text-primary disabled:opacity-50"
          >
            {exporting ? "Exporting..." : "Export Usagi CSV"}
          </button>
        )}
      </div>

      {/* Progress tracker */}
      {progressData && progressData.total > 0 && (
        <div className="mb-4">
          <MappingProgressTracker {...progressData} />
        </div>
      )}

      {/* Table filter badges */}
      {viewMode === "table" && (
        <>
          {availableTables.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-text-muted">Table:</label>
                <select
                  value={tableFilter}
                  onChange={(e) => {
                    setTableFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-text-primary"
                >
                  <option value="">All tables</option>
                  {availableTables.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                placeholder="Search source codes..."
                value={searchFilter}
                onChange={(e) => {
                  setSearchFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-text-primary
                           placeholder:text-text-ghost focus:border-success focus:outline-none"
              />
            </div>
          )}

          {/* Summary badges */}
          {summary && summary.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {summary.map((s) => (
                <button
                  key={`${s.cdm_table}-${s.cdm_field}`}
                  type="button"
                  onClick={() => {
                    setTableFilter(s.cdm_table);
                    setPage(1);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    tableFilter === s.cdm_table
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border-default text-text-muted hover:border-surface-highlight"
                  }`}
                >
                  {s.cdm_table} ({s.code_count} codes, {Number(s.total_records).toLocaleString()} records)
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Content area */}
      {!selectedSourceId && (
        <p className="py-10 text-center text-text-ghost">Select a source to view unmapped codes.</p>
      )}

      {isLoading && viewMode === "table" && <p className="text-text-ghost">Loading unmapped codes...</p>}

      {/* Pareto view */}
      {viewMode === "pareto" && paretoData && paretoData.codes.length > 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
          <h3 className="mb-3 text-sm font-medium text-text-primary">Unmapped Codes Pareto Analysis</h3>
          <ParetoChart data={paretoData.codes} top20Coverage={paretoData.top_20_coverage} />
        </div>
      )}

      {viewMode === "pareto" && paretoData && paretoData.codes.length === 0 && (
        <p className="py-10 text-center text-text-ghost">No unmapped codes found for Pareto analysis.</p>
      )}

      {/* Vocabulary view */}
      {viewMode === "vocabulary" && treemapData && treemapData.length > 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
          <h3 className="mb-3 text-sm font-medium text-text-primary">Unmapped Codes by Vocabulary</h3>
          <VocabularyBarChart data={treemapData} />
        </div>
      )}

      {viewMode === "vocabulary" && treemapData && treemapData.length === 0 && (
        <p className="py-10 text-center text-text-ghost">No vocabulary data available.</p>
      )}

      {/* Table view */}
      {viewMode === "table" && codesData && codesData.data.length === 0 && (
        <p className="py-10 text-center text-text-ghost">
          No unmapped source codes found. All codes are mapped to standard OMOP concepts.
        </p>
      )}

      {viewMode === "table" && codesData && codesData.data.length > 0 && (
        <>
          <p className="mb-3 text-xs text-text-ghost">
            Sorted by impact score (record count x domain weight)
          </p>

          <div className="overflow-hidden rounded-lg border border-border-subtle">
            <table className="w-full text-sm">
              <thead className="bg-surface-overlay">
                <tr className="border-b border-border-subtle">
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-text-muted">Source Code</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-text-muted">Vocabulary</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-text-muted">CDM Table</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-text-muted">CDM Field</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium uppercase text-text-muted">Records</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium uppercase text-text-muted">Impact Score</th>
                </tr>
              </thead>
              <tbody>
                {codesData.data.map((code: UnmappedCode, idx: number) => (
                  <tr key={code.id} className="border-b border-border-subtle hover:bg-surface-raised">
                    <td className="px-3 py-2 font-mono text-xs text-text-secondary">{code.source_code}</td>
                    <td className="px-3 py-2 text-xs text-text-muted">{code.source_vocabulary_id}</td>
                    <td className="px-3 py-2 text-xs text-text-muted">{code.cdm_table}</td>
                    <td className="px-3 py-2 text-xs text-text-muted">{code.cdm_field}</td>
                    <td className="px-3 py-2 text-right text-xs text-text-secondary">
                      {code.record_count.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      <span className="flex items-center justify-end gap-1.5">
                        {page === 1 && idx < 3 && (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-text-primary">
                            #{idx + 1}
                          </span>
                        )}
                        <span className="text-text-secondary">{Number(code.impact_score).toFixed(1)}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* AI Mapping Suggestion Panels */}
          {selectedSourceId && (
            <div className="mt-3 space-y-1">
              <p className="mb-2 text-[11px] uppercase text-text-ghost">AI Mapping Suggestions</p>
              {codesData.data.map((code: UnmappedCode) => (
                <div key={`suggest-${code.id}`} className="rounded-lg border border-border-subtle bg-surface-raised">
                  <div className="px-3 py-1.5 text-xs text-text-secondary">
                    <span className="font-mono">{code.source_code}</span>
                    <span className="ml-2 text-text-ghost">({code.source_vocabulary_id})</span>
                  </div>
                  <MappingSuggestionPanel code={code} sourceId={selectedSourceId} />
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          <div className="mt-3 flex items-center justify-between text-xs text-text-muted">
            <span>
              Showing {(codesData.meta.page - 1) * codesData.meta.per_page + 1}–
              {Math.min(codesData.meta.page * codesData.meta.per_page, codesData.meta.total)} of{" "}
              {codesData.meta.total.toLocaleString()}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-border-default px-3 py-1 disabled:opacity-30"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(codesData.meta.last_page, p + 1))}
                disabled={page >= codesData.meta.last_page}
                className="rounded border border-border-default px-3 py-1 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
