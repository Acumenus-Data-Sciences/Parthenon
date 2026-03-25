import { useState } from "react";
import { useFeasibilityAssessment, useFeasibilityList, useRunFeasibility } from "../../../hooks/useNetworkData";
import FeasibilityForm from "./FeasibilityForm";
import type { FeasibilityAssessment, FeasibilityResult } from "../../../types/ares";

function PassBadge({ pass }: { pass: boolean }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
        pass ? "bg-[#2DD4BF]/20 text-[#2DD4BF]" : "bg-[#9B1B30]/20 text-[#e85d75]"
      }`}
    >
      {pass ? "PASS" : "FAIL"}
    </span>
  );
}

export default function FeasibilityView() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: assessments } = useFeasibilityList();
  const { data: selectedAssessment } = useFeasibilityAssessment(selectedId);
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
              onClick={() => setSelectedId(a.id)}
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

      {/* Assessment results detail */}
      {selectedAssessment?.results && (
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
                  <th className="px-3 py-2 text-center text-[11px] font-medium uppercase text-[#888]">Overall</th>
                </tr>
              </thead>
              <tbody>
                {selectedAssessment.results.map((r: FeasibilityResult) => (
                  <tr key={r.id} className="border-b border-[#1a1a22] hover:bg-[#1a1a22]">
                    <td className="px-3 py-2 text-white">{r.source_name}</td>
                    <td className="px-3 py-2 text-center"><PassBadge pass={r.domain_pass} /></td>
                    <td className="px-3 py-2 text-center"><PassBadge pass={r.concept_pass} /></td>
                    <td className="px-3 py-2 text-center"><PassBadge pass={r.visit_pass} /></td>
                    <td className="px-3 py-2 text-center"><PassBadge pass={r.date_pass} /></td>
                    <td className="px-3 py-2 text-center"><PassBadge pass={r.patient_pass} /></td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          r.overall_pass
                            ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
                            : "bg-[#9B1B30]/20 text-[#e85d75]"
                        }`}
                      >
                        {r.overall_pass ? "ELIGIBLE" : "INELIGIBLE"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!assessments || assessments.length === 0 ? (
        <p className="py-10 text-center text-[#555]">
          No assessments yet. Create one to evaluate if your network can support a proposed study.
        </p>
      ) : null}
    </div>
  );
}
