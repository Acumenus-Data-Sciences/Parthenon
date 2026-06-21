import type { ReactNode } from "react";

interface ChartCardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, subtitle, children, className }: ChartCardProps) {
  return (
    <div className={`rounded-xl border border-border-default bg-surface-raised p-6 ${className ?? ""}`}>
      {title && (
        <h3 className="mb-1 text-sm font-semibold uppercase tracking-wider text-text-muted">
          {title}
        </h3>
      )}
      {subtitle && (
        <p className="mb-4 text-xs text-text-ghost">{subtitle}</p>
      )}
      {!subtitle && title && <div className="mb-4" />}
      {children}
    </div>
  );
}
