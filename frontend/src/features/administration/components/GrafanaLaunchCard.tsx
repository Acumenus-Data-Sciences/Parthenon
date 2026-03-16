import { ExternalLink, BarChart2 } from "lucide-react";
import { Panel, Badge, StatusDot, type BadgeVariant, type StatusDotVariant } from "@/components/ui";
import type { SystemHealthService } from "@/types/models";

const STATUS_MAP: Record<string, { badge: BadgeVariant; dot: StatusDotVariant }> = {
  healthy:  { badge: "success",  dot: "healthy" },
  degraded: { badge: "warning",  dot: "degraded" },
  down:     { badge: "critical", dot: "critical" },
};

interface GrafanaLaunchCardProps {
  service: SystemHealthService;
  grafanaUrl: string;
}

export function GrafanaLaunchCard({ service, grafanaUrl }: GrafanaLaunchCardProps) {
  const { badge, dot } = STATUS_MAP[service.status] ?? STATUS_MAP.down;

  return (
    <Panel className="h-full">
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

      <div className="mt-3">
        <a
          href={grafanaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <BarChart2 className="h-3.5 w-3.5" />
          Open Dashboard
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </Panel>
  );
}
