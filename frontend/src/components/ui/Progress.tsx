import { cn } from "@/lib/utils";

export interface ProgressProps {
  value?: number;
  max?: number;
  variant?: "default" | "primary" | "success" | "warning" | "critical" | "info";
  indeterminate?: boolean;
  className?: string;
  label?: string;
}

export function Progress({
  value = 0,
  max = 100,
  variant = "default",
  indeterminate,
  className,
  label,
}: ProgressProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div
      className={cn("progress-track", className)}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div
        className={cn(
          "progress-fill",
          variant !== "default" && variant,
          indeterminate && "indeterminate",
        )}
        style={indeterminate ? undefined : { width: `${percent}%` }}
      />
    </div>
  );
}
