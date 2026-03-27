import { Link } from "react-router-dom";
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
import type { SystemHealthService } from "@/types/models";

const NAV_CARDS = [
  {
    title: "User Management",
    description: "Create, edit, and deactivate user accounts. Assign roles to control access.",
    icon: Users,
    href: "/admin/users",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    superAdminOnly: false,
  },
  {
    title: "Roles & Permissions",
    description: "Define custom roles and fine-tune permission assignments across all domains.",
    icon: ShieldCheck,
    href: "/admin/roles",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    superAdminOnly: true,
  },
  {
    title: "Authentication Providers",
    description: "Enable and configure LDAP, OAuth 2.0, SAML 2.0, or OIDC for SSO.",
    icon: KeyRound,
    href: "/admin/auth-providers",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    superAdminOnly: true,
  },
  {
    title: "AI Provider Configuration",
    description: "Switch Abby's backend between local Ollama, Anthropic, OpenAI, Gemini, and more.",
    icon: Bot,
    href: "/admin/ai-providers",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    superAdminOnly: true,
  },
  {
    title: "System Health",
    description: "Live status of all Parthenon services: Redis, AI, R runtime, Solr, Orthanc PACS, job queues.",
    icon: Activity,
    href: "/admin/system-health",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    superAdminOnly: false,
  },
  {
    title: "Vocabulary Management",
    description: "Update OMOP vocabulary tables by uploading a new Athena vocabulary ZIP file.",
    icon: BookOpen,
    href: "/admin/vocabulary",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    superAdminOnly: true,
  },
  {
    title: "FHIR EHR Connections",
    description: "Manage FHIR R4 connections to Epic, Cerner, and other EHR systems for bulk data import.",
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
      <span className="text-[11px] text-[#5A5650] whitespace-nowrap">{label}</span>
      <span className={`text-[11px] font-mono font-medium ${warn ? "text-red-400" : "text-[#F0EDE8]"}`}>
        {value}
      </span>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getService(services: SystemHealthService[] | undefined, key: string): SystemHealthService | undefined {
  return services?.find((s) => s.key === key);
}

export default function AdminDashboardPage() {
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
  const pendingJobs = (queue?.details?.pending_jobs as number) ?? 0;
  const failedJobs = (queue?.details?.failed_jobs as number) ?? 0;
  const redisMemory = (redis?.details?.used_memory_human as string) ?? "—";
  const redisClients = (redis?.details?.connected_clients as number) ?? "—";

  // Solr stats
  const solrCores = (solr?.details?.cores as number) ?? 0;
  const solrDocs = (solr?.details?.total_documents as number) ?? 0;

  // Sources — CDM sources with person counts from daimons
  const cdmSources = (sources ?? []).filter((s) =>
    s.daimons?.some((d) => d.daimon_type === "CDM")
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
        <h1 className="text-2xl font-bold text-foreground">Administration</h1>
        <p className="mt-1 text-muted-foreground">
          Manage users, roles, permissions, and system configuration.
        </p>
      </div>

      {/* High-density system panels */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Platform Health */}
        <Link to="/admin/system-health" className="block">
          <div className={`rounded-lg border ${overallBorder} bg-[#151518] p-4 hover:bg-[#1A1A1F] transition-colors h-full`}>
            <div className="flex items-center gap-2 mb-3">
              <Activity size={14} className="text-emerald-400" />
              <span className="text-xs font-semibold text-[#F0EDE8]">Platform</span>
              <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded ${
                allHealthy ? "bg-emerald-500/15 text-emerald-400" : hasDown ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
              }`}>
                {allHealthy ? "All healthy" : hasDown ? "Degraded" : "Warning"}
              </span>
            </div>
            <div className="space-y-1.5">
              <Stat label="Services" value={`${healthyCount}/${totalServices} up`} warn={healthyCount < totalServices} />
              <Stat label="Queue" value={`${pendingJobs} pending / ${failedJobs} failed`} warn={failedJobs > 0} />
              <Stat label="Redis" value={`${redisMemory} / ${redisClients} clients`} />
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
          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 hover:bg-[#1A1A1F] transition-colors h-full">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-blue-400" />
              <span className="text-xs font-semibold text-[#F0EDE8]">Users & Access</span>
            </div>
            <div className="space-y-1.5">
              <Stat label="Total users" value={usersPage?.total ?? "—"} />
              <Stat label="Roles" value={roles?.length ?? "—"} />
              <Stat label="Auth providers" value={`${enabledProviders} enabled`} />
              <Stat label="Token expiry" value="8h" />
            </div>
          </div>
        </Link>

        {/* Data Sources */}
        <Link to="/data-sources" className="block">
          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 hover:bg-[#1A1A1F] transition-colors h-full">
            <div className="flex items-center gap-2 mb-3">
              <Database size={14} className="text-violet-400" />
              <span className="text-xs font-semibold text-[#F0EDE8]">Data Sources</span>
              <span className="ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400">
                {cdmSources.length} CDM{cdmSources.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-1.5">
              {cdmSources.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-[#5A5650] truncate">{s.source_name}</span>
                  <CircleDot size={8} className="shrink-0 text-violet-400/40" />
                </div>
              ))}
              {cdmSources.length === 0 && (
                <span className="text-[11px] text-[#5A5650]">No CDM sources configured</span>
              )}
              {solr && (
                <>
                  <div className="border-t border-[#232328] mt-2 pt-1.5" />
                  <Stat label="Solr" value={`${formatCompact(solrDocs)} docs / ${solrCores} cores`} />
                </>
              )}
            </div>
          </div>
        </Link>

        {/* AI & Research */}
        <Link to="/admin/ai-providers" className="block">
          <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 hover:bg-[#1A1A1F] transition-colors h-full">
            <div className="flex items-center gap-2 mb-3">
              <FlaskConical size={14} className="text-orange-400" />
              <span className="text-xs font-semibold text-[#F0EDE8]">AI & Research</span>
            </div>
            <div className="space-y-1.5">
              <Stat
                label="AI provider"
                value={activeAiProvider?.display_name ?? "None"}
                warn={!activeAiProvider}
              />
              {activeAiProvider?.model && (
                <Stat label="Model" value={activeAiProvider.model} />
              )}
              <Stat
                label="Abby"
                value={aiSvc?.status === "healthy" ? "Online" : aiSvc?.status ?? "—"}
                warn={aiSvc?.status === "down"}
              />
              <Stat
                label="R / HADES"
                value={
                  darkstar?.status === "healthy"
                    ? `Online (${(darkstar.details?.hades_packages as number) ?? "?"} pkgs)`
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
                  <h3 className="mt-4 text-base font-semibold text-foreground">{card.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Open <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Panel>
          </Link>
        ))}

        {/* Setup Wizard — superadmin only, button not link */}
        {isSuperAdmin() && (
          <button type="button" onClick={openSetupWizard} className="block text-left">
            <Panel className="group h-full cursor-pointer transition-colors hover:border-[#C9A227]/50">
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div className="inline-flex rounded-md bg-[#C9A227]/10 p-2">
                    <Wand2 className="h-5 w-5 text-[#C9A227]" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-foreground">Platform Setup Wizard</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Re-run the guided setup — health check, AI provider, authentication, and data sources.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-[#C9A227] opacity-0 transition-opacity group-hover:opacity-100">
                  Open wizard <ArrowRight className="h-4 w-4" />
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
                  <h3 className="mt-4 text-base font-semibold text-foreground">Migrate from Atlas</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Import cohort definitions, concept sets, and analyses from an existing OHDSI Atlas installation.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-rose-500 opacity-0 transition-opacity group-hover:opacity-100">
                  Open wizard <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Panel>
          </button>
        )}
      </div>
    </div>
  );
}
