// ---------------------------------------------------------------------------
// ExportControls — Format picker + export button
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Download, FileText, FileSpreadsheet, Image, Code, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ExportFormat } from "../types/publish";

interface ExportControlsProps {
  onExport: (format: ExportFormat) => void;
  isExporting: boolean;
}

/**
 * Export format picker with radio buttons and export trigger button.
 */
export function ExportControls({ onExport, isExporting }: ExportControlsProps) {
  const { t } = useTranslation("app");
  const [selected, setSelected] = useState<ExportFormat>("pdf");
  const formatOptions: {
    value: ExportFormat;
    label: string;
    description: string;
    icon: LucideIcon;
    available: boolean;
  }[] = [
    {
      value: "pdf",
      label: "PDF",
      description: t("publish.exportControls.formats.pdf.description"),
      icon: FileText,
      available: true,
    },
    {
      value: "docx",
      label: "DOCX",
      description: t("publish.exportControls.formats.docx.description"),
      icon: FileText,
      available: false,
    },
    {
      value: "xlsx",
      label: "XLSX",
      description: t("publish.exportControls.formats.xlsx.description"),
      icon: FileSpreadsheet,
      available: false,
    },
    {
      value: "png",
      label: "PNG",
      description: t("publish.exportControls.formats.png.description"),
      icon: Image,
      available: true,
    },
    {
      value: "svg",
      label: "SVG",
      description: t("publish.exportControls.formats.svg.description"),
      icon: Code,
      available: true,
    },
  ];

  return (
    <div data-testid="export-controls" className="space-y-6">
      {/* Format selector */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          {t("publish.exportControls.exportFormat")}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {formatOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selected === opt.value;

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  isSelected
                    ? "border-success bg-success/10"
                    : "border-border-default bg-surface-raised hover:border-success/40"
                }`}
              >
                <Icon
                  size={18}
                  className={isSelected ? "text-success" : "text-text-primary/40"}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isSelected ? "text-success" : "text-text-primary"
                      }`}
                    >
                      {opt.label}
                    </span>
                    {!opt.available && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                        {t("publish.exportControls.comingSoon")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-primary/40 mt-0.5">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Export button */}
      <button
        type="button"
        onClick={() => onExport(selected)}
        disabled={isExporting}
        className="flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-surface-base hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Download size={16} />
        {isExporting
          ? t("publish.exportControls.exporting")
          : t("publish.exportControls.exportAs", {
              format: selected.toUpperCase(),
            })}
      </button>
    </div>
  );
}
