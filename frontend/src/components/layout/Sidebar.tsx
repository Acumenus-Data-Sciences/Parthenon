import { useState } from "react";
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
  TrendingUp,
  FileOutput,
  HelpCircle,
  Globe,
} from "lucide-react";
import { HelpSlideOver } from "@/features/help/components/HelpSlideOver";

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
  { path: "/publish", label: "Publish", icon: FileOutput },
  { path: "/profiles", label: "Patient Profiles", icon: UserCircle },
  { path: "/genomics", label: "Genomics", icon: Dna },
  { path: "/imaging", label: "Imaging", icon: ScanLine },
  { path: "/heor", label: "HEOR", icon: TrendingUp },
  { path: "/gis", label: "GIS Explorer", icon: Globe },
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

const routeHelpKeys: Record<string, string> = {
  "/": "dashboard",
  "/admin": "administration",
  "/admin/auth-providers": "admin.auth-providers",
  "/admin/notifications": "admin.notifications",
  "/admin/roles": "admin.roles",
  "/admin/users": "admin.users",
  "/analyses": "analyses",
  "/care-gaps": "care-gaps",
  "/cohort-definitions": "cohort-builder",
  "/concept-sets": "concept-set-builder",
  "/data-explorer": "data-explorer",
  "/data-sources": "data-sources",
  "/genomics": "genomics",
  "/gis": "gis",
  "/heor": "heor",
  "/imaging": "imaging",
  "/ingestion": "data-ingestion",
  "/jobs": "jobs",
  "/profiles": "profiles",
  "/publish": "publish",
  "/studies": "studies",
  "/vocabulary": "vocabulary-search",
};

function getHelpKeyForPath(pathname: string): string {
  if (routeHelpKeys[pathname]) return routeHelpKeys[pathname];
  const sorted = Object.keys(routeHelpKeys).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (prefix !== "/" && pathname.startsWith(prefix)) return routeHelpKeys[prefix];
  }
  return "dashboard";
}

export function Sidebar() {
  const location = useLocation();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  const { isAdmin, isSuperAdmin } = useAuthStore();
  const [helpOpen, setHelpOpen] = useState(false);

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
        <img src="/parthenon_icon.png" alt="Parthenon" className={cn("shrink-0", sidebarOpen ? "w-8 h-8" : "w-6 h-6")} />
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

      {/* Help button */}
      <div
        style={{
          padding: sidebarOpen ? "var(--space-2) var(--space-5)" : "var(--space-2) 0",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          title="Help"
          aria-label="Open contextual help"
          className={cn(
            "flex items-center gap-2 rounded-lg transition-colors",
            "bg-[#C9A227]/15 text-[#C9A227] hover:bg-[#C9A227]/25 hover:text-[#D4AF37]",
            sidebarOpen
              ? "px-3 py-2 text-sm font-medium w-full justify-center"
              : "h-8 w-8 justify-center",
          )}
        >
          <HelpCircle size={sidebarOpen ? 16 : 18} />
          {sidebarOpen && <span>Help</span>}
        </button>
      </div>

      <HelpSlideOver
        helpKey={helpOpen ? getHelpKeyForPath(location.pathname) : null}
        onClose={() => setHelpOpen(false)}
      />

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
