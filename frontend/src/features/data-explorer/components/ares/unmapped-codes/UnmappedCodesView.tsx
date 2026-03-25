import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useUnmappedCodes, useUnmappedCodesSummary } from "../../../hooks/useDqHistoryData";
import { useReleases } from "../../../hooks/useReleaseData";
import type { SourceRelease, UnmappedCode } from "../../../types/ares";

export default function UnmappedCodesView() {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [releaseId, setReleaseId] = useState<number | null>(null);
  const [tableFilter, setTableFilter] = useState<string>("");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [page, setPage] = useState(1);

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

  // Extract unique tables from summary for filter dropdown
  const availableTables = summary?.map((s) => s.cdm_table) ?? [];

  return (
    <div className="p-4">
      {/* Filters row */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[#888]">Source:</label>
          <select
            value={selectedSourceId ?? ""}
            onChange={(e) => {
              setSelectedSourceId(Number(e.target.value) || null);
              setReleaseId(null);
              setPage(1);
            }}
            className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-sm text-white"
          >
            <option value="">Select source...</option>
            {sources?.map((s) => (
              <option key={s.id} value={s.id}>{s.source_name}</option>
            ))}
          </select>
        </div>

        {selectedSourceId && releases && releases.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#888]">Release:</label>
            <select
              value={activeReleaseId ?? ""}
              onChange={(e) => {
                setReleaseId(Number(e.target.value) || null);
                setPage(1);
              }}
              className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-sm text-white"
            >
              {releases.map((r: SourceRelease) => (
                <option key={r.id} value={r.id}>{r.release_name}</option>
              ))}
            </select>
          </div>
        )}

        {availableTables.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-[#888]">Table:</label>
            <select
              value={tableFilter}
              onChange={(e) => {
                setTableFilter(e.target.value);
                setPage(1);
              }}
              className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-sm text-white"
            >
              <option value="">All tables</option>
              {availableTables.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}

        <input
          type="text"
          placeholder="Search source codes..."
          value={searchFilter}
          onChange={(e) => {
            setSearchFilter(e.target.value);
            setPage(1);
          }}
          className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-sm text-white
                     placeholder-[#555] focus:border-[#2DD4BF] focus:outline-none"
        />
      </div>

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
                  ? "border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]"
                  : "border-[#333] text-[#888] hover:border-[#555]"
              }`}
            >
              {s.cdm_table} ({s.code_count} codes, {Number(s.total_records).toLocaleString()} records)
            </button>
          ))}
        </div>
      )}

      {/* Helper text */}
      {codesData && codesData.data.length > 0 && (
        <p className="mb-3 text-xs text-[#555]">
          Sorted by impact score (record count x domain weight)
        </p>
      )}

      {/* Data table */}
      {!selectedSourceId && (
        <p className="py-10 text-center text-[#555]">Select a source to view unmapped codes.</p>
      )}

      {isLoading && <p className="text-[#555]">Loading unmapped codes...</p>}

      {codesData && codesData.data.length === 0 && (
        <p className="py-10 text-center text-[#555]">
          No unmapped source codes found. All codes are mapped to standard OMOP concepts.
        </p>
      )}

      {codesData && codesData.data.length > 0 && (
        <>
          <div className="overflow-hidden rounded-lg border border-[#252530]">
            <table className="w-full text-sm">
              <thead className="bg-[#1a1a22]">
                <tr className="border-b border-[#252530]">
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Source Code</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Vocabulary</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">CDM Table</th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">CDM Field</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium uppercase text-[#888]">Records</th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium uppercase text-[#888]">Impact Score</th>
                </tr>
              </thead>
              <tbody>
                {codesData.data.map((code: UnmappedCode, idx: number) => (
                  <tr key={code.id} className="border-b border-[#1a1a22] hover:bg-[#151518]">
                    <td className="px-3 py-2 font-mono text-xs text-[#ccc]">{code.source_code}</td>
                    <td className="px-3 py-2 text-xs text-[#888]">{code.source_vocabulary_id}</td>
                    <td className="px-3 py-2 text-xs text-[#888]">{code.cdm_table}</td>
                    <td className="px-3 py-2 text-xs text-[#888]">{code.cdm_field}</td>
                    <td className="px-3 py-2 text-right text-xs text-[#ccc]">
                      {code.record_count.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-xs">
                      <span className="flex items-center justify-end gap-1.5">
                        {page === 1 && idx < 3 && (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#9B1B30] text-[10px] font-bold text-white">
                            #{idx + 1}
                          </span>
                        )}
                        <span className="text-[#ccc]">{Number(code.impact_score).toFixed(1)}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="mt-3 flex items-center justify-between text-xs text-[#888]">
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
                className="rounded border border-[#333] px-3 py-1 disabled:opacity-30"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(codesData.meta.last_page, p + 1))}
                disabled={page >= codesData.meta.last_page}
                className="rounded border border-[#333] px-3 py-1 disabled:opacity-30"
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
