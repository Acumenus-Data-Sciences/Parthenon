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
import { StudyList } from "../components/StudyList";
import { StudyCard } from "../components/StudyCard";
import { useStudies, useStudyStats } from "../hooks/useStudies";

const STUDY_TYPE_OPTIONS = [
  { value: "characterization", label: "Characterization", icon: BarChart3, color: "#2DD4BF" },
  { value: "population_level_estimation", label: "Population-Level Estimation", icon: Scale, color: "#60A5FA" },
  { value: "patient_level_prediction", label: "Patient-Level Prediction", icon: Brain, color: "#A78BFA" },
  { value: "comparative_effectiveness", label: "Comparative Effectiveness", icon: FlaskConical, color: "#F59E0B" },
  { value: "safety_surveillance", label: "Safety Surveillance", icon: Shield, color: "#E85A6B" },
  { value: "drug_utilization", label: "Drug Utilization", icon: Pill, color: "#34D399" },
  { value: "quality_improvement", label: "Quality Improvement", icon: Activity, color: "#FB923C" },
  { value: "custom", label: "Custom", icon: Wrench, color: "#8A857D" },
];

export default function StudiesPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "card">(() => {
    return (localStorage.getItem("studies-view") as "table" | "card") || "table";
  });

  const { data: stats } = useStudyStats();
  const { data, isLoading, error } = useStudies(page, debouncedSearch);

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

  const studies = useMemo(() => data?.data ?? [], [data]);

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

        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
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
        </div>

        {/* View toggle + Create */}
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
            { label: "Total", value: stats.total, icon: Briefcase, color: "#C5C0B8" },
            { label: "Active", value: stats.active_count, icon: Activity, color: "#2DD4BF" },
            { label: "Pre-Study", value: stats.by_phase?.pre_study ?? 0, icon: FlaskConical, color: "#60A5FA" },
            { label: "In Progress", value: stats.by_phase?.active ?? 0, icon: Loader2, color: "#F59E0B" },
            { label: "Post-Study", value: stats.by_phase?.post_study ?? 0, icon: Shield, color: "#A78BFA" },
          ].map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="flex items-center gap-3 rounded-lg border border-[#232328] bg-[#151518] px-4 py-3"
              >
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg"
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
              </div>
            );
          })}
        </div>
      )}

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
