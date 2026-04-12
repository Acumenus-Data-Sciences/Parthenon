import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChartMetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  subValue?: string;
  badge?: ReactNode;
  color?: "teal" | "gold" | "crimson" | "default";
  className?: string;
  children?: ReactNode;
}

const COLOR_MAP: Record<string, string> = {
  teal: "text-success",
  gold: "text-accent",
  crimson: "text-critical",
  default: "text-text-primary",
};

export function ChartMetricCard({
  label,
  value,
  subtitle,
  subValue,
  badge,
  color = "default",
  className,
  children,
}: ChartMetricCardProps) {
  return (
    <div
      data-testid="chart-metric-card"
      className={cn(
        "rounded-lg border border-border-default bg-surface-raised p-4",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
          {label}
        </span>
        {badge}
      </div>
      <div className={cn("mt-1 text-2xl font-bold", COLOR_MAP[color])}>
        {value}
      </div>
      {subValue && (
        <span className="mt-0.5 block text-xs text-text-ghost font-['IBM_Plex_Mono',monospace]">
          {subValue}
        </span>
      )}
      {subtitle && (
        <span className="mt-0.5 block text-xs text-text-ghost">{subtitle}</span>
      )}
      {children}
    </div>
  );
}
