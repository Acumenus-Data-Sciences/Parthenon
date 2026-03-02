import { cn } from "@/lib/utils";

export type StatusDotVariant =
  | "healthy"
  | "success"
  | "active"
  | "pass"
  | "warning"
  | "degraded"
  | "critical"
  | "error"
  | "fail"
  | "unavailable"
  | "info"
  | "running"
  | "inactive"
  | "draft"
  | "queued"
  | "unknown";

export interface StatusDotProps {
  status: StatusDotVariant;
  className?: string;
  label?: string;
}

export function StatusDot({ status, className, label }: StatusDotProps) {
  return (
    <span
      className={cn("status-dot", status, className)}
      role="img"
      aria-label={label ?? status}
    />
  );
}
