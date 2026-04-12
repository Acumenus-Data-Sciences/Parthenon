import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Settings,
  ClipboardCheck,
  Play,
  Loader2,
  CheckCircle2,
  Sparkles,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import apiClient from "@/lib/api-client";
import { useSourceStore } from "@/stores/sourceStore";
import {
  useCreateRiskScoreAnalysis,
  useExecuteRiskScoreAnalysis,
  useRecommendScores,
} from "../hooks/useRiskScores";
import type {
  RiskScoreAnalysisCreatePayload,
  ScoreRecommendation,
} from "../types/riskScore";
import { CohortProfilePanel } from "../components/CohortProfilePanel";
import { ScoreRecommendationCard } from "../components/ScoreRecommendationCard";
import { RiskScoreRunModal } from "../components/RiskScoreRunModal";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { key: "configure", label: "Configure", icon: Settings },
  { key: "review", label: "Review & Run", icon: ClipboardCheck },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupRecommendations(recommendations: ScoreRecommendation[]) {
  const recommended: ScoreRecommendation[] = [];
  const available: ScoreRecommendation[] = [];
  const notApplicable: ScoreRecommendation[] = [];

  for (const r of recommendations) {
    if (!r.applicable) {
      notApplicable.push(r);
    } else if (
      r.expected_completeness !== null &&
      r.expected_completeness >= 0.7
    ) {
      recommended.push(r);
    } else {
      available.push(r);
    }
  }

  return { recommended, available, notApplicable };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RiskScoreCreatePage() {
  const navigate = useNavigate();
  const { activeSourceId, defaultSourceId } = useSourceStore();
  const sourceId = activeSourceId ?? defaultSourceId ?? 0;
  const createMutation = useCreateRiskScoreAnalysis();
  const executeMutation = useExecuteRiskScoreAnalysis();

  // ── State ──────────────────────────────────────────────────────
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null);
  const [selectedScoreIds, setSelectedScoreIds] = useState<string[]>([]);
  const [showRunModal, setShowRunModal] = useState(false);
  const [createdAnalysisId, setCreatedAnalysisId] = useState<number | null>(
    null,
  );
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Queries ────────────────────────────────────────────────────

  const { data: cohortDefs } = useQuery({
    queryKey: ["cohort-definitions", sourceId],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/sources/${sourceId}/cohort-definitions`,
      );
      return (data.data ?? data) as Array<{
        id: number;
        name: string;
        subject_count?: number;
      }>;
    },
    enabled: sourceId > 0,
  });

  const { data: recommendations, isLoading: loadingRecs } =
    useRecommendScores(sourceId, selectedCohortId ?? 0);

  // ── Derived ────────────────────────────────────────────────────

  const selectedCohort = cohortDefs?.find((c) => c.id === selectedCohortId);

  const canNext =
    step === 0
      ? name.trim().length > 0 &&
        selectedCohortId != null &&
        selectedScoreIds.length > 0
      : true;

  // ── Handlers ───────────────────────────────────────────────────

  function handleCohortChange(cohortId: number | null) {
    setSelectedCohortId(cohortId);
    setSelectedScoreIds([]);

    // Auto-generate name when cohort is selected and name is empty
    if (cohortId != null && name.trim() === "") {
      const cohort = cohortDefs?.find((c) => c.id === cohortId);
      if (cohort) {
        setName(`${cohort.name} \u2014 Risk Stratification`);
      }
    }
  }

  function toggleScore(scoreId: string) {
    setSelectedScoreIds((prev) =>
      prev.includes(scoreId)
        ? prev.filter((id) => id !== scoreId)
        : [...prev, scoreId],
    );
  }

  function handleCreate(andRun: boolean) {
    setCreateError(null);
    const payload: RiskScoreAnalysisCreatePayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      design_json: {
        targetCohortIds: [selectedCohortId!],
        scoreIds: selectedScoreIds,
        storePatientLevel: true,
      },
    };
    createMutation.mutate(payload, {
      onSuccess: (analysis) => {
        if (andRun) {
          setCreatedAnalysisId(analysis.id);
          executeMutation.mutate(
            { analysisId: analysis.id, sourceId },
            {
              onSuccess: () => {
                setShowRunModal(true);
              },
              onError: () => {
                setCreateError(
                  "Analysis created but execution failed. You can re-run from the detail page.",
                );
                setTimeout(() => navigate(`/risk-scores/${analysis.id}`), 2000);
              },
            },
          );
        } else {
          navigate("/risk-scores");
        }
      },
      onError: () => {
        setCreateError("Failed to create analysis. Please try again.");
      },
    });
  }

  // ── Step Renderers ─────────────────────────────────────────────

  const renderConfigure = () => {
    const groups =
      recommendations?.recommendations
        ? groupRecommendations(recommendations.recommendations)
        : null;

    return (
      <div className="space-y-6">
        {/* Basics section */}
        <div className="panel space-y-4">
          <h4 className="text-sm font-semibold text-text-secondary">Basics</h4>

          {/* Name */}
          <div>
            <label className="form-label">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Heart Failure Cohort — Risk Stratification"
              className="form-input"
            />
          </div>

          {/* Description */}
          <div>
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of this risk scoring analysis..."
              rows={3}
              className="form-input form-textarea"
            />
          </div>

          {/* Cohort dropdown */}
          <div>
            <label className="form-label">Target Cohort *</label>
            <select
              value={selectedCohortId ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                handleCohortChange(val ? parseInt(val, 10) : null);
              }}
              className="form-input form-select"
            >
              <option value="">Select a cohort...</option>
              {cohortDefs?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.subject_count != null ? ` (${c.subject_count.toLocaleString()} patients)` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Score Selection section */}
        {selectedCohortId != null && (
          <div className="panel space-y-4">
            <h4 className="text-sm font-semibold text-text-secondary">
              Score Selection
            </h4>

            {loadingRecs && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-lg bg-surface-overlay"
                  />
                ))}
              </div>
            )}

            {!loadingRecs && recommendations && (
              <>
                {/* Cohort profile */}
                <CohortProfilePanel
                  profile={recommendations.profile}
                  compact
                />

                {/* Shortcut buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (groups?.recommended) {
                        setSelectedScoreIds(
                          groups.recommended.map((r) => r.score_id),
                        );
                      }
                    }}
                    className="btn btn-sm"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--success) 8%, transparent)",
                      color: "var(--success)",
                      borderColor: "color-mix(in srgb, var(--success) 25%, transparent)",
                    }}
                  >
                    <Sparkles size={12} /> Select All Recommended
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (groups) {
                        const allIds = [
                          ...selectedScoreIds,
                          ...groups.available
                            .filter(
                              (r) => !selectedScoreIds.includes(r.score_id),
                            )
                            .map((r) => r.score_id),
                        ];
                        setSelectedScoreIds(allIds);
                      }
                    }}
                    className="btn btn-sm"
                    style={{
                      backgroundColor: "var(--warning-bg)",
                      color: 'var(--warning)',
                      borderColor: 'var(--warning-border)',
                    }}
                  >
                    Select All Available
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedScoreIds([])}
                    className="btn btn-ghost btn-sm"
                  >
                    Clear Selection
                  </button>
                  {selectedScoreIds.length > 0 && (
                    <span className="text-xs text-text-muted ml-2">
                      {selectedScoreIds.length} score
                      {selectedScoreIds.length !== 1 ? "s" : ""} selected
                    </span>
                  )}
                </div>

                {/* Recommended tier */}
                {groups && groups.recommended.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-3">
                      Recommended
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {groups.recommended.map((r) => (
                        <ScoreRecommendationCard
                          key={r.score_id}
                          recommendation={r}
                          selected={selectedScoreIds.includes(r.score_id)}
                          onToggle={toggleScore}
                          readOnly={false}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Available tier */}
                {groups && groups.available.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-3">
                      Available
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {groups.available.map((r) => (
                        <ScoreRecommendationCard
                          key={r.score_id}
                          recommendation={r}
                          selected={selectedScoreIds.includes(r.score_id)}
                          onToggle={toggleScore}
                          readOnly={false}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Not Applicable tier */}
                {groups && groups.notApplicable.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider mb-3">
                      Not Applicable
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {groups.notApplicable.map((r) => (
                        <ScoreRecommendationCard
                          key={r.score_id}
                          recommendation={r}
                          selected={false}
                          onToggle={toggleScore}
                          readOnly={false}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderReview = () => {
    const recs = recommendations?.recommendations ?? [];
    const selectedRecs = recs.filter((r) =>
      selectedScoreIds.includes(r.score_id),
    );

    return (
      <div className="space-y-4">
        {/* Analysis details */}
        <div className="panel">
          <h4 className="text-sm font-semibold text-text-secondary mb-3">
            Analysis
          </h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-text-ghost">Name:</span>
              <p className="text-text-primary font-medium">{name}</p>
            </div>
            {description.trim() && (
              <div>
                <span className="text-text-ghost">Description:</span>
                <p className="text-text-secondary mt-0.5">{description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Cohort */}
        <div className="panel">
          <h4 className="text-sm font-semibold text-text-secondary mb-3">
            Target Cohort
          </h4>
          <div className="text-sm">
            <span className="text-text-primary font-medium">
              {recommendations?.cohort?.name ?? selectedCohort?.name ?? "---"}
            </span>
            {recommendations?.cohort?.person_count != null && (
              <span className="ml-2 text-text-muted">
                {recommendations.cohort.person_count.toLocaleString()} patients
              </span>
            )}
          </div>
        </div>

        {/* Selected scores */}
        <div className="panel">
          <h4 className="text-sm font-semibold text-text-secondary mb-3">
            Selected Scores ({selectedScoreIds.length})
          </h4>
          <div className="space-y-2">
            {selectedRecs.map((r) => (
              <div
                key={r.score_id}
                className="flex items-center justify-between rounded-lg border border-border-default bg-surface-raised px-4 py-3"
              >
                <div>
                  <span className="text-sm font-medium text-text-primary">
                    {r.score_name}
                  </span>
                  <span className="ml-2 rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                    {r.category}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-ghost">Completeness:</span>
                  <span className="font-['IBM_Plex_Mono',monospace] text-xs tabular-nums text-text-secondary">
                    {r.expected_completeness != null
                      ? `${Math.round(r.expected_completeness * 100)}%`
                      : "N/A"}
                  </span>
                </div>
              </div>
            ))}
            {selectedRecs.length === 0 && selectedScoreIds.length > 0 && (
              <p className="text-sm text-text-ghost">
                {selectedScoreIds.length} score
                {selectedScoreIds.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => handleCreate(false)}
            disabled={createMutation.isPending || executeMutation.isPending}
            className="btn btn-ghost"
          >
            {createMutation.isPending && !executeMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            Create as Draft
          </button>
          <button
            type="button"
            onClick={() => handleCreate(true)}
            disabled={createMutation.isPending || executeMutation.isPending}
            className="btn btn-primary bg-primary hover:bg-primary/80 border-primary"
          >
            {executeMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Create & Run
          </button>
        </div>

        {createError && (
          <div className="rounded-lg border border-critical/30 bg-critical/5 px-4 py-3 mt-4">
            <p className="text-sm text-critical">{createError}</p>
          </div>
        )}
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => navigate("/risk-scores")}
          className="btn btn-ghost btn-sm mb-3"
        >
          <ArrowLeft size={14} /> Risk Scores
        </button>
        <h1 className="page-title">New Risk Score Analysis</h1>
        <p className="page-subtitle">
          Configure a risk scoring analysis and select scores to compute
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s.key} className="flex items-center flex-1">
              <button
                type="button"
                onClick={() => {
                  if (i < step) setStep(i);
                }}
                disabled={i > step}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all w-full",
                  isActive &&
                    "bg-success/10 text-success border border-success/30",
                  isDone &&
                    "text-success/70 cursor-pointer hover:bg-success/5",
                  !isActive && !isDone && "text-text-ghost cursor-not-allowed",
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0",
                    isActive && "bg-success text-surface-base",
                    isDone && "bg-success/20 text-success",
                    !isActive && !isDone && "bg-surface-elevated text-text-ghost",
                  )}
                >
                  {isDone ? <Check size={12} /> : i + 1}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-px w-4 shrink-0 mx-1",
                    i < step ? "bg-success/30" : "bg-surface-elevated",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div>
        <h3 className="text-base font-semibold text-text-primary mb-4">
          {STEPS[step].label}
        </h3>
        {step === 0 && renderConfigure()}
        {step === 1 && renderReview()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="btn btn-ghost"
        >
          <ArrowLeft size={14} /> Previous
        </button>

        <div className="flex gap-2">
          {step === 0 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={!canNext}
              className="btn btn-primary"
            >
              Next <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Run Modal */}
      {showRunModal && createdAnalysisId != null && (
        <RiskScoreRunModal
          sourceId={sourceId}
          scoreIds={selectedScoreIds}
          onClose={() => navigate(`/risk-scores/${createdAnalysisId}`)}
        />
      )}
    </div>
  );
}
