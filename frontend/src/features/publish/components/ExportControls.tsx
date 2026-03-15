// ---------------------------------------------------------------------------
// ExportControls — Format picker + export button
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Download, FileText, FileSpreadsheet, Image, Code, type LucideIcon } from "lucide-react";
import type { ExportFormat } from "../types/publish";

interface ExportControlsProps {
  onExport: (format: ExportFormat) => void;
  isExporting: boolean;
}

const FORMAT_OPTIONS: {
  value: ExportFormat;
  label: string;
  description: string;
  icon: LucideIcon;
  available: boolean;
}[] = [
  {
    value: "pdf",
    label: "PDF",
    description: "Full formatted report via print dialog",
    icon: FileText,
    available: true,
  },
  {
    value: "docx",
    label: "DOCX",
    description: "Structured Word document",
    icon: FileText,
    available: false,
  },
  {
    value: "xlsx",
    label: "XLSX",
    description: "Tables and statistics as spreadsheet",
    icon: FileSpreadsheet,
    available: false,
  },
  {
    value: "png",
    label: "PNG",
    description: "Charts as raster image files",
    icon: Image,
    available: true,
  },
  {
    value: "svg",
    label: "SVG",
    description: "Charts as vector image files",
    icon: Code,
    available: true,
  },
];

/**
 * Export format picker with radio buttons and export trigger button.
 */
export function ExportControls({ onExport, isExporting }: ExportControlsProps) {
  const [selected, setSelected] = useState<ExportFormat>("pdf");

  return (
    <div data-testid="export-controls" className="space-y-6">
      {/* Format selector */}
      <div>
        <h3 className="text-sm font-semibold text-[#F0EDE8] mb-3">
          Export Format
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FORMAT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selected === opt.value;

            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                  isSelected
                    ? "border-[#2DD4BF] bg-[#2DD4BF]/10"
                    : "border-[#232328] bg-[#151518] hover:border-[#2DD4BF]/40"
                }`}
              >
                <Icon
                  size={18}
                  className={isSelected ? "text-[#2DD4BF]" : "text-[#F0EDE8]/40"}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium ${
                        isSelected ? "text-[#2DD4BF]" : "text-[#F0EDE8]"
                      }`}
                    >
                      {opt.label}
                    </span>
                    {!opt.available && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#C9A227]/20 text-[#C9A227]">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#F0EDE8]/40 mt-0.5">
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
        className="flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-5 py-2.5 text-sm font-semibold text-[#0E0E11] hover:bg-[#2DD4BF]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Download size={16} />
        {isExporting ? "Exporting..." : `Export as ${selected.toUpperCase()}`}
      </button>
    </div>
  );
}
