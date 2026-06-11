import { Loader2, Download, FileType2 } from "lucide-react";
import { Button } from "@/components/ui";
import type { ManuscriptExportFormat } from "./types";

const FORMAT_ICON: Record<ManuscriptExportFormat, typeof Download> = {
  docx: Download,
  pdf: FileType2,
};

const FORMAT_LABEL: Record<ManuscriptExportFormat, string> = {
  docx: "DOCX",
  pdf: "PDF",
};

interface ExportMenuProps {
  onExport: (format: ManuscriptExportFormat) => void;
  isExporting?: boolean;
  /** The format currently exporting, to show a spinner on the right button. */
  pendingFormat?: ManuscriptExportFormat | null;
  formats?: ManuscriptExportFormat[];
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Gold "publishing"-accent export buttons (docx / pdf). Shared by the Studies
 * Manuscript tab and the /publish workspace so every publication export reads
 * as one recognizable action family.
 */
export function ExportMenu({
  onExport,
  isExporting = false,
  pendingFormat = null,
  formats = ["docx", "pdf"],
  disabled = false,
  size = "sm",
}: ExportMenuProps) {
  return (
    <div className="flex items-center gap-1.5">
      {formats.map((format) => {
        const Icon = FORMAT_ICON[format];
        const showSpinner = isExporting && pendingFormat === format;
        return (
          <Button
            key={format}
            type="button"
            variant="publish"
            size={size}
            onClick={() => onExport(format)}
            disabled={disabled || isExporting}
            className="flex items-center gap-1"
          >
            {showSpinner ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
            {FORMAT_LABEL[format]}
          </Button>
        );
      })}
    </div>
  );
}
