import { describe, expect, it } from "vitest";

import { buildDiagramData } from "../diagramBuilders";
import { SECTION_CONFIG } from "../sectionConfig";
import { buildTableFromResults } from "../tableBuilders";
import type { SelectedExecution } from "../../types/publish";

function makeExecution(
  analysisType: string,
  resultJson: Record<string, unknown>,
): SelectedExecution {
  return {
    executionId: 1,
    analysisId: 1,
    analysisType,
    analysisName: `${analysisType} analysis`,
    resultJson,
    designJson: {},
  };
}

describe("publish result mappers", () => {
  it("builds an evidence-synthesis forest plot from per_site and pooled data", () => {
    const diagram = buildDiagramData("forest_plot", [
      makeExecution("evidence_synthesis", {
        per_site: [
          { site_name: "Site A", hr: 1.21, ci_lower: 1.01, ci_upper: 1.45 },
          { site_name: "Site B", hr: 0.94, ci_lower: 0.8, ci_upper: 1.11 },
        ],
        pooled: { hr: 1.08, ci_lower: 0.98, ci_upper: 1.19 },
      }),
    ]);

    expect(diagram).toEqual({
      data: [
        { label: "Site A", estimate: 1.21, ci_lower: 1.01, ci_upper: 1.45 },
        { label: "Site B", estimate: 0.94, ci_lower: 0.8, ci_upper: 1.11 },
      ],
      pooled: { estimate: 1.08, ci_lower: 0.98, ci_upper: 1.19 },
      xLabel: "Hazard Ratio",
    });
  });

  it("builds an evidence-synthesis table from normalized pooled results", () => {
    const table = buildTableFromResults("evidence_synthesis", [
      makeExecution("evidence_synthesis", {
        pooled: { hr: 1.08, ci_lower: 0.98, ci_upper: 1.19 },
        heterogeneity: { i_squared: 22.4 },
      }),
    ]);

    expect(table?.rows).toEqual([
      {
        Analysis: "evidence_synthesis analysis",
        "Pooled Estimate": 1.08,
        "95% CI": "0.98–1.19",
        "I²": "22.4%",
      },
    ]);
  });

  it("does not auto-assign unsupported diagrams to characterization and prediction", () => {
    expect(SECTION_CONFIG.characterization.diagramType).toBeNull();
    expect(SECTION_CONFIG.characterizations.diagramType).toBeNull();
    expect(SECTION_CONFIG.prediction.diagramType).toBeNull();
    expect(SECTION_CONFIG.predictions.diagramType).toBeNull();
  });
});
