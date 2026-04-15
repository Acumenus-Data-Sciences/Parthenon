import { useMyReports } from "../hooks/useMyReports";
import { RunStatusBadge } from "@/features/_finngen-foundation";
import apiClient from "@/lib/api-client";

export function MyReportsTab({
  onOpenReport,
}: {
  onOpenReport: (runId: string) => void;
}) {
  const { data, isLoading, error } = useMyReports();

  if (isLoading) return <div className="text-slate-400">Loading reports...</div>;
  if (error) return <div className="text-rose-300">Failed to load. {(error as Error).message}</div>;
  if (!data?.data?.length) {
    return (
      <div className="text-slate-400">
        You have no reports yet. Go to the Report tab and generate one.
      </div>
    );
  }

  const togglePin = async (runId: string, pinned: boolean) => {
    if (pinned) await apiClient.delete(`/finngen/runs/${runId}/pin`);
    else await apiClient.post(`/finngen/runs/${runId}/pin`);
  };

  return (
    <div className="max-h-[600px] overflow-auto rounded border border-slate-700">
      <table className="min-w-full divide-y divide-slate-700 text-sm">
        <thead className="bg-slate-900 text-left text-xs font-medium uppercase text-slate-400">
          <tr>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2">Concept</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Pin</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {data.data.map((run) => {
            const conceptId = (run.params?.concept_id as number | undefined) ?? null;
            return (
              <tr key={run.id} className="cursor-pointer hover:bg-slate-900/50" onClick={() => onOpenReport(run.id)}>
                <td className="px-3 py-2 text-slate-400">{new Date(run.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-slate-100">{run.source_key}</td>
                <td className="px-3 py-2 font-mono text-xs text-cyan-300">{conceptId ?? "—"}</td>
                <td className="px-3 py-2">
                  <RunStatusBadge status={run.status} />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      void togglePin(run.id, run.pinned);
                    }}
                  >
                    {run.pinned ? "📌 Unpin" : "Pin"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
