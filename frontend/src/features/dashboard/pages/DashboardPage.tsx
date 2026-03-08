import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Database,
  Users,
  FlaskConical,
  Briefcase,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Activity,
  Clock,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import { MetricCard, Panel, StatusDot, Badge, Skeleton, EmptyState } from "@/components/ui";
import { useDashboardStats } from "../hooks/useDashboard";
import { SourceSelector } from "@/features/data-explorer/components/SourceSelector";
import { useRecordCounts, useDemographics, useObservationPeriods } from "@/features/data-explorer/hooks/useAchillesData";
import { ProportionalBar } from "@/features/data-explorer/components/charts/ProportionalBar";
import { DemographicsPyramid } from "@/features/data-explorer/components/charts/DemographicsPyramid";
import { Sparkline } from "@/features/data-explorer/components/charts/Sparkline";
import { formatCompact, GENDER_COLORS } from "@/features/data-explorer/components/charts/chartUtils";
import { HelpButton } from "@/features/help";

export function DashboardPage() {
  const { data: stats, isLoading, error } = useDashboardStats();
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);

  // Auto-select default source (or first source) when stats load
  useEffect(() => {
    if (stats?.sources.length && !selectedSourceId) {
      const defaultSrc = stats.sources.find((s: { id: number; is_default?: boolean }) => s.is_default);
      setSelectedSourceId(defaultSrc ? defaultSrc.id : stats.sources[0].id);
    }
  }, [stats?.sources, selectedSourceId]);

  const sourceId = selectedSourceId ?? 0;
  const { data: recordCounts, isLoading: recordsLoading } = useRecordCounts(sourceId);
  const { data: demographics, isLoading: demoLoading } = useDemographics(sourceId);
  const { data: obsPeriods, isLoading: obsLoading } = useObservationPeriods(sourceId);

  // Derived CDM metrics
  const personCount = recordCounts?.find((r) => r.table === "person")?.count ?? 0;
  const medianObsDuration = obsPeriods?.durationDistribution?.median ?? 0;
  const totalEvents = recordCounts
    ?.filter((r) => !["person", "observation_period"].includes(r.table))
    .reduce((sum, r) => sum + r.count, 0) ?? 0;
  const tablesWithData = recordCounts?.filter((r) => r.count > 0).length ?? 0;
  const totalTables = recordCounts?.length ?? 1;
  const completeness = Math.round((tablesWithData / totalTables) * 100);

  // Sparkline data from observation start dates (aggregated by year)
  const sparklineData = obsPeriods?.startYearMonth
    ?.reduce<Record<string, number>>((acc, d) => {
      const year = d.year_month.slice(0, 4);
      acc[year] = (acc[year] ?? 0) + d.count;
      return acc;
    }, {});
  const sparklineValues = sparklineData ? Object.values(sparklineData) : [];

  // Gender segments for proportional bar
  const genderSegments = demographics?.gender.map((g) => ({
    label: g.concept_name,
    value: g.count,
    color: GENDER_COLORS[g.concept_name] ?? "#8A857D",
  })) ?? [];

  const cdmLoading = recordsLoading || demoLoading || obsLoading;

  return (
    <div>
      {/* Page header */}
      <div className="page-header" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <div style={{ flex: 1 }}>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">
            Unified Outcomes Research Platform
          </p>
        </div>
        <HelpButton helpKey="dashboard" />
      </div>

      {/* Metric row */}
      {isLoading ? (
        <div className="grid-metrics" style={{ marginBottom: "var(--space-6)" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="card" height="120px" />
          ))}
        </div>
      ) : (
        <div className="grid-metrics" style={{ marginBottom: "var(--space-6)" }}>
          <MetricCard
            label="CDM Sources"
            value={stats?.sources.length ?? 0}
            description="Connected databases"
            icon={<Database size={18} />}
          />
          <MetricCard
            label="Active Cohorts"
            value={stats?.cohortCount ?? 0}
            description="Defined cohorts"
            icon={<Users size={18} />}
          />
          <MetricCard
            label="Running Jobs"
            value={stats?.activeJobCount ?? 0}
            description="Queued or executing"
            icon={<Briefcase size={18} />}
            variant={stats?.activeJobCount ? "info" : "default"}
          />
          <MetricCard
            label="DQD Failures"
            value={stats?.dqdFailures ?? 0}
            description="Quality check failures"
            icon={<AlertTriangle size={18} />}
            variant={stats?.dqdFailures ? "critical" : "success"}
          />
          <MetricCard
            label="Concept Sets"
            value={stats?.conceptSetCount ?? 0}
            description="Saved concept sets"
            icon={<FlaskConical size={18} />}
          />
        </div>
      )}

      {error && (
        <div className="alert-card alert-warning" style={{ marginBottom: "var(--space-6)" }}>
          <AlertTriangle size={18} className="alert-icon" />
          <div className="alert-content">
            <div className="alert-title">Unable to load dashboard data</div>
            <div className="alert-message">
              The API may be unavailable. Displaying cached data if available.
            </div>
          </div>
        </div>
      )}

      {/* CDM Characterization Section */}
      <div className="rounded-xl border border-[#232328] bg-[#0E0E11] p-6" style={{ marginBottom: "var(--space-6)" }}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#F0EDE8]">CDM Characterization</h2>
            <p className="mt-0.5 text-sm text-[#8A857D]">Clinical data profile for the selected source</p>
          </div>
          <div className="flex items-center gap-3">
            <SourceSelector value={selectedSourceId} onChange={setSelectedSourceId} />
            <Link
              to="/data-explorer"
              className="flex items-center gap-1 rounded-lg border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#C9A227] hover:border-[#C9A227]/30 hover:text-[#C9A227]"
            >
              View Full <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {sourceId > 0 ? (
          <>
            {/* CDM Metric Cards */}
            {cdmLoading ? (
              <div className="grid grid-cols-4 gap-4 mb-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-lg border border-[#232328] bg-[#151518] p-4">
                    <Skeleton height="16px" className="mb-2" />
                    <Skeleton height="28px" className="mb-1" />
                    <Skeleton height="12px" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4 mb-5">
                <CdmMetricCard
                  icon={<Activity size={16} className="text-[#2DD4BF]" />}
                  label="Persons"
                  value={formatCompact(personCount)}
                  sparkline={sparklineValues}
                  sparkColor="#2DD4BF"
                />
                <CdmMetricCard
                  icon={<Clock size={16} className="text-[#C9A227]" />}
                  label="Median Obs Duration"
                  value={`${formatCompact(medianObsDuration)} days`}
                />
                <CdmMetricCard
                  icon={<BarChart3 size={16} className="text-[#60A5FA]" />}
                  label="Total Events"
                  value={formatCompact(totalEvents)}
                />
                <CdmMetricCard
                  icon={<CheckCircle2 size={16} className="text-[#2DD4BF]" />}
                  label="Data Completeness"
                  value={`${completeness}%`}
                  sub={`${tablesWithData}/${totalTables} tables`}
                />
              </div>
            )}

            {/* Demographics: Gender bar + Age pyramid */}
            {cdmLoading ? (
              <div className="grid grid-cols-2 gap-4">
                <Skeleton height="120px" />
                <Skeleton height="220px" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
                    Gender Distribution
                  </h3>
                  {genderSegments.length > 0 ? (
                    <ProportionalBar segments={genderSegments} height={28} />
                  ) : (
                    <p className="text-sm text-[#5A5650]">No gender data</p>
                  )}
                </div>
                <DemographicsPyramid
                  gender={demographics?.gender ?? []}
                  age={demographics?.age ?? []}
                  height={220}
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10">
            <Database size={32} className="mb-3 text-[#5A5650]" />
            <p className="text-sm text-[#8A857D]">Select a data source to view characterization</p>
          </div>
        )}
      </div>

      {/* Two-column panels */}
      <div className="grid-two" style={{ marginBottom: "var(--space-6)" }}>
        {/* Source Health Panel */}
        <Panel
          header={
            <>
              <span className="panel-title">Source Health</span>
              <Link to="/data-sources" className="btn btn-ghost btn-sm" style={{ gap: "var(--space-1)" }}>
                View All <ArrowRight size={14} />
              </Link>
            </>
          }
        >
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <Skeleton count={3} />
            </div>
          ) : stats?.sources.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Dialect</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.sources.slice(0, 5).map((source) => (
                  <tr key={source.id}>
                    <td style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                      {source.source_name}
                    </td>
                    <td className="mono">{source.source_dialect}</td>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <StatusDot status="healthy" />
                        <span style={{ fontSize: "var(--text-sm)" }}>Healthy</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              icon={<Database size={32} />}
              title="No data sources"
              message="Connect a CDM database to get started."
              action={
                <Link to="/data-sources" className="btn btn-primary btn-sm">
                  Add Source
                </Link>
              }
            />
          )}
        </Panel>

        {/* Active Jobs Panel */}
        <Panel
          header={
            <>
              <span className="panel-title">Active Jobs</span>
              <Link to="/jobs" className="btn btn-ghost btn-sm" style={{ gap: "var(--space-1)" }}>
                View All <ArrowRight size={14} />
              </Link>
            </>
          }
        >
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <Skeleton count={3} />
            </div>
          ) : stats?.recentJobs.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentJobs.map((job) => (
                  <tr key={job.id}>
                    <td style={{ color: "var(--text-primary)" }}>{job.name}</td>
                    <td>
                      <Badge variant="default">{job.type}</Badge>
                    </td>
                    <td>
                      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        {job.status === "running" ? (
                          <Loader2 size={14} style={{ animation: "spin 1s linear infinite", color: "var(--info)" }} />
                        ) : (
                          <StatusDot status={job.status as "running" | "success" | "fail"} />
                        )}
                        <span style={{ fontSize: "var(--text-sm)" }}>{job.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              icon={<Briefcase size={32} />}
              title="No active jobs"
              message="Jobs will appear here when analyses are running."
            />
          )}
        </Panel>
      </div>

      {/* Second row */}
      <div className="grid-two">
        {/* Recent Cohort Activity */}
        <Panel
          header={
            <>
              <span className="panel-title">Recent Cohort Activity</span>
              <Link to="/cohort-definitions" className="btn btn-ghost btn-sm" style={{ gap: "var(--space-1)" }}>
                View All <ArrowRight size={14} />
              </Link>
            </>
          }
        >
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <Skeleton count={3} />
            </div>
          ) : stats?.recentCohorts.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cohort</th>
                  <th>Subjects</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentCohorts.map((cohort) => (
                  <tr key={cohort.id} className="clickable">
                    <td style={{ color: "var(--text-primary)" }}>{cohort.name}</td>
                    <td className="mono">
                      {cohort.person_count != null ? cohort.person_count.toLocaleString() : "—"}
                    </td>
                    <td>
                      <Badge
                        variant={
                          cohort.status === "active" ? "success" :
                          cohort.status === "error" ? "critical" :
                          "default"
                        }
                      >
                        {cohort.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              icon={<Users size={32} />}
              title="No cohorts yet"
              message="Create your first cohort definition to begin research."
              action={
                <Link to="/cohort-definitions" className="btn btn-primary btn-sm">
                  New Cohort
                </Link>
              }
            />
          )}
        </Panel>

        {/* Quick Actions */}
        <Panel
          header={<span className="panel-title">Quick Actions</span>}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Link to="/data-sources" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>
              <Database size={16} /> Connect a Data Source
            </Link>
            <Link to="/cohort-definitions" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>
              <Users size={16} /> Create Cohort Definition
            </Link>
            <Link to="/concept-sets" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>
              <FlaskConical size={16} /> Build Concept Set
            </Link>
            <Link to="/data-explorer" className="btn btn-secondary" style={{ justifyContent: "flex-start" }}>
              <Database size={16} /> Explore Data Quality
            </Link>
          </div>
        </Panel>
      </div>
    </div>
  );
}

/** Compact CDM metric card for the characterization section */
function CdmMetricCard({
  icon,
  label,
  value,
  sub,
  sparkline,
  sparkColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  sparkline?: number[];
  sparkColor?: string;
}) {
  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wider text-[#8A857D]">{label}</span>
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} width={60} height={20} color={sparkColor} />
        )}
      </div>
      <div className="mt-2 font-['IBM_Plex_Mono',monospace] text-xl font-semibold text-[#F0EDE8]">
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-xs text-[#5A5650]">{sub}</div>
      )}
    </div>
  );
}
