import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Plus } from "lucide-react";
import { Panel, Badge, StatusDot, Button, type BadgeVariant, type StatusDotVariant } from "@/components/ui";
import { useServiceDetail } from "../hooks/useAiProviders";
import {
  usePacsConnections,
  useTestPacsConnection,
  useRefreshPacsStats,
  useDeletePacsConnection,
  useSetDefaultPacs,
} from "../hooks/usePacsConnections";
import PacsConnectionCard from "../components/PacsConnectionCard";
import PacsConnectionFormModal from "../components/PacsConnectionFormModal";
import PacsStudyBrowser from "../components/PacsStudyBrowser";
import ChromaStudioPanel from "../components/ChromaStudioPanel";
import type { PacsConnection } from "../api/pacsApi";

const STATUS_MAP: Record<string, { badge: BadgeVariant; dot: StatusDotVariant }> = {
  healthy:  { badge: "success",  dot: "healthy" },
  degraded: { badge: "warning",  dot: "degraded" },
  down:     { badge: "critical", dot: "critical" },
};

const LEVEL_COLORS: Record<string, string> = {
  error: "text-destructive",
  warning: "text-amber-500",
  warn: "text-amber-500",
  info: "text-blue-400",
  debug: "text-muted-foreground",
};

export default function ServiceDetailPage() {
  const { key = "" } = useParams<{ key: string }>();
  const { data, isLoading, isFetching, refetch } = useServiceDetail(key);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded-lg border border-border bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border border-border bg-muted" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Link to="/admin/system-health" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to System Health
        </Link>
        <Panel>
          <p className="text-muted-foreground">Service not found.</p>
        </Panel>
      </div>
    );
  }

  const { service, logs, metrics } = data;
  const { badge, dot } = STATUS_MAP[service.status] ?? STATUS_MAP.down;
  const metricEntries = Object.entries(metrics).filter(([, v]) => v !== null && typeof v !== "object");
  const darkstarPackageKeys = key === "darkstar" ? new Set(["ohdsi_packages", "posit_packages"]) : new Set<string>();
  const nestedMetrics = Object.entries(metrics).filter(([k, v]) => typeof v === "object" && v !== null && !darkstarPackageKeys.has(k));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link to="/admin/system-health" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> System Health
          </Link>
          <h1 className="text-2xl font-bold text-foreground">{service.name}</h1>
          <p className="mt-1 text-muted-foreground">{service.message}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={badge}>{service.status}</Badge>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status banner */}
      <Panel>
        <div className="flex items-center gap-3">
          <StatusDot status={dot} />
          <span className="font-semibold text-foreground">{service.name}</span>
          <Badge variant={badge}>{service.status}</Badge>
          {data.checked_at && (
            <span className="ml-auto text-xs text-muted-foreground">
              Checked at {new Date(data.checked_at).toLocaleTimeString()}
            </span>
          )}
        </div>
      </Panel>

      {/* Solr manage link */}
      {key === "solr" && (
        <div>
          <Link to="/admin/solr">
            <Button variant="primary" size="sm">
              Manage Solr Cores
            </Button>
          </Link>
        </div>
      )}

      {/* Orthanc PACS management */}
      {key === "orthanc" && <PacsManagementSection />}

      {/* ChromaDB Studio */}
      {key === "chromadb" && <ChromaStudioPanel />}

      {/* Darkstar package versions */}
      {key === "darkstar" && <DarkstarPackagesPanel metrics={metrics} />}

      {/* Metrics */}
      {metricEntries.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Metrics</h2>
          <Panel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
              {metricEntries.map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-muted-foreground">{formatLabel(k)}</p>
                  <p className="font-medium text-foreground">{formatValue(v)}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {/* Nested metrics (e.g. Solr cores) */}
      {nestedMetrics.map(([section, obj]) => (
        <div key={section}>
          <h2 className="mb-3 text-lg font-semibold capitalize text-foreground">{formatLabel(section)}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.entries(obj as Record<string, unknown>).map(([name, vals]) => (
              <Panel key={name}>
                <p className="mb-2 font-semibold capitalize text-foreground">{name}</p>
                {typeof vals === "object" && vals !== null ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {Object.entries(vals as Record<string, unknown>).map(([mk, mv]) => (
                      <div key={mk} className="flex justify-between">
                        <span className="text-muted-foreground">{formatLabel(mk)}</span>
                        <span className="font-medium text-foreground">{formatValue(mv)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-foreground">{formatValue(vals)}</p>
                )}
              </Panel>
            ))}
          </div>
        </div>
      ))}

      {/* Logs */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Recent Logs
          <span className="ml-2 text-sm font-normal text-muted-foreground">({logs.length} entries)</span>
        </h2>
        {logs.length === 0 ? (
          <Panel>
            <p className="text-sm text-muted-foreground">No recent log entries available.</p>
          </Panel>
        ) : (
          <Panel className="max-h-[600px] overflow-y-auto">
            <div className="space-y-0.5 font-mono text-xs">
              {[...logs].reverse().map((entry, i) => (
                <div key={i} className="flex gap-3 border-b border-border/30 py-1.5 last:border-0">
                  <span className="shrink-0 text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
                  <span className={`shrink-0 w-14 text-right font-semibold uppercase ${LEVEL_COLORS[entry.level] ?? "text-foreground"}`}>
                    {entry.level}
                  </span>
                  <span className="min-w-0 break-all text-foreground/90 whitespace-pre-wrap">{entry.message}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

function PacsManagementSection() {
  const { data: connections, isLoading } = usePacsConnections();
  const testMut = useTestPacsConnection();
  const refreshMut = useRefreshPacsStats();
  const deleteMut = useDeletePacsConnection();
  const setDefaultMut = useSetDefaultPacs();

  const [editConn, setEditConn] = useState<PacsConnection | null | undefined>(null);
  const [browseConn, setBrowseConn] = useState<PacsConnection | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);

  async function handleTest(id: number) {
    setTestingId(id);
    try {
      await testMut.mutateAsync(id);
    } finally {
      setTestingId(null);
    }
  }

  async function handleRefresh(id: number) {
    setRefreshingId(id);
    try {
      await refreshMut.mutateAsync(id);
    } finally {
      setRefreshingId(null);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">PACS Connections</h2>
        <Button variant="primary" size="sm" onClick={() => setEditConn(undefined)}>
          <Plus className="mr-1 h-4 w-4" />
          Add Connection
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {[1, 2].map((n) => (
            <div key={n} className="h-36 animate-pulse rounded-xl border border-border bg-muted" />
          ))}
        </div>
      ) : connections && connections.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {connections.map((conn) => (
            <PacsConnectionCard
              key={conn.id}
              connection={conn}
              onTest={handleTest}
              onRefresh={handleRefresh}
              onEdit={(c) => setEditConn(c)}
              onDelete={(id) => deleteMut.mutate(id)}
              onBrowse={(c) => setBrowseConn(c)}
              onSetDefault={(id) => setDefaultMut.mutate(id)}
              isTesting={testingId === conn.id}
              isRefreshing={refreshingId === conn.id}
            />
          ))}
        </div>
      ) : (
        <Panel>
          <p className="text-sm text-muted-foreground">No PACS connections configured.</p>
        </Panel>
      )}

      <PacsConnectionFormModal
        isOpen={editConn !== null}
        onClose={() => setEditConn(null)}
        editConnection={editConn === undefined ? null : (editConn ?? null)}
      />

      <PacsStudyBrowser
        connection={browseConn}
        onClose={() => setBrowseConn(null)}
      />
    </div>
  );
}

function DarkstarPackagesPanel({ metrics }: { metrics: Record<string, unknown> }) {
  const ohdsiPkgs = metrics.ohdsi_packages as Record<string, string> | undefined;
  const positPkgs = metrics.posit_packages as Record<string, string> | undefined;

  if (!ohdsiPkgs && !positPkgs) return null;

  return (
    <div className="space-y-4">
      {ohdsiPkgs && Object.keys(ohdsiPkgs).length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            OHDSI HADES Packages
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({Object.keys(ohdsiPkgs).length} installed)
            </span>
          </h2>
          <Panel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(ohdsiPkgs).map(([name, version]) => (
                <div key={name} className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-muted-foreground truncate">{name}</span>
                  <span className="shrink-0 font-mono text-sm font-medium text-foreground">{version}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}

      {positPkgs && Object.keys(positPkgs).length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Posit / CRAN Packages
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({Object.keys(positPkgs).length} installed)
            </span>
          </h2>
          <Panel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
              {Object.entries(positPkgs).map(([name, version]) => (
                <div key={name} className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-muted-foreground truncate">{name}</span>
                  <span className="shrink-0 font-mono text-sm font-medium text-foreground">{version}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString();
  return String(v ?? "—");
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return ts;
  }
}
