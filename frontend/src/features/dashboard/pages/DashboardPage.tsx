import { Link } from "react-router-dom";
import {
  Database,
  Users,
  FlaskConical,
  Briefcase,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { MetricCard, Panel, StatusDot, Badge, Skeleton, EmptyState } from "@/components/ui";
import { useDashboardStats } from "../hooks/useDashboard";

export function DashboardPage() {
  const { data: stats, isLoading, error } = useDashboardStats();

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Unified Outcomes Research Platform
        </p>
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
