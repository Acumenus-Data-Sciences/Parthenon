import { type HTMLAttributes, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface MetricCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  description?: string;
  trend?: { value: string; direction: "positive" | "negative" | "neutral" };
  variant?: "default" | "critical" | "warning" | "success" | "info";
  icon?: ReactNode;
  to?: string;
}

export function MetricCard({
  className,
  label,
  value,
  description,
  trend,
  variant = "default",
  icon,
  to,
  ...props
}: MetricCardProps) {
  const card = (
    <div
      className={cn(
        "metric-card",
        variant !== "default" && variant,
        to && "cursor-pointer",
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

  if (to) {
    return (
      <Link to={to} style={{ textDecoration: "none", color: "inherit" }}>
        {card}
      </Link>
    );
  }

  return card;
}
