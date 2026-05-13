import type { DraftSection } from "../types/publish";

function findSectionSvg(sectionId: string): string | undefined {
  const container = document.querySelector(`[data-section-id="${sectionId}"]`);
  if (!container) return undefined;
  const svg = container.querySelector("svg");
  if (!svg) return undefined;
  return new XMLSerializer().serializeToString(svg);
}

export function captureSnapshots(sections: DraftSection[]): DraftSection[] {
  return sections.map((section) => {
    if (!section.diagramIncluded) return section;
    const live = findSectionSvg(section.id);
    if (live) return { ...section, svgMarkup: live };
    return section; // preserve any prior frozen markup
  });
}
