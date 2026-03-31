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
  ChevronDown,
  ClipboardList,
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
  Brain,
  Library,
  Package,
  ArrowLeftRight,
  MessageSquareCode,
  FlaskRound,
  Microscope,
  Activity,
  MessageSquare,
  PanelsTopLeft,
  ScrollText,
  NotebookPen,
  ShieldUser,
  type LucideIcon,
} from "lucide-react";
import { HelpSlideOver } from "@/features/help/components/HelpSlideOver";

interface NavChild {
  path: string;
  label: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  children?: NavChild[];
}

const studyAgentEnabled = import.meta.env.VITE_STUDY_AGENT_ENABLED === "true";

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/commons", label: "Commons", icon: MessageSquare },
  {
    path: "/data-sources",
    label: "Data",
    icon: Database,
    children: [
      { path: "/data-sources", label: "Clinical Data Models", icon: Database },
      { path: "/ingestion", label: "Data Ingestion", icon: Upload },
      { path: "/data-explorer", label: "Data Explorer", icon: BarChart3 },
    ],
  },
  {
    path: "/vocabulary",
    label: "Vocabulary",
    icon: BookOpen,
    children: [
      { path: "/vocabulary", label: "Vocabulary Search", icon: BookOpen },
      { path: "/mapping-assistant", label: "Mapping Assistant", icon: ArrowLeftRight },
    ],
  },
  {
    path: "/cohort-definitions",
    label: "Research",
    icon: FlaskRound,
    children: [
      { path: "/cohort-definitions", label: "Cohort Definitions", icon: Users },
      { path: "/concept-sets", label: "Concept Sets", icon: FlaskConical },
      { path: "/analyses", label: "Analyses", icon: Workflow },
      { path: "/studies", label: "Studies", icon: Briefcase },
      ...(studyAgentEnabled
        ? [{ path: "/study-designer", label: "Study Designer", icon: Brain }]
        : []),
      { path: "/study-packages", label: "Study Packages", icon: Package },
      { path: "/phenotype-library", label: "Phenotype Library", icon: Library },
    ],
  },
  {
    path: "/profiles",
    label: "Evidence",
    icon: Microscope,
    children: [
      { path: "/profiles", label: "Patient Profiles", icon: UserCircle },
      { path: "/risk-scores", label: "Risk Scores", icon: Activity },
      { path: "/standard-pros", label: "Standard PROs+", icon: ClipboardList },
      { path: "/genomics", label: "Genomics", icon: Dna },
      { path: "/imaging", label: "Imaging", icon: ScanLine },
      { path: "/heor", label: "HEOR", icon: TrendingUp },
      { path: "/gis", label: "GIS Explorer", icon: Globe },
    ],
  },
  {
    path: "/query-assistant",
    label: "Tools",
    icon: Activity,
    children: [
      { path: "/jupyter", label: "Jupyter", icon: NotebookPen },
      { path: "/workbench", label: "Workbench", icon: PanelsTopLeft },
      { path: "/query-assistant", label: "Query Assistant", icon: MessageSquareCode },
      { path: "/publish", label: "Publish", icon: FileOutput },
      { path: "/jobs", label: "Jobs", icon: Briefcase },
    ],
  },
  {
    path: "/admin",
    label: "Administration",
    icon: Settings,
    adminOnly: true,
    children: [
      { path: "/admin", label: "Admin Dashboard", icon: Settings },
      { path: "/admin/system-health", label: "System Health", icon: Activity },
      { path: "/admin/honest-broker", label: "Honest Broker", icon: ShieldUser },
      { path: "/admin/users", label: "Users", icon: UsersRound },
      { path: "/admin/user-audit", label: "Audit Log", icon: ScrollText },
      { path: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck, superAdminOnly: true },
      { path: "/admin/auth-providers", label: "Auth Providers", icon: KeyRound, superAdminOnly: true },
      { path: "/admin/notifications", label: "Notifications", icon: Bell },
    ],
  },
];

const routeHelpKeys: Record<string, string> = {
  "/": "dashboard",
  "/admin": "administration",
  "/admin/ai-providers": "admin.ai-providers",
  "/admin/auth-providers": "admin.auth-providers",
  "/admin/fhir-connections": "admin.fhir-connections",
  "/admin/fhir-export": "admin.fhir-export",
  "/admin/fhir-sync-monitor": "admin.fhir-sync-monitor",
  "/admin/honest-broker": "administration",
  "/admin/notifications": "admin.notifications",
  "/admin/roles": "admin.roles",
  "/admin/system-health": "admin.system-health",
  "/admin/users": "admin.users",
  "/admin/vocabulary": "admin.vocabulary",
  "/admin/webapi-registry": "admin.webapi-registry",
  "/analyses": "analyses",
  "/analyses/characterizations": "characterization",
  "/analyses/estimations": "estimation",
  "/analyses/evidence-synthesis": "evidence-synthesis",
  "/analyses/incidence-rates": "incidence-rates",
  "/analyses/pathways": "treatment-pathways",
  "/analyses/predictions": "prediction",
  "/analyses/sccs": "sccs",
  "/care-gaps": "care-gaps",
  "/cohort-definitions": "cohort-builder",
  "/concept-sets": "concept-set-builder",
  "/data-explorer": "data-explorer",
  "/data-sources": "data-sources",
  "/etl-tools": "data-ingestion",
  "/fhir-ingestion": "data-ingestion",
  "/genomics": "genomics",
  "/gis": "gis",
  "/heor": "heor",
  "/imaging": "imaging",
  "/ingestion": "data-ingestion",
  "/jupyter": "jupyter",
  "/jobs": "jobs",
  "/mapping-assistant": "mapping-assistant",
  "/phenotype-library": "phenotype-library",
  "/profiles": "profiles",
  "/publish": "publish",
  "/query-assistant": "query-assistant",
  "/source-profiler": "data-ingestion",
  "/studies": "studies",
  "/study-designer": "study-designer",
  "/workbench": "study-designer",
  "/study-packages": "study-packages",
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
  const [manualOpen, setManualOpen] = useState<Set<string>>(new Set());
  const [manualClosed, setManualClosed] = useState<Set<string>>(new Set());

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const isGroupActive = (item: NavItem) => {
    if (!item.children) return isActive(item.path);
    return item.children.some((child) => isActive(child.path));
  };

  const toggleGroup = (path: string) => {
    const groupActive = navItems.find((i) => i.path === path)?.children?.some((c) => isActive(c.path)) ?? false;

    if (groupActive) {
      // Active group: toggle in/out of manualClosed
      setManualClosed((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    } else {
      // Inactive group: toggle in/out of manualOpen
      setManualOpen((prev) => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    }
  };

  const isExpanded = (item: NavItem) => {
    if (manualClosed.has(item.path)) return false;
    return manualOpen.has(item.path) || isGroupActive(item);
  };

  const visibleItems = navItems.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin();
    if (item.adminOnly) return isAdmin();
    return true;
  });

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
          const hasChildren = item.children && item.children.length > 0;
          const groupActive = isGroupActive(item);
          const expanded = hasChildren && isExpanded(item);

          if (!hasChildren) {
            // Simple link (Dashboard)
            return (
              <div key={item.path}>
                <Link
                  to={item.path}
                  className={cn("nav-item", isActive(item.path) && "active")}
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
              </div>
            );
          }

          // Group with children (accordion)
          return (
            <div key={item.path}>
              <button
                type="button"
                onClick={() => toggleGroup(item.path)}
                className={cn("nav-item", groupActive && "active")}
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
                {sidebarOpen && (
                  <>
                    <span className="nav-label">{item.label}</span>
                    <ChevronDown
                      size={14}
                      className={cn(
                        "ml-auto shrink-0 transition-transform duration-200",
                        expanded && "rotate-180",
                      )}
                    />
                  </>
                )}
              </button>

              {/* Expanded children */}
              {sidebarOpen && expanded && (
                <div>
                  {item.children!
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
