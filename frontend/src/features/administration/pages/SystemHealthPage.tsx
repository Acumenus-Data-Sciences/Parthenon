import { useMemo } from "react";
import { RefreshCw, ArrowRight, Server, Database, Cpu, HeartPulse, Activity, Building2, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Panel, Badge, StatusDot, Button, type BadgeVariant, type StatusDotVariant } from "@/components/ui";
import { formatDate, formatNumber } from "@/i18n/format";
import type { SystemHealthService } from "@/types/models";
import { useHadesPackageInventory, useSystemHealth } from "../hooks/useAiProviders";
import { GisDataPanel } from "../components/GisDataPanel";
import { LiveKitConfigPanel } from "../components/LiveKitConfigPanel";
import type { HadesPackageStatus } from "../api/adminApi";

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

function tierKey(tier: string): string {
  switch (tier) {
    case "Core Platform":
      return "corePlatform";
    case "Data & Search":
      return "dataSearch";
    case "AI & Analytics":
      return "aiAnalytics";
    case "Clinical Services":
      return "clinicalServices";
    case "Monitoring & Communications":
      return "monitoringCommunications";
    case "Acropolis Infrastructure":
      return "acropolisInfrastructure";
    default:
      return "unknown";
  }
}

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
  const { t } = useTranslation("app");
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
        <Badge variant={badge}>{t(`administration.systemHealth.status.${service.status}`)}</Badge>
      </div>

      {queueDetails?.pending !== undefined && (
        <div className="mt-3 flex gap-4 text-sm">
          <span className="text-muted-foreground">
            {t("administration.systemHealth.labels.pending")}{" "}
            <span className="font-medium text-foreground">{formatNumber(queueDetails.pending ?? 0)}</span>
          </span>
          <span className="text-muted-foreground">
            {t("administration.systemHealth.labels.failed")}{" "}
            <span
              className={`font-medium ${(queueDetails.failed ?? 0) > 0 ? "text-destructive" : "text-foreground"}`}
            >
              {formatNumber(queueDetails.failed ?? 0)}
            </span>
          </span>
        </div>
      )}

      {service.key === "solr" && solrDetails?.cores !== undefined && (
        <div className="mt-3 flex gap-4 text-sm">
          <span className="text-muted-foreground">
            {t("administration.systemHealth.labels.cores")}{" "}
            <span className="font-medium text-foreground">{formatNumber(solrDetails.cores)}</span>
          </span>
          <span className="text-muted-foreground">
            {t("administration.systemHealth.labels.documents")}{" "}
            <span className="font-medium text-foreground">{formatNumber(solrDetails.documents ?? 0)}</span>
          </span>
        </div>
      )}

      {service.key === "poseidon" && poseidonDetails?.dagster_version !== undefined && (
        <div className="mt-3 flex gap-4 text-sm">
          <span className="text-muted-foreground">
            {t("administration.systemHealth.labels.dagster")}{" "}
            <span className="font-medium text-foreground">{poseidonDetails.dagster_version}</span>
          </span>
          <span className="text-muted-foreground">
            {t("administration.systemHealth.labels.graphql")}{" "}
            <span className="font-medium text-foreground">{poseidonDetails.graphql_version}</span>
          </span>
        </div>
      )}

      {service.key === "orthanc" && orthancDetails?.studies !== undefined && (
        <div className="mt-3 flex gap-4 text-sm">
          <span className="text-muted-foreground">
            {t("administration.systemHealth.labels.studies")}{" "}
            <span className="font-medium text-foreground">{formatNumber(orthancDetails.studies ?? 0)}</span>
          </span>
          <span className="text-muted-foreground">
            {t("administration.systemHealth.labels.instances")}{" "}
            <span className="font-medium text-foreground">{formatNumber(orthancDetails.instances ?? 0)}</span>
          </span>
          <span className="text-muted-foreground">
            {t("administration.systemHealth.labels.disk")}{" "}
            <span className="font-medium text-foreground">
              {(orthancDetails.disk_size_mb ?? 0) >= 1024
                ? `${formatNumber((orthancDetails.disk_size_mb ?? 0) / 1024, { maximumFractionDigits: 1 })} GB`
                : `${formatNumber(orthancDetails.disk_size_mb ?? 0)} MB`}
            </span>
          </span>
        </div>
      )}

      {isAcropolis ? (
        <div className="mt-3 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          {t("administration.systemHealth.actions.openService")} <ExternalLink className="h-3.5 w-3.5" />
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          {t("administration.systemHealth.actions.viewDetails")} <ArrowRight className="h-3.5 w-3.5" />
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
  const { t } = useTranslation("app");
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
        <h2 className="text-lg font-semibold text-foreground">{t(`administration.systemHealth.tiers.${tierKey(tier)}`)}</h2>
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

function priorityWeight(pkg: HadesPackageStatus): number {
  const order: Record<string, number> = {
    high: 0,
    first_class: 1,
    medium: 2,
    compatibility: 3,
    low: 4,
    optional: 5,
    superseded: 6,
    runtime: 7,
    core: 8,
  };

  return order[pkg.priority] ?? 9;
}

function HadesPackagePanel() {
  const { t } = useTranslation("app");
  const { data, isLoading, isError, isFetching, refetch } = useHadesPackageInventory();

  const missingPackages = useMemo(() => {
    if (!data) return [];
    return data.packages
      .filter((pkg) => !pkg.installed)
      .sort((a, b) => priorityWeight(a) - priorityWeight(b) || a.package.localeCompare(b.package));
  }, [data]);

  const topMissing = missingPackages.slice(0, 8);
  const statusVariant: BadgeVariant = data?.required_missing_count
    ? "critical"
    : data?.status === "complete" ? "success" : "warning";

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("administration.systemHealth.hades.title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("administration.systemHealth.hades.subtitle")}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          {t("administration.systemHealth.actions.refresh")}
        </Button>
      </div>

      {isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">{t("administration.systemHealth.hades.checking")}</p>
      ) : isError || !data ? (
        <p className="mt-4 text-sm text-destructive">
          {t("administration.systemHealth.hades.unavailable")}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={statusVariant}>{t(`administration.systemHealth.hades.status.${data.status}`)}</Badge>
            <span className="text-sm text-muted-foreground">
              {t("administration.systemHealth.hades.installed")} <span className="font-medium text-foreground">{formatNumber(data.installed_count)}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              {t("administration.systemHealth.hades.missing")} <span className="font-medium text-foreground">{formatNumber(data.missing_count)}</span>
            </span>
            <span className="text-sm text-muted-foreground">
              {t("administration.systemHealth.hades.total")} <span className="font-medium text-foreground">{formatNumber(data.total)}</span>
            </span>
            {typeof data.required_missing_count === "number" && (
              <span className="text-sm text-muted-foreground">
                {t("administration.systemHealth.hades.requiredMissing")} <span className="font-medium text-foreground">{formatNumber(data.required_missing_count)}</span>
              </span>
            )}
          </div>

          {data.shiny_policy && (
            <div className="rounded-lg border border-border-default bg-surface-raised p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-foreground">{t("administration.systemHealth.hades.shinyPolicy")}</p>
                <Badge variant="inactive">{t("administration.systemHealth.hades.notExposed")}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("administration.systemHealth.hades.shinyPolicyDescription")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("administration.systemHealth.hades.replacement", {
                  surface: data.shiny_policy.replacement_surface,
                })}
              </p>
            </div>
          )}

          {topMissing.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-default text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">{t("administration.systemHealth.hades.package")}</th>
                    <th className="py-2 pr-4 font-medium">{t("administration.systemHealth.hades.capability")}</th>
                    <th className="py-2 pr-4 font-medium">{t("administration.systemHealth.hades.priority")}</th>
                    <th className="py-2 pr-4 font-medium">{t("administration.systemHealth.hades.surface")}</th>
                    <th className="py-2 font-medium">{t("administration.systemHealth.hades.source")}</th>
                  </tr>
                </thead>
                <tbody>
                  {topMissing.map((pkg) => (
                    <tr key={pkg.package} className="border-b border-border-default/60">
                      <td className="py-2 pr-4 font-mono text-xs text-foreground">
                        {pkg.package}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{pkg.capability}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{pkg.priority}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{pkg.surface}</td>
                      <td className="py-2 text-muted-foreground">{pkg.install_source ?? t("administration.systemHealth.hades.runtime")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

export default function SystemHealthPage() {
  const { t } = useTranslation("app");
  const { data, isLoading, isFetching, refetch, dataUpdatedAt } = useSystemHealth();

  const services = data?.services;
  const tiers = useMemo(() => {
    if (!services) return [];
    const grouped = new Map<string, SystemHealthService[]>();
    for (const service of services) {
      const tier = service.tier ?? "Monitoring & Communications";
      const list = grouped.get(tier) ?? [];
      list.push(service);
      grouped.set(tier, list);
    }
    return TIER_ORDER
      .filter((t) => grouped.has(t))
      .map((t) => ({ tier: t, services: grouped.get(t)! }));
  }, [services]);

  const overallStatus =
    data?.services.find((s) => s.status === "down")
      ? "down"
      : data?.services.find((s) => s.status === "degraded")
        ? "degraded"
        : "healthy";

  const overallDot: StatusDotVariant = overallStatus === "healthy" ? "healthy" : "degraded";
  const checkedAt = dataUpdatedAt ? formatDate(dataUpdatedAt, { timeStyle: "short" }) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("administration.systemHealth.title")}</h1>
          <p className="mt-1 text-muted-foreground">
            {t("administration.systemHealth.subtitle")}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
          {t("administration.systemHealth.actions.refresh")}
        </Button>
      </div>

      {/* Overall banner */}
      {data && (
        <Panel>
          <div className="flex items-center gap-3">
            <StatusDot status={overallDot} />
            <span className="text-sm font-medium text-foreground">
              {t("administration.systemHealth.serverStatus")}
            </span>
            <Badge variant={overallStatus === "healthy" ? "success" : "warning"}>
              {overallStatus === "healthy"
                ? t("administration.systemHealth.overall.healthy")
                : t("administration.systemHealth.overall.needsAttention")}
            </Badge>
            {checkedAt && (
              <span className="ml-auto text-xs text-muted-foreground">
                {t("administration.systemHealth.lastChecked", { time: checkedAt })}
              </span>
            )}
          </div>
        </Panel>
      )}

      {/* Tiered service groups */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="h-10 w-10 rounded-full border-2 border-muted border-t-teal-400 animate-spin" />
          <p className="mt-4 text-sm text-muted-foreground">
            {t("administration.systemHealth.polling")}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {tiers.map(({ tier, services }) => (
            <TierSection key={tier} tier={tier} services={services} />
          ))}
        </div>
      )}

      {/* GIS Data Management */}
      <HadesPackagePanel />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          {t("administration.systemHealth.gisDataManagement")}
        </h2>
        <GisDataPanel />
      </div>
    </div>
  );
}
