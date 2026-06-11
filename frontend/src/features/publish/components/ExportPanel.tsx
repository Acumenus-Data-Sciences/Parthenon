// ---------------------------------------------------------------------------
// ExportPanel — Step 4: Format picker and download trigger
// ---------------------------------------------------------------------------

import { useState } from "react";
import {
  FileText,
  FileDown,
  ImageIcon,
  Code,
  ArrowLeft,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { downloadBlob } from "@/components/manuscript";
import type { ReportSection, ExportFormat, PublicationReportBundleExportRequest } from "../types/publish";
import { useExportDocument } from "../hooks/useDocumentExport";
import { useExportReportBundle } from "../hooks/useDrafts";
import type { ExportRequest } from "../api/publishApi";
import { getDiagramSvgMarkup, svgMarkupToPngDataUrl } from "../lib/svgExport";

const BUNDLE_FORMATS: { value: string; label: string }[] = [
  { value: "ohdsi_sharing_bundle", label: "OHDSI Sharing Bundle" },
  { value: "ohdsi_report_bundle", label: "OHDSI Report Bundle" },
  { value: "ohdsi_report_generator_r", label: "Report Generator (R)" },
];

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
  const [bundleFormat, setBundleFormat] = useState<string>("ohdsi_sharing_bundle");
  const [figuresMessage, setFiguresMessage] = useState<string | null>(null);
  const exportMutation = useExportDocument();
  const exportBundle = useExportReportBundle();
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

  const handleExportBundle = () => {
    const payload: PublicationReportBundleExportRequest = {
      format: bundleFormat,
      title,
      authors,
      template,
      sections: includedSections.map((section) => ({
        type: section.type,
        title: section.title,
        content: typeof section.content === "string"
          ? section.content
          : section.content
            ? JSON.stringify(section.content)
            : "",
        included: true,
      })),
    };
    exportBundle.mutate({ payload, filename: `${title || "publication"}-bundle.json` });
  };

  // Client-side figure export (the backend renders only docx/pdf/figures-zip).
  const handleExportFigures = async (format: "png" | "svg") => {
    setFiguresMessage(null);
    let count = 0;
    for (const section of includedSections) {
      const markup =
        section.svgMarkup ?? (section.diagramType ? getDiagramSvgMarkup(section.id) : undefined);
      if (!markup) continue;
      const safe = (section.title || section.id).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      if (format === "svg") {
        downloadBlob(markup, `${safe}.svg`, "image/svg+xml");
      } else {
        const dataUrl = await svgMarkupToPngDataUrl(markup);
        if (!dataUrl) continue;
        const anchor = document.createElement("a");
        anchor.href = dataUrl;
        anchor.download = `${safe}.png`;
        anchor.click();
      }
      count += 1;
    }
    setFiguresMessage(
      count === 0 ? "No figures found in the included sections." : `Exported ${count} figure(s).`,
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Draft warning */}
      {hasDraftNarratives && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm text-warning">
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
        className="btn btn-publish w-full justify-center"
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

      {/* Figure export (client-side vector/raster of the diagrams) */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4">
        <h3 className="mb-1 text-sm font-medium text-text-primary">Export figures</h3>
        <p className="mb-3 text-xs text-text-ghost">
          Download each chart in the included sections individually.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleExportFigures("png")}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
          >
            <ImageIcon className="h-3.5 w-3.5" /> PNG
          </button>
          <button
            type="button"
            onClick={() => void handleExportFigures("svg")}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
          >
            <Code className="h-3.5 w-3.5" /> SVG
          </button>
          {figuresMessage && <span className="text-xs text-text-ghost">{figuresMessage}</span>}
        </div>
      </div>

      {/* Reproducible OHDSI sharing bundle */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4">
        <h3 className="mb-1 text-sm font-medium text-text-primary">Reproducible sharing bundle</h3>
        <p className="mb-3 text-xs text-text-ghost">
          Export an OHDSI report bundle for reproducible sharing and re-import.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={bundleFormat}
            onChange={(e) => setBundleFormat(e.target.value)}
            className="form-input w-auto text-xs py-1.5"
          >
            {BUNDLE_FORMATS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExportBundle}
            disabled={includedSections.length === 0 || exportBundle.isPending}
            className="btn btn-secondary btn-sm flex items-center gap-1.5"
          >
            {exportBundle.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            Export bundle
          </button>
        </div>
        {exportBundle.isError && (
          <p className="mt-2 text-xs text-critical">
            {exportBundle.error instanceof Error ? exportBundle.error.message : "Bundle export failed."}
          </p>
        )}
      </div>

      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={onBack}
          className="btn btn-secondary btn-sm flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("publish.exportPanel.backToPreview")}
        </button>
      </div>
    </div>
  );
}
