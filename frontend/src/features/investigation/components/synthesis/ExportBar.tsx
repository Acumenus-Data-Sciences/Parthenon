import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useExportJson, useExportPdf } from "../../hooks/useExport";
import type { DossierExport } from "../../types";

interface ExportBarProps {
  investigationId: number;
  investigationTitle: string;
}

export function ExportBar({ investigationId, investigationTitle }: ExportBarProps) {
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
      setSuccessMsg("Exported successfully");
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
      setSuccessMsg("Exported successfully");
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 max-w-xl">
      <h3 className="text-sm font-semibold text-zinc-200">Export Dossier</h3>
      <p className="text-xs text-zinc-500">
        Export the full evidence dossier including all pinned findings, narratives, and section notes.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => { void handlePdf(); }}
          disabled={exportPdfMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-[#b52038] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {exportPdfMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : null}
          Export PDF
        </button>

        <button
          onClick={() => { void handleJson(); }}
          disabled={exportJsonMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-success hover:bg-success/10 disabled:opacity-50 disabled:cursor-not-allowed text-success text-sm font-medium transition-colors"
        >
          {exportJsonMutation.isPending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : null}
          Export JSON
        </button>
      </div>

      {successMsg && (
        <p className="text-xs text-success transition-opacity">{successMsg}</p>
      )}

      {(exportPdfMutation.isError || exportJsonMutation.isError) && (
        <p className="text-xs text-red-400">Export failed. Please try again.</p>
      )}
    </div>
  );
}
