import { useState } from "react";
import {
  Activity,
  Server,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Clock,
  Download,
  FileText,
  BarChart3,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  TrendingUp,
  Database,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Panel, MetricCard } from "@/components/ui";
import { useFhirSyncDashboard } from "../hooks/useFhirConnections";
import type { FhirSyncRun, FhirSyncDashboard } from "../api/adminApi";

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-[#2DD4BF]/15 text-[#2DD4BF]",
  running: "bg-blue-400/15 text-blue-400",
  pending: "bg-amber-400/15 text-amber-400",
  exporting: "bg-blue-400/15 text-blue-400",
  downloading: "bg-indigo-400/15 text-indigo-400",
  processing: "bg-violet-400/15 text-violet-400",
  failed: "bg-[#E85A6B]/15 text-[#E85A6B]",
};

const ACTIVE_STATUSES = ["pending", "exporting", "downloading", "processing"];

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "--";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const sec = Math.round((e - s) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ──────────────────────────────────────────────────────────────────────────────
// Coverage Bar
// ──────────────────────────────────────────────────────────────────────────────

function CoverageBar({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[#5A5650]">--</span>;
  const color =
    value >= 80
      ? "bg-[#2DD4BF]"
      : value >= 50
        ? "bg-amber-400"
        : "bg-[#E85A6B]";

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="flex-1 h-1.5 bg-[#232328] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-[#8A857D] w-9 text-right">
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sync Timeline Chart (last 30 days)
// ──────────────────────────────────────────────────────────────────────────────

function SyncTimeline({
  timeline,
}: {
  timeline: FhirSyncDashboard["timeline"];
}) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-[#5A5650]">
        No sync activity in the last 30 days
      </div>
    );
  }

  const maxTotal = Math.max(...timeline.map((d) => d.total), 1);

  return (
    <div className="flex items-end gap-px h-24">
      {timeline.map((day) => {
        const height = (day.total / maxTotal) * 100;
        const failedHeight =
          day.total > 0 ? (day.failed / day.total) * height : 0;
        const completedHeight = height - failedHeight;

        return (
          <div
            key={day.date}
            className="flex-1 flex flex-col justify-end group relative min-w-[4px]"
            title={`${day.date}: ${day.completed} completed, ${day.failed} failed`}
          >
            {failedHeight > 0 && (
              <div
                className="bg-[#E85A6B]/60 rounded-t-sm"
                style={{ height: `${failedHeight}%` }}
              />
            )}
            {completedHeight > 0 && (
              <div
                className={`bg-[#2DD4BF]/60 ${failedHeight > 0 ? "" : "rounded-t-sm"}`}
                style={{ height: `${completedHeight}%` }}
              />
            )}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
              <div className="bg-[#1E1E23] border border-[#232328] rounded px-2 py-1 text-[10px] text-[#C5C0B8] whitespace-nowrap shadow-lg">
                {day.date}
                <br />
                {day.completed} ok / {day.failed} fail
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Connection Health Row
// ──────────────────────────────────────────────────────────────────────────────

function ConnectionHealthRow({
  conn,
}: {
  conn: FhirSyncDashboard["connections"][0];
}) {
  const isActive = ACTIVE_STATUSES.includes(conn.last_sync_status ?? "");

  return (
    <Link
      to={`/admin/fhir-connections`}
      className="flex items-center gap-3 px-3 py-2.5 border-b border-[#1E1E23] last:border-0 hover:bg-[#1E1E23]/30 transition-colors group"
    >
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${conn.is_active ? "bg-[#2DD4BF]" : "bg-[#5A5650]"}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#F0EDE8] truncate">
            {conn.site_name}
          </span>
          <span className="text-[10px] text-[#5A5650] font-mono">
            {conn.site_key}
          </span>
        </div>
      </div>
      <span className="text-[10px] text-[#5A5650] min-w-[60px]">
        {conn.total_runs} runs
      </span>
      {conn.last_sync_status && (
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium min-w-[70px] text-center ${STATUS_BADGE[conn.last_sync_status] ?? "bg-[#232328] text-[#8A857D]"}`}
        >
          {isActive && (
            <Loader2 size={8} className="inline animate-spin mr-0.5" />
          )}
          {conn.last_sync_status}
        </span>
      )}
      <span className="text-[10px] text-[#5A5650] min-w-[80px] text-right">
        {formatDate(conn.last_sync_at)}
      </span>
      <ChevronRight
        size={12}
        className="text-[#5A5650] group-hover:text-[#C5C0B8] transition-colors flex-shrink-0"
      />
    </Link>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Recent Run Row
// ──────────────────────────────────────────────────────────────────────────────

function RecentRunRow({ run }: { run: FhirSyncRun }) {
  const isActive = ACTIVE_STATUSES.includes(run.status);
  const trigUser = run.triggered_by ?? run.triggered_by_user;
  const [showError, setShowError] = useState(false);

  return (
    <div className="border-b border-[#1E1E23] last:border-0">
      <div className="flex items-center gap-3 px-3 py-2.5 text-xs">
        <span
          className={`px-1.5 py-0.5 rounded-full font-medium min-w-[80px] text-center ${STATUS_BADGE[run.status] ?? "bg-[#232328] text-[#8A857D]"}`}
        >
          {isActive && (
            <Loader2 size={10} className="inline animate-spin mr-1" />
          )}
          {run.status}
        </span>
        {run.connection && (
          <span className="text-[#8A857D] font-medium min-w-[100px] truncate">
            {run.connection.site_name}
          </span>
        )}
        <span className="text-[#5A5650] min-w-[80px]">
          {formatDate(run.created_at)}
        </span>
        <span className="text-[#5A5650] min-w-[55px]">
          {formatDuration(run.started_at, run.finished_at)}
        </span>
        <div className="flex items-center gap-3 text-[#8A857D] flex-1">
          <span title="Extracted">
            <Download size={10} className="inline mr-0.5" />
            {formatNumber(run.records_extracted)}
          </span>
          <span title="Written">
            <FileText size={10} className="inline mr-0.5" />
            {formatNumber(run.records_written)}
          </span>
          {run.records_failed > 0 && (
            <span className="text-[#E85A6B]" title="Failed">
              <XCircle size={10} className="inline mr-0.5" />
              {formatNumber(run.records_failed)}
            </span>
          )}
          <CoverageBar value={run.mapping_coverage} />
        </div>
        {trigUser && (
          <span className="text-[#5A5650] text-[10px]">{trigUser.name}</span>
        )}
        {run.error_message && (
          <button
            type="button"
            onClick={() => setShowError(!showError)}
            className="p-1 rounded text-[#E85A6B] hover:bg-[#E85A6B]/10 transition-colors"
            title="View error"
          >
            <AlertCircle size={12} />
          </button>
        )}
      </div>
      {showError && run.error_message && (
        <div className="mx-3 mb-2 rounded-md border border-[#E85A6B]/20 bg-[#E85A6B]/5 px-3 py-2 text-xs text-[#E85A6B] font-mono whitespace-pre-wrap break-all">
          {run.error_message}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Pipeline Funnel
// ──────────────────────────────────────────────────────────────────────────────

function PipelineFunnel({
  extracted,
  mapped,
  written,
  failed,
}: {
  extracted: number;
  mapped: number;
  written: number;
  failed: number;
}) {
  const steps = [
    { label: "Extracted", value: extracted, icon: Download, color: "text-blue-400" },
    { label: "Mapped", value: mapped, icon: BarChart3, color: "text-violet-400" },
    { label: "Written", value: written, icon: Database, color: "text-[#2DD4BF]" },
    { label: "Failed", value: failed, icon: XCircle, color: "text-[#E85A6B]" },
  ];

  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center gap-2">
          {i > 0 && i < 3 && (
            <ChevronRight size={12} className="text-[#5A5650]/40" />
          )}
          {i === 3 && (
            <span className="text-[#5A5650]/40 text-[10px] mx-1">|</span>
          )}
          <div className="flex items-center gap-1.5">
            <step.icon size={12} className={step.color} />
            <div className="text-center">
              <div className={`text-sm font-semibold ${step.color}`}>
                {formatNumber(step.value)}
              </div>
              <div className="text-[10px] text-[#5A5650]">{step.label}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Dashboard Page
// ──────────────────────────────────────────────────────────────────────────────

export default function FhirSyncDashboardPage() {
  const hasActiveRuns = (data: FhirSyncDashboard | undefined) =>
    data?.summary.active_runs ? data.summary.active_runs > 0 : false;

  const { data, isLoading } = useFhirSyncDashboard(
    // Auto-refresh every 10s when there are active runs, otherwise 60s
    undefined,
  );

  // Determine refresh interval dynamically
  const refreshInterval = hasActiveRuns(data) ? 10_000 : 60_000;
  const { data: liveData } = useFhirSyncDashboard(refreshInterval);
  const dashboard = liveData ?? data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#2DD4BF]" />
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="text-center py-20 text-[#5A5650]">
        Failed to load dashboard data.
      </div>
    );
  }

  const s = dashboard.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/fhir-connections"
            className="p-1.5 rounded-md text-[#5A5650] hover:text-[#C5C0B8] hover:bg-[#232328] transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#F0EDE8]">
              FHIR Sync Monitor
            </h1>
            <p className="mt-0.5 text-sm text-[#8A857D]">
              Real-time ETL pipeline monitoring across all FHIR connections
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#5A5650]">
          {s.active_runs > 0 && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-400/10 text-blue-400 font-medium">
              <Loader2 size={10} className="animate-spin" />
              {s.active_runs} active
            </span>
          )}
          <span className="flex items-center gap-1">
            <RefreshCw size={10} />
            {hasActiveRuns(dashboard) ? "10s" : "60s"} refresh
          </span>
        </div>
      </div>

      {/* Top-level Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Connections"
          value={`${s.active_connections}/${s.total_connections}`}
          icon={<Server size={16} />}
          to="/admin/fhir-connections"
        />
        <MetricCard
          label="Total Runs"
          value={s.total_runs}
          icon={<Activity size={16} />}
          to="/admin/fhir-connections"
        />
        <MetricCard
          label="Completed"
          value={s.completed_runs}
          icon={<CheckCircle2 size={16} />}
          to="/admin/fhir-connections"
        />
        <MetricCard
          label="Failed"
          value={s.failed_runs}
          icon={<XCircle size={16} />}
          to="/admin/fhir-connections"
        />
        <MetricCard
          label="Records Written"
          value={formatNumber(s.total_written)}
          icon={<Database size={16} />}
          to="/admin/fhir-connections"
        />
        <MetricCard
          label="Avg Coverage"
          value={s.avg_coverage != null ? `${s.avg_coverage}%` : "--"}
          icon={<TrendingUp size={16} />}
          to="/admin/fhir-connections"
        />
      </div>

      {/* Pipeline Funnel + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={14} className="text-[#2DD4BF]" />
            <h2 className="text-sm font-semibold text-[#F0EDE8]">
              Pipeline Throughput
            </h2>
            <span className="text-[10px] text-[#5A5650] ml-auto">
              All-time totals
            </span>
          </div>
          <PipelineFunnel
            extracted={s.total_extracted}
            mapped={s.total_mapped}
            written={s.total_written}
            failed={s.total_failed}
          />
          {s.avg_coverage != null && (
            <div className="mt-4 pt-3 border-t border-[#1E1E23]">
              <div className="flex items-center justify-between text-xs text-[#8A857D] mb-1">
                <span>Average mapping coverage</span>
                <span className="font-medium">{s.avg_coverage}%</span>
              </div>
              <CoverageBar value={s.avg_coverage} />
            </div>
          )}
        </Panel>

        <Panel>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={14} className="text-[#2DD4BF]" />
            <h2 className="text-sm font-semibold text-[#F0EDE8]">
              Sync Activity (30 days)
            </h2>
          </div>
          <SyncTimeline timeline={dashboard.timeline} />
          <div className="flex items-center gap-4 mt-2 text-[10px] text-[#5A5650]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-[#2DD4BF]/60" />
              Completed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-[#E85A6B]/60" />
              Failed
            </span>
          </div>
        </Panel>
      </div>

      {/* Connection Health + Recent Runs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Connection Health */}
        <Panel className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <Server size={14} className="text-[#2DD4BF]" />
            <h2 className="text-sm font-semibold text-[#F0EDE8]">
              Connection Health
            </h2>
          </div>
          {dashboard.connections.length === 0 ? (
            <p className="text-xs text-[#5A5650] py-4 text-center">
              No connections configured
            </p>
          ) : (
            <div className="rounded-md border border-[#1E1E23] overflow-hidden">
              {dashboard.connections.map((conn) => (
                <ConnectionHealthRow key={conn.id} conn={conn} />
              ))}
            </div>
          )}
        </Panel>

        {/* Recent Runs */}
        <Panel className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-[#2DD4BF]" />
            <h2 className="text-sm font-semibold text-[#F0EDE8]">
              Recent Sync Runs
            </h2>
            <span className="text-[10px] text-[#5A5650] ml-auto">
              Last 20 across all connections
            </span>
          </div>
          {dashboard.recent_runs.length === 0 ? (
            <p className="text-xs text-[#5A5650] py-4 text-center">
              No sync runs yet
            </p>
          ) : (
            <div className="rounded-md border border-[#1E1E23] overflow-hidden">
              <div className="px-3 py-1.5 bg-[#1E1E23]/50 text-[10px] font-medium text-[#5A5650] uppercase tracking-wider flex items-center gap-3">
                <span className="min-w-[80px]">Status</span>
                <span className="min-w-[100px]">Connection</span>
                <span className="min-w-[80px]">Started</span>
                <span className="min-w-[55px]">Duration</span>
                <span className="flex-1">Metrics</span>
              </div>
              {dashboard.recent_runs.map((run) => (
                <RecentRunRow key={run.id} run={run} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
