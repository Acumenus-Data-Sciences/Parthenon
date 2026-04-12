import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChartMetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  badge?: ReactNode;
  className?: string;
}

export function ChartMetricCard({ label, value, subValue, badge, className }: ChartMetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border-default bg-surface-raised p-4",
        className,
      )}
      data-testid="chart-metric-card"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-text-muted">{label}</p>
        {badge}
      </div>
      <p className="mt-1 font-['IBM_Plex_Mono',monospace] text-lg font-bold text-text-primary">
        {value}
      </p>
      {subValue && (
        <p className="mt-0.5 text-[10px] text-text-ghost">{subValue}</p>
      )}
    </div>
  );
}
