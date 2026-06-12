import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  BarChart3,
  Eye,
  Star,
  StarOff,
  Shield,
  ShieldOff,
  ChevronDown,
  ChevronUp,
  Layers,
  Plus,
  Trash2,
  Filter,
  Play,
  ExternalLink,
  X,
  AlertTriangle,
} from "lucide-react";
import { formatDate } from "@/i18n/format";
import {
  useStudyResults,
  useUpdateStudyResult,
  useStudySyntheses,
  useCreateStudySynthesis,
  useDeleteStudySynthesis,
  useLaunchStudyResultShinyApp,
} from "../hooks/useStudies";
import type { ManagedShinyLaunch, StudyResult, StudySynthesis } from "../types/study";
import { StudyResultSummary } from "./StudyResultSummary";
import { AskAbbyButton } from "./AskAbbyButton";

const RESULT_TYPE_LABELS: Record<string, string> = {
  cohort_count: "Cohort Count",
  characterization: "Characterization",
  incidence_rate: "Incidence Rate",
  effect_estimate: "Effect Estimate",
  prediction_performance: "Prediction Performance",
  pathway: "Pathway",
  sccs: "SCCS",
  custom: "Custom",
};

const SYNTHESIS_TYPE_LABELS: Record<string, string> = {
  fixed_effects_meta: "Fixed-Effects Meta-Analysis",
  random_effects_meta: "Random-Effects Meta-Analysis",
  bayesian_meta: "Bayesian Meta-Analysis",
  forest_plot: "Forest Plot",
  heterogeneity_analysis: "Heterogeneity Analysis",
  funnel_plot: "Funnel Plot",
  evidence_synthesis: "Evidence Synthesis",
  custom: "Custom",
};

interface StudyResultsTabProps {
  slug: string;
}

export function StudyResultsTab({ slug }: StudyResultsTabProps) {
  const { t } = useTranslation("app");
  const [resultType, setResultType] = useState<string>("");
  const [publishableOnly, setPublishableOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  const [showSynthesisPanel, setShowSynthesisPanel] = useState(false);
  const [selectedResultIds, setSelectedResultIds] = useState<number[]>([]);
  const [synthesisType, setSynthesisType] = useState("random_effects_meta");
  const [launchingResultId, setLaunchingResultId] = useState<number | null>(null);
  const [activeLaunch, setActiveLaunch] = useState<ManagedShinyLaunch | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const { data: resultsData, isLoading: loadingResults } = useStudyResults(slug, {
    result_type: resultType || undefined,
    publishable_only: publishableOnly || undefined,
    page,
    per_page: 25,
  });
  const updateResult = useUpdateStudyResult();
  const launchMutation = useLaunchStudyResultShinyApp();

  const { data: syntheses, isLoading: loadingSyntheses } = useStudySyntheses(slug);
  const createSynthesis = useCreateStudySynthesis();
  const deleteSynthesis = useDeleteStudySynthesis();

  const results = resultsData?.items ?? [];
  const totalResults = resultsData?.total ?? 0;
  const totalPages = Math.ceil(totalResults / 25);

  const handleTogglePrimary = (r: StudyResult) => {
    updateResult.mutate({ slug, resultId: r.id, payload: { is_primary: !r.is_primary } });
  };

  const handleTogglePublishable = (r: StudyResult) => {
    updateResult.mutate({ slug, resultId: r.id, payload: { is_publishable: !r.is_publishable } });
  };

  const launchManagedShiny = (result: StudyResult) => {
    const app = result.managed_shiny_apps?.[0];
    if (!app) return;

    setLaunchingResultId(result.id);
    setLaunchError(null);

    launchMutation.mutate(
      {
        slug,
        resultId: result.id,
        payload: { app_key: app.key, mode: "embedded" },
      },
      {
        onSuccess: (launch) => setActiveLaunch(launch),
        onError: (error) => setLaunchError(extractLaunchError(error)),
        onSettled: () => setLaunchingResultId(null),
      },
    );
  };

  const toggleResultSelection = (id: number) => {
    setSelectedResultIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCreateSynthesis = () => {
    if (selectedResultIds.length < 2) return;
    createSynthesis.mutate(
      {
        slug,
        payload: {
          synthesis_type: synthesisType,
          input_result_ids: selectedResultIds,
        },
      },
      {
        onSuccess: () => {
          setSelectedResultIds([]);
          setShowSynthesisPanel(false);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Results Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-secondary">
            {t("studies.results.sections.results", { count: totalResults })}
          </h3>
          <div className="flex items-center gap-2">
            <AskAbbyButton
              label="Ask Abby"
              prompt="Summarize this study's results: which results are cleared for publication and which are withheld, what the key effect estimates and diagnostics show, and what the findings mean."
            />
            <button
              type="button"
              onClick={() => setShowSynthesisPanel(!showSynthesisPanel)}
              className="btn btn-primary btn-sm"
            >
              <Layers size={14} />
              {t("studies.results.actions.synthesize")}
            </button>
          </div>
        </div>

        {launchError && (
          <div className="rounded-lg border border-critical/30 bg-critical/10 p-3 text-sm text-critical">
            {launchError}
          </div>
        )}

        {activeLaunch && (
          <div className="panel overflow-hidden p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border-muted px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">{activeLaunch.app.label}</p>
                <p className="truncate text-xs text-text-muted">{activeLaunch.artifact.title}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {activeLaunch.launch_url && (
                  <a
                    href={activeLaunch.launch_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                  >
                    <ExternalLink size={14} />
                    {t("studies.artifacts.actions.openLink")}
                  </a>
                )}
                <button type="button" onClick={() => setActiveLaunch(null)} className="btn btn-ghost btn-sm" aria-label="Close managed Shiny viewer">
                  <X size={14} />
                </button>
              </div>
            </div>
            {activeLaunch.launch_url && activeLaunch.embedding.allowed ? (
              <iframe
                src={activeLaunch.launch_url}
                title={activeLaunch.app.label}
                className="h-[640px] w-full border-0 bg-surface"
                sandbox={activeLaunch.embedding.sandbox.join(" ")}
              />
            ) : (
              <div className="flex items-start gap-3 px-4 py-6 text-sm text-text-muted">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
                <span>{activeLaunch.setup.message}</span>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-text-ghost" />
            <select
              value={resultType}
              onChange={(e) => { setResultType(e.target.value); setPage(1); }}
              className="input text-xs py-1 px-2 w-auto"
            >
              <option value="">{t("studies.results.filters.allTypes")}</option>
              {Object.entries(RESULT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{t(`studies.results.resultTypes.${k}`, { defaultValue: v })}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={publishableOnly}
              onChange={(e) => { setPublishableOnly(e.target.checked); setPage(1); }}
              className="rounded border-surface-highlight bg-surface-raised"
            />
            {t("studies.results.filters.publishableOnly")}
          </label>
        </div>

        {loadingResults ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-text-muted" />
          </div>
        ) : results.length === 0 ? (
          <div className="empty-state">
            <BarChart3 size={24} className="text-text-ghost mb-2" />
            <h3 className="empty-title">{t("studies.results.empty.noResultsTitle")}</h3>
            <p className="empty-message">
              {t("studies.results.empty.noResultsMessage")}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-1">
              {results.map((r) => {
                const isExpanded = expandedResult === r.id;
                const isSelected = selectedResultIds.includes(r.id);
                return (
                  <div
                    key={r.id}
                    className={`border rounded-lg transition-colors ${
                      isSelected
                        ? "border-success/40 bg-success/5"
                        : "border-border-default bg-surface-raised"
                    }`}
                  >
                    <div className="flex items-center gap-3 p-3">
                      {showSynthesisPanel && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleResultSelection(r.id)}
                          className="rounded border-surface-highlight"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-info/10 text-info">
                            {t(`studies.results.resultTypes.${r.result_type}`, { defaultValue: r.result_type })}
                          </span>
                          {r.site?.source && (
                            <span className="text-xs text-text-ghost">
                              {r.site.source.source_name}
                            </span>
                          )}
                          {r.is_primary && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-warning/10 text-warning">
                              {t("studies.results.badges.primary")}
                            </span>
                          )}
                          {r.is_publishable && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-success/10 text-success">
                              {t("studies.results.badges.publishable")}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-text-ghost mt-0.5">
                          {t("studies.results.messages.resultCreated", { id: r.id, date: formatDate(r.created_at) })}
                          {r.reviewed_by_user && (
                            <> · {t("studies.results.messages.reviewedBy", { name: r.reviewed_by_user.name })}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {r.managed_shiny_apps?.[0] && (
                          <button
                            type="button"
                            onClick={() => launchManagedShiny(r)}
                            disabled={launchMutation.isPending}
                            className="inline-flex max-w-[14rem] items-center gap-1 rounded border border-success/30 bg-success/10 px-2 py-1 text-xs text-success hover:bg-success/15 disabled:cursor-not-allowed disabled:opacity-60"
                            title={`Open ${r.managed_shiny_apps[0].label}`}
                          >
                            {launchingResultId === r.id ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                            <span className="truncate">{r.managed_shiny_apps[0].label}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleTogglePrimary(r)}
                          className="p-1.5 text-text-ghost hover:text-warning"
                          title={r.is_primary
                            ? t("studies.results.actions.unmarkPrimary")
                            : t("studies.results.actions.markPrimary")}
                        >
                          {r.is_primary ? <Star size={14} /> : <StarOff size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePublishable(r)}
                          className="p-1.5 text-text-ghost hover:text-success"
                          title={r.is_publishable
                            ? t("studies.results.actions.unmarkPublishable")
                            : t("studies.results.actions.markPublishable")}
                        >
                          {r.is_publishable ? <Shield size={14} /> : <ShieldOff size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedResult(isExpanded ? null : r.id)}
                          className="p-1.5 text-text-ghost hover:text-text-secondary"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border-default p-4">
                        <StudyResultSummary result={r} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="btn btn-ghost btn-sm"
                >
                  {t("studies.results.pagination.previous")}
                </button>
                <span className="text-xs text-text-ghost">
                  {t("studies.results.pagination.page", { page, totalPages })}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="btn btn-ghost btn-sm"
                >
                  {t("studies.results.pagination.next")}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Synthesis Creation Panel */}
      {showSynthesisPanel && (
        <div className="border border-success/20 rounded-lg bg-success/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-success">
              <Layers size={14} className="inline mr-1.5" />
              {t("studies.results.synthesis.createTitle")}
            </h4>
            <button
              type="button"
              onClick={() => { setShowSynthesisPanel(false); setSelectedResultIds([]); }}
              className="text-xs text-text-ghost hover:text-text-secondary"
            >
              {t("studies.results.actions.cancel")}
            </button>
          </div>
          <p className="text-xs text-text-muted">
            {t("studies.results.synthesis.instructions")}
          </p>
          <div className="flex items-center gap-3">
            <select
              value={synthesisType}
              onChange={(e) => setSynthesisType(e.target.value)}
              className="input text-xs py-1.5 px-2 w-auto"
            >
              {Object.entries(SYNTHESIS_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{t(`studies.results.synthesisTypes.${k}`, { defaultValue: v })}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCreateSynthesis}
              disabled={selectedResultIds.length < 2 || createSynthesis.isPending}
              className="btn btn-primary btn-sm"
            >
              {createSynthesis.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {t("studies.results.synthesis.createSelected", { count: selectedResultIds.length })}
            </button>
          </div>
        </div>
      )}

      {/* Existing Syntheses */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text-secondary">
          {t("studies.results.sections.syntheses", { count: syntheses?.length ?? 0 })}
        </h3>

        {loadingSyntheses ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : !syntheses || syntheses.length === 0 ? (
          <div className="empty-state">
            <Layers size={24} className="text-text-ghost mb-2" />
            <h3 className="empty-title">{t("studies.results.empty.noSynthesesTitle")}</h3>
            <p className="empty-message">
              {t("studies.results.empty.noSynthesesMessage")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {syntheses.map((s) => (
              <SynthesisCard
                key={s.id}
                synthesis={s}
                onDelete={() => {
                  if (window.confirm(t("studies.results.synthesis.confirmDelete"))) {
                    deleteSynthesis.mutate({ slug, synthesisId: s.id });
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SynthesisCard({
  synthesis: s,
  onDelete,
}: {
  synthesis: StudySynthesis;
  onDelete: () => void;
}) {
  const { t } = useTranslation("app");
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border-default rounded-lg bg-surface-raised">
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-lg bg-domain-observation/10 flex items-center justify-center shrink-0">
          <Layers size={16} className="text-domain-observation" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-primary font-medium">
              {t(`studies.results.synthesisTypes.${s.synthesis_type}`, { defaultValue: s.synthesis_type })}
            </span>
            <span className="text-[10px] text-text-ghost">
              {t("studies.results.synthesis.resultsCount", { count: s.input_result_ids.length })}
            </span>
          </div>
          <p className="text-[10px] text-text-ghost mt-0.5">
            {s.generated_by_user?.name ?? t("studies.results.synthesis.system")} · {formatDate(s.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-text-ghost hover:text-text-secondary"
          >
            <Eye size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-text-ghost hover:text-critical"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border-default p-4 space-y-3">
          {s.method_settings && Object.keys(s.method_settings).length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                {t("studies.results.synthesis.methodSettings")}
              </h4>
              <pre className="text-[10px] text-text-muted bg-surface-darkest rounded p-3 overflow-x-auto">
                {JSON.stringify(s.method_settings, null, 2)}
              </pre>
            </div>
          )}
          {s.output && Object.keys(s.output).length > 0 ? (
            <div>
              <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">
                {t("studies.results.synthesis.output")}
              </h4>
              <pre className="text-[10px] text-text-muted bg-surface-darkest rounded p-3 overflow-x-auto">
                {JSON.stringify(s.output, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-xs text-text-ghost italic">
              {t("studies.results.synthesis.noOutput")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function extractLaunchError(error: unknown): string {
  const response = (error as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response;
  const validationMessage = response?.data?.errors ? Object.values(response.data.errors)[0]?.[0] : null;

  return validationMessage ?? response?.data?.message ?? (error instanceof Error ? error.message : "Managed Shiny launch failed.");
}
