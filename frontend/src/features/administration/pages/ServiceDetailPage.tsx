import { useParams, Link } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Panel, Badge, StatusDot, Button, type BadgeVariant, type StatusDotVariant } from "@/components/ui";
import { useServiceDetail } from "../hooks/useAiProviders";

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
  const nestedMetrics = Object.entries(metrics).filter(([, v]) => typeof v === "object" && v !== null);

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
