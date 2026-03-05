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
  Bell,
  Dna,
  ScanLine,
} from "lucide-react";
import { ParthenonIcon } from "@/components/icons/ParthenonIcon";

interface NavItem {
  path: string;
  label: string;
  icon: React.ElementType;
  section?: string;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  children?: Array<{
    path: string;
    label: string;
    icon: React.ElementType;
    superAdminOnly?: boolean;
  }>;
}

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, section: "Overview" },
  { path: "/data-sources", label: "Data Sources", icon: Database, section: "Data" },
  { path: "/ingestion", label: "Data Ingestion", icon: Upload },
  { path: "/data-explorer", label: "Data Explorer", icon: BarChart3 },
  { path: "/vocabulary", label: "Vocabulary", icon: BookOpen, section: "Research" },
  { path: "/cohort-definitions", label: "Cohort Definitions", icon: Users },
  { path: "/concept-sets", label: "Concept Sets", icon: FlaskConical },
  { path: "/analyses", label: "Analyses", icon: Workflow },
  { path: "/studies", label: "Studies", icon: Briefcase },
  { path: "/profiles", label: "Patient Profiles", icon: UserCircle },
  { path: "/genomics", label: "Genomics", icon: Dna },
  { path: "/imaging", label: "Imaging", icon: ScanLine },
  { path: "/jobs", label: "Jobs", icon: Briefcase, section: "System" },
  {
    path: "/admin",
    label: "Administration",
    icon: Settings,
    adminOnly: true,
    children: [
      { path: "/admin/users", label: "Users", icon: UsersRound },
      { path: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck, superAdminOnly: true },
      { path: "/admin/auth-providers", label: "Auth Providers", icon: KeyRound, superAdminOnly: true },
      { path: "/admin/notifications", label: "Notifications", icon: Bell },
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

  let lastSection: string | undefined;

  return (
    <aside className={cn("app-sidebar", !sidebarOpen && "collapsed")} data-tour="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <ParthenonIcon className={cn("shrink-0 text-[#C9A227]", sidebarOpen ? "w-8 h-8" : "w-6 h-6")} />
        {sidebarOpen && <span className="sidebar-logo">Parthenon</span>}
        <button
          onClick={toggleSidebar}
          className="sidebar-toggle"
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" style={{ flex: 1 }}>
        {visibleItems.map((item) => {
          const active = isActive(item.path);
          const showSection = sidebarOpen && item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;

          return (
            <div key={item.path}>
              {showSection && (
                <div className="sidebar-section-label">{item.section}</div>
              )}
              <Link
                to={item.path}
                className={cn("nav-item", active && "active")}
                title={!sidebarOpen ? item.label : undefined}
                data-tour={
                  item.path === "/data-sources"
                    ? "data-sources"
                    : item.path === "/cohort-definitions"
                      ? "cohort-definitions"
                      : item.path === "/vocabulary"
                        ? "vocabulary"
                        : undefined
                }
              >
                <item.icon size={18} className="nav-icon" />
                {sidebarOpen && <span className="nav-label">{item.label}</span>}
              </Link>

              {/* Admin sub-navigation */}
              {sidebarOpen && active && item.children && (
                <div>
                  {item.children
                    .filter((child) => !child.superAdminOnly || isSuperAdmin())
                    .map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={cn(
                          "nav-sub-item",
                          location.pathname === child.path && "active",
                        )}
                      >
                        <child.icon size={14} />
                        {child.label}
                      </Link>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Acumenus branding */}
      <div
        style={{
          padding: sidebarOpen ? "var(--space-4) var(--space-5)" : "var(--space-4) 0",
          borderTop: "1px solid var(--border-subtle)",
          textAlign: "center",
        }}
      >
        <a
          href="https://www.acumenus.io"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "var(--font-body)",
            fontSize: sidebarOpen ? "var(--text-xs)" : "9px",
            color: "var(--text-ghost)",
            textDecoration: "none",
            letterSpacing: "0.3px",
            transition: "color 200ms",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-muted)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-ghost)";
          }}
        >
          {sidebarOpen ? "Acumenus Data Sciences" : "ADS"}
        </a>
      </div>
    </aside>
  );
}
