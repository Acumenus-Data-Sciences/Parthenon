import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, Play, Trash2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useEvidenceSynthesisAnalysis,
  useDeleteEvidenceSynthesis,
  useExecuteEvidenceSynthesis,
  useEvidenceSynthesisExecution,
} from "../hooks/useEvidenceSynthesis";
import { EvidenceSynthesisDesigner } from "../components/EvidenceSynthesisDesigner";
import { EvidenceSynthesisResults } from "../components/EvidenceSynthesisResults";

export default function EvidenceSynthesisDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const analysisId = id === "new" ? null : Number(id);
  const isNew = id === "new";

  const { data: analysis, isLoading } = useEvidenceSynthesisAnalysis(analysisId);
  const deleteMutation = useDeleteEvidenceSynthesis();
  const executeMutation = useExecuteEvidenceSynthesis();

  const [activeTab, setActiveTab] = useState<"design" | "results">("design");
  const [selectedExecutionId, setSelectedExecutionId] = useState<number | null>(null);

  // Auto-select latest completed execution
  useEffect(() => {
    if (analysis?.executions?.length) {
      const completed = analysis.executions.find((e) => e.status === "completed");
      const latest = completed ?? analysis.executions[0];
      setSelectedExecutionId(latest?.id ?? null);
    }
  }, [analysis?.executions]);

  const { data: execution, isLoading: loadingExecution } = useEvidenceSynthesisExecution(
    analysisId,
    selectedExecutionId,
  );

  const handleDelete = () => {
    if (!analysisId) return;
    deleteMutation.mutate(analysisId, {
      onSuccess: () => navigate("/analyses"),
    });
  };

  const handleExecute = () => {
    if (!analysisId) return;
    executeMutation.mutate(analysisId, {
      onSuccess: (exec) => {
        setSelectedExecutionId(exec.id);
        setActiveTab("results");
      },
    });
  };

  if (isLoading && !isNew) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/analyses")}
            className="text-[#8A857D] hover:text-[#F0EDE8] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-[#F0EDE8]">
              {isNew ? "New Evidence Synthesis" : analysis?.name ?? "Evidence Synthesis"}
            </h1>
            <p className="text-xs text-[#5A5650]">
              Cross-Database Meta-Analysis
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              <button
                onClick={handleExecute}
                disabled={executeMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] hover:bg-[#26B8A5] disabled:opacity-50 transition-colors"
              >
                {executeMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Play size={14} />
                )}
                Execute
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E85A6B]/30 px-3 py-2 text-sm text-[#E85A6B] hover:bg-[#E85A6B]/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      {!isNew && (
        <div className="flex gap-1 border-b border-[#232328]">
          {(["design", "results"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
                activeTab === tab
                  ? "border-[#2DD4BF] text-[#2DD4BF]"
                  : "border-transparent text-[#8A857D] hover:text-[#C5C0B8]",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {(activeTab === "design" || isNew) && (
        <EvidenceSynthesisDesigner
          analysis={analysis}
          isNew={isNew}
          onSaved={(a) => {
            if (isNew) navigate(`/analyses/evidence-synthesis/${a.id}`);
          }}
        />
      )}

      {activeTab === "results" && !isNew && (
        <EvidenceSynthesisResults execution={execution ?? null} isLoading={loadingExecution} />
      )}

      {/* Execution History */}
      {!isNew && analysis?.executions && analysis.executions.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
          <div className="p-4 border-b border-[#232328]">
            <h3 className="text-sm font-semibold text-[#F0EDE8]">Execution History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#232328]">
                  {["ID", "Status", "Started", "Completed"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-[#8A857D]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {analysis.executions.map((exec) => (
                  <tr
                    key={exec.id}
                    onClick={() => {
                      setSelectedExecutionId(exec.id);
                      setActiveTab("results");
                    }}
                    className={cn(
                      "border-b border-[#232328] last:border-0 cursor-pointer hover:bg-[#1A1A1E] transition-colors",
                      selectedExecutionId === exec.id && "bg-[#2DD4BF]/5",
                    )}
                  >
                    <td className="px-4 py-2 text-[#F0EDE8]">#{exec.id}</td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        exec.status === "completed" && "bg-emerald-500/10 text-emerald-400",
                        exec.status === "failed" && "bg-[#E85A6B]/10 text-[#E85A6B]",
                        exec.status === "running" && "bg-[#C9A227]/10 text-[#C9A227]",
                        (exec.status === "queued" || exec.status === "pending") && "bg-[#8A857D]/10 text-[#8A857D]",
                      )}>
                        {exec.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-[#8A857D]">{exec.started_at ? new Date(exec.started_at).toLocaleString() : "-"}</td>
                    <td className="px-4 py-2 text-[#8A857D]">{exec.completed_at ? new Date(exec.completed_at).toLocaleString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
