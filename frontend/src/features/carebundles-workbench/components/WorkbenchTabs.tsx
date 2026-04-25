import { NavLink } from "react-router-dom";
import { GitMerge, LayoutGrid, List, Scale } from "lucide-react";

const TABS = [
  { to: "/workbench/care-bundles", label: "Bundles", icon: LayoutGrid, end: true },
  { to: "/workbench/care-bundles/intersect", label: "Intersect", icon: GitMerge, end: false },
  { to: "/workbench/care-bundles/value-sets", label: "Value Sets", icon: List, end: false },
  { to: "/workbench/care-bundles/measures", label: "CMS Measures", icon: Scale, end: false },
] as const;

export function WorkbenchTabs() {
  return (
    <nav className="flex items-center gap-1 border-b border-border-default">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            [
              "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-accent text-text-primary"
                : "border-transparent text-text-ghost hover:text-text-primary",
            ].join(" ")
          }
        >
          <Icon className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
