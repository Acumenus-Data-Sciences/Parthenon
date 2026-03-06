import { Link } from "react-router-dom";
import {
  Activity, Bot, KeyRound, ShieldCheck, Users, ArrowRight, Wand2, BookOpen, Server, ArrowRightLeft,
} from "lucide-react";
import { MetricCard, Panel } from "@/components/ui";
import { useUsers } from "../hooks/useAdminUsers";
import { useRoles } from "../hooks/useAdminRoles";
import { useAuthProviders } from "../hooks/useAuthProviders";
import { useAiProviders } from "../hooks/useAiProviders";
import { useAuthStore } from "@/stores/authStore";
import { useSetupWizard } from "@/contexts/SetupWizardContext";
import { useAtlasMigration } from "@/contexts/AtlasMigrationContext";

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
    description: "Live status of all Parthenon services: Redis, AI, R runtime, job queues.",
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

export default function AdminDashboardPage() {
  const { isSuperAdmin } = useAuthStore();
  const { openSetupWizard } = useSetupWizard();
  const { openAtlasMigration } = useAtlasMigration();
  const { data: usersPage } = useUsers({ per_page: 1 });
  const { data: roles } = useRoles();
  const { data: providers } = useAuthProviders();
  const { data: aiProviders } = useAiProviders();

  const enabledProviders = providers?.filter((p) => p.is_enabled).length ?? 0;
  const activeAiProvider = aiProviders?.find((p) => p.is_active);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Administration</h1>
        <p className="mt-1 text-muted-foreground">
          Manage users, roles, permissions, and authentication configuration.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label="Total Users"
          value={usersPage?.total ?? "—"}
          icon={<Users size={16} />}
        />
        <MetricCard
          label="Roles Defined"
          value={roles?.length ?? "—"}
          icon={<ShieldCheck size={16} />}
        />
        <MetricCard
          label="Auth Providers"
          value={enabledProviders}
          description={`${enabledProviders} enabled`}
          icon={<KeyRound size={16} />}
        />
        <MetricCard
          label="Active AI"
          value={activeAiProvider?.display_name ?? "—"}
          description={activeAiProvider?.model}
          icon={<Bot size={16} />}
        />
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
