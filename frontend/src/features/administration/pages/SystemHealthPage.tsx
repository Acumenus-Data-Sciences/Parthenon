import { useMemo } from "react";
import { RefreshCw, ArrowRight, Server, Database, Cpu, HeartPulse, Activity, Building2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { Panel, Badge, StatusDot, Button, type BadgeVariant, type StatusDotVariant } from "@/components/ui";
import type { SystemHealthService } from "@/types/models";
import { useSystemHealth } from "../hooks/useAiProviders";
import { GisDataPanel } from "../components/GisDataPanel";
import { LiveKitConfigPanel } from "../components/LiveKitConfigPanel";

const STATUS_MAP: Record<string, { badge: BadgeVariant; dot: StatusDotVariant }> = {
  healthy:  { badge: "success",  dot: "healthy" },
  degraded: { badge: "warning",  dot: "degraded" },
  down:     { badge: "critical", dot: "critical" },
};

/** Tier display order and icons */
const TIER_ORDER = [
  "Core Platform",
  "Data & Search",
  "AI & Analytics",
  "Clinical Services",
  "Monitoring & Communications",
  "Acropolis Infrastructure",
] as const;

const TIER_ICONS: Record<string, React.ReactNode> = {
  "Core Platform":                  <Server className="h-4 w-4" />,
  "Data & Search":                  <Database className="h-4 w-4" />,
  "AI & Analytics":                 <Cpu className="h-4 w-4" />,
  "Clinical Services":             <HeartPulse className="h-4 w-4" />,
  "Monitoring & Communications":   <Activity className="h-4 w-4" />,
  "Acropolis Infrastructure":      <Building2 className="h-4 w-4" />,
};

const ACROPOLIS_SUBDOMAINS: Record<string, string> = {
  authentik: "auth",
  wazuh: "wazuh",
  n8n: "n8n",
  superset: "superset",
  datahub: "datahub",
  portainer: "portainer",
  pgadmin: "pgadmin",
  grafana: "grafana",
};

function getAcropolisUrl(key: string): string {
  const subdomain = ACROPOLIS_SUBDOMAINS[key];
  if (!subdomain) return "#";
  const hostname = window.location.hostname;
  const baseHost = hostname.startsWith("parthenon.") ? hostname.slice("parthenon.".length) : hostname;
  return `${window.location.protocol}//${subdomain}.${baseHost}/`;
}

function ServiceCard({ service }: { service: SystemHealthService }) {
  const { badge, dot } = STATUS_MAP[service.status] ?? STATUS_MAP.down;
  const queueDetails = service.details as { pending?: number; failed?: number } | undefined;
  const solrDetails = service.details as { cores?: number; documents?: number } | undefined;
  const orthancDetails = service.details as { studies?: number; instances?: number; disk_size_mb?: number; patients?: number } | undefined;
  const poseidonDetails = service.details as { dagster_version?: string; graphql_version?: string } | undefined;
  const isAcropolis = service.tier === "Acropolis Infrastructure";

  const cardContent = (
    <Panel className="group h-full cursor-pointer transition-colors hover:border-primary/50">
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

      {service.key === "poseidon" && poseidonDetails?.dagster_version !== undefined && (
        <div className="mt-3 flex gap-4 text-sm">
          <span className="text-muted-foreground">
            Dagster:{" "}
            <span className="font-medium text-foreground">{poseidonDetails.dagster_version}</span>
          </span>
          <span className="text-muted-foreground">
            GraphQL:{" "}
            <span className="font-medium text-foreground">{poseidonDetails.graphql_version}</span>
          </span>
        </div>
      )}

      {service.key === "orthanc" && orthancDetails?.studies !== undefined && (
        <div className="mt-3 flex gap-4 text-sm">
          <span className="text-muted-foreground">
            Studies:{" "}
            <span className="font-medium text-foreground">{orthancDetails.studies?.toLocaleString()}</span>
          </span>
          <span className="text-muted-foreground">
            Instances:{" "}
            <span className="font-medium text-foreground">{orthancDetails.instances?.toLocaleString()}</span>
          </span>
          <span className="text-muted-foreground">
            Disk:{" "}
            <span className="font-medium text-foreground">
              {(orthancDetails.disk_size_mb ?? 0) >= 1024
                ? `${((orthancDetails.disk_size_mb ?? 0) / 1024).toFixed(1)} GB`
                : `${orthancDetails.disk_size_mb} MB`}
            </span>
          </span>
        </div>
      )}

      {isAcropolis ? (
        <div className="mt-3 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Open Service <ExternalLink className="h-3.5 w-3.5" />
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          View details <ArrowRight className="h-3.5 w-3.5" />
        </div>
      )}
    </Panel>
  );

  if (isAcropolis) {
    return (
      <a href={getAcropolisUrl(service.key)} target="_blank" rel="noopener noreferrer">
        {cardContent}
      </a>
    );
  }

  return (
    <Link to={`/admin/system-health/${service.key}`}>
      {cardContent}
    </Link>
  );
}

function TierSection({ tier, services }: { tier: string; services: SystemHealthService[] }) {
  const tierStatus = services.find((s) => s.status === "down")
    ? "down"
    : services.find((s) => s.status === "degraded")
      ? "degraded"
      : "healthy";

  const { dot } = STATUS_MAP[tierStatus] ?? STATUS_MAP.down;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-muted-foreground">{TIER_ICONS[tier]}</span>
        <h2 className="text-lg font-semibold text-foreground">{tier}</h2>
        <StatusDot status={dot} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {services.map((s) =>
          s.key === "livekit" ? (
            <LiveKitConfigPanel key={s.key} service={s} />
          ) : (
            <ServiceCard key={s.key} service={s} />
          )
        )}
      </div>
    </div>
  );
}

export default function SystemHealthPage() {
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useSystemHealth();

  const tiers = useMemo(() => {
    if (!data?.services) return [];
    const grouped = new Map<string, SystemHealthService[]>();
    for (const service of data.services) {
      const tier = service.tier ?? "Monitoring & Communications";
      const list = grouped.get(tier) ?? [];
      list.push(service);
      grouped.set(tier, list);
    }
    return TIER_ORDER
      .filter((t) => grouped.has(t))
      .map((t) => ({ tier: t, services: grouped.get(t)! }));
  }, [data?.services]);

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

      {/* Tiered service groups */}
      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i}>
              <div className="mb-3 h-6 w-40 animate-pulse rounded bg-muted" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: i === 0 ? 3 : 2 }).map((_, j) => (
                  <div key={j} className="h-24 animate-pulse rounded-lg border border-border bg-muted" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {tiers.map(({ tier, services }) => (
            <TierSection key={tier} tier={tier} services={services} />
          ))}
        </div>
      )}

      {/* GIS Data Management */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          GIS Data Management
        </h2>
        <GisDataPanel />
      </div>
    </div>
  );
}
