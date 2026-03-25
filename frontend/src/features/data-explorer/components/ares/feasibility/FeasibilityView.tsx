import { useState } from "react";
import {
  useFeasibilityAssessment,
  useFeasibilityForecast,
  useFeasibilityImpact,
  useFeasibilityList,
  useRunFeasibility,
} from "../../../hooks/useNetworkData";
import FeasibilityForm from "./FeasibilityForm";
import CriteriaImpactChart from "./CriteriaImpactChart";
import ConsortDiagram from "./ConsortDiagram";
import ArrivalForecastChart from "./ArrivalForecastChart";
import type { FeasibilityAssessment, FeasibilityResult } from "../../../types/ares";

function ScoreBadge({ score, pass }: { score: number; pass: boolean }) {
  const color = score >= 90
    ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
    : score >= 70
      ? "bg-[#C9A227]/20 text-[#C9A227]"
      : score >= 50
        ? "bg-[#F59E0B]/20 text-[#F59E0B]"
        : "bg-[#9B1B30]/20 text-[#e85d75]";

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${color}`}>
      {score}%
    </span>
  );
}

type DetailView = "table" | "impact" | "consort";

export default function FeasibilityView() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [detailView, setDetailView] = useState<DetailView>("table");
  const [forecastSourceId, setForecastSourceId] = useState<number | null>(null);

  const { data: assessments } = useFeasibilityList();
  const { data: selectedAssessment } = useFeasibilityAssessment(selectedId);
  const { data: impactData } = useFeasibilityImpact(selectedId);
  const { data: forecastData } = useFeasibilityForecast(selectedId, forecastSourceId);
  const runMutation = useRunFeasibility();

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Feasibility Assessments</h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-[#C9A227] px-3 py-1.5 text-sm font-medium text-black hover:bg-[#d4ad2f]"
        >
          + New Assessment
        </button>
      </div>

      {showForm && (
        <div className="mb-4">
          <FeasibilityForm
            isLoading={runMutation.isPending}
            onSubmit={(name, criteria) => {
              runMutation.mutate(
                { name, criteria },
                {
                  onSuccess: (data) => {
                    setShowForm(false);
                    setSelectedId(data.id);
                  },
                },
              );
            }}
          />
        </div>
      )}

      {/* Past assessments list */}
      {assessments && assessments.length > 0 && (
        <div className="mb-4 space-y-2">
          {assessments.map((a: FeasibilityAssessment) => (
            <button
              key={a.id}
              type="button"
              onClick={() => { setSelectedId(a.id); setDetailView("table"); }}
              className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                selectedId === a.id
                  ? "border-[#C9A227] bg-[#C9A227]/5"
                  : "border-[#252530] bg-[#151518] hover:border-[#333]"
              }`}
            >
              <div>
                <p className="text-sm font-medium text-white">{a.name}</p>
                <p className="text-[11px] text-[#666]">
                  {new Date(a.created_at).toLocaleDateString()} | {a.sources_assessed} sources assessed
                </p>
              </div>
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  a.sources_passed === a.sources_assessed
                    ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
                    : a.sources_passed > 0
                      ? "bg-[#C9A227]/20 text-[#C9A227]"
                      : "bg-[#9B1B30]/20 text-[#e85d75]"
                }`}
              >
                {a.sources_passed}/{a.sources_assessed} passed
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Detail view toggle */}
      {selectedAssessment?.results && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-[#666]">View:</span>
          {(["table", "impact", "consort"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDetailView(mode)}
              className={`rounded px-2 py-1 text-xs transition-colors ${
                detailView === mode
                  ? "bg-[#C9A227]/20 text-[#C9A227]"
                  : "text-[#888] hover:text-white"
              }`}
            >
              {mode === "table" ? "Score Table" : mode === "impact" ? "Impact Analysis" : "CONSORT Flow"}
            </button>
          ))}
        </div>
      )}

      {/* Assessment results detail - Table view */}
      {selectedAssessment?.results && detailView === "table" && (
        <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
          <h3 className="mb-3 text-sm font-medium text-white">
            Results: {selectedAssessment.name}
          </h3>
          <div className="overflow-hidden rounded-lg border border-[#252530]">
            <table className="w-full text-sm">
              <thead className="bg-[#1a1a22]">
                <tr className="border-b border-[#252530]">
                  <th className="px-3 py-2 text-left text-[11px] font-medium uppercase text-[#888]">Source</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Domains</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Concepts</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Visits</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Dates</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Patients</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Score</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Overall</th>
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Forecast</th>
                </tr>
              </thead>
              <tbody>
                {selectedAssessment.results.map((r: FeasibilityResult) => (
                  <tr key={r.id} className="border-b border-[#1a1a22] hover:bg-[#1a1a22]">
                    <td className="px-3 py-2 text-white">{r.source_name}</td>
                    <td className="px-3 py-2 text-center">
                      <ScoreBadge score={r.domain_score ?? (r.domain_pass ? 100 : 0)} pass={r.domain_pass} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ScoreBadge score={r.concept_score ?? (r.concept_pass ? 100 : 0)} pass={r.concept_pass} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ScoreBadge score={r.visit_score ?? (r.visit_pass ? 100 : 0)} pass={r.visit_pass} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ScoreBadge score={r.date_score ?? (r.date_pass ? 100 : 0)} pass={r.date_pass} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <ScoreBadge score={r.patient_score ?? (r.patient_pass ? 100 : 0)} pass={r.patient_pass} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          (r.composite_score ?? 0) >= 80
                            ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
                            : (r.composite_score ?? 0) >= 60
                              ? "bg-[#C9A227]/20 text-[#C9A227]"
                              : "bg-[#9B1B30]/20 text-[#e85d75]"
                        }`}
                      >
                        {r.composite_score ?? 0}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            r.overall_pass
                              ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
                              : "bg-[#9B1B30]/20 text-[#e85d75]"
                          }`}
                        >
                          {r.overall_pass ? "ELIGIBLE" : "INELIGIBLE"}
                        </span>
                        <span className="text-[10px] text-[#666]">{r.composite_score ?? 0}% score</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {r.overall_pass && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForecastSourceId(
                              forecastSourceId === r.source_id ? null : r.source_id,
                            );
                          }}
                          className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                            forecastSourceId === r.source_id
                              ? "bg-[#C9A227] text-black"
                              : "border border-[#333] text-[#888] hover:border-[#C9A227] hover:text-[#C9A227]"
                          }`}
                        >
                          {forecastSourceId === r.source_id ? "Hide" : "Forecast"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Arrival Forecast chart (shown below table when source selected) */}
      {selectedAssessment?.results && detailView === "table" && forecastSourceId && forecastData && (
        <div className="mt-4">
          <ArrivalForecastChart
            forecast={forecastData}
            targetCount={selectedAssessment.criteria?.min_patients}
          />
        </div>
      )}

      {/* Impact Analysis view */}
      {selectedAssessment?.results && detailView === "impact" && (
        <CriteriaImpactChart
          impacts={impactData ?? []}
          baselinePassed={selectedAssessment.sources_passed}
          totalSources={selectedAssessment.sources_assessed}
        />
      )}

      {/* CONSORT Flow view */}
      {selectedAssessment?.results && detailView === "consort" && (
        <ConsortDiagram
          results={selectedAssessment.results}
          criteriaLabels={["Domains", "Concepts", "Visit Types", "Date Range", "Patient Count"]}
        />
      )}

      {!assessments || assessments.length === 0 ? (
        <p className="py-10 text-center text-[#555]">
          No assessments yet. Create one to evaluate if your network can support a proposed study.
        </p>
      ) : null}
    </div>
  );
}
