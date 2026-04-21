import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  LayoutDashboard,
  BarChart3,
  Users,
  Sparkles,
  Settings,
  Loader2,
  RefreshCw,
  Copy,
  Trash2,
  Edit3,
  Save,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useSourceStore } from "@/stores/sourceStore";
import {
  useRiskScoreAnalysis,
  useUpdateRiskScoreAnalysis,
  useDeleteRiskScoreAnalysis,
  useExecuteRiskScoreAnalysis,
  useExecutionDetail,
  useRiskScoreCatalogue,
  useCreateRiskScoreAnalysis,
} from "../hooks/useRiskScores";
import { ANALYSIS_STATUS_COLORS } from "../types/riskScore";
import { OverviewTab } from "../components/OverviewTab";
import { ResultsTab } from "../components/ResultsTab";
import { PatientsTab } from "../components/PatientsTab";
import { RecommendationsTab } from "../components/RecommendationsTab";
import { ConfigurationTab } from "../components/ConfigurationTab";
import { CreateCohortModal } from "../components/CreateCohortModal";
import { RiskScoreRunModal } from "../components/RiskScoreRunModal";
import { getRiskScoreStatusLabel } from "../lib/i18n";

type TabKey =
  | "overview"
  | "results"
  | "patients"
  | "recommendations"
  | "configuration";

export default function RiskScoreDetailPage() {
  const { t } = useTranslation("app");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeSourceId, defaultSourceId } = useSourceStore();
  const sourceId = activeSourceId ?? defaultSourceId ?? 0;

  const { data: analysis, isLoading, error } = useRiskScoreAnalysis(
    id ? Number(id) : null,
  );
  const updateMutation = useUpdateRiskScoreAnalysis();
  const deleteMutation = useDeleteRiskScoreAnalysis();
  const executeMutation = useExecuteRiskScoreAnalysis();
  const createMutation = useCreateRiskScoreAnalysis();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [showRunModal, setShowRunModal] = useState(false);
  const [cohortModal, setCohortModal] = useState<{
    scoreId: string;
    tier?: string;
    patientCount: number;
    personIds?: number[];
  } | null>(null);

  const latestExecution = analysis?.executions?.[analysis.executions.length - 1] ?? null;
  const latestExecutionId = latestExecution?.id ?? null;
  const { data: executionDetail } = useExecutionDetail(
    analysis?.id ?? null,
    latestExecutionId,
  );
  const { data: catalogue } = useRiskScoreCatalogue();
  const scoreNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const score of catalogue?.scores ?? []) {
      map[score.score_id] = score.score_name;
    }
    return map;
  }, [catalogue]);

  const uniqueScoreCount = useMemo(() => {
    const ids = new Set(
      (executionDetail?.population_summaries ?? []).map((summary) => summary.score_id),
    );
    return ids.size;
  }, [executionDetail]);

  const tabCounts: Partial<Record<TabKey, number>> = {
    results: uniqueScoreCount > 0 ? uniqueScoreCount : undefined,
  };

  const tabs: Array<{ key: TabKey; icon: typeof Settings; label: string }> = [
    {
      key: "overview",
      icon: LayoutDashboard,
      label: t("riskScores.common.tabs.overview"),
    },
    {
      key: "results",
      icon: BarChart3,
      label: t("riskScores.common.tabs.results"),
    },
    {
      key: "patients",
      icon: Users,
      label: t("riskScores.common.tabs.patients"),
    },
    {
      key: "recommendations",
      icon: Sparkles,
      label: t("riskScores.common.tabs.recommendations"),
    },
    {
      key: "configuration",
      icon: Settings,
      label: t("riskScores.common.tabs.configuration"),
    },
  ];

  const handleCreateCohort = (scoreId: string, tier: string, patientCount: number) => {
    setCohortModal({ scoreId, tier, patientCount });
  };

  const handleCreateCohortFromFilter = (
    scoreId: string,
    tier: string | undefined,
    personIds: number[],
  ) => {
    setCohortModal({ scoreId, tier, patientCount: personIds.length, personIds });
  };

  const handleSaveTitle = () => {
    if (!analysis || !titleDraft.trim()) return;
    updateMutation.mutate(
      { id: analysis.id, payload: { name: titleDraft.trim() } },
      { onSuccess: () => setEditingTitle(false) },
    );
  };

  const handleDuplicate = () => {
    if (!analysis) return;
    createMutation.mutate(
      {
        name: `Copy of ${analysis.name}`,
        description: analysis.description ?? undefined,
        design_json: analysis.design_json,
      },
      {
        onSuccess: (newAnalysis) => navigate(`/risk-scores/${newAnalysis.id}`),
      },
    );
  };

  const handleDelete = () => {
    if (!analysis) return;
    if (window.confirm(t("riskScores.detail.deleteConfirm"))) {
      deleteMutation.mutate(analysis.id, {
        onSuccess: () => navigate("/risk-scores"),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <p className="text-critical">{t("riskScores.detail.notFound")}</p>
          <Link
            to="/risk-scores"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-success hover:underline"
          >
            <ArrowLeft size={14} />
            {t("riskScores.detail.backToRiskScores")}
          </Link>
        </div>
      </div>
    );
  }

  const status = latestExecution?.status ?? "draft";
  const statusColor = ANALYSIS_STATUS_COLORS[status] ?? ANALYSIS_STATUS_COLORS.draft;

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => navigate("/risk-scores")}
          className="btn btn-ghost btn-sm"
        >
          <ArrowLeft size={14} /> {t("riskScores.detail.backToRiskScores")}
        </button>

        {sourceId === 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-5 py-4">
            <p className="text-sm text-accent">
              {t("riskScores.detail.selectSourcePrompt")}
            </p>
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {editingTitle ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(event) => setTitleDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") handleSaveTitle();
                      if (event.key === "Escape") setEditingTitle(false);
                    }}
                    autoFocus
                    className="form-input flex-1 text-lg font-semibold"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    className="btn btn-primary btn-sm"
                    title={t("riskScores.common.actions.close")}
                  >
                    <Save size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTitle(false)}
                    className="btn btn-ghost btn-sm"
                    title={t("riskScores.common.actions.cancel")}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <h1 className="truncate text-xl font-semibold text-text-primary">
                    {analysis.name}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setTitleDraft(analysis.name);
                      setEditingTitle(true);
                    }}
                    className="shrink-0 text-text-ghost hover:text-text-secondary"
                    title={t("riskScores.common.actions.reRun")}
                  >
                    <Edit3 size={14} />
                  </button>
                </>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `${statusColor}15`,
                  color: statusColor,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: statusColor }}
                />
                {getRiskScoreStatusLabel(t, status)}
              </span>

              {analysis.design_json.targetCohortIds.length > 0 && (
                <span className="rounded-md bg-success/10 px-2 py-0.5 text-xs text-success">
                  {t("riskScores.common.count.cohort", {
                    count: analysis.design_json.targetCohortIds.length,
                  })}
                </span>
              )}

              {analysis.design_json.scoreIds.length > 0 && (
                <span className="rounded-md bg-accent/10 px-2 py-0.5 text-xs text-accent">
                  {t("riskScores.common.count.score", {
                    count: analysis.design_json.scoreIds.length,
                  })}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowRunModal(true)}
              disabled={executeMutation.isPending || sourceId === 0}
              className="btn btn-sm flex items-center gap-1.5 border-primary bg-primary text-primary-foreground hover:bg-primary-light disabled:opacity-50"
            >
              <RefreshCw size={14} />
              {t("riskScores.common.actions.reRun")}
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={createMutation.isPending}
              className="btn btn-ghost btn-sm"
              title={t("riskScores.common.actions.duplicateAnalysis")}
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="btn btn-danger btn-sm"
              title={t("riskScores.common.actions.deleteAnalysis")}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="tab-bar overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const count = tabCounts[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "tab-item flex items-center gap-1.5 whitespace-nowrap",
                activeTab === tab.key && "active",
              )}
            >
              <Icon size={14} />
              {tab.label}
              {count != null && (
                <span className="ml-0.5 text-[10px] font-medium text-text-ghost">
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && (
        <OverviewTab
          analysis={analysis}
          latestExecution={latestExecution}
          populationSummaries={executionDetail?.population_summaries ?? []}
          onRunClick={() => setShowRunModal(true)}
          onTabChange={(tab) => setActiveTab(tab as TabKey)}
        />
      )}
      {activeTab === "results" && (
        <ResultsTab
          analysisId={analysis.id}
          executionId={latestExecutionId}
          summaries={executionDetail?.population_summaries ?? []}
          scoreNames={scoreNameMap}
          onCreateCohort={handleCreateCohort}
        />
      )}
      {activeTab === "patients" && (
        <PatientsTab
          analysisId={analysis.id}
          executionId={latestExecutionId}
          scoreIds={analysis.design_json.scoreIds}
          onCreateCohort={handleCreateCohortFromFilter}
        />
      )}
      {activeTab === "recommendations" && (
        <RecommendationsTab analysis={analysis} sourceId={sourceId} />
      )}
      {activeTab === "configuration" && (
        <ConfigurationTab
          analysis={analysis}
          onReRun={() => setShowRunModal(true)}
        />
      )}

      {cohortModal && analysis && latestExecutionId && (
        <CreateCohortModal
          analysisId={analysis.id}
          executionId={latestExecutionId}
          scoreId={cohortModal.scoreId}
          scoreName={scoreNameMap[cohortModal.scoreId] ?? cohortModal.scoreId}
          cohortName={analysis.name}
          riskTier={cohortModal.tier}
          patientCount={cohortModal.patientCount}
          personIds={cohortModal.personIds}
          onClose={() => setCohortModal(null)}
          onCreated={() => {
            setCohortModal(null);
          }}
        />
      )}

      {showRunModal && (
        <RiskScoreRunModal
          sourceId={sourceId}
          scoreIds={analysis.design_json.scoreIds}
          onClose={() => setShowRunModal(false)}
        />
      )}
    </div>
  );
}
