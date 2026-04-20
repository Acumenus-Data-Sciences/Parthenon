import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { FhirHealthStatus } from "../../api/fhirApi";

export function HealthBadge({ status }: { status: FhirHealthStatus | undefined }) {
  const { t } = useTranslation("app");

  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-elevated text-text-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-text-muted" />
        {t("ingestion.fhirIngestion.checking")}
      </span>
    );
  }

  const isHealthy = status.status === "ok" || status.status === "healthy";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        isHealthy
          ? "bg-success/15 text-success"
          : "bg-critical/15 text-critical",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isHealthy ? "bg-success animate-pulse" : "bg-critical",
        )}
      />
      {isHealthy
        ? t("ingestion.fhirIngestion.serviceOnline")
        : t("ingestion.fhirIngestion.serviceOffline")}
    </span>
  );
}
