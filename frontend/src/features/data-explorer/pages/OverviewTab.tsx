import { useMemo } from "react";
import {
  Users,
  Calendar,
  Activity,
  Database,
  CheckCircle2,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useRecordCounts,
  useDemographics,
  useObservationPeriods,
  useAllDomainTrends,
} from "../hooks/useAchillesData";
import {
  formatCompact,
  ChartCard,
  DOMAIN_COLORS,
  GENDER_COLORS,
  CHART,
  tableToDomain,
  formatTableName,
} from "../components/charts/chartUtils";
import { Sparkline } from "../components/charts/Sparkline";
import { ProportionalBar } from "../components/charts/ProportionalBar";
import { DemographicsPyramid } from "../components/charts/DemographicsPyramid";
import { BoxPlotChart } from "../components/charts/BoxPlotChart";
import { YearOfBirthHistogram } from "../components/charts/YearOfBirthHistogram";
import { CumulativeObservationCurve } from "../components/charts/CumulativeObservationCurve";
import { DualAreaChart } from "../components/charts/DualAreaChart";
import { PeriodCountBar } from "../components/charts/PeriodCountBar";
import { DomainBarChart } from "../components/charts/DomainBarChart";
import { HeatmapChart } from "../components/charts/HeatmapChart";
import { LogScaleBar } from "../components/charts/LogScaleBar";
import type { RecordCount, DemographicDistribution } from "../types/dataExplorer";

interface OverviewTabProps {
  sourceId: number;
  onNavigateToDomain?: (domain: string) => void;
}

// ── Shimmer ──────────────────────────────────────────────────────────────────

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

// ── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  icon: Icon,
}: {
  title: string;
  icon?: typeof BarChart3;
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      {Icon && <Icon size={16} className="text-[#8A857D]" />}
      <h2 className="text-base font-bold uppercase tracking-wider text-[#C5C0B8]">
        {title}
      </h2>
      <div className="flex-1 border-b border-[#232328]" />
    </div>
  );
}

// ── Enhanced Metric Card ─────────────────────────────────────────────────────

interface MetricCardProps {
  icon: typeof Users;
  label: string;
  value: string | number;
  sub?: string;
  sparkData?: number[];
  sparkColor?: string;
  onClick?: () => void;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  sparkData,
  sparkColor,
  onClick,
}: MetricCardProps) {
  return (
    <div
      className="rounded-xl border border-[#232328] bg-[#151518] p-5 transition-colors hover:border-[#3A3A40]"
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon size={14} className="text-[#8A857D]" />
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
          {label}
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="font-serif text-2xl font-bold text-[#F0EDE8]">
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-[#5A5650]">{sub}</p>}
        </div>
        {sparkData && sparkData.length > 2 && (
          <Sparkline data={sparkData} color={sparkColor} />
        )}
      </div>
    </div>
  );
}

// ── Race Bar Chart (horizontal) ──────────────────────────────────────────────

function RaceBarChart({ data }: { data: DemographicDistribution[] }) {
  if (!data.length) return null;
  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 10);
  const max = sorted[0]?.count ?? 1;

  return (
    <div className="space-y-2">
      {sorted.map((d) => {
        const pct = (d.count / max) * 100;
        return (
          <div key={d.concept_id} className="flex items-center gap-3">
            <span className="w-24 truncate text-right text-xs text-[#C5C0B8]">
              {d.concept_name}
            </span>
            <div className="flex-1">
              <div
                className="h-5 rounded-r"
                style={{
                  width: `${Math.max(pct, 2)}%`,
                  backgroundColor: CHART.blue,
                  opacity: 0.7,
                }}
              />
            </div>
            <span className="w-14 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
              {formatCompact(d.count)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Derive domain treemap data from record counts ────────────────────────────

function buildTreemapData(
  recordCounts: RecordCount[],
): { name: string; size: number; color: string }[] {
  const domainMap = new Map<string, number>();

  for (const rc of recordCounts) {
    if (rc.count === 0) continue;
    const domain = tableToDomain(rc.table);
    if (domain === "person" || domain === "observation_period" || domain === "other")
      continue;
    const label = formatTableName(domain);
    domainMap.set(label, (domainMap.get(label) ?? 0) + rc.count);
  }

  return Array.from(domainMap.entries()).map(([name, size]) => ({
    name,
    size,
    color: DOMAIN_COLORS[name.toLowerCase()] ?? CHART.accent,
  }));
}

// ── Build heatmap data: aggregate temporal trends by year ────────────────────

function buildHeatmapData(
  trends: { domain: string; year_month: string; count: number }[],
): { row: string; col: string; value: number }[] {
  const yearMap = new Map<string, number>();

  for (const pt of trends) {
    const year = pt.year_month.slice(0, 4);
    const key = `${pt.domain}|${year}`;
    yearMap.set(key, (yearMap.get(key) ?? 0) + pt.count);
  }

  return Array.from(yearMap.entries()).map(([key, value]) => {
    const [row, col] = key.split("|");
    return { row, col, value };
  });
}

// ── Sparkline data: aggregate startYearMonth by year ─────────────────────────

function yearlySparkline(
  data: { year_month: string; count: number }[],
): number[] {
  const yearMap = new Map<string, number>();
  for (const d of data) {
    const year = String(d.year_month).slice(0, 4);
    yearMap.set(year, (yearMap.get(year) ?? 0) + d.count);
  }
  return Array.from(yearMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v);
}

// ═════════════════════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════════════════════

export default function OverviewTab({
  sourceId,
  onNavigateToDomain,
}: OverviewTabProps) {
  const recordCounts = useRecordCounts(sourceId);
  const demographics = useDemographics(sourceId);
  const obsPeriods = useObservationPeriods(sourceId);
  const domainTrends = useAllDomainTrends(sourceId);

  // ── Derived values ───────────────────────────────────────────────────────

  const personCount = useMemo(
    () => demographics.data?.gender.reduce((s, d) => s + d.count, 0) ?? 0,
    [demographics.data],
  );

  const totalEvents = useMemo(
    () => recordCounts.data?.reduce((s, d) => s + d.count, 0) ?? 0,
    [recordCounts.data],
  );

  const avgObsPeriod = obsPeriods.data?.durationDistribution?.median ?? 0;
  const obsCount = obsPeriods.data?.count ?? 0;

  const completeness = useMemo(() => {
    if (!recordCounts.data) return 0;
    const populated = recordCounts.data.filter((d) => d.count > 0).length;
    return Math.round((populated / recordCounts.data.length) * 100);
  }, [recordCounts.data]);

  const obsSparkData = useMemo(
    () => yearlySparkline(obsPeriods.data?.startYearMonth ?? []),
    [obsPeriods.data],
  );

  const treemapData = useMemo(
    () => buildTreemapData(recordCounts.data ?? []),
    [recordCounts.data],
  );

  const heatmapData = useMemo(
    () => buildHeatmapData(domainTrends.data),
    [domainTrends.data],
  );

  // ── Gender segments for proportional bar ─────────────────────────────────

  const genderSegments = useMemo(
    () =>
      (demographics.data?.gender ?? []).map((g) => ({
        label: g.concept_name,
        value: g.count,
        color: GENDER_COLORS[g.concept_name] ?? CHART.textMuted,
      })),
    [demographics.data],
  );

  const ethnicitySegments = useMemo(
    () =>
      (demographics.data?.ethnicity ?? []).map((e) => ({
        label: e.concept_name,
        value: e.count,
        color:
          e.concept_name.toLowerCase().includes("hispanic")
            ? CHART.gold
            : e.concept_name.toLowerCase().includes("not")
              ? CHART.accent
              : CHART.textMuted,
      })),
    [demographics.data],
  );

  // ═════════════════════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-8">
      {/* ── Section 1: Executive Summary ─────────────────────────────────── */}
      <section id="executive-summary">
        {/* Metric cards */}
        {recordCounts.isLoading || demographics.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Shimmer key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard
              icon={Users}
              label="Persons"
              value={formatCompact(personCount)}
              sub={`${personCount.toLocaleString()} total`}
              sparkData={obsSparkData}
              sparkColor={CHART.accent}
              onClick={() => onNavigateToDomain?.("person")}
            />
            <MetricCard
              icon={Calendar}
              label="Median Obs Duration"
              value={`${Math.round(avgObsPeriod).toLocaleString()} days`}
              sub={`${obsCount.toLocaleString()} observation periods`}
              onClick={() => onNavigateToDomain?.("observation_period")}
            />
            <MetricCard
              icon={Activity}
              label="Total Events"
              value={formatCompact(totalEvents)}
              sub="Across all CDM tables"
              onClick={() => onNavigateToDomain?.("condition")}
            />
            <MetricCard
              icon={CheckCircle2}
              label="Data Completeness"
              value={`${completeness}%`}
              sub={`${recordCounts.data?.filter((d) => d.count > 0).length ?? 0}/${recordCounts.data?.length ?? 0} tables populated`}
              onClick={() => onNavigateToDomain?.("condition")}
            />
          </div>
        )}
      </section>

      {/* ── Section 2: Population Demographics ───────────────────────────── */}
      <section id="demographics">
        <SectionHeader title="Population Demographics" icon={Users} />

        {demographics.isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            <Shimmer className="h-40" />
            <Shimmer className="col-span-2 h-72" />
          </div>
        ) : demographics.data ? (
          <div className="space-y-4">
            {/* Panel 1: Gender, Ethnicity & Race — Panel 2: Age Pyramid */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Left panel: Gender + Ethnicity + Race stacked in one card */}
              <div className="rounded-xl border border-[#232328] bg-[#151518] p-6">
                {/* Gender section */}
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8A857D]">
                  Gender Distribution
                </h3>
                <ProportionalBar segments={genderSegments} height={24} />

                {/* Divider */}
                <div className="my-4 border-t border-[#232328]" />

                {/* Ethnicity section */}
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8A857D]">
                  Ethnicity
                </h3>
                <ProportionalBar segments={ethnicitySegments} height={24} />

                {/* Divider */}
                <div className="my-4 border-t border-[#232328]" />

                {/* Race section */}
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#8A857D]">
                  Race <span className="font-normal normal-case text-[#5A5650]">Top 10</span>
                </h3>
                <RaceBarChart data={demographics.data.race} />
              </div>

              {/* Right panel: Age pyramid (2/3 width) */}
              <div className="lg:col-span-2">
                <DemographicsPyramid
                  gender={demographics.data.gender}
                  age={demographics.data.age}
                />
              </div>
            </div>

            {/* Year of Birth */}
            {demographics.data.yearOfBirth.length > 0 && (
              <ChartCard
                title="Year of Birth Distribution"
                subtitle="Histogram with smoothed density (gold)"
              >
                <YearOfBirthHistogram data={demographics.data.yearOfBirth} />
              </ChartCard>
            )}
          </div>
        ) : null}
      </section>

      {/* ── Section 3: Observation Period Analysis ───────────────────────── */}
      <section id="observation-periods">
        <SectionHeader title="Observation Period Analysis" icon={Calendar} />

        {obsPeriods.isLoading ? (
          <div className="grid grid-cols-2 gap-4">
            <Shimmer className="h-72" />
            <Shimmer className="h-72" />
          </div>
        ) : obsPeriods.data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* KM-style cumulative observation curve */}
              {obsPeriods.data.durationDistribution && (
                <ChartCard
                  title="Cumulative Observation Duration"
                  subtitle="Kaplan-Meier style: % of persons with observation >= X days"
                >
                  <CumulativeObservationCurve
                    distribution={obsPeriods.data.durationDistribution}
                  />
                </ChartCard>
              )}

              {/* Observation start/end temporal distribution */}
              {obsPeriods.data.startYearMonth.length > 0 && (
                <ChartCard
                  title="Observation Start / End Dates"
                  subtitle="Temporal distribution of observation periods"
                >
                  <DualAreaChart
                    primary={obsPeriods.data.startYearMonth}
                    secondary={obsPeriods.data.endYearMonth}
                  />
                </ChartCard>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Duration box plot */}
              {obsPeriods.data.durationDistribution && (
                <BoxPlotChart
                  data={obsPeriods.data.durationDistribution}
                  label="Observation Period Duration (days)"
                />
              )}

              {/* Periods per person */}
              {obsPeriods.data.periodsByPerson.length > 0 && (
                <ChartCard
                  title="Observation Periods per Person"
                  subtitle="Distribution of how many periods each person has"
                >
                  <PeriodCountBar data={obsPeriods.data.periodsByPerson} />
                </ChartCard>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Section 4: Domain Record Proportions ─────────────────────────── */}
      <section id="domain-proportions">
        <SectionHeader title="Domain Record Proportions" icon={Database} />

        {recordCounts.isLoading ? (
          <Shimmer className="h-80" />
        ) : treemapData.length > 0 ? (
          <ChartCard
            title="Clinical Data Domains"
            subtitle="Sorted by record count — click a domain to explore its concepts"
          >
            <DomainBarChart
              data={treemapData}
              onDomainClick={onNavigateToDomain}
            />
          </ChartCard>
        ) : null}
      </section>

      {/* ── Section 5: Data Density Heatmap ──────────────────────────────── */}
      <section id="data-density">
        <SectionHeader title="Data Density Over Time" icon={BarChart3} />

        {domainTrends.isLoading ? (
          <Shimmer className="h-60" />
        ) : heatmapData.length > 0 ? (
          <ChartCard
            title="Records by Domain and Year"
            subtitle="Color intensity indicates record volume per domain per year"
          >
            <HeatmapChart
              data={heatmapData}
              rowColors={DOMAIN_COLORS}
            />
          </ChartCard>
        ) : (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-12">
            <p className="text-sm text-[#8A857D]">
              Run Achilles to generate temporal trend data
            </p>
          </div>
        )}
      </section>

      {/* ── Section 6: Record Distribution (Log Scale) ───────────────────── */}
      <section id="record-distribution">
        <SectionHeader title="Record Distribution" icon={Activity} />

        {recordCounts.isLoading ? (
          <Shimmer className="h-96" />
        ) : recordCounts.data ? (
          <ChartCard
            title="CDM Table Record Counts"
            subtitle="Logarithmic scale — all tables visible regardless of magnitude"
          >
            <LogScaleBar data={recordCounts.data} />
          </ChartCard>
        ) : null}
      </section>
    </div>
  );
}
