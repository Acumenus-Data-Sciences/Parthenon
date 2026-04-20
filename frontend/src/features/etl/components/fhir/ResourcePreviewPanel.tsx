import { useTranslation } from "react-i18next";
import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { FHIR_RESOURCE_ICONS, fmtNumber } from "../../lib/fhir-utils";
import type { ResourcePreview } from "../../lib/fhir-utils";

export function ResourcePreviewPanel({ preview }: { preview: ResourcePreview[] }) {
  const { t } = useTranslation("app");
  const totalResources = preview.reduce((s, p) => s + p.count, 0);

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <div className="px-4 py-3 bg-surface-overlay border-b border-border-default flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-text-muted" />
          <h4 className="text-sm font-medium text-text-primary">
            {t("ingestion.fhirIngestion.resourcePreview")}
          </h4>
        </div>
        <span className="text-xs text-text-muted">
          {t("ingestion.fhirIngestion.resourcesDetected", {
            count: fmtNumber(totalResources),
          })}
        </span>
      </div>
      <div className="divide-y divide-border-subtle">
        {preview.map((p) => {
          const icon = FHIR_RESOURCE_ICONS[p.resourceType] ?? "\u{1F4C4}";
          const idPct = p.count > 0 ? Math.round((p.hasId / p.count) * 100) : 0;
          const codePct = p.count > 0 ? Math.round((p.hasCoding / p.count) * 100) : 0;
          return (
            <div
              key={p.resourceType}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span className="text-base w-6 text-center">{icon}</span>
              <span className="flex-1 text-sm font-medium text-text-primary">
                {p.resourceType}
              </span>
              <span className="text-xs tabular-nums text-text-secondary font-semibold w-12 text-right">
                {fmtNumber(p.count)}
              </span>
              <div className="flex items-center gap-3 text-[10px] text-text-muted w-40 justify-end">
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded",
                    idPct === 100
                      ? "bg-success/10 text-success"
                      : idPct > 0
                        ? "bg-accent/10 text-accent"
                        : "bg-critical/10 text-critical",
                  )}
                >
                  {t("ingestion.fhirIngestion.idPercent", { value: idPct })}
                </span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded",
                    codePct === 100
                      ? "bg-success/10 text-success"
                      : codePct > 0
                        ? "bg-accent/10 text-accent"
                        : "bg-surface-elevated text-text-ghost",
                  )}
                >
                  {t("ingestion.fhirIngestion.codedPercent", {
                    value: codePct,
                  })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
