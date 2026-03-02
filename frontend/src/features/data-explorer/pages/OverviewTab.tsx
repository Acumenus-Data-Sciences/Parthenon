import { Loader2, Users, Calendar, Activity, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useRecordCounts,
  useDemographics,
  useObservationPeriods,
} from "../hooks/useAchillesData";
import { RecordCountsPanel } from "../components/charts/RecordCountsPanel";
import { GenderPieChart } from "../components/charts/GenderPieChart";
import { DemographicsPyramid } from "../components/charts/DemographicsPyramid";
import { BoxPlotChart } from "../components/charts/BoxPlotChart";

interface OverviewTabProps {
  sourceId: number;
}

/** Format large numbers compactly */
function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Shimmer placeholder for loading state */
function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl border border-[#232328] bg-[#151518]",
        className,
      )}
    />
  );
}

interface MetricCardProps {
  icon: typeof Users;
  label: string;
  value: string | number;
  sub?: string;
}

function MetricCard({ icon: Icon, label, value, sub }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-[#232328] bg-[#151518] p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-[#8A857D]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
          {label}
        </span>
      </div>
      <p className="font-serif text-2xl font-bold text-[#F0EDE8]">{value}</p>
      {sub && (
        <p className="mt-0.5 text-xs text-[#5A5650]">{sub}</p>
      )}
    </div>
  );
}

export default function OverviewTab({ sourceId }: OverviewTabProps) {
  const recordCounts = useRecordCounts(sourceId);
  const demographics = useDemographics(sourceId);
  const obsPeriods = useObservationPeriods(sourceId);

  const isLoading =
    recordCounts.isLoading || demographics.isLoading || obsPeriods.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Metrics shimmer */}
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Shimmer key={i} className="h-24" />
          ))}
        </div>
        <Shimmer className="h-72" />
        <div className="grid grid-cols-3 gap-4">
          <Shimmer className="h-72" />
          <Shimmer className="col-span-2 h-72" />
        </div>
      </div>
    );
  }

  const personCount = demographics.data?.gender.reduce((s, d) => s + d.count, 0) ?? 0;
  const totalEvents = recordCounts.data?.reduce((s, d) => s + d.count, 0) ?? 0;
  const avgObsPeriod = obsPeriods.data?.durationDistribution?.median ?? 0;
  const obsCount = obsPeriods.data?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Key metrics row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Persons"
          value={formatCompact(personCount)}
          sub={`${personCount.toLocaleString()} total`}
        />
        <MetricCard
          icon={Calendar}
          label="Avg Obs Period"
          value={`${Math.round(avgObsPeriod)} days`}
          sub={`Median observation period`}
        />
        <MetricCard
          icon={Activity}
          label="Total Events"
          value={formatCompact(totalEvents)}
          sub={`Across all CDM tables`}
        />
        <MetricCard
          icon={Database}
          label="Obs Periods"
          value={formatCompact(obsCount)}
          sub={`${obsCount.toLocaleString()} total`}
        />
      </div>

      {/* Record counts */}
      {recordCounts.data && (
        <RecordCountsPanel data={recordCounts.data} />
      )}

      {/* Demographics row */}
      {demographics.data && (
        <div className="grid grid-cols-3 gap-4">
          <GenderPieChart data={demographics.data.gender} />
          <div className="col-span-2">
            <DemographicsPyramid
              gender={demographics.data.gender}
              age={demographics.data.age}
            />
          </div>
        </div>
      )}

      {/* Observation period box plot */}
      {obsPeriods.data?.durationDistribution && (
        <BoxPlotChart
          data={obsPeriods.data.durationDistribution}
          label="Observation Period Duration (days)"
        />
      )}
    </div>
  );
}
