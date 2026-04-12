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
import type { ReportSection, ExportFormat } from "../types/publish";
import { useExportDocument } from "../hooks/useDocumentExport";
import type { ExportRequest } from "../api/publishApi";

type ExportableFormat = "docx" | "pdf" | "figures-zip";

interface ExportPanelProps {
  sections: ReportSection[];
  title: string;
  authors: string[];
  template: string;
  onBack: () => void;
}

const FORMAT_OPTIONS: Array<{
  format: ExportableFormat;
  icon: typeof FileText;
  label: string;
  description: string;
}> = [
  {
    format: "docx",
    icon: FileText,
    label: "Microsoft Word",
    description: "Journal-ready manuscript with embedded figures",
  },
  {
    format: "pdf",
    icon: FileDown,
    label: "PDF Document",
    description: "Print-ready document for review and sharing",
  },
  {
    format: "figures-zip",
    icon: ImageIcon,
    label: "Individual Figures",
    description: "SVG files for separate journal upload",
  },
];

function formatLabel(format: ExportableFormat): string {
  switch (format) {
    case "docx":
      return "DOCX";
    case "pdf":
      return "PDF";
    case "figures-zip":
      return "Figures ZIP";
  }
}

function getSvgFromDom(sectionId: string): string | undefined {
  const el = document.getElementById(`diagram-${sectionId}`);
  if (!el) return undefined;
  const svg = el.querySelector("[data-diagram-canvas] svg");
  if (!svg) return undefined;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}

function svgMarkupToPngDataUrl(svgMarkup: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new window.Image();

    img.onload = () => {
      const width = img.width || 800;
      const height = img.height || 600;
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(undefined);
        return;
      }

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(undefined);
    };

    img.src = url;
  });
}

export default function ExportPanel({
  sections,
  title,
  authors,
  template,
  onBack,
}: ExportPanelProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportableFormat>("docx");
  const exportMutation = useExportDocument();

  const includedSections = sections.filter((s) => s.included);
  const hasDraftNarratives = includedSections.some(
    (s) => s.narrativeState === "draft",
  );

  const handleExport = async () => {
    const exportSections: ExportRequest["sections"] = await Promise.all(
      includedSections.map(async (section) => {
        const svgMarkup =
          section.svgMarkup ??
          (section.diagramType ? getSvgFromDom(section.id) : undefined);

        return {
          type: section.type,
          title: section.title,
          content: typeof section.content === "string" ? section.content : (section.content ? JSON.stringify(section.content) : undefined),
          included: section.included,
          svg: svgMarkup,
          png_data_url:
            selectedFormat === "docx" && svgMarkup
              ? await svgMarkupToPngDataUrl(svgMarkup)
              : undefined,
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
            Some AI-generated sections are still in draft state. Please go back
            and accept or edit all AI content before exporting.
          </p>
        </div>
      )}

      {/* Format grid */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-text-primary">
          Choose Export Format
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {FORMAT_OPTIONS.map(({ format, icon: Icon, label, description }) => {
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
            Exporting...
          </>
        ) : (
          <>Export as {formatLabel(selectedFormat)}</>
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
          Back to Preview
        </button>
      </div>
    </div>
  );
}
