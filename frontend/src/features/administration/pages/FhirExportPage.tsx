import { PackageOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function FhirExportPage() {
  const { t } = useTranslation("app");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">
          {t("administration.fhirExport.title")}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {t("administration.fhirExport.subtitle")}
        </p>
      </div>

      {/* Coming Soon Card */}
      <div className="rounded-lg border border-border-default bg-surface-overlay p-8">
        <div className="flex flex-col items-center text-center max-w-md mx-auto py-6">
          <PackageOpen size={40} className="text-success mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            {t("administration.fhirExport.comingSoon")}
          </h2>
          <p className="text-sm text-text-secondary mb-4">
            {t("administration.fhirExport.description")}
          </p>
          <p className="text-xs text-text-ghost">
            {t("administration.fhirExport.backendPending")}
          </p>
        </div>
      </div>
    </div>
  );
}
