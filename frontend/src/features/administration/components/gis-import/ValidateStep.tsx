import { useEffect } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useValidateImport } from "../../hooks/useGisImport";
import type { ValidationResult } from "../../types/gisImport";

interface Props {
  importId: number;
  onComplete: (result: ValidationResult) => void;
  onBack: () => void;
}

export function ValidateStep({ importId, onComplete, onBack }: Props) {
  const { t } = useTranslation("app");
  const validate = useValidateImport();

  useEffect(() => {
    if (!validate.data && !validate.isPending && !validate.isError) {
      validate.mutate(importId);
    }
  }, [importId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (validate.isPending) {
    return (
      <div className="flex flex-col items-center py-8">
        <Loader2 className="mb-2 h-8 w-8 animate-spin text-accent" />
        <p className="text-sm text-text-muted">
          {t("administration.gisImport.validate.validating")}
        </p>
      </div>
    );
  }

  if (validate.isError) {
    return (
      <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        {t("administration.gisImport.validate.validationFailed")}{" "}
        {validate.error instanceof Error
          ? validate.error.message
          : t("administration.gisImport.validate.unknownError")}
      </div>
    );
  }

  const result = validate.data;
  if (!result) return null;

  return (
    <div className="space-y-4">
      <div className="rounded border border-border-default bg-surface-base p-4">
        <h3 className="mb-3 text-sm font-medium text-text-primary">
          {t("administration.gisImport.validate.results")}
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <Stat label={t("administration.gisImport.validate.stats.totalRows")} value={result.total_rows} />
          <Stat label={t("administration.gisImport.validate.stats.uniqueGeographies")} value={result.unique_geographies} />
          <Stat label={t("administration.gisImport.validate.stats.matched")} value={result.matched} color="text-green-400" />
          <Stat label={t("administration.gisImport.validate.stats.unmatched")} value={result.unmatched} color={result.unmatched > 0 ? "text-amber-400" : "text-green-400"} />
          <Stat label={t("administration.gisImport.validate.stats.matchRate")} value={`${result.match_rate}%`} />
          <Stat label={t("administration.gisImport.validate.stats.geographyType")} value={result.location_type} />
        </div>
      </div>

      {result.unmatched > 0 && (
        <div className="flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div className="text-xs text-amber-300">
            <p>
              {t("administration.gisImport.validate.unmatchedWarning", {
                count: result.unmatched,
              })}
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="rounded border border-surface-highlight px-4 py-2 text-sm text-text-muted hover:border-text-ghost"
        >
          {t("administration.gisImport.validate.backToMapping")}
        </button>
        <button
          onClick={() => onComplete(result)}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-surface-base hover:bg-accent/90"
        >
          {t("administration.gisImport.validate.proceedWithImport")}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className="text-xs text-text-ghost">{label}</p>
      <p className={`text-lg font-semibold ${color ?? "text-text-primary"}`}>{value}</p>
    </div>
  );
}
