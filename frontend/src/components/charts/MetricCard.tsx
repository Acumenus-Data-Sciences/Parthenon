import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChartMetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  color?: "teal" | "gold" | "crimson" | "default";
  className?: string;
  children?: ReactNode;
}

const COLOR_MAP: Record<string, string> = {
  teal: "text-[#2DD4BF]",
  gold: "text-[#C9A227]",
  crimson: "text-[#E85A6B]",
  default: "text-[#F0EDE8]",
};

export function ChartMetricCard({
  label,
  value,
  subtitle,
  color = "default",
  className,
  children,
}: ChartMetricCardProps) {
  return (
    <div
      data-testid="chart-metric-card"
      className={cn(
        "rounded-lg border border-[#232328] bg-[#151518] p-4",
        className,
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wider text-[#8A857D]">
        {label}
      </span>
      <div className={cn("mt-1 text-2xl font-bold", COLOR_MAP[color])}>
        {value}
      </div>
      {subtitle && (
        <span className="mt-0.5 block text-xs text-[#5A5650]">{subtitle}</span>
      )}
      {children}
    </div>
  );
}
