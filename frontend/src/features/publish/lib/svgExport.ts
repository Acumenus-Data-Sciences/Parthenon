const PRESENTATION_ATTRIBUTES = [
  "fill",
  "stroke",
  "color",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  "stop-color",
  "stop-opacity",
  "flood-color",
  "lighting-color",
] as const;

function parsePositiveNumber(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function svgDimensions(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.viewBox.baseVal;
  const rect = svg.getBoundingClientRect();
  const width =
    (viewBox.width > 0 ? viewBox.width : undefined) ??
    parsePositiveNumber(svg.getAttribute("width")) ??
    (rect.width > 0 ? rect.width : undefined) ??
    800;
  const height =
    (viewBox.height > 0 ? viewBox.height : undefined) ??
    parsePositiveNumber(svg.getAttribute("height")) ??
    (rect.height > 0 ? rect.height : undefined) ??
    600;

  return { width, height };
}

function inlineComputedPresentation(
  source: Element,
  target: Element,
): void {
  const style = window.getComputedStyle(source);

  for (const attr of PRESENTATION_ATTRIBUTES) {
    const value = style.getPropertyValue(attr);
    if (value) {
      target.setAttribute(attr, value.trim());
    }
  }
}

function inlinePresentationStyles(
  sourceSvg: SVGSVGElement,
  targetSvg: SVGSVGElement,
): void {
  inlineComputedPresentation(sourceSvg, targetSvg);

  const sourceNodes = Array.from(sourceSvg.querySelectorAll("*"));
  const targetNodes = Array.from(targetSvg.querySelectorAll("*"));

  sourceNodes.forEach((sourceNode, index) => {
    const targetNode = targetNodes[index];
    if (targetNode) {
      inlineComputedPresentation(sourceNode, targetNode);
    }
  });
}

export function serializeSvgElement(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const { width, height } = svgDimensions(svg);

  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  inlinePresentationStyles(svg, clone);

  return new XMLSerializer().serializeToString(clone);
}

export function getDiagramSvgMarkup(sectionId: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const el = document.getElementById(`diagram-${sectionId}`);
  const svg = el?.querySelector("[data-diagram-canvas] svg");
  return svg instanceof SVGSVGElement ? serializeSvgElement(svg) : undefined;
}

export function svgMarkupToPngDataUrl(
  svgMarkup: string,
  scale = 2,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new window.Image();

    img.onload = () => {
      const width = img.naturalWidth || img.width || 800;
      const height = img.naturalHeight || img.height || 600;
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
