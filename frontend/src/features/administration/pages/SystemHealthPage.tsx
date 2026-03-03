import { RefreshCw } from "lucide-react";
import type { SystemHealthService } from "@/types/models";
import { useSystemHealth } from "../hooks/useAiProviders";

function statusColor(status: SystemHealthService["status"]) {
  switch (status) {
    case "healthy":
      return {
        dot: "bg-emerald-500",
        border: "border-emerald-500/30",
        bg: "bg-emerald-500/10",
        text: "text-emerald-400",
        badge: "bg-emerald-500/10 text-emerald-400",
      };
    case "degraded":
      return {
        dot: "bg-yellow-500",
        border: "border-yellow-500/30",
        bg: "bg-yellow-500/10",
        text: "text-yellow-400",
        badge: "bg-yellow-500/10 text-yellow-400",
      };
    case "down":
      return {
        dot: "bg-red-500",
        border: "border-red-500/30",
        bg: "bg-red-500/10",
        text: "text-red-400",
        badge: "bg-red-500/10 text-red-400",
      };
  }
}

function ServiceCard({ service }: { service: SystemHealthService }) {
  const colors = statusColor(service.status);
  const queueDetails = service.details as { pending?: number; failed?: number } | undefined;

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`mt-0.5 h-2.5 w-2.5 flex-shrink-0 rounded-full ${colors.dot}`} />
          <div>
            <p className="font-semibold text-foreground">{service.name}</p>
            <p className={`mt-0.5 text-sm ${colors.text}`}>{service.message}</p>
          </div>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colors.badge}`}>
          {service.status}
        </span>
      </div>

      {queueDetails && (
        <div className="mt-3 flex gap-4 text-sm">
          <span className="text-muted-foreground">
            Pending:{" "}
            <span className="font-medium text-foreground">{queueDetails.pending ?? 0}</span>
          </span>
          <span className="text-muted-foreground">
            Failed:{" "}
            <span
              className={`font-medium ${(queueDetails.failed ?? 0) > 0 ? "text-red-400" : "text-foreground"}`}
            >
              {queueDetails.failed ?? 0}
            </span>
          </span>
        </div>
      )}
    </div>
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

  const overallColors = data ? statusColor(overallStatus) : null;
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
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Overall banner */}
      {overallColors && data && (
        <div
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${overallColors.border} ${overallColors.bg}`}
        >
          <span className={`h-2.5 w-2.5 rounded-full ${overallColors.dot}`} />
          <span className={`text-sm font-medium capitalize ${overallColors.text}`}>
            System {overallStatus}
          </span>
          {checkedAt && (
            <span className="ml-auto text-xs text-muted-foreground">
              Last checked at {checkedAt}
            </span>
          )}
        </div>
      )}

      {/* Service cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-muted" />
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
