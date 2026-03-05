import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { useStudies, useStudyStats } from "../hooks/useStudies";

const STUDY_TYPE_OPTIONS = [
  { value: "characterization", label: "Characterization", color: "#2DD4BF" },
  { value: "population_level_estimation", label: "PLE", color: "#60A5FA" },
  { value: "patient_level_prediction", label: "PLP", color: "#A78BFA" },
  { value: "comparative_effectiveness", label: "Comparative", color: "#F59E0B" },
  { value: "safety_surveillance", label: "Safety", color: "#E85A6B" },
  { value: "drug_utilization", label: "Drug Util", color: "#34D399" },
  { value: "quality_improvement", label: "QI", color: "#FB923C" },
  { value: "custom", label: "Custom", color: "#8A857D" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft", color: "#8A857D" },
  { value: "protocol_development", label: "Protocol Dev", color: "#60A5FA" },
  { value: "feasibility", label: "Feasibility", color: "#A78BFA" },
  { value: "irb_review", label: "IRB Review", color: "#F59E0B" },
  { value: "execution", label: "Execution", color: "#2DD4BF" },
  { value: "analysis", label: "Analysis", color: "#34D399" },
  { value: "published", label: "Published", color: "#22D3EE" },
  { value: "archived", label: "Archived", color: "#6B7280" },
];

const PRIORITY_OPTIONS = [
  { value: "critical", label: "Critical", color: "#E85A6B" },
  { value: "high", label: "High", color: "#F59E0B" },
  { value: "medium", label: "Medium", color: "#60A5FA" },
  { value: "low", label: "Low", color: "#8A857D" },
];

export default function StudiesPage() {
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

  const hasFilters = !!(filterStatus || filterType || filterPriority || filterPhase);

  const { data: stats } = useStudyStats();
  const { data, isLoading, error } = useStudies(page, debouncedSearch, {
    status: filterStatus ?? undefined,
    study_type: filterType ?? undefined,
    phase: filterPhase ?? undefined,
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filterStatus, filterType, filterPriority, filterPhase]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div className="flex-1 min-w-0">
          <h1 className="page-title">Studies</h1>
          <p className="page-subtitle">
            Orchestrate and manage federated research studies
          </p>
        </div>

        {/* Right side: view toggle, search, help, create */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center rounded-lg border border-[#232328] bg-[#0E0E11] overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "table"
                  ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                  : "text-[#5A5650] hover:text-[#C5C0B8]",
              )}
              title="Table view"
            >
              <List size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={cn(
                "p-2 transition-colors",
                viewMode === "card"
                  ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                  : "text-[#5A5650] hover:text-[#C5C0B8]",
              )}
              title="Card view"
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          {/* Search */}
          <div className="relative w-56">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5650]"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search studies..."
              className={cn(
                "w-full rounded-lg pl-9 pr-8 py-2 text-sm",
                "bg-[#0E0E11] border border-[#232328]",
                "text-[#F0EDE8] placeholder:text-[#5A5650]",
                "focus:outline-none focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40",
                "transition-colors",
              )}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#5A5650] hover:text-[#C5C0B8]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <HelpButton helpKey="studies" />

          {/* New Study */}
          <button
            type="button"
            onClick={() => navigate("/studies/create")}
            className="btn btn-primary"
          >
            <Plus size={16} />
            New Study
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, icon: Briefcase, color: "#C5C0B8", phase: null as string | null },
            { label: "Active", value: stats.active_count, icon: Activity, color: "#2DD4BF", phase: "__active__" },
            { label: "Pre-Study", value: stats.by_phase?.pre_study ?? 0, icon: FlaskConical, color: "#60A5FA", phase: "pre_study" },
            { label: "In Progress", value: stats.by_phase?.active ?? 0, icon: Loader2, color: "#F59E0B", phase: "active" },
            { label: "Post-Study", value: stats.by_phase?.post_study ?? 0, icon: Shield, color: "#A78BFA", phase: "post_study" },
          ].map((metric) => {
            const Icon = metric.icon;
            const isActive = metric.phase === null
              ? !hasFilters
              : metric.phase === "__active__"
                ? filterStatus === "execution"
                : filterPhase === metric.phase;
            return (
              <button
                key={metric.label}
                type="button"
                onClick={() => {
                  if (metric.phase === null) {
                    // "Total" — clear all filters
                    setFilterStatus(null);
                    setFilterType(null);
                    setFilterPriority(null);
                    setFilterPhase(null);
                  } else if (metric.phase === "__active__") {
                    // "Active" — filter to execution status
                    setFilterPhase(null);
                    setFilterType(null);
                    setFilterPriority(null);
                    setFilterStatus(filterStatus === "execution" ? null : "execution");
                  } else {
                    // Phase filters
                    setFilterStatus(null);
                    setFilterType(null);
                    setFilterPriority(null);
                    setFilterPhase(filterPhase === metric.phase ? null : metric.phase);
                  }
                }}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                  isActive
                    ? "border-[#2DD4BF]/30 bg-[#2DD4BF]/5 ring-1 ring-[#2DD4BF]/20"
                    : "border-[#232328] bg-[#151518] hover:border-[#323238] hover:bg-[#1C1C20]",
                )}
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
                  <p className="text-[10px] text-[#5A5650] uppercase tracking-wider">
                    {metric.label}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-[#5A5650] uppercase tracking-wider mr-1">Status</span>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilterStatus(filterStatus === opt.value ? null : opt.value)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
              filterStatus === opt.value
                ? "border-transparent"
                : "border-[#232328] bg-[#151518] text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#323238]",
            )}
            style={filterStatus === opt.value ? { backgroundColor: `${opt.color}20`, color: opt.color, borderColor: `${opt.color}40` } : undefined}
          >
            {opt.label}
          </button>
        ))}

        <span className="text-[#232328] mx-1">|</span>
        <span className="text-[10px] text-[#5A5650] uppercase tracking-wider mr-1">Type</span>
        {STUDY_TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilterType(filterType === opt.value ? null : opt.value)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
              filterType === opt.value
                ? "border-transparent"
                : "border-[#232328] bg-[#151518] text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#323238]",
            )}
            style={filterType === opt.value ? { backgroundColor: `${opt.color}20`, color: opt.color, borderColor: `${opt.color}40` } : undefined}
          >
            {opt.label}
          </button>
        ))}

        <span className="text-[#232328] mx-1">|</span>
        <span className="text-[10px] text-[#5A5650] uppercase tracking-wider mr-1">Priority</span>
        {PRIORITY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilterPriority(filterPriority === opt.value ? null : opt.value)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
              filterPriority === opt.value
                ? "border-transparent"
                : "border-[#232328] bg-[#151518] text-[#8A857D] hover:text-[#C5C0B8] hover:border-[#323238]",
            )}
            style={filterPriority === opt.value ? { backgroundColor: `${opt.color}20`, color: opt.color, borderColor: `${opt.color}40` } : undefined}
          >
            {opt.label}
          </button>
        ))}

        {hasFilters && (
          <button
            type="button"
            onClick={() => { setFilterStatus(null); setFilterType(null); setFilterPriority(null); setFilterPhase(null); }}
            className="ml-2 px-2 py-1 rounded text-[11px] text-[#E85A6B] hover:bg-[#E85A6B]/10 transition-colors"
          >
            <X size={12} className="inline mr-0.5" />
            Clear
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
          totalPages={data?.meta?.last_page ?? 1}
          total={data?.meta?.total ?? 0}
          perPage={data?.meta?.per_page ?? 20}
          onPageChange={setPage}
          searchActive={!!debouncedSearch}
        />
      ) : (
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 size={24} className="animate-spin text-[#8A857D]" />
            </div>
          ) : studies.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
              <Briefcase size={28} className="text-[#323238] mb-3" />
              <h3 className="text-lg font-semibold text-[#F0EDE8]">
                {debouncedSearch ? "No matching studies" : "No studies yet"}
              </h3>
              <p className="mt-2 text-sm text-[#8A857D]">
                {debouncedSearch
                  ? `No studies found for "${debouncedSearch}"`
                  : "Create your first study to orchestrate federated research."}
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
