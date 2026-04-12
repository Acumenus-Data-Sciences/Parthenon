import { useState } from "react";
import {
  Server,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  KeyRound,
  Clock,
  RefreshCw,
  Shield,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  BarChart3,
  Activity,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Panel, MetricCard } from "@/components/ui";
import {
  useFhirConnections,
  useCreateFhirConnection,
  useUpdateFhirConnection,
  useDeleteFhirConnection,
  useTestFhirConnection,
  useStartFhirSync,
  useFhirSyncRuns,
} from "../hooks/useFhirConnections";
import type { FhirConnection, FhirConnectionPayload, FhirTestResult, FhirSyncRun } from "../api/adminApi";

const VENDOR_LABELS: Record<string, string> = {
  epic: "Epic",
  cerner: "Cerner (Oracle Health)",
  other: "Other FHIR R4",
};

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-success/15 text-success",
  running: "bg-blue-400/15 text-blue-400",
  pending: "bg-amber-400/15 text-amber-400",
  exporting: "bg-blue-400/15 text-blue-400",
  downloading: "bg-indigo-400/15 text-indigo-400",
  processing: "bg-violet-400/15 text-violet-400",
  failed: "bg-critical/15 text-critical",
};

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const sec = Math.round((e - s) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Sync Run Row
// ──────────────────────────────────────────────────────────────────────────────

function SyncRunRow({ run }: { run: FhirSyncRun }) {
  const isActive = ["pending", "exporting", "downloading", "processing"].includes(run.status);

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border-subtle last:border-0 text-xs">
      <span className={`px-1.5 py-0.5 rounded-full font-medium min-w-[80px] text-center ${STATUS_BADGE[run.status] ?? "bg-surface-elevated text-text-muted"}`}>
        {isActive && <Loader2 size={10} className="inline animate-spin mr-1" />}
        {run.status}
      </span>
      <span className="text-text-ghost min-w-[90px]">{formatDate(run.created_at)}</span>
      <span className="text-text-ghost min-w-[60px]">{formatDuration(run.started_at, run.finished_at)}</span>
      <div className="flex items-center gap-3 text-text-muted">
        <span title="Extracted"><Download size={10} className="inline mr-0.5" />{run.records_extracted.toLocaleString()}</span>
        <span title="Mapped"><BarChart3 size={10} className="inline mr-0.5" />{run.records_mapped.toLocaleString()}</span>
        <span title="Written"><FileText size={10} className="inline mr-0.5" />{run.records_written.toLocaleString()}</span>
        {run.records_failed > 0 && (
          <span className="text-critical" title="Failed"><XCircle size={10} className="inline mr-0.5" />{run.records_failed.toLocaleString()}</span>
        )}
        {run.mapping_coverage != null && (
          <span title="Mapping coverage">{run.mapping_coverage}%</span>
        )}
      </div>
      {run.triggered_by_user && (
        <span className="ml-auto text-text-ghost">by {run.triggered_by_user.name}</span>
      )}
      {run.error_message && (
        <span className="ml-auto text-critical truncate max-w-[200px]" title={run.error_message}>{run.error_message}</span>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Sync Runs Panel
// ──────────────────────────────────────────────────────────────────────────────

function SyncRunsPanel({ connectionId }: { connectionId: number }) {
  const { data: runs, isLoading } = useFhirSyncRuns(
    connectionId,
    // Auto-refresh every 10s if there are active runs
    undefined, // initial — will be overridden below
  );
  const hasActive = runs?.some((r) => ["pending", "exporting", "downloading", "processing"].includes(r.status));
  const { data: liveRuns } = useFhirSyncRuns(connectionId, hasActive ? 10_000 : undefined);
  const displayRuns = liveRuns ?? runs;

  if (isLoading) {
    return <div className="flex items-center gap-2 py-2 text-xs text-text-ghost"><Loader2 size={12} className="animate-spin" /> Loading sync history...</div>;
  }

  if (!displayRuns || displayRuns.length === 0) {
    return <p className="text-xs text-text-ghost py-2">No sync runs yet.</p>;
  }

  return (
    <div className="mt-2 rounded-md border border-border-subtle bg-surface-base/50 overflow-hidden">
      <div className="px-3 py-1.5 bg-surface-overlay/50 text-[10px] font-medium text-text-ghost uppercase tracking-wider flex items-center gap-3">
        <span className="min-w-[80px]">Status</span>
        <span className="min-w-[90px]">Started</span>
        <span className="min-w-[60px]">Duration</span>
        <span>Metrics</span>
      </div>
      {displayRuns.slice(0, 10).map((run) => (
        <SyncRunRow key={run.id} run={run} />
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Connection Form Dialog
// ──────────────────────────────────────────────────────────────────────────────

function ConnectionDialog({
  conn,
  onClose,
}: {
  conn?: FhirConnection;
  onClose: () => void;
}) {
  const isEdit = !!conn;
  const create = useCreateFhirConnection();
  const update = useUpdateFhirConnection();

  const [form, setForm] = useState<FhirConnectionPayload>({
    site_name: conn?.site_name ?? "",
    site_key: conn?.site_key ?? "",
    ehr_vendor: conn?.ehr_vendor ?? "epic",
    fhir_base_url: conn?.fhir_base_url ?? "",
    token_endpoint: conn?.token_endpoint ?? "",
    client_id: conn?.client_id ?? "",
    private_key_pem: "",
    jwks_url: conn?.jwks_url ?? "",
    scopes: conn?.scopes ?? "system/*.read",
    group_id: conn?.group_id ?? "",
    export_resource_types: conn?.export_resource_types ?? "",
    target_source_id: conn?.target_source_id ?? undefined,
    is_active: conn?.is_active ?? false,
    incremental_enabled: conn?.incremental_enabled ?? true,
  });

  const [error, setError] = useState("");

  function set(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const payload = { ...form };
      if (isEdit && !payload.private_key_pem) {
        delete payload.private_key_pem;
      }
      if (isEdit) {
        await update.mutateAsync({ id: conn!.id, data: payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save";
      setError(msg);
    }
  }

  const pending = create.isPending || update.isPending;

  const inputCls =
    "w-full px-3 py-2 text-sm bg-surface-base border border-border-default rounded-lg text-text-primary placeholder:text-text-ghost focus:outline-none focus:border-success/50 focus:ring-1 focus:ring-success/30";
  const labelCls = "block text-xs font-medium text-text-muted mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-xl border border-border-default bg-surface-raised shadow-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-border-default">
            <h2 className="text-base font-semibold text-text-primary">
              {isEdit ? "Edit FHIR Connection" : "Add FHIR Connection"}
            </h2>
            <p className="text-xs text-text-ghost mt-0.5">
              Configure a SMART Backend Services connection to an EHR FHIR R4 endpoint.
            </p>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Site Name</label>
                <input className={inputCls} required value={form.site_name} onChange={(e) => set("site_name", e.target.value)} placeholder="Johns Hopkins Epic" />
              </div>
              <div>
                <label className={labelCls}>Site Key (slug)</label>
                <input className={inputCls} required pattern="[a-z0-9-]+" value={form.site_key} onChange={(e) => set("site_key", e.target.value)} placeholder="jhu-epic" />
              </div>
            </div>

            <div>
              <label className={labelCls}>EHR Vendor</label>
              <select className={inputCls} value={form.ehr_vendor} onChange={(e) => set("ehr_vendor", e.target.value)}>
                <option value="epic">Epic</option>
                <option value="cerner">Cerner (Oracle Health)</option>
                <option value="other">Other FHIR R4</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>FHIR Base URL</label>
              <input className={inputCls} required type="url" value={form.fhir_base_url} onChange={(e) => set("fhir_base_url", e.target.value)} placeholder="https://fhir.hospital.org/api/FHIR/R4" />
            </div>
            <div>
              <label className={labelCls}>Token Endpoint</label>
              <input className={inputCls} required type="url" value={form.token_endpoint} onChange={(e) => set("token_endpoint", e.target.value)} placeholder="https://fhir.hospital.org/oauth2/token" />
            </div>

            <div>
              <label className={labelCls}>Client ID</label>
              <input className={inputCls} required value={form.client_id} onChange={(e) => set("client_id", e.target.value)} placeholder="parthenon-app-id" />
            </div>

            <div>
              <label className={labelCls}>
                RSA Private Key (PEM)
                {isEdit && conn?.has_private_key && (
                  <span className="ml-2 text-success">Key uploaded</span>
                )}
              </label>
              <textarea
                className={`${inputCls} font-mono text-xs h-24 resize-none`}
                value={form.private_key_pem}
                onChange={(e) => set("private_key_pem", e.target.value)}
                placeholder={isEdit && conn?.has_private_key ? "Leave blank to keep existing key" : "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Scopes</label>
                <input className={inputCls} value={form.scopes} onChange={(e) => set("scopes", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Group ID (for Bulk Export)</label>
                <input className={inputCls} value={form.group_id} onChange={(e) => set("group_id", e.target.value)} placeholder="e1234567" />
              </div>
            </div>

            <div>
              <label className={labelCls}>Export Resource Types (comma-separated, blank = all)</label>
              <input className={inputCls} value={form.export_resource_types} onChange={(e) => set("export_resource_types", e.target.value)} placeholder="Patient,Condition,Encounter,MedicationRequest,Observation,Procedure" />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} className="accent-success" />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                <input type="checkbox" checked={form.incremental_enabled} onChange={(e) => set("incremental_enabled", e.target.checked)} className="accent-success" />
                Incremental sync
              </label>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md border border-critical/20 bg-critical/5 px-3 py-2 text-xs text-critical">
                <AlertCircle size={12} /> {error}
              </div>
            )}
          </div>

          <div className="px-6 py-3 border-t border-border-default flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors disabled:opacity-50">
              {pending && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? "Save Changes" : "Create Connection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Connection Card
// ──────────────────────────────────────────────────────────────────────────────

function ConnectionCard({
  conn,
  onEdit,
}: {
  conn: FhirConnection;
  onEdit: (c: FhirConnection) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRuns, setShowRuns] = useState(false);
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const [testResult, setTestResult] = useState<FhirTestResult | null>(null);
  const [syncError, setSyncError] = useState("");
  const deleteMut = useDeleteFhirConnection();
  const testMut = useTestFhirConnection();
  const syncMut = useStartFhirSync();

  const isSyncing = ["pending", "exporting", "downloading", "processing", "running"].includes(conn.last_sync_status ?? "");
  const canSync = conn.is_active && conn.has_private_key && !isSyncing && !syncMut.isPending;
  const hasLastSync = !!conn.last_sync_at;

  async function handleTest() {
    setTestResult(null);
    const result = await testMut.mutateAsync(conn.id);
    setTestResult(result);
  }

  async function handleSync(forceFull = false) {
    setSyncError("");
    setShowSyncMenu(false);
    try {
      await syncMut.mutateAsync({ id: conn.id, forceFull });
      setShowRuns(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start sync";
      setSyncError(msg);
    }
  }

  return (
    <Panel className="overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`flex items-center justify-center w-9 h-9 rounded-md flex-shrink-0 ${conn.is_active ? "bg-success/10" : "bg-surface-elevated"}`}>
            <Server size={16} className={conn.is_active ? "text-success" : "text-text-ghost"} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text-primary truncate">{conn.site_name}</h3>
              {conn.is_active && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-success/15 text-success">Active</span>
              )}
            </div>
            <p className="text-xs text-text-ghost mt-0.5">
              {VENDOR_LABELS[conn.ehr_vendor]} · <span className="font-mono">{conn.site_key}</span>
            </p>
            <p className="text-xs text-text-ghost mt-0.5 truncate font-mono max-w-md">{conn.fhir_base_url}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Start Sync — dropdown with incremental vs full */}
          <div className="relative">
            <div className="flex">
              <button
                type="button"
                onClick={() => handleSync(false)}
                disabled={!canSync}
                title={!conn.is_active ? "Activate connection first" : !conn.has_private_key ? "Upload a private key first" : isSyncing ? "Sync in progress" : conn.incremental_enabled && hasLastSync ? "Incremental Sync (only new data)" : "Full Sync"}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-l text-xs font-medium bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {syncMut.isPending || isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {conn.incremental_enabled && hasLastSync ? "Sync" : "Full Sync"}
              </button>
              <button
                type="button"
                onClick={() => setShowSyncMenu(!showSyncMenu)}
                disabled={!canSync}
                className="inline-flex items-center px-1 py-1.5 rounded-r border-l border-blue-400/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronDown size={10} />
              </button>
            </div>
            {showSyncMenu && (
              <div className="absolute right-0 mt-1 w-48 rounded-lg border border-border-default bg-surface-raised shadow-xl z-20">
                <button
                  type="button"
                  onClick={() => handleSync(false)}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-surface-overlay transition-colors rounded-t-lg"
                >
                  <div className="font-medium text-text-primary">
                    {conn.incremental_enabled && hasLastSync ? "Incremental Sync" : "Full Sync"}
                  </div>
                  <div className="text-[10px] text-text-ghost mt-0.5">
                    {conn.incremental_enabled && hasLastSync
                      ? "Only new/updated data since last sync"
                      : "Download all data from EHR"}
                  </div>
                </button>
                {conn.incremental_enabled && hasLastSync && (
                  <button
                    type="button"
                    onClick={() => handleSync(true)}
                    className="w-full px-3 py-2 text-left text-xs hover:bg-surface-overlay transition-colors border-t border-border-default rounded-b-lg"
                  >
                    <div className="font-medium text-amber-400">Force Full Sync</div>
                    <div className="text-[10px] text-text-ghost mt-0.5">
                      Re-download all data, dedup on write
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={handleTest} disabled={testMut.isPending} title="Test connection" className="p-1.5 rounded text-text-ghost hover:text-success hover:bg-success/10 transition-colors disabled:opacity-30">
            {testMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          </button>
          <button type="button" onClick={() => onEdit(conn)} title="Edit" className="p-1.5 rounded text-text-ghost hover:text-text-secondary hover:bg-surface-elevated transition-colors">
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => { if (confirm(`Delete "${conn.site_name}"?`)) deleteMut.mutate(conn.id); }}
            title="Delete"
            className="p-1.5 rounded text-text-ghost hover:text-critical hover:bg-critical/10 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-4 mt-3 text-xs text-text-ghost">
        <div className="flex items-center gap-1">
          <KeyRound size={11} />
          {conn.has_private_key ? <span className="text-success">Key uploaded</span> : <span className="text-critical">No key</span>}
        </div>
        <div className="flex items-center gap-1">
          <Clock size={11} />
          Last sync: {formatDate(conn.last_sync_at)}
        </div>
        {conn.last_sync_status && (
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[conn.last_sync_status] ?? "bg-surface-elevated text-text-muted"}`}>
            {isSyncing && <Loader2 size={9} className="inline animate-spin mr-0.5" />}
            {conn.last_sync_status}
          </span>
        )}
        {conn.last_sync_records > 0 && (
          <span className="font-['IBM_Plex_Mono',monospace]">{conn.last_sync_records.toLocaleString()} records</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={() => setShowRuns(!showRuns)} className="flex items-center gap-1 text-text-ghost hover:text-text-secondary transition-colors">
            Sync History {showRuns ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          <button type="button" onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-text-ghost hover:text-text-secondary transition-colors">
            Details {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>
      </div>

      {/* Sync error */}
      {syncError && (
        <div className="flex items-center gap-2 mt-2 rounded-md border border-critical/20 bg-critical/5 px-3 py-2 text-xs text-critical">
          <AlertCircle size={12} /> {syncError}
        </div>
      )}

      {/* Test result */}
      {testResult && (
        <div className={`mt-3 rounded-md border px-3 py-2 text-xs ${testResult.success ? "border-success/20 bg-success/5 text-success" : "border-critical/20 bg-critical/5 text-critical"}`}>
          <div className="flex items-center gap-2 font-medium">
            {testResult.success ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {testResult.message} ({testResult.elapsed_ms}ms)
          </div>
          <div className="mt-1 space-y-0.5">
            {testResult.steps.map((s) => (
              <div key={s.step} className="flex items-center gap-2 text-[10px]">
                {s.status === "ok" ? <CheckCircle2 size={10} className="text-success" /> : s.status === "warning" ? <AlertCircle size={10} className="text-amber-400" /> : <XCircle size={10} className="text-critical" />}
                <span className="font-mono">{s.step}</span>
                {s.detail && <span className="text-text-ghost">— {s.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync runs history */}
      {showRuns && <SyncRunsPanel connectionId={conn.id} />}

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-border-subtle grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div><span className="text-text-ghost">Token endpoint:</span> <span className="text-text-secondary font-mono break-all">{conn.token_endpoint}</span></div>
          <div><span className="text-text-ghost">Client ID:</span> <span className="text-text-secondary font-mono">{conn.client_id}</span></div>
          <div><span className="text-text-ghost">Scopes:</span> <span className="text-text-secondary">{conn.scopes}</span></div>
          <div><span className="text-text-ghost">Group ID:</span> <span className="text-text-secondary font-mono">{conn.group_id || "—"}</span></div>
          <div><span className="text-text-ghost">Resource types:</span> <span className="text-text-secondary">{conn.export_resource_types || "All supported"}</span></div>
          <div><span className="text-text-ghost">Incremental:</span> <span className="text-text-secondary">{conn.incremental_enabled ? "Enabled" : "Disabled"}</span>{conn.incremental_enabled && conn.last_sync_at && <span className="text-text-ghost"> (since {formatDate(conn.last_sync_at)})</span>}</div>
          <div><span className="text-text-ghost">Target source:</span> <span className="text-text-secondary">{conn.target_source?.source_name ?? "Not set"}</span></div>
          <div><span className="text-text-ghost">Sync runs:</span> <span className="text-text-secondary">{conn.sync_runs_count ?? 0}</span></div>
        </div>
      )}
    </Panel>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────────────────

export default function FhirConnectionsPage() {
  const { data: connections, isLoading } = useFhirConnections();
  const [dialogConn, setDialogConn] = useState<FhirConnection | undefined>(undefined);
  const [showDialog, setShowDialog] = useState(false);

  const activeCount = connections?.filter((c) => c.is_active).length ?? 0;
  const withKey = connections?.filter((c) => c.has_private_key).length ?? 0;
  const lastSync = connections?.reduce<string | null>((best, c) => {
    if (!c.last_sync_at) return best;
    if (!best || c.last_sync_at > best) return c.last_sync_at;
    return best;
  }, null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">FHIR EHR Connections</h1>
          <p className="mt-1 text-sm text-text-muted">
            Configure SMART Backend Services connections for FHIR R4 Bulk Data extraction from Epic, Cerner, and other EHR systems.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/fhir-sync-monitor"
            className="inline-flex items-center gap-2 rounded-lg border border-border-default px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated transition-colors"
          >
            <Activity size={16} />
            Sync Monitor
          </Link>
          <button
            type="button"
            onClick={() => { setDialogConn(undefined); setShowDialog(true); }}
            className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-medium text-surface-base hover:bg-success-dark transition-colors"
          >
            <Plus size={16} />
            Add Connection
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total Connections" value={connections?.length ?? 0} icon={<Server size={16} />} />
        <MetricCard label="Active" value={activeCount} icon={<CheckCircle2 size={16} />} />
        <MetricCard label="Keys Configured" value={withKey} icon={<Shield size={16} />} />
        <MetricCard label="Last Sync" value={lastSync ? formatDate(lastSync) : "Never"} icon={<RefreshCw size={16} />} />
      </div>

      {/* Connection list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={22} className="animate-spin text-success" />
        </div>
      ) : !connections || connections.length === 0 ? (
        <Panel className="flex flex-col items-center justify-center py-14 text-text-ghost">
          <Server size={36} className="mb-3 opacity-40" />
          <p className="text-sm font-medium text-text-muted">No FHIR connections configured</p>
          <p className="text-xs mt-1">Add a connection to begin extracting clinical data from an EHR via FHIR R4 Bulk Data.</p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              conn={conn}
              onEdit={(c) => { setDialogConn(c); setShowDialog(true); }}
            />
          ))}
        </div>
      )}

      {showDialog && (
        <ConnectionDialog
          conn={dialogConn}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}
