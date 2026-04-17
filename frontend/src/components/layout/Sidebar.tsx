import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  Hammer,
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
  labelKey: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}

interface NavItem {
  path: string;
  labelKey: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  children?: NavChild[];
}

const studyAgentEnabled = import.meta.env.VITE_STUDY_AGENT_ENABLED === "true";

const navItems: NavItem[] = [
  { path: "/", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { path: "/commons", labelKey: "nav.commons", icon: MessageSquare },
  {
    path: "/data-sources",
    labelKey: "nav.data",
    icon: Database,
    children: [
      { path: "/data-sources", labelKey: "nav.clinicalDataModels", icon: Database },
      { path: "/ingestion", labelKey: "nav.dataIngestion", icon: Upload },
      { path: "/data-explorer", labelKey: "nav.dataExplorer", icon: BarChart3 },
    ],
  },
  {
    path: "/vocabulary",
    labelKey: "nav.vocabulary",
    icon: BookOpen,
    children: [
      { path: "/vocabulary", labelKey: "nav.vocabularySearch", icon: BookOpen },
      { path: "/mapping-assistant", labelKey: "nav.mappingAssistant", icon: ArrowLeftRight },
    ],
  },
  {
    path: "/cohort-definitions",
    labelKey: "nav.research",
    icon: FlaskRound,
    children: [
      { path: "/cohort-definitions", labelKey: "nav.cohortDefinitions", icon: Users },
      { path: "/concept-sets", labelKey: "nav.conceptSets", icon: FlaskConical },
      { path: "/analyses", labelKey: "nav.analyses", icon: Workflow },
      { path: "/studies", labelKey: "nav.studies", icon: Briefcase },
      ...(studyAgentEnabled
        ? [{ path: "/study-designer", labelKey: "nav.studyDesigner", icon: Brain }]
        : []),
      { path: "/study-packages", labelKey: "nav.studyPackages", icon: Package },
      { path: "/phenotype-library", labelKey: "nav.phenotypeLibrary", icon: Library },
    ],
  },
  {
    path: "/profiles",
    labelKey: "nav.evidence",
    icon: Microscope,
    children: [
      { path: "/profiles", labelKey: "nav.patientProfiles", icon: UserCircle },
      { path: "/patient-similarity", labelKey: "nav.patientSimilarity", icon: UsersRound },
      { path: "/risk-scores", labelKey: "nav.riskScores", icon: Activity },
      { path: "/standard-pros", labelKey: "nav.standardPros", icon: ClipboardList },
      { path: "/genomics", labelKey: "nav.genomics", icon: Dna },
      { path: "/imaging", labelKey: "nav.imaging", icon: ScanLine },
      { path: "/heor", labelKey: "nav.heor", icon: TrendingUp },
      { path: "/gis", labelKey: "nav.gisExplorer", icon: Globe },
    ],
  },
  {
    path: "/query-assistant",
    labelKey: "nav.tools",
    icon: Hammer,
    children: [
      { path: "/jupyter", labelKey: "nav.jupyter", icon: NotebookPen },
      { path: "/workbench", labelKey: "nav.workbench", icon: PanelsTopLeft },
      { path: "/query-assistant", labelKey: "nav.queryAssistant", icon: MessageSquareCode },
      { path: "/publish", labelKey: "nav.publish", icon: FileOutput },
      { path: "/jobs", labelKey: "nav.jobs", icon: Briefcase },
    ],
  },
  {
    path: "/admin",
    labelKey: "nav.administration",
    icon: Settings,
    adminOnly: true,
    children: [
      { path: "/admin", labelKey: "nav.adminDashboard", icon: Settings },
      { path: "/admin/system-health", labelKey: "nav.systemHealth", icon: Activity },
      { path: "/admin/honest-broker", labelKey: "nav.honestBroker", icon: ShieldUser },
      { path: "/admin/users", labelKey: "nav.users", icon: UsersRound },
      { path: "/admin/user-audit", labelKey: "nav.auditLog", icon: ScrollText },
      { path: "/admin/roles", labelKey: "nav.rolesPermissions", icon: ShieldCheck, superAdminOnly: true },
      { path: "/admin/auth-providers", labelKey: "nav.authProviders", icon: KeyRound, superAdminOnly: true },
      { path: "/admin/notifications", labelKey: "nav.notifications", icon: Bell },
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
  const { t } = useTranslation("layout");
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
          aria-label={sidebarOpen ? t("sidebar.collapse") : t("sidebar.expand")}
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
          const itemLabel = t(item.labelKey);

          if (!hasChildren) {
            // Simple link (Dashboard)
            return (
              <div key={item.path}>
                <Link
                  to={item.path}
                  className={cn("nav-item", isActive(item.path) && "active")}
                  title={!sidebarOpen ? itemLabel : undefined}
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
                  {sidebarOpen && <span className="nav-label">{itemLabel}</span>}
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
                title={!sidebarOpen ? itemLabel : undefined}
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
                    <span className="nav-label">{itemLabel}</span>
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
                    .map((child) => {
                      const childLabel = t(child.labelKey);

                      return (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={cn(
                            "nav-sub-item",
                            location.pathname === child.path && "active",
                          )}
                        >
                          <child.icon size={14} />
                          {childLabel}
                        </Link>
                      );
                    })}
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
          title={t("sidebar.help")}
          aria-label={t("sidebar.openHelp")}
          className={cn(
            "flex items-center gap-2 rounded-lg transition-colors",
            "bg-accent/15 text-accent hover:bg-accent/25 hover:text-accent",
            sidebarOpen
              ? "px-3 py-2 text-sm font-medium w-full justify-center"
              : "h-8 w-8 justify-center",
          )}
        >
          <HelpCircle size={sidebarOpen ? 16 : 18} />
          {sidebarOpen && <span>{t("sidebar.help")}</span>}
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
