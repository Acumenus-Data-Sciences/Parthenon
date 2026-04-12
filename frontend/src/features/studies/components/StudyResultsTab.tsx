import { useState } from "react";
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
} from "lucide-react";
import {
  useStudyResults,
  useUpdateStudyResult,
  useStudySyntheses,
  useCreateStudySynthesis,
  useDeleteStudySynthesis,
} from "../hooks/useStudies";
import type { StudyResult, StudySynthesis } from "../types/study";

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
  const [resultType, setResultType] = useState<string>("");
  const [publishableOnly, setPublishableOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  const [showSynthesisPanel, setShowSynthesisPanel] = useState(false);
  const [selectedResultIds, setSelectedResultIds] = useState<number[]>([]);
  const [synthesisType, setSynthesisType] = useState("random_effects_meta");

  const { data: resultsData, isLoading: loadingResults } = useStudyResults(slug, {
    result_type: resultType || undefined,
    publishable_only: publishableOnly || undefined,
    page,
    per_page: 25,
  });
  const updateResult = useUpdateStudyResult();

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
            Results ({totalResults})
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSynthesisPanel(!showSynthesisPanel)}
              className="btn btn-primary btn-sm"
            >
              <Layers size={14} />
              Synthesize
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-text-ghost" />
            <select
              value={resultType}
              onChange={(e) => { setResultType(e.target.value); setPage(1); }}
              className="input text-xs py-1 px-2 w-auto"
            >
              <option value="">All types</option>
              {Object.entries(RESULT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
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
            Publishable only
          </label>
        </div>

        {loadingResults ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-text-muted" />
          </div>
        ) : results.length === 0 ? (
          <div className="empty-state">
            <BarChart3 size={24} className="text-surface-highlight mb-2" />
            <h3 className="empty-title">No results yet</h3>
            <p className="empty-message">
              Results will appear here after analyses are executed
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
                            {RESULT_TYPE_LABELS[r.result_type] ?? r.result_type}
                          </span>
                          {r.site?.source && (
                            <span className="text-xs text-text-ghost">
                              {r.site.source.source_name}
                            </span>
                          )}
                          {r.is_primary && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-warning/10 text-warning">
                              PRIMARY
                            </span>
                          )}
                          {r.is_publishable && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-success/10 text-success">
                              PUBLISHABLE
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-text-ghost mt-0.5">
                          Result #{r.id} · {new Date(r.created_at).toLocaleDateString()}
                          {r.reviewed_by_user && (
                            <> · Reviewed by {r.reviewed_by_user.name}</>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleTogglePrimary(r)}
                          className="p-1.5 text-text-ghost hover:text-warning"
                          title={r.is_primary ? "Unmark primary" : "Mark as primary"}
                        >
                          {r.is_primary ? <Star size={14} /> : <StarOff size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePublishable(r)}
                          className="p-1.5 text-text-ghost hover:text-success"
                          title={r.is_publishable ? "Unmark publishable" : "Mark as publishable"}
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
                      <div className="border-t border-border-default p-4 space-y-3">
                        {r.summary_data && Object.keys(r.summary_data).length > 0 ? (
                          <div>
                            <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Summary</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {Object.entries(r.summary_data).map(([key, val]) => (
                                <div key={key} className="bg-surface-darkest rounded p-2">
                                  <p className="text-[9px] text-text-ghost uppercase">{key.replace(/_/g, " ")}</p>
                                  <p className="text-sm text-text-primary font-mono">
                                    {typeof val === "number" ? val.toLocaleString() : String(val)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-text-ghost italic">No summary data available</p>
                        )}

                        {r.diagnostics && Object.keys(r.diagnostics).length > 0 && (
                          <div>
                            <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Diagnostics</h4>
                            <pre className="text-[10px] text-text-muted bg-surface-darkest rounded p-3 overflow-x-auto">
                              {JSON.stringify(r.diagnostics, null, 2)}
                            </pre>
                          </div>
                        )}
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
                  Previous
                </button>
                <span className="text-xs text-text-ghost">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page >= totalPages}
                  className="btn btn-ghost btn-sm"
                >
                  Next
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
              Create Synthesis
            </h4>
            <button
              type="button"
              onClick={() => { setShowSynthesisPanel(false); setSelectedResultIds([]); }}
              className="text-xs text-text-ghost hover:text-text-secondary"
            >
              Cancel
            </button>
          </div>
          <p className="text-xs text-text-muted">
            Select 2 or more results above, then choose a synthesis method.
          </p>
          <div className="flex items-center gap-3">
            <select
              value={synthesisType}
              onChange={(e) => setSynthesisType(e.target.value)}
              className="input text-xs py-1.5 px-2 w-auto"
            >
              {Object.entries(SYNTHESIS_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
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
              Create ({selectedResultIds.length} selected)
            </button>
          </div>
        </div>
      )}

      {/* Existing Syntheses */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text-secondary">
          Syntheses ({syntheses?.length ?? 0})
        </h3>

        {loadingSyntheses ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        ) : !syntheses || syntheses.length === 0 ? (
          <div className="empty-state">
            <Layers size={24} className="text-surface-highlight mb-2" />
            <h3 className="empty-title">No syntheses</h3>
            <p className="empty-message">
              Combine results from multiple sites using meta-analysis
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {syntheses.map((s) => (
              <SynthesisCard
                key={s.id}
                synthesis={s}
                onDelete={() => {
                  if (window.confirm("Delete this synthesis?")) {
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
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border-default rounded-lg bg-surface-raised">
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--domain-observation)]/10 flex items-center justify-center shrink-0">
          <Layers size={16} className="text-[var(--domain-observation)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-primary font-medium">
              {SYNTHESIS_TYPE_LABELS[s.synthesis_type] ?? s.synthesis_type}
            </span>
            <span className="text-[10px] text-text-ghost">
              {s.input_result_ids.length} results
            </span>
          </div>
          <p className="text-[10px] text-text-ghost mt-0.5">
            {s.generated_by_user?.name ?? "System"} · {new Date(s.created_at).toLocaleDateString()}
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
              <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Method Settings</h4>
              <pre className="text-[10px] text-text-muted bg-surface-darkest rounded p-3 overflow-x-auto">
                {JSON.stringify(s.method_settings, null, 2)}
              </pre>
            </div>
          )}
          {s.output && Object.keys(s.output).length > 0 ? (
            <div>
              <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">Output</h4>
              <pre className="text-[10px] text-text-muted bg-surface-darkest rounded p-3 overflow-x-auto">
                {JSON.stringify(s.output, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-xs text-text-ghost italic">No output generated yet</p>
          )}
        </div>
      )}
    </div>
  );
}
