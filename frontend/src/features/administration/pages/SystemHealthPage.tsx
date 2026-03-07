import { RefreshCw, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Panel, Badge, StatusDot, Button, type BadgeVariant, type StatusDotVariant } from "@/components/ui";
import type { SystemHealthService } from "@/types/models";
import { useSystemHealth } from "../hooks/useAiProviders";

const STATUS_MAP: Record<string, { badge: BadgeVariant; dot: StatusDotVariant }> = {
  healthy:  { badge: "success",  dot: "healthy" },
  degraded: { badge: "warning",  dot: "degraded" },
  down:     { badge: "critical", dot: "critical" },
};

function ServiceCard({ service }: { service: SystemHealthService }) {
  const { badge, dot } = STATUS_MAP[service.status] ?? STATUS_MAP.down;
  const queueDetails = service.details as { pending?: number; failed?: number } | undefined;
  const solrDetails = service.details as { cores?: number; documents?: number } | undefined;

  return (
    <Link to={`/admin/system-health/${service.key}`}>
      <Panel className="group cursor-pointer transition-colors hover:border-primary/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <StatusDot status={dot} />
            <div>
              <p className="font-semibold text-foreground">{service.name}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{service.message}</p>
            </div>
          </div>
          <Badge variant={badge}>{service.status}</Badge>
        </div>

        {queueDetails?.pending !== undefined && (
          <div className="mt-3 flex gap-4 text-sm">
            <span className="text-muted-foreground">
              Pending:{" "}
              <span className="font-medium text-foreground">{queueDetails.pending ?? 0}</span>
            </span>
            <span className="text-muted-foreground">
              Failed:{" "}
              <span
                className={`font-medium ${(queueDetails.failed ?? 0) > 0 ? "text-destructive" : "text-foreground"}`}
              >
                {queueDetails.failed ?? 0}
              </span>
            </span>
          </div>
        )}

        {service.key === "solr" && solrDetails?.cores !== undefined && (
          <div className="mt-3 flex gap-4 text-sm">
            <span className="text-muted-foreground">
              Cores:{" "}
              <span className="font-medium text-foreground">{solrDetails.cores}</span>
            </span>
            <span className="text-muted-foreground">
              Documents:{" "}
              <span className="font-medium text-foreground">{solrDetails.documents?.toLocaleString() ?? 0}</span>
            </span>
          </div>
        )}

        <div className="mt-3 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          View details <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </Panel>
    </Link>
  );
}

export default function SystemHealthPage() {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useSystemHealth();

  const overallStatus =
    data?.services.find((s) => s.status === "down")
      ? "down"
      : data?.services.find((s) => s.status === "degraded")
        ? "degraded"
        : "healthy";

  const overallDot: StatusDotVariant = overallStatus === "healthy" ? "healthy" : "degraded";
  const checkedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Health</h1>
          <p className="mt-1 text-muted-foreground">
            Live status of all Parthenon services. Auto-refreshes every 30 seconds.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Overall banner */}
      {data && (
        <Panel>
          <div className="flex items-center gap-3">
            <StatusDot status={overallDot} />
            <span className="text-sm font-medium text-foreground">
              Server Status
            </span>
            <Badge variant={overallStatus === "healthy" ? "success" : "warning"}>
              {overallStatus === "healthy" ? "Healthy" : "Needs Attention"}
            </Badge>
            {checkedAt && (
              <span className="ml-auto text-xs text-muted-foreground">
                Last checked at {checkedAt}
              </span>
            )}
          </div>
        </Panel>
      )}

      {/* Service cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(data?.services ?? []).map((s) => (
            <ServiceCard key={s.key} service={s} />
          ))}
        </div>
      )}
    </div>
  );
}
