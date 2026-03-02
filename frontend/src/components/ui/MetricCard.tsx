import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  description?: string;
  trend?: { value: string; direction: "positive" | "negative" | "neutral" };
  variant?: "default" | "critical" | "warning" | "success" | "info";
  icon?: ReactNode;
}

export function MetricCard({
  className,
  label,
  value,
  description,
  trend,
  variant = "default",
  icon,
  ...props
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "metric-card",
        variant !== "default" && variant,
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <span className="metric-label">{label}</span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
      <div className="metric-value">{value}</div>
      {description && <div className="metric-description">{description}</div>}
      {trend && (
        <div className={cn("metric-trend", trend.direction)}>
          {trend.value}
        </div>
      )}
    </div>
  );
}
