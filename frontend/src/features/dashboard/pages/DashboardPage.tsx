import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  Pill,
  Stethoscope,
  Microscope,
  Eye,
  CalendarDays,
  Skull,
  HeartPulse,
  Syringe,
} from "lucide-react";
import { MetricCard, Panel, StatusDot, Badge, Skeleton, EmptyState } from "@/components/ui";
import { useDashboardStats } from "../hooks/useDashboard";
import { useSourceStore } from "@/stores/sourceStore";
import { useRecordCounts, useDemographics, useObservationPeriods } from "@/features/data-explorer/hooks/useAchillesData";
import { ProportionalBar } from "@/features/data-explorer/components/charts/ProportionalBar";
import { DemographicsPyramid } from "@/features/data-explorer/components/charts/DemographicsPyramid";
import { Sparkline } from "@/features/data-explorer/components/charts/Sparkline";
import { formatCompact, GENDER_COLORS } from "@/features/data-explorer/components/charts/chartUtils";
import { HelpButton } from "@/features/help";

// Domain table → display config
const DOMAIN_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  condition_occurrence: { label: "Conditions", icon: <HeartPulse size={14} />, color: "var(--critical)" },
  drug_exposure: { label: "Drug Exposures", icon: <Pill size={14} />, color: "var(--info)" },
  procedure_occurrence: { label: "Procedures", icon: <Syringe size={14} />, color: "var(--accent)" },
  measurement: { label: "Measurements", icon: <Microscope size={14} />, color: "var(--success)" },
  observation: { label: "Observations", icon: <Eye size={14} />, color: "var(--domain-observation)" },
  visit_occurrence: { label: "Visits", icon: <CalendarDays size={14} />, color: 'var(--domain-device)' },
  drug_era: { label: "Drug Eras", icon: <Pill size={14} />, color: "#38BDF8" },
  condition_era: { label: "Condition Eras", icon: <HeartPulse size={14} />, color: "#FB7185" },
  device_exposure: { label: "Devices", icon: <Stethoscope size={14} />, color: "#4ADE80" },
  death: { label: "Deaths", icon: <Skull size={14} />, color: "var(--text-muted)" },
};

export function DashboardPage() {
  const { data: stats, isLoading, error } = useDashboardStats();
  const navigate = useNavigate();
  const activeSourceId = useSourceStore((s) => s.activeSourceId);

  const sourceId = activeSourceId ?? 0;
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

  // Sparkline from observation start dates
  const sparklineData = obsPeriods?.startYearMonth
    ?.reduce<Record<string, number>>((acc, d) => {
      const year = d.year_month.slice(0, 4);
      acc[year] = (acc[year] ?? 0) + d.count;
      return acc;
    }, {});
  const sparklineValues = sparklineData ? Object.values(sparklineData) : [];

  // Gender segments
  const genderSegments = demographics?.gender.map((g) => ({
    label: g.concept_name,
    value: g.count,
    color: GENDER_COLORS[g.concept_name] ?? "var(--text-muted)",
  })) ?? [];

  // Domain counts for the CDM breakdown panel
  const domainCounts = useMemo(() => {
    if (!recordCounts) return [];
    return recordCounts
      .filter((r) => r.table in DOMAIN_CONFIG && r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [recordCounts]);

  const maxDomainCount = domainCounts.length > 0 ? domainCounts[0].count : 1;

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
        <div className="grid grid-cols-4 gap-4" style={{ marginBottom: "var(--space-6)" }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="card" height="120px" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-4" style={{ marginBottom: "var(--space-6)" }}>
          <MetricCard
            label="CDM Sources"
            value={stats?.sources.length ?? 0}
            description={`${stats?.sources.filter(s => s.source_dialect === "postgresql").length ?? 0} PostgreSQL · ${personCount > 0 ? formatCompact(personCount) + " persons" : "No CDM loaded"}`}
            icon={<Database size={18} />}
            to="/data-sources"
          />
          <MetricCard
            label="Running Jobs"
            value={stats?.activeJobCount ?? 0}
            description={`${stats?.recentJobs.filter(j => j.status === "completed").length ?? 0} completed recently · ${stats?.recentJobs.filter(j => j.status === "failed").length ?? 0} failed`}
            icon={<Briefcase size={18} />}
            variant={stats?.activeJobCount ? "info" : "default"}
            to="/jobs"
          />
          <MetricCard
            label="Concept Sets"
            value={stats?.conceptSetCount ?? 0}
            description={`${tablesWithData}/${totalTables} CDM tables populated · ${completeness}% complete`}
            icon={<FlaskConical size={18} />}
            to="/concept-sets"
          />
          <MetricCard
            label="Active Cohorts"
            value={stats?.cohortCount ?? 0}
            description={`${stats?.recentCohorts.filter(c => c.person_count != null && c.person_count > 0).length ?? 0} generated · ${stats?.conceptSetCount ?? 0} concept sets`}
            icon={<Users size={18} />}
            to="/cohort-definitions"
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
      <div className="rounded-xl border border-border-default bg-surface-base p-6" style={{ marginBottom: "var(--space-6)" }}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">CDM Characterization</h2>
            <p className="mt-0.5 text-sm text-text-muted">Clinical data profile for the selected source</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/data-explorer"
              className="flex items-center gap-1 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-accent hover:border-accent/30 hover:text-accent"
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
                  <div key={i} className="rounded-lg border border-border-default bg-surface-raised p-4">
                    <Skeleton height="16px" className="mb-2" />
                    <Skeleton height="28px" className="mb-1" />
                    <Skeleton height="12px" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-4 mb-5">
                <CdmMetricCard
                  icon={<Activity size={16} className="text-success" />}
                  label="Persons"
                  value={formatCompact(personCount)}
                  sparkline={sparklineValues}
                  sparkColor="var(--success)"
                  onClick={() => navigate(`/data-explorer/${sourceId}`)}
                />
                <CdmMetricCard
                  icon={<Clock size={16} className="text-accent" />}
                  label="Median Obs Duration"
                  value={`${formatCompact(medianObsDuration)} days`}
                  onClick={() => navigate(`/data-explorer/${sourceId}`)}
                />
                <CdmMetricCard
                  icon={<BarChart3 size={16} className="text-info" />}
                  label="Total Events"
                  value={formatCompact(totalEvents)}
                  onClick={() => navigate(`/data-explorer/${sourceId}`)}
                />
                <CdmMetricCard
                  icon={<CheckCircle2 size={16} className="text-success" />}
                  label="Data Completeness"
                  value={`${completeness}%`}
                  sub={`${tablesWithData}/${totalTables} tables`}
                  onClick={() => navigate(`/data-explorer/${sourceId}`)}
                />
              </div>
            )}

            {/* Demographics + Domain Counts — two column */}
            {cdmLoading ? (
              <div className="grid grid-cols-2 gap-4">
                <Skeleton height="300px" />
                <Skeleton height="300px" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {/* Left: Gender + Age Pyramid combined */}
                <div className="rounded-lg border border-border-default bg-surface-raised p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Demographics
                  </h3>

                  {/* Gender bar */}
                  {genderSegments.length > 0 && (
                    <div className="mb-4">
                      <ProportionalBar segments={genderSegments} height={24} />
                    </div>
                  )}

                  {/* Age pyramid */}
                  <DemographicsPyramid
                    gender={demographics?.gender ?? []}
                    age={demographics?.age ?? []}
                    height={200}
                  />
                </div>

                {/* Right: CDM Domain Counts */}
                <div className="rounded-lg border border-border-default bg-surface-raised p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    CDM Domain Counts
                  </h3>

                  {domainCounts.length > 0 ? (
                    <div className="space-y-2.5">
                      {domainCounts.map((rc) => {
                        const config = DOMAIN_CONFIG[rc.table];
                        if (!config) return null;
                        const pct = (rc.count / maxDomainCount) * 100;
                        return (
                          <div key={rc.table}>
                            <div className="mb-1 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span style={{ color: config.color }}>{config.icon}</span>
                                <span className="text-xs font-medium text-text-secondary">{config.label}</span>
                              </div>
                              <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-primary">
                                {rc.count.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-surface-elevated">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: config.color, opacity: 0.7 }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-text-ghost">No domain data available</p>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-10">
            <Database size={32} className="mb-3 text-text-ghost" />
            <p className="text-sm text-text-muted">Select a data source to view characterization</p>
          </div>
        )}
      </div>

      {/* Recent Cohorts + Quick Actions */}
      <div className="grid-two" style={{ marginBottom: "var(--space-6)" }}>
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
                  <tr key={cohort.id} className="clickable" onClick={() => navigate(`/cohort-definitions/${cohort.id}`)} style={{ cursor: "pointer" }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate(`/cohort-definitions/${cohort.id}`); }}>
                    <td style={{ color: "var(--text-primary)" }}>{cohort.name}</td>
                    <td className="mono">
                      {cohort.person_count != null ? cohort.person_count.toLocaleString() : "\u2014"}
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

      {/* Source Health + Active Jobs (bottom — generally empty) */}
      <div className="grid-two">
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
                  <tr key={source.id} onClick={() => navigate(`/data-explorer/${source.id}`)} style={{ cursor: "pointer" }} className="clickable" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate(`/data-explorer/${source.id}`); }}>
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
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  sparkline?: number[];
  sparkColor?: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-border-default bg-surface-raised p-4 transition-colors hover:border-surface-highlight"
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</span>
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline data={sparkline} width={60} height={20} color={sparkColor} />
        )}
      </div>
      <div className="mt-2 font-['IBM_Plex_Mono',monospace] text-xl font-semibold text-text-primary">
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-xs text-text-ghost">{sub}</div>
      )}
    </div>
  );
}
