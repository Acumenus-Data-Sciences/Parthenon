import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { captureSnapshots } from "../snapshotCapture";
import type { DraftSection } from "../../types/publish";

describe("captureSnapshots", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("captures SVG markup from a section's diagram container", () => {
    const container = document.createElement("div");
    container.setAttribute("data-section-id", "results-1");
    container.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    document.body.appendChild(container);

    const sections: DraftSection[] = [
      {
        id: "results-1",
        type: "results",
        title: "Results",
        content: "",
        included: true,
        diagramIncluded: true,
        diagramType: "kaplan-meier",
      },
    ];
    const captured = captureSnapshots(sections);
    expect(captured[0].svgMarkup).toContain("<svg");
    expect(captured[0].svgMarkup).toContain("<rect");
  });

  it("preserves existing svgMarkup if no DOM element is found", () => {
    const sections: DraftSection[] = [
      {
        id: "missing",
        type: "results",
        title: "x",
        content: "",
        included: true,
        diagramIncluded: true,
        diagramType: "kaplan-meier",
        svgMarkup: "<svg>previously frozen</svg>",
      },
    ];
    const captured = captureSnapshots(sections);
    expect(captured[0].svgMarkup).toBe("<svg>previously frozen</svg>");
  });

  it("leaves sections without diagrams untouched", () => {
    const sections: DraftSection[] = [
      { id: "intro", type: "introduction", title: "I", content: "x", included: true },
    ];
    const captured = captureSnapshots(sections);
    expect(captured[0].svgMarkup).toBeUndefined();
    expect(captured[0]).toEqual(sections[0]);
  });

  it("does not mutate input sections", () => {
    const sections: DraftSection[] = [
      { id: "x", type: "results", title: "x", content: "", included: true, diagramIncluded: true },
    ];
    captureSnapshots(sections);
    expect(sections[0].svgMarkup).toBeUndefined();
  });
});
