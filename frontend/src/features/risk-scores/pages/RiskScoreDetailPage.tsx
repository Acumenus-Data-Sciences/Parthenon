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

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabKey = "overview" | "results" | "patients" | "recommendations" | "configuration";

const TABS: { key: TabKey; label: string; icon: typeof Settings }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "results", label: "Results", icon: BarChart3 },
  { key: "patients", label: "Patients", icon: Users },
  { key: "recommendations", label: "Recommendations", icon: Sparkles },
  { key: "configuration", label: "Configuration", icon: Settings },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RiskScoreDetailPage() {
  const { scoreId: id } = useParams<{ scoreId: string }>();
  const navigate = useNavigate();
  const { activeSourceId, defaultSourceId } = useSourceStore();
  const sourceId = activeSourceId ?? defaultSourceId ?? 0;

  const { data: analysis, isLoading, error } = useRiskScoreAnalysis(id ? Number(id) : null);
  const updateMutation = useUpdateRiskScoreAnalysis();
  const deleteMutation = useDeleteRiskScoreAnalysis();
  const executeMutation = useExecuteRiskScoreAnalysis();
  const createMutation = useCreateRiskScoreAnalysis();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [showRunModal, setShowRunModal] = useState(false);

  // Latest execution
  const latestExecution = analysis?.executions?.[analysis.executions.length - 1] ?? null;
  const latestExecutionId = latestExecution?.id ?? null;

  // Execution detail (for population summaries)
  const { data: executionDetail } = useExecutionDetail(
    analysis?.id ?? null,
    latestExecutionId,
  );

  // Score name lookup from catalogue
  const { data: catalogue } = useRiskScoreCatalogue();
  const scoreNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of catalogue?.scores ?? []) {
      map[s.score_id] = s.score_name;
    }
    return map;
  }, [catalogue]);

  // Tab badge counts
  const uniqueScoreCount = useMemo(() => {
    const ids = new Set(
      (executionDetail?.population_summaries ?? []).map((s) => s.score_id),
    );
    return ids.size;
  }, [executionDetail]);

  const tabCounts: Partial<Record<TabKey, number>> = {
    results: uniqueScoreCount > 0 ? uniqueScoreCount : undefined,
  };

  // Create cohort state
  const [cohortModal, setCohortModal] = useState<{
    scoreId: string;
    tier?: string;
    patientCount: number;
    personIds?: number[];
  } | null>(null);

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

  // Title editing
  const handleSaveTitle = () => {
    if (!analysis || !titleDraft.trim()) return;
    updateMutation.mutate(
      { id: analysis.id, payload: { name: titleDraft.trim() } },
      { onSuccess: () => setEditingTitle(false) },
    );
  };

  // Duplicate
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

  // Delete
  const handleDelete = () => {
    if (!analysis) return;
    if (window.confirm("Are you sure you want to delete this analysis? This action cannot be undone.")) {
      deleteMutation.mutate(analysis.id, {
        onSuccess: () => navigate("/risk-scores"),
      });
    }
  };

  // Derived status
  const status = latestExecution?.status ?? "draft";
  const statusColor = ANALYSIS_STATUS_COLORS[status] ?? ANALYSIS_STATUS_COLORS.draft;

  // ── Loading ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  // ── Error / Not Found ──────────────────────────────────────────────
  if (error || !analysis) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-[#E85A6B]">Analysis not found</p>
          <Link
            to="/risk-scores"
            className="inline-flex items-center gap-1.5 text-sm text-[#2DD4BF] hover:underline mt-4"
          >
            <ArrowLeft size={14} />
            Back to Risk Scores
          </Link>
        </div>
      </div>
    );
  }

  // ── No source warning ──────────────────────────────────────────────
  const noSourceBanner = sourceId === 0 && (
    <div className="flex items-center gap-3 rounded-xl border border-[#C9A227]/20 bg-[#C9A227]/5 px-5 py-4">
      <p className="text-sm text-[#C9A227]">
        Select a data source to run or view execution results.
      </p>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => navigate("/risk-scores")}
          className="btn btn-ghost btn-sm"
        >
          <ArrowLeft size={14} /> Risk Scores
        </button>

        {noSourceBanner}

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Title (inline editable) */}
            <div className="flex items-center gap-2">
              {editingTitle ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle();
                      if (e.key === "Escape") setEditingTitle(false);
                    }}
                    autoFocus
                    className="form-input text-lg font-semibold flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleSaveTitle}
                    className="btn btn-primary btn-sm"
                  >
                    <Save size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTitle(false)}
                    className="btn btn-ghost btn-sm"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-semibold text-[#F0EDE8] truncate">
                    {analysis.name}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setTitleDraft(analysis.name);
                      setEditingTitle(true);
                    }}
                    className="text-[#5A5650] hover:text-[#C5C0B8] shrink-0"
                  >
                    <Edit3 size={14} />
                  </button>
                </>
              )}
            </div>

            {/* Badges row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {/* Status badge */}
              <span
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium"
                style={{
                  backgroundColor: `${statusColor}15`,
                  color: statusColor,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: statusColor }}
                />
                {status}
              </span>

              {/* Target cohort count */}
              {analysis.design_json.targetCohortIds.length > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-[#2DD4BF]/10 text-xs text-[#2DD4BF]">
                  {analysis.design_json.targetCohortIds.length} cohort
                  {analysis.design_json.targetCohortIds.length !== 1 ? "s" : ""}
                </span>
              )}

              {/* Score count */}
              {analysis.design_json.scoreIds.length > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-[#C9A227]/10 text-xs text-[#C9A227]">
                  {analysis.design_json.scoreIds.length} score
                  {analysis.design_json.scoreIds.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowRunModal(true)}
              disabled={executeMutation.isPending || sourceId === 0}
              className="btn btn-sm flex items-center gap-1.5 bg-[#9B1B30] text-white hover:bg-[#B42240] border-[#9B1B30] disabled:opacity-50"
            >
              <RefreshCw size={14} />
              Re-run
            </button>
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={createMutation.isPending}
              className="btn btn-ghost btn-sm"
              title="Duplicate analysis"
            >
              <Copy size={14} />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="btn btn-danger btn-sm"
              title="Delete analysis"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="tab-bar overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {TABS.map((tab) => {
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
                <span className="ml-0.5 text-[10px] font-medium text-[#5A5650]">
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && analysis && (
        <OverviewTab
          analysis={analysis}
          latestExecution={latestExecution}
          populationSummaries={executionDetail?.population_summaries ?? []}
          onRunClick={() => setShowRunModal(true)}
          onTabChange={(tab) => setActiveTab(tab as TabKey)}
        />
      )}
      {activeTab === "results" && analysis && (
        <ResultsTab
          analysisId={analysis.id}
          executionId={latestExecutionId}
          summaries={executionDetail?.population_summaries ?? []}
          scoreNames={scoreNameMap}
          onCreateCohort={handleCreateCohort}
        />
      )}
      {activeTab === "patients" && analysis && (
        <PatientsTab
          analysisId={analysis.id}
          executionId={latestExecutionId}
          scoreIds={analysis.design_json.scoreIds}
          onCreateCohort={handleCreateCohortFromFilter}
        />
      )}
      {activeTab === "recommendations" && analysis && (
        <RecommendationsTab
          analysis={analysis}
          sourceId={sourceId}
        />
      )}
      {activeTab === "configuration" && analysis && (
        <ConfigurationTab
          analysis={analysis}
          onReRun={() => setShowRunModal(true)}
        />
      )}

      {/* Create Cohort Modal */}
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

      {/* Run Modal */}
      {showRunModal && analysis && (
        <RiskScoreRunModal
          sourceId={sourceId}
          scoreIds={analysis.design_json.scoreIds}
          onClose={() => {
            setShowRunModal(false);
          }}
        />
      )}
    </div>
  );
}
