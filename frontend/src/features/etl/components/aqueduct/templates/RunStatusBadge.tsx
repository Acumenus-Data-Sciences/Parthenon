import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { TemplateRunStatus } from "../../../types/templates";

const STYLE: Record<TemplateRunStatus, { bg: string; text: string }> = {
  pending: { bg: "bg-surface-overlay", text: "text-text-muted" },
  queued: { bg: "bg-info/15", text: "text-info" },
  running: { bg: "bg-warning/15", text: "text-warning" },
  completed: { bg: "bg-success/15", text: "text-success" },
  failed: { bg: "bg-critical/15", text: "text-critical" },
  cancelled: { bg: "bg-surface-overlay", text: "text-text-ghost" },
};

export function RunStatusBadge({ status }: { status: TemplateRunStatus }) {
  const { t } = useTranslation("app");
  const s = STYLE[status];
  return (
    <span
      data-testid={`run-status-${status}`}
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        s.bg,
        s.text,
      )}
    >
      {t(`aqueduct.status.${status}`, { defaultValue: status })}
    </span>
  );
}
