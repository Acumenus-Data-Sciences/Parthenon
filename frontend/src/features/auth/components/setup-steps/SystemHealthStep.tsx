import { useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useSystemHealth } from "@/features/administration/hooks/useAiProviders";
import type { SystemHealthService } from "@/types/models";
import { cn } from "@/lib/utils";

interface Props {
  onHealthChecked: () => void;
  /** Jump directly to AI Provider step when AI service is down. */
  onGoToAiProvider?: () => void;
}

const STATUS_CONFIG = {
  healthy: {
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    label: "Healthy",
  },
  degraded: {
    icon: AlertTriangle,
    dot: "bg-yellow-500",
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    label: "Degraded",
  },
  down: {
    icon: XCircle,
    dot: "bg-red-500",
    border: "border-red-500/30",
    bg: "bg-red-500/10",
    text: "text-red-400",
    label: "Down",
  },
} as const;

function ServiceRow({
  service,
  onGoToAiProvider,
}: {
  service: SystemHealthService;
  onGoToAiProvider?: () => void;
}) {
  const config = STATUS_CONFIG[service.status];
  const queueDetails = service.details as { pending?: number; failed?: number } | undefined;

  // Detect AI service by key
  const isAiService = service.key === "ai" || service.name?.toLowerCase().includes("ai");
  const aiUnhealthy = isAiService && service.status !== "healthy";

  return (
    <div className={cn("rounded-lg border p-4", config.border, config.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full", config.dot)} />
          <div>
            <p className="font-semibold text-text-primary">{service.name}</p>
            <p className={cn("mt-0.5 text-base", config.text)}>{service.message}</p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize",
            config.bg,
            config.text,
          )}
        >
          {config.label}
        </span>
      </div>

      {queueDetails && (
        <div className="mt-3 flex gap-4 text-sm">
          <span className="text-text-muted">
            Pending:{" "}
            <span className="font-medium text-text-primary">{queueDetails.pending ?? 0}</span>
          </span>
          <span className="text-text-muted">
            Failed:{" "}
            <span
              className={cn(
                "font-medium",
                (queueDetails.failed ?? 0) > 0 ? "text-red-400" : "text-text-primary",
              )}
            >
              {queueDetails.failed ?? 0}
            </span>
          </span>
        </div>
      )}

      {/* AI service cross-link */}
      {aiUnhealthy && onGoToAiProvider && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-surface-highlight bg-surface-base/60 px-3 py-2">
          <p className="text-sm text-text-muted">
            Abby AI is not responding — configure the provider in the next step.
          </p>
          <button
            type="button"
            onClick={onGoToAiProvider}
            className="ml-3 flex shrink-0 items-center gap-1 text-sm font-medium text-accent hover:text-[#D4AE3A] transition-colors"
          >
            Configure AI
            <ArrowRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

export function SystemHealthStep({ onHealthChecked, onGoToAiProvider }: Props) {
  const { data: health, isLoading, isFetching, dataUpdatedAt } = useSystemHealth();
  const qc = useQueryClient();

  useEffect(() => {
    if (health) onHealthChecked();
  }, [health, onHealthChecked]);

  const overallStatus = health?.services.find((s) => s.status === "down")
    ? "down"
    : health?.services.find((s) => s.status === "degraded")
      ? "degraded"
      : "healthy";

  const overallConfig = STATUS_CONFIG[overallStatus];
  const checkedAt = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">System Health Check</h3>
          <p className="text-base text-text-muted">
            Verifying that all platform services are running correctly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => qc.invalidateQueries({ queryKey: ["system-health"] })}
          disabled={isFetching}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-default px-3 py-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text-secondary disabled:opacity-50"
        >
          <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
          <span className="ml-2 text-sm text-text-muted">Checking services...</span>
        </div>
      ) : (
        <>
          {/* Overall banner */}
          {health && (
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3",
                overallConfig.border,
                overallConfig.bg,
              )}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", overallConfig.dot)} />
              <span className={cn("text-base font-medium capitalize", overallConfig.text)}>
                System {overallStatus}
              </span>
              {checkedAt && (
                <span className="ml-auto text-sm text-text-ghost">
                  Last checked at {checkedAt}
                </span>
              )}
            </div>
          )}

          {/* Service list */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(health?.services ?? []).map((service) => (
              <ServiceRow
                key={service.key}
                service={service}
                onGoToAiProvider={onGoToAiProvider}
              />
            ))}
          </div>

          <p className="text-sm text-text-ghost">Auto-refreshes every 30 seconds.</p>
        </>
      )}
    </div>
  );
}
