import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Plus,
  X,
  Play,
  ChevronDown,
  ChevronRight,
  BarChart3,
  TrendingUp,
  GitBranch,
  Scale,
  Brain,
  Clock,
  ExternalLink,
  Database,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ExecutionStatusBadge } from "@/features/analyses/components/ExecutionStatusBadge";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import {
  useStudyAnalyses,
  useAddStudyAnalysis,
  useRemoveStudyAnalysis,
  useExecuteAllStudyAnalyses,
  useStudyProgress,
} from "../hooks/useStudies";
import { useCharacterizations } from "@/features/analyses/hooks/useCharacterizations";
import { useIncidenceRates } from "@/features/analyses/hooks/useIncidenceRates";
import { usePathways } from "@/features/pathways/hooks/usePathways";
import { useEstimations } from "@/features/estimation/hooks/useEstimations";
import { usePredictions } from "@/features/prediction/hooks/usePredictions";
import type { StudyAnalysisEntry } from "../types/study";
import type { ExecutionStatus } from "@/features/analyses/types/analysis";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANALYSIS_TYPE_META: Record<string, { label: string; icon: typeof BarChart3; color: string; detailPath: string }> = {
  characterization: { label: "Characterization", icon: BarChart3, color: "#2DD4BF", detailPath: "/analyses/characterizations" },
  "incidence-rate": { label: "Incidence Rate", icon: TrendingUp, color: "#60A5FA", detailPath: "/analyses/incidence-rates" },
  incidence_rate: { label: "Incidence Rate", icon: TrendingUp, color: "#60A5FA", detailPath: "/analyses/incidence-rates" },
  pathway: { label: "Pathway", icon: GitBranch, color: "#A78BFA", detailPath: "/analyses/pathways" },
  estimation: { label: "Estimation", icon: Scale, color: "#F59E0B", detailPath: "/analyses/estimations" },
  prediction: { label: "Prediction", icon: Brain, color: "#E85A6B", detailPath: "/analyses/predictions" },
};

const ADD_ANALYSIS_TYPES = [
  { value: "characterization", label: "Characterization" },
  { value: "incidence_rate", label: "Incidence Rate" },
  { value: "pathway", label: "Pathway" },
  { value: "estimation", label: "Estimation" },
  { value: "prediction", label: "Prediction" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StudyAnalysesTabProps {
  studyId: number;
  studySlug: string;
}

export function StudyAnalysesTab({ studyId, studySlug }: StudyAnalysesTabProps) {
  const navigate = useNavigate();
  const { data: analyses, isLoading } = useStudyAnalyses(studyId);
  const { data: progress } = useStudyProgress(studyId);
  const addMutation = useAddStudyAnalysis();
  const removeMutation = useRemoveStudyAnalysis();
  const executeMutation = useExecuteAllStudyAnalyses();

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addType, setAddType] = useState("characterization");
  const [addId, setAddId] = useState<number | null>(null);
  const [sourceId, setSourceId] = useState<number | null>(null);

  // Fetch available analyses for the add panel
  const { data: charData } = useCharacterizations(1);
  const { data: irData } = useIncidenceRates(1);
  const { data: pathwayData } = usePathways(1);
  const { data: estData } = useEstimations(1);
  const { data: predData } = usePredictions(1);
  const { data: sources } = useQuery({ queryKey: ["sources"], queryFn: fetchSources });

  const getAnalysisOptions = () => {
    switch (addType) {
      case "characterization": return charData?.data?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "incidence_rate": return irData?.data?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "pathway": return pathwayData?.data?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "estimation": return estData?.data?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "prediction": return predData?.data?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      default: return [];
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    if (!addId) return;
    // Map frontend type name to backend expected format
    const backendType = addType === "incidence_rate" ? "incidence_rate" : addType;
    addMutation.mutate(
      { studyId, payload: { analysis_type: backendType, analysis_id: addId } },
      { onSuccess: () => { setAddId(null); setShowAddPanel(false); } },
    );
  };

  const handleExecuteAll = () => {
    if (!sourceId) return;
    executeMutation.mutate({ studyId, sourceId });
  };

  const isRunning = progress?.overall_status === "running" || progress?.overall_status === "pending";

  // Group analyses by type
  const grouped = (analyses ?? []).reduce<Record<string, StudyAnalysisEntry[]>>((acc, entry) => {
    const key = entry.analysis_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#8A857D]" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#C5C0B8]">
            Analysis Pipeline ({analyses?.length ?? 0})
          </h3>
          {progress && progress.total > 0 && (
            <div className="flex items-center gap-3 mt-1 text-xs text-[#5A5650]">
              <span className="text-[#34D399]">{progress.completed} completed</span>
              <span className="text-[#F59E0B]">{progress.running} running</span>
              <span className="text-[#E85A6B]">{progress.failed} failed</span>
              <span>{progress.pending} pending</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Source selector + Execute */}
          <div className="relative">
            <Database size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5A5650]" />
            <select
              value={sourceId ?? ""}
              onChange={(e) => setSourceId(Number(e.target.value) || null)}
              className="form-input form-select py-1.5 pl-7 text-xs"
              style={{ minWidth: "140px" }}
            >
              <option value="">Select source...</option>
              {sources?.map((s) => <option key={s.id} value={s.id}>{s.source_name}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={handleExecuteAll}
            disabled={!sourceId || executeMutation.isPending || isRunning || !analyses?.length}
            className="btn btn-primary btn-sm"
          >
            {executeMutation.isPending || isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Execute All
          </button>
          <button type="button" onClick={() => setShowAddPanel(!showAddPanel)} className="btn btn-ghost btn-sm">
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {progress && progress.total > 0 && (
        <div className="progress-bar">
          <div className="flex h-full">
            {progress.completed > 0 && <div style={{ width: `${(progress.completed / progress.total) * 100}%`, background: "#34D399" }} />}
            {progress.running > 0 && <div style={{ width: `${(progress.running / progress.total) * 100}%`, background: "#F59E0B" }} />}
            {progress.failed > 0 && <div style={{ width: `${(progress.failed / progress.total) * 100}%`, background: "#E85A6B" }} />}
          </div>
        </div>
      )}

      {/* Add Analysis Panel */}
      {showAddPanel && (
        <div className="panel">
          <h4 className="text-sm font-semibold text-[#C5C0B8] mb-3">Add Analysis to Study</h4>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="form-label">Analysis Type</label>
              <select
                value={addType}
                onChange={(e) => { setAddType(e.target.value); setAddId(null); }}
                className="form-input form-select"
              >
                {ADD_ANALYSIS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="form-label">Analysis</label>
              <select
                value={addId ?? ""}
                onChange={(e) => setAddId(Number(e.target.value) || null)}
                className="form-input form-select"
              >
                <option value="">Select analysis...</option>
                {getAnalysisOptions().map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!addId || addMutation.isPending}
              className="btn btn-primary btn-sm"
            >
              {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </button>
            <button type="button" onClick={() => setShowAddPanel(false)} className="btn btn-ghost btn-sm">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Analysis Cards grouped by type */}
      {(!analyses || analyses.length === 0) ? (
        <div className="empty-state">
          <BarChart3 size={24} className="text-[#323238] mb-2" />
          <h3 className="empty-title">No analyses in this study</h3>
          <p className="empty-message">Add characterizations, estimations, predictions, and more to build your analysis pipeline</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, entries]) => {
            const meta = ANALYSIS_TYPE_META[type] ?? {
              label: type.replace(/_/g, " "),
              icon: BarChart3,
              color: "#8A857D",
              detailPath: "/analyses",
            };
            const Icon = meta.icon;

            return (
              <div key={type}>
                {/* Type header */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} style={{ color: meta.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                    {meta.label} ({entries.length})
                  </span>
                </div>

                {/* Analysis cards */}
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const expanded = expandedIds.has(entry.id);
                    const latestExec = entry.analysis?.latest_execution;

                    return (
                      <div key={entry.id} className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
                        {/* Card header */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#1C1C20] transition-colors"
                          onClick={() => toggleExpand(entry.id)}
                        >
                          <button type="button" className="text-[#5A5650]">
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#F0EDE8] font-medium truncate">
                              {entry.analysis?.name ?? `Analysis #${entry.analysis_id}`}
                            </p>
                          </div>

                          {/* Execution status */}
                          <div className="flex items-center gap-2 shrink-0">
                            {latestExec ? (
                              <ExecutionStatusBadge status={latestExec.status as ExecutionStatus} />
                            ) : (
                              <span className="text-[10px] text-[#5A5650] flex items-center gap-1">
                                <Clock size={10} /> Not executed
                              </span>
                            )}
                          </div>

                          {/* Actions (stop propagation to prevent expand toggle) */}
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => navigate(`${meta.detailPath}/${entry.analysis_id}`)}
                              className="p-1.5 text-[#5A5650] hover:text-[#2DD4BF] transition-colors"
                              title="Open analysis detail"
                            >
                              <ExternalLink size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm("Remove this analysis from the study?")) {
                                  removeMutation.mutate({ studyId, entryId: entry.id });
                                }
                              }}
                              disabled={removeMutation.isPending}
                              className="p-1.5 text-[#5A5650] hover:text-[#E85A6B] transition-colors"
                              title="Remove from study"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {expanded && (
                          <div className="border-t border-[#232328] px-4 py-3 bg-[#0E0E11]">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-[#5A5650] uppercase tracking-wider">Type</span>
                                <p className="text-[#C5C0B8] mt-0.5 capitalize">{meta.label}</p>
                              </div>
                              <div>
                                <span className="text-[#5A5650] uppercase tracking-wider">Analysis ID</span>
                                <p className="text-[#C5C0B8] mt-0.5 font-['IBM_Plex_Mono',monospace]">{entry.analysis_id}</p>
                              </div>
                              {latestExec && (
                                <>
                                  <div>
                                    <span className="text-[#5A5650] uppercase tracking-wider">Last Run</span>
                                    <p className="text-[#C5C0B8] mt-0.5">
                                      {latestExec.started_at ? new Date(latestExec.started_at).toLocaleString() : "—"}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-[#5A5650] uppercase tracking-wider">Completed</span>
                                    <p className="text-[#C5C0B8] mt-0.5">
                                      {latestExec.completed_at ? new Date(latestExec.completed_at).toLocaleString() : "—"}
                                    </p>
                                  </div>
                                  {latestExec.fail_message && (
                                    <div className="col-span-2">
                                      <span className="text-[#5A5650] uppercase tracking-wider">Error</span>
                                      <p className="text-[#E85A6B] mt-0.5 font-mono text-[11px]">{latestExec.fail_message}</p>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="mt-3 flex justify-end">
                              <button
                                type="button"
                                onClick={() => navigate(`${meta.detailPath}/${entry.analysis_id}`)}
                                className="btn btn-ghost btn-sm text-xs"
                              >
                                <ExternalLink size={12} /> View Full Detail
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
