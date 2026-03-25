import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { useDqHistory, useDqDeltas, useCategoryHeatmap } from "../../../hooks/useDqHistoryData";
import { useDqOverlay } from "../../../hooks/useNetworkData";
import DqTrendChart from "./DqTrendChart";
import DqDeltaTable from "./DqDeltaTable";
import DqCategoryHeatmap from "./DqCategoryHeatmap";
import type { DqTrendPoint } from "../../../types/ares";

type DqTab = "trends" | "heatmap" | "overlay";

export default function DqHistoryView() {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [selectedReleaseId, setSelectedReleaseId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<DqTab>("trends");

  const { data: sources } = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
  const { data: trends, isLoading: trendsLoading } = useDqHistory(selectedSourceId);
  const { data: deltas, isLoading: deltasLoading } = useDqDeltas(selectedSourceId, selectedReleaseId);
  const { data: heatmapData, isLoading: heatmapLoading } = useCategoryHeatmap(
    activeTab === "heatmap" ? selectedSourceId : null,
  );
  const { data: overlayData, isLoading: overlayLoading } = useDqOverlay();

  const selectedRelease = trends?.find((t: DqTrendPoint) => t.release_id === selectedReleaseId);

  return (
    <div className="p-4">
      {/* Header with source selector and tab toggle */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
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

        {/* Tab toggle */}
        <div className="flex gap-1 rounded-lg border border-[#333] p-0.5">
          <button
            type="button"
            onClick={() => setActiveTab("trends")}
            className={`rounded px-3 py-1 text-xs ${
              activeTab === "trends" ? "bg-[#2DD4BF] text-black" : "text-[#888]"
            }`}
          >
            Trends
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("heatmap")}
            className={`rounded px-3 py-1 text-xs ${
              activeTab === "heatmap" ? "bg-[#2DD4BF] text-black" : "text-[#888]"
            }`}
          >
            Heatmap
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("overlay")}
            className={`rounded px-3 py-1 text-xs ${
              activeTab === "overlay" ? "bg-[#2DD4BF] text-black" : "text-[#888]"
            }`}
          >
            Cross-Source
          </button>
        </div>
      </div>

      {!selectedSourceId && activeTab !== "overlay" && (
        <p className="py-10 text-center text-[#555]">Select a source to view DQ history.</p>
      )}

      {/* Trends tab */}
      {activeTab === "trends" && selectedSourceId && (
        <>
          {trendsLoading && <p className="text-[#555]">Loading DQ history...</p>}

          {!trendsLoading && trends && (
            <>
              <div className="mb-6 rounded-lg border border-[#252530] bg-[#151518] p-4">
                <h3 className="mb-3 text-sm font-medium text-white">DQ Pass Rate Over Releases</h3>
                <DqTrendChart
                  data={trends}
                  onReleaseClick={(releaseId) => setSelectedReleaseId(releaseId)}
                />
              </div>

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
        </>
      )}

      {/* Heatmap tab */}
      {activeTab === "heatmap" && selectedSourceId && (
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
          <h3 className="mb-3 text-sm font-medium text-white">Category x Release Heatmap</h3>
          {heatmapLoading && <p className="text-[#555]">Loading heatmap...</p>}
          {heatmapData && (
            <DqCategoryHeatmap
              releases={heatmapData.releases}
              categories={heatmapData.categories}
              cells={heatmapData.cells}
              onCellClick={(releaseId, _category) => {
                setSelectedReleaseId(releaseId);
                setActiveTab("trends");
              }}
            />
          )}
        </div>
      )}

      {/* Cross-source overlay tab */}
      {activeTab === "overlay" && (
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
          <h3 className="mb-3 text-sm font-medium text-white">Cross-Source DQ Overlay</h3>
          {overlayLoading && <p className="text-[#555]">Loading overlay data...</p>}
          {overlayData && overlayData.length > 0 && (
            <DqTrendChart
              data={[]}
              overlayData={overlayData}
            />
          )}
          {overlayData && overlayData.length === 0 && (
            <p className="py-10 text-center text-[#555]">No DQ data available across sources.</p>
          )}
        </div>
      )}
    </div>
  );
}
