import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Activity, Bot, KeyRound, ShieldCheck, Users, ArrowRight, Wand2, BookOpen, Server, ArrowRightLeft,
  Database, FlaskConical, CircleDot,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Panel } from "@/components/ui";
import { useUsers } from "../hooks/useAdminUsers";
import { useRoles } from "../hooks/useAdminRoles";
import { useAuthProviders } from "../hooks/useAuthProviders";
import { useAiProviders, useSystemHealth } from "../hooks/useAiProviders";
import { useAuthStore } from "@/stores/authStore";
import { useSetupWizard } from "@/contexts/SetupWizardContext";
import { useAtlasMigration } from "@/contexts/AtlasMigrationContext";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { formatNumber } from "@/i18n/format";
import type { SystemHealthService } from "@/types/models";

const NAV_CARDS = [
  {
    titleKey: "userManagement",
    icon: Users,
    href: "/admin/users",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    superAdminOnly: false,
  },
  {
    titleKey: "rolesPermissions",
    icon: ShieldCheck,
    href: "/admin/roles",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    superAdminOnly: true,
  },
  {
    titleKey: "authProviders",
    icon: KeyRound,
    href: "/admin/auth-providers",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    superAdminOnly: true,
  },
  {
    titleKey: "aiProviders",
    icon: Bot,
    href: "/admin/ai-providers",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    superAdminOnly: true,
  },
  {
    titleKey: "systemHealth",
    icon: Activity,
    href: "/admin/system-health",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    superAdminOnly: false,
  },
  {
    titleKey: "vocabularyManagement",
    icon: BookOpen,
    href: "/admin/vocabulary",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    superAdminOnly: true,
  },
  {
    titleKey: "fhirConnections",
    icon: Server,
    href: "/admin/fhir-connections",
    color: "text-teal-500",
    bg: "bg-teal-500/10",
    superAdminOnly: true,
  },
];

// ── Dense panel helpers ────────────────────────────────────────────────────

function StatusDotInline({ status }: { status: "healthy" | "degraded" | "down" | string }) {
  const color =
    status === "healthy" ? "bg-emerald-400" : status === "degraded" ? "bg-amber-400" : "bg-red-400";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />;
}

function Stat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-text-ghost whitespace-nowrap">{label}</span>
      <span className={`text-[11px] font-mono font-medium ${warn ? "text-red-400" : "text-text-primary"}`}>
        {value}
      </span>
    </div>
  );
}

function formatCompact(n: number): string {
  return formatNumber(n, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

function getService(services: SystemHealthService[] | undefined, key: string): SystemHealthService | undefined {
  return services?.find((s) => s.key === key);
}

export default function AdminDashboardPage() {
  const { t } = useTranslation("app");
  const { isSuperAdmin } = useAuthStore();
  const { openSetupWizard } = useSetupWizard();
  const { openAtlasMigration } = useAtlasMigration();
  const { data: usersPage } = useUsers({ per_page: 1 });
  const { data: roles } = useRoles();
  const { data: providers } = useAuthProviders();
  const { data: aiProviders } = useAiProviders();
  const { data: health } = useSystemHealth();
  const { data: sources } = useQuery({ queryKey: ["admin-sources"], queryFn: fetchSources });

  const enabledProviders = providers?.filter((p) => p.is_enabled).length ?? 0;
  const activeAiProvider = aiProviders?.find((p) => p.is_active);

  // System health derived stats
  const services = health?.services;
  const healthyCount = services?.filter((s) => s.status === "healthy").length ?? 0;
  const totalServices = services?.length ?? 0;
  const queue = getService(services, "queue");
  const redis = getService(services, "redis");
  const solr = getService(services, "solr");
  const darkstar = getService(services, "darkstar");
  const aiSvc = getService(services, "ai");
  const pendingJobs = (queue?.details?.pending as number) ?? (queue?.details?.pending_jobs as number) ?? 0;
  const failedJobs = (queue?.details?.failed as number) ?? (queue?.details?.failed_jobs as number) ?? 0;
  const redisMsg = redis?.message ?? "—";

  // Solr stats
  const solrCores = (solr?.details?.cores as number) ?? 0;
  const solrDocs = (solr?.details?.documents as number) ?? (solr?.details?.total_documents as number) ?? 0;

  // Sources — CDM sources with person counts from daimons
  const cdmSources = (sources ?? []).filter((s) =>
    s.daimons?.some((d) => d.daimon_type === "cdm")
  );

  // Overall health status
  const allHealthy = totalServices > 0 && healthyCount === totalServices;
  const hasDown = services?.some((s) => s.status === "down") ?? false;
  const overallBorder = allHealthy
    ? "border-emerald-500/30"
    : hasDown
      ? "border-red-500/30"
      : "border-amber-500/30";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("administration.dashboard.title")}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {t("administration.dashboard.subtitle")}
        </p>
      </div>

      {/* High-density system panels */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Platform Health */}
        <Link to="/admin/system-health" className="block">
          <div className={`rounded-lg border ${overallBorder} bg-surface-raised p-4 hover:bg-surface-overlay transition-colors h-full`}>
            <div className="flex items-center gap-2 mb-3">
              <Activity size={14} className="text-emerald-400" />
              <span className="text-xs font-semibold text-text-primary">
                {t("administration.dashboard.panels.platform")}
              </span>
              <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded ${
                allHealthy ? "bg-emerald-500/15 text-emerald-400" : hasDown ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
              }`}>
                {allHealthy
                  ? t("administration.dashboard.status.allHealthy")
                  : hasDown
                    ? t("administration.dashboard.status.degraded")
                    : t("administration.dashboard.status.warning")}
              </span>
            </div>
            <div className="space-y-1.5">
              <Stat
                label={t("administration.dashboard.labels.services")}
                value={t("administration.dashboard.values.servicesUp", {
                  healthy: formatNumber(healthyCount),
                  total: formatNumber(totalServices),
                })}
                warn={healthyCount < totalServices}
              />
              <Stat
                label={t("administration.dashboard.labels.queue")}
                value={t("administration.dashboard.values.queueSummary", {
                  pending: formatNumber(pendingJobs),
                  failed: formatNumber(failedJobs),
                })}
                warn={failedJobs > 0}
              />
              <Stat label={t("administration.dashboard.labels.redis")} value={redisMsg} />
              {services && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {services.map((s) => (
                    <span key={s.key} title={`${s.name}: ${s.status}`}>
                      <StatusDotInline status={s.status} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Link>

        {/* Users & Access */}
        <Link to="/admin/users" className="block">
          <div className="rounded-lg border border-border-default bg-surface-raised p-4 hover:bg-surface-overlay transition-colors h-full">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-blue-400" />
              <span className="text-xs font-semibold text-text-primary">
                {t("administration.dashboard.panels.usersAccess")}
              </span>
            </div>
            <div className="space-y-1.5">
              <Stat
                label={t("administration.dashboard.labels.totalUsers")}
                value={usersPage?.total ?? "—"}
              />
              <Stat label={t("administration.dashboard.labels.roles")} value={roles?.length ?? "—"} />
              <Stat
                label={t("administration.dashboard.labels.authProviders")}
                value={t("administration.dashboard.values.enabledCount", {
                  count: formatNumber(enabledProviders),
                })}
              />
              <Stat
                label={t("administration.dashboard.labels.tokenExpiry")}
                value={t("administration.dashboard.values.tokenExpiry")}
              />
            </div>
          </div>
        </Link>

        {/* Data Sources */}
        <Link to="/data-sources" className="block">
          <div className="rounded-lg border border-border-default bg-surface-raised p-4 hover:bg-surface-overlay transition-colors h-full">
            <div className="flex items-center gap-2 mb-3">
              <Database size={14} className="text-violet-400" />
              <span className="text-xs font-semibold text-text-primary">
                {t("administration.dashboard.panels.dataSources")}
              </span>
              <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400">
                {t("administration.dashboard.values.cdmCount", {
                  count: formatNumber(cdmSources.length),
                })}
              </span>
            </div>
            <div className="space-y-1.5">
              {cdmSources.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-text-ghost truncate">{s.source_name}</span>
                  <CircleDot size={8} className="shrink-0 text-violet-400/40" />
                </div>
              ))}
              {cdmSources.length === 0 && (
                <span className="text-[11px] text-text-ghost">
                  {t("administration.dashboard.messages.noCdmSources")}
                </span>
              )}
              {solr && (
                <>
                  <div className="border-t border-border-default mt-2 pt-1.5" />
                  <Stat
                    label={t("administration.dashboard.labels.solr")}
                    value={t("administration.dashboard.values.solrSummary", {
                      docs: formatCompact(solrDocs),
                      cores: formatNumber(solrCores),
                    })}
                  />
                </>
              )}
            </div>
          </div>
        </Link>

        {/* AI & Research */}
        <Link to="/admin/ai-providers" className="block">
          <div className="rounded-lg border border-border-default bg-surface-raised p-4 hover:bg-surface-overlay transition-colors h-full">
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical size={14} className="text-orange-400" />
              <span className="text-xs font-semibold text-text-primary">
                {t("administration.dashboard.panels.aiResearch")}
              </span>
            </div>
            <div className="space-y-1.5">
              <Stat
                label={t("administration.dashboard.labels.aiProvider")}
                value={activeAiProvider?.display_name ?? t("administration.dashboard.values.none")}
                warn={!activeAiProvider}
              />
              {activeAiProvider?.model && (
                <Stat label={t("administration.dashboard.labels.model")} value={activeAiProvider.model} />
              )}
              <Stat
                label={t("administration.dashboard.labels.abby")}
                value={aiSvc?.status === "healthy" ? t("administration.dashboard.values.online") : aiSvc?.status ?? "—"}
                warn={aiSvc?.status === "down"}
              />
              <Stat
                label={t("administration.dashboard.labels.researchRuntime")}
                value={
                  darkstar?.status === "healthy"
                    ? darkstar.message ?? t("administration.dashboard.values.online")
                    : darkstar?.status ?? "—"
                }
                warn={darkstar?.status === "down"}
              />
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {NAV_CARDS.filter((c) => !c.superAdminOnly || isSuperAdmin()).map((card) => (
          <Link key={card.href} to={card.href} className="block">
            <Panel className="group h-full cursor-pointer transition-colors hover:border-primary/50">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div className={`inline-flex rounded-md p-2 ${card.bg}`}>
                    <card.icon className={`h-5 w-5 ${card.color}`} />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {t(`administration.dashboard.nav.${card.titleKey}.title`)}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(`administration.dashboard.nav.${card.titleKey}.description`)}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  {t("administration.dashboard.actions.open")} <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Panel>
          </Link>
        ))}

        {/* Setup Wizard — superadmin only, button not link */}
        {isSuperAdmin() && (
          <button type="button" onClick={openSetupWizard} className="block text-left">
            <Panel className="group h-full cursor-pointer transition-colors hover:border-accent/50">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div className="inline-flex rounded-md bg-accent/10 p-2">
                    <Wand2 className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {t("administration.dashboard.setupWizard.title")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("administration.dashboard.setupWizard.description")}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                  {t("administration.dashboard.actions.openWizard")} <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Panel>
          </button>
        )}

        {/* Migrate from Atlas — superadmin only, opens in-window modal wizard */}
        {isSuperAdmin() && (
          <button type="button" onClick={openAtlasMigration} className="block text-left">
            <Panel className="group h-full cursor-pointer transition-colors hover:border-rose-500/50">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div className="inline-flex rounded-md bg-rose-500/10 p-2">
                    <ArrowRightLeft className="h-5 w-5 text-rose-500" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">
                    {t("administration.dashboard.atlasMigration.title")}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("administration.dashboard.atlasMigration.description")}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-rose-500 opacity-0 transition-opacity group-hover:opacity-100">
                  {t("administration.dashboard.actions.openWizard")} <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Panel>
          </button>
        )}
      </div>
    </div>
  );
}
