import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
} from "lucide-react";
import type { ExecutionStatus } from "../types/analysis";

const statusConfig: Record<
  ExecutionStatus,
  { icon: typeof Clock; color: string; label: string }
> = {
  pending: { icon: Clock, color: "var(--text-muted)", label: "Pending" },
  queued: { icon: Clock, color: "var(--info)", label: "Queued" },
  running: { icon: Loader2, color: 'var(--warning)', label: "Running" },
  completed: { icon: CheckCircle2, color: "var(--success)", label: "Completed" },
  failed: { icon: XCircle, color: "var(--critical)", label: "Failed" },
  cancelled: { icon: Ban, color: "var(--text-muted)", label: "Cancelled" },
};

interface ExecutionStatusBadgeProps {
  status: ExecutionStatus;
}

export function ExecutionStatusBadge({ status }: ExecutionStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: `${config.color}15`,
        color: config.color,
      }}
    >
      <Icon
        size={10}
        className={status === "running" ? "animate-spin" : ""}
      />
      {config.label}
    </span>
  );
}
