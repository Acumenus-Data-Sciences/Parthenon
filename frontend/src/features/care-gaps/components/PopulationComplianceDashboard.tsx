import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  AlertCircle,
  Users,
  Layers,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ComplianceRing } from "./ComplianceRing";
import { usePopulationSummary } from "../hooks/useCareGaps";
import type { BundlePopulationEntry } from "../types/careGap";

interface PopulationComplianceDashboardProps {
  sourceId: number | null;
}

function getComplianceColor(pct: number): string {
  if (pct >= 80) return "#2DD4BF";
  if (pct >= 50) return "#C9A227";
  return "#9B1B30";
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color }} />
        <span className="text-xs font-medium text-[#8A857D]">{label}</span>
      </div>
      <p
        className="font-['IBM_Plex_Mono',monospace] text-xl font-bold"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}

export function PopulationComplianceDashboard({
  sourceId,
}: PopulationComplianceDashboardProps) {
  const navigate = useNavigate();
  const { data, isLoading, error } = usePopulationSummary(sourceId);
  const [categoryFilter, setCategoryFilter] = useState("All");

  const filteredBundles = useMemo(() => {
    if (!data?.bundles) return [];
    if (categoryFilter === "All") return data.bundles;
    return data.bundles.filter(
      (b: BundlePopulationEntry) => b.disease_category === categoryFilter,
    );
  }, [data, categoryFilter]);

  const categories = useMemo(() => {
    if (!data?.bundles) return ["All"];
    const cats = new Set(
      data.bundles
        .map((b: BundlePopulationEntry) => b.disease_category)
        .filter(Boolean),
    );
    return ["All", ...Array.from(cats)] as string[];
  }, [data]);

  const totalOpenGaps = useMemo(
    () =>
      filteredBundles.reduce(
        (sum: number, b: BundlePopulationEntry) => sum + b.total_open_gaps,
        0,
      ),
    [filteredBundles],
  );

  if (!sourceId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <AlertCircle size={24} className="text-[#323238] mb-3" />
        <p className="text-sm text-[#8A857D]">
          Select a data source to view population compliance.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <AlertCircle size={24} className="text-[#E85A6B] mb-3" />
        <p className="text-sm text-[#E85A6B]">
          Failed to load population summary.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={Layers}
          label="Total Bundles"
          value={data.total_bundles.toLocaleString()}
          color="#2DD4BF"
        />
        <SummaryCard
          icon={Users}
          label="Total Patients"
          value={data.total_patients.toLocaleString()}
          color="#818CF8"
        />
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 flex items-center gap-4">
          <ComplianceRing
            percentage={data.avg_compliance}
            size="sm"
            label="Avg Compliance"
          />
        </div>
        <SummaryCard
          icon={ShieldAlert}
          label="Total Open Gaps"
          value={totalOpenGaps.toLocaleString()}
          color="#9B1B30"
        />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Activity size={14} className="text-[#8A857D]" />
        <span className="text-xs text-[#8A857D]">Filter by category:</span>
        <div className="flex items-center gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                categoryFilter === cat
                  ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
                  : "bg-[#151518] text-[#8A857D] hover:text-[#C5C0B8]",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Horizontal bar chart */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Bundle Compliance Comparison
        </h3>

        {filteredBundles.length === 0 ? (
          <p className="text-xs text-[#5A5650]">
            No bundles match the selected filter.
          </p>
        ) : (
          <div className="space-y-2">
            {filteredBundles.map((b: BundlePopulationEntry) => {
              const color = getComplianceColor(b.avg_compliance_pct);
              return (
                <button
                  key={b.bundle_code}
                  type="button"
                  onClick={() => {
                    // Navigate by searching for the bundle - use bundle_code as a proxy
                    navigate(`/care-gaps?search=${encodeURIComponent(b.bundle_code)}`);
                  }}
                  className="w-full text-left group"
                >
                  <div className="flex items-center gap-3">
                    {/* Label */}
                    <div className="w-40 shrink-0 truncate">
                      <span className="text-xs font-medium text-[#F0EDE8] group-hover:text-[#2DD4BF] transition-colors">
                        {b.condition_name}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="flex-1 h-6 rounded bg-[#0E0E11] overflow-hidden relative">
                      <div
                        className="h-full rounded transition-all duration-500"
                        style={{
                          width: `${Math.max(b.avg_compliance_pct, 1)}%`,
                          backgroundColor: color,
                          opacity: 0.8,
                        }}
                      />
                      {/* Patients label inside */}
                      <span className="absolute inset-y-0 right-2 flex items-center text-[10px] text-[#8A857D]">
                        {b.patient_count.toLocaleString()} pts
                      </span>
                    </div>

                    {/* Percent */}
                    <span
                      className="w-12 text-right font-['IBM_Plex_Mono',monospace] text-xs font-bold shrink-0"
                      style={{ color }}
                    >
                      {b.avg_compliance_pct.toFixed(0)}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
