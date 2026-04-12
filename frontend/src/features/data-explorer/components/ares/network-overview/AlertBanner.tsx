import { AlertTriangle, XCircle, Info } from "lucide-react";
import type { AresAlert } from "../../../types/ares";

interface AlertBannerProps {
  alerts: AresAlert[];
}

const SEVERITY_STYLES = {
  critical: {
    border: "border-primary",
    bg: "bg-primary/10",
    icon: XCircle,
    iconColor: "text-critical",
  },
  warning: {
    border: "border-accent",
    bg: "bg-accent/10",
    icon: AlertTriangle,
    iconColor: "text-accent",
  },
  info: {
    border: "border-success",
    bg: "bg-success/10",
    icon: Info,
    iconColor: "text-success",
  },
};

export default function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {alerts.slice(0, 5).map((alert, i) => {
        const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.warning;
        const Icon = style.icon;
        return (
          <div
            key={`${alert.type}-${alert.source_id}-${i}`}
            className={`flex items-center gap-3 rounded-lg border ${style.border} ${style.bg} px-4 py-2`}
          >
            <Icon size={16} className={style.iconColor} />
            <span className="text-sm text-text-secondary">{alert.message}</span>
          </div>
        );
      })}
    </div>
  );
}
