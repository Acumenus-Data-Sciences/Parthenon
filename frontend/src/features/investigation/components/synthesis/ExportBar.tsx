import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useExportJson, useExportPdf } from "../../hooks/useExport";
import type { DossierExport } from "../../types";

interface ExportBarProps {
  investigationId: number;
  investigationTitle: string;
}

export function ExportBar({ investigationId, investigationTitle }: ExportBarProps) {
  const { t } = useTranslation("app");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const exportPdfMutation = useExportPdf();
  const exportJsonMutation = useExportJson();

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  function slugTitle() {
    return investigationTitle.toLowerCase().replace(/\s+/g, "-");
  }

  async function handlePdf() {
    try {
      const blob = await exportPdfMutation.mutateAsync(investigationId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugTitle()}-dossier.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMsg(t("investigation.common.messages.exportSucceeded"));
    } catch {
      // error handled by mutation state
    }
  }

  async function handleJson() {
    try {
      const data: DossierExport = await exportJsonMutation.mutateAsync(investigationId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slugTitle()}-dossier.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMsg(t("investigation.common.messages.exportSucceeded"));
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 max-w-xl">
      <h3 className="text-sm font-semibold text-text-primary">
        {t("investigation.common.sections.exportDossier")}
      </h3>
      <p className="text-xs text-text-ghost">
        {t("investigation.synthesis.exportDescription")}
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => { void handlePdf(); }}
          disabled={exportPdfMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground text-sm font-medium transition-colors"
        >
          {exportPdfMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : null}
          {t("investigation.common.actions.exportPdf")}
        </button>

        <button
          onClick={() => { void handleJson(); }}
          disabled={exportJsonMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-success hover:bg-success/10 disabled:opacity-50 disabled:cursor-not-allowed text-success text-sm font-medium transition-colors"
        >
          {exportJsonMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : null}
          {t("investigation.common.actions.exportJson")}
        </button>
      </div>

      {successMsg && (
        <p className="text-xs text-success transition-opacity">{successMsg}</p>
      )}

      {(exportPdfMutation.isError || exportJsonMutation.isError) && (
        <p className="text-xs text-red-400">
          {t("investigation.common.messages.exportFailed")}
        </p>
      )}
    </div>
  );
}
