import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/uiStore";
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
} from "lucide-react";

const navItems = [
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
  { path: "/admin", label: "Administration", icon: Settings },
];

export function Sidebar() {
  const location = useLocation();
  const { sidebarOpen, toggleSidebar } = useUiStore();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar-background transition-all duration-300",
        sidebarOpen ? "w-64" : "w-16",
      )}
    >
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        {sidebarOpen && (
          <span className="text-lg font-bold text-sidebar-foreground">
            Parthenon
          </span>
        )}
        <button
          onClick={toggleSidebar}
          className="rounded-md p-1 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>
      <nav className="mt-2 space-y-1 px-2">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
              title={!sidebarOpen ? item.label : undefined}
            >
              <item.icon size={20} className="shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
