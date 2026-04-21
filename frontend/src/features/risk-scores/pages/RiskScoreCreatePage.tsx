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
import { useTranslation } from "react-i18next";
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
import { getRiskScoreCategoryLabel } from "../lib/i18n";

const STEP_KEYS = ["configure", "reviewAndRun"] as const;

function groupRecommendations(recommendations: ScoreRecommendation[]) {
  const recommended: ScoreRecommendation[] = [];
  const available: ScoreRecommendation[] = [];
  const notApplicable: ScoreRecommendation[] = [];

  for (const recommendation of recommendations) {
    if (!recommendation.applicable) {
      notApplicable.push(recommendation);
    } else if (
      recommendation.expected_completeness !== null &&
      recommendation.expected_completeness >= 0.7
    ) {
      recommended.push(recommendation);
    } else {
      available.push(recommendation);
    }
  }

  return { recommended, available, notApplicable };
}

export default function RiskScoreCreatePage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const { activeSourceId, defaultSourceId } = useSourceStore();
  const sourceId = activeSourceId ?? defaultSourceId ?? 0;
  const createMutation = useCreateRiskScoreAnalysis();
  const executeMutation = useExecuteRiskScoreAnalysis();

  const steps = [
    { key: "configure", label: t("riskScores.create.steps.configure"), icon: Settings },
    {
      key: "reviewAndRun",
      label: t("riskScores.create.steps.reviewAndRun"),
      icon: ClipboardCheck,
    },
  ] as const;

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null);
  const [selectedScoreIds, setSelectedScoreIds] = useState<string[]>([]);
  const [showRunModal, setShowRunModal] = useState(false);
  const [createdAnalysisId, setCreatedAnalysisId] = useState<number | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: cohortDefs } = useQuery({
    queryKey: ["cohort-definitions", sourceId],
    queryFn: async () => {
      const { data } = await apiClient.get(`/sources/${sourceId}/cohort-definitions`);
      return (data.data ?? data) as Array<{
        id: number;
        name: string;
        subject_count?: number;
      }>;
    },
    enabled: sourceId > 0,
  });

  const { data: recommendations, isLoading: loadingRecs } = useRecommendScores(
    sourceId,
    selectedCohortId ?? 0,
  );

  const selectedCohort = cohortDefs?.find((cohort) => cohort.id === selectedCohortId);
  const canNext =
    step === 0
      ? name.trim().length > 0 &&
        selectedCohortId != null &&
        selectedScoreIds.length > 0
      : true;

  function handleCohortChange(cohortId: number | null) {
    setSelectedCohortId(cohortId);
    setSelectedScoreIds([]);

    if (cohortId != null && name.trim() === "") {
      const cohort = cohortDefs?.find((item) => item.id === cohortId);
      if (cohort) {
        setName(
          `${cohort.name} - ${t("riskScores.create.autoNameSuffix")}`,
        );
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
              onSuccess: () => setShowRunModal(true),
              onError: () => {
                setCreateError(t("riskScores.create.errors.executionFailed"));
                setTimeout(() => navigate(`/risk-scores/${analysis.id}`), 2000);
              },
            },
          );
          return;
        }
        navigate("/risk-scores");
      },
      onError: () => {
        setCreateError(t("riskScores.create.errors.createFailed"));
      },
    });
  }

  const renderConfigure = () => {
    const groups = recommendations?.recommendations
      ? groupRecommendations(recommendations.recommendations)
      : null;

    return (
      <div className="space-y-6">
        <div className="panel space-y-4">
          <h4 className="text-sm font-semibold text-text-secondary">
            {t("riskScores.create.basics")}
          </h4>

          <div>
            <label className="form-label">{t("riskScores.create.name")}</label>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("riskScores.create.placeholders.name")}
              className="form-input"
            />
          </div>

          <div>
            <label className="form-label">
              {t("riskScores.create.description")}
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("riskScores.create.placeholders.description")}
              rows={3}
              className="form-input form-textarea"
            />
          </div>

          <div>
            <label className="form-label">
              {t("riskScores.create.targetCohort")}
            </label>
            <select
              value={selectedCohortId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                handleCohortChange(value ? parseInt(value, 10) : null);
              }}
              className="form-input form-select"
            >
              <option value="">{t("riskScores.create.selectCohort")}</option>
              {cohortDefs?.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>
                  {cohort.name}
                  {cohort.subject_count != null
                    ? ` (${t("riskScores.create.cohortPatients", {
                        count: cohort.subject_count.toLocaleString(),
                      })})`
                    : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedCohortId != null && (
          <div className="panel space-y-4">
            <h4 className="text-sm font-semibold text-text-secondary">
              {t("riskScores.create.scoreSelection")}
            </h4>

            {loadingRecs && (
              <div className="space-y-3">
                {[1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="h-20 animate-pulse rounded-lg bg-surface-overlay"
                  />
                ))}
              </div>
            )}

            {!loadingRecs && recommendations && (
              <>
                <CohortProfilePanel profile={recommendations.profile} compact />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (groups?.recommended) {
                        setSelectedScoreIds(
                          groups.recommended.map((recommendation) => recommendation.score_id),
                        );
                      }
                    }}
                    className="btn btn-sm"
                    style={{
                      backgroundColor: "#2DD4BF15",
                      color: "var(--success)",
                      borderColor: "#2DD4BF40",
                    }}
                  >
                    <Sparkles size={12} /> {t("riskScores.recommendations.recommended")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (groups) {
                        const allIds = [
                          ...selectedScoreIds,
                          ...groups.available
                            .filter(
                              (recommendation) =>
                                !selectedScoreIds.includes(recommendation.score_id),
                            )
                            .map((recommendation) => recommendation.score_id),
                        ];
                        setSelectedScoreIds(allIds);
                      }
                    }}
                    className="btn btn-sm"
                    style={{
                      backgroundColor: "#F59E0B15",
                      color: "var(--warning)",
                      borderColor: "#F59E0B40",
                    }}
                  >
                    {t("riskScores.recommendations.available")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedScoreIds([])}
                    className="btn btn-ghost btn-sm"
                  >
                    {t("riskScores.common.actions.clear")}
                  </button>
                  {selectedScoreIds.length > 0 && (
                    <span className="ml-2 text-xs text-text-muted">
                      {t("riskScores.common.count.score", {
                        count: selectedScoreIds.length,
                      })}{" "}
                      selected
                    </span>
                  )}
                </div>

                {groups && groups.recommended.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-text-muted">
                      {t("riskScores.recommendations.recommended")}
                    </h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {groups.recommended.map((recommendation) => (
                        <ScoreRecommendationCard
                          key={recommendation.score_id}
                          recommendation={recommendation}
                          selected={selectedScoreIds.includes(recommendation.score_id)}
                          onToggle={toggleScore}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {groups && groups.available.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-text-muted">
                      {t("riskScores.recommendations.available")}
                    </h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {groups.available.map((recommendation) => (
                        <ScoreRecommendationCard
                          key={recommendation.score_id}
                          recommendation={recommendation}
                          selected={selectedScoreIds.includes(recommendation.score_id)}
                          onToggle={toggleScore}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {groups && groups.notApplicable.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-text-muted">
                      {t("riskScores.recommendations.notApplicable")}
                    </h3>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {groups.notApplicable.map((recommendation) => (
                        <ScoreRecommendationCard
                          key={recommendation.score_id}
                          recommendation={recommendation}
                          selected={false}
                          onToggle={toggleScore}
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
    const recommendationsList = recommendations?.recommendations ?? [];
    const selectedRecs = recommendationsList.filter((recommendation) =>
      selectedScoreIds.includes(recommendation.score_id),
    );

    return (
      <div className="space-y-4">
        <div className="panel">
          <h4 className="mb-3 text-sm font-semibold text-text-secondary">
            {t("riskScores.create.steps.reviewAndRun")}
          </h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-text-ghost">{t("riskScores.create.name")} </span>
              <p className="font-medium text-text-primary">{name}</p>
            </div>
            {description.trim() && (
              <div>
                <span className="text-text-ghost">
                  {t("riskScores.create.description")}
                </span>
                <p className="mt-0.5 text-text-secondary">{description}</p>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <h4 className="mb-3 text-sm font-semibold text-text-secondary">
            {t("riskScores.create.targetCohort")}
          </h4>
          <div className="text-sm">
            <span className="font-medium text-text-primary">
              {recommendations?.cohort?.name ?? selectedCohort?.name ?? "---"}
            </span>
            {recommendations?.cohort?.person_count != null && (
              <span className="ml-2 text-text-muted">
                {t("riskScores.create.cohortPatients", {
                  count: recommendations.cohort.person_count.toLocaleString(),
                })}
              </span>
            )}
          </div>
        </div>

        <div className="panel">
          <h4 className="mb-3 text-sm font-semibold text-text-secondary">
            {t("riskScores.configuration.selectedScores")} ({selectedScoreIds.length})
          </h4>
          <div className="space-y-2">
            {selectedRecs.map((recommendation) => (
              <div
                key={recommendation.score_id}
                className="flex items-center justify-between rounded-lg border border-border-default bg-surface-raised px-4 py-3"
              >
                <div>
                  <span className="text-sm font-medium text-text-primary">
                    {recommendation.score_name}
                  </span>
                  <span className="ml-2 rounded bg-surface-overlay px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-text-muted">
                    {getRiskScoreCategoryLabel(t, recommendation.category)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-ghost">
                    {t("riskScores.create.completeness")}
                  </span>
                  <span className="font-['IBM_Plex_Mono',monospace] text-xs tabular-nums text-text-secondary">
                    {recommendation.expected_completeness != null
                      ? `${Math.round(recommendation.expected_completeness * 100)}%`
                      : t("riskScores.common.values.notAvailable")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

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
            {t("riskScores.create.createAsDraft")}
          </button>
          <button
            type="button"
            onClick={() => handleCreate(true)}
            disabled={createMutation.isPending || executeMutation.isPending}
            className="btn btn-primary border-primary bg-primary hover:bg-primary/80"
          >
            {executeMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {t("riskScores.create.createAndRun")}
          </button>
        </div>

        {createError && (
          <div className="mt-4 rounded-lg border border-critical/30 bg-critical/5 px-4 py-3">
            <p className="text-sm text-critical">{createError}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <button
          type="button"
          onClick={() => navigate("/risk-scores")}
          className="btn btn-ghost btn-sm mb-3"
        >
          <ArrowLeft size={14} /> {t("riskScores.detail.backToRiskScores")}
        </button>
        <h1 className="page-title">{t("riskScores.create.title")}</h1>
        <p className="page-subtitle">
          {t("riskScores.create.subtitle")}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {steps.map((stepDef, index) => {
          const isActive = index === step;
          const isDone = index < step;
          const Icon = stepDef.icon;
          return (
            <div key={STEP_KEYS[index]} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => {
                  if (index < step) setStep(index);
                }}
                disabled={index > step}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all",
                  isActive && "border border-success/30 bg-success/10 text-success",
                  isDone && "cursor-pointer text-success/70 hover:bg-success/5",
                  !isActive && !isDone && "cursor-not-allowed text-text-ghost",
                )}
              >
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    isActive && "bg-success text-surface-base",
                    isDone && "bg-success/20 text-success",
                    !isActive && !isDone && "bg-surface-elevated text-text-ghost",
                  )}
                >
                  {isDone ? <Check size={12} /> : <Icon size={12} />}
                </div>
                <span className="hidden sm:inline">{stepDef.label}</span>
              </button>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "mx-1 h-px w-4 shrink-0",
                    index < step ? "bg-success/30" : "bg-surface-elevated",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="mb-4 text-base font-semibold text-text-primary">
          {steps[step].label}
        </h3>
        {step === 0 && renderConfigure()}
        {step === 1 && renderReview()}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className="btn btn-ghost"
        >
          <ArrowLeft size={14} /> {t("profiles.common.actions.previous")}
        </button>

        <div className="flex gap-2">
          {step === 0 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={!canNext}
              className="btn btn-primary"
            >
              {t("profiles.common.actions.next")} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

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
