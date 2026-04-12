import { AlertTriangle, XCircle, Info } from "lucide-react";
import type { AresAlert } from "../../../types/ares";

interface AlertBannerProps {
  alerts: AresAlert[];
}

const SEVERITY_STYLES = {
  critical: {
    border: "border-[#9B1B30]",
    bg: "bg-[#9B1B30]/10",
    icon: XCircle,
    iconColor: "text-[#e85d75]",
  },
  warning: {
    border: "border-[#C9A227]",
    bg: "bg-[#C9A227]/10",
    icon: AlertTriangle,
    iconColor: "text-[#C9A227]",
  },
  info: {
    border: "border-[#2DD4BF]",
    bg: "bg-[#2DD4BF]/10",
    icon: Info,
    iconColor: "text-[#2DD4BF]",
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
            <span className="text-sm text-[#ccc]">{alert.message}</span>
          </div>
        );
      })}
    </div>
  );
}
