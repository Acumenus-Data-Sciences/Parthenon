import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ExecutionStatus } from "../types/analysis";

function getStatusConfig(t: (key: string) => string): Record<
  ExecutionStatus,
  { icon: typeof Clock; color: string; label: string }
> {
  return {
    pending: { icon: Clock, color: "var(--text-muted)", label: t("analyses.auto.pending_2d13df") },
    queued: { icon: Clock, color: "var(--info)", label: t("analyses.auto.queued_7b2f31") },
    running: { icon: Loader2, color: "var(--warning)", label: t("analyses.auto.running_5bda81") },
    completed: { icon: CheckCircle2, color: "var(--success)", label: t("analyses.auto.completed_07ca50") },
    failed: { icon: XCircle, color: "var(--critical)", label: t("analyses.auto.failed_d7c8c8") },
    cancelled: { icon: Ban, color: "var(--text-muted)", label: t("analyses.auto.cancelled_a149e8") },
  };
}

interface ExecutionStatusBadgeProps {
  status: ExecutionStatus;
}

export function ExecutionStatusBadge({ status }: ExecutionStatusBadgeProps) {
  const { t } = useTranslation("app");
  const config = getStatusConfig(t)[status];
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
