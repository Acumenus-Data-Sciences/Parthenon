import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

export interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function TabBar({ tabs, activeTab, onTabChange, className }: TabBarProps) {
  return (
    <div className={cn("tab-bar", className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={cn("tab-item", activeTab === tab.id && "active")}
          onClick={() => onTabChange(tab.id)}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
        >
          {tab.icon && <span className="mr-2 inline-flex">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export interface TabPanelProps {
  id: string;
  active: boolean;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ id, active, children, className }: TabPanelProps) {
  if (!active) return null;
  return (
    <div
      id={`tabpanel-${id}`}
      role="tabpanel"
      aria-labelledby={id}
      className={className}
    >
      {children}
    </div>
  );
}
