// ---------------------------------------------------------------------------
// ExportPanel — Step 4: Format picker and download trigger
// ---------------------------------------------------------------------------

import { useState } from "react";
import {
  FileText,
  FileDown,
  ImageIcon,
  ArrowLeft,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReportSection, ExportFormat } from "../types/publish";
import { useExportDocument } from "../hooks/useDocumentExport";
import type { ExportRequest } from "../api/publishApi";
import { getDiagramSvgMarkup, svgMarkupToPngDataUrl } from "../lib/svgExport";

type ExportableFormat = "docx" | "pdf" | "figures-zip";

interface ExportPanelProps {
  sections: ReportSection[];
  title: string;
  authors: string[];
  template: string;
  onBack: () => void;
}

function formatLabel(
  t: (key: string) => string,
  format: ExportableFormat,
): string {
  switch (format) {
    case "docx":
      return t("publish.exportPanel.formatLabels.docx");
    case "pdf":
      return t("publish.exportPanel.formatLabels.pdf");
    case "figures-zip":
      return t("publish.exportPanel.formatLabels.figuresZip");
  }
}

export default function ExportPanel({
  sections,
  title,
  authors,
  template,
  onBack,
}: ExportPanelProps) {
  const { t } = useTranslation("app");
  const [selectedFormat, setSelectedFormat] = useState<ExportableFormat>("docx");
  const exportMutation = useExportDocument();
  const formatOptions: Array<{
    format: ExportableFormat;
    icon: typeof FileText;
    label: string;
    description: string;
  }> = [
    {
      format: "docx",
      icon: FileText,
      label: t("publish.exportPanel.formats.docx.label"),
      description: t("publish.exportPanel.formats.docx.description"),
    },
    {
      format: "pdf",
      icon: FileDown,
      label: t("publish.exportPanel.formats.pdf.label"),
      description: t("publish.exportPanel.formats.pdf.description"),
    },
    {
      format: "figures-zip",
      icon: ImageIcon,
      label: t("publish.exportPanel.formats.figuresZip.label"),
      description: t("publish.exportPanel.formats.figuresZip.description"),
    },
  ];

  const includedSections = sections.filter((s) => s.included);
  const hasDraftNarratives = includedSections.some(
    (s) => s.narrativeState === "draft",
  );

  const handleExport = async () => {
    const exportSections: ExportRequest["sections"] = await Promise.all(
      includedSections.map(async (section) => {
        const svgMarkup =
          section.svgMarkup ??
          (section.diagramType ? getDiagramSvgMarkup(section.id) : undefined);
        const pngDataUrl = svgMarkup
          ? await svgMarkupToPngDataUrl(svgMarkup)
          : undefined;

        return {
          type: section.type,
          title: section.title,
          content: typeof section.content === "string" ? section.content : (section.content ? JSON.stringify(section.content) : undefined),
          included: section.included,
          svg: svgMarkup,
          png_data_url: pngDataUrl,
          caption: section.caption,
          diagram_type: section.diagramType,
          table_data: section.tableIncluded !== false && section.tableData
            ? section.tableData
            : undefined,
        };
      }),
    );

    exportMutation.mutate({
      template,
      format: selectedFormat as ExportFormat,
      title,
      authors,
      sections: exportSections,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Draft warning */}
      {hasDraftNarratives && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-200">
            {t("publish.exportPanel.draftWarning")}
          </p>
        </div>
      )}

      {/* Format grid */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-text-primary">
          {t("publish.exportPanel.chooseExportFormat")}
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {formatOptions.map(({ format, icon: Icon, label, description }) => {
            const isSelected = selectedFormat === format;
            return (
              <button
                key={format}
                type="button"
                onClick={() => setSelectedFormat(format)}
                className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-colors ${
                  isSelected
                    ? "border-accent bg-accent/5"
                    : "border-border-default bg-surface-raised hover:border-text-ghost"
                }`}
              >
                <Icon
                  className={`h-8 w-8 ${
                    isSelected ? "text-accent" : "text-text-ghost"
                  }`}
                />
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      isSelected ? "text-accent" : "text-text-primary"
                    }`}
                  >
                    {label}
                  </p>
                  <p className="mt-1 text-xs text-text-ghost">{description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {exportMutation.isError && (
        <div className="rounded-lg border border-critical/30 bg-critical/10 px-4 py-3 text-sm text-critical">
          {exportMutation.error instanceof Error
            ? exportMutation.error.message
            : "Export failed. Please try again."}
        </div>
      )}

      {/* Export button */}
      <button
        type="button"
        onClick={handleExport}
        disabled={hasDraftNarratives || exportMutation.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-surface-base transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        {exportMutation.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("publish.exportPanel.exporting")}
          </>
        ) : (
          <>
            {t("publish.exportPanel.exportAs", {
              format: formatLabel(t, selectedFormat),
            })}
          </>
        )}
      </button>

      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-lg border border-border-default px-4 py-2 text-sm text-text-primary transition-colors hover:bg-surface-elevated"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("publish.exportPanel.backToPreview")}
        </button>
      </div>
    </div>
  );
}
