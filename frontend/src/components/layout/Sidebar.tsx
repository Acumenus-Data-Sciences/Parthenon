import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";
import { useAuthStore } from "@/stores/authStore";
import {
  LayoutDashboard,
  Database,
  Upload,
  BarChart3,
  BookOpen,
  Users,
  FlaskConical,
  Workflow,
  UserCircle,
  Briefcase,
  Settings,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  children?: Array<{ path: string; label: string; icon: React.ElementType; superAdminOnly?: boolean }>;
}

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/data-sources", label: "Data Sources", icon: Database },
  { path: "/ingestion", label: "Data Ingestion", icon: Upload },
  { path: "/data-explorer", label: "Data Explorer", icon: BarChart3 },
  { path: "/vocabulary", label: "Vocabulary", icon: BookOpen },
  { path: "/cohort-definitions", label: "Cohort Definitions", icon: Users },
  { path: "/concept-sets", label: "Concept Sets", icon: FlaskConical },
  { path: "/analyses", label: "Analyses", icon: Workflow },
  { path: "/studies", label: "Studies", icon: Briefcase },
  { path: "/profiles", label: "Patient Profiles", icon: UserCircle },
  { path: "/jobs", label: "Jobs", icon: Briefcase },
  {
    path: "/admin",
    label: "Administration",
    icon: Settings,
    adminOnly: true,
    children: [
      { path: "/admin/users", label: "Users", icon: UsersRound },
      { path: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck, superAdminOnly: true },
      { path: "/admin/auth-providers", label: "Auth Providers", icon: KeyRound, superAdminOnly: true },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const { isAdmin, isSuperAdmin } = useAuthStore();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const visibleItems = navItems.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin();
    if (item.adminOnly) return isAdmin();
    return true;
  });

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar-background transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16",
      )}
    >
      {/* Logo / toggle */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        {sidebarOpen && (
          <span className="text-lg font-bold text-sidebar-foreground">Parthenon</span>
        )}
        <button
          onClick={toggleSidebar}
          className="rounded-md p-1 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="mt-2 space-y-0.5 px-2 overflow-y-auto h-[calc(100vh-3.5rem)]">
        {visibleItems.map((item) => {
          const active = isActive(item.path);
          const adminExpanded = sidebarOpen && active && item.children;

          return (
            <div key={item.path}>
              <Link
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <item.icon size={20} className="shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </Link>

              {/* Admin sub-navigation */}
              {adminExpanded && item.children && (
                <div className="ml-8 mt-0.5 space-y-0.5">
                  {item.children
                    .filter((child) => !child.superAdminOnly || isSuperAdmin())
                    .map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition-colors",
                          location.pathname === child.path
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        )}
                      >
                        <child.icon size={14} className="shrink-0" />
                        {child.label}
                      </Link>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
