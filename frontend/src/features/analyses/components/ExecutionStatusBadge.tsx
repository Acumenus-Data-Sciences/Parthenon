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
  pending: { icon: Clock, color: "#8A857D", label: "Pending" },
  queued: { icon: Clock, color: "#60A5FA", label: "Queued" },
  running: { icon: Loader2, color: "#F59E0B", label: "Running" },
  completed: { icon: CheckCircle2, color: "#2DD4BF", label: "Completed" },
  failed: { icon: XCircle, color: "#E85A6B", label: "Failed" },
  cancelled: { icon: Ban, color: "#8A857D", label: "Cancelled" },
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
