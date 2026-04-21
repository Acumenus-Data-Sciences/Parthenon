import { useCallback, useRef, type ReactNode } from "react";
import { Download, Image } from "lucide-react";
import { useTranslation } from "react-i18next";

interface DiagramWrapperProps {
  title: string;
  caption?: string;
  figureNumber?: number;
  children: ReactNode;
  onExportSvg?: () => void;
  onExportPng?: () => void;
}

function extractSvgElement(container: HTMLElement): SVGSVGElement | null {
  return container.querySelector("svg");
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function serializeSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  return new XMLSerializer().serializeToString(clone);
}

export default function DiagramWrapper({
  title,
  caption,
  figureNumber,
  children,
  onExportSvg,
  onExportPng,
}: DiagramWrapperProps) {
  const { t } = useTranslation("app");
  const containerRef = useRef<HTMLDivElement>(null);

  const slugTitle = title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

  const handleExportSvg = useCallback(() => {
    if (onExportSvg) {
      onExportSvg();
      return;
    }
    if (!containerRef.current) return;
    const svg = extractSvgElement(containerRef.current);
    if (!svg) return;

    const svgString = serializeSvg(svg);
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, `${slugTitle}.svg`);
  }, [onExportSvg, slugTitle]);

  const handleExportPng = useCallback(() => {
    if (onExportPng) {
      onExportPng();
      return;
    }
    if (!containerRef.current) return;
    const svg = extractSvgElement(containerRef.current);
    if (!svg) return;

    const svgString = serializeSvg(svg);
    const svgWidth = svg.viewBox.baseVal.width || svg.getBoundingClientRect().width;
    const svgHeight = svg.viewBox.baseVal.height || svg.getBoundingClientRect().height;
    const scale = 2; // 2x for retina quality

    const canvas = document.createElement("canvas");
    canvas.width = svgWidth * scale;
    canvas.height = svgHeight * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new window.Image();
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          downloadBlob(pngBlob, `${slugTitle}.png`);
        }
      }, "image/png");
    };
    img.src = url;
  }, [onExportPng, slugTitle]);

  const displayTitle = figureNumber != null
    ? `Figure ${figureNumber}. ${title}`
    : title;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">{displayTitle}</h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleExportSvg}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-text-ghost hover:bg-gray-100 hover:text-gray-700"
            title={t("publish.diagram.exportSvg")}
          >
            <Download className="h-3 w-3" />
            SVG
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-text-ghost hover:bg-gray-100 hover:text-gray-700"
            title={t("publish.diagram.exportPng")}
          >
            <Image className="h-3 w-3" />
            PNG
          </button>
        </div>
      </div>
      <div ref={containerRef} data-diagram-canvas className="flex justify-center p-4">
        {children}
      </div>
      {caption && (
        <div className="border-t border-gray-100 px-4 py-2">
          <p className="text-xs italic text-text-ghost">{caption}</p>
        </div>
      )}
    </div>
  );
}
