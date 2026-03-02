import { Link } from "react-router-dom";
import { Users, ShieldCheck, KeyRound, Settings2, ArrowRight } from "lucide-react";
import { useUsers } from "../hooks/useAdminUsers";
import { useRoles } from "../hooks/useAdminRoles";
import { useAuthProviders } from "../hooks/useAuthProviders";
import { useAuthStore } from "@/stores/authStore";

const cards = [
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
];

export default function AdminDashboardPage() {
  const { isSuperAdmin } = useAuthStore();
  const { data: usersPage } = useUsers({ per_page: 1 });
  const { data: roles } = useRoles();
  const { data: providers } = useAuthProviders();

  const enabledProviders = providers?.filter((p) => p.is_enabled).length ?? 0;

  const stats = [
    { label: "Total Users", value: usersPage?.total ?? "—" },
    { label: "Roles Defined", value: roles?.length ?? "—" },
    { label: "Auth Providers Enabled", value: enabledProviders },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Administration</h1>
        <p className="mt-1 text-muted-foreground">
          Manage users, roles, permissions, and authentication configuration.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-3xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards
          .filter((c) => !c.superAdminOnly || isSuperAdmin())
          .map((card) => (
            <Link
              key={card.href}
              to={card.href}
              className="group flex flex-col justify-between rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent"
            >
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
            </Link>
          ))}
      </div>
    </div>
  );
}
