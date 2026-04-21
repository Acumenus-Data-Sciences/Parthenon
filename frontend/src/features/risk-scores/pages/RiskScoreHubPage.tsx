import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Loader2,
  Search,
  X,
  Briefcase,
  CheckCircle2,
  BarChart3,
  Users,
  Activity,
  LayoutGrid,
  List,
  Info,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpButton } from "@/features/help";
import { useSourceStore } from "@/stores/sourceStore";
import { RiskScoreAnalysisList } from "../components/RiskScoreAnalysisList";
import { RiskScoreAnalysisCard } from "../components/RiskScoreAnalysisCard";
import { ScoreCatalogueCard } from "../components/ScoreCatalogueCard";
import { ScoreDetailModal } from "../components/ScoreDetailModal";
import { RiskScoreRunModal } from "../components/RiskScoreRunModal";
import {
  useRiskScoreAnalyses,
  useRiskScoreAnalysisStats,
  useAllRiskScoreAnalyses,
  useRiskScoreCatalogue,
  useRiskScoreEligibility,
  useRefreshEligibility,
  useRiskScoreResults,
} from "../hooks/useRiskScores";
import type {
  RiskScoreAnalysis,
  RiskScoreSourceSummaryItem,
} from "../types/riskScore";
import { ANALYSIS_STATUS_COLORS, CATEGORY_ORDER } from "../types/riskScore";
import {
  getRiskScoreCategoryLabel,
  getRiskScoreStatusLabel,
} from "../lib/i18n";

const STATUS_OPTIONS = [
  { value: "draft", color: ANALYSIS_STATUS_COLORS.draft },
  { value: "running", color: ANALYSIS_STATUS_COLORS.running },
  { value: "completed", color: ANALYSIS_STATUS_COLORS.completed },
  { value: "failed", color: ANALYSIS_STATUS_COLORS.failed },
];
const MIDDLE_DOT = String.fromCharCode(183);

const CATEGORY_COLORS: Record<string, string> = {
  Cardiovascular: "var(--critical)",
  "Comorbidity Burden": "var(--domain-observation)",
  Hepatic: "var(--warning)",
  Pulmonary: "var(--info)",
  Respiratory: "var(--info)",
  Metabolic: "var(--success)",
  Endocrine: "var(--domain-device)",
  Musculoskeletal: "var(--text-muted)",
};

export default function RiskScoreHubPage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const { activeSourceId, defaultSourceId, sources } = useSourceStore();
  const sourceId = activeSourceId ?? defaultSourceId ?? 0;
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "card">(() => {
    return (localStorage.getItem("risk-scores-view") as "table" | "card") || "table";
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [drilldownStatus, setDrilldownStatus] = useState<string | null>(null);
  const [hubTab, setHubTab] = useState<"analyses" | "catalogue">("analyses");
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(null);
  const [showRunModal, setShowRunModal] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const hasFilters = !!(filterStatus || filterCategory);
  const categoryOptions = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        value: category,
        label: getRiskScoreCategoryLabel(t, category),
        color: CATEGORY_COLORS[category] ?? "var(--text-muted)",
      })),
    [t],
  );

  const { data: stats } = useRiskScoreAnalysisStats();
  const { data, isLoading, error } = useRiskScoreAnalyses(page, debouncedSearch, {
    status: filterStatus ?? undefined,
    category: filterCategory ?? undefined,
  });
  const { data: allAnalysesData } = useAllRiskScoreAnalyses();
  const { data: catalogue } = useRiskScoreCatalogue();
  const { data: eligibility, isLoading: loadingEligibility } = useRiskScoreEligibility(sourceId);
  const { data: sourceResults } = useRiskScoreResults(sourceId);
  const refreshEligibilityMutation = useRefreshEligibility();

  const facets = data?.facets;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Persist view mode
  useEffect(() => {
    localStorage.setItem("risk-scores-view", viewMode);
  }, [viewMode]);

  const analyses = useMemo(() => {
    return data?.data ?? [];
  }, [data]);

  // Search dropdown — list all analyses, filtered by input
  const dropdownAnalyses = useMemo(() => {
    const all = allAnalysesData?.data ?? [];
    if (!searchInput.trim()) return all.slice(0, 12);
    const q = searchInput.toLowerCase();
    return all.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      (a.description ?? "").toLowerCase().includes(q)
    ).slice(0, 12);
  }, [allAnalysesData, searchInput]);

  // Analyses for drilldown panel
  const drilldownAnalyses = useMemo(() => {
    if (!drilldownStatus) return [];
    const all = allAnalysesData?.data ?? [];
    // Match analyses that have at least one execution in the drilldown status
    return all.filter((a) =>
      a.executions?.some((e) => e.status === drilldownStatus)
    );
  }, [allAnalysesData, drilldownStatus]);

  const completedV2ScoreIdsForSource = useMemo(() => {
    const ids = new Set<string>();

    for (const analysis of allAnalysesData?.data ?? []) {
      const hasCompletedExecutionForSource = analysis.executions?.some(
        (execution) =>
          execution.source_id === sourceId && execution.status === "completed",
      );

      if (!hasCompletedExecutionForSource) continue;

      for (const scoreId of analysis.design_json.scoreIds ?? []) {
        ids.add(scoreId);
      }
    }

    return ids;
  }, [allAnalysesData, sourceId]);

  const sourceSummaryByScore = useMemo(() => {
    const map = new Map<string, RiskScoreSourceSummaryItem>();

    for (const summary of sourceResults?.summary ?? []) {
      map.set(summary.score_id, summary);
    }

    return map;
  }, [sourceResults]);

  const legacyOnlySummaries = useMemo(() => {
    return (sourceResults?.summary ?? []).filter(
      (summary) => !completedV2ScoreIdsForSource.has(summary.score_id),
    );
  }, [sourceResults, completedV2ScoreIdsForSource]);

  // Close dropdown on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Derive the latest execution status for display
  // Group catalogue scores by category for the catalogue tab
  const catalogueGroups = useMemo(() => {
    if (!catalogue?.scores) return [];
    return CATEGORY_ORDER.map((category) => ({
      category,
      color: CATEGORY_COLORS[category] ?? "var(--text-muted)",
      scores: catalogue.scores.filter((s) => s.category === category),
    })).filter((g) => g.scores.length > 0);
  }, [catalogue]);

  const getAnalysisStatus = (a: RiskScoreAnalysis): string => {
    if (!a.executions || a.executions.length === 0) return "draft";
    // Latest execution status
    return a.executions[0].status;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div className="flex-1 min-w-0">
          <h1 className="page-title">{t("riskScores.hub.title")}</h1>
          <p className="page-subtitle">
            {t("riskScores.hub.subtitle")}
          </p>
        </div>

        {/* Right side: view toggle, search, help, create */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center rounded-lg border border-border-default bg-surface-base overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "table"
                  ? "bg-success/10 text-success"
                  : "text-text-ghost hover:text-text-secondary",
              )}
              title={t("riskScores.common.view.table")}
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "card"
                  ? "bg-success/10 text-success"
                  : "text-text-ghost hover:text-text-secondary",
              )}
              title={t("riskScores.common.view.card")}
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          {/* Search dropdown — lists all analyses */}
          <div className="relative w-72" ref={searchRef}>
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-ghost z-10"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder={t("riskScores.common.search.analysesPlaceholder")}
              className={cn(
                "w-full rounded-lg pl-9 pr-8 py-2 text-sm",
                "bg-surface-base border border-border-default",
                "text-text-primary placeholder:text-text-ghost",
                "focus:outline-none focus:border-success focus:ring-1 focus:ring-success/40",
                "transition-colors",
              )}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-ghost hover:text-text-secondary z-10"
              >
                <X size={14} />
              </button>
            )}

            {/* Dropdown listing */}
            {showDropdown && (
              <div className="absolute top-full left-0 w-96 mt-1 rounded-lg border border-border-default bg-surface-raised shadow-xl z-50 overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  {dropdownAnalyses.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-text-ghost">
                      {t("riskScores.common.search.noMatch", {
                        query: searchInput,
                      })}
                    </div>
                  ) : (
                    dropdownAnalyses.map((analysis) => {
                      const status = getAnalysisStatus(analysis);
                      const sColor = ANALYSIS_STATUS_COLORS[status] ?? "var(--text-muted)";
                      const scoreCount = analysis.design_json?.scoreIds?.length ?? 0;
                      return (
                        <button
                          key={analysis.id}
                          type="button"
                          onClick={() => {
                            setShowDropdown(false);
                            setSearchInput("");
                            navigate(`/risk-scores/${analysis.id}`);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-surface-overlay transition-colors border-b border-border-subtle last:border-b-0"
                        >
                          <p className="text-sm font-medium text-text-primary truncate">{analysis.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium"
                              style={{ color: sColor }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sColor }} />
                              {getRiskScoreStatusLabel(t, status)}
                            </span>
                            <span className="text-[10px] text-text-ghost">{MIDDLE_DOT}</span>
                            <span className="text-[10px] text-text-ghost">
                              {t("riskScores.common.count.score", { count: scoreCount })}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                {(allAnalysesData?.data?.length ?? 0) > 12 && !searchInput.trim() && (
                  <div className="px-4 py-2 text-center text-[10px] text-text-ghost border-t border-border-default bg-surface-base">
                    {t("riskScores.common.search.typeToFilter", {
                      count: allAnalysesData?.data?.length,
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <HelpButton helpKey="risk-scores" />

          <div className="ml-auto">
            <button
              type="button"
              onClick={() => navigate("/risk-scores/create")}
              className="btn btn-primary"
            >
              <Plus size={16} />
              {t("riskScores.common.actions.newAnalysis")}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: t("riskScores.hub.metrics.total"), value: stats.total, icon: Briefcase, color: "var(--text-secondary)", drilldown: null as string | null },
              { label: t("riskScores.hub.metrics.running"), value: stats.running, icon: Loader2, color: "var(--warning)", drilldown: "running" },
              { label: t("riskScores.hub.metrics.completed"), value: stats.completed, icon: CheckCircle2, color: "var(--success)", drilldown: "completed" },
              { label: t("riskScores.hub.metrics.scoresAvailable"), value: stats.scores_available, icon: BarChart3, color: "var(--info)", drilldown: "__catalogue__" },
              { label: t("riskScores.hub.metrics.patientsScored"), value: stats.patients_scored, icon: Users, color: "var(--domain-observation)", drilldown: null },
            ].map((metric) => {
              const Icon = metric.icon;
              const isDrilling =
                (metric.drilldown === "__catalogue__" && hubTab === "catalogue") ||
                (metric.drilldown !== null && metric.drilldown !== "__catalogue__" && drilldownStatus === metric.drilldown);
              return (
                <button
                  key={metric.label}
                  type="button"
                  onClick={() => {
                    if (metric.drilldown === "__catalogue__") {
                      setHubTab("catalogue");
                      setDrilldownStatus(null);
                    } else if (metric.drilldown === null) {
                      setDrilldownStatus(null);
                    } else {
                      setHubTab("analyses");
                      setDrilldownStatus(drilldownStatus === metric.drilldown ? null : metric.drilldown);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                    isDrilling
                      ? "ring-1"
                      : "border-border-default bg-surface-raised hover:border-surface-highlight hover:bg-surface-overlay",
                  )}
                  style={isDrilling ? {
                    borderColor: `${metric.color}40`,
                    backgroundColor: `${metric.color}08`,
                    boxShadow: `0 0 0 1px ${metric.color}30`,
                  } : undefined}
                >
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                    style={{ backgroundColor: `${metric.color}15` }}
                  >
                    <Icon size={18} style={{ color: metric.color }} />
                  </div>
                  <div>
                    <p
                      className="font-['IBM_Plex_Mono',monospace] text-xl font-semibold tabular-nums"
                      style={{ color: metric.color }}
                    >
                      {metric.value}
                    </p>
                    <p className="text-[10px] text-text-ghost uppercase tracking-wider">
                      {metric.label}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Drilldown panel */}
          {drilldownStatus && drilldownAnalyses.length > 0 && (
            <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-surface-overlay border-b border-border-default">
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  {t("riskScores.hub.drilldown.analyses", {
                    status: getRiskScoreStatusLabel(t, drilldownStatus),
                  })}
                  <span className="ml-1.5 text-text-ghost">({drilldownAnalyses.length})</span>
                </p>
                <button
                  type="button"
                  onClick={() => setDrilldownStatus(null)}
                  className="text-text-ghost hover:text-text-secondary transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="divide-y divide-border-subtle max-h-64 overflow-y-auto">
                {drilldownAnalyses.map((analysis: RiskScoreAnalysis) => {
                  const status = getAnalysisStatus(analysis);
                  const sColor = ANALYSIS_STATUS_COLORS[status] ?? "var(--text-muted)";
                  const scoreCount = analysis.design_json?.scoreIds?.length ?? 0;
                  return (
                    <button
                      key={analysis.id}
                      type="button"
                      onClick={() => navigate(`/risk-scores/${analysis.id}`)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-surface-overlay transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">{analysis.name}</p>
                        <p className="text-[10px] text-text-ghost truncate mt-0.5">
                          {t("riskScores.common.count.score", { count: scoreCount })}
                          {analysis.author?.name ? ` - ${analysis.author.name}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: `${sColor}15`, color: sColor }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sColor }} />
                          {getRiskScoreStatusLabel(t, status)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Bar */}
      <div className="tab-bar">
        <button
          type="button"
          onClick={() => setHubTab("analyses")}
          className={cn("tab-item flex items-center gap-1.5 whitespace-nowrap", hubTab === "analyses" && "active")}
        >
          <List size={14} />
          {t("riskScores.hub.tabs.analyses")}
          {stats && stats.total > 0 && (
            <span className="text-[10px] font-medium text-text-ghost">{stats.total}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setHubTab("catalogue")}
          className={cn("tab-item flex items-center gap-1.5 whitespace-nowrap", hubTab === "catalogue" && "active")}
        >
          <BarChart3 size={14} />
          {t("riskScores.hub.tabs.scoreCatalogue")}
          {catalogue?.scores && (
            <span className="text-[10px] font-medium text-text-ghost">{catalogue.scores.length}</span>
          )}
        </button>
      </div>

      {/* ── Analyses Tab ─────────────────────────────────────────── */}
      {hubTab === "analyses" && (
        <>
          {/* Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-text-ghost uppercase tracking-wider mr-1">{t("riskScores.hub.filters.status")}</span>
            {STATUS_OPTIONS.map((opt) => {
              const count = facets?.status?.[opt.value];
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setFilterStatus(filterStatus === opt.value ? null : opt.value);
                    setPage(1);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                    filterStatus === opt.value
                      ? "border-transparent"
                      : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary hover:border-surface-highlight",
                  )}
                  style={filterStatus === opt.value ? { backgroundColor: `${opt.color}20`, color: opt.color, borderColor: `${opt.color}40` } : undefined}
                >
                  {getRiskScoreStatusLabel(t, opt.value)}
                  {count != null && <span className="ml-1 text-[10px] opacity-60">({count})</span>}
                </button>
              );
            })}

            <span className="text-text-disabled mx-1">|</span>
            <span className="text-[10px] text-text-ghost uppercase tracking-wider mr-1">{t("riskScores.hub.filters.category")}</span>
            {categoryOptions.map((opt) => {
              const count = facets?.category?.[opt.value];
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setFilterCategory(filterCategory === opt.value ? null : opt.value);
                    setPage(1);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                    filterCategory === opt.value
                      ? "border-transparent"
                      : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary hover:border-surface-highlight",
                  )}
                  style={filterCategory === opt.value ? { backgroundColor: `${opt.color}20`, color: opt.color, borderColor: `${opt.color}40` } : undefined}
                >
                  {opt.label}
                  {count != null && <span className="ml-1 text-[10px] opacity-60">({count})</span>}
                </button>
              );
            })}

            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setFilterStatus(null);
                  setFilterCategory(null);
                  setPage(1);
                }}
                className="ml-2 px-2 py-1 rounded text-[11px] text-critical hover:bg-critical/10 transition-colors"
              >
                <X size={12} className="inline mr-0.5" />
                {t("riskScores.common.actions.clear")}
              </button>
            )}
          </div>

          {sourceId > 0 && legacyOnlySummaries.length > 0 && (
            <div className="rounded-xl border border-info/20 bg-info/5 px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-info">
                    {t("riskScores.hub.catalogue.sourceLevelCompletedScores")}
                  </p>
                  <p className="mt-1 text-xs text-info">
                    {t("riskScores.hub.catalogue.sourceLevelCompletedScoresDetail", {
                      count: legacyOnlySummaries.length,
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHubTab("catalogue")}
                  className="shrink-0 text-xs text-info hover:text-info transition-colors"
                >
                  {t("riskScores.common.actions.openCatalogue")}
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {legacyOnlySummaries.map((summary) => (
                  <button
                    key={summary.score_id}
                    type="button"
                    onClick={() => {
                      setHubTab("catalogue");
                      setSelectedScoreId(summary.score_id);
                    }}
                    className="rounded-full border border-info/30 bg-info/10 px-3 py-1.5 text-left transition-colors hover:bg-info/20"
                  >
                    <span className="font-['IBM_Plex_Mono',monospace] text-[10px] text-info">
                      {summary.score_id}
                    </span>
                    <span className="ml-2 text-[11px] font-medium text-info">
                      {summary.score_name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Analysis Content */}
          {viewMode === "table" ? (
            <RiskScoreAnalysisList
              analyses={analyses}
              onSelect={(id) => navigate(`/risk-scores/${id}`)}
              isLoading={isLoading}
              error={error}
              page={page}
              totalPages={data?.last_page ?? 1}
              total={data?.total ?? 0}
              perPage={data?.per_page ?? 20}
              onPageChange={setPage}
              searchActive={!!debouncedSearch}
            />
          ) : (
            <div>
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 size={24} className="animate-spin text-text-muted" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-critical/30 bg-critical/5 py-16">
                  <p className="text-sm text-critical">{t("riskScores.hub.errors.failedToLoadAnalyses")}</p>
                </div>
              ) : analyses.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
                  <Activity size={28} className="text-text-ghost mb-3" />
                  <h3 className="text-lg font-semibold text-text-primary">
                    {debouncedSearch
                      ? t("riskScores.hub.empty.noMatchingAnalyses")
                      : t("riskScores.hub.empty.noRiskScoreAnalysesYet")}
                  </h3>
                  <p className="mt-2 text-sm text-text-muted">
                    {debouncedSearch
                      ? t("riskScores.hub.empty.noAnalysesFoundFor", {
                          query: debouncedSearch,
                        })
                      : t("riskScores.hub.empty.createFirst")}
                  </p>
                  {!debouncedSearch && (
                    <button
                      type="button"
                      onClick={() => navigate("/risk-scores/create")}
                      className="btn btn-primary mt-4"
                    >
                      <Plus size={16} />
                      {t("riskScores.common.actions.newAnalysis")}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {analyses.map((analysis) => (
                    <RiskScoreAnalysisCard
                      key={analysis.id}
                      analysis={analysis}
                      onClick={() => navigate(`/risk-scores/${analysis.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Score Catalogue Tab ──────────────────────────────────── */}
      {hubTab === "catalogue" && (
        <div className="space-y-6">
          {sourceId > 0 ? (
            <div className="flex items-center justify-between rounded-xl border border-success/20 bg-success/5 px-5 py-3">
              <div className="flex items-center gap-2">
                {loadingEligibility || refreshEligibilityMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin text-success" />
                ) : (
                  <CheckCircle2 size={14} className="text-success" />
                )}
                <p className="text-sm text-success">
                  {loadingEligibility || refreshEligibilityMutation.isPending
                    ? t("riskScores.hub.catalogue.checkingEligibility")
                    : <>
                        {t("riskScores.hub.catalogue.showingEligibilityFor", {
                          source:
                            sources.find((s) => s.id === sourceId)?.source_name ??
                            `Source #${sourceId}`,
                        })}
                      </>
                  }
                </p>
              </div>
              <div className="flex items-center gap-3">
                {eligibility && (
                  <span className="text-xs text-success/70">
                    {t("riskScores.hub.catalogue.eligibleSummary", {
                      eligible: Object.values(eligibility).filter((e) => e.eligible).length,
                      total: Object.keys(eligibility).length,
                    })}
                  </span>
                )}
                {sourceResults && sourceResults.scores_computed > 0 && (
                  <span className="text-xs text-info">
                    {t("riskScores.hub.catalogue.completedResults", {
                      count: sourceResults.scores_computed,
                    })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => refreshEligibilityMutation.mutate(sourceId)}
                  disabled={refreshEligibilityMutation.isPending}
                  className="flex items-center gap-1 text-xs text-success hover:text-success/80 transition-colors disabled:opacity-50"
                  title={t("riskScores.common.actions.refresh")}
                >
                  <RefreshCw size={12} className={refreshEligibilityMutation.isPending ? "animate-spin" : ""} />
                  {t("riskScores.common.actions.refresh")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-5 py-3">
              <Info size={16} className="text-accent shrink-0" />
              <p className="text-sm text-accent">
                {t("riskScores.hub.catalogue.selectSourcePrompt")}
              </p>
            </div>
          )}

          {catalogueGroups.map(({ category, color, scores }) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">
                  {getRiskScoreCategoryLabel(t, category)}
                </h2>
                <span className="text-[10px] text-text-ghost">
                  ({scores.length})
                </span>
                {sourceId > 0 && eligibility && (
                  <span className="text-[10px] text-success">
                    {t("riskScores.hub.catalogue.eligibleCount", {
                      count: scores.filter((s) => eligibility[s.score_id]?.eligible).length,
                    })}
                  </span>
                )}
                {sourceId > 0 && sourceResults && (
                  <span className="text-[10px] text-info">
                    {t("riskScores.hub.catalogue.completedCount", {
                      count: scores.filter((s) => sourceSummaryByScore.has(s.score_id)).length,
                    })}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {scores.map((score) => (
                  <ScoreCatalogueCard
                    key={score.score_id}
                    score={score}
                    color={color}
                    eligibility={eligibility?.[score.score_id]}
                    sourceResult={sourceSummaryByScore.get(score.score_id)}
                    sourceSelected={sourceId > 0}
                    onClick={() => setSelectedScoreId(score.score_id)}
                  />
                ))}
              </div>
            </div>
          ))}

          {(!catalogue?.scores || catalogue.scores.length === 0) && (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={20} className="animate-spin text-text-muted" />
            </div>
          )}
        </div>
      )}
      {/* Score Detail Modal */}
      {selectedScoreId && catalogue?.scores && (() => {
        const score = catalogue.scores.find((s) => s.score_id === selectedScoreId);
        if (!score) return null;
        const catColor = CATEGORY_COLORS[score.category] ?? "var(--text-muted)";
        return (
          <ScoreDetailModal
            score={score}
            color={catColor}
            eligibility={eligibility?.[score.score_id]}
            sourceSelected={sourceId > 0}
            onClose={() => setSelectedScoreId(null)}
            onCreateAnalysis={(scoreId) => {
              setSelectedScoreId(null);
              navigate(`/risk-scores/create?score=${scoreId}`);
            }}
            onRunSingle={(scoreId) => {
              setSelectedScoreId(null);
              setShowRunModal(scoreId);
            }}
          />
        );
      })()}

      {/* Quick Run Modal */}
      {showRunModal && sourceId > 0 && (
        <RiskScoreRunModal
          sourceId={sourceId}
          scoreIds={[showRunModal]}
          onClose={() => setShowRunModal(null)}
        />
      )}
    </div>
  );
}
