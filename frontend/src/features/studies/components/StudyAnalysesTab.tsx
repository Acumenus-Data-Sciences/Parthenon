import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { formatDateTime } from "@/i18n/format";
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

const ANALYSIS_TYPE_META: Record<string, { i18nKey: string; icon: typeof BarChart3; color: string; detailPath: string }> = {
  characterization: { i18nKey: "characterization", icon: BarChart3, color: "var(--success)", detailPath: "/analyses/characterizations" },
  "incidence-rate": { i18nKey: "incidence-rate", icon: TrendingUp, color: "var(--info)", detailPath: "/analyses/incidence-rates" },
  incidence_rate: { i18nKey: "incidence-rate", icon: TrendingUp, color: "var(--info)", detailPath: "/analyses/incidence-rates" },
  pathway: { i18nKey: "pathway", icon: GitBranch, color: "var(--domain-observation)", detailPath: "/analyses/pathways" },
  estimation: { i18nKey: "estimation", icon: Scale, color: "var(--warning)", detailPath: "/analyses/estimations" },
  prediction: { i18nKey: "prediction", icon: Brain, color: "var(--critical)", detailPath: "/analyses/predictions" },
};

const ADD_ANALYSIS_TYPES = [
  "characterization",
  "incidence_rate",
  "pathway",
  "estimation",
  "prediction",
];

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StudyAnalysesTabProps {
  studyId: number;
  studySlug: string;
}

export function StudyAnalysesTab({ studySlug }: StudyAnalysesTabProps) {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const slug = studySlug;
  const { data: analyses, isLoading } = useStudyAnalyses(slug);
  const { data: progress } = useStudyProgress(slug);
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
      case "characterization": return charData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "incidence_rate": return irData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "pathway": return pathwayData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "estimation": return estData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      case "prediction": return predData?.items?.map((a) => ({ id: a.id, name: a.name })) ?? [];
      default: return [];
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAdd = () => {
    if (!addId) return;
    // Map frontend type name to backend expected format
    const backendType = addType === "incidence_rate" ? "incidence_rate" : addType;
    addMutation.mutate(
      { slug, payload: { analysis_type: backendType, analysis_id: addId } },
      { onSuccess: () => { setAddId(null); setShowAddPanel(false); } },
    );
  };

  const handleExecuteAll = () => {
    if (!sourceId) return;
    executeMutation.mutate({ slug, sourceId });
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
    return <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-text-muted" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-secondary">
            {t("studies.detail.sections.analysisPipeline", { count: analyses?.length ?? 0 })}
          </h3>
          {progress && progress.total > 0 && (
            <div className="flex items-center gap-3 mt-1 text-xs text-text-ghost">
              <span className="text-success">{t("studies.detail.progress.completed", { count: progress.completed })}</span>
              <span className="text-warning">{t("studies.detail.progress.running", { count: progress.running })}</span>
              <span className="text-critical">{t("studies.detail.progress.failed", { count: progress.failed })}</span>
              <span>{t("studies.detail.progress.pending", { count: progress.pending })}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Source selector + Execute */}
          <div className="relative">
            <Database size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-ghost" />
            <select
              value={sourceId ?? ""}
              onChange={(e) => setSourceId(Number(e.target.value) || null)}
              className="form-input form-select py-1.5 pl-7 text-xs"
              style={{ minWidth: "140px" }}
            >
              <option value="">{t("studies.analyses.selectSource")}</option>
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
            {t("studies.analyses.executeAll")}
          </button>
          <button type="button" onClick={() => setShowAddPanel(!showAddPanel)} className="btn btn-ghost btn-sm">
            <Plus size={14} /> {t("studies.designer.actions.add")}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {progress && progress.total > 0 && (
        <div className="progress-bar">
          <div className="flex h-full">
            {progress.completed > 0 && <div style={{ width: `${(progress.completed / progress.total) * 100}%`, background: "var(--success)" }} />}
            {progress.running > 0 && <div style={{ width: `${(progress.running / progress.total) * 100}%`, background: "var(--warning)" }} />}
            {progress.failed > 0 && <div style={{ width: `${(progress.failed / progress.total) * 100}%`, background: "var(--critical)" }} />}
          </div>
        </div>
      )}

      {/* Add Analysis Panel */}
      {showAddPanel && (
        <div className="panel">
          <h4 className="text-sm font-semibold text-text-secondary mb-3">
            {t("studies.analyses.addAnalysisToStudy")}
          </h4>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="form-label">{t("studies.designer.labels.analysisType")}</label>
              <select
                value={addType}
                onChange={(e) => { setAddType(e.target.value); setAddId(null); }}
                className="form-input form-select"
              >
                {ADD_ANALYSIS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`studies.designer.analysisTypes.${type === "incidence_rate" ? "incidence-rate" : type}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="form-label">{t("studies.designer.labels.analysis")}</label>
              <select
                value={addId ?? ""}
                onChange={(e) => setAddId(Number(e.target.value) || null)}
                className="form-input form-select"
              >
                <option value="">{t("studies.designer.placeholders.selectAnalysis")}</option>
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
              {t("studies.designer.actions.add")}
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
          <BarChart3 size={24} className="text-text-ghost mb-2" />
          <h3 className="empty-title">{t("studies.dashboard.empty.title")}</h3>
          <p className="empty-message">{t("studies.analyses.emptyMessage")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, entries]) => {
            const meta = ANALYSIS_TYPE_META[type] ?? {
              i18nKey: "",
              icon: BarChart3,
              color: "var(--text-muted)",
              detailPath: "/analyses",
            };
            const Icon = meta.icon;
            const analysisTypeLabel = meta.i18nKey
              ? t(`studies.designer.analysisTypes.${meta.i18nKey}`)
              : humanize(type);

            return (
              <div key={type}>
                {/* Type header */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} style={{ color: meta.color }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                    {t("studies.analyses.groupHeader", { label: analysisTypeLabel, count: entries.length })}
                  </span>
                </div>

                {/* Analysis cards */}
                <div className="space-y-2">
                  {entries.map((entry) => {
                    const expanded = expandedIds.has(entry.id);
                    const latestExec = entry.analysis?.latest_execution;

                    return (
                      <div key={entry.id} className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
                        {/* Card header */}
                        <div
                          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-overlay transition-colors"
                          onClick={() => toggleExpand(entry.id)}
                        >
                          <button type="button" className="text-text-ghost">
                            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-primary font-medium truncate">
                              {entry.analysis?.name ?? t("studies.designer.messages.analysisFallback", { id: entry.analysis_id })}
                            </p>
                          </div>

                          {/* Execution status */}
                          <div className="flex items-center gap-2 shrink-0">
                            {latestExec ? (
                              <ExecutionStatusBadge status={latestExec.status as ExecutionStatus} />
                            ) : (
                              <span className="text-[10px] text-text-ghost flex items-center gap-1">
                                <Clock size={10} /> {t("studies.dashboard.messages.notExecuted")}
                              </span>
                            )}
                          </div>

                          {/* Actions (stop propagation to prevent expand toggle) */}
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => navigate(`${meta.detailPath}/${entry.analysis_id}`)}
                              className="p-1.5 text-text-ghost hover:text-success transition-colors"
                              title={t("studies.analyses.openAnalysisDetail")}
                            >
                              <ExternalLink size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(t("studies.analyses.confirmRemove"))) {
                                  removeMutation.mutate({ slug, entryId: entry.id });
                                }
                              }}
                              disabled={removeMutation.isPending}
                              className="p-1.5 text-text-ghost hover:text-critical transition-colors"
                              title={t("studies.analyses.removeFromStudy")}
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {expanded && (
                          <div className="border-t border-border-default px-4 py-3 bg-surface-base">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-text-ghost uppercase tracking-wider">{t("studies.dashboard.table.type")}</span>
                                <p className="text-text-secondary mt-0.5 capitalize">{analysisTypeLabel}</p>
                              </div>
                              <div>
                                <span className="text-text-ghost uppercase tracking-wider">{t("studies.analyses.analysisId")}</span>
                                <p className="text-text-secondary mt-0.5 font-['IBM_Plex_Mono',monospace]">{entry.analysis_id}</p>
                              </div>
                              {latestExec && (
                                <>
                                  <div>
                                    <span className="text-text-ghost uppercase tracking-wider">{t("studies.analyses.lastRun")}</span>
                                    <p className="text-text-secondary mt-0.5">
                                      {latestExec.started_at ? formatDateTime(latestExec.started_at) : "—"}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-text-ghost uppercase tracking-wider">{t("studies.dashboard.stats.completed")}</span>
                                    <p className="text-text-secondary mt-0.5">
                                      {latestExec.completed_at ? formatDateTime(latestExec.completed_at) : "—"}
                                    </p>
                                  </div>
                                  {latestExec.fail_message && (
                                    <div className="col-span-2">
                                      <span className="text-text-ghost uppercase tracking-wider">{t("studies.analyses.error")}</span>
                                      <p className="text-critical mt-0.5 font-mono text-[11px]">{latestExec.fail_message}</p>
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
                                <ExternalLink size={12} /> {t("studies.analyses.viewFullDetail")}
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
