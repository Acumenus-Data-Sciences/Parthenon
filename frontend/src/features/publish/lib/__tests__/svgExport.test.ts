import { describe, expect, it } from "vitest";

import { serializeSvgElement } from "../svgExport";

describe("publish SVG export", () => {
  it("serializes standalone SVGs with dimensions and resolved presentation styles", () => {
    document.body.innerHTML = `
      <svg width="320" height="180" viewBox="0 0 320 180">
        <text style="fill: rgb(1, 2, 3); font-size: 12px;">Figure label</text>
      </svg>
    `;

    const svg = document.querySelector("svg") as SVGSVGElement;
    const serialized = serializeSvgElement(svg);

    expect(serialized).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(serialized).toContain('width="320"');
    expect(serialized).toContain('height="180"');
    expect(serialized).toContain("Figure label");
    expect(serialized).toContain('fill="rgb(1, 2, 3)"');
  });
});
