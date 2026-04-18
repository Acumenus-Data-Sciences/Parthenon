import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Loader2,
  Search,
  X,
  Briefcase,
  FlaskConical,
  Shield,
  Activity,
  LayoutGrid,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HelpButton } from "@/features/help";
import { StudyList } from "../components/StudyList";
import { StudyCard } from "../components/StudyCard";
import { useStudies, useStudyStats, useAllStudies } from "../hooks/useStudies";
import type { Study } from "../types/study";

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--text-muted)",
  protocol_development: "var(--info)",
  feasibility: "var(--domain-observation)",
  irb_review: "var(--warning)",
  execution: "var(--success)",
  analysis: "var(--success)",
  published: "var(--info)",
  archived: "var(--text-ghost)",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "var(--critical)",
  high: "var(--warning)",
  medium: "var(--info)",
  low: "var(--text-muted)",
};

const STUDY_TYPE_OPTIONS = [
  { value: "characterization", labelKey: "characterization", color: "var(--success)" },
  { value: "population_level_estimation", labelKey: "populationLevelEstimation", color: "var(--info)" },
  { value: "patient_level_prediction", labelKey: "patientLevelPrediction", color: "var(--domain-observation)" },
  { value: "comparative_effectiveness", labelKey: "comparativeEffectiveness", color: "var(--warning)" },
  { value: "safety_surveillance", labelKey: "safetySurveillance", color: "var(--critical)" },
  { value: "drug_utilization", labelKey: "drugUtilization", color: "var(--success)" },
  { value: "quality_improvement", labelKey: "qualityImprovement", color: "var(--domain-device)" },
  { value: "custom", labelKey: "custom", color: "var(--text-muted)" },
];

const STATUS_OPTIONS = [
  { value: "draft", color: "var(--text-muted)" },
  { value: "protocol_development", color: "var(--info)" },
  { value: "feasibility", color: "var(--domain-observation)" },
  { value: "irb_review", color: "var(--warning)" },
  { value: "execution", color: "var(--success)" },
  { value: "analysis", color: "var(--success)" },
  { value: "published", color: "var(--info)" },
  { value: "archived", color: "var(--text-ghost)" },
];

const PRIORITY_OPTIONS = [
  { value: "critical", color: "var(--critical)" },
  { value: "high", color: "var(--warning)" },
  { value: "medium", color: "var(--info)" },
  { value: "low", color: "var(--text-muted)" },
];

export default function StudiesPage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterPhase, setFilterPhase] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "card">(() => {
    return (localStorage.getItem("studies-view") as "table" | "card") || "table";
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [drilldownPhase, setDrilldownPhase] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const hasFilters = !!(filterStatus || filterType || filterPriority || filterPhase);

  const { data: stats } = useStudyStats();
  const { data, isLoading, error } = useStudies(page, debouncedSearch, {
    status: filterStatus ?? undefined,
    study_type: filterType ?? undefined,
    phase: filterPhase ?? undefined,
  });
  const { data: allStudiesData } = useAllStudies();

  const facets = data?.facets;
  const searchEngine = data?.engine;

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
    localStorage.setItem("studies-view", viewMode);
  }, [viewMode]);

  const studies = useMemo(() => {
    let items = data?.data ?? [];
    // Client-side priority filter (backend doesn't support priority param)
    if (filterPriority) {
      items = items.filter((s) => s.priority === filterPriority);
    }
    return items;
  }, [data, filterPriority]);

  // Search dropdown — list all studies, filtered by input
  const dropdownStudies = useMemo(() => {
    const all = allStudiesData?.data ?? [];
    if (!searchInput.trim()) return all.slice(0, 12);
    const q = searchInput.toLowerCase();
    return all.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      s.study_type.replace(/_/g, " ").toLowerCase().includes(q) ||
      s.status.replace(/_/g, " ").toLowerCase().includes(q)
    ).slice(0, 12);
  }, [allStudiesData, searchInput]);

  // Studies for drilldown panel
  const drilldownStudies = useMemo(() => {
    if (!drilldownPhase) return [];
    const all = allStudiesData?.data ?? [];
    if (drilldownPhase === "__active__") {
      return all.filter((s) => s.phase === "active");
    }
    return all.filter((s) => s.phase === drilldownPhase);
  }, [allStudiesData, drilldownPhase]);

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

  const studyTypeLabel = (value: string) => {
    const option = STUDY_TYPE_OPTIONS.find((item) => item.value === value);
    return option
      ? t(`studies.studyTypes.${option.labelKey}`)
      : value.replace(/_/g, " ");
  };

  const statusLabel = (value: string) =>
    t(`studies.statuses.${value}`, { defaultValue: value.replace(/_/g, " ") });

  const priorityLabel = (value: string) =>
    t(`studies.priorities.${value}`, { defaultValue: value });

  const phaseLabel = (value: string) => {
    if (value === "__active__") return t("studies.phases.activeMetric");

    return t(`studies.phases.${value}`, { defaultValue: value.replace(/_/g, " ") });
  };

  const toggleStatusFilter = (value: string) => {
    setFilterStatus((current) => current === value ? null : value);
    setPage(1);
  };

  const toggleTypeFilter = (value: string) => {
    setFilterType((current) => current === value ? null : value);
    setPage(1);
  };

  const togglePriorityFilter = (value: string) => {
    setFilterPriority((current) => current === value ? null : value);
    setPage(1);
  };

  const clearFilters = () => {
    setFilterStatus(null);
    setFilterType(null);
    setFilterPriority(null);
    setFilterPhase(null);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div className="flex-1 min-w-0">
          <h1 className="page-title">{t("studies.list.title")}</h1>
          <p className="page-subtitle">
            {t("studies.list.subtitle")}
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
              title={t("studies.list.tableView")}
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
              title={t("studies.list.cardView")}
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          {/* Search dropdown — lists all studies */}
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
              placeholder={t("studies.list.searchPlaceholder")}
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
                  {dropdownStudies.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-text-ghost">
                      {t("studies.list.noSearchMatches", {
                        query: searchInput,
                      })}
                    </div>
                  ) : (
                    dropdownStudies.map((study) => {
                      const sColor = STATUS_COLORS[study.status] ?? "var(--text-muted)";
                      const pColor = PRIORITY_COLORS[study.priority] ?? "var(--text-muted)";
                      return (
                        <button
                          key={study.id}
                          type="button"
                          onClick={() => {
                            setShowDropdown(false);
                            setSearchInput("");
                            navigate(`/studies/${study.slug || study.id}`);
                          }}
                          className="w-full px-4 py-2.5 text-left hover:bg-surface-overlay transition-colors border-b border-border-subtle last:border-b-0"
                        >
                          <p className="text-sm font-medium text-text-primary truncate">{study.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-medium"
                              style={{ color: sColor }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sColor }} />
                              {statusLabel(study.status)}
                            </span>
                            <span className="text-[10px] text-text-ghost">{" · "}</span>
                            <span className="text-[10px]" style={{ color: pColor }}>
                              {priorityLabel(study.priority)}
                            </span>
                            <span className="text-[10px] text-text-ghost">{" · "}</span>
                            <span className="text-[10px] text-text-ghost">
                              {studyTypeLabel(study.study_type)}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                {(allStudiesData?.data?.length ?? 0) > 12 && !searchInput.trim() && (
                  <div className="px-4 py-2 text-center text-[10px] text-text-ghost border-t border-border-default bg-surface-base">
                    {t("studies.list.typeToFilter", {
                      count: allStudiesData?.data?.length ?? 0,
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {searchEngine === "solr" && (
            <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-success/10 text-success border border-success/20">
              {t("studies.list.solr")}
            </span>
          )}

          <HelpButton helpKey="studies" />

          <div className="ml-auto">
            <button
              type="button"
              onClick={() => navigate("/studies/create")}
              className="btn btn-primary"
            >
              <Plus size={16} />
              {t("studies.list.newStudy")}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: t("studies.metrics.total"), value: stats.total, icon: Briefcase, color: "var(--text-secondary)", phase: null as string | null },
              { label: t("studies.metrics.active"), value: stats.active_count, icon: Activity, color: "var(--success)", phase: "__active__" },
              { label: t("studies.metrics.preStudy"), value: stats.by_phase?.pre_study ?? 0, icon: FlaskConical, color: "var(--info)", phase: "pre_study" },
              { label: t("studies.metrics.inProgress"), value: stats.by_phase?.active ?? 0, icon: Loader2, color: "var(--warning)", phase: "active" },
              { label: t("studies.metrics.postStudy"), value: stats.by_phase?.post_study ?? 0, icon: Shield, color: "var(--domain-observation)", phase: "post_study" },
            ].map((metric) => {
              const Icon = metric.icon;
              const isDrilling = metric.phase !== null && drilldownPhase === metric.phase;
              return (
                <button
                  key={metric.label}
                  type="button"
                  onClick={() => {
                    if (metric.phase === null) {
                      setDrilldownPhase(null);
                    } else {
                      setDrilldownPhase(drilldownPhase === metric.phase ? null : metric.phase);
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
          {drilldownPhase && drilldownStudies.length > 0 && (
            <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-surface-overlay border-b border-border-default">
                <p className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  {t("studies.list.drilldownTitle", {
                    phase: phaseLabel(drilldownPhase),
                  })}
                  <span className="ml-1.5 text-text-ghost">({drilldownStudies.length})</span>
                </p>
                <button
                  type="button"
                  onClick={() => setDrilldownPhase(null)}
                  className="text-text-ghost hover:text-text-secondary transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="divide-y divide-border-subtle max-h-64 overflow-y-auto">
                {drilldownStudies.map((study: Study) => {
                  const sColor = STATUS_COLORS[study.status] ?? "var(--text-muted)";
                  const pColor = PRIORITY_COLORS[study.priority] ?? "var(--text-muted)";
                  return (
                    <button
                      key={study.id}
                      type="button"
                      onClick={() => navigate(`/studies/${study.slug || study.id}`)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-surface-overlay transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-text-primary truncate">{study.title}</p>
                        <p className="text-[10px] text-text-ghost truncate mt-0.5">
                          {studyTypeLabel(study.study_type)}
                          {study.principal_investigator?.name ? ` — ${study.principal_investigator.name}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{ backgroundColor: `${sColor}15`, color: sColor }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sColor }} />
                          {statusLabel(study.status)}
                        </span>
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-medium uppercase"
                          style={{ backgroundColor: `${pColor}15`, color: pColor }}
                        >
                          {priorityLabel(study.priority)}
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

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-text-ghost uppercase tracking-wider mr-1">
          {t("studies.list.filterLabels.status")}
        </span>
        {STATUS_OPTIONS.map((opt) => {
          const count = facets?.status?.[opt.value];
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleStatusFilter(opt.value)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                filterStatus === opt.value
                  ? "border-transparent"
                  : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary hover:border-surface-highlight",
              )}
              style={filterStatus === opt.value ? { backgroundColor: `${opt.color}20`, color: opt.color, borderColor: `${opt.color}40` } : undefined}
            >
              {statusLabel(opt.value)}
              {count != null && <span className="ml-1 text-[10px] opacity-60">({count})</span>}
            </button>
          );
        })}

        <span className="text-text-disabled mx-1">|</span>
        <span className="text-[10px] text-text-ghost uppercase tracking-wider mr-1">
          {t("studies.list.filterLabels.type")}
        </span>
        {STUDY_TYPE_OPTIONS.map((opt) => {
          const count = facets?.study_type?.[opt.value];
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleTypeFilter(opt.value)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                filterType === opt.value
                  ? "border-transparent"
                  : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary hover:border-surface-highlight",
              )}
              style={filterType === opt.value ? { backgroundColor: `${opt.color}20`, color: opt.color, borderColor: `${opt.color}40` } : undefined}
            >
              {t(`studies.studyTypes.${opt.labelKey}`)}
              {count != null && <span className="ml-1 text-[10px] opacity-60">({count})</span>}
            </button>
          );
        })}

        <span className="text-text-disabled mx-1">|</span>
        <span className="text-[10px] text-text-ghost uppercase tracking-wider mr-1">
          {t("studies.list.filterLabels.priority")}
        </span>
        {PRIORITY_OPTIONS.map((opt) => {
          const count = facets?.priority?.[opt.value];
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => togglePriorityFilter(opt.value)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                filterPriority === opt.value
                  ? "border-transparent"
                  : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary hover:border-surface-highlight",
              )}
              style={filterPriority === opt.value ? { backgroundColor: `${opt.color}20`, color: opt.color, borderColor: `${opt.color}40` } : undefined}
            >
              {priorityLabel(opt.value)}
              {count != null && <span className="ml-1 text-[10px] opacity-60">({count})</span>}
            </button>
          );
        })}

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-2 px-2 py-1 rounded text-[11px] text-critical hover:bg-critical/10 transition-colors"
          >
            <X size={12} className="inline mr-0.5" />
            {t("studies.list.clear")}
          </button>
        )}
      </div>

      {/* Content */}
      {viewMode === "table" ? (
        <StudyList
          studies={studies}
          onSelect={(slugOrId) => navigate(`/studies/${slugOrId}`)}
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
          ) : studies.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
              <Briefcase size={28} className="text-text-ghost mb-3" />
              <h3 className="text-lg font-semibold text-text-primary">
                {debouncedSearch
                  ? t("studies.list.empty.noMatchingTitle")
                  : t("studies.list.empty.noStudiesTitle")}
              </h3>
              <p className="mt-2 text-sm text-text-muted">
                {debouncedSearch
                  ? t("studies.list.empty.noResultsFor", {
                      query: debouncedSearch,
                    })
                  : t("studies.list.empty.createFirst")}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {studies.map((study) => (
                <StudyCard
                  key={study.id}
                  study={study}
                  onClick={() => navigate(`/studies/${study.slug || study.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
