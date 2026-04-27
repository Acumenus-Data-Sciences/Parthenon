import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerificationBadge({ status }: { status: string }) {
  const { t } = useTranslation("app");
  const label = status === "verified"
    ? t("studies.workbench.labels.verified")
    : status === "partial"
      ? t("studies.workbench.labels.needsCheck")
      : status === "blocked"
        ? t("studies.workbench.labels.blocked")
        : t("studies.workbench.labels.unverified");
  const tone = status === "verified" ? "success" : status === "blocked" ? "critical" : "warning";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider",
        tone === "success" && "bg-success/10 text-success",
        tone === "warning" && "bg-warning/10 text-warning",
        tone === "critical" && "bg-critical/10 text-critical",
      )}
    >
      {tone === "success" ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
      {label}
    </span>
  );
}
