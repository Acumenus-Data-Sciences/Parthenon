import { lazy, Suspense, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Database,
  Link2,
  Loader2,
  Play,
  RefreshCw,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/ui/MetricCard";
import { Panel } from "@/components/ui/Panel";
import {
  useAttachProjectFhirConnection,
  useIngestionProjects,
  useProjectFhirWorkspace,
  useStartProjectFhirSync,
} from "../hooks/useIngestionProjects";
import type { FhirProjectWorkspace } from "../api/ingestionApi";
import type { FhirConnection, FhirSyncRun } from "@/features/administration/api/adminApi";

type AuthAwareFhirConnection = FhirConnection & { auth_mode?: FhirConnection["auth_mode"] };

const FhirIngestionPanel = lazy(
  () => import("@/features/etl/components/FhirIngestionPanel"),
);

/* ── Status maps ──────────────────────────────────────────────────── */

const SYNC_STATUS: Record<string, { label: string; variant: "success" | "warning" | "info" | "critical" | "inactive" }> = {
  pending: { label: "Pending", variant: "inactive" },
  exporting: { label: "Exporting", variant: "info" },
  downloading: { label: "Downloading", variant: "info" },
  processing: { label: "Processing", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  ready: { label: "Ready", variant: "success" },
  failed: { label: "Failed", variant: "critical" },
};

const ACTIVE_STATUSES = ["pending", "exporting", "downloading", "processing"];

function statusBadge(status: string | null | undefined) {
  const s = SYNC_STATUS[status ?? ""] ?? { label: status ?? "Unconfigured", variant: "inactive" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Never" : date.toLocaleString();
}

function isActiveRun(run: Pick<FhirSyncRun, "status">): boolean {
  return ACTIVE_STATUSES.includes(run.status);
}

/* ── Props ─────────────────────────────────────────────────────────── */

interface FhirProjectWorkspacePageProps {
  activeProjectId: number | null;
  onActiveProjectChange: (id: number | null) => void;
}

/* ── Main component ────────────────────────────────────────────────── */

export default function FhirProjectWorkspacePage({
  activeProjectId,
  onActiveProjectChange,
}: FhirProjectWorkspacePageProps) {
  if (activeProjectId === null) {
    return <ProjectPicker onSelect={onActiveProjectChange} />;
  }

  return (
    <WorkspaceView
      projectId={activeProjectId}
      onBack={() => onActiveProjectChange(null)}
    />
  );
}

/* ── Project picker (no project selected) ──────────────────────────── */

function ProjectPicker({ onSelect }: { onSelect: (id: number) => void }) {
  const { data: projectsData, isLoading } = useIngestionProjects();
  const projects = projectsData?.data ?? [];

  return (
    <Panel
      header={
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Vulcan</h2>
          <p className="mt-1 text-sm text-text-muted">
            Connection-backed FHIR bulk sync. Attach a FHIR server to an ingestion project and run incremental or full exports.
          </p>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-text-muted">
          <Loader2 size={16} className="animate-spin" />
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<Database size={36} />}
          title="No ingestion projects"
          message="Create an ingestion project in the Ingestion tab first, then return here to attach a FHIR connection."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelect(project.id)}
              className="flex items-center justify-between rounded-lg border border-border-default bg-surface-base px-4 py-3 text-left transition-colors hover:border-success/40 hover:bg-surface-raised"
            >
              <div>
                <div className="text-sm font-medium text-text-primary">
                  {project.name}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-text-muted">
                  {statusBadge(project.last_fhir_sync_status ?? project.status)}
                  {project.fhir_connection_id && (
                    <span className="text-success">FHIR linked</span>
                  )}
                </div>
              </div>
              <ChevronDown size={14} className="-rotate-90 text-text-muted" />
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

/* ── Workspace view (project selected) ─────────────────────────────── */

function WorkspaceView({
  projectId,
  onBack,
}: {
  projectId: number;
  onBack: () => void;
}) {
  const workspaceQuery = useProjectFhirWorkspace(projectId);
  const attachMutation = useAttachProjectFhirConnection(projectId);
  const syncMutation = useStartProjectFhirSync(projectId);
  const [sandboxOpen, setSandboxOpen] = useState(false);

  if (workspaceQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-text-muted" />
      </div>
    );
  }

  if (workspaceQuery.error || !workspaceQuery.data?.project) {
    return (
      <Panel>
        <EmptyState
          title="Failed to load workspace"
          message="Could not load the FHIR workspace for this project."
          action={
            <button
              type="button"
              onClick={onBack}
              className="mt-3 text-sm text-success hover:underline"
            >
              Back to projects
            </button>
          }
        />
      </Panel>
    );
  }

  const workspace = workspaceQuery.data;
  const { project, fhir_connection: connection, recent_runs: runs, available_connections: availableConnections } = workspace;

  const activeRun = runs.find(isActiveRun) ?? (workspace.last_sync_run && isActiveRun(workspace.last_sync_run) ? workspace.last_sync_run : null);
  const syncInProgress = Boolean(activeRun) || syncMutation.isPending;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">{project.name}</h2>
          {statusBadge(project.last_fhir_sync_status ?? project.status)}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => workspaceQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-surface-highlight px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-lg border border-surface-highlight px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            All Projects
          </button>
        </div>
      </div>

      {/* Connection + Sync Controls */}
      {connection ? (
        <ConnectedView
          workspace={workspace}
          connection={connection}
          runs={runs}
          activeRun={activeRun}
          syncInProgress={syncInProgress}
          onSync={(full) => syncMutation.mutate(full)}
        />
      ) : (
        <AttachConnectionView
          availableConnections={availableConnections}
          isPending={attachMutation.isPending}
          onAttach={(connectionId) =>
            attachMutation.mutate({
              fhir_connection_id: connectionId,
              fhir_sync_mode: "bulk_group",
            })
          }
        />
      )}

      {/* Legacy sandbox */}
      <Panel>
        <button
          type="button"
          onClick={() => setSandboxOpen((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <Upload size={16} className="text-text-muted" />
            <div>
              <div className="text-sm font-medium text-text-primary">
                Bundle / NDJSON Sandbox
              </div>
              <div className="mt-0.5 text-xs text-text-muted">
                Ad-hoc upload for local validation and mapper spot checks
              </div>
            </div>
          </div>
          {sandboxOpen ? (
            <ChevronUp size={16} className="text-text-muted" />
          ) : (
            <ChevronDown size={16} className="text-text-muted" />
          )}
        </button>
        {sandboxOpen && (
          <div className="mt-4 border-t border-border-default pt-4">
            <Suspense
              fallback={
                <div className="flex items-center gap-2 py-6 text-sm text-text-muted">
                  <Loader2 size={16} className="animate-spin" />
                  Loading sandbox...
                </div>
              }
            >
              <FhirIngestionPanel />
            </Suspense>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ── Connected state ───────────────────────────────────────────────── */

function ConnectedView({
  workspace,
  connection,
  runs,
  activeRun,
  syncInProgress,
  onSync,
}: {
  workspace: FhirProjectWorkspace;
  connection: AuthAwareFhirConnection;
  runs: FhirSyncRun[];
  activeRun: FhirSyncRun | null;
  syncInProgress: boolean;
  onSync: (forceFull: boolean) => void;
}) {
  const project = workspace.project;
  const lastSyncAt = project.last_fhir_sync_at ?? connection.last_sync_at;

  return (
    <>
      {/* Connection card + actions */}
      <Panel
        header={
          <div className="flex items-center gap-2">
            <Link2 size={16} className="text-success" />
            <span className="text-sm font-medium text-text-primary">Attached Connection</span>
          </div>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-text-primary">
              {connection.site_name}
            </div>
            <div className="mt-1 text-xs text-text-muted">
              {connection.site_key} &middot; {connection.ehr_vendor}
              {connection.auth_mode === "none" && (
                <span className="ml-2 text-accent">anonymous</span>
              )}
            </div>
          </div>
          {statusBadge(connection.last_sync_status ?? (connection.is_active ? "ready" : "failed"))}
        </div>

        {/* Metric row */}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricCard
            label="Last Sync"
            value={formatDateTime(lastSyncAt)}
          />
          <MetricCard
            label="Incremental"
            value={connection.incremental_enabled ? "Enabled" : "Disabled"}
          />
          <MetricCard
            label="Last Records"
            value={connection.last_sync_records?.toLocaleString?.() ?? "0"}
          />
        </div>

        {/* Sync controls */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSync(false)}
            disabled={syncInProgress}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base transition-colors hover:bg-[#26BCA8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncInProgress ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            Incremental Sync
          </button>
          <button
            type="button"
            onClick={() => onSync(true)}
            disabled={syncInProgress}
            className="inline-flex items-center gap-2 rounded-lg border border-surface-highlight px-4 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={14} />
            Full Sync
          </button>
        </div>

        {activeRun && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-[#1A1710] px-3 py-2 text-xs text-accent">
            <Loader2 size={12} className="animate-spin" />
            Sync in progress — auto-refreshing every 10 seconds
          </div>
        )}
      </Panel>

      {/* Recent runs */}
      <SyncRunsTable runs={runs} />
    </>
  );
}

/* ── Attach connection (no connection linked yet) ─────────────────── */

function AttachConnectionView({
  availableConnections,
  isPending,
  onAttach,
}: {
  availableConnections: FhirConnection[];
  isPending: boolean;
  onAttach: (connectionId: number) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>("");

  return (
    <Panel
      header={
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-text-muted" />
          <span className="text-sm font-medium text-text-primary">FHIR Connection</span>
        </div>
      }
    >
      {availableConnections.length === 0 ? (
        <EmptyState
          icon={<Database size={28} />}
          title="No FHIR connections available"
          message="Ask an administrator to create a FHIR connection in Admin before attaching one here."
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="min-w-[280px] rounded-lg border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="">Select a FHIR connection</option>
            {availableConnections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.site_name} ({c.site_key})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onAttach(Number(selectedId))}
            disabled={!selectedId || isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base transition-colors hover:bg-[#26BCA8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Database size={14} />
            )}
            Attach Connection
          </button>
        </div>
      )}
    </Panel>
  );
}

/* ── Sync runs table ───────────────────────────────────────────────── */

function SyncRunsTable({ runs }: { runs: FhirSyncRun[] }) {
  return (
    <Panel
      header={
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-accent" />
          <span className="text-sm font-medium text-text-primary">Recent Sync Runs</span>
        </div>
      }
    >
      {runs.length === 0 ? (
        <EmptyState
          icon={<Activity size={28} />}
          title="No sync runs yet"
          message="Start a sync to begin pulling data from the attached FHIR server."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-default">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default bg-surface-raised">
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">Run</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-text-muted">Extracted</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-text-muted">Mapped</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-text-muted">Written</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-text-muted">Coverage</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-text-muted">Started</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className={cn(
                    "border-b border-border-default bg-surface-base",
                    isActiveRun(run) && "animate-pulse",
                  )}
                >
                  <td className="px-4 py-2.5 text-sm font-mono text-text-muted">#{run.id}</td>
                  <td className="px-4 py-2.5">{statusBadge(run.status)}</td>
                  <td className="px-4 py-2.5 text-right text-sm text-text-primary">
                    {run.records_extracted.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-text-primary">
                    {run.records_mapped.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-text-primary">
                    {run.records_written.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-text-primary">
                    {run.mapping_coverage == null ? "—" : `${run.mapping_coverage}%`}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-text-muted">
                    {formatDateTime(run.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
