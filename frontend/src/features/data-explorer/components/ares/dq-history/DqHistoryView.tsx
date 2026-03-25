import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useDqHistory, useDqDeltas } from "../../../hooks/useDqHistoryData";
import DqTrendChart from "./DqTrendChart";
import DqDeltaTable from "./DqDeltaTable";
import type { DqTrendPoint } from "../../../types/ares";

export default function DqHistoryView() {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState<number | null>(null);

  const { data: sources } = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
  const { data: trends, isLoading: trendsLoading } = useDqHistory(selectedSourceId);
  const { data: deltas, isLoading: deltasLoading } = useDqDeltas(selectedSourceId, selectedReleaseId);

  const selectedRelease = trends?.find((t: DqTrendPoint) => t.release_id === selectedReleaseId);

  return (
    <div className="p-4">
      {/* Source selector */}
      <div className="mb-4 flex items-center gap-4">
        <label className="text-sm text-[#888]">Source:</label>
        <select
          value={selectedSourceId ?? ""}
          onChange={(e) => {
            setSelectedSourceId(Number(e.target.value) || null);
            setSelectedReleaseId(null);
          }}
          className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-sm text-white"
        >
          <option value="">Select source...</option>
          {sources?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.source_name}
            </option>
          ))}
        </select>
      </div>

      {!selectedSourceId && (
        <p className="py-10 text-center text-[#555]">Select a source to view DQ history.</p>
      )}

      {selectedSourceId && trendsLoading && <p className="text-[#555]">Loading DQ history...</p>}

      {selectedSourceId && !trendsLoading && trends && (
        <>
          {/* Trend chart */}
          <div className="mb-6 rounded-lg border border-[#252530] bg-[#151518] p-4">
            <h3 className="mb-3 text-sm font-medium text-white">DQ Pass Rate Over Releases</h3>
            <DqTrendChart
              data={trends}
              onReleaseClick={(releaseId) => setSelectedReleaseId(releaseId)}
            />
          </div>

          {/* Delta table — shows when a release is clicked */}
          {selectedReleaseId && (
            <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
              {deltasLoading ? (
                <p className="text-[#555]">Loading deltas...</p>
              ) : (
                <DqDeltaTable
                  deltas={deltas ?? []}
                  releaseName={selectedRelease?.release_name ?? ""}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
